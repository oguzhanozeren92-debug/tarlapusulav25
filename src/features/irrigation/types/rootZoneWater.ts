export type RootZoneWaterStatus =
  | 'usable'
  | 'partial'
  | 'blocked';

export type RootZoneCropProfile = {
  cropKey: string;
  displayName: string;

  aliases:
    string[];

  cropSubtype:
    | 'table'
    | 'wine'
    | null;

  cropSubtypeLabel:
    | string
    | null;

  /*
    FAO-56 Table 22 maximum effective rooting depth range.
  */
  rootDepthMinM:
    number;

  rootDepthMaxM:
    number;

  /*
    FAO-56 Table 22 depletion fraction for
    approximately ETc = 5 mm/day.
  */
  depletionFractionP:
    number;

  sourceLabel:
    string;

  sourceUrl:
    string;
};

export type RootZoneWaterResult = {
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

  status:
    RootZoneWaterStatus;

  rootZone: {
    /*
      Sulama planlamasında FAO notuna göre
      aralığın küçük değeri kullanılır.
    */
    schedulingDepthM:
      number | null;

    rangeMinM:
      number | null;

    rangeMaxM:
      number | null;

    depthSource:
      | 'fao56_lower_bound'
      | null;
  };

  soil: {
    availableWaterCapacityMmPerM:
      number | null;

    source:
      string | null;

    quality:
      string | null;
  };

  /*
    TAW = (FC - WP) × root depth
  */
  totalAvailableWaterMm:
    number | null;

  depletion: {
    baseFractionP:
      number | null;

    adjustedFractionP:
      number | null;

    forecastAverageCropWaterUseMmPerDay:
      number | null;

    /*
      RAW = p × TAW
      Çiftçi dilinde:
      "Stres başlamadan kullanılabilir bölüm"
    */
    readilyAvailableWaterMm:
      number | null;
  };

  display: {
    storageLabel:
      string;

    stressFreeLabel:
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
