import { supabase } from '../supabaseClient';

export type AgroClimateStressClass =
  | 'strong_dry_signal'
  | 'dry_signal'
  | 'near_normal'
  | 'wet_signal';

export type AgroClimateBaselineEvidence = {
  ok: boolean;
  status: 'ready' | 'partial' | 'unavailable';
  fieldId: string;
  field: {
    name: string | null;
    crop: string | null;
  };
  productionAuthority: false;
  inputAuthority: 'server-derived';
  analysis: {
    windowDays: number;
    currentPeriod: { start: string; end: string };
    baselinePeriod: string;
    era5LagDays: number;
  } | null;
  era5Land: {
    source: string;
    access: string;
    spatialResolution: string;
    current: {
      validDays: number;
      temperatureMeanC: number | null;
      precipitationTotalMm: number | null;
      et0TotalMm: number | null;
      waterBalanceMm: number | null;
      soilMoisture0To7: number | null;
      soilMoisture7To28: number | null;
      soilMoisture28To100: number | null;
    };
    baseline: {
      years: string;
      yearsUsed: number;
      windowDays: number;
      temperatureMeanC: number | null;
      precipitationTotalMm: number | null;
      et0TotalMm: number | null;
      waterBalanceMm: number | null;
      soilMoisture0To7: number | null;
      soilMoisture7To28: number | null;
      soilMoisture28To100: number | null;
    } | null;
  } | null;
  chirps: {
    available: boolean;
    pending: boolean;
    source: string;
    provider: string;
    dataset: string;
    totalMm: number | null;
    validDayCount: number | null;
    period: { start?: string; end?: string; days?: number } | null;
    providerJobId: string | null;
    note: string | null;
  } | null;
  anomalies: {
    precipitationRatioPct: number | null;
    precipitationDeficitPct: number | null;
    temperatureAnomalyC: number | null;
    et0ChangePct: number | null;
    waterBalanceAnomalyMm: number | null;
    soilMoisture0To7Percentile: number | null;
    soilMoisture7To28Percentile: number | null;
    soilMoisture28To100Percentile: number | null;
    chirpsVsEra5PrecipDifferencePct: number | null;
  } | null;
  climateWaterStress: {
    class: AgroClimateStressClass;
    label: string;
    confidence: 'low' | 'medium';
  } | null;
  evidencePolicy: {
    neverBlindAverage: true;
    chirpsRole: string;
    era5LandRole: string;
    note: string;
  } | null;
  warnings: string[];
  generatedAt: string;
};

type CachedEvidence = {
  savedAt: number;
  result: AgroClimateBaselineEvidence;
};

const MEMORY_CACHE = new Map<string, CachedEvidence>();
const CACHE_PREFIX = 'tp_agroclimate_baseline_v1:';
const CACHE_MS = 12 * 60 * 60 * 1000;

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function readCached(key: string) {
  const memory = MEMORY_CACHE.get(key);
  if (memory && Date.now() - memory.savedAt < CACHE_MS) return memory.result;

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEvidence;
    if (!parsed?.savedAt || !parsed?.result || Date.now() - parsed.savedAt >= CACHE_MS) {
      return null;
    }
    MEMORY_CACHE.set(key, parsed);
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCached(key: string, result: AgroClimateBaselineEvidence) {
  const value: CachedEvidence = { savedAt: Date.now(), result };
  MEMORY_CACHE.set(key, value);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
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
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
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
  return error?.message || 'Agroiklim karşılaştırması alınamadı.';
}

function normalize(data: any, fieldId: string): AgroClimateBaselineEvidence {
  const status: AgroClimateBaselineEvidence['status'] =
    data?.status === 'ready' || data?.status === 'partial' || data?.status === 'unavailable'
      ? data.status
      : data?.ok
        ? 'partial'
        : 'unavailable';

  const stressClass = String(data?.climateWaterStress?.class ?? 'near_normal') as AgroClimateStressClass;

  return {
    ok: data?.ok === true,
    status,
    fieldId,
    field: {
      name: textOrNull(data?.field?.name),
      crop: textOrNull(data?.field?.crop),
    },
    productionAuthority: false,
    inputAuthority: 'server-derived',
    analysis: data?.analysis
      ? {
          windowDays: Math.max(0, Math.round(numberOrNull(data.analysis.windowDays) ?? 0)),
          currentPeriod: {
            start: String(data.analysis?.currentPeriod?.start ?? ''),
            end: String(data.analysis?.currentPeriod?.end ?? ''),
          },
          baselinePeriod: String(data.analysis?.baselinePeriod ?? ''),
          era5LagDays: Math.max(0, Math.round(numberOrNull(data.analysis?.era5LagDays) ?? 0)),
        }
      : null,
    era5Land: data?.era5Land ?? null,
    chirps: data?.chirps
      ? {
          available: data.chirps.available === true,
          pending: data.chirps.pending === true,
          source: String(data.chirps.source ?? 'UCSB CHIRPS via SERVIR ClimateSERV'),
          provider: String(data.chirps.provider ?? 'SERVIR ClimateSERV'),
          dataset: String(data.chirps.dataset ?? 'Global CHIRPS'),
          totalMm: numberOrNull(data.chirps.totalMm),
          validDayCount: numberOrNull(data.chirps.validDayCount),
          period: data.chirps.period ?? null,
          providerJobId: textOrNull(data.chirps.providerJobId),
          note: textOrNull(data.chirps.note),
        }
      : null,
    anomalies: data?.anomalies
      ? {
          precipitationRatioPct: numberOrNull(data.anomalies.precipitationRatioPct),
          precipitationDeficitPct: numberOrNull(data.anomalies.precipitationDeficitPct),
          temperatureAnomalyC: numberOrNull(data.anomalies.temperatureAnomalyC),
          et0ChangePct: numberOrNull(data.anomalies.et0ChangePct),
          waterBalanceAnomalyMm: numberOrNull(data.anomalies.waterBalanceAnomalyMm),
          soilMoisture0To7Percentile: numberOrNull(data.anomalies.soilMoisture0To7Percentile),
          soilMoisture7To28Percentile: numberOrNull(data.anomalies.soilMoisture7To28Percentile),
          soilMoisture28To100Percentile: numberOrNull(data.anomalies.soilMoisture28To100Percentile),
          chirpsVsEra5PrecipDifferencePct: numberOrNull(data.anomalies.chirpsVsEra5PrecipDifferencePct),
        }
      : null,
    climateWaterStress: data?.climateWaterStress
      ? {
          class: ['strong_dry_signal', 'dry_signal', 'near_normal', 'wet_signal'].includes(stressClass)
            ? stressClass
            : 'near_normal',
          label: String(data.climateWaterStress.label ?? 'İklim bağlamı'),
          confidence: data.climateWaterStress.confidence === 'medium' ? 'medium' : 'low',
        }
      : null,
    evidencePolicy: data?.evidencePolicy
      ? {
          neverBlindAverage: true,
          chirpsRole: String(data.evidencePolicy.chirpsRole ?? ''),
          era5LandRole: String(data.evidencePolicy.era5LandRole ?? ''),
          note: String(data.evidencePolicy.note ?? ''),
        }
      : null,
    warnings: Array.isArray(data?.warnings) ? data.warnings.map(String) : [],
    generatedAt: String(data?.generated_at ?? new Date().toISOString()),
  };
}

export async function fetchAgroClimateBaselineEvidence(
  fieldId: string | number,
  options: { forceRefresh?: boolean; asOfDate?: string | null } = {},
): Promise<AgroClimateBaselineEvidence> {
  if (!supabase) throw new Error('Agroiklim bağlantısı hazır değil.');

  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) throw new Error('Agroiklim analizi için tarla seçilmedi.');

  const asOfDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.asOfDate ?? ''))
    ? String(options.asOfDate)
    : '';
  const key = `${normalizedFieldId}:${asOfDate || 'latest'}`;

  if (!options.forceRefresh) {
    const cached = readCached(key);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke('agroclimate-baseline-evidence', {
    body: {
      field_id: normalizedFieldId,
      ...(asOfDate ? { as_of_date: asOfDate } : {}),
    },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('Agroiklim servisi boş yanıt döndürdü.');
  if (data.ok === false) throw new Error(data.error || 'Agroiklim karşılaştırması oluşturulamadı.');

  const result = normalize(data, normalizedFieldId);
  writeCached(key, result);
  return result;
}

export function compactAgroClimateForPusula(
  evidence: AgroClimateBaselineEvidence | null | undefined,
) {
  if (!evidence) return null;

  return {
    status: evidence.status,
    windowDays: evidence.analysis?.windowDays ?? null,
    currentPeriod: evidence.analysis?.currentPeriod ?? null,
    baselinePeriod: evidence.analysis?.baselinePeriod ?? null,
    climateWaterStress: evidence.climateWaterStress,
    precipitation: {
      era5LandMm: evidence.era5Land?.current.precipitationTotalMm ?? null,
      baselineMm: evidence.era5Land?.baseline?.precipitationTotalMm ?? null,
      ratioPct: evidence.anomalies?.precipitationRatioPct ?? null,
      deficitPct: evidence.anomalies?.precipitationDeficitPct ?? null,
      chirpsMm: evidence.chirps?.totalMm ?? null,
      chirpsAvailable: evidence.chirps?.available ?? false,
      sourceDifferencePct: evidence.anomalies?.chirpsVsEra5PrecipDifferencePct ?? null,
    },
    temperatureAnomalyC: evidence.anomalies?.temperatureAnomalyC ?? null,
    et0ChangePct: evidence.anomalies?.et0ChangePct ?? null,
    waterBalanceAnomalyMm: evidence.anomalies?.waterBalanceAnomalyMm ?? null,
    soilMoisturePercentiles: {
      surface: evidence.anomalies?.soilMoisture0To7Percentile ?? null,
      rootZoneShallow: evidence.anomalies?.soilMoisture7To28Percentile ?? null,
      rootZoneDeep: evidence.anomalies?.soilMoisture28To100Percentile ?? null,
    },
    warnings: evidence.warnings.slice(0, 3),
    productionAuthority: false,
    generatedAt: evidence.generatedAt,
  };
}

export function clearAgroClimateBaselineCache(fieldId?: string | number) {
  if (fieldId === undefined) {
    MEMORY_CACHE.clear();
    if (typeof window !== 'undefined') {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
      }
    }
    return;
  }

  const prefix = `${CACHE_PREFIX}${String(fieldId)}:`;
  for (const key of [...MEMORY_CACHE.keys()]) {
    if (key.startsWith(`${String(fieldId)}:`)) MEMORY_CACHE.delete(key);
  }
  if (typeof window !== 'undefined') {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  }
}
