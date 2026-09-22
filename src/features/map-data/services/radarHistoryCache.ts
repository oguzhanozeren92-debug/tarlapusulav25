import type {
  Sentinel1RadarMode,
  Sentinel1RadarResponse,
  Sentinel1RadarScene,
} from '../../../services/sentinel1Service';
import { mirrorRadarHistorySnapshot } from './mapLayerCloudArchive';
import {
  mapLayerArchiveIsFresh,
  mapLayerStableHash,
  readMapLayerArchive,
  requestMapLayerPersistentStorage,
  writeMapLayerArchive,
} from './mapLayerArchive';

/**
 * Sentinel-1 geçmiş sahneleri değişmez. Görüntü + hesap sonucu bir kez alınır,
 * cihaz arşivine kalıcı yazılır. Sadece processingVersion değişirse yeniden alınır.
 */
export const RADAR_HISTORY_PROCESSING_VERSION = 's1-history-v8-water-area';
const RADAR_HISTORY_NAMESPACE = 'sentinel1-history';

export const RADAR_HISTORY_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const RADAR_HISTORY_WINDOW_DAYS = 180;

export type RadarHistoryListCache = {
  scenes: Sentinel1RadarScene[];
  comparisonBasis: string | null;
  syncedAt: number;
};

export function radarHistoryScope(input: {
  fieldId: string;
  mode: Sentinel1RadarMode;
  latitude: number;
  longitude: number;
  radiusKm: number;
  geometry?: unknown;
}) {
  const hasGeometry = Boolean(input.geometry);

  /*
   * Parsel geometrisi varken cache anahtarı artık radiusKm'ye bağlı değil.
   * Radar görseli parsel bbox'ına göre üretildiği için kullanıcı arayüzündeki
   * zoom/radius ayarı değişse bile aynı tarihi yeniden indirmiyoruz.
   */
  return [
    input.fieldId,
    input.mode,
    hasGeometry ? 'parcel' : input.latitude.toFixed(5),
    hasGeometry ? mapLayerStableHash(input.geometry) : input.longitude.toFixed(5),
    hasGeometry ? 'stable' : input.radiusKm.toFixed(2),
  ].join(':');
}

function sceneKey(scene: Sentinel1RadarScene) {
  return [
    scene.id || scene.datetime,
    scene.datetime,
    scene.orbitDirection ?? 'orbit',
    scene.relativeOrbit ?? 'rel',
  ].join(':');
}

export async function readRadarHistoryList(scope: string) {
  return readMapLayerArchive<RadarHistoryListCache>({
    namespace: RADAR_HISTORY_NAMESPACE,
    key: `${scope}:scene-list`,
    processingVersion: RADAR_HISTORY_PROCESSING_VERSION,
  });
}

export async function writeRadarHistoryList(
  scope: string,
  value: RadarHistoryListCache,
) {
  await writeMapLayerArchive({
    namespace: RADAR_HISTORY_NAMESPACE,
    key: `${scope}:scene-list`,
    processingVersion: RADAR_HISTORY_PROCESSING_VERSION,
    data: value,
  });
}

export async function readRadarHistorySceneData(
  scope: string,
  scene: Sentinel1RadarScene,
) {
  return readMapLayerArchive<Sentinel1RadarResponse>({
    namespace: RADAR_HISTORY_NAMESPACE,
    key: `${scope}:scene:${sceneKey(scene)}`,
    processingVersion: RADAR_HISTORY_PROCESSING_VERSION,
  });
}

export async function writeRadarHistorySceneData(
  scope: string,
  scene: Sentinel1RadarScene,
  value: Sentinel1RadarResponse,
) {
  await writeMapLayerArchive({
    namespace: RADAR_HISTORY_NAMESPACE,
    key: `${scope}:scene:${sceneKey(scene)}`,
    processingVersion: RADAR_HISTORY_PROCESSING_VERSION,
    data: value,
  });

  void mirrorRadarHistorySnapshot(
    scope,
    scene,
    value,
    RADAR_HISTORY_PROCESSING_VERSION,
  );
}

export function radarHistoryCacheIsFresh(
  cached: RadarHistoryListCache | null,
  now = Date.now(),
) {
  return mapLayerArchiveIsFresh(
    cached?.syncedAt,
    RADAR_HISTORY_SYNC_INTERVAL_MS,
    now,
  );
}

export function radarHistoryIncrementalDays(
  scenes: Sentinel1RadarScene[],
  now = Date.now(),
) {
  const newest = scenes
    .map((scene) => new Date(scene.datetime).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!Number.isFinite(newest)) return RADAR_HISTORY_WINDOW_DAYS;

  const elapsedDays = Math.max(
    0,
    Math.ceil((now - newest) / (24 * 60 * 60 * 1000)),
  );

  return Math.min(
    RADAR_HISTORY_WINDOW_DAYS,
    Math.max(14, elapsedDays + 10),
  );
}

function sameComparablePass(
  reference: Sentinel1RadarScene,
  scene: Sentinel1RadarScene,
) {
  if (
    reference.orbitDirection &&
    scene.orbitDirection &&
    reference.orbitDirection !== scene.orbitDirection
  ) {
    return false;
  }

  if (
    reference.relativeOrbit != null &&
    scene.relativeOrbit != null &&
    reference.relativeOrbit !== scene.relativeOrbit
  ) {
    return false;
  }

  if (
    reference.instrumentMode &&
    scene.instrumentMode &&
    reference.instrumentMode !== scene.instrumentMode
  ) {
    return false;
  }

  return true;
}

export function mergeRadarHistoryScenes(
  fresh: Sentinel1RadarScene[],
  cached: Sentinel1RadarScene[],
  now = Date.now(),
) {
  const reference = fresh[0] ?? cached[0] ?? null;
  const cutoff = now - RADAR_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();

  return [...fresh, ...cached]
    .filter((scene) => {
      const time = new Date(scene.datetime).getTime();
      if (!Number.isFinite(time) || time < cutoff) return false;
      if (reference && !sameComparablePass(reference, scene)) return false;

      const key = sceneKey(scene);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
    )
    .slice(0, 32);
}

export const requestRadarHistoryPersistentStorage =
  requestMapLayerPersistentStorage;
