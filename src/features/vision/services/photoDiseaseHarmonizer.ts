import { knowledgeEntries, normalizeKnowledgeText } from '../../knowledge/services/catalog';
import type { KnowledgeEntry } from '../../knowledge/types';
import { knowledgeEntryToFieldVisionReference } from './agmlDatasetAdapter';
import type { FieldVisionReference } from '../types/fieldVisionDataset';

export type PhotoDiseaseReferenceMatch = {
  entryId: string;
  label: string;
  crop: string | null;
  kind: FieldVisionReference['kind'];
  source: string;
  license: string;
  sourceUrl: string | null;
};

export type PhotoDiseaseHarmonization = {
  status: 'matched-reference' | 'no-reference';
  issueText: string | null;
  cropText: string | null;
  matches: PhotoDiseaseReferenceMatch[];
  referenceOnly: true;
  diagnosticAuthority: false;
  note: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function meaningfulTokens(value: string) {
  return normalizeKnowledgeText(value)
    .split(' ')
    .filter((token) => token.length >= 3);
}

function candidateScore(entry: KnowledgeEntry, issueText: string, cropText: string) {
  if (!['disease', 'pest', 'healthy'].includes(entry.kind)) return 0;

  const issue = normalizeKnowledgeText(issueText);
  if (!issue) return 0;

  const candidate = normalizeKnowledgeText([
    entry.titleTr,
    entry.originalTitle,
    entry.scientificName,
    ...entry.aliases,
  ].join(' '));

  let score = 0;
  if (candidate === issue) score += 10;
  if (candidate.includes(issue) || issue.includes(candidate)) score += 6;

  const issueTokens = meaningfulTokens(issueText);
  const overlap = issueTokens.filter((token) => candidate.includes(token)).length;
  if (issueTokens.length > 0) score += (overlap / issueTokens.length) * 5;

  if (cropText) {
    const crop = normalizeKnowledgeText(cropText);
    const cropMatches = entry.crops.some((item) => {
      const candidateCrop = normalizeKnowledgeText(item);
      return candidateCrop === crop || candidateCrop.includes(crop) || crop.includes(candidateCrop);
    });
    if (cropMatches) score += 3;
    else if (entry.crops.length > 0) score -= 2;
  }

  return score;
}

function toMatch(entry: KnowledgeEntry): PhotoDiseaseReferenceMatch {
  const reference = knowledgeEntryToFieldVisionReference(entry);
  return {
    entryId: entry.id,
    label: reference.issueLabel,
    crop: reference.cropLabel,
    kind: reference.kind,
    source: reference.provenance.datasetName,
    license: reference.provenance.license,
    sourceUrl: reference.provenance.sourceUrl,
  };
}

/**
 * Pusula AI fotoğraf ön değerlendirmesini yerel bilgi kataloğuyla eşleştirir.
 * Bu fonksiyon teşhis üretmez ve mevcut AI sonucunun güvenini yükseltmez.
 * Eşleşme yalnız isim/provenans desteği sağlar.
 */
export function harmonizePhotoDiseaseAssessment(
  analysis: Record<string, unknown>,
): PhotoDiseaseHarmonization {
  const issueText =
    text(analysis.possibleIssue) ||
    text(analysis.headline) ||
    text(analysis.issueType) ||
    '';
  const cropText =
    text(analysis.crop) ||
    text(analysis.cropName) ||
    text(analysis.plant) ||
    '';

  if (!issueText) {
    return {
      status: 'no-reference',
      issueText: null,
      cropText: cropText || null,
      matches: [],
      referenceOnly: true,
      diagnosticAuthority: false,
      note: 'Fotoğraf ön değerlendirmesinde bilgi kataloğuyla eşleştirilecek açık bir sorun etiketi yok.',
    };
  }

  const ranked = knowledgeEntries
    .map((entry) => ({ entry, score: candidateScore(entry, issueText, cropText) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 3)
    .map((item) => toMatch(item.entry));

  return {
    status: ranked.length > 0 ? 'matched-reference' : 'no-reference',
    issueText,
    cropText: cropText || null,
    matches: ranked,
    referenceOnly: true,
    diagnosticAuthority: false,
    note: ranked.length > 0
      ? 'Bilgi kataloğunda benzer hastalık/zararlı etiketleri bulundu. Bu eşleşme yalnız referanstır; fotoğraf ön değerlendirmesini kesin teşhise dönüştürmez.'
      : 'Bilgi kataloğunda yeterince yakın bir etiket bulunamadı. Pusula AI ön değerlendirmesi ayrı bir saha kanıtı olarak tutulur.',
  };
}
