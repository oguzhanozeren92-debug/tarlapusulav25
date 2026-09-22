import type { IrrigationDecisionResult } from '../types/irrigationDecision';
import {
  toAquaCropPilotEvidence,
  type AquaCropPilotAudit,
} from './aquaCropPilotEvidence.service';

/**
 * Adds AquaCrop as season-scale scientific evidence only.
 * It never changes the production decision code, water prescription or
 * confidence because the pilot horizon is not the same as Today's 5-day
 * irrigation horizon.
 */
export function attachAquaCropPilotEvidence(
  decision: IrrigationDecisionResult | null | undefined,
  audit: AquaCropPilotAudit | null | undefined,
): IrrigationDecisionResult | null {
  if (!decision) return null;

  const seasonModelEvidence = toAquaCropPilotEvidence(audit);
  if (seasonModelEvidence.productionAuthority !== false) {
    return decision;
  }
  const evidence = seasonModelEvidence.status === 'ready' &&
    seasonModelEvidence.sourceModel === 'aquacrop-pilot' &&
    seasonModelEvidence.productionAuthority === false &&
    seasonModelEvidence.missingInputs.length === 0
    ? seasonModelEvidence.evidence.map((item) => `Sezon kanıtı · ${item}`)
    : [];

  const productionReasons = [...(decision.reasons ?? [])];
  const remainingSlots = Math.max(0, 10 - productionReasons.length);
  return {
    ...decision,
    reasons: [...productionReasons, ...evidence.slice(0, remainingSlots)],
    confidence: decision.confidence,
    decision: decision.decision,
    recommendation: decision.recommendation,
    waterBalance: decision.waterBalance,
    forecast: decision.forecast,
    display: decision.display,
    warnings: decision.warnings,
    missing: decision.missing,
    generatedAt: decision.generatedAt,
    modelEvidence: decision.modelEvidence,
    synthesis: decision.synthesis,
    seasonModelEvidence,
  };
}
