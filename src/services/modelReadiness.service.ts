import {
  supabase,
} from '../supabaseClient';

export type ModelEngine =
  | 'pyfao56'
  | 'pcse'
  | 'aquacrop';

export type ModelReadinessRefreshResult = {
  ok: boolean;
  engine: ModelEngine;
  fieldId: string;
  ready: boolean | null;
  missingInputs: string[];
  error: string | null;
};

export type ModelReadinessSnapshot = {
  fieldId: string;
  engine: ModelEngine;
  rollout: string;
  ready: boolean;
  availableInputs: string[];
  missingInputs: string[];
  inputAuthority: string;
  checkedAt: string;
};

export type EnsureModelReadinessResult = {
  snapshot: ModelReadinessSnapshot | null;
  refreshed: boolean;
  refresh: ModelReadinessRefreshResult | null;
};

const DEFAULT_MAX_AGE_HOURS = 24;
const inFlightRefreshes = new Map<
  string,
  Promise<ModelReadinessRefreshResult>
>();

function normalizedId(fieldId: string) {
  return String(fieldId ?? '').trim();
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(String)
    : [];
}

function mapSnapshot(row: any): ModelReadinessSnapshot {
  return {
    fieldId: String(row.field_id),
    engine: row.engine as ModelEngine,
    rollout: String(row.rollout ?? ''),
    ready: Boolean(row.ready),
    availableInputs: normalizeStringArray(row.available_inputs),
    missingInputs: normalizeStringArray(row.missing_inputs),
    inputAuthority: String(row.input_authority ?? ''),
    checkedAt: String(row.checked_at ?? ''),
  };
}

function isFresh(
  snapshot: ModelReadinessSnapshot,
  maxAgeHours: number,
) {
  const checkedAt = Date.parse(snapshot.checkedAt);
  if (!Number.isFinite(checkedAt)) return false;

  const maxAgeMs = Math.max(0.25, maxAgeHours) * 60 * 60 * 1000;
  return Date.now() - checkedAt <= maxAgeMs;
}

async function syncModelReadinessTasks(fieldId: string) {
  const field = normalizedId(fieldId);
  if (!field) return;

  const { error } = await supabase.rpc(
    'tp_sync_model_readiness_tasks',
    {
      p_field_id: field,
    },
  );

  if (error) throw error;
}

function syncModelReadinessTasksBestEffort(fieldId: string) {
  void syncModelReadinessTasks(fieldId).catch((error) => {
    console.warn(
      '[model-readiness] Pusula task sync failed',
      error,
    );
  });
}

export async function getModelReadinessSnapshot(
  fieldId: string,
  engine: ModelEngine,
): Promise<ModelReadinessSnapshot | null> {
  const field = normalizedId(fieldId);
  if (!field) return null;

  const {
    data,
    error,
  } = await supabase
    .from('model_engine_readiness_snapshots')
    .select(
      'field_id,engine,rollout,ready,available_inputs,missing_inputs,input_authority,checked_at',
    )
    .eq('field_id', field)
    .eq('engine', engine)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSnapshot(data) : null;
}

export async function refreshModelReadiness(
  fieldId: string,
  engine: ModelEngine,
): Promise<ModelReadinessRefreshResult> {
  const field = normalizedId(fieldId);
  if (!field) {
    return {
      ok: false,
      engine,
      fieldId: field,
      ready: null,
      missingInputs: [],
      error: 'Model readiness için tarla kimliği gerekli.',
    };
  }

  const key = `${engine}:${field}`;
  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const request = (async (): Promise<ModelReadinessRefreshResult> => {
    try {
      const {
        data,
        error,
      } = await supabase.functions.invoke(
        'model-engine-readiness',
        {
          body: {
            engine,
            field_id: field,
          },
        },
      );

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(
          String(
            data?.error ??
            'Model readiness yenilenemedi.',
          ),
        );
      }

      syncModelReadinessTasksBestEffort(field);

      return {
        ok: true,
        engine,
        fieldId: field,
        ready:
          typeof data.ready === 'boolean'
            ? data.ready
            : null,
        missingInputs:
          normalizeStringArray(data.missing_inputs),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        engine,
        fieldId: field,
        ready: null,
        missingInputs: [],
        error:
          error instanceof Error
            ? error.message
            : 'Model readiness yenilenemedi.',
      };
    } finally {
      inFlightRefreshes.delete(key);
    }
  })();

  inFlightRefreshes.set(key, request);
  return request;
}

export async function ensureModelReadinessFresh(
  fieldId: string,
  engine: ModelEngine,
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
): Promise<EnsureModelReadinessResult> {
  const field = normalizedId(fieldId);
  if (!field) {
    return {
      snapshot: null,
      refreshed: false,
      refresh: null,
    };
  }

  let snapshot: ModelReadinessSnapshot | null = null;

  try {
    snapshot = await getModelReadinessSnapshot(field, engine);
  } catch (error) {
    console.warn(
      `[model-readiness] ${engine} snapshot read failed`,
      error,
    );
  }

  if (snapshot && isFresh(snapshot, maxAgeHours)) {
    return {
      snapshot,
      refreshed: false,
      refresh: null,
    };
  }

  const refresh = await refreshModelReadiness(field, engine);

  if (!refresh.ok) {
    return {
      snapshot,
      refreshed: false,
      refresh,
    };
  }

  try {
    snapshot = await getModelReadinessSnapshot(field, engine);
  } catch (error) {
    console.warn(
      `[model-readiness] ${engine} refreshed snapshot read failed`,
      error,
    );
  }

  return {
    snapshot,
    refreshed: true,
    refresh,
  };
}

export function ensureModelReadinessFreshBestEffort(
  fieldId: string,
  engine: ModelEngine,
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
) {
  void ensureModelReadinessFresh(
    fieldId,
    engine,
    maxAgeHours,
  ).then((result) => {
    if (result.refresh && !result.refresh.ok) {
      console.warn(
        `[model-readiness] ${engine} freshness refresh failed`,
        result.refresh.error,
      );
    }
  });
}

export function refreshModelReadinessBestEffort(
  fieldId: string,
  engine: ModelEngine,
) {
  void refreshModelReadiness(
    fieldId,
    engine,
  ).then((result) => {
    if (!result.ok) {
      console.warn(
        `[model-readiness] ${engine} refresh failed`,
        result.error,
      );
    }
  });
}

export function ensurePyFao56ReadinessFreshBestEffort(
  fieldId: string,
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
) {
  ensureModelReadinessFreshBestEffort(
    fieldId,
    'pyfao56',
    maxAgeHours,
  );
}

export function refreshPyFao56ReadinessBestEffort(
  fieldId: string,
) {
  refreshModelReadinessBestEffort(
    fieldId,
    'pyfao56',
  );
}
