import { shouldPlayMapOpening, openMapAtField } from '../map-opening/mapOpening';
import { resolveOpeningTarget } from '../map-opening/openingTarget';
import { mapRuntime } from '../../lib/mapRuntime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Crosshair, History, Minus, Plus, Satellite } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import MapDataDate from '../map-data/components/MapDataDate';
import SatelliteHistorySheet from '../map-data/components/SatelliteHistorySheet';
import RadarHistorySheet from '../map-data/components/RadarHistorySheet';
import { useSatelliteHistory } from '../map-data/hooks/useSatelliteHistory';
import { useRadarHistory } from '../map-data/hooks/useRadarHistory';
import {
  readMapLayerArchive,
  requestMapLayerPersistentStorage,
  writeMapLayerArchive,
} from '../map-data/services/mapLayerArchive';
import {
  fieldIdFromMapCacheKey,
  readFieldMapLayerCache,
  writeFieldMapLayerCache,
} from './services/fieldMapLayerCache';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../../supabaseClient';
import { fetchSentinel1Radar } from '../../services/sentinel1Service';
import {
  fetchSoilGridsProfile,
  getSoilGridsWmsLayerName,
  type SoilGridsProfile,
} from '../../services/soilGridsService';
import { createSatelliteRasterSource, vividSatellitePaint } from '../../lib/mapStyle';
import { addTarlaCompass } from '../../components/MapCompass';
import NdviObservationPhotoModal from '../field-observations/components/NdviObservationPhotoModal';
import NdviObservationTimelineModal from '../field-observations/components/NdviObservationTimelineModal';
import FieldObservationPointsModal from '../field-observations/components/FieldObservationPointsModal';
import FieldOperationModal from '../field-operations/components/FieldOperationModal';
import { ensureNdviObservationPoint, listFieldObservationPoints } from '../field-observations/services/fieldObservation.service';
import type {
  FieldObservationPointOverview,
  NdviObservationTarget,
  ObservationUploadResult,
} from '../field-observations/types/fieldObservation';

function formatHomeSatelliteDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

  const tr = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (tr) return `${tr[1].padStart(2, '0')}.${tr[2].padStart(2, '0')}.${tr[3]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const HOME_MAP_RADAR_CACHE = new Map<string, any>();
const HOME_MAP_RADAR_CLIPPED_CACHE = new Map<
  string,
  { url: string; summary: HomeLayerSpatialSummary }
>();
const HOME_MAP_CLIMATE_CACHE = new Map<string, any[]>();
const HOME_MAP_CLIMATE_CLIPPED_CACHE = new Map<
  string,
  {
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
    variable: HomeClimateVariable;
  }
>();
const HOME_MAP_AGRO_CACHE = new Map<string, any[]>();
// Agro metrikleri (yüzey sıcaklığı / ET₀ / yağış) birbirinden tamamen bağımsız
// cache anahtarları ve hücre kimliği kullanır. Bu sürüm etiketi eski/potansiyel
// çapraz-katman cache kayıtlarını otomatik olarak devre dışı bırakır.
const HOME_AGRO_DATA_VERSION = 'agro-independent-v3';
const HOME_MAP_AGRO_CLIPPED_CACHE = new Map<
  string,
  {
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
  }
>();
const HOME_MAP_SOIL_CLIPPED_CACHE = new Map<
  string,
  { url: string; bbox: HomeBBox }
>();
const HOME_MAP_NDVI_CACHE = new Map<string, string>();

/**
 * Harita katmanları için üç seviyeli cache:
 * 1) RAM -> aynı oturumda anlık geçiş
 * 2) Ortak IndexedDB katman arşivi -> uygulama yeniden açılsa da tekrar sorgulama yok
 * 3) Supabase field_map_layer_cache -> cihaz değişince / yerel cache temizlenince geri yükleme
 *
 * Dinamik katmanlar TTL ile yenilenir. Tarihli Sentinel geçmişi ise ayrı history
 * cache'lerinde kalıcı tutulur.
 */
const HOME_MAP_CACHE_PROCESSING_VERSION = 'home-map-layer-v4';
const HOME_MAP_ARCHIVE_NAMESPACE = 'home-map-current';
const HOME_MAP_CACHE_TTL = {
  radar: 6 * 60 * 60 * 1000,
  climate: 6 * 60 * 60 * 1000,
  agro: 6 * 60 * 60 * 1000,
  ndvi: 24 * 60 * 60 * 1000,
  soil: 30 * 24 * 60 * 60 * 1000,
} as const;

const HOME_MAP_RADAR_INFLIGHT = new Map<string, Promise<any>>();
const HOME_MAP_RADAR_VISUAL_INFLIGHT = new Map<
  string,
  Promise<{ url: string; summary: HomeLayerSpatialSummary }>
>();
const HOME_MAP_CLIMATE_INFLIGHT = new Map<string, Promise<any[]>>();
const HOME_MAP_CLIMATE_VISUAL_INFLIGHT = new Map<
  string,
  Promise<{
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
    variable: HomeClimateVariable;
  }>
>();
const HOME_MAP_AGRO_INFLIGHT = new Map<string, Promise<any[]>>();
const HOME_MAP_AGRO_VISUAL_INFLIGHT = new Map<
  string,
  Promise<{
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
  }>
>();
const HOME_MAP_SOIL_VISUAL_INFLIGHT = new Map<
  string,
  Promise<{ url: string; bbox: HomeBBox }>
>();
const HOME_MAP_NDVI_INFLIGHT = new Map<string, Promise<string>>();
const HOME_MAP_SOIL_PROFILE_CACHE = new Map<string, SoilGridsProfile>();
const HOME_MAP_SOIL_PROFILE_INFLIGHT = new Map<
  string,
  Promise<SoilGridsProfile>
>();

async function readHomeMapPersistentCache<T>(
  namespace: string,
  key: string,
  ttlMs: number,
): Promise<T | null> {
  const local = await readMapLayerArchive<T>({
    namespace: `${HOME_MAP_ARCHIVE_NAMESPACE}:${namespace}`,
    key,
    processingVersion: HOME_MAP_CACHE_PROCESSING_VERSION,
    ttlMs,
  });

  if (local != null) return local;

  const fieldId = fieldIdFromMapCacheKey(key);
  if (!fieldId) return null;

  try {
    const cloud = await readFieldMapLayerCache<T>(
      fieldId,
      namespace,
      key,
      ttlMs,
    );

    if (cloud != null) {
      await writeMapLayerArchive({
        namespace: `${HOME_MAP_ARCHIVE_NAMESPACE}:${namespace}`,
        key,
        processingVersion: HOME_MAP_CACHE_PROCESSING_VERSION,
        data: cloud,
        ttlMs,
      });
      return cloud;
    }
  } catch (error) {
    console.warn('Harita katmanı bulut cache okuma hatası:', error);
  }

  return null;
}

async function writeHomeMapPersistentCache<T>(
  namespace: string,
  key: string,
  data: T,
  ttlMs?: number,
) {
  const effectiveTtl = ttlMs ?? (
    namespace.startsWith('soil')
      ? HOME_MAP_CACHE_TTL.soil
      : namespace.startsWith('ndvi')
        ? HOME_MAP_CACHE_TTL.ndvi
        : namespace.startsWith('climate')
          ? HOME_MAP_CACHE_TTL.climate
          : namespace.startsWith('agro')
            ? HOME_MAP_CACHE_TTL.agro
            : HOME_MAP_CACHE_TTL.radar
  );

  await writeMapLayerArchive({
    namespace: `${HOME_MAP_ARCHIVE_NAMESPACE}:${namespace}`,
    key,
    processingVersion: HOME_MAP_CACHE_PROCESSING_VERSION,
    data,
    ttlMs: effectiveTtl,
  });

  const fieldId = fieldIdFromMapCacheKey(key);
  if (!fieldId) return;

  void writeFieldMapLayerCache(
    fieldId,
    namespace,
    key,
    data,
    effectiveTtl,
  ).catch((error) => {
    console.warn('Harita katmanı bulut cache yazma hatası:', error);
  });
}

function homeMapFieldCacheKey(field: any) {
  return String(field?.id ?? 'no-field');
}

type HomeBBox = [number, number, number, number];

const HOME_SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    // Bazı bölgelerde sağlayıcının z19 karoları gerçek görüntü yerine
    // "Map data not yet available" placeholder'ı döndürüyor.
    // z18'de gerçek uydu görüntüsü mevcut olduğu için kaynağı z18'de
    // sabitliyor, MapLibre'ın daha yakın zoomlarda bu karoyu overzoom
    // etmesine izin veriyoruz. Katman/veri mantığı değişmez.
    satellite: {
      ...(createSatelliteRasterSource() as any),
      maxzoom: 18,
    } as any,
  },
  layers: [
    {
      id: 'home-satellite-base',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22,
      paint: vividSatellitePaint,
    },
  ],
};

function homeBboxFromGeometry(parcelGeometry: any): HomeBBox | null {
  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  const coordinates = geometry?.coordinates;
  if (!coordinates) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (value: any) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const lng = Number(value[0]);
      const lat = Number(value[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        west = Math.min(west, lng);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        north = Math.max(north, lat);
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
  };

  visit(coordinates);

  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (west >= east || south >= north) return null;
  return [west, south, east, north];
}

function normalizeHomeBbox(value: unknown): HomeBBox | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const v = value.map(Number);
  if (!v.every(Number.isFinite)) return null;
  const [west, south, east, north] = v;
  if (west >= east || south >= north) return null;
  return [west, south, east, north];
}


type HomePusulaGridDirection =
  | 'kuzeybatı'
  | 'kuzey'
  | 'kuzeydoğu'
  | 'batı'
  | 'merkez'
  | 'doğu'
  | 'güneybatı'
  | 'güney'
  | 'güneydoğu';

const HOME_PUSULA_GRID_POSITION: Record<
  HomePusulaGridDirection,
  { row: 0 | 1 | 2; col: 0 | 1 | 2 }
> = {
  kuzeybatı: { row: 0, col: 0 },
  kuzey: { row: 0, col: 1 },
  kuzeydoğu: { row: 0, col: 2 },
  batı: { row: 1, col: 0 },
  merkez: { row: 1, col: 1 },
  doğu: { row: 1, col: 2 },
  güneybatı: { row: 2, col: 0 },
  güney: { row: 2, col: 1 },
  güneydoğu: { row: 2, col: 2 },
};

function normalizeHomePusulaDirection(
  value: unknown,
): HomePusulaGridDirection | null {
  const key = String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[\s_-]+/g, '');

  const aliases: Record<string, HomePusulaGridDirection> = {
    kuzeybatı: 'kuzeybatı',
    kuzeybati: 'kuzeybatı',
    northwest: 'kuzeybatı',
    kuzey: 'kuzey',
    north: 'kuzey',
    kuzeydoğu: 'kuzeydoğu',
    kuzeydogu: 'kuzeydoğu',
    northeast: 'kuzeydoğu',
    batı: 'batı',
    bati: 'batı',
    west: 'batı',
    merkez: 'merkez',
    orta: 'merkez',
    center: 'merkez',
    centre: 'merkez',
    doğu: 'doğu',
    dogu: 'doğu',
    east: 'doğu',
    güneybatı: 'güneybatı',
    guneybati: 'güneybatı',
    southwest: 'güneybatı',
    güney: 'güney',
    guney: 'güney',
    south: 'güney',
    güneydoğu: 'güneydoğu',
    guneydogu: 'güneydoğu',
    southeast: 'güneydoğu',
  };

  return aliases[key] ?? null;
}


function homePusulaSpatialFocusDirections(
  spatial: any,
  layer: HomeLayer,
): HomePusulaGridDirection[] {
  const findings =
    Array.isArray(spatial?.findings)
      ? spatial.findings
      : [];

  const scored = findings
    .map((finding: any) => {
      const direction =
        normalizeHomePusulaDirection(
          finding?.area ??
            finding?.direction,
        );

      if (!direction) {
        return null;
      }

      let severity = 0;

      if (layer === 'vegetation') {
        const health =
          Number(
            finding?.ndvi
              ?.relativeHealth,
          );

        if (!Number.isFinite(health)) {
          return null;
        }

        severity = 1 - health;

        if (severity < 0.68) {
          return null;
        }
      } else if (layer === 'radar-water') {
        const water =
          Number(
            finding?.radarWater
              ?.blueRatio,
          );

        if (!Number.isFinite(water)) {
          return null;
        }

        severity = water;

        if (severity < 0.68) {
          return null;
        }
      } else if (layer === 'radar-vv') {
        const vv =
          Number(
            finding?.radarVv
              ?.relativeBackscatter,
          );

        if (!Number.isFinite(vv)) {
          return null;
        }

        severity =
          Math.abs(vv - 0.5) * 2;

        if (severity < 0.52) {
          return null;
        }
      } else if (layer === 'radar-vh') {
        const vh =
          Number(
            finding?.radarVh
              ?.textureScore,
          );

        if (!Number.isFinite(vh)) {
          return null;
        }

        severity = vh;

        if (severity < 0.70) {
          return null;
        }
      } else {
        return null;
      }

      return {
        direction,
        severity,
      };
    })
    .filter(Boolean) as Array<{
      direction: HomePusulaGridDirection;
      severity: number;
    }>;

  return scored
    .sort(
      (a, b) =>
        b.severity - a.severity,
    )
    .slice(0, 3)
    .map((item) => item.direction);
}

function homePusulaFocusFromDirections(
  parcelGeometry: any,
  analysisBounds: HomeBBox,
  directions: HomePusulaGridDirection[],
) {
  const features = directions
    .map((direction) => {
      const cell =
        homePusulaGridBounds(
          analysisBounds,
          direction,
        );

      const feature =
        homePusulaFocusFeature(
          parcelGeometry,
          cell,
        );

      if (!feature) return null;

      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          source:
            'pusula-spatial-finding',
          direction,
        },
      };
    })
    .filter(Boolean);

  if (!features.length) {
    return null;
  }

  const polygons: any[] = [];

  for (const feature of features) {
    const geometry =
      (feature as any).geometry;

    if (
      geometry?.type === 'Polygon'
    ) {
      polygons.push(
        geometry.coordinates,
      );
    } else if (
      geometry?.type ===
      'MultiPolygon'
    ) {
      polygons.push(
        ...(geometry.coordinates ??
          []),
      );
    }
  }

  if (!polygons.length) {
    return null;
  }

  const feature = {
    type: 'Feature',
    properties: {
      source:
        'pusula-spatial-findings',
      focusCount: features.length,
    },
    geometry:
      polygons.length === 1
        ? {
            type: 'Polygon',
            coordinates: polygons[0],
          }
        : {
            type: 'MultiPolygon',
            coordinates: polygons,
          },
  };

  const bounds =
    homeBboxFromGeometry(feature);

  if (!bounds) {
    return null;
  }

  return {
    feature,
    bounds,
  };
}

function homePusulaDirectionFromPoint(
  point: [number, number],
  base: HomeBBox | null,
): HomePusulaGridDirection | null {
  if (!base) return null;

  const [west, south, east, north] = base;
  const width = east - west;
  const height = north - south;

  if (width <= 0 || height <= 0) return null;

  const x = Math.max(
    0,
    Math.min(0.999999, (point[0] - west) / width),
  );
  const y = Math.max(
    0,
    Math.min(0.999999, (north - point[1]) / height),
  );

  const col = Math.min(2, Math.floor(x * 3)) as 0 | 1 | 2;
  const row = Math.min(2, Math.floor(y * 3)) as 0 | 1 | 2;

  const found = Object.entries(HOME_PUSULA_GRID_POSITION).find(
    ([, position]) => position.row === row && position.col === col,
  );

  return (found?.[0] as HomePusulaGridDirection | undefined) ?? null;
}

function homePusulaRelativeHealthForDirection(
  spatial: any,
  direction: HomePusulaGridDirection | null,
) {
  if (!direction || !Array.isArray(spatial?.findings)) {
    return null;
  }

  const finding = spatial.findings.find(
    (item: any) =>
      normalizeHomePusulaDirection(item?.area ?? item?.direction) === direction,
  );

  const value = Number(finding?.ndvi?.relativeHealth);
  return Number.isFinite(value) ? value : null;
}

function homePusulaGridBounds(
  base: HomeBBox,
  direction: HomePusulaGridDirection,
): HomeBBox {
  const [west, south, east, north] = base;
  const { row, col } = HOME_PUSULA_GRID_POSITION[direction];

  const lngStep = (east - west) / 3;
  const latStep = (north - south) / 3;

  const cellWest = west + col * lngStep;
  const cellEast = west + (col + 1) * lngStep;

  // Raster 3×3 sırası yukarıdan aşağıya gider:
  // row 0 = kuzey, row 2 = güney.
  const cellNorth = north - row * latStep;
  const cellSouth = north - (row + 1) * latStep;

  return [cellWest, cellSouth, cellEast, cellNorth];
}

type HomeLngLat = [number, number];

function closeHomeRing(points: HomeLngLat[]) {
  if (points.length < 3) return [];

  const result = [...points];
  const first = result[0];
  const last = result[result.length - 1];

  if (!last || last[0] !== first[0] || last[1] !== first[1]) {
    result.push([first[0], first[1]]);
  }

  return result;
}

function homeClipRingToBbox(
  rawRing: unknown,
  bbox: HomeBBox,
): HomeLngLat[] {
  if (!Array.isArray(rawRing)) return [];

  let points = rawRing
    .map((point: any) => [Number(point?.[0]), Number(point?.[1])] as HomeLngLat)
    .filter(
      (point) =>
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    );

  if (points.length < 3) return [];

  const first = points[0];
  const last = points[points.length - 1];
  if (
    last &&
    first &&
    last[0] === first[0] &&
    last[1] === first[1]
  ) {
    points = points.slice(0, -1);
  }

  const [west, south, east, north] = bbox;

  const clipEdge = (
    input: HomeLngLat[],
    inside: (point: HomeLngLat) => boolean,
    intersect: (a: HomeLngLat, b: HomeLngLat) => HomeLngLat,
  ) => {
    if (!input.length) return [] as HomeLngLat[];

    const output: HomeLngLat[] = [];
    let previous = input[input.length - 1];
    let previousInside = inside(previous);

    for (const current of input) {
      const currentInside = inside(current);

      if (currentInside) {
        if (!previousInside) {
          output.push(intersect(previous, current));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(intersect(previous, current));
      }

      previous = current;
      previousInside = currentInside;
    }

    return output;
  };

  const intersectVertical = (
    x: number,
    a: HomeLngLat,
    b: HomeLngLat,
  ): HomeLngLat => {
    const dx = b[0] - a[0];
    if (Math.abs(dx) < 1e-12) return [x, a[1]];
    const t = (x - a[0]) / dx;
    return [x, a[1] + (b[1] - a[1]) * t];
  };

  const intersectHorizontal = (
    y: number,
    a: HomeLngLat,
    b: HomeLngLat,
  ): HomeLngLat => {
    const dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-12) return [a[0], y];
    const t = (y - a[1]) / dy;
    return [a[0] + (b[0] - a[0]) * t, y];
  };

  points = clipEdge(
    points,
    (point) => point[0] >= west,
    (a, b) => intersectVertical(west, a, b),
  );
  points = clipEdge(
    points,
    (point) => point[0] <= east,
    (a, b) => intersectVertical(east, a, b),
  );
  points = clipEdge(
    points,
    (point) => point[1] >= south,
    (a, b) => intersectHorizontal(south, a, b),
  );
  points = clipEdge(
    points,
    (point) => point[1] <= north,
    (a, b) => intersectHorizontal(north, a, b),
  );

  return closeHomeRing(points);
}

function homePusulaFocusFeature(
  parcelGeometry: any,
  cellBbox: HomeBBox,
) {
  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  if (!geometry?.coordinates) return null;

  const polygons: any[] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];

  const clipped = polygons
    .map((polygon) => {
      if (!Array.isArray(polygon) || !polygon.length) return null;

      const outer = homeClipRingToBbox(polygon[0], cellBbox);
      if (outer.length < 4) return null;

      const rings: HomeLngLat[][] = [outer];

      for (let index = 1; index < polygon.length; index += 1) {
        const hole = homeClipRingToBbox(polygon[index], cellBbox);
        if (hole.length >= 4) rings.push(hole);
      }

      return rings;
    })
    .filter(Boolean) as HomeLngLat[][][];

  if (!clipped.length) return null;

  return {
    type: 'Feature',
    properties: {
      source: 'pusula-grid-focus',
    },
    geometry:
      clipped.length === 1
        ? {
            type: 'Polygon',
            coordinates: clipped[0],
          }
        : {
            type: 'MultiPolygon',
            coordinates: clipped,
          },
  };
}

function homePusulaRectangleFeature(bounds: HomeBBox) {
  const [west, south, east, north] = bounds;

  return {
    type: 'Feature',
    properties: {
      source: 'pusula-bounds-focus',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
          [west, north],
        ],
      ],
    },
  };
}

function homePusulaFeatureFromGeometry(value: any) {
  if (!value) return null;

  if (value.type === 'Feature' && value.geometry) {
    return value;
  }

  if (
    value.type === 'Polygon' ||
    value.type === 'MultiPolygon'
  ) {
    return {
      type: 'Feature',
      properties: {
        source: 'pusula-direct-geometry',
      },
      geometry: value,
    };
  }

  return null;
}


type HomePusulaFocusItem = {
  feature: any;
  bounds: HomeBBox;
  center: [number, number];
};

type HomePusulaFocusUi = {
  count: number;
  index: number;
  label: string;
  tone: 'danger' | 'attention' | 'neutral';
};

function homePusulaFocusItems(
  feature: any,
): HomePusulaFocusItem[] {
  const normalized =
    homePusulaFeatureFromGeometry(feature);

  if (!normalized?.geometry) return [];

  const properties = {
    ...(normalized.properties ?? {}),
  };

  const geometry = normalized.geometry;

  const rawFeatures: any[] =
    geometry.type === 'Polygon'
      ? [
          {
            type: 'Feature',
            properties,
            geometry,
          },
        ]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates ?? []).map(
            (polygon: any, index: number) => ({
              type: 'Feature',
              properties: {
                ...properties,
                focusIndex: index,
              },
              geometry: {
                type: 'Polygon',
                coordinates: polygon,
              },
            }),
          )
        : [];

  return rawFeatures
    .map((item, index) => {
      const bounds =
        homeBboxFromGeometry(item);

      if (!bounds) return null;

      const feature = {
        ...item,
        properties: {
          ...(item.properties ?? {}),
          focusIndex: index,
        },
      };

      return {
        feature,
        bounds,
        center: homeInteriorPointFromFeature(
          feature,
          bounds,
        ),
      };
    })
    .filter(Boolean) as HomePusulaFocusItem[];
}

function homePusulaFocusCollection(
  items: HomePusulaFocusItem[],
) {
  return {
    type: 'FeatureCollection',
    features: items.map((item, index) => ({
      ...item.feature,
      properties: {
        ...(item.feature?.properties ?? {}),
        focusIndex: index,
      },
    })),
  };
}

function homePusulaFocusUnionBounds(
  items: HomePusulaFocusItem[],
): HomeBBox | null {
  if (!items.length) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const item of items) {
    west = Math.min(west, item.bounds[0]);
    south = Math.min(south, item.bounds[1]);
    east = Math.max(east, item.bounds[2]);
    north = Math.max(north, item.bounds[3]);
  }

  if (
    ![west, south, east, north].every(
      Number.isFinite,
    )
  ) {
    return null;
  }

  return [west, south, east, north];
}


function homePointInRing(
  point: [number, number],
  ring: any[],
) {
  const [x, y] = point;
  let inside = false;

  for (
    let i = 0, j = ring.length - 1;
    i < ring.length;
    j = i++
  ) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);

    if (
      ![xi, yi, xj, yj].every(Number.isFinite)
    ) {
      continue;
    }

    const intersects =
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) /
          ((yj - yi) || 1e-12) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function homePointInPolygonGeometry(
  geometry: any,
  point: [number, number],
) {
  if (!geometry) return false;

  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];

  for (const polygon of polygons) {
    const outerRing = polygon?.[0];
    if (!Array.isArray(outerRing)) continue;

    if (!homePointInRing(point, outerRing)) {
      continue;
    }

    const holes = Array.isArray(polygon)
      ? polygon.slice(1)
      : [];

    const insideHole = holes.some((ring: any) =>
      Array.isArray(ring)
        ? homePointInRing(point, ring)
        : false,
    );

    if (!insideHole) {
      return true;
    }
  }

  return false;
}

function homeRingCentroid(
  ring: any[],
): [number, number] | null {
  if (!Array.isArray(ring) || ring.length < 3) {
    return null;
  }

  let area2 = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const x1 = Number(ring[i]?.[0]);
    const y1 = Number(ring[i]?.[1]);
    const x2 = Number(ring[i + 1]?.[0]);
    const y2 = Number(ring[i + 1]?.[1]);

    if (
      ![x1, y1, x2, y2].every(Number.isFinite)
    ) {
      continue;
    }

    const cross = x1 * y2 - x2 * y1;
    area2 += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  if (Math.abs(area2) < 1e-12) {
    return null;
  }

  return [
    cx / (3 * area2),
    cy / (3 * area2),
  ];
}

function homeFallbackInsidePoint(
  geometry: any,
  bounds: HomeBBox,
): [number, number] {
  const [west, south, east, north] = bounds;
  const center: [number, number] = [
    (west + east) / 2,
    (south + north) / 2,
  ];

  if (homePointInPolygonGeometry(geometry, center)) {
    return center;
  }

  let bestPoint: [number, number] | null = null;
  let bestDistance = Infinity;

  const cols = 9;
  const rows = 9;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const lng =
        west + ((east - west) * col) / cols;
      const lat =
        south + ((north - south) * row) / rows;
      const point: [number, number] = [
        lng,
        lat,
      ];

      if (
        !homePointInPolygonGeometry(
          geometry,
          point,
        )
      ) {
        continue;
      }

      const distance =
        (lng - center[0]) ** 2 +
        (lat - center[1]) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    }
  }

  if (bestPoint) {
    return bestPoint;
  }

  const polygons =
    geometry?.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];

  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (
      Array.isArray(ring) &&
      Array.isArray(ring[0]) &&
      ring[0].length >= 2
    ) {
      return [
        Number(ring[0][0]) || center[0],
        Number(ring[0][1]) || center[1],
      ];
    }
  }

  return center;
}

function homeInteriorPointFromFeature(
  feature: any,
  bounds: HomeBBox,
): [number, number] {
  const geometry = feature?.geometry;
  if (!geometry) {
    return [
      (bounds[0] + bounds[2]) / 2,
      (bounds[1] + bounds[3]) / 2,
    ];
  }

  const polygon =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates?.[0]
        : null;

  const outerRing = polygon?.[0];
  const centroid = Array.isArray(outerRing)
    ? homeRingCentroid(outerRing)
    : null;

  if (
    centroid &&
    homePointInPolygonGeometry(
      geometry,
      centroid,
    )
  ) {
    return centroid;
  }

  return homeFallbackInsidePoint(
    geometry,
    bounds,
  );
}

function firstOuterRing(parcelGeometry: any): number[][] | null {
  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  if (!geometry?.coordinates) return null;

  if (geometry.type === 'Polygon') {
    return Array.isArray(geometry.coordinates?.[0])
      ? geometry.coordinates[0]
      : null;
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as any[];
    if (!Array.isArray(polygons) || !polygons.length) return null;

    let best: number[][] | null = null;
    let bestSize = 0;
    for (const polygon of polygons) {
      const ring = polygon?.[0];
      if (Array.isArray(ring) && ring.length > bestSize) {
        best = ring;
        bestSize = ring.length;
      }
    }
    return best;
  }

  return null;
}

function ringClipPath(ring: number[][] | null, bbox: HomeBBox | null) {
  if (!ring || !bbox) return undefined;
  const [west, south, east, north] = bbox;
  const width = east - west;
  const height = north - south;
  if (width <= 0 || height <= 0) return undefined;

  const points = ring
    .filter(
      (p) =>
        Array.isArray(p) &&
        Number.isFinite(Number(p[0])) &&
        Number.isFinite(Number(p[1]))
    )
    .map(([lng, lat]) => {
      const x = ((Number(lng) - west) / width) * 100;
      const y = ((north - Number(lat)) / height) * 100;
      return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
    });

  return points.length >= 3 ? `polygon(${points.join(',')})` : undefined;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function ndviValueToColor(value: number) {
  const v = clamp01(value);

  // IMPORTANT: Map colours and GeoBlaze percentages use the same absolute
  // NDVI classes. This prevents a relatively "better" pixel from turning
  // green when it is still below the absolute healthy threshold.
  if (v < 0.30) {
    return { r: 230, g: 48, b: 35 };
  }

  if (v < 0.60) {
    return { r: 242, g: 174, b: 24 };
  }

  if (v < 0.80) {
    return { r: 112, g: 191, b: 61 };
  }

  return { r: 13, g: 122, b: 46 };
}

function renderedNdviScore(r: number, g: number, b: number) {
  /*
   * satellite-field-analysis renders NDVI with four fixed absolute classes.
   * Decode those colours back into representative NDVI values so every later
   * operation (smoothing, hotspot search, Pusula focus) keeps the same class
   * semantics as GeoBlaze:
   *   red < .30, amber .30-.59, green .60-.79, dark green >= .80.
   *
   * Nearest-colour matching is deliberately used instead of relative hue
   * normalization; JPEG/PNG/canvas interpolation may shift the RGB values a
   * little, but cannot change the underlying class.
   */
  const palette = [
    { rgb: [230, 26, 20], value: 0.15 },
    { rgb: [242, 163, 26], value: 0.45 },
    { rgb: [112, 191, 61], value: 0.70 },
    { rgb: [13, 122, 46], value: 0.90 },
  ] as const;

  let best: (typeof palette)[number] = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of palette) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    const distance = dr * dr + dg * dg + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return best.value;
}


type HomeHotspotPoint = {
  x: number;
  y: number;
};

function homeHotspotConvexHull(
  points: HomeHotspotPoint[],
): HomeHotspotPoint[] {
  if (points.length <= 3) return points;

  const unique = Array.from(
    new Map(
      points.map((point) => [
        `${point.x.toFixed(6)}:${point.y.toFixed(6)}`,
        point,
      ]),
    ).values(),
  ).sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x,
  );

  if (unique.length <= 3) return unique;

  const cross = (
    o: HomeHotspotPoint,
    a: HomeHotspotPoint,
    b: HomeHotspotPoint,
  ) =>
    (a.x - o.x) * (b.y - o.y) -
    (a.y - o.y) * (b.x - o.x);

  const lower: HomeHotspotPoint[] = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(
        lower[lower.length - 2],
        lower[lower.length - 1],
        point,
      ) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: HomeHotspotPoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (
      upper.length >= 2 &&
      cross(
        upper[upper.length - 2],
        upper[upper.length - 1],
        point,
      ) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

async function homeNdviHotspotFocus(
  imageUrl: string,
  bbox: HomeBBox,
): Promise<{
  feature: any;
  bounds: HomeBBox;
  hotspotCount: number;
} | null> {
  if (!imageUrl || !bbox) return null;

  return new Promise((resolve) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          resolve(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });

        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          width,
          height,
        ).data;

        const cols = 72;
        const rows = Math.max(
          36,
          Math.round(cols * (height / width)),
        );

        type Cell = {
          col: number;
          row: number;
          score: number;
        };

        const cells = new Map<string, Cell>();

        const sampleCell = (
          col: number,
          row: number,
        ) => {
          const px = Math.max(
            0,
            Math.min(
              width - 1,
              Math.round(((col + 0.5) / cols) * width),
            ),
          );
          const py = Math.max(
            0,
            Math.min(
              height - 1,
              Math.round(((row + 0.5) / rows) * height),
            ),
          );

          const index = (py * width + px) * 4;
          const alpha = pixels[index + 3];

          if (alpha < 46) return null;

          return renderedNdviScore(
            pixels[index],
            pixels[index + 1],
            pixels[index + 2],
          );
        };

        const collect = (threshold: number) => {
          cells.clear();

          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const score = sampleCell(col, row);
              if (score == null || score > threshold) continue;

              cells.set(`${col}:${row}`, {
                col,
                row,
                score,
              });
            }
          }
        };

        // Önce gerçekten düşük NDVI renklerini hedefle.
        collect(0.30);

        // Çok az piksel varsa sabit eşiği hafifçe gevşet.
        if (cells.size < 4) {
          collect(0.30);
        }

        /*
         * Parselin tamamı görece sağlıklıysa sabit kırmızı eşik hiç hücre
         * bulamayabilir. "Zayıf alan" burada tarlanın kendi içindeki göreli
         * en zayıf bölge anlamına gelir; sahte koordinat üretmeden doğrudan
         * aynı NDVI rasterındaki en düşük dilimi kullanıyoruz.
         */
        if (cells.size < 3) {
          const allCells: Cell[] = [];

          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const score = sampleCell(col, row);
              if (score == null) continue;
              allCells.push({ col, row, score });
            }
          }

          allCells.sort((a, b) => a.score - b.score);

          const relativeCount = Math.max(
            3,
            Math.min(
              allCells.length,
              Math.ceil(allCells.length * 0.16),
            ),
          );

          cells.clear();
          for (const cell of allCells.slice(0, relativeCount)) {
            cells.set(`${cell.col}:${cell.row}`, cell);
          }
        }

        if (cells.size < 3) {
          resolve(null);
          return;
        }

        const visited = new Set<string>();
        const components: Cell[][] = [];
        const neighborOffsets = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],            [1, 0],
          [-1, 1],  [0, 1],   [1, 1],
        ];

        for (const [key, start] of cells) {
          if (visited.has(key)) continue;

          const queue = [start];
          const component: Cell[] = [];
          visited.add(key);

          while (queue.length) {
            const current = queue.shift()!;
            component.push(current);

            for (const [dx, dy] of neighborOffsets) {
              const nextCol = current.col + dx;
              const nextRow = current.row + dy;
              const nextKey = `${nextCol}:${nextRow}`;

              if (
                nextCol < 0 ||
                nextCol >= cols ||
                nextRow < 0 ||
                nextRow >= rows ||
                visited.has(nextKey)
              ) {
                continue;
              }

              const next = cells.get(nextKey);
              if (!next) continue;

              visited.add(nextKey);
              queue.push(next);
            }
          }

          if (component.length >= 3) {
            components.push(component);
          }
        }

        if (!components.length) {
          /*
           * Çok parçalı/gürültülü rasterda en düşük hücreler birbirine
           * değmeyebilir. En düşük gerçek hücrenin yakın çevresinden küçük
           * bir küme kur; böylece Haritada göster her zaman gerçek rasterdaki
           * göreli en zayıf noktaya odaklanır, tüm parsele yayılmaz.
           */
          const rankedCells = Array.from(cells.values()).sort(
            (a, b) => a.score - b.score,
          );
          const seed = rankedCells[0];

          if (seed) {
            let local = rankedCells
              .filter(
                (cell) =>
                  Math.abs(cell.col - seed.col) <= 3 &&
                  Math.abs(cell.row - seed.row) <= 3,
              )
              .slice(0, 18);

            if (local.length < 3) {
              local = rankedCells.slice(0, Math.min(6, rankedCells.length));
            }

            if (local.length >= 3) {
              components.push(local);
            }
          }
        }

        if (!components.length) {
          resolve(null);
          return;
        }

        const ranked = components
          .map((component) => {
            const mean =
              component.reduce(
                (sum, cell) => sum + cell.score,
                0,
              ) / component.length;

            const severity = Math.max(0.01, 0.48 - mean);

            return {
              component,
              mean,
              rank:
                severity *
                Math.sqrt(component.length),
            };
          })
          .sort((a, b) => b.rank - a.rank);

        const strongest = ranked[0]?.rank ?? 0;

        const selected = ranked
          .filter(
            (item, index) =>
              index === 0 ||
              item.rank >= strongest * 0.42,
          )
          .slice(0, 3);

        const [west, south, east, north] = bbox;
        const spanLng = east - west;
        const spanLat = north - south;

        const polygons: number[][][][] = [];
        let focusWest = Infinity;
        let focusSouth = Infinity;
        let focusEast = -Infinity;
        let focusNorth = -Infinity;

        for (const item of selected) {
          const cornerPoints: HomeHotspotPoint[] = [];

          for (const cell of item.component) {
            const x0 = cell.col / cols;
            const x1 = (cell.col + 1) / cols;
            const y0 = cell.row / rows;
            const y1 = (cell.row + 1) / rows;

            cornerPoints.push(
              { x: x0, y: y0 },
              { x: x1, y: y0 },
              { x: x1, y: y1 },
              { x: x0, y: y1 },
            );
          }

          const hull = homeHotspotConvexHull(cornerPoints);
          if (hull.length < 3) continue;

          const ring = hull.map((point) => {
            const lng = west + point.x * spanLng;
            const lat = north - point.y * spanLat;

            focusWest = Math.min(focusWest, lng);
            focusSouth = Math.min(focusSouth, lat);
            focusEast = Math.max(focusEast, lng);
            focusNorth = Math.max(focusNorth, lat);

            return [lng, lat];
          });

          ring.push([...ring[0]]);
          polygons.push([ring]);
        }

        if (
          !polygons.length ||
          ![
            focusWest,
            focusSouth,
            focusEast,
            focusNorth,
          ].every(Number.isFinite)
        ) {
          resolve(null);
          return;
        }

        resolve({
          feature: {
            type: 'Feature',
            properties: {
              source: 'ndvi-real-hotspots',
              hotspotCount: polygons.length,
            },
            geometry:
              polygons.length === 1
                ? {
                    type: 'Polygon',
                    coordinates: polygons[0],
                  }
                : {
                    type: 'MultiPolygon',
                    coordinates: polygons,
                  },
          },
          bounds: [
            focusWest,
            focusSouth,
            focusEast,
            focusNorth,
          ],
          hotspotCount: polygons.length,
        });
      } catch (error) {
        console.warn(
          'NDVI gerçek hotspot alanı çıkarılamadı:',
          error,
        );
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

function gaussianKernel(radius: number, sigma: number) {
  const kernel: number[] = [];
  let total = 0;

  for (let i = -radius; i <= radius; i += 1) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(value);
    total += value;
  }

  return kernel.map((value) => value / total);
}

// VARYASYON A: güçlü/sisli geçiş — keskin Sentinel hücrelerini eritmek için.
function gaussianBlurMasked(
  scores: Float32Array,
  weights: Float32Array,
  width: number,
  height: number
) {
  const radius = 7;
  const kernel = gaussianKernel(radius, 3.9);

  const horizontal = new Float32Array(scores.length);
  const horizontalWeight = new Float32Array(scores.length);
  const output = new Float32Array(scores.length);
  const outputWeight = new Float32Array(scores.length);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;

    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let weightSum = 0;

      for (let k = -radius; k <= radius; k += 1) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        const index = row + sx;
        const w = kernel[k + radius] * weights[index];
        sum += scores[index] * w;
        weightSum += w;
      }

      const index = row + x;
      horizontal[index] = weightSum > 0 ? sum / weightSum : 0;
      horizontalWeight[index] = weightSum > 0 ? 1 : 0;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let weightSum = 0;

      for (let k = -radius; k <= radius; k += 1) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        const index = sy * width + x;
        const w = kernel[k + radius] * horizontalWeight[index];
        sum += horizontal[index] * w;
        weightSum += w;
      }

      const index = y * width + x;
      output[index] = weightSum > 0 ? sum / weightSum : 0;
      outputWeight[index] = weightSum > 0 ? 1 : 0;
    }
  }

  return { scores: output, weights: outputWeight };
}

async function makeSmoothNdviOverlay(
  imageUrl: string,
  bbox: HomeBBox | null,
  parcelGeometry: any
): Promise<string | null> {
  if (!imageUrl) return null;

  return new Promise((resolve) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!sourceWidth || !sourceHeight) {
          resolve(null);
          return;
        }

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sourceWidth;
        sourceCanvas.height = sourceHeight;

        const sourceContext = sourceCanvas.getContext('2d', {
          willReadFrequently: true,
        });

        if (!sourceContext) {
          resolve(null);
          return;
        }

        sourceContext.drawImage(image, 0, 0);

        const pixels = sourceContext.getImageData(
          0,
          0,
          sourceWidth,
          sourceHeight
        ).data;

        // IMPORTANT:
        // We do NOT blur the existing coloured rectangles anymore.
        // Instead we sample the real Sentinel render into many health points,
        // then rebuild a continuous heat surface from radial gradients.
        // This is the same visual idea as SVG circles + feGaussianBlur,
        // but the point values still come from the real NDVI raster.

        const sampleCols = 18;
        const sampleRows = 18;
        const points: Array<{
          x: number;
          y: number;
          value: number;
          weight: number;
        }> = [];

        const cellWidth = sourceWidth / sampleCols;
        const cellHeight = sourceHeight / sampleRows;

        for (let gy = 0; gy < sampleRows; gy += 1) {
          for (let gx = 0; gx < sampleCols; gx += 1) {
            const x0 = Math.floor(gx * cellWidth);
            const y0 = Math.floor(gy * cellHeight);
            const x1 = Math.min(sourceWidth, Math.ceil((gx + 1) * cellWidth));
            const y1 = Math.min(sourceHeight, Math.ceil((gy + 1) * cellHeight));

            let scoreSum = 0;
            let weightSum = 0;

            // A few samples per cell are enough and keep this fast on phones.
            const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
            const stepY = Math.max(1, Math.floor((y1 - y0) / 5));

            for (let y = y0; y < y1; y += stepY) {
              for (let x = x0; x < x1; x += stepX) {
                const index = (y * sourceWidth + x) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const a = pixels[index + 3];

                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const chroma = max - min;

                const noData = a < 10 || max < 32 || (max < 72 && chroma < 16);

                if (noData) continue;

                scoreSum += renderedNdviScore(r, g, b);
                weightSum += 1;
              }
            }

            if (weightSum < 2) continue;

            points.push({
              x: (gx + 0.5) / sampleCols,
              y: (gy + 0.5) / sampleRows,
              value: scoreSum / weightSum,
              weight: Math.min(1, weightSum / 12),
            });
          }
        }

        if (!points.length) {
          resolve(null);
          return;
        }

        // Do not normalize the field to its own min/max here. Relative
        // stretching was the source of the visual contradiction: a field with
        // 0% healthy pixels could still contain green areas. Point values now
        // remain on the absolute NDVI scale used by GeoBlaze percentages.

        const width = 720;
        const height = Math.max(
          420,
          Math.round(width * (sourceHeight / sourceWidth))
        );

        // Separate colour and weight canvases so overlapping circles average
        // instead of making saturated hard blobs.
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = width;
        colorCanvas.height = height;
        const colorContext = colorCanvas.getContext('2d');

        const alphaCanvas = document.createElement('canvas');
        alphaCanvas.width = width;
        alphaCanvas.height = height;
        const alphaContext = alphaCanvas.getContext('2d');

        if (!colorContext || !alphaContext) {
          resolve(null);
          return;
        }

        colorContext.clearRect(0, 0, width, height);
        alphaContext.clearRect(0, 0, width, height);

        // Large radius is intentional: this is the "Variation A / stdDeviation 12"
        // look. Neighbouring points melt together into one continuous surface.
        const radius = Math.max(width / sampleCols, height / sampleRows) * 2.6;

        for (const point of points) {
          const value = clamp01(point.value);
          const color = ndviValueToColor(value);
          const cx = point.x * width;
          const cy = point.y * height;

          const gradient = colorContext.createRadialGradient(
            cx,
            cy,
            0,
            cx,
            cy,
            radius
          );

          gradient.addColorStop(
            0,
            `rgba(${color.r},${color.g},${color.b},${0.62 * point.weight})`
          );
          gradient.addColorStop(
            0.38,
            `rgba(${color.r},${color.g},${color.b},${0.48 * point.weight})`
          );
          gradient.addColorStop(
            0.72,
            `rgba(${color.r},${color.g},${color.b},${0.22 * point.weight})`
          );
          gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);

          colorContext.fillStyle = gradient;
          colorContext.beginPath();
          colorContext.arc(cx, cy, radius, 0, Math.PI * 2);
          colorContext.fill();

          const alphaGradient = alphaContext.createRadialGradient(
            cx,
            cy,
            0,
            cx,
            cy,
            radius
          );
          alphaGradient.addColorStop(
            0,
            `rgba(255,255,255,${0.92 * point.weight})`
          );
          alphaGradient.addColorStop(
            0.55,
            `rgba(255,255,255,${0.58 * point.weight})`
          );
          alphaGradient.addColorStop(1, 'rgba(255,255,255,0)');

          alphaContext.fillStyle = alphaGradient;
          alphaContext.beginPath();
          alphaContext.arc(cx, cy, radius, 0, Math.PI * 2);
          alphaContext.fill();
        }

        // Strong finishing blur so there are absolutely no rectangular seams.
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalContext = finalCanvas.getContext('2d');

        if (!finalContext) {
          resolve(colorCanvas.toDataURL('image/png'));
          return;
        }

        finalContext.clearRect(0, 0, width, height);
        finalContext.filter = 'blur(15px)';
        finalContext.drawImage(colorCanvas, 0, 0);
        finalContext.filter = 'none';

        // A tiny amount of original radial detail keeps local hotspots readable.
        finalContext.globalAlpha = 0.14;
        finalContext.drawImage(colorCanvas, 0, 0);
        finalContext.globalAlpha = 1;

        // HARD PARCEL CLIP.
        // The previous version clipped a DOM rectangle after MapLibre had already
        // pitched/rotated the map. At strong 3D angles that rectangle no longer
        // matched the geographic parcel, so the NDVI appeared to slide outside.
        // Here we cut the heatmap to the parcel BEFORE it enters MapLibre.
        if (bbox && parcelGeometry) {
          const [west, south, east, north] = bbox;
          const spanX = east - west;
          const spanY = north - south;

          if (spanX > 0 && spanY > 0) {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = width;
            maskCanvas.height = height;

            const maskContext = maskCanvas.getContext('2d');

            if (maskContext) {
              const geometry = parcelGeometry?.geometry ?? parcelGeometry;

              const traceRing = (ring: any[]) => {
                let started = false;

                for (const point of ring ?? []) {
                  if (!Array.isArray(point) || point.length < 2) continue;

                  const lng = Number(point[0]);
                  const lat = Number(point[1]);

                  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

                  const x = ((lng - west) / spanX) * width;
                  const y = ((north - lat) / spanY) * height;

                  if (!started) {
                    maskContext.moveTo(x, y);
                    started = true;
                  } else {
                    maskContext.lineTo(x, y);
                  }
                }

                if (started) maskContext.closePath();
              };

              maskContext.beginPath();

              if (geometry?.type === 'Polygon') {
                (geometry.coordinates ?? []).forEach(traceRing);
              } else if (geometry?.type === 'MultiPolygon') {
                (geometry.coordinates ?? []).forEach((polygon: any[]) =>
                  (polygon ?? []).forEach(traceRing)
                );
              }

              maskContext.fillStyle = '#fff';
              maskContext.fill('evenodd');

              finalContext.save();
              finalContext.globalCompositeOperation = 'destination-in';
              finalContext.drawImage(maskCanvas, 0, 0);
              finalContext.restore();
            }
          }
        }

        resolve(finalCanvas.toDataURL('image/png'));
      } catch (error) {
        console.warn('Yumuşak NDVI yüzeyi hazırlanamadı:', error);
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

function InteractiveHomeHealthMap({
  data,
  parcelGeometry,
  height = 390,
  onOpen,
}: {
  data: any;
  parcelGeometry?: any;
  height?: number;
  onOpen?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const [smoothNdvi, setSmoothNdvi] = useState<string | null>(null);

  const bbox = useMemo(
    () => normalizeHomeBbox(data?.bbox) ?? homeBboxFromGeometry(parcelGeometry),
    [data?.bbox, parcelGeometry]
  );

  useEffect(() => {
    let cancelled = false;

    if (!data?.ndviImage) {
      setSmoothNdvi(null);
      return () => {
        cancelled = true;
      };
    }

    void makeSmoothNdviOverlay(data.ndviImage, bbox, parcelGeometry).then(
      (result) => {
        if (!cancelled) {
          setSmoothNdvi(result || data.ndviImage);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    data?.ndviImage,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
    parcelGeometry,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !smoothNdvi || !bbox) return;

    let cancelled = false;

    const install = () => {
      if (cancelled || !mapRef.current) return;

      const currentMap = mapRef.current;
      if (!currentMap) return;

      const coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number]
      ] = [
        [bbox[0], bbox[3]],
        [bbox[2], bbox[3]],
        [bbox[2], bbox[1]],
        [bbox[0], bbox[1]],
      ];

      try {
        const existing = currentMap.getSource('home-ndvi-image') as
          | maplibregl.ImageSource
          | undefined;

        if (existing && typeof existing.updateImage === 'function') {
          existing.updateImage({
            url: smoothNdvi,
            coordinates,
          });
        } else {
          currentMap.addSource('home-ndvi-image', {
            type: 'image',
            url: smoothNdvi,
            coordinates,
          });

          currentMap.addLayer(
            {
              id: 'home-ndvi-layer',
              type: 'raster',
              source: 'home-ndvi-image',
              paint: {
                'raster-opacity': 0.82,
                'raster-fade-duration': 0,
                'raster-saturation': 0.04,
                'raster-contrast': -0.04,
              },
            },
            currentMap.getLayer('home-parcel-shadow')
              ? 'home-parcel-shadow'
              : undefined
          );
        }
      } catch (error) {
        console.warn('NDVI harita katmanı eklenemedi:', error);
      }
    };

    if (map.loaded()) {
      install();
    } else {
      map.once('load', install);
    }

    return () => {
      cancelled = true;
      try {
        map.off('load', install);
      } catch {
        // no-op
      }
    };
  }, [smoothNdvi, bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3]]);

  const fitParcel = () => {
    const map = mapRef.current;
    if (!map || !bbox) return;
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        // Bilinçli olarak geniş boşluk: tarlanın çevresi de ilk karede görünür.
        padding: { top: 18, right: 18, bottom: 30, left: 18 },
        maxZoom: 18.35,
        pitch: bbox ? 55 : 0,
        bearing: bbox ? -14 : 0,
        duration: 650,
      }
    );
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const center: [number, number] = bbox
      ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
      : [35.2433, 38.9637];

    const map = new mapRuntime.Map({
      container,
      style: HOME_SATELLITE_STYLE,
      center,
      zoom: bbox ? 14.2 : 6,
      pitch: 55,
      bearing: -14,
      minZoom: 2,
      maxZoom: 22,
      maxPitch: 68,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;

    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right'
    );

    addTarlaCompass(map, 'bottom-right');

    map.on('load', () => {
      if (parcelGeometry) {
        try {
          map.addSource('home-parcel', {
            type: 'geojson',
            data:
              parcelGeometry?.type === 'Feature'
                ? parcelGeometry
                : {
                    type: 'Feature',
                    properties: {},
                    geometry: parcelGeometry?.geometry ?? parcelGeometry,
                  },
          });

          map.addLayer({
            id: 'home-parcel-shadow',
            type: 'line',
            source: 'home-parcel',
            paint: {
              'line-color': '#06100B',
              'line-width': 7,
              'line-opacity': 0.85,
            },
          });

          map.addLayer({
            id: 'home-parcel-line',
            type: 'line',
            source: 'home-parcel',
            paint: {
              'line-color': '#70E39A',
              'line-width': 2.4,
              'line-opacity': 0.98,
            },
          });
        } catch (error) {
          console.warn('Ana sayfa parsel sınırı eklenemedi:', error);
        }
      }

      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          {
            padding: { top: 18, right: 18, bottom: 30, left: 18 },
            maxZoom: 18.35,
            pitch: 55,
            bearing: -14,
            duration: 0,
          }
        );
      }

      requestAnimationFrame(() => {
        map.resize();
      });
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], parcelGeometry]);

  return (
    <div className="tp-real-home-map" style={{ height }}>
      <div ref={containerRef} className="tp-real-home-map-canvas" />

      <MapDataDate latestDate={data?.latestImageDate} hasData={Boolean(smoothNdvi && bbox)} />

      <button
        type="button"
        className="tp-real-home-reset"
        onClick={fitParcel}
        aria-label="Tarlayı ortala"
        title="Tarlayı ortala"
      >
        ⌖
      </button>

      <div className="tp-real-home-badge">🌿 Bitki Sağlığı · Güncel NDVI</div>

      <div className="tp-real-home-legend">
        <strong>Bitki Sağlığı</strong>
        <div
          className="tp-gradient"
          style={{
            background:
              HOME_LAYER_FARMER_GUIDES.vegetation.legendGradient,
          }}
        />
        <div className="tp-legend-label">
          <span>Zayıf</span>
          <span>Orta</span>
          <span>Güçlü</span>
        </div>
      </div>

      {onOpen && (
        <button
          type="button"
          className="tp-real-home-open"
          onClick={onOpen}
          aria-label="Uydularımı aç"
          title="Uydularımı aç"
        >
          ↗
        </button>
      )}
    </div>
  );
}

export type HomeLayer =
  | 'vegetation'
  | 'radar-vv'
  | 'radar-vh'
  | 'radar-water'
  | 'soil'
  | 'climate'
  | 'surface-temperature'
  | 'evapotranspiration'
  | 'rainfall-history';

type HomeRadarLayer =
  | 'radar-vv'
  | 'radar-vh'
  | 'radar-water';

type HomeSpatialMode =
  | 'field-detail'
  | 'general';

type HomeVariabilityLevel =
  | 'low'
  | 'medium'
  | 'high';


function homeRenderedRadarRatio(
  r: number,
  g: number,
  b: number,
  layer: HomeRadarLayer,
) {
  let bestRatio = 0.5;
  let bestDistance = Infinity;

  /*
   * Görsel zaten homeRadarRgb() ile üretildiği için, ekrandaki rengi
   * aynı palete geri eşleyerek 0..1 katman oranını çıkarıyoruz.
   * Böylece "Haritada göster" veri kaynağından kopuk yeni bir skor üretmez.
   */
  for (let step = 0; step <= 50; step += 1) {
    const ratio = step / 50;
    const sample = homeRadarRgb(ratio, layer);

    const distance =
      (sample.r - r) ** 2 +
      (sample.g - g) ** 2 +
      (sample.b - b) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestRatio = ratio;
    }
  }

  return bestRatio;
}

async function homeRadarHotspotFocus(
  imageUrl: string,
  bbox: HomeBBox,
  layer: HomeRadarLayer,
): Promise<{
  feature: any;
  bounds: HomeBBox;
  hotspotCount: number;
} | null> {
  if (!imageUrl || !bbox) return null;

  return new Promise((resolve) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          resolve(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d', {
          willReadFrequently: true,
        });

        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          width,
          height,
        ).data;

        const cols = 68;
        const rows = Math.max(
          34,
          Math.round(cols * (height / width)),
        );

        type Cell = {
          col: number;
          row: number;
          ratio: number;
          severity: number;
        };

        const cells = new Map<string, Cell>();

        const sampleCell = (
          col: number,
          row: number,
        ) => {
          const px = Math.max(
            0,
            Math.min(
              width - 1,
              Math.round(((col + 0.5) / cols) * width),
            ),
          );
          const py = Math.max(
            0,
            Math.min(
              height - 1,
              Math.round(((row + 0.5) / rows) * height),
            ),
          );

          const index = (py * width + px) * 4;
          const alpha = pixels[index + 3];

          // Parsel maskesinin dışı / veri olmayan alan.
          if (alpha < 50) return null;

          const ratio = homeRenderedRadarRatio(
            pixels[index],
            pixels[index + 1],
            pixels[index + 2],
            layer,
          );

          let severity = 0;

          if (layer === 'radar-water') {
            // Palet solda mavi = yüksek risk, sağda zeytin = düşük risk.
            severity = 1 - ratio;
          } else if (layer === 'radar-vv') {
            // Daha yüksek oran = daha güçlü nem sinyali.
            severity = ratio;
          } else {
            // VH: yüksek oran = daha belirgin yüzey/bitki farkı.
            severity = ratio;
          }

          return {
            ratio,
            severity,
          };
        };

        const threshold =
          layer === 'radar-water'
            ? 0.68
            : layer === 'radar-vv'
              ? 0.70
              : 0.70;

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const sampled = sampleCell(col, row);
            if (
              !sampled ||
              sampled.severity < threshold
            ) {
              continue;
            }

            cells.set(`${col}:${row}`, {
              col,
              row,
              ratio: sampled.ratio,
              severity: sampled.severity,
            });
          }
        }

        if (cells.size < 3) {
          resolve(null);
          return;
        }

        const visited = new Set<string>();
        const components: Cell[][] = [];
        const neighbors = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],            [1, 0],
          [-1, 1],  [0, 1],   [1, 1],
        ];

        for (const [key, start] of cells) {
          if (visited.has(key)) continue;

          const queue = [start];
          const component: Cell[] = [];
          visited.add(key);

          while (queue.length) {
            const current = queue.shift()!;
            component.push(current);

            for (const [dx, dy] of neighbors) {
              const nextCol = current.col + dx;
              const nextRow = current.row + dy;
              const nextKey = `${nextCol}:${nextRow}`;

              if (
                nextCol < 0 ||
                nextCol >= cols ||
                nextRow < 0 ||
                nextRow >= rows ||
                visited.has(nextKey)
              ) {
                continue;
              }

              const next = cells.get(nextKey);
              if (!next) continue;

              visited.add(nextKey);
              queue.push(next);
            }
          }

          if (component.length >= 3) {
            components.push(component);
          }
        }

        if (!components.length) {
          resolve(null);
          return;
        }

        const ranked = components
          .map((component) => {
            const meanSeverity =
              component.reduce(
                (sum, cell) => sum + cell.severity,
                0,
              ) / component.length;

            return {
              component,
              meanSeverity,
              rank:
                meanSeverity *
                Math.sqrt(component.length),
            };
          })
          .sort((a, b) => b.rank - a.rank);

        const strongest = ranked[0]?.rank ?? 0;

        const selected = ranked
          .filter(
            (item, index) =>
              index === 0 ||
              item.rank >= strongest * 0.45,
          )
          .slice(0, 3);

        const [west, south, east, north] = bbox;
        const spanLng = east - west;
        const spanLat = north - south;

        const polygons: number[][][][] = [];
        let focusWest = Infinity;
        let focusSouth = Infinity;
        let focusEast = -Infinity;
        let focusNorth = -Infinity;

        for (const item of selected) {
          const cornerPoints: HomeHotspotPoint[] = [];

          for (const cell of item.component) {
            const x0 = cell.col / cols;
            const x1 = (cell.col + 1) / cols;
            const y0 = cell.row / rows;
            const y1 = (cell.row + 1) / rows;

            cornerPoints.push(
              { x: x0, y: y0 },
              { x: x1, y: y0 },
              { x: x1, y: y1 },
              { x: x0, y: y1 },
            );
          }

          const hull = homeHotspotConvexHull(
            cornerPoints,
          );

          if (hull.length < 3) continue;

          const ring = hull.map((point) => {
            const lng = west + point.x * spanLng;
            const lat = north - point.y * spanLat;

            focusWest = Math.min(focusWest, lng);
            focusSouth = Math.min(focusSouth, lat);
            focusEast = Math.max(focusEast, lng);
            focusNorth = Math.max(focusNorth, lat);

            return [lng, lat];
          });

          ring.push([...ring[0]]);
          polygons.push([ring]);
        }

        if (
          !polygons.length ||
          ![
            focusWest,
            focusSouth,
            focusEast,
            focusNorth,
          ].every(Number.isFinite)
        ) {
          resolve(null);
          return;
        }

        resolve({
          feature: {
            type: 'Feature',
            properties: {
              source: 'radar-real-hotspots',
              layer,
              hotspotCount: polygons.length,
            },
            geometry:
              polygons.length === 1
                ? {
                    type: 'Polygon',
                    coordinates: polygons[0],
                  }
                : {
                    type: 'MultiPolygon',
                    coordinates: polygons,
                  },
          },
          bounds: [
            focusWest,
            focusSouth,
            focusEast,
            focusNorth,
          ],
          hotspotCount: polygons.length,
        });
      } catch (error) {
        console.warn(
          'Radar gerçek hotspot alanı çıkarılamadı:',
          error,
        );
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

export type HomeLayerSpatialSummary = {
  layer: HomeLayer;
  mode: HomeSpatialMode;
  variability: HomeVariabilityLevel | null;
  variabilityLabel: string;
  shortLabel: string;
  message: string;
  detail: string;
  displayValue?: number | null;
  displayUnit?: string;
  displayLabel?: string;
  displayMeta?: string;
};

const HOME_RADAR_PALETTES: Record<
  HomeRadarLayer,
  readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
> = {
  'radar-vv': [
    [39, 48, 50],
    [47, 77, 80],
    [56, 112, 116],
    [64, 157, 158],
    [151, 217, 194],
  ],
  'radar-vh': [
    [34, 52, 47],
    [39, 79, 63],
    [52, 112, 82],
    [72, 157, 103],
    [126, 207, 144],
  ],
  'radar-water': [
    [32, 69, 184],
    [37, 112, 193],
    [63, 154, 184],
    [87, 154, 130],
    [111, 137, 83],
  ],
};

function homeRadarRgb(
  ratio: number,
  layer: HomeRadarLayer,
) {
  const palette = HOME_RADAR_PALETTES[layer];
  const value = Math.max(0, Math.min(1, ratio));
  const scaled = value * (palette.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(palette.length - 1, left + 1);
  const fraction = scaled - left;

  const mix = (a: number, b: number) =>
    Math.round(a + (b - a) * fraction);

  return {
    r: mix(palette[left][0], palette[right][0]),
    g: mix(palette[left][1], palette[right][1]),
    b: mix(palette[left][2], palette[right][2]),
  };
}

function homeRadarGradient(layer: HomeRadarLayer) {
  const stops = HOME_RADAR_PALETTES[layer].map(
    (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
  );

  return `linear-gradient(90deg,${stops.join(',')})`;
}

export const HOME_LAYER_AI_LABELS: Record<HomeLayer, string> = {
  vegetation: 'NDVI',
  'radar-vv': 'Yüzey Nem Sinyali',
  'radar-vh': 'Yüzey & Bitki Farkı',
  'radar-water': 'Göllenme / Su Adayı',
  soil: 'Toprak',
  climate: 'İklim',
  'surface-temperature': 'Yüzeye Yakın Toprak Sıcaklığı',
  evapotranspiration: 'Buharlaşma & Su Talebi',
  'rainfall-history': 'Yağış Geçmişi',
};

type HomeAgroLayer =
  | 'surface-temperature'
  | 'evapotranspiration'
  | 'rainfall-history';

const HOME_AGRO_LAYER_LABELS: Record<HomeAgroLayer, string> = {
  'surface-temperature': 'Yüzeye Yakın Toprak Sıcaklığı',
  evapotranspiration: 'Buharlaşma & Su Talebi (ET₀)',
  'rainfall-history': 'Yağış Geçmişi',
};

export type HomeSoilProperty = 'phh2o' | 'soc' | 'clay' | 'sand' | 'silt';
export type HomeSoilDepth = '0-5cm' | '5-15cm' | '15-30cm';

export const HOME_SOIL_PROPERTY_LABELS: Record<HomeSoilProperty, string> = {
  phh2o: 'pH',
  soc: 'Organik Karbon',
  clay: 'Kil',
  sand: 'Kum',
  silt: 'Silt',
};

export const HOME_SOIL_DEPTH_LABELS: Record<HomeSoilDepth, string> = {
  '0-5cm': '0–5 cm',
  '5-15cm': '5–15 cm',
  '15-30cm': '15–30 cm',
};

export type HomeClimateLayer =
  | 'soil-moisture'
  | 'soil-temperature'
  | 'air-temperature'
  | 'precipitation';

export type HomeClimateDepth = '0-7cm' | '7-28cm' | '28-100cm';

export type HomeClimateVariable =
  | 'soil_moisture_0_to_7cm'
  | 'soil_moisture_7_to_28cm'
  | 'soil_moisture_28_to_100cm'
  | 'soil_temperature_0_to_7cm'
  | 'soil_temperature_7_to_28cm'
  | 'temperature_2m'
  | 'precipitation';

export const HOME_CLIMATE_LAYER_LABELS: Record<HomeClimateLayer, string> = {
  'soil-moisture': 'Toprak Nemi',
  'soil-temperature': 'Toprak Sıcaklığı',
  'air-temperature': 'Hava Sıcaklığı',
  precipitation: 'Yağış',
};

export const HOME_CLIMATE_DEPTH_LABELS: Record<HomeClimateDepth, string> = {
  '0-7cm': '0–7 cm',
  '7-28cm': '7–28 cm',
  '28-100cm': '28–100 cm',
};

type HomeLayerFarmerGuide = {
  title: string;
  what: string;
  agriculturalUse: string;
  interpretation: string;
  compareWith: string;
  source: string;
  caution: string;
  legend: [string, string, string];
  legendGradient: string;
};

const HOME_LAYER_FARMER_GUIDES: Record<HomeLayer, HomeLayerFarmerGuide> = {
  vegetation: {
    title: 'NDVI · Vejetasyon İndeksi',
    what:
      'Uydu görüntüsünde aktif yeşil bitki örtüsü sinyalinin sayısal NDVI dağılımını gösterir.',
    agriculturalUse:
      'Mutlak NDVI düzeyini görmek ve parselin kendi ortalamasına göre anlamlı derecede düşük bölgeleri saha kontrolü için ayırmakta kullanılır.',
    interpretation:
      'Ana haritadaki renkler mutlak NDVI sınıflarıdır. “Göreli fark” ise gerçek bölge NDVI ortalamasının parsel ortalamasından anlamlı derecede düşük olup olmadığını ayrı olarak gösterir.',
    compareWith: 'Yüzey Nem Sinyali · Yüzey Sıcaklığı · Saha Kontrolü',
    source: 'Sentinel-2 NDVI',
    caution:
      'Düşük NDVI tek başına hastalık veya kötü tarla anlamına gelmez; bahçe sıra araları, çıplak toprak, fenoloji, hasat ve bulut etkileyebilir.',
    legend: ['Düşük NDVI', 'Orta NDVI', 'Yüksek NDVI'],
    legendGradient: 'linear-gradient(90deg,#e2472a,#f2b705,#4caf50)',
  },
  'radar-vv': {
    title: 'Yüzey Nem Sinyali',
    what:
      'Radarın yüzeyden aldığı sinyale göre tarlanın diğer bölümlerinden daha nemli olabilecek alanları işaret eder.',
    agriculturalUse:
      'Fazla sulama, drenaj sorunu, su kaçağı veya uzun süre nemli kalan bölgeleri araştırmaya yardımcı olur.',
    interpretation:
      'Bu doğrudan bir toprak nem sensörü değildir. Yüzey pürüzlülüğü ve bitki örtüsü de radar sinyalini etkiler.',
    compareWith: 'Göllenme / Su Adayı · Yağış Geçmişi · Bitki Sağlığı',
    source: 'Sentinel-1 radar',
    caution:
      'Tek başına sulama kararı verilmemeli; yağış ve saha kontrolüyle doğrulanmalıdır.',
    legend: ['Daha Az Nem İhtimali', 'Orta', 'Daha Fazla Nem İhtimali'],
    legendGradient: homeRadarGradient('radar-vv'),
  },
  'radar-vh': {
    title: 'Yüzey & Bitki Farkı',
    what:
      'Tarlanın farklı bölgelerinde bitki yapısı, yüzey pürüzlülüğü veya nem nedeniyle oluşan radar farklarını gösterir. Yükseklik haritası değildir.',
    agriculturalUse:
      'Tarlanın geri kalanından farklı davranan bölgeleri bulup bitki gelişimi, yüzey yapısı veya nem açısından kontrol etmeye yardımcı olur.',
    interpretation:
      'Belirgin fark bir sorun olduğunu kesin olarak göstermez; önce Bitki Sağlığı ve Yüzey Nem Sinyali katmanlarıyla aynı bölgeyi karşılaştır.',
    compareWith: 'Bitki Sağlığı · Yüzey Nem Sinyali · Saha Kontrolü',
    source: 'Sentinel-1 radar',
    caution:
      'Sürüm izi, bitki sıklığı, toprak yüzeyi ve nem aynı anda radar görünümünü değiştirebilir.',
    legend: ['Benzer Alanlar', 'Değişen Alanlar', 'Belirgin Fark'],
    legendGradient: homeRadarGradient('radar-vh'),
  },
  'radar-water': {
    title: 'Göllenme / Su Adayı',
    what:
      'Radar görünümünde suya benzer davranan veya uzun süre ıslak kalma ihtimali bulunan bölgeleri işaret eder.',
    agriculturalUse:
      'Drenaj problemi, göllenme ve kök bölgesinde fazla su riski olabilecek yerleri önceden kontrol etmeye yardımcı olur.',
    interpretation:
      'Su adayı görülen alanı Yüzey Nem Sinyali ve son yağışlarla birlikte değerlendir. Tek radar görüntüsü kesin göllenme kanıtı değildir.',
    compareWith: 'Yüzey Nem Sinyali · Yağış Geçmişi · Saha Kontrolü',
    source: 'Sentinel-1 radar',
    caution:
      'Düz yüzeyler ve bazı toprak koşulları suya benzer radar tepkisi verebilir.',
    legend: ['Yüksek Risk', 'Orta Risk', 'Düşük Risk'],
    legendGradient: homeRadarGradient('radar-water'),
  },
  soil: {
    title: 'Toprak',
    what:
      'Toprak özelliklerinin bölgesel ve tahmini dağılımını gösterir.',
    agriculturalUse:
      'Toprak yapısını anlamaya, sulama ve gübreleme planını daha bilinçli hazırlamaya yardımcı olur.',
    interpretation:
      'Bu bir laboratuvar sonucu değildir. Gerçek toprak analizin varsa her zaman laboratuvar değerlerini önceliklendir.',
    compareWith: 'Laboratuvar Toprak Analizi · Bitki Sağlığı',
    source: 'SoilGrids tahmini profil',
    caution:
      'Parsel içindeki küçük farklılıkları kesin ölçüm gibi yorumlama.',
    legend: ['Düşük', 'Orta', 'Yüksek'],
    legendGradient: 'linear-gradient(90deg,#65584d,#b4a18a,#ece2d2)',
  },
  climate: {
    title: 'İklim',
    what:
      'Tarla çevresindeki sıcaklık, yağış ve toprak koşullarının model tabanlı iklim görünümünü gösterir.',
    agriculturalUse:
      'Sulama, ekim zamanı, sıcaklık stresi ve günlük tarla işlerini planlamaya yardımcı olur.',
    interpretation:
      'İklim verisi parsel içindeki metre ölçeğinde farkları değil, bölgesel koşulları anlatır.',
    compareWith: 'Bitki Sağlığı · Buharlaşma & Su Talebi · Hava Durumu',
    source: 'ERA5 / ERA5-Land',
    caution:
      'Yerel sensör veya saha gözlemi varsa daha hassas karar için birlikte kullanılmalıdır.',
    legend: ['Düşük', 'Orta', 'Yüksek'],
    legendGradient: 'linear-gradient(90deg,#2f6bd8,#e4c74f,#d34a35)',
  },
  'surface-temperature': {
    title: 'Yüzeye Yakın Toprak Sıcaklığı',
    what:
      'Tarla çevresindeki yüzeyin daha serin veya daha sıcak seyreden bölgelerini ve dönemleri gösterir.',
    agriculturalUse:
      'Isı stresi, hızlı su kaybı ve sulama ihtiyacının artabileceği sıcak dönemleri fark etmeye yardımcı olur.',
    interpretation:
      'Sıcak görünüm tek başına bitki stresi demek değildir. Bitki Sağlığı ve Su İhtiyacıyla birlikte okunmalıdır.',
    compareWith: 'Bitki Sağlığı · Buharlaşma & Su Talebi · Hava Sıcaklığı',
    source: 'ERA5-Land',
    caution:
      'Model çözünürlüğü parsel içindeki çok küçük sıcaklık farklarını kesin olarak göstermez.',
    legend: ['Daha Serin', 'Orta', 'Daha Sıcak'],
    legendGradient: 'linear-gradient(90deg,#2c70d6,#e6c044,#cd3e2f)',
  },
  evapotranspiration: {
    title: 'Buharlaşma & Su Talebi',
    what:
      'Hava koşullarının toprak ve bitkiden su kaybını ne kadar artırdığını gösteren referans su talebini izler.',
    agriculturalUse:
      'Sulama zamanını ve su ihtiyacının yükseldiği dönemleri planlamaya yardımcı olur.',
    interpretation:
      'ET₀ doğrudan “şu kadar litre su ver” demek değildir; ürün türü, gelişim dönemi, toprak ve yağışla birlikte kullanılmalıdır.',
    compareWith: 'Toprak Nemi · Yağış Geçmişi · Bitki Sağlığı',
    source: 'FAO-56 ET₀',
    caution:
      'Gerçek sulama miktarı ürün katsayısı ve saha koşullarına göre değişir.',
    legend: ['Düşük Su Talebi', 'Orta', 'Yüksek Su Talebi'],
    legendGradient: 'linear-gradient(90deg,#3b74ca,#debb47,#ca542d)',
  },
  'rainfall-history': {
    title: 'Yağış Geçmişi',
    what:
      'Tarla çevresinde son dönemde biriken toplam yağış miktarını gösterir.',
    agriculturalUse:
      'Sulama kararını, su açığını ve aşırı yağış sonrası drenaj ihtiyacını değerlendirmeye yardımcı olur.',
    interpretation:
      'Yağış toplamını tek başına yeterli su varmış gibi yorumlama; toprak nemi ve su ihtiyacıyla birlikte değerlendir.',
    compareWith: 'Toprak Nemi · Buharlaşma & Su Talebi · Göllenme / Su Adayı',
    source: 'Open-Meteo geçmiş yağış',
    caution:
      'Yağış verisi bölgesel grid verisidir; tarladaki gerçek yağış küçük farklılık gösterebilir.',
    legend: ['Az Yağış', 'Orta', 'Fazla Yağış'],
    legendGradient: 'linear-gradient(90deg,#d88d48,#63b1bc,#2453b1)',
  },
};

const HOME_SOIL_FARMER_GUIDES: Record<HomeSoilProperty, Partial<HomeLayerFarmerGuide>> = {
  phh2o: {
    title: 'Toprak · pH',
    what:
      'Toprağın daha asidik veya daha alkali olma eğilimini gösterir.',
    agriculturalUse:
      'Besinlerin bitki tarafından alınabilirliğini ve kireçleme/gübreleme kararlarını değerlendirmeye yardımcı olur.',
    interpretation:
      'Tahmini pH değeri yön gösterir; kireç veya ciddi gübreleme kararı öncesinde laboratuvar analiziyle doğrula.',
    legend: ['Daha Asidik', 'Orta pH', 'Daha Alkali'],
    legendGradient: 'linear-gradient(90deg,#c94c35,#e5bd45,#4dac68)',
  },
  soc: {
    title: 'Toprak · Organik Karbon',
    what:
      'Toprağın organik madde/karbon bakımından daha düşük veya daha yüksek olabilecek bölgelerini gösterir.',
    agriculturalUse:
      'Toprak verimliliği, su tutma kapasitesi ve organik madde yönetimini planlamaya yardımcı olur.',
    interpretation:
      'Düşük görünen bölgelerde organik madde yönetimi düşünülebilir; uygulama kararı laboratuvar analiziyle desteklenmelidir.',
    legend: ['Daha Az Organik Karbon', 'Orta', 'Daha Fazla Organik Karbon'],
    legendGradient: 'linear-gradient(90deg,#ead8b7,#a96b43,#3a241b)',
  },
  clay: {
    title: 'Toprak · Kil',
    what:
      'Toprağın kil oranının daha düşük veya daha yüksek olma eğilimini gösterir.',
    agriculturalUse:
      'Su tutma, drenaj, işlenebilirlik ve sulama sıklığını anlamaya yardımcı olur.',
    interpretation:
      'Kil arttıkça su daha uzun tutulabilir ve drenaj yavaşlayabilir; gerçek tekstürü saha veya laboratuvar analiziyle doğrula.',
    legend: ['Az Kil', 'Orta', 'Çok Kil'],
    legendGradient: 'linear-gradient(90deg,#f0d7a3,#d27a45,#71392f)',
  },
  sand: {
    title: 'Toprak · Kum',
    what:
      'Toprağın kum oranının daha düşük veya daha yüksek olma eğilimini gösterir.',
    agriculturalUse:
      'Suyun toprağa geçiş hızını ve sulamanın ne kadar sık gerekebileceğini anlamaya yardımcı olur.',
    interpretation:
      'Kumlu toprak daha hızlı su kaybedebilir; sulama planını toprak nemi ve ürün kök yapısıyla birlikte değerlendir.',
    legend: ['Az Kum', 'Orta', 'Çok Kum'],
    legendGradient: 'linear-gradient(90deg,#624b34,#d5a653,#fff0bd)',
  },
  silt: {
    title: 'Toprak · Silt',
    what:
      'Toprağın silt oranının daha düşük veya daha yüksek olma eğilimini gösterir.',
    agriculturalUse:
      'Toprak tekstürü, su tutma ve yüzey kabuklaşması gibi özellikleri anlamaya yardımcı olur.',
    interpretation:
      'Silt oranı tek başına karar verdirmez; kil ve kum oranlarıyla birlikte toprak tekstürü olarak değerlendirilmelidir.',
    legend: ['Az Silt', 'Orta', 'Çok Silt'],
    legendGradient: 'linear-gradient(90deg,#65584d,#b4a18a,#ece2d2)',
  },
};

const HOME_CLIMATE_FARMER_GUIDES: Record<HomeClimateLayer, Partial<HomeLayerFarmerGuide>> = {
  'soil-moisture': {
    title: 'İklim · Toprak Nemi',
    what:
      'Model verisine göre toprağın daha kuru veya daha nemli seyreden dönemsel durumunu gösterir.',
    agriculturalUse:
      'Sulama zamanlamasını ve su stresinin oluşabileceği dönemleri değerlendirmeye yardımcı olur.',
    interpretation:
      'Bu doğrudan tarlaya takılı nem sensörü ölçümü değildir; yağış, toprak tipi ve saha kontrolüyle birlikte kullanılmalıdır.',
    compareWith: 'Buharlaşma & Su Talebi · Yağış Geçmişi · Bitki Sağlığı',
    legend: ['Daha Kuru', 'Orta', 'Daha Nemli'],
    legendGradient: 'linear-gradient(90deg,#8b5a2b,#55b6a8,#1e5fd1)',
  },
  'soil-temperature': {
    title: 'İklim · Toprak Sıcaklığı',
    what:
      'Toprağın daha serin veya daha sıcak seyreden dönemsel sıcaklık durumunu gösterir.',
    agriculturalUse:
      'Çimlenme, kök gelişimi ve ekim zamanını değerlendirmeye yardımcı olur.',
    interpretation:
      'Ürünün uygun toprak sıcaklığı aralığına göre değerlendir; tek başına yetiştiricilik kararı verme.',
    compareWith: 'Hava Sıcaklığı · Bitki Sağlığı',
    legend: ['Daha Soğuk', 'Orta', 'Daha Sıcak'],
    legendGradient: 'linear-gradient(90deg,#2f6bd8,#e4c74f,#d34a35)',
  },
  'air-temperature': {
    title: 'İklim · Hava Sıcaklığı',
    what:
      'Tarla çevresindeki hava sıcaklığının daha düşük veya daha yüksek seyrettiği koşulları gösterir.',
    agriculturalUse:
      'Don, sıcaklık stresi, ilaçlama ve tarla çalışma saatlerini planlamaya yardımcı olur.',
    interpretation:
      'Kritik sıcaklıkları ürünün gelişim dönemine göre yorumla; kısa süreli uç değerler ayrıca kontrol edilmelidir.',
    compareWith: 'Yüzey Sıcaklığı · Bitki Sağlığı · Hava Durumu',
    legend: ['Daha Soğuk', 'Orta', 'Daha Sıcak'],
    legendGradient: 'linear-gradient(90deg,#2f6bd8,#e4c74f,#d34a35)',
  },
  precipitation: {
    title: 'İklim · Yağış',
    what:
      'Tarla çevresinde daha az veya daha fazla yağış görülen dönemsel iklim durumunu gösterir.',
    agriculturalUse:
      'Sulama, ilaçlama ve tarla giriş zamanını planlamaya yardımcı olur.',
    interpretation:
      'Yağışın miktarı kadar ne zaman düştüğü de önemlidir; toprak nemi ve yağış geçmişiyle birlikte değerlendir.',
    compareWith: 'Yağış Geçmişi · Toprak Nemi · Göllenme / Su Adayı',
    legend: ['Daha Az Yağış', 'Orta', 'Daha Fazla Yağış'],
    legendGradient: 'linear-gradient(90deg,#d7c79a,#6bb6d7,#2457b5)',
  },
};

export function getHomeLayerFarmerGuide(
  layer: HomeLayer,
  soilProperty: HomeSoilProperty = 'phh2o',
  climateLayer: HomeClimateLayer = 'soil-moisture',
): HomeLayerFarmerGuide {
  const base = HOME_LAYER_FARMER_GUIDES[layer];

  if (layer === 'soil') {
    return {
      ...base,
      ...HOME_SOIL_FARMER_GUIDES[soilProperty],
    } as HomeLayerFarmerGuide;
  }

  if (layer === 'climate') {
    return {
      ...base,
      ...HOME_CLIMATE_FARMER_GUIDES[climateLayer],
    } as HomeLayerFarmerGuide;
  }

  return base;
}

export function homeClimateVariable(
  layer: HomeClimateLayer,
  depth: HomeClimateDepth,
): HomeClimateVariable {
  if (layer === 'soil-moisture') {
    if (depth === '7-28cm') return 'soil_moisture_7_to_28cm';
    if (depth === '28-100cm') return 'soil_moisture_28_to_100cm';
    return 'soil_moisture_0_to_7cm';
  }

  if (layer === 'soil-temperature') {
    if (depth === '7-28cm') return 'soil_temperature_7_to_28cm';
    return 'soil_temperature_0_to_7cm';
  }

  if (layer === 'air-temperature') return 'temperature_2m';
  return 'precipitation';
}

function homeClimateExpectedUnit(variable: HomeClimateVariable) {
  if (variable.startsWith('soil_moisture')) return 'm³/m³';
  if (variable.includes('temperature')) return '°C';
  return 'mm';
}

function homeClimateCellsMatchVariable(
  cells: any[] | null | undefined,
  variable: HomeClimateVariable,
) {
  if (!Array.isArray(cells) || !cells.length) return false;

  const expectedUnit = homeClimateExpectedUnit(variable);

  return cells.every((cell: any) => {
    const cellVariable = String(cell?.variable ?? '').trim();
    const cellUnit = String(cell?.unit ?? '').trim();

    return (
      cellVariable === variable &&
      Number.isFinite(Number(cell?.value)) &&
      (!expectedUnit || cellUnit.includes(expectedUnit))
    );
  });
}

function homeFieldCenter(parcelGeometry: any, field: any) {
  const bbox = homeBboxFromGeometry(parcelGeometry);

  if (bbox) {
    return {
      longitude: (bbox[0] + bbox[2]) / 2,
      latitude: (bbox[1] + bbox[3]) / 2,
      bbox,
    };
  }

  return {
    longitude: Number(field?.parcelCentroidLng ?? field?.longitude ?? 35.2433),
    latitude: Number(field?.parcelCentroidLat ?? field?.latitude ?? 38.9637),
    bbox: null as HomeBBox | null,
  };
}

function homeSoilWmsUrl(
  bbox: HomeBBox,
  property: HomeSoilProperty = 'phh2o',
  depth: HomeSoilDepth = '0-5cm'
) {
  const width = Math.max(0.0005, bbox[2] - bbox[0]);
  const height = Math.max(0.0005, bbox[3] - bbox[1]);
  const padX = width * 0.85;
  const padY = height * 0.85;

  const expanded: HomeBBox = [
    bbox[0] - padX,
    bbox[1] - padY,
    bbox[2] + padX,
    bbox[3] + padY,
  ];

  const layerName = getSoilGridsWmsLayerName(property, depth, 'mean');
  const [west, south, east, north] = expanded;

  // SoilGrids tarafında UnifiedMap'te çalışan düzeni kullanıyoruz:
  // WMS 1.1.1 + EPSG:4326 + normal LON,LAT bbox sırası + image/png.
  const params = new URLSearchParams({
    map: `/map/${property}.map`,
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layerName,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: [west, south, east, north].join(','),
    WIDTH: '1000',
    HEIGHT: '760',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });

  return {
    url: `https://maps.isric.org/mapserv?${params.toString()}`,
    bbox: expanded,
    layerName,
  };
}

const HOME_OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

function homeIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function homeAverageFinite(values: unknown[]) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!numbers.length) return null;

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

async function fetchHomeClimateGrid(
  latitude: number,
  longitude: number,
  variable:
    | 'soil_moisture_0_to_7cm'
    | 'soil_moisture_7_to_28cm'
    | 'soil_moisture_28_to_100cm'
    | 'soil_temperature_0_to_7cm'
    | 'soil_temperature_7_to_28cm'
    | 'temperature_2m'
    | 'precipitation'
) {
  const radius = 2;
  const model = variable === 'precipitation' ? 'era5' : 'era5_land';
  const modelLabel = variable === 'precipitation' ? 'ERA5' : 'ERA5-Land';
  const step = variable === 'precipitation' ? 0.25 : 0.1;

  const points: Array<{ latitude: number; longitude: number }> = [];

  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      points.push({
        latitude: latitude + y * step,
        longitude: longitude + x * step,
      });
    }
  }

  // ERA5 / ERA5-Land yaklaşık 5 gün gecikmeli yayınlanır.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 5);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  const periodStart = homeIsoDate(start);
  const periodEnd = homeIsoDate(end);
  const generatedAt = new Date().toISOString();

  const params = new URLSearchParams({
    latitude: points.map((p) => p.latitude.toFixed(5)).join(','),
    longitude: points.map((p) => p.longitude.toFixed(5)).join(','),
    start_date: periodStart,
    end_date: periodEnd,
    hourly: variable,
    timezone: 'UTC',
    models: model,
    cell_selection: 'land',
  });

  const response = await fetch(
    `${HOME_OPEN_METEO_ARCHIVE}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo iklim servisi ${response.status} hatası verdi.`
    );
  }

  const payload = await response.json();
  const entries = Array.isArray(payload) ? payload : [payload];

  const cells = entries
    .map((entry: any, index: number) => {
      const values = Array.isArray(entry?.hourly?.[variable])
        ? entry.hourly[variable]
        : [];

      const value =
        variable === 'precipitation'
          ? homeSumFinite(values)
          : homeAverageFinite(values);
      if (value == null) return null;

      const fallbackPoint = points[index];

      return {
        id: `home-climate-${variable}-${index}`,
        latitude: Number(entry?.latitude ?? fallbackPoint?.latitude),
        longitude: Number(entry?.longitude ?? fallbackPoint?.longitude),
        value,
        unit: variable.startsWith('soil_moisture')
          ? 'm³/m³'
          : variable.includes('temperature')
          ? '°C'
          : 'mm / 7 gün',
        model: modelLabel,
        provider: 'ECMWF via Open-Meteo',
        source: 'Open-Meteo Historical Weather API',
        variable,
        quality: 'reanalysis',
        periodStart,
        periodEnd,
        generatedAt,
        resolutionDegrees: step,
      };
    })
    .filter(Boolean);

  if (!cells.length) {
    throw new Error('Seçili tarla için iklim hücresi bulunamadı.');
  }

  return cells;
}

function homeSumFinite(values: unknown[]) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!numbers.length) return null;

  return numbers.reduce((sum, value) => sum + value, 0);
}

function homeAgroSourceVariable(layer: HomeAgroLayer) {
  if (layer === 'surface-temperature') return 'soil_temperature_0_to_7cm';
  if (layer === 'evapotranspiration') return 'et0_fao_evapotranspiration';
  return 'precipitation_sum';
}

function homeAgroCellsMatchLayer(
  cells: any[] | null | undefined,
  layer: HomeAgroLayer,
) {
  if (!Array.isArray(cells) || !cells.length) return false;

  const expectedVariable = homeAgroSourceVariable(layer);
  const expectedUnit =
    layer === 'surface-temperature'
      ? '°C'
      : layer === 'evapotranspiration'
        ? 'mm / 7 gün'
        : 'mm / 30 gün';

  return cells.every((cell: any) =>
    cell?.layer === layer &&
    cell?.sourceVariable === expectedVariable &&
    String(cell?.unit ?? '') === expectedUnit &&
    Number.isFinite(Number(cell?.value)),
  );
}

async function fetchHomeAgroGrid(
  latitude: number,
  longitude: number,
  layer: HomeAgroLayer,
) {
  const radius = 2;
  const step = 0.08;

  const points: Array<{ latitude: number; longitude: number }> = [];

  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      points.push({
        latitude: latitude + y * step,
        longitude: longitude + x * step,
      });
    }
  }

  const end = new Date();
  // Historical archive can lag a few days.
  end.setUTCDate(end.getUTCDate() - 6);

  const periodDays =
    layer === 'rainfall-history'
      ? 30
      : 7;

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (periodDays - 1));

  const common = {
    latitude: points.map((p) => p.latitude.toFixed(5)).join(','),
    longitude: points.map((p) => p.longitude.toFixed(5)).join(','),
    start_date: homeIsoDate(start),
    end_date: homeIsoDate(end),
    timezone: 'UTC',
  };

  const sourceVariable = homeAgroSourceVariable(layer);
  let params: URLSearchParams;

  if (layer === 'surface-temperature') {
    params = new URLSearchParams({
      ...common,
      hourly: 'soil_temperature_0_to_7cm',
    });
  } else if (layer === 'evapotranspiration') {
    params = new URLSearchParams({
      ...common,
      daily: 'et0_fao_evapotranspiration',
    });
  } else {
    params = new URLSearchParams({
      ...common,
      daily: 'precipitation_sum',
    });
  }

  const response = await fetch(
    `${HOME_OPEN_METEO_ARCHIVE}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo tarımsal katman servisi ${response.status} hatası verdi.`
    );
  }

  const payload = await response.json();
  const entries = Array.isArray(payload) ? payload : [payload];

  const cells = entries
    .map((entry: any, index: number) => {
      let values: unknown[] = [];
      let value: number | null = null;
      let unit = '';
      let model = 'ERA5-Land / Open-Meteo';

      if (layer === 'surface-temperature') {
        values = Array.isArray(entry?.hourly?.soil_temperature_0_to_7cm)
          ? entry.hourly.soil_temperature_0_to_7cm
          : [];
        value = homeAverageFinite(values);
        unit = '°C';
      } else if (layer === 'evapotranspiration') {
        values = Array.isArray(entry?.daily?.et0_fao_evapotranspiration)
          ? entry.daily.et0_fao_evapotranspiration
          : [];
        // 7 günlük toplam referans evapotranspirasyon / su ihtiyacı.
        value = homeSumFinite(values);
        unit = 'mm / 7 gün';
        model = 'FAO-56 ET₀ / Open-Meteo';
      } else {
        values = Array.isArray(entry?.daily?.precipitation_sum)
          ? entry.daily.precipitation_sum
          : [];
        // Son 30 günlük toplam yağış.
        value = homeSumFinite(values);
        unit = 'mm / 30 gün';
        model = 'ERA5 / Open-Meteo';
      }

      if (value == null) return null;

      const fallbackPoint = points[index];

      return {
        id: `home-agro-${layer}-${index}`,
        layer,
        sourceVariable,
        latitude: Number(entry?.latitude ?? fallbackPoint?.latitude),
        longitude: Number(entry?.longitude ?? fallbackPoint?.longitude),
        value,
        unit,
        model,
        periodStart: homeIsoDate(start),
        periodEnd: homeIsoDate(end),
        resolutionDegrees: step,
      };
    })
    .filter(Boolean);

  if (!cells.length) {
    throw new Error(
      `${HOME_AGRO_LAYER_LABELS[layer]} için kullanılabilir harita hücresi bulunamadı.`
    );
  }

  return cells;
}

const HOME_AGRO_PALETTES: Record<
  HomeAgroLayer,
  readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
> = {
  'surface-temperature': [
    [44, 112, 214],
    [230, 192, 68],
    [205, 62, 47],
  ],
  evapotranspiration: [
    [59, 116, 202],
    [222, 187, 71],
    [202, 84, 45],
  ],
  'rainfall-history': [
    [216, 141, 72],
    [99, 177, 188],
    [36, 83, 177],
  ],
};

function homeAgroRgb(ratio: number, layer: HomeAgroLayer) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const mix = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    t: number,
  ) => ({
    r: Math.round(a[0] + (b[0] - a[0]) * t),
    g: Math.round(a[1] + (b[1] - a[1]) * t),
    b: Math.round(a[2] + (b[2] - a[2]) * t),
  });

  const palette = HOME_AGRO_PALETTES[layer];
  const v = clamp(ratio);

  return v <= 0.5
    ? mix(palette[0], palette[1], v / 0.5)
    : mix(palette[1], palette[2], (v - 0.5) / 0.5);
}

function homeAgroGradient(layer: HomeAgroLayer) {
  const palette = HOME_AGRO_PALETTES[layer];
  const color = (rgb: readonly [number, number, number]) =>
    `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

  return `linear-gradient(90deg,${color(palette[0])},${color(
    palette[1],
  )},${color(palette[2])})`;
}


function homeBboxSizeMeters(bbox: HomeBBox | null) {
  if (!bbox) {
    return {
      width: 0,
      height: 0,
      maxSpan: 0,
    };
  }

  const [west, south, east, north] = bbox;
  const centerLat = ((south + north) / 2) * (Math.PI / 180);
  const height = Math.abs(north - south) * 111320;
  const width =
    Math.abs(east - west) *
    111320 *
    Math.max(0.2, Math.cos(centerLat));

  return {
    width,
    height,
    maxSpan: Math.max(width, height),
  };
}

function homeGridResolutionMeters(
  cells: any[],
  bbox: HomeBBox | null,
) {
  const resolutions = cells
    .map((cell: any) => Number(cell?.resolutionDegrees))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!resolutions.length) return null;

  const average =
    resolutions.reduce((sum, value) => sum + value, 0) /
    resolutions.length;

  const centerLat =
    bbox
      ? ((bbox[1] + bbox[3]) / 2) * (Math.PI / 180)
      : 39 * (Math.PI / 180);

  const latMeters = average * 111320;
  const lngMeters =
    average * 111320 * Math.max(0.2, Math.cos(centerLat));

  return Math.max(latMeters, lngMeters);
}

function homeGridIsCoarseForParcel(
  cells: any[],
  bbox: HomeBBox | null,
) {
  if (!bbox) return true;

  const parcel = homeBboxSizeMeters(bbox);
  const resolution = homeGridResolutionMeters(cells, bbox);

  if (!resolution || !parcel.maxSpan) return true;

  return resolution > Math.max(180, parcel.maxSpan * 1.35);
}

function homeGeneralSpatialSummary(
  layer: HomeLayer,
  sourceLabel: string,
  metric?: {
    value?: number | null;
    unit?: string;
    label?: string;
    meta?: string;
  },
): HomeLayerSpatialSummary {
  return {
    layer,
    mode: 'general',
    variability: null,
    variabilityLabel: 'Tarla geneli',
    shortLabel: 'Tarla geneli · bölgesel veri',
    message:
      `${sourceLabel} verisinin çözünürlüğü bu parselin içindeki küçük farkları güvenilir biçimde ayırmak için yeterli değil.`,
    detail:
      'Bu katmanda parseli yapay renk bölgelerine ayırmıyoruz. Değer, tarlanın genel koşulunu temsil eder.',
    displayValue:
      metric?.value != null && Number.isFinite(Number(metric.value))
        ? Number(metric.value)
        : null,
    displayUnit: metric?.unit ?? '',
    displayLabel: metric?.label ?? 'Tarla geneli',
    displayMeta: metric?.meta ?? '',
  };
}

function homeSoilSpatialSummary(
  bbox: HomeBBox | null,
): HomeLayerSpatialSummary {
  const parcel = homeBboxSizeMeters(bbox);
  const coarse = !bbox || parcel.maxSpan < 320;

  return coarse
    ? homeGeneralSpatialSummary('soil', 'SoilGrids')
    : {
        layer: 'soil',
        mode: 'field-detail',
        variability: null,
        variabilityLabel: 'Bölgesel tahmin',
        shortLabel: 'Bölgesel toprak tahmini',
        message:
          'SoilGrids bölgesel bir tahmindir; görünen farklar laboratuvar örneklemesi kadar hassas değildir.',
        detail:
          'Gübreleme, kireçleme veya ciddi toprak düzenleme kararı öncesinde laboratuvar analizini önceliklendir.',
      };
}

function homeSoilMetricFromProfile(
  profile: SoilGridsProfile | null,
  property: HomeSoilProperty,
  depth: HomeSoilDepth,
) {
  if (!profile) return null;

  const propertyProfile =
    property === 'phh2o'
      ? profile.properties.ph
      : property === 'soc'
        ? profile.properties.organicCarbon
        : property === 'clay'
          ? profile.properties.clay
          : property === 'sand'
            ? profile.properties.sand
            : profile.properties.silt;

  const layer = propertyProfile?.layers?.find(
    (item) => item.depth === depth,
  );

  const value = Number(layer?.value);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    unit: String(layer?.unit ?? propertyProfile?.unit ?? ''),
    label: `${HOME_SOIL_PROPERTY_LABELS[property]} · ${HOME_SOIL_DEPTH_LABELS[depth]} tahmini`,
  };
}

function homeRepresentativeCellValue(
  cells: any[],
  bbox: HomeBBox,
) {
  const centerLat = (bbox[1] + bbox[3]) / 2;
  const centerLng = (bbox[0] + bbox[2]) / 2;

  const prepared = cells
    .map((cell: any) => ({
      latitude: Number(cell?.latitude),
      longitude: Number(cell?.longitude),
      value: Number(cell?.value),
    }))
    .filter(
      (cell) =>
        Number.isFinite(cell.latitude) &&
        Number.isFinite(cell.longitude) &&
        Number.isFinite(cell.value),
    );

  if (!prepared.length) return null;

  prepared.sort((a, b) => {
    const ad =
      (a.latitude - centerLat) ** 2 +
      (a.longitude - centerLng) ** 2;
    const bd =
      (b.latitude - centerLat) ** 2 +
      (b.longitude - centerLng) ** 2;
    return ad - bd;
  });

  return prepared[0]?.value ?? null;
}

function homePercentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;

  const index = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.round((sorted.length - 1) * p),
    ),
  );

  return sorted[index];
}

async function makeFarmerRadarOverlay(
  imageUrl: string,
  rasterBbox: HomeBBox,
  parcelGeometry: any,
  layer: HomeRadarLayer,
): Promise<{
  url: string;
  summary: HomeLayerSpatialSummary;
}> {
  const fallbackSummary: HomeLayerSpatialSummary = {
    layer,
    mode: 'field-detail',
    variability: 'low',
    variabilityLabel: 'Düşük',
    shortLabel: 'Tarla içi değişkenlik: Düşük',
    message:
      'Parsel içinde belirgin bir radar farkı seçilemiyor.',
    detail:
      'Radar görünümünü Bitki Sağlığı, yağış ve saha kontrolüyle birlikte değerlendir.',
  };

  if (!imageUrl || !rasterBbox || !parcelGeometry) {
    return {
      url: imageUrl,
      summary: fallbackSummary,
    };
  }

  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  if (!geometry?.coordinates) {
    return {
      url: imageUrl,
      summary: fallbackSummary,
    };
  }

  return new Promise((resolve) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          resolve({
            url: imageUrl,
            summary: fallbackSummary,
          });
          return;
        }

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceCtx = sourceCanvas.getContext('2d', {
          willReadFrequently: true,
        });

        if (!sourceCtx) {
          resolve({
            url: imageUrl,
            summary: fallbackSummary,
          });
          return;
        }

        sourceCtx.drawImage(image, 0, 0, width, height);
        const sourcePixels =
          sourceCtx.getImageData(0, 0, width, height);

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');

        if (!maskCtx) {
          resolve({
            url: imageUrl,
            summary: fallbackSummary,
          });
          return;
        }

        const [west, south, east, north] = rasterBbox;
        const spanX = east - west;
        const spanY = north - south;

        if (spanX <= 0 || spanY <= 0) {
          resolve({
            url: imageUrl,
            summary: fallbackSummary,
          });
          return;
        }

        const traceRing = (ring: any[]) => {
          let started = false;

          for (const point of ring ?? []) {
            if (!Array.isArray(point) || point.length < 2) continue;

            const lng = Number(point[0]);
            const lat = Number(point[1]);

            if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

            const x = ((lng - west) / spanX) * width;
            const y = ((north - lat) / spanY) * height;

            if (!started) {
              maskCtx.moveTo(x, y);
              started = true;
            } else {
              maskCtx.lineTo(x, y);
            }
          }

          if (started) maskCtx.closePath();
        };

        maskCtx.beginPath();

        if (geometry.type === 'Polygon') {
          (geometry.coordinates ?? []).forEach(traceRing);
        } else if (geometry.type === 'MultiPolygon') {
          (geometry.coordinates ?? []).forEach((polygon: any[]) =>
            (polygon ?? []).forEach(traceRing),
          );
        }

        maskCtx.fillStyle = '#fff';
        maskCtx.fill('evenodd');

        const maskPixels =
          maskCtx.getImageData(0, 0, width, height).data;
        const source = sourcePixels.data;
        const signals: number[] = [];

        const sampleStride =
          width * height > 900000 ? 2 : 1;

        for (let py = 0; py < height; py += sampleStride) {
          for (let px = 0; px < width; px += sampleStride) {
            const pixelIndex = py * width + px;
            const index = pixelIndex * 4;

            if (maskPixels[index + 3] < 128) continue;
            if (source[index + 3] < 24) continue;

            const r = source[index];
            const g = source[index + 1];
            const b = source[index + 2];
            const luminance =
              0.2126 * r +
              0.7152 * g +
              0.0722 * b;

            if (Number.isFinite(luminance)) {
              signals.push(luminance);
            }
          }
        }

        if (signals.length < 24) {
          void maskHomeRasterToParcel(
            imageUrl,
            rasterBbox,
            parcelGeometry,
          ).then((url) =>
            resolve({
              url,
              summary: fallbackSummary,
            }),
          );
          return;
        }

        signals.sort((a, b) => a - b);

        const p08 = homePercentile(signals, 0.08);
        const p92 = homePercentile(signals, 0.92);
        const spread = Math.max(0.0001, p92 - p08);
        const normalizedSpread = spread / 255;

        const variability: HomeVariabilityLevel =
          normalizedSpread < 0.045
            ? 'low'
            : normalizedSpread < 0.105
              ? 'medium'
              : 'high';

        const variabilityLabel =
          variability === 'high'
            ? 'Yüksek'
            : variability === 'medium'
              ? 'Orta'
              : 'Düşük';

        const compression =
          variability === 'low'
            ? { min: 0.34, max: 0.66 }
            : variability === 'medium'
              ? { min: 0.14, max: 0.86 }
              : { min: 0, max: 1 };

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext('2d');

        if (!outputCtx) {
          resolve({
            url: imageUrl,
            summary: fallbackSummary,
          });
          return;
        }

        const outputImage =
          outputCtx.createImageData(width, height);
        const out = outputImage.data;

        for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
          const index = pixelIndex * 4;

          if (
            maskPixels[index + 3] < 128 ||
            source[index + 3] < 24
          ) {
            out[index + 3] = 0;
            continue;
          }

          const luminance =
            0.2126 * source[index] +
            0.7152 * source[index + 1] +
            0.0722 * source[index + 2];

          let ratio =
            (luminance - p08) / spread;

          ratio = Math.max(0, Math.min(1, ratio));

          ratio =
            compression.min +
            ratio * (compression.max - compression.min);

          const color =
            homeRadarRgb(ratio, layer);

          out[index] = color.r;
          out[index + 1] = color.g;
          out[index + 2] = color.b;
          out[index + 3] = 222;
        }

        outputCtx.putImageData(outputImage, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');

        if (!finalCtx) {
          resolve({
            url: outputCanvas.toDataURL('image/png'),
            summary: fallbackSummary,
          });
          return;
        }

        finalCtx.filter = 'blur(1.6px)';
        finalCtx.drawImage(outputCanvas, 0, 0);
        finalCtx.filter = 'none';

        finalCtx.globalAlpha = 0.34;
        finalCtx.drawImage(outputCanvas, 0, 0);
        finalCtx.globalAlpha = 1;

        const layerMeaning =
          layer === 'radar-vv'
            ? 'nem ihtimali'
            : layer === 'radar-vh'
              ? 'yüzey ve bitki yapısı'
              : 'su birikimi riski';

        const message =
          variability === 'high'
            ? `Parsel içinde ${layerMeaning} açısından belirgin farklı bölgeler var.`
            : variability === 'medium'
              ? `Parsel içinde ${layerMeaning} açısından orta düzeyde farklılık görülüyor.`
              : `Parsel genelinde ${layerMeaning} açısından belirgin bir tarla içi fark görünmüyor.`;

        resolve({
          url: finalCanvas.toDataURL('image/png'),
          summary: {
            layer,
            mode: 'field-detail',
            variability,
            variabilityLabel,
            shortLabel: `Tarla içi değişkenlik: ${variabilityLabel}`,
            message,
            detail:
              'Renkler yalnızca bu parsel içindeki göreli radar farklarını görünür kılmak için ölçeklenir. Mutlak nem veya kesin sorun ölçümü değildir.',
          },
        });
      } catch (error) {
        console.warn(
          'Radar katmanı tarla içi kontrastla hazırlanamadı:',
          error,
        );

        void maskHomeRasterToParcel(
          imageUrl,
          rasterBbox,
          parcelGeometry,
        ).then((url) =>
          resolve({
            url,
            summary: fallbackSummary,
          }),
        );
      }
    };

    image.onerror = () =>
      resolve({
        url: imageUrl,
        summary: fallbackSummary,
      });

    image.src = imageUrl;
  });
}

function makeSmoothAgroOverlay(
  cells: any[],
  layer: HomeAgroLayer,
  targetBbox?: HomeBBox | null,
) {
  const valid = cells.filter(
    (cell: any) =>
      Number.isFinite(Number(cell?.latitude)) &&
      Number.isFinite(Number(cell?.longitude)) &&
      Number.isFinite(Number(cell?.value))
  );

  if (!valid.length) return null;

  const values = valid.map((cell: any) => Number(cell.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rawSpread = max - min;
  const spread = Math.max(0.000001, rawSpread);
  const coarseForParcel =
    Boolean(targetBbox) &&
    homeGridIsCoarseForParcel(valid, targetBbox ?? null);

  // Yeni tarımsal katmanların rasterını doğrudan parsel çevresine üret.
  // Böylece 0.08° gibi geniş model gridleri yüzünden parsel birkaç piksele
  // sıkışmaz. Veri yine gerçek grid hücrelerinden gelir; burada yalnızca
  // görselleştirme çözünürlüğü parsel ölçeğine taşınır.
  let west: number;
  let south: number;
  let east: number;
  let north: number;

  if (
    targetBbox &&
    targetBbox.length === 4 &&
    targetBbox.every((value) => Number.isFinite(Number(value)))
  ) {
    [west, south, east, north] = targetBbox.map(Number) as HomeBBox;
  } else {
    west = Infinity;
    south = Infinity;
    east = -Infinity;
    north = -Infinity;

    for (const cell of valid) {
      const resolution = Number(cell.resolutionDegrees ?? 0.08);
      const half = resolution / 2;

      west = Math.min(west, Number(cell.longitude) - half);
      east = Math.max(east, Number(cell.longitude) + half);
      south = Math.min(south, Number(cell.latitude) - half);
      north = Math.max(north, Number(cell.latitude) + half);
    }
  }

  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (east <= west || north <= south) return null;

  const geoW = Math.max(0.000001, east - west);
  const geoH = Math.max(0.000001, north - south);
  const aspect = geoW / geoH;

  // Küçük bir raster yeterli; MapLibre linear resampling ile yumuşatır.
  // Parsel çok uzun/dar olsa bile boyutu kontrollü tutuyoruz.
  const width = Math.max(220, Math.min(520, Math.round(360 * Math.sqrt(aspect))));
  const height = Math.max(220, Math.min(520, Math.round(width / aspect)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;

  if (coarseForParcel && targetBbox) {
    const representative =
      homeRepresentativeCellValue(valid, targetBbox);

    const centerLat = (targetBbox[1] + targetBbox[3]) / 2;
    const centerLng = (targetBbox[0] + targetBbox[2]) / 2;
    const representativeCell = valid
      .map((cell: any) => ({
        ...cell,
        latitude: Number(cell?.latitude),
        longitude: Number(cell?.longitude),
        value: Number(cell?.value),
      }))
      .filter(
        (cell: any) =>
          Number.isFinite(cell.latitude) &&
          Number.isFinite(cell.longitude) &&
          Number.isFinite(cell.value),
      )
      .sort((a: any, b: any) => {
        const ad =
          (a.latitude - centerLat) ** 2 +
          (a.longitude - centerLng) ** 2;
        const bd =
          (b.latitude - centerLat) ** 2 +
          (b.longitude - centerLng) ** 2;
        return ad - bd;
      })[0];

    // Kaba çözünürlüklü veride parseli tek renge boyamak sahte bir
    // tarla-içi ayrım hissi veriyordu. Rasterı görünmez bırakıyoruz;
    // gerçek tarla-geneli sayısal değer ayrı kartta gösterilecek.
    for (let index = 0; index < out.length; index += 4) {
      out[index] = 0;
      out[index + 1] = 0;
      out[index + 2] = 0;
      out[index + 3] = 0;
    }

    ctx.putImageData(imageData, 0, 0);

    const displayLabel =
      layer === 'surface-temperature'
        ? '7 günlük ortalama yüzey sıcaklığı'
        : layer === 'evapotranspiration'
          ? 'Son 7 gün referans su talebi'
          : 'Son 30 gün toplam yağış';

    return {
      image: canvas.toDataURL('image/png'),
      bbox: targetBbox,
      summary: homeGeneralSpatialSummary(
        layer,
        layer === 'surface-temperature'
          ? 'ERA5-Land'
          : layer === 'evapotranspiration'
            ? 'FAO-56 / Open-Meteo'
            : 'ERA5 / Open-Meteo',
        {
          value: representative,
          unit:
            layer === 'surface-temperature'
              ? '°C'
              : layer === 'evapotranspiration'
                ? 'mm / 7 gün'
                : 'mm / 30 gün',
          label: displayLabel,
        },
      ),
    };
  }

  // Her piksel için en yakın model hücrelerinden inverse-distance
  // interpolasyon. Bu yeni bir ölçüm icat etmez; yalnızca mevcut grid
  // değerlerini parsel ölçeğinde sürekli bir renk yüzeyine dönüştürür.
  const prepared = valid.map((cell: any) => ({
    latitude: Number(cell.latitude),
    longitude: Number(cell.longitude),
    value: Number(cell.value),
  }));

  const maxNeighbours = Math.min(6, prepared.length);
  const flatRatio = 0.5;

  for (let py = 0; py < height; py += 1) {
    const lat = north - ((py + 0.5) / height) * geoH;

    for (let px = 0; px < width; px += 1) {
      const lng = west + ((px + 0.5) / width) * geoW;

      const nearest = prepared
        .map((cell) => {
          const dx = (cell.longitude - lng) / geoW;
          const dy = (cell.latitude - lat) / geoH;
          return {
            ...cell,
            distance2: dx * dx + dy * dy,
          };
        })
        .sort((a, b) => a.distance2 - b.distance2)
        .slice(0, maxNeighbours);

      let weighted = 0;
      let weightTotal = 0;

      for (const cell of nearest) {
        const weight = 1 / Math.max(1e-8, cell.distance2);
        weighted += cell.value * weight;
        weightTotal += weight;
      }

      const interpolated =
        weightTotal > 0
          ? weighted / weightTotal
          : nearest[0]?.value ?? values[0];

      // Grid değerleri birbirine neredeyse eşitse katmanı görünmez yapmak
      // yerine orta renk ile homojen veri gösteriyoruz.
      const ratio =
        rawSpread < 1e-7
          ? flatRatio
          : Math.max(0, Math.min(1, (interpolated - min) / spread));

      const color = homeAgroRgb(ratio, layer);
      const index = (py * width + px) * 4;

      out[index] = color.r;
      out[index + 1] = color.g;
      out[index + 2] = color.b;
      out[index + 3] = 222;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Çok hafif blur: pikselli görünümü azaltır ama rengi silmez.
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext('2d');

  if (!finalCtx) {
    return {
      image: canvas.toDataURL('image/png'),
      bbox: [west, south, east, north] as HomeBBox,
    };
  }

  finalCtx.filter = 'blur(2px)';
  finalCtx.drawImage(canvas, 0, 0);
  finalCtx.filter = 'none';

  return {
    image: finalCanvas.toDataURL('image/png'),
    bbox: [west, south, east, north] as HomeBBox,
    summary: {
      layer,
      mode: 'field-detail',
      variability: null,
      variabilityLabel: 'Bölgesel fark',
      shortLabel: 'Bölgesel değişkenlik görünümü',
      message:
        'Model hücreleri parsel ölçeğinde ayrışabildiği için bölgesel renk farkları gösteriliyor.',
      detail:
        'Renk geçişleri model hücreleri arasındaki değişimi yumuşatır; yeni ölçüm noktaları oluşturmaz.',
    } as HomeLayerSpatialSummary,
  };
}

function homeClimateRgb(ratio: number, climateLayer: HomeClimateLayer) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const mix = (a: number[], b: number[], t: number) => ({
    r: Math.round(a[0] + (b[0] - a[0]) * t),
    g: Math.round(a[1] + (b[1] - a[1]) * t),
    b: Math.round(a[2] + (b[2] - a[2]) * t),
  });

  const palette =
    climateLayer === 'air-temperature' || climateLayer === 'soil-temperature'
      ? [
          [47, 107, 216],
          [228, 199, 79],
          [211, 74, 53],
        ]
      : climateLayer === 'precipitation'
      ? [
          [215, 199, 154],
          [107, 182, 215],
          [36, 87, 181],
        ]
      : [
          [139, 90, 43],
          [85, 182, 168],
          [30, 95, 209],
        ];

  const v = clamp(ratio);
  return v <= 0.5
    ? mix(palette[0], palette[1], v / 0.5)
    : mix(palette[1], palette[2], (v - 0.5) / 0.5);
}

async function maskHomeRasterToParcel(
  imageUrl: string,
  rasterBbox: HomeBBox | null,
  parcelGeometry: any,
): Promise<string> {
  if (!imageUrl || !rasterBbox || !parcelGeometry) return imageUrl;

  const geometry = parcelGeometry?.geometry ?? parcelGeometry;
  if (!geometry?.coordinates) return imageUrl;

  return new Promise((resolve) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          resolve(imageUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);

        const [west, south, east, north] = rasterBbox;
        const spanX = east - west;
        const spanY = north - south;

        if (spanX <= 0 || spanY <= 0) {
          resolve(imageUrl);
          return;
        }

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;

        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) {
          resolve(imageUrl);
          return;
        }

        const traceRing = (ring: any[]) => {
          let started = false;

          for (const point of ring ?? []) {
            if (!Array.isArray(point) || point.length < 2) continue;

            const lng = Number(point[0]);
            const lat = Number(point[1]);

            if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

            const x = ((lng - west) / spanX) * width;
            const y = ((north - lat) / spanY) * height;

            if (!started) {
              maskCtx.moveTo(x, y);
              started = true;
            } else {
              maskCtx.lineTo(x, y);
            }
          }

          if (started) maskCtx.closePath();
        };

        maskCtx.beginPath();

        if (geometry.type === 'Polygon') {
          (geometry.coordinates ?? []).forEach(traceRing);
        } else if (geometry.type === 'MultiPolygon') {
          (geometry.coordinates ?? []).forEach((polygon: any[]) =>
            (polygon ?? []).forEach(traceRing),
          );
        }

        maskCtx.fillStyle = '#fff';
        maskCtx.fill('evenodd');

        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();

        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        console.warn('Harita katmanı parsel içine kırpılamadı:', error);
        resolve(imageUrl);
      }
    };

    image.onerror = () => resolve(imageUrl);
    image.src = imageUrl;
  });
}

function makeSmoothClimateOverlay(
  cells: any[],
  climateLayer: HomeClimateLayer,
  targetBbox?: HomeBBox | null,
) {
  const valid = cells.filter(
    (cell: any) =>
      Number.isFinite(Number(cell?.latitude)) &&
      Number.isFinite(Number(cell?.longitude)) &&
      Number.isFinite(Number(cell?.value))
  );

  if (!valid.length) return null;

  const values = valid.map((cell: any) => Number(cell.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(0.000001, max - min);
  const coarseForParcel =
    Boolean(targetBbox) &&
    homeGridIsCoarseForParcel(valid, targetBbox ?? null);

  if (coarseForParcel && targetBbox) {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // ERA5 / ERA5-Land hücresi tarladan çok daha büyükse parseli tek renge
    // boyamak gerçek bir tarla-içi fark varmış izlenimi veriyordu.
    // Bu durumda raster tamamen şeffaf kalır; gerçek temsilî değer kartta gösterilir.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const representative =
      homeRepresentativeCellValue(valid, targetBbox);

    const centerLat = (targetBbox[1] + targetBbox[3]) / 2;
    const centerLng = (targetBbox[0] + targetBbox[2]) / 2;
    const representativeCell = valid
      .map((cell: any) => ({
        ...cell,
        latitude: Number(cell?.latitude),
        longitude: Number(cell?.longitude),
        value: Number(cell?.value),
      }))
      .sort((a: any, b: any) => {
        const ad =
          (a.latitude - centerLat) ** 2 +
          (a.longitude - centerLng) ** 2;
        const bd =
          (b.latitude - centerLat) ** 2 +
          (b.longitude - centerLng) ** 2;
        return ad - bd;
      })[0];

    const displayLabel =
      climateLayer === 'soil-moisture'
        ? '7 günlük ortalama model toprak nemi'
        : climateLayer === 'soil-temperature'
          ? '7 günlük ortalama model toprak sıcaklığı'
          : climateLayer === 'air-temperature'
            ? '7 günlük ortalama model hava sıcaklığı'
            : 'Son 7 gün model toplam yağış';

    const resolutionDegrees = Number(representativeCell?.resolutionDegrees);
    const resolutionKm =
      Number.isFinite(resolutionDegrees) && resolutionDegrees > 0
        ? Math.round(resolutionDegrees * 111)
        : null;
    const period =
      representativeCell?.periodStart && representativeCell?.periodEnd
        ? `${formatHomeSatelliteDate(representativeCell.periodStart)} – ${formatHomeSatelliteDate(
            representativeCell.periodEnd,
          )}`
        : '';
    const sourceMeta = [
      representativeCell?.model,
      'Open-Meteo',
      resolutionKm ? `~${resolutionKm} km` : '',
      period,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      image: canvas.toDataURL('image/png'),
      bbox: targetBbox,
      summary: homeGeneralSpatialSummary(
        'climate',
        'ERA5 / ERA5-Land',
        {
          value: representative,
          unit:
            climateLayer === 'soil-moisture'
              ? 'm³/m³'
              : climateLayer === 'soil-temperature' ||
                  climateLayer === 'air-temperature'
                ? '°C'
                : 'mm',
          label: displayLabel,
          meta: sourceMeta,
        },
      ),
    };
  }

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const cell of valid) {
    const resolution = Number(cell.resolutionDegrees ?? 0.08);
    const half = resolution / 2;
    west = Math.min(west, Number(cell.longitude) - half);
    east = Math.max(east, Number(cell.longitude) + half);
    south = Math.min(south, Number(cell.latitude) - half);
    north = Math.max(north, Number(cell.latitude) + half);
  }

  if (![west, south, east, north].every(Number.isFinite)) return null;

  const width = 760;
  const geoW = Math.max(0.000001, east - west);
  const geoH = Math.max(0.000001, north - south);
  const height = Math.max(420, Math.round(width * (geoH / geoW)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const approxCols = Math.max(3, Math.round(Math.sqrt(valid.length)));
  const radius = Math.max(width / approxCols, height / approxCols) * 1.7;

  for (const cell of valid) {
    const x = ((Number(cell.longitude) - west) / geoW) * width;
    const y = ((north - Number(cell.latitude)) / geoH) * height;
    const ratio = (Number(cell.value) - min) / spread;
    const color = homeClimateRgb(ratio, climateLayer);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.78)`);
    gradient.addColorStop(0.45, `rgba(${color.r},${color.g},${color.b},0.52)`);
    gradient.addColorStop(0.8, `rgba(${color.r},${color.g},${color.b},0.22)`);
    gradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;

  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    return {
      image: canvas.toDataURL('image/png'),
      bbox: [west, south, east, north] as HomeBBox,
    };
  }

  finalCtx.filter = 'blur(14px)';
  finalCtx.drawImage(canvas, 0, 0);
  finalCtx.filter = 'none';

  finalCtx.globalAlpha = 0.16;
  finalCtx.drawImage(canvas, 0, 0);
  finalCtx.globalAlpha = 1;

  return {
    image: finalCanvas.toDataURL('image/png'),
    bbox: [west, south, east, north] as HomeBBox,
    summary: {
      layer: 'climate',
      mode: 'field-detail',
      variability: null,
      variabilityLabel: 'Bölgesel fark',
      shortLabel: 'Bölgesel iklim farkı',
      message:
        'İklim model hücreleri bu ölçekte ayrışabildiği için bölgesel renk farkları gösteriliyor.',
      detail:
        'Bu görünüm metre seviyesinde sensör ölçümü değildir; model hücreleri arasındaki değişimi gösterir.',
    } as HomeLayerSpatialSummary,
  };
}

export function HomeInlineLayerMap({
  layer,
  field,
  satelliteData: latestSatelliteData,
  soilProperty,
  soilDepth,
  climateLayer,
  climateDepth,
  height = 390,
  onSpatialSummary,
}: {
  layer: HomeLayer;
  field: any;
  satelliteData: any;
  soilProperty: HomeSoilProperty;
  soilDepth: HomeSoilDepth;
  climateLayer: HomeClimateLayer;
  climateDepth: HomeClimateDepth;
  height?: number;
  onSpatialSummary?: (
    summary: HomeLayerSpatialSummary | null,
  ) => void;
}) {
  const history = useSatelliteHistory(field?.id ? String(field.id) : undefined, field?.parcelGeometry);
  const satelliteData = history.data ?? latestSatelliteData;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Katman geçişlerinde eski async isteğin yeni katmanın state'ini ezmesini
  // engelleyen kimlik. Aynı zamanda haritada hangi rasterın gerçekten
  // render edildiğini takip eder.
  const activeLayerRequestKeyRef = useRef('');
  const renderedLayerRequestKeyRef = useRef('');
  const pusulaFocusMarkerRef = useRef<maplibregl.Marker | null>(null);
  const trackingPointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pusulaFocusTimersRef = useRef<number[]>([]);
  const pusulaFocusItemsRef = useRef<HomePusulaFocusItem[]>([]);
  const ndviObservationRequestRef = useRef(0);
  const [pusulaFocusUi, setPusulaFocusUi] =
    useState<HomePusulaFocusUi | null>(null);
  const [ndviObservationTarget, setNdviObservationTarget] =
    useState<NdviObservationTarget | null>(null);
  const [ndviPhotoModalOpen, setNdviPhotoModalOpen] = useState(false);
  const [ndviHistoryOpen, setNdviHistoryOpen] = useState(false);
  const [fieldTrackingOpen, setFieldTrackingOpen] = useState(false);
  const [fieldOperationOpen, setFieldOperationOpen] = useState(false);
  const [fieldOperationToast, setFieldOperationToast] = useState<string | null>(null);


  useEffect(() => {
    const openFieldOperation = () => setFieldOperationOpen(true);

    window.addEventListener(
      'tp:home-map-open-field-operation',
      openFieldOperation,
    );

    return () => {
      window.removeEventListener(
        'tp:home-map-open-field-operation',
        openFieldOperation,
      );
    };
  }, []);
  const [trackingPointOverviews, setTrackingPointOverviews] =
    useState<FieldObservationPointOverview[]>([]);
  const [selectedTrackingPoint, setSelectedTrackingPoint] =
    useState<FieldObservationPointOverview | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [radarImage, setRadarImage] = useState<any>(null);
  const [radarImageKey, setRadarImageKey] = useState('');
  const [clippedRadarImage, setClippedRadarImage] = useState<string | null>(null);
  const [clippedRadarImageKey, setClippedRadarImageKey] = useState('');
  const [radarSpatialSummary, setRadarSpatialSummary] =
    useState<HomeLayerSpatialSummary | null>(null);
  const [clippedSoilImage, setClippedSoilImage] = useState<{
    url: string;
    bbox: HomeBBox;
  } | null>(null);
  const [clippedSoilImageKey, setClippedSoilImageKey] = useState('');
  const [clippedClimateImage, setClippedClimateImage] = useState<{
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
    variable: HomeClimateVariable;
  } | null>(null);
  const [clippedClimateImageKey, setClippedClimateImageKey] = useState('');
  const [climateCells, setClimateCells] = useState<any[]>([]);
  const [climateCellsKey, setClimateCellsKey] = useState('');
  const [clippedAgroImage, setClippedAgroImage] = useState<{
    url: string;
    bbox: HomeBBox;
    summary: HomeLayerSpatialSummary;
  } | null>(null);
  const [clippedAgroImageKey, setClippedAgroImageKey] = useState('');
  const [agroCells, setAgroCells] = useState<any[]>([]);
  const [agroCellsKey, setAgroCellsKey] = useState('');
  const [smoothNdvi, setSmoothNdvi] = useState<string | null>(null);
  const [smoothNdviKey, setSmoothNdviKey] = useState('');
  const [soilLoadError, setSoilLoadError] = useState<string | null>(null);
  const [soilProfile, setSoilProfile] = useState<SoilGridsProfile | null>(null);
  const [soilProfileKey, setSoilProfileKey] = useState('');
  const [soilProfileLoading, setSoilProfileLoading] = useState(false);
  const [soilProfileError, setSoilProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void requestMapLayerPersistentStorage();
  }, []);

  const parcelGeometry = field?.parcelGeometry ?? null;
  const fieldCenter = useMemo(
    () => homeFieldCenter(parcelGeometry, field),
    [parcelGeometry, field?.id]
  );

  const radarMode: 'vv' | 'vh' | 'water' | null =
    layer === 'radar-vv'
      ? 'vv'
      : layer === 'radar-vh'
        ? 'vh'
        : layer === 'radar-water'
          ? 'water'
          : null;

  const homeMapFieldKey = homeMapFieldCacheKey(field);

  const radarCacheKey =
    `${homeMapFieldKey}:radar-history-v8-water-area:${layer}:${fieldCenter.latitude.toFixed(5)}:${fieldCenter.longitude.toFixed(5)}`;

  const soilProfileCacheKey =
    `${homeMapFieldKey}:${fieldCenter.latitude.toFixed(5)}:${fieldCenter.longitude.toFixed(5)}`;

  const radarHistory = useRadarHistory({
    fieldId: field?.id ? String(field.id) : undefined,
    latitude: fieldCenter.latitude,
    longitude: fieldCenter.longitude,
    geometry: parcelGeometry,
    mode: radarMode,
    radiusKm: 3.5,
    currentData:
      radarImageKey === radarCacheKey
        ? radarImage
        : null,
  });

  const activeRadarImage =
    radarHistory.data ??
    (radarImageKey === radarCacheKey ? radarImage : null);

  const bbox = fieldCenter.bbox ?? normalizeHomeBbox(satelliteData?.bbox);

  const soilMetric = useMemo(
    () =>
      soilProfileKey === soilProfileCacheKey
        ? homeSoilMetricFromProfile(soilProfile, soilProperty, soilDepth)
        : null,
    [
      soilProfile,
      soilProfileKey,
      soilProfileCacheKey,
      soilProperty,
      soilDepth,
    ],
  );

  const climateVariableKey =
    homeClimateVariable(climateLayer, climateDepth);

  const climateCacheKey =
    `${homeMapFieldKey}:metric-v3:${climateVariableKey}:${fieldCenter.latitude.toFixed(5)}:${fieldCenter.longitude.toFixed(5)}`;

  /*
   * Görsel özet cache'i metrik cache'den ayrı sürümlenir.
   * Eski visual-v1 sürümünde katman değişimi sırasında önceki değişkenin
   * değeri yeni katmanın etiketiyle kaydolabiliyordu.
   */
  const climateVisualCacheKey =
    `${climateCacheKey}:visual-v2`;

  const agroLayer =
    layer === 'surface-temperature' ||
    layer === 'evapotranspiration' ||
    layer === 'rainfall-history'
      ? (layer as HomeAgroLayer)
      : null;

  const agroCacheKey =
    agroLayer
      ? `${homeMapFieldKey}:${HOME_AGRO_DATA_VERSION}:${agroLayer}:${homeAgroSourceVariable(agroLayer)}:${fieldCenter.latitude.toFixed(5)}:${fieldCenter.longitude.toFixed(5)}`
      : `${homeMapFieldKey}:no-agro`;

  // Görsel cache sürümü ayrı: eski geniş-bbox rasterı tekrar kullanılmasın.
  const agroImageCacheKey =
    agroLayer && bbox
      ? `${agroCacheKey}:parcel-paint-v3:${bbox.join(',')}`
      : `${agroCacheKey}:parcel-paint-v3:no-bbox`;

  const soilCacheKey =
    bbox
      ? `${homeMapFieldKey}:${soilProperty}:${soilDepth}:${bbox.join(',')}`
      : `${homeMapFieldKey}:${soilProperty}:${soilDepth}:no-bbox`;

  const ndviVersion =
    `${String(satelliteData?.latestImageDate ?? 'unknown-date')}:` +
    `${Number.isFinite(Number(satelliteData?.ndviAverage)) ? Number(satelliteData?.ndviAverage).toFixed(4) : 'no-average'}`;

  const ndviCacheKey =
    bbox
      ? `${homeMapFieldKey}:ndvi-overlay-v5-absolute:${ndviVersion}:${bbox.join(',')}`
      : `${homeMapFieldKey}:ndvi-overlay-v5-absolute:${ndviVersion}:no-bbox`;

  // Her görünür katman/alt-katman kendi request kimliğine sahiptir. Böylece
  // örneğin Yağış isteği geç cevap verse bile kullanıcı o sırada ET₀'ya
  // geçtiyse eski sonuç yeni ekrana yazılamaz.
  const activeLayerRequestKey =
    layer === 'vegetation'
      ? `vegetation:${ndviCacheKey}`
      : radarMode
        ? `radar:${radarCacheKey}`
        : layer === 'soil'
          ? `soil:${soilCacheKey}`
          : layer === 'climate'
            ? `climate:${climateVisualCacheKey}`
            : agroLayer
              ? `agro:${agroImageCacheKey}`
              : `${homeMapFieldKey}:${layer}`;

  const activeRadarSceneKey = radarMode
    ? String(
        activeRadarImage?.scene?.id ??
          activeRadarImage?.scene?.datetime ??
          activeRadarImage?.dataDate ??
          'current',
      )
    : '';

  const radarVisualCacheKey = radarMode
    ? `${radarCacheKey}:${activeRadarSceneKey}:farmer-contrast-v4`
    : '';

  const activeMapVisualKey = radarMode
    ? radarVisualCacheKey
    : activeLayerRequestKey;

  useEffect(() => {
    activeLayerRequestKeyRef.current = activeLayerRequestKey;
    // Önceki katmanın loading sonucu yeni katmana taşınmasın. Yeni katmanın
    // kendi effect'i gerekiyorsa hemen tekrar true yapacaktır.
    setLoading(false);
  }, [activeLayerRequestKey]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (!satelliteData?.ndviImage || !bbox) {
      setSmoothNdvi(null);
      setSmoothNdviKey('');

      return () => {
        cancelled = true;
      };
    }

    // Render the available observation immediately; cache/smoothing is optional.
    setSmoothNdvi(satelliteData.ndviImage);
    setSmoothNdviKey(ndviCacheKey);

    const memoryCached = HOME_MAP_NDVI_CACHE.get(ndviCacheKey);

    if (memoryCached?.startsWith('data:image/')) {
      setSmoothNdvi(memoryCached);
      setSmoothNdviKey(ndviCacheKey);

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const persisted = await readHomeMapPersistentCache<string>(
        'ndvi',
        ndviCacheKey,
        HOME_MAP_CACHE_TTL.ndvi,
      );

      // Signed URLs stored in browser cache may have expired; regenerate instead.
      if (persisted?.startsWith('data:image/')) {
        HOME_MAP_NDVI_CACHE.set(ndviCacheKey, persisted);

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setSmoothNdvi(persisted);
          setSmoothNdviKey(ndviCacheKey);
        }

        return;
      }

      let pending = HOME_MAP_NDVI_INFLIGHT.get(ndviCacheKey);

      if (!pending) {
        pending = makeSmoothNdviOverlay(
          satelliteData.ndviImage,
          bbox,
          parcelGeometry,
        ).then((result) => result || satelliteData.ndviImage);

        HOME_MAP_NDVI_INFLIGHT.set(ndviCacheKey, pending);

        void pending.finally(() => {
          HOME_MAP_NDVI_INFLIGHT.delete(ndviCacheKey);
        });
      }

      const finalImage = await pending;

      // Kullanıcı başka katmana geçmiş olsa bile sonuç cache'e yazılır.
      HOME_MAP_NDVI_CACHE.set(ndviCacheKey, finalImage);

      void writeHomeMapPersistentCache(
        'ndvi',
        ndviCacheKey,
        finalImage,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setSmoothNdvi(finalImage);
        setSmoothNdviKey(ndviCacheKey);
      }
    })().catch((error) => {
      console.warn('Ana ekran NDVI cache/görsel hazırlama hatası:', error);
      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setSmoothNdvi(satelliteData.ndviImage);
        setSmoothNdviKey(ndviCacheKey);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    satelliteData?.ndviImage,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
    parcelGeometry,
    ndviCacheKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (!radarMode) {
      // Son başarılı radar verisini bellekte tut. Katmana geri dönüldüğünde
      // yeniden ağ isteği beklemeden aynı kayıt anında kullanılabilir.
      return () => {
        cancelled = true;
      };
    }

    const memoryCached = HOME_MAP_RADAR_CACHE.get(radarCacheKey);

    if (memoryCached) {
      setRadarImage(memoryCached);
      setRadarImageKey(radarCacheKey);
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    void (async () => {
      const persisted = await readHomeMapPersistentCache<any>(
        'radar',
        radarCacheKey,
        HOME_MAP_CACHE_TTL.radar,
      );

      if (persisted) {
        HOME_MAP_RADAR_CACHE.set(radarCacheKey, persisted);

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setRadarImage(persisted);
          setRadarImageKey(radarCacheKey);
          setLoading(false);
        }

        return;
      }

      let pending = HOME_MAP_RADAR_INFLIGHT.get(radarCacheKey);

      if (!pending) {
        pending = fetchSentinel1Radar(
          fieldCenter.latitude,
          fieldCenter.longitude,
          {
            days: 45,
            mode: radarMode,
            radiusKm: 3.5,
            geometry: parcelGeometry,
          },
        );

        HOME_MAP_RADAR_INFLIGHT.set(radarCacheKey, pending);

        void pending.finally(() => {
          HOME_MAP_RADAR_INFLIGHT.delete(radarCacheKey);
        });
      }

      const result = await pending;

      // Katmandan çıkılsa bile tamamlanan sorguyu kaybetme.
      HOME_MAP_RADAR_CACHE.set(radarCacheKey, result);

      void writeHomeMapPersistentCache(
        'radar',
        radarCacheKey,
        result,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setRadarImage(result);
        setRadarImageKey(radarCacheKey);
        setLoading(false);
      }
    })()
      .catch((error) => {
        console.warn(
          'Ana ekran radar katmanı alınamadı:',
          error,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    field?.id,
    fieldCenter.latitude,
    fieldCenter.longitude,
    parcelGeometry,
    radarMode,
    radarCacheKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (
      !activeRadarImage?.imageDataUrl ||
      !activeRadarImage?.bbox ||
      !(
        layer === 'radar-vv' ||
        layer === 'radar-vh' ||
        layer === 'radar-water'
      )
    ) {
      // Önceki başarılı radar görselini state'te tut; aktif katman kontrolü
      // nedeniyle başka bir katmanda render edilmez.
      return () => {
        cancelled = true;
      };
    }

    const visualCacheKey = radarVisualCacheKey;

    const memoryCached =
      HOME_MAP_RADAR_CLIPPED_CACHE.get(visualCacheKey);

    if (memoryCached) {
      setClippedRadarImage(memoryCached.url);
      setClippedRadarImageKey(visualCacheKey);
      setRadarSpatialSummary(memoryCached.summary);

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const persisted = await readHomeMapPersistentCache<{
        url: string;
        summary: HomeLayerSpatialSummary;
      }>(
        'radar-visual',
        visualCacheKey,
        HOME_MAP_CACHE_TTL.radar,
      );

      if (persisted?.url) {
        HOME_MAP_RADAR_CLIPPED_CACHE.set(
          visualCacheKey,
          persisted,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setClippedRadarImage(persisted.url);
          setClippedRadarImageKey(visualCacheKey);
          setRadarSpatialSummary(persisted.summary);
        }

        return;
      }

      let pending =
        HOME_MAP_RADAR_VISUAL_INFLIGHT.get(visualCacheKey);

      if (!pending) {
        pending = makeFarmerRadarOverlay(
          activeRadarImage.imageDataUrl,
          activeRadarImage.bbox as HomeBBox,
          parcelGeometry,
          layer as HomeRadarLayer,
        );

        HOME_MAP_RADAR_VISUAL_INFLIGHT.set(
          visualCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_RADAR_VISUAL_INFLIGHT.delete(visualCacheKey);
        });
      }

      const result = await pending;

      HOME_MAP_RADAR_CLIPPED_CACHE.set(
        visualCacheKey,
        result,
      );

      void writeHomeMapPersistentCache(
        'radar-visual',
        visualCacheKey,
        result,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setClippedRadarImage(result.url);
        setClippedRadarImageKey(visualCacheKey);
        setRadarSpatialSummary(result.summary);
      }
    })().catch((error) => {
      console.warn('Radar görsel cache hazırlama hatası:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    activeRadarImage?.imageDataUrl,
    activeRadarImage?.bbox,
    activeRadarImage?.scene?.id,
    activeRadarImage?.scene?.datetime,
    activeRadarImage?.dataDate,
    parcelGeometry,
    radarCacheKey,
    radarVisualCacheKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (layer !== 'climate') {
      // Son başarılı iklim hücrelerini sakla; render tarafındaki değişken
      // kimliği yanlış değişkenin ekranda kullanılmasını zaten engelliyor.
      return () => {
        cancelled = true;
      };
    }

    // Alt katman değiştiğinde eski state'i silmek yerine hedef cache'i önce
    // deniyoruz. Yanlış değişken render edilmez; cache varsa geçiş anlıktır.

    const memoryCached =
      HOME_MAP_CLIMATE_CACHE.get(climateCacheKey);

    if (homeClimateCellsMatchVariable(memoryCached, climateVariableKey)) {
      setClimateCells(memoryCached!);
      setClimateCellsKey(climateCacheKey);
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    if (memoryCached?.length) {
      HOME_MAP_CLIMATE_CACHE.delete(climateCacheKey);
    }

    setLoading(true);

    void (async () => {
      const persisted = await readHomeMapPersistentCache<any[]>(
        'climate',
        climateCacheKey,
        HOME_MAP_CACHE_TTL.climate,
      );

      if (
        homeClimateCellsMatchVariable(
          persisted,
          climateVariableKey,
        )
      ) {
        HOME_MAP_CLIMATE_CACHE.set(
          climateCacheKey,
          persisted!,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setClimateCells(persisted!);
          setClimateCellsKey(climateCacheKey);
          setLoading(false);
        }

        return;
      }

      let pending =
        HOME_MAP_CLIMATE_INFLIGHT.get(climateCacheKey);

      if (!pending) {
        pending = (async () => {
          const selectedVariable = climateVariableKey;

          try {
            const { data, error } =
              await supabase.functions.invoke(
                'era5-map',
                {
                  body: {
                    latitude: fieldCenter.latitude,
                    longitude: fieldCenter.longitude,
                    variable: selectedVariable,
                    days: 7,
                    gridRadius: 2,
                  },
                },
              );

            if (error) {
              throw error;
            }

            const cells =
              Array.isArray(data?.cells)
                ? data.cells
                    .filter(
                      (cell: any) =>
                        Number.isFinite(Number(cell?.latitude)) &&
                        Number.isFinite(Number(cell?.longitude)) &&
                        Number.isFinite(Number(cell?.value)) &&
                        String(
                          cell?.variable ??
                            data?.variable ??
                            '',
                        ).trim() === selectedVariable,
                    )
                    .map((cell: any) => ({
                      ...cell,
                      source:
                        String(data?.source ?? cell?.source ?? '') ||
                        'Open-Meteo Historical Weather API',
                      provider:
                        String(data?.provider ?? cell?.provider ?? '') ||
                        'ECMWF via Open-Meteo',
                      model:
                        String(data?.model ?? cell?.model ?? '') ||
                        (selectedVariable === 'precipitation' ? 'ERA5' : 'ERA5-Land'),
                      variable: String(data?.variable ?? selectedVariable),
                      quality: String(data?.quality ?? cell?.quality ?? 'reanalysis'),
                      periodStart:
                        String(data?.period?.start ?? cell?.periodStart ?? '') || null,
                      periodEnd:
                        String(data?.period?.end ?? cell?.periodEnd ?? '') || null,
                      generatedAt:
                        String(data?.generatedAt ?? cell?.generatedAt ?? '') || null,
                      resolutionDegrees:
                        Number(cell?.resolutionDegrees ?? data?.spatialResolutionDegrees) ||
                        (selectedVariable === 'precipitation' ? 0.25 : 0.1),
                    }))
                : [];

            if (
              homeClimateCellsMatchVariable(
                cells,
                selectedVariable as HomeClimateVariable,
              )
            ) {
              return cells;
            }

            throw new Error(
              'ERA5 Edge Function hücre döndürmedi.',
            );
          } catch (edgeError) {
            console.warn(
              'Ana ekran era5-map kullanılamadı; Open-Meteo fallback deneniyor:',
              edgeError,
            );
          }

          const fallbackCells = await fetchHomeClimateGrid(
            fieldCenter.latitude,
            fieldCenter.longitude,
            selectedVariable as any,
          );

          if (
            !homeClimateCellsMatchVariable(
              fallbackCells,
              selectedVariable as HomeClimateVariable,
            )
          ) {
            throw new Error(
              `İklim değişkeni eşleşmedi: ${selectedVariable}`,
            );
          }

          return fallbackCells;
        })();

        HOME_MAP_CLIMATE_INFLIGHT.set(
          climateCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_CLIMATE_INFLIGHT.delete(climateCacheKey);
        });
      }

      const cells = await pending;

      HOME_MAP_CLIMATE_CACHE.set(
        climateCacheKey,
        cells,
      );

      void writeHomeMapPersistentCache(
        'climate',
        climateCacheKey,
        cells,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setClimateCells(cells);
        setClimateCellsKey(climateCacheKey);
        setLoading(false);
      }
    })()
      .catch((error) => {
        console.warn(
          'Ana ekran iklim katmanı alınamadı:',
          error,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    field?.id,
    fieldCenter.latitude,
    fieldCenter.longitude,
    climateCacheKey,
    climateVariableKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (!agroLayer) {
      // Son başarılı tarımsal katman verisini sakla. Katmana geri dönünce
      // cache üzerinden sıfır beklemeyle açılabilir.
      return () => {
        cancelled = true;
      };
    }

    // ET₀ / yağış / yüzey sıcaklığı state'leri korunur; aşağıdaki katman
    // kimliği kontrolü yalnız aktif metriğin render edilmesini sağlar.

    const memoryCached =
      HOME_MAP_AGRO_CACHE.get(agroCacheKey);

    if (homeAgroCellsMatchLayer(memoryCached, agroLayer)) {
      setAgroCells(memoryCached!);
      setAgroCellsKey(agroCacheKey);
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    // Eski veya başka bir metriğe ait RAM cache girdisini kullanma.
    if (memoryCached?.length) {
      HOME_MAP_AGRO_CACHE.delete(agroCacheKey);
    }

    setLoading(true);

    void (async () => {
      const persisted = await readHomeMapPersistentCache<any[]>(
        'agro',
        agroCacheKey,
        HOME_MAP_CACHE_TTL.agro,
      );

      if (homeAgroCellsMatchLayer(persisted, agroLayer)) {
        HOME_MAP_AGRO_CACHE.set(
          agroCacheKey,
          persisted!,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setAgroCells(persisted!);
          setAgroCellsKey(agroCacheKey);
          setLoading(false);
        }

        return;
      }

      let pending =
        HOME_MAP_AGRO_INFLIGHT.get(agroCacheKey);

      if (!pending) {
        pending = fetchHomeAgroGrid(
          fieldCenter.latitude,
          fieldCenter.longitude,
          agroLayer,
        );

        HOME_MAP_AGRO_INFLIGHT.set(
          agroCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_AGRO_INFLIGHT.delete(agroCacheKey);
        });
      }

      const cells = await pending;

      HOME_MAP_AGRO_CACHE.set(
        agroCacheKey,
        cells,
      );

      void writeHomeMapPersistentCache(
        'agro',
        agroCacheKey,
        cells,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setAgroCells(cells);
        setAgroCellsKey(agroCacheKey);
        setLoading(false);
      }
    })()
      .catch((error) => {
        console.warn(
          `Ana ekran ${HOME_AGRO_LAYER_LABELS[agroLayer]} katmanı alınamadı:`,
          error,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    agroLayer,
    field?.id,
    fieldCenter.latitude,
    fieldCenter.longitude,
    agroCacheKey,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const playOpening = shouldPlayMapOpening();
    let userInteracted = false;
    let disposed = false;
    const map = new mapRuntime.Map({
      container,
      style: HOME_SATELLITE_STYLE,
      center: playOpening || !field?.id ? [20, 25] : [fieldCenter.longitude, fieldCenter.latitude],
      zoom: playOpening || !field?.id ? 2 : bbox ? 14.2 : 16,
      pitch: 0,
      bearing: 0,
      minZoom: 2,
      maxZoom: 22,
      maxPitch: 68,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;
    const stopOpening = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) {
        userInteracted = true;
        map.stop();
      }
    };
    map.on('mousedown', stopOpening);
    map.on('touchstart', stopOpening);
    map.on('wheel', stopOpening);

    addTarlaCompass(map, 'bottom-right');

    map.on('load', () => {
      if (parcelGeometry) {
        map.addSource('home-inline-parcel', {
          type: 'geojson',
          data:
            parcelGeometry?.type === 'Feature'
              ? parcelGeometry
              : {
                  type: 'Feature',
                  properties: {},
                  geometry: parcelGeometry?.geometry ?? parcelGeometry,
                },
        });

        map.addLayer({
          id: 'home-inline-parcel-glow',
          type: 'line',
          source: 'home-inline-parcel',
          paint: {
            'line-color': '#22C55E',
            'line-width': 12,
            'line-opacity': 0.22,
            'line-blur': 7,
          },
        });

        map.addLayer({
          id: 'home-inline-parcel-shadow',
          type: 'line',
          source: 'home-inline-parcel',
          paint: {
            'line-color': '#020804',
            'line-width': 7.2,
            'line-opacity': 0.82,
          },
        });

        map.addLayer({
          id: 'home-inline-parcel-line',
          type: 'line',
          source: 'home-inline-parcel',
          paint: {
            'line-color': '#70E39A',
            'line-width': 2.4,
            'line-opacity': 1,
          },
        });
      }

      if (!userInteracted) {
        void resolveOpeningTarget(Boolean(field?.id), [fieldCenter.longitude, fieldCenter.latitude], bbox)
          .then(target => {
            if (disposed || userInteracted || !target) return;
            openMapAtField(map, target.center, target.bbox, playOpening, target.zoom);
          });
      }
    });

    return () => {
      disposed = true;
      for (const marker of trackingPointMarkersRef.current) {
        try {
          marker.remove();
        } catch {
          // no-op
        }
      }
      trackingPointMarkersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [field?.id, bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], parcelGeometry]);


  useEffect(() => {
    let cancelled = false;

    if (layer !== 'vegetation' || !field?.id) {
      setTrackingPointOverviews([]);
      setSelectedTrackingPoint(null);
      return;
    }

    void listFieldObservationPoints(String(field.id))
      .then((rows) => {
        if (cancelled) return;

        /*
         * Haritada yalnızca gerçekten fotoğrafla takibe alınmış noktaları
         * sürekli göster. Pusula'nın sadece analiz sırasında oluşturduğu,
         * henüz fotoğraf eklenmemiş aday noktalar haritayı kalabalıklaştırmasın.
         */
        setTrackingPointOverviews(
          rows.filter(
            (row) =>
              row.point.status === 'active' &&
              Boolean(row.point.lastPhotoAt),
          ),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('NDVI takip noktaları haritaya yüklenemedi:', error);
        setTrackingPointOverviews([]);
      });

    return () => {
      cancelled = true;
    };
  }, [layer, field?.id, trackingRefreshKey]);

  useEffect(() => {
    const map = mapRef.current;

    const clearMarkers = () => {
      for (const marker of trackingPointMarkersRef.current) {
        try {
          marker.remove();
        } catch {
          // no-op
        }
      }
      trackingPointMarkersRef.current = [];
    };

    clearMarkers();

    if (
      !map ||
      layer !== 'vegetation' ||
      trackingPointOverviews.length === 0
    ) {
      return clearMarkers;
    }

    const renderMarkers = () => {
      clearMarkers();

      for (const overview of trackingPointOverviews) {
        const { point, latestComparison } = overview;
        const lng = Number(point.centroidLng);
        const lat = Number(point.centroidLat);

        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute(
          'aria-label',
          `${point.direction ?? 'Takip'} bölgesi NDVI takip noktası`,
        );
        button.title = `${
          point.direction
            ? point.direction.charAt(0).toLocaleUpperCase('tr-TR') +
              point.direction.slice(1)
            : 'Takip'
        } · Fotoğraf geçmişi`;

        const status = latestComparison?.status ?? 'unknown';
        const ring =
          status === 'improving'
            ? '#22C55E'
            : status === 'worsening'
              ? '#EF4444'
              : status === 'stable'
                ? '#06B6D4'
                : '#86efac';

        Object.assign(button.style, {
          width: '24px',
          height: '24px',
          display: 'grid',
          placeItems: 'center',
          padding: '0',
          border: `2px solid ${ring}`,
          borderRadius: '999px',
          background: 'rgba(2,8,4,.94)',
          color: ring,
          boxShadow: `0 0 0 3px rgba(2,8,4,.72), 0 0 16px ${ring}66`,
          cursor: 'pointer',
          outline: 'none',
        });

        const core = document.createElement('span');
        core.textContent = '●';
        Object.assign(core.style, {
          fontSize: '9px',
          lineHeight: '1',
          transform: 'translateY(-.5px)',
        });

        button.appendChild(core);

        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          setSelectedTrackingPoint(overview);
          setNdviObservationTarget({
            point,
            fieldName: String(field?.name ?? 'Tarlan'),
            direction: point.direction,
            centroid: [lng, lat],
            relativeHealth: point.latestRelativeHealth,
            ndviValue: point.latestNdvi,
            satelliteDate: point.latestSatelliteDate,
          });
        });

        const marker = new mapRuntime.Marker({
          element: button,
          anchor: 'center',
        })
          .setLngLat([lng, lat])
          .addTo(map);

        trackingPointMarkersRef.current.push(marker);
      }
    };

    if (map.loaded()) {
      renderMarkers();
    } else {
      map.once('load', renderMarkers);
    }

    return () => {
      try {
        map.off('load', renderMarkers);
      } catch {
        // no-op
      }
      clearMarkers();
    };
  }, [
    layer,
    field?.id,
    field?.name,
    trackingPointOverviews,
  ]);

  useEffect(() => {
    const clearFocusTimers = () => {
      for (const timer of pusulaFocusTimersRef.current) {
        window.clearTimeout(timer);
      }
      pusulaFocusTimersRef.current = [];
    };

    const clearFocusOverlay = (map: MapLibreMap | null) => {
      clearFocusTimers();

      try {
        pusulaFocusMarkerRef.current?.remove();
      } catch {
        // no-op
      }
      pusulaFocusMarkerRef.current = null;

      if (!map) return;

      pusulaFocusItemsRef.current = [];
      ndviObservationRequestRef.current += 1;
      setPusulaFocusUi(null);
      setNdviObservationTarget(null);
      setNdviPhotoModalOpen(false);
      setNdviHistoryOpen(false);
      setFieldTrackingOpen(false);

      try {
        (map as any).__tpPusulaFocusCleanup?.();
        delete (map as any).__tpPusulaFocusCleanup;
      } catch {
        // no-op
      }

      try {
        const layerIds = [
          'home-pusula-focus-selected-dot',
          'home-pusula-focus-selected-halo',
          'home-pusula-focus-center-dots',
          'home-pusula-focus-selected-line',
          'home-pusula-focus-selected-glow',
          'home-pusula-focus-selected-fill',
          'home-pusula-focus-line',
          'home-pusula-focus-fill',
        ];

        for (const id of layerIds) {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
        }

        if (map.getSource('home-pusula-focus-selected-center')) {
          map.removeSource('home-pusula-focus-selected-center');
        }

        if (map.getSource('home-pusula-focus-centers')) {
          map.removeSource('home-pusula-focus-centers');
        }

        if (map.getSource('home-pusula-focus-selected')) {
          map.removeSource('home-pusula-focus-selected');
        }

        if (map.getSource('home-pusula-focus')) {
          map.removeSource('home-pusula-focus');
        }
      } catch {
        // Harita katman değiştirirken temizlenmiş olabilir.
      }
    };

    const showFocus = async (detail: any) => {
      const map = mapRef.current;
      if (!map) return;

      const requestedFieldId = String(detail?.fieldId ?? '').trim();
      const currentFieldId = String(field?.id ?? '').trim();

      if (
        requestedFieldId &&
        currentFieldId &&
        requestedFieldId !== currentFieldId
      ) {
        return;
      }

      if (detail?.layer && detail.layer !== layer) {
        return;
      }

      const importantArea = detail?.importantArea ?? null;
      const spatial = detail?.spatial ?? null;

      const focusTone =
        layer === 'vegetation' || layer === 'radar-water'
          ? 'danger'
          : layer === 'radar-vv' || layer === 'radar-vh'
            ? 'attention'
            : 'neutral';

      const focusPalette =
        focusTone === 'danger'
          ? {
              fill: '#EF4444',
              line: '#FCA5A5',
              glow: '#EF4444',
              labelBorder: 'rgba(239,68,68,.38)',
              labelText: '#FECACA',
              labelBg: 'rgba(30,5,5,.94)',
            }
          : focusTone === 'attention'
            ? {
                fill: '#F59E0B',
                line: '#FCD34D',
                glow: '#F59E0B',
                labelBorder: 'rgba(245,158,11,.34)',
                labelText: '#FDE68A',
                labelBg: 'rgba(28,18,3,.94)',
              }
            : {
                fill: '#22C55E',
                line: '#D1FAE5',
                glow: '#86EFAC',
                labelBorder: 'rgba(134,239,172,.32)',
                labelText: '#D1FAE5',
                labelBg: 'rgba(2,10,5,.92)',
              };

      const directFeature =
        homePusulaFeatureFromGeometry(importantArea?.geometry);

      const directBounds =
        normalizeHomeBbox(importantArea?.bounds);

      const direction =
        normalizeHomePusulaDirection(importantArea?.area);

      const radarBounds =
        layer === 'radar-vv' ||
        layer === 'radar-vh' ||
        layer === 'radar-water'
          ? normalizeHomeBbox(activeRadarImage?.bbox)
          : null;

      const analysisBounds =
        radarBounds ??
        bbox ??
        normalizeHomeBbox(satelliteData?.bbox);

      const spatialDirections =
        analysisBounds
          ? homePusulaSpatialFocusDirections(
              spatial,
              layer,
            )
          : [];

      /*
       * Pusula stripi spatial importantAreaByLayer üzerinden tek bir alan
       * gösterebilir. analysis.importantArea boş olduğunda eski kod bu tek
       * bölgeyi harita odağına çevirmiyordu. Özellikle radar-water'da
       * "Doğu bölümünde..." yazıp Haritada göster'in boş kalmasının sebebi buydu.
       */
      const fallbackSpatialDirection =
        direction ??
        spatialDirections[0] ??
        null;

      const multiSpatialFocus =
        analysisBounds &&
        spatialDirections.length > 1
          ? homePusulaFocusFromDirections(
              parcelGeometry,
              analysisBounds,
              spatialDirections,
            )
          : null;

      let focusFeature: any =
        multiSpatialFocus?.feature ??
        directFeature;
      let focusBounds: HomeBBox | null =
        multiSpatialFocus?.bounds ??
        (directFeature
          ? homeBboxFromGeometry(directFeature)
          : directBounds);

      /*
       * Yeni NDVI akışında “Göreli farkı göster” öncelikle gerçek Sentinel-2
       * piksellerinden üretilen 3×3 bölge karşılaştırmasını kullanır. Yalnızca
       * eski kayıtlarda göreli yön bilgisi yoksa görüntü-hotspot fallback'i
       * devreye girebilir.
       */
      if (
        !multiSpatialFocus &&
        layer === 'vegetation' &&
        !fallbackSpatialDirection &&
        smoothNdvi &&
        analysisBounds
      ) {
        const realHotspots =
          await homeNdviHotspotFocus(
            smoothNdvi,
            analysisBounds,
          );

        if (realHotspots) {
          focusFeature = realHotspots.feature;
          focusBounds = realHotspots.bounds;
        }
      }

      if (
        !multiSpatialFocus &&
        !focusFeature &&
        (layer === 'radar-vv' ||
          layer === 'radar-vh' ||
          layer === 'radar-water') &&
        clippedRadarImage &&
        radarBounds
      ) {
        const radarHotspots =
          await homeRadarHotspotFocus(
            clippedRadarImage,
            radarBounds,
            layer,
          );

        if (radarHotspots) {
          focusFeature = radarHotspots.feature;
          focusBounds = radarHotspots.bounds;
        }
      }

      if (!focusFeature && directBounds) {
        focusFeature =
          homePusulaFocusFeature(parcelGeometry, directBounds) ??
          homePusulaRectangleFeature(directBounds);
        focusBounds =
          homeBboxFromGeometry(focusFeature) ??
          directBounds;
      }

      if (
        !focusFeature &&
        fallbackSpatialDirection &&
        analysisBounds
      ) {
        const gridBounds =
          homePusulaGridBounds(
            analysisBounds,
            fallbackSpatialDirection,
          );

        /*
         * spatialFieldReader aynı rasterı 3×3 gerçek hücrelere ayırıyor.
         * Burada metinden rastgele koordinat üretmiyoruz; Pusula'nın seçtiği
         * aynı hücreyi coğrafi bbox'a geri çevirip parsel ile kesiştiriyoruz.
         */
        focusFeature =
          homePusulaFocusFeature(
            parcelGeometry,
            gridBounds,
          );

        focusBounds =
          focusFeature
            ? homeBboxFromGeometry(focusFeature)
            : null;
      }

      if (
        (!focusFeature || !focusBounds) &&
        layer === 'radar-water' &&
        analysisBounds
      ) {
        const waterArea =
          spatial?.importantAreaByLayer?.['radar-water'] ??
          spatial?.importantAreaByLayer?.[layer] ??
          null;

        const waterDirection =
          normalizeHomePusulaDirection(
            waterArea?.area ??
              waterArea?.direction,
          );

        if (waterDirection) {
          const waterGridBounds =
            homePusulaGridBounds(
              analysisBounds,
              waterDirection,
            );

          const waterFeature =
            homePusulaFocusFeature(
              parcelGeometry,
              waterGridBounds,
            );

          if (waterFeature) {
            focusFeature = waterFeature;
            focusBounds =
              homeBboxFromGeometry(waterFeature);
          }
        }
      }

      if (!focusFeature || !focusBounds) {
        // Geçerli gerçek mekânsal alan yoksa sahte alan üretme.
        return;
      }

      const installFocus = () => {
        if (!mapRef.current) return;

        const currentMap = mapRef.current;
        clearFocusOverlay(currentMap);

        const focusItems =
          homePusulaFocusItems(focusFeature);

        if (!focusItems.length) {
          return;
        }

        pusulaFocusItemsRef.current =
          focusItems;

        const layerFocusLabel =
          layer === 'vegetation'
            ? 'Göreli düşük NDVI'
            : layer === 'radar-water'
              ? 'Su riski'
              : layer === 'radar-vv'
                ? 'Nem sinyali'
                : layer === 'radar-vh'
                  ? 'Yüzey / bitki farkı'
                  : 'Dikkat alanı';

        const beforeId =
          currentMap.getLayer('home-inline-parcel-line')
            ? 'home-inline-parcel-line'
            : undefined;

        try {
          currentMap.addSource('home-pusula-focus', {
            type: 'geojson',
            data: homePusulaFocusCollection(
              focusItems,
            ),
          } as any);

          const centerFeatures = focusItems.map(
            (item, index) => ({
              type: 'Feature',
              properties: {
                focusIndex: index,
              },
              geometry: {
                type: 'Point',
                coordinates: item.center,
              },
            }),
          );

          currentMap.addSource(
            'home-pusula-focus-centers',
            {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: centerFeatures,
              },
            } as any,
          );

          currentMap.addSource(
            'home-pusula-focus-selected-center',
            {
              type: 'geojson',
              data: centerFeatures[0],
            } as any,
          );

          /*
           * Tüm bulunan alanlar hafif görünür.
           * Böylece kullanıcı tek bir nokta var sanmaz.
           */
          currentMap.addLayer(
            {
              id: 'home-pusula-focus-fill',
              type: 'fill',
              source: 'home-pusula-focus',
              paint: {
                'fill-color': focusPalette.fill,
                'fill-opacity': 0.05,
              },
            },
            beforeId,
          );

          currentMap.addLayer(
            {
              id: 'home-pusula-focus-line',
              type: 'line',
              source: 'home-pusula-focus',
              paint: {
                'line-color': focusPalette.line,
                'line-width': 1.1,
                'line-opacity': 0.28,
              },
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
            },
            beforeId,
          );

          /*
           * Köşeli kırmızı kutu yerine yuvarlak spotlight.
           */
          currentMap.addLayer(
            {
              id: 'home-pusula-focus-center-dots',
              type: 'circle',
              source: 'home-pusula-focus-centers',
              paint: {
                'circle-radius': 7,
                'circle-color': focusPalette.fill,
                'circle-opacity': 0.14,
                'circle-stroke-width': 1.2,
                'circle-stroke-color': focusPalette.line,
                'circle-stroke-opacity': 0.22,
              },
            },
          );

          currentMap.addLayer(
            {
              id: 'home-pusula-focus-selected-halo',
              type: 'circle',
              source: 'home-pusula-focus-selected-center',
              paint: {
                'circle-radius': 26,
                'circle-color': focusPalette.glow,
                'circle-opacity': 0.16,
                'circle-blur': 0.72,
              },
            },
          );

          currentMap.addLayer(
            {
              id: 'home-pusula-focus-selected-dot',
              type: 'circle',
              source: 'home-pusula-focus-selected-center',
              paint: {
                'circle-radius': 10,
                'circle-color': focusPalette.fill,
                'circle-opacity': 0.92,
                'circle-stroke-width': 2,
                'circle-stroke-color': focusPalette.line,
                'circle-stroke-opacity': 0.95,
              },
            },
          );
        } catch (error) {
          console.warn(
            'Pusula odak alanı haritaya eklenemedi:',
            error,
          );
          clearFocusOverlay(currentMap);
          return;
        }

        let selectedIndex = 0;

        const clearMarker = () => {
          try {
            pusulaFocusMarkerRef.current?.remove();
          } catch {
            // no-op
          }
          pusulaFocusMarkerRef.current = null;
        };

        const pulseSelected = () => {
          clearFocusTimers();

          const pulseSteps = [
            {
              delay: 180,
              opacity: 0.38,
              width: 4.4,
              fill: 0.20,
            },
            {
              delay: 520,
              opacity: 1.0,
              width: 2.5,
              fill: 0.12,
            },
            {
              delay: 860,
              opacity: 0.42,
              width: 4.0,
              fill: 0.19,
            },
            {
              delay: 1200,
              opacity: 0.96,
              width: 2.6,
              fill: 0.12,
            },
          ];

          pusulaFocusTimersRef.current =
            pulseSteps.map((step) =>
              window.setTimeout(() => {
                const liveMap = mapRef.current;
                if (!liveMap) return;

                try {
                  if (
                    liveMap.getLayer(
                      'home-pusula-focus-selected-halo',
                    )
                  ) {
                    liveMap.setPaintProperty(
                      'home-pusula-focus-selected-halo',
                      'circle-opacity',
                      step.fill,
                    );
                    liveMap.setPaintProperty(
                      'home-pusula-focus-selected-halo',
                      'circle-radius',
                      18 + step.width * 4.5,
                    );
                  }

                  if (
                    liveMap.getLayer(
                      'home-pusula-focus-selected-dot',
                    )
                  ) {
                    liveMap.setPaintProperty(
                      'home-pusula-focus-selected-dot',
                      'circle-radius',
                      7 + step.width,
                    );
                    liveMap.setPaintProperty(
                      'home-pusula-focus-selected-dot',
                      'circle-stroke-opacity',
                      step.opacity,
                    );
                  }
                } catch {
                  // Katman değiştiyse sessizce bırak.
                }
              }, step.delay),
            );
        };

        const showSelected = (
          index: number,
          animate = true,
        ) => {
          const items =
            pusulaFocusItemsRef.current;

          if (!items.length) return;

          selectedIndex =
            ((index % items.length) +
              items.length) %
            items.length;

          const item = items[selectedIndex];

          const selectedCenterSource =
            currentMap.getSource(
              'home-pusula-focus-selected-center',
            ) as any;

          const centerFeature = {
            type: 'Feature',
            properties: {
              focusIndex: selectedIndex,
            },
            geometry: {
              type: 'Point',
              coordinates: item.center,
            },
          };

          try {
            selectedCenterSource?.setData(
              centerFeature,
            );
          } catch {
            // Harita kaynak değiştirirken kaldırılmış olabilir.
          }

          const [
            west,
            south,
            east,
            north,
          ] = item.bounds;

          currentMap.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            {
              padding: {
                top: 88,
                right: 82,
                bottom: 112,
                left: 82,
              },
              maxZoom: 19.0,
              pitch: 0,
              bearing: 0,
              duration: animate ? 760 : 0,
            },
          );

          const center: [number, number] =
            item.center;

          if (layer === 'vegetation' && field?.id) {
            const requestId = ++ndviObservationRequestRef.current;
            const direction = homePusulaDirectionFromPoint(
              center,
              analysisBounds,
            );
            const relativeHealth = homePusulaRelativeHealthForDirection(
              spatial,
              direction,
            );

            void ensureNdviObservationPoint({
              fieldId: String(field.id),
              direction,
              centroid: center,
              areaGeometry: item.feature?.geometry ?? null,
              ndviValue: null,
              relativeHealth,
              satelliteDate: satelliteData?.latestImageDate ?? null,
            })
              .then((point) => {
                if (requestId !== ndviObservationRequestRef.current) return;

                setNdviObservationTarget({
                  point,
                  fieldName: String(field?.name ?? 'Tarlan'),
                  direction,
                  centroid: center,
                  relativeHealth,
                  ndviValue: null,
                  satelliteDate:
                    String(satelliteData?.latestImageDate ?? '').trim() || null,
                });

                if (detail?.openPhoto) {
                  window.setTimeout(() => {
                    setNdviPhotoModalOpen(true);
                  }, 180);
                }
              })
              .catch((error) => {
                console.warn('NDVI takip noktası kaydedilemedi:', error);
              });
          } else {
            setNdviObservationTarget(null);
          }

          clearMarker();

          const label =
            document.createElement('div');

          const title =
            document.createElement('strong');
          title.textContent =
            layerFocusLabel;

          const detailText =
            document.createElement('span');
          detailText.textContent =
            layer === 'vegetation'
              ? 'Parsel ortalamasına göre daha düşük NDVI.'
              : layer === 'radar-water'
                ? 'Su birikimi sinyali daha yüksek.'
                : layer === 'radar-vv'
                  ? 'Nem sinyali daha belirgin.'
                  : layer === 'radar-vh'
                    ? 'Yüzey / bitki farkı daha belirgin.'
                    : 'Pusula’nın dikkat çektiği alan.';

          const actionHint =
            document.createElement('span');
          actionHint.textContent =
            'FOTOĞRAF YÜKLE';

          label.style.cssText = [
            'pointer-events:none',
            'display:grid',
            'gap:4px',
            'min-width:136px',
            'padding:8px 10px',
            'border-radius:10px',
            `border:1px solid ${focusPalette.labelBorder}`,
            `background:${focusPalette.labelBg}`,
            'color:#fff',
            'box-shadow:0 8px 24px rgba(0,0,0,.34)',
            'backdrop-filter:blur(10px)',
          ].join(';');

          actionHint.style.cssText = [
            'justify-self:start',
            'display:inline-flex',
            'align-items:center',
            'min-height:16px',
            'padding:0 6px',
            'border-radius:999px',
            'background:#fff',
            'color:#8f1111',
            'font:900 7px/1 Inter,system-ui,sans-serif',
            'letter-spacing:.05em',
          ].join(';');

          title.style.cssText = [
            'font:850 9px/1.1 Inter,system-ui,sans-serif',
            'white-space:nowrap',
            'color:#fff',
          ].join(';');

          detailText.style.cssText = [
            'font:780 8px/1.25 Inter,system-ui,sans-serif',
            'color:#fff',
            'opacity:1',
            'white-space:normal',
            'max-width:168px',
          ].join(';');

          label.appendChild(actionHint);
          label.appendChild(title);
          label.appendChild(detailText);

          try {
            actionHint.animate(
              [
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 0.42, transform: 'scale(0.97)' },
              ],
              {
                duration: 780,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'ease-in-out',
              },
            );
          } catch {}

          try {
            pusulaFocusMarkerRef.current =
              new mapRuntime.Marker({
                element: label,
                anchor: 'bottom',
                offset: [0, -7],
              })
                .setLngLat(center)
                .addTo(currentMap);
          } catch {
            // Etiket başarısız olsa bile odak modu devam eder.
          }

          setPusulaFocusUi({
            count: items.length,
            index: selectedIndex,
            label: layerFocusLabel,
            tone: focusTone,
          });

          pulseSelected();
        };

        const showAllFocusAreas = () => {
          const union =
            homePusulaFocusUnionBounds(
              pusulaFocusItemsRef.current,
            );

          if (!union) return;

          const [
            west,
            south,
            east,
            north,
          ] = union;

          currentMap.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            {
              padding: {
                top: 72,
                right: 68,
                bottom: 100,
                left: 68,
              },
              maxZoom: 18.5,
              pitch: 0,
              bearing: 0,
              duration: 650,
            },
          );
        };

        const onPrevious = () => {
          showSelected(
            selectedIndex - 1,
          );
        };

        const onNext = () => {
          showSelected(
            selectedIndex + 1,
          );
        };

        const onShowAll = () => {
          showAllFocusAreas();
        };

        const onExit = () => {
          clearFocusOverlay(currentMap);

          if (bbox) {
            currentMap.fitBounds(
              [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]],
              ],
              {
                padding: {
                  top: 18,
                  right: 18,
                  bottom: 30,
                  left: 18,
                },
                maxZoom: 18.35,
                pitch: 0,
                bearing: 0,
                duration: 650,
              },
            );
          }
        };

        window.addEventListener(
          'tp:home-map-pusula-focus-prev',
          onPrevious,
        );
        window.addEventListener(
          'tp:home-map-pusula-focus-next',
          onNext,
        );
        window.addEventListener(
          'tp:home-map-pusula-focus-all',
          onShowAll,
        );
        window.addEventListener(
          'tp:home-map-pusula-focus-exit',
          onExit,
        );

        /*
         * cleanup fonksiyonlarını bu kaynak kurulumuna bağla.
         * clearFocusOverlay tekrar çağrıldığında eski navigation listener'ları
         * da DOM'da kalmasın.
         */
        const navigationCleanup = () => {
          window.removeEventListener(
            'tp:home-map-pusula-focus-prev',
            onPrevious,
          );
          window.removeEventListener(
            'tp:home-map-pusula-focus-next',
            onNext,
          );
          window.removeEventListener(
            'tp:home-map-pusula-focus-all',
            onShowAll,
          );
          window.removeEventListener(
            'tp:home-map-pusula-focus-exit',
            onExit,
          );
        };

        (currentMap as any).__tpPusulaFocusCleanup?.();
        (currentMap as any).__tpPusulaFocusCleanup =
          navigationCleanup;

        showSelected(0, true);
      };

      if (map.loaded()) {
        installFocus();
      } else {
        map.once('load', installFocus);
      }
    };

    const onShowPusulaArea = (event: Event) => {
      void showFocus(
        (event as CustomEvent<any>)?.detail,
      );
    };

    window.addEventListener(
      'tp:home-map-show-pusula-area',
      onShowPusulaArea,
    );

    return () => {
      window.removeEventListener(
        'tp:home-map-show-pusula-area',
        onShowPusulaArea,
      );

      clearFocusOverlay(mapRef.current);
    };
  }, [
    field?.id,
    layer,
    parcelGeometry,
    satelliteData?.bbox,
    activeRadarImage?.bbox,
    clippedRadarImage,
    smoothNdvi,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
  ]);

  useEffect(() => {
    let cancelled = false;

    if (layer !== 'soil') {
      // Profili silme: Toprak katmanına geri dönünce anında kullan.
      return () => {
        cancelled = true;
      };
    }

    const memoryCached =
      HOME_MAP_SOIL_PROFILE_CACHE.get(soilProfileCacheKey);

    if (memoryCached) {
      setSoilProfile(memoryCached);
      setSoilProfileKey(soilProfileCacheKey);
      setSoilProfileLoading(false);
      setSoilProfileError(null);

      return () => {
        cancelled = true;
      };
    }

    setSoilProfileLoading(true);
    setSoilProfileError(null);

    void (async () => {
      const persisted =
        await readHomeMapPersistentCache<SoilGridsProfile>(
          'soil-profile',
          soilProfileCacheKey,
          HOME_MAP_CACHE_TTL.soil,
        );

      if (persisted) {
        HOME_MAP_SOIL_PROFILE_CACHE.set(
          soilProfileCacheKey,
          persisted,
        );

        if (!cancelled) {
          setSoilProfile(persisted);
          setSoilProfileKey(soilProfileCacheKey);
          setSoilProfileLoading(false);
          setSoilProfileError(null);
        }

        return;
      }

      let pending =
        HOME_MAP_SOIL_PROFILE_INFLIGHT.get(soilProfileCacheKey);

      if (!pending) {
        pending = fetchSoilGridsProfile(
          fieldCenter.latitude,
          fieldCenter.longitude,
        );

        HOME_MAP_SOIL_PROFILE_INFLIGHT.set(
          soilProfileCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_SOIL_PROFILE_INFLIGHT.delete(soilProfileCacheKey);
        });
      }

      const profile = await pending;

      HOME_MAP_SOIL_PROFILE_CACHE.set(
        soilProfileCacheKey,
        profile,
      );

      void writeHomeMapPersistentCache(
        'soil-profile',
        soilProfileCacheKey,
        profile,
      );

      if (!cancelled) {
        setSoilProfile(profile);
        setSoilProfileKey(soilProfileCacheKey);
        setSoilProfileLoading(false);
        setSoilProfileError(null);
      }
    })().catch((error) => {
      if (cancelled) return;

      setSoilProfileError(
        error instanceof Error
          ? error.message
          : 'SoilGrids toprak profili alınamadı.',
      );

      setSoilProfileLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    field?.id,
    homeMapFieldKey,
    fieldCenter.latitude,
    fieldCenter.longitude,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (layer !== 'soil' || !bbox) {
      return () => {
        cancelled = true;
      };
    }

    const memoryCached =
      HOME_MAP_SOIL_CLIPPED_CACHE.get(soilCacheKey);

    if (memoryCached) {
      setClippedSoilImage(memoryCached);
      setClippedSoilImageKey(soilCacheKey);

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const persisted = await readHomeMapPersistentCache<{
        url: string;
        bbox: HomeBBox;
      }>(
        'soil-raster',
        soilCacheKey,
        HOME_MAP_CACHE_TTL.soil,
      );

      if (persisted?.url) {
        HOME_MAP_SOIL_CLIPPED_CACHE.set(
          soilCacheKey,
          persisted,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setClippedSoilImage(persisted);
          setClippedSoilImageKey(soilCacheKey);
        }

        return;
      }

      let pending =
        HOME_MAP_SOIL_VISUAL_INFLIGHT.get(soilCacheKey);

      if (!pending) {
        const soil = homeSoilWmsUrl(
          bbox,
          soilProperty,
          soilDepth,
        );

        const soilUrl =
          `${soil.url}&_tp=${encodeURIComponent(
            `${soilProperty}-${soilDepth}`,
          )}`;

        pending = maskHomeRasterToParcel(
          soilUrl,
          soil.bbox,
          parcelGeometry,
        ).then((url) => ({
          url,
          bbox: soil.bbox,
        }));

        HOME_MAP_SOIL_VISUAL_INFLIGHT.set(
          soilCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_SOIL_VISUAL_INFLIGHT.delete(soilCacheKey);
        });
      }

      const cached = await pending;

      HOME_MAP_SOIL_CLIPPED_CACHE.set(
        soilCacheKey,
        cached,
      );

      void writeHomeMapPersistentCache(
        'soil-raster',
        soilCacheKey,
        cached,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setClippedSoilImage(cached);
        setClippedSoilImageKey(soilCacheKey);
      }
    })().catch((error) => {
      console.warn('SoilGrids raster cache hazırlama hatası:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
    soilProperty,
    soilDepth,
    parcelGeometry,
    soilCacheKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (
      layer !== 'climate' ||
      climateCellsKey !== climateCacheKey ||
      !homeClimateCellsMatchVariable(
        climateCells,
        climateVariableKey,
      )
    ) {
      // Yanlış değişken render edilmediği için son başarılı görseli saklamak
      // güvenlidir ve geri dönüşü hızlandırır.
      return () => {
        cancelled = true;
      };
    }

    const memoryCached =
      HOME_MAP_CLIMATE_CLIPPED_CACHE.get(climateVisualCacheKey);

    if (
      memoryCached &&
      memoryCached.variable === climateVariableKey
    ) {
      setClippedClimateImage(memoryCached);
      setClippedClimateImageKey(climateVisualCacheKey);

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const persisted = await readHomeMapPersistentCache<{
        url: string;
        bbox: HomeBBox;
        summary: HomeLayerSpatialSummary;
        variable: HomeClimateVariable;
      }>(
        'climate-visual',
        climateVisualCacheKey,
        HOME_MAP_CACHE_TTL.climate,
      );

      if (
        persisted?.url &&
        persisted.variable === climateVariableKey
      ) {
        HOME_MAP_CLIMATE_CLIPPED_CACHE.set(
          climateVisualCacheKey,
          persisted,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setClippedClimateImage(persisted);
          setClippedClimateImageKey(climateVisualCacheKey);
        }

        return;
      }

      const smoothClimate = makeSmoothClimateOverlay(
        climateCells,
        climateLayer,
        bbox,
      );

      if (!smoothClimate) {
        return;
      }

      let pending =
        HOME_MAP_CLIMATE_VISUAL_INFLIGHT.get(climateVisualCacheKey);

      if (!pending) {
        pending = maskHomeRasterToParcel(
          smoothClimate.image,
          smoothClimate.bbox,
          parcelGeometry,
        ).then((url) => ({
          url,
          bbox: smoothClimate.bbox,
          summary:
            smoothClimate.summary ??
            homeGeneralSpatialSummary(
              'climate',
              'ERA5 / ERA5-Land',
            ),
          variable: climateVariableKey,
        }));

        HOME_MAP_CLIMATE_VISUAL_INFLIGHT.set(
          climateVisualCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_CLIMATE_VISUAL_INFLIGHT.delete(climateVisualCacheKey);
        });
      }

      const cached = await pending;

      HOME_MAP_CLIMATE_CLIPPED_CACHE.set(
        climateVisualCacheKey,
        cached,
      );

      void writeHomeMapPersistentCache(
        'climate-visual',
        climateVisualCacheKey,
        cached,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setClippedClimateImage(cached);
        setClippedClimateImageKey(climateVisualCacheKey);
      }
    })().catch((error) => {
      console.warn('İklim görsel cache hazırlama hatası:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    layer,
    climateCells,
    climateCellsKey,
    climateCacheKey,
    climateLayer,
    parcelGeometry,
    climateVisualCacheKey,
  ]);


  useEffect(() => {
    let cancelled = false;
    const requestKey = activeLayerRequestKey;

    if (
      !agroLayer ||
      agroCellsKey !== agroCacheKey ||
      !agroCells.length
    ) {
      return () => {
        cancelled = true;
      };
    }

    const memoryCached =
      HOME_MAP_AGRO_CLIPPED_CACHE.get(agroImageCacheKey);

    if (memoryCached) {
      setClippedAgroImage(memoryCached);
      setClippedAgroImageKey(agroImageCacheKey);

      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const persisted = await readHomeMapPersistentCache<{
        url: string;
        bbox: HomeBBox;
        summary: HomeLayerSpatialSummary;
      }>(
        'agro-visual',
        agroImageCacheKey,
        HOME_MAP_CACHE_TTL.agro,
      );

      if (persisted?.url) {
        HOME_MAP_AGRO_CLIPPED_CACHE.set(
          agroImageCacheKey,
          persisted,
        );

        if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
          setClippedAgroImage(persisted);
          setClippedAgroImageKey(agroImageCacheKey);
        }

        return;
      }

      const smoothAgro = makeSmoothAgroOverlay(
        agroCells,
        agroLayer,
        bbox,
      );

      if (!smoothAgro) {
        return;
      }

      let pending =
        HOME_MAP_AGRO_VISUAL_INFLIGHT.get(agroImageCacheKey);

      if (!pending) {
        pending = maskHomeRasterToParcel(
          smoothAgro.image,
          smoothAgro.bbox,
          parcelGeometry,
        ).then((url) => ({
          url,
          bbox: smoothAgro.bbox,
          summary:
            smoothAgro.summary ??
            homeGeneralSpatialSummary(
              agroLayer,
              HOME_AGRO_LAYER_LABELS[agroLayer],
            ),
        }));

        HOME_MAP_AGRO_VISUAL_INFLIGHT.set(
          agroImageCacheKey,
          pending,
        );

        void pending.finally(() => {
          HOME_MAP_AGRO_VISUAL_INFLIGHT.delete(agroImageCacheKey);
        });
      }

      const cached = await pending;

      HOME_MAP_AGRO_CLIPPED_CACHE.set(
        agroImageCacheKey,
        cached,
      );

      void writeHomeMapPersistentCache(
        'agro-visual',
        agroImageCacheKey,
        cached,
      );

      if (!cancelled && activeLayerRequestKeyRef.current === requestKey) {
        setClippedAgroImage(cached);
        setClippedAgroImageKey(agroImageCacheKey);
      }
    })().catch((error) => {
      console.warn('Tarım katmanı görsel cache hazırlama hatası:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    agroLayer,
    agroCells,
    agroCellsKey,
    agroCacheKey,
    parcelGeometry,
    agroImageCacheKey,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const installLayers = () => {
      if (!mapRef.current) return;

      const isRadarLayer =
        layer === 'radar-vv' ||
        layer === 'radar-vh' ||
        layer === 'radar-water';

      const isAgroLayer = Boolean(agroLayer);

      const targetHasRaster =
        layer === 'vegetation'
          ? Boolean(
              smoothNdvi &&
                bbox &&
                smoothNdviKey === ndviCacheKey,
            )
          : isRadarLayer
            ? Boolean(
                clippedRadarImage &&
                  activeRadarImage?.bbox &&
                  clippedRadarImageKey === radarVisualCacheKey,
              )
            : layer === 'soil'
              ? Boolean(
                  clippedSoilImage &&
                    clippedSoilImageKey === soilCacheKey &&
                    homeSoilSpatialSummary(bbox).mode !== 'general',
                )
              : layer === 'climate'
                ? Boolean(
                    clippedClimateImage &&
                      clippedClimateImageKey === climateVisualCacheKey &&
                      clippedClimateImage.variable === climateVariableKey &&
                      clippedClimateImage.summary.mode !== 'general',
                  )
                : isAgroLayer
                  ? Boolean(
                      clippedAgroImage &&
                        clippedAgroImageKey === agroImageCacheKey &&
                        clippedAgroImage.summary.layer === layer &&
                        clippedAgroImage.summary.mode !== 'general',
                    )
                  : false;

      /*
       * Katman geçiş kuralı:
       * - hedef katmanın kendi cache'i hazırsa anında onu çiz,
       * - hedef ilk kez yükleniyorsa önceki katmanın rengini yeni başlık altında
       *   göstermemek için eski rasterı temizle ve yalnız uydu tabanını bırak,
       * - aynı hedefin mevcut rasterı varken arka planda yenileniyorsa onu koru.
       * Böylece hem flaş/boşluk azalır hem de NDVI renginin VV etiketi altında
       * birkaç saniye görünmesi gibi yanıltıcı geçişler olmaz.
       */
      const targetIsPending =
        layer === 'vegetation'
          ? Boolean(
              satelliteData?.ndviImage &&
                bbox &&
                (!smoothNdvi || smoothNdviKey !== ndviCacheKey),
            )
          : isRadarLayer
            ? Boolean(
                loading ||
                  (activeRadarImage?.imageDataUrl &&
                    activeRadarImage?.bbox &&
                    (!clippedRadarImage ||
                      clippedRadarImageKey !== radarVisualCacheKey)),
              )
            : layer === 'soil'
              ? Boolean(
                  soilProfileLoading ||
                    ((!clippedSoilImage ||
                      clippedSoilImageKey !== soilCacheKey) &&
                      !soilLoadError),
                )
              : layer === 'climate'
                ? Boolean(
                    loading ||
                      (climateCellsKey === climateCacheKey &&
                        climateCells.length > 0 &&
                        (!clippedClimateImage ||
                          clippedClimateImageKey !== climateVisualCacheKey)),
                  )
                : isAgroLayer
                  ? Boolean(
                      loading ||
                        (agroCellsKey === agroCacheKey &&
                          agroCells.length > 0 &&
                          (!clippedAgroImage ||
                            clippedAgroImageKey !== agroImageCacheKey)),
                    )
                  : false;

      const clearLayer = (id: string, source: string) => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(source)) map.removeSource(source);
      };

      const clearRenderedRaster = () => {
        clearLayer('home-inline-image-layer', 'home-inline-image');
        clearLayer('home-inline-climate-layer', 'home-inline-climate');
        clearLayer('home-inline-agro-layer', 'home-inline-agro');
        renderedLayerRequestKeyRef.current = '';
      };

      if (!targetHasRaster && targetIsPending) {
        // Aynı hedef katmanın eski/son başarılı rasterı zaten görünüyorsa
        // arka plandaki yenileme sırasında onu koru. Başka katmanın rasterıysa
        // yanlış veri göstermemek için temizle.
        if (renderedLayerRequestKeyRef.current !== activeMapVisualKey) {
          clearRenderedRaster();
        }
        return;
      }

      clearRenderedRaster();

      if (
        layer === 'vegetation' &&
        smoothNdvi &&
        bbox &&
        smoothNdviKey === ndviCacheKey
      ) {
        map.addSource('home-inline-image', {
          type: 'image',
          url: smoothNdvi,
          coordinates: [
            [bbox[0], bbox[3]],
            [bbox[2], bbox[3]],
            [bbox[2], bbox[1]],
            [bbox[0], bbox[1]],
          ],
        } as any);

        map.addLayer(
          {
            id: 'home-inline-image-layer',
            type: 'raster',
            source: 'home-inline-image',
            paint: {
              'raster-opacity': 0.82,
              'raster-fade-duration': 0,
              'raster-saturation': 0.04,
              'raster-contrast': -0.04,
              'raster-resampling': 'linear',
            },
          },
          map.getLayer('home-inline-parcel-shadow')
            ? 'home-inline-parcel-shadow'
            : undefined
        );
        renderedLayerRequestKeyRef.current = activeMapVisualKey;
      }

      if (
        (layer === 'radar-vv' ||
          layer === 'radar-vh' ||
          layer === 'radar-water') &&
        clippedRadarImage &&
        clippedRadarImageKey === radarVisualCacheKey &&
        activeRadarImage?.bbox
      ) {
        const rb = activeRadarImage.bbox as HomeBBox;

        map.addSource('home-inline-image', {
          type: 'image',
          url: clippedRadarImage,
          coordinates: [
            [rb[0], rb[3]],
            [rb[2], rb[3]],
            [rb[2], rb[1]],
            [rb[0], rb[1]],
          ],
        } as any);

        map.addLayer(
          {
            id: 'home-inline-image-layer',
            type: 'raster',
            source: 'home-inline-image',
            paint: {
              'raster-opacity': 0.90,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
              'raster-contrast': 0.10,
              'raster-saturation': 0.10,
            },
          },
          map.getLayer('home-inline-parcel-shadow')
            ? 'home-inline-parcel-shadow'
            : undefined
        );
        renderedLayerRequestKeyRef.current = activeMapVisualKey;
      }

      if (
        layer === 'soil' &&
        clippedSoilImage &&
        clippedSoilImageKey === soilCacheKey &&
        homeSoilSpatialSummary(bbox).mode !== 'general'
      ) {
        setSoilLoadError(null);

        map.addSource('home-inline-image', {
          type: 'image',
          url: clippedSoilImage.url,
          coordinates: [
            [clippedSoilImage.bbox[0], clippedSoilImage.bbox[3]],
            [clippedSoilImage.bbox[2], clippedSoilImage.bbox[3]],
            [clippedSoilImage.bbox[2], clippedSoilImage.bbox[1]],
            [clippedSoilImage.bbox[0], clippedSoilImage.bbox[1]],
          ],
        } as any);

        map.addLayer(
          {
            id: 'home-inline-image-layer',
            type: 'raster',
            source: 'home-inline-image',
            paint: {
              'raster-opacity': 0.72,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
              'raster-contrast': 0.03,
              'raster-saturation': 0.06,
            },
          },
          map.getLayer('home-inline-parcel-shadow')
            ? 'home-inline-parcel-shadow'
            : undefined,
        );
        renderedLayerRequestKeyRef.current = activeMapVisualKey;
      }

      if (
        layer === 'climate' &&
        clippedClimateImage &&
        clippedClimateImageKey === climateVisualCacheKey &&
        clippedClimateImage.variable === climateVariableKey &&
        clippedClimateImage.summary.mode !== 'general'
      ) {
        const cb = clippedClimateImage.bbox;

        map.addSource('home-inline-climate', {
          type: 'image',
          url: clippedClimateImage.url,
          coordinates: [
            [cb[0], cb[3]],
            [cb[2], cb[3]],
            [cb[2], cb[1]],
            [cb[0], cb[1]],
          ],
        } as any);

        map.addLayer(
          {
            id: 'home-inline-climate-layer',
            type: 'raster',
            source: 'home-inline-climate',
            paint: {
              'raster-opacity': 0.72,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
              'raster-contrast': -0.08,
            },
          },
          map.getLayer('home-inline-parcel-shadow')
            ? 'home-inline-parcel-shadow'
            : undefined,
        );
        renderedLayerRequestKeyRef.current = activeMapVisualKey;
      }


      if (
        agroLayer &&
        clippedAgroImage &&
        clippedAgroImageKey === agroImageCacheKey &&
        clippedAgroImage.summary.layer === layer &&
        clippedAgroImage.summary.mode !== 'general'
      ) {
        const ab = clippedAgroImage.bbox;

        map.addSource('home-inline-agro', {
          type: 'image',
          url: clippedAgroImage.url,
          coordinates: [
            [ab[0], ab[3]],
            [ab[2], ab[3]],
            [ab[2], ab[1]],
            [ab[0], ab[1]],
          ],
        } as any);

        map.addLayer(
          {
            id: 'home-inline-agro-layer',
            type: 'raster',
            source: 'home-inline-agro',
            paint: {
              'raster-opacity': 0.86,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
              'raster-contrast': 0.08,
              'raster-saturation': 0.12,
            },
          },
          map.getLayer('home-inline-parcel-shadow')
            ? 'home-inline-parcel-shadow'
            : undefined,
        );
        renderedLayerRequestKeyRef.current = activeMapVisualKey;
      }
    };

    let cancelled = false;
    let retryTimer: number | null = null;

    const installWhenStyleReady = () => {
      if (cancelled || !mapRef.current) return;

      /*
       * map.loaded() tile/ağ yükleri sırasında false dönebilir ve `load`
       * olayı daha önce gerçekleşmiş olabilir. O durumda eski kod bir daha
       * tetiklenmediği için NDVI ilk açılışta görünmüyor, ancak başka katmana
       * geçip geri dönünce çiziliyordu. Raster eklemek için gerekli olan şey
       * stilin hazır olmasıdır.
       */
      if (map.isStyleLoaded()) {
        installLayers();
        return;
      }

      if (retryTimer == null) {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          installWhenStyleReady();
        }, 60);
      }
    };

    /*
     * Burada kalıcı `styledata` listener KULLANMIYORUZ. Kaynak/layer eklemek
     * de styledata ürettiği için eski sürüm kendi kendini tekrar tetikliyor,
     * NDVI rasterını sürekli silip yeniden ekliyor ve ekranda bozuk TV gibi
     * renk flaşı oluşturuyordu. Effect zaten veri/katman değişince yeniden
     * çalışıyor; ilk açılışta yalnızca stil hazır olana kadar beklemek yeterli.
     */
    installWhenStyleReady();

    if (!map.isStyleLoaded()) {
      map.once('load', installWhenStyleReady);
    }

    return () => {
      cancelled = true;

      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
      }

      try {
        map.off('load', installWhenStyleReady);
      } catch {
        // no-op
      }
    };
  }, [
    layer,
    smoothNdvi,
    smoothNdviKey,
    ndviCacheKey,
    clippedRadarImage,
    clippedRadarImageKey,
    radarVisualCacheKey,
    activeRadarImage?.bbox,
    clippedSoilImage?.url,
    clippedSoilImageKey,
    soilCacheKey,
    clippedSoilImage?.bbox,
    clippedClimateImage?.url,
    clippedClimateImage?.bbox,
    clippedClimateImageKey,
    climateVisualCacheKey,
    clippedAgroImage?.url,
    clippedAgroImage?.bbox,
    clippedAgroImageKey,
    agroImageCacheKey,
    agroLayer,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
    soilProperty,
    soilDepth,
    climateLayer,
    climateDepth,
    loading,
    soilProfileLoading,
    soilLoadError,
    climateCells.length,
    climateCellsKey,
    climateCacheKey,
    agroCells.length,
    agroCellsKey,
    agroCacheKey,
    activeRadarImage?.imageDataUrl,
    activeMapVisualKey,
  ]);

  const fitParcel = () => {
    const map = mapRef.current;
    if (!map || !bbox) return;

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: { top: 18, right: 18, bottom: 30, left: 18 },
        maxZoom: 18.35,
        pitch: 0,
        bearing: 0,
        duration: 500,
      }
    );
  };

  const zoomInMap = () => {
    mapRef.current?.zoomIn({ duration: 180 });
  };

  const zoomOutMap = () => {
    mapRef.current?.zoomOut({ duration: 180 });
  };

  const spatialSummary = useMemo<HomeLayerSpatialSummary | null>(() => {
    if (
      layer === 'radar-vv' ||
      layer === 'radar-vh' ||
      layer === 'radar-water'
    ) {
      return clippedRadarImageKey === radarVisualCacheKey
        ? radarSpatialSummary
        : null;
    }

    if (layer === 'soil') {
      const baseSummary = homeSoilSpatialSummary(bbox);

      if (
        baseSummary.mode === 'general' ||
        (clippedSoilImageKey !== soilCacheKey && soilMetric)
      ) {
        return homeGeneralSpatialSummary(
          'soil',
          'SoilGrids 250 m',
          soilMetric
            ? {
                value: soilMetric.value,
                unit: soilMetric.unit,
                label: soilMetric.label,
              }
            : undefined,
        );
      }

      return baseSummary;
    }

    if (layer === 'climate') {
      return (
        clippedClimateImageKey === climateVisualCacheKey &&
        clippedClimateImage?.variable === climateVariableKey
          ? clippedClimateImage.summary
          : homeGeneralSpatialSummary(
              'climate',
              'ERA5 / ERA5-Land',
            )
      );
    }

    if (
      layer === 'surface-temperature' ||
      layer === 'evapotranspiration' ||
      layer === 'rainfall-history'
    ) {
      return (
        clippedAgroImageKey === agroImageCacheKey &&
        clippedAgroImage?.summary?.layer === layer
          ? clippedAgroImage.summary
          : homeGeneralSpatialSummary(
              layer,
              HOME_AGRO_LAYER_LABELS[layer],
            )
      );
    }

    return null;
  }, [
    layer,
    radarSpatialSummary,
    clippedRadarImageKey,
    radarVisualCacheKey,
    clippedSoilImage?.url,
    clippedSoilImageKey,
    soilCacheKey,
    soilMetric?.value,
    soilMetric?.unit,
    soilMetric?.label,
    clippedClimateImage?.summary,
    clippedClimateImage?.variable,
    clippedClimateImageKey,
    climateVisualCacheKey,
    climateVariableKey,
    clippedAgroImage?.summary,
    clippedAgroImageKey,
    agroImageCacheKey,
    bbox?.[0],
    bbox?.[1],
    bbox?.[2],
    bbox?.[3],
  ]);

  useEffect(() => {
    onSpatialSummary?.(spatialSummary);
  }, [
    onSpatialSummary,
    spatialSummary?.layer,
    spatialSummary?.mode,
    spatialSummary?.variability,
    spatialSummary?.shortLabel,
    spatialSummary?.message,
    spatialSummary?.displayValue,
    spatialSummary?.displayUnit,
    spatialSummary?.displayLabel,
    spatialSummary?.displayMeta,
  ]);

  const satelliteDate =
    layer === 'vegetation'
      ? formatHomeSatelliteDate(satelliteData?.latestImageDate)
      : '';

  const radarDate = radarMode
    ? formatHomeSatelliteDate(
        activeRadarImage?.scene?.datetime ??
          activeRadarImage?.dataDate ??
          activeRadarImage?.timeRange?.to,
      )
    : '';

  const labels: Record<HomeLayer, string> = {
    vegetation: '🌿 NDVI · Vejetasyon İndeksi',
    'radar-vv': '◈ Yüzey Nem Sinyali · Sentinel-1',
    'radar-vh': '◈ Yüzey & Bitki Farkı · Radar',
    'radar-water': '◈ Göllenme / Su Adayı · Sentinel-1',
    soil: `◫ Toprak · ${HOME_SOIL_PROPERTY_LABELS[soilProperty]} · ${HOME_SOIL_DEPTH_LABELS[soilDepth]}`,
    climate: `☁ İklim · ${HOME_CLIMATE_LAYER_LABELS[climateLayer]}${
      climateLayer === 'soil-moisture' || climateLayer === 'soil-temperature'
        ? ` · ${HOME_CLIMATE_DEPTH_LABELS[climateDepth]}`
        : ''
    }`,
    'surface-temperature': '♨ Yüzeye Yakın Toprak Sıcaklığı · ERA5-Land',
    evapotranspiration: '◌ Evapotranspirasyon · ET₀ / 7 gün',
    'rainfall-history': '☂ Yağış Geçmişi · Son 30 gün toplam',
  };


  const sourceLabels: Record<HomeLayer, string> = {
    vegetation: 'Sentinel-2 Uydu Verisi',
    'radar-vv': 'Sentinel-1 Radar',
    'radar-vh': 'Sentinel-1 Radar',
    'radar-water': 'Sentinel-1 Radar',
    soil: 'SoilGrids',
    climate:
      climateLayer === 'precipitation'
        ? 'ECMWF ERA5 · Open-Meteo'
        : 'ECMWF ERA5-Land · Open-Meteo',
    'surface-temperature': 'ERA5-Land',
    evapotranspiration: 'FAO-56 ET₀',
    'rainfall-history': 'Open-Meteo',
  };

  const ndviAverageValue = Number(satelliteData?.ndviAverage);
  const hasNdviAverage = Number.isFinite(ndviAverageValue);

  return (
    <div className="tp-real-home-map" style={{ height }}>
      <div ref={containerRef} className="tp-real-home-map-canvas" />
      <MapDataDate
        layer={layer}
        latestDate={satelliteData?.latestImageDate}
        radarRange={activeRadarImage?.timeRange}
        hasData={Boolean(
          layer === 'vegetation'
            ? smoothNdvi && smoothNdviKey === ndviCacheKey && bbox
            : layer.startsWith('radar-')
              ? clippedRadarImage && clippedRadarImageKey === radarVisualCacheKey
              : layer === 'soil'
                ? clippedSoilImage && clippedSoilImageKey === soilCacheKey
                : layer === 'climate'
                  ? clippedClimateImage &&
                    clippedClimateImageKey === climateVisualCacheKey
                  : clippedAgroImage && clippedAgroImageKey === agroImageCacheKey
        )}
        isHistorical={Boolean(history.data || radarHistory.data)}
      />

      {layer === 'vegetation' &&
      selectedTrackingPoint &&
      !pusulaFocusUi ? (
        <div
          aria-label="Seçili NDVI takip noktası"
          style={{
            position: 'absolute',
            zIndex: 45,
            left: '50%',
            top: 12,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: 'calc(100% - 28px)',
            minHeight: 38,
            padding: '5px 6px 5px 10px',
            border: '1px solid rgba(34,197,94,.18)',
            borderRadius: 999,
            background: 'rgba(2,10,5,.93)',
            boxShadow: '0 10px 28px rgba(0,0,0,.38)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              minWidth: 0,
              display: 'grid',
              paddingRight: 4,
            }}
          >
            <small
              style={{
                color: '#86efac',
                fontSize: 6.3,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}
            >
              NDVI TAKİP NOKTASI
            </small>
            <strong
              style={{
                marginTop: 3,
                overflow: 'hidden',
                color: 'rgba(237,244,238,.92)',
                fontSize: 8.7,
                fontWeight: 820,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedTrackingPoint.point.direction
                ? selectedTrackingPoint.point.direction
                    .charAt(0)
                    .toLocaleUpperCase('tr-TR') +
                  selectedTrackingPoint.point.direction.slice(1)
                : 'Takip noktası'}
              {selectedTrackingPoint.point.lastPhotoAt
                ? ` · Son foto ${formatHomeSatelliteDate(
                    selectedTrackingPoint.point.lastPhotoAt,
                  )}`
                : ''}
            </strong>
          </span>

          <button
            type="button"
            onClick={() => {
              const point = selectedTrackingPoint.point;

              window.dispatchEvent(
                new CustomEvent('tp:home-map-show-pusula-area', {
                  detail: {
                    fieldId: point.fieldId,
                    layer: 'vegetation',
                    importantArea: {
                      area: point.direction,
                      geometry: point.areaGeometry,
                    },
                    spatial: null,
                  },
                }),
              );
            }}
            style={{
              minHeight: 27,
              padding: '0 7px',
              border: '1px solid rgba(6,182,212,.14)',
              borderRadius: 999,
              background: 'rgba(6,182,212,.045)',
              color: '#a5f3fc',
              fontSize: 6.8,
              fontWeight: 850,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Odakla
          </button>

          <button
            type="button"
            onClick={() => setNdviHistoryOpen(true)}
            style={{
              minHeight: 27,
              padding: '0 7px',
              border: '1px solid rgba(34,197,94,.14)',
              borderRadius: 999,
              background: 'rgba(34,197,94,.04)',
              color: '#bbf7d0',
              fontSize: 6.8,
              fontWeight: 850,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Geçmiş
          </button>

          <button
            type="button"
            onClick={() => setNdviPhotoModalOpen(true)}
            style={{
              minHeight: 27,
              padding: '0 7px',
              border: '1px solid rgba(239,68,68,.14)',
              borderRadius: 999,
              background: 'rgba(239,68,68,.04)',
              color: '#fecaca',
              fontSize: 6.8,
              fontWeight: 850,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📷 Foto
          </button>

          <button
            type="button"
            aria-label="Takip noktası menüsünü kapat"
            onClick={() => setSelectedTrackingPoint(null)}
            style={{
              width: 27,
              height: 27,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.02)',
              color: 'rgba(218,230,220,.72)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {pusulaFocusUi && (
        <div
          aria-label="Pusula odak modu"
          style={{
            position: 'absolute',
            zIndex: 46,
            left: '50%',
            top: 14,
            bottom: 'auto',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            maxWidth: 'calc(100% - 28px)',
            minHeight: 38,
            padding: '5px 6px 5px 10px',
            borderRadius: 999,
            border:
              pusulaFocusUi.tone === 'danger'
                ? '1px solid rgba(239,68,68,.28)'
                : pusulaFocusUi.tone === 'attention'
                  ? '1px solid rgba(245,158,11,.24)'
                  : '1px solid rgba(134,239,172,.22)',
            background: 'rgba(2,10,5,.92)',
            boxShadow: '0 10px 28px rgba(0,0,0,.36)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              display: 'grid',
              minWidth: 0,
              paddingRight: 3,
            }}
          >
            <small
              style={{
                color:
                  pusulaFocusUi.tone === 'danger'
                    ? '#fca5a5'
                    : pusulaFocusUi.tone === 'attention'
                      ? '#fcd34d'
                      : '#86efac',
                fontSize: 6.5,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}
            >
              PUSULA ODAK
            </small>
            <strong
              style={{
                marginTop: 3,
                overflow: 'hidden',
                color: 'rgba(237,244,238,.92)',
                fontSize: 9,
                fontWeight: 800,
                lineHeight: 1,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pusulaFocusUi.count}{' '}
              {pusulaFocusUi.count === 1
                ? 'alan bulundu'
                : 'ayrı alan bulundu'}
            </strong>
          </span>

          {pusulaFocusUi.count > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(
                      'tp:home-map-pusula-focus-prev',
                    ),
                  )
                }
                aria-label="Önceki Pusula alanı"
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.025)',
                  color: '#d8e6db',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ‹
              </button>

              <strong
                style={{
                  minWidth: 34,
                  color: '#dbe8dd',
                  fontSize: 8.5,
                  textAlign: 'center',
                }}
              >
                {pusulaFocusUi.index + 1}/
                {pusulaFocusUi.count}
              </strong>

              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(
                      'tp:home-map-pusula-focus-next',
                    ),
                  )
                }
                aria-label="Sonraki Pusula alanı"
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.025)',
                  color: '#d8e6db',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ›
              </button>

              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(
                      'tp:home-map-pusula-focus-all',
                    ),
                  )
                }
                title="Tüm tespitleri göster"
                style={{
                  minHeight: 28,
                  padding: '0 7px',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.02)',
                  color: 'rgba(211,226,215,.72)',
                  fontSize: 7,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Tümü
              </button>
            </>
          )}

          {layer === 'vegetation' &&
          ndviObservationTarget?.point.lastPhotoAt ? (
            <button
              type="button"
              onClick={() => setNdviHistoryOpen(true)}
              title="Bu noktanın fotoğraf ve gelişim geçmişini aç"
              style={{
                minHeight: 28,
                padding: '0 8px',
                border: '1px solid rgba(34,197,94,.16)',
                borderRadius: 999,
                background: 'rgba(34,197,94,.045)',
                color: '#bbf7d0',
                fontSize: 7,
                fontWeight: 850,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ◷ Geçmiş
            </button>
          ) : null}

          {layer === 'vegetation' && ndviObservationTarget ? (
            <button
              type="button"
              onClick={() => setNdviPhotoModalOpen(true)}
              title={
                ndviObservationTarget.point.lastPhotoAt
                  ? `Son fotoğraf: ${formatHomeSatelliteDate(ndviObservationTarget.point.lastPhotoAt)}`
                  : 'Bu noktadan fotoğraf ekle'
              }
              style={{
                minHeight: 28,
                padding: '0 8px',
                border: '1px solid rgba(239,68,68,.18)',
                borderRadius: 999,
                background: 'rgba(239,68,68,.065)',
                color: '#fecaca',
                fontSize: 7,
                fontWeight: 850,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📷 {ndviObservationTarget.point.lastPhotoAt ? 'Yeni foto' : 'Fotoğraf ekle'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(
                  'tp:home-map-pusula-focus-exit',
                ),
              )
            }
            style={{
              minHeight: 28,
              padding: '0 8px',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 8,
              background: 'rgba(255,255,255,.025)',
              color: 'rgba(215,229,218,.78)',
              fontSize: 7,
              fontWeight: 850,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Tarlaya dön
          </button>
        </div>
      )}

      <FieldOperationModal
        open={fieldOperationOpen}
        fieldId={field?.id ? String(field.id) : null}
        fieldName={String(field?.name ?? 'Tarlan')}
        onClose={() => setFieldOperationOpen(false)}
        onSaved={(operation) => {
          const costText =
            operation.cost != null && operation.cost > 0
              ? ` · ${operation.cost.toLocaleString('tr-TR')} TL gider kaydı`
              : '';
          setFieldOperationToast(`${operation.type} kaydedildi${costText}`);
          window.setTimeout(() => setFieldOperationToast(null), 2600);
        }}
      />

      <NdviObservationPhotoModal
        open={ndviPhotoModalOpen}
        target={ndviObservationTarget}
        onClose={() => setNdviPhotoModalOpen(false)}
        onUploaded={(result: ObservationUploadResult) => {
          setNdviObservationTarget((current) =>
            current
              ? {
                  ...current,
                  point: result.updatedPoint,
                }
              : current,
          );
          setTrackingRefreshKey((value) => value + 1);
        }}
      />

      <NdviObservationTimelineModal
        open={ndviHistoryOpen}
        target={ndviObservationTarget}
        onClose={() => setNdviHistoryOpen(false)}
        onAddPhoto={() => setNdviPhotoModalOpen(true)}
      />

      <FieldObservationPointsModal
        open={fieldTrackingOpen}
        fieldId={field?.id ? String(field.id) : null}
        fieldName={String(field?.name ?? 'Tarlan')}
        onClose={() => setFieldTrackingOpen(false)}
        onStatusChanged={(point) => {
          setTrackingRefreshKey((value) => value + 1);

          if (point.status !== 'active') {
            setSelectedTrackingPoint((current) =>
              current?.point.id === point.id ? null : current,
            );
          }

          setNdviObservationTarget((current) =>
            current?.point.id === point.id
              ? { ...current, point }
              : current,
          );
        }}
        onOpenHistory={(target) => {
          setFieldTrackingOpen(false);
          setNdviObservationTarget(target);
          setSelectedTrackingPoint(
            trackingPointOverviews.find(
              (item) => item.point.id === target.point.id,
            ) ?? null,
          );
          window.setTimeout(() => setNdviHistoryOpen(true), 80);
        }}
        onOpenOnMap={(target) => {
          setFieldTrackingOpen(false);
          setNdviObservationTarget(target);
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('tp:home-map-show-pusula-area', {
                detail: {
                  fieldId: target.point.fieldId,
                  layer: 'vegetation',
                  importantArea: {
                    area: target.direction,
                    geometry: target.point.areaGeometry,
                  },
                  spatial: null,
                },
              }),
            );
          }, 100);
        }}
      />

      <div className="tp-map-control-rail" aria-label="Harita kontrolleri">
        <button
          type="button"
          className="tp-map-control-btn tp-map-fit-control"
          onClick={fitParcel}
          aria-label="Tarlayı ortala"
          title="Tarlayı ortala"
        >
          <Crosshair size={23} strokeWidth={1.9} />
        </button>

        {layer === 'vegetation' ? (
          <button
            type="button"
            className="tp-map-control-btn tp-map-tracking-control"
            onClick={() => setFieldTrackingOpen(true)}
            aria-label="Takip noktalarını göster"
            title="NDVI takip noktaları"
          >
            <History size={22} strokeWidth={1.9} />
          </button>
        ) : null}

        <button
          type="button"
          className="tp-map-control-btn"
          onClick={zoomInMap}
          aria-label="Yakınlaştır"
          title="Yakınlaştır"
        >
          <Plus size={24} strokeWidth={2.1} />
        </button>

        <button
          type="button"
          className="tp-map-control-btn"
          onClick={zoomOutMap}
          aria-label="Uzaklaştır"
          title="Uzaklaştır"
        >
          <Minus size={24} strokeWidth={2.1} />
        </button>

        {(layer === 'vegetation' || radarMode) && (
          <button
            type="button"
            className="tp-map-control-btn tp-map-history-label tp-map-satellite-history-control"
            onClick={() =>
              layer === 'vegetation'
                ? void history.show()
                : void radarHistory.show()
            }
            aria-label={
              layer === 'vegetation'
                ? 'Geçmiş uydu ölçümlerini aç'
                : 'Geçmiş Sentinel-1 radar ölçümlerini aç'
            }
            title={
              layer === 'vegetation'
                ? 'Uydu geçmişi'
                : 'Radar geçmişi'
            }
          >
            <Satellite size={21} strokeWidth={1.9} />
            <span>Geçmiş</span>
          </button>
        )}

      </div>

      <SatelliteHistorySheet
        open={history.open}
        dates={history.dates}
        loading={history.loading}
        error={history.error}
        fieldName={String(field?.name ?? 'Tarlan')}
        selectedDate={history.data?.latestImageDate}
        currentData={history.data}
        getHistoryData={history.getHistoryData}
        onSelect={date => void history.select(date)}
        onClose={history.close}
      />

      {radarMode ? (
        <RadarHistorySheet
          open={radarHistory.open}
          scenes={radarHistory.scenes}
          comparisonBasis={radarHistory.comparisonBasis}
          loading={radarHistory.loading}
          error={radarHistory.error}
          fieldName={String(field?.name ?? 'Tarlan')}
          mode={radarMode}
          currentData={radarImage}
          selectedData={radarHistory.data}
          selectedScene={radarHistory.selectedScene}
          geometry={parcelGeometry}
          onSelect={(scene) => void radarHistory.select(scene)}
          onResetCurrent={radarHistory.resetCurrent}
          onClose={radarHistory.close}
        />
      ) : null}

      <div className="tp-real-home-badge">
        <span className="tp-real-home-badge-pulse" aria-hidden="true" />
        {labels[layer]}
      </div>

      {layer === 'vegetation' && (
        <div className="tp-ndvi-legend-card" aria-label="Mutlak NDVI açıklaması">
          <strong>NDVI · Mutlak Değer</strong>
          <div className="tp-ndvi-legend-row">
            <i className="very-healthy" />
            <span>≥ 0.80</span>
            <b>Çok yüksek</b>
          </div>
          <div className="tp-ndvi-legend-row">
            <i className="healthy" />
            <span>0.60 - 0.79</span>
            <b>Yüksek</b>
          </div>
          <div className="tp-ndvi-legend-row">
            <i className="medium" />
            <span>0.30 - 0.59</span>
            <b>Orta</b>
          </div>
          <div className="tp-ndvi-legend-row">
            <i className="weak" />
            <span>&lt; 0.30</span>
            <b>Düşük</b>
          </div>
          <div className="tp-ndvi-live-summary">
            <span>Parsel Ortalaması</span>
            <strong>{hasNdviAverage ? ndviAverageValue.toFixed(2) : '—'}</strong>
          </div>
        </div>
      )}

      <div className="tp-map-data-badge">
        <div>
          <span className="tp-map-data-icon" aria-hidden="true"><CalendarClock size={18} strokeWidth={1.8} /></span>
          <span>
            <small>
              {layer === 'vegetation'
                ? 'Son Güncelleme'
                : radarMode
                  ? radarHistory.data
                    ? 'Geçmiş Veri Tarihi'
                    : 'Veri Tarihi'
                  : 'Aktif Katman'}
            </small>
            <strong>
              {layer === 'vegetation'
                ? satelliteDate || 'Güncelleniyor'
                : radarMode
                  ? radarDate || 'Güncelleniyor'
                  : labels[layer].replace(/^[^ ]+ /, '')}
            </strong>
          </span>
        </div>
        <div>
          <span className="tp-map-data-icon" aria-hidden="true"><Satellite size={18} strokeWidth={1.8} /></span>
          <span>
            <small>Veri Kaynağı</small>
            <strong>{sourceLabels[layer]}</strong>
          </span>
        </div>
      </div>

      {spatialSummary && (
        <div
          className={`tp-home-spatial-note ${spatialSummary.mode}`}
          title={`${spatialSummary.message} ${spatialSummary.detail}`}
        >
          <span className="tp-home-spatial-dot" />
          <strong>{spatialSummary.shortLabel}</strong>
        </div>
      )}

      {(() => {
        const guide = getHomeLayerFarmerGuide(
          layer,
          soilProperty,
          climateLayer,
        );

        if (spatialSummary?.mode === 'general') {
          const summaryUnit = String(spatialSummary.displayUnit ?? '');

          const expectedAgroUnit =
            layer === 'surface-temperature'
              ? '°C'
              : layer === 'evapotranspiration'
                ? 'mm'
                : layer === 'rainfall-history'
                  ? 'mm'
                  : '';

          const staleAgroMetric =
            Boolean(expectedAgroUnit) &&
            Boolean(summaryUnit) &&
            !summaryUnit.includes(expectedAgroUnit);

          const expectedClimateUnit =
            layer !== 'climate'
              ? ''
              : climateLayer === 'soil-moisture'
                ? 'm³/m³'
                : climateLayer === 'soil-temperature' ||
                    climateLayer === 'air-temperature'
                  ? '°C'
                  : 'mm';

          const staleClimateMetric =
            Boolean(expectedClimateUnit) &&
            Boolean(summaryUnit) &&
            !summaryUnit.includes(expectedClimateUnit);

          const value =
            staleAgroMetric || staleClimateMetric
              ? null
              : spatialSummary.displayValue;

          const isClimateSoilMoisture =
            layer === 'climate' && climateLayer === 'soil-moisture';
          const formattedValue =
            value != null && Number.isFinite(Number(value))
              ? Number(value).toLocaleString('tr-TR', {
                  minimumFractionDigits: isClimateSoilMoisture ? 2 : 0,
                  maximumFractionDigits: isClimateSoilMoisture ? 2 : 1,
                })
              : '—';

          return (
            <div
              className={`tp-home-general-metric ${
                layer === 'climate' ? 'is-climate' : ''
              }`}
            >
              <div className="tp-home-general-metric-head">
                <span>{layer === 'climate' ? 'Bölgesel Model' : 'Tarla Geneli'}</span>
                <strong>{guide.title}</strong>
              </div>

              <div className="tp-home-general-metric-value">
                <strong>{formattedValue}</strong>
                {!staleAgroMetric &&
                  !staleClimateMetric &&
                  spatialSummary.displayUnit && (
                    <span>{spatialSummary.displayUnit}</span>
                  )}
                {isClimateSoilMoisture &&
                  spatialSummary.displayValue != null &&
                  Number.isFinite(Number(spatialSummary.displayValue)) && (
                    <em className="tp-home-general-metric-percent">
                      ≈ %{Math.round(Number(spatialSummary.displayValue) * 100)}
                    </em>
                  )}
              </div>

              <small>{spatialSummary.displayLabel ?? spatialSummary.message}</small>

              {layer === 'climate' && spatialSummary.displayMeta && (
                <div className="tp-home-metric-explainer">
                  <b>Kaynak</b>
                  <span>{spatialSummary.displayMeta}</span>
                </div>
              )}

              {layer === 'climate' && climateLayer === 'soil-moisture' && (
                <div className="tp-home-metric-note">
                  Bölgesel model verisidir · tarla sensörü ölçümü değildir.
                </div>
              )}

              {layer === 'evapotranspiration' &&
                spatialSummary.displayValue != null && (
                  <div className="tp-home-metric-explainer">
                    ≈{' '}
                    {(Number(spatialSummary.displayValue) / 7).toLocaleString('tr-TR', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    mm/gün referans ET₀. Bu değer doğrudan sulama miktarı değildir.
                  </div>
                )}

              {layer === 'rainfall-history' &&
                spatialSummary.displayValue != null && (
                  <div className="tp-home-metric-explainer">
                    1 mm yağış = 1 L/m² su. Bu değer son 30 günün toplamıdır.
                  </div>
                )}

              {staleAgroMetric && (
                <div className="tp-home-metric-error">
                  Önceki katmana ait eski ölçüm gösterilmedi; güncel veri yenileniyor.
                </div>
              )}

              <p>
                Model çözünürlüğü parsel içindeki küçük farkları güvenilir biçimde ayırmaz.
              </p>
            </div>
          );
        }

        if (layer === 'vegetation') {
          return null;
        }

        return (
          <div
            className={`tp-real-home-legend tp-home-legend-${layer}${
              layer === 'soil' ? ` tp-home-legend-soil-${soilProperty}` : ''
            }${
              layer === 'climate' ? ` tp-home-legend-climate-${climateLayer}` : ''
            }`}
          >
            <strong>{guide.title}</strong>

            <div
              className="tp-gradient"
              style={{ background: guide.legendGradient }}
            />

            <div className="tp-legend-label">
              {guide.legend.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        );
      })()}

      {layer !== 'vegetation' && loading && (
        <div className="tp-home-map-loading">Katman hazırlanıyor…</div>
      )}

      {layer === 'climate' &&
        !loading &&
        !(climateCellsKey === climateCacheKey && climateCells.length) && (
        <div className="tp-home-map-loading">
          İklim verisi şu anda alınamadı.
        </div>
      )}

      {agroLayer &&
        !loading &&
        !(agroCellsKey === agroCacheKey && agroCells.length) && (
        <div className="tp-home-map-loading">
          {HOME_AGRO_LAYER_LABELS[agroLayer]} verisi şu anda alınamadı.
        </div>
      )}

      {layer === 'soil' &&
        soilProfileLoading &&
        !(soilProfileKey === soilProfileCacheKey && soilProfile) && (
        <div className="tp-home-map-loading">Toprak tahmini hazırlanıyor…</div>
      )}

      {layer === 'soil' &&
        !soilProfileLoading &&
        soilProfileError &&
        !(clippedSoilImageKey === soilCacheKey && clippedSoilImage) && (
        <div className="tp-home-map-loading">{soilProfileError}</div>
      )}

      {layer === 'soil' && soilLoadError && (
        <div className="tp-home-map-loading">{soilLoadError}</div>
      )}
    </div>
  );
}

