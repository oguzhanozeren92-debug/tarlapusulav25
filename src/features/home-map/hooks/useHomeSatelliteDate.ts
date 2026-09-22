import { useEffect, useState } from 'react';
import {
  fetchHomeSatelliteScene,
  type HomeSatelliteSceneInfo,
} from '../services/homeSatelliteDate.service';

declare global {
  interface Window {
    __tpHomeSatelliteSceneInfo?: HomeSatelliteSceneInfo | null;
  }
}

export function useHomeSatelliteSceneInfo({
  fieldKey,
  parcelGeometry,
}: {
  fieldKey: string;
  parcelGeometry?: unknown;
}) {
  const [sceneInfo, setSceneInfo] = useState<HomeSatelliteSceneInfo | null>(null);

  useEffect(() => {
    let alive = true;
    setSceneInfo(null);

    if (typeof window !== 'undefined') {
      window.__tpHomeSatelliteSceneInfo = null;
    }

    if (!fieldKey || !parcelGeometry) {
      return () => {
        alive = false;
      };
    }

    void fetchHomeSatelliteScene(parcelGeometry)
      .then((value) => {
        if (!alive) return;
        setSceneInfo(value);
        if (typeof window !== 'undefined') {
          window.__tpHomeSatelliteSceneInfo = value;
        }
      })
      .catch((error) => {
        console.warn('Sentinel-2 görüntü bilgisi alınamadı:', error);
      });

    return () => {
      alive = false;
    };
  }, [fieldKey, parcelGeometry]);

  return sceneInfo;
}

/**
 * Existing callers expect this hook to return a plain date string.
 * Keep that contract while Earth Search scene metadata is exposed separately.
 */
export function useHomeSatelliteDate({
  fieldKey,
  parcelGeometry,
  satelliteDate,
}: {
  fieldKey: string;
  parcelGeometry?: unknown;
  satelliteDate?: unknown;
}) {
  const sceneInfo = useHomeSatelliteSceneInfo({ fieldKey, parcelGeometry });
  return sceneInfo?.latestImageDate || String(satelliteDate ?? '').trim();
}
