import {
  supabase,
} from '../../../supabaseClient';

export type FieldPhenologyContext = {
  fieldId: string;

  cropName:
    | string
    | null;

  cropCycle:
    | 'annual'
    | 'perennial'
    | 'unknown';

  seasonYear:
    | number
    | null;

  plantingYear:
    | number
    | null;

  bearing:
    | boolean
    | null;

  actualPlantingDate:
    | string
    | null;

  actualHarvestDate:
    | string
    | null;

  seasonRecordId:
    | string
    | null;

  hasSeasonRecord:
    boolean;

  needsCropCalendar:
    boolean;

  source:
    | 'field+season_history'
    | 'field_only'
    | 'database_field'
    | 'database_field+season_history';
};

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

function numberOrNull(
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

function booleanOrNull(
  value: unknown,
): boolean | null {
  if (
    typeof value ===
    'boolean'
  ) {
    return value;
  }

  if (
    value === 1 ||
    value === '1' ||
    value === 'true'
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === '0' ||
    value === 'false'
  ) {
    return false;
  }

  return null;
}

function normalizeCropCycle(
  value: unknown,
):
  | 'annual'
  | 'perennial'
  | 'unknown' {
  const normalized =
    String(
      value ?? '',
    )
      .trim()
      .toLowerCase();

  if (
    normalized ===
    'annual'
  ) {
    return 'annual';
  }

  if (
    normalized ===
    'perennial'
  ) {
    return 'perennial';
  }

  return 'unknown';
}

function normalizeDate(
  value: unknown,
): string | null {
  const text =
    textOrNull(value);

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function dateIsTodayOrPast(
  value: string,
  now =
    new Date(),
) {
  const date =
    new Date(
      `${value}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return false;
  }

  const todayUtc =
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

  return (
    date.getTime() <=
    todayUtc
  );
}

type AuthoritativeField = {
  crop:
    | string
    | null;

  season:
    | number
    | null;

  crop_cycle:
    | string
    | null;

  planting_year:
    | number
    | null;

  bearing:
    | boolean
    | null;
};

async function readAuthoritativeField(
  fieldId: string,
): Promise<
  AuthoritativeField | null
> {
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
      'Fenoloji bağlamı için oturum bulunamadı.',
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('fields')
      .select(
        'crop, season, crop_cycle, planting_year, bearing',
      )
      .eq(
        'id',
        fieldId,
      )
      .eq(
        'user_id',
        user.id,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    crop:
      textOrNull(
        data.crop,
      ),

    season:
      numberOrNull(
        data.season,
      ),

    crop_cycle:
      textOrNull(
        data.crop_cycle,
      ),

    planting_year:
      numberOrNull(
        data.planting_year,
      ),

    bearing:
      booleanOrNull(
        data.bearing,
      ),
  };
}

export async function loadFieldPhenologyContext(
  field: any,
): Promise<FieldPhenologyContext> {
  if (
    field?.id ===
      null ||
    field?.id ===
      undefined
  ) {
    throw new Error(
      'Fenoloji bağlamı için tarla kimliği bulunamadı.',
    );
  }

  const fieldId =
    String(
      field.id,
    );

  /*
    KRİTİK:
    Frontend objesinde cropCycle eksik olabilir.
    Fenoloji için gerçek üretim profilini DB'den okuyup
    tarla objesini yalnızca fallback olarak kullanıyoruz.
  */
  let dbField:
    AuthoritativeField | null =
    null;

  try {
    dbField =
      await readAuthoritativeField(
        fieldId,
      );
  } catch (error) {
    console.warn(
      '[TarlaPusula] Fenoloji için fields kaydı okunamadı; frontend tarla verisi kullanılacak:',
      error,
    );
  }

  const cropName =
    dbField?.crop ??
    textOrNull(
      field.cropName ??
      field.crop,
    );

  const cropCycle =
    normalizeCropCycle(
      dbField?.crop_cycle ??
      field.cropCycle ??
      field.crop_cycle,
    );

  const seasonYear =
    dbField?.season ??
    numberOrNull(
      field.season,
    );

  const plantingYear =
    dbField?.planting_year ??
    numberOrNull(
      field.plantingYear ??
      field.planting_year,
    );

  const bearing =
    dbField?.bearing ??
    booleanOrNull(
      field.bearing,
    );

  /*
    Çok yıllık üründe dikim yılı,
    BU YILIN fenoloji başlangıcı değildir.
    Ürün takvimi + ERA5 düzeltmesi kullanılacaktır.
  */
  if (
    cropCycle ===
    'perennial'
  ) {
    return {
      fieldId,
      cropName,
      cropCycle,
      seasonYear,
      plantingYear,
      bearing,

      actualPlantingDate:
        null,

      actualHarvestDate:
        null,

      seasonRecordId:
        null,

      hasSeasonRecord:
        false,

      needsCropCalendar:
        true,

      source:
        dbField
          ? 'database_field'
          : 'field_only',
    };
  }

  /*
    Crop cycle hâlâ bilinmiyorsa
    annual varsaymıyoruz.
    Yanlış fenoloji üretmek yerine
    açıkça unknown bırakıyoruz.
  */
  if (
    cropCycle ===
    'unknown'
  ) {
    return {
      fieldId,
      cropName,
      cropCycle,
      seasonYear,
      plantingYear,
      bearing,

      actualPlantingDate:
        null,

      actualHarvestDate:
        null,

      seasonRecordId:
        null,

      hasSeasonRecord:
        false,

      needsCropCalendar:
        true,

      source:
        dbField
          ? 'database_field'
          : 'field_only',
    };
  }

  /*
    annual:
    field_seasons yalnızca gerçek üretim geçmişidir.
  */
  let query =
    supabase
      .from(
        'field_seasons',
      )
      .select(
        'id, year, crop, planting_date, harvest_date',
      )
      .eq(
        'field_id',
        fieldId,
      );

  if (
    seasonYear !==
    null
  ) {
    query =
      query.eq(
        'year',
        seasonYear,
      );
  }

  const {
    data,
    error,
  } =
    await query
      .order(
        'year',
        {
          ascending:
            false,
        },
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      fieldId,
      cropName,
      cropCycle,
      seasonYear,
      plantingYear,
      bearing,

      actualPlantingDate:
        null,

      actualHarvestDate:
        null,

      seasonRecordId:
        null,

      hasSeasonRecord:
        false,

      needsCropCalendar:
        true,

      source:
        dbField
          ? 'database_field'
          : 'field_only',
    };
  }

  const actualPlantingDate =
    normalizeDate(
      data.planting_date,
    );

  const rawHarvestDate =
    normalizeDate(
      data.harvest_date,
    );

  const actualHarvestDate =
    rawHarvestDate &&
    dateIsTodayOrPast(
      rawHarvestDate,
    )
      ? rawHarvestDate
      : null;

  return {
    fieldId,

    cropName:
      textOrNull(
        data.crop,
      ) ??
      cropName,

    cropCycle,

    seasonYear:
      numberOrNull(
        data.year,
      ) ??
      seasonYear,

    plantingYear,
    bearing,

    actualPlantingDate,
    actualHarvestDate,

    seasonRecordId:
      textOrNull(
        data.id,
      ),

    hasSeasonRecord:
      true,

    needsCropCalendar:
      true,

    source:
      dbField
        ? 'database_field+season_history'
        : 'field+season_history',
  };
}
