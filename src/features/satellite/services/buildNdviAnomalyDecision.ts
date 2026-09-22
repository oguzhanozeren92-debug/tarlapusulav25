import type { HomeDecisionEvent } from '../../decision/types/homeDecision';
import type { NdviAnomalyResult } from '../types/ndviAnomaly';
import { isRecentSatelliteObservation } from './buildHomeSatelliteDecision';

export type HomeNdviAnomalySignal = NdviAnomalyResult & {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

/**
 * NDVI anomalisi bir teşhis değildir. Bu adaptör yalnızca motorun gerçek
 * gözlemlerden ürettiği negatif anomalinin sahada kontrol edilmesini ister.
 */
export function buildNdviAnomalyDecision(
  fieldId: string,
  signal: HomeNdviAnomalySignal | null | undefined,
  activeGrowth: boolean,
  now = new Date(),
  spatialArea?: { area?: unknown; geometry?: unknown; summary?: unknown } | null,
): HomeDecisionEvent | null {
  if (
    !fieldId || signal?.fieldId !== fieldId || signal.status !== 'ready' ||
    signal.quality !== 'usable' || !signal.anomaly || signal.direction !== 'negative' ||
    signal.observationCount < 5 || signal.spanDays == null || signal.spanDays < 20 ||
    !activeGrowth || !isRecentSatelliteObservation(signal.latestDate, now)
  ) return null;

  const score = Number.isFinite(signal.robustScore) ? Math.abs(signal.robustScore as number) : null;
  const deviation = Number.isFinite(signal.deviation) ? signal.deviation as number : null;
  const evidence = [
    `${signal.observationCount} gerçek NDVI gözlemi, ${signal.spanDays} günlük dönem.`,
    deviation != null ? `Son gözlem tarla baz medyanından ${Math.abs(deviation).toFixed(3)} NDVI daha düşük.` : '',
    score != null ? `Robust anomali skoru: ${score.toFixed(2)}.` : '',
  ].filter(Boolean);
  const period = signal.latestDate ?? now.toISOString().slice(0, 10);
  const spatialAreaName = String(spatialArea?.area ?? '').trim();
  const importantArea = spatialAreaName
    ? { ...spatialArea, area: spatialAreaName }
    : { area: 'Tarla geneli' };
  const direction = spatialAreaName || 'tarla-geneli';

  if (spatialAreaName) {
    evidence.push(
      `Aynı NDVI katmanının uzamsal analizinde ${spatialAreaName} bölümü öncelikli kontrol alanı olarak işaretlendi.`,
    );
  }

  return {
    id: `satellite:${fieldId}:ndvi-negative-anomaly:${period}`,
    group: 'satellite-anomaly',
    source: 'satellite',
    priority: 92,
    severity: 'warning',
    target: 'map_vegetation',
    channels: ['today', 'notification', 'pusula'],
    kind: 'check',
    label: 'UYDU UYARISI',
    title: 'NDVI Anomalisi Tespit Edildi',
    detail: spatialAreaName
      ? `Son uydu gözlemi tarlanın kendi yakın geçmişinden belirgin biçimde düşük. Aynı NDVI katmanının uzamsal analizi ${spatialAreaName} bölümünü öncelikli saha kontrol alanı olarak gösteriyor. Bu alanı kontrol et ve fotoğrafını çek; sinyal tek başına hastalık, su veya besin eksikliği teşhisi değildir.`
      : 'Son uydu gözlemi tarlanın kendi yakın geçmişinden belirgin biçimde düşük. Tarlayı kontrol et ve mümkünse sorun gördüğün alanın fotoğrafını çek. Fotoğraf saha kanıtı olarak uydu kaydıyla birlikte saklanır; bu sinyal tek başına hastalık, su veya besin eksikliği teşhisi değildir.',
    evidence,
    task: {
      taskKey: `ndvi-anomaly-photo:${period}`,
      actionTarget: 'field-photo',
      rewardPoints: 0,
      rewardRuleKey: null,
      metadata: {
        source: 'ndvi_anomaly',
        direction,
        importantArea,
        spatiallyFocused: Boolean(spatialAreaName),
        satelliteDate: signal.latestDate,
        latestNdvi: signal.latestAverage,
        baselineMedian: signal.baselineMedian,
        robustScore: signal.robustScore,
        observationCount: signal.observationCount,
        spanDays: signal.spanDays,
        requestPhoto: true,
        photoGuidance: 'Sorun gördüğün bölgeden yakın plan, bitkinin genel görünümü ve alan/toprak çevresi fotoğrafı çek.',
      },
    },
    today: { tone: 'amber', visual: 'spraying', iconKey: 'leaf-green', iconClass: 'leaf' },
    notification: { iconKey: 'leaf', iconTone: 'green', dotTone: 'warning' },
  };
}
