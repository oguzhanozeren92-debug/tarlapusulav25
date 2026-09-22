import type { WeatherForecastDay } from '../../../types';

export type SprayDayScreening = {
  status: 'rain' | 'wind' | 'check' | 'missing';
  title: string;
  reasons: string[];
};

function valueOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Günlük toplam ve maksimumlar yalnızca ön eleme yapabilir: uygun bir saat kanıtlamaz.
export function screenSprayWeather(day: WeatherForecastDay): SprayDayScreening {
  const rain = valueOrNull(day.precipitation);
  const rainChance = valueOrNull(day.precipitationProbability);
  const wind = valueOrNull(day.windSpeed);
  const reasons: string[] = [];

  if (rain !== null && rain >= 1) reasons.push(`Günlük yağış tahmini ${rain.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mm.`);
  if (rainChance !== null && rainChance >= 45) reasons.push(`En yüksek yağış olasılığı %${Math.round(rainChance)}.`);
  if (wind !== null && wind >= 20) reasons.push(`Gün içindeki en yüksek rüzgâr ${Math.round(wind)} km/sa.`);

  if (reasons.length > 0) {
    const rainConcern = (rain !== null && rain >= 1) || (rainChance !== null && rainChance >= 45);
    return {
      status: rainConcern ? 'rain' : 'wind',
      title: rainConcern ? 'Yağışa dikkat' : 'Rüzgâra dikkat',
      reasons,
    };
  }

  if (rain === null || rainChance === null || wind === null) {
    return {
      status: 'missing',
      title: 'Veri eksik',
      reasons: ['Yağış ve rüzgâr verileri tamamlanınca kontrol et.'],
    };
  }

  return {
    status: 'check',
    title: 'Yağış ve rüzgâr sakin',
    reasons: [
      `Günlük yağış ${rain.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mm; en yüksek yağış olasılığı %${Math.round(rainChance)}.`,
      `Gün içindeki en yüksek rüzgâr ${Math.round(wind)} km/sa.`,
    ],
  };
}
