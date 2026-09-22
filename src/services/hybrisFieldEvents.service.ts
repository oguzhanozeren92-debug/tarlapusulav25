import { supabase } from '../supabaseClient';

export type HybrisFieldEventType = 'sowing' | 'harvest' | 'tillage';

export type HybrisFieldEvent = {
  type: HybrisFieldEventType;
  signalDate: string;
  uncertaintyDays: number;
  prominence: number;
  confidence: 'medium' | 'low';
  indexValue: number | null;
  s1Contribution: number | null;
  s2Contribution: number | null;
  note: string;
};

export type HybrisFieldEventsEvidence = {
  ok: boolean;
  fieldId: string;
  status: 'ready' | 'insufficient_data' | 'blocked' | 'unavailable';
  source: 'HyBRIS adapted field-event evidence';
  sourceRepo: string;
  sourceCommit: string;
  license: 'MIT';
  implementation: string;
  lookbackDays: number;
  maxTemporalDistanceDays: number;
  smoothingDays: number;
  s1ObservationCount: number;
  s2ObservationCount: number;
  selectedOrbitDirection: 'ASCENDING' | 'DESCENDING' | null;
  radarBackscatter: string | null;
  radarPreprocessing: string[];
  opticalIndex: 'BSI';
  eventDateMeaning: 'signal-window-not-exact-operation-date';
  events: HybrisFieldEvent[];
  latestEvent: HybrisFieldEvent | null;
  dataCoverage: {
    startDate: string | null;
    endDate: string | null;
    spanDays: number;
    fusedDays: number;
    dualSensorDays: number;
    dualSensorRatio: number | null;
  };
  missingInputs: string[];
  warnings: string[];
  generatedAt: string;
};

type Cached = { savedAt: number; result: HybrisFieldEventsEvidence };

const CACHE_PREFIX = 'tp_hybris_field_events_v1:';
const CACHE_MS = 6 * 60 * 60 * 1000;
const MEMORY = new Map<string, Cached>();

function text(value: unknown): string | null {
  const parsed = String(value ?? '').trim();
  return parsed || null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
}

function readCache(fieldId: string) {
  const memory = MEMORY.get(fieldId);
  if (memory && Date.now() - memory.savedAt < CACHE_MS) return memory.result;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${fieldId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed?.savedAt || !parsed?.result || Date.now() - parsed.savedAt >= CACHE_MS) {
      return null;
    }
    MEMORY.set(fieldId, parsed);
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCache(fieldId: string, result: HybrisFieldEventsEvidence) {
  const cached: Cached = { savedAt: Date.now(), result };
  MEMORY.set(fieldId, cached);
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${fieldId}`, JSON.stringify(cached));
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

async function functionError(error: any) {
  try {
    if (error?.context instanceof Response) {
      const payload = await error.context.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
    }
  } catch {
    // no-op
  }
  return error?.message || 'HyBRIS tarla olay bağlamı alınamadı.';
}

function normalizeEvent(value: any): HybrisFieldEvent | null {
  const type = String(value?.type ?? '');
  if (type !== 'sowing' && type !== 'harvest' && type !== 'tillage') return null;

  const signalDate = text(value?.signal_date);
  if (!signalDate) return null;

  const confidenceText = text(value?.confidence);
  const confidence: HybrisFieldEvent['confidence'] =
    confidenceText === 'medium' ? 'medium' : 'low';

  return {
    type,
    signalDate,
    uncertaintyDays: Math.max(1, Math.round(num(value?.uncertainty_days) ?? 28)),
    prominence: num(value?.prominence) ?? 0,
    confidence,
    indexValue: num(value?.index_value),
    s1Contribution: num(value?.s1_contribution),
    s2Contribution: num(value?.s2_contribution),
    note: text(value?.note) ?? 'Uydu zaman serisinden olası tarımsal olay sinyali.',
  };
}

function normalize(data: any, fieldId: string): HybrisFieldEventsEvidence {
  const statusText = String(data?.status ?? 'unavailable');
  const status: HybrisFieldEventsEvidence['status'] =
    statusText === 'ready' ||
    statusText === 'insufficient_data' ||
    statusText === 'blocked'
      ? statusText
      : 'unavailable';

  const orbit = String(data?.selected_orbit_direction ?? '');
  const selectedOrbitDirection =
    orbit === 'ASCENDING' || orbit === 'DESCENDING' ? orbit : null;

  const events = Array.isArray(data?.events)
    ? data.events.map(normalizeEvent).filter(Boolean) as HybrisFieldEvent[]
    : [];

  const latest = normalizeEvent(data?.latest_event);

  return {
    ok: data?.ok === true,
    fieldId,
    status,
    source: 'HyBRIS adapted field-event evidence',
    sourceRepo: text(data?.source_repo) ?? 'https://github.com/pdallago97/HyBRIS',
    sourceCommit: text(data?.source_commit) ?? 'f554d0efb13899588b3c6e8c27420f1d267a48de',
    license: 'MIT',
    implementation:
      text(data?.implementation) ??
      'TarlaPusula TypeScript adaptation using Copernicus Data Space Sentinel Hub Statistical API',
    lookbackDays: num(data?.lookback_days) ?? 365,
    maxTemporalDistanceDays: num(data?.max_temporal_distance_days) ?? 12,
    smoothingDays: num(data?.smoothing_days) ?? 30,
    s1ObservationCount: num(data?.s1_observation_count) ?? 0,
    s2ObservationCount: num(data?.s2_observation_count) ?? 0,
    selectedOrbitDirection,
    radarBackscatter: text(data?.radar_backscatter),
    radarPreprocessing: strings(data?.radar_preprocessing),
    opticalIndex: 'BSI',
    eventDateMeaning: 'signal-window-not-exact-operation-date',
    events,
    latestEvent: latest ?? (events.length ? events[events.length - 1] : null),
    dataCoverage: {
      startDate: text(data?.data_coverage?.start_date),
      endDate: text(data?.data_coverage?.end_date),
      spanDays: num(data?.data_coverage?.span_days) ?? 0,
      fusedDays: num(data?.data_coverage?.fused_days) ?? 0,
      dualSensorDays: num(data?.data_coverage?.dual_sensor_days) ?? 0,
      dualSensorRatio: num(data?.data_coverage?.dual_sensor_ratio),
    },
    missingInputs: strings(data?.missing_inputs),
    warnings: strings(data?.warnings),
    generatedAt: text(data?.generated_at) ?? new Date().toISOString(),
  };
}

export async function fetchHybrisFieldEventsEvidence(
  fieldIdInput: string | number,
  options: { forceRefresh?: boolean } = {},
): Promise<HybrisFieldEventsEvidence> {
  if (!supabase) throw new Error('HyBRIS bağlantısı hazır değil.');

  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('HyBRIS için tarla seçilmedi.');

  if (!options.forceRefresh) {
    const cached = readCache(fieldId);
    if (cached) return cached;
  }

  const { data, error } = await supabase.functions.invoke('hybris-field-events', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(await functionError(error));
  if (!data) throw new Error('HyBRIS servisi boş yanıt döndürdü.');
  if (data.ok === false) throw new Error(data.error || 'HyBRIS olay bağlamı oluşturulamadı.');

  const result = normalize(data, fieldId);
  writeCache(fieldId, result);
  return result;
}
