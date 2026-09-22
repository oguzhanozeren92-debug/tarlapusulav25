import { supabase } from '../supabaseClient';

export type AgStackGeoIdStatus = 'created' | 'existing';

export type AgStackGeoIdResult = {
  ok: true;
  source: 'AgStack Asset Registry';
  fieldId: string;
  fieldName: string | null;
  geoId: string;
  matchedGeoIds: string[];
  status: AgStackGeoIdStatus;
  s2CellTokens: Record<string, string[]> | null;
  thresholdPercent: number;
  geometryType: 'Polygon' | 'MultiPolygon' | string;
  geometrySha256: string;
  parcelLookupSource: string | null;
  inputAuthority: 'server-derived';
  productionAuthority: false;
  upstreamMessage: string | null;
  evidence: string[];
  generatedAt: string;
};

type CachedResult = {
  savedAt: number;
  result: AgStackGeoIdResult;
};

const MEMORY_CACHE = new Map<string, CachedResult>();
const CACHE_PREFIX = 'tp_agstack_geoid_v1:';
const CACHE_MS = 24 * 60 * 60 * 1000;

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function readCache(fieldId: string) {
  const memory = MEMORY_CACHE.get(fieldId);
  if (memory && Date.now() - memory.savedAt < CACHE_MS) return memory.result;

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${fieldId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedResult;
    if (!parsed?.savedAt || !parsed?.result || Date.now() - parsed.savedAt >= CACHE_MS) {
      return null;
    }

    MEMORY_CACHE.set(fieldId, parsed);
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCache(fieldId: string, result: AgStackGeoIdResult) {
  const value: CachedResult = { savedAt: Date.now(), result };
  MEMORY_CACHE.set(fieldId, value);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${fieldId}`, JSON.stringify(value));
  } catch {
    // Cache yalnızca optimizasyon; GeoID doğruluğunun kaynağı Edge Function'dır.
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
          const message = clean(parsed?.error ?? parsed?.message);
          if (message) return message;
        } catch {
          return text.slice(0, 500);
        }
      }
    }
  } catch {
    // no-op
  }

  return clean(error?.message) ?? 'AgStack GeoID çağrısı başarısız oldu.';
}

function normalizeS2Tokens(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const result: Record<string, string[]> = {};
  for (const [level, tokens] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(tokens)) continue;
    const normalized = tokens.map(clean).filter(Boolean) as string[];
    if (normalized.length) result[level] = normalized;
  }

  return Object.keys(result).length ? result : null;
}

export async function fetchAgStackGeoId(
  fieldIdInput: string | number,
  options: { forceRefresh?: boolean } = {},
): Promise<AgStackGeoIdResult> {
  if (!supabase) throw new Error('AgStack GeoID bağlantısı hazır değil.');

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('GeoID için tarla seçilmedi.');

  if (!options.forceRefresh) {
    const cached = readCache(fieldId);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke('agstack-geoid', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('AgStack GeoID servisi boş yanıt döndürdü.');
  if (data.ok === false) {
    throw new Error(clean(data.error) ?? 'AgStack GeoID oluşturulamadı.');
  }

  const geoId = clean(data.geo_id ?? data.geoId);
  const geometryHash = clean(data.geometry_sha256 ?? data.geometrySha256);

  if (!geoId || !geometryHash) {
    throw new Error('AgStack GeoID yanıtı doğrulanamadı.');
  }

  const matchedGeoIds = Array.isArray(data.matched_geo_ids)
    ? (data.matched_geo_ids.map(clean).filter(Boolean) as string[])
    : [geoId];

  const result: AgStackGeoIdResult = {
    ok: true,
    source: 'AgStack Asset Registry',
    fieldId: String(data.field_id ?? fieldId),
    fieldName: clean(data.field_name),
    geoId,
    matchedGeoIds: matchedGeoIds.length ? matchedGeoIds : [geoId],
    status: data.status === 'existing' ? 'existing' : 'created',
    s2CellTokens: normalizeS2Tokens(data.s2_cell_tokens),
    thresholdPercent: Number(data.threshold_percent ?? 95),
    geometryType: String(data.geometry_type ?? 'Polygon'),
    geometrySha256: geometryHash,
    parcelLookupSource: clean(data.parcel_lookup_source),
    inputAuthority: 'server-derived',
    productionAuthority: false,
    upstreamMessage: clean(data.upstream_message),
    evidence: Array.isArray(data.evidence)
      ? (data.evidence.map(clean).filter(Boolean) as string[])
      : [],
    generatedAt: clean(data.generated_at) ?? new Date().toISOString(),
  };

  writeCache(fieldId, result);
  return result;
}

export function compactAgStackGeoId(
  value: AgStackGeoIdResult | null | undefined,
) {
  if (!value) return null;

  return {
    source: value.source,
    geoId: value.geoId,
    status: value.status,
    s2CellTokens: value.s2CellTokens,
    geometrySha256: value.geometrySha256,
    thresholdPercent: value.thresholdPercent,
    inputAuthority: value.inputAuthority,
    generatedAt: value.generatedAt,
  };
}

export function clearAgStackGeoIdCache(fieldIdInput?: string | number) {
  if (fieldIdInput === undefined) {
    MEMORY_CACHE.clear();

    if (typeof window !== 'undefined') {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
      }
    }
    return;
  }

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return;

  MEMORY_CACHE.delete(fieldId);

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(`${CACHE_PREFIX}${fieldId}`);
  }
}
