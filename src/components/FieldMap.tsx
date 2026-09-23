import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../lib/mapRuntime';
import type { GeoJSONSource, Map } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { createSatelliteRasterSource, vividSatellitePaint } from '../lib/mapStyle';
maplibregl.setWorkerUrl(workerUrl);

type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export type ParcelFeature = GeoJSON.Feature<PolygonGeometry>;

export type FieldSectionMapItem = {
  id: string;
  name: string;
  crop: string;
  geometry: ParcelFeature;
};

type FieldMapProps = {
  parcelGeometry?: ParcelFeature | null;

  sections?: FieldSectionMapItem[];

  initialCenter?: [number, number];

  initialZoom?: number;

  height?: number | string;

  drawEnabled?: boolean;

  onSectionDrawn?: (result: {
    geometry: ParcelFeature;
    areaSquareMeters: number;
    areaDecare: number;
  }) => void;
};

type MapMode = 'street' | 'satellite';

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const TURKEY_CENTER: [number, number] = [35.2433, 38.9637];

export default function FieldMap({
  parcelGeometry = null,
  sections = [],
  initialCenter = TURKEY_CENTER,
  initialZoom = 5.3,
  height = 520,
  drawEnabled = true,
  onSectionDrawn,
}: FieldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const [mapMode, setMapMode] = useState<MapMode>('satellite');

  const [drawing, setDrawing] = useState(false);

  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);

  const [drawMessage, setDrawMessage] = useState('');

  const [lastAreaDecare, setLastAreaDecare] = useState<number | null>(null);

  const sectionCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: sections.map((section) => ({
        ...section.geometry,
        properties: {
          ...(section.geometry.properties ?? {}),
          id: section.id,
          name: section.name,
          crop: section.crop,
        },
      })),
    };
  }, [sections]);

  const drawingCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];

    if (drawPoints.length > 0) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: drawPoints,
        },
      });

      for (const coordinate of drawPoints) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: coordinate,
          },
        });
      }
    }

    if (drawPoints.length >= 3) {
      const closedCoordinates = [...drawPoints, drawPoints[0]];

      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoordinates],
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [drawPoints]);

  const updateSource = (
    sourceId: string,
    data: GeoJSON.Feature | GeoJSON.FeatureCollection | null,
  ) => {
    const map = mapRef.current;

    if (!map) return;

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (!source) return;

    source.setData(data ?? EMPTY_COLLECTION);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapRuntime.Map({
      container: mapContainerRef.current,

      center: initialCenter,

      zoom: initialZoom,

      attributionControl: { compact: true },

      style: {
        version: 8,

        sources: {
          osm: {
            type: 'raster',

            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],

            tileSize: 256,

            attribution:
              '&copy; OpenStreetMap contributors',
          },

          satellite: createSatelliteRasterSource(),

          parcel: {
            type: 'geojson',

            data: EMPTY_COLLECTION,
          },

          sections: {
            type: 'geojson',

            data: EMPTY_COLLECTION,
          },

          drawing: {
            type: 'geojson',

            data: EMPTY_COLLECTION,
          },
        },

        layers: [
          {
            id: 'osm-layer',

            type: 'raster',

            source: 'osm',

            layout: {
              visibility: 'none',
            },
          },

          {
            id: 'satellite-layer',

            type: 'raster',

            source: 'satellite',

            layout: {
              visibility: 'visible',
            },

            paint: vividSatellitePaint,
          },

          {
            id: 'parcel-fill',

            type: 'fill',

            source: 'parcel',

            paint: {
              'fill-color': '#37a85b',

              'fill-opacity': 0.12,
            },
          },

          {
            id: 'parcel-line',

            type: 'line',

            source: 'parcel',

            paint: {
              'line-color': '#ffffff',

              'line-width': 3,
            },
          },

          {
            id: 'parcel-line-green',

            type: 'line',

            source: 'parcel',

            paint: {
              'line-color': '#1f793b',

              'line-width': 1.5,
            },
          },

          {
            id: 'section-fill',

            type: 'fill',

            source: 'sections',

            paint: {
              'fill-color': '#f3c34a',

              'fill-opacity': 0.38,
            },
          },

          {
            id: 'section-line',

            type: 'line',

            source: 'sections',

            paint: {
              'line-color': '#fff4bd',

              'line-width': 2,
            },
          },

          {
            id: 'drawing-fill',

            type: 'fill',

            source: 'drawing',

            filter: ['==', '$type', 'Polygon'],

            paint: {
              'fill-color': '#63cf78',

              'fill-opacity': 0.32,
            },
          },

          {
            id: 'drawing-line',

            type: 'line',

            source: 'drawing',

            filter: [
              'any',

              ['==', '$type', 'Polygon'],

              ['==', '$type', 'LineString'],
            ],

            paint: {
              'line-color': '#ffffff',

              'line-width': 2.5,

              'line-dasharray': [2, 1],
            },
          },

          {
            id: 'drawing-points',

            type: 'circle',

            source: 'drawing',

            filter: ['==', '$type', 'Point'],

            paint: {
              'circle-radius': 6,

              'circle-color': '#ffffff',

              'circle-stroke-width': 2,

              'circle-stroke-color': '#23723a',
            },
          },
        ],
      },
    });

    mapRef.current = map;

    map.addControl(
      new mapRuntime.NavigationControl({
        visualizePitch: true,
      }),
      'bottom-right',
    );

    map.addControl(
      new mapRuntime.ScaleControl({
        maxWidth: 120,

        unit: 'metric',
      }),
      'bottom-left',
    );

    return () => {
      map.remove();

      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const handleLoad = () => {
      updateSource('parcel', parcelGeometry);

      updateSource('sections', sectionCollection);

      if (parcelGeometry) {
        const bounds = turf.bbox(parcelGeometry);

        map.fitBounds(
          [
            [bounds[0], bounds[1]],

            [bounds[2], bounds[3]],
          ],
          {
            padding: 55,

            duration: 900,

            maxZoom: 18,
          },
        );
      }
    };

    if (map.loaded()) {
      handleLoad();

      return;
    }

    map.once('load', handleLoad);

    return () => {
      map.off('load', handleLoad);
    };
  }, [parcelGeometry, sectionCollection]);

  useEffect(() => {
    updateSource('drawing', drawingCollection);
  }, [drawingCollection]);

  useEffect(() => {
    updateSource('sections', sectionCollection);
  }, [sectionCollection]);

  useEffect(() => {
    updateSource('parcel', parcelGeometry);

    const map = mapRef.current;

    if (!map || !parcelGeometry) return;

    const bounds = turf.bbox(parcelGeometry);

    map.fitBounds(
      [
        [bounds[0], bounds[1]],

        [bounds[2], bounds[3]],
      ],
      {
        padding: 55,

        maxZoom: 18,

        duration: 900,
      },
    );
  }, [parcelGeometry]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (!drawing) return;

      const coordinate: [number, number] = [
        event.lngLat.lng,

        event.lngLat.lat,
      ];

      if (parcelGeometry) {
        const clickedPoint = turf.point(coordinate);

        const insideParcel = turf.booleanPointInPolygon(
          clickedPoint,

          parcelGeometry,
        );

        if (!insideParcel) {
          setDrawMessage(
            'Çizim noktası parsel sınırının dışında olamaz.',
          );

          return;
        }
      }

      setDrawMessage('');

      setDrawPoints((current) => [...current, coordinate]);
    };

    map.on('click', handleMapClick);

    if (drawing) {
      map.getCanvas().style.cursor = 'crosshair';

      map.doubleClickZoom.disable();
    } else {
      map.getCanvas().style.cursor = '';

      map.doubleClickZoom.enable();
    }

    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawing, parcelGeometry]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    const applyMode = () => {
      if (!map.getLayer('osm-layer') || !map.getLayer('satellite-layer')) {
        return;
      }

      map.setLayoutProperty(
        'osm-layer',

        'visibility',

        mapMode === 'street' ? 'visible' : 'none',
      );

      map.setLayoutProperty(
        'satellite-layer',

        'visibility',

        mapMode === 'satellite' ? 'visible' : 'none',
      );
    };

    if (map.loaded()) {
      applyMode();
    } else {
      map.once('load', applyMode);
    }
  }, [mapMode]);

  const startDrawing = () => {
    if (!drawEnabled) return;

    setDrawPoints([]);

    setLastAreaDecare(null);

    setDrawMessage(
      'Harita üzerinde alanın köşelerine sırayla dokun. En az 3 nokta seç.',
    );

    setDrawing(true);
  };

  const cancelDrawing = () => {
    setDrawing(false);

    setDrawPoints([]);

    setLastAreaDecare(null);

    setDrawMessage('');
  };

  const undoLastPoint = () => {
    setDrawPoints((current) => current.slice(0, -1));
  };

  const finishDrawing = () => {
    if (drawPoints.length < 3) {
      setDrawMessage(
        'Bir alan oluşturmak için en az 3 nokta seçmelisin.',
      );

      return;
    }

    const coordinates = [...drawPoints, drawPoints[0]];

    const polygonFeature = turf.polygon([
      coordinates,
    ]) as ParcelFeature;

    if (parcelGeometry) {
      const completelyInside = turf.booleanWithin(
        polygonFeature,

        parcelGeometry,
      );

      if (!completelyInside) {
        setDrawMessage(
          'Çizdiğin üretim alanının tamamı parsel sınırının içinde olmalı.',
        );

        return;
      }
    }

    const areaSquareMeters = turf.area(polygonFeature);

    const areaDecare = areaSquareMeters / 1000;

    setLastAreaDecare(areaDecare);

    setDrawing(false);

    setDrawMessage(
      `${areaDecare.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,

        maximumFractionDigits: 2,
      })} dekar alan çizildi.`,
    );

    onSectionDrawn?.({
      geometry: polygonFeature,

      areaSquareMeters,

      areaDecare,
    });
  };

  return (
    <div className="field-map-shell">
      <div className="field-map-toolbar">
        <div className="field-map-layer-switcher">
          <button
            type="button"
            className={mapMode === 'street' ? 'active' : ''}
            onClick={() => setMapMode('street')}
          >
            🗺️ Harita
          </button>

          <button
            type="button"
            className={mapMode === 'satellite' ? 'active' : ''}
            onClick={() => setMapMode('satellite')}
          >
            🛰️ Uydu
          </button>
        </div>

        {drawEnabled && (
          <div className="field-map-draw-controls">
            {!drawing ? (
              <button
                type="button"
                className="field-map-draw-button"
                onClick={startDrawing}
              >
                ✏️ Bölüm Çiz
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={undoLastPoint}
                  disabled={drawPoints.length === 0}
                >
                  ↶ Son Noktayı Sil
                </button>

                <button
                  type="button"
                  className="field-map-finish-button"
                  onClick={finishDrawing}
                >
                  ✓ Çizimi Bitir
                </button>

                <button
                  type="button"
                  onClick={cancelDrawing}
                >
                  İptal
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        ref={mapContainerRef}
        className="field-map-container"
        style={{
          height:
            typeof height === 'number'
              ? `${height}px`
              : height,
        }}
      />

      {(drawMessage || lastAreaDecare !== null) && (
        <div
          className={`field-map-message ${
            lastAreaDecare !== null ? 'success' : ''
          }`}
        >
          <span>
            {lastAreaDecare !== null ? '✓' : 'ⓘ'}
          </span>

          <p>{drawMessage}</p>
        </div>
      )}

      <style>{`
        .field-map-shell {
          width: 100%;
          overflow: hidden;
          border: 1px solid rgba(35, 78, 48, 0.12);
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 12px 36px rgba(35, 70, 46, 0.08);
        }

        .field-map-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid rgba(35, 78, 48, 0.10);
          background: rgba(250, 252, 249, 0.97);
        }

        .field-map-layer-switcher,
        .field-map-draw-controls {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .field-map-toolbar button {
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid rgba(40, 81, 52, 0.14);
          border-radius: 10px;
          background: #ffffff;
          color: #526058;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .field-map-toolbar button:hover {
          border-color: #3d7c4d;
          color: #285f36;
        }

        .field-map-layer-switcher button.active {
          border-color: #347746;
          background: #e8f3e8;
          color: #286039;
        }

        .field-map-toolbar button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .field-map-draw-button,
        .field-map-finish-button {
          border-color: #337548 !important;
          background: #337548 !important;
          color: #ffffff !important;
        }

        .field-map-container {
          position: relative;
          width: 100%;
          min-height: 320px;
          background: #e7ece5;
        }

        .field-map-message {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 10px 12px 12px;
          padding: 10px 12px;
          border-radius: 11px;
          background: #f4f6f3;
          color: #626d65;
          font-size: 11px;
          line-height: 1.45;
        }

        .field-map-message.success {
          background: #eaf5e9;
          color: #32613e;
        }

        .field-map-message p {
          margin: 0;
        }

        .maplibregl-ctrl-group {
          border-radius: 10px !important;
          overflow: hidden;
        }

        @media (max-width: 700px) {
          .field-map-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .field-map-layer-switcher,
          .field-map-draw-controls {
            width: 100%;
          }

          .field-map-layer-switcher button,
          .field-map-draw-controls button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
