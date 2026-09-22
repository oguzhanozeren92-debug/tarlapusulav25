import { supabase } from '../../../supabaseClient';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';

const HISTORY_PREVIEW_CACHE = new Map<string, string>();

export function cacheSatelliteHistoryPreview(date: string, image: string) {
  if (!date || !image) return;
  HISTORY_PREVIEW_CACHE.set(date, image);
}

export function getSatelliteHistoryPreview(date: string) {
  return HISTORY_PREVIEW_CACHE.get(date) ?? null;
}

export function clearSatelliteHistoryPreviewCache() {
  HISTORY_PREVIEW_CACHE.clear();
}

function normalizeParcelGeometry(geometry: any) {
  if (!geometry) return geometry;
  if (geometry.type === 'Feature' && geometry.geometry && ['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)) return geometry;
  if (['Polygon', 'MultiPolygon'].includes(geometry.type)) return { type: 'Feature', properties: {}, geometry };
  if (geometry.geometry && ['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)) return { type: 'Feature', properties: geometry.properties ?? {}, geometry: geometry.geometry };
  return geometry;
}

function normalizeDates(value: unknown) {
  return [...new Set<string>((Array.isArray(value) ? value : []).filter((date: unknown) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().reverse();
}

async function requestAnalysis(geometry: unknown, options: Record<string, unknown>) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');
  const { data, error } = await supabase.functions.invoke('satellite-field-analysis', {
    body: { geometry: normalizeParcelGeometry(geometry), maxCloudCoverage: 30, ...options },
  });
  if (error) throw new Error('Uydu verisi alınamadı. Tekrar dene.');
  if (!data?.success) throw new Error(data?.message ?? 'Uydu ölçümü bulunamadı.');
  return data;
}

async function requestSceneList(geometry: unknown) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');
  const { data, error } = await supabase.functions.invoke('satellite-scene-list', {
    body: { geometry: normalizeParcelGeometry(geometry), daysBack: 180, maxCloudCoverage: 35 },
  });
  if (error || !data?.success) throw new Error(data?.message ?? 'Uydu arşivi alınamadı. Tekrar dene.');
  return normalizeDates(data.dates);
}

export async function listSatelliteDates(geometry: unknown): Promise<string[]> {
  // Geçmiş galerisi için bağımsız scene-list servisi kanonik kaynaktır. Bu servis
  // 180 günlük katalog sonuçlarını sayfalayarak toplar; analiz endpoint'i yalnızca
  // geriye dönük yedek olarak kullanılır.
  try {
    const dates = await requestSceneList(geometry);
    if (dates.length) return dates;
  } catch {
    // Eski deployment'larla uyumluluk için analiz endpoint'ini yedek olarak dene.
  }

  const data = await requestAnalysis(geometry, {
    listScenes: true,
    daysBack: 180,
    maxCloudCoverage: 35,
  });
  return normalizeDates(data.dates);
}

export async function fetchHistoricalSatellitePreview(geometry: unknown, date: string): Promise<string> {
  const existing = getSatelliteHistoryPreview(date);
  if (existing) return existing;
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');
  const { data, error } = await supabase.functions.invoke('satellite-history-preview', {
    body: { geometry: normalizeParcelGeometry(geometry), imageDate: date, maxCloudCoverage: 35 },
  });
  if (error) throw new Error('Uydu önizlemesi alınamadı.');
  if (!data?.success || data.latestImageDate !== date || typeof data.ndviImage !== 'string' || !data.ndviImage) {
    throw new Error(data?.message ?? 'Bu tarihin uydu önizlemesi bulunamadı.');
  }
  cacheSatelliteHistoryPreview(date, data.ndviImage);
  return data.ndviImage;
}

function hasExactHistoricalImage(data: any, date: string) {
  return data?.latestImageDate === date && typeof data?.ndviImage === 'string' && data.ndviImage.length > 0;
}

function previewOnlyHistoricalResult(date: string, ndviImage: string): SatelliteHealthResult {
  // Bu bir sentetik analiz değildir: ndviImage aynı tarih için Copernicus Process API'den
  // üretilmiş doğrulanmış Sentinel-2 NDVI görüntüsüdür. İstatistik üretilemediyse rakam
  // uydurmak yerine null bırakılır.
  return {
    success: true,
    source: 'Copernicus Data Space · Sentinel-2 L2A',
    status: 'unknown',
    statusLabel: 'Geçmiş görüntü',
    summary: 'Seçilen tarihin Sentinel-2 NDVI görüntüsü gösteriliyor.',
    recommendations: [],
    latestImageDate: date,
    ndviAverage: null,
    ndviMin: null,
    ndviMax: null,
    ndviImage,
    trueColorImage: null,
    healthyPercent: null,
    warningPercent: null,
    stressedPercent: null,
    generatedAt: new Date().toISOString(),
  } as unknown as SatelliteHealthResult;
}

export async function fetchHistoricalSatellite(geometry: unknown, date: string): Promise<SatelliteHealthResult> {
  // Galerideki küçük resim zaten aynı gün için doğrulanmış gerçek Copernicus NDVI'sıdır.
  // Tam analiz başarılıysa onu kullan. Tam analiz görüntü üretemezse kullanıcıya galeride
  // gösterdiğimiz doğrulanmış görüntüyü haritada aç; sahte istatistik üretme.
  try {
    const data = await requestAnalysis(geometry, { imageDate: date });
    if (hasExactHistoricalImage(data, date)) {
      cacheSatelliteHistoryPreview(date, data.ndviImage);
      return data as SatelliteHealthResult;
    }
  } catch {
    // Aşağıdaki doğrulanmış preview fallback'i denenecek.
  }

  const ndviImage = await fetchHistoricalSatellitePreview(geometry, date);
  if (!ndviImage) {
    throw new Error('Bu güne ait geçerli NDVI görüntüsü bulunamadı. Başka bir tarih seç.');
  }

  cacheSatelliteHistoryPreview(date, ndviImage);
  return previewOnlyHistoricalResult(date, ndviImage);
}
