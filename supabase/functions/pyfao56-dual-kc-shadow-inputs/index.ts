import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_ELEVATION = 'https://api.open-meteo.com/v1/elevation';
const FORECAST_DAYS = 3;

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

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function normalizeSubtype(value: unknown): 'table' | 'wine' | null {
  const normalized = normalizeText(value);
  if (['table', 'sofralık', 'sofralik'].includes(normalized)) return 'table';
  if (['wine', 'şaraplık', 'saraplik'].includes(normalized)) return 'wine';
  return null;
}

function resolveReferenceProfile(profiles: any[], crop: unknown, subtype: unknown) {
  const normalizedCrop = normalizeText(crop);
  if (!normalizedCrop) return null;
  const normalizedSubtype = normalizeSubtype(subtype);
  const candidates = profiles.filter((profile) => {
    if (normalizeText(profile.display_name) === normalizedCrop) return true;
    return Array.isArray(profile.aliases) &&
      profile.aliases.some((alias: unknown) => normalizeText(alias) === normalizedCrop);
  });
  if (!candidates.length) return null;
  const grape = ['üzüm', 'uzum', 'grape', 'grapes'].includes(normalizedCrop);
  if (grape) {
    if (!normalizedSubtype) return null;
    return candidates.find((profile) => profile.crop_subtype === normalizedSubtype) ?? null;
  }
  return candidates.find((profile) => profile.crop_subtype == null) ?? candidates[0] ?? null;
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  return {
    latitude,
    longitude,
    source: field.parcel_centroid_lat != null && field.parcel_centroid_lng != null
      ? 'parcel_centroid'
      : 'field_coordinates',
  };
}

function canopyHeight(field: any) {
  const direct = finite(field?.canopy_height_m);
  if (direct !== null && direct > 0) {
    return { value: direct, source: 'measured_or_manual_numeric' };
  }
  const classes: Record<string, number> = {
    under_1m: 0.75,
    '1_2m': 1.5,
    '2_3m': 2.5,
    '3_5m': 4,
    over_5m: 6,
  };
  const key = String(field?.canopy_height_class ?? '');
  return key in classes
    ? { value: classes[key], source: 'user_confirmed_class' }
    : { value: null, source: null };
}

function canopyCover(field: any) {
  const direct = finite(field?.canopy_cover_percent);
  if (direct !== null && direct >= 0 && direct <= 100) {
    return { value: direct / 100, source: 'measured_or_manual_numeric' };
  }
  const classes: Record<string, number> = {
    very_small: 0.15,
    small: 0.30,
    medium: 0.50,
    large: 0.70,
    very_large: 0.85,
  };
  const key = String(field?.canopy_development_class ?? '');
  return key in classes
    ? { value: classes[key], source: 'user_confirmed_class' }
    : { value: null, source: null };
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error ?? payload?.reason ?? `HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function callFunction(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  slug: string,
  fieldId: string,
) {
  const payload = await fetchJson(`${supabaseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ field_id: fieldId }),
  }, 80_000);

  if (payload?.ok === false) throw new Error(payload?.error ?? `${slug} başarısız.`);
  if (payload?.production_authority !== false || payload?.input_authority !== 'server-derived') {
    throw new Error(`${slug} trust boundary doğrulanamadı.`);
  }
  return payload;
}

async function fetchElevation(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  });
  const payload = await fetchJson(`${OPEN_METEO_ELEVATION}?${params.toString()}`);
  const raw = Array.isArray(payload?.elevation) ? payload.elevation[0] : payload?.elevation;
  return finite(raw);
}

async function fetchForecast(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'dew_point_2m_mean',
      'wind_speed_10m_mean',
      'shortwave_radiation_sum',
      'precipitation_sum',
    ].join(','),
    wind_speed_unit: 'ms',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
  });
  const payload = await fetchJson(`${OPEN_METEO_FORECAST}?${params.toString()}`);
  const daily = payload?.daily ?? {};
  const dates = Array.isArray(daily.time) ? daily.time : [];
  const result: any[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const date = String(dates[index] ?? '');
    const solar = finite(daily.shortwave_radiation_sum?.[index]);
    const tmax = finite(daily.temperature_2m_max?.[index]);
    const tmin = finite(daily.temperature_2m_min?.[index]);
    const dew = finite(daily.dew_point_2m_mean?.[index]);
    const wind = finite(daily.wind_speed_10m_mean?.[index]);
    const rain = finite(daily.precipitation_sum?.[index]);
    if (!date || solar === null || tmax === null || tmin === null || dew === null || wind === null || rain === null) {
      continue;
    }
    result.push({
      date,
      solar_radiation_mj_m2: solar,
      tmax_c: tmax,
      tmin_c: tmin,
      dew_point_c: dew,
      wind_m_s: wind,
      rain_mm: Math.max(0, rain),
    });
  }

  return {
    timezone: payload?.timezone ?? null,
    timezone_abbreviation: payload?.timezone_abbreviation ?? null,
    days: result.slice(0, FORECAST_DAYS),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!authorization || !supabaseUrl || !anonKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    const forbidden = [
      'latitude', 'longitude', 'kcb', 'basal_profile', 'rew', 'rew_values_mm', 'fw', 'theta_fc', 'theta_wp',
      'initial_de_mm', 'initial_dr_mm', 'root_depth_m', 'weather', 'days', 'parameters',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({ ok: false, error: 'Dual-Kc model girdileri istemciden kabul edilmez.' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);

    const [fieldResult, profileResult] = await Promise.all([
      userClient
        .from('fields')
        .select('id,user_id,name,crop,crop_subtype,irrigation_status,irrigation_method,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng,canopy_cover_percent,canopy_height_m,canopy_development_class,canopy_height_class')
        .eq('id', fieldId)
        .maybeSingle(),
      userClient
        .from('crop_water_reference_profiles')
        .select('crop_key,display_name,crop_subtype,aliases,root_depth_min_m,root_depth_max_m,depletion_fraction_p,reference_version,root_source_label'),
    ]);
    if (fieldResult.error) throw fieldResult.error;
    if (profileResult.error) throw profileResult.error;
    const field = fieldResult.data;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const irrigationStatus = normalizeText(field.irrigation_status);
    if (irrigationStatus === 'rainfed') {
      return json({
        ok: true,
        field_id: fieldId,
        status: 'not_applicable',
        ready: false,
        production_authority: false,
        input_authority: 'server-derived',
        missing_inputs: [],
        note: 'Susuz/rainfed tarla için bu adapter sulama dual-Kc shadow kontratı üretmez.',
      });
    }

    const location = resolveLocation(field as Record<string, unknown>);
    const profile = resolveReferenceProfile(
      Array.isArray(profileResult.data) ? profileResult.data : [],
      field.crop,
      field.crop_subtype,
    );
    const height = canopyHeight(field);
    const cover = canopyCover(field);

    const missing: string[] = [];
    if (!location) missing.push('field_location');
    if (!profile) missing.push('crop_water_reference_profile');
    if (height.value === null) missing.push('canopy_height');
    if (cover.value === null) missing.push('canopy_cover');

    const functionResults = location
      ? await Promise.allSettled([
          callFunction(supabaseUrl, anonKey, authorization, 'pyfao56-kcb-context', fieldId),
          callFunction(supabaseUrl, anonKey, authorization, 'pyfao56-water-balance-inputs', fieldId),
          callFunction(supabaseUrl, anonKey, authorization, 'irrigation-water-balance-state', fieldId),
          callFunction(supabaseUrl, anonKey, authorization, 'soil-evaporation-context', fieldId),
          fetchElevation(location.latitude, location.longitude),
          fetchForecast(location.latitude, location.longitude),
        ])
      : [];

    const kcbContext = functionResults[0]?.status === 'fulfilled' ? functionResults[0].value : null;
    const waterInputs = functionResults[1]?.status === 'fulfilled' ? functionResults[1].value : null;
    const irrigationBalance = functionResults[2]?.status === 'fulfilled' ? functionResults[2].value : null;
    const evaporationContext = functionResults[3]?.status === 'fulfilled' ? functionResults[3].value : null;
    const elevationM = functionResults[4]?.status === 'fulfilled' ? functionResults[4].value : null;
    const forecast = functionResults[5]?.status === 'fulfilled' ? functionResults[5].value : null;

    if (!kcbContext) missing.push('kcb_context');
    if (!waterInputs) missing.push('water_balance_inputs');
    if (!evaporationContext) missing.push('soil_evaporation_context');
    if (elevationM === null) missing.push('dem_elevation');
    if (!forecast || !Array.isArray(forecast.days) || forecast.days.length < 1) missing.push('forecast_weather');

    const validatedKcb =
      kcbContext?.validated === true &&
      kcbContext?.status === 'validated' &&
      finite(kcbContext?.kcb) !== null;
    if (!validatedKcb) missing.push('validated_basal_kcb');

    const basalInitial = finite(kcbContext?.reference_profile?.initial);
    const basalMid = finite(kcbContext?.reference_profile?.mid);
    const basalEnd = finite(kcbContext?.reference_profile?.end);
    const validBasalProfile =
      basalInitial !== null && basalMid !== null && basalEnd !== null &&
      basalInitial > 0 && basalMid > 0 && basalEnd > 0 &&
      Math.abs(basalMid - basalInitial) > 1e-9;
    if (!validBasalProfile) missing.push('fao56_basal_kcb_profile');

    const rootDepthM = finite(waterInputs?.root_zone?.scheduling_depth_m);
    const thetaFc = finite(waterInputs?.root_zone?.field_capacity_vol);
    const thetaWp = finite(waterInputs?.root_zone?.wilting_point_vol);
    const measuredDr = finite(waterInputs?.root_zone?.current_depletion_mm);
    const estimatedDr =
      irrigationBalance?.ready === true && irrigationBalance?.status === 'estimated'
        ? finite(irrigationBalance?.root_zone?.current_depletion_mm)
        : null;
    const initialDr = measuredDr ?? estimatedDr;
    const rootStateSource = measuredDr !== null
      ? 'field_water_measurements'
      : estimatedDr !== null
        ? 'irrigation-water-balance-state'
        : null;

    if (rootDepthM === null || thetaFc === null || thetaWp === null) missing.push('root_zone_soil_hydraulics');
    if (initialDr === null) missing.push('current_root_zone_depletion');

    const zeM = finite(waterInputs?.surface_evaporation?.ze_m);
    const initialDe = finite(waterInputs?.surface_evaporation?.de_mm);
    if (zeM === null) missing.push('surface_evaporation_depth');
    if (initialDe === null) missing.push('current_surface_depletion_measurement');

    const rewRangeRaw = evaporationContext?.fao56?.rew_range_mm;
    const rewMin = Array.isArray(rewRangeRaw) ? finite(rewRangeRaw[0]) : null;
    const rewMax = Array.isArray(rewRangeRaw) ? finite(rewRangeRaw[1]) : null;
    if (rewMin === null || rewMax === null || rewMin <= 0 || rewMax < rewMin) {
      missing.push('fao56_rew_reference_range');
    }

    const p = finite(profile?.depletion_fraction_p);
    if (p === null || p <= 0 || p >= 1) missing.push('depletion_fraction_p');

    const uniqueMissing = [...new Set(missing)];
    const kcb = finite(kcbContext?.kcb);
    const weatherDays = Array.isArray(forecast?.days) && kcb !== null
      ? forecast.days.map((day: any) => ({ ...day, kcb: round(kcb, 4) }))
      : [];
    const rewValues = rewMin !== null && rewMax !== null
      ? [...new Set([round(rewMin, 3), round(rewMax, 3)])]
      : [];

    const fwRangeRaw = evaporationContext?.irrigation_wetting?.fw_range;
    const fwMin = Array.isArray(fwRangeRaw) ? finite(fwRangeRaw[0]) : null;
    const fwMax = Array.isArray(fwRangeRaw) ? finite(fwRangeRaw[1]) : null;
    const validFwRange =
      fwMin !== null && fwMax !== null &&
      fwMin > 0 && fwMax >= fwMin && fwMax <= 1;
    if (!validFwRange) missing.push('fao56_irrigation_wetting_fraction_range');

    const gatewayPayload = uniqueMissing.length === 0 && location
      ? {
          field_id: fieldId,
          station: {
            latitude: location.latitude,
            elevation_m: elevationM,
            wind_height_m: 10,
          },
          basal_profile: {
            initial: basalInitial,
            mid: basalMid,
            end: basalEnd,
          },
          state: {
            theta_fc: thetaFc,
            theta_wp: thetaWp,
            root_depth_m: rootDepthM,
            depletion_fraction_p: p,
            ze_m: zeM,
            initial_de_mm: initialDe,
            initial_dr_mm: initialDr,
            canopy_height_m: height.value,
            canopy_cover_fraction: cover.value,
          },
          rew_values_mm: rewValues,
          irrigation_wetting_fraction_range: [fwMin, fwMax],
          days: weatherDays,
          irrigation_events: [],
        }
      : null;

    return json({
      ok: true,
      engine: 'pyfao56',
      mode: 'dual-kc-shadow-inputs',
      field_id: fieldId,
      ready: Boolean(gatewayPayload),
      status: gatewayPayload ? 'bounded_shadow_ready' : 'blocked',
      production_authority: false,
      input_authority: 'server-derived',
      field: {
        name: field.name ?? null,
        crop: field.crop ?? null,
        crop_subtype: normalizeSubtype(field.crop_subtype),
        irrigation_status: field.irrigation_status ?? null,
        irrigation_method: field.irrigation_method ?? null,
        location_source: location?.source ?? null,
      },
      evidence: {
        basal_kcb: kcbContext,
        basal_profile: validBasalProfile ? {
          initial: basalInitial,
          mid: basalMid,
          end: basalEnd,
        } : null,
        root_zone: {
          depth_m: rootDepthM,
          field_capacity_vol: thetaFc,
          wilting_point_vol: thetaWp,
          initial_depletion_mm: initialDr,
          source: rootStateSource,
          measured_depletion_mm: measuredDr,
          estimated_depletion_mm: estimatedDr,
        },
        surface_evaporation: {
          ze_m: zeM,
          initial_depletion_mm: initialDe,
          depletion_source: initialDe !== null ? 'field_water_measurements' : null,
          rew_range_mm: rewMin !== null && rewMax !== null ? [rewMin, rewMax] : null,
          irrigation_wetting: evaporationContext?.irrigation_wetting ?? null,
        },
        canopy: {
          height_m: height.value,
          height_source: height.source,
          cover_fraction: cover.value,
          cover_source: cover.source,
        },
        forecast: {
          provider: 'Open-Meteo',
          timezone: forecast?.timezone ?? null,
          timezone_abbreviation: forecast?.timezone_abbreviation ?? null,
          day_count: weatherDays.length,
        },
      },
      missing_inputs: uniqueMissing,
      gateway_payload: gatewayPayload,
      assumptions: gatewayPayload ? [
        `Doğrulanmış güncel Kcb ${FORECAST_DAYS} günlük kısa shadow penceresinde sabit tutulur.`,
        'FAO basal Kcb initial/mid/end profili yalnız pyfao56 iç interpolasyon geometrisini korumak için taşınır; günlük Kcb saha-doğrulanmış Update girdisiyle verilir.',
        'REW tek sayıya indirgenmez; FAO-56 referans aralığının alt ve üst sınırı ayrı senaryo olarak çalıştırılır.',
        'Sulama yöntemi fw aralığı tek sayıya indirgenmez; yalnız yönteme ait FAO-56 aralığı model belirsizliği olarak taşınır.',
        rootStateSource === 'irrigation-water-balance-state'
          ? 'Kök bölgesi başlangıç Dr değeri gerçek nem sensörü değil; son miktarlı sulama + hava dengesi tahminidir.'
          : 'Kök bölgesi başlangıç Dr değeri saha su ölçümünden türetilmiştir.',
        'Yüzey başlangıç De değeri yalnız gerçek 0–15 cm su ölçümü varsa kabul edilir; sentetik yüzey nemi üretilmez.',
      ] : [],
      caution: 'Bu adapter yalnız bounded dual-Kc shadow girdisi üretir. Production sulama kararı vermez ve eksik yüzey/root state değerlerini uydurmaz.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[pyfao56-dual-kc-shadow-inputs]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Dual-Kc shadow girdileri hazırlanamadı.',
      production_authority: false,
    }, 500);
  }
});
