export type SatelliteFusionTrendDirection =
  | 'rising'
  | 'stable'
  | 'falling'
  | 'unknown';

export type SatelliteFusionSeriesPoint = {
  date: string;
  mean: number;
  min: number | null;
  max: number | null;
};

export type SatelliteFusionTrend = {
  direction: SatelliteFusionTrendDirection;
  latest: number | null;
  previous: number | null;
  delta: number | null;
  slopePerDay: number | null;
  count: number;
};

export type SatelliteFusionSignal = {
  series: SatelliteFusionSeriesPoint[];
  trend: SatelliteFusionTrend;
};

export type SatelliteFusionResponse = {
  success: true;
  source: {
    optical: string;
    radar: string;
  };
  period: {
    from: string;
    to: string;
  };
  optical: {
    ndvi: SatelliteFusionSignal;
  };
  radar: {
    vvDb: SatelliteFusionSignal;
    vhDb: SatelliteFusionSignal;
    vvMinusVhDb: SatelliteFusionSignal;
  };
  fusion: {
    status: 'stable' | 'watch' | 'attention' | 'unknown';
    summary: string;
    evidence: string[];
    caution: string;
  };
  generatedAt: string;
};

export type SatelliteFusionErrorResponse = {
  success?: false;
  error?: string;
  message?: string;
};
