export type NdviAnomalyQuality = 'insufficient' | 'usable';
export type NdviAnomalyDirection = 'unknown' | 'negative' | 'positive' | 'none';

export type NdviAnomalyResult = {
  quality: NdviAnomalyQuality;
  anomaly: boolean;
  direction: NdviAnomalyDirection;
  latestDate: string | null;
  latestAverage: number | null;
  baselineMedian: number | null;
  deviation: number | null;
  mad: number | null;
  robustScore: number | null;
  observationCount: number;
  spanDays: number | null;
  reason: string;
};
