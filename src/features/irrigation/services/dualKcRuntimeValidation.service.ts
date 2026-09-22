import type { IrrigationDecisionResult } from '../types/irrigationDecision';
import { assessDualKcValidationHistory, type DualKcValidationHistory } from './dualKcValidationHistory.service';
import { loadDualKcShadowAuditHistory } from './dualKcShadow.service';
import { assessDualKcModelEvidence } from './irrigationModelEvidence.service';
import { listSoilWaterMeasurements } from './soilWaterMeasurement.service';

/**
 * Historical days are accepted only when the production decision was captured
 * with that exact shadow run. Legacy rows without a persisted comparison remain
 * excluded rather than being reinterpreted against today's decision.
 */
export async function loadDualKcRuntimeValidation(input: {
  fieldId: string;
  decision: IrrigationDecisionResult | null | undefined;
}): Promise<DualKcValidationHistory> {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId || !input.decision) {
    return assessDualKcValidationHistory({ runs: [], verifiedSoilWaterMeasurementCount: 0 });
  }

  const [audits, measurements] = await Promise.all([
    loadDualKcShadowAuditHistory(fieldId, 30),
    listSoilWaterMeasurements(fieldId, 100),
  ]);

  const currentAudit = audits[0] ?? null;
  const currentEvidence = assessDualKcModelEvidence(input.decision, currentAudit);

  const runs = audits.flatMap((audit, index) => {
    if (audit.status !== 'completed') return [];

    // The newest run may not have been persisted yet during the first render;
    // it is safe to assess only that run against the current decision.
    if (index === 0 && !audit.comparison) {
      return [{
        audit,
        agreement: currentEvidence.agreement,
        promotionEligible: currentEvidence.promotionGate.eligible,
      }];
    }

    const snapshot = audit.comparison;
    if (!snapshot) return [];
    return [{
      audit,
      agreement: snapshot.agreement,
      promotionEligible:
        snapshot.promotionEligibleAtCapture &&
        snapshot.confidence === 'high' &&
        snapshot.productionAuthority === false,
    }];
  });

  return assessDualKcValidationHistory({
    runs,
    verifiedSoilWaterMeasurementCount: measurements.length,
  });
}
