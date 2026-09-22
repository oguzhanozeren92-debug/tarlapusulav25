import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchSentinel1Radar,
  listSentinel1RadarScenes,
  type Sentinel1RadarMode,
  type Sentinel1RadarResponse,
  type Sentinel1RadarScene,
} from '../../../services/sentinel1Service';
import {
  RADAR_HISTORY_WINDOW_DAYS,
  mergeRadarHistoryScenes,
  radarHistoryCacheIsFresh,
  radarHistoryIncrementalDays,
  radarHistoryScope,
  readRadarHistoryList,
  readRadarHistorySceneData,
  requestRadarHistoryPersistentStorage,
  writeRadarHistoryList,
  writeRadarHistorySceneData,
} from '../services/radarHistoryCache';

type Input = {
  fieldId?: string;
  latitude: number;
  longitude: number;
  geometry?: unknown;
  mode: Sentinel1RadarMode | null;
  radiusKm?: number;
  currentData?: Sentinel1RadarResponse | null;
};

const PREFETCH_SCENE_COUNT = 6;

export function useRadarHistory({
  fieldId,
  latitude,
  longitude,
  geometry,
  mode,
  radiusKm = 3.5,
  currentData = null,
}: Input) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Sentinel1RadarScene[]>([]);
  const [comparisonBasis, setComparisonBasis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    fieldId: string;
    mode: Sentinel1RadarMode;
    scene: Sentinel1RadarScene;
    data: Sentinel1RadarResponse;
  } | null>(null);

  const requestId = useRef(0);
  const memoryCache = useRef(new Map<string, Sentinel1RadarResponse>());
  const inflightCache = useRef(
    new Map<string, Promise<Sentinel1RadarResponse | null>>(),
  );
  const prefetchedScopes = useRef(new Set<string>());

  const persistentScope = useMemo(() => {
    if (
      !fieldId ||
      !mode ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return radarHistoryScope({
      fieldId,
      mode,
      latitude,
      longitude,
      radiusKm,
      geometry,
    });
  }, [fieldId, geometry, latitude, longitude, mode, radiusKm]);

  const sceneMemoryKey = useCallback(
    (scene: Sentinel1RadarScene) =>
      persistentScope
        ? `${persistentScope}:${scene.id}:${scene.datetime}`
        : `${scene.id}:${scene.datetime}`,
    [persistentScope],
  );

  useEffect(() => {
    requestId.current += 1;
    setOpen(false);
    setScenes([]);
    setComparisonBasis(null);
    setLoading(false);
    setError(null);
    setSelection(null);
    memoryCache.current.clear();
    inflightCache.current.clear();

    if (!persistentScope) return;

    let active = true;

    void readRadarHistoryList(persistentScope).then((cached) => {
      if (!active || !cached) return;
      setScenes(cached.scenes);
      setComparisonBasis(cached.comparisonBasis ?? null);
    });

    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [persistentScope]);

  /*
   * Ana haritada zaten indirilmiş olan güncel Sentinel-1 görüntüsünü tarih
   * ekranının cihaz cache'ine de seed ediyoruz. Böylece aynı güncel sahneyi
   * geçmiş ekranı tekrar indirmez.
   */
  useEffect(() => {
    if (!persistentScope || !currentData?.scene || !mode) return;
    if (currentData.mode !== mode) return;

    const key = sceneMemoryKey(currentData.scene);
    memoryCache.current.set(key, currentData);
    void writeRadarHistorySceneData(
      persistentScope,
      currentData.scene,
      currentData,
    );
  }, [currentData, mode, persistentScope, sceneMemoryKey]);

  const readSceneCache = useCallback(
    async (scene: Sentinel1RadarScene) => {
      if (!persistentScope) return null;

      const key = sceneMemoryKey(scene);
      const memory = memoryCache.current.get(key);
      if (memory) return memory;

      const persisted = await readRadarHistorySceneData(
        persistentScope,
        scene,
      );

      if (persisted) {
        memoryCache.current.set(key, persisted);
        return persisted;
      }

      return null;
    }, [persistentScope, sceneMemoryKey],
  );

  const getSceneData = useCallback(
    async (scene: Sentinel1RadarScene) => {
      if (!fieldId || !mode || !persistentScope) return null;

      const cached = await readSceneCache(scene);
      if (cached) return cached;

      const key = sceneMemoryKey(scene);
      const inflight = inflightCache.current.get(key);
      if (inflight) return inflight;

      const pending = (async () => {
        const result = await fetchSentinel1Radar(latitude, longitude, {
          mode,
          days: RADAR_HISTORY_WINDOW_DAYS,
          radiusKm,
          geometry,
          sceneDatetime: scene.datetime,
          orbitDirection: scene.orbitDirection,
          relativeOrbit: scene.relativeOrbit,
        });

        memoryCache.current.set(key, result);
        await writeRadarHistorySceneData(persistentScope, scene, result);
        return result;
      })();

      inflightCache.current.set(key, pending);

      try {
        return await pending;
      } finally {
        inflightCache.current.delete(key);
      }
    }, [
      fieldId,
      geometry,
      latitude,
      longitude,
      mode,
      persistentScope,
      radiusKm,
      readSceneCache,
      sceneMemoryKey,
    ],
  );

  const prefetchRecentScenes = useCallback(
    (items: Sentinel1RadarScene[]) => {
      if (!persistentScope || !items.length) return;

      const scopeKey = `${persistentScope}:${items[0]?.datetime ?? 'none'}`;
      if (prefetchedScopes.current.has(scopeKey)) return;
      prefetchedScopes.current.add(scopeKey);

      const queue = items.slice(0, PREFETCH_SCENE_COUNT);

      const run = async () => {
        for (const scene of queue) {
          try {
            await getSceneData(scene);
          } catch (caught) {
            console.warn('Radar geçmişi arka plan cache hazırlığı atlandı:', caught);
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 120);
          });
        }
      };

      window.setTimeout(() => {
        void run();
      }, 180);
    },
    [getSceneData, persistentScope],
  );

  useEffect(() => {
    if (!scenes.length || !persistentScope) return;
    prefetchRecentScenes(scenes);
  }, [persistentScope, prefetchRecentScenes, scenes]);

  const show = useCallback(async () => {
    setOpen(true);
    setError(null);

    if (!fieldId || !mode || !persistentScope) {
      setError('Radar geçmişi için aktif bir tarla ve radar katmanı gerekli.');
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Tarla koordinatı bulunamadı.');
      return;
    }

    void requestRadarHistoryPersistentStorage();

    const cached = await readRadarHistoryList(persistentScope);
    const cachedScenes = cached?.scenes ?? scenes;

    if (cached?.scenes.length) {
      setScenes(cached.scenes);
      setComparisonBasis(cached.comparisonBasis ?? null);
      prefetchRecentScenes(cached.scenes);
    }

    /*
     * Son 12 saatte tarih listesi senkronlandıysa sunucuya hiç gitme.
     * Kullanıcı tarih ekranını cihaz arşivinden anında görür.
     */
    if (radarHistoryCacheIsFresh(cached)) return;

    const id = ++requestId.current;
    const hasLocalHistory = cachedScenes.length > 0;

    if (!hasLocalHistory) setLoading(true);

    try {
      const days = hasLocalHistory
        ? radarHistoryIncrementalDays(cachedScenes)
        : RADAR_HISTORY_WINDOW_DAYS;

      const result = await listSentinel1RadarScenes(latitude, longitude, {
        mode,
        days,
        radiusKm,
        geometry,
      });

      if (id !== requestId.current) return;

      const merged = mergeRadarHistoryScenes(
        result.scenes,
        cachedScenes,
      );

      setScenes(merged);
      setComparisonBasis(result.comparisonBasis ?? cached?.comparisonBasis ?? null);

      /* Kullanıcı artık listeyi görebilsin; IndexedDB yazımı arka planda bitsin. */
      setLoading(false);

      void writeRadarHistoryList(persistentScope, {
        scenes: merged,
        comparisonBasis:
          result.comparisonBasis ?? cached?.comparisonBasis ?? null,
        syncedAt: Date.now(),
      });

      prefetchRecentScenes(merged);
    } catch (caught) {
      if (id !== requestId.current) return;

      if (hasLocalHistory) {
        console.warn('Radar geçmişi yenilik kontrolü yapılamadı:', caught);
        prefetchRecentScenes(cachedScenes);
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : 'Radar geçmişi alınamadı.',
      );
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [
    fieldId,
    geometry,
    latitude,
    longitude,
    mode,
    persistentScope,
    prefetchRecentScenes,
    radiusKm,
    scenes,
  ]);

  const select = useCallback(
    async (scene: Sentinel1RadarScene) => {
      if (!fieldId || !mode) return;

      const id = ++requestId.current;
      setError(null);

      try {
        /* Cache varsa loading göstermeden doğrudan ekrana bas. */
        const cached = await readSceneCache(scene);
        if (id !== requestId.current) return;

        if (cached) {
          setSelection({
            fieldId,
            mode,
            scene,
            data: cached,
          });
          setOpen(true);
          setLoading(false);
          return;
        }

        setLoading(true);
        const result = await getSceneData(scene);
        if (id !== requestId.current || !result) return;

        setSelection({
          fieldId,
          mode,
          scene,
          data: result,
        });
        setOpen(true);
      } catch (caught) {
        if (id === requestId.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Seçilen radar görüntüsü alınamadı.',
          );
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
        }
      }
    }, [fieldId, getSceneData, mode, readSceneCache],
  );

  const resetCurrent = useCallback(() => {
    requestId.current += 1;
    setSelection(null);
    setLoading(false);
    setError(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    requestId.current += 1;
    setOpen(false);
    setLoading(false);
  }, []);

  const data =
    selection?.fieldId === fieldId &&
    selection?.mode === mode
      ? selection.data
      : null;

  return {
    open,
    scenes,
    comparisonBasis,
    loading,
    error,
    show,
    select,
    close,
    resetCurrent,
    getSceneData,
    data,
    selectedScene: data ? selection?.scene ?? null : null,
  };
}
