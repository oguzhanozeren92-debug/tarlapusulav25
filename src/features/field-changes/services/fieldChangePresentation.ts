import type { HomeDecisionEvent } from '../../decision/types/homeDecision';

export function buildFieldChangePresentation(events: HomeDecisionEvent[], fieldId: string, latestDate: string | null) {
  const event = events.find((item) => item.source === 'satellite' && item.group === 'satellite-trend');
  if (!event || !fieldId || !latestDate || !event.id.startsWith(`satellite:${fieldId}:`)) return null;
  return {
    key: JSON.stringify([fieldId, event.id, latestDate]),
    summary: 'Son uydu gözlemlerinde bitki gelişimi sinyali azalıyor. Birlikte bakalım mı?',
    evidence: event.evidence ?? [],
    detail: 'Bu değişiklik tek başına hastalık veya susuzluk anlamına gelmez. Haritadaki alanları gezip bitkinin durumunu kontrol et; sonraki kontrolde karşılaştırmak için fotoğraf çek.',
  };
}
