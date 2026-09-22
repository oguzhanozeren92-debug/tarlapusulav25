import { supabase } from '../../../supabaseClient';
import type { FieldOperationType } from '../../field-operations/types/fieldOperation';
import type {
  HybrisFieldEvent,
  HybrisFieldEventType,
} from '../../../services/hybrisFieldEvents.service';

export type FieldEventFeedbackStatus =
  | 'seen'
  | 'confirmed'
  | 'dismissed'
  | 'covered';

export type FieldEventCandidateFeedback = {
  id: string;
  fieldId: string;
  candidateKey: string;
  eventType: HybrisFieldEventType;
  signalDate: string;
  uncertaintyDays: number;
  confidence: 'medium' | 'low';
  prominence: number | null;
  status: FieldEventFeedbackStatus;
  seenAt: string | null;
  respondedAt: string | null;
  responseOperationType: string | null;
  confirmedOperationId: string | null;
  responseNote: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

function mapRow(row: any): FieldEventCandidateFeedback {
  return {
    id: String(row.id),
    fieldId: String(row.field_id),
    candidateKey: String(row.candidate_key),
    eventType: String(row.event_type) as HybrisFieldEventType,
    signalDate: String(row.signal_date),
    uncertaintyDays: Number(row.uncertainty_days ?? 28),
    confidence: row.confidence === 'medium' ? 'medium' : 'low',
    prominence: Number.isFinite(Number(row.prominence)) ? Number(row.prominence) : null,
    status: String(row.status) as FieldEventFeedbackStatus,
    seenAt: row.seen_at ? String(row.seen_at) : null,
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    responseOperationType: row.response_operation_type
      ? String(row.response_operation_type)
      : null,
    confirmedOperationId: row.confirmed_operation_id
      ? String(row.confirmed_operation_id)
      : null,
    responseNote: row.response_note ? String(row.response_note) : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Pusula teyidi için oturum gerekli.');
  return data.user.id;
}

export function fieldEventCandidateKey(event: HybrisFieldEvent) {
  return `hybris:${event.type}:${event.signalDate}`;
}

export async function getFieldEventCandidateFeedback(
  fieldIdInput: string,
  candidateKey: string,
): Promise<FieldEventCandidateFeedback | null> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId || !candidateKey) return null;

  const { data, error } = await supabase
    .from('field_event_candidate_feedback')
    .select('*')
    .eq('field_id', fieldId)
    .eq('candidate_key', candidateKey)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      throw new Error('Pusula olay teyidi tablosu henüz veritabanına uygulanmamış.');
    }
    throw error;
  }

  return data ? mapRow(data) : null;
}

async function insertSeen(
  fieldId: string,
  event: HybrisFieldEvent,
): Promise<FieldEventCandidateFeedback> {
  const uid = await userId();
  const now = new Date().toISOString();
  const candidateKey = fieldEventCandidateKey(event);

  const { data, error } = await supabase
    .from('field_event_candidate_feedback')
    .insert({
      user_id: uid,
      field_id: fieldId,
      source: 'hybris',
      candidate_key: candidateKey,
      event_type: event.type,
      signal_date: event.signalDate,
      uncertainty_days: event.uncertaintyDays,
      confidence: event.confidence,
      prominence: event.prominence,
      status: 'seen',
      seen_at: now,
      metadata: {
        indexValue: event.indexValue,
        s1Contribution: event.s1Contribution,
        s2Contribution: event.s2Contribution,
        sourceNote: event.note,
      },
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const existing = await getFieldEventCandidateFeedback(fieldId, candidateKey);
      if (existing) return existing;
    }
    throw error;
  }

  return mapRow(data);
}

export async function markFieldEventCandidateSeen(
  fieldIdInput: string,
  event: HybrisFieldEvent,
) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('Pusula teyidi için tarla seçilemedi.');

  const key = fieldEventCandidateKey(event);
  const existing = await getFieldEventCandidateFeedback(fieldId, key);
  if (existing) return existing;
  return insertSeen(fieldId, event);
}

async function finalizeFeedback(args: {
  fieldId: string;
  event: HybrisFieldEvent;
  status: 'confirmed' | 'dismissed' | 'covered';
  operationType?: FieldOperationType | null;
  operationId?: string | null;
  responseNote?: string | null;
}) {
  const uid = await userId();
  const now = new Date().toISOString();
  const candidateKey = fieldEventCandidateKey(args.event);

  const payload = {
    user_id: uid,
    field_id: args.fieldId,
    source: 'hybris',
    candidate_key: candidateKey,
    event_type: args.event.type,
    signal_date: args.event.signalDate,
    uncertainty_days: args.event.uncertaintyDays,
    confidence: args.event.confidence,
    prominence: args.event.prominence,
    status: args.status,
    seen_at: now,
    responded_at: now,
    response_operation_type: args.operationType ?? null,
    confirmed_operation_id: args.operationId ?? null,
    response_note: args.responseNote ?? null,
    metadata: {
      indexValue: args.event.indexValue,
      s1Contribution: args.event.s1Contribution,
      s2Contribution: args.event.s2Contribution,
      sourceNote: args.event.note,
    },
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('field_event_candidate_feedback')
    .upsert(payload, { onConflict: 'user_id,field_id,candidate_key' })
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function confirmFieldEventCandidate(args: {
  fieldId: string;
  event: HybrisFieldEvent;
  operationType: FieldOperationType;
  operationId: string;
  responseNote?: string | null;
}) {
  return finalizeFeedback({
    ...args,
    status: 'confirmed',
  });
}

export async function dismissFieldEventCandidate(args: {
  fieldId: string;
  event: HybrisFieldEvent;
  responseNote?: string | null;
}) {
  return finalizeFeedback({
    ...args,
    status: 'dismissed',
  });
}

export async function coverFieldEventCandidate(args: {
  fieldId: string;
  event: HybrisFieldEvent;
  operationType?: FieldOperationType | null;
  operationId?: string | null;
}) {
  return finalizeFeedback({
    ...args,
    status: 'covered',
    responseNote: 'Aynı olay penceresinde mevcut kullanıcı işlem kaydı bulundu.',
  });
}
