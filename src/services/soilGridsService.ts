import { supabase } from '../supabaseClient';

export type SoilGridsPropertyKey =
  | 'phh2o'
  | 'soc'
  | 'clay'
  | 'sand'
  | 'silt';

export type SoilGridsDepth =
  | '0-5cm'
  | '5-15cm'
  | '15-30cm'
  | '30-60cm'
  | '60-100cm'
  | '100-200cm';

export type SoilGridsLayerValue = {
  property: SoilGridsPropertyKey;
  depth: SoilGridsDepth;
  rawValue: number | null;
  value: number | null;
  unit: string;
  coverageId: string;
  sourceUrl?: string;
};

export type SoilGridsPropertyProfile = {
  key: SoilGridsPropertyKey;
  label: string;
  unit: string;
  layers: SoilGridsLayerValue[];
  topsoil0To30: number | null;
};

export type SoilGridsProfile = {
  success: true;
  source: 'SoilGrids';
  provider: 'ISRIC — World Soil Information';
  product: 'SoilGrids250m 2.0';
  dataType: 'model-estimate';
  license: 'CC BY 4.0';
  spatialResolutionMeters: 250;
  requestedLatitude: number;
  requestedLongitude: number;
  generatedAt: string;
  properties: {
    ph: SoilGridsPropertyProfile;
    organicCarbon: SoilGridsPropertyProfile;
    clay: SoilGridsPropertyProfile;
    sand: SoilGridsPropertyProfile;
    silt: SoilGridsPropertyProfile;
  };
  texture: {
    clayPercent: number | null;
    sandPercent: number | null;
    siltPercent: number | null;
  };
  warnings: string[];
};

type SoilGridsErrorResponse = {
  success?: false;
  error?: string;
  warnings?: string[];
  debug?: {
    successfulLayers?: number;
    requestedLayers?: number;
  };
};

const CACHE_PREFIX = 'tp_soilgrids_edge_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(latitude: number, longitude: number) {
  return `${CACHE_PREFIX}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
}

function readCache(latitude: number, longitude: number) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: SoilGridsProfile;
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
  data: SoilGridsProfile,
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
    // Cache zorunlu değil.
  }
}

export function clearSoilGridsCache() {
  if (typeof window === 'undefined') return;

  try {
    const keys: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);

      if (key?.startsWith('tp_soilgrids_')) {
        keys.push(key);
      }
    }

    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage kapalı olabilir.
  }
}

export async function fetchSoilGridsProfile(
  latitude: number,
  longitude: number,
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
): Promise<SoilGridsProfile> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('SoilGrids için geçerli bir enlem gerekli.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('SoilGrids için geçerli bir boylam gerekli.');
  }

  if (!options?.forceRefresh) {
    const cached = readCache(latitude, longitude);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke<
    SoilGridsProfile | SoilGridsErrorResponse
  >('soilgrids', {
    body: {
      latitude,
      longitude,
    },
  });

  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    throw new Error(
      `SoilGrids sunucu isteği başarısız: ${error.message}`,
    );
  }

  if (!data || data.success !== true) {
    const failed = data as SoilGridsErrorResponse | null;

    const warningText =
      failed?.warnings?.length
        ? ` ${failed.warnings.slice(0, 2).join(' | ')}`
        : '';

    const debugText =
      failed?.debug
        ? ` (${failed.debug.successfulLayers ?? 0}/${failed.debug.requestedLayers ?? 15} katman)`
        : '';

    throw new Error(
      `${failed?.error ?? 'SoilGrids verisi alınamadı.'}${debugText}${warningText}`,
    );
  }

  writeCache(latitude, longitude, data);

  return data;
}

export function getSoilGridsWmsBaseUrl(property: SoilGridsPropertyKey) {
  return `https://maps.isric.org/mapserv/${property}`;
}

export function getSoilGridsWmsLayerName(
  property: SoilGridsPropertyKey,
  depth: SoilGridsDepth,
  prediction: 'mean' | 'Q0.05' | 'Q0.5' | 'Q0.95' = 'mean',
) {
  return `${property}_${depth}_${prediction}`;
}

export async function testSoilGridsAtCoordinates(
  latitude: number,
  longitude: number,
) {
  clearSoilGridsCache();

  const result = await fetchSoilGridsProfile(latitude, longitude, {
    forceRefresh: true,
  });

  console.log('✅ SOILGRIDS EDGE TEST SONUCU', result);

  return result;
}
