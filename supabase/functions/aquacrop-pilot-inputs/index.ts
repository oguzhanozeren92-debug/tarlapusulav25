import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INITIAL_WATER_MAX_AGE_DAYS = 14;
const REQUIRED_INITIAL_WATER_DEPTH_CM = 200;
const AQUACROP_UPSTREAM_COMMIT = '36cc20e44644ed1704398889312435c85e04a2f3';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CROP_MODEL_MAP: Record<string, string> = {
  wheat: 'Wheat', bugday: 'Wheat', barley: 'Barley', arpa: 'Barley',
  maize: 'Maize', corn: 'Maize', misir: 'Maize', cotton: 'Cotton', pamuk: 'Cotton',
  potato: 'Potato', patates: 'Potato',
};

const PERENNIAL_CROP_KEYS = new Set([
  'badem', 'almond', 'ceviz', 'walnut', 'kiraz', 'cherry', 'elma', 'apple',
  'armut', 'pear', 'zeytin', 'olive', 'uzum', 'grape', 'antepfistigi', 'pistachio',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
}
function normalizeKey(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '');
}
function normalizeUnit(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR').replace(/³/g, '3').replace(/\s+/g, '');
}
function validIsoDate(value: unknown) {
  const text = String(value ?? '').trim();
  return ISO_DATE.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`));
}
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
function ageDays(iso: string | null | undefined) {
  if (!iso) return null; const timestamp = Date.parse(iso); if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 86400000);
}
function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) throw new Error('AquaCrop pilot girdileri için sunucu kimlik bilgileri veya oturum eksik.');
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('AquaCrop pilot girdileri için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient, supabaseUrl, serviceRoleKey };
}

async function loadSoilProfile(supabaseUrl: string, serviceRoleKey: string, location: { latitude: number; longitude: number } | null) {
  if (!location) return { available: false, modelReady: false, source: null, profileDepthCm: 0, layers: [], detail: 'AquaCrop toprak profili için tarla koordinatı eksik.' };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/aquacrop-soil-profile`, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' }, body: JSON.stringify(location) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok === false) return { available: false, modelReady: false, source: null, profileDepthCm: 0, layers: [], detail: payload?.error ?? `AquaCrop soil profile HTTP ${response.status}` };
    if (payload.input_authority !== 'server-derived' || payload.production_authority !== false || Number(payload.adapter_contract_version) !== 2 || payload.pedotransfer_method !== 'Saxton-Rawls 2006') throw new Error('AquaCrop soil profile trust boundary doğrulanamadı.');
    return {
      available: Array.isArray(payload.layers) && payload.layers.length > 0,
      modelReady: Boolean(payload.model_ready), source: payload.source ?? null,
      adapterContractVersion: Number(payload.adapter_contract_version ?? 0),
      pedotransferMethod: String(payload.pedotransfer_method ?? ''),
      profileDepthCm: Number(payload.profile_depth_cm ?? 0), layers: Array.isArray(payload.layers) ? payload.layers : [],
      assumptions: Array.isArray(payload.assumptions) ? payload.assumptions : [], warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      generatedAt: String(payload.generated_at ?? ''),
      detail: payload.model_ready ? '0–200 cm SoilGrids katmanları AquaCrop uyumlu hidrolik profile dönüştürüldü.' : 'Toprak profili kısmi; 0–200 cm doğrulanmış pilot profil tamamlanmadı.',
    };
  } catch (error) {
    return { available: false, modelReady: false, source: null, profileDepthCm: 0, layers: [], detail: error instanceof Error ? error.message : 'AquaCrop soil profile adapter unavailable' };
  } finally { clearTimeout(timeout); }
}

function resolveCropAdapter(field: any, season: any) {
  const rawCrop = String(season?.crop ?? field?.crop ?? '').trim();
  const cropKey = normalizeKey(rawCrop); const cropCycle = normalizeKey(field?.crop_cycle);
  const perennial = cropCycle.includes('perennial') || cropCycle.includes('cokyillik') || PERENNIAL_CROP_KEYS.has(cropKey);
  if (!rawCrop) return { available: false, source: null, fieldCrop: null, modelCropKey: null, detail: 'Tarla için ürün kimliği eksik.' };
  if (perennial) return { available: false, source: 'fields.crop/field_seasons.crop', fieldCrop: rawCrop, modelCropKey: null, detail: 'Bu ürün çok yıllık; mevcut AquaCrop pilot kapsamına güvenli biçimde eşlenmedi.' };
  const modelCropKey = CROP_MODEL_MAP[cropKey] ?? null;
  if (!modelCropKey) return { available: false, source: 'fields.crop/field_seasons.crop', fieldCrop: rawCrop, modelCropKey: null, detail: 'Bu ürün için doğrulanmış AquaCrop built-in eşlemesi henüz tanımlı değil.' };
  return { available: true, source: `aquacrop.entities.crops.crop_params@${AQUACROP_UPSTREAM_COMMIT}`, fieldCrop: rawCrop, modelCropKey, parameterAuthority: 'upstream-built-in', numericOverrides: false, detail: `${rawCrop} ürünü AquaCrop built-in ${modelCropKey} parametre setine doğrulanmış alias ile eşlendi.` };
}

function buildInitialWaterAdapter(rows: any[]) {
  const validSegments = (Array.isArray(rows) ? rows : []).map((row) => {
    const water = finite(row?.volumetric_water_content); const from = finite(row?.depth_from_cm); const to = finite(row?.depth_to_cm); const age = ageDays(row?.measured_at);
    const valid = Boolean(water !== null && water > 0 && water < 1 && from !== null && from >= 0 && to !== null && to > from && to <= 300 && age !== null && age <= INITIAL_WATER_MAX_AGE_DAYS);
    return valid ? { id: String(row.id), measuredAt: String(row.measured_at), ageDays: Number(age!.toFixed(2)), volumetricWaterContent: water!, depthFromCm: from!, depthToCm: to!, source: String(row.source) } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => a.depthFromCm - b.depthFromCm || b.depthToCm - a.depthToCm || a.ageDays - b.ageDays);
  const selected: typeof validSegments = []; let coveredToCm = 0; const epsilon = 0.01;
  while (coveredToCm < REQUIRED_INITIAL_WATER_DEPTH_CM) {
    const candidates = validSegments.filter((segment) => segment.depthFromCm <= coveredToCm + epsilon && segment.depthToCm > coveredToCm + epsilon);
    if (!candidates.length) break;
    candidates.sort((a, b) => b.depthToCm - a.depthToCm || a.ageDays - b.ageDays);
    const best = candidates[0]; if (!selected.some((item) => item.id === best.id)) selected.push(best);
    coveredToCm = Math.max(coveredToCm, best.depthToCm);
  }
  const modelReady = coveredToCm >= REQUIRED_INITIAL_WATER_DEPTH_CM;
  const selectedIds = new Set(selected.map((segment) => segment.id));
  const overlappingUnused = validSegments.some((segment) =>
    !selectedIds.has(segment.id) && selected.some((chosen) =>
      Math.max(segment.depthFromCm, chosen.depthFromCm) < Math.min(segment.depthToCm, chosen.depthToCm)
    )
  );
  return {
    available: modelReady && !overlappingUnused, modelReady: modelReady && !overlappingUnused, source: selected.length ? 'field_water_measurements' : null,
    requiredDepthCm: REQUIRED_INITIAL_WATER_DEPTH_CM, coveredDepthCm: Number(Math.min(coveredToCm, REQUIRED_INITIAL_WATER_DEPTH_CM).toFixed(2)),
    maxAgeDays: INITIAL_WATER_MAX_AGE_DAYS, segments: selected, allValidSegmentCount: validSegments.length,
    wcType: modelReady && !overlappingUnused ? 'Num' : null, method: modelReady && !overlappingUnused ? 'Depth' : null,
    depthPointsM: modelReady && !overlappingUnused ? selected.flatMap((segment) => [segment.depthFromCm / 100, segment.depthToCm / 100]) : [],
    detail: overlappingUnused ? 'Başlangıç suyu ölçümlerinde birbiriyle çakışan geçerli derinlik kayıtları var; profil tekilleştirilmeden pilot bloklandı.' : modelReady ? 'Doğrulanmış ve taze toprak su ölçümleri 0–200 cm profili kesintisiz kapsıyor.' : validSegments.length ? `Taze ölçümler yalnız 0–${Number(coveredToCm.toFixed(1))} cm kesintisiz kapsıyor; AquaCrop başlangıç suyu için 0–${REQUIRED_INITIAL_WATER_DEPTH_CM} cm gerekli.` : 'Son 14 günde doğrulanmış ve geçerli toprak su ölçümü yok.',
  };
}

function buildRecordedIrrigationSchedule(rows: any[], areaDecare: number | null, plantingDate: unknown, harvestDate: unknown) {
  const start = String(plantingDate ?? '').trim();
  const end = validIsoDate(harvestDate) ? String(harvestDate) : todayUtc();
  if (!validIsoDate(start)) {
    return { available: false, source: 'activities', mode: null, settings: null, detail: 'Sulama günlüklerinden AquaCrop programı üretmek için sezon ekim tarihi gerekli.', quantifiedCount: 0, unquantifiedCount: 0 };
  }

  const seasonRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const date = String(row?.activity_date ?? '');
    return validIsoDate(date) && date >= start && date <= end;
  });

  if (!seasonRows.length) {
    return { available: false, source: 'activities', mode: null, settings: null, detail: 'Bu sezon için kayıtlı Sulama işlemi yok.', quantifiedCount: 0, unquantifiedCount: 0 };
  }

  const quantified: Array<{ id: string; date: string; depthMm: number; quantity: number; unit: string }> = [];
  const excluded: Array<{ id: string; date: string; reason: string; unit: string | null }> = [];

  for (const row of seasonRows) {
    const id = String(row?.id ?? '');
    const date = String(row?.activity_date ?? '');
    const quantity = finite(row?.quantity);
    const unit = normalizeUnit(row?.unit);
    let depthMm: number | null = null;

    if (quantity === null || quantity <= 0) {
      excluded.push({ id, date, reason: 'water_quantity_missing_or_invalid', unit: row?.unit == null ? null : String(row.unit) });
      continue;
    }

    if (['m3/da', 'm3/dekar'].includes(unit)) {
      depthMm = quantity;
    } else if (['m3', 'metrekup', 'metreküp'].includes(unit)) {
      if (areaDecare === null || areaDecare <= 0) {
        excluded.push({ id, date, reason: 'field_area_decare_missing_for_total_volume_conversion', unit: String(row?.unit ?? '') });
        continue;
      }
      depthMm = quantity / areaDecare;
    } else {
      excluded.push({ id, date, reason: unit === 'saat' ? 'duration_only_without_water_amount' : 'unsupported_irrigation_unit', unit: row?.unit == null ? null : String(row.unit) });
      continue;
    }

    if (!Number.isFinite(depthMm) || depthMm <= 0 || depthMm > 500) {
      excluded.push({ id, date, reason: 'derived_water_depth_out_of_range', unit: String(row?.unit ?? '') });
      continue;
    }

    quantified.push({ id, date, depthMm: Number(depthMm.toFixed(3)), quantity, unit: String(row?.unit ?? '') });
  }

  if (excluded.length > 0) {
    return {
      available: false,
      source: 'activities',
      mode: null,
      settings: null,
      detail: `${seasonRows.length} Sulama kaydının ${excluded.length} tanesinde gerçek su miktarı güvenle mm'ye çevrilemiyor; eksik program AquaCrop'a gönderilmedi.`,
      quantifiedCount: quantified.length,
      unquantifiedCount: excluded.length,
      excluded,
    };
  }

  if (!quantified.length) {
    return { available: false, source: 'activities', mode: null, settings: null, detail: 'Bu sezon için mm karşılığı hesaplanabilen Sulama kaydı yok.', quantifiedCount: 0, unquantifiedCount: 0 };
  }

  const grouped = new Map<string, number>();
  for (const item of quantified) grouped.set(item.date, (grouped.get(item.date) ?? 0) + item.depthMm);
  if ([...grouped.values()].some((depthMm) => !Number.isFinite(depthMm) || depthMm <= 0 || depthMm > 500)) {
    return { available: false, source: 'activities', mode: null, settings: null, detail: 'Aynı güne ait Sulama kayıtlarının toplamı güvenli AquaCrop sınırını aşıyor.', quantifiedCount: quantified.length, unquantifiedCount: 0 };
  }
  const schedule = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, depthMm]) => ({ date, depth_mm: Number(depthMm.toFixed(3)) }));

  return {
    available: true,
    source: 'activities',
    mode: 'recorded_schedule',
    settings: { schedule },
    managementSource: 'recorded_operations',
    verifiedAt: schedule[schedule.length - 1]?.date ?? null,
    quantifiedCount: quantified.length,
    unquantifiedCount: 0,
    conversion: '1 m³/da = 1 mm; total m³ / field area (da) = mm',
    detail: `${quantified.length} ölçülü Sulama kaydı ${schedule.length} günlük AquaCrop sulama girdisine dönüştürüldü.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);
  try {
    const body = await req.json(); const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);
    const bodyKeys = Object.keys(body ?? {});
    if (bodyKeys.some((key) => key !== 'field_id')) {
      return json({ ok: false, error: 'AquaCrop girdi adaptörü yalnız field_id kabul eder.', production_authority: false }, 400);
    }
    const { user, serviceClient, supabaseUrl, serviceRoleKey } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient.from('fields').select('id,user_id,irrigation_status,area_decare,crop,crop_cycle,season,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng').eq('id', fieldId).eq('user_id', user.id).maybeSingle();
    if (fieldError) throw fieldError; if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    let seasonQuery = serviceClient.from('field_seasons').select('id,year,crop,planting_date,harvest_date,created_at').eq('user_id', user.id).eq('field_id', fieldId).order('year', { ascending: false }).limit(1);
    if (Number.isInteger(Number(field.season))) seasonQuery = seasonQuery.eq('year', Number(field.season));
    const recentWaterSince = new Date(Date.now() - INITIAL_WATER_MAX_AGE_DAYS * 86400000).toISOString();

    const [seasonResult, waterResult, managementResult, irrigationActivitiesResult, soilProfile] = await Promise.all([
      seasonQuery.maybeSingle(),
      serviceClient.from('field_water_measurements').select('id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source').eq('user_id', user.id).eq('field_id', fieldId).gte('measured_at', recentWaterSince).order('measured_at', { ascending: false }).limit(30),
      serviceClient.from('field_aquacrop_management').select('id,mode,settings,source,verified_at,updated_at').eq('user_id', user.id).eq('field_id', fieldId).maybeSingle(),
      serviceClient.from('activities').select('id,activity_date,quantity,unit').eq('user_id', user.id).eq('field_id', fieldId).eq('activity_type', 'Sulama').order('activity_date', { ascending: true }).limit(500),
      loadSoilProfile(supabaseUrl, serviceRoleKey, resolveLocation(field as Record<string, unknown>)),
    ]);
    for (const result of [seasonResult, waterResult, managementResult, irrigationActivitiesResult]) if (result.error) throw result.error;

    const season = seasonResult.data;
    const cropParameters = resolveCropAdapter(field, season);
    const initialWater = buildInitialWaterAdapter(waterResult.data ?? []);
    const areaDecare = finite(field.area_decare);
    const recordedSchedule = buildRecordedIrrigationSchedule(irrigationActivitiesResult.data ?? [], areaDecare, season?.planting_date, season?.harvest_date);
    const irrigationStatus = normalizeKey(field.irrigation_status);
    const isRainfed = ['rainfed', 'susuz', 'dryland'].includes(irrigationStatus);
    const management = managementResult.data;
    const seasonIrrigationCount = Array.isArray(irrigationActivitiesResult.data)
      ? irrigationActivitiesResult.data.filter((row: any) => {
          const date = String(row?.activity_date ?? '');
          const start = String(season?.planting_date ?? '');
          const end = validIsoDate(season?.harvest_date) ? String(season.harvest_date) : todayUtc();
          return validIsoDate(start) && validIsoDate(date) && date >= start && date <= end;
        }).length
      : 0;

    let irrigationManagement: any;
    if (management) {
      const allowedModes = new Set(['rainfed', 'soil_moisture_target', 'recorded_schedule']);
      const mode = String(management.mode);
      const verifiedAt = String(management.verified_at ?? '');
      const verifiedAtValid = Number.isFinite(Date.parse(verifiedAt)) && Date.parse(verifiedAt) <= Date.now();
      const source = String(management.source ?? '').trim();
      const sourceValid = source.length > 0;
      irrigationManagement = {
        available: allowedModes.has(mode) && verifiedAtValid && sourceValid,
        source: 'field_aquacrop_management',
        mode: allowedModes.has(mode) && verifiedAtValid && sourceValid ? mode : null,
        settings: management.settings ?? {},
        verifiedAt: verifiedAtValid ? verifiedAt : null,
        managementSource: sourceValid ? source : null,
        detail: !allowedModes.has(mode)
          ? 'AquaCrop yönetim modu doğrulanmış server-derived pilot kapsamı dışında; pilot bloklandı.'
          : !verifiedAtValid
            ? 'AquaCrop yönetim kaydının doğrulama zamanı eksik/geçersiz; pilot bloklandı.'
            : sourceValid
              ? 'AquaCrop yönetimi kullanıcı/operasyon doğrulamalı yönetim kaydından alındı.'
              : 'AquaCrop yönetim kaynağı eksik; pilot bloklandı.',
      };
    } else if (isRainfed && seasonIrrigationCount > 0) {
      irrigationManagement = {
        available: false,
        source: 'fields.irrigation_status + activities',
        mode: null,
        settings: null,
        verifiedAt: null,
        detail: 'Tarla rainfed/susuz kayıtlı ancak aynı sezonda Sulama işlemi var. Çelişki çözülmeden AquaCrop yönetimi seçilmedi.',
      };
    } else if (isRainfed) {
      irrigationManagement = {
        available: true,
        source: 'fields.irrigation_status',
        mode: 'rainfed',
        settings: {},
        verifiedAt: null,
        detail: 'Tarla susuz/rainfed kayıtlı ve sezonda Sulama kaydı yok; AquaCrop için sulamasız yönetim açıkça tanımlı.',
      };
    } else if (recordedSchedule.available) {
      irrigationManagement = recordedSchedule;
    } else {
      irrigationManagement = {
        ...recordedSchedule,
        available: false,
        detail: recordedSchedule.detail || 'Sulu/kısmi sulamalı tarla için doğrulanmış AquaCrop sulama yönetimi kaydı yok.',
      };
    }

    const availableInputs: string[] = [];
    if (cropParameters.available) availableInputs.push('crop_parameters');
    if (soilProfile.modelReady) availableInputs.push('soil_profile');
    if (initialWater.modelReady) availableInputs.push('initial_water_content');
    if (irrigationManagement.available) availableInputs.push('irrigation_management');
    const missingInputs = ['crop_parameters', 'soil_profile', 'initial_water_content', 'irrigation_management'].filter((key) => !availableInputs.includes(key));

    return json({
      ok: true,
      engine: 'aquacrop',
      mode: 'pilot-input-adapter',
      field_id: fieldId,
      production_authority: false,
    inputContractVersion: 8,
      input_authority: 'server-derived',
      client_supplied_agricultural_values_accepted: false,
      available_inputs: availableInputs,
      missing_inputs: missingInputs,
      adapters: { crop_parameters: cropParameters, soil_profile: soilProfile, initial_water_content: initialWater, irrigation_management: irrigationManagement },
      context: {
        planting_date: season?.planting_date ?? null,
        harvest_date: season?.harvest_date ?? null,
        crop_identity: season?.crop ?? field.crop ?? null,
        irrigation_status: field.irrigation_status ?? null,
        area_decare: areaDecare,
      },
      note: missingInputs.length === 0 ? 'AquaCrop pilot için ürün, 0–200 cm toprak profili, 0–200 cm başlangıç suyu ve sulama yönetimi gerçek/server-derived kaynaklarla hazır.' : 'Eksik AquaCrop girdileri için sentetik tarımsal değer üretilmedi; pilot bloklu kalır.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AquaCrop pilot input hazırlığı başarısız oldu.';
    console.error('[aquacrop-pilot-inputs]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
});
