import { useEffect, useRef, useState } from 'react';
import { selectOperationQuestion } from '../services/operationQuestion';
import { loadOperationQuestionData } from '../services/operationQuestionData';
import type { CalendarReminder } from '../../../types';
import type { FieldOperation } from '../../field-operations/types/fieldOperation';
import FieldOperationModal from '../../field-operations/components/FieldOperationModal';
import './PusulaOperationQuestion.css';

export default function PusulaOperationQuestion({ fieldId, fieldName, operations, ready, paused, onActiveChange }: {
  fieldId: string; fieldName: string; operations: FieldOperation[]; ready: boolean; paused: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const [data, setData] = useState<{ fieldId: string; userId: string; reminders: CalendarReminder[] } | null>(null);
  const [preferences, setPreferences] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(() => new Date());
  const [record, setRecord] = useState<ReturnType<typeof selectOperationQuestion> | null>(null);
  const savedKey = useRef('');
  useEffect(() => {
    let cancelled = false;
    setData(null); setRecord(null);
    const load = () => void loadOperationQuestionData(fieldId).then((result) => {
      if (cancelled) return;
      setData({ ...result, fieldId }); setClock(new Date());
      try { const value = JSON.parse(localStorage.getItem(`tp_operation_questions_v1:${result.userId}`) ?? '{}'); setPreferences(value && typeof value === 'object' && !Array.isArray(value) ? value : {}); }
      catch { setPreferences({}); }
    }).catch(() => { if (!cancelled) setData(null); });
    if (fieldId) load();
    const onVisible = () => { if (document.visibilityState === 'visible' && fieldId) load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fieldId]);
  const question = data?.fieldId === fieldId && data.userId && ready
    ? selectOperationQuestion(fieldId, data.reminders, operations, preferences, clock) : null;
  const active = Boolean(question && !paused || record);
  useEffect(() => { onActiveChange(active); return () => onActiveChange(false); }, [active, onActiveChange]);
  const remember = (key: string, duration: number) => {
    const now = Date.now();
    const next = Object.fromEntries(Object.entries({ ...preferences, [key]: now + duration }).filter(([, until]) => Number.isFinite(until) && until > now).slice(-100));
    setPreferences(next);
    try { localStorage.setItem(`tp_operation_questions_v1:${data?.userId}`, JSON.stringify(next)); } catch { /* Oturum boyunca hatırlanır. */ }
  };
  return <>
    {question && !paused && !record && <aside className="tp-operation-question" aria-label="Pusula işlem sorusu">
      <div className="tp-operation-question-logo" aria-hidden="true"><img src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp" alt="" /><img className="tp-operation-question-needle" src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp" alt="" /></div>
      <div className="tp-operation-question-copy"><small>PUSULA · {fieldName}</small><strong>{question.title}</strong><p>Takviminde {question.reminder.reminderDate.split('-').reverse().join('.')} için bu işlem vardı. Yaptıysan kaydını ekleyelim.</p>
        <div className="tp-operation-question-actions"><button type="button" onClick={() => { savedKey.current = ''; setRecord(question); }}>Yaptım</button><button type="button" onClick={() => remember(question.key, 8 * 86_400_000)}>Yapmadım</button></div>
        <button className="tp-operation-question-later" type="button" onClick={() => remember(question.key, 24 * 60 * 60 * 1000)}>Şimdi değil</button>
      </div>
    </aside>}
    <FieldOperationModal open={Boolean(record)} fieldId={record ? fieldId : null} fieldName={fieldName} initialType={record?.type ?? 'Sürme'} initialDate={record?.reminder.reminderDate} onClose={() => { if (record && savedKey.current !== record.key) remember(record.key, 24 * 60 * 60 * 1000); setRecord(null); }} onSaved={() => { if (record) { savedKey.current = record.key; remember(record.key, 8 * 86_400_000); } }} />
  </>;
}
