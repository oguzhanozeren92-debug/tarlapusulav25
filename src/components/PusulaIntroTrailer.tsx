import { useEffect, useMemo, useState } from 'react';
import './PusulaIntroTrailer.css';

const INTRO_STORAGE_KEY = 'tp_pusula_intro_seen_v1';

export function shouldShowPusulaIntro() {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markPusulaIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_STORAGE_KEY, '1');
  } catch {
    // localStorage kapalıysa oturum normal devam eder.
  }
}

type PusulaIntroTrailerProps = {
  open: boolean;
  hasFields?: boolean;
  onClose: () => void;
  onStartFirstField: () => void;
};

type Scene = {
  eyebrow: string;
  title: string;
  description: string;
};

const scenes: Scene[] = [
  {
    eyebrow: 'TARLAPUSULA',
    title: 'Tarlanı yalnızca kaydetmez. Onu öğrenir.',
    description:
      'Pusula; tarla, toprak, depo, saha fotoğrafı ve işlem kayıtlarını tek bir yerde anlamlandırır.',
  },
  {
    eyebrow: 'PUSULA GÜCÜ',
    title: 'Sen veri girdikçe, Pusula güçlenir.',
    description:
      'Her tamamlanan bilgi Pusula’nın seni ve tarlanı daha iyi tanımasını sağlar. Eksik olanı da sana tek tek söyler.',
  },
  {
    eyebrow: 'PUAN SİSTEMİ',
    title: 'Puan süs değil. İlerlemenin anahtarı.',
    description:
      'TarlaPusula’yı kullandıkça puan biriktirirsin. Puanların harcanmaz; yeni tarla haklarının kilidini açar.',
  },
  {
    eyebrow: 'İLK GÖREV',
    title: 'Şimdi Pusula’yı birlikte uyandıralım.',
    description:
      'İlk tarlanı ekle. Ardından Pusula sana en değerli üç sonraki adımı gösterecek.',
  },
];

function CompassMark({ active }: { active: boolean }) {
  return (
    <svg
      className={`tp-intro-compass ${active ? 'is-active' : ''}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="52" className="tp-intro-compass-ring outer" />
      <circle cx="60" cy="60" r="37" className="tp-intro-compass-ring inner" />
      <path d="M68 31 59 57 34 67 60 58 69 86 60 58 86 49 60 58Z" className="tp-intro-compass-needle" />
      <circle cx="60" cy="58" r="4" className="tp-intro-compass-core" />
    </svg>
  );
}

function SceneOne() {
  return (
    <div className="tp-intro-visual tp-intro-visual-network">
      <div className="tp-intro-field-shape" />
      <CompassMark active />
      <span className="tp-intro-node n1">Tarla</span>
      <span className="tp-intro-node n2">Toprak</span>
      <span className="tp-intro-node n3">Depo</span>
      <span className="tp-intro-node n4">Fotoğraf</span>
      <span className="tp-intro-node n5">Sulama</span>
    </div>
  );
}

function SceneTwo() {
  return (
    <div className="tp-intro-visual tp-intro-visual-power">
      <div className="tp-intro-power-orbit">
        <span>Tarla</span>
        <span>Toprak</span>
        <span>Depo</span>
        <span>Saha</span>
      </div>

      <div className="tp-intro-power-core">
        <CompassMark active />
        <strong>%64</strong>
        <small>Pusula Gücü</small>
      </div>

      <div className="tp-intro-power-before">
        <span>%18</span>
        <i />
        <span>%64</span>
      </div>
    </div>
  );
}

function LockIcon({ open }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d={open ? 'M8 10V7a4 4 0 0 1 7.3-2.2' : 'M8 10V7a4 4 0 0 1 8 0v3'} />
    </svg>
  );
}

function SceneThree() {
  return (
    <div className="tp-intro-visual tp-intro-visual-points">
      <div className="tp-intro-points-head">
        <span>420 P</span>
        <small>Toplam puanın</small>
      </div>

      <div className="tp-intro-unlock-track">
        <article className="is-open">
          <div className="tp-intro-unlock-icon"><LockIcon open /></div>
          <div><strong>1. Tarla</strong><small>Açık</small></div>
        </article>
        <article>
          <div className="tp-intro-unlock-icon"><LockIcon /></div>
          <div><strong>2. Tarla</strong><small>1.000 P</small></div>
        </article>
        <article>
          <div className="tp-intro-unlock-icon"><LockIcon /></div>
          <div><strong>3. Tarla</strong><small>2.500 P</small></div>
        </article>
      </div>

      <div className="tp-intro-points-note">Puan harcanmaz · Biriktikçe kilit açar</div>
    </div>
  );
}

function SceneFour({ onStart }: { onStart: () => void }) {
  return (
    <div className="tp-intro-visual tp-intro-visual-mission">
      <div className="tp-intro-mission-glow" />
      <div className="tp-intro-mission-card">
        <span className="tp-intro-mission-kicker">PUSULA SENİ TANIYOR</span>
        <div className="tp-intro-mission-meter">
          <span><i style={{ width: '24%' }} /></span>
          <strong>%24</strong>
        </div>

        <div className="tp-intro-mission-row is-primary">
          <b>01</b>
          <div>
            <strong>İlk tarlanı ekle</strong>
            <small>Pusula’nın temel profilini oluşturur</small>
          </div>
          <button
            type="button"
            className="tp-intro-mission-start"
            onClick={onStart}
          >
            Başla
          </button>
        </div>

        <div className="tp-intro-mission-row">
          <b>02</b>
          <div>
            <strong>Toprak analizini ekle</strong>
            <small>+150 P · Toprak yorumlarını güçlendirir</small>
          </div>
        </div>

        <div className="tp-intro-mission-row">
          <b>03</b>
          <div>
            <strong>Saha fotoğrafı ekle</strong>
            <small>+30 P · Görsel saha bağlamı kazandırır</small>
          </div>
        </div>
      </div>
    </div>
  );
}

const sceneVisuals = [<SceneOne />, <SceneTwo />, <SceneThree />];

export default function PusulaIntroTrailer({
  open,
  hasFields = false,
  onClose,
  onStartFirstField,
}: PusulaIntroTrailerProps) {
  const [sceneIndex, setSceneIndex] = useState(0);

  const isLast = sceneIndex === scenes.length - 1;
  const baseScene = scenes[sceneIndex];
  const scene =
    isLast && hasFields
      ? {
          ...baseScene,
          title: 'Pusula artık seninle çalışmaya hazır.',
          description:
            'Tarlan hazır. Ana ekrandaki Pusula alanı sana öncelikli öneriyi ve tamamlaman gereken en değerli üç bilgiyi gösterecek.',
        }
      : baseScene;

  const progress = useMemo(
    () => ((sceneIndex + 1) / scenes.length) * 100,
    [sceneIndex],
  );

  useEffect(() => {
    if (!open) {
      setSceneIndex(0);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        markPusulaIntroSeen();
        onClose();
      }

      if (event.key === 'ArrowRight') {
        setSceneIndex((current) => Math.min(scenes.length - 1, current + 1));
      }

      if (event.key === 'ArrowLeft') {
        setSceneIndex((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || isLast) return;

    const timer = window.setTimeout(() => {
      setSceneIndex((current) => Math.min(scenes.length - 1, current + 1));
    }, 4300);

    return () => window.clearTimeout(timer);
  }, [open, isLast, sceneIndex]);

  if (!open) return null;

  const closeTrailer = () => {
    markPusulaIntroSeen();
    onClose();
  };

  const startMission = () => {
    markPusulaIntroSeen();
    onClose();
    onStartFirstField();
  };

  return (
    <div
      className="tp-intro-shell"
      role="dialog"
      aria-modal="true"
      aria-label="TarlaPusula başlangıç tanıtımı"
    >
      <div className="tp-intro-backdrop" />

      <div className="tp-intro-stage">
        <header className="tp-intro-topbar">
          <div className="tp-intro-brand">
            <CompassMark active={false} />
            <span>
              <strong>TarlaPusula</strong>
              <small>Akıllı üretim asistanı</small>
            </span>
          </div>

          <button type="button" className="tp-intro-skip" onClick={closeTrailer}>
            Atla
          </button>
        </header>

        <div className="tp-intro-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>

        <main className="tp-intro-content">
          <section className="tp-intro-copy">
            <span className="tp-intro-eyebrow">{scene.eyebrow}</span>
            <h1>{scene.title}</h1>
            <p>{scene.description}</p>

            {sceneIndex === 2 && (
              <div className="tp-intro-inline-explain">
                <strong>420 / 1.000 P</strong>
                <span>2. tarlan için 580 puan kaldı.</span>
              </div>
            )}

            <div className="tp-intro-actions">
              {!isLast ? (
                <button
                  type="button"
                  className="tp-intro-primary"
                  onClick={() =>
                    setSceneIndex((current) =>
                      Math.min(scenes.length - 1, current + 1),
                    )
                  }
                >
                  Devam Et
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  className="tp-intro-primary is-final"
                  onClick={startMission}
                >
                  {hasFields ? 'Pusula’ya Geç' : 'İlk Tarlamı Ekle'}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}

              {sceneIndex > 0 && (
                <button
                  type="button"
                  className="tp-intro-secondary"
                  onClick={() =>
                    setSceneIndex((current) => Math.max(0, current - 1))
                  }
                >
                  Geri
                </button>
              )}
            </div>
          </section>

          <section
            key={sceneIndex}
            className="tp-intro-visual-wrap"
            aria-hidden="true"
          >
            {sceneIndex === 3 ? (
              <SceneFour onStart={startMission} />
            ) : (
              sceneVisuals[sceneIndex]
            )}
          </section>
        </main>

        <footer className="tp-intro-footer">
          <div className="tp-intro-dots" aria-label="Tanıtım adımları">
            {scenes.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                className={index === sceneIndex ? 'is-active' : ''}
                onClick={() => setSceneIndex(index)}
                aria-label={`${index + 1}. adıma git`}
              />
            ))}
          </div>

          <span className="tp-intro-counter">
            {String(sceneIndex + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
          </span>
        </footer>
      </div>
    </div>
  );
}
