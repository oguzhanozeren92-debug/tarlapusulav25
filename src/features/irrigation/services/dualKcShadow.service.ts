import { supabase } from '../../../supabaseClient';

export const DUAL_KC_AUDIT_MAX_AGE_HOURS = 36;

export type DualKcShadowScenarioFinalState = {
  surfaceDepletionMm: number | null;
  rootDepletionMm: number | null;
  stressCoefficient: number | null;
  actualEtMm: number | null;
};

export type DualKcShadowScenario = {
  rewMm: number | null;
  dayCount: number;
  startDate: string | null;
  endDate: string | null;
  finalState: DualKcShadowScenarioFinalState;
};

export type DualKcShadowEvidence = {
  ok: boolean;
  blocked: boolean;
  notApplicable: boolean;
  cached: boolean;
  fieldId: string;
  productionAuthority: false;
  missingInputs: string[];
  scenarios: DualKcShadowScenario[];
  engineVersion: string | null;
  completedAt: string | null;
  error: string | null;
};

export type DualKcProductionComparison = {
  source: 'tarlapusula-production-irrigation-engine';
  productionAuthority: false;
  capturedAt: string;
  generatedAt: string;
  projected5DayDeficitMm: number;
  forecastStartDate: string;
  forecastEndDate: string;
  agreement: 'supportive' | 'divergent';
  confidence: 'high' | 'low';
  promotionEligibleAtCapture: boolean;
};

export type DualKcShadowAudit = {
  runId: string;
  fieldId: string;
  comparison: DualKcProductionComparison | null;
  status: 'running' | 'completed' | 'blocked' | 'failed' | 'queued';
  notApplicable: boolean;
  missingInputs: string[];
  scenarios: DualKcShadowScenario[];
  engineVersion: string | null;
  completedAt: string | null;
  productionAuthority: false;
  error: string | null;
};

const inFlight = new Map<string, Promise<DualKcShadowEvidence>>();

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeScenario(value: any): DualKcShadowScenario {
  const days = Array.isArray(value?.days) ? value.days : [];
  const dates = days
    .map((day: any) => String(day?.date ?? '').slice(0, 10))
    .filter(Boolean);
  return {
    rewMm: finiteOrNull(value?.rew_mm),
    dayCount: days.length,
    startDate: dates[0] ?? null,
    endDate: dates.at(-1) ?? null,
    finalState: {
      surfaceDepletionMm: finiteOrNull(value?.final_state?.surface_depletion_mm),
      rootDepletionMm: finiteOrNull(value?.final_state?.root_depletion_mm),
      stressCoefficient: finiteOrNull(value?.final_state?.stress_coefficient),
      actualEtMm: finiteOrNull(value?.final_state?.actual_et_mm),
    },
  };
}

function emptyEvidence(fieldId: string, error: string): DualKcShadowEvidence {
  return {
    ok: false,
    blocked: true,
    notApplicable: false,
    cached: false,
    fieldId,
    productionAuthority: false,
    missingInputs: [],
    scenarios: [],
    engineVersion: null,
    completedAt: null,
    error,
  };
}

function emitUpdated(fieldId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:dual-kc-shadow-updated', {
      detail: { fieldId },
    }),
  );
}

function isDualKcAuditRow(row: any) {
  return (
    row?.output?.shadow_scope === 'dual_kc_water_balance_bounded_rew' ||
    row?.source_versions?.pyfao56_dual_shadow_runner != null ||
    row?.input_summary?.dual_kc === true
  );
}

export function dualKcAuditAgeHours(
  audit: DualKcShadowAudit | null | undefined,
  nowMs = Date.now(),
) {
  if (!audit?.completedAt) return null;
  const completedMs = Date.parse(audit.completedAt);
  if (!Number.isFinite(completedMs)) return null;
  return Math.max(0, (nowMs - completedMs) / 3_600_000);
}

export function isDualKcShadowAuditFresh(
  audit: DualKcShadowAudit | null | undefined,
  maxAgeHours = DUAL_KC_AUDIT_MAX_AGE_HOURS,
) {
  if (!audit || audit.status !== 'completed') return false;
  const ageHours = dualKcAuditAgeHours(audit);
  return ageHours != null && ageHours <= maxAgeHours;
}

function normalizeAuditRow(row: any, fallbackFieldId: string): DualKcShadowAudit {
  const output = row?.output ?? null;
  const scenarios = Array.isArray(output?.scenarios)
    ? output.scenarios.map(normalizeScenario)
    : [];
  const rawStatus = String(row?.status ?? 'blocked');
  const status: DualKcShadowAudit['status'] =
    rawStatus === 'running' ||
    rawStatus === 'completed' ||
    rawStatus === 'failed' ||
    rawStatus === 'queued'
      ? rawStatus
      : 'blocked';

  const rawComparison = row?.comparison;
  const comparison: DualKcProductionComparison | null =
    rawComparison?.source === 'tarlapusula-production-irrigation-engine' &&
    rawComparison?.production_authority === false
      ? {
          source: 'tarlapusula-production-irrigation-engine',
          productionAuthority: false,
          capturedAt: String(rawComparison.captured_at ?? ''),
          generatedAt: String(rawComparison.generated_at ?? ''),
          projected5DayDeficitMm: Number(rawComparison.projected_5_day_deficit_mm),
          forecastStartDate: String(rawComparison.forecast_start_date ?? ''),
          forecastEndDate: String(rawComparison.forecast_end_date ?? ''),
          agreement: rawComparison.agreement === 'supportive' ? 'supportive' : 'divergent',
          confidence: rawComparison.confidence === 'high' ? 'high' : 'low',
          promotionEligibleAtCapture: rawComparison.promotion_eligible_at_capture === true,
        }
      : null;

  return {
    runId: String(row?.id ?? ''),
    fieldId: String(row?.field_id ?? fallbackFieldId),
    comparison,
    status,
    notApplicable: row?.input_summary?.reason === 'rainfed_not_applicable',
    missingInputs: stringArray(row?.missing_inputs),
    scenarios,
    engineVersion:
      row?.engine_version == null
        ? output?.engine_version == null ? null : String(output.engine_version)
        : String(row.engine_version),
    completedAt: row?.completed_at == null ? null : String(row.completed_at),
    productionAuthority: false,
    error: row?.error_message == null ? null : String(row.error_message),
  };
}

export async function loadDualKcShadowAuditHistory(
  fieldId: string,
  limit = 30,
): Promise<DualKcShadowAudit[]> {
  const field = String(fieldId ?? '').trim();
  if (!field) return [];
  const safeLimit = Math.max(3, Math.min(100, Math.floor(limit)));

  const { data, error } = await supabase
    .from('model_engine_runs')
    .select('id,field_id,status,missing_inputs,output,engine_version,error_message,completed_at,created_at,input_summary,source_versions,comparison')
    .eq('field_id', field)
    .eq('engine', 'pyfao56')
    .eq('mode', 'shadow')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .filter(isDualKcAuditRow)
    .map((row) => normalizeAuditRow(row, field));
}

export async function loadLatestDualKcShadowAudit(
  fieldId: string,
): Promise<DualKcShadowAudit | null> {
  const field = String(fieldId ?? '').trim();
  if (!field) return null;

  const { data, error } = await supabase
    .from('model_engine_runs')
    .select(
      'id,field_id,status,missing_inputs,output,engine_version,error_message,completed_at,created_at,input_summary,source_versions,comparison',
    )
    .eq('field_id', field)
    .eq('engine', 'pyfao56')
    .eq('mode', 'shadow')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const row = (Array.isArray(data) ? data : []).find(isDualKcAuditRow);
  if (!row) return null;

  return normalizeAuditRow(row, field);
}

export async function runDualKcShadowEvidence(
  fieldId: string,
): Promise<DualKcShadowEvidence> {
  const field = String(fieldId ?? '').trim();
  if (!field) return emptyEvidence('', 'Tarla kimliği gerekli.');

  const existing = inFlight.get(field);
  if (existing) return existing;

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'pyfao56-dual-kc-shadow-run',
        { body: { field_id: field } },
      );

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(String(data?.error ?? 'Gelişmiş su modeli çalıştırılamadı.'));
      }

      const result = data?.result ?? null;
      const scenarios = Array.isArray(result?.scenarios)
        ? result.scenarios.map(normalizeScenario)
        : [];

      return {
        ok: true,
        blocked: Boolean(data?.blocked),
        notApplicable: Boolean(data?.not_applicable),
        cached: Boolean(data?.cached),
        fieldId: String(data?.field_id ?? field),
        productionAuthority: false as const,
        missingInputs: stringArray(data?.missing_inputs),
        scenarios,
        engineVersion: result?.engine_version == null ? null : String(result.engine_version),
        completedAt: data?.completed_at == null ? null : String(data.completed_at),
        error: null,
      };
    } catch (error) {
      return emptyEvidence(
        field,
        error instanceof Error
          ? error.message
          : 'Gelişmiş su modeli çalıştırılamadı.',
      );
    } finally {
      inFlight.delete(field);
      emitUpdated(field);
    }
  })();

  inFlight.set(field, request);
  return request;
}

export function runDualKcShadowEvidenceBestEffort(fieldId: string) {
  const field = String(fieldId ?? '').trim();
  if (!field) return;

  void runDualKcShadowEvidence(field).then((result) => {
    if (!result.ok && result.error) {
      console.warn('[dual-kc-shadow] refresh failed', result.error);
    }
  });
}

export function summarizeDualKcShadowRange(
  evidence: Pick<DualKcShadowEvidence, 'ok' | 'blocked' | 'scenarios'> | DualKcShadowAudit | null | undefined,
) {
  const blocked = 'blocked' in (evidence ?? {})
    ? Boolean((evidence as DualKcShadowEvidence | null)?.blocked)
    : (evidence as DualKcShadowAudit | null)?.status !== 'completed';
  const ok = 'ok' in (evidence ?? {})
    ? Boolean((evidence as DualKcShadowEvidence | null)?.ok)
    : Boolean(evidence);
  const scenarios = evidence?.scenarios ?? [];

  if (!ok || blocked || scenarios.length === 0) return null;

  const rootValues = scenarios
    .map((scenario) => scenario.finalState.rootDepletionMm)
    .filter((value): value is number => value !== null);
  const surfaceValues = scenarios
    .map((scenario) => scenario.finalState.surfaceDepletionMm)
    .filter((value): value is number => value !== null);
  const stressValues = scenarios
    .map((scenario) => scenario.finalState.stressCoefficient)
    .filter((value): value is number => value !== null);
  const actualEtValues = scenarios
    .map((scenario) => scenario.finalState.actualEtMm)
    .filter((value): value is number => value !== null);

  const range = (values: number[]) =>
    values.length
      ? { min: Math.min(...values), max: Math.max(...values) }
      : null;

  return {
    rootDepletionMm: range(rootValues),
    surfaceDepletionMm: range(surfaceValues),
    stressCoefficient: range(stressValues),
    actualEtMm: range(actualEtValues),
    scenarioCount: scenarios.length,
    productionAuthority: false as const,
  };
}
