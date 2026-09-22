export type IrrigationDecisionCode =
  | 'needs_data'
  | 'rainfed_monitoring'
  | 'wait'
  | 'irrigation_approaching'
  | 'irrigate_now';

export type IrrigationDecisionConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type IrrigationShadowModelAgreement =
  | 'supportive'
  | 'divergent'
  | 'not_comparable'
  | 'unavailable';

export type IrrigationShadowModelEvidence = {
  status: 'ready' | 'waiting' | 'blocked' | 'not_applicable' | 'error';
  sourceModel: 'pyfao56-dual-kc-shadow';
  productionAuthority: false;
  agreement: IrrigationShadowModelAgreement;
  confidence: IrrigationDecisionConfidence;
  engineVersion: string | null;
  completedAt: string | null;
  horizonDays: number | null;
  scenarioCount: number;
  missingInputs: string[];
  rootDepletionRangeMm: { min: number; max: number } | null;
  surfaceDepletionRangeMm: { min: number; max: number } | null;
  stressCoefficientRange: { min: number; max: number } | null;
  evidence: string[];
  note: string;
  promotionGate: {
    eligible: boolean;
    reason: string;
    requiredAgreement: 'supportive';
    requiredProductionHorizonDays: 5;
    requiredShadowHorizonDays: 5;
    productionAuthority: false;
    validationHistory?: {
      eligible: boolean;
      consecutiveSupportiveRuns: number;
      requiredSupportiveRuns: 3;
      distinctDays: number;
      hasVerifiedSoilWaterEvidence: boolean;
      reason: string;
      productionAuthority: false;
    };
  };
};

export type AquaCropPilotEvidence = {
  status: 'ready' | 'waiting' | 'blocked' | 'error';
  sourceModel: 'aquacrop-pilot';
  productionAuthority: false;
  engineVersion: string | null;
  completedAt: string | null;
  missingInputs: string[];
  cropModelKey: string | null;
  simulationStart: string | null;
  simulationEnd: string | null;
  weatherDays: number | null;
  soilLayerCount: number | null;
  initialWaterLayerCount: number | null;
  irrigationMode: string | null;
  evidence: string[];
  note: string;
};

export type IrrigationSynthesisAgreement =
  | 'aligned'
  | 'mixed'
  | 'partial'
  | 'insufficient';

/**
 * Tek bir yeni sulama modeli değildir. Production kararını; güncel fenoloji/Kc,
 * pyfao56 kısa dönem su dengesi ve AquaCrop sezon bağlamıyla birlikte açıklar.
 * Sayısal reçete otoritesi yine production irrigation engine'de kalır.
 */
export type IrrigationDecisionSynthesis = {
  status: 'ready' | 'partial' | 'blocked';
  agreement: IrrigationSynthesisAgreement;
  confidence: IrrigationDecisionConfidence;
  productionAuthority: false;
  stage: string | null;
  stageLabel: string | null;
  phenologyConfidence: IrrigationDecisionConfidence | null;
  phenologyGeneratedAt: string | null;
  currentKc: number | null;
  sources: {
    production: true;
    phenology: 'ready' | 'missing' | 'error';
    pyfao56: 'ready' | 'not_applicable' | 'waiting' | 'blocked' | 'error';
    aquacrop: 'ready' | 'waiting' | 'blocked' | 'error';
    wapor: 'ready' | 'partial' | 'unavailable' | 'error';
  };
  missingSources: string[];
  headline: string;
  summary: string;
  evidence: string[];
  warnings: string[];
  generatedAt: string;
};

export type IrrigationDecisionDay = {
  date: string;
  estimatedCropWaterUseMm: number;
  precipitationMm: number;
  effectiveRainMm: number;
  estimatedDeficitMm: number;
  thresholdReached: boolean;
};

export type RainfedStressRiskLevel =
  | 'unknown'
  | 'normal'
  | 'elevated'
  | 'high';

export type RainfedStressAssessment = {
  /*
    Bu alan gerçek toprak nemi/su açığı değildir.
    Son 7 gün + 5 günlük tahminde ETc ile etkili yağış arasındaki
    iklim-temelli su baskısını gösteren erken uyarıdır.
  */
  riskLevel: RainfedStressRiskLevel;
  pressureRatio: number | null;
  past7DayPrecipitationMm: number | null;
  past7DayCropWaterUseMm: number | null;
  past7DayEffectiveRainMm: number | null;
  past7DayClimateDeficitMm: number | null;
  forecast5DayPrecipitationMm: number | null;
  forecast5DayCropWaterUseMm: number | null;
  forecast5DayEffectiveRainMm: number | null;
  forecast5DayClimateDeficitMm: number | null;
  combinedClimatePressureMm: number | null;
  validPastDayCount: number;
  validForecastDayCount: number;
  nextMeaningfulRain:
    | {
        date: string;
        precipitationMm: number;
      }
    | null;
  basis: 'climate_water_balance_not_soil_moisture';
};

export type IrrigationDecisionResult = {
  fieldId: string;
  fieldName: string | null;
  cropName: string | null;
  decision: IrrigationDecisionCode;
  confidence: IrrigationDecisionConfidence;
  irrigationStatus: 'irrigated' | 'rainfed' | 'partial' | 'unknown';
  irrigationMethod: import('./irrigation').IrrigationContext['irrigationMethod'];

  /* Kc calculated for the current visit; never a measurement for past days. */
  currentKc: number | null;

  waterBalance: {
    /*
      Son tam sulamadan bugüne tahmini kök bölgesi açığı.
      Bu değer ancak güvenilir bir baseline varsa üretilir.
    */
    currentDeficitMm: number | null;
    stressThresholdMm: number | null;
    rootZoneStorageMm: number | null;
    currentDeficitRatio: number | null;
    projected5DayDeficitMm: number | null;
    daysToStressThreshold: number | null;
    lastIrrigationDate: string | null;
    lastIrrigationAppliedMm: number | null;
    baselineAssumption: 'last_irrigation_refilled_root_zone' | null;
  };

  rainfedStress: RainfedStressAssessment | null;

  recommendation: {
    /*
      Toprağa/kök bölgesine ulaşması gereken NET su.
      Sulama sistemi randımanı henüz uygulanmaz.
    */
    netWaterMm: number | null;
    totalNetWaterM3: number | null;
    irrigationEfficiencyApplied: false;
    grossWaterMm: null;
    totalGrossWaterM3: null;
  };

  forecast: IrrigationDecisionDay[];

  display: {
    headline: string;
    summary: string;
    action: string;
    waterLabel: string | null;
  };

  reasons: string[];
  missing: string[];
  warnings: string[];
  generatedAt: string;

  /** Independent validation models. Neither changes production authority. */
  modelEvidence?: IrrigationShadowModelEvidence;
  seasonModelEvidence?: AquaCropPilotEvidence;

  /** Unified explanation layer over production + phenology + validation models. */
  synthesis?: IrrigationDecisionSynthesis;
};