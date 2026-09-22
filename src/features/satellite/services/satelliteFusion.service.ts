import { supabase } from '../../../supabaseClient';
import type {
  SatelliteFusionErrorResponse,
  SatelliteFusionResponse,
} from '../types/satelliteFusion';

type SatelliteFusionOptions = {
  daysBack?: number;
  maxCloudCoverage?: number;
};

const CACHE_TTL_MS = 30 * 60 * 1000;

const memoryCache = new Map<
  string,
  {
    expiresAt: number;
    value: SatelliteFusionResponse;
  }
>();

function geometryCacheKey(
  geometry: unknown,
  options?: SatelliteFusionOptions,
) {
  return JSON.stringify({
    geometry,
    daysBack: options?.daysBack ?? 90,
    maxCloudCoverage: options?.maxCloudCoverage ?? 35,
  });
}

export async function fetchFieldSatelliteFusion(
  geometry: unknown,
  options?: SatelliteFusionOptions,
): Promise<SatelliteFusionResponse> {
  if (!geometry) {
    throw new Error(
      'Sentinel fusion için parsel geometrisi bulunamadı.',
    );
  }

  const cacheKey = geometryCacheKey(
    geometry,
    options,
  );

  const cached = memoryCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value;
  }

  const { data, error } = await supabase.functions.invoke<
    SatelliteFusionResponse | SatelliteFusionErrorResponse
  >('field-satellite-fusion', {
    body: {
      geometry,
      daysBack: options?.daysBack ?? 90,
      maxCloudCoverage:
        options?.maxCloudCoverage ?? 35,
    },
  });

  if (error) {
    throw new Error(
      `Sentinel fusion isteği başarısız: ${error.message}`,
    );
  }

  if (!data || data.success !== true) {
    const failed =
      data as SatelliteFusionErrorResponse | null;

    throw new Error(
      failed?.message ??
        failed?.error ??
        'Sentinel-1 + Sentinel-2 fusion verisi alınamadı.',
    );
  }

  memoryCache.set(cacheKey, {
    value: data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return data;
}
