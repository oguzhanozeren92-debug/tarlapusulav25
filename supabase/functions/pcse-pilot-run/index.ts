import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCHIVE_LAG_DAYS = 6;
const MAX_DURATION_DAYS = 365;
const RUNNER_VERSION = 4;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function dateOnly(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('PCSE pilot için Supabase sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('PCSE pilot için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient, supabaseUrl, anonKey, authorization };
}

async function loadInputAdapters(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/pcse-pilot-inputs`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ field_id: fieldId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload?.error ?? `PCSE input adapter HTTP ${response.status}`);
  }
  if (payload.production_authority !== false || payload.input_authority !== 'server-derived') {
    throw new Error('PCSE input adapter trust boundary doğrulanamadı.');
  }
  return payload;
}

async function persistRun(serviceClient: any, values: Record<string, unknown>) {
  const { error } = await serviceClient.from('model_engine_runs').upsert(values, {
    onConflict: 'user_id,field_id,engine,mode,input_fingerprint',
  });
  if (error) console.error('[pcse-pilot-run] run persistence failed', error.message);
}

async function queueVarietyMappingRequest(serviceClient: any, inputs: any) {
  const localVarietyName = String(inputs?.context?.farmer_variety_name ?? '').trim();
  const mappedVarietyKey = String(inputs?.context?.wofost_variety_key ?? '').trim();
  const wofostCropKey = String(inputs?.context?.wofost_crop_key ?? '').trim();
  const cropName = String(inputs?.context?.crop_identity ?? wofostCropKey).trim();

  if (!localVarietyName || mappedVarietyKey || !wofostCropKey || !cropName) return false;

  const normalizedLocalVarietyName = normalizeText(localVarietyName);
  if (!normalizedLocalVarietyName) return false;

  const { data: existing, error: lookupError } = await serviceClient
    .from('pcse_variety_mapping_requests')
    .select('id,status')
    .eq('crop_name', cropName)
    .eq('normalized_local_variety_name', normalizedLocalVarietyName)
    .eq('model_version', '7.2')
    .maybeSingle();

  if (lookupError) {
    console.warn('[pcse-pilot-run] variety mapping request lookup failed', lookupError.message);
    return false;
  }

  const now = new Date().toISOString();
  if (existing?.id) {
    const { error } = await serviceClient
      .from('pcse_variety_mapping_requests')
      .update({
        local_variety_name: localVarietyName,
        wofost_crop_key: wofostCropKey,
        last_seen_at: now,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) {
      console.warn('[pcse-pilot-run] variety mapping request refresh failed', error.message);
      return false;
    }
    return true;
  }

  const { error } = await serviceClient
    .from('pcse_variety_mapping_requests')
    .insert({
      crop_name: cropName,
      local_variety_name: localVarietyName,
      normalized_local_variety_name: normalizedLocalVarietyName,
      wofost_crop_key: wofostCropKey,
      model_family: 'WOFOST',
      model_version: '7.2',
      status: 'pending',
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    });

  if (error) {
    console.warn('[pcse-pilot-run] variety mapping request insert failed', error.message);
    return false;
  }
  return true;
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
    .eq('engine', 'pcse')
    .eq('mode', 'pilot')
    .eq('status', 'completed')
    .eq('input_fingerprint', fingerprint)
    .maybeSingle();

  if (error) {
    console.warn('[pcse-pilot-run] cached run lookup failed', error.message);
    return null;
  }

  const output = data?.output;
  if (
    !output ||
    output.engine !== 'pcse' ||
    output.mode !== 'phenology_pilot' ||
    output.production_authority !== false ||
    output.water_stress_authority !== false
  ) {
    return null;
  }

  return {
    result: output,
    completedAt: data?.completed_at ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = ['latitude', 'longitude', 'crop_key', 'variety_key', 'planting_date', 'weather', 'parameters'];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'PCSE tarımsal/model girdileri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
      }, 400);
    }

    const gatewayUrl = (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, '');
    const gatewayKey = Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '';
    if (!gatewayUrl || !gatewayKey) {
      return json({ ok: false, blocked: true, missing_inputs: ['model_gateway_connection'], production_authority: false }, 503);
    }

    const { user, serviceClient, supabaseUrl, anonKey, authorization } = await authenticatedClients(req);
    const inputs = await loadInputAdapters(supabaseUrl, anonKey, authorization, fieldId);
    const mappingRequestQueued = await queueVarietyMappingRequest(serviceClient, inputs);
    const missing = new Set<string>(Array.isArray(inputs?.missing_inputs) ? inputs.missing_inputs.map(String) : []);

    const location = inputs?.adapters?.field_location;
    const crop = inputs?.adapters?.crop_parameters?.parameters;
    const planting = inputs?.adapters?.planting_date;
    const latitude = finite(location?.latitude);
    const longitude = finite(location?.longitude);
    const plantingDate = dateOnly(inputs?.context?.planting_date ?? planting?.plantingDate);
    const rawHarvestDate = dateOnly(inputs?.context?.harvest_date);
    const cropKey = String(crop?.wofost_crop_key ?? '').trim();
    const varietyKey = String(crop?.wofost_variety_key ?? '').trim();

    if (latitude === null || longitude === null) missing.add('field_location');
    if (!plantingDate) missing.add('planting_date');
    if (!cropKey || !varietyKey) missing.add('crop_parameters');

    const asOfDate = isoDateDaysAgo(ARCHIVE_LAG_DAYS);
    if (plantingDate && asOfDate < plantingDate) missing.add('daily_weather');
    if (plantingDate && asOfDate >= plantingDate && daysBetween(plantingDate, asOfDate) > MAX_DURATION_DAYS) {
      missing.add('simulation_window_too_long');
    }

    const harvestDate = rawHarvestDate && plantingDate && rawHarvestDate >= plantingDate && rawHarvestDate <= asOfDate
      ? rawHarvestDate
      : null;

    if (missing.size) {
      const fingerprint = await sha256({
        fieldId,
        missing: Array.from(missing).sort(),
        inputAdapterVersion: 4,
        runnerVersion: RUNNER_VERSION,
        asOfDate,
      });
      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'pcse',
        mode: 'pilot',
        status: 'blocked',
        input_fingerprint: fingerprint,
        input_summary: {
          planting_date: plantingDate,
          farmer_variety_name: inputs?.context?.farmer_variety_name ?? null,
          server_derived: true,
          phenology_only: true,
        },
        source_versions: {
          pcse_input_adapter: 4,
          pcse_pilot_runner: RUNNER_VERSION,
          model: 'Wofost72_Phenology',
        },
        missing_inputs: Array.from(missing).sort(),
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      });
      return json({
        ok: true,
        blocked: true,
        cached: false,
        engine: 'pcse',
        mode: 'pilot',
        field_id: fieldId,
        production_authority: false,
        water_stress_authority: false,
        missing_inputs: Array.from(missing).sort(),
        variety_mapping_request_queued: mappingRequestQueued,
        note: 'Eksik gerçek fenoloji girdileri nedeniyle PCSE çalıştırılmadı; sentetik ürün, çeşit veya tarih üretilmedi.',
      });
    }

    const modelPayload = {
      field_id: fieldId,
      latitude,
      longitude,
      crop_key: cropKey,
      variety_key: varietyKey,
      planting_date: plantingDate,
      as_of_date: asOfDate,
      harvest_date: harvestDate,
      max_duration_days: MAX_DURATION_DAYS,
    };
    const fingerprint = await sha256({
      modelPayload,
      inputAdapterVersion: 4,
      runnerVersion: RUNNER_VERSION,
      model: 'Wofost72_Phenology',
    });

    const cached = await loadCachedCompletedRun(serviceClient, user.id, fieldId, fingerprint);
    if (cached) {
      return json({
        ok: true,
        blocked: false,
        cached: true,
        engine: 'pcse',
        mode: 'pilot',
        field_id: fieldId,
        production_authority: false,
        water_stress_authority: false,
        missing_inputs: [],
        completed_at: cached.completedAt,
        result: cached.result,
      });
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'pcse',
      mode: 'pilot',
      status: 'running',
      input_fingerprint: fingerprint,
      input_summary: {
        planting_date: plantingDate,
        as_of_date: asOfDate,
        crop_key: cropKey,
        variety_key: varietyKey,
        farmer_variety_name: inputs?.context?.farmer_variety_name ?? null,
        server_derived: true,
        phenology_only: true,
      },
      source_versions: {
        weather: 'Open-Meteo ERA5-Land via PCSE',
        crop_parameters: inputs?.adapters?.crop_parameters?.sourceReference ?? null,
        pcse_input_adapter: 4,
        pcse_pilot_runner: RUNNER_VERSION,
        model: 'Wofost72_Phenology',
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
      gatewayResponse = await fetch(`${gatewayUrl}/v1/phenology/pcse/pilot`, {
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
      const errorMessage = String(result?.detail ?? result?.error ?? `Model Gateway HTTP ${gatewayResponse.status}`);
      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'pcse',
        mode: 'pilot',
        status: 'failed',
        input_fingerprint: fingerprint,
        input_summary: { planting_date: plantingDate, as_of_date: asOfDate, server_derived: true, phenology_only: true },
        source_versions: {
          weather: 'Open-Meteo ERA5-Land via PCSE',
          pcse_input_adapter: 4,
          pcse_pilot_runner: RUNNER_VERSION,
          model: 'Wofost72_Phenology',
        },
        missing_inputs: [],
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: errorMessage.slice(0, 2000),
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, error: errorMessage, production_authority: false }, 502);
    }

    if (
      result.production_authority !== false ||
      result.water_stress_authority !== false ||
      result.engine !== 'pcse' ||
      result.mode !== 'phenology_pilot' ||
      result.model !== 'Wofost72_Phenology' ||
      result?.simulation?.production_level !== 'phenology_only'
    ) {
      throw new Error('PCSE gateway response trust boundary doğrulanamadı.');
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'pcse',
      mode: 'pilot',
      status: 'completed',
      input_fingerprint: fingerprint,
      input_summary: {
        planting_date: plantingDate,
        as_of_date: asOfDate,
        crop_key: cropKey,
        variety_key: varietyKey,
        server_derived: true,
        phenology_only: true,
      },
      source_versions: {
        weather: 'Open-Meteo ERA5-Land via PCSE',
        crop_parameters: inputs?.adapters?.crop_parameters?.sourceReference ?? null,
        pcse_input_adapter: 4,
        pcse_pilot_runner: RUNNER_VERSION,
        model: 'Wofost72_Phenology',
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
      engine: 'pcse',
      mode: 'pilot',
      field_id: fieldId,
      production_authority: false,
      water_stress_authority: false,
      missing_inputs: [],
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PCSE fenoloji pilotu çalıştırılamadı.';
    console.error('[pcse-pilot-run]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
