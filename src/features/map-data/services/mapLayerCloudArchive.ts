import { supabase } from '../../../supabaseClient';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import type {
  Sentinel1RadarResponse,
  Sentinel1RadarScene,
} from '../../../services/sentinel1Service';
import type { EarthSearchNdviStats } from '../../home-map/services/earthSearchNdvi.service';
import {
  listMapLayerArchiveEntries,
  type MapLayerArchiveEntry,
} from './mapLayerArchive';

const CLOUD_ARCHIVE_NAMESPACE = 'pdf-layer-archive-v1';
const CLOUD_ARCHIVE_SCHEMA_VERSION = 1;
const CLOUD_ARCHIVE_RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CloudLayerSnapshot = {
  schemaVersion: number;
  fieldId: string;
  layer: string;
  source: string;
  observedAt: string | null;
  processingVersion: string;
  metrics: Record<string, number | null>;
  details?: Record<string, unknown>;
  archivedAt: string;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOnly(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function fieldIdFromScope(scope: string) {
  const candidate = String(scope ?? '').split(':')[0] ?? '';
  return UUID_RE.test(candidate) ? candidate : null;
}

function compactValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value ?? null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return '';
    if (
      text.startsWith('data:image/') ||
      text.startsWith('blob:') ||
      text.length > 1200
    ) {
      return undefined;
    }
    return text;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .map((item) => compactValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const blocked = new Set([
      'imageDataUrl',
      'ndviImage',
      'trueColorImage',
      'image',
      'png',
      'blob',
      'raw',
    ]);

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key))
      .slice(0, 80)
      .map(([key, item]) => [key, compactValue(item, depth + 1)] as const)
      .filter(([, item]) => item !== undefined);

    return Object.fromEntries(entries);
  }

  return undefined;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function upsertCloudSnapshot(snapshot: CloudLayerSnapshot) {
  if (!UUID_RE.test(snapshot.fieldId)) return false;

  const userId = await currentUserId();
  if (!userId) return false;

  const now = new Date();
  const observedDate = dateOnly(snapshot.observedAt);
  const identity = String(snapshot.details?.sceneId ?? '').trim().slice(0, 120);
  const sourceKey = [
    snapshot.layer,
    observedDate ?? 'undated',
    identity || 'scene',
    snapshot.processingVersion,
  ].join(':');
  const cacheKey = [snapshot.fieldId, sourceKey].join(':');

  const { error } = await supabase
    .from('field_map_layer_cache')
    .upsert(
      {
        user_id: userId,
        field_id: snapshot.fieldId,
        namespace: CLOUD_ARCHIVE_NAMESPACE,
        cache_key: cacheKey,
        payload: snapshot,
        data_date: observedDate,
        source_key: sourceKey,
        saved_at: now.toISOString(),
        expires_at: new Date(
          now.getTime() + CLOUD_ARCHIVE_RETENTION_MS,
        ).toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id,field_id,namespace,cache_key' },
    );

  if (error) {
    console.warn('Katman arşivi buluta aynalanamadı:', error.message);
    return false;
  }

  return true;
}

export async function mirrorSatelliteHistorySnapshot(
  scope: string,
  date: string,
  data: SatelliteHealthResult,
  processingVersion: string,
) {
  const fieldId = fieldIdFromScope(scope);
  if (!fieldId) return false;

  return upsertCloudSnapshot({
    schemaVersion: CLOUD_ARCHIVE_SCHEMA_VERSION,
    fieldId,
    layer: 'sentinel2',
    source: String(data.source ?? 'Sentinel-2'),
    observedAt: dateOnly(date) ?? dateOnly(data.latestImageDate),
    processingVersion,
    metrics: {
      ndvi: finiteNumber(data.ndviAverage),
      ndviMin: finiteNumber(data.ndviMin),
      ndviMax: finiteNumber(data.ndviMax),
      ndmi: finiteNumber(data.ndmiAverage),
      ndre: finiteNumber(data.ndreAverage),
      savi: finiteNumber(data.saviAverage),
      gndvi: finiteNumber(data.gndviAverage),
      highPercent: finiteNumber(data.healthyPercent),
      mediumPercent: finiteNumber(data.warningPercent),
      lowPercent: finiteNumber(data.stressedPercent),
    },
    details: {
      status: data.status ?? null,
      statusLabel: data.statusLabel ?? null,
      latestImageDate: data.latestImageDate ?? null,
      generatedAt: data.generatedAt ?? null,
    },
    archivedAt: new Date().toISOString(),
  });
}

export async function mirrorRadarHistorySnapshot(
  scope: string,
  scene: Sentinel1RadarScene,
  data: Sentinel1RadarResponse,
  processingVersion: string,
) {
  const fieldId = fieldIdFromScope(scope);
  if (!fieldId) return false;

  return upsertCloudSnapshot({
    schemaVersion: CLOUD_ARCHIVE_SCHEMA_VERSION,
    fieldId,
    layer: `sentinel1-${data.mode}`,
    source: data.source ?? 'Copernicus Sentinel-1 GRD',
    observedAt: dateOnly(scene.date ?? scene.datetime ?? data.dataDate),
    processingVersion,
    metrics: {
      mean: finiteNumber(data.stats?.mean),
      min: finiteNumber(data.stats?.min),
      max: finiteNumber(data.stats?.max),
      stDev: finiteNumber(data.stats?.stDev),
      sampleCount: finiteNumber(data.stats?.sampleCount),
      noDataCount: finiteNumber(data.stats?.noDataCount),
    },
    details: {
      unit: data.stats?.unit ?? null,
      metric: data.stats?.metric ?? null,
      sceneId: scene.id,
      datetime: scene.datetime,
      orbitDirection: scene.orbitDirection ?? null,
      relativeOrbit: scene.relativeOrbit ?? null,
      polarization: scene.polarization ?? null,
      instrumentMode: scene.instrumentMode ?? null,
    },
    archivedAt: new Date().toISOString(),
  });
}

export async function mirrorEarthSearchNdviSnapshot(
  fieldId: string,
  data: EarthSearchNdviStats,
  processingVersion: string,
) {
  if (!UUID_RE.test(fieldId)) return false;

  return upsertCloudSnapshot({
    schemaVersion: CLOUD_ARCHIVE_SCHEMA_VERSION,
    fieldId,
    layer: 'sentinel2-geoblaze',
    source: 'Earth Search / Sentinel-2',
    observedAt: dateOnly(data.datetime),
    processingVersion,
    metrics: {
      ndvi: finiteNumber(data.mean),
      ndviMedian: finiteNumber(data.median),
      ndviStdDev: finiteNumber(data.stdDev),
      ndviMin: finiteNumber(data.min),
      ndviMax: finiteNumber(data.max),
      highPercent: finiteNumber(data.healthyPercent),
      mediumPercent: finiteNumber(data.moderatePercent),
      lowPercent: finiteNumber(data.stressedPercent),
      sampleCount: finiteNumber(data.sampleCount),
      cloudCover: finiteNumber(data.cloudCover),
    },
    details: {
      sceneId: data.sceneId,
      datetime: data.datetime,
      engine: data.engine,
      relativeThreshold: data.relativeThreshold,
      relativeZones: compactValue(data.relativeZones),
    },
    archivedAt: new Date().toISOString(),
  });
}

async function mirrorGenericLocalEntry(
  fieldId: string,
  entry: MapLayerArchiveEntry<unknown>,
) {
  const compact = compactValue(entry.data);
  if (!compact || typeof compact !== 'object') return false;

  const object = compact as Record<string, unknown>;
  const observedAt =
    dateOnly(object.dataDate) ??
    dateOnly(object.latestImageDate) ??
    dateOnly((object.timeRange as any)?.from) ??
    dateOnly(object.date) ??
    null;

  return upsertCloudSnapshot({
    schemaVersion: CLOUD_ARCHIVE_SCHEMA_VERSION,
    fieldId,
    layer: `cached:${entry.namespace}`,
    source: String(object.source ?? object.provider ?? entry.namespace),
    observedAt,
    processingVersion: entry.processingVersion,
    metrics: {},
    details: {
      cacheKey: entry.key,
      data: compact,
    },
    archivedAt: new Date().toISOString(),
  });
}

/**
 * PDF isteğinden hemen önce cihazdaki mevcut gerçek kayıtları buluta taşır.
 * Böylece bu özellik kurulduktan önce telefona indirilmiş sahneler de PDF worker
 * tarafından kullanılabilir.
 */
export async function syncFieldLocalLayerArchiveToCloud(fieldId: string) {
  if (!UUID_RE.test(fieldId)) return { scanned: 0, mirrored: 0 };

  const entries = await listMapLayerArchiveEntries();
  const relevant = entries.filter((entry) => {
    const localKey = String(entry.key ?? '');
    return localKey.startsWith(`${entry.namespace}:${fieldId}:`);
  });

  const tasks: Array<() => Promise<boolean>> = [];

  for (const entry of relevant.slice(0, 120)) {
    const localKey = String(entry.key).slice(`${entry.namespace}:`.length);

    if (entry.namespace === 'sentinel2-history' && localKey.includes(':full:')) {
      const date = localKey.split(':full:')[1]?.slice(0, 10) ?? '';
      if (date) {
        tasks.push(() =>
          mirrorSatelliteHistorySnapshot(
            localKey.split(':full:')[0],
            date,
            entry.data as SatelliteHealthResult,
            entry.processingVersion,
          ),
        );
      }
      continue;
    }

    if (entry.namespace === 'sentinel1-history' && localKey.includes(':scene:')) {
      const data = entry.data as Sentinel1RadarResponse;
      if (data?.scene?.datetime) {
        const scope = localKey.split(':scene:')[0];
        tasks.push(() =>
          mirrorRadarHistorySnapshot(
            scope,
            data.scene,
            data,
            entry.processingVersion,
          ),
        );
      }
      continue;
    }

    if (entry.namespace === 'sentinel2-geoblaze') {
      const data = entry.data as EarthSearchNdviStats;
      if (data?.datetime && Number.isFinite(Number(data.mean))) {
        tasks.push(() =>
          mirrorEarthSearchNdviSnapshot(
            fieldId,
            data,
            entry.processingVersion,
          ),
        );
      }
      continue;
    }

    if (entry.namespace.startsWith('home-map-current:')) {
      tasks.push(() => mirrorGenericLocalEntry(fieldId, entry));
    }
  }

  let nextTask = 0;
  let mirrored = 0;

  async function worker() {
    while (nextTask < tasks.length) {
      const index = nextTask;
      nextTask += 1;
      try {
        if (await tasks[index]()) mirrored += 1;
      } catch (error) {
        console.warn('Katman arşivi toplu aynalama kaydı atlandı:', error);
      }
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);

  return { scanned: relevant.length, mirrored };
}

export const PDF_LAYER_ARCHIVE_NAMESPACE = CLOUD_ARCHIVE_NAMESPACE;
