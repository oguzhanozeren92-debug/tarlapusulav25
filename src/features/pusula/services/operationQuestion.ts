import type { CalendarReminder } from '../../../types';
import type { FieldOperation, FieldOperationType } from '../../field-operations/types/fieldOperation';

const QUESTIONS: Partial<Record<FieldOperationType, string>> = {
  'Sürme': 'Tarlayı sürdün mü?', 'İkileme': 'İkileme işlemini yaptın mı?',
  'Ekim / Dikim': 'Ekim veya dikimi yaptın mı?', 'İlaçlama': 'İlaçlamayı yapabildin mi?',
  'Gübreleme': 'Gübrelemeyi yaptın mı?', 'Sulama': 'Tarlayı suladın mı?', 'Hasat': 'Hasadı yaptın mı?',
};
export function selectOperationQuestion(fieldId: string, reminders: CalendarReminder[], operations: FieldOperation[], preferences: Record<string, number>, now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return reminders.filter((item) => item.fieldId === fieldId && !item.completed).map((item) => {
    const type = item.reminderType as FieldOperationType;
    const time = item.reminderTime?.slice(0, 5) ?? '18:00';
    const date = new Date(`${item.reminderDate}T${time}:00`);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(item.reminderDate) && /^\d{2}:\d{2}$/.test(time) &&
      Number.isFinite(date.getTime()) && date.getFullYear() === Number(item.reminderDate.slice(0, 4)) &&
      date.getMonth() + 1 === Number(item.reminderDate.slice(5, 7)) && date.getDate() === Number(item.reminderDate.slice(8, 10));
    const key = JSON.stringify([fieldId, item.id, item.reminderDate, time, type]);
    return { key, type, reminder: item, title: QUESTIONS[type], due: valid ? date.getTime() : NaN };
  }).filter((item) => item.title && item.due <= now.getTime() && now.getTime() - item.due <= 7 * 86_400_000 &&
    !(preferences[item.key] > now.getTime()) && !operations.some((op) => op.fieldId === fieldId &&
      op.type === item.type && op.date >= item.reminder.reminderDate && op.date <= today)
  ).sort((a, b) => b.due - a.due)[0] ?? null;
}
