import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AGSTACK_LOGIN_URL = 'https://user-registry.agstack.org/login';
const AGSTACK_REGISTER_URL = 'https://api-ar.agstack.org/register-field-boundary';
const REQUEST_TIMEOUT_MS = 20_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type Position = [number, number];
type LinearRing = Position[];
type PolygonCoordinates = LinearRing[];
type MultiPolygonCoordinates = PolygonCoordinates[];

type PolygonGeometry = {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
};

type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
};

type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

function parseGeometry(input: unknown): SupportedGeometry | null {
  let value: any = input;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const geometry = value?.type === 'Feature' ? value?.geometry : value?.geometry ?? value;
  const type = String(geometry?.type ?? '');

  if (type !== 'Polygon' && type !== 'MultiPolygon') return null;
  if (!Array.isArray(geometry?.coordinates)) return null;

  return geometry as SupportedGeometry;
}

function samePosition(a: Position, b: Position) {
  return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}

function normalizeRing(input: unknown): LinearRing {
  if (!Array.isArray(input)) throw new Error('Parsel sınırı geçerli bir koordinat halkası değil.');

  const points: LinearRing = input.map((item: any) => {
    if (!Array.isArray(item) || item.length < 2) {
      throw new Error('Parsel sınırında geçersiz koordinat bulundu.');
    }

    const lng = finite(item[0]);
    const lat = finite(item[1]);

    if (lng === null || lat === null || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Parsel sınırındaki enlem/boylam değeri geçersiz.');
    }

    return [lng, lat];
  });

  if (points.length < 3) {
    throw new Error('GeoID için parsel sınırında en az üç köşe gerekli.');
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (!samePosition(first, last)) points.push([...first] as Position);

  if (points.length < 4) {
    throw new Error('GeoID için kapalı bir parsel poligonu gerekli.');
  }

  return points;
}

function normalizePolygon(input: unknown): PolygonCoordinates {
  if (!Array.isArray(input) || !input.length) {
    throw new Error('Parsel poligonu boş.');
  }
  return input.map(normalizeRing);
}

function normalizeGeometry(geometry: SupportedGeometry): SupportedGeometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: normalizePolygon(geometry.coordinates),
    };
  }

  if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) {
    throw new Error('Parsel multipoligonu boş.');
  }

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map(normalizePolygon),
  };
}

function coordinateText(position: Position) {
  const lng = Number(position[0].toFixed(8));
  const lat = Number(position[1].toFixed(8));
  return `${lng} ${lat}`;
}

function ringWkt(ring: LinearRing) {
  return `(${ring.map(coordinateText).join(',')})`;
}

function polygonBody(polygon: PolygonCoordinates) {
  return `(${polygon.map(ringWkt).join(',')})`;
}

function geometryToWkt(geometry: SupportedGeometry) {
  if (geometry.type === 'Polygon') {
    return `POLYGON${polygonBody(geometry.coordinates)}`;
  }

  return `MULTIPOLYGON(${geometry.coordinates.map(polygonBody).join(',')})`;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function loginAgStack() {
  const email = clean(Deno.env.get('AGSTACK_EMAIL'));
  const password = clean(Deno.env.get('AGSTACK_PASSWORD'));

  if (!email || !password) {
    throw new Error(
      'AgStack kimlik bilgileri yapılandırılmadı. Supabase secret olarak AGSTACK_EMAIL ve AGSTACK_PASSWORD gerekli.',
    );
  }

  const response = await fetchWithTimeout(AGSTACK_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FROM-ASSET-REGISTRY': 'True',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload: any = await parseResponse(response);
  const accessToken = clean(payload?.access_token ?? payload?.accessToken);

  if (!response.ok || !accessToken) {
    const message = clean(payload?.message ?? payload?.error) ?? `AgStack login HTTP ${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status === 401 || response.status === 403 ? 502 : 502;
    throw error;
  }

  return accessToken;
}

async function resolveAccessToken(forceLogin = false) {
  const configuredToken = clean(Deno.env.get('AGSTACK_ACCESS_TOKEN'));
  if (configuredToken && !forceLogin) return configuredToken;
  return await loginAgStack();
}

async function registerBoundary(wkt: string, accessToken: string) {
  const response = await fetchWithTimeout(AGSTACK_REGISTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-FROM-ASSET-REGISTRY': 'True',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      wkt,
      threshold: 95,
      return_s2_indices: true,
      s2_index: '8,13',
    }),
  });

  const payload = await parseResponse(response);
  return { response, payload };
}

function pickGeoIds(payload: any) {
  const direct = clean(
    payload?.['Geo Id'] ??
      payload?.['Geo ID'] ??
      payload?.geo_id ??
      payload?.geoId,
  );

  const matchedRaw =
    payload?.['matched geo ids'] ??
    payload?.matched_geo_ids ??
    payload?.matchedGeoIds;

  const matched = Array.isArray(matchedRaw)
    ? matchedRaw.map(clean).filter(Boolean) as string[]
    : [];

  return direct ? [direct, ...matched.filter((id) => id !== direct)] : matched;
}

function pickS2Tokens(payload: any) {
  const value =
    payload?.['S2 Cell Tokens'] ??
    payload?.s2_cell_tokens ??
    payload?.s2CellTokens ??
    null;

  if (!value || typeof value !== 'object') return null;

  const result: Record<string, string[]> = {};
  for (const [level, tokens] of Object.entries(value)) {
    if (!Array.isArray(tokens)) continue;
    const cleanTokens = tokens.map(clean).filter(Boolean) as string[];
    if (cleanTokens.length) result[String(level)] = cleanTokens;
  }

  return Object.keys(result).length ? result : null;
}

async function authenticatedClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !authorization) {
    throw new Error('GeoID için sunucu ayarı veya kullanıcı oturumu eksik.');
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    const authError = new Error('GeoID için geçerli kullanıcı oturumu gerekli.');
    (authError as any).status = 401;
    throw authError;
  }

  return { client, user: data.user };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = clean(body?.field_id ?? body?.fieldId);

    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if ('wkt' in body || 'geometry' in body || 'parcel_geometry' in body) {
      return json(
        {
          ok: false,
          error: 'GeoID sınırı istemciden kabul edilmez; kayıtlı parsel geometrisi sunucudan okunur.',
        },
        400,
      );
    }

    const { client, user } = await authenticatedClient(req);

    const { data: field, error: fieldError } = await client
      .from('fields')
      .select('id,user_id,name,parcel_geometry,parcel_lookup_status,parcel_lookup_source')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya erişim yetkin yok.' }, 404);

    const parsedGeometry = parseGeometry(field.parcel_geometry);
    if (!parsedGeometry) {
      return json(
        {
          ok: false,
          error: 'Bu tarlada GeoID oluşturmak için kayıtlı Polygon/MultiPolygon parsel sınırı yok.',
          field_id: fieldId,
          parcel_lookup_status: field.parcel_lookup_status ?? null,
        },
        422,
      );
    }

    const geometry = normalizeGeometry(parsedGeometry);
    const wkt = geometryToWkt(geometry);
    const geometryHash = await sha256(wkt);

    let accessToken = await resolveAccessToken(false);
    let registration = await registerBoundary(wkt, accessToken);

    if (
      (registration.response.status === 401 || registration.response.status === 403) &&
      clean(Deno.env.get('AGSTACK_EMAIL')) &&
      clean(Deno.env.get('AGSTACK_PASSWORD'))
    ) {
      accessToken = await resolveAccessToken(true);
      registration = await registerBoundary(wkt, accessToken);
    }

    const payload: any = registration.payload;
    const geoIds = pickGeoIds(payload);
    const s2CellTokens = pickS2Tokens(payload);

    if (!registration.response.ok && !geoIds.length) {
      const message =
        clean(payload?.message ?? payload?.error) ??
        `AgStack Asset Registry HTTP ${registration.response.status}`;
      const upstreamError = new Error(message);
      (upstreamError as any).status = 502;
      throw upstreamError;
    }

    if (!geoIds.length) {
      throw new Error('AgStack yanıtı GeoID içermedi; kayıt doğrulanamadı.');
    }

    const message = clean(payload?.message);
    const existing = /already|previous|matched/i.test(message ?? '') || Boolean(payload?.['matched geo ids']);

    return json({
      ok: true,
      source: 'AgStack Asset Registry',
      field_id: fieldId,
      field_name: field.name ?? null,
      geo_id: geoIds[0],
      matched_geo_ids: geoIds,
      status: existing ? 'existing' : 'created',
      s2_cell_tokens: s2CellTokens,
      threshold_percent: 95,
      geometry_type: geometry.type,
      geometry_sha256: geometryHash,
      parcel_lookup_source: field.parcel_lookup_source ?? null,
      input_authority: 'server-derived',
      production_authority: false,
      upstream_message: message,
      evidence: [
        'Parsel sınırı TarlaPusula fields.parcel_geometry kaydından sunucu tarafında okundu.',
        'AgStack Asset Registry eşleşme eşiği %95 olarak çağrıldı.',
        'S2 seviye 8 ve 13 indeksleri talep edildi.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AgStack GeoID isteği başarısız oldu.';
    console.error('[agstack-geoid]', message);

    const explicitStatus = Number((error as any)?.status);
    const status =
      Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : /oturum|kullanıcı/i.test(message)
          ? 401
          : 500;

    return json({ ok: false, error: message }, status);
  }
});
