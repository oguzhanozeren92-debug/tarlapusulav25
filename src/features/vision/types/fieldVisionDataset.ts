export type FieldVisionKind = 'disease' | 'pest' | 'healthy' | 'unknown';

export type FieldVisionProvenance = {
  source: string;
  datasetName: string;
  datasetVersion: string | null;
  license: string;
  attribution: string | null;
  sourceUrl: string | null;
};

/**
 * Görüntü veri setleri için ortak TarlaPusula zarfı.
 *
 * Bu kayıtlar model eğitimi/değerlendirmesi için referanstır. Tek başına
 * kullanıcı fotoğrafında teşhis yetkisi taşımaz.
 */
export type FieldVisionReference = {
  datasetId: string;
  sourceRecordId: string;
  cropLabel: string | null;
  issueLabel: string;
  kind: FieldVisionKind;
  imageUri: string | null;
  split: string | null;
  provenance: FieldVisionProvenance;
  referenceOnly: true;
  diagnosticAuthority: false;
  metadata: Record<string, unknown>;
};

export type AgmlDatasetContext = {
  datasetId: string;
  datasetName: string;
  datasetVersion?: string | null;
  license: string;
  attribution?: string | null;
  sourceUrl?: string | null;
};
