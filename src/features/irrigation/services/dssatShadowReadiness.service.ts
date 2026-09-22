import { supabase } from '../../../supabaseClient';

export type DssatShadowReadinessStatus =
  | 'ready'
  | 'runtime_pending'
  | 'blocked'
  | 'unavailable';

export type DssatShadowReadiness = {
  ok: boolean;
  fieldId: string;
  status: DssatShadowReadinessStatus;
  inputReady: boolean;
  executionEnabled: boolean;
  productionAuthority: false;
  yieldAuthority: false;
  irrigationPrescriptionAuthority: false;
  nutrientPrescriptionAuthority: false;
  modelVersion: string | null;
  availableInputs: string[];
  missingInputs: string[];
  simulation: {
    plantingDate: string | null;
    harvestDate: string | null;
    weatherStart: string | null;
    weatherEnd: string | null;
    weatherDays: number | null;
    scope: string | null;
  };
  crop: {
    cropIdentity: string | null;
    localVarietyName: string | null;
    dssatCropFolder: string | null;
    dssatCultivarCode: string | null;
    mappingVerified: boolean;
    detail: string | null;
  };
  weather: {
    available: boolean;
    source: string | null;
    detail: string | null;
  };
  gateway: {
    available: boolean;
    rollout: string;
    error: string | null;
  };
  warnings: string[];
  note: string;
  generatedAt: string;
};

type CachedValue = {
  savedAt: number;
  result: DssatShadowReadiness;
};

const CACHE_PREFIX = 'tp_dssat_shadow_readiness_v2:';
const CACHE_MS = 6 * 60 * 60 * 1000;
const MEMORY_CACHE = new Map<string, CachedValue>();

function text(value: unknown): string | null {
  const parsed = String(value ?? '').trim();
  return parsed || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function readCached(fieldId: string) {
  const memory = MEMORY_CACHE.get(fieldId);
  if (memory && Date.now() - memory.savedAt < CACHE_MS) return memory.result;

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${fieldId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue;
    if (!parsed?.savedAt || !parsed?.result || Date.now() - parsed.savedAt >= CACHE_MS) {
      return null;
    }
    MEMORY_CACHE.set(fieldId, parsed);
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCached(fieldId: string, result: DssatShadowReadiness) {
  const value: CachedValue = { savedAt: Date.now(), result };
  MEMORY_CACHE.set(fieldId, value);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${fieldId}`, JSON.stringify(value));
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

async function readFunctionError(error: any) {
  try {
    const context = error?.context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
    }
  } catch {
    // no-op
  }
  return error?.message || 'DSSAT readiness alınamadı.';
}

function normalize(data: any, fieldId: string): DssatShadowReadiness {
  const statusText = String(data?.status ?? 'unavailable');
  const status: DssatShadowReadinessStatus =
    statusText === 'ready' || statusText === 'runtime_pending' || statusText === 'blocked'
      ? statusText
      : 'unavailable';

  const cropParameters = data?.adapters?.crop_parameters ?? {};
  const cropReference = cropParameters?.cropReference ?? {};
  const varietyMapping = cropParameters?.varietyMapping ?? {};
  const weather = data?.adapters?.daily_weather ?? {};

  return {
    ok: data?.ok === true,
    fieldId,
    status,
    inputReady: data?.input_ready === true,
    executionEnabled: data?.execution_enabled === true,
    productionAuthority: false,
    yieldAuthority: false,
    irrigationPrescriptionAuthority: false,
    nutrientPrescriptionAuthority: false,
    modelVersion: text(data?.model_version),
    availableInputs: stringArray(data?.available_inputs),
    missingInputs: stringArray(data?.missing_inputs),
    simulation: {
      plantingDate: text(data?.simulation?.planting_date),
      harvestDate: text(data?.simulation?.harvest_date),
      weatherStart: text(data?.simulation?.weather_start),
      weatherEnd: text(data?.simulation?.weather_end),
      weatherDays: numberOrNull(data?.simulation?.weather_days),
      scope: text(data?.simulation?.scope),
    },
    crop: {
      cropIdentity: text(cropParameters?.cropIdentity),
      localVarietyName: text(cropParameters?.localVarietyName),
      dssatCropFolder: text(cropReference?.dssatCropFolder),
      dssatCultivarCode: text(varietyMapping?.dssatCultivarCode),
      mappingVerified: Boolean(varietyMapping?.dssatCultivarCode),
      detail: text(cropParameters?.detail),
    },
    weather: {
      available: weather?.available === true,
      source: text(weather?.source),
      detail: text(weather?.detail),
    },
    gateway: {
      available: data?.gateway?.available === true,
      rollout: String(data?.gateway?.rollout ?? 'off'),
      error: text(data?.gateway?.error),
    },
    warnings: stringArray(data?.warnings),
    note: String(data?.note ?? 'DSSAT readiness durumu alınamadı.'),
    generatedAt: String(data?.generated_at ?? new Date().toISOString()),
  };
}

export async function fetchDssatShadowReadiness(
  fieldIdInput: string | number,
  options: { forceRefresh?: boolean } = {},
): Promise<DssatShadowReadiness> {
  if (!supabase) throw new Error('DSSAT readiness bağlantısı hazır değil.');

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('DSSAT readiness için tarla seçilmedi.');

  if (!options.forceRefresh) {
    const cached = readCached(fieldId);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke('dssat-shadow-readiness', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (!data) throw new Error('DSSAT readiness servisi boş yanıt döndürdü.');
  if (data.ok === false) throw new Error(data.error || 'DSSAT readiness oluşturulamadı.');

  const result = normalize(data, fieldId);
  writeCached(fieldId, result);
  return result;
}

export function compactDssatReadinessForPusula(
  readiness: DssatShadowReadiness | null | undefined,
) {
  if (!readiness) return null;
  return {
    status: readiness.status,
    inputReady: readiness.inputReady,
    executionEnabled: readiness.executionEnabled,
    modelVersion: readiness.modelVersion,
    crop: readiness.crop,
    simulation: readiness.simulation,
    missingInputs: readiness.missingInputs.slice(0, 8),
    productionAuthority: false,
    yieldAuthority: false,
    note: readiness.note,
    generatedAt: readiness.generatedAt,
  };
}

export function clearDssatShadowReadinessCache(fieldId?: string | number) {
  if (fieldId === undefined) {
    MEMORY_CACHE.clear();
    if (typeof window !== 'undefined') {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
      }
    }
    return;
  }

  const normalized = String(fieldId);
  MEMORY_CACHE.delete(normalized);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(`${CACHE_PREFIX}${normalized}`);
  }
}
