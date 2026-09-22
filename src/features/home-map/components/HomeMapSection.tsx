import { useEffect } from 'react';
import { ListTodo, Map as MapIcon, MapPin, Plus } from 'lucide-react';
import FieldMap from '../../../components/FieldMap';
import {
  formatHomeSatelliteDate,
  titleCaseEachWordTr,
} from '../../home/homeFormatters';
import { useEarthSearchNdvi } from '../hooks/useEarthSearchNdvi';
import type { EarthSearchNdviStats } from '../services/earthSearchNdvi.service';
import {
  HomeInlineLayerMap,
  HOME_CLIMATE_DEPTH_LABELS,
  HOME_CLIMATE_LAYER_LABELS,
  HOME_SOIL_DEPTH_LABELS,
  HOME_SOIL_PROPERTY_LABELS,
  type HomeClimateDepth,
  type HomeClimateLayer,
  type HomeLayer,
  type HomeSoilDepth,
  type HomeSoilProperty,
  type HomeLayerSpatialSummary,
} from '../HomeMapEngine';

type HomeMapSectionProps = {
  homeField: any;
  realFields?: any[] | null;
  setHomeFieldId: (fieldId: string) => void;
  setFieldControlFieldId?: (fieldId: string) => void;
  onAddField: () => void;
  onOpenTasks?: () => void;
  activeHomeLayer: HomeLayer;
  openMapLayer: (layer: HomeLayer) => void;
  soilMenuOpen: boolean;
  setSoilMenuOpen: (open: boolean) => void;
  homeSoilProperty: HomeSoilProperty;
  setHomeSoilProperty: (property: HomeSoilProperty) => void;
  homeSoilDepth: HomeSoilDepth;
  setHomeSoilDepth: (depth: HomeSoilDepth) => void;
  climateMenuOpen: boolean;
  setClimateMenuOpen: (open: boolean) => void;
  homeClimateLayer: HomeClimateLayer;
  setHomeClimateLayer: (layer: HomeClimateLayer) => void;
  homeClimateDepth: HomeClimateDepth;
  setHomeClimateDepth: (depth: HomeClimateDepth) => void;
  satelliteData?: any;
  resolvedSatelliteDate: string;
  onSpatialSummary: (summary: HomeLayerSpatialSummary | null) => void;
  onNdviStats?: (stats: EarthSearchNdviStats | null) => void;
};

export default function HomeMapSection({
  homeField,
  realFields,
  setHomeFieldId,
  setFieldControlFieldId,
  onAddField,
  onOpenTasks,
  activeHomeLayer,
  openMapLayer,
  soilMenuOpen,
  setSoilMenuOpen,
  homeSoilProperty,
  setHomeSoilProperty,
  homeSoilDepth,
  setHomeSoilDepth,
  climateMenuOpen,
  setClimateMenuOpen,
  homeClimateLayer,
  setHomeClimateLayer,
  homeClimateDepth,
  setHomeClimateDepth,
  satelliteData: sat,
  onSpatialSummary: setHomeLayerSpatialSummary,
  onNdviStats,
}: HomeMapSectionProps) {
  const ndviReady = Boolean(sat?.ndviImage);
  const trueColorReady = Boolean(sat?.trueColorImage);
  // The date must belong to the rendered image, not a different catalog scene.
  const displayedSatelliteDate = ndviReady ? String(sat?.latestImageDate ?? '') : '';
  const earthNdvi = useEarthSearchNdvi({
    fieldKey: String(homeField?.id ?? ''),
    parcelGeometry: homeField?.parcelGeometry,
    imageDate: displayedSatelliteDate || null,
    enabled: activeHomeLayer === 'vegetation',
  });
  const liveNdvi = earthNdvi.status === 'ready' ? earthNdvi.data : null;

  useEffect(() => {
    if (activeHomeLayer !== 'vegetation' || !liveNdvi) return;
    onNdviStats?.(liveNdvi);
  }, [activeHomeLayer, liveNdvi, onNdviStats]);

  return (
    <section className="tp-home-field">
      <span className="tp-map-frame-corner tl" aria-hidden="true" />
      <span className="tp-map-frame-corner tr" aria-hidden="true" />
      <span className="tp-map-frame-corner bl" aria-hidden="true" />
      <span className="tp-map-frame-corner br" aria-hidden="true" />
      <div className="tp-field-head">
        <div className="tp-map-section-heading">
          <div className="tp-map-heading-icon" aria-hidden="true"><MapIcon size={44} strokeWidth={1.65} /></div>
          <div className="tp-map-heading-copy"><h2>Tarımsal Analiz Haritası</h2><p>Parselini farklı katmanlarla analiz et, daha bilinçli kararlar al.</p></div>
        </div>
        <div className="tp-field-toolbar">
          <div className="tp-field-select-wrap">
            <div className="tp-field-select-box">
              <span className="tp-field-pin" aria-hidden="true"><MapPin size={22} strokeWidth={1.9} /></span>
              <select className="tp-field-select" value={String(homeField?.id ?? '')} onChange={(event) => { const nextId = event.target.value; setHomeFieldId(nextId); setFieldControlFieldId?.(nextId); }} aria-label="Ana ekranda gösterilecek tarlayı seç">
                {!realFields?.length && <option value="" disabled>Önce bir tarla ekle</option>}
                {realFields?.filter(Boolean).map((field: any) => <option key={String(field.id)} value={String(field.id)}>{titleCaseEachWordTr(field.name || 'Adsız Tarla')}</option>)}
              </select>
              <span className="tp-field-chevron">⌄</span>
            </div>
            <small>{homeField?.crop || 'Ürün belirtilmedi'} · {homeField?.area || '—'} da</small>
          </div>
          <button type="button" className="tp-add-field-3d tp-map-tasks-btn" onClick={() => onOpenTasks?.()} aria-label="Görevlerim" title="Görevlerim"><ListTodo size={23} strokeWidth={1.9} /></button>
          <button type="button" className="tp-add-field-3d tp-map-add-field-btn" onClick={onAddField} aria-label="Yeni tarla ekle" title="Tarla ekle"><Plus size={25} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="tp-map-shortcut-stack">
        <div className="tp-map-shortcuts" aria-label="Harita katmanları">
          <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'vegetation' ? 'active' : ''}`} onClick={() => openMapLayer('vegetation')}>Sağlık</button>
          <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'radar-vv' ? 'active' : ''}`} onClick={() => openMapLayer('radar-vv')}>Nemli Alanlar</button>
          <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'radar-vh' ? 'active' : ''}`} onClick={() => openMapLayer('radar-vh')}>Yüzey & Bitki Farkı</button>
          <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'radar-water' ? 'active' : ''}`} onClick={() => openMapLayer('radar-water')}>Su Birikimi Riski</button>
          <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'soil' ? 'active' : ''}`} onClick={() => openMapLayer('soil')}>Toprak</button>
          <button type="button" className={`tp-map-shortcut ${['climate', 'surface-temperature', 'evapotranspiration', 'rainfall-history'].includes(activeHomeLayer) ? 'active' : ''}`} onClick={() => openMapLayer('climate')}>İklim</button>
        </div>
        {['climate', 'surface-temperature', 'evapotranspiration', 'rainfall-history'].includes(activeHomeLayer) && (
          <div className="tp-map-shortcuts tp-map-shortcuts-secondary" aria-label="İklim ve su katmanları">
            <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'surface-temperature' ? 'active' : ''}`} onClick={() => openMapLayer('surface-temperature')} title="ERA5-Land 0–7 cm yüzeye yakın toprak sıcaklığı">Yüzey Sıcaklığı</button>
            <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'evapotranspiration' ? 'active' : ''}`} onClick={() => openMapLayer('evapotranspiration')}>Su İhtiyacı</button>
            <button type="button" className={`tp-map-shortcut ${activeHomeLayer === 'rainfall-history' ? 'active' : ''}`} onClick={() => openMapLayer('rainfall-history')}>Yağış Geçmişi</button>
          </div>
        )}
      </div>

      {activeHomeLayer === 'soil' && (
        <div className="tp-layer-subbar" aria-label="Toprak alt katmanları">
          <div className="tp-layer-subbar-section"><span className="tp-layer-subbar-label">Toprak Özelliği</span><div className="tp-layer-subbar-scroll">{(Object.keys(HOME_SOIL_PROPERTY_LABELS) as HomeSoilProperty[]).map((property) => <button type="button" key={property} className={`tp-layer-subbar-chip ${homeSoilProperty === property ? 'active' : ''}`} onClick={() => setHomeSoilProperty(property)}>{HOME_SOIL_PROPERTY_LABELS[property]}</button>)}</div></div>
          <div className="tp-layer-subbar-section compact"><span className="tp-layer-subbar-label">Derinlik</span><div className="tp-layer-subbar-scroll">{(Object.keys(HOME_SOIL_DEPTH_LABELS) as HomeSoilDepth[]).map((depth) => <button type="button" key={depth} className={`tp-layer-subbar-chip ${homeSoilDepth === depth ? 'active' : ''}`} onClick={() => setHomeSoilDepth(depth)}>{HOME_SOIL_DEPTH_LABELS[depth]}</button>)}</div></div>
        </div>
      )}

      {activeHomeLayer === 'climate' && (
        <div className="tp-layer-subbar" aria-label="İklim alt katmanları">
          <div className="tp-layer-subbar-section"><span className="tp-layer-subbar-label">İklim Verisi</span><div className="tp-layer-subbar-scroll">{(Object.keys(HOME_CLIMATE_LAYER_LABELS) as HomeClimateLayer[]).map((item) => <button type="button" key={item} className={`tp-layer-subbar-chip ${homeClimateLayer === item ? 'active' : ''}`} onClick={() => setHomeClimateLayer(item)}>{HOME_CLIMATE_LAYER_LABELS[item]}</button>)}</div></div>
          {(homeClimateLayer === 'soil-moisture' || homeClimateLayer === 'soil-temperature') && <div className="tp-layer-subbar-section compact"><span className="tp-layer-subbar-label">Derinlik</span><div className="tp-layer-subbar-scroll">{(Object.keys(HOME_CLIMATE_DEPTH_LABELS) as HomeClimateDepth[]).filter((depth) => homeClimateLayer === 'soil-temperature' ? depth !== '28-100cm' : true).map((depth) => <button type="button" key={depth} className={`tp-layer-subbar-chip ${homeClimateDepth === depth ? 'active' : ''}`} onClick={() => setHomeClimateDepth(depth)}>{HOME_CLIMATE_DEPTH_LABELS[depth]}</button>)}</div></div>}
        </div>
      )}

      <div className="tp-map-stage">
        {trueColorReady || ndviReady || homeField?.parcelGeometry ? (
          <HomeInlineLayerMap layer={activeHomeLayer} field={homeField} satelliteData={{ ...sat, latestImageDate: displayedSatelliteDate }} soilProperty={homeSoilProperty} soilDepth={homeSoilDepth} climateLayer={homeClimateLayer} climateDepth={homeClimateDepth} height={390} onSpatialSummary={setHomeLayerSpatialSummary} />
        ) : (
          <FieldMap initialCenter={[homeField?.parcelCentroidLng ?? homeField?.longitude ?? 35.2433, homeField?.parcelCentroidLat ?? homeField?.latitude ?? 38.9637]} initialZoom={homeField?.parcelGeometry ? 15 : 10} height={390} parcelGeometry={homeField?.parcelGeometry ?? null} sections={[]} drawEnabled={false} />
        )}

        {activeHomeLayer === 'soil' && soilMenuOpen && (
          <div className="tp-soil-popover" role="dialog" aria-label="Toprak katmanları">
            <div className="tp-soil-popover-head"><div><strong>Toprak Katmanları</strong><small>Özellik ve derinlik seç</small></div><button type="button" className="tp-soil-close" onClick={() => setSoilMenuOpen(false)} aria-label="Toprak menüsünü kapat">×</button></div>
            <div className="tp-soil-group"><span className="tp-soil-group-label">Özellik</span><div className="tp-soil-chip-grid">{(Object.keys(HOME_SOIL_PROPERTY_LABELS) as HomeSoilProperty[]).map((property) => <button type="button" key={property} className={`tp-soil-chip ${homeSoilProperty === property ? 'active' : ''}`} onClick={() => setHomeSoilProperty(property)}>{HOME_SOIL_PROPERTY_LABELS[property]}</button>)}</div></div>
            <div className="tp-soil-group"><span className="tp-soil-group-label">Derinlik</span><div className="tp-soil-depth-row">{(Object.keys(HOME_SOIL_DEPTH_LABELS) as HomeSoilDepth[]).map((depth) => <button type="button" key={depth} className={`tp-soil-depth ${homeSoilDepth === depth ? 'active' : ''}`} onClick={() => setHomeSoilDepth(depth)}>{HOME_SOIL_DEPTH_LABELS[depth]}</button>)}</div></div>
            <div className="tp-soil-current"><span>Seçili katman</span><strong>{HOME_SOIL_PROPERTY_LABELS[homeSoilProperty]} · {HOME_SOIL_DEPTH_LABELS[homeSoilDepth]}</strong></div>
          </div>
        )}

        {activeHomeLayer === 'climate' && climateMenuOpen && (
          <div className="tp-soil-popover" role="dialog" aria-label="İklim katmanları">
            <div className="tp-soil-popover-head"><div><strong>İklim Katmanları</strong><small>Görünüm ve gerekiyorsa derinlik seç</small></div><button type="button" className="tp-soil-close" onClick={() => setClimateMenuOpen(false)} aria-label="İklim menüsünü kapat">×</button></div>
            <div className="tp-soil-group"><span className="tp-soil-group-label">Katman</span><div className="tp-climate-chip-grid">{(Object.keys(HOME_CLIMATE_LAYER_LABELS) as HomeClimateLayer[]).map((item) => <button type="button" key={item} className={`tp-soil-chip ${homeClimateLayer === item ? 'active' : ''}`} onClick={() => setHomeClimateLayer(item)}>{HOME_CLIMATE_LAYER_LABELS[item]}</button>)}</div></div>
            {(homeClimateLayer === 'soil-moisture' || homeClimateLayer === 'soil-temperature') && <div className="tp-soil-group"><span className="tp-soil-group-label">Derinlik</span><div className="tp-soil-depth-row">{(Object.keys(HOME_CLIMATE_DEPTH_LABELS) as HomeClimateDepth[]).filter((depth) => homeClimateLayer === 'soil-temperature' ? depth !== '28-100cm' : true).map((depth) => <button type="button" key={depth} className={`tp-soil-depth ${homeClimateDepth === depth ? 'active' : ''}`} onClick={() => setHomeClimateDepth(depth)}>{HOME_CLIMATE_DEPTH_LABELS[depth]}</button>)}</div></div>}
            <div className="tp-soil-current"><span>Seçili katman</span><strong>{HOME_CLIMATE_LAYER_LABELS[homeClimateLayer]}{(homeClimateLayer === 'soil-moisture' || homeClimateLayer === 'soil-temperature') && <> · {HOME_CLIMATE_DEPTH_LABELS[homeClimateDepth]}</>}</strong></div>
          </div>
        )}
      </div>

      <div className="tp-field-stats">
        {activeHomeLayer === 'vegetation' ? (
          <>
            <div><small>Ort. NDVI</small><strong>{liveNdvi ? liveNdvi.mean.toFixed(2) : earthNdvi.status === 'loading' ? '…' : sat?.ndviAverage != null ? Number(sat.ndviAverage).toFixed(2) : '—'}</strong></div>
            <div><small>İyi Alan</small><strong>{liveNdvi ? `%${Math.round(liveNdvi.healthyPercent)}` : earthNdvi.status === 'loading' ? '…' : sat?.healthyPercent != null ? `%${Math.round(sat.healthyPercent)}` : '—'}</strong></div>
            <div>
              <small>Son Görüntü</small>
              <strong>{displayedSatelliteDate ? formatHomeSatelliteDate(displayedSatelliteDate) : earthNdvi.status === 'loading' ? 'Aranıyor' : '—'}</strong>
              {liveNdvi && (
                <small>
                  {liveNdvi.engine === 'geoblaze' ? 'GeoBlaze · ' : ''}
                  Sentinel-2
                  {liveNdvi.cloudCover != null ? ` · Bulut %${Math.round(liveNdvi.cloudCover)}` : ''}
                </small>
              )}
            </div>
          </>
        ) : (
          <>
            <div><small>Katman</small><strong>{activeHomeLayer.startsWith('radar-') ? 'Sentinel-1' : activeHomeLayer === 'soil' ? 'SoilGrids' : activeHomeLayer === 'surface-temperature' ? 'ERA5-Land' : activeHomeLayer === 'evapotranspiration' ? 'FAO-56 ET₀' : activeHomeLayer === 'rainfall-history' ? 'Open-Meteo' : 'ERA5'}</strong></div>
            <div><small>Tarla</small><strong>{titleCaseEachWordTr(homeField?.name ?? '—')}</strong></div>
            <div><small>Görünüm</small><strong>{activeHomeLayer === 'radar-vv' ? 'Yüzey Nem Sinyali' : activeHomeLayer === 'radar-vh' ? 'Yüzey & Bitki Farkı' : activeHomeLayer === 'radar-water' ? 'Göllenme / Su Adayı' : activeHomeLayer === 'soil' ? `${HOME_SOIL_PROPERTY_LABELS[homeSoilProperty]} · ${HOME_SOIL_DEPTH_LABELS[homeSoilDepth]}` : activeHomeLayer === 'surface-temperature' ? 'Yüzeye Yakın Toprak Sıcaklığı · Son 7 gün' : activeHomeLayer === 'evapotranspiration' ? 'ET₀ · Son 7 gün' : activeHomeLayer === 'rainfall-history' ? 'Toplam Yağış · Son 30 gün' : `${HOME_CLIMATE_LAYER_LABELS[homeClimateLayer]}${homeClimateLayer === 'soil-moisture' || homeClimateLayer === 'soil-temperature' ? ` · ${HOME_CLIMATE_DEPTH_LABELS[homeClimateDepth]}` : ''}`}</strong></div>
          </>
        )}
      </div>
    </section>
  );
}
