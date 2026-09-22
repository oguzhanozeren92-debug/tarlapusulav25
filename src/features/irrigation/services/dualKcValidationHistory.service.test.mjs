import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDualKcValidationHistory } from './dualKcValidationHistory.service.ts';

function run(date, agreement = 'supportive', promotionEligible = true) {
  return {
    audit: {
      fieldId: 'field-1',
      status: 'completed',
      notApplicable: false,
      missingInputs: [],
      scenarios: [],
      engineVersion: 'test',
      completedAt: date,
      productionAuthority: false,
      error: null,
    },
    agreement,
    promotionEligible,
  };
}

test('one matching run can never promote pyfao56', () => {
  const result = assessDualKcValidationHistory({
    runs: [run('2026-09-20T08:00:00Z')],
    verifiedSoilWaterMeasurementCount: 1,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.consecutiveSupportiveRuns, 1);
  assert.equal(result.productionAuthority, false);
});

test('three supportive runs on the same day count only once', () => {
  const result = assessDualKcValidationHistory({
    runs: [
      run('2026-09-20T10:00:00Z'),
      run('2026-09-20T09:00:00Z'),
      run('2026-09-20T08:00:00Z'),
    ],
    verifiedSoilWaterMeasurementCount: 1,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.consecutiveSupportiveRuns, 1);
});

test('a divergence breaks the consecutive validation chain', () => {
  const result = assessDualKcValidationHistory({
    runs: [
      run('2026-09-20T08:00:00Z'),
      run('2026-09-19T08:00:00Z', 'divergent', false),
      run('2026-09-18T08:00:00Z'),
      run('2026-09-17T08:00:00Z'),
    ],
    verifiedSoilWaterMeasurementCount: 1,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.consecutiveSupportiveRuns, 1);
});

test('three distinct supportive days still require verified field-water evidence', () => {
  const runs = [
    run('2026-09-20T08:00:00Z'),
    run('2026-09-19T08:00:00Z'),
    run('2026-09-18T08:00:00Z'),
  ];
  assert.equal(assessDualKcValidationHistory({
    runs,
    verifiedSoilWaterMeasurementCount: 0,
  }).eligible, false);

  const ready = assessDualKcValidationHistory({
    runs,
    verifiedSoilWaterMeasurementCount: 1,
  });
  assert.equal(ready.eligible, true);
  assert.equal(ready.productionAuthority, false);
});
