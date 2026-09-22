import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
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

function interpolateKcb(profile: any, stage: StageResolution | null) {
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
    if (['crop', 'crop_subtype', 'stage', 'kcb'].some((key) => key in body)) {
      return json({ ok: false, error: 'Kcb girdileri istemciden kabul edilmez.' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);
    }

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,crop,crop_subtype')
      .eq('id', fieldId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const today = fieldDate();

    const [profilesResult, snapshotResult, observationsResult] = await Promise.all([
      serviceClient
        .from('crop_water_reference_profiles')
        .select('crop_key,display_name,crop_subtype,aliases,kcb_initial,kcb_mid,kcb_end,kcb_source_label,kcb_source_url,reference_version'),
      serviceClient
        .from('field_irrigation_kc_snapshots')
        .select('snapshot_date,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at')
        .eq('field_id', fieldId)
        .eq('user_id', authData.user.id)
        .order('snapshot_date', { ascending: false })
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from('field_growth_observations')
        .select('id,season_id,observed_on,stage,notes,created_at')
        .eq('field_id', fieldId)
        .eq('user_id', authData.user.id)
        .eq('observed_on', today)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    for (const result of [profilesResult, snapshotResult, observationsResult]) {
      if (result.error) throw result.error;
    }

    const profile = resolveReferenceProfile(
      Array.isArray(profilesResult.data) ? profilesResult.data : [],
      field.crop,
      field.crop_subtype,
    );

    const snapshot = snapshotResult.data;
    const observations = Array.isArray(observationsResult.data)
      ? observationsResult.data
      : [];

    const canonicalObservations = observations.filter((observation) => resolveStage(observation?.stage) !== null);
    const distinctObservedStages = [
      ...new Set(canonicalObservations.map((observation) => normalizeText(observation.stage))),
    ];
    const hasInvalidObservation = canonicalObservations.length !== observations.length;
    const hasConflictingObservations = distinctObservedStages.length > 1;
    const authoritativeObservation = !hasInvalidObservation && !hasConflictingObservations && distinctObservedStages.length === 1
      ? canonicalObservations[0]
      : null;

    const snapshotIsCurrent = Boolean(
      snapshot?.snapshot_date && String(snapshot.snapshot_date) === today && resolveStage(snapshot.phenology_stage),
    );
    const automaticStage = snapshotIsCurrent
      ? normalizeText(snapshot?.phenology_stage)
      : null;
    const observedStage = authoritativeObservation
      ? normalizeText(authoritativeObservation.stage)
      : null;
    const effectiveStage = observedStage ?? automaticStage;
    const stageSource = observedStage
      ? 'field_observation'
      : automaticStage
        ? 'model_snapshot'
        : null;
    const effectiveStageLabel = observedStage
      ? automaticStage === observedStage && snapshot?.stage_label
        ? snapshot.stage_label
        : authoritativeObservation?.stage ?? observedStage
      : snapshotIsCurrent
        ? snapshot?.stage_label ?? automaticStage
        : null;
    const stageResolution = resolveStage(effectiveStage);
    const kcb = interpolateKcb(profile, stageResolution);
    const stageDisagreement = Boolean(
      observedStage && automaticStage && observedStage !== automaticStage,
    );

    const validated = Boolean(
      profile &&
      authoritativeObservation &&
      !hasInvalidObservation &&
      !hasConflictingObservations &&
      stageResolution &&
      kcb !== null,
    );

    const missingInputs: string[] = [];
    if (!profile) missingInputs.push('fao56_basal_kcb_reference');
    if (!observations.length) missingInputs.push('same_day_field_growth_observation');
    if (hasInvalidObservation) missingInputs.push('canonical_field_growth_stage');
    if (hasConflictingObservations) missingInputs.push('conflicting_same_day_field_growth_observations');
    if (!authoritativeObservation && !automaticStage) missingInputs.push('current_phenology_stage');

    const warnings: string[] = [];
    if (stageDisagreement) warnings.push('model_stage_disagrees_with_field_observation');
    if (hasConflictingObservations) warnings.push('multiple_distinct_field_growth_stages_recorded_for_today');
    if (hasInvalidObservation) warnings.push('non_canonical_field_growth_stage_recorded_for_today');

    const status = validated
      ? 'validated'
      : hasInvalidObservation || hasConflictingObservations
        ? 'blocked'
        : kcb !== null
          ? 'shadow_candidate'
          : 'blocked';

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      field_time_zone: FIELD_TIME_ZONE,
      evidence_date: today,
      status,
      validated,
      crop_key: profile?.crop_key ?? null,
      kcb: kcb === null ? null : round(kcb, 3),
      reference_profile: profile ? {
        initial: Number(profile.kcb_initial),
        mid: Number(profile.kcb_mid),
        end: Number(profile.kcb_end),
      } : null,
      phenology: {
        // Backward-compatible fields retained for existing consumers.
        stage: effectiveStage,
        stage_label: effectiveStageLabel,
        source: stageSource === 'field_observation'
          ? 'field_growth_observations'
          : snapshotIsCurrent
            ? snapshot?.source_label ?? null
            : null,
        snapshot_date: snapshotIsCurrent ? snapshot?.snapshot_date ?? null : null,
        coefficient_confidence: snapshotIsCurrent ? snapshot?.coefficient_confidence ?? null : null,

        // Explicit provenance for newer consumers.
        effective_stage: effectiveStage,
        stage_source: stageSource,
        model_stage: automaticStage,
        model_stage_label: snapshotIsCurrent ? snapshot?.stage_label ?? null : null,
        model_source: snapshotIsCurrent ? snapshot?.source_label ?? null : null,
        model_disagrees_with_field_observation: stageDisagreement,
      },
      field_observation: authoritativeObservation ? {
        id: authoritativeObservation.id,
        observed_on: authoritativeObservation.observed_on,
        stage: authoritativeObservation.stage,
        canonical_stage: true,
        authoritative_for_kcb: true,
        model_stage_match: automaticStage === null ? null : !stageDisagreement,
      } : {
        observed_on: today,
        authoritative_for_kcb: false,
        observation_count: observations.length,
        distinct_canonical_stages: distinctObservedStages,
        has_invalid_stage: hasInvalidObservation,
        has_conflicting_stages: hasConflictingObservations,
      },
      source: profile ? {
        label: profile.kcb_source_label,
        url: profile.kcb_source_url,
        reference_version: profile.reference_version,
      } : null,
      missing_inputs: [...new Set(missingInputs)],
      warnings,
      validation_rule: 'FAO-56 basal Kcb reference + one unambiguous same-day canonical field growth observation. The field observation is authoritative even when the automatic phenology estimate disagrees.',
      caution: validated
        ? 'Kcb girdisi aynı gün saha gözlemiyle doğrulandı. Otomatik fenoloji farklıysa çelişki uyarı olarak korunur; saha gözlemi ezilmez. Model yine shadow rollout seviyesindedir ve production sulama otoritesi değildir.'
        : 'Saha gözlemi yoksa otomatik fenoloji yalnız shadow Kcb adayı üretir; çelişkili veya geçersiz saha gözlemi varsa Kcb doğrulanmaz.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[pyfao56-kcb-context]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'PyFAO56 Kcb bağlamı hazırlanamadı.',
      production_authority: false,
    }, 500);
  }
});
