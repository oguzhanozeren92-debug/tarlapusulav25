import { supabase } from '../../../supabaseClient';

export type PlantCvPhotoEvidence = {
  ok: boolean;
  blocked: boolean;
  engine: 'plantcv';
  mode: 'photo_evidence';
  source?: 'PlantCV';
  upstream?: 'danforthcenter/plantcv';
  upstream_license?: 'MPL-2.0';
  engine_version?: string | null;
  field_id?: string;
  job_id?: string;
  production_authority: false;
  diagnostic_authority: false;
  reason?: string;
  segmentation?: {
    quality?: 'high' | 'medium' | 'low' | 'blocked' | string;
    mask_fraction?: number;
    candidate_dominance?: number;
    touches_frame?: boolean;
    segmentation_method?: string;
    reason?: string;
  } | null;
  shape?: {
    area_px?: number | null;
    convex_hull_area_px?: number | null;
    solidity?: number | null;
    perimeter_px?: number | null;
    width_px?: number | null;
    height_px?: number | null;
    longest_path_px?: number | null;
    object_in_frame?: boolean | number | null;
  } | null;
  color?: {
    hue_circular_mean?: number | null;
    hue_circular_std?: number | null;
    hue_median?: number | null;
    saturation_mean?: number | null;
    saturation_median?: number | null;
    value_mean?: number | null;
    value_median?: number | null;
  } | null;
  heuristic_color_proxies?: {
    green_like_fraction?: number | null;
    yellow_like_fraction?: number | null;
    brown_dark_like_fraction?: number | null;
  } | null;
  evidence?: string[];
  warnings?: string[];
  input_authority?: 'server-derived';
  generated_at?: string;
};

async function readFunctionError(error: any) {
  try {
    const context = error?.context;
    if (context instanceof Response) {
      const text = await context.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            return parsed.error.trim();
          }
        } catch {
          return text.slice(0, 500);
        }
      }
    }
  } catch {
    // Keep the original invoke error below.
  }

  return error?.message || 'PlantCV sayısal fotoğraf kanıtı alınamadı.';
}

/**
 * Yalnız jobId gönderir. Fotoğraf yolu, tarla kimliği ve dosya içeriği
 * sunucu tarafında ai_image_analysis_jobs kaydından türetilir.
 */
export async function fetchPlantCvPhotoEvidence(
  jobId: string | number,
): Promise<PlantCvPhotoEvidence> {
  const normalizedJobId = String(jobId ?? '').trim();
  if (!normalizedJobId) {
    throw new Error('PlantCV için fotoğraf analiz işi bulunamadı.');
  }

  const { data, error } = await supabase.functions.invoke('plantcv-photo-evidence', {
    body: { jobId: normalizedJobId },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data || data.ok === false) {
    throw new Error(data?.error || 'PlantCV sayısal fotoğraf kanıtı alınamadı.');
  }

  if (
    data.engine !== 'plantcv' ||
    data.mode !== 'photo_evidence' ||
    data.production_authority !== false ||
    data.diagnostic_authority !== false
  ) {
    throw new Error('PlantCV kanıtı güven sınırı doğrulanamadı.');
  }

  return data as PlantCvPhotoEvidence;
}

export function compactPlantCvEvidence(
  evidence: PlantCvPhotoEvidence | null | undefined,
) {
  if (!evidence) return null;

  if (evidence.blocked) {
    return {
      available: false,
      reason: evidence.reason ?? 'segmentation_unreliable',
      diagnosticAuthority: false as const,
      warnings: evidence.warnings?.slice(0, 2) ?? [],
    };
  }

  return {
    available: true,
    diagnosticAuthority: false as const,
    maskQuality: evidence.segmentation?.quality ?? null,
    maskFraction: evidence.segmentation?.mask_fraction ?? null,
    shape: evidence.shape ?? null,
    color: evidence.color ?? null,
    colorProxies: evidence.heuristic_color_proxies ?? null,
    warnings: evidence.warnings?.slice(0, 3) ?? [],
  };
}
