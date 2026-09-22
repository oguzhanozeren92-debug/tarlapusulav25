import type { OfficialVerification } from '../../../types';

const CSS = String.raw`
.tp-official-verification{
  margin-top:12px;
  padding:13px 14px;
  border:1px solid #dfe3e7;
  border-radius:14px;
  background:#fff;
  color:#111820;
}
.tp-official-verification-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.tp-official-verification-kicker{
  display:block;
  margin-bottom:3px;
  color:#68727d;
  font-size:9px;
  font-weight:900;
  letter-spacing:.1em;
}
.tp-official-verification-title{
  color:#111820;
  font-size:12px;
  font-weight:900;
  line-height:1.3;
}
.tp-official-verification-chip{
  flex:0 0 auto;
  padding:5px 8px;
  border:1px solid #d8dde1;
  border-radius:999px;
  background:#f4f5f6;
  color:#353e47;
  font-size:8px;
  font-weight:900;
}
.tp-official-verification-chip.is-verified{
  background:#111820;
  border-color:#111820;
  color:#fff;
}
.tp-official-verification p{
  margin:9px 0 0;
  color:#5f6974;
  font-size:11px;
  line-height:1.5;
}
.tp-official-verification-meta{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  margin-top:9px;
}
.tp-official-verification-meta span{
  padding:4px 7px;
  border-radius:999px;
  background:#f4f5f6;
  color:#66717b;
  font-size:8px;
  font-weight:800;
}
.tp-official-verification-proof{
  margin-top:10px;
  padding:10px 11px;
  border:1px solid #dfe3e7;
  border-radius:11px;
  background:#f8f9fa;
}
.tp-official-verification-proof strong{
  display:block;
  color:#111820;
  font-size:9px;
  font-weight:900;
}
.tp-official-verification-proof dl{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:5px 10px;
  margin:7px 0 0;
}
.tp-official-verification-proof dt,
.tp-official-verification-proof dd{
  margin:0;
  font-size:8.5px;
  line-height:1.35;
}
.tp-official-verification-proof dt{color:#68727d}
.tp-official-verification-proof dd{
  max-width:210px;
  overflow-wrap:anywhere;
  color:#28323a;
  text-align:right;
  font-weight:800;
}
.tp-official-verification-safety{
  margin-top:9px;
  padding:9px 10px;
  border-radius:10px;
  background:#f4f5f6;
  color:#47515a;
  font-size:9px;
  font-weight:750;
  line-height:1.45;
}
.tp-official-verification-safety strong{color:#111820}
.tp-official-verification-link{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  margin-top:10px;
  min-height:34px;
  padding:0 11px;
  border:1px solid #111820;
  border-radius:10px;
  background:#111820;
  color:#fff!important;
  text-decoration:none;
  font-size:9px;
  font-weight:900;
}
`;

function safeUrl(value: unknown) {
  const text = String(value ?? '').trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

function formatOfficialDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export default function OfficialVerificationCard({
  verification,
}: {
  verification?: OfficialVerification | null;
}) {
  if (!verification || verification.status === 'not_applicable') return null;

  const verified = verification.status === 'verified';
  const url = safeUrl(verification.sourceUrl);
  const blockedCount = Math.max(0, Number(verification.blockedRecommendationCount ?? 0));
  const matchedRecordCount = Math.max(0, Number(verification.matchedRecordCount ?? 0));
  const sourceObservedDate = formatOfficialDate(verification.sourceObservedAt);
  const verifiedDate = formatOfficialDate(verification.verifiedAt);
  const officialRecordId = String(verification.officialRecordId ?? '').trim() || null;
  const auditedSnapshot =
    verified && verification.verificationBasis === 'admin_reviewed_official_snapshot';
  const availabilityLabel =
    verification.sourceAvailability === 'reachable'
      ? 'Resmî site erişilebilir'
      : verification.sourceAvailability === 'unreachable'
        ? 'Resmî site şu an erişilemiyor'
        : null;
  const statusLabel = verified
    ? `${verification.source} doğrulandı`
    : verification.status === 'unavailable'
      ? 'Resmî doğrulama bekliyor'
      : `${verification.source} kontrolü gerekli`;

  return (
    <section className="tp-official-verification" aria-label="Resmî doğrulama">
      <style>{CSS}</style>
      <div className="tp-official-verification-head">
        <div>
          <span className="tp-official-verification-kicker">RESMÎ DOĞRULAMA</span>
          <strong className="tp-official-verification-title">
            {verification.sourceName || verification.source}
          </strong>
        </div>
        <span className={`tp-official-verification-chip${verified ? ' is-verified' : ''}`}>
          {statusLabel}
        </span>
      </div>

      <p>{verification.note}</p>

      {(verification.crop || verification.issue || availabilityLabel) && (
        <div className="tp-official-verification-meta">
          {verification.crop ? <span>Ürün: {verification.crop}</span> : null}
          {verification.issue ? <span>Ön değerlendirme: {verification.issue}</span> : null}
          {availabilityLabel ? <span>{availabilityLabel}</span> : null}
        </div>
      )}

      {auditedSnapshot ? (
        <div className="tp-official-verification-proof">
          <strong>Doğrulama izi</strong>
          <dl>
            {officialRecordId ? (
              <>
                <dt>Kayıt referansı</dt>
                <dd>{officialRecordId}</dd>
              </>
            ) : null}
            {sourceObservedDate ? (
              <>
                <dt>Resmî kaynak kontrolü</dt>
                <dd>{sourceObservedDate}</dd>
              </>
            ) : null}
            {verifiedDate ? (
              <>
                <dt>Pusula doğrulaması</dt>
                <dd>{verifiedDate}</dd>
              </>
            ) : null}
            {matchedRecordCount > 0 ? (
              <>
                <dt>Güncel eşleşme</dt>
                <dd>{matchedRecordCount} kayıt</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}

      {blockedCount > 0 ? (
        <div className="tp-official-verification-safety">
          <strong>{blockedCount} doğrulanmamış kimyasal öneri engellendi.</strong>{' '}
          BKU eşleşmesi bulunsa bile doz ve uygulama ayrıntısı güncel ruhsat etiketi doğrulanmadan gösterilmez.
        </div>
      ) : null}

      {verification.sourceAvailability === 'unreachable' ? (
        <div className="tp-official-verification-safety">
          Resmî kaynak geçici olarak erişilemiyor. Bu durum önerinin doğrulandığı anlamına gelmez; doğrulama beklemede kalır.
        </div>
      ) : null}

      {url ? (
        <a
          className="tp-official-verification-link"
          href={url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {verification.source} resmî kaynağı aç ↗
        </a>
      ) : null}
    </section>
  );
}
