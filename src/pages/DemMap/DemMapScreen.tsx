import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../../lib/mapRuntime';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Field } from '../../types';
import {
  fetchDemTerrainProfile,
  type DemGridCell,
  type DemTerrainProfile,
} from '../../services/demService';

maplibregl.setWorkerUrl(workerUrl);

type Props = {
  fields: Field[];
  selectedFieldId?: string;
  onFieldChange?: (id: string) => void;
  onBack: () => void;
};

type Variable = 'elevation' | 'slope' | 'aspect';

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

function ramp(ratio: number) {
  const stops = [
    [35, 68, 52],
    [79, 105, 68],
    [145, 128, 75],
    [139, 91, 54],
    [98, 58, 46],
  ];

  const x =
    Math.max(0, Math.min(1, ratio)) *
    (stops.length - 1);

  const a = Math.floor(x);
  const b = Math.min(stops.length - 1, a + 1);
  const t = x - a;

  const rgb = stops[a].map((value, index) =>
    Math.round(
      value + (stops[b][index] - value) * t,
    ),
  );

  return `rgb(${rgb.join(',')})`;
}

function aspectColor(label: string) {
  const colors: Record<string, string> = {
    K: '#36576c',
    KD: '#466e67',
    D: '#687b55',
    GD: '#948151',
    G: '#9a6448',
    GB: '#75536b',
    B: '#4c5575',
    KB: '#3c5b70',
  };

  return colors[label] ?? '#4c554d';
}

function gridGeoJson(
  cells: DemGridCell[],
  variable: Variable,
  min: number | null,
  max: number | null,
  step: number,
): GeoJSON.FeatureCollection {
  const range =
    min !== null && max !== null
      ? max - min
      : 0;

  return {
    type: 'FeatureCollection',
    features: cells.flatMap((cell) => {
      const value =
        variable === 'elevation'
          ? cell.elevationM
          : variable === 'slope'
            ? cell.slopeDeg
            : cell.aspectDeg;

      if (value === null) return [];

      const latHalf = step / 111_320 / 2;

      const cosLat = Math.max(
        0.15,
        Math.cos((cell.latitude * Math.PI) / 180),
      );

      const lonHalf =
        step / (111_320 * cosLat) / 2;

      let fill = '#566354';

      if (variable === 'elevation') {
        fill = ramp(
          range > 0
            ? (value - (min ?? value)) / range
            : 0.5,
        );
      } else if (variable === 'slope') {
        fill = ramp(Math.min(1, value / 25));
      } else {
        fill = aspectColor(cell.aspectLabel);
      }

      return [
        {
          type: 'Feature',
          properties: {
            fill,
            elevationM: cell.elevationM,
            slopeDeg: cell.slopeDeg,
            aspectDeg: cell.aspectDeg,
            aspectLabel: cell.aspectLabel,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [
                cell.longitude - lonHalf,
                cell.latitude - latHalf,
              ],
              [
                cell.longitude + lonHalf,
                cell.latitude - latHalf,
              ],
              [
                cell.longitude + lonHalf,
                cell.latitude + latHalf,
              ],
              [
                cell.longitude - lonHalf,
                cell.latitude + latHalf,
              ],
              [
                cell.longitude - lonHalf,
                cell.latitude - latHalf,
              ],
            ]],
          },
        } as GeoJSON.Feature,
      ];
    }),
  };
}

function metric(
  value: number | null | undefined,
  suffix = '',
) {
  return value === null || value === undefined
    ? '—'
    : `${value}${suffix}`;
}

function legendItems(
  variable: Variable,
  profile: DemTerrainProfile | null,
) {
  if (variable === 'elevation') {
    const min = profile?.stats.minElevationM ?? null;
    const max = profile?.stats.maxElevationM ?? null;

    if (min === null || max === null) {
      return [
        { label: 'Düşük rakım', color: ramp(0) },
        { label: 'Orta rakım', color: ramp(0.5) },
        { label: 'Yüksek rakım', color: ramp(1) },
      ];
    }

    const range = max - min;

    return [
      {
        label: `${Math.round(min)} m`,
        color: ramp(0),
      },
      {
        label: `${Math.round(min + range * 0.25)} m`,
        color: ramp(0.25),
      },
      {
        label: `${Math.round(min + range * 0.5)} m`,
        color: ramp(0.5),
      },
      {
        label: `${Math.round(min + range * 0.75)} m`,
        color: ramp(0.75),
      },
      {
        label: `${Math.round(max)} m`,
        color: ramp(1),
      },
    ];
  }

  if (variable === 'slope') {
    return [
      { label: '0–2° Düz / çok hafif', color: ramp(0.04) },
      { label: '2–5° Hafif eğim', color: ramp(0.16) },
      { label: '5–10° Orta eğim', color: ramp(0.32) },
      { label: '10–15° Belirgin eğim', color: ramp(0.5) },
      { label: '15–25° Dik', color: ramp(0.8) },
      { label: '25°+ Çok dik', color: ramp(1) },
    ];
  }

  return [
    { label: 'Kuzey (K)', color: aspectColor('K') },
    { label: 'Kuzeydoğu (KD)', color: aspectColor('KD') },
    { label: 'Doğu (D)', color: aspectColor('D') },
    { label: 'Güneydoğu (GD)', color: aspectColor('GD') },
    { label: 'Güney (G)', color: aspectColor('G') },
    { label: 'Güneybatı (GB)', color: aspectColor('GB') },
    { label: 'Batı (B)', color: aspectColor('B') },
    { label: 'Kuzeybatı (KB)', color: aspectColor('KB') },
  ];
}

export default function DemMapScreen({
  fields,
  selectedFieldId = '',
  onFieldChange = () => undefined,
  onBack,
}: Props) {
  const safeFields =
    Array.isArray(fields) ? fields : [];

  const [fieldId, setFieldId] = useState(
    selectedFieldId ||
      String(safeFields[0]?.id ?? ''),
  );

  const [variable, setVariable] =
    useState<Variable>('elevation');

  const [status, setStatus] =
    useState<
      'idle' | 'loading' | 'ready' | 'error'
    >('idle');

  const [message, setMessage] = useState('');
  const [profile, setProfile] =
    useState<DemTerrainProfile | null>(null);

  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<Map | null>(null);

  const selectedField = useMemo(
    () =>
      safeFields.find(
        (field) =>
          String(field.id) === String(fieldId),
      ) ??
      safeFields[0] ??
      null,
    [safeFields, fieldId],
  );

  const coords = useMemo(
    () => coordinates(selectedField),
    [selectedField],
  );

  const legend = useMemo(
    () => legendItems(variable, profile),
    [variable, profile],
  );

  useEffect(() => {
    if (selectedFieldId) {
      setFieldId(selectedFieldId);
    }
  }, [selectedFieldId]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) {
      return;
    }

    const start =
      coords ?? {
        latitude: 39,
        longitude: 35,
      };

    const map = new mapRuntime.Map({
      container: mapContainer.current,
      center: [
        start.longitude,
        start.latitude,
      ],
      zoom: coords ? 14 : 5.2,
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
            attribution:
              '© OpenStreetMap contributors',
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

    map.addControl(
      new mapRuntime.NavigationControl(),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('dem-grid', {
        type: 'geojson',
        data: EMPTY,
      });

      map.addLayer({
        id: 'dem-grid-fill',
        type: 'fill',
        source: 'dem-grid',
        paint: {
          'fill-color': ['get', 'fill'],
          'fill-opacity': 0.72,
        },
      });

      map.addLayer({
        id: 'dem-grid-line',
        type: 'line',
        source: 'dem-grid',
        paint: {
          'line-color': '#d0c184',
          'line-opacity': 0.4,
          'line-width': 0.7,
        },
      });

      map.addSource('dem-parcel', {
        type: 'geojson',
        data: parcel(selectedField),
      });

      map.addLayer({
        id: 'dem-parcel-fill',
        type: 'fill',
        source: 'dem-parcel',
        paint: {
          'fill-color': '#eadc98',
          'fill-opacity': 0.07,
        },
      });

      map.addLayer({
        id: 'dem-parcel-line',
        type: 'line',
        source: 'dem-parcel',
        paint: {
          'line-color': '#eadc98',
          'line-width': 2.4,
          'line-opacity': 0.95,
        },
      });

      map.on(
        'click',
        'dem-grid-fill',
        (event) => {
          const properties =
            event.features?.[0]?.properties as
              | Record<string, unknown>
              | undefined;

          if (!properties) return;

          new mapRuntime.Popup({
            closeButton: false,
            offset: 8,
          })
            .setLngLat(event.lngLat)
            .setHTML(
              `<div style="font:12px system-ui;color:#172019">
                <strong>Arazi Profili</strong><br/>
                Rakım: ${properties.elevationM ?? '—'} m<br/>
                Eğim: ${properties.slopeDeg ?? '—'}°<br/>
                Bakı: ${properties.aspectLabel ?? '—'} ${properties.aspectDeg ?? ''}°
              </div>`,
            )
            .addTo(map);
        },
      );

      map.on(
        'mouseenter',
        'dem-grid-fill',
        () => {
          map.getCanvas().style.cursor =
            'pointer';
        },
      );

      map.on(
        'mouseleave',
        'dem-grid-fill',
        () => {
          map.getCanvas().style.cursor = '';
        },
      );
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
        map.getSource(
          'dem-parcel',
        ) as GeoJSONSource | undefined
      )?.setData(parcel(selectedField));
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('load', update);
    }
  }, [selectedField]);

  useEffect(() => {
    if (!coords) {
      setStatus('error');
      setProfile(null);
      setMessage(
        'Seçili tarlada koordinat bulunamadı.',
      );
      return;
    }

    const controller =
      new AbortController();

    setStatus('loading');
    setMessage('');

    void fetchDemTerrainProfile(
      coords.latitude,
      coords.longitude,
      {
        gridSize: 9,
        stepMeters: 90,
        signal: controller.signal,
      },
    )
      .then((data) => {
        setProfile(data);
        setStatus('ready');

        mapRef.current?.easeTo({
          center: [
            coords.longitude,
            coords.latitude,
          ],
          zoom: 14.3,
          duration: 650,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setStatus('error');
        setProfile(null);
        setMessage(
          error instanceof Error
            ? error.message
            : 'DEM arazi verisi alınamadı.',
        );
      });

    return () => controller.abort();
  }, [
    coords?.latitude,
    coords?.longitude,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !profile) return;

    const data = gridGeoJson(
      profile.cells,
      variable,
      profile.stats.minElevationM,
      profile.stats.maxElevationM,
      profile.stepMeters,
    );

    const update = () => {
      (
        map.getSource(
          'dem-grid',
        ) as GeoJSONSource | undefined
      )?.setData(data);
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('load', update);
    }
  }, [profile, variable]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={onBack}
          style={styles.back}
        >
          ←
        </button>

        <div>
          <small style={styles.kicker}>
            HARİTALAR / ARAZİ
          </small>

          <h1 style={styles.title}>
            DEM Arazi Haritası
          </h1>
        </div>

        <span style={styles.source}>
          Copernicus GLO-90 · 90 m
        </span>
      </header>

      <section style={styles.toolbar}>
        <label style={styles.control}>
          <span>TARLA</span>

          <select
            value={String(fieldId)}
            onChange={(event) => {
              setFieldId(event.target.value);
              onFieldChange(event.target.value);
            }}
            style={styles.select}
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

        <div style={styles.tabs}>
          {([
            ['elevation', 'Rakım'],
            ['slope', 'Eğim'],
            ['aspect', 'Bakı'],
          ] as const).map(
            ([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() =>
                  setVariable(value)
                }
                style={{
                  ...styles.tab,
                  ...(variable === value
                    ? styles.tabActive
                    : {}),
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </section>

      <section style={styles.legendShell}>
        <div style={styles.legendHeader}>
          <div>
            <small style={styles.legendKicker}>RENK AÇIKLAMASI</small>
            <strong style={styles.legendTitle}>
              {variable === 'elevation'
                ? 'Rakım renkleri'
                : variable === 'slope'
                  ? 'Eğim renkleri'
                  : 'Bakı yönleri'}
            </strong>
          </div>

          <span style={styles.legendHint}>
            {variable === 'elevation'
              ? 'Yeşilden kahverengiye doğru gidildikçe rakım yükselir.'
              : variable === 'slope'
                ? 'Yeşil tonlar daha düz; sarı-kahve tonlar daha dik araziyi gösterir.'
                : 'Renkler, arazinin baktığı yönü (bakı) gösterir.'}
          </span>
        </div>

        <div style={styles.legendItems}>
          {legend.map((item) => (
            <div key={item.label} style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendSwatch,
                  background: item.color,
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.mapShell}>
        <div
          ref={mapContainer}
          style={styles.map}
        />

        {status === 'loading' && (
          <div style={styles.overlay}>
            <strong>
              Arazi modeli hazırlanıyor…
            </strong>

            <span>
              81 noktadan rakım, eğim ve
              bakı hesaplanıyor.
            </span>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.overlay}>
            <strong>
              Harita verisi alınamadı
            </strong>

            <span>{message}</span>
          </div>
        )}
      </section>

      <section style={styles.metrics}>
        <article style={styles.metric}>
          <small>MERKEZ RAKIM</small>
          <strong>
            {metric(
              profile?.stats.centerElevationM,
              ' m',
            )}
          </strong>
        </article>

        <article style={styles.metric}>
          <small>RAKIM ARALIĞI</small>

          <strong>
            {profile
              ? `${metric(
                  profile.stats.minElevationM,
                )}–${metric(
                  profile.stats.maxElevationM,
                )} m`
              : '—'}
          </strong>
        </article>

        <article style={styles.metric}>
          <small>ARAZİ FARKI</small>

          <strong>
            {metric(
              profile?.stats.reliefM,
              ' m',
            )}
          </strong>
        </article>

        <article style={styles.metric}>
          <small>ORT. EĞİM</small>

          <strong>
            {metric(
              profile?.stats.averageSlopeDeg,
              '°',
            )}
          </strong>
        </article>

        <article style={styles.metric}>
          <small>HAKİM BAKI</small>

          <strong>
            {profile?.stats.dominantAspect ??
              '—'}
          </strong>
        </article>
      </section>

      <section style={styles.note}>
        <strong>DEM neyi gösteriyor?</strong>

        <p>
          Copernicus DEM GLO-90 yaklaşık
          90 m çözünürlüklü sayısal
          yükseklik modelidir. Eğim ve
          bakı komşu yükseklik
          noktalarından hesaplanır. Bu
          ekran RTK/GNSS, hassas tesviye
          veya parsel içi mühendislik
          ölçümü yerine geçmez.
        </p>
      </section>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: '100vh',
    background: '#08100b',
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
    gap: 12,
    alignItems: 'end',
    justifyContent: 'space-between',
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

  tabs: {
    display: 'flex',
    gap: 7,
    padding: 4,
    border: '1px solid #25382c',
    borderRadius: 12,
    background: '#0b1510',
  },

  tab: {
    minWidth: 82,
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

  legendShell: {
    margin: '0 22px 12px',
    border: '1px solid #273a2e',
    borderRadius: 14,
    padding: '12px 14px',
    background: '#0b1510',
  },

  legendHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 10,
  },

  legendKicker: {
    display: 'block',
    marginBottom: 3,
    color: '#728676',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: '.12em',
  },

  legendTitle: {
    color: '#d8d2ba',
    fontSize: 12,
  },

  legendHint: {
    maxWidth: 520,
    color: '#7f9184',
    fontSize: 10,
    lineHeight: 1.4,
  },

  legendItems: {
    display: 'flex',
    gap: '8px 14px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 24,
    padding: '3px 7px 3px 4px',
    border: '1px solid rgba(116, 139, 119, .20)',
    borderRadius: 8,
    background: 'rgba(17, 29, 21, .72)',
    color: '#aab7ad',
    fontSize: 10,
    whiteSpace: 'nowrap',
  },

  legendSwatch: {
    display: 'inline-block',
    flex: '0 0 auto',
    width: 24,
    height: 14,
    borderRadius: 4,
    border: '1px solid rgba(232, 221, 173, .38)',
    boxShadow:
      'inset 0 0 0 1px rgba(0,0,0,.18), 0 0 8px rgba(0,0,0,.16)',
  },

  mapShell: {
    position: 'relative',
    margin: '0 22px',
    height: 'min(64vh, 650px)',
    minHeight: 430,
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
    background: 'rgba(6, 12, 8, .58)',
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
