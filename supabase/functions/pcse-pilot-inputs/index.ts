import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED = ['field_location', 'daily_weather', 'crop_parameters', 'planting_date'] as const;
const ARCHIVE_LAG_DAYS = 6;
const WEATHER_VALIDATION_DAYS = 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DURATION_DAYS = 365;

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

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function validIsoDate(value: unknown) {
  const text = String(value ?? '').trim();
  return ISO_DATE.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`));
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function resolveCropReference(rows: any[], crop: unknown) {
  const normalizedCrop = normalizeText(crop);
  if (!normalizedCrop) return null;
  return rows.find((row) => {
    if (!row?.verified) return false;
    if (normalizeText(row.crop_name) === normalizedCrop) return true;
    return Array.isArray(row.crop_aliases) && row.crop_aliases.some((alias: unknown) => normalizeText(alias) === normalizedCrop);
  }) ?? null;
}

function resolveVerifiedVarietyMapping(rows: any[], cropName: string, localVariety: unknown) {
  const normalizedVariety = normalizeText(localVariety);
  if (!normalizedVariety) return null;
  return rows.find((row) =>
    row?.verified === true &&
    String(row.crop_name ?? '') === cropName &&
    normalizeText(row.normalized_local_variety_name) === normalizedVariety
  ) ?? null;
}

function deriveCropParameters(season: any, cropReference: any, varietyMapping: any) {
  const localVarietyName = String(season?.variety_name ?? '').trim();
  if (!cropReference) {
    return {
      available: false,
      source: null,
      parameters: null,
      detail: 'Bu ürün için doğrulanmış WOFOST 7.2 ürün eşlemesi yok.',
    };
  }
  if (!localVarietyName) {
    return {
      available: false,
      source: cropReference.source_label,
      sourceReference: cropReference.source_url,
      parameters: {
        wofost_crop_key: cropReference.wofost_crop_key,
        local_variety_name: null,
        wofost_variety_key: null,
        model_family: cropReference.model_family,
        model_version: cropReference.model_version,
      },
      detail: 'Çiftçinin gerçek çeşit adı henüz kayıtlı değil; WOFOST variety seçimi yapılmadı.',
    };
  }
  if (!varietyMapping) {
    return {
      available: false,
      source: cropReference.source_label,
      sourceReference: cropReference.source_url,
      parameters: {
        wofost_crop_key: cropReference.wofost_crop_key,
        local_variety_name: localVarietyName,
        wofost_variety_key: null,
        model_family: cropReference.model_family,
        model_version: cropReference.model_version,
      },
      detail: 'Gerçek çeşit adı kayıtlı; fakat bu çeşit için doğrulanmış WOFOST variety eşlemesi henüz yok.',
    };
  }
  return {
    available: true,
    source: 'pcse_upstream',
    sourceReference: varietyMapping.source_url,
    verifiedAt: varietyMapping.updated_at ?? varietyMapping.created_at ?? null,
    parameters: {
      wofost_crop_key: varietyMapping.wofost_crop_key,
      wofost_variety_key: varietyMapping.wofost_variety_key,
      local_variety_name: localVarietyName,
      model_family: varietyMapping.model_family,
      model_version: varietyMapping.model_version,
      provider: 'PCSE YAMLCropDataProvider',
    },
    detail: 'Ürün ve model variety anahtarı doğrulanmış eşleme kaydından çözüldü; varsayılan variety seçilmedi.',
  };
}

function derivePlantingAndAgromanagement(season: any, cropReference: any, varietyMapping: any) {
  const plantingDate = String(season?.planting_date ?? '').trim();
  const harvestDate = String(season?.harvest_date ?? '').trim();
  const crop = String(season?.crop ?? '').trim();

  if (!season?.id || !crop || !validIsoDate(plantingDate)) {
    return {
      available: false,
      source: 'field_seasons',
      sourceReference: season?.id ? `field_seasons:${season.id}` : null,
      plantingDate: null,
      parameters: null,
      detail: 'PCSE fenoloji pilotu için gerçek sezon, ürün ve ekim/dikim tarihi gerekli.',
    };
  }

  const cropName = String(cropReference?.wofost_crop_key ?? crop);
  const varietyName = varietyMapping?.wofost_variety_key ? String(varietyMapping.wofost_variety_key) : null;
  const hasHarvest = validIsoDate(harvestDate) && Date.parse(`${harvestDate}T00:00:00Z`) >= Date.parse(`${plantingDate}T00:00:00Z`);

  return {
    available: true,
    source: 'field_seasons',
    sourceReference: `field_seasons:${season.id}`,
    verifiedAt: season.updated_at ?? season.created_at ?? null,
    plantingDate,
    parameters: {
      campaign_start_date: plantingDate,
      crop_calendar: {
        local_crop_name: crop,
        local_variety_name: String(season?.variety_name ?? '').trim() || null,
        crop_name: cropName,
        variety_name: varietyName,
        crop_start_date: plantingDate,
        crop_start_type: 'sowing',
        crop_end_date: hasHarvest ? harvestDate : null,
        crop_end_type: hasHarvest ? 'harvest' : 'maturity',
        max_duration: MAX_DURATION_DAYS,
      },
    },
    detail: hasHarvest
      ? 'Fenoloji takvimi gerçek ekim ve hasat tarihlerinden üretildi.'
      : 'Fenoloji takvimi gerçek ekim tarihinden üretildi; hasat tarihi olmadığı için model maturity sonlandırması kullanacak.',
  };
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('PCSE pilot girdileri için sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('PCSE pilot girdileri için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function validateDailyWeather(location: { latitude: number; longitude: number } | null) {
  if (!location) return { available: false, source: null, days: 0, detail: 'Tarla koordinatı eksik.' };
  const end = isoDateDaysAgo(ARCHIVE_LAG_DAYS);
  const start = isoDateDaysAgo(ARCHIVE_LAG_DAYS + WEATHER_VALIDATION_DAYS - 1);
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,precipitation_sum,shortwave_radiation_sum');
  url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,dewpoint_2m');
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('models', 'era5_land');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'TarlaPusula-PCSE-Phenology/2.0' } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily || !payload?.hourly) {
      return { available: false, source: 'Open-Meteo ERA5-Land', days: 0, detail: `Weather HTTP ${response.status}` };
    }
    const d = payload.daily;
    const dates = Array.isArray(d.time) ? d.time : [];
    const tmin = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [];
    const tmax = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [];
    const rain = Array.isArray(d.precipitation_sum) ? d.precipitation_sum : [];
    const radiation = Array.isArray(d.shortwave_radiation_sum) ? d.shortwave_radiation_sum : [];
    const valid = dates.length === WEATHER_VALIDATION_DAYS && [tmin, tmax, rain, radiation].every((a) => a.length === dates.length) && dates.every((_: string, i: number) => {
      const lo = Number(tmin[i]); const hi = Number(tmax[i]); const p = Number(rain[i]); const r = Number(radiation[i]);
      return Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo && Number.isFinite(p) && p >= 0 && Number.isFinite(r) && r >= 0;
    });
    return {
      available: valid,
      source: 'Open-Meteo ERA5-Land',
      provider: 'PCSE OpenMeteoWeatherDataProvider compatible contract',
      archiveLagDays: ARCHIVE_LAG_DAYS,
      days: valid ? dates.length : 0,
      start,
      end,
      detail: valid ? 'PCSE için gerekli günlük/saatlik hava kaynakları server tarafında doğrulandı.' : 'PCSE hava serisi eksik veya geçersiz.',
    };
  } catch (error) {
    return { available: false, source: 'Open-Meteo ERA5-Land', days: 0, detail: error instanceof Error ? error.message : 'Weather validation failed' };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    const { user, serviceClient } = await authenticatedClients(req);

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,crop,season,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    let seasonQuery = serviceClient
      .from('field_seasons')
      .select('id,year,crop,variety_name,planting_date,harvest_date,created_at,updated_at')
      .eq('user_id', user.id)
      .eq('field_id', fieldId)
      .order('year', { ascending: false })
      .limit(1);
    if (Number.isInteger(Number(field.season))) seasonQuery = seasonQuery.eq('year', Number(field.season));

    const location = resolveLocation(field as Record<string, unknown>);
    const [seasonResult, cropRefsResult, varietyMappingsResult, weather] = await Promise.all([
      seasonQuery.maybeSingle(),
      serviceClient
        .from('pcse_crop_reference_mappings')
        .select('crop_name,crop_aliases,wofost_crop_key,model_family,model_version,source_label,source_url,verified'),
      serviceClient
        .from('pcse_variety_mappings')
        .select('crop_name,local_variety_name,normalized_local_variety_name,wofost_crop_key,wofost_variety_key,model_family,model_version,source_label,source_url,verified,created_at,updated_at')
        .eq('verified', true),
      validateDailyWeather(location),
    ]);

    for (const result of [seasonResult, cropRefsResult, varietyMappingsResult]) {
      if (result.error) throw result.error;
    }

    const season = seasonResult.data;
    const cropIdentity = season?.crop ?? field.crop ?? null;
    const cropReference = resolveCropReference(Array.isArray(cropRefsResult.data) ? cropRefsResult.data : [], cropIdentity);
    const varietyMapping = cropReference
      ? resolveVerifiedVarietyMapping(
          Array.isArray(varietyMappingsResult.data) ? varietyMappingsResult.data : [],
          String(cropReference.crop_name),
          season?.variety_name,
        )
      : null;

    const cropParameters = deriveCropParameters(season, cropReference, varietyMapping);
    const planting = derivePlantingAndAgromanagement(season, cropReference, varietyMapping);
    const fieldLocation = location
      ? { available: true, source: 'fields', latitude: location.latitude, longitude: location.longitude, detail: 'Tarla koordinatı server-side field kaydından çözüldü.' }
      : { available: false, source: 'fields', latitude: null, longitude: null, detail: 'Tarla koordinatı eksik.' };

    const availableInputs: string[] = [];
    if (fieldLocation.available) availableInputs.push('field_location');
    if (weather.available) availableInputs.push('daily_weather');
    if (cropParameters.available) availableInputs.push('crop_parameters');
    if (planting.available) availableInputs.push('planting_date');

    const missingInputs = REQUIRED.filter((key) => !availableInputs.includes(key));
    return json({
      ok: true,
      engine: 'pcse',
      mode: 'phenology-pilot-input-adapter',
      field_id: fieldId,
      rollout: 'pilot',
      production_authority: false,
      water_stress_authority: false,
      input_authority: 'server-derived',
      client_supplied_agricultural_values_accepted: false,
      ready: missingInputs.length === 0,
      available_inputs: availableInputs,
      missing_inputs: missingInputs,
      adapters: {
        field_location: fieldLocation,
        daily_weather: weather,
        crop_parameters: cropParameters,
        planting_date: planting,
        agromanagement: planting,
        soil_provider: {
          available: true,
          source: 'PCSE DummySoilDataProvider',
          field_measurement: false,
          structural_only: true,
          detail: 'Wofost72_Phenology için PCSE’nin yapısal soil providerı; fenoloji-only çalışır ve saha toprağı iddiası taşımaz.',
        },
      },
      context: {
        season_id: season?.id ?? null,
        crop_identity: cropIdentity,
        farmer_variety_name: season?.variety_name ?? null,
        wofost_crop_key: cropReference?.wofost_crop_key ?? null,
        wofost_variety_key: varietyMapping?.wofost_variety_key ?? null,
        planting_date: season?.planting_date ?? null,
        harvest_date: season?.harvest_date ?? null,
        season_year: season?.year ?? field.season ?? null,
        weather_archive_lag_days: ARCHIVE_LAG_DAYS,
        model: 'Wofost72_Phenology',
      },
      note: missingInputs.length === 0
        ? 'PCSE/WOFOST fenoloji pilot girdileri doğrulanmış server-side kaynaklarla hazır.'
        : 'Eksik fenoloji girdileri için sentetik ürün/çeşit/tarih üretilmedi; pilot bloklu kalır.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PCSE pilot input hazırlığı başarısız oldu.';
    console.error('[pcse-pilot-inputs]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
