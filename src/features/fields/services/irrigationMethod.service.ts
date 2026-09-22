import { supabase } from '../../../supabaseClient';
import { runDualKcShadowEvidenceBestEffort } from '../../irrigation/services/dualKcShadow.service';
import { syncIrrigationEvidenceTasksBestEffort } from '../../tasks/services/fieldTasks.service';

export type FieldIrrigationMethod =
  | 'sprinkler'
  | 'basin'
  | 'border'
  | 'furrow_every_narrow'
  | 'furrow_every_wide'
  | 'furrow_alternating'
  | 'trickle'
  | 'unknown';

const ALLOWED_METHODS = new Set<FieldIrrigationMethod>([
  'sprinkler',
  'basin',
  'border',
  'furrow_every_narrow',
  'furrow_every_wide',
  'furrow_alternating',
  'trickle',
  'unknown',
]);

function normalizeMethod(value: unknown): FieldIrrigationMethod | null {
  const method = String(value ?? '').trim() as FieldIrrigationMethod;
  return ALLOWED_METHODS.has(method) ? method : null;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sulama yöntemi için oturum bulunamadı.');
  return data.user;
}

function emitUpdated(fieldId: string, method: FieldIrrigationMethod) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('tp:field-context-updated', {
      detail: {
        fieldId,
        changedFields: ['irrigation_method'],
        irrigationMethod: method,
      },
    }),
  );
}

export async function loadFieldIrrigationMethod(
  fieldIdInput: string,
): Promise<FieldIrrigationMethod | null> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return null;

  const user = await requireUser();
  const { data, error } = await supabase
    .from('fields')
    .select('id,irrigation_method')
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeMethod(data.irrigation_method);
}

export async function saveFieldIrrigationMethod(input: {
  fieldId: string;
  irrigationMethod: FieldIrrigationMethod;
}) {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Sulama yöntemi kaydı için tarla kimliği bulunamadı.');
  if (!ALLOWED_METHODS.has(input.irrigationMethod)) {
    throw new Error('Geçerli bir sulama yöntemi seç.');
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from('fields')
    .update({
      irrigation_method: input.irrigationMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id,irrigation_method')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Sulama yöntemi kaydedilemedi.');

  const savedMethod = normalizeMethod(data.irrigation_method);
  if (!savedMethod) throw new Error('Sulama yöntemi kaydedildi ancak doğrulanamadı.');

  emitUpdated(fieldId, savedMethod);
  syncIrrigationEvidenceTasksBestEffort(fieldId);
  runDualKcShadowEvidenceBestEffort(fieldId);

  return {
    fieldId: String(data.id),
    irrigationMethod: savedMethod,
  };
}
