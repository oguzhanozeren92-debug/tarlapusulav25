import type { Field } from '../types';
import {
  findLatestSentinel2Scene,
  findSentinel2Scenes,
  type EarthSearchScene,
  type Position,
} from './earthSearchService';

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
};

type GeoJsonFeature = {
  type?: string;
  geometry?: GeoJsonGeometry | null;
};

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function asRing(value: unknown): Position[] | null {
  if (!Array.isArray(value)) return null;
  const positions = value.filter(isPosition);
  return positions.length >= 3 ? positions : null;
}

/**
 * Converts the parcel geometry already stored on a Field into the exterior
 * polygon ring expected by Earth Search. Supports Polygon, MultiPolygon,
 * GeoJSON Feature wrappers and the raw coordinate arrays used by older rows.
 */
export function getFieldExteriorRing(field: Field): Position[] | null {
  const source = field.parcelGeometry as GeoJsonGeometry | GeoJsonFeature | unknown;
  if (!source) return null;

  const feature = source as GeoJsonFeature;
  const geometry = feature.type === 'Feature' ? feature.geometry : (source as GeoJsonGeometry);
  if (!geometry) return null;

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return asRing(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    const firstPolygon = geometry.coordinates[0];
    return Array.isArray(firstPolygon) ? asRing(firstPolygon[0]) : null;
  }

  // Compatibility for older records that stored only coordinates.
  if (Array.isArray(source)) {
    const direct = asRing(source);
    if (direct) return direct;
    const polygon = source[0];
    if (Array.isArray(polygon)) {
      const ring = asRing(polygon);
      if (ring) return ring;
      return asRing(polygon[0]);
    }
  }

  return null;
}

export function fieldHasSatelliteGeometry(field: Field): boolean {
  return getFieldExteriorRing(field) !== null;
}

export async function findLatestSceneForField(
  field: Field,
  options: {
    daysBack?: number;
    maxCloudCover?: number;
    signal?: AbortSignal;
  } = {},
): Promise<EarthSearchScene | null> {
  const ring = getFieldExteriorRing(field);
  if (!ring) return null;

  return findLatestSentinel2Scene({
    ring,
    daysBack: options.daysBack ?? 60,
    maxCloudCover: options.maxCloudCover ?? 30,
    signal: options.signal,
  });
}

export async function findScenesForField(
  field: Field,
  options: {
    daysBack?: number;
    maxCloudCover?: number;
    limit?: number;
    signal?: AbortSignal;
  } = {},
): Promise<EarthSearchScene[]> {
  const ring = getFieldExteriorRing(field);
  if (!ring) return [];

  return findSentinel2Scenes({
    ring,
    daysBack: options.daysBack ?? 60,
    maxCloudCover: options.maxCloudCover ?? 30,
    limit: options.limit ?? 12,
    signal: options.signal,
  });
}
