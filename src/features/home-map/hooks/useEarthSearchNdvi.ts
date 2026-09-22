import { useEffect, useState } from 'react';
import { findLatestSentinel2Scene, type Position } from '../../../services/earthSearchService';
import { analyzeEarthSearchSceneNdvi, type EarthSearchNdviStats } from '../services/earthSearchNdvi.service';

type State = {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  data: EarthSearchNdviStats | null;
  error: string | null;
};

function getRing(source: any): Position[] | null {
  if (!source) return null;
  const geometry = source?.type === 'Feature' ? source.geometry : source;
  const coordinates = geometry?.coordinates ?? geometry;
  if (geometry?.type === 'Polygon' && Array.isArray(coordinates?.[0])) return coordinates[0] as Position[];
  if (geometry?.type === 'MultiPolygon' && Array.isArray(coordinates?.[0]?.[0])) return coordinates[0][0] as Position[];
  if (Array.isArray(coordinates) && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') return coordinates as Position[];
  if (Array.isArray(coordinates?.[0]) && Array.isArray(coordinates[0][0]) && typeof coordinates[0][0][0] === 'number') return coordinates[0] as Position[];
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
  const [state, setState] = useState<State>({ status: 'idle', data: null, error: null });

  useEffect(() => {
    const ring = getRing(parcelGeometry);
    if (!enabled || !fieldKey || !ring?.length) {
      setState({ status: 'idle', data: null, error: null });
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setState({ status: 'loading', data: null, error: null });

    void findLatestSentinel2Scene({
      ring,
      daysBack: 60,
      maxCloudCover: 30,
      date: imageDate || undefined,
      signal: controller.signal,
    })
      .then(async (scene) => {
        if (!scene) return null;
        return analyzeEarthSearchSceneNdvi(scene, ring);
      })
      .then((data) => {
        if (!alive) return;
        setState(data ? { status: 'ready', data, error: null } : { status: 'empty', data: null, error: null });
      })
      .catch((error) => {
        if (!alive || controller.signal.aborted) return;
        console.warn('Earth Search NDVI analizi alınamadı:', error);
        setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'NDVI analizi alınamadı.' });
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [enabled, fieldKey, parcelGeometry, imageDate]);

  return state;
}
