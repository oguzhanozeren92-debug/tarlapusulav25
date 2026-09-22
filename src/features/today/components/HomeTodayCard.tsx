import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';
import { buildRainfedTodaySummary } from '../../irrigation/services/rainfedTodaySummary';
import type { IrrigationDecisionResult } from '../../irrigation/types/irrigationDecision';
import './HomeTodayCard.css';

export type HomeTodayDecision = {
  id: string;
  visual: string;
  tone: string;
  target: any;
  iconClass: string;
  iconSrc: string;
  label: string;
  title: string;
  detail: string;
};

type Props = {
  decisions: HomeTodayDecision[];
  fieldName?: string;
  irrigationDecision?: IrrigationDecisionResult | null;
  onOpenDecision: (target: any) => void;
};

export default function HomeTodayCard({ decisions, fieldName, irrigationDecision, onOpenDecision }: Props) {
  const [selectedDecision, setSelectedDecision] = useState<HomeTodayDecision | null>(null);
  const rainfedSummary = selectedDecision?.id.startsWith('irrigation:') && irrigationDecision
    ? buildRainfedTodaySummary(irrigationDecision)
    : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedDecision && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [selectedDecision]);

  return (
    <>
    <article className="tp-home-today-reference">
      <div
        className="tp-home-today-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${HOME_REFERENCE_ASSETS.todayBg})` }}
      />
      <div className="tp-home-today-shade" aria-hidden="true" />

      <div className="tp-home-today-content">
        <div className="tp-home-today-title">
          <img
            className="tp-home-today-title-icon"
            src={HOME_REFERENCE_ASSETS.iconPusulaSprout}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div>
            <small>BUGÜN</small>
            <h2>Ne Yapmalısın?</h2>
          </div>
        </div>

        <p className="tp-home-today-subtitle">
          Tarlan için en doğru zamanı birlikte seçelim.
        </p>

        <div className="tp-home-today-actions">
          {decisions.map((decision) => (
            <button
              type="button"
              key={decision.id}
              className={`tp-home-today-action ${decision.visual} ${decision.tone}`}
              aria-haspopup="dialog"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSelectedDecision(decision);
              }}
            >
              <img
                className={`tp-home-today-action-icon ${decision.iconClass}`}
                src={decision.iconSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="tp-home-today-action-copy">
                <small>{decision.label}</small>
                <strong>{decision.title}</strong>
                <em>{decision.detail}</em>
              </span>
              <span className="tp-home-today-action-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
    {createPortal(
      <dialog
        ref={dialogRef}
        className={`tp-home-today-dialog ${selectedDecision?.visual ?? ''}`}
        aria-labelledby="tp-home-today-dialog-title"
        aria-describedby="tp-home-today-dialog-detail"
        onClose={() => {
          setSelectedDecision(null);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        {selectedDecision && (
          <div className="tp-home-today-dialog-content">
            <div className="tp-home-today-dialog-head">
              <img src={selectedDecision.iconSrc} alt="" aria-hidden="true" />
              <span>{selectedDecision.label}</span>
              <button type="button" aria-label="Pencereyi kapat" onClick={() => dialogRef.current?.close()}>×</button>
            </div>
            {fieldName && <p className="tp-home-today-dialog-field">Tarla: <strong>{fieldName}</strong></p>}
            <h2 id="tp-home-today-dialog-title">{selectedDecision.title}</h2>
            {rainfedSummary ? (
              <div id="tp-home-today-dialog-detail" className="tp-home-today-water-summary">
                <p><strong>Genel durum:</strong> {rainfedSummary.generalStatus}</p>
                <dl>
                  {rainfedSummary.rows.map(({ label, text }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
                <p><strong>Özet:</strong> {rainfedSummary.conclusion}</p>
                <small>Bu yağış ve tahmini su ihtiyacı farkıdır; ölçülmüş toprak nemi ya da sulama miktarı değildir.</small>
              </div>
            ) : <p id="tp-home-today-dialog-detail">{selectedDecision.detail}</p>}
            <button
              type="button"
              className="tp-home-today-dialog-link"
              onClick={() => {
                dialogRef.current?.close();
                onOpenDecision(selectedDecision.target);
              }}
            >
              Detayına git <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </dialog>,
      document.body,
    )}
    </>
  );
}
