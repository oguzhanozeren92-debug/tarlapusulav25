import type { IrrigationDecisionResult } from '../types/irrigationDecision';

export type RainfedTodaySummary = {
  generalStatus: string;
  rows: Array<{ label: string; text: string }>;
  conclusion: string;
};

function amount(value: number): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function waterBalanceLine(deficit: number | null, use: number | null, rain: number | null, future: boolean): string | null {
  if (deficit === null || !Number.isFinite(deficit)) return null;
  const prefix = future ? 'Tahmini etkili yağış' : 'Etkili yağış';
  const suffix = future ? 'kalacak' : 'kaldı';
  if (deficit >= 0.5) {
    return `${prefix}, ürünün tahmini su ihtiyacından ${amount(deficit)} mm (m² başına yaklaşık ${amount(deficit)} litre) eksik ${suffix}.`;
  }
  if (use !== null && rain !== null && Number.isFinite(use) && Number.isFinite(rain) && rain - use >= 0.5) {
    return `${prefix}, ürünün tahmini su ihtiyacından ${amount(rain - use)} mm fazla ${future ? 'olacak' : 'kaldı'}.`;
  }
  return future
    ? 'Tahmine göre yağış ile ürünün su ihtiyacı birbirine yakın olacak.'
    : 'Etkili yağış ile ürünün tahmini su ihtiyacı birbirine yakın seyretti.';
}

export function buildRainfedTodaySummary(decision: IrrigationDecisionResult): RainfedTodaySummary | null {
  if (decision.decision !== 'rainfed_monitoring' || !decision.rainfedStress) return null;

  const stress = decision.rainfedStress;
  const risk = stress.riskLevel;
  const generalStatus = risk === 'normal'
    ? 'Bu tarla sulanmıyor; hesaplanan su stresi şimdilik düşük.'
    : risk === 'elevated'
      ? 'Bu tarla sulanmıyor; su stresi riski artıyor.'
      : risk === 'high'
        ? 'Bu tarla sulanmıyor; su stresi riski yüksek.'
        : 'Bu tarla sulanmıyor; su stresi riski için yeterli veri yok.';

  const rows: RainfedTodaySummary['rows'] = [];
  const past = waterBalanceLine(stress.past7DayClimateDeficitMm, stress.past7DayCropWaterUseMm, stress.past7DayEffectiveRainMm, false);
  const forecast = waterBalanceLine(stress.forecast5DayClimateDeficitMm, stress.forecast5DayCropWaterUseMm, stress.forecast5DayEffectiveRainMm, true);

  if (past) rows.push({ label: 'Geçen 7 gün', text: past });
  else if (stress.past7DayPrecipitationMm !== null) rows.push({ label: 'Geçen 7 gün', text: `Toplam ${amount(stress.past7DayPrecipitationMm)} mm yağış kaydedildi. Ürün ihtiyacını hesaplamak için veri eksik.` });

  if (forecast) rows.push({ label: 'Gelecek 5 gün', text: forecast });
  else if (stress.forecast5DayPrecipitationMm !== null) rows.push({ label: 'Gelecek 5 gün', text: `Toplam ${amount(stress.forecast5DayPrecipitationMm)} mm yağış bekleniyor. Ürün ihtiyacını hesaplamak için veri eksik.` });

  if (stress.nextMeaningfulRain) {
    rows.push({ label: 'Yağış beklentisi', text: `${stress.nextMeaningfulRain.date} tarihinde ${amount(stress.nextMeaningfulRain.precipitationMm)} mm yağış tahmini var.` });
  } else if (stress.forecast5DayPrecipitationMm !== null && stress.forecast5DayPrecipitationMm < 0.5) {
    rows.push({ label: 'Yağış beklentisi', text: 'Önümüzdeki 5 günde kayda değer yağmur görünmüyor.' });
  }

  const conclusion = risk === 'normal'
    ? 'Şimdilik belirgin su stresi beklenmiyor. Yağışı ve bitkinin görünümünü izlemeye devam et.'
    : risk === 'elevated'
      ? 'Tarlada solma belirtisi ve mümkünse toprak nemini kontrol et.'
      : risk === 'high'
        ? 'Tarlayı yakından kontrol et; bitkide su stresi belirtisi olabilir.'
        : 'Yağış bilgisi var, ancak ürünün su stresi güvenilir biçimde hesaplanamıyor.';

  return { generalStatus, rows, conclusion };
}
