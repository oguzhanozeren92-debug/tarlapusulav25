import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarLocalDate, nextSevenCalendarDates, fieldTasksForDate } from './weeklyFieldPlan.ts';

test('gece saatinde günü UTC yerine yerel tarihten başlatır ve ay sonunu aşar', () => {
  const days = nextSevenCalendarDates(new Date(2026, 8, 29, 0, 15));
  assert.equal(days[0], '2026-09-29');
  assert.equal(days[2], '2026-10-01');
  assert.equal(days.length, 7);
  assert.equal(calendarLocalDate(new Date(2026, 8, 29, 0, 15)), days[0]);
});

test('seçilen tarlanın açık işlerini saat sırasıyla gösterir', () => {
  const task = (id, fieldId, reminderTime, completed = false) => ({
    id, fieldId, reminderDate: '2026-09-29', reminderTime, completed, title: id,
  });
  const items = [task('akşam', 'a', '17:00'), task('baska', 'b', '09:00'), task('sabah', 'a', '08:30'), task('bitti', 'a', '07:00', true)];
  assert.deepEqual(fieldTasksForDate(items, '2026-09-29', 'a').map((item) => item.id), ['sabah', 'akşam']);
  assert.equal(fieldTasksForDate(items, '2026-09-30', 'a').length, 0);
});
