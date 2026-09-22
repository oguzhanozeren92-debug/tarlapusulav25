import { supabase } from '../../../supabaseClient';
import type { NdviTimeSeriesPoint } from '../types/ndviTimeSeries';
import type { NdviAnomalyResult } from '../types/ndviAnomaly';

const fieldAnomalyCache = new Map<string, NdviAnomalyResult>();

export function cacheNdviAnomaly(fieldId: string | number, result: NdviAnomalyResult) {
  fieldAnomalyCache.set(String(fieldId), result);
}
export function getCachedNdviAnomaly(fieldId: string | number | null | undefined) {
  if (fieldId == null) return null;
  return fieldAnomalyCache.get(String(fieldId)) ?? null;
}
export function clearCachedNdviAnomaly(fieldId?: string | number) {
  if (fieldId == null) fieldAnomalyCache.clear();
  else fieldAnomalyCache.delete(String(fieldId));
}

export async function analyzeNdviAnomaly(points: NdviTimeSeriesPoint[]): Promise<NdviAnomalyResult> {
  const evidence = points
    .filter(point => Number.isFinite(point.average) && point.average >= -1 && point.average <= 1)
    .map(point => ({ date: point.date, average: point.average }));
  const { data, error } = await supabase.functions.invoke('satellite-ndvi-anomaly', { body: { points: evidence } });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.message ?? 'NDVI anomali analizi alınamadı.');
  return {
    quality: data.quality === 'usable' ? 'usable' : 'insufficient',
    anomaly: data.quality === 'usable' && data.anomaly === true,
    direction: ['negative', 'positive', 'none'].includes(data.direction) && data.quality === 'usable' ? data.direction : 'unknown',
    latestDate: data.latestDate ? String(data.latestDate) : null,
    latestAverage: Number.isFinite(Number(data.latestAverage)) ? Number(data.latestAverage) : null,
    baselineMedian: Number.isFinite(Number(data.baselineMedian)) ? Number(data.baselineMedian) : null,
    deviation: Number.isFinite(Number(data.deviation)) ? Number(data.deviation) : null,
    mad: Number.isFinite(Number(data.mad)) ? Number(data.mad) : null,
    robustScore: Number.isFinite(Number(data.robustScore)) ? Number(data.robustScore) : null,
    observationCount: Number.isFinite(Number(data.observationCount)) ? Number(data.observationCount) : evidence.length,
    spanDays: Number.isFinite(Number(data.spanDays)) ? Number(data.spanDays) : null,
    reason: String(data.reason ?? ''),
  };
}
