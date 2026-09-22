import { useEffect, useMemo, useRef, useState } from 'react';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  GitCompareArrows,
  Image as ImageIcon,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { getSatelliteHistoryPreview } from '../services/satelliteHistory';
import { useEntitlementStore } from '../../../entitlements/useEntitlementStore';
import './SatelliteHistorySheet.css';

type Props = {
  open: boolean;
  dates: string[];
  loading: boolean;
  error: string | null;
  fieldName: string;
  selectedDate?: string | null;
  currentData?: SatelliteHealthResult | null;
  getHistoryData?: (date: string) => Promise<SatelliteHealthResult | null>;
  onSelect: (date: string | null) => void;
  onClose: () => void;
};

type CompareTrend = {
  label: string;
  tone: 'good' | 'bad' | 'same' | 'unknown';
  deltaText: string;
  description: string;
};

type ImageNdviEstimate = {
  average: number;
  sampleCount: number;
};

const NDVI_IMAGE_PALETTE = [
  { rgb: [230, 26, 20] as const, value: 0.10 },
  { rgb: [245, 110, 26] as const, value: 0.275 },
  { rgb: [242, 194, 31] as const, value: 0.425 },
  { rgb: [112, 191, 61] as const, value: 0.575 },
  { rgb: [13, 122, 46] as const, value: 0.75 },
];

function formatDate(date: string) {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : date;
}

function formatNdvi(value: number | null | undefined) {
  return Number.isFinite(value as number) ? Number(value).toFixed(2) : '—';
}

function compareNdvi(
  beforeAverage: number | null,
  afterAverage: number | null,
  approximate: boolean,
): CompareTrend {
  if (!Number.isFinite(beforeAverage as number) || !Number.isFinite(afterAverage as number)) {
    return {
      label: 'Sayısal karşılaştırma yok',
      tone: 'unknown',
      deltaText: 'NDVI ortalaması alınamadı',
      description:
        'Bu iki tarih için NDVI ortalaması üretilemedi. Görsel karşılaştırma yapılabilir.',
    };
  }

  const delta = Number(afterAverage) - Number(beforeAverage);
  const absolute = Math.abs(delta);
  const deltaText = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
  const sourceText = approximate
    ? ' Görüntü renk sınıflarından yaklaşık hesaplandı.'
    : '';

  if (absolute < 0.03) {
    return {
      label: 'Büyük ölçüde aynı',
      tone: 'same',
      deltaText,
      description: `NDVI ortalaması anlamlı şekilde değişmemiş görünüyor.${sourceText}`,
    };
  }

  if (delta > 0) {
    return {
      label: 'İyiye gidiyor',
      tone: 'good',
      deltaText,
      description: `Bitki canlılığı artmış görünüyor. Daha sağlıklı bir gelişim var.${sourceText}`,
    };
  }

  return {
    label: 'Kötüye gidiyor',
    tone: 'bad',
    deltaText,
    description: `Bitki canlılığı düşmüş görünüyor. Stres veya zayıflama artmış olabilir.${sourceText}`,
  };
}

function estimateNdviFromImage(src: string): Promise<ImageNdviEstimate | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      try {
        const maxSide = 360;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let weightedTotal = 0;
        let sampleCount = 0;

        for (let index = 0; index < pixels.length; index += 16) {
          const alpha = pixels[index + 3];
          if (alpha < 90) continue;

          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];

          let bestDistance = Number.POSITIVE_INFINITY;
          let bestValue: number | null = null;

          for (const item of NDVI_IMAGE_PALETTE) {
            const dr = red - item.rgb[0];
            const dg = green - item.rgb[1];
            const db = blue - item.rgb[2];
            const distance = dr * dr + dg * dg + db * db;

            if (distance < bestDistance) {
              bestDistance = distance;
              bestValue = item.value;
            }
          }

          if (bestValue === null || bestDistance > 6500) continue;

          weightedTotal += bestValue;
          sampleCount += 1;
        }

        if (sampleCount < 20) {
          resolve(null);
          return;
        }

        resolve({
          average: Number((weightedTotal / sampleCount).toFixed(3)),
          sampleCount,
        });
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export default function SatelliteHistorySheet(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const entitlement = useEntitlementStore();
  const isPremium = entitlement.isPremium;

  const [compareMode, setCompareMode] = useState(false);
  const [freePreviewDate, setFreePreviewDate] = useState<string | null>(null);
  const [historyListOpen, setHistoryListOpen] = useState(false);
  const [compareDates, setCompareDates] = useState<string[]>([]);
  const [slider, setSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsByDate, setMetricsByDate] = useState<Record<string, SatelliteHealthResult | null>>({});
  const [imageEstimateByDate, setImageEstimateByDate] = useState<Record<string, ImageNdviEstimate | null>>({});

  const currentDate = props.dates[0] ?? null;
  const activeDate =
    !isPremium && freePreviewDate
      ? freePreviewDate
      : props.selectedDate ?? currentDate;
  const activeImage = activeDate ? getSatelliteHistoryPreview(activeDate) : null;
  const isFreeHistoricalPreview =
    !isPremium &&
    Boolean(activeDate) &&
    Boolean(currentDate) &&
    activeDate !== currentDate;

  const afterDate = compareDates[0] ?? null;
  const beforeDate = compareDates[1] ?? null;
  const afterImage = afterDate ? getSatelliteHistoryPreview(afterDate) : null;
  const beforeImage = beforeDate ? getSatelliteHistoryPreview(beforeDate) : null;

  const beforeMetrics = beforeDate ? metricsByDate[beforeDate] ?? null : null;
  const afterMetrics = afterDate ? metricsByDate[afterDate] ?? null : null;
  const beforeEstimate = beforeDate ? imageEstimateByDate[beforeDate] ?? null : null;
  const afterEstimate = afterDate ? imageEstimateByDate[afterDate] ?? null : null;

  const beforeNdviAverage = Number.isFinite(beforeMetrics?.ndviAverage as number)
    ? Number(beforeMetrics?.ndviAverage)
    : beforeEstimate?.average ?? null;
  const afterNdviAverage = Number.isFinite(afterMetrics?.ndviAverage as number)
    ? Number(afterMetrics?.ndviAverage)
    : afterEstimate?.average ?? null;
  const usingApproximateNdvi =
    (!Number.isFinite(beforeMetrics?.ndviAverage as number) && beforeEstimate !== null) ||
    (!Number.isFinite(afterMetrics?.ndviAverage as number) && afterEstimate !== null);

  const compareTrend = useMemo(
    () => compareNdvi(beforeNdviAverage, afterNdviAverage, usingApproximateNdvi),
    [beforeNdviAverage, afterNdviAverage, usingApproximateNdvi],
  );

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;

    if (props.open) {
      if (!node.open) node.showModal();
    } else if (node.open) {
      node.close();
    }
  }, [props.open]);

  useEffect(() => {
    if (!props.open) {
      setCompareMode(false);
      setCompareDates([]);
      setFreePreviewDate(null);
      setHistoryListOpen(false);
      setSlider(50);
      setZoom(1);
      setMetricsLoading(false);
    }
  }, [props.open]);

  useEffect(() => {
    if (isPremium) {
      setFreePreviewDate(null);
    } else {
      setCompareMode(false);
      setCompareDates([]);
    }
  }, [isPremium]);

  useEffect(() => {
    setZoom(1);
  }, [activeDate]);

  useEffect(() => {
    const current = props.currentData;
    const date = String(current?.latestImageDate ?? '').trim();
    if (!current || !date) return;

    setMetricsByDate((prev) => {
      if (prev[date] === current) return prev;
      return { ...prev, [date]: current };
    });
  }, [props.currentData]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      if (!isPremium || !props.getHistoryData) return;
      const targets = compareMode ? compareDates.filter(Boolean) : activeDate ? [activeDate] : [];
      const missing = targets.filter((date) => !(date in metricsByDate));

      if (!missing.length) return;

      setMetricsLoading(true);
      try {
        for (const date of missing) {
          const result = await props.getHistoryData(date);
          if (cancelled) return;
          setMetricsByDate((prev) => ({ ...prev, [date]: result }));
        }
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [
    activeDate,
    compareDates,
    compareMode,
    isPremium,
    metricsByDate,
    props.getHistoryData,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadImageEstimates() {
      const pairs: Array<[string | null, string | null]> = [
        [beforeDate, beforeImage],
        [afterDate, afterImage],
      ];

      for (const [date, image] of pairs) {
        if (!date || !image || date in imageEstimateByDate) continue;
        const estimate = await estimateNdviFromImage(image);
        if (cancelled) return;
        setImageEstimateByDate((current) => ({ ...current, [date]: estimate }));
      }
    }

    if (compareMode && compareDates.length === 2) {
      void loadImageEstimates();
    }

    return () => {
      cancelled = true;
    };
  }, [
    afterDate,
    afterImage,
    beforeDate,
    beforeImage,
    compareDates.length,
    compareMode,
    imageEstimateByDate,
  ]);

  const requestPreview = (date: string) => {
    window.dispatchEvent(
      new CustomEvent('tp:satellite-history-preview-request', {
        detail: { date },
      }),
    );
  };

  const zoomIn = () => {
    setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))));
  };

  const zoomOut = () => {
    setZoom((current) => Math.max(0.75, Number((current - 0.25).toFixed(2))));
  };

  const resetZoom = () => setZoom(1);

  const toggleCompareMode = () => {
    if (!isPremium) {
      const teaserDate = props.dates.find((date) => date !== currentDate) ?? null;
      if (teaserDate) {
        requestPreview(teaserDate);
        setFreePreviewDate(teaserDate);
      }
      return;
    }

    setCompareMode((current) => !current);
    setCompareDates([]);
    setSlider(50);
    setZoom(1);
  };

  const toggleCompareDate = (date: string) => {
    setCompareDates((current) => {
      if (current.includes(date)) {
        return current.filter((item) => item !== date);
      }
      if (current.length >= 2) {
        return [current[1], date];
      }
      return [...current, date];
    });

    setZoom(1);
    requestPreview(date);
  };

  const selectDate = (date: string, index: number) => {
    if (!isPremium) {
      requestPreview(date);
      setFreePreviewDate(index === 0 ? null : date);
      setHistoryListOpen(false);
      setZoom(1);
      return;
    }

    if (compareMode) {
      toggleCompareDate(date);
      setHistoryListOpen(false);
      return;
    }

    requestPreview(date);
    props.onSelect(index === 0 ? null : date);
    setHistoryListOpen(false);
    setZoom(1);
  };

  const ZoomControls = () => (
    <div className="tp-satellite-zoom-controls">
      <button
        type="button"
        onClick={zoomOut}
        disabled={zoom <= 0.75}
        aria-label="Uzaklaştır"
        title="Uzaklaştır"
      >
        <Minus size={18} />
      </button>

      <button
        type="button"
        className="tp-satellite-zoom-reset"
        onClick={resetZoom}
        aria-label="Görüntüyü sıfırla"
        title="Sıfırla"
      >
        {zoom === 1 ? <span>100%</span> : <RotateCcw size={15} />}
      </button>

      <button
        type="button"
        onClick={zoomIn}
        disabled={zoom >= 3}
        aria-label="Yakınlaştır"
        title="Yakınlaştır"
      >
        <Plus size={18} />
      </button>
    </div>
  );

  const Legend = () => (
    <section className="tp-satellite-meaning" aria-label="NDVI renklerinin anlamı">
      <div className="tp-satellite-meaning-head">
        <strong>Renkler ne anlatıyor?</strong>
        <span>NDVI yorum rehberi</span>
      </div>

      <div className="tp-satellite-meaning-grid">
        <div className="tp-satellite-meaning-item">
          <i className="healthy" />
          <div>
            <strong>Yeşil</strong>
            <p>Bitki daha canlı ve sağlıklı.</p>
          </div>
        </div>

        <div className="tp-satellite-meaning-item">
          <i className="warning" />
          <div>
            <strong>Sarı / Turuncu</strong>
            <p>Geçiş alanı, dikkat isteyen bölgeler.</p>
          </div>
        </div>

        <div className="tp-satellite-meaning-item">
          <i className="stress" />
          <div>
            <strong>Kırmızı</strong>
            <p>Stresli veya zayıf gelişim gösteren alanlar.</p>
          </div>
        </div>

        <div className="tp-satellite-meaning-item">
          <i className="nodata" />
          <div>
            <strong>Gri</strong>
            <p>Parsel dışı alan ya da ölçümsüz bölüm.</p>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <dialog
      ref={dialog}
      className="tp-satellite-history"
      aria-labelledby="tp-satellite-history-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="tp-satellite-history-handle" aria-hidden="true" />

      <header className="tp-satellite-history-header">
        <div className="tp-satellite-history-heading">
          <h2 id="tp-satellite-history-title">Uydu Geçmişi</h2>
          <p>
            {activeDate ? `Veri tarihi · ${formatDate(activeDate)}` : 'Uydu verileri yükleniyor'}
          </p>
        </div>

        <button
          type="button"
          className="tp-satellite-history-close"
          onClick={props.onClose}
          aria-label="Kapat"
        >
          <X size={20} />
        </button>
      </header>

      <div className="tp-satellite-history-actions">
        <span>Son 180 gün</span>
        <button
          type="button"
          className={`tp-satellite-compare-toggle ${compareMode ? 'active' : ''} ${!isPremium ? 'is-free-locked' : ''}`}
          onClick={toggleCompareMode}
          aria-disabled={!isPremium}
          title={!isPremium ? 'Karşılaştırma Premium planda açılır' : undefined}
        >
          {!isPremium ? <Lock size={13} /> : <GitCompareArrows size={15} />}
          {!isPremium
            ? 'Premium karşılaştırma'
            : compareMode
              ? 'Kapat'
              : 'Karşılaştır'}
        </button>
      </div>

      {!isPremium ? (
        <aside className="tp-satellite-free-preview-note" aria-label="Ücretsiz uydu geçmişi önizlemesi">
          <span className="tp-satellite-free-preview-icon" aria-hidden="true">
            <Lock size={15} />
          </span>
          <div>
            <strong>Uydu geçmişini ön izle</strong>
            <p>
              Tarihleri ve değişimi görebilirsin. Geçmiş görüntüler ücretsiz planda
              bulanık gösterilir; net görüntü, tarih seçimi ve karşılaştırma Premium'da açılır.
            </p>
          </div>
          <em>PREMIUM</em>
        </aside>
      ) : null}

      {props.error ? (
        <p className="tp-satellite-history-error" role="alert">
          {props.error}
        </p>
      ) : null}

      {props.loading && !props.dates.length ? (
        <div className="tp-satellite-history-loading" role="status">
          <span />
          <strong>Uydu arşivi hazırlanıyor…</strong>
        </div>
      ) : null}

      {!props.loading && !props.error && !props.dates.length ? (
        <div className="tp-satellite-history-empty">
          <ImageIcon size={24} />
          <strong>Uygun çekim bulunamadı</strong>
          <p>Bu dönem için kullanılabilir Sentinel-2 ölçümü bulunamadı.</p>
        </div>
      ) : null}

      {!compareMode && activeDate ? (
        <>
          <section className="tp-satellite-history-featured" aria-label="Seçili uydu görüntüsü">
            <div className="tp-satellite-history-featured-head">
              <div>
                <strong>{props.selectedDate ? formatDate(activeDate) : 'Son ölçüm'}</strong>
                <span>{formatDate(activeDate)}</span>
              </div>
              {!props.selectedDate ? <em>Güncel</em> : null}
            </div>

            <div
              className={`tp-satellite-history-featured-image ${isFreeHistoricalPreview ? 'is-free-preview' : ''}`}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={`${formatDate(activeDate)} NDVI görüntüsü`}
                  draggable={false}
                  style={{ transform: `scale(${zoom})` }}
                />
              ) : (
                <div className="tp-satellite-history-featured-placeholder">
                  <ImageIcon size={24} />
                </div>
              )}

              {isFreeHistoricalPreview ? (
                <div className="tp-satellite-free-image-lock">
                  <Lock size={18} />
                  <strong>{formatDate(activeDate)} görüntüsü</strong>
                  <span>Premium'da net görüntü ve detaylı geçmiş açılır</span>
                </div>
              ) : null}

              {!isFreeHistoricalPreview ? <ZoomControls /> : null}
            </div>
          </section>

          <Legend />
        </>
      ) : null}

      {compareMode ? (
        <section className="tp-satellite-compare" aria-label="Uydu görüntüsü karşılaştırması">
          {compareDates.length < 2 ? (
            <div className="tp-satellite-compare-prompt">
              <div>
                <GitCompareArrows size={18} />
                <strong>İki tarih seç</strong>
              </div>
              <span>{compareDates.length}/2</span>
            </div>
          ) : (
            <>
              <div className="tp-satellite-compare-head">
                <span>
                  <b>ÖNCE</b>
                  {beforeDate ? formatDate(beforeDate) : '—'}
                </span>
                <span>
                  <b>SONRA</b>
                  {afterDate ? formatDate(afterDate) : '—'}
                </span>
              </div>

              {beforeImage && afterImage ? (
                <div className="tp-satellite-compare-stage">
                  <img
                    src={beforeImage}
                    alt={`${formatDate(beforeDate!)} NDVI`}
                    draggable={false}
                    style={{ transform: `scale(${zoom})` }}
                  />

                  <div
                    className="tp-satellite-compare-after"
                    style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
                  >
                    <img
                      src={afterImage}
                      alt={`${formatDate(afterDate!)} NDVI`}
                      draggable={false}
                      style={{ transform: `scale(${zoom})` }}
                    />
                  </div>

                  <i
                    className="tp-satellite-compare-line"
                    style={{ left: `${slider}%` }}
                    aria-hidden="true"
                  />

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={slider}
                    onChange={(event) => setSlider(Number(event.target.value))}
                    aria-label="Önce sonra karşılaştırma sürgüsü"
                  />

                  <ZoomControls />
                </div>
              ) : (
                <div className="tp-satellite-compare-wait">
                  <span />
                  <strong>Görüntüler hazırlanıyor…</strong>
                </div>
              )}

              <Legend />

              <section className={`tp-satellite-insight-card tone-${compareTrend.tone}`} aria-label="NDVI karşılaştırma özeti">
                <div className="tp-satellite-insight-head">
                  <div>
                    <strong>NDVI ortalaması karşılaştırması</strong>
                    <p>{compareTrend.description}</p>
                    {usingApproximateNdvi ? (
                      <span className="tp-satellite-estimate-note">Yaklaşık · renk sınıflarından hesaplandı</span>
                    ) : null}
                  </div>

                  <div className="tp-satellite-insight-badge">
                    {compareTrend.tone === 'good' ? (
                      <ArrowUp size={15} />
                    ) : compareTrend.tone === 'bad' ? (
                      <ArrowDown size={15} />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    <span>{compareTrend.label}</span>
                  </div>
                </div>

                <div className="tp-satellite-insight-grid">
                  <div className="tp-satellite-insight-metric">
                    <small>Önce</small>
                    <strong>{formatNdvi(beforeNdviAverage)}</strong>
                    <span>{beforeDate ? formatDate(beforeDate) : '—'}</span>
                  </div>

                  <div className="tp-satellite-insight-metric delta">
                    <small>Fark</small>
                    <strong>{compareTrend.deltaText}</strong>
                    <span>{metricsLoading ? 'hesaplanıyor' : usingApproximateNdvi ? 'yaklaşık değişim' : 'ortalama değişim'}</span>
                  </div>

                  <div className="tp-satellite-insight-metric">
                    <small>Sonra</small>
                    <strong>{formatNdvi(afterNdviAverage)}</strong>
                    <span>{afterDate ? formatDate(afterDate) : '—'}</span>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      ) : null}

      {props.dates.length ? (
        <section className="tp-satellite-history-strip">
          <div className="tp-satellite-history-strip-head">
            <button
              type="button"
              className={`tp-satellite-history-list-toggle ${historyListOpen ? 'active' : ''}`}
              onClick={() => setHistoryListOpen((open) => !open)}
              aria-expanded={historyListOpen}
              aria-controls="tp-satellite-history-date-list"
            >
              <span>
                {!isPremium
                  ? 'Geçmiş görüntüler · önizleme'
                  : compareMode
                    ? 'Tarihleri seç'
                    : 'Geçmiş görüntüler'}
              </span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            <span>
              {historyListOpen
                ? `${props.dates.length} tarih`
                : !isPremium
                  ? 'dokun · bulanık önizle'
                  : 'sağa kaydır'}
            </span>
          </div>

          {historyListOpen ? (
            <div
              id="tp-satellite-history-date-list"
              className="tp-satellite-history-date-list"
              aria-label="Tüm uydu görüntüsü tarihleri"
            >
              <div className="tp-satellite-history-date-list-head">
                <div>
                  <strong>Tüm tarihler</strong>
                  <span>
                    En yeni ölçümden en eski kullanılabilir ölçüme kadar
                  </span>
                </div>
                <em>{props.dates.length}</em>
              </div>

              <div className="tp-satellite-history-date-list-scroll">
                {props.dates.map((date, index) => {
                  const preview = getSatelliteHistoryPreview(date);
                  const isCurrent = index === 0;
                  const isOldest = index === props.dates.length - 1;
                  const isSelected = compareMode
                    ? compareDates.includes(date)
                    : props.selectedDate
                      ? props.selectedDate === date
                      : isCurrent;
                  const isFreeLockedDate = !isPremium && !isCurrent;
                  const isFreeTeaserSelected =
                    !isPremium && freePreviewDate === date;

                  return (
                    <button
                      type="button"
                      key={`vertical-${date}`}
                      className={`tp-satellite-history-date-row ${
                        isSelected || isFreeTeaserSelected ? 'selected' : ''
                      } ${isFreeLockedDate ? 'is-free-locked' : ''}`}
                      disabled={props.loading}
                      onClick={() => selectDate(date, index)}
                    >
                      <span className="tp-satellite-history-date-row-thumb">
                        {preview ? (
                          <img
                            src={preview}
                            alt=""
                            draggable={false}
                          />
                        ) : (
                          <span>
                            <ImageIcon size={16} />
                          </span>
                        )}
                      </span>

                      <span className="tp-satellite-history-date-row-copy">
                        <strong>
                          {isCurrent ? 'Son ölçüm' : formatDate(date)}
                        </strong>
                        <small>
                          {isCurrent
                            ? formatDate(date)
                            : isFreeLockedDate
                              ? 'Premium önizleme'
                              : 'Sentinel-2'}
                        </small>
                      </span>

                      <span className="tp-satellite-history-date-row-meta">
                        {isOldest ? <b>EN ESKİ</b> : null}
                        {isFreeLockedDate ? (
                          <Lock size={13} aria-label="Premium önizleme" />
                        ) : isSelected ? (
                          <Check size={14} aria-label="Seçili" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="tp-satellite-history-gallery" aria-label="Uydu görüntüsü tarihleri">
            {props.dates.map((date, index) => {
              const preview = getSatelliteHistoryPreview(date);
              const isCurrent = index === 0;
              const isSelected = compareMode
                ? compareDates.includes(date)
                : props.selectedDate
                  ? props.selectedDate === date
                  : isCurrent;

              const isFreeLockedDate = !isPremium && !isCurrent;
              const isFreeTeaserSelected =
                !isPremium && freePreviewDate === date;

              return (
                <button
                  type="button"
                  key={date}
                  className={`tp-satellite-history-card ${isSelected ? 'selected' : ''} ${compareMode ? 'compare-mode' : ''} ${isFreeLockedDate ? 'is-free-locked' : ''} ${isFreeTeaserSelected ? 'is-free-teaser-selected' : ''}`}
                  aria-pressed={isSelected || isFreeTeaserSelected}
                  disabled={props.loading}
                  onClick={() => selectDate(date, index)}
                >
                  <span className="tp-satellite-history-thumb">
                    {preview ? (
                      <img
                        src={preview}
                        alt={`${formatDate(date)} NDVI önizlemesi`}
                        draggable={false}
                      />
                    ) : (
                      <span className="tp-satellite-history-thumb-loading" aria-hidden="true">
                        <ImageIcon size={18} />
                      </span>
                    )}
                    {isFreeLockedDate ? (
                      <b className="tp-satellite-history-lock-badge" aria-hidden="true">
                        <Lock size={10} />
                      </b>
                    ) : isSelected ? (
                      <i aria-hidden="true">
                        <Check size={12} />
                      </i>
                    ) : null}
                  </span>

                  <span className="tp-satellite-history-card-copy">
                    <strong>{isCurrent ? 'Son ölçüm' : formatDate(date)}</strong>
                    <small>
                      {isCurrent
                        ? formatDate(date)
                        : isFreeLockedDate
                          ? 'Premium önizleme'
                          : 'Sentinel-2'}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </dialog>
  );
}
