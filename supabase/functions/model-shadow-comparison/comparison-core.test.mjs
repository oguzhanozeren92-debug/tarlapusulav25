import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShadowComparison } from './comparison-core.mjs';

function pcse(stage = 'vegetative', end = '2026-05-01') {
  return {
    ok: true,
    blocked: false,
    result: {
      simulation: {
        planting_date: '2025-11-01',
        actual_output_date: end,
        requested_as_of_date: end,
        crop_key: 'wheat',
      },
      phenology: { stage, dvs: stage === 'mature' ? 2.1 : 0.7 },
    },
  };
}

function aquacrop(end = '2026-05-02') {
  return {
    ok: true,
    blocked: false,
    result: {
      simulation: {
        planting_date: '2025-11-01',
        end,
        crop_model_key: 'Wheat',
      },
      outputs: {
        last_water_flux: { dap: 183, Wr: 84, IrrDay: 0, Infl: 4, Runoff: 0, DeepPerc: 0, Es: 1.4, Tr: 2.1 },
      },
    },
  };
}

function cropforge(stage = 'tillering', end = '2026-05-01') {
  return {
    ok: true,
    blocked: false,
    result: {
      planting_date: '2025-11-01',
      simulation_end: end,
      crop_key: 'wheat',
      result: {
        phenological_stage: stage,
        stage_progress: 0.4,
        mean_lai: 2.1,
        mean_biomass_g_per_representative_plant: 21.5,
        mean_height_cm: 37.2,
        thermal_time_degree_days: 620,
      },
    },
  };
}

test('scope-aware comparison accepts aligned engines without fabricating AquaCrop phenology', () => {
  const result = buildShadowComparison({
    pcse: pcse(),
    aquacrop: aquacrop(),
    cropforge: cropforge(),
    comparisonDay: '2026-09-23',
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.severity, 'none');
  assert.equal(result.production_authority, false);
  assert.equal(result.user_visible, false);
  assert.equal(result.engines.aquacrop.phenology, null);
  assert.equal(result.normalized.comparable_scopes.water_balance_cross_engine, false);
  assert.equal(result.normalized.comparable_scopes.crop_growth_cross_engine, false);
  assert.equal(result.comparison_as_of, '2026-05-01');
});

test('large PCSE and CropForge phenology disagreement becomes an internal high divergence', () => {
  const result = buildShadowComparison({
    pcse: pcse('mature'),
    aquacrop: aquacrop(),
    cropforge: cropforge('emergence'),
    comparisonDay: '2026-09-23',
  });

  assert.equal(result.severity, 'high');
  assert.ok(result.divergences.some((item) => item.code === 'PHENOLOGY_STAGE_DIVERGENCE' && item.severity === 'high'));
});

test('blocked inputs produce a blocked internal snapshot rather than synthetic comparison values', () => {
  const blocked = { ok: true, blocked: true, missing_inputs: ['soil_profile'] };
  const result = buildShadowComparison({
    pcse: blocked,
    aquacrop: blocked,
    cropforge: blocked,
    comparisonDay: '2026-09-23',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.severity, 'none');
  assert.deepEqual(result.normalized.completed_engines, []);
  assert.equal(result.comparison_as_of, null);
});

test('simulation horizon drift beyond three days is high severity', () => {
  const result = buildShadowComparison({
    pcse: pcse('vegetative', '2026-05-01'),
    aquacrop: aquacrop('2026-05-08'),
    cropforge: cropforge('tillering', '2026-05-01'),
    comparisonDay: '2026-09-23',
  });

  assert.equal(result.severity, 'high');
  assert.ok(result.divergences.some((item) => item.code === 'SIMULATION_HORIZON_DRIFT' && item.severity === 'high'));
});
