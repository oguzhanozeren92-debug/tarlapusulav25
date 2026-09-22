import { useEffect, useMemo, useState } from 'react';
import {
  Droplets,
  MoreHorizontal,
  Sprout,
  Tractor,
  Wheat,
  X,
} from 'lucide-react';
import type { FieldOperationType } from '../../field-operations/types/fieldOperation';
import type { HybrisFieldEvent } from '../../../services/hybrisFieldEvents.service';
import './PusulaFieldEventSheet.css';

type AnswerOption = {
  type: FieldOperationType;
  label: string;
  detail: string;
  icon: typeof Tractor;
};

const ANSWERS: AnswerOption[] = [
  { type: 'Sürme', label: 'Sürüm / Toprak işleme', detail: 'Sürme, ikileme veya benzeri hazırlık', icon: Tractor },
  { type: 'Ekim / Dikim', label: 'Ekim / Dikim', detail: 'Tohum veya fide/fidan ekimi', icon: Sprout },
  { type: 'Hasat', label: 'Hasat', detail: 'Ürünü kaldırdım / biçtim', icon: Wheat },
  { type: 'Sulama', label: 'Sulama', detail: 'Bu dönemde sulama yaptım', icon: Droplets },
  { type: 'Diğer', label: 'Başka işlem', detail: 'Listede olmayan bir işlem', icon: MoreHorizontal },
];

function trDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
  }).format(parsed);
}

function eventHint(event: HybrisFieldEvent) {
  if (event.type === 'sowing') return 'Ekim dönemine benzeyen bir değişim';
  if (event.type === 'harvest') return 'Hasat dönemine benzeyen bir değişim';
  return 'Toprak/yüzey yapısında belirgin bir değişim';
}

export default function PusulaFieldEventSheet({
  open,
  fieldName,
  candidate,
  onClose,
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  fieldName: string;
  candidate: HybrisFieldEvent | null;
  onClose: () => void;
  onDismiss: () => Promise<void>;
  onConfirm: (input: {
    operationType: FieldOperationType;
    date: string;
    note?: string | null;
  }) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [date, setDate] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !candidate) return;
    setSelected(null);
    setEditingDate(false);
    setDate(candidate.signalDate);
    setOtherNote('');
    setSaving(false);
    setError(null);
  }, [open, candidate?.signalDate]);

  const dateLabel = useMemo(() => (date ? trDate(date) : ''), [date]);

  if (!open || !candidate) return null;

  const save = async () => {
    if (!selected || !date || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        operationType: selected.type,
        date,
        note: selected.type === 'Diğer' ? otherNote : null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'İşlem kaydedilemedi.');
      setSaving(false);
    }
  };

  const dismiss = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onDismiss();
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'Cevap kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <div
      className="tp-field-event-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="tp-field-event-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-field-event-title"
      >
        <div className="tp-field-event-handle" aria-hidden="true" />

        <header className="tp-field-event-head">
          <div className="tp-field-event-compass" aria-hidden="true">
            <img
              src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp"
              alt=""
              draggable={false}
            />
            <img
              className="tp-field-event-compass-needle"
              src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp"
              alt=""
              draggable={false}
            />
          </div>
          <div>
            <small>PUSULA FARK ETTİ</small>
            <h3 id="tp-field-event-title">Tarlada bir değişiklik gördüm</h3>
          </div>
          <button type="button" className="tp-field-event-close" onClick={onClose} disabled={saving} aria-label="Kapat">
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="tp-field-event-signal">
          <strong>{fieldName}</strong>
          <span>{trDate(candidate.signalDate)} civarında</span>
          <p>{eventHint(candidate)} algılandı. Uydu/radar sinyali tek başına işlemin ne olduğunu söylemez.</p>
        </div>

        {!selected ? (
          <>
            <div className="tp-field-event-question">Bu günlerde tarlada ne yaptın?</div>
            <div className="tp-field-event-options">
              {ANSWERS.map((answer) => {
                const Icon = answer.icon;
                return (
                  <button key={answer.type} type="button" onClick={() => setSelected(answer)} disabled={saving}>
                    <span className="tp-field-event-option-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span><strong>{answer.label}</strong><small>{answer.detail}</small></span>
                    <b aria-hidden="true">›</b>
                  </button>
                );
              })}
            </div>

            <button type="button" className="tp-field-event-none" onClick={() => void dismiss()} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Hiçbir şey yapmadım'}
            </button>
          </>
        ) : (
          <div className="tp-field-event-confirm">
            <small>TEYİT</small>
            <h4>{selected.label}</h4>
            <p>
              İşlem tarihi olarak <strong>{dateLabel}</strong> kaydedilsin mi? Uydu sinyal tarihi yaklaşık olduğu için gerekirse tarihi düzelt.
            </p>

            {editingDate && (
              <label className="tp-field-event-date">
                <span>İşlem tarihi</span>
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                  disabled={saving}
                />
              </label>
            )}

            {selected.type === 'Diğer' && (
              <label className="tp-field-event-date">
                <span>Ne yaptın?</span>
                <input
                  type="text"
                  value={otherNote}
                  maxLength={180}
                  placeholder="Kısaca yazabilirsin"
                  onChange={(event) => setOtherNote(event.target.value)}
                  disabled={saving}
                />
              </label>
            )}

            {error && <div className="tp-field-event-error">{error}</div>}

            <div className="tp-field-event-confirm-actions">
              <button type="button" className="secondary" onClick={() => setSelected(null)} disabled={saving}>
                Geri
              </button>
              {!editingDate ? (
                <button type="button" className="secondary" onClick={() => setEditingDate(true)} disabled={saving}>
                  Tarihi değiştir
                </button>
              ) : null}
              <button type="button" className="primary" onClick={() => void save()} disabled={saving || !date || (selected.type === 'Diğer' && !otherNote.trim())}>
                {saving ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </div>
          </div>
        )}

        {!selected && error && <div className="tp-field-event-error">{error}</div>}
        <p className="tp-field-event-footnote">Kayıt yalnız sen teyit edersen İşlemler’e eklenir.</p>
      </section>
    </div>
  );
}
