import { supabase } from '../../../supabaseClient';
import { calculateIrrigationDecision } from '../../irrigation/services/irrigationDecision.service';
import { loadLatestDualKcShadowAudit } from '../../irrigation/services/dualKcShadow.service';
import { attachDualKcEvidence } from '../../irrigation/services/irrigationModelEvidence.service';
import { loadLatestAquaCropPilotAudit } from '../../irrigation/services/aquaCropPilotEvidence.service';
import { attachAquaCropPilotEvidence } from '../../irrigation/services/irrigationAquaCropEvidenceAttach.service';
import { resolveIrrigationSynthesis } from '../../irrigation/services/irrigationSynthesis.service';
import { buildSoilWaterContext } from '../../irrigation/services/soilWaterContext.service';
import { loadFieldSoilIntelligenceForPdf } from './pusulaPdfDecisionEvidence.service';
import { buildIrrigationWhatIf } from '../../irrigation/services/irrigationWhatIf.service';

const PDF_LAYER_ARCHIVE_NAMESPACE = 'pdf-layer-archive-v1';
const RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;

function dateOnly(value: unknown) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/**
 * PDF worker'a tek bir sulama sentezi bırakır. Bu kayıt production kararını
 * değiştirmez; fenoloji/Kc + pyfao56 + AquaCrop kanıtlarının hangi durumda
 * birlikte değerlendirildiğini rapor tarafında açıklanabilir hale getirir.
 */
export async function mirrorLatestIrrigationSynthesisForPdf(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return false;

  try {
    const production = await calculateIrrigationDecision({ id: fieldId });
    const [dualKcAudit, aquaCropAudit] = await Promise.all([
      loadLatestDualKcShadowAudit(fieldId).catch(() => null),
      loadLatestAquaCropPilotAudit(fieldId).catch(() => null),
    ]);

    const withDualKc = attachDualKcEvidence(production, dualKcAudit);
    const withAquaCrop = attachAquaCropPilotEvidence(withDualKc, aquaCropAudit);
    if (!withAquaCrop) return false;

    const synthesis = await resolveIrrigationSynthesis(withAquaCrop);
    const whatIf = buildIrrigationWhatIf(withAquaCrop);
    const soilBundle = await loadFieldSoilIntelligenceForPdf(fieldId).catch((error) => {
      console.warn('[PUSULAPDF] sulama sentezi için toprak bağlamı alınamadı:', error);
      return null;
    });
    const soilWaterContext = buildSoilWaterContext(
      withAquaCrop,
      soilBundle?.intelligence ?? null,
    );

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return false;

    const observedAt = dateOnly(synthesis.generatedAt) ?? new Date().toISOString().slice(0, 10);
    const layer = 'irrigation-synthesis';
    const sourceKey = [layer, observedAt, synthesis.agreement, withAquaCrop.decision].join(':');
    const cacheKey = [fieldId, sourceKey].join(':');
    const now = new Date();

    const payload = {
      schemaVersion: 1,
      fieldId,
      layer,
      source: 'TarlaPusula irrigation synthesis',
      observedAt,
      processingVersion: 'irrigation-synthesis-v1',
      metrics: {
        decision: withAquaCrop.decision,
        decisionConfidence: withAquaCrop.confidence,
        synthesisStatus: synthesis.status,
        synthesisAgreement: synthesis.agreement,
        synthesisConfidence: synthesis.confidence,
        currentKc: withAquaCrop.currentKc,
        currentDeficitMm: withAquaCrop.waterBalance.currentDeficitMm,
        projected5DayDeficitMm: withAquaCrop.waterBalance.projected5DayDeficitMm,
        stressThresholdMm: withAquaCrop.waterBalance.stressThresholdMm,
        daysToStressThreshold: withAquaCrop.waterBalance.daysToStressThreshold,
        netWaterMm: withAquaCrop.recommendation.netWaterMm,
        stage: synthesis.stage,
        stageLabel: synthesis.stageLabel,
        soilWaterStatus: soilWaterContext?.status ?? 'unavailable',
        soilContext: soilWaterContext?.soilContext ?? 'missing',
        estimatedHydraulicLimits: false,
        whatIfStatus: whatIf.status,
        whatIfHorizonDays: whatIf.horizonDays,
        whatIfAppliedNetWaterMm: whatIf.status === 'ready' ? whatIf.appliedNetWaterMm : null,
        whatIfIrrigateTodayDeficitMm: whatIf.status === 'ready'
          ? whatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.irrigateToday ?? null
          : null,
        whatIfWaitTwoDaysDeficitMm: whatIf.status === 'ready'
          ? whatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.waitTwoDays ?? null
          : null,
      },
      details: {
        productionAuthority: false,
        headline: synthesis.headline,
        summary: synthesis.summary,
        sources: synthesis.sources,
        missingSources: synthesis.missingSources,
        evidence: synthesis.evidence,
        warnings: synthesis.warnings,
        phenologyGeneratedAt: synthesis.phenologyGeneratedAt,
        generatedAt: synthesis.generatedAt,
        irrigationWhatIf: whatIf,
        soilWaterContext: soilWaterContext
          ? {
              status: soilWaterContext.status,
              sourceModel: soilWaterContext.sourceModel,
              productionAuthority: soilWaterContext.productionAuthority,
              soilContext: soilWaterContext.soilContext,
              evidence: soilWaterContext.evidence,
              warnings: soilWaterContext.warnings,
            }
          : null,
        soilIntelligenceSourceModel: soilBundle?.intelligence.sourceModel ?? null,
        note:
          'Bu kayıt fenoloji/Kc, pyfao56, AquaCrop ve varsa gerçek laboratuvar/SoilGrids bağlamını açıklar. SoilGrids sayısal sulama reçetesini değiştirmez; production sulama motoru karar otoritesidir.',
      },
      archivedAt: now.toISOString(),
    };

    const { error } = await supabase.from('field_map_layer_cache').upsert(
      {
        user_id: userId,
        field_id: fieldId,
        namespace: PDF_LAYER_ARCHIVE_NAMESPACE,
        cache_key: cacheKey,
        payload,
        data_date: observedAt,
        source_key: sourceKey,
        saved_at: now.toISOString(),
        expires_at: new Date(now.getTime() + RETENTION_MS).toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id,field_id,namespace,cache_key' },
    );

    if (error) {
      console.warn('[PUSULAPDF] sulama sentezi arşive yazılamadı:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[PUSULAPDF] sulama sentezi hazırlanamadı:', error);
    return false;
  }
}
