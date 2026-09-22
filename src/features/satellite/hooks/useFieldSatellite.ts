import { useCallback, useRef, useState } from 'react';
import { analyzeFieldSatellite, type SatelliteHealthResult } from '../../../lib/satelliteService';
import type { Field, FieldSatelliteState } from '../../../types';
import { readFieldMapLayerCache, writeFieldMapLayerCache } from '../../home-map/services/fieldMapLayerCache';

const SATELLITE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SATELLITE_CACHE_NAMESPACE = 'satellite-analysis-v2';
type SavedSatellite = SatelliteHealthResult & { parcelSignature?: string };

function usable(data: SatelliteHealthResult | undefined | null): data is SavedSatellite {
  // The map can derive bounds from the parcel; older saved responses may omit bbox.
  return Boolean(data?.success && typeof data.ndviImage === 'string' && data.ndviImage.trim());
}

export function useFieldSatellite() {
  const [satelliteByField, setSatelliteByField] = useState<Record<string, FieldSatelliteState>>({});
  const stateRef = useRef(satelliteByField);
  const inflight = useRef(new Map<string, Promise<void>>());

  const loadFieldSatellite = useCallback(async (field: Field, force = false) => {
    const key = String(field.id);
    const signature = JSON.stringify(field.parcelGeometry?.geometry ?? field.parcelGeometry);
    const matches = (data: SavedSatellite | undefined | null) =>
      usable(data) && (!data.parcelSignature || data.parcelSignature === signature);
    const current = stateRef.current[key];
    if (inflight.current.has(key)) return inflight.current.get(key);
    if (!force && current?.status === 'ready' && matches(current.data)) return;

    const update = (value: FieldSatelliteState) => {
      stateRef.current = { ...stateRef.current, [key]: value };
      setSatelliteByField(stateRef.current);
    };
    let lastGood = matches(current?.data) ? current?.data : undefined;
    update(
      lastGood
        ? { status: 'ready', data: lastGood }
        : { status: 'loading', message: 'NDVI yükleniyor.' },
    );

    const request = (async () => {
      try {
        // A forced refresh must also restore saved data after a page reload.
        try {
          const fresh = await readFieldMapLayerCache<SavedSatellite>(key, SATELLITE_CACHE_NAMESPACE, `${key}:latest`, SATELLITE_CACHE_TTL_MS);
          const saved = matches(fresh) ? fresh : await readFieldMapLayerCache<SavedSatellite>(
            key, SATELLITE_CACHE_NAMESPACE, `${key}:latest`, SATELLITE_CACHE_TTL_MS, { allowExpired: true },
          );
          if (matches(saved)) {
            if (!lastGood || !lastGood.latestImageDate || !saved?.latestImageDate
              || new Date(saved.latestImageDate).getTime() >= new Date(lastGood.latestImageDate).getTime()) {
              lastGood = saved!;
            }
            if (!force && saved === fresh) {
              update({ status: 'ready', data: lastGood });
              return;
            }
            update({ status: 'ready', data: lastGood });
          }
        } catch (error) {
          console.warn('Kayıtlı NDVI okunamadı:', error);
        }

        const result = await analyzeFieldSatellite(field.parcelGeometry);
        if (!usable(result)) throw new Error('Uydu servisi kullanılabilir bir NDVI görüntüsü döndürmedi.');
        // Do not replace a newer successful observation with an older response.
        if (lastGood?.latestImageDate && result.latestImageDate
          && new Date(result.latestImageDate).getTime() < new Date(lastGood.latestImageDate).getTime()) {
          throw new Error('Servis son kayıtlı ölçümden daha eski bir görüntü döndürdü.');
        }
        const data: SavedSatellite = { ...result, parcelSignature: signature };
        update({ status: 'ready', data });
        try {
          await writeFieldMapLayerCache(key, SATELLITE_CACHE_NAMESPACE, `${key}:latest`, data, SATELLITE_CACHE_TTL_MS, true);
        } catch (error) {
          console.warn('NDVI kalıcı kaydı başarısız:', error);
          update({ status: 'ready', data });
        }
      } catch (error) {
        if (lastGood) {
          // Güncel sorgu başarısız olsa bile son gerçek NDVI'yı kesintisiz göster.
          // Kullanıcı verinin güncelliğini haritadaki ölçüm tarihinden görür.
          update({ status: 'ready', data: lastGood });
        } else {
          update({
            status: 'error',
            message: `NDVI alınamadı; kayıtlı görüntü de bulunamadı. ${
              error instanceof Error ? error.message : ''
            }`.trim(),
          });
        }
      }
    })();
    inflight.current.set(key, request);
    try { await request; } finally { inflight.current.delete(key); }
  }, []);

  return { satelliteByField, loadFieldSatellite };
}
