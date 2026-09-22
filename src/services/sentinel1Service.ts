import { supabase } from '../supabaseClient';

export type Sentinel1RadarMode =
  | 'composite'
  | 'vv'
  | 'vh'
  | 'water';

export type Sentinel1OrbitDirection =
  | 'ASCENDING'
  | 'DESCENDING';

export type Sentinel1RadarScene = {
  id: string;
  datetime: string;
  date: string;
  orbitDirection: Sentinel1OrbitDirection | null;
  relativeOrbit: number | null;
  polarization: string | null;
  instrumentMode: string | null;
};

export type Sentinel1RadarStats = {
  metric: 'vv_db' | 'vh_db' | 'water_area_fraction' | 'water_score' | 'composite';
  unit: 'dB' | 'fraction' | 'score' | 'unknown';
  mean: number | null;
  min: number | null;
  max: number | null;
  stDev: number | null;
  sampleCount: number | null;
  noDataCount: number | null;
};

export type Sentinel1RadarComparison = {
  basis: string;
  currentDate: string;
  currentDatetime: string;
  currentMean: number;
  previousDate: string;
  previousDatetime: string;
  previousMean: number;
  delta: number;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  unit: string;
  comparable: boolean;
};

export type Sentinel1RadarResponse = {
  success: true;
  action?: 'image';
  source: 'Copernicus Sentinel-1 GRD';
  provider: 'Copernicus Data Space Ecosystem / Sentinel Hub';
  mode: Sentinel1RadarMode;
  scene: Sentinel1RadarScene;
  dataDate?: string | null;
  timeRange: {
    from: string;
    to: string;
    days: number;
  };
  processing: {
    acquisitionMode: string;
    polarization: string;
    resolution: string;
    orthorectified: boolean;
    backCoeff: string;
    demInstance: string;
    orbitDirection?: Sentinel1OrbitDirection | null;
    relativeOrbit?: number | null;
  };
  bbox: [number, number, number, number];
  searchBbox?: [number, number, number, number];
  renderBoundsSource?: 'parcel' | 'radius';
  imageSize?: { width: number; height: number };
  imageDataUrl: string;
  stats: Sentinel1RadarStats | null;
  previousComparison?: Sentinel1RadarComparison | null;
  comparisonBasis?: string | null;
  generatedAt: string;
  disclaimer: string;
};

export type Sentinel1RadarSceneListResponse = {
  success: true;
  action: 'dates';
  source: 'Copernicus Sentinel-1 GRD';
  provider: 'Copernicus Data Space Ecosystem / Sentinel Hub';
  mode: Sentinel1RadarMode;
  comparisonBasis: string;
  scenes: Sentinel1RadarScene[];
  generatedAt: string;
};

type Sentinel1ErrorResponse = {
  success?: false;
  error?: string;
  detail?: string;
};

function failMessage(
  data: Sentinel1ErrorResponse | null,
  fallback: string,
) {
  return [data?.error ?? fallback, data?.detail]
    .filter(Boolean)
    .join(' — ');
}

async function invokeErrorMessage(error: unknown, fallback: string) {
  const anyError = error as any;
  const response = anyError?.context;

  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();
      const detail = [payload?.error, payload?.detail]
        .filter(Boolean)
        .join(' — ');
      if (detail) return `${fallback}: ${detail}`;
    } catch {
      try {
        const text = await response.clone().text();
        if (text?.trim()) {
          return `${fallback}: ${text.trim().slice(0, 900)}`;
        }
      } catch {
        // Supabase response body okunamıyorsa standart mesaja düş.
      }
    }
  }

  const message = String(anyError?.message ?? '').trim();
  return message ? `${fallback}: ${message}` : fallback;
}

export async function fetchSentinel1Radar(
  latitude: number,
  longitude: number,
  options?: {
    mode?: Sentinel1RadarMode;
    days?: number;
    radiusKm?: number;
    geometry?: unknown;
    sceneDatetime?: string | null;
    orbitDirection?: Sentinel1OrbitDirection | null;
    relativeOrbit?: number | null;
    includePreviousComparison?: boolean;
  },
): Promise<Sentinel1RadarResponse> {
  const { data, error } = await supabase.functions.invoke<
    Sentinel1RadarResponse | Sentinel1ErrorResponse
  >('sentinel1-radar', {
    body: {
      action: 'image',
      latitude,
      longitude,
      mode: options?.mode ?? 'composite',
      days: options?.days ?? 45,
      radiusKm: options?.radiusKm ?? 2,
      geometry: options?.geometry ?? null,
      sceneDatetime: options?.sceneDatetime ?? null,
      orbitDirection: options?.orbitDirection ?? null,
      relativeOrbit: options?.relativeOrbit ?? null,
      includePreviousComparison:
        options?.includePreviousComparison === true,
    },
  });

  if (error) {
    throw new Error(
      await invokeErrorMessage(error, 'Sentinel-1 sunucu isteği başarısız'),
    );
  }

  if (!data || data.success !== true || !('imageDataUrl' in data)) {
    throw new Error(
      failMessage(
        data as Sentinel1ErrorResponse | null,
        'Sentinel-1 verisi alınamadı.',
      ),
    );
  }

  return data as Sentinel1RadarResponse;
}

export async function listSentinel1RadarScenes(
  latitude: number,
  longitude: number,
  options?: {
    mode?: Sentinel1RadarMode;
    days?: number;
    radiusKm?: number;
    geometry?: unknown;
  },
): Promise<Sentinel1RadarSceneListResponse> {
  const { data, error } = await supabase.functions.invoke<
    Sentinel1RadarSceneListResponse | Sentinel1ErrorResponse
  >('sentinel1-radar', {
    body: {
      action: 'dates',
      latitude,
      longitude,
      mode: options?.mode ?? 'vv',
      days: options?.days ?? 180,
      radiusKm: options?.radiusKm ?? 2,
      geometry: options?.geometry ?? null,
    },
  });

  if (error) {
    throw new Error(
      await invokeErrorMessage(error, 'Sentinel-1 geçmiş isteği başarısız'),
    );
  }

  if (!data || data.success !== true || !('scenes' in data)) {
    throw new Error(
      failMessage(
        data as Sentinel1ErrorResponse | null,
        'Sentinel-1 geçmiş tarihleri alınamadı.',
      ),
    );
  }

  return data as Sentinel1RadarSceneListResponse;
}
