export type PhenologyStage =
  | 'unknown'
  | 'pre_sowing'
  | 'establishment'
  | 'vegetative'
  | 'reproductive'
  | 'maturation'
  | 'harvest_window'
  | 'post_harvest'

  /*
    Çok yıllık meyve/bağ fenolojisi.
  */
  | 'dormancy'
  | 'bud_swell'
  | 'bud_break'
  | 'flowering'
  | 'fruit_set'
  | 'fruit_growth'
  | 'veraison'
  | 'leaf_fall';

export type PhenologyConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type PhenologyDataStatus =
  | 'usable'
  | 'insufficient_data'
  | 'invalid_dates';

export type NdviTrendDirection =
  | 'rising'
  | 'stable'
  | 'falling'
  | 'unknown';

export type NdviTrendQuality =
  | 'usable'
  | 'insufficient';

export type PhenologyInput = {
  cropName?: string | null;
  sowingDate?: string | null;
  expectedHarvestDate?: string | null;
  actualHarvestDate?: string | null;
  currentDate?: string | Date | null;

  ndviTrend?: {
    direction?: NdviTrendDirection | null;
    quality?: NdviTrendQuality | null;
    latestAverage?: number | null;
    changeFromPrevious?: number | null;
    changeFromFirst?: number | null;
  } | null;
};

export type PhenologyResult = {
  stage: PhenologyStage;
  stageLabel: string;
  confidence: PhenologyConfidence;
  dataStatus: PhenologyDataStatus;

  progressPercent: number | null;
  daysSinceSowing: number | null;
  daysUntilExpectedHarvest: number | null;

  basis: string[];
  warnings: string[];
  summary: string;
};
