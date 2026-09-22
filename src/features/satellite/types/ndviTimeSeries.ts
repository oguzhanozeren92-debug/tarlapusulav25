export type NdviTimeSeriesPoint = {
  date: string;
  average: number;
  min: number | null;
  max: number | null;
  sampleCount: number | null;
  noDataCount: number | null;
};

export type NdviTrendDirection =
  | 'rising'
  | 'stable'
  | 'falling'
  | 'unknown';

export type NdviTrendQuality =
  | 'usable'
  | 'insufficient';

export type NdviTimeSeriesTrend = {
  direction: NdviTrendDirection;
  quality: NdviTrendQuality;
  slopePerDay: number | null;
  changeFromPrevious: number | null;
  changeFromFirst: number | null;
  latestAverage: number | null;
  previousAverage: number | null;
  firstAverage: number | null;
  observationCount: number;
  spanDays: number | null;
};

export type NdviTimeSeriesResult = {
  success: boolean;
  source?: string;
  period?: {
    from: string;
    to: string;
  };
  points: NdviTimeSeriesPoint[];
  trend: NdviTimeSeriesTrend;
  generatedAt?: string;
  message?: string;
};
