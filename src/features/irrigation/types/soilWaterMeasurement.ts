export type SoilWaterMeasurementSource =
  | 'sensor'
  | 'laboratory'
  | 'manual_verified';

export type SoilWaterMeasurement = {
  id: string;
  fieldId: string;
  measuredAt: string;
  volumetricWaterContent: number;
  depthFromCm: number;
  depthToCm: number;
  source: SoilWaterMeasurementSource;
  notes: string | null;
  createdAt: string;
};

export type CreateSoilWaterMeasurementInput = {
  fieldId: string;
  measuredAt?: string | null;
  volumetricWaterContent: number;
  depthFromCm: number;
  depthToCm: number;
  source: SoilWaterMeasurementSource;
  notes?: string | null;
};
