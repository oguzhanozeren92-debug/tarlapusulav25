import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareDigitalTwinScenarios,
} from './digitalTwinScenarioService.ts';

function metric(key, value, unit, overrides = {}) {
  return {
    key,
    value,
    unit,
    source: 'verified-test-source',
    observedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

function scenario(metrics, overrides = {}) {
  return {
    id: 'baseline',
    name: 'Mevcut plan',
    kind: 'irrigation',
    context: {
      fieldId: 'field-1',
      generatedAt: '2026-09-20T00:00:00.000Z',
      source: 'test-fixture',
    },
    metrics,
    ...overrides,
  };
}

test('same-unit metrics produce absolute and relative deltas', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm')]),
    scenario([metric('water', 15, 'MM')], { id: 'candidate', name: 'Alternatif plan' }),
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.comparableMetricCount, 1);
  assert.equal(result.metrics[0].absoluteDelta, -5);
  assert.equal(result.metrics[0].relativeDeltaPercent, -25);
});

test('unit mismatch never fabricates a comparison', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm')]),
    scenario([metric('water', 200, 'm3')], { id: 'candidate' }),
  );
  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics[0].absoluteDelta, null);
  assert.equal(result.metrics[0].reason, 'unit_mismatch');
});

test('blocked and missing sources remain explicit instead of using fallback values', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm', { status: 'blocked', blockedReason: 'ET kaynağı henüz doğrulanmadı.' })]),
    scenario([metric('water', 18, 'mm')], { id: 'candidate' }),
  );
  assert.equal(result.metrics[0].reason, 'source_blocked');
  assert.equal(result.metrics[0].absoluteDelta, null);
});

test('zero baseline keeps absolute delta but suppresses unsafe percentage math', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('nitrogen', 0, 'kg/ha')], { kind: 'nutrition' }),
    scenario([metric('nitrogen', 25, 'kg/ha')], { id: 'candidate', kind: 'nutrition' }),
  );
  assert.equal(result.metrics[0].absoluteDelta, 25);
  assert.equal(result.metrics[0].relativeDeltaPercent, null);
  assert.equal(result.metrics[0].reason, 'zero_baseline');
});

test('different scenario kinds cannot be compared', () => {
  assert.throws(
    () => compareDigitalTwinScenarios(
      scenario([], { kind: 'irrigation' }),
      scenario([], { id: 'candidate', kind: 'crop' }),
    ),
    /aynı senaryo türleri/,
  );
});

test('missing scenario source provenance blocks comparison', () => {
  assert.throws(
    () => compareDigitalTwinScenarios(
      scenario([metric('water', 20, 'mm')]),
      scenario([metric('water', 18, 'mm')], {
        id: 'candidate',
        context: {
          fieldId: 'field-1',
          generatedAt: '2026-09-20T00:00:00.000Z',
          source: '',
        },
      }),
    ),
    /veri kaynağı/,
  );
});

test('missing or invalid scenario timestamp blocks comparison', () => {
  assert.throws(
    () => compareDigitalTwinScenarios(
      scenario([metric('water', 20, 'mm')]),
      scenario([metric('water', 18, 'mm')], {
        id: 'candidate',
        context: {
          fieldId: 'field-1',
          generatedAt: 'not-a-date',
          source: 'production-irrigation-engine',
        },
      }),
    ),
    /üretim zamanı/,
  );
});

test('available metric without source provenance is blocked instead of compared', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm')]),
    scenario([metric('water', 18, 'mm', { source: '' })], { id: 'candidate' }),
  );
  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics[0].reason, 'missing_provenance');
  assert.equal(result.metrics[0].absoluteDelta, null);
});

test('available metric with invalid observation time is blocked instead of compared', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm')]),
    scenario([metric('water', 18, 'mm', { observedAt: 'not-a-date' })], { id: 'candidate' }),
  );
  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics[0].reason, 'missing_provenance');
  assert.equal(result.metrics[0].relativeDeltaPercent, null);
});

test('metric observed after its scenario was generated is blocked', () => {
  const result = compareDigitalTwinScenarios(
    scenario([metric('water', 20, 'mm')]),
    scenario([metric('water', 18, 'mm', { observedAt: '2026-09-20T00:05:00.000Z' })], { id: 'candidate' }),
  );
  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics[0].reason, 'missing_provenance');
  assert.equal(result.metrics[0].absoluteDelta, null);
});

test('future-dated scenario provenance is rejected', () => {
  assert.throws(
    () => compareDigitalTwinScenarios(
      scenario([metric('water', 20, 'mm')]),
      scenario([metric('water', 18, 'mm')], {
        id: 'candidate',
        context: {
          fieldId: 'field-1',
          generatedAt: '2999-01-01T00:00:00.000Z',
          source: 'production-irrigation-engine',
        },
      }),
    ),
    /gelecekte üretilmiş/,
  );
});
