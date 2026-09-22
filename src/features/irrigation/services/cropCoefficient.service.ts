import type {
  PhenologyStage,
} from '../../phenology/types/phenology';

import {
  CROP_COEFFICIENT_PROFILES,
} from '../data/cropCoefficientProfiles';

import type {
  CropCoefficientAnchor,
  CropCoefficientProfile,
  CropCoefficientResult,
} from '../types/cropCoefficient';

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

function round3(
  value: number,
) {
  return Number(
    value.toFixed(3),
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

  return Number.isFinite(number)
    ? number
    : null;
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function normalizeCropSubtype(
  value: unknown,
):
  | 'table'
  | 'wine'
  | null {
  const normalized =
    normalizeText(value);

  if (
    normalized === 'table' ||
    normalized === 'sofralık' ||
    normalized === 'sofralik'
  ) {
    return 'table';
  }

  if (
    normalized === 'wine' ||
    normalized === 'şaraplık' ||
    normalized === 'saraplik'
  ) {
    return 'wine';
  }

  return null;
}

function isGrapeName(
  cropName: unknown,
) {
  const normalized =
    normalizeText(
      cropName,
    );

  return [
    'üzüm',
    'uzum',
    'grape',
    'grapes',
  ].includes(
    normalized,
  );
}

function findProfile(
  cropName: unknown,
  cropSubtype: unknown,
): CropCoefficientProfile | null {
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
    CROP_COEFFICIENT_PROFILES.filter(
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
    isGrapeName(
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
    candidates[0] ??
    null
  );
}

type StageResolution = {
  anchor:
    CropCoefficientAnchor;

  /*
    Kc = ini + (mid-ini)*weight
    veya
    Kc = mid + (end-mid)*weight
  */
  mode:
    | 'initial'
    | 'mid'
    | 'end'
    | 'initial_to_mid'
    | 'mid_to_end';

  weight:
    number;

  explanation:
    string;
};

function resolveStage(
  stage:
    PhenologyStage,
): StageResolution | null {
  switch (stage) {
    case 'dormancy':
    case 'pre_sowing':
      return {
        anchor:
          'initial',

        mode:
          'initial',

        weight:
          0,

        explanation:
          'Dinlenme veya başlangıç dönemi için düşük su ihtiyacı esas alındı.',
      };

    case 'bud_swell':
    case 'bud_break':
    case 'establishment':
      return {
        anchor:
          'development',

        mode:
          'initial_to_mid',

        weight:
          0.30,

        explanation:
          'Erken gelişimde su ihtiyacının yavaş yavaş arttığı kabul edildi.',
      };

    case 'flowering':
      return {
        anchor:
          'development',

        mode:
          'initial_to_mid',

        weight:
          0.55,

        explanation:
          'Çiçeklenmede su ihtiyacının arttığı kabul edildi.',
      };

    case 'fruit_set':
    case 'reproductive':
      return {
        anchor:
          'development',

        mode:
          'initial_to_mid',

        weight:
          0.80,

        explanation:
          'Meyve tutumunda su ihtiyacının en yüksek döneme yaklaştığı kabul edildi.',
      };

    case 'vegetative':
    case 'fruit_growth':
    case 'veraison':
      return {
        anchor:
          'mid',

        mode:
          'mid',

        weight:
          1,

        explanation:
          'Aktif gelişimde yüksek su ihtiyacı esas alındı.',
      };

    case 'maturation':
      return {
        anchor:
          'late',

        mode:
          'mid_to_end',

        weight:
          0.50,

        explanation:
          'Olgunlaşmada su ihtiyacının azalmaya başladığı kabul edildi.',
      };

    case 'harvest_window':
      return {
        anchor:
          'late',

        mode:
          'mid_to_end',

        weight:
          0.85,

        explanation:
          'Hasat döneminde sezon sonundaki su ihtiyacına yakın bir değer kullanıldı.',
      };

    case 'leaf_fall':
    case 'post_harvest':
      return {
        anchor:
          'end',

        mode:
          'end',

        weight:
          1,

        explanation:
          'Hasat sonrası veya yaprak dökümünde sezon sonundaki su ihtiyacı esas alındı.',
      };

    default:
      return null;
  }
}

function calculateKc(
  profile:
    CropCoefficientProfile,
  resolution:
    StageResolution,
) {
  switch (
    resolution.mode
  ) {
    case 'initial':
      return profile
        .kcInitial;

    case 'mid':
      return profile
        .kcMid;

    case 'end':
      return profile
        .kcEnd;

    case 'initial_to_mid':
      return (
        profile.kcInitial +
        (
          profile.kcMid -
          profile.kcInitial
        ) *
          resolution.weight
      );

    case 'mid_to_end':
      return (
        profile.kcMid +
        (
          profile.kcEnd -
          profile.kcMid
        ) *
          resolution.weight
      );
  }
}

export function resolveCropCoefficient(
  input: {
    cropName?:
      unknown;

    cropSubtype?:
      unknown;

    stage:
      PhenologyStage;

    stageLabel?:
      string | null;

    bearing?:
      boolean | null;

    canopyCoverPercent?:
      unknown;

    canopyHeightM?:
      unknown;
  },
): CropCoefficientResult {
  const cropName =
    String(
      input.cropName ??
      '',
    ).trim() ||
    null;

  const cropSubtype =
    normalizeCropSubtype(
      input.cropSubtype,
    );

  if (
    isGrapeName(
      cropName,
    ) &&
    !cropSubtype
  ) {
    return {
      status:
        'needs_crop_subtype',

      cropKey:
        null,

      cropName:
        cropName || 'Üzüm',

      cropSubtype:
        null,

      stage:
        input.stage,

      stageLabel:
        input.stageLabel ??
        null,

      anchor:
        null,

      kc:
        null,

      kcInitial:
        null,

      kcMid:
        null,

      kcEnd:
        null,

      confidence:
        'low',

      bearing:
        input.bearing ??
        null,

      basis:
        [],

      warnings: [
        'Üzümün sofralık mı şaraplık mı olduğunu belirt. Su ihtiyacı hesabı bu iki üzümde farklı yapılır.',
      ],

      caution:
        'Üzüm tipi bilinmediği için bitkinin su tüketimi hesaplanamadı.',

      source:
        null,
    };
  }

  const profile =
    findProfile(
      cropName,
      cropSubtype,
    );

  if (!profile) {
    return {
      status:
        'unsupported_crop',

      cropKey:
        null,

      cropName,

      cropSubtype,

      stage:
        input.stage,

      stageLabel:
        input.stageLabel ??
        null,

      anchor:
        null,

      kc:
        null,

      kcInitial:
        null,

      kcMid:
        null,

      kcEnd:
        null,

      confidence:
        'low',

      bearing:
        input.bearing ??
        null,

      basis:
        [],

      warnings: [
        cropName
          ? `${cropName} için doğrulanmış su ihtiyacı bilgisi henüz tanımlı değil.`
          : 'Ürün adı bulunamadı.',
      ],

      caution:
        'Bitkinin su tüketimi için yeterli bilgi yok; tahmini miktar hesaplanmadı.',

      source:
        null,
    };
  }

  const resolution =
    resolveStage(
      input.stage,
    );

  if (!resolution) {
    return {
      status:
        'unknown_stage',

      cropKey:
        profile.cropKey,

      cropName:
        profile.displayName,

      cropSubtype:
        profile.cropSubtype,

      stage:
        input.stage,

      stageLabel:
        input.stageLabel ??
        null,

      anchor:
        null,

      kc:
        null,

      kcInitial:
        profile.kcInitial,

      kcMid:
        profile.kcMid,

      kcEnd:
        profile.kcEnd,

      confidence:
        'low',

      bearing:
        input.bearing ??
        null,

      basis: [
        profile
          .baselineAssumption,
      ],

      warnings: [
        `“${String(input.stage)}” gelişim dönemi için su ihtiyacı hesaplanamadı.`,
      ],

      caution:
        'Fenoloji evresi belirsizken ETc hesabı yapılmamalı.',

      source: {
        label:
          profile.sourceLabel,

        url:
          profile.sourceUrl,
      },
    };
  }

  /*
    Genç / ürün vermeyen çok yıllık bahçe:
    Olgun bahçe Kc'si doğrudan kullanılmaz.

    Allen & Pereira (2009) yoğunluk yaklaşımındaki Kd mantığı,
    taç örtüsü (fc) ve bitki yüksekliği (h) ile v1 planlama
    düzeltmesi olarak uygulanır.

    Kd = min(1, ML * fc, fc^(1/(1+h)))
    v1'de ML = 1.5: yayımlanan 1.5–2 aralığının ihtiyatlı alt ucu.
    Kc_min = 0.15: kuru/çıplak yüzey için FAO yaklaşımındaki alt baz.

    Not: Bu, dual-Kc'nin tam günlük toprak buharlaşma hesabının yerine
    geçmez. Bu yüzden güven "low" tutulur ve yalnız erken uyarı /
    planlama amaçlı kullanılır.
  */
  if (
    input.bearing ===
    false
  ) {
    const canopyCoverPercent =
      finiteNumber(
        input.canopyCoverPercent,
      );

    const canopyHeightM =
      finiteNumber(
        input.canopyHeightM,
      );

    if (
      canopyCoverPercent === null ||
      canopyHeightM === null
    ) {
      return {
        status:
          'needs_canopy_data',

        cropKey:
          profile.cropKey,

        cropName:
          profile.displayName,

        cropSubtype:
          profile.cropSubtype,

        stage:
          input.stage,

        stageLabel:
          input.stageLabel ??
          null,

        anchor:
          resolution.anchor,

        kc:
          null,

        kcInitial:
          profile.kcInitial,

        kcMid:
          profile.kcMid,

        kcEnd:
          profile.kcEnd,

        confidence:
          'low',

        bearing:
          false,

        basis: [
          profile
            .baselineAssumption,
          resolution
            .explanation,
        ],

        warnings: [
          'Tarla genç veya henüz ürün vermeyen bahçe olarak kayıtlı. Yetişkin ağaçların su ihtiyacı doğrudan kullanılmadı.',
          canopyCoverPercent === null
            ? 'Taç örtüsü yüzdesi eksik.'
            : '',
          canopyHeightM === null
            ? 'Ortalama ağaç / kanopi yüksekliği eksik.'
            : '',
        ].filter(Boolean),

        caution:
          'Genç veya seyrek bahçede ağaç örtüsü ve boyu bilinmeden su ihtiyacı hesaplanamaz.',

        source: {
          label:
            profile.sourceLabel,

          url:
            profile.sourceUrl,
        },
      };
    }

    const fc =
      clamp(
        canopyCoverPercent / 100,
        0.01,
        0.99,
      );

    const h =
      clamp(
        canopyHeightM,
        0.10,
        30,
      );

    const densityMultiplier =
      1.5;

    const densityCoefficient =
      Math.min(
        1,
        densityMultiplier * fc,
        Math.pow(
          fc,
          1 / (1 + h),
        ),
      );

    const matureStageKc =
      calculateKc(
        profile,
        resolution,
      );

    const kcMinimum =
      0.15;

    const adjustedKc =
      round3(
        clamp(
          kcMinimum +
            densityCoefficient *
              (
                matureStageKc -
                kcMinimum
              ),
          kcMinimum,
          matureStageKc,
        ),
      );

    return {
      status:
        'usable',

      cropKey:
        profile.cropKey,

      cropName:
        profile.displayName,

      cropSubtype:
        profile.cropSubtype,

      stage:
        input.stage,

      stageLabel:
        input.stageLabel ??
        null,

      anchor:
        resolution.anchor,

      kc:
        adjustedKc,

      kcInitial:
        profile.kcInitial,

      kcMid:
        profile.kcMid,

      kcEnd:
        profile.kcEnd,

      confidence:
        'low',

      bearing:
        false,

      basis: [
        profile
          .baselineAssumption,

        resolution
          .explanation,

        `Genç bahçe taç örtüsü: %${round3(canopyCoverPercent)}.`,

        `Ortalama kanopi yüksekliği: ${round3(canopyHeightM)} m.`,

        `Ağaçların kapladığı alana göre hesap oranı: ${round3(densityCoefficient)}.`,

        `Yetişkin bahçe için hesap oranı ${round3(matureStageKc)}; genç bahçe için kullanılan oran ${adjustedKc}.`,
      ],

      warnings: [
        'Genç bahçe düzeltmesi Allen & Pereira yoğunluk yaklaşımının düşük güvenli v1 planlama uyarlamasıdır.',
        'Sıra arası bitki örtüsü, topraktan günlük buharlaşma ve tarlanın yerel hava koşulları ayrıca hesaba katılmıyor.',
      ],

      caution:
        'Genç bahçe için hesaplanan bu değer erken uyarı ve tahmini su ihtiyacı içindir; tek başına sulama miktarı değildir.',

      source: {
        label:
          `${profile.sourceLabel} + Allen & Pereira canopy-density adjustment`,

        url:
          profile.sourceUrl,
      },
    };
  }

  const kc =
    round3(
      calculateKc(
        profile,
        resolution,
      ),
    );

  const basis = [
    profile
      .baselineAssumption,

    resolution
      .explanation,

    `Bitkinin başlangıç, gelişme ve sezon sonu su ihtiyacı oranları: ${profile.kcInitial} / ${profile.kcMid} / ${profile.kcEnd}.`,
  ];

  const warnings:
    string[] = [
    'Su ihtiyacı için temel ürün bilgisi kullanıldı; yer örtüsü, ağaç örtüsü, rüzgâr ve hava nemi düzeltmeleri henüz uygulanmadı.',
  ];

  return {
    status:
      'usable',

    cropKey:
      profile.cropKey,

    cropName:
      profile.displayName,

    stage:
      input.stage,

    stageLabel:
      input.stageLabel ??
      null,

    anchor:
      resolution.anchor,

    kc,

    kcInitial:
      profile.kcInitial,

    kcMid:
      profile.kcMid,

    kcEnd:
      profile.kcEnd,

    confidence:
      'medium',

    bearing:
      input.bearing ??
      null,

    basis,
    warnings,

    caution:
      'Bitkinin tahmini su tüketimi, normal koşullardaki gelişimine ve havaya göre hesaplanır. Bu değer tek başına sulama miktarı değildir.',

    source: {
      label:
        profile.sourceLabel,

      url:
        profile.sourceUrl,
    },
  };
}
