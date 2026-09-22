import { supabase } from '../../../supabaseClient';
import type { CalendarReminder } from '../../../types';

export async function loadOperationQuestionData(fieldId: string) {
  if (!supabase) throw new Error('Veri bağlantısı hazır değil.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return { userId: '', reminders: [] as CalendarReminder[] };
  const now = new Date();
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const from = new Date(now); from.setDate(from.getDate() - 7);
  const { data, error } = await supabase.from('calendar_reminders')
    .select('id, field_id, reminder_type, title, reminder_date, reminder_time, completed')
    .eq('user_id', user.id).eq('field_id', fieldId).eq('completed', false)
    .gte('reminder_date', date(from)).lte('reminder_date', date(now))
    .order('reminder_date', { ascending: false }).limit(50);
  if (error) throw error;
  return { userId: user.id, reminders: (data ?? []).map((item) => ({
    id: String(item.id), fieldId: String(item.field_id), fieldName: '',
    reminderType: item.reminder_type ?? 'Diğer', title: item.title ?? '',
    reminderDate: item.reminder_date, reminderTime: item.reminder_time ?? null,
    completed: Boolean(item.completed), notes: null,
  })) as CalendarReminder[] };
}
