import type {
  HomeDecisionEvent,
  HomeObservationFollowUpSignal,
  HomePhenologySignal,
} from '../types/homeDecision';
import { buildRiskRadarDecision } from './buildRiskRadarDecision';

type PlantHealthSynthesisInput = {
  fieldId: string | number | null | undefined;
  radar: unknown;
  observation?: HomeObservationFollowUpSignal | null;
  phenology?: HomePhenologySignal | null;
  now?: Date;
};

type ThreatShape = {
  name?: unknown;
};

type RadarShape = {
  topThreats?: ThreatShape[];
};

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value: unknown) {
  return text(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function meaningfulTokens(value: unknown) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !['hastalik', 'zararli', 'riski', 'bitki'].includes(token));
}

function labelsMatch(left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const aTokens = meaningfulTokens(a);
  const bTokens = meaningfulTokens(b);
  if (!aTokens.length || !bTokens.length) return false;

  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longer = aTokens.length <= bTokens.length ? bTokens : aTokens;
  const overlap = shorter.filter((token) => longer.includes(token)).length;
  return overlap >= Math.max(1, Math.ceil(shorter.length * 0.5));
}

function compactUnique(values: Array<string | null | undefined>, limit = 8) {
  return [...new Set(values.map((value) => text(value)).filter(Boolean))].slice(0, limit);
}

/**
 * Risk Radar'ın gerçek iklim/ürün/fenoloji riskini, mevcut saha fotoğrafı
 * takibi ve doğrulanmış gelişim evresiyle tek açıklanabilir sağlık olayında
 * birleştirir. Yeni bir risk skoru hesaplamaz ve fotoğraf ön değerlendirmesini
 * kesin teşhis olarak kullanmaz.
 */
export function buildPlantHealthSynthesisDecision({
  fieldId,
  radar,
  observation,
  phenology,
  now = new Date(),
}: PlantHealthSynthesisInput): HomeDecisionEvent | null {
  const base = buildRiskRadarDecision(
    fieldId,
    radar as Parameters<typeof buildRiskRadarDecision>[1],
    now,
  );
  if (!base) return null;

  const radarShape = radar && typeof radar === 'object'
    ? radar as RadarShape
    : null;
  const threatName = text(radarShape?.topThreats?.[0]?.name);
  const trackedIssue = text(observation?.trackedIssueLabel);
  const photoMatched = Boolean(
    threatName &&
    trackedIssue &&
    labelsMatch(threatName, trackedIssue),
  );
  const phenologyUsable = Boolean(
    phenology?.dataStatus === 'usable' &&
      phenology.stage &&
      phenology.stage !== 'unknown',
  );

  const photoEvidence = photoMatched
    ? [
        `Saha fotoğrafı Pusula AI ön değerlendirmesinde aynı veya benzer etiket izleniyor: ${trackedIssue}.`,
        observation?.trackedIssueSummary
          ? `Son saha takibi: ${text(observation.trackedIssueSummary)}`
          : null,
        'Fotoğraf eşleşmesi ön değerlendirmedir; kesin hastalık veya zararlı teşhisi değildir.',
      ]
    : [];
  const phenologyEvidence = phenologyUsable
    ? [`Gelişim evresi: ${text(phenology?.stageLabel) || text(phenology?.stage)}.`]
    : [];

  const sourceModel = compactUnique([
    'risk-radar',
    photoMatched ? 'field-photo' : null,
    phenologyUsable ? 'phenology' : null,
  ], 3).join('+');

  return {
    ...base,
    group: 'plant-health-risk',
    sourceModel,
    confidence: photoMatched ? 'medium' : 'preliminary',
    kind: 'check',
    detail: compactUnique([
      base.detail,
      photoMatched
        ? 'Risk Radar iklimsel risk bağlamı ile saha fotoğrafındaki ön değerlendirme aynı yönde; sahada belirti kontrolüyle doğrula.'
        : 'Risk Radar iklimsel risk bağlamıdır; tek başına hastalık veya zararlı teşhisi değildir.',
    ], 2).join(' '),
    evidence: compactUnique([
      ...(base.evidence ?? []),
      ...phenologyEvidence,
      ...photoEvidence,
    ]),
  };
}
