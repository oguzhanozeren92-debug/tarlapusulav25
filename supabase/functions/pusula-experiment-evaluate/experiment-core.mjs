const COARSE_STAGES = new Set([
  'pre_emergence',
  'vegetative',
  'reproductive',
  'mature',
]);

const DEFAULT_MAX_MODEL_DAY_GAP = 1;

function text(value) {
  return String(value ?? '').trim();
}

function dateOnly(value) {
  const raw = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function dayDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
}

export function fieldStageBucket(stage) {
  switch (text(stage)) {
    case 'establishment':
    case 'vegetative':
      return 'vegetative';
    case 'reproductive':
      return 'reproductive';
    case 'maturation':
    case 'harvest_window':
      return 'mature';
    default:
      return null;
  }
}

function groundTruthDays(observations) {
  const grouped = new Map();

  for (const observation of array(observations)) {
    const day = dateOnly(observation?.observed_on);
    if (!day) continue;

    const stage = text(observation?.stage);
    const bucket = fieldStageBucket(stage);
    const current = grouped.get(day) ?? {
      day,
      stages: new Set(),
      buckets: new Set(),
    };
    if (stage) current.stages.add(stage);
    if (bucket) current.buckets.add(bucket);
    grouped.set(day, current);
  }

  return [...grouped.values()]
    .map((item) => {
      const buckets = [...item.buckets];
      return {
        day: item.day,
        stages: [...item.stages].sort(),
        bucket: buckets.length === 1 ? buckets[0] : null,
        ambiguous: buckets.length > 1,
        mapped: buckets.length > 0,
      };
    })
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

function comparisonDays(rows) {
  const byDay = new Map();
  for (const row of array(rows)) {
    const day = dateOnly(row?.comparison_day);
    if (!day) continue;
    byDay.set(day, row);
  }
  return [...byDay.entries()]
    .map(([day, row]) => ({ ...row, comparison_day: day }))
    .sort((a, b) => String(a.comparison_day).localeCompare(String(b.comparison_day)));
}

function nearestComparison(day, rows, maxGapDays) {
  let selected = null;
  let selectedGap = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const gap = dayDistance(day, row.comparison_day);
    if (gap > maxGapDays) continue;
    if (gap < selectedGap) {
      selected = row;
      selectedGap = gap;
      continue;
    }
    if (gap === selectedGap && selected && String(row.comparison_day) > String(selected.comparison_day)) {
      selected = row;
    }
  }

  return selected ? { row: selected, gapDays: selectedGap } : null;
}

function engineBucket(row, engine) {
  const bucket = text(row?.engines?.[engine]?.phenology?.bucket);
  return COARSE_STAGES.has(bucket) ? bucket : null;
}

function engineState(evaluatedDays, supportedDays, divergentDays) {
  if (evaluatedDays < 2) return 'insufficient';
  if (supportedDays >= 2 && divergentDays === 0) return 'supportive';
  if (divergentDays >= 2 && supportedDays === 0) return 'divergent';
  return 'mixed';
}

function evaluateEngine({ engine, truthDays, comparisons, maxGapDays }) {
  let evaluatedDays = 0;
  let supportedDays = 0;
  let divergentDays = 0;
  const pairs = [];

  for (const truth of truthDays) {
    if (!truth.bucket || truth.ambiguous) continue;
    const nearest = nearestComparison(truth.day, comparisons, maxGapDays);
    if (!nearest) {
      pairs.push({
        observation_day: truth.day,
        field_bucket: truth.bucket,
        state: 'no_nearby_model_day',
      });
      continue;
    }

    const modelBucket = engineBucket(nearest.row, engine);
    if (!modelBucket) {
      pairs.push({
        observation_day: truth.day,
        model_day: nearest.row.comparison_day,
        day_gap: nearest.gapDays,
        field_bucket: truth.bucket,
        model_bucket: null,
        state: 'model_not_comparable',
      });
      continue;
    }

    evaluatedDays += 1;
    const supported = modelBucket === truth.bucket;
    if (supported) supportedDays += 1;
    else divergentDays += 1;

    pairs.push({
      observation_day: truth.day,
      model_day: nearest.row.comparison_day,
      day_gap: nearest.gapDays,
      field_bucket: truth.bucket,
      model_bucket: modelBucket,
      state: supported ? 'supportive' : 'divergent',
    });
  }

  return {
    state: engineState(evaluatedDays, supportedDays, divergentDays),
    evaluated_days: evaluatedDays,
    supported_days: supportedDays,
    divergent_days: divergentDays,
    pairs,
  };
}

function satelliteEvidence(snapshots) {
  const byDay = new Map();

  for (const snapshot of array(snapshots)) {
    const ndvi = snapshot?.ndvi;
    if (!ndvi || typeof ndvi !== 'object') continue;

    const source = text(ndvi.source).toLowerCase();
    if (!source.includes('sentinel-2') && !source.includes('copernicus')) continue;

    const day = dateOnly(ndvi.date);
    const average = finite(ndvi.average);
    if (!day || average === null || average < -1 || average > 1) continue;

    const capturedAt = text(snapshot?.captured_at);
    const previous = byDay.get(day);
    if (!previous || capturedAt >= previous.captured_at) {
      byDay.set(day, {
        day,
        average,
        source: text(ndvi.source),
        captured_at: capturedAt,
      });
    }
  }

  const values = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const first = values[0] ?? null;
  const latest = values[values.length - 1] ?? null;
  const delta = first && latest && first.day !== latest.day
    ? Number((latest.average - first.average).toFixed(4))
    : null;

  return {
    ndvi_days: values.length,
    first: first ? { day: first.day, average: first.average, source: first.source } : null,
    latest: latest ? { day: latest.day, average: latest.average, source: latest.source } : null,
    delta,
    note: 'NDVI is stored as independent satellite evidence only; it is never treated as direct phenology ground truth.',
  };
}

function photoEvidence(photos) {
  let georeferenced = 0;
  for (const photo of array(photos)) {
    const lat = finite(photo?.captured_lat);
    const lng = finite(photo?.captured_lng);
    if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      georeferenced += 1;
    }
  }
  return {
    photo_count: array(photos).length,
    georeferenced_photo_count: georeferenced,
    note: 'Photo presence is evidence coverage only. AI photo analysis is not used as field-stage truth in this experiment gate.',
  };
}

function baseResult(seasonKey, status, calibrationReviewEligible) {
  return {
    season_key: seasonKey,
    status,
    calibration_review_eligible: calibrationReviewEligible,
    review_ready: false,
    field_observation_days: 0,
    comparable_observation_days: 0,
    ambiguous_observation_days: 0,
    pcse: {
      state: 'insufficient',
      evaluated_days: 0,
      supported_days: 0,
      divergent_days: 0,
      pairs: [],
    },
    cropforge: {
      state: 'insufficient',
      evaluated_days: 0,
      supported_days: 0,
      divergent_days: 0,
      pairs: [],
    },
    satellite: satelliteEvidence([]),
    photos: photoEvidence([]),
    latest_field_observation_day: null,
    production_authority: false,
    user_visible: false,
  };
}

export function buildPusulaExperimentState(input) {
  const calibration = input?.calibration ?? null;
  const seasonKey = text(calibration?.season_key) || 'unknown';
  const calibrationReviewEligible = calibration?.review_eligible === true;

  if (!calibration) {
    return baseResult('unknown', 'waiting_calibration', false);
  }

  if (seasonKey === 'unknown' || seasonKey.startsWith('mixed:')) {
    return {
      ...baseResult(seasonKey, 'blocked', calibrationReviewEligible),
      evidence: { reason: 'season_identity_not_resolved' },
    };
  }

  if (!calibrationReviewEligible) {
    return {
      ...baseResult(seasonKey, 'waiting_calibration', false),
      evidence: {
        reason: 'shadow_calibration_not_review_eligible',
        calibration_status: text(calibration?.status) || null,
      },
    };
  }

  if (!input?.season) {
    return {
      ...baseResult(seasonKey, 'blocked', true),
      evidence: { reason: 'field_season_not_resolved' },
    };
  }

  const truth = groundTruthDays(input?.growthObservations);
  const fieldObservationDays = truth.length;
  const comparableTruth = truth.filter((item) => item.bucket && !item.ambiguous);
  const ambiguousObservationDays = truth.filter((item) => item.ambiguous).length;
  const comparisons = comparisonDays(input?.comparisons);
  const maxGapDays = Number.isFinite(input?.maxModelDayGap)
    ? Math.max(0, Math.min(3, Math.floor(input.maxModelDayGap)))
    : DEFAULT_MAX_MODEL_DAY_GAP;

  const pcse = evaluateEngine({
    engine: 'pcse',
    truthDays: comparableTruth,
    comparisons,
    maxGapDays,
  });
  const cropforge = evaluateEngine({
    engine: 'cropforge',
    truthDays: comparableTruth,
    comparisons,
    maxGapDays,
  });
  const satellite = satelliteEvidence(input?.satelliteSnapshots);
  const photos = photoEvidence(input?.photos);
  const latestFieldObservationDay = truth.length ? truth[truth.length - 1].day : null;

  let status = 'observing';
  if (comparableTruth.length === 0) {
    status = 'waiting_ground_truth';
  } else if (pcse.state === 'divergent' || cropforge.state === 'divergent') {
    status = 'field_conflict';
  } else if (pcse.state === 'mixed' || cropforge.state === 'mixed') {
    status = 'mixed';
  } else if (pcse.state === 'supportive' && cropforge.state === 'supportive') {
    status = 'field_supported';
  }

  const reviewReady =
    calibrationReviewEligible &&
    comparableTruth.length >= 2 &&
    (pcse.evaluated_days >= 2 || cropforge.evaluated_days >= 2);

  return {
    season_key: seasonKey,
    status,
    calibration_review_eligible: true,
    review_ready: reviewReady,
    field_observation_days: fieldObservationDays,
    comparable_observation_days: comparableTruth.length,
    ambiguous_observation_days: ambiguousObservationDays,
    pcse,
    cropforge,
    satellite,
    photos,
    latest_field_observation_day: latestFieldObservationDay,
    production_authority: false,
    user_visible: false,
    evidence: {
      internal_only: true,
      max_model_day_gap: maxGapDays,
      field_stage_truth_source: 'manual_field_growth_observation',
      same_day_observations_count_once: true,
      ambiguous_same_day_stage_is_excluded: true,
      satellite_is_not_phenology_truth: true,
      photos_are_not_ai_truth: true,
      automatic_model_ranking: false,
      automatic_production_promotion: false,
    },
  };
}
