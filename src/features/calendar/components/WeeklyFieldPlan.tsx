import { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import type { CalendarReminder, Field } from '../../../types';
import { fieldTasksForDate, nextSevenCalendarDates } from '../services/weeklyFieldPlan';
import './WeeklyFieldPlan.css';

type Props = {
  reminders: CalendarReminder[];
  fields: Field[];
  loading: boolean;
  onAdd: (date: string, fieldId: string) => void;
};

function dateLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', options).format(new Date(year, month - 1, day, 12));
}

export default function WeeklyFieldPlan({ reminders, fields, loading, onAdd }: Props) {
  const dates = nextSevenCalendarDates(new Date());
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [fieldId, setFieldId] = useState('');
  const activeDate = dates.includes(selectedDate) ? selectedDate : dates[0];
  const activeField = fields.some((field) => String(field.id) === fieldId) ? fieldId : '';
  const tasks = fieldTasksForDate(reminders, activeDate, activeField);

  return (
    <section className="tp-week-plan" aria-labelledby="tp-week-plan-title">
      <div className="tp-week-plan-heading">
        <span className="tp-week-plan-icon"><CalendarDays size={20} aria-hidden="true" /></span>
        <div><small>ÖNÜMÜZDEKİ 7 GÜN</small><h2 id="tp-week-plan-title">Tarla planım</h2></div>
      </div>

      {fields.length > 1 && (
        <div className="tp-week-plan-fields" role="group" aria-label="Tarla seçimi">
          <button type="button" aria-pressed={!activeField} className={!activeField ? 'is-active' : ''} onClick={() => setFieldId('')}>Tüm tarlalar</button>
          {fields.map((field) => (
            <button key={field.id} type="button" aria-pressed={activeField === String(field.id)} className={activeField === String(field.id) ? 'is-active' : ''} onClick={() => setFieldId(String(field.id))}>{field.name}</button>
          ))}
        </div>
      )}

      <div className="tp-week-plan-days" role="group" aria-label="Plan günü seç">
        {dates.map((date, index) => {
          const count = fieldTasksForDate(reminders, date, activeField).length;
          return (
            <button key={date} type="button" className={activeDate === date ? 'is-active' : ''} aria-pressed={activeDate === date} aria-label={`${index === 0 ? 'Bugün' : dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} iş`} onClick={() => setSelectedDate(date)}>
              <span>{index === 0 ? 'Bugün' : dateLabel(date, { weekday: 'short' })}</span>
              <strong>{dateLabel(date, { day: 'numeric' })}</strong>
              <i aria-hidden="true">{count || '·'}</i>
            </button>
          );
        })}
      </div>

      <div className="tp-week-plan-detail" aria-live="polite">
        <strong>{dateLabel(activeDate, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        {loading ? <p>Tarla işleri yükleniyor…</p> : tasks.length ? (
          <ul>{tasks.map((task) => (
            <li key={task.id}>
              <span className="tp-week-plan-task-time">{task.reminderTime?.slice(0, 5) || 'Gün boyu'}</span>
              <span><b>{task.title}</b><small>{task.fieldName} · {task.reminderType}</small></span>
            </li>
          ))}</ul>
        ) : <p>Bu güne planlanmış iş yok.</p>}
      </div>

      <button type="button" className="tp-week-plan-add" onClick={() => onAdd(activeDate, activeField)}>
        <Plus size={18} aria-hidden="true" /> Bu güne iş ekle
      </button>
    </section>
  );
}
