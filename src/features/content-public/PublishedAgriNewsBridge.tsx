import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './PublishedAgriNewsBridge.css';

type SourceRef = {
  source_name?: unknown;
  url?: unknown;
  title?: unknown;
  published_at?: unknown;
};

type LiveNewsRow = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  tags: string[] | null;
  crop_tags: string[] | null;
  source_refs: SourceRef[] | null;
  published_at: string | null;
  updated_at: string;
};

type ImageRow = {
  content_id: string | null;
  public_url: string | null;
  original_url: string | null;
  credit_text: string | null;
  is_cover: boolean;
};

type CategoryKey = 'varieties' | 'support' | 'pest_warning' | 'developments';

const MAIN_SELECTOR = '.tp-agri-news-main';

function normalize(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function categoryFor(item: LiveNewsRow): CategoryKey {
  const haystack = normalize(
    `${item.title} ${item.excerpt ?? ''} ${(item.tags ?? []).join(' ')}`,
  );

  if (/cesit|tescil|tohum|kultivar/.test(haystack)) return 'varieties';
  if (/destek|mevzuat|hibe|odeme|cks/.test(haystack)) return 'support';
  if (/hastalik|zararli|risk|pas|mantar|bocek|uyari/.test(haystack)) return 'pest_warning';
  return 'developments';
}

function categoryLabel(category: CategoryKey) {
  if (category === 'varieties') return 'YENİ ÇEŞİT';
  if (category === 'support') return 'DESTEK & MEVZUAT';
  if (category === 'pest_warning') return 'HASTALIK / ZARARLI';
  return 'TARIMSAL GELİŞME';
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Yayın tarihi yok';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sourceName(item: LiveNewsRow) {
  const value = item.source_refs?.[0]?.source_name;
  return typeof value === 'string' && value.trim() ? value : 'TarlaPusula kaynak ağı';
}

function sourceUrl(item: LiveNewsRow) {
  const value = item.source_refs?.[0]?.url;
  return typeof value === 'string' ? value : '';
}

export default function PublishedAgriNewsBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<LiveNewsRow[]>([]);
  const [images, setImages] = useState<Record<string, ImageRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<LiveNewsRow | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let frame = 0;
    const scan = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = document.querySelector<HTMLElement>(MAIN_SELECTOR);
        setTarget((current) => (current === next ? current : next));
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const loadPublished = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: itemError } = await supabase
        .from('content_items')
        .select('id,title,excerpt,body,tags,crop_tags,source_refs,published_at,updated_at')
        .eq('content_type', 'news')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(30);

      if (itemError) throw itemError;

      const nextItems = (data ?? []) as LiveNewsRow[];
      setItems(nextItems);

      if (!nextItems.length) {
        setImages({});
        return;
      }

      const { data: imageData, error: imageError } = await supabase
        .from('content_images')
        .select('content_id,public_url,original_url,credit_text,is_cover')
        .in('content_id', nextItems.map((item) => item.id))
        .eq('status', 'approved')
        .order('is_cover', { ascending: false });

      if (imageError) throw imageError;

      const imageMap: Record<string, ImageRow> = {};
      ((imageData ?? []) as ImageRow[]).forEach((image) => {
        if (!image.content_id || imageMap[image.content_id]) return;
        imageMap[image.content_id] = image;
      });
      setImages(imageMap);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Yayınlanan içerikler yüklenemedi.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPublished();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadPublished();
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadPublished();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!target) return;

    if (items.length) target.classList.add('tp-live-news-active');
    else target.classList.remove('tp-live-news-active');

    return () => target.classList.remove('tp-live-news-active');
  }, [target, items.length]);

  useEffect(() => {
    if (!detail) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', close);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', close);
    };
  }, [detail]);

  const featured = items[0] ?? null;
  const rest = useMemo(() => items.slice(1), [items]);

  if (!target) return null;

  const feed = createPortal(
    <section className="tp-live-news-feed" aria-label="Admin onaylı Tarım Gündemi yayınları">
      <header className="tp-live-news-feed__head">
        <div>
          <span><ShieldCheck size={15} /> ADMIN ONAYLI CANLI AKIŞ</span>
          <h2>Yayınlanan içerikler</h2>
          <p>Yalnızca yönetim merkezinde onaylanıp yayınlanan içerikler burada görünür.</p>
        </div>
        <button type="button" onClick={() => void loadPublished()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Yenile
        </button>
      </header>

      {error ? (
        <div className="tp-live-news-feed__state error">
          <strong>Canlı içerik yüklenemedi</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void loadPublished()}>Tekrar dene</button>
        </div>
      ) : loading && !items.length ? (
        <div className="tp-live-news-feed__state">Yayınlanan içerikler yükleniyor…</div>
      ) : !items.length ? (
        <div className="tp-live-news-feed__state">Henüz admin onaylı yayın bulunmuyor.</div>
      ) : (
        <>
          {featured ? (
            <article className="tp-live-news-hero">
              {images[featured.id] ? (
                <div className="tp-live-news-hero__image">
                  <img
                    src={images[featured.id].public_url || images[featured.id].original_url || ''}
                    alt=""
                  />
                </div>
              ) : (
                <div className="tp-live-news-hero__image placeholder" aria-hidden="true">
                  <span>TP</span>
                </div>
              )}

              <div className="tp-live-news-hero__copy">
                <div className="tp-live-news-meta">
                  <span>{categoryLabel(categoryFor(featured))}</span>
                  <time>{fmtDate(featured.published_at)}</time>
                </div>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt || featured.body}</p>
                <div className="tp-live-news-tags">
                  {(featured.tags ?? []).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="tp-live-news-actions">
                  <button type="button" onClick={() => setDetail(featured)}>Haberi oku</button>
                  {sourceUrl(featured) ? (
                    <a href={sourceUrl(featured)} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Kaynağı aç
                    </a>
                  ) : null}
                </div>
                <small>{sourceName(featured)}</small>
              </div>
            </article>
          ) : null}

          {rest.length ? (
            <div className="tp-live-news-grid">
              {rest.map((item) => (
                <article key={item.id} className="tp-live-news-card">
                  <div className="tp-live-news-meta">
                    <span>{categoryLabel(categoryFor(item))}</span>
                    <time>{fmtDate(item.published_at)}</time>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt || item.body}</p>
                  <div className="tp-live-news-card__foot">
                    <small>{sourceName(item)}</small>
                    <button type="button" onClick={() => setDetail(item)}>Oku →</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>,
    target,
  );

  const modal = detail
    ? createPortal(
        <div
          className="tp-live-news-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetail(null);
          }}
        >
          <article className="tp-live-news-modal" role="dialog" aria-modal="true" aria-labelledby="tp-live-news-modal-title">
            <header>
              <div>
                <span>{categoryLabel(categoryFor(detail))}</span>
                <small>{fmtDate(detail.published_at)}</small>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Kapat"><X size={20} /></button>
            </header>
            <div className="tp-live-news-modal__body">
              <h2 id="tp-live-news-modal-title">{detail.title}</h2>
              {detail.excerpt ? <p className="lead">{detail.excerpt}</p> : null}
              <p>{detail.body}</p>

              {(detail.tags ?? []).length ? (
                <div className="tp-live-news-tags">
                  {(detail.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              ) : null}

              <div className="tp-live-news-source-box">
                <span>KAYNAK</span>
                <strong>{sourceName(detail)}</strong>
                {sourceUrl(detail) ? (
                  <a href={sourceUrl(detail)} target="_blank" rel="noreferrer">
                    Resmî kaynağı aç <ExternalLink size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        </div>,
        document.body,
      )
    : null;

  return <>{feed}{modal}</>;
}
