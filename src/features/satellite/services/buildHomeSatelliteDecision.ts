import type { HomeDecisionEvent } from '../../decision/types/homeDecision';

export type HomeSatelliteTrendSignal = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  quality: 'usable' | 'insufficient';
  direction: 'rising' | 'stable' | 'falling' | 'unknown';
  observationCount: number;
  spanDays: number | null;
  latestDate: string | null;
};

export function isRecentSatelliteObservation(latestDate: string | null | undefined, now: Date = new Date()) {
  const latestMs = latestDate ? Date.parse(latestDate) : NaN;
  return Number.isFinite(latestMs) &&
    latestMs <= now.getTime() + 86_400_000 &&
    now.getTime() - latestMs <= 30 * 86_400_000;
}

/** NDVI tek başına hastalık veya besin eksikliği teşhisi değildir. */
export function buildHomeSatelliteDecision(
  fieldId: string,
  trend: HomeSatelliteTrendSignal | null | undefined,
  activeGrowth: boolean,
  now: Date = new Date(),
): HomeDecisionEvent | null {
  if (
    !fieldId || trend?.fieldId !== fieldId || trend.status !== 'ready' ||
    trend.quality !== 'usable' || trend.direction !== 'falling' ||
    trend.observationCount < 3 || trend.spanDays == null || trend.spanDays < 12 ||
    !activeGrowth || !isRecentSatelliteObservation(trend.latestDate, now)
  ) return null;

  return {
    id: `satellite:${fieldId}:ndvi-falling`,
    group: 'satellite-trend',
    source: 'satellite',
    priority: 78,
    severity: 'warning',
    target: 'map_vegetation',
    channels: ['today', 'notification', 'pusula'],
    label: 'UYDU TAKİBİ',
    title: 'NDVI Eğilimini Kontrol Et',
    detail: 'Bitki örtüsü sinyali azalıyor; haritadaki alanları sahada karşılaştır.',
    evidence: [
      `Son ${trend.spanDays} günde ${trend.observationCount} uydu gözlemi karşılaştırıldı.`,
      `Son gözlem: ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(trend.latestDate!))}.`,
      'Ürün aktif gelişim döneminde.',
    ],
    today: { tone: 'amber', visual: 'spraying', iconKey: 'leaf-green', iconClass: 'leaf' },
    notification: { iconKey: 'leaf', iconTone: 'green', dotTone: 'warning' },
  };
}
