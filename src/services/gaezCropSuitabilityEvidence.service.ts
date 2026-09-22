import { supabase } from '../supabaseClient';

export type GaezSuitabilityEvidenceResponse = {
  ok: boolean;
  status:
    | 'ready'
    | 'partial'
    | 'unavailable'
    | 'unsupported_crop'
    | 'catalog_match_missing';
  field_id: string;
  crop?: {
    key: string;
    label: string;
    gaez_codes: string[];
  };
  source?: {
    name: string;
    theme: string;
    service: string;
    service_url: string;
    spatial_resolution: string;
    baseline_note?: string;
  };
  samples?: Array<{
    catalog: {
      objectid?: number | string | null;
      name?: string | null;
      sub_theme_name?: string | null;
      variable?: string | null;
      year?: string | null;
      model?: string | null;
      rcp?: string | null;
      crop?: string | null;
      water_supply?: string | null;
      input_level?: string | null;
      units?: string | null;
      renderer?: string | null;
      file_id?: string | null;
    };
    selection_rank: number;
    selection_reasons: string[];
    sample: {
      ok: boolean;
      rawValue?: unknown;
      numericValue?: number | null;
      objectId?: number | null;
      name?: string | null;
      error?: string;
    };
    interpretation: {
      continuous_suitability_index_detected: boolean;
      derived_class: { class: number; label: string } | null;
      used_in_tarlapusula_commercial_score: false;
    };
  }>;
  role?: 'research_validation_only';
  production_authority?: false;
  commercial_use_allowed?: false;
  evidence_policy?: {
    affects_crop_suitability_score: false;
    affects_farmer_recommendation: false;
    purpose: string;
    disagreement_rule: string;
  };
  license?: {
    name: string;
    commercialUseAllowed: false;
    source: string;
    url: string;
    note: string;
  };
  warnings?: string[];
  generated_at?: string;
  error?: string;
};

async function errorMessage(error: any) {
  try {
    if (error?.context instanceof Response) {
      const payload = await error.context.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
    }
  } catch {
    // no-op
  }

  return error?.message || 'FAO GAEZ uygunluk kanıtı alınamadı.';
}

export async function fetchGaezCropSuitabilityEvidence(
  fieldIdInput: string | number,
  crop?: string | null,
): Promise<GaezSuitabilityEvidenceResponse> {
  if (!supabase) {
    throw new Error('GAEZ kanıt servisi için Supabase bağlantısı hazır değil.');
  }

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('GAEZ kanıtı için tarla seçilmedi.');

  const body: { field_id: string; crop?: string } = { field_id: fieldId };
  const normalizedCrop = String(crop ?? '').trim();
  if (normalizedCrop) body.crop = normalizedCrop;

  const { data, error } = await supabase.functions.invoke(
    'gaez-crop-suitability-evidence',
    { body },
  );

  if (error) throw new Error(await errorMessage(error));
  if (!data) throw new Error('GAEZ kanıt servisi boş yanıt döndürdü.');
  if (data.ok === false) throw new Error(data.error || 'GAEZ kanıtı hazırlanamadı.');

  return data as GaezSuitabilityEvidenceResponse;
}
