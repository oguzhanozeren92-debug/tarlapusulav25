import {
  supabase,
} from '../../../supabaseClient';

import {
  fetchSoilGridsProfile,
} from '../../../services/soilGridsService';

import type {
  SoilWaterProfile,
  SoilWaterProfileQuality,
  SoilWaterProfileSource,
} from '../types/soilWaterProfile';

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

function round4(
  value: number,
) {
  return Number(
    value.toFixed(4),
  );
}

function round2(
  value: number,
) {
  return Number(
    value.toFixed(2),
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function normalizePercent(
  value: unknown,
): number | null {
  const number =
    finiteNumber(value);

  if (number === null) {
    return null;
  }

  if (
    number >= 0 &&
    number <= 1
  ) {
    return number * 100;
  }

  if (
    number >= 0 &&
    number <= 100
  ) {
    return number;
  }

  return null;
}

function normalizeTexture(
  sand: number,
  clay: number,
  silt: number,
) {
  const total =
    sand +
    clay +
    silt;

  if (
    total <= 0
  ) {
    throw new Error(
      'Toprak tekstürü normalize edilemedi.',
    );
  }

  return {
    sandPercent:
      (sand / total) *
      100,

    clayPercent:
      (clay / total) *
      100,

    siltPercent:
      (silt / total) *
      100,
  };
}

function getNestedNumber(
  source: any,
  paths:
    string[][],
): number | null {
  for (
    const path
    of paths
  ) {
    let current =
      source;

    for (
      const key
      of path
    ) {
      current =
        current?.[key];
    }

    const number =
      finiteNumber(
        current,
      );

    if (
      number !==
      null
    ) {
      return number;
    }
  }

  return null;
}

function readLabTexture(
  extractedValues: any,
) {
  if (!extractedValues) {
    return null;
  }

  const sand =
    normalizePercent(
      getNestedNumber(
        extractedValues,
        [
          ['sand'],
          ['sandPercent'],
          ['sand_percent'],
          ['texture', 'sand'],
          ['texture', 'sandPercent'],
          ['topsoil', 'sand'],
        ],
      ),
    );

  const clay =
    normalizePercent(
      getNestedNumber(
        extractedValues,
        [
          ['clay'],
          ['clayPercent'],
          ['clay_percent'],
          ['texture', 'clay'],
          ['texture', 'clayPercent'],
          ['topsoil', 'clay'],
        ],
      ),
    );

  const silt =
    normalizePercent(
      getNestedNumber(
        extractedValues,
        [
          ['silt'],
          ['siltPercent'],
          ['silt_percent'],
          ['texture', 'silt'],
          ['texture', 'siltPercent'],
          ['topsoil', 'silt'],
        ],
      ),
    );

  if (
    sand === null ||
    clay === null ||
    silt === null
  ) {
    return null;
  }

  const texture =
    normalizeTexture(
      sand,
      clay,
      silt,
    );

  const organicCarbonGKg =
    getNestedNumber(
      extractedValues,
      [
        ['organicCarbonGKg'],
        ['organic_carbon_gkg'],
        ['organicCarbon'],
        ['soc'],
        ['topsoil', 'organicCarbon'],
      ],
    );

  const organicMatterPercentDirect =
    normalizePercent(
      getNestedNumber(
        extractedValues,
        [
          ['organicMatterPercent'],
          ['organic_matter_percent'],
          ['organicMatter'],
          ['organic_matter'],
        ],
      ),
    );

  return {
    ...texture,

    organicCarbonGKg:
      organicCarbonGKg !==
      null
        ? organicCarbonGKg
        : null,

    organicMatterPercent:
      organicMatterPercentDirect,
  };
}

function organicMatterFromCarbon(
  organicCarbonGKg:
    | number
    | null,
) {
  if (
    organicCarbonGKg ===
    null
  ) {
    return null;
  }

  /*
    g/kg → yüzde:
    10 g/kg = %1 organik karbon.

    Van Bemmelen yaklaşımı:
    OM ≈ OC × 1.724
  */
  const organicCarbonPercent =
    organicCarbonGKg /
    10;

  return (
    organicCarbonPercent *
    1.724
  );
}

function calculateSaxtonRawls(
  sandPercent: number,
  clayPercent: number,
  organicMatterPercent:
    number | null,
) {
  /*
    Saxton & Rawls (2006).

    S ve C burada 0–1 fraksiyonudur.
    OM yüzde ağırlık olarak kullanılır.
  */
  const S =
    clamp(
      sandPercent /
        100,
      0,
      1,
    );

  const C =
    clamp(
      clayPercent /
        100,
      0,
      1,
    );

  /*
    OM bilinmiyorsa 0 kabul edip gizlice
    tam güven üretmiyoruz; caller warning ekler.
  */
  const OM =
    clamp(
      organicMatterPercent ??
        0,
      0,
      20,
    );

  const theta1500t =
    -0.024 * S +
    0.487 * C +
    0.006 * OM +
    0.005 * S * OM -
    0.013 * C * OM +
    0.068 * S * C +
    0.031;

  const pwp =
    theta1500t +
    (
      0.14 *
        theta1500t -
      0.02
    );

  const theta33t =
    -0.251 * S +
    0.195 * C +
    0.011 * OM +
    0.006 * S * OM -
    0.027 * C * OM +
    0.452 * S * C +
    0.299;

  const fc =
    theta33t +
    (
      1.283 *
        theta33t *
        theta33t -
      0.374 *
        theta33t -
      0.015
    );

  /*
    Fiziksel güvenlik sınırları.
    PTF tahminidir; ölçüm değildir.
  */
  const safePwp =
    clamp(
      pwp,
      0.02,
      0.60,
    );

  const safeFc =
    clamp(
      fc,
      safePwp +
        0.01,
      0.70,
    );

  const availableFraction =
    safeFc -
    safePwp;

  return {
    fieldCapacityVol:
      round4(
        safeFc,
      ),

    permanentWiltingPointVol:
      round4(
        safePwp,
      ),

    plantAvailableWaterFraction:
      round4(
        availableFraction,
      ),

    availableWaterCapacityMmPerM:
      round2(
        availableFraction *
        1000,
      ),

    availableWaterCapacityMmPerCm:
      round4(
        availableFraction *
        10,
      ),
  };
}

function resolveCoordinates(
  field: any,
) {
  const latitude =
    finiteNumber(
      field
        ?.parcel_centroid_lat ??
      field
        ?.latitude,
    );

  const longitude =
    finiteNumber(
      field
        ?.parcel_centroid_lng ??
      field
        ?.longitude,
    );

  if (
    latitude === null ||
    longitude === null
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

export async function loadSoilWaterProfile(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<SoilWaterProfile> {
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
      'Toprak su profili için tarla kimliği bulunamadı.',
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
      'Toprak su profili için oturum bulunamadı.',
    );
  }

  const [
    fieldResult,
    labResult,
  ] =
    await Promise.all([
      supabase
        .from('fields')
        .select(
          [
            'id',
            'latitude',
            'longitude',
            'parcel_centroid_lat',
            'parcel_centroid_lng',
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
        .maybeSingle(),

      supabase
        .from('soil_analyses')
        .select(
          'id, extracted_values, status, created_at',
        )
        .eq(
          'field_id',
          fieldId,
        )
        .eq(
          'user_id',
          user.id,
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
    labResult.error
  ) {
    throw labResult.error;
  }

  const dbField =
    fieldResult.data;

  if (!dbField) {
    throw new Error(
      'Toprak su profili için tarla bulunamadı veya erişim yok.',
    );
  }

  const warnings:
    string[] = [];

  const evidence:
    string[] = [];

  let source:
    SoilWaterProfileSource;

  let quality:
    SoilWaterProfileQuality;

  let sandPercent:
    number;

  let clayPercent:
    number;

  let siltPercent:
    number;

  let organicCarbonGKg:
    | number
    | null;

  let organicMatterPercent:
    | number
    | null;

  const labTexture =
    readLabTexture(
      labResult
        .data
        ?.extracted_values,
    );

  if (labTexture) {
    source =
      'laboratory';

    quality =
      'measured_context';

    sandPercent =
      labTexture
        .sandPercent;

    clayPercent =
      labTexture
        .clayPercent;

    siltPercent =
      labTexture
        .siltPercent;

    organicCarbonGKg =
      labTexture
        .organicCarbonGKg;

    organicMatterPercent =
      labTexture
        .organicMatterPercent ??
      organicMatterFromCarbon(
        organicCarbonGKg,
      );

    evidence.push(
      'Kil/kum/silt verisi son laboratuvar/toprak analizi kaydından alındı.',
    );
  } else {
    const coordinates =
      resolveCoordinates(
        dbField,
      );

    if (!coordinates) {
      throw new Error(
        'Toprak su profili için koordinat bulunamadı.',
      );
    }

    const soilGrids =
      await fetchSoilGridsProfile(
        coordinates.latitude,
        coordinates.longitude,
      );

    const sand =
      finiteNumber(
        soilGrids
          .texture
          .sandPercent,
      );

    const clay =
      finiteNumber(
        soilGrids
          .texture
          .clayPercent,
      );

    const silt =
      finiteNumber(
        soilGrids
          .texture
          .siltPercent,
      );

    if (
      sand === null ||
      clay === null ||
      silt === null
    ) {
      throw new Error(
        'SoilGrids geçerli tekstür profili döndürmedi.',
      );
    }

    const normalized =
      normalizeTexture(
        sand,
        clay,
        silt,
      );

    source =
      'soilgrids';

    quality =
      'model_estimate';

    sandPercent =
      normalized
        .sandPercent;

    clayPercent =
      normalized
        .clayPercent;

    siltPercent =
      normalized
        .siltPercent;

    organicCarbonGKg =
      finiteNumber(
        soilGrids
          .properties
          .organicCarbon
          .topsoil0To30,
      );

    organicMatterPercent =
      organicMatterFromCarbon(
        organicCarbonGKg,
      );

    evidence.push(
      'Kil/kum/silt profili SoilGrids 0–30 cm model tahmininden alındı.',
    );

    warnings.push(
      'Laboratuvar tekstür verisi olmadığı için SoilGrids yaklaşık 250 m model tahmini kullanıldı.',
    );
  }

  if (
    organicMatterPercent ===
    null
  ) {
    warnings.push(
      'Organik madde bulunamadı; su tutma tahmininde OM=0 kullanıldı. Sonuç güveni düşüktür.',
    );
  }

  const water =
    calculateSaxtonRawls(
      sandPercent,
      clayPercent,
      organicMatterPercent,
    );

  evidence.push(
    `Tekstür: kum %${sandPercent.toFixed(1)}, kil %${clayPercent.toFixed(1)}, silt %${siltPercent.toFixed(1)}.`,
  );

  if (
    organicMatterPercent !==
    null
  ) {
    evidence.push(
      `Tahmini organik madde: %${organicMatterPercent.toFixed(2)}.`,
    );
  }

  evidence.push(
    `Bitkiye kullanılabilir su kapasitesi: yaklaşık ${water.availableWaterCapacityMmPerM.toFixed(1)} mm/m.`,
  );

  return {
    fieldId,

    source,
    quality,

    texture: {
      sandPercent:
        round2(
          sandPercent,
        ),

      clayPercent:
        round2(
          clayPercent,
        ),

      siltPercent:
        round2(
          siltPercent,
        ),

      organicCarbonGKg:
        organicCarbonGKg !==
        null
          ? round2(
              organicCarbonGKg,
            )
          : null,

      organicMatterPercent:
        organicMatterPercent !==
        null
          ? round2(
              organicMatterPercent,
            )
          : null,
    },

    fieldCapacityVol:
      water
        .fieldCapacityVol,

    permanentWiltingPointVol:
      water
        .permanentWiltingPointVol,

    plantAvailableWaterFraction:
      water
        .plantAvailableWaterFraction,

    availableWaterCapacityMmPerM:
      water
        .availableWaterCapacityMmPerM,

    availableWaterCapacityMmPerCm:
      water
        .availableWaterCapacityMmPerCm,

    warnings,
    evidence,

    caution:
      'Bu toprak su kapasitesi Saxton–Rawls pedotransfer fonksiyonuyla tekstür ve organik maddeden tahmin edilir. Özellikle SoilGrids kullanıldığında laboratuvar/field ölçümü değildir; sulama kararında ölçüm varsa her zaman ölçüm önceliklidir.',

    generatedAt:
      new Date()
        .toISOString(),
  };
}
