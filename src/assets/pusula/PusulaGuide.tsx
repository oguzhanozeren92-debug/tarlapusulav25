import {
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import './PusulaGuide.css';

const BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const NEEDLE_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp';


export type PusulaInsight = {
  id: string;
  gozlem: string;
  yonlendirme?: string;
  guven_skoru?: 'Yüksek' | 'Orta' | 'Düşük';
  puan_odulu?: number;
};

export type PusulaFeedbackReason =
  | 'yanlis'
  | 'faydasiz'
  | 'cok_genel'
  | 'diger';

export type PusulaFeedbackValue = {
  insightId: string;
  liked: boolean;
  reason: PusulaFeedbackReason | null;
  createdAt: string;
};

const FEEDBACK_STORAGE_PREFIX = 'tp_pusula_feedback_v1:';

const feedbackReasonOptions: Array<{
  value: PusulaFeedbackReason;
  label: string;
}> = [
  { value: 'yanlis', label: 'Yanlış' },
  { value: 'faydasiz', label: 'Faydasız' },
  { value: 'cok_genel', label: 'Çok genel' },
  { value: 'diger', label: 'Diğer' },
];

function feedbackStorageKey(insightId: string) {
  return `${FEEDBACK_STORAGE_PREFIX}${encodeURIComponent(insightId)}`;
}

function readStoredFeedback(insightId: string): PusulaFeedbackValue | null {
  if (typeof window === 'undefined' || !insightId) return null;

  try {
    const raw = window.localStorage.getItem(feedbackStorageKey(insightId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PusulaFeedbackValue>;
    if (typeof parsed.liked !== 'boolean') return null;

    return {
      insightId,
      liked: parsed.liked,
      reason: parsed.reason ?? null,
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function storeFeedback(value: PusulaFeedbackValue) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      feedbackStorageKey(value.insightId),
      JSON.stringify(value),
    );
  } catch {
    // localStorage kapalı olsa da geri bildirim arayüzü çalışmaya devam eder.
  }
}

type Phase =
  | 'idle'
  | 'wake'
  | 'accelerate'
  | 'seek'
  | 'lock'
  | 'talk'
  | 'hold'
  | 'back'
  | 'replay';

type PusulaGuideProps = {
  logoSrc?: string;
  insight?: PusulaInsight | null;
  anchorSelector?: string;
  onFeedback?: (feedback: PusulaFeedbackValue) => void | Promise<void>;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function PusulaGuide({
  insight = null,
  anchorSelector = '.tp-homev3-brand',
  onFeedback,
}: PusulaGuideProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [panelVisible, setPanelVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [assetsReady, setAssetsReady] = useState(false);
  const [lastInsight, setLastInsight] = useState<PusulaInsight | null>(null);
  const [feedback, setFeedback] = useState<PusulaFeedbackValue | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [showDislikeReasons, setShowDislikeReasons] = useState(false);

  const [anchor, setAnchor] = useState({
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: 30,
    size: 58,
  });

  const runRef = useRef(0);
  const lastPlayedIdRef = useRef<string | null>(null);
  const keepOpenRef = useRef(false);

  const activeInsight = insight ?? lastInsight;

  const fullText = useMemo(() => {
    if (!activeInsight) return '';

    return [activeInsight.gozlem, activeInsight.yonlendirme]
      .filter(Boolean)
      .join(' ');
  }, [activeInsight]);

  useEffect(() => {
    const activeId = activeInsight?.id;

    setFeedback(activeId ? readStoredFeedback(activeId) : null);
    setShowDislikeReasons(false);
    keepOpenRef.current = false;
  }, [activeInsight?.id]);

  const submitFeedback = async (
    liked: boolean,
    reason: PusulaFeedbackReason | null = null,
  ) => {
    if (!activeInsight?.id) return;

    keepOpenRef.current = true;

    const value: PusulaFeedbackValue = {
      insightId: activeInsight.id,
      liked,
      reason: liked ? null : reason,
      createdAt: new Date().toISOString(),
    };

    setFeedback(value);
    storeFeedback(value);

    // Uygulama isterse bu olayı dinleyip Supabase/Edge Function'a kaydedebilir.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<PusulaFeedbackValue>('tp:pusula-feedback', {
          detail: value,
        }),
      );
    }

    if (!onFeedback) return;

    setFeedbackSaving(true);

    try {
      await onFeedback(value);
    } catch (error) {
      console.info('Pusula feedback callback failed:', error);
    } finally {
      setFeedbackSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const body = new Image();
    const needle = new Image();

    let bodyReady = false;
    let needleReady = false;

    const check = () => {
      if (mounted && bodyReady && needleReady) {
        setAssetsReady(true);
      }
    };

    body.onload = () => {
      bodyReady = true;
      check();
    };

    needle.onload = () => {
      needleReady = true;
      check();
    };

    body.src = BODY_SRC;
    needle.src = NEEDLE_SRC;

    if (body.complete) bodyReady = true;
    if (needle.complete) needleReady = true;

    check();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const updateAnchor = () => {
      const target = document.querySelector(anchorSelector) as HTMLElement | null;
      if (!target) return;

      const rect = target.getBoundingClientRect();

      setAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: Math.max(56, Math.max(rect.width, rect.height)),
      });
    };

    updateAnchor();

    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);

    const target = document.querySelector(anchorSelector) as HTMLElement | null;
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateAnchor)
        : null;

    if (target && observer) {
      observer.observe(target);
    }

    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
      observer?.disconnect();
    };
  }, [anchorSelector]);

  useEffect(() => {
    const target = document.querySelector(anchorSelector) as HTMLElement | null;
    const image = target?.querySelector('img') as HTMLImageElement | null;

    if (!image) return;

    const previousOpacity = image.style.opacity;
    image.style.opacity = '0';

    return () => {
      image.style.opacity = previousOpacity;
    };
  }, [anchorSelector]);

  useEffect(() => {
    if (phase !== 'talk' && phase !== 'replay') return;
    if (!fullText) return;

    let cancelled = false;
    let index = 0;
    let timer = 0;

    setTypedText('');

    const write = () => {
      if (cancelled) return;

      index += 1;
      setTypedText(fullText.slice(0, index));

      if (index < fullText.length) {
        timer = window.setTimeout(write, 24);
      }
    };

    timer = window.setTimeout(write, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, fullText]);

  const returnToHeader = async (token: number) => {
    setPanelVisible(false);
    setPhase('back');

    await wait(800);

    if (token !== runRef.current) return;

    setPhase('idle');
  };

  const playInsight = async (data: PusulaInsight) => {
    if (!assetsReady) return;

    const token = ++runRef.current;

    keepOpenRef.current = false;
    setLastInsight(data);
    setPanelVisible(false);
    setTypedText('');
    setShowDislikeReasons(false);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    setPhase('wake');
    await wait(560);

    if (token !== runRef.current) return;

    setPhase('accelerate');
    await wait(1080);

    if (token !== runRef.current) return;

    setPhase('seek');
    await wait(400);

    if (token !== runRef.current) return;

    setPhase('lock');
    await wait(820);

    if (token !== runRef.current) return;

    setPanelVisible(true);
    setPhase('talk');

    const text = [data.gozlem, data.yonlendirme].filter(Boolean).join(' ');
    await wait(Math.max(3900, text.length * 29));

    if (token !== runRef.current) return;

    setPhase('hold');
    // Kullanıcının minik 👍 / 👎 alanını rahatça kullanabilmesi için
    // paneli önceki 2.3 saniyeden biraz daha uzun açık tutuyoruz.
    await wait(6500);

    if (token !== runRef.current) return;
    if (keepOpenRef.current) return;

    await returnToHeader(token);
  };

  useEffect(() => {
    if (!insight?.id) return;
    if (!assetsReady) return;
    if (lastPlayedIdRef.current === insight.id) return;

    lastPlayedIdRef.current = insight.id;

    void playInsight(insight);
  }, [insight?.id, assetsReady]);

  const replayLastMessage = async () => {
    if (!assetsReady || phase !== 'idle' || !lastInsight) return;

    const token = ++runRef.current;

    setPanelVisible(true);
    setPhase('replay');

    const text = [lastInsight.gozlem, lastInsight.yonlendirme]
      .filter(Boolean)
      .join(' ');

    await wait(Math.max(3200, text.length * 29));

    if (token !== runRef.current) return;

    setPhase('hold');
  };

  const closeMessage = () => {
    const token = ++runRef.current;
    keepOpenRef.current = false;
    setShowDislikeReasons(false);
    void returnToHeader(token);
  };

  const largeSize = 198;
  const scale = largeSize / Math.max(anchor.size, 1);
  const dropDistance = 205;

  const style = {
    '--pg-x': `${anchor.x}px`,
    '--pg-y': `${anchor.y}px`,
    '--pg-small': `${anchor.size}px`,
    '--pg-scale': String(scale),
    '--pg-drop': `${dropDistance}px`,
    '--pg-panel-y': `${anchor.y + dropDistance + largeSize / 2 + 22}px`,
  } as CSSProperties;

  return (
    <div className={`pusula-guide pusula-guide--${phase}`} style={style}>
      <button
        type="button"
        className="pusula-guide__logo"
        onClick={replayLastMessage}
        aria-label={
          lastInsight
            ? "Pusula'nın son mesajını tekrar göster"
            : 'Pusula'
        }
      >
        <span className="pusula-guide__halo" aria-hidden="true" />

        <span className="pusula-guide__stage">
          <img
            className="pusula-guide__body"
            src={BODY_SRC}
            alt=""
            draggable={false}
          />

          <span className="pusula-guide__needle-layer" aria-hidden="true">
            <img
              className="pusula-guide__needle"
              src={NEEDLE_SRC}
              alt=""
              draggable={false}
            />
          </span>
        </span>
      </button>

      {panelVisible && activeInsight && (
        <section className="pusula-guide__speech" aria-live="polite">
          <button
            type="button"
            className="pusula-guide__close"
            onClick={closeMessage}
            aria-label="Pusula mesajını kapat"
          >
            ×
          </button>

          <div className="pusula-guide__wave" aria-hidden="true">
            {Array.from({ length: 23 }).map((_, index) => (
              <i
                key={index}
                style={{ '--pg-bar': index } as CSSProperties}
              />
            ))}
          </div>

          <div className="pusula-guide__message">
            <div className="pusula-guide__message-heading">
              <strong>Pusula</strong>
              <span>AI Tarım Rehberi</span>
            </div>

            <p>
              {phase === 'hold' ? fullText : typedText}

              {(phase === 'talk' || phase === 'replay') &&
                typedText.length < fullText.length && (
                  <span className="pusula-guide__cursor" aria-hidden="true" />
                )}
            </p>

            {phase === 'hold' && (
              <>
                {(activeInsight.guven_skoru || !!activeInsight.puan_odulu) && (
                  <div className="pusula-guide__meta">
                    {activeInsight.guven_skoru && (
                      <span>Güven: {activeInsight.guven_skoru}</span>
                    )}

                    {!!activeInsight.puan_odulu && (
                      <span>+{activeInsight.puan_odulu} puan</span>
                    )}
                  </div>
                )}

                <div className="pusula-guide__feedback">
                  <span className="pusula-guide__feedback-label">
                    {feedbackSaving
                      ? 'Kaydediliyor…'
                      : feedback
                        ? 'Geri bildirimin alındı ✓'
                        : 'Bu öneri nasıldı?'}
                  </span>

                  <div className="pusula-guide__feedback-actions">
                    <button
                      type="button"
                      className={`pusula-guide__feedback-button pusula-guide__feedback-button--like${
                        feedback?.liked === true ? ' is-selected' : ''
                      }`}
                      aria-pressed={feedback?.liked === true}
                      onClick={() => {
                        setShowDislikeReasons(false);
                        void submitFeedback(true);
                      }}
                    >
                      <span aria-hidden="true">👍</span>
                      Beğendim
                    </button>

                    <button
                      type="button"
                      className={`pusula-guide__feedback-button pusula-guide__feedback-button--dislike${
                        feedback?.liked === false ? ' is-selected' : ''
                      }`}
                      aria-pressed={feedback?.liked === false}
                      onClick={() => {
                        setShowDislikeReasons(true);
                        void submitFeedback(
                          false,
                          feedback?.liked === false ? feedback.reason : null,
                        );
                      }}
                    >
                      <span aria-hidden="true">👎</span>
                      Beğenmedim
                    </button>
                  </div>

                  {showDislikeReasons && feedback?.liked === false && (
                    <div
                      className="pusula-guide__feedback-reasons"
                      aria-label="Beğenmeme nedeni"
                    >
                      {feedbackReasonOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={
                            feedback.reason === option.value ? 'is-selected' : ''
                          }
                          aria-pressed={feedback.reason === option.value}
                          onClick={() => void submitFeedback(false, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
