import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getKnowledgeGuideEntry,
  resolveMapKnowledgeQuickLink,
  type MapKnowledgeContext,
} from '../data/guide';

type Props = MapKnowledgeContext & {
  className?: string;
};

const CSS = String.raw`
.tp-knowledge-quick-trigger{
  display:inline-flex;
  align-items:center;
  min-height:17px;
  padding:0 6px;
  border:1px solid rgba(148,163,184,.24);
  border-radius:999px;
  background:rgba(148,163,184,.08);
  color:rgba(207,219,210,.76);
  font:800 6.6px/1 Inter,system-ui,sans-serif;
  letter-spacing:0;
  text-transform:none;
  white-space:nowrap;
  cursor:pointer;
}
.tp-knowledge-quick-trigger:hover{
  border-color:rgba(148,163,184,.42);
  background:rgba(148,163,184,.15);
  color:rgba(238,244,239,.94);
}
html body .tp-v1 .tp-knowledge-quick-trigger{
  border-color:#d2d8de;
  background:#f2f4f6;
  color:#37424c;
}
.tp-knowledge-quick-backdrop{
  position:fixed;
  z-index:10020;
  inset:0;
  border:0;
  background:rgba(0,0,0,.46);
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
}
.tp-knowledge-quick-sheet{
  position:fixed;
  z-index:10021;
  left:50%;
  bottom:18px;
  width:min(520px,calc(100vw - 24px));
  max-height:min(74vh,680px);
  transform:translateX(-50%);
  overflow:hidden;
  border:1px solid rgba(255,255,255,.10);
  border-radius:22px;
  background:#f7f8f8;
  color:#151a1d;
  box-shadow:0 26px 80px rgba(0,0,0,.34);
}
.tp-knowledge-quick-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  padding:17px 18px 14px;
  border-bottom:1px solid #e4e7e9;
  background:#fff;
}
.tp-knowledge-quick-head small{
  display:block;
  margin-bottom:5px;
  color:#68727a;
  font:850 9px/1.1 Inter,system-ui,sans-serif;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.tp-knowledge-quick-head strong{
  display:block;
  color:#111619;
  font:850 17px/1.2 Inter,system-ui,sans-serif;
}
.tp-knowledge-quick-close{
  width:31px;
  height:31px;
  flex:0 0 31px;
  display:grid;
  place-items:center;
  padding:0;
  border:1px solid #dfe3e6;
  border-radius:10px;
  background:#f7f8f8;
  color:#30383e;
  font:500 20px/1 Inter,system-ui,sans-serif;
  cursor:pointer;
}
.tp-knowledge-quick-body{
  max-height:calc(min(74vh,680px) - 72px);
  overflow:auto;
  padding:16px 18px 20px;
  overscroll-behavior:contain;
}
.tp-knowledge-quick-category{
  display:inline-flex;
  align-items:center;
  min-height:22px;
  padding:0 8px;
  border-radius:999px;
  background:#e9ecef;
  color:#4b555d;
  font:800 9px/1 Inter,system-ui,sans-serif;
}
.tp-knowledge-quick-summary{
  margin:11px 0 15px;
  color:#30393f;
  font:650 13px/1.55 Inter,system-ui,sans-serif;
}
.tp-knowledge-quick-section{
  padding:13px 0;
  border-top:1px solid #e3e6e8;
}
.tp-knowledge-quick-section h3{
  margin:0 0 6px;
  color:#171c1f;
  font:850 12.5px/1.3 Inter,system-ui,sans-serif;
}
.tp-knowledge-quick-section p{
  margin:0;
  color:#4b555d;
  font:560 12px/1.55 Inter,system-ui,sans-serif;
}
.tp-knowledge-quick-note{
  margin:13px 0 0;
  padding:11px 12px;
  border-radius:12px;
  background:#eceff1;
  color:#59636b;
  font:600 10.5px/1.45 Inter,system-ui,sans-serif;
}
@media(max-width:600px){
  .tp-knowledge-quick-sheet{
    bottom:8px;
    width:calc(100vw - 16px);
    border-radius:20px;
  }
}
`;

export default function KnowledgeQuickView({
  activeLayer,
  soilProperty,
  climateLayer,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const link = useMemo(
    () => resolveMapKnowledgeQuickLink({ activeLayer, soilProperty, climateLayer }),
    [activeLayer, soilProperty, climateLayer],
  );

  const entry = useMemo(
    () => getKnowledgeGuideEntry(link?.entryId),
    [link?.entryId],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [activeLayer, soilProperty, climateLayer]);

  if (!link || !entry) return null;

  const modal = open && typeof document !== 'undefined'
    ? createPortal(
        <>
          <button
            type="button"
            className="tp-knowledge-quick-backdrop"
            aria-label="Bilgi penceresini kapat"
            onClick={() => setOpen(false)}
          />
          <section
            className="tp-knowledge-quick-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tp-knowledge-quick-title"
          >
            <header className="tp-knowledge-quick-head">
              <div>
                <small>Bilgi Rehberi</small>
                <strong id="tp-knowledge-quick-title">{entry.title}</strong>
              </div>
              <button
                type="button"
                className="tp-knowledge-quick-close"
                aria-label="Kapat"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="tp-knowledge-quick-body">
              <span className="tp-knowledge-quick-category">{entry.category}</span>
              <p className="tp-knowledge-quick-summary">{entry.summary}</p>

              {entry.sections.map(([title, body]) => (
                <section className="tp-knowledge-quick-section" key={`${entry.id}:${title}`}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </section>
              ))}

              <p className="tp-knowledge-quick-note">
                Bu içerik Bilgi Rehberi ile aynı kaynaktan gelir. Genel bilgilendirme amaçlıdır; kesin teşhis, reçete veya tek başına uygulama kararı değildir.
              </p>
            </div>
          </section>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className={['tp-knowledge-quick-trigger', className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {link.buttonLabel}
      </button>
      {modal}
    </>
  );
}
