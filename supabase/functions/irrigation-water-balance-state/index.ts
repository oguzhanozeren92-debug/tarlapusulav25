import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const MAX_BALANCE_LOOKBACK_DAYS = 92;
const EFFECTIVE_RAIN_FACTOR = 0.80;
const FIELD_TIME_ZONE = 'Europe/Istanbul';

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

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function fieldDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FIELD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function normalizeSubtype(value: unknown): 'table' | 'wine' | null {
  const valueNormalized = normalizeText(value);
  if (['table', 'sofralık', 'sofralik'].includes(valueNormalized)) return 'table';
  if (['wine', 'şaraplık', 'saraplik'].includes(valueNormalized)) return 'wine';
  return null;
}

function normalizeIrrigationStatus(value: unknown) {
  const raw = normalizeText(value);
  if (['sulu', 'sulanıyor', 'sulaniyor', 'irrigated', 'irrigation', 'tam sulu'].includes(raw)) return 'irrigated';
  if (['susuz', 'kuru', 'kıraç', 'kirac', 'rainfed', 'dry'].includes(raw)) return 'rainfed';
  if (
    ['kısmi', 'kismi', 'kısmi sulama', 'kismi sulama', 'ihtiyaca göre', 'ihtiyaca gore', 'partial', 'supplemental'].includes(raw) ||
    raw.includes('kısmi') || raw.includes('kismi') || raw.includes('ihtiyaca')
  ) return 'partial';
  return 'unknown';
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    latitude,
    longitude,
    source: field.parcel_centroid_lat != null && field.parcel_centroid_lng != null ? 'parcel_centroid' : 'field_coordinates',
  };
}

function resolveReferenceProfile(profiles: any[], crop: unknown, subtype: unknown) {
  const normalizedCrop = normalizeText(crop);
  if (!normalizedCrop) return null;
  const normalizedSubtype = normalizeSubtype(subtype);
  const candidates = profiles.filter((profile) => {
    if (normalizeText(profile.display_name) === normalizedCrop) return true;
    return Array.isArray(profile.aliases) && profile.aliases.some((alias: unknown) => normalizeText(alias) === normalizedCrop);
  });
  if (!candidates.length) return null;
  const grape = ['üzüm', 'uzum', 'grape', 'grapes'].includes(normalizedCrop);
  if (grape) {
    if (!normalizedSubtype) return null;
    return candidates.find((profile) => profile.crop_subtype === normalizedSubtype) ?? null;
  }
  return candidates.find((profile) => profile.crop_subtype == null) ?? candidates[0] ?? null;
}

function findNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function parseIrrigationAmount(activity: any, areaDecare: number | null) {
  const notes = String(activity?.notes ?? '');
  const unit = normalizeText(activity?.unit);
  const quantity = finite(activity?.quantity);

  let totalM3 = findNumber(notes, [
    /toplam\s+sulama\s+suyu\s*:\s*([\d.,]+)\s*m[³3]/i,
    /toplam\s+su\s*:\s*([\d.,]+)\s*m[³3]/i,
  ]);
  let perDecare = findNumber(notes, [
    /dekara\s+sulama\s+suyu\s*:\s*([\d.,]+)\s*m[³3]\s*\/\s*da/i,
    /([\d.,]+)\s*m[³3]\s*\/\s*da/i,
  ]);

  const perDecareUnit = unit === 'mm' || unit.includes('m³/da') || unit.includes('m3/da') || unit.includes('m³ / da') || unit.includes('m3 / da');
  const totalUnit = !perDecareUnit && (unit === 'm³' || unit === 'm3' || unit.includes('m³') || unit.includes('m3'));

  if (perDecare === null && quantity !== null && quantity >= 0 && perDecareUnit) perDecare = quantity;
  if (totalM3 === null && quantity !== null && quantity >= 0 && totalUnit) totalM3 = quantity;
  if (perDecare === null && totalM3 !== null && areaDecare !== null && areaDecare > 0) perDecare = totalM3 / areaDecare;
  if (totalM3 === null && perDecare !== null && areaDecare !== null && areaDecare > 0) totalM3 = perDecare * areaDecare;

  return {
    appliedWaterMm: perDecare === null ? null : round(perDecare, 3),
    totalWaterM3: totalM3 === null ? null : round(totalM3, 3),
  };
}

function weightedSoilValue(layers: any[], targetDepthCm: number, key: 'thFC' | 'thWP') {
  let weighted = 0;
  let covered = 0;
  for (const layer of layers) {
    const from = finite(layer?.fromCm);
    const to = finite(layer?.toCm);
    const value = finite(layer?.hydraulic?.[key]);
    if (from === null || to === null || value === null || to <= from) continue;
    const overlap = Math.max(0, Math.min(to, targetDepthCm) - Math.max(from, 0));
    if (overlap <= 0) continue;
    weighted += value * overlap;
    covered += overlap;
  }
  if (covered + 0.001 < targetDepthCm || covered <= 0) return null;
  return weighted / covered;
}

async function loadSoilProfile(
  supabaseUrl: string,
  serviceRoleKey: string,
  latitude: number,
  longitude: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/aquacrop-soil-profile`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) return null;
    if (payload.input_authority !== 'server-derived' || payload.production_authority !== false) return null;
    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWeather(latitude: number, longitude: number, pastDays: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    daily: 'et0_fao_evapotranspiration,precipitation_sum',
    timezone: FIELD_TIME_ZONE,
    past_days: String(Math.max(1, Math.min(MAX_BALANCE_LOOKBACK_DAYS, pastDays))),
    forecast_days: '5',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${OPEN_METEO_FORECAST}?${params.toString()}`, { signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) throw new Error(`Open-Meteo ${response.status}`);
    const dates = Array.isArray(payload.daily.time) ? payload.daily.time : [];
    const eto = Array.isArray(payload.daily.et0_fao_evapotranspiration) ? payload.daily.et0_fao_evapotranspiration : [];
    const rain = Array.isArray(payload.daily.precipitation_sum) ? payload.daily.precipitation_sum : [];
    return dates.map((date: string, index: number) => ({
      date: String(date),
      etoMm: finite(eto[index]),
      precipitationMm: finite(rain[index]),
    }));
  } finally {
    clearTimeout(timeout);
  }
}

function daysBetween(startIso: string, endIso: string) {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    if (['latitude','longitude','crop','kc','root_depth_m','depletion_mm'].some((key) => key in body)) {
      return json({ ok: false, error: 'Su dengesi girdileri istemciden kabul edilmez.' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);

    const [fieldResult, profileResult, irrigationResult, kcResult] = await Promise.all([
      serviceClient.from('fields').select('id,user_id,name,crop,crop_subtype,area_decare,irrigation_status,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng').eq('id', fieldId).eq('user_id', authData.user.id).maybeSingle(),
      serviceClient.from('crop_water_reference_profiles').select('crop_key,display_name,crop_subtype,aliases,root_depth_min_m,root_depth_max_m,depletion_fraction_p,root_source_label'),
      serviceClient.from('activities').select('id,activity_date,quantity,unit,notes,created_at').eq('field_id', fieldId).eq('user_id', authData.user.id).ilike('activity_type', 'Sulama').order('activity_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from('field_irrigation_kc_snapshots').select('snapshot_date,kc,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at').eq('field_id', fieldId).eq('user_id', authData.user.id).order('snapshot_date', { ascending: false }).order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    for (const result of [fieldResult, profileResult, irrigationResult, kcResult]) if (result.error) throw result.error;
    const field = fieldResult.data;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const irrigationStatus = normalizeIrrigationStatus(field.irrigation_status);
    if (irrigationStatus === 'rainfed') {
      return json({
        ok: true,
        field_id: fieldId,
        status: 'not_applicable',
        irrigation_status: irrigationStatus,
        field_time_zone: FIELD_TIME_ZONE,
        production_authority: false,
        input_authority: 'server-derived',
        ready: false,
        missing_inputs: [],
        note: 'Susuz/rainfed tarla için bu endpoint sulama su dengesi başlangıcı üretmez.',
      });
    }

    const location = resolveLocation(field as Record<string, unknown>);
    const reference = resolveReferenceProfile(Array.isArray(profileResult.data) ? profileResult.data : [], field.crop, field.crop_subtype);
    const rootDepthM = finite(reference?.root_depth_min_m);
    const p = finite(reference?.depletion_fraction_p);
    const kc = finite(kcResult.data?.kc);
    const lastIrrigationDate = String(irrigationResult.data?.activity_date ?? '').trim() || null;
    const areaDecare = finite(field.area_decare);
    const irrigationAmount = irrigationResult.data ? parseIrrigationAmount(irrigationResult.data, areaDecare) : { appliedWaterMm: null, totalWaterM3: null };

    const missing: string[] = [];
    if (irrigationStatus === 'unknown') missing.push('irrigation_status');
    if (!location) missing.push('field_location');
    if (!reference || rootDepthM === null || p === null) missing.push('root_zone_reference');
    if (kc === null || kc <= 0 || kc > 3) missing.push('current_kc');
    if (!lastIrrigationDate) missing.push('last_irrigation');
    if (lastIrrigationDate && irrigationAmount.appliedWaterMm === null) missing.push('last_irrigation_amount');

    const today = fieldDate();
    const lookbackDays = lastIrrigationDate ? daysBetween(lastIrrigationDate, today) : null;
    if (lookbackDays !== null && lookbackDays > MAX_BALANCE_LOOKBACK_DAYS) missing.push('recent_water_baseline');

    if (missing.length) {
      return json({
        ok: true,
        field_id: fieldId,
        status: 'blocked',
        irrigation_status: irrigationStatus,
        field_time_zone: FIELD_TIME_ZONE,
        evidence_date: today,
        production_authority: false,
        input_authority: 'server-derived',
        ready: false,
        missing_inputs: [...new Set(missing)],
        baseline: {
          last_irrigation_date: lastIrrigationDate,
          applied_water_mm: irrigationAmount.appliedWaterMm,
        },
        note: 'Eksik gerçek veri nedeniyle mevcut kök bölgesi su açığı üretilmedi.',
      });
    }

    const soil = await loadSoilProfile(supabaseUrl, serviceRoleKey, location!.latitude, location!.longitude);
    const layers = Array.isArray(soil?.layers) ? soil.layers : [];
    const targetDepthCm = rootDepthM! * 100;
    const fieldCapacity = weightedSoilValue(layers, targetDepthCm, 'thFC');
    const wiltingPoint = weightedSoilValue(layers, targetDepthCm, 'thWP');
    if (fieldCapacity === null || wiltingPoint === null || fieldCapacity <= wiltingPoint) {
      return json({
        ok: true,
        field_id: fieldId,
        status: 'blocked',
        irrigation_status: irrigationStatus,
        field_time_zone: FIELD_TIME_ZONE,
        evidence_date: today,
        production_authority: false,
        input_authority: 'server-derived',
        ready: false,
        missing_inputs: ['root_zone_soil_hydraulics'],
        note: 'Kök bölgesi FC/WP profili oluşturulamadı.',
      });
    }

    const tawMm = Math.max(0, 1000 * (fieldCapacity - wiltingPoint) * rootDepthM!);
    const rawMm = Math.max(0, tawMm * p!);
    const weather = await fetchWeather(location!.latitude, location!.longitude, Math.max(1, lookbackDays! + 1));

    let currentDepletionMm = 0;
    const historical = weather.filter((day) => day.date > lastIrrigationDate! && day.date < today);
    let validHistoricalDays = 0;
    for (const day of historical) {
      if (day.etoMm === null || day.precipitationMm === null) continue;
      const cropUse = Math.max(0, day.etoMm * kc!);
      const effectiveRain = Math.max(0, day.precipitationMm * EFFECTIVE_RAIN_FACTOR);
      currentDepletionMm = clamp(currentDepletionMm + cropUse - effectiveRain, 0, tawMm);
      validHistoricalDays += 1;
    }

    let running = currentDepletionMm;
    const forecast = weather.filter((day) => day.date >= today).slice(0, 5).map((day) => {
      const eto = Math.max(0, day.etoMm ?? 0);
      const rain = Math.max(0, day.precipitationMm ?? 0);
      const cropUse = eto * kc!;
      const effectiveRain = rain * EFFECTIVE_RAIN_FACTOR;
      running = clamp(running + cropUse - effectiveRain, 0, tawMm);
      return {
        date: day.date,
        eto_mm: round(eto, 2),
        crop_water_use_mm: round(cropUse, 2),
        precipitation_mm: round(rain, 2),
        effective_rain_mm: round(effectiveRain, 2),
        estimated_depletion_mm: round(running, 2),
        stress_threshold_reached: running >= rawMm,
      };
    });

    const baselineConfidence = irrigationAmount.appliedWaterMm! < rawMm * 0.50 ? 'low' : 'medium';

    return json({
      ok: true,
      field_id: fieldId,
      status: 'estimated',
      irrigation_status: irrigationStatus,
      field_time_zone: FIELD_TIME_ZONE,
      evidence_date: today,
      production_authority: false,
      input_authority: 'server-derived',
      ready: true,
      source: 'last_irrigation_fao56_style_water_balance',
      confidence: baselineConfidence,
      baseline: {
        assumption: 'root_zone_near_field_capacity_after_last_recorded_irrigation',
        last_irrigation_date: lastIrrigationDate,
        applied_water_mm: irrigationAmount.appliedWaterMm,
        amount_is_below_half_raw: irrigationAmount.appliedWaterMm! < rawMm * 0.50,
      },
      crop_coefficient: {
        kc: round(kc!, 4),
        snapshot_date: kcResult.data?.snapshot_date ?? null,
        phenology_stage: kcResult.data?.phenology_stage ?? null,
        confidence: kcResult.data?.coefficient_confidence ?? null,
        source: kcResult.data?.source_label ?? null,
      },
      root_zone: {
        depth_m: round(rootDepthM!, 3),
        field_capacity_vol: round(fieldCapacity, 4),
        wilting_point_vol: round(wiltingPoint, 4),
        total_available_water_mm: round(tawMm, 2),
        readily_available_water_mm: round(rawMm, 2),
        current_depletion_mm: round(currentDepletionMm, 2),
        current_depletion_ratio_of_taw: tawMm > 0 ? round(currentDepletionMm / tawMm, 4) : null,
        stress_threshold_reached: currentDepletionMm >= rawMm,
      },
      historical_valid_day_count: validHistoricalDays,
      forecast,
      assumptions: [
        'Son kayıtlı sulama sonrası kök bölgesi tarla kapasitesine yakın kabul edilir.',
        'Etkili yağış planlama tahmini olarak toplam yağışın %80’i kabul edilir.',
        'Günlük ETc hesabında en güncel doğrulanmış Kc, hesap penceresi boyunca sabit kullanılır.',
      ],
      caution: 'Bu durum gerçek toprak nem sensörü ölçümü değildir; sulama kaydı, FAO-56 tarzı kök bölgesi kapasitesi, ET0×Kc ve etkili yağıştan üretilen server-side tahmindir.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[irrigation-water-balance-state]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Sulama su dengesi durumu hazırlanamadı.',
      production_authority: false,
    }, 500);
  }
});
