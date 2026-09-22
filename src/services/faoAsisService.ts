export type FaoAsisStressClass =
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'no_fao_drought_threshold'
  | 'unavailable';

export type FaoAsisPointContext = {
  ok: boolean;
  source: 'FAO GIEWS ASIS';
  dataset: 'Vegetation Health Index (VHI) - Near Real Time (Dekadal)';
  license: 'CC BY 4.0';
  spatialResolutionMeters: 1000;
  latitude: number;
  longitude: number;
  rasterId: number | null;
  rasterName: string | null;
  year: number | null;
  yearDekad: string | null;
  dekad: string | null;
  value: number | null;
  stressClass: FaoAsisStressClass;
  label: string;
  observedAt: string | null;
  scope: 'regional-remote-context';
  warnings: string[];
  generatedAt: string;
};

type RasterCatalogItem = {
  OBJECTID?: unknown;
  Name?: unknown;
  Variable?: unknown;
  Year?: unknown;
  Year_Dekad?: unknown;
  Dekad?: unknown;
};

const SERVICE_ROOT =
  'https://asis-esri.fao.org/image/rest/services/VHI_D/ImageServer';

const CACHE_PREFIX = 'tp_fao_asis_vhi_v1:';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 18_000;

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function normalizeVhi(value: unknown): number | null {
  const parsed = finite(value);
  if (parsed === null) return null;
  if (parsed < 0 || parsed > 100) return null;
  return Number(parsed.toFixed(2));
}

export function classifyFaoAsisVhi(
  value: number | null,
): {
  stressClass: FaoAsisStressClass;
  label: string;
} {
  if (value === null || !Number.isFinite(value)) {
    return {
      stressClass: 'unavailable',
      label: 'FAO ASIS VHI verisi yok',
    };
  }

  if (value < 25) {
    return {
      stressClass: 'extreme',
      label: 'FAO ASIS: aşırı kuraklık eşiği',
    };
  }

  if (value < 35) {
    return {
      stressClass: 'severe',
      label: 'FAO ASIS: şiddetli kuraklık eşiği',
    };
  }

  if (value < 38) {
    return {
      stressClass: 'moderate',
      label: 'FAO ASIS: orta kuraklık eşiği',
    };
  }

  return {
    stressClass: 'no_fao_drought_threshold',
    label: 'FAO ASIS: VHI kuraklık eşiği altında değil',
  };
}

function cacheKey(latitude: number, longitude: number) {
  return `${CACHE_PREFIX}${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

function readCache(
  latitude: number,
  longitude: number,
): FaoAsisPointContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: FaoAsisPointContext;
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
  data: FaoAsisPointContext,
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
    // Cache is only an optimization.
  }
}

async function fetchJson(
  url: string,
  externalSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const abort = () => controller.abort();
  externalSignal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`FAO ASIS servisi HTTP ${response.status} hatası verdi.`);
    }

    const payload = await response.json();

    if (payload?.error) {
      throw new Error(
        String(
          payload.error?.message ??
            payload.error?.details?.[0] ??
            'FAO ASIS servisi hata döndürdü.',
        ),
      );
    }

    return payload;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abort);
  }
}

function yearDekadRank(item: RasterCatalogItem) {
  const raw = text(item.Year_Dekad) ?? '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length >= 5) {
    const numeric = Number(digits);
    if (Number.isFinite(numeric)) return numeric;
  }

  const year = finite(item.Year) ?? 0;
  const dekadRaw = text(item.Dekad) ?? '';
  const dekadDigits = dekadRaw.replace(/\D/g, '');
  const dekad = Number(dekadDigits) || 0;

  return year * 100 + dekad;
}

async function queryLatestRaster(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<RasterCatalogItem | null> {
  const currentYear = new Date().getUTCFullYear();

  const params = new URLSearchParams({
    where: `Year >= ${currentYear - 1}`,
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'OBJECTID,Name,Variable,Year,Year_Dekad,Dekad',
    returnGeometry: 'false',
    resultRecordCount: '100',
    f: 'json',
  });

  let payload: any;

  try {
    payload = await fetchJson(`${SERVICE_ROOT}/query?${params.toString()}`, signal);
  } catch (error) {
    const fallback = new URLSearchParams({
      where: '1=1',
      geometry: `${longitude},${latitude}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'false',
      resultRecordCount: '1000',
      f: 'json',
    });

    payload = await fetchJson(
      `${SERVICE_ROOT}/query?${fallback.toString()}`,
      signal,
    );

    if (!payload?.features?.length) throw error;
  }

  const features = Array.isArray(payload?.features)
    ? payload.features
    : [];

  const rows = features
    .map((feature: any) => feature?.attributes ?? null)
    .filter(Boolean) as RasterCatalogItem[];

  if (!rows.length) return null;

  return [...rows].sort((a, b) => {
    const rankDiff = yearDekadRank(b) - yearDekadRank(a);
    if (rankDiff !== 0) return rankDiff;

    return (finite(b.OBJECTID) ?? 0) - (finite(a.OBJECTID) ?? 0);
  })[0] ?? null;
}

function findPixelValue(payload: any): number | null {
  const candidates: unknown[] = [
    payload?.value,
    payload?.pixel?.value,
    payload?.properties?.Value,
    payload?.properties?.value,
    payload?.properties?.Values?.[0],
    payload?.properties?.values?.[0],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeVhi(candidate);
    if (normalized !== null) return normalized;
  }

  return null;
}

async function identifyRasterValue(
  latitude: number,
  longitude: number,
  rasterId: number,
  signal?: AbortSignal,
) {
  const mosaicRule = {
    mosaicMethod: 'esriMosaicLockRaster',
    lockRasterIds: [rasterId],
    mosaicOperation: 'MT_FIRST',
  };

  const geometry = {
    x: longitude,
    y: latitude,
    spatialReference: {
      wkid: 4326,
    },
  };

  const params = new URLSearchParams({
    geometry: JSON.stringify(geometry),
    geometryType: 'esriGeometryPoint',
    mosaicRule: JSON.stringify(mosaicRule),
    returnGeometry: 'false',
    returnCatalogItems: 'false',
    f: 'json',
  });

  const payload = await fetchJson(
    `${SERVICE_ROOT}/identify?${params.toString()}`,
    signal,
  );

  return findPixelValue(payload);
}

function buildUnavailable(
  latitude: number,
  longitude: number,
  warning: string,
): FaoAsisPointContext {
  return {
    ok: false,
    source: 'FAO GIEWS ASIS',
    dataset: 'Vegetation Health Index (VHI) - Near Real Time (Dekadal)',
    license: 'CC BY 4.0',
    spatialResolutionMeters: 1000,
    latitude,
    longitude,
    rasterId: null,
    rasterName: null,
    year: null,
    yearDekad: null,
    dekad: null,
    value: null,
    stressClass: 'unavailable',
    label: 'FAO ASIS VHI verisi yok',
    observedAt: null,
    scope: 'regional-remote-context',
    warnings: [warning],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchFaoAsisPointContext(
  latitude: number,
  longitude: number,
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
): Promise<FaoAsisPointContext> {
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return buildUnavailable(
      latitude,
      longitude,
      'FAO ASIS için geçerli tarla koordinatı gerekli.',
    );
  }

  if (!options?.forceRefresh) {
    const cached = readCache(latitude, longitude);
    if (cached) return cached;
  }

  try {
    const latest = await queryLatestRaster(
      latitude,
      longitude,
      options?.signal,
    );

    const rasterId = finite(latest?.OBJECTID);

    if (!latest || rasterId === null) {
      return buildUnavailable(
        latitude,
        longitude,
        'FAO ASIS VHI raster kataloğunda bu konum için yakın dönem veri bulunamadı.',
      );
    }

    const value = await identifyRasterValue(
      latitude,
      longitude,
      rasterId,
      options?.signal,
    );

    const classification = classifyFaoAsisVhi(value);
    const year = finite(latest.Year);
    const yearDekad = text(latest.Year_Dekad);
    const dekad = text(latest.Dekad);

    const result: FaoAsisPointContext = {
      ok: value !== null,
      source: 'FAO GIEWS ASIS',
      dataset: 'Vegetation Health Index (VHI) - Near Real Time (Dekadal)',
      license: 'CC BY 4.0',
      spatialResolutionMeters: 1000,
      latitude,
      longitude,
      rasterId,
      rasterName: text(latest.Name),
      year,
      yearDekad,
      dekad,
      value,
      stressClass: classification.stressClass,
      label: classification.label,
      observedAt:
        yearDekad ??
        (year !== null && dekad ? `${year} · ${dekad}` : year !== null ? String(year) : null),
      scope: 'regional-remote-context',
      warnings: [
        'FAO ASIS VHI yaklaşık 1 km çözünürlüklü bölgesel/uzaktan algılama bağlamıdır; tek parsel teşhisi değildir.',
        'VHI, VCI ve sıcaklık koşulu bileşenlerini birleştirir; TarlaPusula Sentinel-2 parsel NDVI ölçümünün yerine geçmez.',
      ],
      generatedAt: new Date().toISOString(),
    };

    writeCache(latitude, longitude, result);
    return result;
  } catch (error) {
    return buildUnavailable(
      latitude,
      longitude,
      error instanceof Error
        ? error.message
        : 'FAO ASIS VHI bağlamı alınamadı.',
    );
  }
}
