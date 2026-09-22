import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { loadObservationTimeline } from '../services/fieldObservation.service';

import type {
  FieldObservationComparison,
  FieldObservationPhoto,
  NdviObservationTarget,
} from '../types/fieldObservation';

type Props = {
  open: boolean;
  target: NdviObservationTarget | null;
  onClose: () => void;
  onAddPhoto?: () => void;
};

type TimelineState = {
  photos: FieldObservationPhoto[];
  comparisons: FieldObservationComparison[];
};

const CSS = String.raw`
.tp-observation-history-portal{
  position:fixed!important;
  inset:0!important;
  z-index:2147483635!important;
  width:100vw!important;
  height:100dvh!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom))!important;
  box-sizing:border-box!important;
  isolation:isolate!important;
}

.tp-observation-history-backdrop{
  position:absolute!important;
  inset:0!important;
  z-index:0!important;
  width:100%!important;
  height:100%!important;
  border:0!important;
  background:rgba(0,0,0,.64)!important;
  backdrop-filter:blur(5px)!important;
  -webkit-backdrop-filter:blur(5px)!important;
}

.tp-observation-history-sheet{
  position:relative!important;
  z-index:1!important;
  width:min(94vw,560px)!important;
  max-height:min(88dvh,760px)!important;
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
  border:1px solid rgba(34,197,94,.16)!important;
  border-radius:22px!important;
  background:
    radial-gradient(circle at 10% 0%,rgba(34,197,94,.075),transparent 30%),
    rgba(3,12,7,.99)!important;
  box-shadow:0 30px 90px rgba(0,0,0,.68)!important;
}

.tp-observation-history-head{
  flex:0 0 auto;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:14px;
  border-bottom:1px solid rgba(255,255,255,.055);
}

.tp-observation-history-kicker{
  color:#86efac;
  font-size:7px;
  font-weight:900;
  letter-spacing:.09em;
  text-transform:uppercase;
}

.tp-observation-history-head h3{
  margin:4px 0 0;
  color:#f0f7f2;
  font-size:14px;
  line-height:1.15;
}

.tp-observation-history-head p{
  margin:5px 0 0;
  color:rgba(211,225,214,.58);
  font-size:8.5px;
  line-height:1.4;
}

.tp-observation-history-close{
  width:32px;
  height:32px;
  flex:0 0 32px;
  border:1px solid rgba(255,255,255,.06);
  border-radius:10px;
  background:rgba(255,255,255,.02);
  color:#dce8de;
  font-size:19px;
  cursor:pointer;
}

.tp-observation-history-body{
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  padding:12px 14px 14px;
}

.tp-observation-history-summary{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:6px;
  margin-bottom:11px;
}

.tp-observation-history-stat{
  min-width:0;
  padding:8px 9px;
  border:1px solid rgba(105,139,114,.10);
  border-radius:11px;
  background:rgba(255,255,255,.014);
}

.tp-observation-history-stat small{
  display:block;
  color:rgba(159,178,164,.48);
  font-size:6.5px;
  font-weight:800;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.tp-observation-history-stat strong{
  display:block;
  margin-top:4px;
  overflow:hidden;
  color:rgba(232,240,234,.90);
  font-size:9px;
  font-weight:850;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.tp-observation-history-latest{
  margin:0 0 11px;
  padding:9px 10px;
  border:1px solid rgba(105,139,114,.10);
  border-radius:12px;
  background:rgba(105,139,114,.035);
}

.tp-observation-history-latest.improving{
  border-color:rgba(34,197,94,.18);
  background:rgba(34,197,94,.045);
}

.tp-observation-history-latest.worsening{
  border-color:rgba(239,68,68,.18);
  background:rgba(239,68,68,.045);
}

.tp-observation-history-latest.stable{
  border-color:rgba(6,182,212,.16);
  background:rgba(6,182,212,.035);
}

.tp-observation-history-latest small{
  display:block;
  color:rgba(158,178,163,.54);
  font-size:6.5px;
  font-weight:850;
  letter-spacing:.05em;
  text-transform:uppercase;
}

.tp-observation-history-latest strong{
  display:block;
  margin-top:3px;
  color:#e9f3eb;
  font-size:9.5px;
}

.tp-observation-history-latest p{
  margin:4px 0 0;
  color:rgba(207,220,210,.62);
  font-size:8px;
  line-height:1.4;
}


.tp-observation-history-ai{
  margin-top:8px;
  padding-top:8px;
  border-top:1px solid rgba(255,255,255,.055);
}

.tp-observation-history-ai-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}

.tp-observation-history-ai-head strong{
  color:rgba(235,242,237,.90);
  font-size:7.5px;
  font-weight:900;
}

.tp-observation-history-ai-head span{
  min-height:17px;
  display:inline-flex;
  align-items:center;
  padding:0 6px;
  border:1px solid rgba(105,139,114,.11);
  border-radius:999px;
  color:rgba(189,205,193,.62);
  font-size:6px;
  font-weight:850;
}

.tp-observation-history-ai-change{
  margin:6px 0 0!important;
  color:rgba(221,232,223,.73)!important;
  font-size:8px!important;
  line-height:1.42!important;
}

.tp-observation-history-ai-evidence{
  display:grid;
  gap:4px;
  margin:7px 0 0;
  padding:0;
  list-style:none;
}

.tp-observation-history-ai-evidence li{
  position:relative;
  padding-left:10px;
  color:rgba(194,209,197,.58);
  font-size:7px;
  line-height:1.38;
}

.tp-observation-history-ai-evidence li::before{
  content:'•';
  position:absolute;
  left:0;
  color:#86efac;
}

.tp-observation-history-ai-recommendation{
  margin:7px 0 0!important;
  padding:6px 7px;
  border-radius:9px;
  background:rgba(105,139,114,.03);
  color:rgba(209,223,212,.64)!important;
  font-size:7.2px!important;
  line-height:1.4!important;
}

.tp-observation-history-title{
  margin:12px 0 7px;
  color:rgba(231,239,233,.88);
  font-size:9px;
  font-weight:900;
}

.tp-observation-history-list{
  display:grid;
  gap:8px;
}

.tp-observation-history-item{
  display:grid;
  grid-template-columns:92px minmax(0,1fr);
  gap:9px;
  padding:8px;
  border:1px solid rgba(105,139,114,.10);
  border-radius:13px;
  background:rgba(255,255,255,.012);
}

.tp-observation-history-photo{
  width:92px;
  height:78px;
  overflow:hidden;
  border-radius:9px;
  border:1px solid rgba(255,255,255,.055);
  background:rgba(255,255,255,.018);
}

.tp-observation-history-photo img{
  width:100%;
  height:100%;
  display:block;
  object-fit:cover;
}

.tp-observation-history-photo-empty{
  width:100%;
  height:100%;
  display:grid;
  place-items:center;
  color:rgba(182,198,186,.40);
  font-size:7px;
  text-align:center;
}

.tp-observation-history-copy{
  min-width:0;
}

.tp-observation-history-date{
  color:#eef5ef;
  font-size:9px;
  font-weight:850;
}

.tp-observation-history-meta{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
  margin-top:5px;
}

.tp-observation-history-chip{
  min-height:18px;
  display:inline-flex;
  align-items:center;
  padding:0 6px;
  border:1px solid rgba(105,139,114,.10);
  border-radius:999px;
  background:rgba(105,139,114,.025);
  color:rgba(196,211,199,.62);
  font-size:6.5px;
  font-weight:800;
}

.tp-observation-history-note{
  margin:6px 0 0;
  color:rgba(193,207,196,.54);
  font-size:7.5px;
  line-height:1.38;
}

.tp-observation-history-comparison{
  margin-top:6px;
  padding:6px 7px;
  border-radius:9px;
  border:1px solid rgba(105,139,114,.09);
  background:rgba(105,139,114,.025);
}

.tp-observation-history-comparison strong{
  display:block;
  font-size:7.5px;
}

.tp-observation-history-comparison.improving strong{
  color:#86efac;
}

.tp-observation-history-comparison.worsening strong{
  color:#fca5a5;
}

.tp-observation-history-comparison.stable strong{
  color:#67e8f9;
}

.tp-observation-history-comparison.unknown strong{
  color:rgba(203,216,206,.60);
}

.tp-observation-history-comparison span{
  display:block;
  margin-top:3px;
  color:rgba(190,205,194,.52);
  font-size:6.7px;
  line-height:1.35;
}

.tp-observation-history-loading,
.tp-observation-history-empty,
.tp-observation-history-error{
  min-height:120px;
  display:grid;
  place-items:center;
  padding:20px;
  border:1px dashed rgba(105,139,114,.11);
  border-radius:12px;
  color:rgba(198,212,201,.58);
  font-size:8.5px;
  text-align:center;
}

.tp-observation-history-error{
  color:#fca5a5;
}

.tp-observation-history-actions{
  display:flex;
  justify-content:flex-end;
  gap:7px;
  margin-top:12px;
}

.tp-observation-history-actions button{
  min-height:34px;
  padding:0 11px;
  border-radius:10px;
  font-size:8px;
  font-weight:850;
  cursor:pointer;
}

.tp-observation-history-close-action{
  border:1px solid rgba(255,255,255,.06);
  background:transparent;
  color:rgba(211,225,214,.66);
}

.tp-observation-history-add{
  border:1px solid rgba(239,68,68,.18);
  background:rgba(239,68,68,.065);
  color:#fecaca;
}

@media(max-width:460px){
  .tp-observation-history-summary{
    grid-template-columns:1fr 1fr;
  }

  .tp-observation-history-item{
    grid-template-columns:78px minmax(0,1fr);
  }

  .tp-observation-history-photo{
    width:78px;
    height:72px;
  }
}
`;

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatHealth(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '—';
  }

  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNdvi(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }

  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusTitle(status: FieldObservationComparison['status']) {
  if (status === 'improving') return 'Toparlanıyor';
  if (status === 'worsening') return 'Zayıflıyor';
  if (status === 'stable') return 'Belirgin değişim yok';
  return 'Karşılaştırma sınırlı';
}

function directionLabel(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  if (!text) return 'Takip noktası';

  return (
    text.charAt(0).toLocaleUpperCase('tr-TR') +
    text.slice(1)
  );
}


type VisualAiComparison = {
  status?: string;
  comparability?: 'high' | 'medium' | 'low';
  confidence?: number;
  headline?: string;
  summary?: string;
  visualChange?: string;
  evidence?: string[];
  recommendation?: string;
  caveat?: string;
};

function visualAiComparison(
  comparison: FieldObservationComparison | null | undefined,
): VisualAiComparison | null {
  const value = comparison?.details?.aiComparison;
  return value && typeof value === 'object' ? value : null;
}

function comparabilityLabel(value: VisualAiComparison['comparability']) {
  if (value === 'high') return 'Görseller uyumlu';
  if (value === 'medium') return 'Orta uyum';
  if (value === 'low') return 'Düşük uyum';
  return 'Görsel karşılaştırma';
}

export default function NdviObservationTimelineModal({
  open,
  target,
  onClose,
  onAddPhoto,
}: Props) {
  const [state, setState] = useState<TimelineState>({
    photos: [],
    comparisons: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !target?.point.id) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    void loadObservationTimeline(target.point.id)
      .then((result) => {
        if (cancelled) return;
        setState(result);
      })
      .catch((value) => {
        if (cancelled) return;
        setError(
          value instanceof Error
            ? value.message
            : 'Takip geçmişi yüklenemedi.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target?.point.id]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const latestComparison = state.comparisons[0] ?? null;
  const latestVisualAi = visualAiComparison(latestComparison);

  const comparisonByCurrentPhotoId = useMemo(() => {
    const map = new Map<string, FieldObservationComparison>();

    for (const comparison of state.comparisons) {
      if (comparison.currentPhotoId) {
        map.set(comparison.currentPhotoId, comparison);
      }
    }

    return map;
  }, [state.comparisons]);

  const firstPhoto =
    state.photos.length > 0
      ? state.photos[state.photos.length - 1]
      : null;

  const latestPhoto =
    state.photos.length > 0
      ? state.photos[0]
      : null;

  if (!open || !target || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <style>{CSS}</style>

      <div className="tp-observation-history-portal">
        <button
          type="button"
          className="tp-observation-history-backdrop"
          aria-label="Takip geçmişini kapat"
          onClick={onClose}
        />

        <section
          className="tp-observation-history-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="NDVI takip geçmişi"
        >
          <header className="tp-observation-history-head">
            <div>
              <div className="tp-observation-history-kicker">
                🧭 PUSULA TAKİP GEÇMİŞİ · {directionLabel(target.direction)}
              </div>
              <h3>{target.fieldName} · Gelişim karşılaştırması</h3>
              <p>
                Aynı takip noktasından eklenen fotoğraflar ve o tarihlerdeki
                uydu sağlık sinyalleri birlikte tutulur.
              </p>
            </div>

            <button
              type="button"
              className="tp-observation-history-close"
              onClick={onClose}
              aria-label="Takip geçmişini kapat"
            >
              ×
            </button>
          </header>

          <div className="tp-observation-history-body">
            {loading ? (
              <div className="tp-observation-history-loading">
                Takip geçmişi hazırlanıyor…
              </div>
            ) : error ? (
              <div className="tp-observation-history-error">{error}</div>
            ) : state.photos.length === 0 ? (
              <div className="tp-observation-history-empty">
                Bu takip noktasında henüz tarihli fotoğraf kaydı yok.
              </div>
            ) : (
              <>
                <div className="tp-observation-history-summary">
                  <div className="tp-observation-history-stat">
                    <small>İlk kayıt</small>
                    <strong>{formatDate(firstPhoto?.capturedAt)}</strong>
                  </div>

                  <div className="tp-observation-history-stat">
                    <small>Son kayıt</small>
                    <strong>{formatDate(latestPhoto?.capturedAt)}</strong>
                  </div>

                  <div className="tp-observation-history-stat">
                    <small>Fotoğraf</small>
                    <strong>{state.photos.length} kayıt</strong>
                  </div>
                </div>

                {latestComparison ? (
                  <div
                    className={`tp-observation-history-latest ${latestComparison.status}`}
                  >
                    <small>Son karşılaştırma</small>
                    <strong>{statusTitle(latestComparison.status)}</strong>
                    <p>
                      {latestComparison.summary ??
                        'İki kayıt arasındaki gelişim karşılaştırıldı.'}
                    </p>

                    {latestVisualAi ? (
                      <div className="tp-observation-history-ai">
                        <div className="tp-observation-history-ai-head">
                          <strong>AI GÖRSEL KARŞILAŞTIRMA</strong>
                          <span>
                            {comparabilityLabel(latestVisualAi.comparability)}
                            {Number.isFinite(Number(latestVisualAi.confidence))
                              ? ` · %${Math.round(Number(latestVisualAi.confidence))}`
                              : ''}
                          </span>
                        </div>

                        {latestVisualAi.visualChange ? (
                          <p className="tp-observation-history-ai-change">
                            {latestVisualAi.visualChange}
                          </p>
                        ) : null}

                        {Array.isArray(latestVisualAi.evidence) &&
                        latestVisualAi.evidence.length > 0 ? (
                          <ul className="tp-observation-history-ai-evidence">
                            {latestVisualAi.evidence.slice(0, 3).map((item, index) => (
                              <li key={`${index}:${item}`}>{item}</li>
                            ))}
                          </ul>
                        ) : null}

                        {latestVisualAi.recommendation ? (
                          <p className="tp-observation-history-ai-recommendation">
                            {latestVisualAi.recommendation}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="tp-observation-history-title">
                  Fotoğraf geçmişi
                </div>

                <div className="tp-observation-history-list">
                  {state.photos.map((photo) => {
                    const comparison =
                      comparisonByCurrentPhotoId.get(photo.id) ?? null;
                    const visualAi = visualAiComparison(comparison);
                    const ndvi = formatNdvi(photo.ndviValue);

                    return (
                      <article
                        key={photo.id}
                        className="tp-observation-history-item"
                      >
                        <div className="tp-observation-history-photo">
                          {photo.signedUrl ? (
                            <img
                              src={photo.signedUrl}
                              alt={`${formatDate(photo.capturedAt)} takip fotoğrafı`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="tp-observation-history-photo-empty">
                              Fotoğraf önizlemesi yok
                            </div>
                          )}
                        </div>

                        <div className="tp-observation-history-copy">
                          <div className="tp-observation-history-date">
                            {formatDate(photo.capturedAt)}
                          </div>

                          <div className="tp-observation-history-meta">
                            {photo.satelliteDate ? (
                              <span className="tp-observation-history-chip">
                                Uydu {formatDate(photo.satelliteDate)}
                              </span>
                            ) : null}

                            {photo.relativeHealth != null ? (
                              <span className="tp-observation-history-chip">
                                Göreli sağlık {formatHealth(photo.relativeHealth)}
                              </span>
                            ) : null}

                            {ndvi ? (
                              <span className="tp-observation-history-chip">
                                NDVI {ndvi}
                              </span>
                            ) : null}

                            {photo.distanceToPointM != null ? (
                              <span className="tp-observation-history-chip">
                                ⌖ Referansa {Math.round(photo.distanceToPointM)} m
                              </span>
                            ) : null}
                          </div>

                          {photo.notes ? (
                            <p className="tp-observation-history-note">
                              {photo.notes}
                            </p>
                          ) : null}

                          {comparison ? (
                            <div
                              className={`tp-observation-history-comparison ${comparison.status}`}
                            >
                              <strong>
                                {statusTitle(comparison.status)}
                              </strong>
                              <span>
                                {comparison.summary ??
                                  'Önceki kayıtla karşılaştırıldı.'}
                                {comparison.relativeHealthDelta != null
                                  ? ` · Değişim ${
                                      comparison.relativeHealthDelta > 0 ? '+' : ''
                                    }${comparison.relativeHealthDelta.toLocaleString(
                                      'tr-TR',
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}`
                                  : ''}
                                {visualAi ? ' · AI görsel kontrolü' : ''}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            <div className="tp-observation-history-actions">
              <button
                type="button"
                className="tp-observation-history-close-action"
                onClick={onClose}
              >
                Kapat
              </button>

              {onAddPhoto ? (
                <button
                  type="button"
                  className="tp-observation-history-add"
                  onClick={() => {
                    onClose();
                    onAddPhoto();
                  }}
                >
                  📷 Yeni fotoğraf ekle
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>,
    document.body,
  );
}
