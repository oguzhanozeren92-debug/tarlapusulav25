import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import { buildPusulaExperimentState } from './experiment-core.mjs';
import { buildExperimentEvidenceTaskPlan } from './evidence-task-core.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FUNCTION_VERSION = 2;
const MAX_MODEL_DAY_GAP = 1;
const MAX_HISTORY_ROWS = 500;
const EXPERIMENT_TASK_SOURCE = 'pusula-experiment';

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

function dateOnly(value: unknown) {
  const raw = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

function seasonPlantingDate(seasonKey: unknown) {
  const match = String(seasonKey ?? '').trim().match(/:(\d{4}-\d{2}-\d{2})$/);
  return match ? dateOnly(match[1]) : null;
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Pusula Deneyi için sunucu kimlik bilgileri veya kullanıcı oturumu eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('Pusula Deneyi için geçerli kullanıcı oturumu gerekli.');

  return { user: data.user, serviceClient };
}

async function loadCalibration(serviceClient: any, userId: string, fieldId: string) {
  const { data, error } = await serviceClient
    .from('model_shadow_calibration_states')
    .select('season_key,status,review_eligible,phenology_clean_streak,water_evidence_state,updated_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Pusula Deneyi kalibrasyon durumu okunamadı: ${error.message}`);
  return data ?? null;
}

async function loadSeason(serviceClient: any, userId: string, fieldId: string, seasonKey: string) {
  const plantingDate = seasonPlantingDate(seasonKey);
  if (!plantingDate) return null;

  const { data, error } = await serviceClient
    .from('field_seasons')
    .select('id,planting_date,harvest_date,crop')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('planting_date', plantingDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Pusula Deneyi sezonu okunamadı: ${error.message}`);
  return data ?? null;
}

async function loadExperimentInputs(
  serviceClient: any,
  userId: string,
  fieldId: string,
  seasonKey: string,
  season: any,
) {
  const plantingDate = dateOnly(season?.planting_date);
  const harvestDate = dateOnly(season?.harvest_date);
  const today = new Date().toISOString().slice(0, 10);
  const endDate = harvestDate && harvestDate < today ? harvestDate : today;

  const [comparisonsResult, observationsResult, snapshotsResult, photosResult] = await Promise.all([
    serviceClient
      .from('model_shadow_comparisons')
      .select('comparison_day,status,engines,normalized,divergences')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .eq('season_key', seasonKey)
      .order('comparison_day', { ascending: false })
      .limit(MAX_HISTORY_ROWS),
    serviceClient
      .from('field_growth_observations')
      .select('observed_on,stage,created_at')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .eq('season_id', season.id)
      .order('observed_on', { ascending: false })
      .limit(MAX_HISTORY_ROWS),
    serviceClient
      .from('field_data_snapshots')
      .select('ndvi,captured_at')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .gte('captured_at', `${plantingDate}T00:00:00Z`)
      .lte('captured_at', `${endDate}T23:59:59.999Z`)
      .order('captured_at', { ascending: false })
      .limit(1000),
    serviceClient
      .from('field_observation_photos')
      .select('captured_at,captured_lat,captured_lng,location_accuracy_m,distance_to_point_m,source')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .gte('captured_at', `${plantingDate}T00:00:00Z`)
      .lte('captured_at', `${endDate}T23:59:59.999Z`)
      .order('captured_at', { ascending: false })
      .limit(MAX_HISTORY_ROWS),
  ]);

  if (comparisonsResult.error) {
    throw new Error(`Pusula Deneyi model geçmişi okunamadı: ${comparisonsResult.error.message}`);
  }
  if (observationsResult.error) {
    throw new Error(`Pusula Deneyi saha gözlemleri okunamadı: ${observationsResult.error.message}`);
  }
  if (snapshotsResult.error) {
    throw new Error(`Pusula Deneyi uydu kanıtı okunamadı: ${snapshotsResult.error.message}`);
  }
  if (photosResult.error) {
    throw new Error(`Pusula Deneyi saha fotoğrafı kapsamı okunamadı: ${photosResult.error.message}`);
  }

  return {
    comparisons: Array.isArray(comparisonsResult.data) ? comparisonsResult.data : [],
    growthObservations: Array.isArray(observationsResult.data) ? observationsResult.data : [],
    satelliteSnapshots: Array.isArray(snapshotsResult.data) ? snapshotsResult.data : [],
    photos: Array.isArray(photosResult.data) ? photosResult.data : [],
  };
}

async function persistState(
  serviceClient: any,
  userId: string,
  fieldId: string,
  state: any,
) {
  const now = new Date().toISOString();
  const { error } = await serviceClient
    .from('pusula_experiment_states')
    .upsert({
      user_id: userId,
      field_id: fieldId,
      season_key: state.season_key,
      status: state.status,
      calibration_review_eligible: state.calibration_review_eligible,
      review_ready: state.review_ready,
      field_observation_days: state.field_observation_days,
      comparable_observation_days: state.comparable_observation_days,
      ambiguous_observation_days: state.ambiguous_observation_days,
      pcse_field_state: state.pcse.state,
      pcse_evaluated_days: state.pcse.evaluated_days,
      pcse_supported_days: state.pcse.supported_days,
      pcse_divergent_days: state.pcse.divergent_days,
      cropforge_field_state: state.cropforge.state,
      cropforge_evaluated_days: state.cropforge.evaluated_days,
      cropforge_supported_days: state.cropforge.supported_days,
      cropforge_divergent_days: state.cropforge.divergent_days,
      satellite_ndvi_days: state.satellite.ndvi_days,
      field_photo_count: state.photos.photo_count,
      georeferenced_photo_count: state.photos.georeferenced_photo_count,
      latest_field_observation_day: state.latest_field_observation_day,
      evidence: {
        function_version: FUNCTION_VERSION,
        internal_only: true,
        state_evidence: state.evidence ?? {},
        pcse_pairs: state.pcse.pairs,
        cropforge_pairs: state.cropforge.pairs,
        satellite: state.satellite,
        photos: state.photos,
      },
      production_authority: false,
      user_visible: false,
      updated_at: now,
    }, {
      onConflict: 'user_id,field_id,season_key',
    });

  if (error) throw new Error(`Pusula Deneyi durumu kaydedilemedi: ${error.message}`);
}

async function syncEvidenceTasks(
  serviceClient: any,
  userId: string,
  fieldId: string,
  state: any,
  season: any,
) {
  const today = new Date().toISOString().slice(0, 10);
  const plan = buildExperimentEvidenceTaskPlan({ state, season, today });
  const now = new Date().toISOString();

  const { data: existingRows, error: readError } = await serviceClient
    .from('field_todos')
    .select('id,task_key,completed,dismissed')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('source', EXPERIMENT_TASK_SOURCE)
    .limit(200);

  if (readError) throw new Error(`Pusula Deneyi görevleri okunamadı: ${readError.message}`);

  const existing = Array.isArray(existingRows) ? existingRows : [];
  const requestedKeys = new Set(plan.tasks.map((task: any) => String(task.task_key)));
  const staleIds = existing
    .filter((row: any) => {
      if (row.completed === true || row.dismissed === true) return false;
      const key = String(row.task_key ?? '');
      return !requestedKeys.has(key);
    })
    .map((row: any) => String(row.id))
    .filter(Boolean);

  if (staleIds.length) {
    const { error: dismissError } = await serviceClient
      .from('field_todos')
      .update({ dismissed: true, updated_at: now })
      .eq('user_id', userId)
      .in('id', staleIds);
    if (dismissError) throw new Error(`Eski Pusula Deneyi görevleri kapatılamadı: ${dismissError.message}`);
  }

  let created = 0;
  let active = 0;

  for (const task of plan.tasks) {
    const previous = existing.find((row: any) => String(row.task_key ?? '') === task.task_key);
    if (previous?.completed === true || previous?.dismissed === true) continue;

    const payload = {
      user_id: userId,
      field_id: fieldId,
      task_key: task.task_key,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      completed: false,
      source: EXPERIMENT_TASK_SOURCE,
      action_target: task.action_target,
      priority: task.priority,
      reward_rule_key: task.reward_rule_key,
      metadata: task.metadata,
      dismissed: false,
      updated_at: now,
    };

    if (previous?.id) {
      const { error: updateError } = await serviceClient
        .from('field_todos')
        .update(payload)
        .eq('id', previous.id)
        .eq('user_id', userId);
      if (updateError) throw new Error(`Pusula Deneyi görevi güncellenemedi: ${updateError.message}`);
      active += 1;
      continue;
    }

    const { error: insertError } = await serviceClient
      .from('field_todos')
      .insert(payload);
    if (insertError) {
      if (insertError.code === '23505') continue;
      throw new Error(`Pusula Deneyi görevi oluşturulamadı: ${insertError.message}`);
    }
    created += 1;
    active += 1;
  }

  return {
    requested: plan.tasks.length,
    active,
    created,
    stale_closed: staleIds.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = [
      'season_key', 'season', 'calibration', 'comparisons', 'models', 'pcse', 'cropforge',
      'observations', 'growth_observations', 'photos', 'ndvi', 'satellite', 'thresholds',
      'max_model_day_gap', 'force', 'status', 'review_ready', 'production_authority',
      'tasks', 'reward_points', 'reward_rule_key',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'Pusula Deneyi kanıtları ve görevleri istemciden kabul edilmez; yalnız field_id gönderilebilir.',
      }, 400);
    }

    const { user, serviceClient } = await authenticatedClients(req);

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,crop_cycle')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    if (String(field.crop_cycle ?? 'annual') !== 'annual') {
      await syncEvidenceTasks(serviceClient, user.id, fieldId, {
        season_key: 'unknown',
        status: 'blocked',
        calibration_review_eligible: false,
      }, null);
      return json({
        ok: true,
        field_id: fieldId,
        status: 'blocked',
        reason: 'Pusula Deneyi v1 yalnız mevcut PCSE/CropForge yıllık ürün kapsamını değerlendirir.',
        production_authority: false,
        user_visible: false,
        internal_only: true,
      });
    }

    const calibration = await loadCalibration(serviceClient, user.id, fieldId);
    if (!calibration) {
      await syncEvidenceTasks(serviceClient, user.id, fieldId, {
        season_key: 'unknown',
        status: 'waiting_calibration',
        calibration_review_eligible: false,
      }, null);
      return json({
        ok: true,
        field_id: fieldId,
        status: 'waiting_calibration',
        review_ready: false,
        evidence_tasks: { requested: 0, active: 0 },
        production_authority: false,
        user_visible: false,
        internal_only: true,
      });
    }

    const seasonKey = String(calibration.season_key ?? 'unknown');
    const season = await loadSeason(serviceClient, user.id, fieldId, seasonKey);

    let inputs = {
      comparisons: [],
      growthObservations: [],
      satelliteSnapshots: [],
      photos: [],
    } as any;

    if (season && calibration.review_eligible === true) {
      inputs = await loadExperimentInputs(
        serviceClient,
        user.id,
        fieldId,
        seasonKey,
        season,
      );
    }

    const state = buildPusulaExperimentState({
      calibration,
      season,
      ...inputs,
      maxModelDayGap: MAX_MODEL_DAY_GAP,
    });

    await persistState(serviceClient, user.id, fieldId, state);
    const evidenceTasks = await syncEvidenceTasks(
      serviceClient,
      user.id,
      fieldId,
      state,
      season,
    );

    return json({
      ok: true,
      field_id: fieldId,
      season_key: state.season_key,
      status: state.status,
      review_ready: state.review_ready,
      field_observation_days: state.field_observation_days,
      comparable_observation_days: state.comparable_observation_days,
      pcse_field_state: state.pcse.state,
      cropforge_field_state: state.cropforge.state,
      satellite_ndvi_days: state.satellite.ndvi_days,
      field_photo_count: state.photos.photo_count,
      evidence_tasks: evidenceTasks,
      production_authority: false,
      user_visible: false,
      internal_only: true,
      note: 'Pusula Deneyi yalnız iç kanıt değerlendirmesidir. Eksik gerçek saha kanıtı puanlı görev olarak istenir; model sıralanmaz, otomatik terfi etmez ve çiftçi kararı değiştirilmez.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pusula Deneyi değerlendirmesi başarısız oldu.';
    console.error('[pusula-experiment-evaluate]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({
      ok: false,
      error: message,
      production_authority: false,
      user_visible: false,
      internal_only: true,
    }, status);
  }
});
