import {
  supabase,
} from '../../../supabaseClient';

import type {
  IrrigationClimateContext,
  IrrigationClimateDay,
  IrrigationClimateQuality,
} from '../types/irrigationClimate';

const OPEN_METEO_FORECAST =
  'https://api.open-meteo.com/v1/forecast';

const PAST_DAYS = 7;
const FORECAST_DAYS = 5;

/*
  0.5 mm altındaki çok küçük tahminleri
  operasyonel "yağış geliyor" sinyali
  olarak öne çıkarmıyoruz.
*/
const MEANINGFUL_RAIN_MM =
  0.5;

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

function round3(
  value:
    | number
    | null,
) {
  return value === null
    ? null
    : Number(
        value.toFixed(3),
      );
}

function isoDate(
  date: Date,
) {
  return date
    .toISOString()
    .slice(0, 10);
}

function todayUtc() {
  const now =
    new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
}

function walkCoordinates(
  value: any,
  sink:
    Array<
      [
        number,
        number,
      ]
    >,
) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2 &&
    Number.isFinite(
      Number(value[0]),
    ) &&
    Number.isFinite(
      Number(value[1]),
    )
  ) {
    const longitude =
      Number(value[0]);

    const latitude =
      Number(value[1]);

    if (
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    ) {
      sink.push([
        longitude,
        latitude,
      ]);
    }

    return;
  }

  for (
    const child
    of value
  ) {
    walkCoordinates(
      child,
      sink,
    );
  }
}

function geometryCenter(
  parcelGeometry: any,
) {
  const geometry =
    parcelGeometry
      ?.geometry ??
    parcelGeometry;

  const coordinates =
    geometry?.coordinates;

  if (!coordinates) {
    return null;
  }

  const points:
    Array<
      [
        number,
        number,
      ]
    > = [];

  walkCoordinates(
    coordinates,
    points,
  );

  if (!points.length) {
    return null;
  }

  let west =
    Infinity;
  let east =
    -Infinity;
  let south =
    Infinity;
  let north =
    -Infinity;

  for (
    const [
      longitude,
      latitude,
    ]
    of points
  ) {
    west =
      Math.min(
        west,
        longitude,
      );

    east =
      Math.max(
        east,
        longitude,
      );

    south =
      Math.min(
        south,
        latitude,
      );

    north =
      Math.max(
        north,
        latitude,
      );
  }

  return {
    latitude:
      (south + north) /
      2,

    longitude:
      (west + east) /
      2,
  };
}

type FieldLocation = {
  latitude: number;
  longitude: number;

  source:
    IrrigationClimateContext[
      'location'
    ]['source'];
};

function resolveLocation(
  field: any,
): FieldLocation | null {
  const centroidLat =
    finiteNumber(
      field
        ?.parcel_centroid_lat ??
      field
        ?.parcelCentroidLat,
    );

  const centroidLng =
    finiteNumber(
      field
        ?.parcel_centroid_lng ??
      field
        ?.parcelCentroidLng,
    );

  if (
    centroidLat !== null &&
    centroidLng !== null &&
    centroidLat >= -90 &&
    centroidLat <= 90 &&
    centroidLng >= -180 &&
    centroidLng <= 180
  ) {
    return {
      latitude:
        centroidLat,

      longitude:
        centroidLng,

      source:
        'parcel_centroid',
    };
  }

  const latitude =
    finiteNumber(
      field?.latitude,
    );

  const longitude =
    finiteNumber(
      field?.longitude,
    );

  if (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return {
      latitude,
      longitude,

      source:
        'field_coordinates',
    };
  }

  const geometry =
    geometryCenter(
      field
        ?.parcel_geometry ??
      field
        ?.parcelGeometry,
    );

  if (geometry) {
    return {
      ...geometry,

      source:
        'parcel_geometry',
    };
  }

  return null;
}

function buildDay(
  date: string,
  etoValue: unknown,
  rainValue: unknown,
  kind:
    IrrigationClimateDay[
      'kind'
    ],
): IrrigationClimateDay {
  const etoMm =
    finiteNumber(
      etoValue,
    );

  const precipitationMm =
    finiteNumber(
      rainValue,
    );

  const referenceDeficitMm =
    etoMm === null ||
    precipitationMm ===
      null
      ? null
      : Math.max(
          0,
          etoMm -
            precipitationMm,
        );

  return {
    date,

    etoMm:
      round3(
        etoMm,
      ),

    precipitationMm:
      round3(
        precipitationMm,
      ),

    referenceDeficitMm:
      round3(
        referenceDeficitMm,
      ),

    kind,
  };
}

function sumAvailable(
  days:
    IrrigationClimateDay[],
  key:
    | 'etoMm'
    | 'precipitationMm'
    | 'referenceDeficitMm',
) {
  const values =
    days
      .map(
        (day) =>
          day[key],
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value,
          ),
      );

  if (!values.length) {
    return null;
  }

  return round3(
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ),
  );
}

function validDayCount(
  days:
    IrrigationClimateDay[],
) {
  return days.filter(
    (day) =>
      day.etoMm !==
        null &&
      day.precipitationMm !==
        null,
  ).length;
}

function resolveQuality(
  pastCount: number,
  forecastCount: number,
):
  IrrigationClimateQuality {
  if (
    pastCount >= 5 &&
    forecastCount >= 3
  ) {
    return 'usable';
  }

  if (
    pastCount >= 3 ||
    forecastCount >= 2
  ) {
    return 'partial';
  }

  return 'insufficient';
}

export async function loadIrrigationClimateContext(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<IrrigationClimateContext> {
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
      'Sulama iklim bağlamı için tarla kimliği bulunamadı.',
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
      'Sulama iklim bağlamı için oturum bulunamadı.',
    );
  }

  const {
    data: dbField,
    error: fieldError,
  } =
    await supabase
      .from('fields')
      .select(
        [
          'id',
          'latitude',
          'longitude',
          'parcel_centroid_lat',
          'parcel_centroid_lng',
          'parcel_geometry',
        ].join(', '),
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

  if (fieldError) {
    throw fieldError;
  }

  if (!dbField) {
    throw new Error(
      'Sulama iklim bağlamı için tarla bulunamadı veya erişim yok.',
    );
  }

  const location =
    resolveLocation(
      dbField,
    );

  if (!location) {
    throw new Error(
      'Sulama iklim bağlamı için tarla koordinatı bulunamadı.',
    );
  }

  /*
    Tek istek:
    - son 7 gün
    - bugün + 4 gün
    - günlük FAO-56 ET₀
    - günlük yağış

    ET₀ özellikle DAILY istenir.
  */
  const params =
    new URLSearchParams({
      latitude:
        location.latitude
          .toFixed(5),

      longitude:
        location.longitude
          .toFixed(5),

      daily:
        [
          'et0_fao_evapotranspiration',
          'precipitation_sum',
        ].join(','),

      past_days:
        String(
          PAST_DAYS,
        ),

      forecast_days:
        String(
          FORECAST_DAYS,
        ),

      timezone:
        'UTC',
    });

  const response =
    await fetch(
      `${OPEN_METEO_FORECAST}?${params.toString()}`,
    );

  if (!response.ok) {
    throw new Error(
      `Sulama iklim servisi Open-Meteo ${response.status} hatası verdi.`,
    );
  }

  const payload =
    await response.json();

  const dates =
    Array.isArray(
      payload?.daily?.time,
    )
      ? payload.daily.time
      : [];

  const etoValues =
    Array.isArray(
      payload
        ?.daily
        ?.et0_fao_evapotranspiration,
    )
      ? payload
          .daily
          .et0_fao_evapotranspiration
      : [];

  const rainValues =
    Array.isArray(
      payload
        ?.daily
        ?.precipitation_sum,
    )
      ? payload
          .daily
          .precipitation_sum
      : [];

  if (!dates.length) {
    throw new Error(
      'Sulama iklim servisi günlük veri döndürmedi.',
    );
  }

  const today =
    isoDate(
      todayUtc(),
    );

  const past:
    IrrigationClimateDay[] =
    [];

  const forecast:
    IrrigationClimateDay[] =
    [];

  for (
    let index = 0;
    index <
    dates.length;
    index++
  ) {
    const date =
      String(
        dates[index] ??
        '',
      );

    if (!date) {
      continue;
    }

    const kind:
      IrrigationClimateDay[
        'kind'
      ] =
      date < today
        ? 'past'
        : 'forecast';

    const day =
      buildDay(
        date,
        etoValues[index],
        rainValues[index],
        kind,
      );

    if (
      kind === 'past'
    ) {
      past.push(day);
    } else {
      forecast.push(day);
    }
  }

  const past7Days =
    past
      .slice(-PAST_DAYS);

  const forecast5Days =
    forecast
      .slice(
        0,
        FORECAST_DAYS,
      );

  const pastCount =
    validDayCount(
      past7Days,
    );

  const forecastCount =
    validDayCount(
      forecast5Days,
    );

  const quality =
    resolveQuality(
      pastCount,
      forecastCount,
    );

  const warnings:
    string[] = [];

  if (
    pastCount <
    PAST_DAYS
  ) {
    warnings.push(
      `Son 7 gün için ${pastCount}/${PAST_DAYS} gün kullanılabilir ET₀ + yağış verisi bulundu.`,
    );
  }

  if (
    forecastCount <
    FORECAST_DAYS
  ) {
    warnings.push(
      `5 günlük tahmin için ${forecastCount}/${FORECAST_DAYS} gün kullanılabilir ET₀ + yağış verisi bulundu.`,
    );
  }

  const nextMeaningfulRain =
    forecast5Days.find(
      (day) =>
        day.precipitationMm !==
          null &&
        day.precipitationMm >=
          MEANINGFUL_RAIN_MM,
    );

  return {
    fieldId,

    location,

    past7Days: {
      days:
        past7Days,

      etoMm:
        sumAvailable(
          past7Days,
          'etoMm',
        ),

      precipitationMm:
        sumAvailable(
          past7Days,
          'precipitationMm',
        ),

      referenceDeficitMm:
        sumAvailable(
          past7Days,
          'referenceDeficitMm',
        ),

      validDayCount:
        pastCount,
    },

    forecast5Days: {
      days:
        forecast5Days,

      etoMm:
        sumAvailable(
          forecast5Days,
          'etoMm',
        ),

      precipitationMm:
        sumAvailable(
          forecast5Days,
          'precipitationMm',
        ),

      referenceDeficitMm:
        sumAvailable(
          forecast5Days,
          'referenceDeficitMm',
        ),

      validDayCount:
        forecastCount,

      nextMeaningfulRain:
        nextMeaningfulRain &&
        nextMeaningfulRain
          .precipitationMm !==
          null
          ? {
              date:
                nextMeaningfulRain
                  .date,

              precipitationMm:
                nextMeaningfulRain
                  .precipitationMm,
            }
          : null,
    },

    quality,

    warnings,

    source: {
      provider:
        'Open-Meteo',

      eto:
        'FAO-56 reference evapotranspiration (ET₀)',

      precipitation:
        'Open-Meteo daily precipitation',

      endpoint:
        'forecast',
    },

    caution:
      'ET₀ referans evapotranspirasyondur. Bu çıktı ürün su tüketimi (ETc), toprak su açığı veya doğrudan sulama miktarı değildir. Ürün katsayısı, fenoloji, toprak su tutma kapasitesi ve sulama kayıtları Decision Layer’da ayrıca uygulanmalıdır.',

    generatedAt:
      new Date()
        .toISOString(),
  };
}
