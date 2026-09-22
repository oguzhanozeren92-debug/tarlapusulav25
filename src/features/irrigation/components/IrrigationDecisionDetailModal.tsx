import { useEffect } from 'react';
import type { IrrigationDecisionResult } from '../types/irrigationDecision';
import type { IrrigationWhatIfResult } from '../services/irrigationWhatIf.service';

const IRRIGATION_DECISION_DETAIL_MODAL_CSS = String.raw`
.tp-irrigation-detail-backdrop{
  position:fixed;
  inset:0;
  z-index:2200;
  display:grid;
  place-items:center;
  padding:18px;
  background:rgba(0,5,3,.72);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
}

.tp-irrigation-detail-modal{
  width:min(560px,100%);
  max-height:min(760px,88vh);
  overflow:auto;
  border:1px solid rgba(34,197,94,.28);
  border-radius:24px;
  background:
    radial-gradient(circle at 16% 0%,rgba(6,182,212,.10),transparent 36%),
    linear-gradient(180deg,rgba(6,19,8,.98),rgba(2,8,4,.99));
  box-shadow:
    0 28px 80px rgba(0,0,0,.58),
    0 0 32px rgba(34,197,94,.08),
    inset 0 1px 0 rgba(255,255,255,.035);
  color:#eef7f0;
  padding:20px;
}

.tp-irrigation-detail-head{
  display:grid;
  grid-template-columns:48px minmax(0,1fr) 36px;
  gap:12px;
  align-items:start;
}

.tp-irrigation-detail-mark{
  width:48px;
  height:48px;
  border-radius:16px;
  display:grid;
  place-items:center;
  border:1px solid rgba(6,182,212,.42);
  background:rgba(3,27,28,.78);
  box-shadow:inset 0 0 20px rgba(6,182,212,.08),0 0 18px rgba(6,182,212,.10);
  font-size:23px;
}

.tp-irrigation-detail-head small,
.tp-irrigation-detail-pusula small,
.tp-irrigation-detail-grid small,
.tp-irrigation-detail-status small,
.tp-irrigation-detail-rain small,
.tp-irrigation-detail-reasons>small{
  color:#36dbe7;
  font-size:9px;
  line-height:1.1;
  font-weight:850;
  letter-spacing:.10em;
}

.tp-irrigation-detail-head h3{
  margin:4px 0 3px;
  color:#f3f8f4;
  font-size:21px;
  line-height:1.15;
}

.tp-irrigation-detail-head p{
  margin:0;
  color:#819188;
  font-size:11px;
}

.tp-irrigation-detail-close{
  width:34px;
  height:34px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.10);
  border-radius:12px;
  background:rgba(255,255,255,.025);
  color:#b8c4bc;
  font-size:24px;
  line-height:1;
  cursor:pointer;
}

.tp-irrigation-detail-pusula{
  margin-top:18px;
  padding:15px;
  border:1px solid rgba(34,197,94,.22);
  border-radius:18px;
  background:rgba(5,31,15,.55);
}

.tp-irrigation-detail-pusula small{
  color:#45dc82;
}

.tp-irrigation-detail-pusula strong{
  display:block;
  margin-top:7px;
  color:#edf5ef;
  font-size:14px;
  line-height:1.45;
}

.tp-irrigation-detail-pusula p{
  margin:8px 0 0;
  color:#a0afa5;
  font-size:11px;
  line-height:1.45;
}

.tp-irrigation-detail-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
  margin-top:12px;
}

.tp-irrigation-detail-grid article{
  min-width:0;
  padding:14px;
  border:1px solid rgba(30,58,36,.96);
  border-radius:17px;
  background:rgba(4,15,8,.78);
}

.tp-irrigation-detail-grid article>span{
  display:block;
  margin-top:8px;
  color:#8d9c92;
  font-size:10px;
}

.tp-irrigation-detail-grid article>strong{
  display:block;
  margin-top:3px;
  color:#eef6f0;
  font-size:20px;
}

.tp-irrigation-detail-grid article>em{
  display:block;
  margin-top:7px;
  color:#77877d;
  font-size:9.5px;
  line-height:1.35;
  font-style:normal;
}

.tp-irrigation-detail-status{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-top:10px;
  padding:13px 14px;
  border:1px solid rgba(6,182,212,.20);
  border-radius:16px;
  background:rgba(3,21,22,.60);
}

.tp-irrigation-detail-status strong{
  display:block;
  margin-top:4px;
  font-size:14px;
}

.tp-irrigation-detail-status>span{
  min-width:46px;
  height:32px;
  padding:0 10px;
  display:grid;
  place-items:center;
  border-radius:999px;
  border:1px solid rgba(6,182,212,.32);
  background:rgba(6,182,212,.08);
  color:#59e3eb;
  font-weight:850;
  font-size:12px;
}

.tp-irrigation-detail-whatif{
  margin-top:10px;
  padding:13px 14px;
  border:1px solid rgba(255,255,255,.10);
  border-radius:16px;
  background:rgba(255,255,255,.025);
}
.tp-irrigation-detail-whatif>small{
  color:#36dbe7;
  font-size:9px;
  font-weight:850;
  letter-spacing:.10em;
}
.tp-irrigation-detail-whatif>strong{
  display:block;
  margin-top:5px;
  font-size:13px;
}
.tp-irrigation-detail-whatif>div{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-top:10px;
}
.tp-irrigation-detail-whatif article{
  padding:10px;
  border-radius:12px;
  background:rgba(0,0,0,.18);
}
.tp-irrigation-detail-whatif span,
.tp-irrigation-detail-whatif em{
  display:block;
  color:#8d9c92;
  font-size:9px;
  font-style:normal;
}
.tp-irrigation-detail-whatif b{
  display:block;
  margin:4px 0;
  font-size:17px;
}
.tp-irrigation-detail-whatif p{
  margin:9px 0 0;
  color:#77877d;
  font-size:9px;
  line-height:1.4;
}

.tp-irrigation-detail-balance{
  margin-top:12px;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.025)
}
.tp-irrigation-detail-balance>small,.tp-irrigation-detail-model>small,.tp-irrigation-detail-forecast>small{
  color:#36dbe7;font-size:9px;font-weight:850;letter-spacing:.10em
}
.tp-irrigation-detail-balance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
.tp-irrigation-detail-balance-grid article{padding:10px;border-radius:12px;background:rgba(0,0,0,.18)}
.tp-irrigation-detail-balance-grid span{display:block;color:#7f8d84;font-size:9px;line-height:1.3}
.tp-irrigation-detail-balance-grid strong{display:block;margin-top:4px;color:#f2f7f3;font-size:15px}
.tp-irrigation-detail-forecast{margin-top:10px;padding:13px 14px;border:1px solid rgba(6,182,212,.16);border-radius:16px;background:rgba(3,21,22,.38)}
.tp-irrigation-detail-forecast-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:10px}
.tp-irrigation-detail-forecast-list article{min-width:0;padding:8px 5px;text-align:center;border-radius:11px;background:rgba(0,0,0,.18)}
.tp-irrigation-detail-forecast-list span,.tp-irrigation-detail-forecast-list em{display:block;color:#829188;font-size:8px;font-style:normal}
.tp-irrigation-detail-forecast-list strong{display:block;margin:4px 0;color:#e9f4ed;font-size:11px}
.tp-irrigation-detail-model{margin-top:10px;padding:13px 14px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.02)}
.tp-irrigation-detail-model-row{display:flex;justify-content:space-between;gap:12px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}
.tp-irrigation-detail-model-row:first-of-type{border-top:0;padding-top:0}
.tp-irrigation-detail-model-row span{color:#8d9c92;font-size:10px}
.tp-irrigation-detail-model-row strong{color:#eaf3ec;font-size:10px;text-align:right}
.tp-irrigation-detail-model p{margin:9px 0 0;color:#6f7d74;font-size:9px;line-height:1.4}
.tp-irrigation-detail-rain{
  display:flex;
  gap:10px;
  align-items:center;
  margin-top:10px;
  padding:12px 14px;
  border:1px solid rgba(6,182,212,.18);
  border-radius:16px;
  background:rgba(4,24,24,.48);
}

.tp-irrigation-detail-rain>span{
  font-size:21px;
}

.tp-irrigation-detail-rain strong{
  display:block;
  margin-top:3px;
  color:#e7f5f5;
  font-size:12px;
}

.tp-irrigation-detail-reasons{
  margin-top:14px;
  padding-top:13px;
  border-top:1px solid rgba(255,255,255,.06);
}

.tp-irrigation-detail-reasons>small{
  color:#45dc82;
}

.tp-irrigation-detail-reasons ul{
  margin:9px 0 0;
  padding:0;
  list-style:none;
  display:grid;
  gap:7px;
}

.tp-irrigation-detail-reasons li{
  position:relative;
  padding-left:15px;
  color:#a6b4aa;
  font-size:10.5px;
  line-height:1.4;
}

.tp-irrigation-detail-reasons li::before{
  content:'';
  position:absolute;
  left:0;
  top:.55em;
  width:6px;
  height:6px;
  border-radius:50%;
  background:#22c55e;
  box-shadow:0 0 10px rgba(34,197,94,.44);
}

.tp-irrigation-detail-note{
  margin:14px 0 0;
  padding:11px 12px;
  border-radius:14px;
  background:rgba(255,255,255,.025);
  color:#6f7d74;
  font-size:9.5px;
  line-height:1.45;
}

.tp-irrigation-detail-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px;
  margin-top:15px;
}

.tp-irrigation-detail-actions button{
  min-height:43px;
  border-radius:14px;
  font-weight:800;
  font-size:11px;
  cursor:pointer;
}

.tp-irrigation-detail-secondary{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.035);
  color:#aab7ae;
}

.tp-irrigation-detail-primary{
  border:1px solid rgba(6,182,212,.35);
  background:linear-gradient(180deg,rgba(6,71,76,.92),rgba(3,41,44,.96));
  color:#ddfbfd;
  box-shadow:0 0 20px rgba(6,182,212,.08);
}
.tp-irrigation-detail-record{
  grid-column:1/-1;
  border:1px solid rgba(34,197,94,.32);
  background:rgba(14,85,45,.35);
  color:#d7fbe1;
}

@media (max-width:560px){
  .tp-irrigation-detail-backdrop{
    align-items:end;
    padding:10px;
  }

  .tp-irrigation-detail-modal{
    max-height:88vh;
    border-radius:22px 22px 16px 16px;
    padding:16px;
  }

  .tp-irrigation-detail-grid{
    grid-template-columns:1fr;
  }
}

`;

type Props = {
  open: boolean;
  decision: IrrigationDecisionResult | null | undefined;
  fallbackFieldName?: string;
  onClose: () => void;
  onOpenWeather: () => void;
  onAddIrrigationRecord?: () => void;
  whatIf?: IrrigationWhatIfResult | null;
};

function formatMm(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Veri yok';
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)} mm` : 'Veri yok';
}

function formatDate(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const parsed = new Date(`${text}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return text;

  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
  }).format(parsed);
}

function irrigationMethodLabel(value: unknown) {
  const labels: Record<string, string> = {
    trickle: 'Damlama',
    sprinkler: 'Yağmurlama',
    basin: 'Tava / göllendirme',
    border: 'Şerit / salma',
    furrow_every_narrow: 'Karık · her karık, dar yatak',
    furrow_every_wide: 'Karık · her karık, geniş yatak',
    furrow_alternating: 'Karık · dönüşümlü',
    unknown: 'Yöntem belirtilmedi',
  };
  return labels[String(value ?? '')] ?? 'Yöntem belirtilmedi';
}

function riskLabel(value: unknown) {
  const risk = String(value ?? '').trim();

  if (risk === 'high') return 'Yüksek';
  if (risk === 'elevated') return 'Yükseliyor';
  if (risk === 'normal') return 'Düşük';
  return 'Hesaplanamadı';
}

export default function IrrigationDecisionDetailModal({
  open,
  decision,
  fallbackFieldName,
  onClose,
  onOpenWeather,
  onAddIrrigationRecord,
  whatIf,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !decision) return null;

  const stress = decision.rainfedStress;
  const fieldName =
    String(decision.fieldName ?? fallbackFieldName ?? 'Seçili tarla').trim() ||
    'Seçili tarla';

  const reasons = Array.isArray(decision.reasons)
    ? decision.reasons.filter(Boolean).slice(0, 5)
    : [];

  const nextRain = stress?.nextMeaningfulRain ?? null;
  const balance = decision.waterBalance;
  const forecast = Array.isArray(decision.forecast) ? decision.forecast.slice(0, 5) : [];
  const model = decision.modelEvidence;
  const seasonModel = decision.seasonModelEvidence;
  const validation = model?.promotionGate?.validationHistory;

  const modelAgreementLabel =
    model?.agreement === 'supportive' ? 'Production ile uyumlu' :
    model?.agreement === 'divergent' ? 'Ayrışıyor · saha kontrolü gerekli' :
    model?.status === 'ready' ? 'Karşılaştırma için veri eksik' :
    model?.status === 'not_applicable' ? 'Uygulanmıyor' :
    'Kanıt bekleniyor';

  return (
    <>
      <style>{IRRIGATION_DECISION_DETAIL_MODAL_CSS}</style>
      <div
        className="tp-irrigation-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="tp-irrigation-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-irrigation-detail-title"
      >
        <div className="tp-irrigation-detail-head">
          <div className="tp-irrigation-detail-mark" aria-hidden="true">
            <span>💧</span>
          </div>

          <div>
            <small>SU & YAĞIŞ ANALİZİ</small>
            <h3 id="tp-irrigation-detail-title">
              {decision.display?.headline || 'Yağış Dengesi'}
            </h3>
            <p>{fieldName}{decision.cropName ? ` · ${decision.cropName}` : ''}</p>
          </div>

          <button
            type="button"
            className="tp-irrigation-detail-close"
            onClick={onClose}
            aria-label="Pencereyi kapat"
          >
            ×
          </button>
        </div>

        <div className="tp-irrigation-detail-pusula">
          <small>PUSULA YORUMU</small>
          <strong>{decision.display?.summary || 'Su ve yağış dengesi değerlendiriliyor.'}</strong>
          {decision.display?.action ? <p>{decision.display.action}</p> : null}
        </div>

        {decision.currentKc != null && Number.isFinite(decision.currentKc) ? (
          <p className="tp-irrigation-detail-note">
            Bitkinin su ihtiyacı hesabında bugün kullanılan oran: {decision.currentKc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Bu, tarlada ölçülen su miktarı değildir.
          </p>
        ) : (
          <p className="tp-irrigation-detail-note">
            Bitkinin su ihtiyacı henüz hesaplanamadı. Tarlanın ürün, gelişim ve ağaç örtüsü bilgilerini kontrol et.
          </p>
        )}

        {decision.irrigationStatus !== 'rainfed' ? (
          <div className="tp-irrigation-detail-balance">
            <small>SULAMA DURUMU</small>
            <div className="tp-irrigation-detail-model-row">
              <span>Sulama yöntemi</span>
              <strong>{irrigationMethodLabel(decision.irrigationMethod)}</strong>
            </div>
            <div className="tp-irrigation-detail-balance-grid">
              <article><span>Mevcut su açığı</span><strong>{formatMm(balance?.currentDeficitMm)}</strong></article>
              <article><span>5 gün sonra</span><strong>{formatMm(balance?.projected5DayDeficitMm)}</strong></article>
              <article><span>NET su ihtiyacı</span><strong>{formatMm(decision.recommendation?.netWaterMm)}</strong></article>
            </div>
            <p className="tp-irrigation-detail-note">
              {balance?.lastIrrigationDate
                ? `Son kayıtlı sulama: ${formatDate(balance.lastIrrigationDate)}`
                : 'Kayıtlı sulama başlangıç noktası yoksa kesin su açığı üretilmez.'}
            </p>
          </div>
        ) : null}

        {forecast.length === 5 ? (
          <div className="tp-irrigation-detail-forecast">
            <small>5 GÜNLÜK SU DENGESİ</small>
            <div className="tp-irrigation-detail-forecast-list">
              {forecast.map((day) => (
                <article key={day.date}>
                  <span>{formatDate(day.date)}</span>
                  <strong>{formatMm(day.estimatedDeficitMm)}</strong>
                  <em>Yağış {formatMm(day.precipitationMm)}</em>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="tp-irrigation-detail-note">
            5 günlük su dengesi için tüm günlerde gerçek ET0 ve yağış verisi gerekli. Eksik gün varken sıfır kabul edilmez.
          </p>
        )}

        <div className="tp-irrigation-detail-grid">
          <article>
            <small>SON 7 GÜN</small>
            <span>Toplam yağış</span>
            <strong>{formatMm(stress?.past7DayPrecipitationMm)}</strong>
            <em>
              {stress?.past7DayCropWaterUseMm != null
                ? `Bitkinin bugünkü durumuna göre tahmini tüketim ${formatMm(stress.past7DayCropWaterUseMm)}`
                : 'Ürün bazlı tüketim için veri eksik'}
            </em>
          </article>

          <article>
            <small>ÖNÜMÜZDEKİ 5 GÜN</small>
            <span>Beklenen yağış</span>
            <strong>{formatMm(stress?.forecast5DayPrecipitationMm)}</strong>
            <em>
              {stress?.forecast5DayCropWaterUseMm != null
                ? `Tahmini bitki tüketimi ${formatMm(stress.forecast5DayCropWaterUseMm)}`
                : 'Ürün bazlı tüketim için veri eksik'}
            </em>
          </article>
        </div>

        <div className="tp-irrigation-detail-status">
          <div>
            <small>İKLİM-TEMELLİ STRES RİSKİ</small>
            <strong>{riskLabel(stress?.riskLevel)}</strong>
          </div>

          {stress?.pressureRatio != null ? (
            <span>%{Math.round(stress.pressureRatio * 100)}</span>
          ) : (
            <span>—</span>
          )}
        </div>

        {nextRain ? (
          <div className="tp-irrigation-detail-rain">
            <span aria-hidden="true">☔</span>
            <div>
              <small>ANLAMLI YAĞIŞ TAHMİNİ</small>
              <strong>
                {formatDate(nextRain.date)} · {formatMm(nextRain.precipitationMm)}
              </strong>
            </div>
          </div>
        ) : null}

        <div className="tp-irrigation-detail-whatif">
          <small>2 GÜNLÜK SENARYO</small>
          <strong>Bugün sularsam / 2 gün beklersem</strong>
          {whatIf?.status === 'ready' ? (
            <>
              <div>
                <article>
                  <span>Bugün sularsam</span>
                  <b>{formatMm(whatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.irrigateToday)}</b>
                  <em>2 gün sonraki tahmini su açığı</em>
                </article>
                <article>
                  <span>2 gün beklersem</span>
                  <b>{formatMm(whatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.waitTwoDays)}</b>
                  <em>2 gün sonraki tahmini su açığı</em>
                </article>
              </div>
              <p>Bugün senaryosunda {formatMm(whatIf.appliedNetWaterMm)} NET su kullanılır. Değer production Sulama Motoru'ndan gelir.</p>
            </>
          ) : (
            <p>
              Senaryo henüz hesaplanamıyor. Eksik gerçek veri: {whatIf?.status === 'blocked' && whatIf.missing.length
                ? whatIf.missing.join(', ')
                : 'sulama motoru sonucu'}. Veri tamamlanınca karşılaştırma otomatik görünür.
            </p>
          )}
        </div>

        {decision.irrigationStatus !== 'rainfed' ? (
          <div className="tp-irrigation-detail-model">
            <small>MODEL DOĞRULAMASI</small>
            <div className="tp-irrigation-detail-model-row">
              <span>pyfao56 · Dual-Kc</span>
              <strong>{modelAgreementLabel}</strong>
            </div>
            <div className="tp-irrigation-detail-model-row">
              <span>AquaCrop · sezon bağlamı</span>
              <strong>{seasonModel?.status === 'ready' ? 'Kanıt hazır' : seasonModel?.status === 'blocked' ? 'Gerçek veri eksik' : 'Kanıt bekleniyor'}</strong>
            </div>
            {validation ? (
              <div className="tp-irrigation-detail-model-row">
                <span>Saha doğrulama geçmişi</span>
                <strong>{validation.consecutiveSupportiveRuns}/{validation.requiredSupportiveRuns} gün · {validation.hasVerifiedSoilWaterEvidence ? 'nem ölçümü var' : 'nem ölçümü gerekli'}</strong>
              </div>
            ) : null}
            <p>Bu modeller sulama emri vermez. Production kararını bağımsız kanıtlarla kontrol eder; doğrulama eksikse değer uydurulmaz.</p>
          </div>
        ) : null}

        {reasons.length ? (
          <div className="tp-irrigation-detail-reasons">
            <small>NEDEN BUNU SÖYLÜYORUM?</small>
            <ul>
              {reasons.map((reason, index) => (
                <li key={`${index}-${reason}`}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="tp-irrigation-detail-note">
          Bu değerlendirme gerçek toprak nemi ölçümü değildir. Susuz tarlada sulama miktarı önermez; yağış, hava koşulları, bitkinin gelişimi ve toprak bilgileriyle erken uyarı üretir.
        </p>

        <p className="tp-irrigation-detail-note">
          Son 7 günün tahmini tüketimi bitkinin bugünkü gelişimine göre hesaplandı; geçmiş günlerdeki gelişimi ayrı ayrı ölçülmedi.
        </p>

        {onAddIrrigationRecord && decision.irrigationStatus !== 'rainfed' &&
          !decision.waterBalance?.lastIrrigationDate ? (
          <p className="tp-irrigation-detail-note">
            Bu tarla için kayıtlı sulama yok. Sulama yaptıysan tarihini ve verdiğin su miktarını kaydet.
          </p>
        ) : null}

        <div className="tp-irrigation-detail-actions">
          <button
            type="button"
            className="tp-irrigation-detail-secondary"
            onClick={onClose}
          >
            Kapat
          </button>

          <button
            type="button"
            className="tp-irrigation-detail-primary"
            onClick={onOpenWeather}
          >
            Hava detaylarını aç
          </button>

          {onAddIrrigationRecord && decision.irrigationStatus !== 'rainfed' ? (
            <button
              type="button"
              className="tp-irrigation-detail-record"
              onClick={onAddIrrigationRecord}
            >
              Sulama kaydı ekle
            </button>
          ) : null}
        </div>
        </section>
      </div>
    </>
  );
}
