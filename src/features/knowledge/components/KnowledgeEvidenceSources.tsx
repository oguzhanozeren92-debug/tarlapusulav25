import type { MapKnowledgeEvidenceSource } from '../services/mapKnowledgeEvidence';

type Props = {
  sources?: MapKnowledgeEvidenceSource[] | null;
};

const CSS = String.raw`
.tp-knowledge-evidence{
  margin-top:12px;
  padding-top:11px;
  border-top:1px solid rgba(255,255,255,.09);
}
.tp-knowledge-evidence-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:7px;
}
.tp-knowledge-evidence-head strong{
  color:rgba(239,242,244,.91);
  font-size:9px;
  font-weight:900;
}
.tp-knowledge-evidence-head span{
  color:rgba(182,190,196,.56);
  font-size:7px;
  font-weight:760;
}
.tp-knowledge-evidence-list{
  display:grid;
  gap:6px;
}
.tp-knowledge-evidence-item{
  display:block;
  padding:9px 10px;
  border:1px solid rgba(255,255,255,.09);
  border-radius:11px;
  background:rgba(255,255,255,.025);
  color:inherit;
  text-decoration:none;
}
a.tp-knowledge-evidence-item:hover{
  border-color:rgba(255,255,255,.17);
  background:rgba(255,255,255,.05);
}
.tp-knowledge-evidence-title{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}
.tp-knowledge-evidence-title strong{
  min-width:0;
  color:rgba(237,241,243,.92);
  font-size:9px;
  line-height:1.3;
  font-weight:850;
}
.tp-knowledge-evidence-page{
  flex:0 0 auto;
  padding:2px 5px;
  border-radius:999px;
  background:rgba(255,255,255,.06);
  color:rgba(211,217,221,.72);
  font-size:6.5px;
  font-weight:850;
}
.tp-knowledge-evidence-meta{
  display:block;
  margin-top:4px;
  color:rgba(188,197,202,.62);
  font-size:7.2px;
  line-height:1.25;
  font-weight:700;
}
.tp-knowledge-evidence-summary{
  margin:6px 0 0;
  color:rgba(213,220,224,.72);
  font-size:8.5px;
  line-height:1.4;
}
.tp-knowledge-evidence-note{
  margin:7px 0 0;
  color:rgba(174,182,188,.48);
  font-size:7px;
  line-height:1.35;
}
`;

function safeUrl(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

function compact(value: unknown, max = 210) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1);
  const split = clipped.lastIndexOf(' ');
  return `${(split > max * .7 ? clipped.slice(0, split) : clipped).trim()}…`;
}

export default function KnowledgeEvidenceSources({ sources }: Props) {
  const rows = Array.isArray(sources) ? sources.filter(Boolean).slice(0, 3) : [];
  if (!rows.length) return null;

  return (
    <section className="tp-knowledge-evidence" aria-label="Onaylı bilgi kaynakları">
      <style>{CSS}</style>
      <div className="tp-knowledge-evidence-head">
        <strong>Onaylı bilgi kaynakları</strong>
        <span>Bilgi Motoru · admin onaylı</span>
      </div>

      <div className="tp-knowledge-evidence-list">
        {rows.map((source) => {
          const url = safeUrl(source.sourceUrl);
          const content = (
            <>
              <div className="tp-knowledge-evidence-title">
                <strong>{source.documentTitle || source.sourceName}</strong>
                {source.sourcePage != null ? (
                  <span className="tp-knowledge-evidence-page">s. {source.sourcePage}</span>
                ) : null}
              </div>
              <span className="tp-knowledge-evidence-meta">
                {source.sourceName}{url ? ' · kaynağı aç ↗' : ''}
              </span>
              {source.summary ? (
                <p className="tp-knowledge-evidence-summary">{compact(source.summary)}</p>
              ) : null}
            </>
          );

          return url ? (
            <a
              key={source.claimId}
              className="tp-knowledge-evidence-item"
              href={url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {content}
            </a>
          ) : (
            <div key={source.claimId} className="tp-knowledge-evidence-item">
              {content}
            </div>
          );
        })}
      </div>

      <p className="tp-knowledge-evidence-note">
        Yalnızca Bilgi Motorunda yayınlanmış ve iddia düzeyinde admin onayı verilmiş kaynaklar burada gösterilir.
      </p>
    </section>
  );
}
