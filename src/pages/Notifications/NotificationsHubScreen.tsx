import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Leaf,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import './NotificationsHubScreen.css';
import {
  fetchFieldCropSuitability,
  fetchFieldCropSuitabilityComparison,
  type CropSuitabilityComparisonResponse,
  type CropSuitabilityResponse,
} from '../../services/fieldCropSuitability.service';
import {
  fetchGaezCropSuitabilityEvidence,
  type GaezSuitabilityEvidenceResponse,
} from '../../services/gaezCropSuitabilityEvidence.service';
import {
  fetchTtsmVarietySources,
  type TtsmVarietySourceResponse,
} from '../../services/officialAgricultureSources.service';

const NOTIFICATION_STORAGE_KEY = 'tp_system_notifications_v1';

type FieldLike = {
  id: string | number;
  name?: string | null;
  crop?: string | null;
  demo?: boolean;
  [key: string]: unknown;
};

type StoredNotification = {
  id: string;
  fieldId: string;
  fieldName?: string | null;
  source?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  iconKey?: string | null;
  target?: string | null;
  priority?: number | null;
  kind?: 'task' | 'notification' | string;
  task?: {
    id?: string | null;
    task_key?: string | null;
    action_target?: string | null;
    title?: string | null;
    status?: string | null;
  } | null;
  isRead?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type NotificationsHubScreenProps = {
  fields?: FieldLike[];
  selectedFieldId?: string | number | null;
  setScreen: (screen: any) => void;
  onOpenFieldDetail?: (
    field: any,
    entry?: { actionTarget?: string | null },
  ) => void;
};

function readStoredNotifications(): StoredNotification[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        NOTIFICATION_STORAGE_KEY,
      );

    const parsed =
      raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function writeStoredNotifications(
  notifications: StoredNotification[],
) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      NOTIFICATION_STORAGE_KEY,
      JSON.stringify(notifications),
    );

    window.dispatchEvent(
      new CustomEvent(
        'tp:notifications-updated',
        {
          detail: {
            notifications,
          },
        },
      ),
    );
  } catch {
    // localStorage kapalıysa ekran yine çalışmaya devam eder.
  }
}

function scoreText(value: number | null | undefined) {
  return value == null
    ? '—'
    : `${Math.round(value)}`;
}

function confidenceLabel(value?: string | null) {
  if (value === 'high') return 'Yüksek';
  if (value === 'medium') return 'Orta';
  if (value === 'low') return 'Düşük';
  return 'Belirsiz';
}

function notificationIcon(
  item: StoredNotification,
) {
  const source =
    String(item.source ?? '')
      .toLocaleLowerCase('tr-TR');

  if (
    source.includes('risk') ||
    item.severity === 'danger'
  ) {
    return <CircleAlert size={18} />;
  }

  if (
    source.includes('satellite') ||
    source.includes('pusula')
  ) {
    return <Sprout size={18} />;
  }

  if (
    source.includes('nutrition') ||
    source.includes('soil')
  ) {
    return <Leaf size={18} />;
  }

  return <Bell size={18} />;
}

function relativeTime(
  value?: string | null,
) {
  if (!value) return '';

  const time =
    new Date(value).getTime();

  if (!Number.isFinite(time)) {
    return '';
  }

  const delta =
    Date.now() - time;

  if (delta < 60_000) {
    return 'Şimdi';
  }

  if (delta < 3_600_000) {
    return `${Math.max(
      1,
      Math.floor(delta / 60_000),
    )} dk`;
  }

  if (delta < 86_400_000) {
    return `${Math.max(
      1,
      Math.floor(delta / 3_600_000),
    )} sa`;
  }

  return `${Math.max(
    1,
    Math.floor(delta / 86_400_000),
  )} gün`;
}

function factorShortLabel(key: string) {
  if (key === 'temperature') {
    return 'Sıcaklık';
  }

  if (key === 'rainfall') {
    return 'Yağış';
  }

  if (key === 'soil_ph') {
    return 'Toprak pH';
  }

  return key;
}

export default function NotificationsHubScreen({
  fields = [],
  selectedFieldId,
  setScreen,
  onOpenFieldDetail,
}: NotificationsHubScreenProps) {
  const realFields =
    useMemo(
      () =>
        fields.filter(
          (field) =>
            field &&
            field.id != null &&
            !field.demo &&
            !String(field.id)
              .startsWith('demo'),
        ),
      [fields],
    );

  const initialFieldId =
    String(
      selectedFieldId ??
      realFields[0]?.id ??
      '',
    );

  const [activeFieldId, setActiveFieldId] =
    useState(initialFieldId);

  const activeField =
    useMemo(
      () =>
        realFields.find(
          (field) =>
            String(field.id) ===
            String(activeFieldId),
        ) ??
        realFields[0] ??
        null,
      [realFields, activeFieldId],
    );

  const fieldId =
    String(activeField?.id ?? '');

  const [notifications, setNotifications] =
    useState<StoredNotification[]>(
      () => readStoredNotifications(),
    );

  const [suitability, setSuitability] =
    useState<CropSuitabilityResponse | null>(
      null,
    );
  const [suitabilityLoading, setSuitabilityLoading] =
    useState(false);
  const [suitabilityError, setSuitabilityError] =
    useState('');

  const [detailOpen, setDetailOpen] =
    useState(false);

  const [comparisonOpen, setComparisonOpen] =
    useState(false);
  const [comparison, setComparison] =
    useState<CropSuitabilityComparisonResponse | null>(
      null,
    );
  const [comparisonLoading, setComparisonLoading] =
    useState(false);
  const [comparisonError, setComparisonError] =
    useState('');

  const [gaez, setGaez] =
    useState<GaezSuitabilityEvidenceResponse | null>(
      null,
    );
  const [gaezLoading, setGaezLoading] =
    useState(false);

  const [varietiesOpen, setVarietiesOpen] =
    useState(false);
  const [ttsm, setTtsm] =
    useState<TtsmVarietySourceResponse | null>(
      null,
    );
  const [ttsmLoading, setTtsmLoading] =
    useState(false);
  const [ttsmError, setTtsmError] =
    useState('');

  useEffect(() => {
    if (
      initialFieldId &&
      !activeFieldId
    ) {
      setActiveFieldId(initialFieldId);
    }
  }, [initialFieldId, activeFieldId]);

  useEffect(() => {
    const refresh = () => {
      setNotifications(
        readStoredNotifications(),
      );
    };

    const custom = (event: Event) => {
      const detail =
        (event as CustomEvent)
          ?.detail?.notifications;

      setNotifications(
        Array.isArray(detail)
          ? detail
          : readStoredNotifications(),
      );
    };

    window.addEventListener(
      'storage',
      refresh,
    );
    window.addEventListener(
      'tp:notifications-updated',
      custom,
    );

    refresh();

    return () => {
      window.removeEventListener(
        'storage',
        refresh,
      );
      window.removeEventListener(
        'tp:notifications-updated',
        custom,
      );
    };
  }, []);

  const loadSuitability =
    useCallback(async () => {
      if (!fieldId) {
        setSuitability(null);
        setSuitabilityError('');
        return;
      }

      setSuitabilityLoading(true);
      setSuitabilityError('');

      try {
        const next =
          await fetchFieldCropSuitability(
            fieldId,
          );

        setSuitability(next);
      } catch (error) {
        setSuitability(null);
        setSuitabilityError(
          error instanceof Error
            ? error.message
            : 'Ürün uygunluğu hazırlanamadı.',
        );
      } finally {
        setSuitabilityLoading(false);
      }
    }, [fieldId]);

  useEffect(() => {
    setDetailOpen(false);
    setComparisonOpen(false);
    setComparison(null);
    setComparisonError('');
    setGaez(null);
    setVarietiesOpen(false);
    setTtsm(null);
    setTtsmError('');

    void loadSuitability();
  }, [fieldId, loadSuitability]);

  useEffect(() => {
    if (
      !detailOpen ||
      !fieldId ||
      gaez ||
      gaezLoading
    ) {
      return;
    }

    let cancelled = false;

    setGaezLoading(true);

    void fetchGaezCropSuitabilityEvidence(
      fieldId,
      suitability?.crop?.label ??
        activeField?.crop ??
        null,
    )
      .then((result) => {
        if (!cancelled) {
          setGaez(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGaez(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGaezLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    detailOpen,
    fieldId,
    gaez,
    gaezLoading,
    suitability?.crop?.label,
    activeField?.crop,
  ]);

  const loadComparison =
    useCallback(async () => {
      if (!fieldId) return;

      setComparisonOpen(true);

      if (
        comparison ||
        comparisonLoading
      ) {
        return;
      }

      setComparisonLoading(true);
      setComparisonError('');

      try {
        const result =
          await fetchFieldCropSuitabilityComparison(
            fieldId,
          );

        setComparison(result);
      } catch (error) {
        setComparisonError(
          error instanceof Error
            ? error.message
            : 'Ürün karşılaştırması hazırlanamadı.',
        );
      } finally {
        setComparisonLoading(false);
      }
    }, [
      fieldId,
      comparison,
      comparisonLoading,
    ]);

  const loadTtsm =
    useCallback(async () => {
      if (!fieldId) return;

      setVarietiesOpen(true);

      if (ttsm || ttsmLoading) {
        return;
      }

      setTtsmLoading(true);
      setTtsmError('');

      try {
        const result =
          await fetchTtsmVarietySources(
            fieldId,
            suitability?.crop?.label ??
              activeField?.crop ??
              null,
          );

        setTtsm(result);
      } catch (error) {
        setTtsmError(
          error instanceof Error
            ? error.message
            : 'TTSM çeşit kaynakları hazırlanamadı.',
        );
      } finally {
        setTtsmLoading(false);
      }
    }, [
      fieldId,
      ttsm,
      ttsmLoading,
      suitability?.crop?.label,
      activeField?.crop,
    ]);

  const filteredNotifications =
    useMemo(
      () =>
        [...notifications]
          .filter(
            (item) =>
              !fieldId ||
              String(item.fieldId ?? '') ===
                fieldId,
          )
          .sort((a, b) => {
            const pa =
              Number(a.priority ?? 0);
            const pb =
              Number(b.priority ?? 0);

            if (pa !== pb) {
              return pb - pa;
            }

            const at =
              new Date(
                a.updatedAt ??
                a.createdAt ??
                0,
              ).getTime();

            const bt =
              new Date(
                b.updatedAt ??
                b.createdAt ??
                0,
              ).getTime();

            return bt - at;
          }),
      [notifications, fieldId],
    );

  const unreadCount =
    filteredNotifications.filter(
      (item) => !item.isRead,
    ).length;

  const markRead =
    useCallback(
      (id: string) => {
        const next =
          notifications.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isRead: true,
                }
              : item,
          );

        setNotifications(next);
        writeStoredNotifications(next);
      },
      [notifications],
    );

  const markAllRead =
    useCallback(() => {
      const next =
        notifications.map((item) =>
          !fieldId ||
          String(item.fieldId) ===
            fieldId
            ? {
                ...item,
                isRead: true,
              }
            : item,
        );

      setNotifications(next);
      writeStoredNotifications(next);
    }, [notifications, fieldId]);

  const openNotification =
    useCallback(
      (item: StoredNotification) => {
        markRead(item.id);

        const target =
          String(
            item.task?.action_target ??
            item.target ??
            '',
          ).trim();

        if (
          item.kind === 'task' &&
          activeField &&
          typeof onOpenFieldDetail ===
            'function'
        ) {
          onOpenFieldDetail(
            activeField,
            {
              actionTarget:
                target || null,
            },
          );
          return;
        }

        if (
          target === 'weather' ||
          target === 'spray_weather'
        ) {
          setScreen('weatherHub');
          return;
        }

        if (target === 'calendar') {
          setScreen('calendar');
          return;
        }

        if (target === 'ai') {
          setScreen('aiAnalysis');
          return;
        }

        if (target === 'soil') {
          setScreen('soilAnalysisHub');
          return;
        }

        if (
          target === 'map_vegetation'
        ) {
          setScreen('fieldControlHub');
          return;
        }

        if (
          target === 'field_growth' &&
          activeField &&
          typeof onOpenFieldDetail ===
            'function'
        ) {
          onOpenFieldDetail(
            activeField,
            {
              actionTarget:
                'field-growth',
            },
          );
          return;
        }

        setScreen('home');
      },
      [
        activeField,
        markRead,
        onOpenFieldDetail,
        setScreen,
      ],
    );

  const screening =
    suitability?.screening;

  const cropLabel =
    suitability?.crop?.label ??
    activeField?.crop ??
    'Ürün';

  const score =
    screening?.score ?? null;

  const limiting =
    screening?.limitingFactor;

  const gaezSample =
    gaez?.samples?.find(
      (item) => item.sample?.ok,
    );

  return (
    <main className="tp-notifications-page">
      <section className="tp-notifications-shell">
        <header className="tp-notifications-header">
          <div>
            <span className="tp-notifications-kicker">
              BİLDİRİM MERKEZİ
            </span>
            <h1>
              Tarlanla ilgili olanlar
            </h1>
            <p>
              Pusula analizleri üstte sabit,
              gelişmeler ve görevler aşağıda.
            </p>
          </div>

          <div className="tp-notifications-header-actions">
            {realFields.length > 1 && (
              <label className="tp-notifications-field-picker">
                <span>Tarla</span>
                <select
                  value={fieldId}
                  onChange={(event) =>
                    setActiveFieldId(
                      event.target.value,
                    )
                  }
                >
                  {realFields.map(
                    (field) => (
                      <option
                        key={String(
                          field.id,
                        )}
                        value={String(
                          field.id,
                        )}
                      >
                        {field.name ||
                          'Tarla'}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}

            <button
              type="button"
              className="tp-notifications-home-button"
              onClick={() =>
                setScreen('home')
              }
            >
              Ana ekran
            </button>
          </div>
        </header>

        {!activeField ? (
          <section className="tp-notifications-empty-card">
            <Sprout size={22} />
            <div>
              <strong>
                Önce bir tarla ekle
              </strong>
              <span>
                Ürün uygunluğu ve tarla
                bildirimleri burada
                görünecek.
              </span>
            </div>
          </section>
        ) : (
          <section className="tp-suitability-card">
            <div className="tp-suitability-topline">
              <div className="tp-suitability-heading">
                <span className="tp-suitability-icon">
                  <Leaf size={19} />
                </span>
                <div>
                  <span>
                    SABİT PUSULA ANALİZİ
                  </span>
                  <h2>
                    Ürün Uygunluğu
                  </h2>
                </div>
              </div>

              <span className="tp-suitability-fixed-badge">
                Sabit
              </span>
            </div>

            {suitabilityLoading ? (
              <div className="tp-suitability-loading">
                <LoaderCircle
                  className="tp-spin"
                  size={22}
                />
                <span>
                  Tarla verileri
                  karşılaştırılıyor…
                </span>
              </div>
            ) : suitabilityError ? (
              <div className="tp-suitability-error">
                <CircleAlert
                  size={20}
                />
                <div>
                  <strong>
                    Uygunluk analizi
                    alınamadı
                  </strong>
                  <span>
                    {suitabilityError}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void loadSuitability()
                  }
                >
                  <RefreshCw
                    size={15}
                  />
                  Yenile
                </button>
              </div>
            ) : suitability?.status ===
              'unsupported_crop' ? (
              <div className="tp-suitability-unsupported">
                <div>
                  <strong>
                    {activeField.crop ||
                      'Bu ürün'}
                  </strong>
                  <span>
                    için kaynaklı kural
                    paketi henüz yok.
                    Mevcut ürünlerle
                    karşılaştırma
                    yapabilirsin.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadComparison()
                  }
                >
                  Başka ürünle
                  karşılaştır
                </button>
              </div>
            ) : (
              <>
                <div className="tp-suitability-summary">
                  <div
                    className="tp-suitability-score"
                    style={{
                      ['--score-angle' as any]: `${Math.max(
                        0,
                        Math.min(100, Number(score ?? 0)),
                      ) * 3.6}deg`,
                    }}
                  >
                    <strong>
                      {scoreText(score)}
                    </strong>
                    <span>/100</span>
                  </div>

                  <div className="tp-suitability-copy">
                    <span>
                      {cropLabel}
                    </span>
                    <strong>
                      {screening?.label ??
                        'Veri hazırlanıyor'}
                    </strong>
                    <small>
                      {limiting
                        ? `Sınırlayıcı faktör: ${limiting.label}`
                        : 'Sınırlayıcı faktör belirlenmedi'}
                    </small>
                  </div>

                  <div className="tp-suitability-confidence">
                    <span>
                      Güven
                    </span>
                    <strong>
                      {confidenceLabel(
                        screening
                          ?.confidence,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="tp-suitability-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      setDetailOpen(
                        (value) =>
                          !value,
                      )
                    }
                  >
                    Detayı gör
                    <ChevronDown
                      size={16}
                      className={
                        detailOpen
                          ? 'is-open'
                          : ''
                      }
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void loadComparison()
                    }
                  >
                    Başka ürünle
                    karşılaştır
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void loadTtsm()
                    }
                  >
                    Çeşitleri incele
                  </button>
                </div>

                {detailOpen && (
                  <div className="tp-suitability-detail">
                    <div className="tp-suitability-factor-grid">
                      {(screening
                        ?.factors ??
                        []).map(
                        (factor) => (
                          <article
                            key={
                              factor.key
                            }
                            className="tp-suitability-factor"
                          >
                            <div>
                              <span>
                                {factorShortLabel(
                                  factor.key,
                                )}
                              </span>
                              <strong>
                                {scoreText(
                                  factor.score,
                                )}
                                <small>
                                  /100
                                </small>
                              </strong>
                            </div>

                            <div className="tp-factor-track">
                              <i
                                style={{
                                  width:
                                    `${Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        Number(
                                          factor.score ??
                                            0,
                                        ),
                                      ),
                                    )}%`,
                                }}
                              />
                            </div>

                            <small>
                              {factor.value ==
                              null
                                ? 'Veri yok'
                                : `${factor.value} ${factor.unit}`}
                            </small>
                          </article>
                        ),
                      )}
                    </div>

                    <div className="tp-suitability-evidence">
                      <div className="tp-suitability-evidence-head">
                        <ShieldCheck
                          size={17}
                        />
                        <strong>
                          Kaynaklar /
                          Neden?
                        </strong>
                      </div>

                      <div className="tp-suitability-source-chips">
                        <span>
                          FAO ECOCROP
                        </span>
                        <span>
                          NASA POWER
                        </span>
                        <span>
                          SoilGrids
                        </span>
                        <span
                          className={
                            gaez?.status ===
                            'ready'
                              ? 'ready'
                              : ''
                          }
                        >
                          {gaezLoading
                            ? 'GAEZ kontrol ediliyor'
                            : gaez?.status ===
                                'ready'
                              ? 'FAO GAEZ · çapraz kontrol'
                              : 'FAO GAEZ · bağımsız kanıt'}
                        </span>
                      </div>

                      {gaezSample?.interpretation
                        ?.derived_class && (
                        <p className="tp-gaez-note">
                          GAEZ bağımsız
                          karşılaştırması:{' '}
                          <strong>
                            {
                              gaezSample
                                .interpretation
                                .derived_class
                                .label
                            }
                          </strong>
                          . Bu sonuç ana
                          skora katılmıyor.
                        </p>
                      )}

                      <p>
                        Bu puan ekim
                        tavsiyesi değildir.
                        Şimdilik uzun dönem
                        sıcaklık, yıllık
                        yağış ve 0–30 cm
                        toprak pH ön
                        elemesine dayanır.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {comparisonOpen && (
              <div className="tp-comparison-panel">
                <div className="tp-comparison-head">
                  <div>
                    <span>
                      AYNI TARLA · AYNI VERİ
                    </span>
                    <strong>
                      Ürün ön uygunluk
                      karşılaştırması
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setComparisonOpen(
                        false,
                      )
                    }
                  >
                    Kapat
                  </button>
                </div>

                {comparisonLoading ? (
                  <div className="tp-comparison-loading">
                    <LoaderCircle
                      className="tp-spin"
                      size={20}
                    />
                    16 ürün tek veri
                    paketiyle
                    karşılaştırılıyor…
                  </div>
                ) : comparisonError ? (
                  <div className="tp-comparison-error">
                    {comparisonError}
                  </div>
                ) : (
                  <div className="tp-comparison-list">
                    {comparison?.comparisons
                      ?.map(
                        (
                          item,
                          index,
                        ) => {
                          const isCurrent =
                            item.crop
                              .key ===
                            suitability
                              ?.crop
                              ?.key;

                          return (
                            <article
                              key={
                                item
                                  .crop
                                  .key
                              }
                              className={
                                isCurrent
                                  ? 'is-current'
                                  : ''
                              }
                            >
                              <span className="tp-comparison-rank">
                                {index +
                                  1}
                              </span>

                              <div className="tp-comparison-crop">
                                <strong>
                                  {
                                    item
                                      .crop
                                      .label
                                  }
                                </strong>
                                <small>
                                  {isCurrent
                                    ? 'Mevcut ürün'
                                    : item
                                        .screening
                                        .label}
                                </small>
                              </div>

                              <div className="tp-comparison-limit">
                                <span>
                                  Sınırlayıcı
                                </span>
                                <strong>
                                  {item
                                    .screening
                                    .limitingFactor
                                    ?.label ??
                                    '—'}
                                </strong>
                              </div>

                              <b>
                                {scoreText(
                                  item
                                    .screening
                                    .score,
                                )}
                              </b>
                            </article>
                          );
                        },
                      )}
                  </div>
                )}

                <p className="tp-comparison-disclaimer">
                  Sıralama yalnız mevcut
                  üç ön-eleme faktörüne
                  göre yapılır; “bunu ek”
                  önerisi değildir.
                </p>
              </div>
            )}

            {varietiesOpen && (
              <div className="tp-variety-panel">
                <div className="tp-variety-head">
                  <div>
                    <span>
                      T.C. TARIM VE ORMAN
                      BAKANLIĞI · TTSM
                    </span>
                    <strong>
                      Çeşit kaynakları
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setVarietiesOpen(
                        false,
                      )
                    }
                  >
                    Kapat
                  </button>
                </div>

                {ttsmLoading ? (
                  <div className="tp-variety-loading">
                    <LoaderCircle
                      className="tp-spin"
                      size={20}
                    />
                    Resmî katalog ve tescil
                    kaynakları aranıyor…
                  </div>
                ) : ttsmError ? (
                  <div className="tp-variety-error">
                    {ttsmError}
                  </div>
                ) : ttsm
                    ?.relevant_documents
                    ?.length ? (
                  <div className="tp-variety-documents">
                    {ttsm.relevant_documents.map(
                      (
                        document,
                        index,
                      ) => (
                        <a
                          href={
                            document.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          key={`${document.url}-${index}`}
                        >
                          <span>
                            {document.kind ===
                            'catalog'
                              ? 'Katalog'
                              : 'Tescil raporu'}
                          </span>
                          <strong>
                            {document.title}
                          </strong>
                          <ChevronRight
                            size={16}
                          />
                        </a>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="tp-variety-empty">
                    Bu ürün için sayfadan
                    eşleşen TTSM belgesi
                    bulunamadı. Veri
                    uydurulmadı.
                  </div>
                )}

                <p>
                  Bu bölüm şu aşamada
                  resmî belgeyi bulur.
                  Çeşit performansını
                  otomatik puanlamaz.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="tp-notification-feed">
          <div className="tp-notification-feed-head">
            <div>
              <span>
                GÜNCEL GELİŞMELER
              </span>
              <h2>
                Bildirimler ve görevler
              </h2>
            </div>

            <div className="tp-notification-feed-actions">
              {unreadCount > 0 && (
                <span>
                  {unreadCount} okunmamış
                </span>
              )}

              {filteredNotifications.length >
                0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                >
                  <Check size={14} />
                  Tümünü okundu yap
                </button>
              )}
            </div>
          </div>

          {filteredNotifications.length ===
          0 ? (
            <div className="tp-notification-empty">
              <Bell size={20} />
              <div>
                <strong>
                  Şimdilik yeni bildirim
                  yok
                </strong>
                <span>
                  Pusula yeni bir gelişme
                  yakaladığında burada
                  gösterecek.
                </span>
              </div>
            </div>
          ) : (
            <div className="tp-notification-list">
              {filteredNotifications.map(
                (item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`tp-notification-item ${
                      item.isRead
                        ? 'is-read'
                        : 'is-unread'
                    }`}
                    onClick={() =>
                      openNotification(
                        item,
                      )
                    }
                  >
                    <span className="tp-notification-item-icon">
                      {notificationIcon(
                        item,
                      )}
                    </span>

                    <span className="tp-notification-item-copy">
                      <small>
                        {item.kind ===
                        'task'
                          ? 'GÖREV'
                          : 'BİLDİRİM'}
                        {item.fieldName
                          ? ` · ${item.fieldName}`
                          : ''}
                      </small>
                      <strong>
                        {item.title ||
                          'Tarla güncellemesi'}
                      </strong>
                      <em>
                        {item.message ||
                          'Detayı görmek için aç.'}
                      </em>
                    </span>

                    <span className="tp-notification-item-meta">
                      <small>
                        {relativeTime(
                          item.updatedAt ??
                            item.createdAt,
                        )}
                      </small>
                      {!item.isRead && (
                        <i
                          aria-label="Okunmamış"
                        />
                      )}
                      <ChevronRight
                        size={16}
                      />
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </section>

        <footer className="tp-notifications-footer-note">
          <FlaskConical size={16} />
          <span>
            Pusula kaynakları arkada
            birleştirir; kullanıcıya sade
            sonucu gösterir. “Kaynaklar /
            Neden?” bölümü kanıtı açar.
          </span>
        </footer>
      </section>
    </main>
  );
}
