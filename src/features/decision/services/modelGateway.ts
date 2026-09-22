import type {
  HomeDecisionConfidence,
  HomeDecisionEvent,
  HomeDecisionSource,
} from '../types/homeDecision';
import type {
  HarmonizedHomeDecisionEvent,
  ModelGatewayEnvelope,
  ModelSignalStatus,
} from '../types/modelGateway';

const SOURCE_MODELS: Record<HomeDecisionSource, string> = {
  field: 'field-context',
  weather: 'weather-decision',
  calendar: 'calendar',
  satellite: 'satellite-decision',
  pusula: 'field-synthesis',
  'risk-radar': 'risk-radar',
  irrigation: 'irrigation-decision',
  phenology: 'phenology',
  operation: 'field-operations',
  nutrition: 'soil-nutrition',
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function uniqueEvidence(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((item) => text(item))
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

function resolveStatus(event: HomeDecisionEvent): ModelSignalStatus {
  if (event.kind === 'data') return 'needs-data';

  const haystack = `${event.id} ${event.group} ${event.title} ${event.detail}`
    .toLocaleLowerCase('tr-TR');

  if (
    haystack.includes(':error:') ||
    /veri.+hata|yüklenemedi|alınamadı|olmadan.+karar verme/.test(haystack)
  ) {
    return 'error';
  }

  if (
    /bilgi eksik|veri eksik|tamamla|kayıt gerekiyor|needs-data|missing-/.test(haystack)
  ) {
    return 'needs-data';
  }

  if (
    haystack.includes(':loading:') ||
    /hazırlanıyor|hesaplanıyor|veri bekleniyor|henüz karar üretmedi/.test(haystack)
  ) {
    return 'partial';
  }

  return 'ready';
}

function resolveConfidence(
  status: ModelSignalStatus,
  evidence: string[],
  explicit?: HomeDecisionConfidence,
): HomeDecisionConfidence {
  if (status !== 'ready') return 'preliminary';
  if (explicit) return explicit;
  if (evidence.length >= 2) return 'strong';
  if (evidence.length === 1) return 'medium';
  return 'preliminary';
}

function parseObservedAt(event: HomeDecisionEvent): string | null {
  // Yalnız olay kimliğinde açık bir ISO tarih varsa kullanılır.
  // Kaynak tarihi bilinmiyorsa tahmin edilmez.
  const match = event.id.match(/(?:^|:)(\d{4}-\d{2}-\d{2})(?:$|:)/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function ageHours(observedAt: string | null, evaluatedAt: string) {
  if (!observedAt) return null;
  const observed = Date.parse(observedAt);
  const evaluated = Date.parse(evaluatedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(evaluated)) return null;
  return Math.max(0, Number(((evaluated - observed) / 3_600_000).toFixed(1)));
}

export function harmonizeDecisionEvent(
  event: HomeDecisionEvent,
  fieldId: unknown,
  evaluatedAt = new Date().toISOString(),
): HarmonizedHomeDecisionEvent {
  const evidence = uniqueEvidence(event.evidence);
  const status = resolveStatus(event);
  const observedAt = parseObservedAt(event);

  const gateway: ModelGatewayEnvelope = {
    schemaVersion: '1.0',
    signalId: event.id,
    fieldId: text(fieldId),
    source: event.source,
    sourceModel: text(event.sourceModel) || SOURCE_MODELS[event.source],
    status,
    confidence: resolveConfidence(status, evidence, event.confidence),
    evidence,
    freshness: {
      observedAt,
      evaluatedAt,
      ageHours: ageHours(observedAt, evaluatedAt),
    },
    recommendation: {
      title: event.title,
      detail: event.detail,
      target: event.target,
    },
    severity: event.severity,
    priority: event.priority,
  };

  return {
    ...event,
    evidence,
    gateway,
  };
}

export function harmonizeDecisionEvents(
  events: HomeDecisionEvent[],
  fieldId: unknown,
  evaluatedAt = new Date().toISOString(),
): HarmonizedHomeDecisionEvent[] {
  return events.map((event) =>
    harmonizeDecisionEvent(event, fieldId, evaluatedAt),
  );
}
