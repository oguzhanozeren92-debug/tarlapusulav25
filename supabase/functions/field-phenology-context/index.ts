import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PCSE_MAX_AGE_DAYS = 14;

const PERENNIAL_CROPS = new Set([
  'antep fıstığı', 'antepfıstığı', 'antep fistigi', 'antepfistigi', 'fıstık', 'fistik', 'pistachio',
  'badem', 'almond',
  'kiraz', 'cherry', 'cherries',
  'ceviz', 'walnut', 'walnuts',
  'üzüm', 'uzum', 'grape', 'grapes',
  'elma', 'apple',
  'armut', 'pear',
  'zeytin', 'olive',
  'fındık', 'findik', 'hazelnut',
  'kayısı', 'kayisi', 'apricot',
  'şeftali', 'seftali', 'peach',
  'erik', 'plum',
  'nar', 'pomegranate',
]);

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
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function inferCropCycle(declared: unknown, crop: unknown): 'annual' | 'perennial' | 'unknown' {
  const cropName = normalizeText(crop);
  if (PERENNIAL_CROPS.has(cropName)) return 'perennial';

  const cycle = normalizeText(declared);
  if (cycle === 'perennial' || cycle === 'çok yıllık' || cycle === 'cok yillik') return 'perennial';
  if (cycle === 'annual' || cycle === 'tek yıllık' || cycle === 'tek yillik') return 'annual';
  return 'unknown';
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

function cleanDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`))
    ? text
    : null;
}

function daysOld(value: string | null, currentDate: string | null) {
  if (!value) return null;
  const reference = currentDate ?? new Date().toISOString().slice(0, 10);
  const a = Date.parse(`${value}T00:00:00Z`);
  const b = Date.parse(`${reference}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86400000);
}

function mapPcseStage(value: unknown) {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'pre_emergence': return { stage: 'establishment', label: 'Çıkış / kuruluş' };
    case 'vegetative': return { stage: 'vegetative', label: 'Vejetatif gelişim' };
    case 'reproductive': return { stage: 'reproductive', label: 'Üreme / generatif dönem' };
    case 'mature': return { stage: 'maturation', label: 'Olgunlaşma' };
    default: return null;
  }
}

function resolveTrustedPcseRun(runRow: any, currentDate: string | null) {
  const output = runRow?.output;
  if (
    !output ||
    output.engine !== 'pcse' ||
    output.mode !== 'phenology_pilot' ||
    output.production_authority !== false ||
    output.water_stress_authority !== false ||
    output.model !== 'Wofost72_PP'
  ) return null;

  const outputDate = cleanDate(output?.simulation?.actual_output_date ?? output?.simulation?.requested_as_of_date);
  const age = daysOld(outputDate, currentDate);
  if (age === null || age < 0 || age > PCSE_MAX_AGE_DAYS) return null;

  const mapped = mapPcseStage(output?.phenology?.stage);
  if (!mapped) return null;

  return {
    stage: mapped.stage,
    stageLabel: mapped.label,
    dvs: finite(output?.phenology?.dvs),
    outputDate,
    ageDays: age,
    completedAt: runRow?.completed_at ?? null,
    engineVersion: runRow?.engine_version ?? output?.engine_version ?? null,
    model: 'Wofost72_PP',
  };
}

async function refreshPcseWhenReady(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
) {
  try {
    const readinessResponse = await fetch(`${supabaseUrl}/functions/v1/model-engine-readiness`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ engine: 'pcse', field_id: fieldId }),
    });
    const readiness = await readinessResponse.json().catch(() => null);
    if (!readinessResponse.ok || readiness?.ok === false || readiness?.ready !== true) return;

    await fetch(`${supabaseUrl}/functions/v1/pcse-pilot-run`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field_id: fieldId }),
    });
  } catch (error) {
    console.warn('[field-phenology-context] background PCSE refresh failed', error);
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
    const currentDate = cleanDate(body?.current_date);
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if (
      'latitude' in body || 'longitude' in body || 'geometry' in body ||
      'crop' in body || 'crop_key' in body || 'planting_date' in body ||
      'phenology_stage' in body || 'pcse' in body
    ) {
      return json({
        ok: false,
        error: 'Fenoloji bağlamında istemci koordinatı, ürün, model sonucu veya ekim tarihi kabul edilmez.',
      }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);
    }

    const { data: field, error: fieldError } = await userClient
      .from('fields')
      .select('id,user_id,name,crop,season,crop_cycle,planting_year,bearing,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const [seasonResult, pcseRunResult] = await Promise.all([
      userClient
        .from('field_seasons')
        .select('id,year,crop,variety_name,planting_date,harvest_date,created_at')
        .eq('field_id', fieldId)
        .eq('user_id', authData.user.id)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
      userClient
        .from('model_engine_runs')
        .select('output,engine_version,completed_at')
        .eq('field_id', fieldId)
        .eq('user_id', authData.user.id)
        .eq('engine', 'pcse')
        .eq('mode', 'pilot')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (seasonResult.error) throw seasonResult.error;
    if (pcseRunResult.error) console.warn('[field-phenology-context] PCSE run lookup failed', pcseRunResult.error.message);

    const requestedYear = currentDate
      ? Number(currentDate.slice(0, 4))
      : new Date().getUTCFullYear();
    const seasonRows = Array.isArray(seasonResult.data) ? seasonResult.data : [];
    const activeSeason = seasonRows.find((row: any) => Number(row?.year) === requestedYear)
      ?? seasonRows.find((row: any) => !row?.harvest_date)
      ?? seasonRows[0]
      ?? null;

    const location = resolveLocation(field as Record<string, unknown>);
    const crop = String(activeSeason?.crop ?? field.crop ?? '').trim() || null;
    const cropCycle = inferCropCycle(field.crop_cycle, crop);
    const plantingDate = cleanDate(activeSeason?.planting_date);
    const harvestDate = cleanDate(activeSeason?.harvest_date);
    const pcse = cropCycle === 'annual' && !harvestDate
      ? resolveTrustedPcseRun(pcseRunResult.data, currentDate)
      : null;

    const missingInputs: string[] = [];
    if (!location) missingInputs.push('field_location');
    if (!crop) missingInputs.push('crop');
    if (cropCycle === 'annual' && !plantingDate) missingInputs.push('planting_date');

    let climateShift: any = null;
    if (location) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/phenology-climate-shift`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: authorization,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
            cropKey: crop,
            currentDate,
          }),
        });
        climateShift = await response.json().catch(() => null);
        if (!response.ok || climateShift?.success === false) {
          climateShift = {
            success: false,
            status: 'unavailable',
            message: climateShift?.message ?? `phenology-climate-shift HTTP ${response.status}`,
          };
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (cropCycle === 'annual' && plantingDate && !harvestDate) {
      const runtime = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) {
        runtime.waitUntil(refreshPcseWhenReady(supabaseUrl, anonKey, authorization, fieldId));
      }
    }

    const phenologyStage = harvestDate
      ? {
          status: 'season_closed',
          stage: 'post_harvest',
          stage_label: 'Hasat sonrası',
          bbch: null,
          confidence: 'high',
          reason: 'Bu sezon için gerçek hasat tarihi kayıtlı.',
          source: 'field_seasons',
        }
      : pcse
        ? {
            status: 'model_ready',
            stage: pcse.stage,
            stage_label: pcse.stageLabel,
            bbch: null,
            confidence: 'medium',
            reason: `WOFOST 7.2 potansiyel gelişim modeli DVS=${pcse.dvs ?? 'n/a'}; çıktı ${pcse.outputDate}.`,
            source: 'PCSE Wofost72_PP',
          }
        : {
            status: cropCycle === 'perennial' ? 'calendar_context' : 'needs_data',
            stage: null,
            stage_label: null,
            bbch: null,
            confidence: 'low',
            reason: cropCycle === 'perennial'
              ? 'Çok yıllık ürün PCSE annual pilotuna sokulmaz; ürün takvimi ve saha/uydu kanıtları kullanılır.'
              : 'Güncel ve doğrulanmış PCSE fenoloji sonucu henüz yok; sentetik evre üretilmez.',
            source: null,
          };

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      client_supplied_model_output_accepted: false,
      field: {
        crop,
        crop_cycle: cropCycle,
        declared_crop_cycle: field.crop_cycle ?? null,
        season_year: activeSeason?.year ?? field.season ?? null,
        variety_name: activeSeason?.variety_name ?? null,
        planting_date: plantingDate,
        harvest_date: harvestDate,
        planting_year: field.planting_year ?? null,
        bearing: field.bearing ?? null,
      },
      location_source: location?.source ?? null,
      thermal_calendar: climateShift,
      pcse_phenology: pcse,
      phenology_stage: phenologyStage,
      missing_inputs: missingInputs,
      evidence: [
        ...(activeSeason ? [{
          source: 'field_seasons',
          observed_at: activeSeason.created_at ?? null,
          finding: `Sezon ${activeSeason.year}; ekim ${plantingDate ?? 'kayıtlı değil'}; hasat ${harvestDate ?? 'kayıtlı değil'}.`,
        }] : []),
        ...(pcse ? [{
          source: 'PCSE Wofost72_PP',
          observed_at: pcse.completedAt,
          finding: `${pcse.stageLabel}; DVS ${pcse.dvs ?? 'n/a'}; model veri tarihi ${pcse.outputDate}.`,
        }] : []),
        ...(climateShift?.status === 'ready' ? [{
          source: 'ERA5-Land via Open-Meteo Historical API',
          observed_at: climateShift?.period?.to ?? null,
          finding: `Termal takvim kayması ${Number(climateShift.shiftDays ?? 0)} gün; sıcaklık anomalisi ${Number(climateShift.anomalyC ?? 0)} °C.`,
        }] : []),
      ],
      caution: cropCycle === 'annual'
        ? 'PCSE sonucu potansiyel gelişim baz çizgisidir; su stresi ve sulama kararı pyfao56/AquaCrop su katmanlarından gelir.'
        : 'Çok yıllık ürünlerde yıllık gelişim evresi ürün takvimi, iklim, uydu ve saha gözlemleri birlikte doğrulanmadan kesin BBCH olarak sunulmaz.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[field-phenology-context]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Fenoloji bağlamı hazırlanamadı.',
    }, 500);
  }
});
