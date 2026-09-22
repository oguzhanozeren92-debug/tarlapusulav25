import type { SoilIntelligenceResult } from '../../nutrition/services/soilIntelligence.service';
import type { IrrigationDecisionResult } from '../types/irrigationDecision';

export type SoilWaterContext = {
  status: 'ready' | 'partial' | 'unavailable';
  sourceModel: string;
  productionAuthority: false;
  soilContext: 'lab-backed' | 'model-context' | 'missing';
  evidence: string[];
  warnings: string[];
};

function compactUnique(values: Array<string | null | undefined>, limit = 8) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
    .slice(0, limit);
}

/**
 * Toprak ve su kaynaklarını ortak bir açıklama bağlamında toplar.
 *
 * Bu servis yeni bir sulama eşiği, tarla kapasitesi veya solma noktası türetmez.
 * Sayısal sulama otoritesi production irrigation engine'de kalır. SoilGrids
 * yalnız mekânsal/model bağlamıdır; laboratuvar analizi ise varsa ölçüm
 * otoritesidir.
 */
export function buildSoilWaterContext(
  decision: IrrigationDecisionResult | null | undefined,
  soil: SoilIntelligenceResult | null | undefined,
): SoilWaterContext | null {
  if (!decision) return null;

  const productionReady = decision.decision !== 'needs_data';
  const labBacked = soil?.status === 'lab-backed';
  const soilModelReady = soil?.status === 'context-only' || labBacked;
  const soilContext: SoilWaterContext['soilContext'] = labBacked
    ? 'lab-backed'
    : soilModelReady
      ? 'model-context'
      : 'missing';

  const soilEvidence = soilModelReady
    ? (soil?.evidence ?? [])
        .filter((item) => /soilgrids|toprak analiz|tekstür|pH|organik karbon/i.test(item))
        .slice(0, 4)
    : [];

  const waterEvidence = compactUnique([
    decision.synthesis?.summary
      ? `Sulama sentezi: ${decision.synthesis.summary}`
      : null,
    decision.waterBalance?.baselineAssumption === 'last_irrigation_refilled_root_zone'
      ? 'Kök bölgesi su açığı son kayıtlı tam sulamanın kök bölgesini doldurduğu varsayımıyla hesaplanıyor.'
      : null,
    decision.irrigationStatus === 'rainfed' && decision.rainfedStress
      ? 'Susuz tarla su baskısı göstergesi iklim su dengesidir; doğrudan toprak nemi ölçümü değildir.'
      : null,
    ...soilEvidence,
  ]);

  const status: SoilWaterContext['status'] =
    productionReady && soilModelReady
      ? 'ready'
      : productionReady || soilModelReady
        ? 'partial'
        : 'unavailable';

  return {
    status,
    sourceModel: soilModelReady
      ? `soil-water-context:${soil?.sourceModel ?? 'soil-context'}`
      : 'soil-water-context',
    productionAuthority: false,
    soilContext,
    evidence: waterEvidence,
    warnings: compactUnique([
      ...(soil?.warnings ?? []).slice(0, 2),
      soilModelReady
        ? 'Toprak bağlamı sulama motorunun sayısal su reçetesini değiştirmez.'
        : null,
    ], 3),
  };
}
