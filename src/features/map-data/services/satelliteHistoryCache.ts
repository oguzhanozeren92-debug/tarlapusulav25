import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import { mirrorSatelliteHistorySnapshot } from './mapLayerCloudArchive';
import {
  mapLayerArchiveIsFresh,
  mapLayerStableHash,
  readMapLayerArchive,
  requestMapLayerPersistentStorage,
  writeMapLayerArchive,
} from './mapLayerArchive';

/** Sentinel-2 tarihli sahneler sabittir; yalnız uygulamanın işleme sürümü değişirse yenilenir. */
export const SATELLITE_HISTORY_PROCESSING_VERSION = 's2-history-v3';
const SATELLITE_HISTORY_NAMESPACE = 'sentinel2-history';

export const SATELLITE_HISTORY_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type SatelliteHistoryListCache = {
  dates: string[];
  syncedAt: number;
};

export function satelliteHistoryScope(input: {
  fieldId: string;
  geometry: unknown;
}) {
  return [input.fieldId, mapLayerStableHash(input.geometry ?? null)].join(':');
}

export async function readSatelliteHistoryList(scope: string) {
  return readMapLayerArchive<SatelliteHistoryListCache>({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:date-list`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
  });
}

export async function writeSatelliteHistoryList(
  scope: string,
  value: SatelliteHistoryListCache,
) {
  await writeMapLayerArchive({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:date-list`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
    data: value,
  });
}

export async function readSatelliteHistoryPreview(
  scope: string,
  date: string,
) {
  return readMapLayerArchive<string>({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:preview:${date}`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
  });
}

export async function writeSatelliteHistoryPreview(
  scope: string,
  date: string,
  image: string,
) {
  await writeMapLayerArchive({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:preview:${date}`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
    data: image,
  });
}

export async function readSatelliteHistoryData(
  scope: string,
  date: string,
) {
  return readMapLayerArchive<SatelliteHealthResult>({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:full:${date}`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
  });
}

export async function writeSatelliteHistoryData(
  scope: string,
  date: string,
  data: SatelliteHealthResult,
) {
  await writeMapLayerArchive({
    namespace: SATELLITE_HISTORY_NAMESPACE,
    key: `${scope}:full:${date}`,
    processingVersion: SATELLITE_HISTORY_PROCESSING_VERSION,
    data,
  });

  void mirrorSatelliteHistorySnapshot(
    scope,
    date,
    data,
    SATELLITE_HISTORY_PROCESSING_VERSION,
  );

  if (data.ndviImage) {
    await writeSatelliteHistoryPreview(scope, date, data.ndviImage);
  }
}

export function satelliteHistoryCacheIsFresh(
  cached: SatelliteHistoryListCache | null,
  now = Date.now(),
) {
  return mapLayerArchiveIsFresh(
    cached?.syncedAt,
    SATELLITE_HISTORY_SYNC_INTERVAL_MS,
    now,
  );
}

export function mergeSatelliteHistoryDates(
  fresh: string[],
  cached: string[],
) {
  return [...new Set([...fresh, ...cached].filter(Boolean))].sort((a, b) =>
    b.localeCompare(a),
  );
}

export const requestSatelliteHistoryPersistentStorage =
  requestMapLayerPersistentStorage;
