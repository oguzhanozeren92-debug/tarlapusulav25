import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../lib/mapRuntime';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SatelliteHealthResult } from '../lib/satelliteService';
import { createSatelliteRasterSource, vividSatellitePaint } from '../lib/mapStyle';

type Props = {
  data: SatelliteHealthResult;
  parcelGeometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  height?: number;
};

const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satellite: createSatelliteRasterSource(),
  },
  layers: [
    {
      id: 'satellite-base',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 19,
      paint: vividSatellitePaint,
    },
  ],
};

const imageCoordinatesFromBbox = (
  bbox?: [number, number, number, number] | number[] | null,
): [[number, number], [number, number], [number, number], [number, number]] | null => {
  if (!bbox || bbox.length !== 4) return null;

  const [west, south, east, north] = bbox.map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;

  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
};

export default function SatelliteHealthMap({
  data,
  parcelGeometry = null,
  height = 370,
}: Props) {
  const [healthVisible, setHealthVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.58);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const imageCoordinates = useMemo(
    () => imageCoordinatesFromBbox(data.bbox),
    [data.bbox],
  );

  const focusParcel = (showSurroundings = true) => {
    const map = mapRef.current;
    if (!map || !data.bbox || data.bbox.length !== 4) return;

    const [west, south, east, north] = data.bbox.map(Number);
    if (![west, south, east, north].every(Number.isFinite)) return;

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: showSurroundings ? 85 : 35,
        duration: 500,
        maxZoom: showSurroundings ? 16.2 : 18,
      },
    );

    if (showSurroundings) {
      map.once('moveend', () => {
        const z = map.getZoom();
        map.easeTo({
          zoom: Math.max(3, z - 1.15),
          duration: 350,
        });
      });
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: [number, number] =
      data.bbox && data.bbox.length === 4
        ? [
            (Number(data.bbox[0]) + Number(data.bbox[2])) / 2,
            (Number(data.bbox[1]) + Number(data.bbox[3])) / 2,
          ]
        : [35.2433, 38.9637];

    let map: MapLibreMap;

    try {
      map = new mapRuntime.Map({
        container: mapContainerRef.current,
        style: SATELLITE_STYLE,
        center,
        zoom: data.bbox ? 14 : 6,
        minZoom: 2,
        maxZoom: 19,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
      });
    } catch (error) {
      console.error('Uydu haritası başlatılamadı:', error);
      return;
    }

    mapRef.current = map;

    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-left',
    );

    map.addControl(
      new mapRuntime.AttributionControl({ compact: true }),
      'bottom-right',
    );

    map.on('load', () => {
      if (data.ndviImage && imageCoordinates) {
        map.addSource('health-overlay', {
          type: 'image',
          url: data.ndviImage,
          coordinates: imageCoordinates,
        });

        map.addLayer({
          id: 'health-overlay-layer',
          type: 'raster',
          source: 'health-overlay',
          paint: {
            'raster-opacity': healthVisible ? overlayOpacity : 0,
            'raster-fade-duration': 0,
            'raster-resampling': 'linear',
          },
        });
      }

      if (parcelGeometry) {
        map.addSource('parcel', {
          type: 'geojson',
          data: parcelGeometry,
        });

        map.addLayer({
          id: 'parcel-shadow',
          type: 'line',
          source: 'parcel',
          paint: {
            'line-color': '#101b13',
            'line-width': 5,
            'line-opacity': 0.62,
          },
        });

        map.addLayer({
          id: 'parcel-outline',
          type: 'line',
          source: 'parcel',
          paint: {
            'line-color': '#ffffff',
            'line-width': 2.4,
            'line-opacity': 0.98,
          },
        });
      }

      focusParcel(true);
    });

    map.on('error', (event) => {
      console.error('Harita hatası:', event?.error ?? event);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('parcel') as GeoJSONSource | undefined;
    if (source && parcelGeometry) {
      source.setData(parcelGeometry);
    }
  }, [parcelGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !imageCoordinates || !data.ndviImage) return;

    if (map.getLayer('health-overlay-layer')) {
      map.removeLayer('health-overlay-layer');
    }
    if (map.getSource('health-overlay')) {
      map.removeSource('health-overlay');
    }

    map.addSource('health-overlay', {
      type: 'image',
      url: data.ndviImage,
      coordinates: imageCoordinates,
    });

    map.addLayer({
      id: 'health-overlay-layer',
      type: 'raster',
      source: 'health-overlay',
      paint: {
        'raster-opacity': healthVisible ? overlayOpacity : 0,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear',
      },
    });

    if (map.getLayer('parcel-shadow')) map.moveLayer('parcel-shadow');
    if (map.getLayer('parcel-outline')) map.moveLayer('parcel-outline');
  }, [data.ndviImage, imageCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('health-overlay-layer')) return;

    map.setPaintProperty(
      'health-overlay-layer',
      'raster-opacity',
      healthVisible ? overlayOpacity : 0,
    );
  }, [healthVisible, overlayOpacity]);

  return (
    <div className="tp-health-map">
      <div className="tp-health-toolbar">
        <div className="tp-health-title">
          <span className="tp-health-live" />
          <div>
            <strong>Uydu Sağlık Haritası</strong>
            <small>Normal uydu görüntüsü üzerinde NDVI analizi</small>
          </div>
        </div>

        <div className="tp-health-actions">
          <button
            type="button"
            className={healthVisible ? 'active' : ''}
            onClick={() => setHealthVisible((v) => !v)}
          >
            {healthVisible ? 'Sağlık Katmanı' : 'Sağlık Katmanını Aç'}
          </button>

          <button type="button" onClick={() => focusParcel(true)}>
            Çevreyle Göster
          </button>

          <button type="button" onClick={() => focusParcel(false)}>
            Tarlaya Yaklaş
          </button>
        </div>
      </div>

      <div className="tp-health-stage" style={{ height }}>
        <div ref={mapContainerRef} className="tp-health-canvas" />

        {healthVisible && (
          <>
            <div className="tp-health-legend">
              <div className="tp-health-legend-head">
                <strong>Bitki Sağlığı</strong>
                <span>NDVI</span>
              </div>

              <div className="tp-health-gradient" />

              <div className="tp-health-labels">
                <span>Stresli</span>
                <span>Kontrol</span>
                <span>Sağlıklı</span>
              </div>
            </div>

            <div className="tp-health-opacity">
              <span>Renk yoğunluğu</span>
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={Math.round(overlayOpacity * 100)}
                onChange={(event) =>
                  setOverlayOpacity(Number(event.target.value) / 100)
                }
              />
              <strong>{Math.round(overlayOpacity * 100)}%</strong>
            </div>
          </>
        )}

        <div className="tp-health-date">
          <small>Sentinel-2 analiz tarihi</small>
          <strong>{data.latestImageDate ?? '—'}</strong>
        </div>
      </div>

      <style>{`
        .tp-health-map{
          width:100%;
          color:#A3B3A7;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .tp-health-toolbar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:9px;
        }

        .tp-health-title{
          display:flex;
          align-items:center;
          gap:8px;
        }

        .tp-health-title strong{
          display:block;
          color:#E6E1D5;
          font-size:10px;
          font-weight:800;
        }

        .tp-health-title small{
          display:block;
          margin-top:2px;
          color:#617366;
          font-size:7px;
        }

        .tp-health-live{
          width:9px;
          height:9px;
          border-radius:50%;
          background:#00FF88;
          box-shadow:0 0 0 4px rgba(0,255,136,.08);
        }

        .tp-health-actions{
          display:flex;
          align-items:center;
          gap:6px;
          flex-wrap:wrap;
          justify-content:flex-end;
        }

        .tp-health-actions button{
          min-height:33px;
          border:1px solid #23352B;
          border-radius:9px;
          padding:0 10px;
          background:#1B2920;
          color:#D2E7D6;
          font:inherit;
          font-size:8px;
          font-weight:800;
          cursor:pointer;
        }

        .tp-health-actions button:hover{
          border-color:#35503F;
          background:#203127;
        }

        .tp-health-actions button.active{
          border-color:#D2E7D6;
          background:#D2E7D6;
          color:#0C120E;
        }

        .tp-health-stage{
          position:relative;
          overflow:hidden;
          border:1px solid #1F2E25;
          border-radius:14px;
          background:#0C120E;
          box-shadow:0 10px 28px rgba(0,0,0,.22);
        }

        .tp-health-canvas{
          position:absolute;
          inset:0;
        }

        .tp-health-canvas .maplibregl-map{
          width:100%;
          height:100%;
        }

        .tp-health-canvas .maplibregl-ctrl-top-left{
          top:10px;
          left:10px;
        }

        .tp-health-canvas .maplibregl-ctrl-group{
          overflow:hidden;
          border:1px solid #1F2E25;
          border-radius:10px;
          background:#0C120E;
          box-shadow:0 4px 15px rgba(0,0,0,.22);
        }

        .tp-health-canvas .maplibregl-ctrl-group button{
          width:34px;
          height:34px;
          background-color:#0C120E;
        }

        .tp-health-canvas .maplibregl-ctrl-group button+button{
          border-top:1px solid #1F2E25;
        }

        .tp-health-canvas .maplibregl-ctrl-icon{
          filter:invert(90%);
        }

        .tp-health-canvas .maplibregl-ctrl-attrib{
          border:1px solid rgba(31,46,37,.85);
          background:rgba(12,18,14,.88);
          color:#A3B3A7;
          font-size:7px;
        }

        .tp-health-canvas .maplibregl-ctrl-attrib a{
          color:#D2E7D6;
        }

        .tp-health-legend{
          position:absolute;
          z-index:5;
          left:12px;
          bottom:12px;
          width:185px;
          padding:10px;
          border:1px solid #1F2E25;
          border-radius:10px;
          background:rgba(12,18,14,.92);
          box-shadow:0 4px 16px rgba(0,0,0,.22);
          backdrop-filter:blur(7px);
        }

        .tp-health-legend-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:7px;
        }

        .tp-health-legend-head strong{
          color:#E6E1D5;
          font-size:8px;
        }

        .tp-health-legend-head span{
          color:#617366;
          font-size:6px;
          font-weight:900;
        }

        .tp-health-gradient{
          height:8px;
          border-radius:999px;
          background:linear-gradient(
            90deg,
            #c83c32 0%,
            #e36d32 20%,
            #e7bd35 43%,
            #88b94e 66%,
            #2f8b48 84%,
            #176436 100%
          );
        }

        .tp-health-labels{
          display:flex;
          justify-content:space-between;
          margin-top:5px;
          color:#A3B3A7;
          font-size:6.5px;
          font-weight:750;
        }

        .tp-health-opacity{
          position:absolute;
          z-index:5;
          right:12px;
          bottom:12px;
          width:175px;
          display:grid;
          grid-template-columns:auto 1fr auto;
          align-items:center;
          gap:7px;
          padding:9px;
          border:1px solid #1F2E25;
          border-radius:10px;
          background:rgba(12,18,14,.92);
          box-shadow:0 4px 16px rgba(0,0,0,.22);
          backdrop-filter:blur(7px);
        }

        .tp-health-opacity span,
        .tp-health-opacity strong{
          color:#A3B3A7;
          font-size:7px;
          font-weight:850;
        }

        .tp-health-opacity strong{
          color:#E6E1D5;
        }

        .tp-health-opacity input{
          width:100%;
          accent-color:#D2E7D6;
        }

        .tp-health-date{
          position:absolute;
          z-index:5;
          right:12px;
          top:12px;
          padding:8px 10px;
          border:1px solid #1F2E25;
          border-radius:9px;
          background:rgba(12,18,14,.88);
          box-shadow:0 4px 14px rgba(0,0,0,.22);
          backdrop-filter:blur(7px);
        }

        .tp-health-date small{
          display:block;
          color:#617366;
          font-size:6.5px;
        }

        .tp-health-date strong{
          display:block;
          margin-top:2px;
          color:#E6E1D5;
          font-size:8px;
        }

        @media(max-width:720px){
          .tp-health-toolbar{
            align-items:stretch;
            flex-direction:column;
          }

          .tp-health-actions{
            width:100%;
          }

          .tp-health-actions button{
            flex:1;
          }

          .tp-health-legend{
            width:145px;
          }

          .tp-health-opacity{
            width:140px;
          }
        }
      `}</style>
    </div>
  );
}
