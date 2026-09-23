const REQUIRED_CLEAN_PHENOLOGY_DAYS = 3;
const REQUIRED_AQUACROP_EVIDENCE_DAYS = 3;

const AGRONOMIC_DIVERGENCE_CODES = new Set([
  'PHENOLOGY_STAGE_DIVERGENCE',
  'PLANTING_DATE_MISMATCH',
  'CROP_IDENTITY_MISMATCH',
  'SIMULATION_HORIZON_DRIFT',
]);

function text(value) {
  return String(value ?? '').trim();
}

function dateOnly(value) {
  const raw = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`))
    ? raw
    : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function isPhenologyComparable(row) {
  return row?.normalized?.comparable_scopes?.phenology === true &&
    row?.engines?.pcse?.status === 'completed' &&
    row?.engines?.cropforge?.status === 'completed';
}

function agronomicDivergences(row) {
  return array(row?.divergences).filter((item) =>
    AGRONOMIC_DIVERGENCE_CODES.has(text(item?.code)),
  );
}

function divergenceSeverity(items) {
  if (items.some((item) => item?.severity === 'high')) return 'high';
  if (items.some((item) => item?.severity === 'watch')) return 'watch';
  return 'none';
}

function uniqueDays(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const day = dateOnly(row?.comparison_day);
    if (!day) continue;
    // Prefer the last occurrence supplied for an accidental duplicate day.
    byDay.set(day, row);
  }
  return [...byDay.entries()]
    .map(([day, row]) => ({ ...row, comparison_day: day }))
    .sort((a, b) => String(b.comparison_day).localeCompare(String(a.comparison_day)));
}

export function buildCalibrationState({ seasonKey, rows }) {
  const season = text(seasonKey) || 'unknown';
  const ordered = uniqueDays(array(rows));
  const invalidSeason = season === 'unknown' || season.startsWith('mixed:');

  let phenologyComparableDays = 0;
  let phenologyWatchDays = 0;
  let phenologyHighDays = 0;
  let aquacropCompletedDays = 0;
  let lastDivergenceDay = null;

  for (const row of ordered) {
    if (row?.engines?.aquacrop?.status === 'completed') aquacropCompletedDays += 1;
    if (!isPhenologyComparable(row)) continue;

    phenologyComparableDays += 1;
    const severity = divergenceSeverity(agronomicDivergences(row));
    if (severity === 'high') phenologyHighDays += 1;
    else if (severity === 'watch') phenologyWatchDays += 1;

    if (severity !== 'none' && !lastDivergenceDay) {
      lastDivergenceDay = row.comparison_day;
    }
  }

  let phenologyCleanStreak = 0;
  for (const row of ordered) {
    // Follow the same conservative rule as the existing pyfao56 validation gate:
    // a non-comparable day or real agronomic divergence breaks the latest streak.
    if (!isPhenologyComparable(row)) break;
    if (agronomicDivergences(row).length > 0) break;
    phenologyCleanStreak += 1;
  }

  const latest = ordered[0] ?? null;
  const latestComparable = latest ? isPhenologyComparable(latest) : false;
  const latestAgronomicDivergences = latest ? agronomicDivergences(latest) : [];
  const latestSeverity = divergenceSeverity(latestAgronomicDivergences);

  let status = 'insufficient_evidence';
  if (invalidSeason) {
    status = 'blocked';
  } else if (!latest) {
    status = 'insufficient_evidence';
  } else if (latestComparable && latestAgronomicDivergences.length > 0) {
    status = 'divergent';
  } else if (phenologyCleanStreak >= REQUIRED_CLEAN_PHENOLOGY_DAYS) {
    status = 'consistent';
  } else if (phenologyComparableDays > 0) {
    status = 'observing';
  } else if (latest?.status === 'blocked' || latest?.status === 'failed') {
    status = 'blocked';
  }

  const waterEvidenceState = aquacropCompletedDays >= REQUIRED_AQUACROP_EVIDENCE_DAYS
    ? 'covered'
    : aquacropCompletedDays > 0
      ? 'observing'
      : 'none';

  const reviewEligible =
    !invalidSeason &&
    status === 'consistent' &&
    phenologyCleanStreak >= REQUIRED_CLEAN_PHENOLOGY_DAYS;

  return {
    season_key: season,
    status,
    review_eligible: reviewEligible,
    required_clean_phenology_days: REQUIRED_CLEAN_PHENOLOGY_DAYS,
    phenology_comparable_days: phenologyComparableDays,
    phenology_clean_streak: phenologyCleanStreak,
    phenology_watch_days: phenologyWatchDays,
    phenology_high_days: phenologyHighDays,
    aquacrop_completed_days: aquacropCompletedDays,
    required_aquacrop_evidence_days: REQUIRED_AQUACROP_EVIDENCE_DAYS,
    water_evidence_state: waterEvidenceState,
    latest_comparison_day: latest?.comparison_day ?? null,
    latest_comparison_status: text(latest?.status) || null,
    latest_phenology_comparable: latestComparable,
    latest_agronomic_severity: latestSeverity,
    last_divergence_day: lastDivergenceDay,
    distinct_days: ordered.length,
    production_authority: false,
    user_visible: false,
    evidence: {
      internal_only: true,
      same_day_repeats_count_once: true,
      divergence_breaks_clean_streak: true,
      non_comparable_day_breaks_clean_streak: true,
      aquacrop_scope: 'water_balance_evidence_only',
      phenology_scope: 'pcse_vs_cropforge_coarse_stage_only',
    },
  };
}
