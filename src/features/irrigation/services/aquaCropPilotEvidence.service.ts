import { supabase } from '../../../supabaseClient';
import type { AquaCropPilotEvidence } from '../types/irrigationDecision';

export const AQUACROP_AUDIT_MAX_AGE_HOURS = 36;

export type AquaCropPilotAudit = {
  fieldId: string;
  status: 'running' | 'completed' | 'blocked' | 'failed' | 'queued';
  missingInputs: string[];
  engineVersion: string | null;
  completedAt: string | null;
  inputSummary: Record<string, unknown>;
  output: Record<string, any> | null;
  error: string | null;
  sourceVersions: Record<string, unknown>;
};

const inFlight = new Map<string, Promise<AquaCropPilotAudit | null>>();
const SESSION_ATTEMPT_PREFIX = 'tp:aquacrop-pilot-attempt:';
const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeStatus(value: unknown): AquaCropPilotAudit['status'] {
  const status = String(value ?? 'blocked');
  if (status === 'running' || status === 'completed' || status === 'failed' || status === 'queued') {
    return status;
  }
  return 'blocked';
}

function normalizeAudit(row: any): AquaCropPilotAudit {
  return {
    fieldId: String(row?.field_id ?? ''),
    status: normalizeStatus(row?.status),
    missingInputs: stringArray(row?.missing_inputs),
    engineVersion: row?.engine_version == null ? null : String(row.engine_version),
    completedAt: row?.completed_at == null ? null : String(row.completed_at),
    inputSummary: row?.input_summary && typeof row.input_summary === 'object'
      ? row.input_summary
      : {},
    output: row?.output && typeof row.output === 'object' ? row.output : null,
    error: row?.error_message == null ? null : String(row.error_message),
    sourceVersions: row?.source_versions && typeof row.source_versions === 'object'
      ? row.source_versions
      : {},
  };
}

function emitUpdated(fieldId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:aquacrop-pilot-updated', { detail: { fieldId } }),
  );
}

function recentAttempt(fieldId: string) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(`${SESSION_ATTEMPT_PREFIX}${fieldId}`);
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && Date.now() - timestamp < ATTEMPT_TTL_MS;
  } catch {
    return false;
  }
}

function markAttempt(fieldId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SESSION_ATTEMPT_PREFIX}${fieldId}`, String(Date.now()));
  } catch {
    // localStorage unavailable is not fatal; in-flight guard still prevents overlap.
  }
}

export function aquaCropAuditAgeHours(
  audit: AquaCropPilotAudit | null | undefined,
  nowMs = Date.now(),
) {
  if (!audit?.completedAt) return null;
  const completedMs = Date.parse(audit.completedAt);
  if (!Number.isFinite(completedMs) || completedMs > nowMs + 60_000) return null;
  return (nowMs - completedMs) / 3_600_000;
}

export function isAquaCropPilotAuditFresh(
  audit: AquaCropPilotAudit | null | undefined,
  maxAgeHours = AQUACROP_AUDIT_MAX_AGE_HOURS,
) {
  if (!audit || audit.status !== 'completed') return false;
  const ageHours = aquaCropAuditAgeHours(audit);
  return ageHours != null && ageHours <= maxAgeHours;
}

export async function loadLatestAquaCropPilotAudit(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return null;

  const { data, error } = await supabase
    .from('model_engine_runs')
.select('field_id,status,missing_inputs,engine_version,completed_at,input_summary,source_versions,output,error_message,created_at')
    .eq('field_id', fieldId)
    .eq('engine', 'aquacrop')
    .eq('mode', 'pilot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeAudit(data) : null;
}

export function toAquaCropPilotEvidence(
  audit: AquaCropPilotAudit | null | undefined,
): AquaCropPilotEvidence {
  if (!audit) {
    return {
      status: 'waiting',
      sourceModel: 'aquacrop-pilot',
      productionAuthority: false,
      engineVersion: null,
      completedAt: null,
      missingInputs: [],
      cropModelKey: null,
      simulationStart: null,
      simulationEnd: null,
      weatherDays: null,
      soilLayerCount: null,
      initialWaterLayerCount: null,
      irrigationMode: null,
      evidence: [],
      note: 'AquaCrop pilot doğrulaması henüz çalışmadı.',
    };
  }

  const output = audit.output;
  const outputSimulation = output?.simulation;
  const sourceFingerprints = audit.sourceVersions?.fingerprints && typeof audit.sourceVersions.fingerprints === 'object'
    ? audit.sourceVersions.fingerprints as Record<string, unknown>
    : {};
  const trustedCompletedOutput =
    audit.status === 'completed' &&
    output?.engine === 'aquacrop' &&
    output?.mode === 'pilot' &&
    output?.production_authority === false &&
    output?.irrigation_prescription_authority === false &&
    output?.yield_authority === false &&
    output?.evidence_scope === 'season_scale_validation_only' &&
    output?.outputs?.evidence_only === true &&
    finiteNumber(output?.outputs?.simulation_result_rows) === 1 &&
    finiteNumber(output?.contract_version) === 8 &&
    audit.engineVersion === '3.1.0' &&
    stringOrNull(output?.engine_version) === audit.engineVersion &&
    stringOrNull(audit.sourceVersions?.crop_parameter_source_commit) === '36cc20e44644ed1704398889312435c85e04a2f3' &&
    stringOrNull(audit.sourceVersions?.aquacrop_runtime_package) === '3.1.0' &&
    finiteNumber(audit.sourceVersions?.input_adapter_version) === 4 &&
    finiteNumber(audit.sourceVersions?.run_adapter_version) === 3 &&
    stringOrNull(audit.sourceVersions?.weather) === 'Open-Meteo Archive' &&
    stringOrNull(audit.sourceVersions?.weather_timezone) === 'UTC' &&
    finiteNumber(audit.sourceVersions?.weather_adapter_contract_version) === 2 &&
    Array.isArray(audit.sourceVersions?.weather_variables) &&
    ['temperature_2m_min', 'temperature_2m_max', 'precipitation_sum', 'et0_fao_evapotranspiration'].every((key) =>
      (audit.sourceVersions.weather_variables as unknown[]).map(String).includes(key)
    ) &&
    ['weather', 'soil', 'initial_water', 'irrigation_management'].every((key) => /^[a-f0-9]{64}$/.test(String(sourceFingerprints[key] ?? ''))) &&
    Boolean(audit.sourceVersions?.soil) &&
    finiteNumber(audit.sourceVersions?.soil_adapter_contract_version) === 2 &&
    stringOrNull(audit.sourceVersions?.soil_pedotransfer_method) === 'Saxton-Rawls 2006' &&
    Boolean(audit.sourceVersions?.crop_parameters) &&
    Boolean(audit.sourceVersions?.initial_water) &&
    Boolean(audit.sourceVersions?.irrigation_management) &&
    stringOrNull(output?.field_id) === audit.fieldId &&
    stringOrNull(outputSimulation?.start) === stringOrNull(audit.inputSummary?.simulation_start) &&
    stringOrNull(outputSimulation?.planting_date) === stringOrNull(audit.inputSummary?.simulation_start) &&
    stringOrNull(outputSimulation?.end) === stringOrNull(audit.inputSummary?.simulation_end) &&
    stringOrNull(outputSimulation?.crop_model_key) === stringOrNull(audit.inputSummary?.crop_model_key) &&
    finiteNumber(outputSimulation?.weather_days) === finiteNumber(audit.inputSummary?.weather_days) &&
    finiteNumber(audit.inputSummary?.archive_lag_days) === 5 &&
    finiteNumber(audit.inputSummary?.model_payload_bytes) != null &&
    finiteNumber(audit.inputSummary?.model_payload_bytes)! > 0 &&
    finiteNumber(audit.inputSummary?.model_payload_bytes)! <= 2_000_000 &&
    finiteNumber(outputSimulation?.soil_layers) === finiteNumber(audit.inputSummary?.soil_layers) &&
    finiteNumber(outputSimulation?.initial_water_layers) === finiteNumber(audit.inputSummary?.initial_water_layers) &&
    stringOrNull(outputSimulation?.irrigation_mode) === stringOrNull(audit.inputSummary?.irrigation_mode) &&
    stringOrNull(outputSimulation?.initial_water_method) === 'Depth' &&
    stringOrNull(outputSimulation?.initial_water_depth_semantics) === 'measured_interval_midpoints' &&
    stringOrNull(outputSimulation?.daily_output_integrity) === 'exact_zero_based_time_step_counter' &&
    stringOrNull(outputSimulation?.output_scope) === 'water_balance_evidence_only';

  const simulation = trustedCompletedOutput ? output?.simulation ?? {} : {};
  const summary = audit.inputSummary ?? {};
  const cropModelKey = stringOrNull(simulation.crop_model_key ?? summary.crop_model_key);
  const simulationStart = stringOrNull(simulation.start ?? summary.simulation_start);
  const simulationEnd = stringOrNull(simulation.end ?? summary.simulation_end);
  const weatherDays = finiteNumber(simulation.weather_days ?? summary.weather_days);
  const soilLayerCount = finiteNumber(simulation.soil_layers ?? summary.soil_layers);
  const initialWaterLayerCount = finiteNumber(
    simulation.initial_water_layers ?? summary.initial_water_layers,
  );
  const irrigationMode = stringOrNull(simulation.irrigation_mode);

  const staleCompletedAudit =
    audit.status === 'completed' && !isAquaCropPilotAuditFresh(audit);
  const untrustedCompletedAudit = audit.status === 'completed' && !trustedCompletedOutput;

  if (audit.status !== 'completed' || staleCompletedAudit || untrustedCompletedAudit) {
    const status: AquaCropPilotEvidence['status'] = untrustedCompletedAudit
      ? 'error'
      : staleCompletedAudit
        ? 'waiting'
      : audit.status === 'failed'
        ? 'error'
        : audit.status === 'blocked'
          ? 'blocked'
          : 'waiting';
    return {
      status,
      sourceModel: 'aquacrop-pilot',
      productionAuthority: false,
      engineVersion: audit.engineVersion,
      completedAt: audit.completedAt,
      missingInputs: [...audit.missingInputs],
      cropModelKey,
      simulationStart,
      simulationEnd,
      weatherDays,
      soilLayerCount,
      initialWaterLayerCount,
      irrigationMode,
      evidence: [],
      note: untrustedCompletedAudit
        ? 'AquaCrop tamamlanmış kaydının model güven sınırı doğrulanamadı; kanıt olarak kullanılmadı.'
        : staleCompletedAudit
          ? 'AquaCrop sezon kanıtı güncelliğini yitirdi; yeni hava ve saha girdileriyle yenileniyor.'
        : audit.status === 'failed'
          ? audit.error || 'AquaCrop pilot tamamlanamadı.'
          : audit.missingInputs.length
            ? `AquaCrop pilot ${audit.missingInputs.length} gerçek girdi eksik olduğu için sentetik değer üretmeden bekliyor.`
            : 'AquaCrop pilot doğrulaması hazırlanıyor.',
    };
  }

  const evidence = [
    cropModelKey ? `AquaCrop ürün modeli: ${cropModelKey}` : '',
    simulationStart && simulationEnd
      ? `Sezon simülasyonu: ${simulationStart} – ${simulationEnd}`
      : '',
    weatherDays != null ? `Gerçek tarihli hava girdisi: ${Math.round(weatherDays)} gün` : '',
    soilLayerCount != null ? `Toprak profili: ${Math.round(soilLayerCount)} katman` : '',
    initialWaterLayerCount != null
      ? `Başlangıç su profili: ${Math.round(initialWaterLayerCount)} katman`
      : '',
    irrigationMode ? `Sulama yönetimi: ${irrigationMode}` : '',
  ].filter(Boolean);

  return {
    status: 'ready',
    sourceModel: 'aquacrop-pilot',
    productionAuthority: false,
    engineVersion: audit.engineVersion,
    completedAt: audit.completedAt,
    missingInputs: [],
    cropModelKey,
    simulationStart,
    simulationEnd,
    weatherDays,
    soilLayerCount,
    initialWaterLayerCount,
    irrigationMode,
    evidence: evidence.slice(0, 6),
    note:
      'AquaCrop sezon simülasyonu gerçek hava, toprak, başlangıç suyu ve yönetim girdileriyle tamamlandı. Bu pilot kanıttır; bugünkü sulama reçetesinin yerine geçmez.',
  };
}

export async function runAquaCropPilotEvidence(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return null;

  const existing = inFlight.get(fieldId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('aquacrop-pilot-run', {
        body: { field_id: fieldId },
      });
      if (error) throw error;
      // The edge function persists both completed and blocked states. Always reload
      // the canonical audit row instead of trusting client-facing response shape.
      return await loadLatestAquaCropPilotAudit(fieldId);
    } catch (error) {
      console.warn('[AquaCrop pilot] doğrulama çalıştırılamadı:', error);
      return await loadLatestAquaCropPilotAudit(fieldId).catch(() => null);
    } finally {
      inFlight.delete(fieldId);
      emitUpdated(fieldId);
    }
  })();

  inFlight.set(fieldId, request);
  return request;
}

export function runAquaCropPilotEvidenceBestEffort(
  fieldIdInput: string,
  options: { force?: boolean } = {},
) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return;
  if (!options.force && recentAttempt(fieldId)) return;
  markAttempt(fieldId);
  void runAquaCropPilotEvidence(fieldId);
}