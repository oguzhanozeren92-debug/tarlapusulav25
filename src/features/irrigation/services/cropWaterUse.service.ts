import {
  supabase,
} from '../../../supabaseClient';

import {
  getFieldPhenologySnapshot,
} from '../../phenology/services/fieldPhenologySnapshot.service';

import {
  loadIrrigationClimateContext,
} from './irrigationClimate.service';

import {
  resolveCropCoefficient,
} from './cropCoefficient.service';

import { saveDailyKcSnapshot } from './dailyKcSnapshot.service';

import {
  getCanopyDevelopmentLabel,
  getCanopyHeightLabel,
  resolveCanopyModelInput,
} from '../../fields/data/canopyDevelopmentProfiles';

import type {
  CropWaterUseDay,
  CropWaterUsePeriod,
  CropWaterUseResult,
  CropWaterUseStatus,
} from '../types/cropWaterUse';

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

function normalizeCropSubtype(
  value: unknown,
):
  | 'table'
  | 'wine'
  | null {
  const normalized =
    String(
      value ?? '',
    )
      .trim()
      .toLocaleLowerCase(
        'tr-TR',
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

function sumAvailable(
  days:
    CropWaterUseDay[],
  key:
    | 'estimatedCropWaterUseMm'
    | 'precipitationMm'
    | 'climateWaterGapMm',
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

function buildPeriod(
  days:
    CropWaterUseDay[],
): CropWaterUsePeriod {
  const validDayCount =
    days.filter(
      (day) =>
        day
          .estimatedCropWaterUseMm !==
          null,
    ).length;

  return {
    days,

    estimatedCropWaterUseMm:
      sumAvailable(
        days,
        'estimatedCropWaterUseMm',
      ),

    precipitationMm:
      sumAvailable(
        days,
        'precipitationMm',
      ),

    climateWaterGapMm:
      sumAvailable(
        days,
        'climateWaterGapMm',
      ),

    validDayCount,
  };
}

function buildDays(
  climateDays: any[],
  kc:
    | number
    | null,
): CropWaterUseDay[] {
  return climateDays.map(
    (day) => {
      const etoMm =
        finiteNumber(
          day
            ?.etoMm,
        );

      const precipitationMm =
        finiteNumber(
          day
            ?.precipitationMm,
        );

      const estimatedCropWaterUseMm =
        etoMm !== null &&
        kc !== null
          ? etoMm * kc
          : null;

      /*
        Buradaki açık, yalnızca iklimsel kaba farktır.
        Sulama önerisine dönüşmez.
      */
      const climateWaterGapMm =
        estimatedCropWaterUseMm !==
          null &&
        precipitationMm !==
          null
          ? Math.max(
              0,
              estimatedCropWaterUseMm -
                precipitationMm,
            )
          : null;

      return {
        date:
          String(
            day?.date ??
            '',
          ),

        referenceEvapotranspirationMm:
          round3(
            etoMm,
          ),

        cropCoefficient:
          kc,

        estimatedCropWaterUseMm:
          round3(
            estimatedCropWaterUseMm,
          ),

        precipitationMm:
          round3(
            precipitationMm,
          ),

        climateWaterGapMm:
          round3(
            climateWaterGapMm,
          ),

        kind:
          day?.kind ===
            'past'
            ? 'past'
            : 'forecast',
      };
    },
  );
}

function resolveStatus(
  kcStatus: string,
  pastCount: number,
  forecastCount: number,
): CropWaterUseStatus {
  if (
    kcStatus !==
    'usable'
  ) {
    return 'blocked';
  }

  if (
    pastCount >= 5 &&
    forecastCount >= 3
  ) {
    return 'usable';
  }

  if (
    pastCount > 0 ||
    forecastCount > 0
  ) {
    return 'partial';
  }

  return 'blocked';
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

export async function calculateCropWaterUse(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<CropWaterUseResult> {
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
      'Bitki su tüketimi hesabı için tarla kimliği bulunamadı.',
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
      'Bitki su tüketimi hesabı için oturum bulunamadı.',
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
          'name',
          'crop',
          'crop_subtype',
          'crop_cycle',
          'season',
          'planting_year',
          'bearing',
          'canopy_development_class',
          'canopy_height_class',
          'canopy_cover_percent',
          'canopy_height_m',
          'parcel_geometry',
          'parcel_centroid_lat',
          'parcel_centroid_lng',
          'latitude',
          'longitude',
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
      'Bitki su tüketimi hesabı için tarla bulunamadı veya erişim yok.',
    );
  }

  const fieldRow = dbField as Record<string, any>;

  const normalizedField =
    {
      ...fieldRow,

      cropCycle:
        fieldRow.crop_cycle,

      plantingYear:
        fieldRow.planting_year,

      cropSubtype:
        fieldRow.crop_subtype,

      parcelGeometry:
        fieldRow.parcel_geometry,

      parcelCentroidLat:
        fieldRow.parcel_centroid_lat,

      parcelCentroidLng:
        fieldRow.parcel_centroid_lng,
    };

  const [
    phenology,
    climate,
  ] =
    await Promise.all([
      getFieldPhenologySnapshot(
        normalizedField,
        {
          forceRefresh:
            false,
        },
      ),

      loadIrrigationClimateContext(
        {
          id:
            fieldId,
        },
      ),
    ]);

  const cropSubtype =
    normalizeCropSubtype(
      fieldRow.crop_subtype,
    );

  const canopyModel =
    resolveCanopyModelInput({
      canopyCoverPercent:
        fieldRow.canopy_cover_percent,
      canopyHeightM:
        fieldRow.canopy_height_m,
      canopyDevelopmentClass:
        fieldRow.canopy_development_class,
      canopyHeightClass:
        fieldRow.canopy_height_class,
    });

  const coefficient =
    resolveCropCoefficient({
      cropName:
        fieldRow.crop,

      cropSubtype,

      stage:
        phenology
          .phenology
          .stage,

      stageLabel:
        phenology
          .phenology
          .stageLabel,

      bearing:
        phenology
          .context
          .bearing,

      canopyCoverPercent:
        canopyModel
          .canopyCoverPercent,

      canopyHeightM:
        canopyModel
          .canopyHeightM,
    });

  const kc =
    coefficient.status ===
      'usable'
      ? coefficient.kc
      : null;

  const generatedAt = new Date().toISOString();

  if (kc !== null && coefficient.source?.label) {
    void saveDailyKcSnapshot({
      fieldId,
      calculatedAt: generatedAt,
      kc,
      cropName: String(fieldRow.crop ?? ''),
      stage: phenology.phenology.stage,
      stageLabel: phenology.phenology.stageLabel,
      confidence: coefficient.confidence,
      sourceLabel: coefficient.source.label,
    }).catch((error) => {
      console.warn('[TarlaPusula] Bugünkü Kc kaydedilemedi:', error);
    });
  }

  const pastDays =
    buildDays(
      climate
        .past7Days
        .days,

      kc,
    );

  const forecastDays =
    buildDays(
      climate
        .forecast5Days
        .days,

      kc,
    );

  const past7Days =
    buildPeriod(
      pastDays,
    );

  const forecast5Days =
    buildPeriod(
      forecastDays,
    );

  const status =
    resolveStatus(
      coefficient.status,
      past7Days
        .validDayCount,
      forecast5Days
        .validDayCount,
    );

  const evidence:
    string[] = [];

  const warnings:
    string[] = [
      ...coefficient
        .warnings,
      ...climate
        .warnings,
    ];

  if (
    coefficient.kc !==
    null
  ) {
    evidence.push(
      `Bitkinin su ihtiyacı hesabında kullanılan oran: ${coefficient.kc.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}.`,
    );
  }

  const canopyDevelopmentLabel =
    getCanopyDevelopmentLabel(
      fieldRow.canopy_development_class,
    );

  const canopyHeightLabel =
    getCanopyHeightLabel(
      fieldRow.canopy_height_class,
    );

  if (canopyDevelopmentLabel) {
    evidence.push(
      `Taç gelişimi kullanıcı seçimi: ${canopyDevelopmentLabel}.`,
    );
  } else if (
    canopyModel.canopyCoverPercent !== null
  ) {
    evidence.push(
      `Taç örtüsü: %${canopyModel.canopyCoverPercent.toFixed(0)}.`,
    );
  }

  if (canopyHeightLabel) {
    evidence.push(
      `Ağaç boyu kullanıcı seçimi: ${canopyHeightLabel}.`,
    );
  } else if (
    canopyModel.canopyHeightM !== null
  ) {
    evidence.push(
      `Ortalama kanopi yüksekliği: ${canopyModel.canopyHeightM.toFixed(1)} m.`,
    );
  }

  if (
    phenology
      .phenology
      .stageLabel
  ) {
    evidence.push(
      `Fenoloji: ${phenology.phenology.stageLabel}.`,
    );
  }

  if (
    past7Days
      .estimatedCropWaterUseMm !==
    null
  ) {
    evidence.push(
      `Son 7 gün bitkinin tahmini su tüketimi: ${past7Days.estimatedCropWaterUseMm.toFixed(1)} mm.`,
    );
  }

  if (
    forecast5Days
      .estimatedCropWaterUseMm !==
    null
  ) {
    evidence.push(
      `Önümüzdeki 5 gün bitkinin tahmini su tüketimi: ${forecast5Days.estimatedCropWaterUseMm.toFixed(1)} mm.`,
    );
  }

  if (
    forecast5Days
      .precipitationMm !==
    null
  ) {
    evidence.push(
      `Önümüzdeki 5 gün beklenen yağış: ${forecast5Days.precipitationMm.toFixed(1)} mm.`,
    );
  }

  if (
    coefficient.status ===
    'needs_canopy_data'
  ) {
    warnings.push(
      'Bu tarla genç/ürün vermeyen bahçe olduğu için canopy/taç örtüsü bilgisi olmadan bitkinin tahmini su tüketimi hesaplanmadı.',
    );
  }

  if (
    coefficient.status ===
    'needs_crop_subtype'
  ) {
    warnings.push(
      'Üzüm tipi Sofralık veya Şaraplık seçilmeden bitkinin tahmini su tüketimi hesaplanmadı.',
    );
  }

  return {
    fieldId,

    fieldName:
      String(
        fieldRow.name ??
        '',
      ).trim() ||
      null,

    cropName:
      String(
        fieldRow.crop ??
        '',
      ).trim() ||
      null,

    cropSubtype,

    phenology: {
      stage:
        phenology
          .phenology
          .stage,

      stageLabel:
        phenology
          .phenology
          .stageLabel,

      bearing:
        phenology
          .context
          .bearing,
    },

    coefficient: {
      status:
        coefficient
          .status,

      kc:
        coefficient
          .kc,

      confidence:
        coefficient
          .confidence,

      sourceLabel:
        coefficient
          .source
          ?.label ??
        null,
    },

    past7Days,
    forecast5Days,

    status,

    display: {
      primaryLabel:
        'Bitkinin Tahmini Su Tüketimi',

      pastLabel:
        `Son 7 gün (bitkinin bugünkü durumuna göre): ${formatMm(
          past7Days
            .estimatedCropWaterUseMm,
        )}`,

      forecastLabel:
        `Önümüzdeki 5 gün: ${formatMm(
          forecast5Days
            .estimatedCropWaterUseMm,
        )}`,

      note:
        'Bu değer sulama miktarı değildir; toprakta mevcut su, son sulama ve etkili yağış daha hesaba katılacaktır.',
    },

    evidence,
    warnings,

    caution:
      'Bitkinin tahmini su tüketimi, havanın kurutucu etkisine ve bitkinin gelişimine göre hesaplanır. Bu değer toprak su açığı veya doğrudan verilmesi gereken sulama suyu değildir.',

    generatedAt,
  };
}
