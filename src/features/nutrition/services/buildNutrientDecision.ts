import type { SoilAnalysisRecord } from '../../../lib/soilAnalysisService';
import type { HomeDecisionEvent } from '../../decision/types/homeDecision';
import type { SoilIntelligenceResult } from './soilIntelligence.service';

export type HomeNutrientSignal = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  latestAnalysis: SoilAnalysisRecord | null;
  soilIntelligence?: SoilIntelligenceResult | null;
};

/**
 * Laboratuvar raporu besin/gübreleme kararının ölçüm dayanağıdır. SoilGrids
 * yalnız model tahmini arka planı olarak kanıt listesine eklenir.
 */
export function buildNutrientDecision(
  fieldId: string,
  crop: string | null | undefined,
  signal: HomeNutrientSignal | null | undefined,
  recentFertilization: boolean,
): HomeDecisionEvent | null {
  if (!fieldId || !crop?.trim() || signal?.fieldId !== fieldId || signal.status !== 'ready') return null;

  const analysis = signal.latestAnalysis;
  const intelligence = signal.soilIntelligence ?? null;
  const intelligenceEvidence = intelligence?.evidence?.slice(0, 4) ?? [];

  if (!analysis) {
    const hasSoilGridsContext = intelligence?.status === 'context-only';
    return {
      id: `nutrition:${fieldId}:missing-analysis`,
      group: 'nutrition',
      source: 'nutrition',
      sourceModel: intelligence?.sourceModel ?? 'soil-intelligence',
      confidence: 'preliminary',
      kind: 'data',
      missingInfoKind: 'soil-analysis',
      priority: 39,
      severity: 'info',
      target: 'soil',
      channels: ['notification'],
      label: 'TOPRAK ANALİZİ',
      title: 'Toprak Analizini Ekle',
      detail: hasSoilGridsContext
        ? 'SoilGrids arka plan tahmini hazır; gübreleme kararını gerçek laboratuvar ölçümüyle tamamla.'
        : 'Gübreleme kararını bu tarlanın laboratuvar analiziyle destekle.',
      evidence: hasSoilGridsContext
        ? [
            ...intelligenceEvidence,
            'SoilGrids model tahminidir; laboratuvar analizi yerine geçmez.',
          ]
        : undefined,
      task: {
        taskKey: 'notification:soil-analysis',
        actionTarget: 'soil-analysis',
        rewardPoints: 150,
        rewardRuleKey: null,
        metadata: {
          pointRuleKey: 'ADD_SOIL_ANALYSIS',
          pointMode: 'existing-action',
          soilGridsContextAvailable: hasSoilGridsContext,
        },
      },
      notification: { iconKey: 'document', iconTone: 'green', dotTone: 'info' },
    };
  }

  if (String(analysis.field_id) !== fieldId) return null;

  const reportCrop = String(analysis.crop ?? '').trim().toLocaleLowerCase('tr-TR');
  if (reportCrop && reportCrop !== crop.trim().toLocaleLowerCase('tr-TR')) {
    return {
      id: `nutrition:${fieldId}:${analysis.id}:crop-changed`,
      group: 'nutrition',
      source: 'nutrition',
      sourceModel: intelligence?.sourceModel ?? 'soil-intelligence:lab',
      confidence: 'medium',
      kind: 'check',
      priority: 44,
      severity: 'info',
      target: 'soil',
      channels: ['notification'],
      label: 'TOPRAK ANALİZİ',
      title: 'Analiz Yorumunu Güncelle',
      detail: 'Son analiz önceki ürünün için yorumlanmış; yeni ürüne göre yeniden değerlendir.',
      evidence: intelligenceEvidence.length ? intelligenceEvidence : undefined,
      notification: { iconKey: 'document', iconTone: 'green', dotTone: 'info' },
    };
  }

  if (!['check', 'alert'].includes(analysis.status ?? '')) {
    return null;
  }

  return {
    id: `nutrition:${fieldId}:${analysis.id}:report-review`,
    group: 'nutrition',
    source: 'nutrition',
    sourceModel: intelligence?.sourceModel ?? 'soil-intelligence:lab',
    confidence: 'medium',
    kind: 'check',
    priority: analysis.status === 'alert' ? 76 : 62,
    severity: 'warning',
    target: 'soil',
    channels: ['today', 'notification', 'pusula'],
    label: 'TOPRAK ANALİZİ',
    title: 'Analiz Raporunu İncele',
    detail: recentFertilization
      ? 'Rapordaki uyarıyı son gübreleme kaydınla birlikte değerlendir.'
      : 'Raporda incelenmesi gereken bulgular var; uygulamadan önce kontrol et.',
    evidence: [
      'Bu tarlaya ait laboratuvar raporu mevcut ve ölçüm dayanağı olarak önceliklidir.',
      `Rapor durumu: ${analysis.status === 'alert' ? 'uyarı' : 'kontrol'}.`,
      ...(recentFertilization ? ['Son gübreleme kaydı da mevcut.'] : []),
      ...intelligenceEvidence.filter((item) => !item.startsWith('Bu tarlaya ait laboratuvar')),
    ].slice(0, 6),
    today: { tone: 'amber', visual: 'spraying', iconKey: 'document', iconClass: 'leaf' },
    notification: { iconKey: 'document', iconTone: 'gold', dotTone: 'warning' },
  };
}
