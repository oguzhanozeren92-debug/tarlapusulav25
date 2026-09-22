import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SURFACE_DEPTH_CM = 15;

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

function classifyUsdaTexture(sand: number, silt: number, clay: number) {
  const total = sand + silt + clay;
  if (!Number.isFinite(total) || Math.abs(total - 100) > 1.5) return null;

  if (silt + 1.5 * clay < 15) return 'sand';
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return 'loamy_sand';
  if (
    (clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) ||
    (clay < 7 && silt < 50 && silt + 2 * clay >= 30)
  ) return 'sandy_loam';
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return 'loam';
  if (
    (silt >= 50 && clay >= 12 && clay < 27) ||
    (silt >= 50 && silt < 80 && clay < 12)
  ) return 'silt_loam';
  if (silt >= 80 && clay < 12) return 'silt';
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return 'sandy_clay_loam';
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return 'clay_loam';
  if (clay >= 27 && clay < 40 && sand <= 20) return 'silty_clay_loam';
  if (clay >= 35 && sand > 45) return 'sandy_clay';
  if (clay >= 40 && silt >= 40) return 'silty_clay';
  if (clay >= 40 && sand <= 45 && silt < 40) return 'clay';
  return null;
}

function weightedSurface(layers: any[]) {
  let covered = 0;
  let sandWeighted = 0;
  let siltWeighted = 0;
  let clayWeighted = 0;
  let fcWeighted = 0;
  let wpWeighted = 0;

  for (const layer of layers) {
    const from = finite(layer?.fromCm);
    const to = finite(layer?.toCm);
    const sand = finite(layer?.texture?.sandPercent);
    const silt = finite(layer?.texture?.siltPercent);
    const clay = finite(layer?.texture?.clayPercent);
    const fc = finite(layer?.hydraulic?.thFC);
    const wp = finite(layer?.hydraulic?.thWP);
    if (
      from === null || to === null || to <= from ||
      sand === null || silt === null || clay === null || fc === null || wp === null
    ) continue;

    const overlap = Math.max(0, Math.min(to, SURFACE_DEPTH_CM) - Math.max(from, 0));
    if (overlap <= 0) continue;

    covered += overlap;
    sandWeighted += sand * overlap;
    siltWeighted += silt * overlap;
    clayWeighted += clay * overlap;
    fcWeighted += fc * overlap;
    wpWeighted += wp * overlap;
  }

  if (covered + 0.001 < SURFACE_DEPTH_CM) return null;

  return {
    sand: sandWeighted / covered,
    silt: siltWeighted / covered,
    clay: clayWeighted / covered,
    fieldCapacity: fcWeighted / covered,
    wiltingPoint: wpWeighted / covered,
  };
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
    if (!response.ok || payload?.ok !== true) {
      throw new Error(payload?.error ?? `aquacrop-soil-profile HTTP ${response.status}`);
    }
    if (payload.input_authority !== 'server-derived' || payload.production_authority !== false) {
      throw new Error('Soil profile trust boundary doğrulanamadı.');
    }
    return payload;
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    if (['latitude', 'longitude', 'sand', 'silt', 'clay', 'texture', 'rew', 'fw', 'irrigation_method'].some((key) => key in body)) {
      return json({ ok: false, error: 'Toprak buharlaşma girdileri istemciden kabul edilmez.' }, 400);
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

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng,irrigation_method')
      .eq('id', fieldId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const location = resolveLocation(field as Record<string, unknown>);
    if (!location) {
      return json({
        ok: true,
        field_id: fieldId,
        ready: false,
        status: 'blocked',
        missing_inputs: ['field_location'],
        production_authority: false,
        input_authority: 'server-derived',
      });
    }

    const soil = await loadSoilProfile(
      supabaseUrl,
      serviceRoleKey,
      location.latitude,
      location.longitude,
    );
    const surface = weightedSurface(Array.isArray(soil?.layers) ? soil.layers : []);
    if (!surface) {
      return json({
        ok: true,
        field_id: fieldId,
        ready: false,
        status: 'blocked',
        missing_inputs: ['surface_soil_profile'],
        production_authority: false,
        input_authority: 'server-derived',
      });
    }

    const textureKey = classifyUsdaTexture(surface.sand, surface.silt, surface.clay);
    const irrigationMethod = String(field.irrigation_method ?? '').trim();

    const [rewResult, wettingResult] = await Promise.all([
      textureKey
        ? serviceClient
            .from('soil_evaporation_reference_profiles')
            .select('texture_key,texture_label,rew_min_mm,rew_max_mm,tew_min_mm_at_ze_010,tew_max_mm_at_ze_010,ze_recommended_min_m,ze_recommended_max_m,source_label,source_url,reference_version')
            .eq('texture_key', textureKey)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      irrigationMethod && irrigationMethod !== 'unknown'
        ? serviceClient
            .from('irrigation_wetting_reference_profiles')
            .select('method_key,display_name_tr,fw_min,fw_max,source_label,source_url,reference_version')
            .eq('method_key', irrigationMethod)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (rewResult.error) throw rewResult.error;
    if (wettingResult.error) throw wettingResult.error;

    const reference = rewResult.data;
    const wettingReference = wettingResult.data;
    const tewAt010 = 1000 * (surface.fieldCapacity - 0.5 * surface.wiltingPoint) * 0.10;
    const tewAt015 = 1000 * (surface.fieldCapacity - 0.5 * surface.wiltingPoint) * 0.15;

    const missingInputs: string[] = [];
    if (!reference) missingInputs.push('fao56_table19_texture_reference');
    missingInputs.push('validated_single_rew_value', 'current_surface_depletion_de');
    if (!irrigationMethod || irrigationMethod === 'unknown') {
      missingInputs.push('irrigation_method_for_fw');
    } else if (!wettingReference) {
      missingInputs.push('fao56_table20_wetting_reference');
    }

    return json({
      ok: true,
      field_id: fieldId,
      ready: Boolean(reference),
      status: reference ? 'reference_range_available' : 'unsupported_fao_table19_texture',
      production_authority: false,
      input_authority: 'server-derived',
      location_source: location.source,
      surface_depth_cm: SURFACE_DEPTH_CM,
      texture: {
        classification_system: 'USDA soil texture triangle',
        texture_key: textureKey,
        sand_percent: round(surface.sand, 2),
        silt_percent: round(surface.silt, 2),
        clay_percent: round(surface.clay, 2),
        source: 'ISRIC SoilGrids 250m model-estimate',
      },
      hydraulics: {
        field_capacity_vol: round(surface.fieldCapacity, 4),
        wilting_point_vol: round(surface.wiltingPoint, 4),
      },
      fao56: reference ? {
        rew_range_mm: [Number(reference.rew_min_mm), Number(reference.rew_max_mm)],
        tew_table19_range_mm_at_ze_010: [
          Number(reference.tew_min_mm_at_ze_010),
          Number(reference.tew_max_mm_at_ze_010),
        ],
        tew_formula_mm: {
          ze_010_m: round(tewAt010, 2),
          ze_015_m: round(tewAt015, 2),
        },
        ze_recommended_range_m: [
          Number(reference.ze_recommended_min_m),
          Number(reference.ze_recommended_max_m),
        ],
        source: {
          label: reference.source_label,
          url: reference.source_url,
          reference_version: reference.reference_version,
        },
      } : null,
      irrigation_wetting: {
        method_key: irrigationMethod || null,
        method_label: wettingReference?.display_name_tr ?? null,
        fw_range: wettingReference
          ? [Number(wettingReference.fw_min), Number(wettingReference.fw_max)]
          : null,
        exact: wettingReference
          ? Number(wettingReference.fw_min) === Number(wettingReference.fw_max)
          : false,
        source: wettingReference ? {
          label: wettingReference.source_label,
          url: wettingReference.source_url,
          reference_version: wettingReference.reference_version,
        } : null,
        note: wettingReference
          ? 'FAO-56 Table 20 aralığı korunur; aralık tek bir fw değerine indirgenmez.'
          : irrigationMethod === 'unknown'
            ? 'Sulama yöntemi bilinmiyor; fw uydurulmaz.'
            : 'Sulama yöntemi henüz kaydedilmedi; fw uydurulmaz.',
      },
      validated_rew_mm: null,
      missing_inputs: [...new Set(missingInputs)],
      caution: 'FAO-56 Table 19 REW ve Table 20 fw değerleri aralık olarak korunur. Tek REW/fw değeri seçilmez ve yüzey De bilinmeden dual-Kc yüzey buharlaşma katmanı production-ready sayılmaz.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[soil-evaporation-context]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Toprak buharlaşma bağlamı hazırlanamadı.',
      production_authority: false,
    }, 500);
  }
});
