export type IrrigationStatus =
  | 'irrigated'
  | 'rainfed'
  | 'partial'
  | 'unknown';

export type IrrigationContextQuality =
  | 'usable'
  | 'partial'
  | 'insufficient';

export type LastIrrigationRecord = {
  activityId: string;
  date: string;

  /*
    Tarla geneline uygulanan toplam su.
  */
  totalWaterM3: number | null;

  /*
    1 m³/da = 1 mm su yüksekliği.
    Bu nedenle dekara m³ değeri aynı zamanda yaklaşık uygulama mm'sidir.
  */
  waterM3PerDecare: number | null;
  appliedWaterMm: number | null;

  durationHours: number | null;

  amountSource:
    | 'notes_per_decare'
    | 'notes_total'
    | 'activity_quantity'
    | 'unknown';

  notes: string | null;
};

export type IrrigationContext = {
  fieldId: string;
  fieldName: string | null;
  cropName: string | null;

  cropSubtype:
    | 'table'
    | 'wine'
    | null;

  areaDecare: number | null;

  irrigationStatus: IrrigationStatus;
  irrigationStatusRaw: string | null;
  irrigationMethod: import('../../../types').FieldIrrigationMethod | null;

  lastIrrigation: LastIrrigationRecord | null;

  quality: IrrigationContextQuality;

  missing: Array<
    | 'irrigation_status'
    | 'field_area'
    | 'last_irrigation'
  >;

  /*
    last_irrigation'ın eksik olması her zaman hata değildir.
    Kullanıcı hiç sulamamış olabilir; karar motoru bunu ayrı ele alır.
  */
  warnings: string[];

  source: {
    field: 'supabase.fields';
    irrigationHistory: 'supabase.activities';
  };

  generatedAt: string;
};
