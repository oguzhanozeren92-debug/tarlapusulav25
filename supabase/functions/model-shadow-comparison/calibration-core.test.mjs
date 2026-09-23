import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalibrationState } from './calibration-core.mjs';

function row(day, options = {}) {
  const {
    pcse = 'completed',
    cropforge = 'completed',
    aquacrop = 'completed',
    status = 'complete',
    divergences = [],
  } = options;
  const phenologyComparable = pcse === 'completed' && cropforge === 'completed';
  return {
    comparison_day: day,
    season_key: 'wheat:2026-09-01',
    status,
    severity: divergences.some((item) => item.severity === 'high')
      ? 'high'
      : divergences.length ? 'watch' : 'none',
    engines: {
      pcse: { status: pcse },
      aquacrop: { status: aquacrop },
      cropforge: { status: cropforge },
    },
    normalized: {
      comparable_scopes: { phenology: phenologyComparable },
    },
    divergences,
  };
}

const phenologyWatch = {
  code: 'PHENOLOGY_STAGE_DIVERGENCE',
  severity: 'watch',
};

const phenologyHigh = {
  code: 'PHENOLOGY_STAGE_DIVERGENCE',
  severity: 'high',
};

test('one clean day stays observing and never grants production authority', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [row('2026-09-20')],
  });
  assert.equal(result.status, 'observing');
  assert.equal(result.phenology_clean_streak, 1);
  assert.equal(result.review_eligible, false);
  assert.equal(result.production_authority, false);
  assert.equal(result.user_visible, false);
});

test('three clean distinct days become internally consistent but only review eligible', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [row('2026-09-20'), row('2026-09-19'), row('2026-09-18')],
  });
  assert.equal(result.status, 'consistent');
  assert.equal(result.phenology_clean_streak, 3);
  assert.equal(result.review_eligible, true);
  assert.equal(result.production_authority, false);
});

test('same-day repeats count once and cannot manufacture three-day evidence', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20'),
      row('2026-09-20'),
      row('2026-09-19'),
    ],
  });
  assert.equal(result.distinct_days, 2);
  assert.equal(result.phenology_clean_streak, 2);
  assert.equal(result.review_eligible, false);
});

test('latest phenology divergence immediately marks the internal state divergent', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20', { divergences: [phenologyHigh] }),
      row('2026-09-19'),
      row('2026-09-18'),
      row('2026-09-17'),
    ],
  });
  assert.equal(result.status, 'divergent');
  assert.equal(result.phenology_clean_streak, 0);
  assert.equal(result.phenology_high_days, 1);
  assert.equal(result.last_divergence_day, '2026-09-20');
  assert.equal(result.review_eligible, false);
});

test('an older divergence breaks the consecutive chain even after earlier clean history', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20'),
      row('2026-09-19', { divergences: [phenologyWatch] }),
      row('2026-09-18'),
      row('2026-09-17'),
    ],
  });
  assert.equal(result.status, 'observing');
  assert.equal(result.phenology_clean_streak, 1);
  assert.equal(result.phenology_watch_days, 1);
  assert.equal(result.review_eligible, false);
});

test('a non-comparable day breaks the latest phenology streak rather than counting as agreement', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20'),
      row('2026-09-19', { cropforge: 'blocked', status: 'partial' }),
      row('2026-09-18'),
      row('2026-09-17'),
    ],
  });
  assert.equal(result.phenology_clean_streak, 1);
  assert.equal(result.review_eligible, false);
});

test('AquaCrop evidence coverage is tracked separately from phenology consistency', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20', { pcse: 'blocked', cropforge: 'blocked', status: 'partial' }),
      row('2026-09-19', { pcse: 'blocked', cropforge: 'blocked', status: 'partial' }),
      row('2026-09-18', { pcse: 'blocked', cropforge: 'blocked', status: 'partial' }),
    ],
  });
  assert.equal(result.aquacrop_completed_days, 3);
  assert.equal(result.water_evidence_state, 'covered');
  assert.equal(result.phenology_comparable_days, 0);
  assert.equal(result.review_eligible, false);
});

test('AquaCrop pipeline failure does not fabricate a PCSE-CropForge agronomic divergence', () => {
  const result = buildCalibrationState({
    seasonKey: 'wheat:2026-09-01',
    rows: [
      row('2026-09-20', {
        aquacrop: 'failed',
        status: 'partial',
        divergences: [{ code: 'ENGINE_EXECUTION_FAILURE', severity: 'watch' }],
      }),
    ],
  });
  assert.equal(result.status, 'observing');
  assert.equal(result.phenology_clean_streak, 1);
  assert.equal(result.phenology_watch_days, 0);
  assert.equal(result.aquacrop_completed_days, 0);
});

test('unknown or mixed season identity is blocked from calibration review', () => {
  for (const seasonKey of ['unknown', 'mixed:2026-09-01|2026-09-02']) {
    const result = buildCalibrationState({ seasonKey, rows: [row('2026-09-20')] });
    assert.equal(result.status, 'blocked');
    assert.equal(result.review_eligible, false);
    assert.equal(result.production_authority, false);
  }
});
