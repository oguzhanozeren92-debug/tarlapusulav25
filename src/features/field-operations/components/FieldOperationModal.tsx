import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import {
  createFieldOperation,
  saveFieldPlantingManagement,
} from '../services/fieldOperation.service';
import {
  FIELD_OPERATION_OPTIONS,
  type FieldOperation,
  type FieldOperationType,
} from '../types/fieldOperation';

type Props = {
  open: boolean;
  fieldId: string | null;
  fieldName: string;
  initialType?: FieldOperationType;
  initialDate?: string;
  onClose: () => void;
  onSaved?: (operation: FieldOperation) => void;
};

const CSS = String.raw`
.tp-field-operation-portal{
  position:fixed!important;inset:0!important;z-index:2147483625!important;
  width:100vw!important;height:100dvh!important;display:flex!important;
  align-items:center!important;justify-content:center!important;
  padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))!important;
  box-sizing:border-box!important;isolation:isolate!important
}
.tp-field-operation-backdrop{
  position:absolute!important;inset:0!important;border:0!important;
  background:rgba(0,0,0,.64)!important;backdrop-filter:blur(5px)!important;
  -webkit-backdrop-filter:blur(5px)!important
}
.tp-field-operation-sheet{
  position:relative!important;z-index:1!important;width:min(94vw,540px)!important;
  max-height:min(90dvh,780px)!important;display:flex!important;flex-direction:column!important;
  overflow:hidden!important;border:1px solid rgba(34,197,94,.16)!important;
  border-radius:22px!important;background:radial-gradient(circle at 8% 0%,rgba(34,197,94,.08),transparent 30%),rgba(3,12,7,.99)!important;
  box-shadow:0 28px 90px rgba(0,0,0,.68)!important
}
.tp-field-operation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid rgba(255,255,255,.055)}
.tp-field-operation-kicker{color:#86efac;font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
.tp-field-operation-head h3{margin:4px 0 0;color:#f0f7f2;font-size:15px;line-height:1.1}
.tp-field-operation-head p{margin:5px 0 0;color:rgba(207,222,211,.58);font-size:8px;line-height:1.4}
.tp-field-operation-close{width:32px;height:32px;flex:0 0 32px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(255,255,255,.02);color:#dce8de;font-size:19px;cursor:pointer}
.tp-field-operation-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 14px 14px}
.tp-field-operation-label{display:block;margin:0 0 6px;color:rgba(222,232,224,.76);font-size:7.5px;font-weight:850}
.tp-field-operation-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.tp-field-operation-type{min-height:62px;display:grid;place-items:center;align-content:center;gap:5px;padding:6px;border:1px solid rgba(105,139,114,.10);border-radius:12px;background:rgba(255,255,255,.012);color:rgba(212,225,215,.66);cursor:pointer}
.tp-field-operation-type span:first-child{font-size:18px;line-height:1}
.tp-field-operation-type span:last-child{font-size:7px;font-weight:850;text-align:center}
.tp-field-operation-type.active{border-color:rgba(34,197,94,.26);background:rgba(34,197,94,.065);color:#d7fbe1;box-shadow:0 0 18px rgba(34,197,94,.06)}
.tp-field-operation-divider{height:1px;margin:12px 0;background:rgba(255,255,255,.05)}
.tp-field-operation-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
.tp-field-operation-field{display:grid;gap:5px;min-width:0}
.tp-field-operation-field.full{grid-column:1/-1}
.tp-field-operation-field label{color:rgba(215,228,218,.67);font-size:7px;font-weight:850}
.tp-field-operation-field input,.tp-field-operation-field select,.tp-field-operation-field textarea{
  width:100%;min-height:40px;box-sizing:border-box;border:1px solid rgba(105,139,114,.12);border-radius:11px;background:rgba(255,255,255,.015);color:#edf5ef;padding:0 10px;outline:none;font:inherit;font-size:9px
}
.tp-field-operation-field textarea{min-height:74px;padding:9px 10px;resize:vertical;line-height:1.4}
.tp-field-operation-field input:focus,.tp-field-operation-field select:focus,.tp-field-operation-field textarea:focus{border-color:rgba(34,197,94,.30);box-shadow:0 0 0 2px rgba(34,197,94,.04)}
.tp-field-operation-date-shortcuts{display:flex;gap:5px;margin-top:6px}
.tp-field-operation-date-shortcuts button{min-height:27px;padding:0 8px;border:1px solid rgba(105,139,114,.10);border-radius:999px;background:rgba(255,255,255,.012);color:rgba(201,216,204,.65);font-size:6.7px;font-weight:850;cursor:pointer}
.tp-field-operation-cost-note{margin-top:5px;color:rgba(134,239,172,.54);font-size:6.5px;line-height:1.35}
.tp-planting-details{grid-column:1/-1;display:grid;gap:9px;padding:10px;border:1px solid rgba(105,139,114,.11);border-radius:12px;background:rgba(255,255,255,.012)}
.tp-planting-details-head{display:grid;gap:3px}
.tp-planting-details-head strong{font-size:8px;color:rgba(224,235,226,.82)}
.tp-planting-details-head small{font-size:6.6px;line-height:1.4;color:rgba(190,207,194,.54)}
.tp-planting-details-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.tp-planting-details-note{font-size:6.5px;line-height:1.4;color:rgba(190,207,194,.52)}
.tp-irrigation-mode-wrap{grid-column:1/-1;display:grid;gap:7px}
.tp-irrigation-mode-title{color:rgba(215,228,218,.72);font-size:7px;font-weight:850}
.tp-irrigation-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.tp-irrigation-mode{min-height:48px;display:grid;gap:3px;align-content:center;padding:7px 9px;border:1px solid rgba(6,182,212,.11);border-radius:11px;background:rgba(6,182,212,.018);color:rgba(202,221,225,.66);text-align:left;cursor:pointer}
.tp-irrigation-mode strong{font-size:7.6px;color:inherit}
.tp-irrigation-mode small{font-size:6.3px;line-height:1.3;color:rgba(190,207,211,.52)}
.tp-irrigation-mode.active{border-color:rgba(6,182,212,.28);background:rgba(6,182,212,.065);color:#cffafe;box-shadow:0 0 18px rgba(6,182,212,.05)}
.tp-irrigation-calc{grid-column:1/-1;margin-top:1px;padding:8px 9px;border:1px solid rgba(34,197,94,.12);border-radius:10px;background:rgba(34,197,94,.03);color:rgba(197,224,204,.69);font-size:7px;line-height:1.42}
.tp-irrigation-calc strong{color:#bbf7d0}
.tp-irrigation-warning{grid-column:1/-1;padding:8px 9px;border:1px solid rgba(245,158,11,.15);border-radius:10px;background:rgba(245,158,11,.035);color:#fde68a;font-size:7px;line-height:1.42}
.tp-field-operation-error{margin-top:10px;padding:8px 9px;border:1px solid rgba(239,68,68,.16);border-radius:10px;background:rgba(239,68,68,.04);color:#fca5a5;font-size:7.5px;line-height:1.4}
.tp-field-operation-success{margin-top:10px;padding:8px 9px;border:1px solid rgba(34,197,94,.16);border-radius:10px;background:rgba(34,197,94,.045);color:#bbf7d0;font-size:7.5px;line-height:1.4}
.tp-field-operation-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:12px}
.tp-field-operation-actions button{min-height:36px;padding:0 12px;border-radius:10px;font-size:8px;font-weight:900;cursor:pointer}
.tp-field-operation-cancel{border:1px solid rgba(255,255,255,.06);background:transparent;color:rgba(211,225,214,.65)}
.tp-field-operation-save{border:1px solid rgba(34,197,94,.18);background:rgba(34,197,94,.075);color:#bbf7d0}
.tp-field-operation-actions button:disabled{opacity:.42;cursor:default}
@media(max-width:480px){.tp-field-operation-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.tp-field-operation-row{grid-template-columns:1fr}.tp-planting-details-grid{grid-template-columns:1fr}}
html body .tp-field-operation-sheet{background:#fff!important;border-color:#cbd0d6!important;filter:grayscale(1);box-shadow:0 20px 70px #0003!important}
html body .tp-field-operation-sheet :is(h3,strong,span,p,label,small,div){color:#242a31!important}
html body .tp-field-operation-sheet :is(.tp-field-operation-kicker,.tp-field-operation-cost-note,.tp-irrigation-mode small,.tp-planting-details-head small,.tp-planting-details-note){color:#56616e!important;font-size:12px!important;line-height:1.5!important}
html body .tp-field-operation-sheet h3{font-size:22px!important;line-height:1.3!important}
html body .tp-field-operation-sheet :is(.tp-field-operation-label,.tp-field-operation-field label,.tp-irrigation-mode-title){font-size:14px!important}
html body .tp-field-operation-sheet :is(input,select,textarea){background:#f7f8fa!important;color:#242a31!important;border-color:#cbd0d6!important;font-size:16px!important;min-height:44px!important}
html body .tp-field-operation-sheet :is(input,select,textarea):focus{border-color:#424b56!important;box-shadow:0 0 0 2px #424b5620!important}
html body .tp-field-operation-sheet button{background:#f0f2f4!important;color:#242a31!important;border-color:#cbd0d6!important;min-height:44px!important;font-size:14px!important;box-shadow:none!important}
html body .tp-field-operation-sheet :is(.tp-field-operation-type.active,.tp-irrigation-mode.active){background:#e0e4e9!important;border-color:#424b56!important}
html body .tp-field-operation-sheet :is(.tp-field-operation-type strong,.tp-irrigation-mode strong,.tp-planting-details-head strong){font-size:14px!important}
html body .tp-field-operation-sheet :is(.tp-irrigation-calc,.tp-irrigation-warning,.tp-field-operation-error,.tp-field-operation-success,.tp-planting-details){background:#f0f2f4!important;border-color:#cbd0d6!important;font-size:14px!important;line-height:1.5!important}
html body .tp-field-operation-sheet .tp-field-operation-save{background:#242a31!important;color:#fff!important}
html body .tp-field-operation-head{border-color:#d4d9df!important}
`;

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberOrNull(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

type IrrigationInputMode =
  | 'total_m3'
  | 'per_decare'
  | 'duration_flow'
  | 'duration_only';

function operationConfig(type: FieldOperationType) {
  if (type === 'Ekim / Dikim') {
    return { product: 'Tohum / fidan / çeşit', productPlaceholder: 'Örn: Bezostaja buğday', quantity: true, units: ['kg', 'adet', 'kg/da'] };
  }
  if (type === 'Gübreleme') {
    return { product: 'Gübre / ürün', productPlaceholder: 'Örn: Üre %46', quantity: true, units: ['kg', 'L', 'kg/da', 'L/da'] };
  }
  if (type === 'İlaçlama') {
    return { product: 'İlaç / ürün', productPlaceholder: 'Kullandığın ürün', quantity: true, units: ['L', 'ml', 'kg', 'g', 'L/da', 'ml/da'] };
  }
  if (type === 'Sulama') {
    return { product: null, productPlaceholder: '', quantity: false, units: [] as string[] };
  }
  if (type === 'Hasat') {
    return { product: 'Hasat edilen ürün', productPlaceholder: 'Ürün', quantity: true, units: ['kg', 'ton', 'kasa', 'adet'] };
  }
  return { product: null, productPlaceholder: '', quantity: false, units: [] as string[] };
}

export default function FieldOperationModal({
  open,
  fieldId,
  fieldName,
  initialType = 'Sürme',
  initialDate,
  onClose,
  onSaved,
}: Props) {
  const [type, setType] = useState<FieldOperationType>('Sürme');
  const [date, setDate] = useState(localDate());
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [plantPopulationM2, setPlantPopulationM2] = useState('');
  const [rowSpacingCm, setRowSpacingCm] = useState('');
  const [plantingDepthCm, setPlantingDepthCm] = useState('');
  const [irrigationMode, setIrrigationMode] =
    useState<IrrigationInputMode>('total_m3');
  const [irrigationAmount, setIrrigationAmount] = useState('');
  const [irrigationDurationHours, setIrrigationDurationHours] = useState('');
  const [irrigationFlowM3Hour, setIrrigationFlowM3Hour] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const config = useMemo(() => operationConfig(type), [type]);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setDate(initialDate ?? localDate());
    setProductName('');
    setQuantity('');
    setUnit('');
    setPlantPopulationM2('');
    setRowSpacingCm('');
    setPlantingDepthCm('');
    setIrrigationMode('total_m3');
    setIrrigationAmount('');
    setIrrigationDurationHours('');
    setIrrigationFlowM3Hour('');
    setCost('');
    setNotes('');
    setError(null);
    setSuccess(null);
    setSaving(false);
  }, [open, fieldId, initialType, initialDate]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!config.quantity) {
      setQuantity('');
      setUnit('');
      return;
    }
    if (config.units.length > 0 && !config.units.includes(unit)) {
      setUnit(config.units[0]);
    }
  }, [config.quantity, config.units.join('|'), unit]);

  useEffect(() => {
    if (type === 'Ekim / Dikim') return;
    setPlantPopulationM2('');
    setRowSpacingCm('');
    setPlantingDepthCm('');
  }, [type]);

  const irrigationComputedTotalM3 = useMemo(() => {
    if (type !== 'Sulama' || irrigationMode !== 'duration_flow') return null;

    const hours = numberOrNull(irrigationDurationHours);
    const flow = numberOrNull(irrigationFlowM3Hour);

    if (hours == null || flow == null || hours <= 0 || flow <= 0) return null;
    return Number((hours * flow).toFixed(3));
  }, [type, irrigationMode, irrigationDurationHours, irrigationFlowM3Hour]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fieldId || saving) return;

    if (date > localDate()) {
      setError('Yapılmış bir işlem için gelecek tarih seçilemez. Gelecek işler Takvim bölümünden planlanır.');
      return;
    }

    let resolvedQuantity = config.quantity ? numberOrNull(quantity) : null;
    let resolvedUnit = config.quantity ? unit : null;
    let resolvedNotes = notes.trim();
    let plantingManagement: {
      plantPopulationM2: number;
      rowSpacingCm: number;
      plantingDepthCm: number;
    } | null = null;

    if (type === 'Ekim / Dikim') {
      const rawValues = [plantPopulationM2, rowSpacingCm, plantingDepthCm];
      const hasAnyPlantingDetail = rawValues.some((value) => value.trim() !== '');

      if (hasAnyPlantingDetail) {
        const population = numberOrNull(plantPopulationM2);
        const rowSpacing = numberOrNull(rowSpacingCm);
        const plantingDepth = numberOrNull(plantingDepthCm);

        if (population == null || rowSpacing == null || plantingDepth == null) {
          setError('Ekim ayrıntılarında üç alanı da birlikte gir veya üçünü de boş bırak.');
          return;
        }
        if (population <= 0 || population > 2000) {
          setError('Yaklaşık bitki sıklığı 0–2000 bitki/m² aralığında olmalı.');
          return;
        }
        if (rowSpacing <= 0 || rowSpacing > 500) {
          setError('Sıra arası 0–500 cm aralığında olmalı.');
          return;
        }
        if (plantingDepth <= 0 || plantingDepth > 50) {
          setError('Ekim derinliği 0–50 cm aralığında olmalı.');
          return;
        }

        plantingManagement = {
          plantPopulationM2: population,
          rowSpacingCm: rowSpacing,
          plantingDepthCm: plantingDepth,
        };
      }
    }

    if (type === 'Sulama') {
      const amount = numberOrNull(irrigationAmount);
      const hours = numberOrNull(irrigationDurationHours);
      const flow = numberOrNull(irrigationFlowM3Hour);
      const technicalNotes: string[] = [];

      if (irrigationMode === 'total_m3') {
        if (amount == null || amount <= 0) {
          setError('Toplam sulama suyu miktarını m³ olarak gir.');
          return;
        }
        resolvedQuantity = amount;
        resolvedUnit = 'm³';
        technicalNotes.push(`Toplam sulama suyu: ${amount} m³.`);
      }

      if (irrigationMode === 'per_decare') {
        if (amount == null || amount <= 0) {
          setError('Dekara verilen su miktarını gir.');
          return;
        }
        resolvedQuantity = amount;
        resolvedUnit = 'm³/da';
        technicalNotes.push(`Dekara sulama suyu: ${amount} m³/da.`);
      }

      if (irrigationMode === 'duration_flow') {
        if (hours == null || hours <= 0) {
          setError('Sulama süresini saat olarak gir.');
          return;
        }
        if (flow == null || flow <= 0) {
          setError('Pompa / hat debisini m³/saat olarak gir.');
          return;
        }
        const totalM3 = Number((hours * flow).toFixed(3));
        resolvedQuantity = totalM3;
        resolvedUnit = 'm³';
        technicalNotes.push(`Sulama süresi: ${hours} saat.`);
        technicalNotes.push(`Pompa debisi: ${flow} m³/saat.`);
        technicalNotes.push(`Toplam sulama suyu: ${totalM3} m³.`);
      }

      if (irrigationMode === 'duration_only') {
        if (hours == null || hours <= 0) {
          setError('Sulama süresini saat olarak gir.');
          return;
        }
        resolvedQuantity = hours;
        resolvedUnit = 'saat';
        technicalNotes.push(`Sulama süresi: ${hours} saat.`);
        technicalNotes.push('Su miktarı bilinmiyor; yalnızca süre kaydıdır.');
      }

      resolvedNotes = [technicalNotes.join(' '), resolvedNotes]
        .filter(Boolean)
        .join(' ');
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (plantingManagement) {
        await saveFieldPlantingManagement({
          fieldId,
          ...plantingManagement,
          operationDate: date,
          productName,
        });
      }

      const operation = await createFieldOperation({
        fieldId,
        type,
        date,
        productName: config.product ? productName : null,
        quantity: resolvedQuantity,
        unit: resolvedUnit,
        cost: numberOrNull(cost),
        notes: resolvedNotes,
      });

      const plantingSuffix = plantingManagement ? ' · Ekim ayrıntıları Pusula modellerine eklendi.' : '';
      setSuccess(
        operation.cost != null && operation.cost > 0
          ? `${type} kaydedildi · ${operation.cost.toLocaleString('tr-TR')} TL giderlere eklendi.${plantingSuffix}`
          : `${type} kaydedildi.${plantingSuffix}`,
      );
      onSaved?.(operation);
      window.setTimeout(onClose, plantingManagement ? 950 : 650);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'İşlem kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="tp-field-operation-portal">
        <button type="button" className="tp-field-operation-backdrop" aria-label="İşlem penceresini kapat" onClick={onClose} />
        <section className="tp-field-operation-sheet" role="dialog" aria-modal="true" aria-label="Tarla işlemi ekle">
          <header className="tp-field-operation-head">
            <div>
              <div className="tp-field-operation-kicker">TARLA GÜNLÜĞÜ · {fieldName}</div>
              <h3>Tarlada ne yaptın?</h3>
              <p>Bugünkü veya geçmişte yaptığın işlemi seç, tarihini gir ve kaydet.</p>
            </div>
            <button type="button" className="tp-field-operation-close" onClick={onClose} aria-label="Kapat">×</button>
          </header>

          <form className="tp-field-operation-body" onSubmit={submit}>
            <span className="tp-field-operation-label">İşlem türü</span>
            <div className="tp-field-operation-grid">
              {FIELD_OPERATION_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`tp-field-operation-type ${type === option.type ? 'active' : ''}`}
                  onClick={() => setType(option.type)}
                >
                  <span>{option.icon}</span>
                  <span>{option.shortLabel}</span>
                </button>
              ))}
            </div>

            <div className="tp-field-operation-divider" />

            <div className="tp-field-operation-row">
              <div className="tp-field-operation-field full">
                <label>İşlem tarihi</label>
                <input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} required />
                <div className="tp-field-operation-date-shortcuts">
                  <button type="button" onClick={() => setDate(localDate())}>Bugün</button>
                  <button type="button" onClick={() => setDate(localDate(-1))}>Dün</button>
                  <button type="button" onClick={() => setDate(localDate(-7))}>1 hafta önce</button>
                </div>
              </div>

              {config.product ? (
                <div className="tp-field-operation-field full">
                  <label>{config.product}</label>
                  <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={config.productPlaceholder} />
                </div>
              ) : null}

              {type === 'Ekim / Dikim' ? (
                <div className="tp-planting-details">
                  <div className="tp-planting-details-head">
                    <strong>Ekim ayrıntıları · biliyorsan ekle</strong>
                    <small>Pusula bu bilgileri su, gelişim ve sezon modellerini daha doğru doğrulamak için arka planda kullanır.</small>
                  </div>

                  <div className="tp-planting-details-grid">
                    <div className="tp-field-operation-field">
                      <label>Yaklaşık bitki sıklığı (bitki/m²)</label>
                      <input
                        inputMode="decimal"
                        value={plantPopulationM2}
                        onChange={(e) => setPlantPopulationM2(e.target.value)}
                        placeholder="Örn: 350"
                      />
                    </div>

                    <div className="tp-field-operation-field">
                      <label>Sıra arası (cm)</label>
                      <input
                        inputMode="decimal"
                        value={rowSpacingCm}
                        onChange={(e) => setRowSpacingCm(e.target.value)}
                        placeholder="Örn: 15"
                      />
                    </div>

                    <div className="tp-field-operation-field">
                      <label>Ekim derinliği (cm)</label>
                      <input
                        inputMode="decimal"
                        value={plantingDepthCm}
                        onChange={(e) => setPlantingDepthCm(e.target.value)}
                        placeholder="Örn: 4"
                      />
                    </div>
                  </div>

                  <div className="tp-planting-details-note">
                    Emin değilsen boş bırakabilirsin. Birini doldurursan üç bilgiyi birlikte kaydetmen gerekir.
                  </div>
                </div>
              ) : null}

              {type === 'Sulama' ? (
                <div className="tp-irrigation-mode-wrap">
                  <span className="tp-irrigation-mode-title">
                    Sulama suyunu nasıl biliyorsun?
                  </span>

                  <div className="tp-irrigation-modes">
                    <button
                      type="button"
                      className={`tp-irrigation-mode ${irrigationMode === 'total_m3' ? 'active' : ''}`}
                      onClick={() => setIrrigationMode('total_m3')}
                    >
                      <strong>Toplam su</strong>
                      <small>Sayaç / depo / toplam m³ biliniyorsa</small>
                    </button>

                    <button
                      type="button"
                      className={`tp-irrigation-mode ${irrigationMode === 'per_decare' ? 'active' : ''}`}
                      onClick={() => setIrrigationMode('per_decare')}
                    >
                      <strong>Dekara su</strong>
                      <small>m³/da biliniyorsa · 1 m³/da ≈ 1 mm</small>
                    </button>

                    <button
                      type="button"
                      className={`tp-irrigation-mode ${irrigationMode === 'duration_flow' ? 'active' : ''}`}
                      onClick={() => setIrrigationMode('duration_flow')}
                    >
                      <strong>Süre + debi</strong>
                      <small>Saat ve pompanın m³/saat değeri biliniyorsa</small>
                    </button>

                    <button
                      type="button"
                      className={`tp-irrigation-mode ${irrigationMode === 'duration_only' ? 'active' : ''}`}
                      onClick={() => setIrrigationMode('duration_only')}
                    >
                      <strong>Sadece süre</strong>
                      <small>Su miktarı bilinmiyorsa yalnızca kayıt tut</small>
                    </button>
                  </div>

                  {irrigationMode === 'total_m3' ? (
                    <div className="tp-field-operation-field full">
                      <label>Toplam verilen su (m³)</label>
                      <input
                        inputMode="decimal"
                        value={irrigationAmount}
                        onChange={(e) => setIrrigationAmount(e.target.value)}
                        placeholder="Örn: 120"
                      />
                    </div>
                  ) : null}

                  {irrigationMode === 'per_decare' ? (
                    <div className="tp-field-operation-field full">
                      <label>Dekara verilen su (m³/da)</label>
                      <input
                        inputMode="decimal"
                        value={irrigationAmount}
                        onChange={(e) => setIrrigationAmount(e.target.value)}
                        placeholder="Örn: 25"
                      />
                    </div>
                  ) : null}

                  {irrigationMode === 'duration_flow' ? (
                    <>
                      <div className="tp-field-operation-row" style={{ marginTop: 0 }}>
                        <div className="tp-field-operation-field">
                          <label>Sulama süresi (saat)</label>
                          <input
                            inputMode="decimal"
                            value={irrigationDurationHours}
                            onChange={(e) => setIrrigationDurationHours(e.target.value)}
                            placeholder="Örn: 4"
                          />
                        </div>
                        <div className="tp-field-operation-field">
                          <label>Pompa / hat debisi (m³/saat)</label>
                          <input
                            inputMode="decimal"
                            value={irrigationFlowM3Hour}
                            onChange={(e) => setIrrigationFlowM3Hour(e.target.value)}
                            placeholder="Örn: 18"
                          />
                        </div>
                      </div>

                      {irrigationComputedTotalM3 != null ? (
                        <div className="tp-irrigation-calc">
                          Hesaplanan toplam su: <strong>{irrigationComputedTotalM3.toLocaleString('tr-TR')} m³</strong>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {irrigationMode === 'duration_only' ? (
                    <>
                      <div className="tp-field-operation-field full">
                        <label>Sulama süresi (saat)</label>
                        <input
                          inputMode="decimal"
                          value={irrigationDurationHours}
                          onChange={(e) => setIrrigationDurationHours(e.target.value)}
                          placeholder="Örn: 5"
                        />
                      </div>
                      <div className="tp-irrigation-warning">
                        Sadece saat bilgisiyle verilen su miktarı hesaplanamaz. Kayıt tutulur ama Pusula bunu su dengesi için miktar olarak kullanmaz.
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {config.quantity ? (
                <>
                  <div className="tp-field-operation-field">
                    <label>{type === 'Sulama' ? 'Süre / miktar' : 'Miktar'}</label>
                    <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                  </div>
                  <div className="tp-field-operation-field">
                    <label>Birim</label>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                      {config.units.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </>
              ) : null}

              <div className="tp-field-operation-field full">
                <label>Maliyet / harcama (TL) · isteğe bağlı</label>
                <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Örn: 1500" />
                <div className="tp-field-operation-cost-note">Tutar girersen Giderler bölümüne otomatik yansır. Boş bırakırsan yalnızca işlem kaydı tutulur.</div>
              </div>

              <div className="tp-field-operation-field full">
                <label>Not · isteğe bağlı</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Örn: Toprak tavındaydı, kuzey bölümünden başlandı..." />
              </div>
            </div>

            {error ? <div className="tp-field-operation-error">{error}</div> : null}
            {success ? <div className="tp-field-operation-success">✓ {success}</div> : null}

            <div className="tp-field-operation-actions">
              <button type="button" className="tp-field-operation-cancel" onClick={onClose}>Vazgeç</button>
              <button type="submit" className="tp-field-operation-save" disabled={!fieldId || saving}>{saving ? 'Kaydediliyor…' : '✓ İşlemi kaydet'}</button>
            </div>
          </form>
        </section>
      </div>
    </>,
    document.body,
  );
}
