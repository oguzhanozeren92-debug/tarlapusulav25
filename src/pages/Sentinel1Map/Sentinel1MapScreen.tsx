import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../../lib/mapRuntime';
import type { GeoJSONSource, ImageSource, Map } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Field } from '../../types';
import {
  fetchSentinel1Radar,
  type Sentinel1RadarMode,
  type Sentinel1RadarResponse,
} from '../../services/sentinel1Service';

maplibregl.setWorkerUrl(workerUrl);

type Props = {
  fields: Field[];
  selectedFieldId?: string;
  onFieldChange?: (id: string) => void;
  onBack: () => void;
};

const EMPTY: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function finite(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordinates(field?: Field | null) {
  if (!field) return null;

  const latitude = finite(
    field.parcelCentroidLat ?? field.latitude,
  );
  const longitude = finite(
    field.parcelCentroidLng ?? field.longitude,
  );

  if (latitude === null || longitude === null) return null;

  return { latitude, longitude };
}

function parcel(field?: Field | null): GeoJSON.FeatureCollection {
  const geometry = field?.parcelGeometry;

  if (!geometry) return EMPTY;

  return {
    type: 'FeatureCollection',
    features: [
      geometry.type === 'Feature'
        ? geometry
        : {
            type: 'Feature',
            properties: {},
            geometry,
          },
    ],
  } as GeoJSON.FeatureCollection;
}

function bboxCoordinates(
  bbox: [number, number, number, number],
): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const [west, south, east, north] = bbox;

  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

const MODES: Array<{
  value: Sentinel1RadarMode;
  label: string;
  explanation: string;
}> = [
  {
    value: 'composite',
    label: 'Radar Kompozit',
    explanation:
      'VV, VH ve polarizasyon oranını birlikte gösterir. Arazi yüzeyi ile bitki/yapı farklarını hızlı karşılaştırmak içindir.',
  },
  {
    value: 'vv',
    label: 'VV',
    explanation:
      'VV geri saçılım yoğunluğu. Yüzey pürüzlülüğü, nem, bitki ve geometri birlikte etkiler.',
  },
  {
    value: 'vh',
    label: 'VH',
    explanation:
      'VH çapraz polarizasyon. Bitki örtüsü ve hacimsel saçılım değişimlerine daha duyarlıdır.',
  },
  {
    value: 'water',
    label: 'Su Adayı',
    explanation:
      'Düşük radar geri saçılımına göre sakin/açık su olabilecek alanları mavi tonla öne çıkarır. Kesin taşkın tespiti değildir.',
  },
];

function legend(mode: Sentinel1RadarMode) {
  if (mode === 'water') {
    return [
      { color: '#163c63', label: 'Daha güçlü su adayı' },
      { color: '#315e62', label: 'Geçiş / belirsiz' },
      { color: '#6e7e54', label: 'Kara / yüksek saçılım' },
    ];
  }

  if (mode === 'vv') {
    return [
      { color: '#171c19', label: 'Düşük geri saçılım' },
      { color: '#777d79', label: 'Orta' },
      { color: '#eceeec', label: 'Yüksek geri saçılım' },
    ];
  }

  if (mode === 'vh') {
    return [
      { color: '#14211d', label: 'Düşük VH' },
      { color: '#24715d', label: 'Orta VH' },
      { color: '#92dfbd', label: 'Yüksek VH' },
    ];
  }

  return [
    { color: '#c76b5b', label: 'VV baskın' },
    { color: '#5db077', label: 'VH / bitki-yapı sinyali' },
    { color: '#6c72d8', label: 'Polarizasyon oranı' },
  ];
}

export default function Sentinel1MapScreen({
  fields,
  selectedFieldId = '',
  onFieldChange = () => undefined,
  onBack,
}: Props) {
  const safeFields = Array.isArray(fields) ? fields : [];

  const [fieldId, setFieldId] = useState(
    selectedFieldId || String(safeFields[0]?.id ?? ''),
  );
  const [mode, setMode] =
    useState<Sentinel1RadarMode>('composite');
  const [days, setDays] = useState(30);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [data, setData] =
    useState<Sentinel1RadarResponse | null>(null);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const selectedField = useMemo(
    () =>
      safeFields.find(
        (field) => String(field.id) === String(fieldId),
      ) ??
      safeFields[0] ??
      null,
    [safeFields, fieldId],
  );

  const coords = useMemo(
    () => coordinates(selectedField),
    [selectedField],
  );

  const modeMeta =
    MODES.find((item) => item.value === mode) ?? MODES[0];

  useEffect(() => {
    if (selectedFieldId) {
      setFieldId(selectedFieldId);
    }
  }, [selectedFieldId]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const start = coords ?? {
      latitude: 39,
      longitude: 35,
    };

    const map = new mapRuntime.Map({
      container: mapContainer.current,
      center: [start.longitude, start.latitude],
      zoom: coords ? 13.5 : 5.2,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
    });

    map.addControl(new mapRuntime.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('s1-parcel', {
        type: 'geojson',
        data: parcel(selectedField),
      });

      map.addLayer({
        id: 's1-parcel-fill',
        type: 'fill',
        source: 's1-parcel',
        paint: {
          'fill-color': '#eadc98',
          'fill-opacity': 0.05,
        },
      });

      map.addLayer({
        id: 's1-parcel-line',
        type: 'line',
        source: 's1-parcel',
        paint: {
          'line-color': '#f0dc8b',
          'line-width': 2.5,
          'line-opacity': 0.95,
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      (
        map.getSource('s1-parcel') as GeoJSONSource | undefined
      )?.setData(parcel(selectedField));
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [selectedField]);

  useEffect(() => {
    if (!coords) {
      setStatus('error');
      setMessage('Seçili tarlada koordinat bulunamadı.');
      setData(null);
      return;
    }

    let active = true;

    setStatus('loading');
    setMessage('');

    void fetchSentinel1Radar(
      coords.latitude,
      coords.longitude,
      {
        mode,
        days,
        radiusKm: 2,
      },
    )
      .then((result) => {
        if (!active) return;

        setData(result);
        setStatus('ready');
      })
      .catch((error) => {
        if (!active) return;

        setData(null);
        setStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Sentinel-1 radar görüntüsü alınamadı.',
        );
      });

    return () => {
      active = false;
    };
  }, [coords?.latitude, coords?.longitude, mode, days]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    const update = () => {
      if (map.getLayer('s1-radar-layer')) {
        map.removeLayer('s1-radar-layer');
      }

      if (map.getSource('s1-radar')) {
        map.removeSource('s1-radar');
      }

      map.addSource('s1-radar', {
        type: 'image',
        url: data.imageDataUrl,
        coordinates: bboxCoordinates(data.bbox),
      });

      map.addLayer(
        {
          id: 's1-radar-layer',
          type: 'raster',
          source: 's1-radar',
          paint: {
            'raster-opacity': 0.78,
            'raster-resampling': 'linear',
          },
        },
        's1-parcel-fill',
      );

      const [west, south, east, north] = data.bbox;

      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: 42,
          duration: 650,
        },
      );
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [data]);

  return (
    <main style={s.page}>
      <header style={s.header}>
        <button type="button" onClick={onBack} style={s.back}>
          ←
        </button>

        <div>
          <small style={s.kicker}>HARİTALAR / RADAR</small>
          <h1 style={s.title}>Sentinel-1 Radar Haritası</h1>
        </div>

        <span style={s.source}>Sentinel-1 GRD · C-band SAR</span>
      </header>

      <section style={s.toolbar}>
        <label style={s.control}>
          <span>TARLA</span>
          <select
            value={String(fieldId)}
            onChange={(event) => {
              setFieldId(event.target.value);
              onFieldChange(event.target.value);
            }}
            style={s.select}
          >
            {safeFields.map((field) => (
              <option
                key={String(field.id)}
                value={String(field.id)}
              >
                {field.name}
              </option>
            ))}
          </select>
        </label>

        <label style={s.control}>
          <span>DÖNEM</span>
          <select
            value={days}
            onChange={(event) =>
              setDays(Number(event.target.value))
            }
            style={s.selectSmall}
          >
            <option value={12}>Son 12 gün</option>
            <option value={24}>Son 24 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={45}>Son 45 gün</option>
          </select>
        </label>

        <div style={s.tabs}>
          {MODES.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => setMode(item.value)}
              style={{
                ...s.tab,
                ...(mode === item.value ? s.tabActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section style={s.legend}>
        <div>
          <small style={s.legendKicker}>RENK AÇIKLAMASI</small>
          <strong style={s.legendTitle}>{modeMeta.label}</strong>
          <p style={s.legendText}>{modeMeta.explanation}</p>
        </div>

        <div style={s.legendItems}>
          {legend(mode).map((item) => (
            <span key={item.label} style={s.legendItem}>
              <i
                style={{
                  ...s.swatch,
                  background: item.color,
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section style={s.mapShell}>
        <div ref={mapContainer} style={s.map} />

        {status === 'loading' && (
          <div style={s.overlay}>
            <strong>Sentinel-1 radar görüntüsü hazırlanıyor…</strong>
            <span>
              Bulutsuz/gece-gündüz çalışan SAR verisi işleniyor.
            </span>
          </div>
        )}

        {status === 'error' && (
          <div style={s.overlay}>
            <strong>Radar görüntüsü alınamadı</strong>
            <span>{message}</span>
          </div>
        )}
      </section>

      <section style={s.metrics}>
        <article style={s.metric}>
          <small>KAYNAK</small>
          <strong>Sentinel-1 GRD</strong>
        </article>

        <article style={s.metric}>
          <small>POLARİZASYON</small>
          <strong>{data?.processing.polarization ?? 'VV + VH'}</strong>
        </article>

        <article style={s.metric}>
          <small>MOD</small>
          <strong>{modeMeta.label}</strong>
        </article>

        <article style={s.metric}>
          <small>ARAMA PENCERESİ</small>
          <strong>{days} gün</strong>
        </article>
      </section>

      <section style={s.note}>
        <strong>Önemli yorumlama notu</strong>
        <p>
          Sentinel-1 doğrudan “toprak nem yüzdesi” ölçmez. Radar geri
          saçılımı toprak nemi yanında bitki örtüsü, yüzey pürüzlülüğü,
          sürüm durumu, eğim ve bakış geometrisinden de etkilenir. Bu nedenle
          “Su Adayı” ve diğer radar görünümleri Pusula için bölgesel sinyal ve
          değişim göstergesi olarak kullanılmalı; arazi gözlemiyle
          doğrulanmalıdır.
        </p>
      </section>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#07100b',
    color: '#dbe4dc',
    paddingBottom: 28,
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    minHeight: 76,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 22px',
    borderBottom: '1px solid #203026',
    background: '#09120d',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    border: '1px solid #2c4033',
    background: '#0e1a13',
    color: '#cbd8ce',
    cursor: 'pointer',
  },
  kicker: {
    color: '#778f7c',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '.13em',
  },
  title: {
    margin: '2px 0 0',
    color: '#e4decc',
    fontFamily: 'Georgia, serif',
    fontSize: 24,
    fontWeight: 500,
  },
  source: {
    marginLeft: 'auto',
    border: '1px solid #2b4032',
    borderRadius: 999,
    padding: '7px 10px',
    color: '#9fb2a2',
    fontSize: 10,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'end',
    gap: 10,
    padding: '14px 22px',
    flexWrap: 'wrap',
  },
  control: {
    display: 'grid',
    gap: 5,
    color: '#7f9184',
    fontSize: 9,
    fontWeight: 800,
  },
  select: {
    minWidth: 220,
    height: 38,
    border: '1px solid #2c4033',
    borderRadius: 11,
    background: '#0d1811',
    color: '#d3ddd5',
    padding: '0 10px',
  },
  selectSmall: {
    minWidth: 130,
    height: 38,
    border: '1px solid #2c4033',
    borderRadius: 11,
    background: '#0d1811',
    color: '#d3ddd5',
    padding: '0 10px',
  },
  tabs: {
    display: 'flex',
    gap: 6,
    marginLeft: 'auto',
    padding: 4,
    border: '1px solid #25382c',
    borderRadius: 12,
    background: '#0b1510',
    flexWrap: 'wrap',
  },
  tab: {
    minWidth: 92,
    height: 32,
    border: '1px solid transparent',
    borderRadius: 9,
    background: 'transparent',
    color: '#819187',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 800,
  },
  tabActive: {
    borderColor: '#43583f',
    background: '#19251a',
    color: '#d9d3b7',
  },
  legend: {
    margin: '0 22px 12px',
    border: '1px solid #273a2e',
    borderRadius: 14,
    padding: '12px 14px',
    background: '#0b1510',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  legendKicker: {
    display: 'block',
    color: '#728676',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: '.12em',
  },
  legendTitle: {
    display: 'block',
    marginTop: 2,
    color: '#d8d2ba',
    fontSize: 12,
  },
  legendText: {
    maxWidth: 700,
    margin: '4px 0 0',
    color: '#819288',
    fontSize: 10,
    lineHeight: 1.45,
  },
  legendItems: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#a8b5ac',
    fontSize: 10,
  },
  swatch: {
    display: 'inline-block',
    width: 22,
    height: 13,
    borderRadius: 4,
    border: '1px solid rgba(232,221,173,.32)',
  },
  mapShell: {
    position: 'relative',
    margin: '0 22px',
    height: 'min(65vh, 660px)',
    minHeight: 440,
    overflow: 'hidden',
    border: '1px solid #273a2e',
    borderRadius: 20,
    background: '#0b1510',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeContent: 'center',
    justifyItems: 'center',
    gap: 7,
    textAlign: 'center',
    padding: 24,
    background: 'rgba(6,12,8,.62)',
    backdropFilter: 'blur(2px)',
    color: '#d8d3bd',
    pointerEvents: 'none',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(145px, 1fr))',
    gap: 10,
    margin: '12px 22px 0',
  },
  metric: {
    border: '1px solid #26392d',
    borderRadius: 14,
    padding: 13,
    background: '#0d1811',
  },
  note: {
    margin: '12px 22px 0',
    border: '1px solid #2a3c30',
    borderRadius: 15,
    padding: '13px 15px',
    background: '#0b1510',
    color: '#86998b',
    fontSize: 11,
    lineHeight: 1.55,
  },
};
