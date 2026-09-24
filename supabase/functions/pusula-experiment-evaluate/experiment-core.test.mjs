import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPusulaExperimentState,
  fieldStageBucket,
} from './experiment-core.mjs';

function calibration(overrides = {}) {
  return {
    season_key: 'wheat:2026-09-01',
    status: 'consistent',
    review_eligible: true,
    ...overrides,
  };
}

function comparison(day, pcseBucket = 'vegetative', cropforgeBucket = 'vegetative') {
  return {
    comparison_day: day,
    status: 'complete',
    engines: {
      pcse: {
        status: 'completed',
        phenology: { bucket: pcseBucket },
      },
      cropforge: {
        status: 'completed',
        phenology: { bucket: cropforgeBucket },
      },
    },
  };
}

function observation(day, stage = 'vegetative') {
  return { observed_on: day, stage };
}

const season = {
  id: 'season-1',
  planting_date: '2026-09-01',
  harvest_date: null,
  crop: 'Buğday',
};

test('manual stage mapping stays deliberately coarse and excludes unsupported stages', () => {
  assert.equal(fieldStageBucket('establishment'), 'vegetative');
  assert.equal(fieldStageBucket('vegetative'), 'vegetative');
  assert.equal(fieldStageBucket('reproductive'), 'reproductive');
  assert.equal(fieldStageBucket('maturation'), 'mature');
  assert.equal(fieldStageBucket('harvest_window'), 'mature');
  assert.equal(fieldStageBucket('pre_sowing'), null);
  assert.equal(fieldStageBucket('post_harvest'), null);
  assert.equal(fieldStageBucket('flowering'), null);
});

test('experiment stays locked until shadow calibration is review eligible', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration({ review_eligible: false, status: 'observing' }),
    season,
    comparisons: [comparison('2026-09-10')],
    growthObservations: [observation('2026-09-10')],
  });

  assert.equal(result.status, 'waiting_calibration');
  assert.equal(result.review_ready, false);
  assert.equal(result.production_authority, false);
});

test('NDVI coverage alone never substitutes for field-stage ground truth', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [comparison('2026-09-10')],
    growthObservations: [],
    satelliteSnapshots: [
      {
        captured_at: '2026-09-10T12:00:00Z',
        ndvi: {
          date: '2026-09-10',
          average: 0.64,
          source: 'Copernicus Data Space · Sentinel-2 L2A',
        },
      },
      {
        captured_at: '2026-09-15T12:00:00Z',
        ndvi: {
          date: '2026-09-15',
          average: 0.71,
          source: 'Copernicus Data Space · Sentinel-2 L2A',
        },
      },
    ],
  });

  assert.equal(result.status, 'waiting_ground_truth');
  assert.equal(result.satellite.ndvi_days, 2);
  assert.equal(result.satellite.delta, 0.07);
  assert.equal(result.review_ready, false);
});

test('two distinct manual field observations can support both engines without granting authority', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [
      comparison('2026-09-10', 'vegetative', 'vegetative'),
      comparison('2026-09-18', 'reproductive', 'reproductive'),
    ],
    growthObservations: [
      observation('2026-09-10', 'vegetative'),
      observation('2026-09-18', 'reproductive'),
    ],
  });

  assert.equal(result.status, 'field_supported');
  assert.equal(result.review_ready, true);
  assert.equal(result.pcse.state, 'supportive');
  assert.equal(result.cropforge.state, 'supportive');
  assert.equal(result.production_authority, false);
  assert.equal(result.user_visible, false);
});

test('repeated conflicts are surfaced as field conflict but no engine is ranked as winner', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [
      comparison('2026-09-10', 'reproductive', 'vegetative'),
      comparison('2026-09-18', 'mature', 'reproductive'),
    ],
    growthObservations: [
      observation('2026-09-10', 'vegetative'),
      observation('2026-09-18', 'reproductive'),
    ],
  });

  assert.equal(result.status, 'field_conflict');
  assert.equal(result.pcse.state, 'divergent');
  assert.equal(result.cropforge.state, 'supportive');
  assert.equal(result.evidence.automatic_model_ranking, false);
  assert.equal(result.production_authority, false);
});

test('same-day duplicate field observations count once', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [comparison('2026-09-10')],
    growthObservations: [
      observation('2026-09-10', 'vegetative'),
      observation('2026-09-10', 'vegetative'),
    ],
  });

  assert.equal(result.field_observation_days, 1);
  assert.equal(result.comparable_observation_days, 1);
  assert.equal(result.pcse.evaluated_days, 1);
  assert.equal(result.pcse.state, 'insufficient');
});

test('conflicting mapped stages on the same field day are excluded as ambiguous evidence', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [comparison('2026-09-10')],
    growthObservations: [
      observation('2026-09-10', 'vegetative'),
      observation('2026-09-10', 'reproductive'),
    ],
  });

  assert.equal(result.field_observation_days, 1);
  assert.equal(result.comparable_observation_days, 0);
  assert.equal(result.ambiguous_observation_days, 1);
  assert.equal(result.status, 'waiting_ground_truth');
});

test('model day farther than one day is not compared to field truth', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [comparison('2026-09-07')],
    growthObservations: [observation('2026-09-10', 'vegetative')],
  });

  assert.equal(result.pcse.evaluated_days, 0);
  assert.equal(result.cropforge.evaluated_days, 0);
  assert.equal(result.status, 'observing');
});

test('photo coverage is counted but AI photo output is never consumed as stage truth', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration(),
    season,
    comparisons: [],
    growthObservations: [],
    photos: [
      {
        captured_at: '2026-09-10T10:00:00Z',
        captured_lat: 40.1,
        captured_lng: 29.2,
        ai_result: { stage: 'reproductive' },
      },
    ],
  });

  assert.equal(result.photos.photo_count, 1);
  assert.equal(result.photos.georeferenced_photo_count, 1);
  assert.equal(result.comparable_observation_days, 0);
  assert.equal(result.status, 'waiting_ground_truth');
});

test('unknown season identity is blocked from experiment review', () => {
  const result = buildPusulaExperimentState({
    calibration: calibration({ season_key: 'unknown' }),
    season,
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.review_ready, false);
  assert.equal(result.production_authority, false);
});
