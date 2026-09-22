import type { IrrigationDecisionResult } from '../types/irrigationDecision';
import type {
  DigitalTwinMetric,
  DigitalTwinScenario,
} from '../../../services/digitalTwinScenarioService';

export type DigitalTwinIrrigationScenarioInput = {
  id: string;
  name: string;
  decision: IrrigationDecisionResult;
};

function metric(
  key: string,
  label: string,
  value: number | null,
  unit: string,
  generatedAt: string,
): DigitalTwinMetric {
  return {
    key,
    label,
    value,
    unit,
    status:
      value !== null && Number.isFinite(value)
        ? 'available'
        : 'missing',
    source: 'production-irrigation-engine',
    observedAt: generatedAt,
  };
}

/**
 * Production sulama motorunun gerçek çıktısını Digital Twin'in ortak senaryo
 * sözleşmesine taşır. Burada yeni bir agronomik hesap yapılmaz; eksik değerler
 * tahmin/fallback ile doldurulmaz.
 */
export function buildDigitalTwinIrrigationScenario(
  input: DigitalTwinIrrigationScenarioInput,
): DigitalTwinScenario {
  const { decision } = input;

  return {
    id: input.id,
    name: input.name,
    kind: 'irrigation',
    context: {
      fieldId: decision.fieldId,
      generatedAt: decision.generatedAt,
      source: 'production-irrigation-engine',
    },
    metrics: [
      metric(
        'current_deficit',
        'Mevcut kök bölgesi su açığı',
        decision.waterBalance.currentDeficitMm,
        'mm',
        decision.generatedAt,
      ),
      metric(
        'projected_5d_deficit',
        '5 günlük tahmini su açığı',
        decision.waterBalance.projected5DayDeficitMm,
        'mm',
        decision.generatedAt,
      ),
      metric(
        'stress_threshold',
        'Stres eşiği',
        decision.waterBalance.stressThresholdMm,
        'mm',
        decision.generatedAt,
      ),
      metric(
        'recommended_net_water',
        'Önerilen net su',
        decision.recommendation.netWaterMm,
        'mm',
        decision.generatedAt,
      ),
      metric(
        'recommended_total_net_water',
        'Önerilen toplam net su',
        decision.recommendation.totalNetWaterM3,
        'm3',
        decision.generatedAt,
      ),
    ],
  };
}
