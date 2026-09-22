import { useMemo } from 'react';

function compactText(value: unknown, maxLength = 74) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length > maxLength
    ? `${raw.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : raw;
}

type CalendarCollectionsInput = {
  calendarItems?: unknown;
  calendarEvents?: unknown;
  upcomingTasks?: unknown;
  tasks?: unknown;
  reminders?: unknown;
};

export function useNextCalendarItem(input: CalendarCollectionsInput) {
  return useMemo(() => {
    const collections = [
      input.calendarItems,
      input.calendarEvents,
      input.upcomingTasks,
      input.tasks,
      input.reminders,
    ];

    const now = Date.now();
    const horizon = now + 72 * 60 * 60 * 1000;

    const normalized = collections
      .flatMap((collection) => (Array.isArray(collection) ? collection : []))
      .filter((item) => item && typeof item === 'object')
      .map((item: any) => {
        const rawDate =
          item.dueDate ??
          item.due_date ??
          item.startsAt ??
          item.start_at ??
          item.startDate ??
          item.start_date ??
          item.scheduledAt ??
          item.scheduled_at ??
          item.reminderAt ??
          item.reminder_at ??
          item.datetime ??
          item.date ??
          item.start;

        const parsed = rawDate ? new Date(rawDate) : null;
        const dateMs =
          parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
        const status = String(item.status ?? '').toLocaleLowerCase('tr-TR');
        const completed =
          item.completed === true ||
          item.isCompleted === true ||
          item.is_completed === true ||
          ['done', 'completed', 'tamamlandı', 'tamamlandi'].includes(status);

        return {
          ...item,
          _tpDateMs: dateMs,
          _tpTitle: compactText(
            item.title ??
              item.name ??
              item.task ??
              item.label ??
              item.operation ??
              item.type,
            54,
          ),
          _tpCompleted: completed,
        };
      })
      .filter(
        (item: any) =>
          !item._tpCompleted &&
          item._tpDateMs != null &&
          item._tpDateMs >= now - 2 * 60 * 60 * 1000 &&
          item._tpDateMs <= horizon,
      )
      .sort((a: any, b: any) => Number(a._tpDateMs) - Number(b._tpDateMs));

    return normalized[0] ?? null;
  }, [
    input.calendarItems,
    input.calendarEvents,
    input.upcomingTasks,
    input.tasks,
    input.reminders,
  ]);
}
