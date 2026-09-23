import { supabase } from '../../../supabaseClient';

export type FieldIrrigationStatusValue =
  | 'sulu'
  | 'susuz'
  | 'kısmi';

export type FieldIrrigationDatabaseValue =
  | 'irrigated'
  | 'rainfed'
  | 'partial';

export type FieldCompletionContext = {
  fieldId: string;
  cropName: string | null;
  cropCycle: string | null;
  plantingYear: number | null;
  irrigationStatus: FieldIrrigationDatabaseValue | null;
  bearing: boolean | null;
  canopyDevelopmentClass:
    | 'very_small'
    | 'small'
    | 'medium'
    | 'large'
    | 'very_large'
    | null;
  canopyHeightClass:
    | 'under_1m'
    | '1_2m'
    | '2_3m'
    | '3_5m'
    | 'over_5m'
    | null;
  canopyCoverPercent: number | null;
  canopyHeightM: number | null;
};

const IRRIGATION_STATUS_TO_DATABASE: Record<
  FieldIrrigationStatusValue,
  FieldIrrigationDatabaseValue
> = {
  sulu: 'irrigated',
  susuz: 'rainfed',
  kısmi: 'partial',
};

function textOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDatabaseStatus(
  value: unknown,
): FieldIrrigationDatabaseValue | null {
  const raw = textOrNull(value);

  if (
    raw === 'irrigated' ||
    raw === 'rainfed' ||
    raw === 'partial'
  ) {
    return raw;
  }

  return null;
}

async function requireUser() {
  const {
    data: userResult,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user = userResult.user;

  if (!user) {
    throw new Error('Tarla bilgisi için oturum bulunamadı.');
  }

  return user;
}

function emitFieldContextUpdated(
  fieldId: string,
  changedFields: string[],
  extra: Record<string, unknown> = {},
) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('tp:field-context-updated', {
      detail: {
        fieldId,
        changedFields,
        ...extra,
      },
    }),
  );
}

export async function loadFieldCompletionContext(
  fieldIdInput: string,
): Promise<FieldCompletionContext | null> {
  const fieldId = String(fieldIdInput ?? '').trim();

  if (!fieldId) return null;

  const user = await requireUser();

  const {
    data,
    error,
  } = await supabase
    .from('fields')
    .select(
      [
        'id',
        'crop',
        'crop_cycle',
        'planting_year',
        'irrigation_status',
        'bearing',
        'canopy_development_class',
        'canopy_height_class',
        'canopy_cover_percent',
        'canopy_height_m',
      ].join(', '),
    )
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as Record<string, any>;

  const canopyDevelopmentClass =
    [
      'very_small',
      'small',
      'medium',
      'large',
      'very_large',
    ].includes(String(row.canopy_development_class ?? ''))
      ? (String(row.canopy_development_class) as FieldCompletionContext['canopyDevelopmentClass'])
      : null;

  const canopyHeightClass =
    [
      'under_1m',
      '1_2m',
      '2_3m',
      '3_5m',
      'over_5m',
    ].includes(String(row.canopy_height_class ?? ''))
      ? (String(row.canopy_height_class) as FieldCompletionContext['canopyHeightClass'])
      : null;

  return {
    fieldId: String(row.id),
    cropName: textOrNull(row.crop),
    cropCycle: textOrNull(row.crop_cycle),
    plantingYear: finiteNumber(row.planting_year),
    irrigationStatus: normalizeDatabaseStatus(row.irrigation_status),
    bearing:
      typeof row.bearing === 'boolean'
        ? row.bearing
        : null,
    canopyDevelopmentClass,
    canopyHeightClass,
    canopyCoverPercent: finiteNumber(row.canopy_cover_percent),
    canopyHeightM: finiteNumber(row.canopy_height_m),
  };
}

/**
 * Eski çağrılar için korunuyor.
 */
export async function loadFieldIrrigationStatus(
  fieldIdInput: string,
): Promise<FieldIrrigationDatabaseValue | null> {
  const context = await loadFieldCompletionContext(fieldIdInput);
  return context?.irrigationStatus ?? null;
}

export async function saveFieldIrrigationStatus(input: {
  fieldId: string;
  irrigationStatus: FieldIrrigationStatusValue;
}) {
  const fieldId = String(input.fieldId ?? '').trim();

  if (!fieldId) {
    throw new Error('Sulama durumu kaydı için tarla kimliği bulunamadı.');
  }

  const databaseValue = IRRIGATION_STATUS_TO_DATABASE[input.irrigationStatus];

  if (!databaseValue) {
    throw new Error('Geçersiz sulama durumu seçildi.');
  }

  const user = await requireUser();

  const {
    data,
    error,
  } = await supabase
    .from('fields')
    .update({
      irrigation_status: databaseValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id, irrigation_status')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Tarla bulunamadı veya sulama durumu güncellenemedi.');
  }

  const savedStatus = normalizeDatabaseStatus(data.irrigation_status);

  if (!savedStatus) {
    throw new Error('Sulama durumu kaydedildi ancak doğrulanamadı.');
  }

  emitFieldContextUpdated(
    fieldId,
    ['irrigation_status'],
    { irrigationStatus: savedStatus },
  );

  return {
    fieldId: String(data.id),
    irrigationStatus: savedStatus,
  };
}

export async function saveFieldCanopyDevelopmentClass(input: {
  fieldId: string;
  canopyDevelopmentClass:
    | 'very_small'
    | 'small'
    | 'medium'
    | 'large'
    | 'very_large';
}) {
  const fieldId = String(input.fieldId ?? '').trim();

  if (!fieldId) {
    throw new Error('Taç gelişimi kaydı için tarla kimliği bulunamadı.');
  }

  const allowed = [
    'very_small',
    'small',
    'medium',
    'large',
    'very_large',
  ];

  if (!allowed.includes(input.canopyDevelopmentClass)) {
    throw new Error('Geçersiz taç gelişimi seçildi.');
  }

  const user = await requireUser();

  const { data, error } = await supabase
    .from('fields')
    .update({
      canopy_development_class: input.canopyDevelopmentClass,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id, canopy_development_class')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Taç gelişimi kaydedilemedi.');
  }

  emitFieldContextUpdated(
    fieldId,
    ['canopy_development_class'],
    {
      canopyDevelopmentClass:
        String(data.canopy_development_class),
    },
  );

  return {
    fieldId: String(data.id),
    canopyDevelopmentClass:
      String(data.canopy_development_class),
  };
}

export async function saveFieldCanopyHeightClass(input: {
  fieldId: string;
  canopyHeightClass:
    | 'under_1m'
    | '1_2m'
    | '2_3m'
    | '3_5m'
    | 'over_5m';
}) {
  const fieldId = String(input.fieldId ?? '').trim();

  if (!fieldId) {
    throw new Error('Ağaç yüksekliği kaydı için tarla kimliği bulunamadı.');
  }

  const allowed = [
    'under_1m',
    '1_2m',
    '2_3m',
    '3_5m',
    'over_5m',
  ];

  if (!allowed.includes(input.canopyHeightClass)) {
    throw new Error('Geçersiz ağaç yüksekliği seçildi.');
  }

  const user = await requireUser();

  const { data, error } = await supabase
    .from('fields')
    .update({
      canopy_height_class: input.canopyHeightClass,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id, canopy_height_class')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Ağaç yüksekliği kaydedilemedi.');
  }

  emitFieldContextUpdated(
    fieldId,
    ['canopy_height_class'],
    {
      canopyHeightClass:
        String(data.canopy_height_class),
    },
  );

  return {
    fieldId: String(data.id),
    canopyHeightClass:
      String(data.canopy_height_class),
  };
}

export async function saveFieldCanopyCoverPercent(input: {
  fieldId: string;
  canopyCoverPercent: number;
}) {
  const fieldId = String(input.fieldId ?? '').trim();
  const canopyCoverPercent = finiteNumber(input.canopyCoverPercent);

  if (!fieldId) {
    throw new Error('Taç örtüsü kaydı için tarla kimliği bulunamadı.');
  }

  if (
    canopyCoverPercent === null ||
    canopyCoverPercent < 0 ||
    canopyCoverPercent > 100
  ) {
    throw new Error('Taç örtüsü 0 ile 100 arasında olmalı.');
  }

  const user = await requireUser();

  const {
    data,
    error,
  } = await supabase
    .from('fields')
    .update({
      canopy_cover_percent: canopyCoverPercent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id, canopy_cover_percent')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Taç örtüsü kaydedilemedi.');
  }

  const savedValue = finiteNumber(data.canopy_cover_percent);

  emitFieldContextUpdated(
    fieldId,
    ['canopy_cover_percent'],
    { canopyCoverPercent: savedValue },
  );

  return {
    fieldId: String(data.id),
    canopyCoverPercent: savedValue,
  };
}

export async function saveFieldCanopyHeightM(input: {
  fieldId: string;
  canopyHeightM: number;
}) {
  const fieldId = String(input.fieldId ?? '').trim();
  const canopyHeightM = finiteNumber(input.canopyHeightM);

  if (!fieldId) {
    throw new Error('Ağaç yüksekliği kaydı için tarla kimliği bulunamadı.');
  }

  if (
    canopyHeightM === null ||
    canopyHeightM <= 0 ||
    canopyHeightM > 30
  ) {
    throw new Error('Ağaç yüksekliği 0 ile 30 metre arasında olmalı.');
  }

  const user = await requireUser();

  const {
    data,
    error,
  } = await supabase
    .from('fields')
    .update({
      canopy_height_m: canopyHeightM,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id, canopy_height_m')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Ağaç yüksekliği kaydedilemedi.');
  }

  const savedValue = finiteNumber(data.canopy_height_m);

  emitFieldContextUpdated(
    fieldId,
    ['canopy_height_m'],
    { canopyHeightM: savedValue },
  );

  return {
    fieldId: String(data.id),
    canopyHeightM: savedValue,
  };
}
