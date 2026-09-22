import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUEST_TIMEOUT_MS = 120_000;
const MIN_STUDY_RADIUS_M = 280;
const MAX_STUDY_RADIUS_M = 2_000;

type Position = [number, number];
type PolygonGeometry = {
  type: 'Polygon';
  coordinates: Position[][];
};
type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: Position[][][];
};
type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

type Candidate = {
  geometry: SupportedGeometry;
  confidence: number | null;
  sourceId: string | null;
  engine: string | null;
  areaM2: number | null;
  containsAnchor: boolean;
  areaDifferenceRatio: number | null;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function validPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = finite(value[0]);
  const lat = finite(value[1]);
  if (
    lng === null ||
    lat === null ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }
  return [lng, lat];
}

function normalizeRing(input: unknown): Position[] | null {
  if (!Array.isArray(input)) return null;
  const ring = input.map(validPosition).filter(Boolean) as Position[];
  if (ring.length < 3) return null;

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }

  return ring.length >= 4 ? ring : null;
}

function normalizeGeometry(input: unknown): SupportedGeometry | null {
  let value: any = input;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const geometry = value?.type === 'Feature' ? value.geometry : value?.geometry ?? value;
  const type = String(geometry?.type ?? '');

  if (type === 'Polygon' && Array.isArray(geometry?.coordinates)) {
    const rings = geometry.coordinates
      .map(normalizeRing)
      .filter(Boolean) as Position[][];
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }

  if (type === 'MultiPolygon' && Array.isArray(geometry?.coordinates)) {
    const polygons = geometry.coordinates
      .map((polygon: unknown) => {
        if (!Array.isArray(polygon)) return null;
        const rings = polygon.map(normalizeRing).filter(Boolean) as Position[][];
        return rings.length ? rings : null;
      })
      .filter(Boolean) as Position[][][];

    return polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null;
  }

  return null;
}

function hasAuthoritativeBoundary(field: any) {
  const geometry = normalizeGeometry(field?.parcel_geometry);
  if (!geometry) return false;

  const source = String(field?.parcel_lookup_source ?? '').toLocaleLowerCase('tr-TR');
  return /tkgm|parsel\s*sorgu|resmi|official/.test(source);
}

function pointInRing(point: Position, ring: Position[]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: Position, polygon: Position[][]) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

function geometryContainsPoint(geometry: SupportedGeometry, point: Position) {
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

function ringAreaM2(ring: Position[]) {
  if (ring.length < 4) return 0;
  const meanLat =
    ring.reduce((sum, [, lat]) => sum + lat, 0) / Math.max(1, ring.length);
  const metersPerLng = 111_320 * Math.cos((meanLat * Math.PI) / 180);
  const metersPerLat = 110_540;

  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area +=
      x1 * metersPerLng * (y2 * metersPerLat) -
      x2 * metersPerLng * (y1 * metersPerLat);
  }

  return Math.abs(area) / 2;
}

function polygonAreaM2(polygon: Position[][]) {
  if (!polygon.length) return 0;
  const outer = ringAreaM2(polygon[0]);
  const holes = polygon.slice(1).reduce((sum, ring) => sum + ringAreaM2(ring), 0);
  return Math.max(0, outer - holes);
}

function geometryAreaM2(geometry: SupportedGeometry) {
  const area =
    geometry.type === 'Polygon'
      ? polygonAreaM2(geometry.coordinates)
      : geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);
  return Number.isFinite(area) && area > 0 ? area : null;
}

function studyRadiusM(areaDecare: number | null) {
  if (areaDecare === null || areaDecare <= 0) return 650;
  const equivalentRadius = Math.sqrt((areaDecare * 1_000) / Math.PI);
  return clamp(equivalentRadius * 4.5, MIN_STUDY_RADIUS_M, MAX_STUDY_RADIUS_M);
}

function bboxAround(latitude: number, longitude: number, radiusM: number) {
  const latDelta = radiusM / 110_540;
  const lngMeters = Math.max(20_000, 111_320 * Math.cos((latitude * Math.PI) / 180));
  const lngDelta = radiusM / lngMeters;

  return [
    Number((longitude - lngDelta).toFixed(7)),
    Number((latitude - latDelta).toFixed(7)),
    Number((longitude + lngDelta).toFixed(7)),
    Number((latitude + latDelta).toFixed(7)),
  ] as [number, number, number, number];
}

function normalizeConfidence(value: unknown) {
  const n = finite(value);
  if (n === null) return null;
  return Number(clamp(n > 1 ? n / 100 : n, 0, 1).toFixed(4));
}

function candidateFeatures(payload: any) {
  if (Array.isArray(payload?.features)) return payload.features;
  if (Array.isArray(payload?.result?.features)) return payload.result.features;
  if (Array.isArray(payload?.candidates)) return payload.candidates;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeCandidates(
  payload: any,
  anchor: Position,
  declaredAreaM2: number | null,
): Candidate[] {
  return candidateFeatures(payload)
    .map((item: any, index: number): Candidate | null => {
      const geometry = normalizeGeometry(item);
      if (!geometry) return null;

      const areaM2 = geometryAreaM2(geometry);
      const areaDifferenceRatio =
        declaredAreaM2 && areaM2
          ? Math.abs(areaM2 - declaredAreaM2) / declaredAreaM2
          : null;

      return {
        geometry,
        confidence: normalizeConfidence(
          item?.properties?.confidence ??
            item?.properties?.score ??
            item?.confidence ??
            item?.score,
        ),
        sourceId: clean(
          item?.properties?.id ?? item?.id ?? item?.properties?.field_id ?? index,
        ),
        engine: clean(
          item?.properties?.['agribound:engine'] ??
            item?.properties?.engine ??
            payload?.engine,
        ),
        areaM2: areaM2 ? Number(areaM2.toFixed(1)) : null,
        containsAnchor: geometryContainsPoint(geometry, anchor),
        areaDifferenceRatio:
          areaDifferenceRatio === null
            ? null
            : Number(areaDifferenceRatio.toFixed(4)),
      };
    })
    .filter(Boolean) as Candidate[];
}

function rankCandidates(candidates: Candidate[]) {
  return [...candidates].sort((a, b) => {
    if (a.containsAnchor !== b.containsAnchor) return a.containsAnchor ? -1 : 1;

    const aArea = a.areaDifferenceRatio ?? Number.POSITIVE_INFINITY;
    const bArea = b.areaDifferenceRatio ?? Number.POSITIVE_INFINITY;
    if (aArea !== bArea) return aArea - bArea;

    return (b.confidence ?? -1) - (a.confidence ?? -1);
  });
}

async function authenticatedClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !authorization) {
    throw new Error('Agribound için sunucu ayarı veya kullanıcı oturumu eksik.');
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    const authError = new Error('Agribound için geçerli kullanıcı oturumu gerekli.');
    (authError as any).status = 401;
    throw authError;
  }

  return { client, user: data.user };
}

async function callWorker(payload: Record<string, unknown>) {
  const workerUrl = clean(Deno.env.get('AGRIBOUND_WORKER_URL'));
  const workerToken = clean(Deno.env.get('AGRIBOUND_WORKER_TOKEN'));

  if (!workerUrl) {
    const error = new Error(
      'Agribound worker henüz yapılandırılmadı. AGRIBOUND_WORKER_URL Supabase secret olarak gerekli.',
    );
    (error as any).status = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(workerToken ? { Authorization: `Bearer ${workerToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text.slice(0, 500) };
    }

    if (!response.ok) {
      const message = clean(body?.error ?? body?.message) ?? `Agribound worker HTTP ${response.status}`;
      const error = new Error(message);
      (error as any).status = 502;
      throw error;
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = clean(body?.field_id ?? body?.fieldId);
    const mode = clean(body?.mode) === 'compare' ? 'compare' : 'missing_only';

    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if (
      'geometry' in body ||
      'parcel_geometry' in body ||
      'bbox' in body ||
      'latitude' in body ||
      'longitude' in body
    ) {
      return json(
        {
          ok: false,
          error:
            'Agribound konum/sınır girdileri istemciden kabul edilmez; kayıtlı tarla verisi sunucudan okunur.',
        },
        400,
      );
    }

    const { client, user } = await authenticatedClient(req);
    const { data: field, error: fieldError } = await client
      .from('fields')
      .select(
        'id,user_id,name,city,district,village,ada,parcel,area_decare,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng,parcel_geometry,parcel_lookup_status,parcel_lookup_source',
      )
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya erişim yetkin yok.' }, 404);

    const existingGeometry = normalizeGeometry(field.parcel_geometry);
    const authoritativeBoundary = hasAuthoritativeBoundary(field);

    if (authoritativeBoundary && mode !== 'compare') {
      return json({
        ok: true,
        status: 'authoritative_boundary_present',
        field_id: fieldId,
        field_name: field.name ?? null,
        source: 'Agribound',
        skipped: true,
        production_authority: false,
        existing_boundary_source: field.parcel_lookup_source ?? null,
        note:
          'TKGM/resmî parsel sınırı mevcut olduğu için Agribound otomatik sınır üretimi çalıştırılmadı. Resmî sınır önceliklidir.',
        generated_at: new Date().toISOString(),
      });
    }

    const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
    const longitude = finite(field.parcel_centroid_lng ?? field.longitude);

    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return json(
        {
          ok: false,
          status: 'missing_anchor',
          error:
            'Otomatik tarla sınırı için güvenilir bir tarla merkezi gerekli. TKGM sınırı bulunmadıysa kullanıcı haritada tarlanın içine bir nokta seçmeli.',
          field_id: fieldId,
          production_authority: false,
        },
        422,
      );
    }

    const areaDecare = finite(field.area_decare);
    const declaredAreaM2 = areaDecare && areaDecare > 0 ? areaDecare * 1_000 : null;
    const radiusM = studyRadiusM(areaDecare);
    const bbox = bboxAround(latitude, longitude, radiusM);
    const year = new Date().getUTCFullYear();

    const workerPayload = {
      request_version: 1,
      request_id: crypto.randomUUID(),
      field_id: fieldId,
      anchor: {
        latitude,
        longitude,
      },
      study_area: {
        bbox,
        radius_m: Number(radiusM.toFixed(1)),
      },
      declared_area_m2: declaredAreaM2,
      preferred_pipeline: {
        source: 'sentinel2',
        engine: 'delineate-anything',
        year,
        lulc_filter: true,
        output_format: 'geojson',
      },
      policy: {
        candidate_only: true,
        never_overwrite_registered_boundary: true,
        official_boundary_priority: true,
      },
    };

    const workerResult = await callWorker(workerPayload);
    const candidates = rankCandidates(
      normalizeCandidates(workerResult, [longitude, latitude], declaredAreaM2),
    );

    const selected = candidates[0] ?? null;
    const selectedAcceptable =
      Boolean(selected?.containsAnchor) &&
      (selected?.areaDifferenceRatio === null || selected.areaDifferenceRatio <= 1.5);

    return json({
      ok: true,
      status: candidates.length ? 'candidates_ready' : 'no_candidate',
      field_id: fieldId,
      field_name: field.name ?? null,
      source: 'Agribound',
      upstream_project: 'montimaj/agribound',
      upstream_license: 'Apache-2.0',
      input_authority: 'server-derived',
      production_authority: false,
      mode,
      anchor: { latitude, longitude },
      study_area: { bbox, radius_m: Number(radiusM.toFixed(1)) },
      declared_area_m2: declaredAreaM2,
      existing_boundary_present: Boolean(existingGeometry),
      existing_boundary_authoritative: authoritativeBoundary,
      existing_boundary_source: field.parcel_lookup_source ?? null,
      selected_candidate: selectedAcceptable ? selected : null,
      candidate_count: candidates.length,
      candidates: candidates.slice(0, 12),
      auto_apply_allowed: false,
      warnings: [
        'Agribound sonucu yalnız aday sınırdır; TKGM/resmî parsel sınırının yerine otomatik olarak yazılmaz.',
        'Uydu tabanlı sınır belirleme; görüntü tarihi, ürün örtüsü, komşu parseller ve model hatalarından etkilenebilir.',
        selected && !selected.containsAnchor
          ? 'En güçlü aday tarla merkez noktasını içermediği için otomatik seçim yapılmadı.'
          : null,
        selected?.areaDifferenceRatio !== null && selected?.areaDifferenceRatio !== undefined && selected.areaDifferenceRatio > 1.5
          ? 'Aday sınırın alanı kayıtlı tarla alanından çok farklı olduğu için otomatik seçim yapılmadı.'
          : null,
      ].filter(Boolean),
      evidence: [
        'Tarla merkezi ve kayıtlı alan sunucu tarafındaki fields kaydından okundu.',
        `Çalışma alanı tarla merkezinin çevresinde yaklaşık ${Math.round(radiusM)} m yarıçapla oluşturuldu.`,
        'Agribound worker Sentinel-2 + tarla sınırı delineation sözleşmesiyle çağrıldı.',
        'Sonuçlar yalnız Polygon/MultiPolygon adayları olarak doğrulandı ve tarla merkezini içerme/alan tutarlılığına göre sıralandı.',
      ],
      worker: {
        engine: clean(workerResult?.engine) ?? selected?.engine ?? null,
        version: clean(workerResult?.version ?? workerResult?.agribound_version),
        generated_at: clean(workerResult?.generated_at),
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agribound sınır isteği başarısız oldu.';
    console.error('[agribound-boundary]', message);

    const explicitStatus = Number((error as any)?.status);
    const status =
      Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : /oturum|kullanıcı/i.test(message)
          ? 401
          : 500;

    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
