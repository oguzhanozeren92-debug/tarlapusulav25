import { useEffect, useState } from 'react';
import {
  findLatestSentinel2Scene,
  type Position,
} from '../../../services/earthSearchService';
import {
  analyzeEarthSearchSceneNdvi,
  type EarthSearchNdviStats,
} from '../services/earthSearchNdvi.service';
import { mirrorEarthSearchNdviSnapshot } from '../../map-data/services/mapLayerCloudArchive';
import {
  mapLayerStableHash,
  readMapLayerArchive,
  writeMapLayerArchive,
} from '../../map-data/services/mapLayerArchive';

type State = {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  data: EarthSearchNdviStats | null;
  error: string | null;
};

const GEOBLAZE_CACHE_VERSION = 'earth-search-ndvi-v2';
const GEOBLAZE_CACHE_NAMESPACE = 'sentinel2-geoblaze';
const LATEST_TTL_MS = 12 * 60 * 60 * 1000;

function getRing(source: any): Position[] | null {
  if (!source) return null;
  const geometry = source?.type === 'Feature' ? source.geometry : source;
  const coordinates = geometry?.coordinates ?? geometry;
  if (geometry?.type === 'Polygon' && Array.isArray(coordinates?.[0])) {
    return coordinates[0] as Position[];
  }
  if (
    geometry?.type === 'MultiPolygon' &&
    Array.isArray(coordinates?.[0]?.[0])
  ) {
    return coordinates[0][0] as Position[];
  }
  if (
    Array.isArray(coordinates) &&
    Array.isArray(coordinates[0]) &&
    typeof coordinates[0][0] === 'number'
  ) {
    return coordinates as Position[];
  }
  if (
    Array.isArray(coordinates?.[0]) &&
    Array.isArray(coordinates[0][0]) &&
    typeof coordinates[0][0][0] === 'number'
  ) {
    return coordinates[0] as Position[];
  }
  return null;
}

export function useEarthSearchNdvi({
  fieldKey,
  parcelGeometry,
  imageDate,
  enabled = true,
}: {
  fieldKey: string;
  parcelGeometry?: unknown;
  /** Render edilen Sentinel görüntüsünün tarihi. */
  imageDate?: string | null;
  enabled?: boolean;
}) {
  const [state, setState] = useState<State>({
    status: 'idle',
    data: null,
    error: null,
  });

  useEffect(() => {
    const ring = getRing(parcelGeometry);
    if (!enabled || !fieldKey || !ring?.length) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }

    const controller = new AbortController();
    let alive = true;
    const fixedDate = String(imageDate ?? '').trim();
    const cacheKey = [
      fieldKey,
      fixedDate || 'latest',
      mapLayerStableHash(ring),
    ].join(':');

    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      const cached = await readMapLayerArchive<EarthSearchNdviStats>({
        namespace: GEOBLAZE_CACHE_NAMESPACE,
        key: cacheKey,
        processingVersion: GEOBLAZE_CACHE_VERSION,
        // Tarihi belli bir Sentinel sahnesi değişmez. "latest" ise yeni sahne
        // çıkabileceği için 12 saatte bir yeniden kontrol edilir.
        ttlMs: fixedDate ? null : LATEST_TTL_MS,
      });

      if (!alive) return;
      if (cached) {
        void mirrorEarthSearchNdviSnapshot(
          fieldKey,
          cached,
          GEOBLAZE_CACHE_VERSION,
        );
        setState({ status: 'ready', data: cached, error: null });
        return;
      }

      const scene = await findLatestSentinel2Scene({
        ring,
        daysBack: 60,
        maxCloudCover: 30,
        date: fixedDate || undefined,
        signal: controller.signal,
      });

      if (!scene) {
        if (alive) setState({ status: 'empty', data: null, error: null });
        return;
      }

      const data = await analyzeEarthSearchSceneNdvi(scene, ring);
      if (!alive) return;

      if (!data) {
        setState({ status: 'empty', data: null, error: null });
        return;
      }

      await writeMapLayerArchive({
        namespace: GEOBLAZE_CACHE_NAMESPACE,
        key: cacheKey,
        processingVersion: GEOBLAZE_CACHE_VERSION,
        data,
        ttlMs: fixedDate ? null : LATEST_TTL_MS,
      });

      void mirrorEarthSearchNdviSnapshot(
        fieldKey,
        data,
        GEOBLAZE_CACHE_VERSION,
      );

      if (alive) {
        setState({ status: 'ready', data, error: null });
      }
    })().catch((error) => {
      if (!alive || controller.signal.aborted) return;
      console.warn('Earth Search NDVI analizi alınamadı:', error);
      setState({
        status: 'error',
        data: null,
        error:
          error instanceof Error ? error.message : 'NDVI analizi alınamadı.',
      });
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [enabled, fieldKey, parcelGeometry, imageDate]);

  return state;
}
