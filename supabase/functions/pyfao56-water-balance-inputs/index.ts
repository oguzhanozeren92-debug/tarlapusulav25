import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_MEASUREMENT_AGE_DAYS = 14;
const DEFAULT_EVAPORATION_DEPTH_M = 0.15;

type WaterMeasurement = {
  measured_at: string;
  volumetric_water_content: number;
  depth_from_cm: number;
  depth_to_cm: number;
  source: string;
};

type SoilLayer = {
  fromCm: number;
  toCm: number;
  available?: boolean;
  texture?: {
    sandPercent?: number;
    clayPercent?: number;
    siltPercent?: number;
    socGKg?: number;
  };
  hydraulic?: {
    thFC?: number;
    thWP?: number;
    thS?: number;
  };
};

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
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function normalizeSubtype(value: unknown): 'table' | 'wine' | null {
  const normalized = normalizeText(value);
  if (['table', 'sofralık', 'sofralik'].includes(normalized)) return 'table';
  if (['wine', 'şaraplık', 'saraplik'].includes(normalized)) return 'wine';
  return null;
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

type StageResolution = {
  mode: 'initial' | 'mid' | 'end' | 'initial_to_mid' | 'mid_to_end';
  weight: number;
};

function resolveStage(stage: unknown): StageResolution | null {
  switch (normalizeText(stage)) {
    case 'dormancy':
    case 'pre_sowing':
      return { mode: 'initial', weight: 0 };
    case 'bud_swell':
    case 'bud_break':
    case 'establishment':
      return { mode: 'initial_to_mid', weight: 0.30 };
    case 'flowering':
      return { mode: 'initial_to_mid', weight: 0.55 };
    case 'fruit_set':
    case 'reproductive':
      return { mode: 'initial_to_mid', weight: 0.80 };
    case 'vegetative':
    case 'fruit_growth':
    case 'veraison':
      return { mode: 'mid', weight: 1 };
    case 'maturation':
      return { mode: 'mid_to_end', weight: 0.50 };
    case 'harvest_window':
      return { mode: 'mid_to_end', weight: 0.85 };
    case 'leaf_fall':
    case 'post_harvest':
      return { mode: 'end', weight: 1 };
    default:
      return null;
  }
}

function interpolateKcb(profile: any, stage: StageResolution | null): number | null {
  if (!profile || !stage) return null;
  const initial = finite(profile.kcb_initial);
  const mid = finite(profile.kcb_mid);
  const end = finite(profile.kcb_end);
  if (initial === null || mid === null || end === null) return null;
  switch (stage.mode) {
    case 'initial': return initial;
    case 'mid': return mid;
    case 'end': return end;
    case 'initial_to_mid': return initial + (mid - initial) * stage.weight;
    case 'mid_to_end': return mid + (end - mid) * stage.weight;
  }
}

function newestCompleteMeasurementDay(rows: WaterMeasurement[], targetDepthCm: number) {
  const groups = new Map<string, WaterMeasurement[]>();
  for (const row of rows) {
    const timestamp = new Date(row.measured_at);
    if (!Number.isFinite(timestamp.getTime())) continue;
    const key = timestamp.toISOString().slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const dates = [...groups.keys()].sort().reverse();
  for (const date of dates) {
    const samples = (groups.get(date) ?? [])
      .filter((row) =>
        Number.isFinite(row.depth_from_cm) && Number.isFinite(row.depth_to_cm) &&
        row.depth_from_cm >= 0 && row.depth_to_cm > row.depth_from_cm &&
        Number.isFinite(row.volumetric_water_content) &&
        row.volumetric_water_content > 0 && row.volumetric_water_content < 1
      )
      .sort((a, b) => a.depth_from_cm - b.depth_from_cm || a.depth_to_cm - b.depth_to_cm);

    let cursor = 0;
    for (const sample of samples) {
      if (sample.depth_from_cm > cursor + 0.001) break;
      if (sample.depth_to_cm > cursor) cursor = sample.depth_to_cm;
      if (cursor >= targetDepthCm - 0.001) {
        return { date, samples, coverageDepthCm: cursor };
      }
    }
  }
  return null;
}

function weightedSoilValue(layers: SoilLayer[], targetDepthCm: number, key: 'thFC' | 'thWP') {
  let weighted = 0;
  let covered = 0;
  for (const layer of layers) {
    const from = finite(layer.fromCm);
    const to = finite(layer.toCm);
    const value = finite(layer.hydraulic?.[key]);
    if (from === null || to === null || value === null || to <= from) continue;
    const overlap = Math.max(0, Math.min(to, targetDepthCm) - Math.max(from, 0));
    if (overlap <= 0) continue;
    weighted += value * overlap;
    covered += overlap;
  }
  if (covered + 0.001 < targetDepthCm || covered <= 0) return null;
  return weighted / covered;
}

function weightedMeasurementValue(samples: WaterMeasurement[], targetDepthCm: number) {
  let weighted = 0;
  let covered = 0;
  let cursor = 0;
  for (const sample of samples) {
    const from = Math.max(0, sample.depth_from_cm);
    const to = Math.min(targetDepthCm, sample.depth_to_cm);
    if (to <= from) continue;
    if (from > cursor + 0.001) return null;
    const effectiveFrom = Math.max(from, cursor);
    const thickness = to - effectiveFrom;
    if (thickness > 0) {
      weighted += sample.volumetric_water_content * thickness;
      covered += thickness;
      cursor = Math.max(cursor, to);
    }
    if (cursor >= targetDepthCm - 0.001) break;
  }
  if (covered + 0.001 < targetDepthCm || covered <= 0) return null;
  return weighted / covered;
}

async function loadSoilProfile(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  latitude: number,
  longitude: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/aquacrop-soil-profile`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
      return { ok: false, error: payload?.error ?? `aquacrop-soil-profile HTTP ${response.status}`, payload };
    }
    return { ok: true, error: null, payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Soil profile unavailable', payload: null };
  } finally {
    clearTimeout(timeout);
  }
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
      'latitude', 'longitude', 'geometry', 'crop', 'crop_key', 'crop_subtype',
      'kcb', 'theta_fc', 'theta_wp', 'theta0', 'root_depth_m', 'soil_profile',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'PyFAO56 girdileri istemciden kabul edilmez; tarla bağlamı sunucudan çözülür.',
      }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);

    const { data: field, error: fieldError } = await userClient
      .from('fields')
      .select('id,user_id,name,crop,crop_subtype,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const location = resolveLocation(field as Record<string, unknown>);

    const [{ data: profiles, error: profileError }, { data: kcSnapshot, error: kcError }] = await Promise.all([
      userClient
        .from('crop_water_reference_profiles')
        .select('crop_key,display_name,crop_subtype,crop_subtype_label,aliases,kcb_initial,kcb_mid,kcb_end,root_depth_min_m,root_depth_max_m,depletion_fraction_p,ground_cover_assumption,kcb_source_label,kcb_source_url,root_source_label,root_source_url,reference_version'),
      userClient
        .from('field_irrigation_kc_snapshots')
        .select('snapshot_date,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at')
        .eq('field_id', fieldId)
        .order('snapshot_date', { ascending: false })
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profileError) throw profileError;
    if (kcError) throw kcError;

    const reference = resolveReferenceProfile(Array.isArray(profiles) ? profiles : [], field.crop, field.crop_subtype);
    const stage = resolveStage(kcSnapshot?.phenology_stage);
    const kcbCandidate = interpolateKcb(reference, stage);

    const rootDepthM = finite(reference?.root_depth_min_m);
    const rootDepthCm = rootDepthM === null ? null : rootDepthM * 100;

    const recentSince = new Date(Date.now() - MAX_MEASUREMENT_AGE_DAYS * 86400_000).toISOString();
    const { data: measurementRows, error: measurementError } = await userClient
      .from('field_water_measurements')
      .select('measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source')
      .eq('field_id', fieldId)
      .gte('measured_at', recentSince)
      .order('measured_at', { ascending: false })
      .limit(200);
    if (measurementError) throw measurementError;

    const measurements: WaterMeasurement[] = (Array.isArray(measurementRows) ? measurementRows : [])
      .map((row: any) => ({
        measured_at: String(row.measured_at ?? ''),
        volumetric_water_content: Number(row.volumetric_water_content),
        depth_from_cm: Number(row.depth_from_cm),
        depth_to_cm: Number(row.depth_to_cm),
        source: String(row.source ?? ''),
      }));

    const rootMeasurement = rootDepthCm === null ? null : newestCompleteMeasurementDay(measurements, rootDepthCm);
    const surfaceMeasurement = newestCompleteMeasurementDay(measurements, DEFAULT_EVAPORATION_DEPTH_M * 100);

    const soilResult = location
      ? await loadSoilProfile(supabaseUrl, anonKey, authorization, location.latitude, location.longitude)
      : { ok: false, error: 'field_location_missing', payload: null };
    const soilLayers: SoilLayer[] = Array.isArray(soilResult.payload?.layers) ? soilResult.payload.layers : [];

    const rootFc = rootDepthCm === null ? null : weightedSoilValue(soilLayers, rootDepthCm, 'thFC');
    const rootWp = rootDepthCm === null ? null : weightedSoilValue(soilLayers, rootDepthCm, 'thWP');
    const rootTheta0 = rootDepthCm === null || !rootMeasurement
      ? null
      : weightedMeasurementValue(rootMeasurement.samples, rootDepthCm);

    const topDepthCm = DEFAULT_EVAPORATION_DEPTH_M * 100;
    const topFc = weightedSoilValue(soilLayers, topDepthCm, 'thFC');
    const topWp = weightedSoilValue(soilLayers, topDepthCm, 'thWP');
    const topTheta0 = surfaceMeasurement
      ? weightedMeasurementValue(surfaceMeasurement.samples, topDepthCm)
      : null;

    const rootTawMm = rootFc !== null && rootWp !== null && rootDepthM !== null
      ? Math.max(0, 1000 * (rootFc - rootWp) * rootDepthM)
      : null;
    const rootDepletionMm = rootFc !== null && rootTheta0 !== null && rootDepthM !== null && rootTawMm !== null
      ? clamp(1000 * (rootFc - rootTheta0) * rootDepthM, 0, rootTawMm)
      : null;

    const tewMm = topFc !== null && topWp !== null
      ? Math.max(0, 1000 * (topFc - 0.5 * topWp) * DEFAULT_EVAPORATION_DEPTH_M)
      : null;
    const surfaceDepletionMm = topFc !== null && topTheta0 !== null && tewMm !== null
      ? clamp(1000 * (topFc - topTheta0) * DEFAULT_EVAPORATION_DEPTH_M, 0, tewMm)
      : null;

    const missingInputs: string[] = [];
    if (!reference) missingInputs.push('validated_basal_kcb_reference');
    if (!stage || kcbCandidate === null) missingInputs.push('current_phenology_stage_for_kcb');
    if (!location) missingInputs.push('field_location');
    if (!soilResult.ok || rootFc === null || rootWp === null) missingInputs.push('root_zone_soil_hydraulics');
    if (!rootMeasurement || rootTheta0 === null) missingInputs.push('current_root_zone_water_measurement');
    if (topFc === null || topWp === null) missingInputs.push('surface_soil_hydraulics');
    if (!surfaceMeasurement || topTheta0 === null) missingInputs.push('current_surface_water_measurement');
    // REW is intentionally not synthesized from a generic texture midpoint yet.
    missingInputs.push('validated_readily_evaporable_water_rew');

    const uniqueMissing = [...new Set(missingInputs)];

    return json({
      ok: true,
      engine: 'pyfao56',
      mode: 'water-balance-input-readiness',
      production_authority: false,
      input_authority: 'server-derived',
      field_id: fieldId,
      field: {
        name: field.name ?? null,
        crop: field.crop ?? null,
        crop_subtype: normalizeSubtype(field.crop_subtype),
        location_source: location?.source ?? null,
      },
      basal_kcb: reference ? {
        status: kcbCandidate === null ? 'blocked' : 'shadow_candidate',
        crop_key: reference.crop_key,
        reference_profile: {
          initial: Number(reference.kcb_initial),
          mid: Number(reference.kcb_mid),
          end: Number(reference.kcb_end),
        },
        current_candidate: kcbCandidate === null ? null : round(kcbCandidate, 3),
        phenology_stage: kcSnapshot?.phenology_stage ?? null,
        stage_label: kcSnapshot?.stage_label ?? null,
        stage_evidence_date: kcSnapshot?.snapshot_date ?? null,
        stage_confidence: kcSnapshot?.coefficient_confidence ?? null,
        source: {
          label: reference.kcb_source_label,
          url: reference.kcb_source_url,
          reference_version: reference.reference_version,
        },
        caution: 'Bu Kcb, FAO-56 basal katsayı profilinin TarlaPusula fenoloji evresine eşlenmiş shadow adayıdır; production sulama otoritesi değildir.',
      } : null,
      root_zone: {
        scheduling_depth_m: rootDepthM,
        depth_source: reference?.root_source_label ?? null,
        field_capacity_vol: rootFc === null ? null : round(rootFc, 4),
        wilting_point_vol: rootWp === null ? null : round(rootWp, 4),
        current_water_vol: rootTheta0 === null ? null : round(rootTheta0, 4),
        total_available_water_mm: rootTawMm === null ? null : round(rootTawMm, 2),
        current_depletion_mm: rootDepletionMm === null ? null : round(rootDepletionMm, 2),
        measurement_date: rootMeasurement?.date ?? null,
        measurement_coverage_cm: rootMeasurement?.coverageDepthCm ?? 0,
        measurement_max_age_days: MAX_MEASUREMENT_AGE_DAYS,
      },
      surface_evaporation: {
        status: tewMm !== null && surfaceDepletionMm !== null ? 'partial' : 'blocked',
        ze_m: DEFAULT_EVAPORATION_DEPTH_M,
        ze_basis: 'FAO-56 recommended value when Ze is unknown (0.10–0.15 m); conservative upper bound selected for readiness calculation.',
        field_capacity_vol: topFc === null ? null : round(topFc, 4),
        wilting_point_vol: topWp === null ? null : round(topWp, 4),
        current_water_vol: topTheta0 === null ? null : round(topTheta0, 4),
        tew_mm: tewMm === null ? null : round(tewMm, 2),
        de_mm: surfaceDepletionMm === null ? null : round(surfaceDepletionMm, 2),
        rew_mm: null,
        measurement_date: surfaceMeasurement?.date ?? null,
        note: 'REW doğrulanmış toprak tekstürü politikası tanımlanmadan doldurulmaz; bu nedenle yüzey buharlaşma katmanı henüz tamamlanmış sayılmaz.',
      },
      soil_profile: {
        status: soilResult.ok ? 'available_model_estimate' : 'unavailable',
        provider: soilResult.payload?.source?.provider ?? null,
        product: soilResult.payload?.source?.product ?? null,
        data_type: soilResult.payload?.source?.dataType ?? null,
        profile_depth_cm: soilResult.payload?.profile_depth_cm ?? 0,
        warning: 'SoilGrids hidrolik değerleri model-estimedir; gerçek nem ölçümünün yerine kullanılmaz.',
      },
      full_water_balance_ready: uniqueMissing.length === 0,
      missing_inputs: uniqueMissing,
      evidence: [
        ...(reference ? [{ source: 'FAO-56 Table 17/22', finding: `${reference.crop_key} için basal Kcb ve kök derinliği referansı bulundu.` }] : []),
        ...(kcSnapshot ? [{ source: 'field_irrigation_kc_snapshots', observed_at: kcSnapshot.calculated_at ?? null, finding: `Fenoloji evresi: ${kcSnapshot.phenology_stage ?? 'bilinmiyor'}.` }] : []),
        ...(rootMeasurement ? [{ source: 'field_water_measurements', observed_at: rootMeasurement.date, finding: `Kök bölgesinde ${round(rootMeasurement.coverageDepthCm, 1)} cm sürekli gerçek ölçüm kapsamı bulundu.` }] : []),
        ...(soilResult.ok ? [{ source: 'ISRIC SoilGrids', observed_at: soilResult.payload?.generated_at ?? null, finding: 'FC/WP hidrolik profili server-side model estimate olarak üretildi.' }] : []),
      ],
      caution: 'Bu endpoint yalnız pyfao56 shadow/pilot girdilerinin hazır olup olmadığını değerlendirir. Eksik girdi sentetik değerle tamamlanmaz ve production sulama kararı üretmez.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[pyfao56-water-balance-inputs]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'PyFAO56 su dengesi girdileri hazırlanamadı.',
    }, 500);
  }
});
