import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import FieldMap from '../components/FieldMap';
import MobileWheelPicker from '../components/MobileWheelPicker';
import { TURKEY_CROP_PICKER_OPTIONS } from '../data/crops';
import { onboardingStyles } from '../styles/onboardingStyles';
import type { CropCycle, LocationOption, Screen } from '../types';
import './AddFieldMobile.css';

const PUSULA_BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const ADD_FIELD_BACKGROUNDS = [
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/backgrounds/add-field/add-field-step-1.webp',
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/backgrounds/add-field/add-field-step-2.webp',
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/backgrounds/add-field/add-field-step-3.webp',
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/backgrounds/add-field/add-field-step-4.webp',
] as const;

type Setter<T> = (value: T) => void;

type AddFieldScreenProps = {
  cmsRuntimeCss: string;
  setScreen: Setter<Screen>;
  fieldName: string;
  setFieldName: Setter<string>;
  selectedProvinceId: number | null;
  selectedDistrictId: number | null;
  provinceOptions: LocationOption[];
  districtOptions: LocationOption[];
  villageOptions: LocationOption[];
  fieldVillage: string;
  locationOptionsLoading: boolean;
  locationOptionsMessage: string;
  fieldAda: string;
  setFieldAda: Setter<string>;
  fieldParcel: string;
  setFieldParcel: Setter<string>;
  parcelLookupLoading: boolean;
  parcelLookupMessage: string;
  parcelGeometry: any | null;
  parcelLookupSource: string;
  parcelLocationMessage: string;
  fieldLatitude: number | null;
  fieldLongitude: number | null;
  fieldArea: string;
  setFieldArea: Setter<string>;
  fieldSeason: string;
  setFieldSeason: Setter<string>;
  fieldCrop: string;
  fieldCropCycle: CropCycle;
  fieldPlantingYear: string;
  setFieldPlantingYear: Setter<string>;
  fieldBearing: boolean;
  setFieldBearing: Setter<boolean>;
  fieldFormMessage: string;
  fieldFormLoading: boolean;
  getDistrictDisplayName: (name: string) => string;
  handleProvinceSelection: (value: string) => void;
  handleDistrictSelection: (value: string) => void;
  handleVillageSelection: (value: string) => void;
  handleParcelLookup: () => void | Promise<void>;
  openOfficialParcelQuery: () => void;
  handleFieldCropSelection: (value: string) => void;
  handleAddField: (event: FormEvent) => void | Promise<void>;
};

export default function AddFieldScreen(props: AddFieldScreenProps) {
  const {
    cmsRuntimeCss,setScreen,fieldName,setFieldName,selectedProvinceId,selectedDistrictId,
    provinceOptions,districtOptions,villageOptions,fieldVillage,locationOptionsLoading,locationOptionsMessage,
    fieldAda,setFieldAda,fieldParcel,setFieldParcel,parcelLookupLoading,parcelLookupMessage,parcelGeometry,
    parcelLookupSource,parcelLocationMessage,fieldLatitude,fieldLongitude,fieldArea,setFieldArea,fieldSeason,
    setFieldSeason,fieldCrop,fieldCropCycle,fieldPlantingYear,setFieldPlantingYear,fieldBearing,setFieldBearing,
    fieldFormMessage,fieldFormLoading,getDistrictDisplayName,handleProvinceSelection,handleDistrictSelection,
    handleVillageSelection,handleParcelLookup,openOfficialParcelQuery,handleFieldCropSelection,handleAddField,
  } = props;

  const [step,setStep] = useState(0);
  const [pendingLocation, setPendingLocation] = useState<'district' | 'village' | null>(null);
  const [districtOpenToken, setDistrictOpenToken] = useState(0);
  const [villageOpenToken, setVillageOpenToken] = useState(0);
  const fieldNameRef = useRef<HTMLInputElement>(null);
  const steps = ['Konum','Parsel','Ürün','Tarla Profili'];

  useEffect(() => {
    if (step !== 0 || locationOptionsLoading) return;
    if (pendingLocation === 'district' && selectedProvinceId && districtOptions.length) {
      setDistrictOpenToken((token) => token + 1);
      setPendingLocation(null);
    } else if (pendingLocation === 'village' && selectedDistrictId && villageOptions.length) {
      setVillageOpenToken((token) => token + 1);
      setPendingLocation(null);
    }
  }, [step, pendingLocation, locationOptionsLoading, selectedProvinceId, selectedDistrictId, districtOptions.length, villageOptions.length]);

  const canNext = useMemo(() => {
    if(step===0) return Boolean(selectedProvinceId && selectedDistrictId && fieldVillage);
    if(step===1) return Boolean(parcelGeometry || (fieldAda.trim() && fieldParcel.trim()));
    if(step===2) return Boolean(fieldCrop && fieldName.trim());
    return true;
  },[step,selectedProvinceId,selectedDistrictId,fieldVillage,parcelGeometry,fieldAda,fieldParcel,fieldCrop,fieldName]);

  const next = async () => {
    if(step===1 && !parcelGeometry && fieldAda.trim() && fieldParcel.trim()) {
      await handleParcelLookup();
      return;
    }
    if(step<3) setStep(step+1);
  };

  const C={
    bg:'#07110d',
    surface:'#0d1913',
    line:'rgba(205,177,102,.24)',
    gold:'#cdb26d',
    cream:'#f1ead8',
    muted:'#9b9b8e',
    green:'#74c98b',
  };

  return <>
    <style>{cmsRuntimeCss + onboardingStyles}</style>

    <style>{`
      body{margin:0;background:${C.bg}}
      .tp-chat-field{position:relative;min-height:100vh;overflow:hidden;color:${C.cream};font-family:Inter,system-ui,sans-serif;padding:18px 14px 40px;background:${C.bg}}
      .tp-addfield-backgrounds{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:${C.bg}}
      .tp-addfield-bg-layer{position:absolute;inset:-2px;opacity:0;transform:scale(1.025);background-repeat:no-repeat;background-size:cover;background-position:center;transition:opacity .58s ease,transform 1.05s ease;will-change:opacity,transform}
      .tp-addfield-bg-layer.active{opacity:1;transform:scale(1)}
      .tp-addfield-bg-layer.step-0{background-position:center 42%}
      .tp-addfield-bg-layer.step-1{background-position:center 35%}
      .tp-addfield-bg-layer.step-2{background-position:center 48%}
      .tp-addfield-bg-layer.step-3{background-position:center}
      .tp-addfield-bg-overlay{position:absolute;inset:0;background:radial-gradient(circle at 50% 14%,rgba(17,47,28,.06),transparent 34%),linear-gradient(180deg,rgba(2,8,5,.46),rgba(2,8,5,.58) 34%,rgba(2,8,5,.78)),linear-gradient(90deg,rgba(2,7,4,.32),rgba(2,7,4,.10) 50%,rgba(2,7,4,.32))}
      .tp-chat-shell{position:relative;z-index:2;width:min(100%,760px);margin:0 auto}
      .tp-chat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
      .tp-chat-top button{width:48px;height:48px;border-radius:15px;border:1px solid ${C.line};background:rgba(7,17,11,.78);color:${C.gold};font-size:19px;backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.20);cursor:pointer}
      .tp-chat-brand{text-align:center;text-shadow:0 2px 12px rgba(0,0,0,.55)}
      .tp-chat-brand strong{display:block;font-family:Georgia,serif;font-size:25px}
      .tp-chat-brand small{color:#c4c7bc;font-size:12px}
      .tp-progress{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0 24px}
      .tp-progress i{height:4px;border-radius:99px;background:rgba(209,220,211,.15);box-shadow:0 1px 8px rgba(0,0,0,.24)}
      .tp-progress i.on{background:${C.gold};box-shadow:0 0 12px rgba(205,178,109,.26)}
      .tp-bubble{display:grid;grid-template-columns:54px 1fr;gap:12px;align-items:flex-start;margin-bottom:17px}
      .tp-bot{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;border:1px solid ${C.line};background:rgba(4,12,7,.84);overflow:hidden;box-shadow:0 0 18px rgba(116,201,139,.12),0 10px 30px rgba(0,0,0,.24);backdrop-filter:blur(10px)}
      .tp-bot img{width:49px;height:49px;display:block;object-fit:contain;border-radius:50%;filter:drop-shadow(0 0 8px rgba(116,201,139,.22))}
      .tp-bubble-copy{border:1px solid ${C.line};border-radius:9px 22px 22px 22px;padding:17px 18px;background:rgba(7,18,12,.79);box-shadow:0 14px 38px rgba(0,0,0,.24);backdrop-filter:blur(14px)}
      .tp-bubble-copy small{color:${C.green};font-size:12px;font-weight:900;letter-spacing:.035em}
      .tp-bubble-copy h1{font-family:Georgia,serif;font-weight:500;font-size:29px;margin:5px 0 7px;text-shadow:0 2px 12px rgba(0,0,0,.38)}
      .tp-bubble-copy p{margin:0;color:#c1c5bc;line-height:1.55;font-size:14px}
      .tp-answer{margin-left:66px;border:1px solid rgba(205,177,102,.22);border-radius:20px;background:rgba(6,17,11,.82);padding:18px;box-shadow:0 16px 42px rgba(0,0,0,.25);backdrop-filter:blur(15px)}
      .tp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .tp-grid .full{grid-column:1/-1}
      .tp-answer label{display:grid;gap:8px;color:#d1d2ca;font-size:14px;line-height:1.2;font-weight:800}
      .tp-answer input,.tp-answer textarea{width:100%;min-height:50px;border:1px solid ${C.line};border-radius:13px;background:rgba(7,19,12,.92);color:${C.cream};padding:12px 14px;font-size:17px;font-weight:650;outline:none}
      .tp-answer input::placeholder,.tp-answer textarea::placeholder{color:#7f897f;opacity:1}
      .tp-answer input:focus,.tp-answer textarea:focus{border-color:${C.gold};box-shadow:0 0 0 3px rgba(205,178,109,.08)}
      .tp-answer label>button,.tp-answer label [role="button"]{min-height:50px!important;font-size:16px!important;font-weight:750!important}
      .tp-action-row{display:flex;justify-content:space-between;gap:10px;margin:18px 0 0 66px}
      .tp-action-row button{min-height:50px;border-radius:14px;padding:0 20px;font-size:15px;font-weight:850;cursor:pointer}
      .back{border:1px solid ${C.line};background:rgba(6,15,10,.72);color:#d0d0c6;backdrop-filter:blur(10px)}
      .next{border:1px solid rgba(116,201,139,.35);background:rgba(22,51,34,.93);color:#e7f4e9;flex:1;box-shadow:0 9px 22px rgba(0,0,0,.18)}
      .next:disabled,.tp-choice:disabled{opacity:.46;cursor:not-allowed}
      .tp-map-preview{height:250px;overflow:hidden;border-radius:16px;border:1px solid ${C.line};margin-top:12px}
      .tp-found{margin-top:10px;color:${C.green};font-size:13px;line-height:1.45}
      .tp-note{margin-top:10px;color:#b7bdb5;font-size:13px;line-height:1.5}
      .tp-choice-row{display:flex;gap:8px;flex-wrap:wrap}
      .tp-choice{border:1px solid ${C.line};background:rgba(11,27,17,.92);color:#e3ded0;border-radius:999px;padding:11px 15px;font-size:14px;font-weight:750;cursor:pointer}
      .tp-choice.active{border-color:${C.gold};color:${C.gold}}

      @media(max-width:520px){
        .tp-chat-field{padding:14px 11px 34px}
        .tp-addfield-bg-layer.step-0,.tp-addfield-bg-layer.step-1,.tp-addfield-bg-layer.step-2{background-position:center 42%}
        .tp-grid{grid-template-columns:1fr;gap:12px}
        .tp-grid .full{grid-column:auto}
        .tp-answer,.tp-action-row{margin-left:0}
        .tp-answer{padding:16px;background:rgba(5,16,10,.86)}
        .tp-bubble{grid-template-columns:48px 1fr;gap:9px}
        .tp-bot{width:48px;height:48px}
        .tp-bot img{width:43px;height:43px}
        .tp-bubble-copy{padding:14px 15px}
        .tp-bubble-copy h1{font-size:24px}
        .tp-bubble-copy p{font-size:13px}
        .tp-answer label{font-size:14px}
        .tp-answer input,.tp-answer textarea{min-height:50px;font-size:17px}
        .tp-answer label>button,.tp-answer label [role="button"]{min-height:50px!important;font-size:16px!important}
        .tp-action-row button{min-height:49px;font-size:14px}
      }
    `}</style>

    <div className="tp-chat-field">
      <div className="tp-addfield-backgrounds" aria-hidden="true">
        {ADD_FIELD_BACKGROUNDS.map((src,index)=>(
          <div
            key={src}
            className={`tp-addfield-bg-layer step-${index}${index===step?' active':''}`}
            style={{backgroundImage:`url("${src}")`}}
          />
        ))}
        <div className="tp-addfield-bg-overlay" />
      </div>

      <div className="tp-chat-shell">
        <header className="tp-chat-top">
          <button onClick={()=>setScreen('home')}>←</button>
          <div className="tp-chat-brand">
            <strong>TarlaPusula</strong>
            <small>Yeni tarlanı tanıyalım</small>
          </div>
          <div style={{width:48}} />
        </header>

        <div className="tp-progress">
          {steps.map((_,i)=><i key={i} className={i<=step?'on':''}/>)}
        </div>

        <div className="tp-bubble">
          <div className="tp-bot" aria-hidden="true">
            <img src={PUSULA_BODY_SRC} alt="" draggable={false} />
          </div>

          <div className="tp-bubble-copy">
            <small>PUSULA · {step+1}/{steps.length}</small>

            <h1>
              {step===0 && 'Tarlan nerede?'}
              {step===1 && 'Parselini birlikte bulalım.'}
              {step===2 && 'Bu tarlada ne yetiştiriyorsun?'}
              {step===3 && 'Son birkaç bilgiyle tarlan hazır.'}
            </h1>

            <p>
              {step===0 && 'Konumu seç. Sonraki adımda resmi ada/parsel sınırını bulmaya çalışacağım.'}
              {step===1 && 'Ada ve parseli girince sınırı haritada kontrol edebilirsin.'}
              {step===2 && 'Ürünü bilmem; uydu, iklim, rehber ve Pusula önerilerini kişiselleştirir.'}
              {step===3 && 'Bu bilgiler daha sonra Pusula AI tarafından tarla bağlamı olarak kullanılacak.'}
            </p>
          </div>
        </div>

        <section className="tp-answer">
          {step===0 && (
            <div className="tp-grid">
              <label>
                İl
                <MobileWheelPicker
                  title="İl seç"
                  value={selectedProvinceId ? String(selectedProvinceId):''}
                  onChange={(value) => { handleProvinceSelection(value); setPendingLocation('district'); }}
                  searchable
                  options={provinceOptions.map(x=>({
                    value:String(x.id),
                    label:x.name,
                  }))}
                />
              </label>

              <label>
                İlçe
                <MobileWheelPicker
                  title="İlçe seç"
                  value={selectedDistrictId ? String(selectedDistrictId):''}
                  onChange={(value) => { handleDistrictSelection(value); setPendingLocation('village'); }}
                  disabled={!selectedProvinceId || districtOptions.length === 0}
                  autoOpenToken={districtOpenToken}
                  searchable
                  options={districtOptions.map(x=>({
                    value:String(x.id),
                    label:getDistrictDisplayName(x.name),
                  }))}
                />
              </label>

              <label className="full">
                Köy / Mahalle
                <MobileWheelPicker
  title="Köy / mahalle seç"
  value={String(
    villageOptions.find(
      item => item.name === fieldVillage
    )?.id ?? ''
  )}
  onChange={(value) => { handleVillageSelection(value); setPendingLocation(null); setStep(1); }}
  disabled={!selectedDistrictId || villageOptions.length === 0}
  autoOpenToken={villageOpenToken}
  searchable
  options={villageOptions.map(x=>({
    value:String(x.id),
    label:x.name,
  }))}
/>
              </label>

              {(locationOptionsLoading || locationOptionsMessage) && (
                <div className="tp-note full">
                  {locationOptionsLoading
                    ? 'Konumlar yükleniyor…'
                    : locationOptionsMessage}
                </div>
              )}
            </div>
          )}

          {step===1 && (
            <>
              <div className="tp-grid">
                <label>
                  Ada
                  <input
                    value={fieldAda}
                    onChange={e=>setFieldAda(e.target.value)}
                    inputMode="numeric"
                    placeholder="Örn: 123"
                  />
                </label>

                <label>
                  Parsel
                  <input
                    value={fieldParcel}
                    onChange={e=>setFieldParcel(e.target.value)}
                    inputMode="numeric"
                    placeholder="Örn: 45"
                  />
                </label>
              </div>

              <button
                className="tp-choice"
                style={{marginTop:10}}
                type="button"
                disabled={parcelLookupLoading}
                onClick={()=>void handleParcelLookup()}
              >
                {parcelLookupLoading
                  ? 'Parsel aranıyor…'
                  : '⌖ Parseli Bul'}
              </button>

              {parcelLookupMessage && (
                <div className="tp-found">
                  {parcelLookupMessage}
                </div>
              )}

              {parcelGeometry && (
                <div className="tp-map-preview">
                  <FieldMap
                    initialCenter={[
                      fieldLongitude ?? 35.2433,
                      fieldLatitude ?? 38.9637,
                    ]}
                    initialZoom={17}
                    height={250}
                    parcelGeometry={parcelGeometry}
                    sections={[]}
                    drawEnabled={false}
                  />
                </div>
              )}

              <div className="tp-note">
                {parcelLookupSource
                  ? `Kaynak: ${parcelLookupSource}`
                  : parcelLocationMessage}
              </div>

              <button
                className="tp-choice"
                style={{marginTop:8}}
                type="button"
                onClick={openOfficialParcelQuery}
              >
                Resmî Parsel Sorgu ↗
              </button>
            </>
          )}

          {step===2 && (
            <div className="tp-grid">
              <label className="full">
                Ürün
                <MobileWheelPicker
                  title="Ürün seç"
                  value={fieldCrop}
                  onChange={(value) => {
                    handleFieldCropSelection(value);
                    if (fieldName.trim()) setStep(3);
                    else window.setTimeout(() => fieldNameRef.current?.focus(), 50);
                  }}
                  searchable
                  options={TURKEY_CROP_PICKER_OPTIONS}
                />
              </label>

              <label className="full">
                Tarla adı
                <input
                  ref={fieldNameRef}
                  value={fieldName}
                  onChange={e=>setFieldName(e.target.value)}
                  placeholder="Örn: Şeno Tarlası"
                />
              </label>
            </div>
          )}

          {step===3 && (
            <div className="tp-grid">
              <label>
                Alan (da)
                <input
                  value={fieldArea}
                  onChange={e=>setFieldArea(e.target.value)}
                  inputMode="decimal"
                />
              </label>

              <label>
                Sezon
                <input
                  value={fieldSeason}
                  onChange={e=>setFieldSeason(e.target.value)}
                  inputMode="numeric"
                />
              </label>

              {fieldCropCycle!=='annual' && (
                <>
                  <label>
                    Dikim yılı
                    <input
                      value={fieldPlantingYear}
                      onChange={e=>setFieldPlantingYear(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>

                  <label>
                    Ürün veriyor mu?
                    <div className="tp-choice-row">
                      <button
                        type="button"
                        className={`tp-choice ${fieldBearing?'active':''}`}
                        onClick={()=>setFieldBearing(true)}
                      >
                        Evet
                      </button>

                      <button
                        type="button"
                        className={`tp-choice ${!fieldBearing?'active':''}`}
                        onClick={()=>setFieldBearing(false)}
                      >
                        Hayır
                      </button>
                    </div>
                  </label>
                </>
              )}

              <div className="full tp-note">
                Toprak analizin varsa daha sonra tarla profilinden yükleyebilirsin.
                Yoksa Pusula tahmini SoilGrids profilini ayrı olarak kullanır.
              </div>

              {fieldFormMessage && (
                <div className="full tp-found">
                  {fieldFormMessage}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="tp-action-row">
          <button
            className="back"
            type="button"
            onClick={()=>step===0 ? setScreen('home') : setStep(step-1)}
          >
            Geri
          </button>

          {step===0 ? null : step<3 ? (
            <button
              className="next"
              type="button"
              disabled={!canNext || parcelLookupLoading}
              onClick={()=>void next()}
            >
              Devam →
            </button>
          ) : (
            <form style={{flex:1}} onSubmit={handleAddField}>
              <button
                className="next"
                style={{width:'100%'}}
                type="submit"
                disabled={fieldFormLoading}
              >
                {fieldFormLoading
                  ? 'Tarlan oluşturuluyor…'
                  : 'Tarlayı Oluştur ✓'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  </>;
}
