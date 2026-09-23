import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCHIVE_LAG_DAYS = 6;
const MAX_SIMULATION_DAYS = 400;
const RUNNER_VERSION = 1;
const INPUT_CONTRACT_VERSION = 1;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: unknown): string | null {
  const text = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function daysInclusive(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

function normalizeCrop(value: unknown): 'wheat' | 'maize' | null {
  const text = String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
  if (['buğday', 'bugday', 'wheat', 'triticum aestivum'].includes(text)) return 'wheat';
  if (['mısır', 'misir', 'maize', 'corn', 'zea mays'].includes(text)) return 'maize';
  return null;
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
    throw new Error('CropForge shadow için Supabase sunucu kimlik bilgileri veya oturum eksik.');
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('CropForge shadow için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient, supabaseUrl, anonKey, authorization };
}

async function callAdapter(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  slug: string,
  fieldId: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_id: fieldId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload?.error ?? `${slug} HTTP ${response.status}`);
    }
    if (payload.production_authority !== false || payload.input_authority !== 'server-derived') {
      throw new Error(`${slug} trust boundary doğrulanamadı.`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadObservedWeather(latitude: number, longitude: number, start: string, end: string) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set(
    'daily',
    [
      'temperature_2m_min',
      'temperature_2m_max',
      'precipitation_sum',
      'shortwave_radiation_sum',
      'et0_fao_evapotranspiration',
      'wind_speed_10m_mean',
      'relative_humidity_2m_mean',
    ].join(','),
  );
  url.searchParams.set('wind_speed_unit', 'ms');
  url.searchParams.set('timezone', 'UTC');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-CropForge-Shadow/1.0' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) throw new Error(`Open-Meteo archive HTTP ${response.status}`);

    const daily = payload.daily;
    const dates = Array.isArray(daily.time) ? daily.time : [];
    const series = [
      daily.temperature_2m_min,
      daily.temperature_2m_max,
      daily.precipitation_sum,
      daily.shortwave_radiation_sum,
      daily.et0_fao_evapotranspiration,
      daily.wind_speed_10m_mean,
      daily.relative_humidity_2m_mean,
    ];
    if (!series.every((items) => Array.isArray(items) && items.length === dates.length)) {
      throw new Error('Open-Meteo CropForge günlük serileri eksik veya hizasız.');
    }

    const weather = dates.map((day: string, index: number) => ({
      date: day,
      tmin_c: Number(daily.temperature_2m_min[index]),
      tmax_c: Number(daily.temperature_2m_max[index]),
      rain_mm: Number(daily.precipitation_sum[index]),
      radiation_mj_m2: Number(daily.shortwave_radiation_sum[index]),
      et0_mm: Number(daily.et0_fao_evapotranspiration[index]),
      wind_m_s: Number(daily.wind_speed_10m_mean[index]),
      humidity_pct: Number(daily.relative_humidity_2m_mean[index]),
    }));

    const expected = daysInclusive(start, end);
    const valid = weather.length === expected && weather[0]?.date === start && weather.at(-1)?.date === end &&
      weather.every((row: any, index: number) =>
        dateOnly(row.date) &&
        Number.isFinite(row.tmin_c) && Number.isFinite(row.tmax_c) && row.tmax_c >= row.tmin_c &&
        Number.isFinite(row.rain_mm) && row.rain_mm >= 0 &&
        Number.isFinite(row.radiation_mj_m2) && row.radiation_mj_m2 >= 0 &&
        Number.isFinite(row.et0_mm) && row.et0_mm >= 0 &&
        Number.isFinite(row.wind_m_s) && row.wind_m_s >= 0 &&
        Number.isFinite(row.humidity_pct) && row.humidity_pct >= 0 && row.humidity_pct <= 100 &&
        (index === 0 || daysInclusive(weather[index - 1].date, row.date) === 2),
      );
    if (!valid) throw new Error('Open-Meteo CropForge gözlem penceresi tam ve kesintisiz değil.');
    return weather;
  } finally {
    clearTimeout(timeout);
  }
}

async function persistRun(serviceClient: any, values: Record<string, unknown>) {
  const { error } = await serviceClient.from('model_engine_runs').upsert(values, {
    onConflict: 'user_id,field_id,engine,mode,input_fingerprint',
  });
  if (error) console.error('[cropforge-shadow-run] persistence failed', error.message);
}

async function loadCachedRun(serviceClient: any, userId: string, fieldId: string, fingerprint: string) {
  const { data, error } = await serviceClient
    .from('model_engine_runs')
    .select('output,engine_version,completed_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('engine', 'cropforge')
    .eq('mode', 'shadow')
    .eq('status', 'completed')
    .eq('input_fingerprint', fingerprint)
    .maybeSingle();
  if (error) return null;
  if (data?.output?.engine !== 'cropforge' || data?.output?.production_authority !== false) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    if (Object.keys(body ?? {}).some((key) => key !== 'field_id')) {
      return json({
        ok: false,
        error: 'CropForge model girdileri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
        production_authority: false,
      }, 400);
    }

    const gatewayUrl = (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, '');
    const gatewayKey = Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '';
    if (!gatewayUrl || !gatewayKey) {
      return json({ ok: false, blocked: true, missing_inputs: ['model_gateway_connection'], production_authority: false }, 503);
    }

    const { user, serviceClient, supabaseUrl, anonKey, authorization } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,crop,area_decare,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const [pcseInputs, aquacropInputs] = await Promise.all([
      callAdapter(supabaseUrl, anonKey, authorization, 'pcse-pilot-inputs', fieldId),
      callAdapter(supabaseUrl, anonKey, authorization, 'aquacrop-pilot-inputs', fieldId),
    ]);

    const missing = new Set<string>();
    const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
    const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      missing.add('field_location');
    }

    const cropKey = normalizeCrop(field.crop ?? pcseInputs?.context?.crop_identity);
    if (!cropKey) missing.add('crop_parameters');

    const plantingDate = dateOnly(
      pcseInputs?.context?.planting_date ??
      aquacropInputs?.context?.planting_date ??
      pcseInputs?.adapters?.planting_date?.plantingDate,
    );
    if (!plantingDate) missing.add('planting_date');

    const aquaAvailable = new Set(Array.isArray(aquacropInputs?.available_inputs) ? aquacropInputs.available_inputs.map(String) : []);
    const soilProfile = aquacropInputs?.adapters?.soil_profile;
    const soilVerified = aquaAvailable.has('soil_profile') && soilProfile?.modelReady === true;
    if (!soilVerified) missing.add('soil_profile');

    const areaDecare = finite(field.area_decare);
    const areaHa = areaDecare !== null && areaDecare > 0 ? areaDecare / 10 : null;
    if (areaHa === null) missing.add('field_area');

    const asOfDate = isoDateDaysAgo(ARCHIVE_LAG_DAYS);
    const harvestDate = dateOnly(pcseInputs?.context?.harvest_date ?? aquacropInputs?.context?.harvest_date);
    const simulationEnd = harvestDate && harvestDate <= asOfDate ? harvestDate : asOfDate;
    if (plantingDate && simulationEnd < plantingDate) missing.add('daily_weather');
    const duration = plantingDate && simulationEnd >= plantingDate ? daysInclusive(plantingDate, simulationEnd) : 0;
    if (duration > MAX_SIMULATION_DAYS) missing.add('simulation_window_too_long');

    if (missing.size) {
      const fingerprint = await sha256({ fieldId, missing: [...missing].sort(), asOfDate, runnerVersion: RUNNER_VERSION });
      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'cropforge',
        mode: 'shadow',
        status: 'blocked',
        input_fingerprint: fingerprint,
        input_summary: { crop: field.crop ?? null, planting_date: plantingDate, simulation_end: simulationEnd, server_derived: true },
        source_versions: { cropforge: '1.0.1', runner: RUNNER_VERSION, input_contract: INPUT_CONTRACT_VERSION },
        missing_inputs: [...missing].sort(),
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      });
      return json({
        ok: true,
        blocked: true,
        engine: 'cropforge',
        mode: 'shadow',
        field_id: fieldId,
        missing_inputs: [...missing].sort(),
        production_authority: false,
        yield_authority: false,
        note: 'Eksik gerçek girdiler nedeniyle CropForge çalıştırılmadı; sentetik tarla veya hava girdisi üretilmedi.',
      });
    }

    const weather = await loadObservedWeather(latitude!, longitude!, plantingDate!, simulationEnd);
    const modelPayload = {
      field_id: fieldId,
      latitude,
      longitude,
      crop_key: cropKey,
      planting_date: plantingDate,
      area_ha: areaHa,
      soil_profile_verified: true,
      weather,
    };
    const fingerprint = await sha256({ modelPayload, cropforge: '1.0.1', runnerVersion: RUNNER_VERSION, inputContractVersion: INPUT_CONTRACT_VERSION });
    const cached = await loadCachedRun(serviceClient, user.id, fieldId, fingerprint);
    if (cached) {
      return json({ ok: true, blocked: false, cached: true, engine: 'cropforge', mode: 'shadow', field_id: fieldId, production_authority: false, result: cached.output, completed_at: cached.completed_at });
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'cropforge',
      mode: 'shadow',
      status: 'running',
      input_fingerprint: fingerprint,
      input_summary: { crop_key: cropKey, planting_date: plantingDate, simulation_end: simulationEnd, days: weather.length, server_derived: true, soil_profile_verified: true },
      source_versions: { cropforge: '1.0.1', weather: 'Open-Meteo historical weather API', pcse_inputs: 'server-derived', aquacrop_inputs: 'server-derived', runner: RUNNER_VERSION, input_contract: INPUT_CONTRACT_VERSION },
      missing_inputs: [],
      adapter_version: RUNNER_VERSION,
      output: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch(`${gatewayUrl}/v1/scenario/cropforge/shadow`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Model-Gateway-Key': gatewayKey },
        body: JSON.stringify(modelPayload),
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await gatewayResponse.json().catch(() => null);
    if (!gatewayResponse.ok || !result || result.ok !== true || result.production_authority !== false || result.engine !== 'cropforge') {
      const message = String(result?.detail ?? result?.error ?? `CropForge gateway HTTP ${gatewayResponse.status}`);
      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'cropforge',
        mode: 'shadow',
        status: 'failed',
        input_fingerprint: fingerprint,
        input_summary: { crop_key: cropKey, planting_date: plantingDate, simulation_end: simulationEnd, days: weather.length, server_derived: true },
        source_versions: { cropforge: '1.0.1', runner: RUNNER_VERSION, input_contract: INPUT_CONTRACT_VERSION },
        missing_inputs: [],
        adapter_version: RUNNER_VERSION,
        output: null,
        error_message: message.slice(0, 1000),
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, blocked: false, engine: 'cropforge', field_id: fieldId, production_authority: false, error: message }, 502);
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'cropforge',
      mode: 'shadow',
      status: 'completed',
      input_fingerprint: fingerprint,
      input_summary: { crop_key: cropKey, planting_date: plantingDate, simulation_end: simulationEnd, days: weather.length, server_derived: true, soil_profile_verified: true },
      source_versions: { cropforge: result.engine_version ?? '1.0.1', weather: 'Open-Meteo historical weather API', runner: RUNNER_VERSION, input_contract: INPUT_CONTRACT_VERSION },
      missing_inputs: [],
      engine_version: String(result.engine_version ?? '1.0.1'),
      adapter_version: RUNNER_VERSION,
      output: result,
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    return json({ ok: true, blocked: false, cached: false, engine: 'cropforge', mode: 'shadow', field_id: fieldId, production_authority: false, yield_authority: false, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CropForge shadow isteği başarısız oldu.';
    console.error('[cropforge-shadow-run]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, production_authority: false, error: message }, status);
  }
});
