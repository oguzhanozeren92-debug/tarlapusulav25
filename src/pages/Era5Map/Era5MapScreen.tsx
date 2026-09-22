import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../../lib/mapRuntime';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../../supabaseClient';
import type { Field } from '../../types';

maplibregl.setWorkerUrl(workerUrl);

type Era5MapVariable =
  | 'soil_moisture_0_to_7cm'
  | 'soil_moisture_7_to_28cm'
  | 'soil_moisture_28_to_100cm'
  | 'soil_temperature_0_to_7cm'
  | 'soil_temperature_7_to_28cm'
  | 'temperature_2m'
  | 'precipitation';

type Era5MapCell = {
  id: string;
  latitude: number;
  longitude: number;
  requestedLatitude?: number;
  requestedLongitude?: number;
  value: number | null;
  unit: string;
  model: 'ERA5-Land' | 'ERA5';
  resolutionDegrees: number;
};

type Era5MapResponse = {
  success?: boolean;
  source?: string;
  provider?: string;
  variable?: Era5MapVariable;
  variableLabel?: string;
  aggregation?: 'average' | 'sum';
  unit?: string;
  model?: 'ERA5-Land' | 'ERA5';
  resolutionDegrees?: number;
  period?: { start?: string; end?: string };
  requestedCenter?: { latitude?: number; longitude?: number };
  cells?: Era5MapCell[];
  stats?: {
    min?: number | null;
    max?: number | null;
    average?: number | null;
    validCellCount?: number;
  };
  error?: string;
};

type Props = {
  fields: Field[];
  selectedFieldId?: string;
  onFieldChange?: (id: string) => void;
  onBack: () => void;
};

const VARIABLE_OPTIONS: Array<{
  value: Era5MapVariable;
  label: string;
  short: string;
}> = [
  { value: 'soil_moisture_0_to_7cm', label: 'Toprak Nemi • 0–7 cm', short: 'Yüzey Nemi' },
  { value: 'soil_moisture_7_to_28cm', label: 'Toprak Nemi • 7–28 cm', short: 'Kök Bölgesi Nemi' },
  { value: 'soil_moisture_28_to_100cm', label: 'Toprak Nemi • 28–100 cm', short: 'Derin Toprak Nemi' },
  { value: 'soil_temperature_0_to_7cm', label: 'Toprak Sıcaklığı • 0–7 cm', short: 'Yüzey Toprak Sıcaklığı' },
  { value: 'soil_temperature_7_to_28cm', label: 'Toprak Sıcaklığı • 7–28 cm', short: 'Kök Bölgesi Sıcaklığı' },
  { value: 'temperature_2m', label: 'Hava Sıcaklığı • 2 m', short: 'Hava Sıcaklığı' },
  { value: 'precipitation', label: 'Yağış', short: 'Toplam Yağış' },
];

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fieldCoordinates(field?: Field | null) {
  if (!field) return null;
  const latitude = finite(field.parcelCentroidLat ?? field.latitude);
  const longitude = finite(field.parcelCentroidLng ?? field.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function colorForRatio(ratio: number) {
  const stops = [
    [57, 49, 35],
    [111, 87, 48],
    [157, 132, 71],
    [108, 136, 83],
    [61, 113, 80],
  ];
  const clamped = Math.max(0, Math.min(1, ratio));
  const scaled = clamped * (stops.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(stops.length - 1, left + 1);
  const mix = scaled - left;
  const rgb = stops[left].map((value, index) =>
    Math.round(value + (stops[right][index] - value) * mix),
  );
  return `rgb(${rgb.join(',')})`;
}

function cellFeatureCollection(cells: Era5MapCell[], min: number | null, max: number | null) {
  const features: GeoJSON.Feature[] = [];
  const spread = min !== null && max !== null ? max - min : 0;

  for (const cell of cells) {
    if (cell.value === null) continue;
    const half = Math.max(0.025, Number(cell.resolutionDegrees || 0.1) / 2);
    const ratio = spread > 0 ? (cell.value - (min ?? cell.value)) / spread : 0.5;
    const west = cell.longitude - half;
    const east = cell.longitude + half;
    const south = cell.latitude - half;
    const north = cell.latitude + half;

    features.push({
      type: 'Feature',
      properties: {
        id: cell.id,
        value: cell.value,
        unit: cell.unit,
        model: cell.model,
        fill: colorForRatio(ratio),
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ]],
      },
    });
  }

  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
}

function parcelCollection(field?: Field | null): GeoJSON.FeatureCollection {
  const geometry = field?.parcelGeometry;
  if (!geometry) return EMPTY_COLLECTION;
  const feature = geometry.type === 'Feature'
    ? geometry
    : { type: 'Feature', properties: {}, geometry };
  return { type: 'FeatureCollection', features: [feature] } as GeoJSON.FeatureCollection;
}

export default function Era5MapScreen({
  fields,
  selectedFieldId = '',
  onFieldChange = () => undefined,
  onBack,
}: Props) {
  const safeFields = Array.isArray(fields) ? fields : [];
  const [internalFieldId, setInternalFieldId] = useState(
    selectedFieldId || String(safeFields[0]?.id ?? ''),
  );
  const [variable, setVariable] = useState<Era5MapVariable>('soil_moisture_0_to_7cm');
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Era5MapResponse | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const selectedField = useMemo(
    () => safeFields.find((field) => String(field.id) === String(internalFieldId)) ?? safeFields[0] ?? null,
    [safeFields, internalFieldId],
  );
  const selectedVariable = VARIABLE_OPTIONS.find((item) => item.value === variable) ?? VARIABLE_OPTIONS[0];
  const coords = fieldCoordinates(selectedField);

  useEffect(() => {
    if (selectedFieldId) setInternalFieldId(String(selectedFieldId));
  }, [selectedFieldId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: [number, number] = coords
      ? [coords.longitude, coords.latitude]
      : [35.2433, 38.9637];

    const map = new mapRuntime.Map({
      container: mapContainerRef.current,
      center,
      zoom: coords ? 9.2 : 5.2,
      attributionControl: true,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
          era5grid: { type: 'geojson', data: EMPTY_COLLECTION },
          parcel: { type: 'geojson', data: EMPTY_COLLECTION },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
          {
            id: 'era5-fill',
            type: 'fill',
            source: 'era5grid',
            paint: {
              'fill-color': ['coalesce', ['get', 'fill'], '#6f825e'],
              'fill-opacity': 0.64,
              'fill-outline-color': 'rgba(234,226,198,.58)',
            },
          },
          {
            id: 'era5-line',
            type: 'line',
            source: 'era5grid',
            paint: {
              'line-color': 'rgba(236,228,202,.68)',
              'line-width': 1,
            },
          },
          {
            id: 'parcel-fill',
            type: 'fill',
            source: 'parcel',
            paint: {
              'fill-color': '#d7bb6a',
              'fill-opacity': 0.08,
            },
          },
          {
            id: 'parcel-line',
            type: 'line',
            source: 'parcel',
            paint: {
              'line-color': '#f2d787',
              'line-width': 2.4,
            },
          },
        ],
      },
    });

    map.addControl(new mapRuntime.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('click', 'era5-fill', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const value = finite(feature.properties?.value);
      const unit = String(feature.properties?.unit ?? '');
      const model = String(feature.properties?.model ?? 'ERA5');
      new mapRuntime.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(event.lngLat)
        .setHTML(
          `<div style="font:12px system-ui;color:#122018"><strong>${selectedVariable.short}</strong><br/>${value === null ? 'Veri yok' : `${value.toFixed(variable.includes('moisture') ? 3 : 1)} ${unit}`}<br/><span style="opacity:.7">${model}</span></div>`,
        )
        .addTo(map);
    });

    map.on('mouseenter', 'era5-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'era5-fill', () => { map.getCanvas().style.cursor = ''; });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // only create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedField) return;
    const update = () => {
      const source = map.getSource('parcel') as GeoJSONSource | undefined;
      source?.setData(parcelCollection(selectedField));
      const next = fieldCoordinates(selectedField);
      if (next) {
        map.easeTo({ center: [next.longitude, next.latitude], zoom: 9.2, duration: 700 });
      }
    };
    if (map.isStyleLoaded()) update(); else map.once('load', update);
  }, [selectedField]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cells = Array.isArray(result?.cells) ? result!.cells! : [];
    const data = cellFeatureCollection(
      cells,
      finite(result?.stats?.min),
      finite(result?.stats?.max),
    );
    const update = () => {
      const source = map.getSource('era5grid') as GeoJSONSource | undefined;
      source?.setData(data);
    };
    if (map.isStyleLoaded()) update(); else map.once('load', update);
  }, [result]);

  const loadMap = async () => {
    if (!selectedField || !coords) {
      setStatus('error');
      setMessage('Bu tarla için harita oluşturacak koordinat bulunamadı.');
      return;
    }
    if (!supabase) {
      setStatus('error');
      setMessage('Supabase bağlantısı hazır değil.');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('era5-map', {
        body: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          variable,
          days,
          gridRadius: 2,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'ERA5 haritası alınamadı.');
      setResult(data as Era5MapResponse);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'ERA5 haritası alınamadı.');
    }
  };

  useEffect(() => {
    if (!selectedField || !coords) return;
    void loadMap();
    // reload on selection controls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField?.id, variable, days]);

  const stats = result?.stats;
  const unit = result?.unit || '';

  return (
    <div className="tp-era5-page">
      <style>{ERA5_MAP_STYLES}</style>

      <header className="tp-era5-topbar">
        <button type="button" onClick={onBack} className="tp-era5-back">←</button>
        <div>
          <small>HARİTALAR / ECMWF</small>
          <h1>ERA5 Arazi Haritası</h1>
        </div>
        <span className="tp-era5-source">Open-Meteo · ECMWF</span>
      </header>

      <main className="tp-era5-main">
        <section className="tp-era5-controls">
          <label>
            <span>Tarla</span>
            <select
              value={String(selectedField?.id ?? '')}
              onChange={(event) => {
                setInternalFieldId(event.target.value);
                onFieldChange(event.target.value);
              }}
            >
              {safeFields.map((field) => (
                <option value={String(field.id)} key={field.id}>
                  {field.name} — {field.crop}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Harita</span>
            <select value={variable} onChange={(event) => setVariable(event.target.value as Era5MapVariable)}>
              {VARIABLE_OPTIONS.map((item) => (
                <option value={item.value} key={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Periyot</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>Son 1 gün</option>
              <option value={7}>Son 7 gün</option>
              <option value={30}>Son 30 gün</option>
            </select>
          </label>

          <button type="button" onClick={() => void loadMap()} disabled={status === 'loading'}>
            {status === 'loading' ? 'Hazırlanıyor…' : 'Haritayı Yenile'}
          </button>
        </section>

        <section className="tp-era5-map-card">
          <div className="tp-era5-map" ref={mapContainerRef} />

          <div className="tp-era5-map-title">
            <small>{selectedField?.name || 'Tarla'}</small>
            <strong>{selectedVariable.short}</strong>
            <span>
              {result?.period?.start && result?.period?.end
                ? `${result.period.start} → ${result.period.end}`
                : 'Veri periyodu hazırlanıyor'}
            </span>
          </div>

          <div className="tp-era5-legend">
            <span>Düşük</span>
            <i />
            <span>Yüksek</span>
          </div>

          {status === 'loading' && (
            <div className="tp-era5-overlay"><b /> <strong>ERA5 grid verisi hazırlanıyor</strong></div>
          )}

          {status === 'error' && (
            <div className="tp-era5-overlay error">
              <strong>Harita yüklenemedi</strong>
              <span>{message}</span>
            </div>
          )}
        </section>

        <section className="tp-era5-stats">
          <article>
            <small>ORTALAMA</small>
            <strong>{finite(stats?.average) === null ? '—' : `${finite(stats?.average)!.toFixed(variable.includes('moisture') ? 3 : 1)} ${unit}`}</strong>
          </article>
          <article>
            <small>MİNİMUM</small>
            <strong>{finite(stats?.min) === null ? '—' : `${finite(stats?.min)!.toFixed(variable.includes('moisture') ? 3 : 1)} ${unit}`}</strong>
          </article>
          <article>
            <small>MAKSİMUM</small>
            <strong>{finite(stats?.max) === null ? '—' : `${finite(stats?.max)!.toFixed(variable.includes('moisture') ? 3 : 1)} ${unit}`}</strong>
          </article>
          <article>
            <small>GRID</small>
            <strong>{result?.resolutionDegrees ? `~${result.resolutionDegrees}°` : '—'}</strong>
          </article>
        </section>

        <section className="tp-era5-info">
          <strong>Bölgesel yeniden analiz haritası</strong>
          <p>
            Bu ekran tarla içi sensör veya metre ölçeğinde uydu haritası değildir. ERA5-Land yaklaşık 0.1°,
            ERA5 yağış yaklaşık 0.25° grid kullanır. Tarla sınırı referans amacıyla haritanın üzerinde gösterilir.
          </p>
        </section>
      </main>
    </div>
  );
}

const ERA5_MAP_STYLES = `
  .tp-era5-page,.tp-era5-page *{box-sizing:border-box}
  .tp-era5-page{min-height:100vh;background:#0a0f0d;color:#aebdb2;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .tp-era5-topbar{height:76px;display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:14px;padding:0 24px;border-bottom:1px solid #1e2c24;background:#0c120e;position:sticky;top:0;z-index:20}
  .tp-era5-topbar small{display:block;color:#708176;font-size:8px;font-weight:800;letter-spacing:.14em}.tp-era5-topbar h1{margin:3px 0 0;color:#e6e1d5;font-family:Georgia,serif;font-size:22px;font-weight:500}
  .tp-era5-back{width:38px;height:38px;border:1px solid #2a3b30;border-radius:12px;background:#121a15;color:#d2e7d6;font-size:20px;cursor:pointer}.tp-era5-source{border:1px solid #2a3b30;border-radius:999px;padding:7px 10px;color:#9faf9f;font-size:8px}
  .tp-era5-main{width:min(1180px,calc(100% - 36px));margin:0 auto;padding:20px 0 60px}.tp-era5-controls{display:grid;grid-template-columns:1.1fr 1.25fr .72fr auto;gap:10px;padding:14px;border:1px solid #1f2e25;border-radius:18px;background:#121a15}
  .tp-era5-controls label>span{display:block;margin:0 0 5px;color:#6f8075;font-size:7px;font-weight:800;letter-spacing:.1em}.tp-era5-controls select{width:100%;height:40px;border:1px solid #293a30;border-radius:11px;padding:0 10px;background:#0c120e;color:#d3ddd5;font:inherit;font-size:10px;outline:none}.tp-era5-controls button{align-self:end;height:40px;border:1px solid #405844;border-radius:11px;padding:0 15px;background:#1b2920;color:#d8e6da;font:inherit;font-size:9px;font-weight:800;cursor:pointer}.tp-era5-controls button:disabled{opacity:.55;cursor:wait}
  .tp-era5-map-card{position:relative;margin-top:14px;overflow:hidden;border:1px solid #26382d;border-radius:22px;background:#0e1511}.tp-era5-map{height:min(66vh,680px);min-height:480px}.tp-era5-map-title{position:absolute;left:16px;top:16px;z-index:5;min-width:210px;border:1px solid rgba(92,119,100,.42);border-radius:14px;padding:11px 13px;background:rgba(9,15,11,.84);backdrop-filter:blur(12px)}.tp-era5-map-title small,.tp-era5-map-title span{display:block;color:#819187;font-size:8px}.tp-era5-map-title strong{display:block;margin:3px 0;color:#e5dfd0;font-family:Georgia,serif;font-size:16px;font-weight:500}
  .tp-era5-legend{position:absolute;left:16px;bottom:16px;z-index:5;display:grid;grid-template-columns:auto 150px auto;align-items:center;gap:8px;border:1px solid rgba(92,119,100,.42);border-radius:12px;padding:9px 11px;background:rgba(9,15,11,.84);backdrop-filter:blur(12px);font-size:7px}.tp-era5-legend i{height:7px;border-radius:999px;background:linear-gradient(90deg,rgb(57,49,35),rgb(157,132,71),rgb(61,113,80))}
  .tp-era5-overlay{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(8,13,10,.58);backdrop-filter:blur(2px);color:#dfe7df}.tp-era5-overlay b{width:18px;height:18px;border:2px solid #4e6655;border-top-color:#d2e7d6;border-radius:50%;animation:tp-era5-spin .8s linear infinite}.tp-era5-overlay.error{flex-direction:column;color:#e1c0aa}.tp-era5-overlay.error span{font-size:9px}@keyframes tp-era5-spin{to{transform:rotate(360deg)}}
  .tp-era5-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.tp-era5-stats article{border:1px solid #1f2e25;border-radius:15px;padding:13px 14px;background:#121a15}.tp-era5-stats small{display:block;color:#697a6f;font-size:7px;font-weight:800;letter-spacing:.09em}.tp-era5-stats strong{display:block;margin-top:5px;color:#e1ded4;font-family:Georgia,serif;font-size:17px;font-weight:500}
  .tp-era5-info{margin-top:12px;border:1px solid #1f2e25;border-radius:15px;padding:14px 16px;background:#0e1511}.tp-era5-info strong{color:#cbd5cd;font-size:10px}.tp-era5-info p{margin:5px 0 0;color:#738379;font-size:9px;line-height:1.55}
  .maplibregl-popup-content{border-radius:10px!important}.maplibregl-ctrl-group{background:#111b15!important}.maplibregl-ctrl-group button{filter:invert(.82)}
  @media(max-width:760px){.tp-era5-topbar{height:66px;padding:0 10px;grid-template-columns:38px 1fr}.tp-era5-source{display:none}.tp-era5-topbar h1{font-size:17px}.tp-era5-main{width:min(100% - 16px,1180px);padding-top:10px}.tp-era5-controls{grid-template-columns:1fr 1fr}.tp-era5-controls label:first-child{grid-column:1/-1}.tp-era5-controls button{grid-column:1/-1}.tp-era5-map{height:58vh;min-height:420px}.tp-era5-map-title{left:10px;top:10px;min-width:180px}.tp-era5-legend{left:10px;bottom:10px;grid-template-columns:auto 90px auto}.tp-era5-stats{grid-template-columns:1fr 1fr}.tp-era5-stats strong{font-size:14px}}
`;
