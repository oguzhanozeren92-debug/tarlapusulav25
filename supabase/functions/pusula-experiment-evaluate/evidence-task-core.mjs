const REQUIRED_FIELD_STAGE_DAYS = 2;

function text(value) {
  return String(value ?? '').trim();
}

function dateOnly(value) {
  const raw = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

function safeSeasonKey(value) {
  return text(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9:_|-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

export function buildExperimentEvidenceTaskPlan({ state, season, today }) {
  const day = dateOnly(today) ?? new Date().toISOString().slice(0, 10);
  const seasonKey = text(state?.season_key) || 'unknown';
  const seasonId = text(season?.id) || null;
  const seasonStart = dateOnly(season?.planting_date);
  const active =
    state?.calibration_review_eligible === true &&
    seasonId !== null &&
    seasonStart !== null &&
    seasonKey !== 'unknown' &&
    !seasonKey.startsWith('mixed:') &&
    state?.status !== 'blocked' &&
    state?.status !== 'waiting_calibration';

  if (!active) {
    return {
      active: false,
      season_key: seasonKey,
      tasks: [],
    };
  }

  const tasks = [];
  const comparableDays = Number(state?.comparable_observation_days ?? 0);
  const latestObservationDay = dateOnly(state?.latest_field_observation_day);

  if (
    comparableDays < REQUIRED_FIELD_STAGE_DAYS &&
    latestObservationDay !== day
  ) {
    tasks.push({
      kind: 'growth_stage',
      task_key: `pusula-experiment-growth-stage:${safeSeasonKey(seasonKey)}:${day}`,
      title: 'Bugünkü gelişim evresini kontrol et',
      description:
        'Pusula Deneyi model çıktısını gerçek tarla gözlemiyle doğrulamak için bugünkü gelişim evresini kaydet. Bu görev tamamlandığında +20 Pusula Puanı kazanırsın.',
      action_target: 'field-growth',
      priority: 75,
      due_date: day,
      reward_rule_key: 'TASK_PUSULA_EXPERIMENT_STAGE',
      reward_points: 20,
      metadata: {
        rewardPoints: 20,
        seasonKey,
        seasonId,
        seasonStart,
        evidenceRequest: 'growth_stage',
        experiment: 'pusula-experiment-v1',
        engines: ['pcse', 'cropforge'],
        internalValidation: true,
      },
    });
  }

  const photoCount = Number(state?.photos?.photo_count ?? state?.field_photo_count ?? 0);
  if (photoCount < 1) {
    tasks.push({
      kind: 'field_photo',
      task_key: `pusula-experiment-field-photo:${safeSeasonKey(seasonKey)}`,
      title: 'Tarlayı kontrol et ve fotoğraf yükle',
      description:
        'Pusula Deneyi için sahadan gerçek bir fotoğraf kanıtı ekle. Fotoğraf yalnız kanıt kapsamı olarak kullanılır; tek başına gelişim evresi gerçeği sayılmaz. Bu görev +30 Pusula Puanı kazandırır.',
      action_target: 'field-photo',
      priority: 65,
      due_date: day,
      reward_rule_key: 'FIELD_OBSERVATION_PHOTO',
      reward_points: 30,
      metadata: {
        rewardPoints: 30,
        seasonKey,
        seasonId,
        seasonStart,
        evidenceRequest: 'field_photo',
        sourceLayer: 'vegetation',
        openPhoto: true,
        experiment: 'pusula-experiment-v1',
        internalValidation: true,
      },
    });
  }

  return {
    active: true,
    season_key: seasonKey,
    tasks,
  };
}
