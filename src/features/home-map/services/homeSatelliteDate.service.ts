import { findLatestSentinel2Scene, type Position } from '../../../services/earthSearchService';

type GeometryLike = {
  type?: string;
  coordinates?: unknown;
  geometry?: GeometryLike | null;
};

export type HomeSatelliteSceneInfo = {
  latestImageDate: string;
  cloudCover: number | null;
  collection: string;
  sceneId: string;
  redUrl: string | null;
  nirUrl: string | null;
  parcelRing: Position[];
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
  const ring = value.filter(isPosition);
  return ring.length >= 3 ? ring : null;
}

export function getHomeFieldExteriorRing(source: unknown): Position[] | null {
  if (!source) return null;

  if (Array.isArray(source)) {
    const direct = asRing(source);
    if (direct) return direct;

    const polygon = source[0];
    if (Array.isArray(polygon)) {
      const ring = asRing(polygon);
      if (ring) return ring;
      return asRing(polygon[0]);
    }
    return null;
  }

  if (typeof source !== 'object') return null;
  const value = source as GeometryLike;
  const geometry = value.type === 'Feature' ? value.geometry : value;
  if (!geometry) return null;

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return asRing(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    const firstPolygon = geometry.coordinates[0];
    return Array.isArray(firstPolygon) ? asRing(firstPolygon[0]) : null;
  }

  return null;
}

/**
 * Returns metadata and analysis assets for the newest sufficiently clear
 * Sentinel-2 L2A scene intersecting the selected parcel.
 */
export async function fetchHomeSatelliteScene(
  parcelGeometry: unknown,
): Promise<HomeSatelliteSceneInfo | null> {
  const ring = getHomeFieldExteriorRing(parcelGeometry);
  if (!ring) return null;

  const scene = await findLatestSentinel2Scene({
    ring,
    daysBack: 60,
    maxCloudCover: 30,
  });

  if (!scene) return null;

  return {
    latestImageDate: String(scene.datetime ?? '').trim(),
    cloudCover:
      scene.cloudCover != null && Number.isFinite(Number(scene.cloudCover))
        ? Number(scene.cloudCover)
        : null,
    collection: String(scene.collection ?? 'sentinel-2-l2a'),
    sceneId: String(scene.id ?? ''),
    redUrl: scene.redUrl,
    nirUrl: scene.nirUrl,
    parcelRing: ring,
  };
}

/** Backwards-compatible date-only helper. */
export async function fetchHomeSatelliteDate(parcelGeometry: unknown) {
  const scene = await fetchHomeSatelliteScene(parcelGeometry);
  return scene?.latestImageDate ?? '';
}
