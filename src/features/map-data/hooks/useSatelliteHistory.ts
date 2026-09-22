import { useCallback, useEffect, useRef, useState } from 'react';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import { getEntitlementSnapshot } from '../../../entitlements/useEntitlementStore';
import {
  clearSatelliteHistoryPreviewCache,
  fetchHistoricalSatellite,
  fetchHistoricalSatellitePreview,
  listSatelliteDates,
} from '../services/satelliteHistory';

const PREVIEW_LIMIT = 6;

export function useSatelliteHistory(
  fieldId: string | undefined,
  geometry: unknown,
) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    fieldId: string;
    data: SatelliteHealthResult;
  } | null>(null);

  const request = useRef(0);
  const cache = useRef(new Map<string, SatelliteHealthResult>());
  const previewInflight = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    request.current += 1;
    setOpen(false);
    setSelection(null);
    setDates([]);
    setPreviews({});
    setError(null);
    setLoading(false);
    setPreviewLoading(false);
    cache.current.clear();
    previewInflight.current.clear();
    clearSatelliteHistoryPreviewCache();

    return () => {
      request.current += 1;
    };
  }, [fieldId]);

  const ensurePreview = useCallback(
    async (date: string) => {
      if (!geometry || !date) return null;
      if (previews[date]) return previews[date];

      const full = cache.current.get(date);
      if (full?.ndviImage) {
        setPreviews((current) => ({
          ...current,
          [date]: full.ndviImage!,
        }));
        return full.ndviImage;
      }

      let pending = previewInflight.current.get(date);

      if (!pending) {
        pending = fetchHistoricalSatellitePreview(geometry, date);
        previewInflight.current.set(date, pending);
        void pending.finally(() => {
          previewInflight.current.delete(date);
        });
      }

      try {
        const image = await pending;
        setPreviews((current) => ({ ...current, [date]: image }));
        return image;
      } catch {
        return null;
      }
    },
    [geometry, previews],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const date = String((event as CustomEvent)?.detail?.date ?? '');
      if (date && dates.includes(date)) {
        void ensurePreview(date);
      }
    };

    window.addEventListener('tp:satellite-history-preview-request', handler);
    return () => {
      window.removeEventListener('tp:satellite-history-preview-request', handler);
    };
  }, [dates, ensurePreview]);

  const warmPreviews = useCallback(
    async (items: string[], id: number) => {
      if (!geometry || !items.length) return;

      setPreviewLoading(true);
      try {
        for (const date of items.slice(0, PREVIEW_LIMIT)) {
          if (id !== request.current) return;
          await ensurePreview(date);
        }
      } finally {
        if (id === request.current) {
          setPreviewLoading(false);
        }
      }
    },
    [ensurePreview, geometry],
  );

  const getHistoryData = useCallback(
    async (date: string) => {
      if (!fieldId || !geometry || !date) return null;

      // Ücretsiz kullanıcı yalnız bulanık önizleme görür.
      // Tam geçmiş analizi ve sayısal metrikler Premium'dur.
      if (!getEntitlementSnapshot().isPremium) return null;

      const cached = cache.current.get(date);
      if (cached) return cached;

      const result = await fetchHistoricalSatellite(geometry, date);
      cache.current.set(date, result);

      if (result.ndviImage) {
        setPreviews((current) => ({
          ...current,
          [date]: result.ndviImage!,
        }));
      }

      return result;
    },
    [fieldId, geometry],
  );

  const show = useCallback(async () => {
    setOpen(true);
    setError(null);

    if (!fieldId || !geometry) {
      setError('Önce parsel sınırları olan bir tarla ekle.');
      return;
    }

    if (dates.length) {
      void warmPreviews(
        dates.filter((date) => !previews[date]),
        request.current,
      );
      return;
    }

    const id = ++request.current;
    setLoading(true);

    try {
      const result = await listSatelliteDates(geometry);
      if (id !== request.current) return;

      setDates(result);
      setLoading(false);
      void warmPreviews(result, id);
    } catch (caught) {
      if (id === request.current) {
        setError(
          caught instanceof Error ? caught.message : 'Tarihler alınamadı.',
        );
      }
    } finally {
      if (id === request.current) {
        setLoading(false);
      }
    }
  }, [dates, fieldId, geometry, previews, warmPreviews]);

  const select = useCallback(
    async (date: string | null) => {
      if (date && !getEntitlementSnapshot().isPremium) {
        // Free planda eski görüntü haritaya uygulanmaz.
        // Sheet açık kalır ve kullanıcı blur önizlemeyi görür.
        return;
      }

      if (!date) {
        request.current += 1;
        setSelection(null);
        setLoading(false);
        setPreviewLoading(false);
        setOpen(false);
        return;
      }

      if (!fieldId || !geometry) return;

      const id = ++request.current;
      setError(null);
      setLoading(true);

      try {
        const result = await getHistoryData(date);
        if (id !== request.current || !result) return;

        setSelection({ fieldId, data: result });
        setOpen(false);
      } catch (caught) {
        if (id === request.current) {
          setError(
            caught instanceof Error ? caught.message : 'Görüntü alınamadı.',
          );
        }
      } finally {
        if (id === request.current) {
          setLoading(false);
        }
      }
    },
    [fieldId, geometry, getHistoryData],
  );

  const close = useCallback(() => {
    request.current += 1;
    setOpen(false);
    setLoading(false);
    setPreviewLoading(false);
  }, []);

  return {
    open,
    dates,
    previews,
    loading,
    previewLoading,
    error,
    show,
    select,
    close,
    ensurePreview,
    getHistoryData,
    data:
      selection?.fieldId === fieldId
        ? selection?.data ?? null
        : null,
  };
}
