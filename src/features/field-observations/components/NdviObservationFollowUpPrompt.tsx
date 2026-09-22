import type { FieldObservationPoint } from '../types/fieldObservation';

type Props = {
  point: FieldObservationPoint;
  fieldName: string;
  onOpen: () => void;
  onLater: () => void;
};

const CSS = String.raw`
.tp-ndvi-follow-backdrop{
  position:fixed;
  inset:0;
  z-index:226;
  border:0;
  background:rgba(0,0,0,.46);
  backdrop-filter:blur(3px);
  -webkit-backdrop-filter:blur(3px);
}
.tp-ndvi-follow-card{
  position:fixed;
  z-index:227;
  left:50%;
  bottom:max(16px,env(safe-area-inset-bottom));
  width:min(90vw,430px);
  transform:translateX(-50%);
  padding:12px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:18px;
  background:#0b0b0c;
  box-shadow:0 22px 70px rgba(0,0,0,.54);
}
.tp-ndvi-follow-kicker{
  color:rgba(255,255,255,.56);
  font-size:7px;
  font-weight:900;
  letter-spacing:.085em;
  text-transform:uppercase;
}
.tp-ndvi-follow-card h3{
  margin:5px 0 0;
  color:#fff;
  font-size:12px;
}
.tp-ndvi-follow-card p{
  margin:6px 0 0;
  color:rgba(255,255,255,.68);
  font-size:9px;
  line-height:1.45;
}
.tp-ndvi-follow-actions{
  display:flex;
  justify-content:flex-end;
  gap:7px;
  margin-top:11px;
}
.tp-ndvi-follow-actions button{
  min-height:34px;
  padding:0 11px;
  border-radius:10px;
  font-size:8px;
  font-weight:850;
  cursor:pointer;
}
.tp-ndvi-follow-later{
  border:1px solid rgba(255,255,255,.10);
  background:transparent;
  color:rgba(255,255,255,.68);
}
.tp-ndvi-follow-open{
  border:1px solid rgba(255,255,255,.16);
  background:#f4f4f5;
  color:#111214;
}
`;

function areaLabel(value: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return 'Takip noktası';
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

export default function NdviObservationFollowUpPrompt({
  point,
  fieldName,
  onOpen,
  onLater,
}: Props) {
  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className="tp-ndvi-follow-backdrop"
        aria-label="Takip hatırlatmasını kapat"
        onClick={onLater}
      />

      <section className="tp-ndvi-follow-card" role="dialog" aria-modal="true">
        <div className="tp-ndvi-follow-kicker">PUSULA · NDVI SAHA KONTROLÜ</div>
        <h3>{areaLabel(point.direction)} bölgesini yerinde kontrol et</h3>
        <p>
          {fieldName} içinde bu bölge diğer bölgelere göre daha zayıf bitki gelişimi gösteriyor.
          Aynı noktadan fotoğraf eklersen Pusula sonraki uydu görüntülerinde gelişimi karşılaştırabilir.
        </p>

        <div className="tp-ndvi-follow-actions">
          <button type="button" className="tp-ndvi-follow-later" onClick={onLater}>
            Sonra hatırlat
          </button>
          <button type="button" className="tp-ndvi-follow-open" onClick={onOpen}>
            Haritada göster · Fotoğraf ekle
          </button>
        </div>
      </section>
    </>
  );
}
