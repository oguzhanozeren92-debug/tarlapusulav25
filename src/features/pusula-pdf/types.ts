export type PusulaPdfSatellitePoint = {
  date: string;
  ndvi: number | null;
  ndmi: number | null;
  ndre: number | null;
  savi: number | null;
  gndvi: number | null;
  ndviMin?: number | null;
  ndviMax?: number | null;
  highPercent?: number | null;
  mediumPercent?: number | null;
  lowPercent?: number | null;
  ndviImage: string | null;
  trueColorImage: string | null;
  source?: string | null;
  fromArchive?: boolean;
};

export type PusulaPdfRadarPoint = {
  date: string;
  vv: number | null;
  vh: number | null;
  water: number | null;
  vvUnit: string | null;
  vhUnit: string | null;
  waterUnit: string | null;
  orbitDirection?: string | null;
  relativeOrbit?: number | null;
};

export type PusulaPdfRadarImage = {
  date: string;
  imageUrl: string;
};

export type PusulaPdfWeatherDay = {
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  tempAvg: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  et0: number | null;
  source?: string | null;
};

export type PusulaPdfWeatherHistory = {
  history: PusulaPdfWeatherDay[];
  source?: string | null;
  archiveUsed?: number;
  liveUsed?: number;
  error?: string;
};

export type PusulaPdfLayerArchiveSnapshot = {
  schemaVersion?: number;
  fieldId?: string;
  layer?: string;
  source?: string;
  observedAt?: string | null;
  processingVersion?: string;
  metrics?: Record<string, unknown>;
  details?: Record<string, unknown>;
  archivedAt?: string | null;
};

export type PusulaPdfSnapshot = {
  schemaVersion: 1 | 2;
  field: {
    id: string;
    name: string;
    city: string | null;
    district: string | null;
    village: string | null;
    areaDecare: number | null;
    crop: string | null;
    cropSubtype: string | null;
    season: number | null;
    irrigationStatus: string | null;
    irrigationMethod: string | null;
    geometry: unknown | null;
    latitude: number | null;
    longitude: number | null;
  };
  period: { start: string; end: string; createdAt: string };
  satellite: {
    points: PusulaPdfSatellitePoint[];
    availableDates: string[];
    archiveUsed?: number;
    liveUsed?: number;
  };
  radar?: {
    points: PusulaPdfRadarPoint[];
    images: PusulaPdfRadarImage[];
    availableDates: string[];
    archiveUsed?: number;
    liveUsed?: number;
    error?: string;
  };
  weather: PusulaPdfWeatherHistory | unknown | null;
  layerArchive?: PusulaPdfLayerArchiveSnapshot[];
  irrigation: { kcSnapshots: unknown[] };
  activities: unknown[];
  soilAnalyses: unknown[];
  diagnoses: unknown[];
  missing: string[];
};

export type WeeklyPusulaReport = {
  id: string;
  field_id: string;
  period_start: string;
  period_end: string;
  status: 'snapshot' | 'generating' | 'ready' | 'failed';
  report_data: PusulaPdfSnapshot;
  pdf_bucket: string | null;
  pdf_path: string | null;
  generated_at: string | null;
};
