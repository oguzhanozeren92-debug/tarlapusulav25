import { useEffect } from 'react';

import { TURKEY_CROPS } from '../../../data/crops';
import {
  ensureModelReadinessFreshBestEffort,
} from '../../../services/modelReadiness.service';
import type { Field, FieldSeason } from '../../../types';
import './PcsePilotReadiness.css';

type Props = {
  field: Field;
  seasons: FieldSeason[];
  loading: boolean;
  onAddSeason: () => void;
  onEditCropType: () => void;
};

function cropCycle(name: string) {
  return TURKEY_CROPS.find((crop) => crop.name.toLocaleLowerCase('tr-TR') === name.trim().toLocaleLowerCase('tr-TR'))?.cycle;
}

export default function PcsePilotReadiness({ field, seasons, loading, onAddSeason, onEditCropType }: Props) {
  const catalogueCycle = cropCycle(field.crop);
  const isAnnual = field.cropCycle === 'annual' && catalogueCycle === 'annual';
  const hasLocation = Number.isFinite(field.latitude ?? field.parcelCentroidLat) &&
    Number.isFinite(field.longitude ?? field.parcelCentroidLng);
  const matchingSeason = seasons.find((season) => season.crop.toLocaleLowerCase('tr-TR') === field.crop.trim().toLocaleLowerCase('tr-TR'));
  const hasPlantingDate = Boolean(matchingSeason?.plantingDate);

  useEffect(() => {
    if (!isAnnual) return;
    ensureModelReadinessFreshBestEffort(
      String(field.id),
      'pcse',
      24,
    );
  }, [field.id, isAnnual]);

  return (
    <section className="tp-pcse-readiness" aria-label="Yıllık ürün gelişim takibi hazırlığı">
      <small>ÜRÜN GELİŞİMİ · VERİ HAZIRLIĞI</small>
      <h3>Tarla bilgilerini tamamlayalım</h3>
      {catalogueCycle === 'perennial' ? (
        <>
          <p>{field.crop} katalogda çok yıllık ürün. Bu tarlanın ürün tipi “tek yıllık” kayıtlı görünüyor; yıllık bitki modeli için kullanmayacağız.</p>
          <button type="button" onClick={onEditCropType}>Ürün tipini kontrol et</button>
        </>
      ) : !isAnnual ? (
        <p>Yıllık ürün modeli için önce ürün türü ve üretim tipinin doğrulanması gerekiyor.</p>
      ) : (
        <>
          <p>Bu tarla için bir model tahmini henüz üretilmedi. Önce gerçek sezon bilgilerini tamamlayalım.</p>
          <ul>
            <li>{loading ? 'Sezon kayıtları yükleniyor…' : hasPlantingDate ? `Ekim kaydı: ${matchingSeason?.plantingDate}` : 'Gerçek ekim tarihi olan sezon kaydı eksik'}</li>
            <li>{hasLocation ? 'Tarla konumu kayıtlı' : 'Tarla koordinatı veya parsel merkezi eksik'}</li>
            <li>Sonraki adım: sezonluk hava, ürün/toprak parametreleri ve iki tarihli saha gelişim gözlemi</li>
          </ul>
          {!loading && !hasPlantingDate ? <button type="button" onClick={onAddSeason}>Sezon ve ekim tarihi ekle</button> : null}
        </>
      )}
    </section>
  );
}
