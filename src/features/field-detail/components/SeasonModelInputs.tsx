import { useEffect, useRef, useState } from 'react';
import { TURKEY_CROPS } from '../../../data/crops';
import {
  ensurePyFao56ReadinessFreshBestEffort,
} from '../../../services/modelReadiness.service';
import type { Field, FieldSeason } from '../../../types';
import DualKcShadowStatus from '../../irrigation/components/DualKcShadowStatus';
import FieldWaterMeasurements from '../../irrigation/components/FieldWaterMeasurements';
import FieldGrowthObservations from './FieldGrowthObservations';
import { checkSeasonWeather, hasFieldSoilReport, type SeasonWeatherCoverage } from '../services/seasonModelInputs.service';
import './SeasonModelInputs.css';

type Props = { field: Field; seasons: FieldSeason[]; seasonsLoading: boolean };

function localDay(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function SeasonModelInputs({ field, seasons, seasonsLoading }: Props) {
  const catalogueCycle = TURKEY_CROPS.find((crop) => crop.name.toLocaleLowerCase('tr-TR') === field.crop.trim().toLocaleLowerCase('tr-TR'))?.cycle;
  const annualCrop = (field.cropCycle ?? 'annual') === 'annual' &&
    catalogueCycle === 'annual';
  const [selected, setSelected] = useState('');
  const [coverage, setCoverage] = useState<SeasonWeatherCoverage | null>(null);
  const [report, setReport] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const requestVersion = useRef(0);
  const season = seasons.find((item) => item.id === selected);
  const latitude = field.latitude ?? field.parcelCentroidLat;
  const longitude = field.longitude ?? field.parcelCentroidLng;
  const end = season?.harvestDate && season.harvestDate < localDay(-1) ? season.harvestDate : localDay(-1);
  const seasonDays = season?.plantingDate ?
    Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${season.plantingDate}T00:00:00Z`)) / 86400000) + 1 : 0;
  const canCheck = Boolean(!seasonsLoading && season?.plantingDate && seasonDays > 0 && seasonDays <= 731 &&
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude));
  const irrigationStatus = field.irrigationStatus ?? null;

  useEffect(() => {
    if (!seasons.some((item) => item.id === selected)) setSelected(seasons[0]?.id ?? '');
  }, [seasons, selected]);

  useEffect(() => {
    requestVersion.current += 1;
    setCoverage(null); setMessage(''); setLoading(false);
  }, [field.id, selected]);

  useEffect(() => {
    ensurePyFao56ReadinessFreshBestEffort(String(field.id), 24);
  }, [field.id]);

  useEffect(() => {
    let active = true;
    setReport(null);
    if (!annualCrop) return () => { active = false; };
    void hasFieldSoilReport(String(field.id)).then((value) => { if (active) setReport(value); })
      .catch(() => { if (active) setReport(null); });
    return () => { active = false; };
  }, [field.id, annualCrop]);

  const check = async () => {
    if (!season?.plantingDate || latitude == null || longitude == null || !canCheck || loading) return;
    const version = ++requestVersion.current;
    setLoading(true); setMessage(''); setCoverage(null);
    try {
      const result = await checkSeasonWeather(String(field.id), latitude, longitude, season.plantingDate, end);
      if (requestVersion.current === version) setCoverage(result);
    } catch (reason) {
      if (requestVersion.current === version) setMessage(reason instanceof Error ? reason.message : 'Günlük hava kontrolü yapılamadı.');
    } finally { if (requestVersion.current === version) setLoading(false); }
  };

  if (!annualCrop) return <>
    <section className="tp-season-model-inputs" aria-label="Sezonluk model girdi kontrolü"><details>
      <summary>Sezon verilerini kontrol et <span aria-hidden="true">⌄</span></summary>
      <div className="tp-season-model-inputs-body">
        <small>SEZON VERİLERİ · MODEL HAZIRLIĞI</small>
        <h3>{field.crop} için durum</h3>
        <p>Bu gelişim modeli kontrolü tek yıllık ürünler için hazırlandı. {field.cropCycle === 'perennial' || catalogueCycle === 'perennial' ? `${field.crop} çok yıllık ürün olduğu için` : `${field.crop} tek yıllık ürün olarak doğrulanmadığı için`} bu tarlada geçmiş hava sorgusu ve PCSE denemesi açılmıyor.</p>
      </div>
    </details></section>
    {field.cropCycle === 'perennial' && (
      <FieldGrowthObservations
        fieldId={String(field.id)}
        seasons={seasons}
        cropCycle="perennial"
      />
    )}
    <FieldWaterMeasurements fieldId={String(field.id)} />
    <DualKcShadowStatus
      fieldId={String(field.id)}
      irrigationStatus={irrigationStatus}
    />
  </>;

  return <>
    <section className="tp-season-model-inputs" aria-label="Sezonluk model girdi kontrolü"><details>
      <summary>Sezon verilerini kontrol et <span aria-hidden="true">⌄</span></summary>
      <div className="tp-season-model-inputs-body">
      <small>SEZON VERİLERİ · MODEL HAZIRLIĞI</small>
      <h3>Bu sezonun verileri neler?</h3>
      <p>Bu kontrol bir bitki gelişimi ya da verim tahmini üretmez.</p>
      {seasonsLoading ? <p>Sezon bilgileri yükleniyor…</p> : seasons.length === 0 ? <p>Önce bu tarla için gerçek sezon ve ekim tarihi ekle.</p> : <>
        <label>Kontrol edilen sezon<select value={selected} onChange={(event) => setSelected(event.target.value)}>
          {seasons.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.crop}</option>)}
        </select></label>
        <ul>
          <li>Ürün: {season?.crop ?? 'Eksik'} · ekim: {season?.plantingDate ?? 'eksik'}.</li>
          <li>Konum: {latitude != null && longitude != null ? 'kayıtlı' : 'eksik'}; rakım: henüz doğrulanmadı.</li>
          <li>Toprak: {report === null ? 'rapor durumu kontrol edilemiyor' : report ? 'laboratuvar raporu kayıtlı' : 'laboratuvar raporu yok'}. Rapor olsa bile PCSE toprak parametreleri ayrıca hazırlanmalı.</li>
          <li>Ürün çeşidi, model ürün parametreleri ve tarla işlemleri: pilot için henüz doğrulanmadı.</li>
        </ul>
        <button type="button" disabled={!canCheck || loading} onClick={() => void check()}>
          {loading ? 'Hava verisi kontrol ediliyor…' : 'Geçmiş günlük havayı kontrol et'}
        </button>
        <p>Düğmeye basınca tarla konumu NASA POWER'a gönderilir; sorgu otomatik yapılmaz.</p>
        {!canCheck && <p>Hava kontrolü için ekim tarihi, tarla konumu ve 731 günü aşmayan geçmiş dönem gerekli.</p>}
        {coverage && <div className="tp-season-model-inputs-result" role="status">
          <strong>NASA POWER · {coverage.start} – {coverage.end}</strong>
          <p>{coverage.expectedDays} günün {coverage.completeDays} gününde sıcaklık, yağış, güneş ışınımı ve rüzgâr birlikte mevcut.</p>
          <p>Eksik gün: sıcaklık {coverage.missing.temperature}, yağış {coverage.missing.rain}, güneş ışınımı {coverage.missing.radiation}, rüzgâr {coverage.missing.wind}.</p>
          {coverage.heatSum10C !== null ? (
            <div className="tp-season-model-heat">
              <small>EKİMDEN BERİ ISI BİRİKİMİ · 10 °C EŞİĞİ</small>
              <strong>{coverage.heatSum10C.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} °C·gün</strong>
              <p>Her günün en düşük ve en yüksek sıcaklığının ortalamasından 10 °C çıkarılıp sıfırın üstündeki değerler toplandı.</p>
            </div>
          ) : <p>Isı birikimi hesaplanmadı: {coverage.missing.temperature} günün sıcaklığı eksik veya tutarsız.</p>}
          <p>10 °C yalnızca karşılaştırma eşiğidir; ürünün çeşidine göre gelişim evresi ya da hasat tarihi tahmini değildir.</p>
          <p>Bunlar bölgesel, uydu ve model kaynaklı geçmiş hava verileridir; tarlada ölçülen hava değildir. PCSE için buhar basıncı, rakım, ürün/toprak parametreleri ve saha gözlemi ayrıca gerekli.</p>
        </div>}
        {message && <p role="alert">{message}</p>}
      </>}
      </div>
    </details></section>
    <FieldWaterMeasurements fieldId={String(field.id)} />
    <DualKcShadowStatus
      fieldId={String(field.id)}
      irrigationStatus={irrigationStatus}
    />
  </>;
}
