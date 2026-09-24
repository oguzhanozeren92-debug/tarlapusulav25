import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExperimentEvidenceTaskPlan } from './evidence-task-core.mjs';

const season = {
  id: 'season-1',
  planting_date: '2026-09-01',
};

function state(overrides = {}) {
  return {
    season_key: 'wheat:2026-09-01',
    status: 'waiting_ground_truth',
    calibration_review_eligible: true,
    comparable_observation_days: 0,
    latest_field_observation_day: null,
    photos: { photo_count: 0 },
    ...overrides,
  };
}

test('requests stage and photo evidence when experiment is eligible but ground truth is empty', () => {
  const plan = buildExperimentEvidenceTaskPlan({
    state: state(),
    season,
    today: '2026-09-24',
  });

  assert.equal(plan.active, true);
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.tasks[0].kind, 'growth_stage');
  assert.equal(plan.tasks[0].reward_points, 20);
  assert.equal(plan.tasks[0].action_target, 'field-growth');
  assert.equal(plan.tasks[1].kind, 'field_photo');
  assert.equal(plan.tasks[1].reward_points, 30);
  assert.equal(plan.tasks[1].reward_rule_key, 'FIELD_OBSERVATION_PHOTO');
});

test('does not ask for another stage observation on the same day', () => {
  const plan = buildExperimentEvidenceTaskPlan({
    state: state({ latest_field_observation_day: '2026-09-24' }),
    season,
    today: '2026-09-24',
  });

  assert.deepEqual(plan.tasks.map((task) => task.kind), ['field_photo']);
});

test('asks for a new stage observation on a later day until two comparable days exist', () => {
  const plan = buildExperimentEvidenceTaskPlan({
    state: state({
      comparable_observation_days: 1,
      latest_field_observation_day: '2026-09-23',
      photos: { photo_count: 1 },
    }),
    season,
    today: '2026-09-24',
  });

  assert.deepEqual(plan.tasks.map((task) => task.kind), ['growth_stage']);
});

test('stops requesting evidence once two comparable stage days and a photo exist', () => {
  const plan = buildExperimentEvidenceTaskPlan({
    state: state({
      status: 'field_supported',
      comparable_observation_days: 2,
      photos: { photo_count: 1 },
    }),
    season,
    today: '2026-09-24',
  });

  assert.equal(plan.active, true);
  assert.equal(plan.tasks.length, 0);
});

test('never creates experiment tasks before calibration review eligibility', () => {
  const plan = buildExperimentEvidenceTaskPlan({
    state: state({
      status: 'waiting_calibration',
      calibration_review_eligible: false,
    }),
    season,
    today: '2026-09-24',
  });

  assert.equal(plan.active, false);
  assert.equal(plan.tasks.length, 0);
});

test('blocked or unresolved seasons never create experiment tasks', () => {
  const unresolved = buildExperimentEvidenceTaskPlan({
    state: state({ season_key: 'unknown', status: 'blocked' }),
    season,
    today: '2026-09-24',
  });
  const noSeason = buildExperimentEvidenceTaskPlan({
    state: state(),
    season: null,
    today: '2026-09-24',
  });

  assert.equal(unresolved.active, false);
  assert.equal(noSeason.active, false);
});
