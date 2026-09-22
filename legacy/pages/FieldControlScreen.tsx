import SatelliteHealthMap from '../components/SatelliteHealthMap';
import type {
  CmsBlockRow,
  CmsPageRow,
  Field,
  FieldSatelliteState,
  Screen,
} from '../types';

type Setter<T> = (value: T) => void;

type FieldControlScreenProps = {
  cmsRuntimeCss: string;
  cmsPageFor: (pageKey: string) => CmsPageRow | undefined;
  cmsBlockFor: (pageKey: string, blockKey: string) => CmsBlockRow | undefined;
  cmsText: (block: CmsBlockRow | undefined, fallback: string) => string;
  cmsSub: (block: CmsBlockRow | undefined, fallback: string) => string;

  realFields: Field[];
  favoriteFieldId: string;
  demoField: Field;
  fieldControlFieldId: string;
  satelliteByField: Record<string, FieldSatelliteState>;

  setScreen: Setter<Screen>;
  setFieldControlFieldId: Setter<string>;
  setWeatherHubFieldId: Setter<string>;

  loadFieldSatellite: (field: Field, force?: boolean) => void | Promise<void>;
};

type ControlIconName =
  | 'back'
  | 'satellite'
  | 'leaf'
  | 'pin'
  | 'weather'
  | 'refresh'
  | 'check'
  | 'alert';

function ControlIcon({
  name,
  size = 18,
}: {
  name: ControlIconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'back':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
      );
    case 'satellite':
      return (
        <svg {...common}>
          <path d="m10 14 4-4" />
          <path d="M7.5 16.5 4 20" />
          <path d="m16.5 7.5 3.5-3.5" />
          <path d="M8.2 8.2 4.8 4.8l-2 2 3.4 3.4" />
          <path d="m15.8 15.8 3.4 3.4 2-2-3.4-3.4" />
          <rect x="8" y="8" width="8" height="8" rx="1.5" transform="rotate(45 12 12)" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M20 4C12 4 6.5 7.7 6.5 13.1A5.9 5.9 0 0 0 12.4 19C17.8 19 20 13 20 4Z" />
          <path d="M5 20c2.2-5.1 6-8.2 11.5-10.5" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'weather':
      return (
        <svg {...common}>
          <path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.5 9.5 4.25 4.25 0 0 0 7 18Z" />
          <path d="M8.5 6.2A4 4 0 0 1 15 4.8" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M19 12a7 7 0 1 0-1.4 4.2" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v5M12 17.3h.01" />
        </svg>
      );
    default:
      return null;
  }
}


function safeText(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

function safeMetric(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return '—';
}

function safeRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function FieldControlScreen({
  cmsRuntimeCss,
  cmsPageFor,
  cmsBlockFor,
  cmsText,
  cmsSub,
  realFields,
  favoriteFieldId,
  demoField,
  fieldControlFieldId,
  satelliteByField,
  setScreen,
  setFieldControlFieldId,
  setWeatherHubFieldId,
  loadFieldSatellite,
}: FieldControlScreenProps) {
  const fieldControlPage = cmsPageFor('fieldControlHub');
  const fieldControlHeaderBlock = cmsBlockFor('fieldControlHub', 'page-header');
  const fieldControlHeroBlock = cmsBlockFor('fieldControlHub', 'hero');
  const fieldControlStartBlock = cmsBlockFor('fieldControlHub', 'start-analysis');
  const fieldControlRecommendationsBlock = cmsBlockFor(
    'fieldControlHub',
    'recommendations',
  );
  const fieldControlRefreshBlock = cmsBlockFor('fieldControlHub', 'refresh');

  const safeFields = Array.isArray(realFields) ? realFields : [];

  const fallbackField =
    safeFields.find((field) => String(field.id) === favoriteFieldId) ??
    safeFields[0] ??
    demoField;

  const controlField =
    safeFields.find((field) => String(field.id) === fieldControlFieldId) ??
    fallbackField;

  const satelliteState = satelliteByField[String(controlField.id)] ?? {
    status: 'idle' as const,
  };

  const satellite = satelliteState.data;
  const statusTone = String(satellite?.status ?? 'unknown');

  const satelliteStatusLabel = safeText(
    satellite?.statusLabel,
    'Analiz',
  );
  const satelliteSummary = safeText(
    satellite?.summary,
    'Uydu analizi tamamlandı.',
  );
  const satelliteSource = safeText(
    satellite?.source,
    'Sentinel-2',
  );
  const satelliteDate = safeText(
    satellite?.latestImageDate,
    'Tarih bulunamadı',
  );
  const satelliteRecommendations = safeRecommendations(
    satellite?.recommendations,
  );

  const statusIcon =
    statusTone === 'good' ? (
      <ControlIcon name="check" size={18} />
    ) : (
      <ControlIcon name="alert" size={18} />
    );

  return (
    <>
      <style>{cmsRuntimeCss + FIELD_CONTROL_STYLES}</style>

      <div className="tp-control-page">
        <header className="tp-control-topbar">
          <button
            type="button"
            className="tp-control-back"
            onClick={() => setScreen('home')}
            aria-label="Ana sayfaya dön"
          >
            <ControlIcon name="back" size={19} />
          </button>

          <div className="tp-control-topbar-copy">
            <strong>
              {cmsText(
                fieldControlHeaderBlock,
                fieldControlPage?.title || 'Tarla Kontrolü',
              )}
            </strong>
            <small>
              {cmsSub(
                fieldControlHeaderBlock,
                fieldControlPage?.subtitle ||
                  'Sentinel-2 uydu görüntüsü ile bitki gelişimini kontrol et',
              )}
            </small>
          </div>
        </header>

        <main className="tp-control-main">
          <section className="tp-control-hero">
            <div className="tp-control-hero-overlay" />

            <div className="tp-control-hero-copy">
              <span className="tp-control-hero-kicker">
                UYDU DESTEKLİ TARLA TAKİBİ
              </span>

              <h1>
                {cmsText(
                  fieldControlHeroBlock,
                  'Tarlanı yukarıdan, daha net gör.',
                )}
              </h1>

              <p>
                {cmsSub(
                  fieldControlHeroBlock,
                  'Sentinel-2 verileriyle gelişim farklarını, zayıf bölgeleri ve kontrol edilmesi gereken alanları tek ekranda incele.',
                )}
              </p>

              <div className="tp-control-hero-pills">
                <span>
                  <ControlIcon name="satellite" size={14} />
                  Sentinel-2
                </span>
                <span>
                  <ControlIcon name="leaf" size={14} />
                  NDVI Sağlık Katmanı
                </span>
                <span>
                  <ControlIcon name="pin" size={14} />
                  Parsel Sınırı
                </span>
              </div>
            </div>
          </section>

          <section className="tp-control-field-select tp-card">
            <div className="tp-control-field-copy">
              <small>SEÇİLİ TARLA</small>
              <strong>{controlField.name}</strong>
              <span>
                {controlField.crop} •{' '}
                {controlField.area.toLocaleString('tr-TR')} da
              </span>
            </div>

            {safeFields.length > 1 && (
              <label className="tp-control-select-wrap">
                <span>Kontrol edilecek tarla</span>
                <select
                  className="tp-select"
                  value={String(controlField.id)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFieldControlFieldId(value);

                    const selected = safeFields.find(
                      (field) => String(field.id) === value,
                    );

                    if (selected?.parcelGeometry) {
                      void loadFieldSatellite(selected);
                    }
                  }}
                >
                  {safeFields.map((field) => (
                    <option key={field.id} value={String(field.id)}>
                      {field.name} — {field.crop} —{' '}
                      {field.area.toLocaleString('tr-TR')} da
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {satelliteState.status === 'idle' && (
            <section className="tp-control-empty tp-card">
              <span className="tp-control-empty-icon">
                <ControlIcon name="satellite" size={31} />
              </span>
              <strong>
                {cmsText(fieldControlStartBlock, 'Uydu analizi hazır')}
              </strong>
              <p>
                {cmsSub(
                  fieldControlStartBlock,
                  'Gerçek parsel sınırını Sentinel-2 ile analiz et.',
                )}
              </p>
              <button
                className="tp-btn-primary"
                type="button"
                onClick={() => void loadFieldSatellite(controlField)}
              >
                <ControlIcon name="satellite" size={15} />
                {fieldControlStartBlock?.button_text ||
                  'Uydu Analizini Başlat'}
              </button>
            </section>
          )}

          {satelliteState.status === 'loading' && (
            <section className="tp-control-empty tp-card">
              <span className="tp-control-loader" />
              <strong>Uydu görüntüsü analiz ediliyor</strong>
              <p>Bulutsuz Sentinel-2 görüntüsü ve NDVI hazırlanıyor.</p>
            </section>
          )}

          {satelliteState.status === 'error' && !satellite && (
            <section className="tp-control-empty tp-control-empty-error tp-card">
              <span className="tp-control-empty-icon warning">
                <ControlIcon name="alert" size={28} />
              </span>
              <strong>Uydu analizi yapılamadı</strong>
              <p>{satelliteState.message}</p>

              {controlField.parcelGeometry && (
                <button
                  className="tp-btn-primary"
                  type="button"
                  onClick={() => void loadFieldSatellite(controlField, true)}
                >
                  <ControlIcon name="refresh" size={15} />
                  Tekrar Dene
                </button>
              )}
            </section>
          )}

          {satellite && (
            <section className="tp-control-grid">
              <article className="tp-control-map-card tp-card">
                <SatelliteHealthMap
                  data={satellite}
                  parcelGeometry={controlField.parcelGeometry ?? null}
                  height={390}
                />
              </article>

              <aside className="tp-control-side">
                <article
                  className={`tp-control-status-card tp-card ${statusTone}`}
                >
                  <small>TARLA GENEL DURUMU</small>

                  <div className="tp-control-status-title">
                    <strong>{satelliteStatusLabel}</strong>
                    <span>{statusIcon}</span>
                  </div>

                  <p>{satelliteSummary}</p>

                  <div className="tp-control-ndvi-grid">
                    <div className="tp-inner-box">
                      <small>Ort. NDVI</small>
                      <strong>{safeMetric(satellite.ndviAverage)}</strong>
                    </div>
                    <div className="tp-inner-box">
                      <small>Min.</small>
                      <strong>{safeMetric(satellite.ndviMin)}</strong>
                    </div>
                    <div className="tp-inner-box">
                      <small>Max.</small>
                      <strong>{safeMetric(satellite.ndviMax)}</strong>
                    </div>
                  </div>

                  <button
                    className="tp-btn-primary tp-control-weather-button"
                    type="button"
                    onClick={() => {
                      setWeatherHubFieldId(String(controlField.id));
                      setScreen('weatherHub');
                    }}
                  >
                    <ControlIcon name="weather" size={15} />
                    Hava ile Değerlendir
                  </button>
                </article>

                <article className="tp-control-recommendations tp-card">
                  <strong>
                    {cmsText(
                      fieldControlRecommendationsBlock,
                      'Önerilen İşlemler',
                    )}
                  </strong>

                  {satelliteRecommendations.length > 0 ? (
                    satelliteRecommendations.map((item, index) => (
                      <div key={`${item}-${index}`}>
                        <span>
                          <ControlIcon name="check" size={14} />
                        </span>
                        <p>{item}</p>
                      </div>
                    ))
                  ) : (
                    <p className="tp-control-no-recommendation">
                      Şu an için ek işlem önerisi bulunmuyor.
                    </p>
                  )}
                </article>

                <article className="tp-control-date-card tp-card">
                  <small>SON UYDU GÖRÜNTÜSÜ</small>
                  <strong>
                    {satelliteDate}
                  </strong>
                  <span>{satelliteSource}</span>

                  <button
                    className="tp-btn-secondary"
                    type="button"
                    onClick={() => void loadFieldSatellite(controlField, true)}
                  >
                    <ControlIcon name="refresh" size={14} />
                    {fieldControlRefreshBlock?.button_text ||
                      cmsText(fieldControlRefreshBlock, 'Yenile')}
                  </button>
                </article>
              </aside>
            </section>
          )}
        </main>
      </div>
    </>
  );
}

const FIELD_CONTROL_STYLES = `
  :root {
    --tp-fc-bg-main: #0A0F0D;
    --tp-fc-bg-card: #121A15;
    --tp-fc-bg-input: #0C120E;
    --tp-fc-bg-active: #1B2920;
    --tp-fc-border-card: #1F2E25;
    --tp-fc-border-input: #23352B;
    --tp-fc-sage: #D2E7D6;
    --tp-fc-heading: #E6E1D5;
    --tp-fc-secondary: #A3B3A7;
    --tp-fc-muted: #617366;
    --tp-fc-good: #82D995;
    --tp-fc-warning: #E5C158;
    --tp-fc-info: #64B5F6;
  }

  .tp-control-page,
  .tp-control-page * {
    box-sizing: border-box;
  }

  .tp-control-page {
    min-height: 100vh;
    min-height: 100svh;
    background:
      radial-gradient(circle at 76% 8%, rgba(51, 80, 59, .07), transparent 30%),
      var(--tp-fc-bg-main);
    color: var(--tp-fc-heading);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .tp-control-topbar {
    min-height: 66px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    border-bottom: 1px solid var(--tp-fc-border-card);
    background: rgba(10, 15, 13, .96);
    backdrop-filter: blur(14px);
  }

  .tp-control-back {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 1px solid var(--tp-fc-border-card);
    border-radius: 11px;
    background: var(--tp-fc-bg-card);
    color: var(--tp-fc-heading);
    cursor: pointer;
  }

  .tp-control-back:hover {
    border-color: #314538;
    background: #162119;
  }

  .tp-control-topbar-copy strong {
    display: block;
    color: var(--tp-fc-heading);
    font-family: Georgia, Cambria, "Times New Roman", serif;
    font-size: 16px;
    font-weight: 600;
  }

  .tp-control-topbar-copy small {
    display: block;
    margin-top: 3px;
    color: var(--tp-fc-muted);
    font-size: 8.5px;
  }

  .tp-control-main {
    width: min(1140px, calc(100% - 30px));
    margin: 0 auto;
    padding: 20px 0 42px;
  }

  .tp-card {
    border: 1px solid var(--tp-fc-border-card);
    border-radius: 20px;
    background: var(--tp-fc-bg-card);
  }

  .tp-control-hero {
    position: relative;
    min-height: 250px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    margin-bottom: 14px;
    border: 1px solid var(--tp-fc-border-card);
    border-radius: 22px;
    padding: 30px 32px;
    background:
      linear-gradient(180deg, rgba(10, 15, 13, .4) 0%, #0A0F0D 100%),
      linear-gradient(90deg, rgba(10,15,13,.76), rgba(10,15,13,.22)),
      url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1800&q=84');
    background-position: center;
    background-size: cover;
  }

  .tp-control-hero-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(10, 15, 13, .18) 0%, rgba(10, 15, 13, .38) 55%, #0A0F0D 100%),
      linear-gradient(90deg, rgba(10,15,13,.74) 0%, rgba(10,15,13,.28) 64%, rgba(10,15,13,.08) 100%);
    pointer-events: none;
  }

  .tp-control-hero-copy {
    position: relative;
    z-index: 2;
    max-width: 720px;
  }

  .tp-control-hero-kicker {
    display: inline-flex;
    align-items: center;
    min-height: 25px;
    margin-bottom: 10px;
    border: 1px solid rgba(210, 231, 214, .15);
    border-radius: 999px;
    padding: 0 10px;
    background: rgba(210, 231, 214, .06);
    color: var(--tp-fc-sage);
    font-size: 7px;
    font-weight: 850;
    letter-spacing: .13em;
    backdrop-filter: blur(8px);
  }

  .tp-control-hero h1 {
    margin: 0;
    color: var(--tp-fc-heading);
    font-family: Georgia, Cambria, "Times New Roman", serif;
    font-size: clamp(29px, 4vw, 46px);
    line-height: 1.02;
    font-weight: 500;
    letter-spacing: -.035em;
  }

  .tp-control-hero p {
    max-width: 620px;
    margin: 9px 0 15px;
    color: #9caea2;
    font-size: 10px;
    line-height: 1.6;
  }

  .tp-control-hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .tp-control-hero-pills span {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(210, 231, 214, .16);
    border-radius: 999px;
    padding: 0 10px;
    background: rgba(210, 231, 214, .08);
    color: var(--tp-fc-sage);
    font-size: 7.5px;
    font-weight: 750;
    backdrop-filter: blur(8px);
  }

  .tp-control-field-select {
    display: grid;
    grid-template-columns: 1fr minmax(220px, 320px);
    align-items: center;
    gap: 18px;
    margin-bottom: 14px;
    padding: 18px 20px;
  }

  .tp-control-field-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tp-control-field-copy small,
  .tp-control-status-card > small,
  .tp-control-date-card > small {
    color: var(--tp-fc-muted);
    font-size: 7.5px;
    font-weight: 850;
    letter-spacing: .09em;
  }

  .tp-control-field-copy strong {
    color: var(--tp-fc-heading);
    font-family: Georgia, Cambria, "Times New Roman", serif;
    font-size: 18px;
    font-weight: 500;
  }

  .tp-control-field-copy span {
    color: var(--tp-fc-secondary);
    font-size: 9px;
  }

  .tp-control-select-wrap > span {
    display: block;
    margin-bottom: 6px;
    color: var(--tp-fc-muted);
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .tp-select {
    width: 100%;
    min-height: 42px;
    border: 1px solid var(--tp-fc-border-input);
    border-radius: 11px;
    padding: 0 12px;
    outline: 0;
    background: var(--tp-fc-bg-input);
    color: var(--tp-fc-heading);
    font: inherit;
    font-size: 9px;
  }

  .tp-select:focus {
    border-color: #4a6552;
    box-shadow: 0 0 0 3px rgba(210, 231, 214, .055);
  }

  .tp-control-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.72fr) minmax(280px, .72fr);
    gap: 14px;
  }

  .tp-control-map-card {
    min-width: 0;
    padding: 14px;
  }

  .tp-control-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tp-control-status-card,
  .tp-control-recommendations,
  .tp-control-date-card {
    padding: 18px;
  }

  .tp-control-status-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
  }

  .tp-control-status-title strong {
    color: var(--tp-fc-heading);
    font-family: Georgia, Cambria, "Times New Roman", serif;
    font-size: 23px;
    line-height: 1.05;
    font-weight: 500;
  }

  .tp-control-status-title > span {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 1px solid #294033;
    border-radius: 999px;
    background: var(--tp-fc-bg-input);
    color: var(--tp-fc-good);
  }

  .tp-control-status-card.check .tp-control-status-title strong,
  .tp-control-status-card.alert .tp-control-status-title strong,
  .tp-control-status-card.urgent .tp-control-status-title strong,
  .tp-control-status-card.attention .tp-control-status-title strong {
    color: var(--tp-fc-warning);
  }

  .tp-control-status-card.check .tp-control-status-title > span,
  .tp-control-status-card.alert .tp-control-status-title > span,
  .tp-control-status-card.urgent .tp-control-status-title > span,
  .tp-control-status-card.attention .tp-control-status-title > span {
    border-color: rgba(229, 193, 88, .18);
    color: var(--tp-fc-warning);
  }

  .tp-control-status-card p {
    margin: 9px 0 0;
    color: var(--tp-fc-secondary);
    font-size: 9px;
    line-height: 1.6;
  }

  .tp-control-ndvi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
    margin: 14px 0;
  }

  .tp-inner-box {
    min-width: 0;
    border: 1px solid var(--tp-fc-border-card);
    border-radius: 12px;
    padding: 10px;
    background: var(--tp-fc-bg-input);
  }

  .tp-control-ndvi-grid small {
    display: block;
    color: var(--tp-fc-muted);
    font-size: 7px;
  }

  .tp-control-ndvi-grid strong {
    display: block;
    margin-top: 3px;
    color: var(--tp-fc-heading);
    font-size: 13px;
    font-weight: 800;
  }

  .tp-btn-primary,
  .tp-btn-secondary {
    min-height: 39px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 10px;
    padding: 0 14px;
    font: inherit;
    font-size: 8.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .tp-btn-primary {
    border: 0;
    background: var(--tp-fc-sage);
    color: var(--tp-fc-bg-input);
  }

  .tp-btn-primary:hover {
    background: #b8d8be;
  }

  .tp-btn-secondary {
    border: 1px solid var(--tp-fc-border-input);
    background: var(--tp-fc-bg-active);
    color: var(--tp-fc-sage);
  }

  .tp-btn-secondary:hover {
    border-color: #35503f;
    background: #203127;
  }

  .tp-control-weather-button {
    width: 100%;
  }

  .tp-control-recommendations > strong {
    display: block;
    margin-bottom: 10px;
    color: var(--tp-fc-heading);
    font-size: 10px;
    font-weight: 800;
  }

  .tp-control-recommendations > div {
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: start;
    gap: 8px;
    margin-top: 8px;
  }

  .tp-control-recommendations > div > span {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    color: var(--tp-fc-good);
  }

  .tp-control-recommendations > div > p {
    margin: 1px 0 0;
    color: var(--tp-fc-secondary);
    font-size: 8.5px;
    line-height: 1.5;
  }

  .tp-control-no-recommendation {
    margin: 0;
    color: var(--tp-fc-muted);
    font-size: 8.5px;
  }

  .tp-control-date-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tp-control-date-card > strong {
    color: var(--tp-fc-heading);
    font-size: 11px;
  }

  .tp-control-date-card > span {
    color: var(--tp-fc-secondary);
    font-size: 8px;
  }

  .tp-control-date-card button {
    align-self: flex-start;
    margin-top: 8px;
  }

  .tp-control-empty {
    min-height: 330px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px;
    text-align: center;
  }

  .tp-control-empty-icon {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    border: 1px solid #283d30;
    border-radius: 18px;
    background: var(--tp-fc-bg-input);
    color: var(--tp-fc-sage);
  }

  .tp-control-empty-icon.warning {
    border-color: rgba(229, 193, 88, .2);
    color: var(--tp-fc-warning);
  }

  .tp-control-empty strong {
    margin-top: 13px;
    color: var(--tp-fc-heading);
    font-family: Georgia, Cambria, "Times New Roman", serif;
    font-size: 17px;
    font-weight: 500;
  }

  .tp-control-empty p {
    max-width: 440px;
    margin: 6px 0 15px;
    color: var(--tp-fc-secondary);
    font-size: 9px;
    line-height: 1.55;
  }

  .tp-control-loader {
    width: 34px;
    height: 34px;
    border: 2px solid #273a2e;
    border-top-color: var(--tp-fc-sage);
    border-radius: 999px;
    animation: tp-control-spin .8s linear infinite;
  }

  @keyframes tp-control-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 820px) {
    .tp-control-grid {
      grid-template-columns: 1fr;
    }

    .tp-control-side {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .tp-control-status-card {
      grid-column: 1 / 3;
    }
  }

  @media (max-width: 620px) {
    .tp-control-topbar {
      min-height: 58px;
      padding: 0 11px;
    }

    .tp-control-main {
      width: calc(100% - 14px);
      padding-top: 8px;
    }

    .tp-control-hero {
      min-height: 220px;
      border-radius: 18px;
      padding: 22px 18px;
    }

    .tp-control-hero h1 {
      font-size: 31px;
    }

    .tp-control-hero p {
      font-size: 9px;
    }

    .tp-control-hero-pills span {
      min-height: 28px;
      font-size: 7px;
    }

    .tp-control-field-select {
      grid-template-columns: 1fr;
      padding: 15px;
      border-radius: 17px;
    }

    .tp-control-map-card {
      padding: 10px;
      border-radius: 17px;
    }

    .tp-control-side {
      display: flex;
    }

    .tp-control-status-card,
    .tp-control-recommendations,
    .tp-control-date-card {
      border-radius: 17px;
      padding: 15px;
    }

    .tp-control-status-title strong {
      font-size: 20px;
    }

    .tp-control-empty {
      min-height: 290px;
      border-radius: 17px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tp-control-loader {
      animation: none;
    }
  }
`;
