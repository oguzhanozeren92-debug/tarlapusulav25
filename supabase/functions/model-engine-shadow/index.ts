import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NASA_POWER_API = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_ELEVATION = 'https://api.open-meteo.com/v1/elevation';
const LOOKBACK_DAYS = 7;
const ADAPTER_VERSION = 2;
const PYFAO56_PIN = '1d242ee985be0edbc4946f06e7e94a487d4bc0c9';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= -900) return null;
  return parsed;
}

function round(value: number | null, digits = 3): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(isoDate: string, days: number) {
  const value = new Date(`${isoDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function compactDate(isoDate: string) {
  return isoDate.replaceAll('-', '');
}

function readableDate(value: string) {
  return value.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
}

function routeFor(engine: string, operation: string) {
  if (engine === 'pcse' && operation === 'readiness') {
    return '/v1/phenology/pcse/readiness';
  }
  if (engine === 'aquacrop' && operation === 'readiness') {
    return '/v1/scenario/aquacrop/readiness';
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        payload?.detail ?? payload?.error ?? payload?.reason ?? `HTTP ${response.status}`,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function collectCoordinates(value: unknown, sink: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  ) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    if (
      longitude >= -180 && longitude <= 180 &&
      latitude >= -90 && latitude <= 90
    ) {
      sink.push([longitude, latitude]);
    }
    return;
  }
  for (const child of value) collectCoordinates(child, sink);
}

function geometryCenter(parcelGeometry: any) {
  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  const points: Array<[number, number]> = [];
  collectCoordinates(geometry?.coordinates, points);
  if (!points.length) return null;

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }

  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    source: 'parcel_geometry',
  } as const;
}

function resolveFieldLocation(field: any) {
  const centroidLat = finite(field?.parcel_centroid_lat);
  const centroidLng = finite(field?.parcel_centroid_lng);
  if (
    centroidLat !== null && centroidLng !== null &&
    centroidLat >= -90 && centroidLat <= 90 &&
    centroidLng >= -180 && centroidLng <= 180
  ) {
    return {
      latitude: centroidLat,
      longitude: centroidLng,
      source: 'parcel_centroid',
    } as const;
  }

  const latitude = finite(field?.latitude);
  const longitude = finite(field?.longitude);
  if (
    latitude !== null && longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  ) {
    return { latitude, longitude, source: 'field_coordinates' } as const;
  }

  return geometryCenter(field?.parcel_geometry);
}

async function sha256(value: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchElevation(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  });
  const payload = await fetchJson(`${OPEN_METEO_ELEVATION}?${params.toString()}`);
  const raw = Array.isArray(payload?.elevation)
    ? payload.elevation[0]
    : payload?.elevation;
  return finite(raw);
}

type NasaWeather = {
  date: string;
  solarRadiationMjM2: number;
  tmaxC: number;
  tminC: number;
  dewPointC: number;
  windMS: number;
  rainMm: number;
};

async function fetchNasaWeather(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
) {
  const params = new URLSearchParams({
    parameters: [
      'T2M_MAX',
      'T2M_MIN',
      'T2MDEW',
      'WS2M',
      'PRECTOTCORR',
      'ALLSKY_SFC_SW_DWN',
    ].join(','),
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: compactDate(startDate),
    end: compactDate(endDate),
    format: 'JSON',
    'time-standard': 'LST',
  });

  const payload = await fetchJson(`${NASA_POWER_API}?${params.toString()}`);
  const parameter = payload?.properties?.parameter;
  if (!parameter) throw new Error('NASA POWER beklenen günlük veri yapısını döndürmedi.');

  const dates = new Set<string>();
  for (const key of Object.keys(parameter.T2M_MAX ?? {})) dates.add(readableDate(key));

  const result = new Map<string, NasaWeather>();
  for (const date of dates) {
    const key = compactDate(date);
    const solarRadiationMjM2 = finite(parameter.ALLSKY_SFC_SW_DWN?.[key]);
    const tmaxC = finite(parameter.T2M_MAX?.[key]);
    const tminC = finite(parameter.T2M_MIN?.[key]);
    const dewPointC = finite(parameter.T2MDEW?.[key]);
    const windMS = finite(parameter.WS2M?.[key]);
    const rainMm = finite(parameter.PRECTOTCORR?.[key]);

    if (
      solarRadiationMjM2 === null || tmaxC === null || tminC === null ||
      dewPointC === null || windMS === null || rainMm === null
    ) continue;

    result.set(date, {
      date,
      solarRadiationMjM2,
      tmaxC,
      tminC,
      dewPointC,
      windMS,
      rainMm,
    });
  }
  return result;
}

type BaselineDay = {
  date: string;
  referenceEtMm: number;
  precipitationMm: number | null;
};

async function fetchTarlaPusulaBaseline(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    daily: 'et0_fao_evapotranspiration,precipitation_sum',
    past_days: String(LOOKBACK_DAYS),
    forecast_days: '1',
    timezone: 'UTC',
  });

  const payload = await fetchJson(`${OPEN_METEO_FORECAST}?${params.toString()}`);
  const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
  const eto = Array.isArray(payload?.daily?.et0_fao_evapotranspiration)
    ? payload.daily.et0_fao_evapotranspiration
    : [];
  const rain = Array.isArray(payload?.daily?.precipitation_sum)
    ? payload.daily.precipitation_sum
    : [];

  const result = new Map<string, BaselineDay>();
  dates.forEach((rawDate: unknown, index: number) => {
    const date = String(rawDate ?? '');
    const referenceEtMm = finite(eto[index]);
    if (!date || referenceEtMm === null) return;
    result.set(date, {
      date,
      referenceEtMm,
      precipitationMm: finite(rain[index]),
    });
  });
  return result;
}

function sourceVersions() {
  return {
    adapter_version: ADAPTER_VERSION,
    shadow_scope: 'reference_et_and_single_kc',
    pyfao56_upstream_pin: PYFAO56_PIN,
    nasa_power: 'daily-point AG; T2M_MAX,T2M_MIN,T2MDEW,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN',
    tarlapusula_baseline: 'Open-Meteo forecast daily et0_fao_evapotranspiration',
    elevation: 'Copernicus DEM GLO-90 via Open-Meteo Elevation API',
  };
}

function meanAbsolute(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + Math.abs(value), 0) / valid.length, 3);
}

function deltaPct(current: number, candidate: number) {
  if (!Number.isFinite(current) || Math.abs(current) < 0.000001) return null;
  return round(((candidate - current) / current) * 100, 2);
}

function buildComparison(gatewayDays: any[], preparedDays: any[]) {
  const preparedByDate = new Map(preparedDays.map((day) => [day.date, day]));
  const days = gatewayDays
    .map((day) => {
      const prepared = preparedByDate.get(String(day?.date ?? '')) as any;
      const pyEt0 = finite(day?.reference_et_mm);
      const pyEtc = finite(day?.crop_et_mm);
      if (!prepared || pyEt0 === null || pyEtc === null) return null;

      const currentEt0 = Number(prepared.baselineReferenceEtMm);
      const kc = Number(prepared.kc);
      const currentEtc = currentEt0 * kc;
      const et0Delta = pyEt0 - currentEt0;
      const etcDelta = pyEtc - currentEtc;

      return {
        date: prepared.date,
        kc: round(kc, 4),
        tarlapusula_reference_et_mm: round(currentEt0),
        pyfao56_reference_et_mm: round(pyEt0),
        reference_et_delta_mm: round(et0Delta),
        reference_et_delta_pct: deltaPct(currentEt0, pyEt0),
        tarlapusula_crop_et_mm: round(currentEtc),
        pyfao56_crop_et_mm: round(pyEtc),
        crop_et_delta_mm: round(etcDelta),
        crop_et_delta_pct: deltaPct(currentEtc, pyEtc),
        tarlapusula_precipitation_mm: round(prepared.baselinePrecipitationMm),
        pyfao56_input_rain_mm: round(prepared.nasaRainMm),
      };
    })
    .filter(Boolean);

  return {
    basis: {
      note: 'Fark, yalnız algoritma farkı değildir; hava kaynağı farkını da içerir.',
      tarlapusula: 'Open-Meteo günlük FAO-56 ET0 × aynı doğrulanmış Kc',
      pyfao56: 'NASA POWER meteorolojisi + Copernicus DEM rakımı ile pyfao56 ET0 × aynı doğrulanmış Kc',
    },
    compared_day_count: days.length,
    days,
    summary: {
      mean_absolute_reference_et_delta_mm: meanAbsolute(
        days.map((day: any) => finite(day.reference_et_delta_mm)),
      ),
      mean_absolute_reference_et_delta_pct: meanAbsolute(
        days.map((day: any) => finite(day.reference_et_delta_pct)),
      ),
      mean_absolute_crop_et_delta_mm: meanAbsolute(
        days.map((day: any) => finite(day.crop_et_delta_mm)),
      ),
      mean_absolute_crop_et_delta_pct: meanAbsolute(
        days.map((day: any) => finite(day.crop_et_delta_pct)),
      ),
    },
  };
}

async function forwardGateway(route: string, payload: unknown) {
  const gatewayUrl = (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, '');
  const gatewayKey = Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '';
  if (!gatewayUrl || !gatewayKey) {
    throw new Error('Model Gateway henüz sunucu tarafında yapılandırılmadı.');
  }

  return fetchJson(`${gatewayUrl}${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Model-Gateway-Key': gatewayKey,
    },
    body: JSON.stringify(payload ?? {}),
  }, 25_000);
}

async function getClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Supabase sunucu kimlik bilgileri veya kullanıcı oturumu eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('Model shadow için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function getExistingRun(serviceClient: any, userId: string, fieldId: string, fingerprint: string) {
  const { data, error } = await serviceClient
    .from('model_engine_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('engine', 'pyfao56')
    .eq('mode', 'shadow')
    .eq('input_fingerprint', fingerprint)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveRun(serviceClient: any, values: Record<string, unknown>, existingId?: string) {
  if (existingId) {
    const { data, error } = await serviceClient
      .from('model_engine_runs')
      .update(values)
      .eq('id', existingId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await serviceClient
    .from('model_engine_runs')
    .insert(values)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function prepareFieldShadow(serviceClient: any, userId: string, fieldId: string) {
  const { data: field, error: fieldError } = await serviceClient
    .from('fields')
    .select([
      'id',
      'user_id',
      'crop',
      'latitude',
      'longitude',
      'parcel_centroid_lat',
      'parcel_centroid_lng',
      'parcel_geometry',
    ].join(', '))
    .eq('id', fieldId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fieldError) throw fieldError;
  if (!field) throw new Error('Tarla bulunamadı veya bu kullanıcıya ait değil.');

  const location = resolveFieldLocation(field);
  const today = todayUtc();
  const cutoff = shiftDate(today, -LOOKBACK_DAYS);

  const { data: snapshots, error: snapshotError } = await serviceClient
    .from('field_irrigation_kc_snapshots')
    .select('snapshot_date,kc,crop_name,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .gte('snapshot_date', cutoff)
    .lt('snapshot_date', today)
    .order('snapshot_date', { ascending: true });

  if (snapshotError) throw snapshotError;

  const missingInputs: string[] = [];
  if (!location) missingInputs.push('field_location');
  if (!Array.isArray(snapshots) || !snapshots.length) missingInputs.push('recent_verified_daily_kc');

  if (!location || !snapshots?.length) {
    const fingerprint = await sha256({
      fieldId,
      scope: 'reference_et_and_single_kc',
      today,
      locationAvailable: Boolean(location),
      snapshotCount: snapshots?.length ?? 0,
    });
    return {
      ready: false,
      field,
      location,
      elevationM: null,
      preparedDays: [],
      gatewayPayload: null,
      missingInputs,
      excludedDays: [],
      fingerprint,
      inputSummary: {
        scope: 'reference_et_and_single_kc',
        day_count: 0,
        dates: [],
        location_source: location?.source ?? null,
      },
      sourceVersions: sourceVersions(),
    };
  }

  const startDate = String(snapshots[0].snapshot_date);
  const endDate = String(snapshots[snapshots.length - 1].snapshot_date);

  const [elevationResult, nasaResult, baselineResult] = await Promise.allSettled([
    fetchElevation(location.latitude, location.longitude),
    fetchNasaWeather(location.latitude, location.longitude, startDate, endDate),
    fetchTarlaPusulaBaseline(location.latitude, location.longitude),
  ]);

  const elevationM = elevationResult.status === 'fulfilled' ? elevationResult.value : null;
  const nasa = nasaResult.status === 'fulfilled' ? nasaResult.value : new Map<string, NasaWeather>();
  const baseline = baselineResult.status === 'fulfilled' ? baselineResult.value : new Map<string, BaselineDay>();

  if (elevationM === null) missingInputs.push('dem_elevation');
  if (nasaResult.status === 'rejected') missingInputs.push('nasa_power_weather');
  if (baselineResult.status === 'rejected') missingInputs.push('tarlapusula_open_meteo_baseline');

  const excludedDays: Array<{ date: string; reason: string }> = [];
  const preparedDays: any[] = [];

  for (const snapshot of snapshots) {
    const date = String(snapshot.snapshot_date);
    const kc = finite(snapshot.kc);
    const nasaDay = nasa.get(date);
    const baselineDay = baseline.get(date);

    if (kc === null || kc <= 0 || kc > 3) {
      excludedDays.push({ date, reason: 'invalid_verified_kc' });
      continue;
    }
    if (!nasaDay) {
      excludedDays.push({ date, reason: 'incomplete_nasa_power_weather' });
      continue;
    }
    if (!baselineDay) {
      excludedDays.push({ date, reason: 'missing_tarlapusula_open_meteo_et0' });
      continue;
    }

    preparedDays.push({
      date,
      kc,
      kcSource: String(snapshot.source_label ?? ''),
      kcConfidence: String(snapshot.coefficient_confidence ?? ''),
      stage: String(snapshot.phenology_stage ?? ''),
      stageLabel: snapshot.stage_label ? String(snapshot.stage_label) : null,
      cropName: String(snapshot.crop_name ?? field.crop ?? ''),
      solarRadiationMjM2: nasaDay.solarRadiationMjM2,
      tmaxC: nasaDay.tmaxC,
      tminC: nasaDay.tminC,
      dewPointC: nasaDay.dewPointC,
      windMS: nasaDay.windMS,
      nasaRainMm: nasaDay.rainMm,
      baselineReferenceEtMm: baselineDay.referenceEtMm,
      baselinePrecipitationMm: baselineDay.precipitationMm,
    });
  }

  if (!preparedDays.length) missingInputs.push('same_day_kc_weather_baseline_overlap');

  const fingerprintPayload = {
    fieldId,
    scope: 'reference_et_and_single_kc',
    location: {
      latitude: round(location.latitude, 6),
      longitude: round(location.longitude, 6),
      elevationM: round(elevationM, 1),
    },
    days: preparedDays.map((day) => ({
      date: day.date,
      kc: day.kc,
      solarRadiationMjM2: day.solarRadiationMjM2,
      tmaxC: day.tmaxC,
      tminC: day.tminC,
      dewPointC: day.dewPointC,
      windMS: day.windMS,
      nasaRainMm: day.nasaRainMm,
      baselineReferenceEtMm: day.baselineReferenceEtMm,
    })),
  };
  const fingerprint = await sha256(fingerprintPayload);

  const gatewayPayload = elevationM !== null && preparedDays.length
    ? {
        field_id: fieldId,
        station: {
          latitude: location.latitude,
          elevation_m: elevationM,
          wind_height_m: 2,
        },
        days: preparedDays.map((day) => ({
          date: day.date,
          solar_radiation_mj_m2: day.solarRadiationMjM2,
          tmax_c: day.tmaxC,
          tmin_c: day.tminC,
          dew_point_c: day.dewPointC,
          wind_m_s: day.windMS,
          rain_mm: day.nasaRainMm,
          kc: day.kc,
        })),
      }
    : null;

  return {
    ready: Boolean(gatewayPayload) && preparedDays.length > 0,
    field,
    location,
    elevationM,
    preparedDays,
    gatewayPayload,
    missingInputs: [...new Set(missingInputs)],
    excludedDays,
    fingerprint,
    inputSummary: {
      scope: 'reference_et_and_single_kc',
      crop: field.crop ?? null,
      day_count: preparedDays.length,
      dates: preparedDays.map((day) => day.date),
      location_source: location.source,
      elevation_m: round(elevationM, 1),
      kc_days: preparedDays.map((day) => ({
        date: day.date,
        kc: round(day.kc, 4),
        source: day.kcSource,
        confidence: day.kcConfidence,
        stage: day.stage,
      })),
      excluded_days: excludedDays,
    },
    sourceVersions: sourceVersions(),
  };
}

async function persistPreparation(
  serviceClient: any,
  userId: string,
  fieldId: string,
  prepared: any,
) {
  const existing = await getExistingRun(serviceClient, userId, fieldId, prepared.fingerprint);
  if (existing?.status === 'completed') return existing;

  const now = new Date().toISOString();
  return saveRun(serviceClient, {
    user_id: userId,
    field_id: fieldId,
    engine: 'pyfao56',
    mode: 'shadow',
    status: prepared.ready ? 'queued' : 'blocked',
    input_fingerprint: prepared.fingerprint,
    input_summary: prepared.inputSummary,
    source_versions: prepared.sourceVersions,
    missing_inputs: prepared.missingInputs,
    adapter_version: ADAPTER_VERSION,
    output: existing?.output ?? null,
    comparison: existing?.comparison ?? null,
    error_message: prepared.ready ? null : 'Gerçek ve aynı güne ait shadow girdileri henüz tamamlanmadı.',
    completed_at: prepared.ready ? null : now,
  }, existing?.id);
}

async function handleFieldPreparation(req: Request, fieldId: string, runGateway: boolean) {
  const { user, serviceClient } = await getClients(req);
  const prepared = await prepareFieldShadow(serviceClient, user.id, fieldId);
  let run = await persistPreparation(serviceClient, user.id, fieldId, prepared);

  const baseResponse = {
    ok: true,
    engine: 'pyfao56',
    mode: 'shadow',
    shadow_scope: 'reference_et_and_single_kc',
    field_id: fieldId,
    run_id: run.id,
    input_fingerprint: prepared.fingerprint,
    ready: prepared.ready,
    day_count: prepared.preparedDays.length,
    dates: prepared.preparedDays.map((day: any) => day.date),
    missing_inputs: prepared.missingInputs,
    excluded_days: prepared.excludedDays,
    source_versions: prepared.sourceVersions,
    production_authority: false,
    full_water_balance_ready: false,
    blocked_full_water_balance_inputs: [
      'validated_basal_kcb',
      'surface_evaporation_layer',
      'current_soil_water_state',
    ],
  };

  if (!runGateway || !prepared.ready || !prepared.gatewayPayload) {
    return baseResponse;
  }

  if (run.status === 'completed' && run.output && run.comparison) {
    return {
      ...baseResponse,
      cached: true,
      output: run.output,
      comparison: run.comparison,
    };
  }

  run = await saveRun(serviceClient, {
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    error_message: null,
  }, run.id);

  try {
    const gatewayPayload = await forwardGateway(
      '/v1/irrigation/pyfao56/shadow',
      prepared.gatewayPayload,
    );
    if (!gatewayPayload?.ok || !Array.isArray(gatewayPayload?.days)) {
      throw new Error(gatewayPayload?.error ?? 'pyfao56 gateway geçerli shadow çıktısı döndürmedi.');
    }

    const comparison = buildComparison(gatewayPayload.days, prepared.preparedDays);
    const completed = await saveRun(serviceClient, {
      status: 'completed',
      engine_version: gatewayPayload?.engine_version ?? null,
      output: gatewayPayload,
      comparison,
      missing_inputs: [],
      error_message: null,
      completed_at: new Date().toISOString(),
    }, run.id);

    return {
      ...baseResponse,
      cached: false,
      run_id: completed.id,
      output: gatewayPayload,
      comparison,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pyfao56 shadow çalıştırılamadı.';
    await saveRun(serviceClient, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    }, run.id);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json();
    const engine = String(body?.engine ?? '').trim();
    const operation = String(body?.operation ?? '').trim();

    if (
      engine === 'pyfao56' &&
      (operation === 'prepare-shadow-field' || operation === 'shadow-run-field')
    ) {
      const fieldId = String(body?.payload?.field_id ?? '').trim();
      if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
      const result = await handleFieldPreparation(req, fieldId, operation === 'shadow-run-field');
      return json(result);
    }

    const route = routeFor(engine, operation);
    if (!route) return json({ ok: false, error: 'Geçersiz model motoru işlemi.' }, 400);

    const payload = await forwardGateway(route, body?.payload ?? {});
    return json(payload ?? { ok: false, error: 'Model Gateway boş yanıt döndürdü.' });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Model Gateway zaman aşımına uğradı.'
        : error instanceof Error
          ? error.message
          : 'Model motoru isteği başarısız oldu.';

    console.error('[model-engine-shadow]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
});
