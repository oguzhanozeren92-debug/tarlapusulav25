import { useEffect, useMemo, useState } from 'react';

import { listRecentFieldOperations } from '../services/fieldOperation.service';
import type { FieldOperation } from '../types/fieldOperation';

type State = {
  fieldKey: string;
  loading: boolean;
  operations: FieldOperation[];
  error: string | null;
};

const EMPTY_STATE: State = {
  fieldKey: '',
  loading: false,
  operations: [],
  error: null,
};

export function useRecentFieldOperations(
  fieldId: string | number | null | undefined,
  lookbackDays = 30,
) {
  const fieldKey = fieldId == null ? '' : String(fieldId).trim();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey) {
      setState(EMPTY_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState((current) => ({
      fieldKey,
      loading: true,
      operations:
        current.fieldKey === fieldKey ? current.operations : [],
      error: null,
    }));

    void listRecentFieldOperations(fieldKey, lookbackDays, 40)
      .then((operations) => {
        if (cancelled) return;
        setState({
          fieldKey,
          loading: false,
          operations,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          fieldKey,
          loading: false,
          operations: [],
          error:
            error instanceof Error
              ? error.message
              : 'Tarla işlemleri alınamadı.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, lookbackDays, refreshKey]);

  useEffect(() => {
    if (!fieldKey || typeof window === 'undefined') return;

    const refreshForField = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      if (String(detail?.fieldId ?? '') !== fieldKey) return;
      setRefreshKey((value) => value + 1);
    };

    window.addEventListener(
      'tp:field-operation-saved',
      refreshForField as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-operation-saved',
        refreshForField as EventListener,
      );
    };
  }, [fieldKey]);

  const belongsToField = state.fieldKey === fieldKey;
  const operations = belongsToField ? state.operations : [];

  const signature = useMemo(
    () =>
      operations
        .map(
          (item) =>
            `${item.id}:${item.type}:${item.date}:${item.quantity ?? ''}:${item.unit ?? ''}`,
        )
        .join('|'),
    [operations],
  );

  return {
    operations,
    loading: belongsToField ? state.loading : Boolean(fieldKey),
    error: belongsToField ? state.error : null,
    signature,
    refresh: () => setRefreshKey((value) => value + 1),
  };
}
