import { supabase } from '../supabaseClient';

export type AgStackGeoIdStatus = 'created' | 'existing' | 'cached';

export type AgStackGeoIdEvidence = {
  ok: true;
  fieldId: string;
  fieldName: string | null;
  geoId: string;
  matchedGeoIds: string[];
  status: AgStackGeoIdStatus;
  s2CellTokens: Record<string, string[]> | null;
  thresholdPercent: number;
  geometryType: 'Polygon' | 'MultiPolygon' | null;
  geometrySha256: string | null;
  parcelLookupSource: string | null;
  source: 'AgStack Asset Registry';
  inputAuthority: 'server-derived';
  productionAuthority: false;
  upstreamMessage: string | null;
  persisted: boolean;
  generatedAt: string;
};

function text(value: unknown): string | null {
  const parsed = String(value ?? '').trim();
  return parsed || null;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
}

function s2Tokens(value: unknown): Record<string, string[]> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const normalized: Record<string, string[]> = {};
  for (const [level, tokens] of Object.entries(value as Record<string, unknown>)) {
    const list = strings(tokens);
    if (list.length) normalized[String(level)] = list;
  }

  return Object.keys(normalized).length ? normalized : null;
}

async function functionError(error: any) {
  try {
    if (error?.context instanceof Response) {
      const payload = await error.context.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
    }
  } catch {
    // no-op
  }

  return error?.message || 'AgStack GeoID alınamadı.';
}

function normalize(data: any, fieldId: string): AgStackGeoIdEvidence {
  const geoId = text(data?.geo_id);
  if (!geoId) {
    throw new Error('AgStack yanıtında GeoID bulunamadı.');
  }

  const statusText = text(data?.status);
  const status: AgStackGeoIdStatus =
    statusText === 'created' || statusText === 'existing' || statusText === 'cached'
      ? statusText
      : 'existing';

  const geometryTypeText = text(data?.geometry_type);
  const geometryType =
    geometryTypeText === 'Polygon' || geometryTypeText === 'MultiPolygon'
      ? geometryTypeText
      : null;

  const matched = strings(data?.matched_geo_ids);
  const matchedGeoIds = matched.length
    ? Array.from(new Set([geoId, ...matched]))
    : [geoId];

  return {
    ok: true,
    fieldId,
    fieldName: text(data?.field_name),
    geoId,
    matchedGeoIds,
    status,
    s2CellTokens: s2Tokens(data?.s2_cell_tokens),
    thresholdPercent: number(data?.threshold_percent) ?? 95,
    geometryType,
    geometrySha256: text(data?.geometry_sha256),
    parcelLookupSource: text(data?.parcel_lookup_source),
    source: 'AgStack Asset Registry',
    inputAuthority: 'server-derived',
    productionAuthority: false,
    upstreamMessage: text(data?.upstream_message),
    persisted: data?.persisted === true,
    generatedAt: text(data?.generated_at) ?? new Date().toISOString(),
  };
}

export async function ensureAgStackGeoId(
  fieldIdInput: string | number,
): Promise<AgStackGeoIdEvidence> {
  if (!supabase) throw new Error('AgStack GeoID bağlantısı hazır değil.');

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('AgStack GeoID için tarla seçilmedi.');

  const { data, error } = await supabase.functions.invoke('agstack-geoid', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(await functionError(error));
  if (!data) throw new Error('AgStack GeoID servisi boş yanıt döndürdü.');
  if (data.ok === false) {
    throw new Error(data.error || 'AgStack GeoID oluşturulamadı.');
  }

  return normalize(data, fieldId);
}
