import { supabase } from '../supabaseClient';
import {
  compactPhiBaseEvidence,
  fetchPhiBaseFieldEvidence,
  type PhiBaseFieldEvidence,
} from '../features/knowledge/services/phibaseEvidence';
import {
  compactWorldCerealReference,
  fetchWorldCerealReferenceContext,
  type WorldCerealReferenceContext,
} from './worldCerealReference.service';
import {
  compactAgroClimateForPusula,
  fetchAgroClimateBaselineEvidence,
  type AgroClimateBaselineEvidence,
} from './agroClimateBaseline.service';

export type RiskRadarLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';

export type RiskRadarTrend =
  | 'rising'
  | 'stable'
  | 'falling';

export type RiskRadarThreat = {
  scientificName: string;
  commonName: string;
  displayName: string;
  threatType: string;
  model: string;
  score: number;
  level: RiskRadarLevel;
  levelLabel: string;
  peakScore7d: number;
  peakLevel7d: RiskRadarLevel;
  peakLevelLabel7d: string;
  peakDate: string | null;
  trend: RiskRadarTrend;
  reasons: string[];
  metrics: {
    temperatureAvgC: number;
    relativeHumidityMaxPercent: number;
    precipitation3dMm: number;
    leafWetnessHours: number;
    humidityStreakDays: number;
    vpdKpa: number | null;
    cumulativeGdd: number | null;
    phenologyFactor: number;
  } | null;
  timeline7d: Array<{
    date: string;
    score: number;
    level: RiskRadarLevel;
    levelLabel: string;
  }>;
  action: string;
};

export type RiskRadarResult = {
  ok: boolean;
  supported: boolean;
  field?: {
    id: string;
    name: string;
    crop: string | null;
    normalizedCrop?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    source: string;
    precision: string;
  };
  seasonStartDate?: string;
  weather?: {
    source: string;
    timezone: string;
    timezoneAbbreviation: string;
    elevationM: number | null;
    pastDays: number;
    forecastDays: number;
  };
  overall?: {
    score: number;
    level: RiskRadarLevel;
    levelLabel: string;
    headline: string;
    recommendation: string;
  };
  threats: RiskRadarThreat[];
  reason?: string;
  supportedCrops?: string[];
  worldCerealReference?: WorldCerealReferenceContext | null;
  phibaseEvidence?: PhiBaseFieldEvidence | null;
  agroClimateBaseline?: AgroClimateBaselineEvidence | null;
  provenance?: {
    engine: string;
    upstream: string;
    upstreamLicense: string;
    upstreamCatalogSha: string;
    fuzzyEngineSha: string;
    weatherProvider: string;
    note: string;
  };
  generatedAt: string;
};

export type FetchRiskRadarOptions = {
  seasonStartDate?: string | null;
  forceRefresh?: boolean;
};

type CachedRiskRadar = {
  savedAt: number;
  result: RiskRadarResult;
};

const MEMORY_CACHE = new Map<string, CachedRiskRadar>();
const CACHE_PREFIX = 'tp_risk_radar_v1:';
const CACHE_MS = 30 * 60 * 1000;

function todayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanDate(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

function cacheKey(
  fieldId: string,
  seasonStartDate?: string | null,
) {
  return [
    fieldId,
    cleanDate(seasonStartDate) ?? 'auto',
    todayLocalIso(),
  ].join(':');
}

function readCached(key: string) {
  const memory = MEMORY_CACHE.get(key);

  if (
    memory &&
    Date.now() - memory.savedAt < CACHE_MS
  ) {
    return memory.result;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      `${CACHE_PREFIX}${key}`,
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedRiskRadar;

    if (
      !parsed?.savedAt ||
      !parsed?.result ||
      Date.now() - parsed.savedAt >= CACHE_MS
    ) {
      return null;
    }

    MEMORY_CACHE.set(key, parsed);
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCached(
  key: string,
  result: RiskRadarResult,
) {
  const value: CachedRiskRadar = {
    savedAt: Date.now(),
    result,
  };

  MEMORY_CACHE.set(key, value);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(value),
    );
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

          if (
            typeof parsed?.error === 'string' &&
            parsed.error.trim()
          ) {
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

  return (
    error?.message ||
    'Pusula Risk Radarı çağrısı başarısız oldu.'
  );
}

export async function fetchFieldRiskRadar(
  fieldId: string | number,
  options: FetchRiskRadarOptions = {},
): Promise<RiskRadarResult> {
  if (!supabase) {
    throw new Error(
      'Pusula Risk Radarı bağlantısı hazır değil.',
    );
  }

  const normalizedFieldId = String(fieldId ?? '').trim();

  if (!normalizedFieldId) {
    throw new Error(
      'Pusula Risk Radarı için tarla seçilmedi.',
    );
  }

  const key = cacheKey(
    normalizedFieldId,
    options.seasonStartDate,
  );

  if (!options.forceRefresh) {
    const cached = readCached(key);
    if (cached) return cached;
  }

  const { data, error } =
    await supabase.functions.invoke(
      'risk-radar',
      {
        body: {
          fieldId: normalizedFieldId,
          appDate: todayLocalIso(),
          seasonStartDate:
            cleanDate(options.seasonStartDate) ??
            undefined,
        },
      },
    );

  if (error) {
    throw new Error(
      await readFunctionError(error),
    );
  }

  if (!data) {
    throw new Error(
      'Pusula Risk Radarı boş yanıt döndürdü.',
    );
  }

  if (data.ok === false) {
    throw new Error(
      data.error ||
        'Pusula Risk Radarı hesabı oluşturulamadı.',
    );
  }

  const result: RiskRadarResult = {
    ...data,
    ok: true,
    supported: data.supported === true,
    threats: Array.isArray(data.threats)
      ? data.threats
      : [],
    generatedAt:
      String(data.generatedAt ?? '') ||
      new Date().toISOString(),
  };

  const latitude = Number(result.location?.latitude);
  const longitude = Number(result.location?.longitude);

  const worldCerealPromise =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? fetchWorldCerealReferenceContext(
          latitude,
          longitude,
          {
            radiusKm: 15,
            forceRefresh: options.forceRefresh,
          },
        )
      : Promise.resolve(null);

  const phibasePromise = fetchPhiBaseFieldEvidence(
    normalizedFieldId,
    {
      forceRefresh: options.forceRefresh,
    },
  );

  const agroClimatePromise = fetchAgroClimateBaselineEvidence(
    normalizedFieldId,
    {
      forceRefresh: options.forceRefresh,
    },
  );

  const [worldCerealResult, phibaseResult, agroClimateResult] =
    await Promise.allSettled([
      worldCerealPromise,
      phibasePromise,
      agroClimatePromise,
    ]);

  if (worldCerealResult.status === 'fulfilled') {
    result.worldCerealReference = worldCerealResult.value;
  } else {
    console.warn(
      '[Pusula] WorldCereal RDM bağlamı alınamadı:',
      worldCerealResult.reason,
    );
    result.worldCerealReference = null;
  }

  if (phibaseResult.status === 'fulfilled') {
    result.phibaseEvidence = phibaseResult.value;
  } else {
    console.warn(
      '[Pusula] PHI-base kanıtı alınamadı:',
      phibaseResult.reason,
    );
    result.phibaseEvidence = null;
  }

  if (agroClimateResult.status === 'fulfilled') {
    result.agroClimateBaseline = agroClimateResult.value;
  } else {
    console.warn(
      '[Pusula] CHIRPS / ERA5-Land agroiklim bağlamı alınamadı:',
      agroClimateResult.reason,
    );
    result.agroClimateBaseline = null;
  }

  writeCached(key, result);

  return result;
}

export function compactRiskRadarForPusula(
  result: RiskRadarResult | null | undefined,
) {
  if (!result) return null;

  const worldCerealReference =
    compactWorldCerealReference(
      result.worldCerealReference,
    );

  const phibaseEvidence = compactPhiBaseEvidence(
    result.phibaseEvidence,
  );

  const agroClimateBaseline = compactAgroClimateForPusula(
    result.agroClimateBaseline,
  );

  if (!result.supported) {
    return {
      supported: false,
      crop: result.field?.crop ?? null,
      reason:
        result.reason ??
        'Bu ürün için doğrulanmış risk modeli henüz yok.',
      worldCerealReference,
      phibaseEvidence,
      agroClimateBaseline,
      generatedAt: result.generatedAt,
    };
  }

  return {
    supported: true,
    fieldId: result.field?.id ?? null,
    crop: result.field?.crop ?? null,
    overall: result.overall ?? null,
    locationPrecision:
      result.location?.precision ?? null,
    topThreats: result.threats
      .slice(0, 3)
      .map((threat) => ({
        name: threat.displayName,
        score: threat.score,
        level: threat.level,
        peakScore7d: threat.peakScore7d,
        peakDate: threat.peakDate,
        trend: threat.trend,
        reasons: threat.reasons,
        action: threat.action,
      })),
    worldCerealReference,
    phibaseEvidence,
    agroClimateBaseline,
    provenance: result.provenance ?? null,
    generatedAt: result.generatedAt,
  };
}

export function clearRiskRadarCache(
  fieldId?: string | number,
) {
  if (fieldId === undefined) {
    MEMORY_CACHE.clear();

    if (typeof window !== 'undefined') {
      const keys = Object.keys(window.localStorage);

      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      }
    }

    return;
  }

  const prefix = String(fieldId);

  for (const key of [...MEMORY_CACHE.keys()]) {
    if (key.startsWith(`${prefix}:`)) {
      MEMORY_CACHE.delete(key);
    }
  }

  if (typeof window !== 'undefined') {
    for (const key of Object.keys(window.localStorage)) {
      if (
        key.startsWith(
          `${CACHE_PREFIX}${prefix}:`,
        )
      ) {
        window.localStorage.removeItem(key);
      }
    }
  }
}
