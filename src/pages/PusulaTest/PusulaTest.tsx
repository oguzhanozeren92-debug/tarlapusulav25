import {
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import './PusulaTest.css';

const BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const NEEDLE_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp';

type Phase =
  | 'idle'
  | 'wake'
  | 'accelerate'
  | 'seek'
  | 'lock'
  | 'talk'
  | 'hold'
  | 'back';

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function PusulaTest() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [assetsReady, setAssetsReady] = useState(false);

  const runRef = useRef(0);

  const message = useMemo(
    () =>
      'Şenpınar tarlasında bitki canlılığında hafif bir değişim görüyorum. Sulama hattını ve yaprak görünümünü bugün kontrol etmeni öneririm.',
    [],
  );

  useEffect(() => {
    let active = true;

    const body = new Image();
    const needle = new Image();

    let bodyLoaded = false;
    let needleLoaded = false;

    const checkReady = () => {
      if (active && bodyLoaded && needleLoaded) {
        setAssetsReady(true);
      }
    };

    body.onload = () => {
      bodyLoaded = true;
      checkReady();
    };

    needle.onload = () => {
      needleLoaded = true;
      checkReady();
    };

    body.onerror = () => {
      console.error('Pusula gövdesi yüklenemedi:', BODY_SRC);
    };

    needle.onerror = () => {
      console.error('Pusula ibresi yüklenemedi:', NEEDLE_SRC);
    };

    body.src = BODY_SRC;
    needle.src = NEEDLE_SRC;

    if (body.complete) {
      bodyLoaded = true;
    }

    if (needle.complete) {
      needleLoaded = true;
    }

    checkReady();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'talk') return;

    let cancelled = false;
    let index = 0;
    let timer = 0;

    setTypedText('');

    const write = () => {
      if (cancelled) return;

      index += 1;
      setTypedText(message.slice(0, index));

      if (index < message.length) {
        timer = window.setTimeout(write, 24);
      }
    };

    timer = window.setTimeout(write, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, message]);

  const startTest = async () => {
    if (!assetsReady || phase !== 'idle') {
      return;
    }

    const run = ++runRef.current;

    setPanelOpen(false);
    setTypedText('');

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

    /*
     * 1 — çok hafif uyanış
     */
    setPhase('wake');

    await wait(560);

    if (run !== runRef.current) return;

    /*
     * 2 — giderek hızlanan dönüş
     * aynı anda akıcı iniş + büyüme
     */
    setPhase('accelerate');

    await wait(1080);

    if (run !== runRef.current) return;

    /*
     * 3 — hedef seçimi
     */
    setPhase('seek');

    await wait(400);

    if (run !== runRef.current) return;

    /*
     * 4 — küçük sağ-sol arama
     */
    setPhase('lock');

    await wait(820);

    if (run !== runRef.current) return;

    /*
     * 5 — tamamen durduktan sonra konuşma
     */
    setPanelOpen(true);
    setPhase('talk');

    await wait(
      Math.max(
        3900,
        message.length * 29,
      ),
    );

    if (run !== runRef.current) return;

    setPhase('hold');

    await wait(2300);

    if (run !== runRef.current) return;

    setPanelOpen(false);
    setPhase('back');

    await wait(800);

    if (run !== runRef.current) return;

    setPhase('idle');
  };

  const closePanel = async () => {
    const run = ++runRef.current;

    setPanelOpen(false);
    setPhase('back');

    await wait(800);

    if (run !== runRef.current) return;

    setPhase('idle');
  };

  return (
    <main className="pt-page">
      <header className="pt-header">
        <div className="pt-weather">
          <span>28°C</span>
          <i />
          <span>Parçalı bulutlu</span>
          <i />
          <span>Şenpınar / Ağın</span>
        </div>

        <div className="pt-header-title">
          TARLAPUSULA ANİMASYON TESTİ
        </div>

        <div className="pt-header-actions">
          <span>◎</span>
          <span>☰</span>
        </div>
      </header>

      <section className="pt-demo-area">
        <article className="pt-demo-card">
          <span>ANİMASYON TEST ALANI</span>

          <strong>Pusula</strong>

          <p>
            İbre yavaş başlar, giderek hızlanır,
            bir yön belirler, hedefin çevresinde
            küçük sağ-sol arama hareketi yapar
            ve orada kilitlenir.
          </p>
        </article>
      </section>

      <button
        type="button"
        className="pt-test-button"
        onClick={startTest}
        disabled={!assetsReady || phase !== 'idle'}
      >
        {!assetsReady
          ? 'Pusula hazırlanıyor'
          : phase === 'idle'
            ? 'Pusula Test'
            : 'Animasyon Çalışıyor'}
      </button>

      <div className={`pt-pusula pt-pusula--${phase}`}>
        <span
          className="pt-pusula-halo"
          aria-hidden="true"
        />

        <button
          type="button"
          className="pt-pusula-button"
          onClick={startTest}
          aria-label="Pusula animasyonunu başlat"
        >
          <span className="pt-pusula-stage">
            <img
              className="pt-pusula-body"
              src={BODY_SRC}
              alt="Pusula"
              draggable={false}
            />

            <span
              className="pt-needle-layer"
              aria-hidden="true"
            >
              <img
                className="pt-pusula-needle"
                src={NEEDLE_SRC}
                alt=""
                draggable={false}
              />
            </span>
          </span>
        </button>
      </div>

      {panelOpen && (
        <section
          className={`pt-speech pt-speech--${phase}`}
          aria-live="polite"
        >
          <button
            type="button"
            className="pt-close"
            onClick={closePanel}
            aria-label="Kapat"
          >
            ×
          </button>

          <div
            className="pt-speaking-wave"
            aria-hidden="true"
          >
            {Array.from({ length: 23 }).map(
              (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      '--wave-index': index,
                    } as CSSProperties
                  }
                />
              ),
            )}
          </div>

          <div className="pt-message">
            <div className="pt-message-heading">
              <strong>Pusula</strong>
              <span>AI Tarım Rehberi</span>
            </div>

            <p>
              {phase === 'hold'
                ? message
                : typedText}

              {phase === 'talk' &&
                typedText.length < message.length && (
                  <span
                    className="pt-cursor"
                    aria-hidden="true"
                  />
                )}
            </p>

            {phase === 'hold' && (
              <div className="pt-meta">
                <span>Güven: Yüksek</span>
                <span>Test mesajı</span>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}