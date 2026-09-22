import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './HomeFieldDataStatus.css';

type DataStatus = 'ready' | 'loading' | 'missing' | 'error';
export type FieldDataTarget = 'weather' | 'calendar' | 'map_vegetation' | 'soil' | 'irrigation_detail';

export type HomeFieldDataStatusItem = {
  label: string;
  status: DataStatus;
  detail: string;
  target: FieldDataTarget;
  actionLabel: string;
};

export default function HomeFieldDataStatus({
  fieldName,
  items,
  onOpen,
  onReveal,
  mapCorner = false,
}: {
  fieldName?: string | null;
  items: HomeFieldDataStatusItem[];
  onOpen: (target: FieldDataTarget) => void;
  onReveal?: () => void;
  mapCorner?: boolean;
}) {
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mapStage, setMapStage] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!mapCorner) return;
    const syncStage = () => setMapStage(document.querySelector<HTMLElement>('.tp-map-first-shell .tp-map-control-rail'));
    syncStage();
    const observer = new MutationObserver(syncStage);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mapCorner]);

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={mapCorner ? 'tp-map-control-btn tp-home-map-info' : 'tp-home-data-status'}
      aria-label={fieldName ? `${fieldName} tarla verileri` : 'Tarla verileri'}
      title="Tarla verileri"
      aria-haspopup="dialog"
      onClick={() => {
        dialogRef.current?.showModal();
        onReveal?.();
      }}
    >
      {mapCorner ? <span aria-hidden="true">i</span> : <>
        <span className="tp-home-data-status-heading">
          <small>Tarla verileri</small>
          <strong>{fieldName ? `${readyCount}/${items.length} kaynak hazır` : 'Tarla ekle'}</strong>
          <small>{fieldName ? `${fieldName} · Ayrıntıları gör` : 'Veri durumunu görmek için'}</small>
        </span>
        <span className="tp-home-data-status-chevron" aria-hidden="true">↗</span>
      </>}
    </button>
  );

  return (
    <>
      {mapCorner ? (mapStage ? createPortal(trigger, mapStage) : null) : trigger}
      <dialog
        ref={dialogRef}
        className="tp-home-data-dialog"
        aria-labelledby="tp-home-data-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="tp-home-data-dialog-head">
          <div>
            <small>SEÇİLİ TARLA</small>
            <h2 id="tp-home-data-dialog-title">Tarla verileri</h2>
            <p>{fieldName ? `${fieldName} · ${readyCount}/${items.length} kaynak hazır` : 'Önce bir tarla ekle'}</p>
          </div>
          <button type="button" aria-label="Tarla verilerini kapat" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <div className="tp-home-data-status-list">
          {fieldName ? items.map((item) => (
            <button
              type="button"
              className="tp-home-data-status-row"
              key={item.label}
              onClick={() => {
                dialogRef.current?.close();
                onOpen(item.target);
              }}
            >
              <span className={`tp-home-data-status-dot is-${item.status}`} aria-hidden="true" />
              <strong>{item.label}</strong>
              <span className="tp-home-data-status-detail">{item.detail}</span>
              <span className="tp-home-data-status-action">{item.actionLabel} →</span>
            </button>
          )) : <p>Bu tarla için veri durumu, tarla eklendikten sonra gösterilir.</p>}
        </div>
      </dialog>
    </>
  );
}
