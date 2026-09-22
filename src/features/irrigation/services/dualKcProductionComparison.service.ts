import { supabase } from '../../../supabaseClient';
import type { IrrigationDecisionResult } from '../types/irrigationDecision';
import { assessDualKcModelEvidence, productionForecastWindow } from './irrigationModelEvidence.service';
import type { DualKcShadowAudit } from './dualKcShadow.service';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Persists the production decision that existed when a completed shadow run was
 * compared. The record is immutable after first write and never grants
 * production authority to pyfao56.
 */
export async function persistDualKcProductionComparison(input: {
  decision: IrrigationDecisionResult;
  audit: DualKcShadowAudit;
}) {
  const { decision, audit } = input;
  if (!audit.runId || audit.status !== 'completed' || audit.comparison) return false;

  const window = productionForecastWindow(decision);
  const projected = decision.waterBalance?.projected5DayDeficitMm;
  if (!window || !finite(projected)) return false;

  const evidence = assessDualKcModelEvidence(decision, audit);
  if (evidence.agreement !== 'supportive' && evidence.agreement !== 'divergent') return false;

  const payload = {
    source: 'tarlapusula-production-irrigation-engine',
    production_authority: false,
    captured_at: new Date().toISOString(),
    generated_at: decision.generatedAt,
    projected_5_day_deficit_mm: projected,
    forecast_start_date: window.startDate,
    forecast_end_date: window.endDate,
    agreement: evidence.agreement,
    confidence: evidence.confidence,
    promotion_eligible_at_capture: evidence.promotionGate.eligible,
    shadow_completed_at: audit.completedAt,
    shadow_engine_version: audit.engineVersion,
  };

  const { data, error } = await supabase.rpc('save_dual_kc_production_comparison', {
    p_run_id: audit.runId,
    p_comparison: payload,
  });
  if (error) throw error;
  return data === true;
}
