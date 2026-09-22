import { useEffect, useState } from 'react';
import {
  loadFieldIrrigationMethod,
  saveFieldIrrigationMethod,
  type FieldIrrigationMethod,
} from '../../fields/services/irrigationMethod.service';

const OPTIONS: Array<{ value: FieldIrrigationMethod; label: string }> = [
  { value: 'trickle', label: 'Damlama' },
  { value: 'sprinkler', label: 'Yağmurlama' },
  { value: 'basin', label: 'Tava / göllendirme' },
  { value: 'border', label: 'Şerit / salma' },
  { value: 'furrow_every_narrow', label: 'Karık · her karık, dar yatak' },
  { value: 'furrow_every_wide', label: 'Karık · her karık, geniş yatak' },
  { value: 'furrow_alternating', label: 'Karık · dönüşümlü' },
  { value: 'unknown', label: 'Bilmiyorum / henüz seçmedim' },
];

export default function FieldIrrigationMethod({ fieldId }: { fieldId: string }) {
  const [method, setMethod] = useState<FieldIrrigationMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    void loadFieldIrrigationMethod(fieldId)
      .then((value) => { if (!cancelled) setMethod(value); })
      .catch(() => { if (!cancelled) setMessage('Sulama yöntemi okunamadı.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fieldId]);

  const save = async (value: FieldIrrigationMethod) => {
    setMethod(value);
    setSaving(true);
    setMessage('');
    try {
      await saveFieldIrrigationMethod({ fieldId, irrigationMethod: value });
      setMessage(value === 'unknown' ? 'Sulama yöntemi bilinmiyor olarak kaydedildi.' : 'Sulama yöntemi kaydedildi.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sulama yöntemi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="tp-irrigation-method-card">
      <div>
        <small>SULAMA YÖNTEMİ</small>
        <strong>Tarla nasıl sulanıyor?</strong>
        <p>Seçim pyfao56 Dual-Kc ıslanan yüzey hesabını besler. Sulama randımanı değildir ve NET su önerisini brüt suya çevirmek için kullanılmaz.</p>
      </div>
      <select
        value={method ?? ''}
        disabled={loading || saving}
        onChange={(event) => void save(event.target.value as FieldIrrigationMethod)}
        aria-label="Sulama yöntemi"
      >
        <option value="" disabled>{loading ? 'Yükleniyor…' : 'Yöntem seç'}</option>
        {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {message ? <em>{message}</em> : null}
    </section>
  );
}
