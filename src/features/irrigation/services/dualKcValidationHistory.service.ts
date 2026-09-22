import type { DualKcShadowAudit } from './dualKcShadow.service';

export type DualKcValidationHistory = {
  eligible: boolean;
  consecutiveSupportiveRuns: number;
  requiredSupportiveRuns: 3;
  distinctDays: number;
  hasVerifiedSoilWaterEvidence: boolean;
  reason: string;
  productionAuthority: false;
};

type ValidationRun = {
  audit: DualKcShadowAudit;
  agreement: 'supportive' | 'divergent' | 'not_comparable' | 'unavailable';
  promotionEligible: boolean;
};

function day(value: string | null | undefined) {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

/**
 * Promotion history is deliberately conservative:
 * - one matching shadow run is never enough;
 * - runs must come from three distinct completed days;
 * - any divergence/non-comparable run breaks the consecutive chain;
 * - at least one verified field-water measurement must exist.
 *
 * This does NOT grant production authority. It only marks the model as
 * eligible for a future, separately reviewed promotion step.
 */
export function assessDualKcValidationHistory(input: {
  runs: ValidationRun[];
  verifiedSoilWaterMeasurementCount: number;
}): DualKcValidationHistory {
  const ordered = [...input.runs]
    .filter((item) => item.audit.status === 'completed' && day(item.audit.completedAt))
    .sort((a, b) => String(b.audit.completedAt).localeCompare(String(a.audit.completedAt)));

  const seenDays = new Set<string>();
  let consecutiveSupportiveRuns = 0;

  for (const item of ordered) {
    const completedDay = day(item.audit.completedAt);
    if (!completedDay || seenDays.has(completedDay)) continue;
    seenDays.add(completedDay);

    if (item.agreement !== 'supportive' || !item.promotionEligible) break;
    consecutiveSupportiveRuns += 1;
  }

  const hasVerifiedSoilWaterEvidence =
    Number.isFinite(input.verifiedSoilWaterMeasurementCount) &&
    input.verifiedSoilWaterMeasurementCount > 0;

  const eligible =
    consecutiveSupportiveRuns >= 3 &&
    hasVerifiedSoilWaterEvidence;

  const reason = eligible
    ? 'Üç ayrı günde ardışık supportive doğrulama ve doğrulanmış saha toprak suyu kanıtı mevcut. Yine de production otoritesi otomatik verilmez.'
    : !hasVerifiedSoilWaterEvidence
      ? 'Doğrulanmış saha toprak suyu ölçümü yok; model promotion geçmişi kilitli.'
      : consecutiveSupportiveRuns < 3
        ? `En az 3 ayrı günde ardışık supportive doğrulama gerekli; mevcut: ${consecutiveSupportiveRuns}.`
        : 'Promotion geçmişi henüz yeterli değil.';

  return {
    eligible,
    consecutiveSupportiveRuns,
    requiredSupportiveRuns: 3,
    distinctDays: seenDays.size,
    hasVerifiedSoilWaterEvidence,
    reason,
    productionAuthority: false,
  };
}
