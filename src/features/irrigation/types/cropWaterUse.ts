export type CropWaterUseStatus =
  | 'usable'
  | 'partial'
  | 'blocked';

export type CropWaterUseDay = {
  date: string;

  referenceEvapotranspirationMm:
    | number
    | null;

  cropCoefficient:
    | number
    | null;

  /*
    Teknik karşılığı:
    ETc = ET₀ × Kc

    Kullanıcıya gösterilecek adı:
    "Bitkinin Tahmini Su Tüketimi"
  */
  estimatedCropWaterUseMm:
    | number
    | null;

  precipitationMm:
    | number
    | null;

  /*
    Bu sadece:
    tahmini bitki su tüketimi - yağış.

    Henüz:
    - toprakta mevcut su,
    - son sulama,
    - etkin yağış,
    - kök derinliği
    hesaba katılmadığı için
    "sulama ihtiyacı" değildir.
  */
  climateWaterGapMm:
    | number
    | null;

  kind:
    | 'past'
    | 'forecast';
};

export type CropWaterUsePeriod = {
  days:
    CropWaterUseDay[];

  estimatedCropWaterUseMm:
    | number
    | null;

  precipitationMm:
    | number
    | null;

  climateWaterGapMm:
    | number
    | null;

  validDayCount:
    number;
};

export type CropWaterUseResult = {
  fieldId: string;

  fieldName:
    | string
    | null;

  cropName:
    | string
    | null;

  cropSubtype:
    | 'table'
    | 'wine'
    | null;

  phenology: {
    stage: string;
    stageLabel:
      | string
      | null;

    bearing:
      | boolean
      | null;
  };

  coefficient: {
    status: string;

    kc:
      | number
      | null;

    confidence:
      'low'
      | 'medium'
      | 'high';

    sourceLabel:
      | string
      | null;
  };

  past7Days:
    CropWaterUsePeriod;

  forecast5Days:
    CropWaterUsePeriod;

  status:
    CropWaterUseStatus;

  /*
    Çiftçi dilinde hazır alanlar.
    UI isterse doğrudan bunları kullanabilir.
  */
  display: {
    primaryLabel:
      'Bitkinin Tahmini Su Tüketimi';

    pastLabel:
      string;

    forecastLabel:
      string;

    note:
      string;
  };

  evidence:
    string[];

  warnings:
    string[];

  caution:
    string;

  generatedAt:
    string;
};
