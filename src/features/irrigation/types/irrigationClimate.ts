export type IrrigationClimateQuality =
  | 'usable'
  | 'partial'
  | 'insufficient';

export type IrrigationClimateDay = {
  date: string;

  etoMm:
    | number
    | null;

  precipitationMm:
    | number
    | null;

  /*
    Bu yalnızca referans iklim açığıdır:
    ET₀ - yağış.

    ETc değildir.
    Toprak su açığı değildir.
    Sulama miktarı değildir.
  */
  referenceDeficitMm:
    | number
    | null;

  kind:
    | 'past'
    | 'forecast';
};

export type IrrigationClimateContext = {
  fieldId: string;

  location: {
    latitude: number;
    longitude: number;

    source:
      | 'parcel_centroid'
      | 'field_coordinates'
      | 'parcel_geometry';
  };

  past7Days: {
    days:
      IrrigationClimateDay[];

    etoMm:
      number | null;

    precipitationMm:
      number | null;

    referenceDeficitMm:
      number | null;

    validDayCount:
      number;
  };

  forecast5Days: {
    days:
      IrrigationClimateDay[];

    etoMm:
      number | null;

    precipitationMm:
      number | null;

    referenceDeficitMm:
      number | null;

    validDayCount:
      number;

    nextMeaningfulRain:
      | {
          date: string;
          precipitationMm: number;
        }
      | null;
  };

  quality:
    IrrigationClimateQuality;

  warnings:
    string[];

  source: {
    provider:
      'Open-Meteo';

    eto:
      'FAO-56 reference evapotranspiration (ET₀)';

    precipitation:
      'Open-Meteo daily precipitation';

    endpoint:
      'forecast';
  };

  caution:
    string;

  generatedAt:
    string;
};
