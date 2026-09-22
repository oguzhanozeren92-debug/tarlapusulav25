import type { IrrigationDecisionResult } from '../types/irrigationDecision';

export type IrrigationWhatIfMetric = {
  key: 'deficit_after_2d' | 'stress_margin_after_2d';
  label: string;
  unit: 'mm';
  irrigateToday: number;
  waitTwoDays: number;
  source: 'production-irrigation-engine';
  observedAt: string;
};

export type IrrigationWhatIfResult =
  | {
      status: 'ready';
      fieldId: string;
      generatedAt: string;
      horizonDays: 2;
      appliedNetWaterMm: number;
      metrics: IrrigationWhatIfMetric[];
      assumptions: string[];
      source: 'production-irrigation-engine';
      productionAuthority: false;
    }
  | {
      status: 'blocked';
      fieldId: string;
      generatedAt: string;
      horizonDays: 2;
      missing: string[];
      source: 'production-irrigation-engine';
      productionAuthority: false;
    };

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

/**
 * "Bugün sularsam / 2 gün beklersem" karşılaştırması.
 *
 * Yeni hava, ET, Kc veya toprak metriği üretmez. Yalnız production sulama
 * motorunun aynı tarla için oluşturduğu mevcut su açığı, gerçek önerilen NET
 * sulama miktarı ve ilk iki günlük forecast çıktısını kullanır.
 *
 * Production motoru bugün sulama miktarı üretmemişse senaryo hesaplanmaz.
 */
export function buildIrrigationWhatIf(
  decision: IrrigationDecisionResult,
): IrrigationWhatIfResult {
  const fieldId = String(decision.fieldId ?? '').trim();
  const generatedAt = String(decision.generatedAt ?? '').trim();
  const currentDeficit = decision.waterBalance.currentDeficitMm;
  const stressThreshold = decision.waterBalance.stressThresholdMm;
  const netWater = decision.recommendation.netWaterMm;
  const day2 = decision.forecast?.[1];

  const missing: string[] = [];

  if (!fieldId) missing.push('field_id');
  if (!generatedAt || !Number.isFinite(Date.parse(generatedAt))) {
    missing.push('generated_at');
  }
  if (!finite(currentDeficit)) missing.push('current_deficit');
  if (!finite(stressThreshold)) missing.push('stress_threshold');
  if (!finite(netWater) || netWater <= 0) missing.push('recommended_net_water');
  if (!day2 || !finite(day2.estimatedDeficitMm)) {
    missing.push('two_day_forecast');
  }

  if (missing.length > 0) {
    return {
      status: 'blocked',
      fieldId,
      generatedAt,
      horizonDays: 2,
      missing,
      source: 'production-irrigation-engine',
      productionAuthority: false,
    };
  }

  // Forecast'taki 2. gün açığı, mevcut açığa göre production motorunun
  // iki günlük net ETc/etkili-yağış etkisini zaten içerir.
  const twoDayClimateDelta = day2!.estimatedDeficitMm - currentDeficit!;
  const irrigateTodayDeficit = Math.max(
    0,
    currentDeficit! - netWater! + twoDayClimateDelta,
  );
  const waitTwoDaysDeficit = day2!.estimatedDeficitMm;

  const observedAt = generatedAt;

  return {
    status: 'ready',
    fieldId,
    generatedAt,
    horizonDays: 2,
    appliedNetWaterMm: round2(netWater!),
    metrics: [
      {
        key: 'deficit_after_2d',
        label: '2 gün sonraki kök bölgesi su açığı',
        unit: 'mm',
        irrigateToday: round2(irrigateTodayDeficit),
        waitTwoDays: round2(waitTwoDaysDeficit),
        source: 'production-irrigation-engine',
        observedAt,
      },
      {
        key: 'stress_margin_after_2d',
        label: '2 gün sonraki stres eşiği marjı',
        unit: 'mm',
        irrigateToday: round2(stressThreshold! - irrigateTodayDeficit),
        waitTwoDays: round2(stressThreshold! - waitTwoDaysDeficit),
        source: 'production-irrigation-engine',
        observedAt,
      },
    ],
    assumptions: [
      'Bugün uygulanacak su, production sulama motorunun gerçek NET su önerisidir.',
      'İki günlük hava/ETc/etkili yağış etkisi production motorunun mevcut forecast çıktısından alınır.',
      'Bu karşılaştırma yeni ölçüm veya uydurma meteorolojik değer üretmez.',
    ],
    source: 'production-irrigation-engine',
    productionAuthority: false,
  };
}
