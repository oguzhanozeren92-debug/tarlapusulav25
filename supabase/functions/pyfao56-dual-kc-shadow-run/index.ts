import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INPUT_ADAPTER_VERSION = 2;
const RUNNER_VERSION = 2;
const GATEWAY_ROUTE = '/v1/irrigation/pyfao56/dual-kc-shadow';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Dual-Kc shadow için Supabase sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new Error('Dual-Kc shadow için geçerli kullanıcı oturumu gerekli.');
  }

  return {
    user: data.user,
    serviceClient,
    supabaseUrl,
    anonKey,
    authorization,
  };
}

async function loadInputs(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/functions/v1/pyfao56-dual-kc-shadow-inputs`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field_id: fieldId }),
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload?.error ?? `Dual-Kc input adapter HTTP ${response.status}`);
  }
  if (payload.production_authority !== false || payload.input_authority !== 'server-derived') {
    throw new Error('Dual-Kc input adapter trust boundary doğrulanamadı.');
  }

  return payload;
}

async function persistRun(serviceClient: any, values: Record<string, unknown>) {
  const { error } = await serviceClient.from('model_engine_runs').upsert(values, {
    onConflict: 'user_id,field_id,engine,mode,input_fingerprint',
  });
  if (error) {
    console.error('[pyfao56-dual-kc-shadow-run] run persistence failed', error.message);
  }
}

async function loadCachedCompletedRun(
  serviceClient: any,
  userId: string,
  fieldId: string,
  fingerprint: string,
) {
  const { data, error } = await serviceClient
    .from('model_engine_runs')
    .select('output,engine_version,completed_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('engine', 'pyfao56')
    .eq('mode', 'shadow')
    .eq('status', 'completed')
    .eq('input_fingerprint', fingerprint)
    .maybeSingle();

  if (error) {
    console.warn('[pyfao56-dual-kc-shadow-run] cached run lookup failed', error.message);
    return null;
  }

  const output = data?.output;
  if (
    !output ||
    output.engine !== 'pyfao56' ||
    output.mode !== 'shadow' ||
    output.shadow_scope !== 'dual_kc_water_balance_bounded_rew' ||
    output.production_authority !== false
  ) {
    return null;
  }

  return {
    result: output,
    engineVersion: data?.engine_version ?? null,
    completedAt: data?.completed_at ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = [
      'latitude',
      'longitude',
      'station',
      'basal_profile',
      'kcb',
      'rew',
      'rew_values_mm',
      'fw',
      'theta_fc',
      'theta_wp',
      'initial_de_mm',
      'initial_dr_mm',
      'root_depth_m',
      'state',
      'weather',
      'days',
      'irrigation_events',
      'parameters',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'Dual-Kc tarımsal/model girdileri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
      }, 400);
    }

    const gatewayUrl = (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, '');
    const gatewayKey = Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '';
    if (!gatewayUrl || !gatewayKey) {
      return json({
        ok: false,
        blocked: true,
        engine: 'pyfao56',
        mode: 'shadow',
        missing_inputs: ['model_gateway_connection'],
        production_authority: false,
      }, 503);
    }

    const {
      user,
      serviceClient,
      supabaseUrl,
      anonKey,
      authorization,
    } = await authenticatedClients(req);

    const inputs = await loadInputs(
      supabaseUrl,
      anonKey,
      authorization,
      fieldId,
    );

    const missing = Array.isArray(inputs?.missing_inputs)
      ? [...new Set(inputs.missing_inputs.map((item: unknown) => String(item)))]
      : [];
    const modelPayload = inputs?.gateway_payload ?? null;
    const notApplicable = inputs?.status === 'not_applicable';

    if (notApplicable) {
      const fingerprint = await sha256({
        fieldId,
        status: 'not_applicable',
        inputAdapterVersion: INPUT_ADAPTER_VERSION,
        runnerVersion: RUNNER_VERSION,
      });

      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'pyfao56',
        mode: 'shadow',
        status: 'blocked',
        input_fingerprint: fingerprint,
        input_summary: {
          server_derived: true,
          dual_kc: true,
          reason: 'rainfed_not_applicable',
        },
        source_versions: {
          pyfao56_dual_input_adapter: INPUT_ADAPTER_VERSION,
          pyfao56_dual_shadow_runner: RUNNER_VERSION,
        },
        missing_inputs: [],
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      });

      return json({
        ok: true,
        blocked: true,
        not_applicable: true,
        cached: false,
        engine: 'pyfao56',
        mode: 'shadow',
        field_id: fieldId,
        production_authority: false,
        missing_inputs: [],
        note: inputs?.note ?? 'Bu tarla için sulama dual-Kc shadow modeli uygulanmıyor.',
      });
    }

    if (inputs?.ready !== true || !modelPayload || missing.length > 0) {
      const fingerprint = await sha256({
        fieldId,
        missing: [...missing].sort(),
        evidence: inputs?.evidence ?? null,
        inputAdapterVersion: INPUT_ADAPTER_VERSION,
        runnerVersion: RUNNER_VERSION,
      });

      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'pyfao56',
        mode: 'shadow',
        status: 'blocked',
        input_fingerprint: fingerprint,
        input_summary: {
          server_derived: true,
          dual_kc: true,
          crop: inputs?.field?.crop ?? null,
          irrigation_status: inputs?.field?.irrigation_status ?? null,
          root_state_source: inputs?.evidence?.root_zone?.source ?? null,
          surface_state_source: inputs?.evidence?.surface_evaporation?.depletion_source ?? null,
        },
        source_versions: {
          pyfao56_dual_input_adapter: INPUT_ADAPTER_VERSION,
          pyfao56_dual_shadow_runner: RUNNER_VERSION,
          crop_reference: inputs?.evidence?.basal_kcb?.reference_version ?? null,
        },
        missing_inputs: [...missing].sort(),
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      });

      return json({
        ok: true,
        blocked: true,
        cached: false,
        engine: 'pyfao56',
        mode: 'shadow',
        field_id: fieldId,
        production_authority: false,
        missing_inputs: [...missing].sort(),
        evidence: inputs?.evidence ?? null,
        note: 'Eksik gerçek saha/model girdileri nedeniyle dual-Kc shadow çalıştırılmadı; sentetik Kcb, De, Dr, REW veya canopy değeri üretilmedi.',
      });
    }

    const fingerprint = await sha256({
      modelPayload,
      inputAdapterVersion: INPUT_ADAPTER_VERSION,
      runnerVersion: RUNNER_VERSION,
      route: GATEWAY_ROUTE,
    });

    const cached = await loadCachedCompletedRun(
      serviceClient,
      user.id,
      fieldId,
      fingerprint,
    );
    if (cached) {
      return json({
        ok: true,
        blocked: false,
        cached: true,
        engine: 'pyfao56',
        mode: 'shadow',
        field_id: fieldId,
        production_authority: false,
        missing_inputs: [],
        completed_at: cached.completedAt,
        result: cached.result,
      });
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'pyfao56',
      mode: 'shadow',
      status: 'running',
      input_fingerprint: fingerprint,
      input_summary: {
        server_derived: true,
        dual_kc: true,
        crop: inputs?.field?.crop ?? null,
        irrigation_status: inputs?.field?.irrigation_status ?? null,
        weather_day_count: Array.isArray(modelPayload?.days) ? modelPayload.days.length : null,
        rew_values_mm: modelPayload?.rew_values_mm ?? null,
        irrigation_method: inputs?.field?.irrigation_method ?? null,
        irrigation_wetting_fraction_range: modelPayload?.irrigation_wetting_fraction_range ?? null,
        root_state_source: inputs?.evidence?.root_zone?.source ?? null,
        surface_state_source: inputs?.evidence?.surface_evaporation?.depletion_source ?? null,
      },
      source_versions: {
        weather: 'Open-Meteo forecast',
        pyfao56_dual_input_adapter: INPUT_ADAPTER_VERSION,
        pyfao56_dual_shadow_runner: RUNNER_VERSION,
        gateway_route: GATEWAY_ROUTE,
      },
      missing_inputs: [],
      adapter_version: RUNNER_VERSION,
      output: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch(`${gatewayUrl}${GATEWAY_ROUTE}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Model-Gateway-Key': gatewayKey,
        },
        body: JSON.stringify(modelPayload),
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await gatewayResponse.json().catch(() => null);
    if (!gatewayResponse.ok || !result || result.ok === false) {
      const errorMessage = String(
        result?.detail ??
        result?.error ??
        `Model Gateway HTTP ${gatewayResponse.status}`,
      );

      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'pyfao56',
        mode: 'shadow',
        status: 'failed',
        input_fingerprint: fingerprint,
        input_summary: {
          server_derived: true,
          dual_kc: true,
          weather_day_count: Array.isArray(modelPayload?.days) ? modelPayload.days.length : null,
        },
        source_versions: {
          pyfao56_dual_input_adapter: INPUT_ADAPTER_VERSION,
          pyfao56_dual_shadow_runner: RUNNER_VERSION,
          gateway_route: GATEWAY_ROUTE,
        },
        missing_inputs: [],
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: errorMessage.slice(0, 2000),
        completed_at: new Date().toISOString(),
      });

      return json({
        ok: false,
        error: errorMessage,
        engine: 'pyfao56',
        mode: 'shadow',
        production_authority: false,
      }, 502);
    }

    if (
      result.production_authority !== false ||
      result.engine !== 'pyfao56' ||
      result.mode !== 'shadow' ||
      result.shadow_scope !== 'dual_kc_water_balance_bounded_rew'
    ) {
      throw new Error('Dual-Kc gateway response trust boundary doğrulanamadı.');
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'pyfao56',
      mode: 'shadow',
      status: 'completed',
      input_fingerprint: fingerprint,
      input_summary: {
        server_derived: true,
        dual_kc: true,
        crop: inputs?.field?.crop ?? null,
        irrigation_status: inputs?.field?.irrigation_status ?? null,
        weather_day_count: Array.isArray(modelPayload?.days) ? modelPayload.days.length : null,
        rew_values_mm: modelPayload?.rew_values_mm ?? null,
        irrigation_method: inputs?.field?.irrigation_method ?? null,
        irrigation_wetting_fraction_range: modelPayload?.irrigation_wetting_fraction_range ?? null,
        root_state_source: inputs?.evidence?.root_zone?.source ?? null,
        surface_state_source: inputs?.evidence?.surface_evaporation?.depletion_source ?? null,
      },
      source_versions: {
        weather: 'Open-Meteo forecast',
        pyfao56_dual_input_adapter: INPUT_ADAPTER_VERSION,
        pyfao56_dual_shadow_runner: RUNNER_VERSION,
        gateway_route: GATEWAY_ROUTE,
      },
      missing_inputs: [],
      engine_version: result.engine_version ?? null,
      adapter_version: RUNNER_VERSION,
      output: result,
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    return json({
      ok: true,
      blocked: false,
      cached: false,
      engine: 'pyfao56',
      mode: 'shadow',
      field_id: fieldId,
      production_authority: false,
      missing_inputs: [],
      result,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Dual-Kc shadow çalıştırılamadı.';
    console.error('[pyfao56-dual-kc-shadow-run]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({
      ok: false,
      error: message,
      engine: 'pyfao56',
      mode: 'shadow',
      production_authority: false,
    }, status);
  }
});
