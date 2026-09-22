import type { KnowledgeEntry } from '../../knowledge/types';
import type {
  AgmlDatasetContext,
  FieldVisionKind,
  FieldVisionReference,
} from '../types/fieldVisionDataset';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function pickText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return '';
}

function normalizeKind(value: unknown): FieldVisionKind {
  const raw = text(value).toLocaleLowerCase('tr-TR');
  if (/healthy|sağlıklı|saglikli/.test(raw)) return 'healthy';
  if (/pest|zararlı|zararli|insect|böcek|bocek/.test(raw)) return 'pest';
  if (/disease|hastalık|hastalik|fung|bacter|virus|blight|rot|rust|mildew|spot/.test(raw)) {
    return 'disease';
  }
  return 'unknown';
}

/**
 * AgML veya benzeri saha görüntü veri setlerinden gelen örnekleri ortak formata
 * taşır. Alan adları veri setleri arasında değişebildiği için yaygın anahtarlar
 * okunur; eksik etiket tahmin edilmez.
 */
export function adaptAgmlSample(
  sampleInput: unknown,
  context: AgmlDatasetContext,
): FieldVisionReference | null {
  const sample = objectValue(sampleInput);
  const issueLabel = pickText(sample, [
    'label',
    'class_name',
    'className',
    'disease',
    'issue',
    'category',
  ]);
  if (!issueLabel) return null;

  const sourceRecordId = pickText(sample, [
    'id',
    'sample_id',
    'sampleId',
    'image_id',
    'imageId',
    'filename',
    'file_name',
  ]) || `${context.datasetId}:${issueLabel}`;

  const cropLabel = pickText(sample, [
    'crop',
    'crop_name',
    'cropName',
    'plant',
    'species',
  ]) || null;

  const imageUri = pickText(sample, [
    'image',
    'image_path',
    'imagePath',
    'path',
    'uri',
    'url',
  ]) || null;

  const split = pickText(sample, ['split', 'subset', 'partition']) || null;
  const explicitKind = pickText(sample, ['kind', 'type', 'task']);

  return {
    datasetId: context.datasetId,
    sourceRecordId,
    cropLabel,
    issueLabel,
    kind: normalizeKind(explicitKind || issueLabel),
    imageUri,
    split,
    provenance: {
      source: 'agml-adapter',
      datasetName: context.datasetName,
      datasetVersion: text(context.datasetVersion) || null,
      license: text(context.license) || 'unknown',
      attribution: text(context.attribution) || null,
      sourceUrl: text(context.sourceUrl) || null,
    },
    referenceOnly: true,
    diagnosticAuthority: false,
    metadata: sample,
  };
}

export function adaptAgmlBatch(
  samples: unknown[],
  context: AgmlDatasetContext,
) {
  return samples
    .map((sample) => adaptAgmlSample(sample, context))
    .filter((sample): sample is FieldVisionReference => Boolean(sample));
}

/** PlantVillage bilgi kataloğunu aynı görüntü-referans zarfına taşır. */
export function knowledgeEntryToFieldVisionReference(
  entry: KnowledgeEntry,
): FieldVisionReference {
  return {
    datasetId: entry.sourceId,
    sourceRecordId: entry.sourceRecordId,
    cropLabel: entry.crops[0] ?? null,
    issueLabel: entry.titleTr || entry.originalTitle,
    kind: entry.kind === 'disease'
      ? 'disease'
      : entry.kind === 'pest'
        ? 'pest'
        : entry.kind === 'healthy'
          ? 'healthy'
          : 'unknown',
    imageUri: null,
    split: null,
    provenance: {
      source: 'knowledge-catalog',
      datasetName: entry.sourceId,
      datasetVersion: entry.sourceVersion || null,
      license: entry.license || 'unknown',
      attribution: entry.attribution || null,
      sourceUrl: entry.sourceUrl || null,
    },
    referenceOnly: true,
    diagnosticAuthority: false,
    metadata: {
      knowledgeEntryId: entry.id,
      aliases: entry.aliases,
      scientificName: entry.scientificName,
    },
  };
}
