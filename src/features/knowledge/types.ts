export type SourceId = 'openfarm' | 'pdo' | 'agrodss' | 'agripest' | 'plantvillage' | 'ip102';
export type KnowledgeKind = 'growing' | 'disease' | 'pest' | 'healthy';
export interface KnowledgeSource {
  id: SourceId;
  name: string;
  url: string;
  description: string;
  status: string;
  limitation: string;
  license: string;
  checkedAt: string;
}
export interface KnowledgeEntry {
  id: string;
  sourceId: SourceId;
  sourceRecordId: string;
  sourceUrl: string;
  sourceVersion: string;
  titleTr: string;
  originalTitle: string;
  scientificName: string;
  crops: string[];
  kind: KnowledgeKind;
  contentType: 'label' | 'article';
  summaryTr: string;
  symptomsTr: string[];
  observationTr: string[];
  aliases: string[];
  attribution: string;
  license: string;
  licenseUrl: string;
  translation: 'editorial' | 'reviewed';
  reviewedBy: string;
  reviewedAt: string;
}
