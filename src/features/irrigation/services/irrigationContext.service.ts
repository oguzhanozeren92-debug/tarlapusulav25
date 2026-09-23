import {
  supabase,
} from '../../../supabaseClient';

import type {
  IrrigationContext,
  IrrigationContextQuality,
  IrrigationStatus,
  LastIrrigationRecord,
} from '../types/irrigation';

function textOrNull(
  value: unknown,
): string | null {
  const text =
    String(
      value ?? '',
    ).trim();

  return text
    ? text
    : null;
}

function finiteNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function positiveNumber(
  value: unknown,
): number | null {
  const number =
    finiteNumber(value);

  return (
    number !== null &&
    number >= 0
  )
    ? number
    : null;
}

export function normalizeIrrigationStatus(
  value: unknown,
): IrrigationStatus {
  const raw =
    String(
      value ?? '',
    )
      .trim()
      .toLocaleLowerCase(
        'tr-TR',
      )
      .replace(
        /\s+/g,
        ' ',
      );

  if (!raw) {
    return 'unknown';
  }

  const irrigatedValues = [
    'sulu',
    'sulanıyor',
    'sulaniyor',
    'irrigated',
    'irrigation',
    'tam sulu',
  ];

  if (
    irrigatedValues.includes(
      raw,
    )
  ) {
    return 'irrigated';
  }

  const rainfedValues = [
    'susuz',
    'kuru',
    'kıraç',
    'kirac',
    'rainfed',
    'dry',
  ];

  if (
    rainfedValues.includes(
      raw,
    )
  ) {
    return 'rainfed';
  }

  const partialValues = [
    'kısmi',
    'kismi',
    'kısmi sulama',
    'kismi sulama',
    'ihtiyaca göre',
    'ihtiyaca gore',
    'kısmi-ihtiyaca göre sulama',
    'kismi-ihtiyaca gore sulama',
    'partial',
    'supplemental',
  ];

  if (
    partialValues.includes(
      raw,
    )
  ) {
    return 'partial';
  }

  if (
    raw.includes(
      'kısmi',
    ) ||
    raw.includes(
      'kismi',
    ) ||
    raw.includes(
      'ihtiyaca',
    )
  ) {
    return 'partial';
  }

  return 'unknown';
}

function normalizeIrrigationMethod(
  value: unknown,
): IrrigationContext['irrigationMethod'] {
  const raw = String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  const aliases: Record<string, NonNullable<IrrigationContext['irrigationMethod']>> = {
    sprinkler: 'sprinkler',
    'yağmurlama': 'sprinkler',
    yagmurlama: 'sprinkler',
    basin: 'basin',
    tav: 'basin',
    border: 'border',
    salma: 'border',
    furrow_every_narrow: 'furrow_every_narrow',
    furrow_every_wide: 'furrow_every_wide',
    furrow_alternating: 'furrow_alternating',
    trickle: 'trickle',
    damlama: 'trickle',
    unknown: 'unknown',
  };
  return aliases[raw] ?? null;
}

function normalizeDecimalText(
  value: string,
) {
  return value
    .replace(/\s/g, '')
    .replace(',', '.');
}

function findNumberByPatterns(
  text: string,
  patterns: RegExp[],
): number | null {
  for (
    const pattern
    of patterns
  ) {
    const match =
      text.match(
        pattern,
      );

    if (
      !match?.[1]
    ) {
      continue;
    }

    const parsed =
      Number(
        normalizeDecimalText(
          match[1],
        ),
      );

    if (
      Number.isFinite(
        parsed,
      ) &&
      parsed >= 0
    ) {
      return parsed;
    }
  }

  return null;
}

function parseIrrigationNotes(
  notes:
    | string
    | null
    | undefined,
) {
  const text =
    String(
      notes ?? '',
    );

  if (!text.trim()) {
    return {
      totalWaterM3:
        null as number | null,

      waterM3PerDecare:
        null as number | null,

      durationHours:
        null as number | null,
    };
  }

  const totalWaterM3 =
    findNumberByPatterns(
      text,
      [
        /toplam\s+sulama\s+suyu\s*:\s*([\d.,]+)\s*m[³3]/i,
        /toplam\s+su\s*:\s*([\d.,]+)\s*m[³3]/i,
      ],
    );

  const waterM3PerDecare =
    findNumberByPatterns(
      text,
      [
        /dekara\s+sulama\s+suyu\s*:\s*([\d.,]+)\s*m[³3]\s*\/\s*da/i,
        /([\d.,]+)\s*m[³3]\s*\/\s*da/i,
      ],
    );

  const durationHours =
    findNumberByPatterns(
      text,
      [
        /sulama\s+süresi\s*:\s*([\d.,]+)\s*saat/i,
        /sulama\s+suresi\s*:\s*([\d.,]+)\s*saat/i,
      ],
    );

  return {
    totalWaterM3,
    waterM3PerDecare,
    durationHours,
  };
}

function buildLastIrrigationRecord(
  activity: any,
  areaDecare: number | null,
): LastIrrigationRecord | null {
  if (!activity) {
    return null;
  }

  const parsed =
    parseIrrigationNotes(
      activity.notes,
    );

  const quantity =
    positiveNumber(
      activity.quantity,
    );

  const unit =
    String(
      activity.unit ?? '',
    )
      .trim()
      .toLocaleLowerCase(
        'tr-TR',
      );

  const quantityLooksLikePerDecare =
    unit === 'mm' ||
    unit.includes('m³/da') ||
    unit.includes('m3/da') ||
    unit.includes('m³ / da') ||
    unit.includes('m3 / da');

  const quantityLooksLikeTotalM3 =
    !quantityLooksLikePerDecare &&
    (
      unit === 'm³' ||
      unit === 'm3' ||
      unit.includes('m³') ||
      unit.includes('m3')
    );

  let totalWaterM3 =
    parsed.totalWaterM3;

  let waterM3PerDecare =
    parsed.waterM3PerDecare;

  let amountSource:
    LastIrrigationRecord['amountSource'] =
    'unknown';

  if (
    waterM3PerDecare !==
    null
  ) {
    amountSource =
      'notes_per_decare';
  }

  if (
    waterM3PerDecare === null &&
    quantity !== null &&
    quantityLooksLikePerDecare
  ) {
    /*
      1 m³/da ≈ 1 mm su yüksekliği. Kullanıcı mm girerse de aynı sayısal
      değer dekara m³ olarak su dengesi için kullanılabilir.
    */
    waterM3PerDecare = quantity;
    amountSource = 'activity_quantity';
  }

  if (
    totalWaterM3 ===
      null &&
    quantity !== null &&
    quantityLooksLikeTotalM3
  ) {
    totalWaterM3 =
      quantity;

    amountSource =
      amountSource ===
      'notes_per_decare'
        ? amountSource
        : 'activity_quantity';
  }

  if (
    waterM3PerDecare ===
      null &&
    totalWaterM3 !==
      null &&
    areaDecare !==
      null &&
    areaDecare > 0
  ) {
    waterM3PerDecare =
      totalWaterM3 /
      areaDecare;

    amountSource =
      amountSource ===
      'unknown'
        ? 'notes_total'
        : amountSource;
  }

  if (
    totalWaterM3 ===
      null &&
    waterM3PerDecare !==
      null &&
    areaDecare !==
      null &&
    areaDecare > 0
  ) {
    totalWaterM3 =
      waterM3PerDecare *
      areaDecare;
  }

  const date =
    textOrNull(
      activity.activity_date,
    );

  if (!date) {
    return null;
  }

  return {
    activityId:
      String(
        activity.id,
      ),

    date,

    totalWaterM3:
      totalWaterM3 !==
      null
        ? Number(
            totalWaterM3.toFixed(
              3,
            ),
          )
        : null,

    waterM3PerDecare:
      waterM3PerDecare !==
      null
        ? Number(
            waterM3PerDecare.toFixed(
              3,
            ),
          )
        : null,

    /*
      1 m³ / da = 1 litre / m² = 1 mm.
    */
    appliedWaterMm:
      waterM3PerDecare !==
      null
        ? Number(
            waterM3PerDecare.toFixed(
              3,
            ),
          )
        : null,

    durationHours:
      parsed.durationHours,

    amountSource,

    notes:
      textOrNull(
        activity.notes,
      ),
  };
}

function resolveQuality(
  irrigationStatus: IrrigationStatus,
  areaDecare: number | null,
):
  IrrigationContextQuality {
  if (
    irrigationStatus ===
    'unknown'
  ) {
    return 'insufficient';
  }

  if (
    areaDecare ===
      null ||
    areaDecare <= 0
  ) {
    return 'partial';
  }

  return 'usable';
}

export async function loadIrrigationContext(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<IrrigationContext> {
  if (
    field?.id ===
      null ||
    field?.id ===
      undefined ||
    String(
      field.id,
    ).trim() ===
      ''
  ) {
    throw new Error(
      'Sulama bağlamı için tarla kimliği bulunamadı.',
    );
  }

  const fieldId =
    String(
      field.id,
    );

  const {
    data: userResult,
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user =
    userResult.user;

  if (!user) {
    throw new Error(
      'Sulama bağlamı için oturum bulunamadı.',
    );
  }

  const [
    fieldResult,
    activityResult,
  ] =
    await Promise.all([
      supabase
        .from('fields')
        .select(
          'id, name, crop, crop_subtype, area_decare, irrigation_status, irrigation_method',
        )
        .eq(
          'id',
          fieldId,
        )
        .eq(
          'user_id',
          user.id,
        )
        .maybeSingle(),

      supabase
        .from('activities')
        .select(
          'id, activity_date, quantity, unit, notes, created_at',
        )
        .eq(
          'field_id',
          fieldId,
        )
        .eq(
          'user_id',
          user.id,
        )
        .ilike(
          'activity_type',
          'Sulama',
        )
        .order(
          'activity_date',
          {
            ascending:
              false,
          },
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          },
        )
        .limit(1)
        .maybeSingle(),
    ]);

  if (
    fieldResult.error
  ) {
    throw fieldResult.error;
  }

  if (
    activityResult.error
  ) {
    throw activityResult.error;
  }

  const dbField =
    fieldResult.data;

  if (!dbField) {
    throw new Error(
      'Sulama bağlamı için tarla bulunamadı veya erişim yok.',
    );
  }

  const areaDecare =
    positiveNumber(
      dbField.area_decare,
    );

  const irrigationStatusRaw =
    textOrNull(
      dbField.irrigation_status,
    );

  const irrigationStatus =
    normalizeIrrigationStatus(
      irrigationStatusRaw,
    );

  const lastIrrigation =
    buildLastIrrigationRecord(
      activityResult.data,
      areaDecare,
    );

  const missing:
    IrrigationContext['missing'] =
    [];

  const warnings:
    string[] = [];

  if (
    irrigationStatus ===
    'unknown'
  ) {
    missing.push(
      'irrigation_status',
    );

    warnings.push(
      'Tarlanın sulu / susuz / kısmi sulama durumu kayıtlı değil. Sulama motoru bu bilgi olmadan “şimdi sula” kararı vermemeli.',
    );
  }

  if (
    areaDecare ===
      null ||
    areaDecare <= 0
  ) {
    missing.push(
      'field_area',
    );

    warnings.push(
      'Tarla alanı bulunamadığı için toplam sulama suyu hesabı yapılamaz.',
    );
  }

  if (!lastIrrigation) {
    missing.push(
      'last_irrigation',
    );

    warnings.push(
      'Tarla günlüğünde henüz Sulama kaydı yok. Bu durum “hiç sulanmadı” olarak otomatik yorumlanmamalı.',
    );
  } else if (
    lastIrrigation
      .appliedWaterMm ===
      null
  ) {
    warnings.push(
      'Son sulama tarihi bulundu ancak uygulanan su miktarı belirlenemedi.',
    );
  }

  const quality =
    resolveQuality(
      irrigationStatus,
      areaDecare,
    );

  return {
    fieldId,

    fieldName:
      textOrNull(
        dbField.name,
      ),

    cropName:
      textOrNull(
        dbField.crop,
      ),

    cropSubtype:
      (() => {
        const raw =
          String(
            dbField.crop_subtype ??
            '',
          )
            .trim()
            .toLocaleLowerCase(
              'tr-TR',
            );

        if (
          raw ===
            'table' ||
          raw ===
            'sofralık' ||
          raw ===
            'sofralik'
        ) {
          return 'table';
        }

        if (
          raw ===
            'wine' ||
          raw ===
            'şaraplık' ||
          raw ===
            'saraplik'
        ) {
          return 'wine';
        }

        return null;
      })(),

    areaDecare,

    irrigationStatus,
    irrigationStatusRaw,
    irrigationMethod: normalizeIrrigationMethod(dbField.irrigation_method),

    lastIrrigation,

    quality,

    missing,
    warnings,

    source: {
      field:
        'supabase.fields',

      irrigationHistory:
        'supabase.activities',
    },

    generatedAt:
      new Date()
        .toISOString(),
  };
}
