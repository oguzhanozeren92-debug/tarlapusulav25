export type HydroRiverContext = {
  ok: boolean;
  source: 'HydroSHEDS HydroRIVERS v1';
  provider: string;
  providerAuthority: 'reference-mirror';
  riverId: string | null;
  mainRiverId: string | null;
  nextDownRiverId: string | null;
  distanceM: number | null;
  reachLengthKm: number | null;
  catchmentAreaKm2: number | null;
  upstreamAreaKm2: number | null;
  averageDischargeM3s: number | null;
  strahlerOrder: number | null;
  riverClass: number | null;
  flowOrder: number | null;
  endorheic: boolean | null;
  confidence: 'low' | 'medium';
  warnings: string[];
};

export type JrcSurfaceWaterHistoryContext = {
  ok: boolean;
  source: 'JRC Global Surface Water Recurrence';
  datasetVersion: 'analysis snapshot 1984-2021';
  latestDatasetAvailable: 'GSW v1.5 · 1984-2024';
  provider: string;
  providerAuthority: 'jrc-arcgis-analysis';
  spatialResolutionM: 30;
  method: 'point-neighborhood-sampling';
  latitude: number;
  longitude: number;
  sampleRadiusM: 500;
  totalSamples: number;
  validSamples: number;
  centerRecurrencePct: number | null;
  meanRecurrencePct: number | null;
  maxRecurrencePct: number | null;
  nearestSampledHistoricalWaterM: number | null;
  waterSignal:
    | 'none'
    | 'episodic'
    | 'recurring'
    | 'persistent'
    | 'unknown';
  confidence: 'low' | 'medium';
  warnings: string[];
  generatedAt: string;
};

export type HydroBasinContext = {
  ok: boolean;
  source: 'HydroSHEDS HydroBASINS v1';
  provider: string;
  providerAuthority: 'reference-mirror';
  datasetResolution: '15 arc-second';
  latitude: number;
  longitude: number;
  basinLevel: 7 | 8 | null;
  basinId: string | null;
  mainBasinId: string | null;
  nextDownBasinId: string | null;
  pfafstetterId: string | null;
  subBasinAreaKm2: number | null;
  upstreamAreaKm2: number | null;
  distanceToSinkKm: number | null;
  distanceToMainOutletKm: number | null;
  endorheic: boolean | null;
  coastal: boolean | null;
  surfaceWaterHistory: JrcSurfaceWaterHistoryContext | null;
  nearestRiver: HydroRiverContext | null;
  scope: 'catchment-context';
  confidence: 'low' | 'medium';
  warnings: string[];
  generatedAt: string;
};

type FeatureAttributes = Record<string, unknown>;

const PRIMARY_SERVICE =
  'https://services3.arcgis.com/AdYB7LvDmN7hzWUb/arcgis/rest/services/Hydrobasins/FeatureServer/5';
const FALLBACK_SERVICE =
  'https://services.arcgis.com/F7DSX1DSNSiWmOqh/arcgis/rest/services/Global_database_FINAL/FeatureServer/0';
const HYDRORIVERS_SERVICE =
  'https://maps.fsc.org/server/rest/services/Hosted/Optimized_Hyrdo/FeatureServer/0';
const JRC_RECURRENCE_ARCGIS_ITEM_ID =
  '4e5a7b42d21843c280bd72568da82013';
const JRC_RECURRENCE_FALLBACK_SERVICE =
  'https://di-jrcglobaldatadev.img.arcgis.com/arcgis/rest/services/Recurrence/ImageServer';
let resolvedJrcRecurrenceService: string | null = null;

const CACHE_PREFIX = 'tp_hydrobasins_context_v3:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const result = String(value).trim();
  return result || null;
}

function pickAttribute(
  attributes: FeatureAttributes,
  names: string[],
): unknown {
  const normalized = new Map(
    Object.entries(attributes).map(([key, value]) => [
      key.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, ''),
      value,
    ]),
  );

  for (const name of names) {
    const key = name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
    if (normalized.has(key)) return normalized.get(key);
  }

  return null;
}

function idValue(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return String(Math.trunc(numeric));
  }

  return raw;
}

function flagValue(value: unknown): boolean | null {
  const numeric = finite(value);
  if (numeric !== null) {
    if (numeric === 0) return false;
    if (numeric > 0) return true;
  }

  const raw = text(value)?.toLocaleLowerCase('en-US');
  if (!raw) return null;
  if (['true', 'yes', 'y'].includes(raw)) return true;
  if (['false', 'no', 'n'].includes(raw)) return false;
  return null;
}

function cacheKey(latitude: number, longitude: number) {
  return `${CACHE_PREFIX}${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

function readCache(
  latitude: number,
  longitude: number,
): HydroBasinContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: HydroBasinContext;
    };

    if (!parsed.savedAt || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(
  latitude: number,
  longitude: number,
  data: HydroBasinContext,
) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      cacheKey(latitude, longitude),
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Hydrology provider HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (payload?.error) {
      throw new Error(
        String(
          payload.error?.message ??
            payload.error?.details?.[0] ??
            'Hydrology provider hata döndürdü.',
        ),
      );
    }

    return payload;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function queryPoint(
  serviceRoot: string,
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: '1',
    f: 'json',
  });

  const payload = await fetchJson(
    `${serviceRoot}/query?${params.toString()}`,
    signal,
  );

  const features = Array.isArray(payload?.features)
    ? payload.features
    : [];

  const attributes = features[0]?.attributes;
  return attributes && typeof attributes === 'object'
    ? (attributes as FeatureAttributes)
    : null;
}


function localPoint(
  longitude: number,
  latitude: number,
  originLongitude: number,
  originLatitude: number,
) {
  const latRad = (originLatitude * Math.PI) / 180;
  return {
    x: (longitude - originLongitude) * 111_320 * Math.cos(latRad),
    y: (latitude - originLatitude) * 110_540,
  };
}

function distancePointToSegmentM(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  );
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function distanceToPolylineM(
  geometry: unknown,
  latitude: number,
  longitude: number,
) {
  const paths = (geometry as any)?.paths;
  if (!Array.isArray(paths)) return null;

  let best = Number.POSITIVE_INFINITY;

  for (const path of paths) {
    if (!Array.isArray(path) || path.length < 2) continue;

    for (let index = 1; index < path.length; index += 1) {
      const a = path[index - 1];
      const b = path[index];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;

      const aLocal = localPoint(Number(a[0]), Number(a[1]), longitude, latitude);
      const bLocal = localPoint(Number(b[0]), Number(b[1]), longitude, latitude);

      if (
        !Number.isFinite(aLocal.x) ||
        !Number.isFinite(aLocal.y) ||
        !Number.isFinite(bLocal.x) ||
        !Number.isFinite(bLocal.y)
      ) {
        continue;
      }

      best = Math.min(
        best,
        distancePointToSegmentM(0, 0, aLocal.x, aLocal.y, bLocal.x, bLocal.y),
      );
    }
  }

  return Number.isFinite(best) ? Math.round(best) : null;
}

async function queryNearbyRivers(
  latitude: number,
  longitude: number,
  radiusM: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(radiusM),
    units: 'esriSRUnit_Meter',
    outFields:
      'hyriv_id,next_down,main_riv,length_km,catch_skm,upland_skm,endorheic,dis_av_cms,ord_stra,ord_clas,ord_flow,dist_dn_km,dist_up_km,hybas_l12',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '100',
    f: 'json',
  });

  const payload = await fetchJson(
    `${HYDRORIVERS_SERVICE}/query?${params.toString()}`,
    signal,
  );

  return Array.isArray(payload?.features) ? payload.features : [];
}

async function fetchNearestRiverContext(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<HydroRiverContext | null> {
  let features = await queryNearbyRivers(latitude, longitude, 20_000, signal);
  if (!features.length) {
    features = await queryNearbyRivers(latitude, longitude, 50_000, signal);
  }
  if (!features.length) return null;

  let best: { feature: any; distanceM: number } | null = null;

  for (const feature of features) {
    const distanceM = distanceToPolylineM(
      feature?.geometry,
      latitude,
      longitude,
    );
    if (distanceM === null) continue;
    if (!best || distanceM < best.distanceM) {
      best = { feature, distanceM };
    }
  }

  if (!best) return null;

  const attributes =
    best.feature?.attributes && typeof best.feature.attributes === 'object'
      ? (best.feature.attributes as FeatureAttributes)
      : {};

  const riverId = idValue(
    pickAttribute(attributes, ['HYRIV_ID', 'HYRIVID', 'RIVER_ID']),
  );
  const mainRiverId = idValue(
    pickAttribute(attributes, ['MAIN_RIV', 'MAINRIV']),
  );
  const nextDownRiverId = idValue(
    pickAttribute(attributes, ['NEXT_DOWN', 'NEXTDOWN']),
  );
  const reachLengthKm = finite(
    pickAttribute(attributes, ['LENGTH_KM', 'LENGTHKM']),
  );
  const catchmentAreaKm2 = finite(
    pickAttribute(attributes, ['CATCH_SKM', 'CATCHSKM']),
  );
  const upstreamAreaKm2 = finite(
    pickAttribute(attributes, ['UPLAND_SKM', 'UPLANDSKM']),
  );
  const averageDischargeM3s = finite(
    pickAttribute(attributes, ['DIS_AV_CMS', 'DISAVCMS']),
  );
  const strahlerOrder = finite(
    pickAttribute(attributes, ['ORD_STRA', 'ORDSTRA']),
  );
  const riverClass = finite(
    pickAttribute(attributes, ['ORD_CLAS', 'ORDCLAS']),
  );
  const flowOrder = finite(
    pickAttribute(attributes, ['ORD_FLOW', 'ORDFLOW']),
  );
  const endorheic = flagValue(
    pickAttribute(attributes, ['ENDORHEIC']),
  );

  const warnings = [
    'HydroRIVERS ana akış ağı bağlamıdır; tarla içi hendek, drenaj kanalı veya küçük dereyi atlayabilir.',
    'En yakın akış koluna mesafe yaklaşık geometri hesabıdır; arazi ölçümü değildir.',
    'Debi değeri uzun dönem model bağlamıdır; anlık nehir debisi değildir.',
    'Canlı sorgu üçüncü taraf ArcGIS aynasından yapılır; üretimde resmi HydroSHEDS verisinin yerel kopyası tercih edilmelidir.',
  ];

  return {
    ok: Boolean(riverId),
    source: 'HydroSHEDS HydroRIVERS v1',
    provider: 'FSC ArcGIS HydroRIVERS global mirror',
    providerAuthority: 'reference-mirror',
    riverId,
    mainRiverId,
    nextDownRiverId,
    distanceM: best.distanceM,
    reachLengthKm,
    catchmentAreaKm2,
    upstreamAreaKm2,
    averageDischargeM3s,
    strahlerOrder:
      strahlerOrder === null ? null : Math.round(strahlerOrder),
    riverClass: riverClass === null ? null : Math.round(riverClass),
    flowOrder: flowOrder === null ? null : Math.round(flowOrder),
    endorheic,
    confidence: riverId && best.distanceM <= 20_000 ? 'medium' : 'low',
    warnings,
  };
}

function offsetPoint(
  latitude: number,
  longitude: number,
  northM: number,
  eastM: number,
) {
  const latDelta = northM / 110_540;
  const lonScale = Math.max(
    1,
    111_320 * Math.cos((latitude * Math.PI) / 180),
  );
  const lonDelta = eastM / lonScale;

  return {
    latitude: latitude + latDelta,
    longitude: longitude + lonDelta,
    distanceM: Math.round(Math.hypot(northM, eastM)),
  };
}

function parseImageServerValue(payload: any) {
  const direct = finite(payload?.value);
  if (direct !== null) return direct;

  const candidates = [
    payload?.properties?.Value,
    payload?.properties?.value,
    payload?.properties?.Values,
    payload?.properties?.values,
    payload?.catalogItems?.features?.[0]?.attributes?.Value,
    payload?.catalogItems?.features?.[0]?.attributes?.value,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const value = finite(item);
        if (value !== null) return value;
      }
      continue;
    }

    if (typeof candidate === 'string' && candidate.includes(',')) {
      for (const item of candidate.split(',')) {
        const value = finite(item.trim());
        if (value !== null) return value;
      }
      continue;
    }

    const value = finite(candidate);
    if (value !== null) return value;
  }

  return null;
}

async function resolveJrcRecurrenceServiceRoot(
  signal?: AbortSignal,
) {
  if (resolvedJrcRecurrenceService) {
    return resolvedJrcRecurrenceService;
  }

  const configured = String(
    (import.meta as any)?.env?.VITE_JRC_GSW_RECURRENCE_IMAGE_SERVICE ?? '',
  ).trim();

  if (configured) {
    resolvedJrcRecurrenceService = configured.replace(/\/$/, '');
    return resolvedJrcRecurrenceService;
  }

  try {
    const payload = await fetchJson(
      `https://www.arcgis.com/sharing/rest/content/items/${JRC_RECURRENCE_ARCGIS_ITEM_ID}?f=json`,
      signal,
    );
    const serviceUrl = text(payload?.url);

    if (serviceUrl && /ImageServer/i.test(serviceUrl)) {
      resolvedJrcRecurrenceService = serviceUrl.replace(/\/$/, '');
      return resolvedJrcRecurrenceService;
    }
  } catch {
    // Metadata çözümleme başarısızsa bilinen analiz servisine düş.
  }

  resolvedJrcRecurrenceService = JRC_RECURRENCE_FALLBACK_SERVICE;
  return resolvedJrcRecurrenceService;
}

async function queryJrcRecurrencePoint(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({
      x: longitude,
      y: latitude,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: 'esriGeometryPoint',
    returnGeometry: 'false',
    returnCatalogItems: 'false',
    renderingRule: JSON.stringify({ rasterFunction: 'None' }),
    f: 'json',
  });

  const serviceRoot = await resolveJrcRecurrenceServiceRoot(signal);
  const payload = await fetchJson(
    `${serviceRoot}/identify?${params.toString()}`,
    signal,
  );

  const value = parseImageServerValue(payload);
  if (value === null || value === 255) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

function classifyHistoricalWater(
  maxRecurrencePct: number | null,
): JrcSurfaceWaterHistoryContext['waterSignal'] {
  if (maxRecurrencePct === null) return 'unknown';
  if (maxRecurrencePct <= 0) return 'none';
  if (maxRecurrencePct < 30) return 'episodic';
  if (maxRecurrencePct < 70) return 'recurring';
  return 'persistent';
}

async function fetchJrcSurfaceWaterHistoryContext(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<JrcSurfaceWaterHistoryContext | null> {
  const points = [
    offsetPoint(latitude, longitude, 0, 0),
    offsetPoint(latitude, longitude, 150, 0),
    offsetPoint(latitude, longitude, -150, 0),
    offsetPoint(latitude, longitude, 0, 150),
    offsetPoint(latitude, longitude, 0, -150),
    offsetPoint(latitude, longitude, 500, 0),
    offsetPoint(latitude, longitude, -500, 0),
    offsetPoint(latitude, longitude, 0, 500),
    offsetPoint(latitude, longitude, 0, -500),
  ];

  const settled = await Promise.allSettled(
    points.map((point) =>
      queryJrcRecurrencePoint(
        point.latitude,
        point.longitude,
        signal,
      ),
    ),
  );

  const values = settled.map((result) =>
    result.status === 'fulfilled' ? result.value : null,
  );

  const valid = values
    .map((value, index) => ({ value, distanceM: points[index].distanceM }))
    .filter(
      (entry): entry is { value: number; distanceM: number } =>
        entry.value !== null && Number.isFinite(entry.value),
    );

  if (!valid.length) return null;

  const centerRecurrencePct = values[0] ?? null;
  const meanRecurrencePct =
    valid.reduce((sum, entry) => sum + entry.value, 0) / valid.length;
  const maxRecurrencePct = Math.max(...valid.map((entry) => entry.value));
  const waterSamples = valid.filter((entry) => entry.value > 0);
  const nearestSampledHistoricalWaterM = waterSamples.length
    ? Math.min(...waterSamples.map((entry) => entry.distanceM))
    : null;

  const warnings = [
    'JRC Global Surface Water geçmiş su davranışını gösterir; bugünkü su birikimi veya gelecek taşkını göstermez.',
    '30 m raster üzerinde merkez ve yakın çevrede örnekleme yapılır; tüm parselin piksel-piksel alan istatistiği değildir.',
    'Düşük recurrence değeri epizodik/geçici su sinyalidir; tek başına drenaj arızası veya taşkın riski anlamına gelmez.',
    'Canlı analiz ucu 1984-2021 analysis-optimized recurrence snapshot kullanır; resmi JRC GSW v1.5 1984-2024 sürümü yayımlanmıştır ve üretim backendine geçirilecektir.',
  ];

  return {
    ok: true,
    source: 'JRC Global Surface Water Recurrence',
    datasetVersion: 'analysis snapshot 1984-2021',
    latestDatasetAvailable: 'GSW v1.5 · 1984-2024',
    provider: 'EC JRC ArcGIS analysis image service',
    providerAuthority: 'jrc-arcgis-analysis',
    spatialResolutionM: 30,
    method: 'point-neighborhood-sampling',
    latitude,
    longitude,
    sampleRadiusM: 500,
    totalSamples: points.length,
    validSamples: valid.length,
    centerRecurrencePct:
      centerRecurrencePct === null
        ? null
        : Math.round(centerRecurrencePct * 10) / 10,
    meanRecurrencePct:
      Math.round(meanRecurrencePct * 10) / 10,
    maxRecurrencePct:
      Math.round(maxRecurrencePct * 10) / 10,
    nearestSampledHistoricalWaterM,
    waterSignal: classifyHistoricalWater(maxRecurrencePct),
    confidence: valid.length >= 7 ? 'medium' : 'low',
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function normalizeContext(
  attributes: FeatureAttributes,
  latitude: number,
  longitude: number,
  provider: string,
  basinLevel: 7 | 8,
  nearestRiver: HydroRiverContext | null,
  surfaceWaterHistory: JrcSurfaceWaterHistoryContext | null,
): HydroBasinContext {
  const basinId = idValue(
    pickAttribute(attributes, [
      'HYBAS_ID',
      'HYBASID',
      'BASINID',
      'BASIN_ID',
      'BasinID',
    ]),
  );

  const mainBasinId = idValue(
    pickAttribute(attributes, ['MAIN_BAS', 'MAINBAS', 'MAIN_BASIN']),
  );

  const nextDownBasinId = idValue(
    pickAttribute(attributes, ['NEXT_DOWN', 'NEXTDOWN', 'DOWNSTREAM_ID']),
  );

  const pfafstetterId = idValue(
    pickAttribute(attributes, ['PFAF_ID', 'PFAFID', 'PFAFSTETTER']),
  );

  const subBasinAreaKm2 = finite(
    pickAttribute(attributes, ['SUB_AREA', 'SUBAREA', 'AREA_KM2']),
  );

  const upstreamAreaKm2 = finite(
    pickAttribute(attributes, ['UP_AREA', 'UPAREA', 'UPSTREAM_AREA']),
  );

  const distanceToSinkKm = finite(
    pickAttribute(attributes, ['DIST_SINK', 'DISTSINK']),
  );

  const distanceToMainOutletKm = finite(
    pickAttribute(attributes, ['DIST_MAIN', 'DISTMAIN']),
  );

  const endorheic = flagValue(
    pickAttribute(attributes, ['ENDO', 'ENDORHEIC']),
  );

  const coastal = flagValue(
    pickAttribute(attributes, ['COAST', 'COASTAL']),
  );

  const detailCount = [
    mainBasinId,
    nextDownBasinId,
    pfafstetterId,
    subBasinAreaKm2,
    upstreamAreaKm2,
    distanceToSinkKm,
    distanceToMainOutletKm,
    endorheic,
    coastal,
    nearestRiver?.riverId ?? null,
    nearestRiver?.distanceM ?? null,
    surfaceWaterHistory?.maxRecurrencePct ?? null,
  ].filter((value) => value !== null).length;

  const warnings = [
    'HydroBASINS yaklaşık 15 arc-second (~500 m) havza bağlamıdır; parsel içi mikro drenaj ölçümü değildir.',
    'Bu sonuç taşkın veya mevcut yüzey suyu tespiti değildir.',
    'Tarla ölçeğinde karar için DEM, güncel radar/uydu ve saha gözlemi ile birlikte yorumlanmalıdır.',
    'Canlı sorgu üçüncü taraf ArcGIS aynasından yapılır; üretimde resmi HydroSHEDS verisinin yerel kopyası tercih edilmelidir.',
    nearestRiver
      ? 'Yakındaki ana akış kolu HydroRIVERS ile ayrıca eşleştirildi.'
      : 'Yakındaki HydroRIVERS ana akış kolu bu sorguda bulunamadı.',
    surfaceWaterHistory
      ? 'JRC geçmiş yüzey suyu recurrence bağlamı görünmeden Pusula kanıtlarına eklendi.'
      : 'JRC geçmiş yüzey suyu recurrence bağlamı bu sorguda alınamadı.',
  ];

  return {
    ok: Boolean(basinId),
    source: 'HydroSHEDS HydroBASINS v1',
    provider,
    providerAuthority: 'reference-mirror',
    datasetResolution: '15 arc-second',
    latitude,
    longitude,
    basinLevel,
    basinId,
    mainBasinId,
    nextDownBasinId,
    pfafstetterId,
    subBasinAreaKm2,
    upstreamAreaKm2,
    distanceToSinkKm,
    distanceToMainOutletKm,
    endorheic,
    coastal,
    surfaceWaterHistory,
    nearestRiver,
    scope: 'catchment-context',
    confidence: detailCount >= 3 ? 'medium' : 'low',
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function unavailable(
  latitude: number,
  longitude: number,
  warning: string,
): HydroBasinContext {
  return {
    ok: false,
    source: 'HydroSHEDS HydroBASINS v1',
    provider: 'unavailable',
    providerAuthority: 'reference-mirror',
    datasetResolution: '15 arc-second',
    latitude,
    longitude,
    basinLevel: null,
    basinId: null,
    mainBasinId: null,
    nextDownBasinId: null,
    pfafstetterId: null,
    subBasinAreaKm2: null,
    upstreamAreaKm2: null,
    distanceToSinkKm: null,
    distanceToMainOutletKm: null,
    endorheic: null,
    coastal: null,
    surfaceWaterHistory: null,
    nearestRiver: null,
    scope: 'catchment-context',
    confidence: 'low',
    warnings: [warning],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchHydroBasinContext(
  latitude: number,
  longitude: number,
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
): Promise<HydroBasinContext> {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return unavailable(
      latitude,
      longitude,
      'HydroBASINS için geçerli tarla koordinatı gerekli.',
    );
  }

  if (!options?.forceRefresh) {
    const cached = readCache(latitude, longitude);
    if (cached) return cached;
  }

  const providers: Array<{
    url: string;
    label: string;
    basinLevel: 7 | 8;
  }> = [
    {
      url: PRIMARY_SERVICE,
      label: 'ArcGIS Hydrobasins Level 7 mirror',
      basinLevel: 7,
    },
    {
      url: FALLBACK_SERVICE,
      label: 'ArcGIS HydroBASINS Level 8 mirror',
      basinLevel: 8,
    },
  ];

  const errors: string[] = [];
  let nearestRiver: HydroRiverContext | null = null;
  let riverChecked = false;
  let surfaceWaterHistory: JrcSurfaceWaterHistoryContext | null = null;
  let waterHistoryChecked = false;

  const getNearestRiver = async () => {
    if (riverChecked) return nearestRiver;
    riverChecked = true;
    try {
      nearestRiver = await fetchNearestRiverContext(
        latitude,
        longitude,
        options?.signal,
      );
    } catch (error) {
      errors.push(
        `HydroRIVERS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      nearestRiver = null;
    }
    return nearestRiver;
  };

  const getSurfaceWaterHistory = async () => {
    if (waterHistoryChecked) return surfaceWaterHistory;
    waterHistoryChecked = true;

    try {
      surfaceWaterHistory = await fetchJrcSurfaceWaterHistoryContext(
        latitude,
        longitude,
        options?.signal,
      );
    } catch (error) {
      errors.push(
        `JRC GSW: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      surfaceWaterHistory = null;
    }

    return surfaceWaterHistory;
  };

  for (const provider of providers) {
    try {
      const attributes = await queryPoint(
        provider.url,
        latitude,
        longitude,
        options?.signal,
      );

      if (!attributes) {
        errors.push(`${provider.label}: parsel noktası için havza kaydı bulunamadı.`);
        continue;
      }

      const [river, waterHistory] = await Promise.all([
        getNearestRiver(),
        getSurfaceWaterHistory(),
      ]);

      const result = normalizeContext(
        attributes,
        latitude,
        longitude,
        provider.label,
        provider.basinLevel,
        river,
        waterHistory,
      );

      if (!result.ok) {
        errors.push(`${provider.label}: havza kimliği okunamadı.`);
        continue;
      }

      writeCache(latitude, longitude, result);
      return result;
    } catch (error) {
      errors.push(
        `${provider.label}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const [river, waterHistory] = await Promise.all([
    getNearestRiver(),
    getSurfaceWaterHistory(),
  ]);

  const result = unavailable(
    latitude,
    longitude,
    errors.slice(0, 2).join(' | ') || 'HydroBASINS verisi alınamadı.',
  );

  result.nearestRiver = river;
  result.surfaceWaterHistory = waterHistory;
  result.ok = Boolean(river?.ok || waterHistory?.ok);

  if (result.ok) {
    result.provider = 'partial hydrology context';
    result.warnings.push(
      'HydroBASINS havza eşleşmesi alınamadı; yalnız kullanılabilen HydroRIVERS/JRC kanıtları tutuldu.',
    );
  }

  writeCache(latitude, longitude, result);
  return result;
}
