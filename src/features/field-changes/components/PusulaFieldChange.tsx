import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, X } from 'lucide-react';
import type { HomeDecisionEvent } from '../../decision/types/homeDecision';
import { buildFieldChangePresentation } from '../services/fieldChangePresentation';
import { buildOperationSatelliteFollowUp } from '../services/operationSatelliteFollowUp';
import type { FieldOperation } from '../../field-operations/types/fieldOperation';
import type { NdviTimeSeriesPoint } from '../../satellite/types/ndviTimeSeries';
import './PusulaFieldChange.css';

const STORAGE_KEY = 'tp_pusula_dismissed_changes_v1';

export default function PusulaFieldChange({ events, fieldId, fieldName, latestDate, paused, onMap, operations, points, quality, phenology }: {
  events: HomeDecisionEvent[]; fieldId: string; fieldName: string;
  latestDate: string | null; paused: boolean; onMap: () => void;
  operations: FieldOperation[]; points: NdviTimeSeriesPoint[]; quality: string | undefined;
  phenology: { stage: string; dataStatus: string } | null | undefined;
}) {
  const satelliteChange = buildFieldChangePresentation(events, fieldId, latestDate);
  const operationChange = buildOperationSatelliteFollowUp({ fieldId, operations, points, quality, phenology });
  const change = satelliteChange ?? operationChange;
  const key = change?.key ?? '';
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : [];
    } catch { return []; }
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = Boolean(change && !paused && !dismissed.includes(key));

  useEffect(() => { setDetailOpen(false); }, [key, paused]);
  useEffect(() => {
    if (detailOpen && visible) dialog.current?.showModal();
    else dialog.current?.close();
  }, [detailOpen, visible]);

  const dismiss = () => {
    const next = [...dismissed.filter((item) => item !== key), key].slice(-100);
    setDismissed(next);
    setDetailOpen(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Oturum içinde hatırlanır. */ }
  };

  if (!visible || !change) return null;
  return (
    <section className="tp-field-change" aria-label="Pusuladan tarla değişikliği">
      <span className="tp-field-change-connector" aria-hidden="true"><ArrowDown size={18} /></span>
      <button className="tp-field-change-message" type="button" onClick={() => setDetailOpen(true)}>
        <span role="status"><small>PUSULA · TARLANDA NE DEĞİŞTİ?</small><strong>{fieldName}</strong><span>{change.summary}</span></span>
        <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button className="tp-field-change-later" type="button" onClick={dismiss}>Şimdi değil</button>
      <dialog ref={dialog} className="tp-field-change-dialog" aria-labelledby="tp-field-change-title" onCancel={() => setDetailOpen(false)} onClose={() => setDetailOpen(false)}>
        <div className="tp-field-change-dialog-head"><div><small>PUSULA · UYDU TAKİBİ</small><h2 id="tp-field-change-title">{fieldName}: ne değişti?</h2></div><button type="button" aria-label="Pencereyi kapat" onClick={() => setDetailOpen(false)}><X /></button></div>
        <p>{change.summary.replace(' Birlikte bakalım mı?', '')}</p>
        <h3>Neden söylüyorum?</h3>
        <ul>{change.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
        <p>{change.detail}</p>
        {satelliteChange && operationChange && <section aria-label="Son işlem sonrası takip"><h3>Son işlemden sonra</h3><ul>{operationChange.evidence.map((item) => <li key={item}>{item}</li>)}</ul><p>{operationChange.detail}</p></section>}
        <button className="tp-field-change-map" type="button" onClick={() => { setDetailOpen(false); onMap(); }}>Haritada göster <ArrowRight size={18} /></button>
        <button className="tp-field-change-later" type="button" onClick={dismiss}>Şimdi değil</button>
      </dialog>
    </section>
  );
}
