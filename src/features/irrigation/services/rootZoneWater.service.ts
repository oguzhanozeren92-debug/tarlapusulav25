import {
  supabase,
} from '../../../supabaseClient';

import {
  calculateCropWaterUse,
} from './cropWaterUse.service';

import {
  loadSoilWaterProfile,
} from './soilWaterProfile.service';

import {
  ROOT_ZONE_CROP_PROFILES,
} from '../data/rootZoneProfiles.ts';

import type {
  RootZoneCropProfile,
  RootZoneWaterResult,
  RootZoneWaterStatus,
} from '../types/rootZoneWater';

function normalizeText(
  value: unknown,
) {
  return String(
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
}

function normalizeCropSubtype(
  value: unknown,
):
  | 'table'
  | 'wine'
  | null {
  const normalized =
    normalizeText(
      value,
    );

  if (
    normalized ===
      'table' ||
    normalized ===
      'sofralık' ||
    normalized ===
      'sofralik'
  ) {
    return 'table';
  }

  if (
    normalized ===
      'wine' ||
    normalized ===
      'şaraplık' ||
    normalized ===
      'saraplik'
  ) {
    return 'wine';
  }

  return null;
}

function isGrape(
  cropName: unknown,
) {
  return [
    'üzüm',
    'uzum',
    'grape',
    'grapes',
  ].includes(
    normalizeText(
      cropName,
    ),
  );
}

function findProfile(
  cropName: unknown,
  cropSubtype: unknown,
): RootZoneCropProfile | null {
  const normalized =
    normalizeText(
      cropName,
    );

  if (!normalized) {
    return null;
  }

  const subtype =
    normalizeCropSubtype(
      cropSubtype,
    );

  const candidates =
    ROOT_ZONE_CROP_PROFILES.filter(
      (profile) =>
        normalizeText(
          profile.displayName,
        ) ===
          normalized ||
        profile.aliases.some(
          (alias) =>
            normalizeText(
              alias,
            ) ===
            normalized,
        ),
    );

  if (!candidates.length) {
    return null;
  }

  if (
    isGrape(
      cropName,
    )
  ) {
    if (!subtype) {
      return null;
    }

    return (
      candidates.find(
        (profile) =>
          profile.cropSubtype ===
          subtype,
      ) ??
      null
    );
  }

  return (
    candidates.find(
      (profile) =>
        profile.cropSubtype ===
        null,
    ) ??
    null
  );
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

function round3(
  value: number,
) {
  return Number(
    value.toFixed(3),
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

function resolveStatus(
  profile:
    RootZoneCropProfile | null,
  soilCapacity:
    number | null,
  cropWaterUseStatus:
    string,
):
  RootZoneWaterStatus {
  if (
    !profile ||
    soilCapacity ===
      null
  ) {
    return 'blocked';
  }

  if (
    cropWaterUseStatus ===
    'usable'
  ) {
    return 'usable';
  }

  return 'partial';
}

function formatMm(
  value:
    | number
    | null,
) {
  return value === null
    ? 'hesaplanamadı'
    : `${value.toFixed(1)} mm`;
}

export async function calculateRootZoneWaterCapacity(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<RootZoneWaterResult> {
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
      'Kök bölgesi su hesabı için tarla kimliği bulunamadı.',
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
      'Kök bölgesi su hesabı için oturum bulunamadı.',
    );
  }

  const {
    data: dbField,
    error: fieldError,
  } =
    await supabase
      .from('fields')
      .select(
        'id, name, crop, crop_subtype',
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
      'Kök bölgesi su hesabı için tarla bulunamadı veya erişim yok.',
    );
  }

  const cropSubtype =
    normalizeCropSubtype(
      dbField.crop_subtype,
    );

  const profile =
    findProfile(
      dbField.crop,
      cropSubtype,
    );

  const [
    soil,
    cropWaterUse,
  ] =
    await Promise.all([
      loadSoilWaterProfile({
        id:
          fieldId,
      }),

      calculateCropWaterUse({
        id:
          fieldId,
      }),
    ]);

  const soilCapacity =
    finiteNumber(
      soil
        .availableWaterCapacityMmPerM,
    );

  const schedulingDepthM =
    profile
      ?.rootDepthMinM ??
    null;

  const totalAvailableWaterMm =
    soilCapacity !== null &&
    schedulingDepthM !==
      null
      ? round2(
          soilCapacity *
          schedulingDepthM,
        )
      : null;

  const forecastAverageCropWaterUseMmPerDay =
    cropWaterUse
      .forecast5Days
      .estimatedCropWaterUseMm !==
        null &&
    cropWaterUse
      .forecast5Days
      .validDayCount >
        0
      ? round3(
          cropWaterUse
            .forecast5Days
            .estimatedCropWaterUseMm /
          cropWaterUse
            .forecast5Days
            .validDayCount,
        )
      : null;

  const baseFractionP =
    profile
      ?.depletionFractionP ??
    null;

  /*
    FAO-56 Table 22:
    p = p_table + 0.04(5 - ETc)

    Sonuç 0.1–0.8 aralığına sınırlandırılır.
  */
  const adjustedFractionP =
    baseFractionP !==
      null &&
    forecastAverageCropWaterUseMmPerDay !==
      null
      ? round3(
          clamp(
            baseFractionP +
              0.04 *
                (
                  5 -
                  forecastAverageCropWaterUseMmPerDay
                ),
            0.1,
            0.8,
          ),
        )
      : baseFractionP;

  const readilyAvailableWaterMm =
    totalAvailableWaterMm !==
      null &&
    adjustedFractionP !==
      null
      ? round2(
          totalAvailableWaterMm *
          adjustedFractionP,
        )
      : null;

  const status =
    resolveStatus(
      profile,
      soilCapacity,
      cropWaterUse
        .status,
    );

  const evidence:
    string[] = [
      ...soil
        .evidence,
    ];

  const warnings:
    string[] = [
      ...soil
        .warnings,
    ];

  if (profile) {
    evidence.push(
      `FAO-56 kök derinliği aralığı: ${profile.rootDepthMinM.toFixed(1)}–${profile.rootDepthMaxM.toFixed(1)} m.`,
    );

    evidence.push(
      `Sulama planlamasında ihtiyatlı olarak ${profile.rootDepthMinM.toFixed(1)} m kök derinliği kullanıldı.`,
    );

    evidence.push(
      `FAO-56 temel su tüketim eşiği p=${profile.depletionFractionP.toFixed(2)}.`,
    );
  } else if (
    isGrape(
      dbField.crop,
    ) &&
    !cropSubtype
  ) {
    warnings.push(
      'Üzüm için Sofralık / Şaraplık seçimi yapılmadan kök bölgesi stres eşiği hesaplanmadı.',
    );
  } else {
    warnings.push(
      `${String(dbField.crop ?? 'Ürün')} için kök bölgesi profili henüz tanımlı değil.`,
    );
  }

  if (
    forecastAverageCropWaterUseMmPerDay !==
      null &&
    adjustedFractionP !==
      null &&
    baseFractionP !==
      null
  ) {
    evidence.push(
      `Önümüzdeki günlerin ortalama bitki su tüketimi ${forecastAverageCropWaterUseMmPerDay.toFixed(2)} mm/gün olduğu için p değeri ${baseFractionP.toFixed(2)} → ${adjustedFractionP.toFixed(3)} olarak ayarlandı.`,
    );
  } else if (
    baseFractionP !==
    null
  ) {
    warnings.push(
      'Günlük bitki su tüketimi kullanılamadığı için FAO-56 temel p değeri değiştirilmeden kullanıldı.',
    );
  }

  return {
    fieldId,

    fieldName:
      String(
        dbField.name ??
        '',
      ).trim() ||
      null,

    cropName:
      String(
        dbField.crop ??
        '',
      ).trim() ||
      null,

    cropSubtype,

    status,

    rootZone: {
      schedulingDepthM,

      rangeMinM:
        profile
          ?.rootDepthMinM ??
        null,

      rangeMaxM:
        profile
          ?.rootDepthMaxM ??
        null,

      depthSource:
        profile
          ? 'fao56_lower_bound'
          : null,
    },

    soil: {
      availableWaterCapacityMmPerM:
        soilCapacity,

      source:
        soil.source,

      quality:
        soil.quality,
    },

    totalAvailableWaterMm,

    depletion: {
      baseFractionP,

      adjustedFractionP,

      forecastAverageCropWaterUseMmPerDay,

      readilyAvailableWaterMm,
    },

    display: {
      storageLabel:
        `Kök bölgesinin yaklaşık su deposu: ${formatMm(
          totalAvailableWaterMm,
        )}`,

      stressFreeLabel:
        `Stres başlamadan kullanılabilir bölüm: ${formatMm(
          readilyAvailableWaterMm,
        )}`,

      note:
        'Bu değerler toprağın kapasitesidir; tarlada şu anda gerçekten ne kadar su kaldığını göstermez. Mevcut su açığı son sulama, yağış ve bitki tüketimiyle bir sonraki adımda hesaplanacaktır.',
    },

    evidence,
    warnings,

    caution:
      'Kök bölgesi kapasitesi, FAO-56 kök derinliği ve SoilGrids/laboratuvar tabanlı toprak su kapasitesinden tahmin edilir. Özellikle SoilGrids kullanıldığında bu bir planlama tahminidir; gerçek kök derinliği veya toprak nem ölçümü varsa onlar önceliklidir.',

    generatedAt:
      new Date()
        .toISOString(),
  };
}
