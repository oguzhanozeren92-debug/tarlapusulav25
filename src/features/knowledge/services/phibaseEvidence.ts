import { supabase } from '../../../supabaseClient';

export type PhiBasePathogenEvidence = {
  pathogen_species: string;
  record_count: number;
  diseases: string[];
  genes: string[];
  mutant_phenotypes: string[];
  interaction_phenotypes: string[];
  tissues: string[];
  pmids: string[];
  dois: string[];
  years: string[];
};

export type PhiBaseFieldEvidence = {
  ok: boolean;
  supported: boolean;
  source: 'PHI-base';
  source_description?: string;
  source_repository?: string;
  license?: 'CC BY 4.0';
  field_id?: string;
  field_name?: string | null;
  crop?: string | null;
  host_taxon?: string | null;
  host_aliases?: string[];
  matched_record_count?: number;
  distinct_pathogen_count?: number;
  diseases?: string[];
  pathogens?: PhiBasePathogenEvidence[];
  release?: {
    file: string;
    sha: string | null;
    size_bytes: number | null;
  };
  interpretation?: {
    scope: 'curated-experimental-host-pathogen-evidence';
    diagnosis: false;
    field_incidence: false;
    treatment_recommendation: false;
  };
  production_authority?: false;
  evidence?: string[];
  warnings?: string[];
  reason?: string;
  generated_at?: string;
};

type CachedEvidence = {
  savedAt: number;
  value: PhiBaseFieldEvidence;
};

const MEMORY_CACHE = new Map<string, CachedEvidence>();
const CACHE_PREFIX = 'tp_phibase_evidence_v1:';
const CACHE_MS = 24 * 60 * 60 * 1000;

function cacheKey(fieldId: string) {
  return `${CACHE_PREFIX}${fieldId}`;
}

function readCache(fieldId: string) {
  const key = cacheKey(fieldId);
  const memory = MEMORY_CACHE.get(key);

  if (memory && Date.now() - memory.savedAt < CACHE_MS) {
    return memory.value;
  }

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedEvidence;
    if (!parsed?.savedAt || !parsed?.value) return null;
    if (Date.now() - parsed.savedAt >= CACHE_MS) return null;

    MEMORY_CACHE.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(fieldId: string, value: PhiBaseFieldEvidence) {
  const key = cacheKey(fieldId);
  const cached: CachedEvidence = {
    savedAt: Date.now(),
    value,
  };

  MEMORY_CACHE.set(key, cached);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

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

  return error?.message || 'PHI-base kanıtı alınamadı.';
}

export async function fetchPhiBaseFieldEvidence(
  fieldId: string | number,
  options: { forceRefresh?: boolean } = {},
): Promise<PhiBaseFieldEvidence> {
  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) {
    throw new Error('PHI-base kanıtı için tarla seçilmedi.');
  }

  if (!options.forceRefresh) {
    const cached = readCache(normalizedFieldId);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke('phibase-evidence', {
    body: {
      field_id: normalizedFieldId,
    },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data) {
    throw new Error('PHI-base boş yanıt döndürdü.');
  }

  if (data.ok === false) {
    throw new Error(String(data.error ?? 'PHI-base kanıtı hazırlanamadı.'));
  }

  const value: PhiBaseFieldEvidence = {
    ...data,
    ok: true,
    supported: data.supported === true,
    source: 'PHI-base',
    pathogens: Array.isArray(data.pathogens) ? data.pathogens : [],
    diseases: Array.isArray(data.diseases) ? data.diseases : [],
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };

  writeCache(normalizedFieldId, value);
  return value;
}

export function compactPhiBaseEvidence(
  value: PhiBaseFieldEvidence | null | undefined,
) {
  if (!value) return null;

  if (!value.supported) {
    return {
      supported: false,
      crop: value.crop ?? null,
      reason: value.reason ?? 'PHI-base eşleşmesi yok.',
      source: 'PHI-base',
    };
  }

  return {
    supported: true,
    source: 'PHI-base',
    license: value.license ?? 'CC BY 4.0',
    crop: value.crop ?? null,
    hostTaxon: value.host_taxon ?? null,
    matchedRecordCount: value.matched_record_count ?? 0,
    distinctPathogenCount: value.distinct_pathogen_count ?? 0,
    diseases: (value.diseases ?? []).slice(0, 10),
    topPathogens: (value.pathogens ?? []).slice(0, 6).map((item) => ({
      pathogen: item.pathogen_species,
      recordCount: item.record_count,
      diseases: item.diseases.slice(0, 5),
      genes: item.genes.slice(0, 5),
      phenotypes: item.interaction_phenotypes.slice(0, 4),
      pmids: item.pmids.slice(0, 4),
      years: item.years.slice(0, 4),
    })),
    interpretation: {
      diagnosis: false,
      fieldIncidence: false,
      treatmentRecommendation: false,
    },
    releaseSha: value.release?.sha ?? null,
    generatedAt: value.generated_at ?? null,
  };
}

export function clearPhiBaseEvidenceCache(fieldId?: string | number) {
  if (fieldId !== undefined) {
    const key = cacheKey(String(fieldId));
    MEMORY_CACHE.delete(key);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // no-op
      }
    }
    return;
  }

  MEMORY_CACHE.clear();

  if (typeof window !== 'undefined') {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(CACHE_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // no-op
    }
  }
}
