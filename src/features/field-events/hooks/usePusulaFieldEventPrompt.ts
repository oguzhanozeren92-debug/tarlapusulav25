import { useCallback, useEffect, useState } from 'react';
import {
  fetchHybrisFieldEventsEvidence,
  type HybrisFieldEvent,
} from '../../../services/hybrisFieldEvents.service';
import {
  createFieldOperation,
  listRecentFieldOperations,
} from '../../field-operations/services/fieldOperation.service';
import type {
  FieldOperation,
  FieldOperationType,
} from '../../field-operations/types/fieldOperation';
import {
  confirmFieldEventCandidate,
  coverFieldEventCandidate,
  dismissFieldEventCandidate,
  fieldEventCandidateKey,
  getFieldEventCandidateFeedback,
  markFieldEventCandidateSeen,
} from '../services/fieldEventCandidateFeedback.service';

const RECENT_EVENT_DAYS = 60;
const OPERATION_LOOKBACK_DAYS = 120;

function dayNumber(value: string) {
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(parsed) ? Math.round(parsed / 86_400_000) : null;
}

function eventAgeDays(value: string) {
  const day = dayNumber(value);
  if (day == null) return Number.POSITIVE_INFINITY;
  const today = Math.round(Date.now() / 86_400_000);
  return Math.max(0, today - day);
}

function matchingOperationTypes(event: HybrisFieldEvent): FieldOperationType[] {
  if (event.type === 'sowing') return ['Ekim / Dikim'];
  if (event.type === 'harvest') return ['Hasat'];
  return ['Sürme', 'İkileme', 'Çapalama'];
}

function findCoveredOperation(
  event: HybrisFieldEvent,
  operations: FieldOperation[],
) {
  const signalDay = dayNumber(event.signalDate);
  if (signalDay == null) return null;

  const allowedTypes = new Set(matchingOperationTypes(event));
  const windowDays = Math.min(28, Math.max(7, event.uncertaintyDays));

  return (
    operations.find((operation) => {
      if (!allowedTypes.has(operation.type as FieldOperationType)) return false;
      const operationDay = dayNumber(operation.date);
      return operationDay != null && Math.abs(operationDay - signalDay) <= windowDays;
    }) ?? null
  );
}

function newestEligibleEvent(events: HybrisFieldEvent[]) {
  return [...events]
    .filter(
      (event) =>
        event.confidence === 'medium' &&
        eventAgeDays(event.signalDate) <= RECENT_EVENT_DAYS,
    )
    .sort((a, b) => b.signalDate.localeCompare(a.signalDate))[0] ?? null;
}

export function usePusulaFieldEventPrompt(args: {
  fieldId: string;
  enabled: boolean;
}) {
  const { fieldId, enabled } = args;
  const [candidate, setCandidate] = useState<HybrisFieldEvent | null>(null);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !fieldId) {
      setCandidate(null);
      setNeedsAttention(false);
      setOpen(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [evidence, operations] = await Promise.all([
        fetchHybrisFieldEventsEvidence(fieldId),
        listRecentFieldOperations(fieldId, OPERATION_LOOKBACK_DAYS, 100),
      ]);

      if (evidence.status !== 'ready') {
        setCandidate(null);
        setNeedsAttention(false);
        return;
      }

      const nextCandidate = newestEligibleEvent(evidence.events);
      if (!nextCandidate) {
        setCandidate(null);
        setNeedsAttention(false);
        return;
      }

      const candidateKey = fieldEventCandidateKey(nextCandidate);
      const feedback = await getFieldEventCandidateFeedback(fieldId, candidateKey);

      if (
        feedback?.status === 'confirmed' ||
        feedback?.status === 'dismissed' ||
        feedback?.status === 'covered'
      ) {
        setCandidate(null);
        setNeedsAttention(false);
        return;
      }

      const coveredBy = findCoveredOperation(nextCandidate, operations);
      if (coveredBy) {
        setCandidate(null);
        setNeedsAttention(false);
        void coverFieldEventCandidate({
          fieldId,
          event: nextCandidate,
          operationType: coveredBy.type as FieldOperationType,
          operationId: coveredBy.id,
        }).catch((coverError) => {
          console.warn('[pusula-field-event] Kapsanan olay işaretlenemedi:', coverError);
        });
        return;
      }

      setCandidate(nextCandidate);
      setNeedsAttention(!feedback?.seenAt);
    } catch (loadError) {
      console.warn('[pusula-field-event] Olay adayı hazırlanamadı:', loadError);
      setCandidate(null);
      setNeedsAttention(false);
      setError(loadError instanceof Error ? loadError.message : 'Pusula değişim kontrolü yapılamadı.');
    } finally {
      setLoading(false);
    }
  }, [enabled, fieldId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled || !fieldId) return;

    const refresh = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      if (detail?.fieldId && String(detail.fieldId) !== fieldId) return;
      void load();
    };

    window.addEventListener('tp:field-operation-saved', refresh as EventListener);
    window.addEventListener('tp:field-context-updated', refresh as EventListener);
    return () => {
      window.removeEventListener('tp:field-operation-saved', refresh as EventListener);
      window.removeEventListener('tp:field-context-updated', refresh as EventListener);
    };
  }, [enabled, fieldId, load]);

  const openPrompt = useCallback(() => {
    if (!candidate || !fieldId) return;
    setOpen(true);
    setNeedsAttention(false);
    void markFieldEventCandidateSeen(fieldId, candidate).catch((seenError) => {
      console.warn('[pusula-field-event] Olay görüldü bilgisi kaydedilemedi:', seenError);
    });
  }, [candidate, fieldId]);

  const closePrompt = useCallback(() => setOpen(false), []);

  const dismiss = useCallback(async () => {
    if (!candidate || !fieldId) return;
    await dismissFieldEventCandidate({
      fieldId,
      event: candidate,
      responseNote: 'Kullanıcı bu dönemde tarla işlemi yapmadığını belirtti.',
    });
    setOpen(false);
    setCandidate(null);
    setNeedsAttention(false);
  }, [candidate, fieldId]);

  const confirm = useCallback(
    async (input: {
      operationType: FieldOperationType;
      date: string;
      note?: string | null;
    }) => {
      if (!candidate || !fieldId) throw new Error('Teyit edilecek Pusula olayı bulunamadı.');

      const operation = await createFieldOperation({
        fieldId,
        type: input.operationType,
        date: input.date,
        notes: [
          input.note?.trim() || null,
          "Pusula'nın fark ettiği uydu/radar değişimi sonrası kullanıcı teyidiyle kaydedildi.",
        ]
          .filter(Boolean)
          .join(' '),
      });

      await confirmFieldEventCandidate({
        fieldId,
        event: candidate,
        operationType: input.operationType,
        operationId: operation.id,
        responseNote: input.note?.trim() || null,
      });

      setOpen(false);
      setCandidate(null);
      setNeedsAttention(false);
      return operation;
    },
    [candidate, fieldId],
  );

  return {
    candidate,
    needsAttention,
    open,
    loading,
    error,
    openPrompt,
    closePrompt,
    dismiss,
    confirm,
    refresh: load,
  };
}
