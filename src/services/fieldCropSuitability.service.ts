import { supabase } from '../supabaseClient';

export type CropSuitabilityConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'unavailable';

export type CropSuitabilityFactor = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  score: number | null;
  rule: {
    absMin: number;
    optMin: number;
    optMax: number;
    absMax: number;
  };
  evidence: {
    source?: string | null;
    provider?: string | null;
    product?: string | null;
  } | null;
};

export type CropSuitabilityScreening = {
  score: number | null;
  band: string;
  label: string;
  confidence: CropSuitabilityConfidence;
  limitingFactor: {
    key: string;
    label: string;
    score: number | null;
    value: number | null;
    unit: string;
  } | null;
  factors: CropSuitabilityFactor[];
  method: string;
  missingFactors: string[];
};

export type CropSuitabilityCrop = {
  key: string;
  label: string;
  scientificName: string;
  ecocropId: number;
  requirementsSource: string;
  sourceUrl: string;
};

export type CropSuitabilitySharedEvidence = {
  climate: {
    annualMeanTemperatureC?: number | null;
    annualRainfallMm?: number | null;
    source?: string | null;
    provider?: string | null;
    product?: string | null;
    meteorologyResolution?: string | null;
  } | null;
  soil: {
    source?: string | null;
    provider?: string | null;
    product?: string | null;
    spatialResolutionMeters?: number | null;
    ph0To30?: number | null;
  } | null;
};

export type CropSuitabilityResponse = {
  ok: boolean;
  status:
    | 'ready'
    | 'partial'
    | 'unavailable'
    | 'unsupported_crop';
  field_id: string;
  field?: {
    name: string | null;
    registeredCrop: string | null;
  };
  requestedCrop?: string | null;
  crop?: CropSuitabilityCrop;
  supportedCrops?: Array<{
    key: string;
    label: string;
    scientificName: string;
  }>;
  screening?: CropSuitabilityScreening;
  evidence?: CropSuitabilitySharedEvidence;
  missing_inputs?: string[];
  location_source?: string | null;
  input_authority?: string;
  client_supplied_coordinates_accepted?: boolean;
  production_authority?: boolean;
  note?: string | null;
  warnings?: string[];
  generated_at?: string;
  error?: string;
};

export type CropSuitabilityComparisonItem = {
  crop: CropSuitabilityCrop;
  screening: CropSuitabilityScreening;
};

export type CropSuitabilityComparisonResponse = {
  ok: boolean;
  status: 'ready' | 'partial' | 'unavailable';
  mode: 'compare_all';
  field_id: string;
  field?: {
    name: string | null;
    registeredCrop: string | null;
  };
  comparisons: CropSuitabilityComparisonItem[];
  supportedCrops: Array<{
    key: string;
    label: string;
    scientificName: string;
  }>;
  evidence?: CropSuitabilitySharedEvidence;
  location_source?: string | null;
  input_authority?: string;
  client_supplied_coordinates_accepted?: boolean;
  production_authority?: boolean;
  warnings?: string[];
  generated_at?: string;
  error?: string;
};

async function normalizeFunctionError(error: any) {
  try {
    if (error?.context instanceof Response) {
      const payload = await error.context
        .clone()
        .json()
        .catch(() => null);

      if (payload?.error) {
        return String(payload.error);
      }
    }
  } catch {
    // no-op
  }

  return (
    error?.message ||
    'Ürün uygunluk analizi alınamadı.'
  );
}

async function invokeCropSuitability<T>(
  body: Record<string, unknown>,
): Promise<T> {
  if (!supabase) {
    throw new Error(
      'Ürün uygunluk servisi için Supabase bağlantısı hazır değil.',
    );
  }

  const { data, error } =
    await supabase.functions.invoke(
      'field-crop-suitability',
      {
        body,
      },
    );

  if (error) {
    throw new Error(
      await normalizeFunctionError(error),
    );
  }

  if (!data) {
    throw new Error(
      'Ürün uygunluk servisi boş yanıt döndürdü.',
    );
  }

  if (data.ok === false) {
    throw new Error(
      data.error ||
        'Ürün uygunluk analizi hazırlanamadı.',
    );
  }

  return data as T;
}

export async function fetchFieldCropSuitability(
  fieldIdInput: string | number,
  crop?: string | null,
): Promise<CropSuitabilityResponse> {
  const fieldId = String(
    fieldIdInput ?? '',
  ).trim();

  if (!fieldId) {
    throw new Error(
      'Ürün uygunluk analizi için tarla seçilmedi.',
    );
  }

  const body: {
    field_id: string;
    crop?: string;
  } = {
    field_id: fieldId,
  };

  const normalizedCrop =
    String(crop ?? '').trim();

  if (normalizedCrop) {
    body.crop = normalizedCrop;
  }

  return invokeCropSuitability<CropSuitabilityResponse>(
    body,
  );
}

export async function fetchFieldCropSuitabilityComparison(
  fieldIdInput: string | number,
): Promise<CropSuitabilityComparisonResponse> {
  const fieldId = String(
    fieldIdInput ?? '',
  ).trim();

  if (!fieldId) {
    throw new Error(
      'Ürün karşılaştırması için tarla seçilmedi.',
    );
  }

  return invokeCropSuitability<CropSuitabilityComparisonResponse>({
    field_id: fieldId,
    mode: 'compare_all',
  });
}
