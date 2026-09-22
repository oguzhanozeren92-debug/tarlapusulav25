import type { CalendarReminder } from '../../../types';

export function calendarLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextSevenCalendarDates(now: Date): string[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    return calendarLocalDate(day);
  });
}

export function fieldTasksForDate(reminders: CalendarReminder[], date: string, fieldId: string): CalendarReminder[] {
  return reminders
    .filter((item) => !item.completed && item.reminderDate === date && (!fieldId || item.fieldId === fieldId))
    .sort((a, b) => (a.reminderTime ?? '').localeCompare(b.reminderTime ?? '') || a.title.localeCompare(b.title, 'tr'));
}
