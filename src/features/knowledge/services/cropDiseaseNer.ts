import { supabase } from '../../../supabaseClient';

export type CropDiseaseEntityType =
  | 'crop'
  | 'disease'
  | 'pest'
  | 'pathogen'
  | 'symptom'
  | 'location'
  | 'control_method'
  | 'chemical';

export type CropDiseaseEntity = {
  text: string;
  type: CropDiseaseEntityType;
  normalized: string | null;
  scientific_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  start: number;
  end: number;
};

export type CropDiseaseNerResult = {
  ok: boolean;
  source: 'TarlaPusula Crop Disease NER';
  model: string;
  text_length: number;
  truncated: boolean;
  entities: CropDiseaseEntity[];
  entity_count: number;
  entity_counts: Partial<Record<CropDiseaseEntityType, number>>;
  production_authority: false;
  diagnosis_authority: false;
  research_reference: {
    project: 'shenjie-hyc/CropDiseaseNer';
    role: 'task-taxonomy-reference-only';
    upstream_data_used: false;
    upstream_license_status: 'not-declared';
    note: string;
  };
  safeguards: string[];
  generated_at: string;
};

export async function extractCropDiseaseEntities(input: {
  text: string;
  language?: string | null;
}): Promise<CropDiseaseNerResult> {
  const text = String(input.text ?? '').trim();

  if (text.length < 3) {
    throw new Error('NER için en az 3 karakter metin gerekli.');
  }

  const { data, error } = await supabase.functions.invoke('crop-disease-ner', {
    body: {
      text,
      language: input.language?.trim() || undefined,
    },
  });

  if (error) throw error;
  if (!data) throw new Error('Crop Disease NER boş yanıt döndürdü.');
  if (data?.ok === false || data?.error) {
    throw new Error(String(data?.error || 'Crop Disease NER çalıştırılamadı.'));
  }

  return {
    ...data,
    ok: true,
    source: 'TarlaPusula Crop Disease NER',
    entities: Array.isArray(data.entities) ? data.entities : [],
    entity_count: Number(data.entity_count ?? data.entities?.length ?? 0),
    entity_counts:
      data.entity_counts && typeof data.entity_counts === 'object'
        ? data.entity_counts
        : {},
    production_authority: false,
    diagnosis_authority: false,
  } as CropDiseaseNerResult;
}

export function compactCropDiseaseEntities(
  result: CropDiseaseNerResult | null | undefined,
) {
  if (!result) return null;

  return {
    model: result.model,
    entityCount: result.entity_count,
    entityCounts: result.entity_counts,
    topEntities: result.entities.slice(0, 24).map((entity) => ({
      text: entity.text,
      type: entity.type,
      normalized: entity.normalized,
      scientificName: entity.scientific_name,
      confidence: entity.confidence,
    })),
    diagnosisAuthority: false,
    generatedAt: result.generated_at,
  };
}
