export type SoilWaterProfileSource =
  | 'laboratory'
  | 'soilgrids';

export type SoilWaterProfileQuality =
  | 'measured_context'
  | 'model_estimate'
  | 'insufficient';

export type SoilWaterProfile = {
  fieldId: string;

  source:
    SoilWaterProfileSource;

  quality:
    SoilWaterProfileQuality;

  texture: {
    sandPercent:
      number;

    clayPercent:
      number;

    siltPercent:
      number;

    organicCarbonGKg:
      | number
      | null;

    organicMatterPercent:
      | number
      | null;
  };

  /*
    Hacimsel su içerikleri:
    m³ su / m³ toprak
  */
  fieldCapacityVol:
    number;

  permanentWiltingPointVol:
    number;

  plantAvailableWaterFraction:
    number;

  /*
    1 m toprak derinliği başına,
    bitkinin teorik olarak kullanabildiği su.
  */
  availableWaterCapacityMmPerM:
    number;

  /*
    Daha sonraki kök derinliği hesabı için
    hazır yardımcı değerler.
  */
  availableWaterCapacityMmPerCm:
    number;

  warnings:
    string[];

  evidence:
    string[];

  caution:
    string;

  generatedAt:
    string;
};
