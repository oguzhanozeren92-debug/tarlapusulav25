import { supabase } from '../supabaseClient';

export type AgriboundCandidateGeometry =
  | {
      type: 'Polygon';
      coordinates: [number, number][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: [number, number][][][];
    };

export type AgriboundBoundaryCandidate = {
  geometry: AgriboundCandidateGeometry;
  confidence: number | null;
  sourceId: string | null;
  engine: string | null;
  areaM2: number | null;
  containsAnchor: boolean;
  areaDifferenceRatio: number | null;
};

export type AgriboundBoundaryResult = {
  ok: boolean;
  status:
    | 'authoritative_boundary_present'
    | 'missing_anchor'
    | 'candidates_ready'
    | 'no_candidate'
    | string;
  field_id?: string;
  field_name?: string | null;
  source?: 'Agribound';
  upstream_project?: 'montimaj/agribound';
  upstream_license?: 'Apache-2.0';
  skipped?: boolean;
  mode?: 'missing_only' | 'compare';
  anchor?: {
    latitude: number;
    longitude: number;
  };
  study_area?: {
    bbox: [number, number, number, number];
    radius_m: number;
  };
  declared_area_m2?: number | null;
  existing_boundary_present?: boolean;
  existing_boundary_authoritative?: boolean;
  existing_boundary_source?: string | null;
  selected_candidate?: AgriboundBoundaryCandidate | null;
  candidate_count?: number;
  candidates?: AgriboundBoundaryCandidate[];
  auto_apply_allowed?: false;
  production_authority?: false;
  input_authority?: 'server-derived';
  note?: string;
  warnings?: string[];
  evidence?: string[];
  worker?: {
    engine: string | null;
    version: string | null;
    generated_at: string | null;
  };
  generated_at?: string;
  error?: string;
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
    // no-op
  }

  return error?.message || 'Agribound sınır servisi çağrısı başarısız oldu.';
}

export async function requestAgriboundBoundary(
  fieldId: string | number,
  options: {
    mode?: 'missing_only' | 'compare';
  } = {},
): Promise<AgriboundBoundaryResult> {
  if (!supabase) {
    throw new Error('Agribound bağlantısı hazır değil.');
  }

  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) {
    throw new Error('Agribound için tarla seçilmedi.');
  }

  const { data, error } = await supabase.functions.invoke(
    'agribound-boundary',
    {
      body: {
        field_id: normalizedFieldId,
        mode: options.mode === 'compare' ? 'compare' : 'missing_only',
      },
    },
  );

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data) {
    throw new Error('Agribound servisi boş yanıt döndürdü.');
  }

  if (data.ok === false) {
    throw new Error(data.error || 'Agribound sınır adayı hazırlanamadı.');
  }

  return {
    ...data,
    ok: true,
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    selected_candidate: data.selected_candidate ?? null,
    production_authority: false,
  } as AgriboundBoundaryResult;
}

export function compactAgriboundBoundaryForPusula(
  result: AgriboundBoundaryResult | null | undefined,
) {
  if (!result) return null;

  if (result.status === 'authoritative_boundary_present') {
    return {
      status: result.status,
      skipped: true,
      reason:
        result.note ??
        'Resmî parsel sınırı mevcut; otomatik sınır modeli çalıştırılmadı.',
      source: result.existing_boundary_source ?? null,
      productionAuthority: false,
    };
  }

  const selected = result.selected_candidate ?? null;

  return {
    status: result.status,
    selectedCandidateReady: Boolean(selected),
    candidateCount: Number(result.candidate_count ?? result.candidates?.length ?? 0),
    selectedAreaM2: selected?.areaM2 ?? null,
    containsAnchor: selected?.containsAnchor ?? false,
    areaDifferenceRatio: selected?.areaDifferenceRatio ?? null,
    confidence: selected?.confidence ?? null,
    engine: selected?.engine ?? result.worker?.engine ?? null,
    warnings: result.warnings?.slice(0, 3) ?? [],
    productionAuthority: false,
    autoApplyAllowed: false,
  };
}
