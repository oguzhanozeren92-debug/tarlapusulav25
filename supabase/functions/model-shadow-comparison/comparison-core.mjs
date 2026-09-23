const STAGE_ORDER = {
  pre_emergence: 0,
  vegetative: 1,
  reproductive: 2,
  mature: 3,
};

function text(value) {
  return String(value ?? '').trim();
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value) {
  const raw = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

function cropFamily(value) {
  const raw = text(value).toLocaleLowerCase('tr-TR');
  if (['wheat', 'buğday', 'bugday', 'triticum aestivum'].includes(raw)) return 'wheat';
  if (['maize', 'corn', 'mısır', 'misir', 'zea mays'].includes(raw)) return 'maize';
  if (['barley', 'arpa'].includes(raw)) return 'barley';
  if (['cotton', 'pamuk'].includes(raw)) return 'cotton';
  if (['potato', 'patates'].includes(raw)) return 'potato';
  return raw || null;
}

function responseStatus(value) {
  if (!value || typeof value !== 'object') return 'failed';
  if (value.ok === true && value.blocked === true) return 'blocked';
  if (value.ok === true && value.blocked !== true && value.result) return 'completed';
  return value.ok === false ? 'failed' : 'failed';
}

function missingInputs(value) {
  return Array.isArray(value?.missing_inputs) ? value.missing_inputs.map(String).sort() : [];
}

function cropForgeBucket(stage) {
  const raw = text(stage).toLowerCase();
  if (!raw) return null;
  if (['germination'].includes(raw)) return 'pre_emergence';
  if (['emergence', 'tillering', 'stem_extension', 'vegetative'].includes(raw)) return 'vegetative';
  if (['anthesis', 'grain_fill', 'tasseling', 'silking'].includes(raw)) return 'reproductive';
  if (['maturity', 'mature'].includes(raw)) return 'mature';
  return null;
}

function normalizePcse(response) {
  const status = responseStatus(response);
  const result = status === 'completed' ? response.result : null;
  return {
    engine: 'pcse',
    status,
    scope: 'phenology_only',
    missing_inputs: missingInputs(response),
    planting_date: dateOnly(result?.simulation?.planting_date),
    end_date: dateOnly(result?.simulation?.actual_output_date ?? result?.simulation?.requested_as_of_date),
    crop: cropFamily(result?.simulation?.crop_key),
    phenology: result ? {
      bucket: text(result?.phenology?.stage) || null,
      raw_stage: text(result?.phenology?.stage) || null,
      dvs: finite(result?.phenology?.dvs),
    } : null,
    water_balance: null,
    crop_growth: null,
  };
}

function normalizeAquaCrop(response) {
  const status = responseStatus(response);
  const result = status === 'completed' ? response.result : null;
  const lastFlux = result?.outputs?.last_water_flux ?? null;
  return {
    engine: 'aquacrop',
    status,
    scope: 'water_balance_evidence_only',
    missing_inputs: missingInputs(response),
    planting_date: dateOnly(result?.simulation?.planting_date),
    end_date: dateOnly(result?.simulation?.end),
    crop: cropFamily(result?.simulation?.crop_model_key),
    phenology: null,
    water_balance: result ? {
      dap: finite(lastFlux?.dap),
      root_zone_water_mm: finite(lastFlux?.Wr),
      irrigation_day_mm: finite(lastFlux?.IrrDay),
      infiltration_mm: finite(lastFlux?.Infl),
      runoff_mm: finite(lastFlux?.Runoff),
      deep_percolation_mm: finite(lastFlux?.DeepPerc),
      soil_evaporation_mm: finite(lastFlux?.Es),
      transpiration_mm: finite(lastFlux?.Tr),
    } : null,
    crop_growth: null,
  };
}

function normalizeCropForge(response) {
  const status = responseStatus(response);
  const result = status === 'completed' ? response.result : null;
  const rawStage = text(result?.result?.phenological_stage) || null;
  return {
    engine: 'cropforge',
    status,
    scope: 'observed_weather_crop_growth_core_v1',
    missing_inputs: missingInputs(response),
    planting_date: dateOnly(result?.planting_date),
    end_date: dateOnly(result?.simulation_end),
    crop: cropFamily(result?.crop_key),
    phenology: result ? {
      bucket: cropForgeBucket(rawStage),
      raw_stage: rawStage,
      stage_progress: finite(result?.result?.stage_progress),
    } : null,
    water_balance: null,
    crop_growth: result ? {
      lai: finite(result?.result?.mean_lai),
      biomass_g_per_representative_plant: finite(result?.result?.mean_biomass_g_per_representative_plant),
      height_cm: finite(result?.result?.mean_height_cm),
      thermal_time_degree_days: finite(result?.result?.thermal_time_degree_days),
    } : null,
  };
}

function daysApart(a, b) {
  if (!a || !b) return null;
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
}

function uniqueNonNull(values) {
  return [...new Set(values.filter(Boolean))];
}

function severityRank(value) {
  return value === 'high' ? 2 : value === 'watch' ? 1 : 0;
}

function pushDivergence(list, code, severity, evidence, note) {
  list.push({ code, severity, evidence, note });
}

export function buildShadowComparison({ pcse, aquacrop, cropforge, comparisonDay }) {
  const engines = {
    pcse: normalizePcse(pcse),
    aquacrop: normalizeAquaCrop(aquacrop),
    cropforge: normalizeCropForge(cropforge),
  };

  const completed = Object.values(engines).filter((item) => item.status === 'completed');
  const blocked = Object.values(engines).filter((item) => item.status === 'blocked');
  const failed = Object.values(engines).filter((item) => item.status === 'failed');

  let status = 'failed';
  if (completed.length === 3) status = 'complete';
  else if (completed.length > 0) status = 'partial';
  else if (blocked.length > 0 && failed.length === 0) status = 'blocked';
  else if (blocked.length > 0) status = 'partial';

  const divergences = [];
  const plantingDates = uniqueNonNull(completed.map((item) => item.planting_date));
  const crops = uniqueNonNull(completed.map((item) => item.crop));
  const endDates = uniqueNonNull(completed.map((item) => item.end_date));

  if (plantingDates.length > 1) {
    pushDivergence(
      divergences,
      'PLANTING_DATE_MISMATCH',
      'high',
      { planting_dates: plantingDates },
      'Completed engines are not comparing the same planting date.',
    );
  }

  if (crops.length > 1) {
    pushDivergence(
      divergences,
      'CROP_IDENTITY_MISMATCH',
      'high',
      { crops },
      'Completed engines are not comparing the same crop family.',
    );
  }

  if (endDates.length > 1) {
    const sorted = [...endDates].sort();
    const driftDays = daysApart(sorted[0], sorted[sorted.length - 1]);
    if (driftDays !== null && driftDays > 1) {
      pushDivergence(
        divergences,
        'SIMULATION_HORIZON_DRIFT',
        driftDays > 3 ? 'high' : 'watch',
        { end_dates: sorted, drift_days: driftDays },
        'Model outputs are not aligned to the same effective comparison horizon.',
      );
    }
  }

  const pcseStage = engines.pcse.status === 'completed' ? engines.pcse.phenology?.bucket : null;
  const cropForgeStage = engines.cropforge.status === 'completed' ? engines.cropforge.phenology?.bucket : null;
  if (pcseStage && cropForgeStage && pcseStage in STAGE_ORDER && cropForgeStage in STAGE_ORDER) {
    const delta = Math.abs(STAGE_ORDER[pcseStage] - STAGE_ORDER[cropForgeStage]);
    if (delta > 0) {
      pushDivergence(
        divergences,
        'PHENOLOGY_STAGE_DIVERGENCE',
        delta >= 2 ? 'high' : 'watch',
        {
          pcse_bucket: pcseStage,
          cropforge_bucket: cropForgeStage,
          bucket_distance: delta,
          pcse_raw: engines.pcse.phenology?.raw_stage ?? null,
          cropforge_raw: engines.cropforge.phenology?.raw_stage ?? null,
        },
        'PCSE and CropForge disagree on coarse phenology stage. This is internal calibration evidence only.',
      );
    }
  }

  if (failed.length > 0) {
    pushDivergence(
      divergences,
      'ENGINE_EXECUTION_FAILURE',
      'watch',
      { engines: failed.map((item) => item.engine) },
      'At least one shadow engine failed to execute. This is an internal pipeline health issue, not an agronomic conclusion.',
    );
  }

  const severity = divergences.reduce(
    (current, item) => severityRank(item.severity) > severityRank(current) ? item.severity : current,
    'none',
  );

  const comparableScopes = {
    calendar_identity: completed.length >= 2,
    phenology: engines.pcse.status === 'completed' && engines.cropforge.status === 'completed',
    water_balance_cross_engine: false,
    crop_growth_cross_engine: false,
  };

  const commonAsOf = endDates.length ? [...endDates].sort()[0] : null;
  const seasonKey = plantingDates.length === 1
    ? `${crops.length === 1 ? crops[0] : 'crop'}:${plantingDates[0]}`
    : plantingDates.length > 0
      ? `mixed:${plantingDates.sort().join('|')}`
      : 'unknown';

  return {
    comparison_day: dateOnly(comparisonDay) ?? new Date().toISOString().slice(0, 10),
    season_key: seasonKey,
    comparison_as_of: commonAsOf,
    status,
    severity,
    production_authority: false,
    user_visible: false,
    engines,
    normalized: {
      completed_engines: completed.map((item) => item.engine),
      blocked_engines: blocked.map((item) => item.engine),
      failed_engines: failed.map((item) => item.engine),
      comparable_scopes: comparableScopes,
      scope_notes: {
        pcse: 'Phenology-only WOFOST baseline.',
        aquacrop: 'Water-balance evidence only; no phenology comparison is inferred.',
        cropforge: 'Observed-weather crop-growth shadow; soil-water and management physics disabled.',
      },
    },
    divergences,
  };
}
