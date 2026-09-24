import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { buildShadowComparison } from './comparison-core.mjs';
import { buildCalibrationState } from './calibration-core.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const COMPLETE_FRESHNESS_HOURS = 24;
const INCOMPLETE_FRESHNESS_HOURS = 1;
const ENGINE_TIMEOUT_MS = 80_000;
const EXPERIMENT_TIMEOUT_MS = 30_000;
const FUNCTION_VERSION = 4;
const CALIBRATION_VERSION = 1;

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
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Shadow model karşılaştırması için sunucu kimlik bilgileri veya kullanıcı oturumu eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('Shadow model karşılaştırması için geçerli kullanıcı oturumu gerekli.');

  return { user: data.user, serviceClient, supabaseUrl, anonKey, authorization };
}

async function callEngine(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  slug: string,
  fieldId: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field_id: fieldId }),
    });

    const payload = await response.json().catch(() => null);
    if (response.ok && payload && typeof payload === 'object') return payload;

    return {
      ok: false,
      blocked: false,
      error: String(payload?.error ?? payload?.detail ?? `${slug} HTTP ${response.status}`),
      http_status: response.status,
      production_authority: false,
    };
  } catch (error) {
    return {
      ok: false,
      blocked: false,
      error: error instanceof Error ? error.message : `${slug} çağrısı başarısız oldu.`,
      production_authority: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callPusulaExperimentBestEffort(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPERIMENT_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/pusula-experiment-evaluate`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field_id: fieldId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object') {
      console.warn('[model-shadow-comparison] Pusula Deneyi güncellenemedi', response.status);
      return null;
    }
    return payload;
  } catch (error) {
    console.warn(
      '[model-shadow-comparison] Pusula Deneyi güncellenemedi',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFreshComparison(serviceClient: any, userId: string, fieldId: string) {
  const { data, error } = await serviceClient
    .from('model_shadow_comparisons')
    .select('comparison_day,comparison_as_of,season_key,status,severity,updated_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[model-shadow-comparison] cache lookup failed', error.message);
    return null;
  }
  if (!data) return null;

  const updatedAt = Date.parse(String(data.updated_at ?? ''));
  if (!Number.isFinite(updatedAt)) return null;
  const freshnessHours = data.status === 'complete'
    ? COMPLETE_FRESHNESS_HOURS
    : INCOMPLETE_FRESHNESS_HOURS;
  const freshnessMs = freshnessHours * 60 * 60 * 1000;
  return Date.now() - updatedAt <= freshnessMs ? data : null;
}

async function persistComparison(
  serviceClient: any,
  userId: string,
  fieldId: string,
  comparison: any,
  fingerprint: string,
) {
  const now = new Date().toISOString();
  const { error } = await serviceClient
    .from('model_shadow_comparisons')
    .upsert({
      user_id: userId,
      field_id: fieldId,
      comparison_day: comparison.comparison_day,
      season_key: comparison.season_key,
      comparison_as_of: comparison.comparison_as_of,
      status: comparison.status,
      severity: comparison.severity,
      fingerprint,
      engines: comparison.engines,
      normalized: {
        ...comparison.normalized,
        function_version: FUNCTION_VERSION,
        internal_only: true,
      },
      divergences: comparison.divergences,
      production_authority: false,
      user_visible: false,
      updated_at: now,
    }, {
      onConflict: 'user_id,field_id,comparison_day',
    });

  if (error) throw new Error(`Shadow comparison persistence failed: ${error.message}`);
}

async function refreshCalibrationState(
  serviceClient: any,
  userId: string,
  fieldId: string,
  seasonKey: string,
) {
  const { data, error } = await serviceClient
    .from('model_shadow_comparisons')
    .select('comparison_day,season_key,status,severity,engines,normalized,divergences')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('season_key', seasonKey)
    .order('comparison_day', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Shadow calibration history failed: ${error.message}`);

  const calibration = buildCalibrationState({
    seasonKey,
    rows: Array.isArray(data) ? data : [],
  });
  const now = new Date().toISOString();

  const { error: persistError } = await serviceClient
    .from('model_shadow_calibration_states')
    .upsert({
      user_id: userId,
      field_id: fieldId,
      season_key: calibration.season_key,
      status: calibration.status,
      review_eligible: calibration.review_eligible,
      required_clean_phenology_days: calibration.required_clean_phenology_days,
      phenology_comparable_days: calibration.phenology_comparable_days,
      phenology_clean_streak: calibration.phenology_clean_streak,
      phenology_watch_days: calibration.phenology_watch_days,
      phenology_high_days: calibration.phenology_high_days,
      aquacrop_completed_days: calibration.aquacrop_completed_days,
      required_aquacrop_evidence_days: calibration.required_aquacrop_evidence_days,
      water_evidence_state: calibration.water_evidence_state,
      latest_comparison_day: calibration.latest_comparison_day,
      latest_comparison_status: calibration.latest_comparison_status,
      latest_phenology_comparable: calibration.latest_phenology_comparable,
      latest_agronomic_severity: calibration.latest_agronomic_severity,
      last_divergence_day: calibration.last_divergence_day,
      distinct_days: calibration.distinct_days,
      evidence: {
        ...calibration.evidence,
        calibration_version: CALIBRATION_VERSION,
      },
      production_authority: false,
      user_visible: false,
      updated_at: now,
    }, {
      onConflict: 'user_id,field_id,season_key',
    });

  if (persistError) {
    throw new Error(`Shadow calibration persistence failed: ${persistError.message}`);
  }
  return calibration;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = [
      'crop', 'planting_date', 'weather', 'soil', 'parameters', 'available_inputs',
      'pcse', 'aquacrop', 'cropforge', 'force', 'severity', 'thresholds', 'calibration',
      'experiment', 'field_observations', 'satellite', 'ndvi',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'Shadow karşılaştırma girdileri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
      }, 400);
    }

    const { user, serviceClient, supabaseUrl, anonKey, authorization } = await authenticatedClients(req);

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const cached = await loadFreshComparison(serviceClient, user.id, fieldId);
    if (cached) {
      const calibration = await refreshCalibrationState(
        serviceClient,
        user.id,
        fieldId,
        String(cached.season_key ?? 'unknown'),
      );
      const experiment = calibration.review_eligible
        ? await callPusulaExperimentBestEffort(supabaseUrl, anonKey, authorization, fieldId)
        : null;
      return json({
        ok: true,
        cached: true,
        field_id: fieldId,
        status: cached.status,
        severity: cached.severity,
        comparison_day: cached.comparison_day,
        comparison_as_of: cached.comparison_as_of,
        season_key: cached.season_key,
        calibration_status: calibration.status,
        calibration_review_eligible: calibration.review_eligible,
        phenology_clean_streak: calibration.phenology_clean_streak,
        water_evidence_state: calibration.water_evidence_state,
        experiment_status: experiment?.status ?? null,
        experiment_review_ready: experiment?.review_ready === true,
        production_authority: false,
        user_visible: false,
        internal_only: true,
      });
    }

    const [pcse, aquacrop, cropforge] = await Promise.all([
      callEngine(supabaseUrl, anonKey, authorization, 'pcse-pilot-run', fieldId),
      callEngine(supabaseUrl, anonKey, authorization, 'aquacrop-pilot-run', fieldId),
      callEngine(supabaseUrl, anonKey, authorization, 'cropforge-shadow-run', fieldId),
    ]);

    const comparison = buildShadowComparison({
      pcse,
      aquacrop,
      cropforge,
      comparisonDay: new Date().toISOString().slice(0, 10),
    });

    const fingerprint = await sha256({
      field_id: fieldId,
      function_version: FUNCTION_VERSION,
      comparison,
    });

    await persistComparison(serviceClient, user.id, fieldId, comparison, fingerprint);
    const calibration = await refreshCalibrationState(
      serviceClient,
      user.id,
      fieldId,
      String(comparison.season_key ?? 'unknown'),
    );
    const experiment = calibration.review_eligible
      ? await callPusulaExperimentBestEffort(supabaseUrl, anonKey, authorization, fieldId)
      : null;

    return json({
      ok: true,
      cached: false,
      field_id: fieldId,
      status: comparison.status,
      severity: comparison.severity,
      comparison_day: comparison.comparison_day,
      comparison_as_of: comparison.comparison_as_of,
      season_key: comparison.season_key,
      engine_statuses: Object.fromEntries(
        Object.entries(comparison.engines).map(([key, value]: [string, any]) => [key, value.status]),
      ),
      divergence_count: comparison.divergences.length,
      calibration_status: calibration.status,
      calibration_review_eligible: calibration.review_eligible,
      phenology_clean_streak: calibration.phenology_clean_streak,
      water_evidence_state: calibration.water_evidence_state,
      experiment_status: experiment?.status ?? null,
      experiment_review_ready: experiment?.review_ready === true,
      production_authority: false,
      user_visible: false,
      internal_only: true,
      note: 'Repeated-day shadow calibration updated for internal review only. Pusula Deneyi runs only after calibration review eligibility and cannot promote a model or change farmer-facing decisions.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shadow model karşılaştırması başarısız oldu.';
    console.error('[model-shadow-comparison]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false, user_visible: false }, status);
  }
});
