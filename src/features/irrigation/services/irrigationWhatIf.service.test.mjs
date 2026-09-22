import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIrrigationWhatIf } from './irrigationWhatIf.service.ts';

function decision(overrides = {}) {
  return {
    fieldId: 'field-1',
    fieldName: 'Tarla 1',
    cropName: 'Buğday',
    decision: 'irrigate_now',
    confidence: 'high',
    irrigationStatus: 'irrigated',
    currentKc: 0.9,
    waterBalance: {
      currentDeficitMm: 22,
      stressThresholdMm: 35,
      rootZoneStorageMm: 90,
      currentDeficitRatio: 22 / 35,
      projected5DayDeficitMm: 39,
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
    forecast: [
      {
        date: '2026-09-20',
        estimatedCropWaterUseMm: 5,
        precipitationMm: 0,
        effectiveRainMm: 0,
        estimatedDeficitMm: 27,
        thresholdReached: false,
      },
      {
        date: '2026-09-21',
        estimatedCropWaterUseMm: 5,
        precipitationMm: 0,
        effectiveRainMm: 0,
        estimatedDeficitMm: 32,
        thresholdReached: false,
      },
    ],
    display: { headline: '', summary: '', action: '', waterLabel: null },
    reasons: [],
    missing: [],
    warnings: [],
    generatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

test('compares irrigating today with waiting two days using production values only', () => {
  const result = buildIrrigationWhatIf(decision());

  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;

  assert.equal(result.appliedNetWaterMm, 22);
  assert.equal(result.metrics[0].irrigateToday, 10);
  assert.equal(result.metrics[0].waitTwoDays, 32);
  assert.equal(result.metrics[1].irrigateToday, 25);
  assert.equal(result.metrics[1].waitTwoDays, 3);
  assert.equal(result.metrics[0].source, 'production-irrigation-engine');
  assert.equal(result.productionAuthority, false);
});

test('blocks instead of inventing a today-irrigation amount when production has none', () => {
  const input = decision();
  input.recommendation.netWaterMm = null;

  const result = buildIrrigationWhatIf(input);

  assert.equal(result.status, 'blocked');
  if (result.status !== 'blocked') return;
  assert.ok(result.missing.includes('recommended_net_water'));
});

test('blocks when two-day production forecast is missing', () => {
  const result = buildIrrigationWhatIf(decision({ forecast: [] }));

  assert.equal(result.status, 'blocked');
  if (result.status !== 'blocked') return;
  assert.ok(result.missing.includes('two_day_forecast'));
});

test('blocks when field or generation provenance is invalid', () => {
  const result = buildIrrigationWhatIf(
    decision({ fieldId: '', generatedAt: 'invalid-date' }),
  );

  assert.equal(result.status, 'blocked');
  if (result.status !== 'blocked') return;
  assert.ok(result.missing.includes('field_id'));
  assert.ok(result.missing.includes('generated_at'));
});


test('production decision source must not coerce missing forecast climate to zero', async () => {
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./irrigationDecision.service.ts', import.meta.url), 'utf8'),
  );

  assert.doesNotMatch(source, /day\.etoMm\s*\?\?\s*0/);
  assert.doesNotMatch(source, /day\.precipitationMm\s*\?\?\s*0/);
  assert.match(source, /forecastHasMissingClimate/);
  assert.match(source, /ET0 veya yağış verisi eksik/);
});
