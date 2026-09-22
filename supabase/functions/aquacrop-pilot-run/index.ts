import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ARCHIVE_LAG_DAYS = 5;
const MAX_SIMULATION_DAYS = 400;
const INITIAL_WATER_PLANTING_TOLERANCE_DAYS = 3;
const INITIAL_WATER_PROFILE_COHERENCE_HOURS = 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function dateOnly(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(parsed) ? text : null;
}

function daysBetween(a: string, b: string) {
  return Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

function isoDateDaysAgo(days: number) {
  const value = new Date(Date.now() - days * 86400000);
  return value.toISOString().slice(0, 10);
}

function minDate(a: string, b: string) {
  return a <= b ? a : b;
}

function stableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    throw new Error('AquaCrop pilot için Supabase sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('AquaCrop pilot için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient, supabaseUrl, anonKey, authorization };
}

async function loadInputAdapters(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/aquacrop-pilot-inputs`, {
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
    throw new Error(payload?.error ?? `AquaCrop input adapter HTTP ${response.status}`);
  }
  if (payload.production_authority !== false || payload.input_authority !== 'server-derived' || Number(payload.inputContractVersion) !== 8) {
    throw new Error('AquaCrop input adapter trust boundary doğrulanamadı.');
  }
  return payload;
}

function canonicalWaterLayers(initialWater: any, plantingDate: string) {
  const segments = Array.isArray(initialWater?.segments) ? initialWater.segments : [];
  if (!initialWater?.modelReady || !segments.length) {
    return { ok: false as const, reason: 'initial_water_content', layers: [] };
  }

  const timestamps = segments
    .map((segment: any) => Date.parse(String(segment?.measuredAt ?? '')))
    .filter((value: number) => Number.isFinite(value));
  if (timestamps.length !== segments.length) {
    return { ok: false as const, reason: 'initial_water_measurement_time', layers: [] };
  }

  const plantingTs = Date.parse(`${plantingDate}T00:00:00Z`);
  if (timestamps.some((value: number) => Math.abs(value - plantingTs) / 86400000 > INITIAL_WATER_PLANTING_TOLERANCE_DAYS)) {
    return { ok: false as const, reason: 'initial_water_not_measured_near_planting', layers: [] };
  }

  const coherenceHours = (Math.max(...timestamps) - Math.min(...timestamps)) / 3600000;
  if (coherenceHours > INITIAL_WATER_PROFILE_COHERENCE_HOURS) {
    return { ok: false as const, reason: 'initial_water_profile_not_time_coherent', layers: [] };
  }

  const ordered = [...segments].sort((a: any, b: any) => Number(a.depthFromCm) - Number(b.depthFromCm));
  const layers: Array<{ from_cm: number; to_cm: number; volumetric_water_content: number }> = [];
  let cursor = 0;
  while (cursor < 200 - 0.001) {
    const candidate = ordered
      .filter((segment: any) => Number(segment.depthFromCm) <= cursor + 0.01 && Number(segment.depthToCm) > cursor + 0.01)
      .sort((a: any, b: any) => Number(b.depthToCm) - Number(a.depthToCm))[0];
    if (!candidate) return { ok: false as const, reason: 'initial_water_depth_gap', layers: [] };
    const water = stableNumber(candidate.volumetricWaterContent);
    const end = Math.min(200, Number(candidate.depthToCm));
    if (water === null || water <= 0 || water >= 1 || end <= cursor) {
      return { ok: false as const, reason: 'initial_water_invalid_value', layers: [] };
    }
    layers.push({ from_cm: cursor, to_cm: end, volumetric_water_content: water });
    cursor = end;
  }

  return { ok: true as const, reason: null, layers, measurement_coherence_hours: Number(coherenceHours.toFixed(2)) };
}

function mapSoilLayers(soilProfile: any) {
  const layers = Array.isArray(soilProfile?.layers) ? soilProfile.layers : [];
  if (!soilProfile?.modelReady || !layers.length) return null;
  const mapped = layers.map((layer: any) => {
    const h = layer?.hydraulic ?? {};
    return {
      from_cm: Number(layer.fromCm),
      to_cm: Number(layer.toCm),
      th_wp: Number(h.thWP),
      th_fc: Number(h.thFC),
      th_s: Number(h.thS),
      ksat_mm_day: Number(h.ksatMmDay),
      penetrability_percent: Number(layer.penetrabilityPercent ?? 100),
    };
  });
  const valid = mapped.every((layer: any) =>
    Number.isFinite(layer.from_cm) && Number.isFinite(layer.to_cm) && layer.to_cm > layer.from_cm &&
    Number.isFinite(layer.th_wp) && Number.isFinite(layer.th_fc) && Number.isFinite(layer.th_s) &&
    layer.th_wp < layer.th_fc && layer.th_fc < layer.th_s &&
    Number.isFinite(layer.ksat_mm_day) && layer.ksat_mm_day > 0,
  );
  if (!valid) return null;
  const ordered = [...mapped].sort((a: any, b: any) => a.from_cm - b.from_cm);
  let cursor = 0;
  for (const layer of ordered) {
    if (Math.abs(layer.from_cm - cursor) > 0.001) return null;
    cursor = layer.to_cm;
  }
  return Math.abs(cursor - 200) <= 0.001 ? ordered : null;
}

async function loadWeather(latitude: number, longitude: number, start: string, end: string) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration');
  url.searchParams.set('timezone', 'UTC');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'TarlaPusula-AquaCrop-Pilot/1.0' } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) throw new Error(`Open-Meteo archive HTTP ${response.status}`);

    const d = payload.daily;
    const dates = Array.isArray(d.time) ? d.time : [];
    const tmin = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [];
    const tmax = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [];
    const rain = Array.isArray(d.precipitation_sum) ? d.precipitation_sum : [];
    const et0 = Array.isArray(d.et0_fao_evapotranspiration) ? d.et0_fao_evapotranspiration : [];
    if (![tmin, tmax, rain, et0].every((array) => array.length === dates.length) || dates.length < 2) {
      throw new Error('Open-Meteo AquaCrop weather series is incomplete.');
    }

    const weather = dates.map((date: string, index: number) => ({
      date,
      tmin_c: Number(tmin[index]),
      tmax_c: Number(tmax[index]),
      precipitation_mm: Number(rain[index]),
      reference_et_mm: Number(et0[index]),
    }));
    const valid = weather.every((row: any) =>
      dateOnly(row.date) && Number.isFinite(row.tmin_c) && Number.isFinite(row.tmax_c) && row.tmax_c >= row.tmin_c &&
      Number.isFinite(row.precipitation_mm) && row.precipitation_mm >= 0 &&
      Number.isFinite(row.reference_et_mm) && row.reference_et_mm >= 0,
    );
    const expectedDays = daysBetween(start, end) + 1;
    const gapless = weather.every((row: any, index: number) => {
      if (index === 0) return row.date === start;
      return daysBetween(weather[index - 1].date, row.date) === 1 && weather[index - 1].date < row.date;
    });
    if (
      !valid ||
      weather.length !== expectedDays ||
      !gapless ||
      weather[weather.length - 1].date !== end
    ) {
      throw new Error('Open-Meteo weather does not fully and continuously cover requested AquaCrop simulation window.');
    }
    return weather;
  } finally {
    clearTimeout(timeout);
  }
}

async function persistRun(serviceClient: any, values: Record<string, unknown>) {
  const { error } = await serviceClient.from('model_engine_runs').upsert(values, {
    onConflict: 'user_id,field_id,engine,mode,input_fingerprint',
  });
  if (error) console.error('[aquacrop-pilot-run] run persistence failed', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const bodyKeys = Object.keys(body ?? {});
    if (bodyKeys.some((key) => key !== 'field_id')) {
      return json({
        ok: false,
        error: 'AquaCrop tarımsal/model girdileri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
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
      .select('id,user_id,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const latitude = stableNumber(field.parcel_centroid_lat ?? field.latitude);
    const longitude = stableNumber(field.parcel_centroid_lng ?? field.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return json({ ok: true, blocked: true, missing_inputs: ['field_location'], production_authority: false });
    }

    const inputs = await loadInputAdapters(supabaseUrl, anonKey, authorization, fieldId);
    const plantingDate = dateOnly(inputs?.context?.planting_date);
    const harvestDate = dateOnly(inputs?.context?.harvest_date);
    const missing = new Set<string>(Array.isArray(inputs.missing_inputs) ? inputs.missing_inputs.map(String) : []);
    if (!plantingDate) missing.add('planting_date');

    const crop = inputs?.adapters?.crop_parameters;
    const soilProfile = inputs?.adapters?.soil_profile;
    const initialWater = inputs?.adapters?.initial_water_content;
    const management = inputs?.adapters?.irrigation_management;
    const soilLayers = mapSoilLayers(soilProfile);
    if (!soilLayers) missing.add('soil_profile');
    if (Number(soilProfile?.profileDepthCm ?? 0) !== 200) missing.add('soil_profile_depth');

    const water = plantingDate ? canonicalWaterLayers(initialWater, plantingDate) : { ok: false as const, reason: 'planting_date', layers: [] };
    if (!water.ok) missing.add(water.reason ?? 'initial_water_content');
    if (Number(initialWater?.requiredDepthCm ?? 0) !== 200 || Number(initialWater?.coveredDepthCm ?? 0) !== 200) missing.add('initial_water_profile_depth');
    if (!crop?.available || !crop?.modelCropKey) missing.add('crop_parameters');
    if (crop?.parameterAuthority !== 'upstream-built-in' || crop?.numericOverrides !== false) missing.add('verified_crop_parameters');
    if (!management?.available || !management?.mode) missing.add('irrigation_management');
    if (management?.mode === 'manual_schedule') missing.add('server_derived_irrigation_management');

    const archiveCutoff = isoDateDaysAgo(ARCHIVE_LAG_DAYS);
    const simulationEnd = harvestDate ? minDate(harvestDate, archiveCutoff) : archiveCutoff;
    if (plantingDate && simulationEnd < plantingDate) missing.add('daily_weather');
    if (plantingDate && daysBetween(plantingDate, simulationEnd) + 1 > MAX_SIMULATION_DAYS) missing.add('simulation_window_too_long');

    if (missing.size) {
      const fingerprint = await sha256({ fieldId, plantingDate, missing: Array.from(missing).sort(), adapter: 2 });
      await persistRun(serviceClient, {
        user_id: user.id,
        field_id: fieldId,
        engine: 'aquacrop',
        mode: 'pilot',
        status: 'blocked',
        input_fingerprint: fingerprint,
        input_summary: { planting_date: plantingDate, harvest_date: harvestDate, server_derived: true },
        source_versions: { aquacrop_input_adapter: 4 },
        missing_inputs: Array.from(missing).sort(),
        adapter_version: 3,
        output: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      });
      return json({
        ok: true,
        blocked: true,
        engine: 'aquacrop',
        mode: 'pilot',
        field_id: fieldId,
        production_authority: false,
        missing_inputs: Array.from(missing).sort(),
        note: 'Eksik veya zaman uyumsuz gerçek veri nedeniyle AquaCrop çalıştırılmadı; sentetik değer üretilmedi.',
      });
    }

    const weather = await loadWeather(latitude, longitude, plantingDate!, simulationEnd);
    const expectedWeatherDays = Math.floor((Date.parse(`${simulationEnd}T00:00:00Z`) - Date.parse(`${plantingDate}T00:00:00Z`)) / 86_400_000) + 1;
    if (weather.length !== expectedWeatherDays) {
      throw new Error(`AquaCrop weather horizon incomplete: expected ${expectedWeatherDays}, got ${weather.length}`);
    }
    const modelPayload = {
      field_id: fieldId,
      simulation_start: plantingDate,
      simulation_end: simulationEnd,
      planting_date: plantingDate,
      crop_model_key: String(crop.modelCropKey),
      weather,
      soil_layers: soilLayers,
      initial_water_layers: water.layers,
      irrigation_management: {
        mode: String(management.mode),
        settings: management.settings && typeof management.settings === 'object' ? management.settings : {},
      },
    };

    const fingerprint = await sha256(modelPayload);
    const modelPayloadBytes = new TextEncoder().encode(JSON.stringify(modelPayload)).byteLength;
    if (modelPayloadBytes > 2_000_000) {
      await persistRun(serviceClient, {
        user_id: user.id, field_id: fieldId, engine: 'aquacrop', mode: 'pilot',
        status: 'failed', input_fingerprint: fingerprint,
        input_summary: { simulation_start: plantingDate, simulation_end: simulationEnd, crop_model_key: crop.modelCropKey, model_payload_bytes: modelPayloadBytes, server_derived: true },
        source_versions: { input_adapter_version: 4, run_adapter_version: 3 },
        missing_inputs: [], adapter_version: 3, output: null,
        error_message: 'AquaCrop model payload exceeds safe pilot size.',
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, engine: 'aquacrop', mode: 'pilot', field_id: fieldId, production_authority: false, error: 'AquaCrop model payload exceeds safe pilot size.' }, 413);
    }
    const weatherFingerprint = await sha256(weather);
    const soilFingerprint = await sha256(soilLayers);
    const initialWaterFingerprint = await sha256(water.layers);
    const managementFingerprint = await sha256(modelPayload.irrigation_management);
    const inputSummary = {
      simulation_start: plantingDate,
      simulation_end: simulationEnd,
      archive_lag_days: ARCHIVE_LAG_DAYS,
      crop_model_key: crop.modelCropKey,
      weather_days: weather.length,
      soil_layers: soilLayers!.length,
      initial_water_layers: water.layers.length,
      initial_water_coherence_hours: water.measurement_coherence_hours,
      irrigation_mode: management.mode,
      server_derived: true,
      model_payload_bytes: modelPayloadBytes,
    };
    const sourceVersions = {
      weather: 'Open-Meteo Archive',
      weather_timezone: 'UTC',
      weather_adapter_contract_version: 2,
      weather_variables: ['temperature_2m_min', 'temperature_2m_max', 'precipitation_sum', 'et0_fao_evapotranspiration'],
      soil: soilProfile?.source ?? {},
      crop_parameters: crop?.source ?? null,
      soil_assumptions: Array.isArray(soilProfile?.assumptions) ? soilProfile.assumptions : [],
      soil_adapter_contract_version: Number(soilProfile?.adapterContractVersion ?? 0),
      soil_pedotransfer_method: String(soilProfile?.pedotransferMethod ?? ''),
      soil_warnings: Array.isArray(soilProfile?.warnings) ? soilProfile.warnings : [],
      irrigation_management: management?.source ?? management?.managementSource ?? null,
      initial_water: initialWater?.source ?? null,
      aquacrop_runtime_package: '3.1.0',
      crop_parameter_source_commit: '36cc20e44644ed1704398889312435c85e04a2f3',
      input_adapter_version: 4,
      run_adapter_version: 3,
      fingerprints: {
        weather: weatherFingerprint,
        soil: soilFingerprint,
        initial_water: initialWaterFingerprint,
        irrigation_management: managementFingerprint,
      },
    };
    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'aquacrop',
      mode: 'pilot',
      status: 'running',
      input_fingerprint: fingerprint,
      input_summary: inputSummary,
      source_versions: sourceVersions,
      missing_inputs: [],
      adapter_version: 3,
      output: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch(`${gatewayUrl}/v1/scenario/aquacrop/pilot`, {
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
        engine: 'aquacrop',
        mode: 'pilot',
        status: 'failed',
        input_fingerprint: fingerprint,
        input_summary: inputSummary,
        source_versions: sourceVersions,
        missing_inputs: [],
        adapter_version: 3,
        output: null,
        error_message: errorMessage.slice(0, 2000),
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, error: errorMessage, production_authority: false }, 502);
    }
    if (
      result.production_authority !== false ||
      result.irrigation_prescription_authority !== false ||
      result.yield_authority !== false ||
      result.evidence_scope !== 'season_scale_validation_only' ||
      result?.outputs?.evidence_only !== true ||
      Number(result?.outputs?.simulation_result_rows) !== 1 ||
      result.engine !== 'aquacrop' ||
      result.mode !== 'pilot' ||
      !String(result.engine_version ?? '').trim() ||
      Number(result.contract_version) !== 8 ||
      String(result.engine_version ?? '') !== '3.1.0' ||
      result.field_id !== fieldId ||
      result?.simulation?.start !== plantingDate ||
      result?.simulation?.end !== simulationEnd ||
      result?.simulation?.planting_date !== plantingDate ||
      result?.simulation?.crop_model_key !== String(crop.modelCropKey) ||
      Number(result?.simulation?.weather_days) !== weather.length ||
      Number(result?.simulation?.soil_layers) !== (Array.isArray(soilProfile?.layers) ? soilProfile.layers.length : -1) ||
      Number(result?.simulation?.initial_water_layers) !== (Array.isArray(initialWater?.layers) ? initialWater.layers.length : -1) ||
      result?.simulation?.irrigation_mode !== String(management.mode) ||
      result?.simulation?.initial_water_method !== 'Depth' ||
      result?.simulation?.initial_water_depth_semantics !== 'measured_interval_midpoints' ||
      result?.simulation?.daily_output_integrity !== 'exact_zero_based_time_step_counter' ||
      result?.simulation?.output_scope !== 'water_balance_evidence_only'
    ) {
      await persistRun(serviceClient, {
        user_id: user.id, field_id: fieldId, engine: 'aquacrop', mode: 'pilot',
        status: 'failed', input_fingerprint: fingerprint, input_summary: inputSummary,
        source_versions: sourceVersions, missing_inputs: [], adapter_version: 3,
        engine_version: result?.engine_version ?? null, output: null,
        error_message: 'AquaCrop gateway response trust boundary doğrulanamadı.',
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, engine: 'aquacrop', mode: 'pilot', field_id: fieldId, production_authority: false, error: 'AquaCrop gateway response trust boundary doğrulanamadı.' }, 502);
    }

    await persistRun(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine: 'aquacrop',
      mode: 'pilot',
      status: 'completed',
      input_fingerprint: fingerprint,
      input_summary: inputSummary,
      source_versions: sourceVersions,
      missing_inputs: [],
      engine_version: result.engine_version ?? null,
      adapter_version: 3,
      output: result,
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    return json({
      ok: true,
      blocked: false,
      engine: 'aquacrop',
      mode: 'pilot',
      field_id: fieldId,
      production_authority: false,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AquaCrop pilot çalıştırılamadı.';
    console.error('[aquacrop-pilot-run]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
