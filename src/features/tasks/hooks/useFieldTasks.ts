import { useCallback, useEffect, useState } from 'react';
import {
  completeFieldTask,
  dismissFieldTask,
  getFieldTasks,
  type FieldTask,
} from '../services/fieldTasks.service';

export function useFieldTasks(fieldId: string, open: boolean) {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fieldId || !open) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setTasks(await getFieldTasks(fieldId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görevler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [fieldId, open]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const handleTasksChanged = (event: Event) => {
      const changedFieldId = String(
        (event as CustomEvent)?.detail?.fieldId ?? '',
      );

      if (!changedFieldId || changedFieldId === fieldId) {
        void refresh();
      }
    };

    window.addEventListener('tp:tasks-changed', handleTasksChanged);
    return () => {
      window.removeEventListener('tp:tasks-changed', handleTasksChanged);
    };
  }, [fieldId, open, refresh]);

  const complete = useCallback(async (task: FieldTask) => {
    setMessage(null);
    try {
      const result = await completeFieldTask(task);
      setMessage(result.message);
      if (result.completed) await refresh();
      return result;
    } catch (caught) {
      const next = caught instanceof Error ? caught.message : 'Görev tamamlanamadı.';
      setMessage(next);
      return { completed: false, message: next };
    }
  }, [refresh]);

  const dismiss = useCallback(async (task: FieldTask) => {
    setMessage(null);
    try {
      const result = await dismissFieldTask(task);
      setMessage(result.message);
      await refresh();
      return result;
    } catch (caught) {
      const next = caught instanceof Error ? caught.message : 'Görev ertelenemedi.';
      setMessage(next);
      return { dismissed: false, message: next };
    }
  }, [refresh]);

  return {
    tasks,
    loading,
    error,
    message,
    refresh,
    complete,
    dismiss,
  };
}
