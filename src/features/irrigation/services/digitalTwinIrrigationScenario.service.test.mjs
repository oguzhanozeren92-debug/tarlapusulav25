import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDigitalTwinIrrigationScenario,
} from './digitalTwinIrrigationScenario.service.ts';
import {
  compareDigitalTwinScenarios,
} from '../../../services/digitalTwinScenarioService.ts';

function decision(overrides = {}) {
  return {
    fieldId: 'field-1',
    fieldName: 'Tarla 1',
    cropName: 'Buğday',
    decision: 'irrigation_approaching',
    confidence: 'high',
    irrigationStatus: 'irrigated',
    currentKc: 0.9,
    waterBalance: {
      currentDeficitMm: 22,
      stressThresholdMm: 35,
      rootZoneStorageMm: 90,
      currentDeficitRatio: 22 / 90,
      projected5DayDeficitMm: 31,
      daysToStressThreshold: 3,
      lastIrrigationDate: '2026-09-15',
      lastIrrigationAppliedMm: 24,
      baselineAssumption: 'last_irrigation_refilled_root_zone',
    },
    rainfedStress: null,
    recommendation: {
      netWaterMm: 22,
      totalNetWaterM3: null,
      irrigationEfficiencyApplied: false,
      grossWaterMm: null,
      totalGrossWaterM3: null,
    },
    forecast: [],
    display: {
      headline: 'Sulama yaklaşıyor',
      summary: '',
      action: '',
      waterLabel: null,
    },
    reasons: [],
    missing: [],
    warnings: [],
    generatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

test('production irrigation values are mapped without inventing missing metrics', () => {
  const scenario = buildDigitalTwinIrrigationScenario({
    id: 'current',
    name: 'Mevcut sulama kararı',
    decision: decision(),
  });

  assert.equal(scenario.kind, 'irrigation');
  assert.equal(scenario.context?.fieldId, 'field-1');

  const currentDeficit = scenario.metrics.find(
    (item) => item.key === 'current_deficit',
  );
  const totalWater = scenario.metrics.find(
    (item) => item.key === 'recommended_total_net_water',
  );

  assert.equal(currentDeficit?.value, 22);
  assert.equal(currentDeficit?.unit, 'mm');
  assert.equal(currentDeficit?.status, 'available');
  assert.equal(currentDeficit?.source, 'production-irrigation-engine');
  assert.equal(totalWater?.value, null);
  assert.equal(totalWater?.status, 'missing');
});

test('two real decision snapshots can be compared through the common digital twin core', () => {
  const baseline = buildDigitalTwinIrrigationScenario({
    id: 'baseline',
    name: 'Mevcut plan',
    decision: decision(),
  });

  const candidate = buildDigitalTwinIrrigationScenario({
    id: 'candidate',
    name: 'Alternatif plan',
    decision: decision({
      waterBalance: {
        ...decision().waterBalance,
        currentDeficitMm: 16,
        projected5DayDeficitMm: 24,
      },
      recommendation: {
        ...decision().recommendation,
        netWaterMm: 16,
      },
    }),
  });

  const result = compareDigitalTwinScenarios(baseline, candidate);
  const currentDeficit = result.metrics.find(
    (item) => item.key === 'current_deficit',
  );
  const totalWater = result.metrics.find(
    (item) => item.key === 'recommended_total_net_water',
  );

  assert.equal(result.status, 'partial');
  assert.equal(currentDeficit?.absoluteDelta, -6);
  assert.equal(currentDeficit?.relativeDeltaPercent, -(6 / 22) * 100);
  assert.equal(totalWater?.comparable, false);
  assert.equal(totalWater?.reason, 'missing_metric');
});

test('different fields cannot be compared even when metric units match', () => {
  const baseline = buildDigitalTwinIrrigationScenario({
    id: 'baseline',
    name: 'Tarla 1',
    decision: decision(),
  });

  const otherField = buildDigitalTwinIrrigationScenario({
    id: 'candidate',
    name: 'Tarla 2',
    decision: decision({ fieldId: 'field-2', fieldName: 'Tarla 2' }),
  });

  assert.throws(
    () => compareDigitalTwinScenarios(baseline, otherField),
    /farklı tarlalar/,
  );
});

test('scenario without field provenance cannot be compared', () => {
  const baseline = buildDigitalTwinIrrigationScenario({
    id: 'baseline',
    name: 'Tarla 1',
    decision: decision(),
  });

  const unbound = buildDigitalTwinIrrigationScenario({
    id: 'candidate',
    name: 'Kimliği eksik senaryo',
    decision: decision({ fieldId: '' }),
  });

  assert.throws(
    () => compareDigitalTwinScenarios(baseline, unbound),
    /tarla kimliği/,
  );
});
