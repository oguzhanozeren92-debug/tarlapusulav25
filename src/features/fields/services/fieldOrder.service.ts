import { supabase } from '../../../supabaseClient';

export async function reorderUserFields(fieldIds: string[]) {
  const ids = fieldIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return;

  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.rpc('tp_reorder_fields', {
    p_field_ids: ids,
  });

  if (error) throw error;
  if (data !== true) {
    throw new Error('Tarla sıralaması kaydedilemedi.');
  }
}
