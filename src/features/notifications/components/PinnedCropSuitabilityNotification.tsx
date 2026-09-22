import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Leaf,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import './PinnedCropSuitabilityNotification.css';
import { supabase } from '../../../supabaseClient';
import {
  fetchFieldCropSuitability,
  fetchFieldCropSuitabilityComparison,
  type CropSuitabilityComparisonResponse,
  type CropSuitabilityResponse,
} from '../../../services/fieldCropSuitability.service';
import {
  fetchGaezCropSuitabilityEvidence,
  type GaezSuitabilityEvidenceResponse,
} from '../../../services/gaezCropSuitabilityEvidence.service';
import {
  fetchTtsmVarietySources,
  type TtsmVarietySourceResponse,
} from '../../../services/officialAgricultureSources.service';

const NOTIFICATION_LIST_SELECTOR =
  'dialog.tp-home-quick-sheet[open][aria-label="Bildirimler"] .tp-home-quick-list';

type FieldRow = {
  id: string | number;
  name: string | null;
  crop: string | null;
};

function findNotificationList() {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(NOTIFICATION_LIST_SELECTOR);
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function scoreText(value: number | null | undefined) {
  return value == null ? '—' : String(Math.round(value));
}

function confidenceLabel(value?: string | null) {
  if (value === 'high') return 'Yüksek';
  if (value === 'medium') return 'Orta';
  if (value === 'low') return 'Düşük';
  return 'Belirsiz';
}

function shortFactorLabel(key: string, fallback: string) {
  if (key === 'temperature') return 'Sıcaklık';
  if (key === 'rainfall') return 'Yağış';
  if (key === 'soil_ph') return 'Toprak pH';
  return fallback;
}

export default function PinnedCropSuitabilityNotification() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [field, setField] = useState<FieldRow | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [suitability, setSuitability] = useState<CropSuitabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gaez, setGaez] = useState<GaezSuitabilityEvidenceResponse | null>(null);
  const [gaezLoading, setGaezLoading] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparison, setComparison] = useState<CropSuitabilityComparisonResponse | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [varietyOpen, setVarietyOpen] = useState(false);
  const [ttsm, setTtsm] = useState<TtsmVarietySourceResponse | null>(null);
  const [ttsmLoading, setTtsmLoading] = useState(false);
  const [ttsmError, setTtsmError] = useState('');

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let frame = 0;

    const scan = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = findNotificationList();
        setPortalTarget((current) => (current === next ? current : next));
      });
    };

    scan();

    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'aria-label'],
    });

    window.addEventListener('tp:notifications-updated', scan);

    return () => {
      observer.disconnect();
      window.removeEventListener('tp:notifications-updated', scan);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen]);

  const loadField = async (nextField: FieldRow) => {
    setField(nextField);
    setSuitability(null);
    setGaez(null);
    setComparison(null);
    setComparisonOpen(false);
    setComparisonError('');
    setTtsm(null);
    setVarietyOpen(false);
    setTtsmError('');
    setLoading(true);
    setError('');

    try {
      const result = await fetchFieldCropSuitability(
        nextField.id,
        nextField.crop,
      );
      setSuitability(result);

      setGaezLoading(true);
      void fetchGaezCropSuitabilityEvidence(
        nextField.id,
        result.crop?.label ?? nextField.crop,
      )
        .then(setGaez)
        .catch(() => setGaez(null))
        .finally(() => setGaezLoading(false));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Ürün uygunluğu hazırlanamadı.',
      );
    } finally {
      setLoading(false);
    }
  };

  const openModal = async () => {
    const dialog = portalTarget?.closest('dialog');
    const fieldNameHint = String(
      dialog?.querySelector('.tp-home-quick-sheet-head small')?.textContent ?? '',
    ).trim();

    if (dialog instanceof HTMLDialogElement) dialog.close();

    setModalOpen(true);
    setLoading(true);
    setError('');

    try {
      const { data, error: fieldError } = await supabase
        .from('fields')
        .select('id,name,crop');

      if (fieldError) throw fieldError;

      const list = (data ?? []) as FieldRow[];
      setFields(list);

      const hinted = list.find(
        (item) => normalize(item.name) === normalize(fieldNameHint),
      );
      const chosen = hinted ?? list[0] ?? null;

      if (!chosen) {
        throw new Error('Ürün uygunluğu için kayıtlı tarla bulunamadı.');
      }

      await loadField(chosen);
    } catch (cause) {
      setLoading(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Ürün uygunluğu hazırlanamadı.',
      );
    }
  };

  const loadComparison = async () => {
    if (!field || comparisonLoading) return;

    setComparisonOpen(true);
    if (comparison) return;

    setComparisonLoading(true);
    setComparisonError('');

    try {
      setComparison(
        await fetchFieldCropSuitabilityComparison(field.id),
      );
    } catch (cause) {
      setComparisonError(
        cause instanceof Error
          ? cause.message
          : 'Ürün karşılaştırması hazırlanamadı.',
      );
    } finally {
      setComparisonLoading(false);
    }
  };

  const loadVarieties = async () => {
    if (!field || ttsmLoading) return;

    setVarietyOpen(true);
    if (ttsm) return;

    setTtsmLoading(true);
    setTtsmError('');

    try {
      setTtsm(
        await fetchTtsmVarietySources(
          field.id,
          suitability?.crop?.label ?? field.crop,
        ),
      );
    } catch (cause) {
      setTtsmError(
        cause instanceof Error
          ? cause.message
          : 'TTSM çeşit kaynakları hazırlanamadı.',
      );
    } finally {
      setTtsmLoading(false);
    }
  };

  const screening = suitability?.screening;
  const cropLabel = suitability?.crop?.label ?? field?.crop ?? 'Ürün';
  const gaezSample = gaez?.samples?.find((item) => item.sample?.ok);
  const currentCropKey = suitability?.crop?.key ?? null;

  const fieldOptions = useMemo(
    () => fields.filter((item) => item.id != null),
    [fields],
  );

  const card = portalTarget
    ? createPortal(
        <button
          type="button"
          className="tp-pinned-crop-suitability"
          onClick={() => void openModal()}
          aria-label="Ürün uygunluğu analizini aç"
        >
          <span className="tp-pinned-crop-suitability-dot" aria-hidden="true" />
          <span className="tp-pinned-crop-suitability-icon" aria-hidden="true">
            <Leaf size={17} strokeWidth={2} />
          </span>
          <span className="tp-pinned-crop-suitability-copy">
            <span className="tp-pinned-crop-suitability-title-row">
              <strong>Ürün Uygunluğu</strong>
              <em>SABİT</em>
            </span>
            <small>Skor, karşılaştırma, kaynaklar ve çeşitler</small>
          </span>
          <ChevronRight
            className="tp-pinned-crop-suitability-chevron"
            size={17}
            aria-hidden="true"
          />
        </button>,
        portalTarget,
      )
    : null;

  const modal = modalOpen
    ? createPortal(
        <div
          className="tp-crop-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            className="tp-crop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tp-crop-modal-title"
          >
            <header className="tp-crop-modal-head">
              <div>
                <small>PUSULA ANALİZİ</small>
                <h2 id="tp-crop-modal-title">Ürün Uygunluğu</h2>
                <span>{field?.name ?? 'Seçili tarla'}</span>
              </div>

              <button
                type="button"
                className="tp-crop-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </header>

            {fieldOptions.length > 1 ? (
              <label className="tp-crop-modal-field-select">
                <span>Tarla</span>
                <select
                  value={String(field?.id ?? '')}
                  onChange={(event) => {
                    const next = fieldOptions.find(
                      (item) => String(item.id) === event.target.value,
                    );
                    if (next) void loadField(next);
                  }}
                >
                  {fieldOptions.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {item.name || 'Tarla'}{item.crop ? ` · ${item.crop}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="tp-crop-modal-scroll">
              {loading ? (
                <div className="tp-crop-modal-state">
                  <LoaderCircle className="tp-crop-spin" size={24} />
                  <span>Tarla verileri karşılaştırılıyor…</span>
                </div>
              ) : error ? (
                <div className="tp-crop-modal-error">
                  <CircleAlert size={20} />
                  <div>
                    <strong>Analiz hazırlanamadı</strong>
                    <span>{error}</span>
                  </div>
                  {field ? (
                    <button type="button" onClick={() => void loadField(field)}>
                      <RefreshCw size={15} /> Yenile
                    </button>
                  ) : null}
                </div>
              ) : suitability?.status === 'unsupported_crop' ? (
                <div className="tp-crop-modal-unsupported">
                  <strong>{field?.crop || 'Bu ürün'} için kaynaklı paket henüz yok.</strong>
                  <span>Desteklenen ürünlerle aynı tarla verisini karşılaştırabilirsin.</span>
                  <button type="button" onClick={() => void loadComparison()}>
                    Başka ürünle karşılaştır
                  </button>
                </div>
              ) : (
                <>
                  <div className="tp-crop-modal-summary">
                    <div className="tp-crop-modal-score">
                      <strong>{scoreText(screening?.score)}</strong>
                      <span>/100</span>
                    </div>
                    <div className="tp-crop-modal-summary-copy">
                      <small>{cropLabel}</small>
                      <strong>{screening?.label ?? 'Veri hazırlanıyor'}</strong>
                      <span>
                        {screening?.limitingFactor
                          ? `Sınırlayıcı: ${screening.limitingFactor.label}`
                          : 'Sınırlayıcı faktör belirlenmedi'}
                      </span>
                    </div>
                    <div className="tp-crop-modal-confidence">
                      <span>Güven</span>
                      <strong>{confidenceLabel(screening?.confidence)}</strong>
                    </div>
                  </div>

                  <div className="tp-crop-modal-factors">
                    {(screening?.factors ?? []).map((factor) => (
                      <article key={factor.key}>
                        <span>{shortFactorLabel(factor.key, factor.label)}</span>
                        <strong>{scoreText(factor.score)}<small>/100</small></strong>
                        <div><i style={{ width: `${Math.max(0, Math.min(100, Number(factor.score ?? 0)))}%` }} /></div>
                        <small>
                          {factor.value == null ? 'Veri yok' : `${factor.value} ${factor.unit}`}
                        </small>
                      </article>
                    ))}
                  </div>

                  <div className="tp-crop-modal-evidence">
                    <div className="tp-crop-modal-evidence-head">
                      <ShieldCheck size={17} />
                      <strong>Kaynaklar / Neden?</strong>
                    </div>
                    <div className="tp-crop-modal-chips">
                      <span>FAO ECOCROP</span>
                      <span>NASA POWER</span>
                      <span>SoilGrids</span>
                      <span>{gaezLoading ? 'GAEZ kontrol ediliyor' : 'FAO GAEZ · bağımsız kanıt'}</span>
                    </div>
                    {gaezSample?.interpretation?.derived_class ? (
                      <p>
                        GAEZ çapraz kontrolü: <strong>{gaezSample.interpretation.derived_class.label}</strong>.
                        Bu sonuç ana skora katılmıyor.
                      </p>
                    ) : null}
                  </div>

                  <div className="tp-crop-modal-actions">
                    <button type="button" onClick={() => void loadComparison()}>
                      Başka ürünle karşılaştır
                      <ChevronDown size={15} className={comparisonOpen ? 'is-open' : ''} />
                    </button>
                    <button type="button" onClick={() => void loadVarieties()}>
                      Çeşitleri incele
                      <ChevronDown size={15} className={varietyOpen ? 'is-open' : ''} />
                    </button>
                  </div>
                </>
              )}

              {comparisonOpen ? (
                <section className="tp-crop-modal-section">
                  <div className="tp-crop-modal-section-head">
                    <div>
                      <small>AYNI TARLA · AYNI VERİ</small>
                      <strong>Ürün karşılaştırması</strong>
                    </div>
                    <button type="button" onClick={() => setComparisonOpen(false)}>Kapat</button>
                  </div>

                  {comparisonLoading ? (
                    <div className="tp-crop-modal-inline-loading">
                      <LoaderCircle className="tp-crop-spin" size={18} />
                      Ürünler karşılaştırılıyor…
                    </div>
                  ) : comparisonError ? (
                    <p className="tp-crop-modal-inline-error">{comparisonError}</p>
                  ) : (
                    <div className="tp-crop-modal-comparison-list">
                      {(comparison?.comparisons ?? []).map((item, index) => (
                        <article
                          key={item.crop.key}
                          className={item.crop.key === currentCropKey ? 'is-current' : ''}
                        >
                          <span>{index + 1}</span>
                          <div>
                            <strong>{item.crop.label}</strong>
                            <small>
                              {item.crop.key === currentCropKey
                                ? 'Mevcut ürün'
                                : item.screening.limitingFactor?.label ?? item.screening.label}
                            </small>
                          </div>
                          <b>{scoreText(item.screening.score)}</b>
                        </article>
                      ))}
                    </div>
                  )}
                  <p className="tp-crop-modal-note">
                    Bu sıralama ön-eleme karşılaştırmasıdır; ekim tavsiyesi değildir.
                  </p>
                </section>
              ) : null}

              {varietyOpen ? (
                <section className="tp-crop-modal-section">
                  <div className="tp-crop-modal-section-head">
                    <div>
                      <small>TTSM · RESMÎ KAYNAKLAR</small>
                      <strong>Çeşit belgeleri</strong>
                    </div>
                    <button type="button" onClick={() => setVarietyOpen(false)}>Kapat</button>
                  </div>

                  {ttsmLoading ? (
                    <div className="tp-crop-modal-inline-loading">
                      <LoaderCircle className="tp-crop-spin" size={18} />
                      Resmî belgeler aranıyor…
                    </div>
                  ) : ttsmError ? (
                    <p className="tp-crop-modal-inline-error">{ttsmError}</p>
                  ) : ttsm?.relevant_documents?.length ? (
                    <div className="tp-crop-modal-docs">
                      {ttsm.relevant_documents.map((document, index) => (
                        <a
                          key={`${document.url}-${index}`}
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{document.kind === 'catalog' ? 'Katalog' : 'Tescil raporu'}</span>
                          <strong>{document.title}</strong>
                          <ChevronRight size={15} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="tp-crop-modal-note">
                      Bu ürün için eşleşen TTSM belgesi bulunamadı; veri uydurulmadı.
                    </p>
                  )}
                </section>
              ) : null}

              <p className="tp-crop-modal-disclaimer">
                Bu çıktı ürün için ön uygunluk taramasıdır; verim tahmini veya ekim tavsiyesi değildir.
              </p>
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {card}
      {modal}
    </>
  );
}
