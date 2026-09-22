import {
  evaluatePhenology,
} from './phenologyEngine';

import {
  resolveCropPhenologyCalendar,
} from './cropPhenologyCalendar.service';

import type {
  NdviTrendDirection,
  NdviTrendQuality,
  PhenologyResult,
} from '../types/phenology';

export type FieldForPhenology = {
  crop?: string | null;
  cropName?: string | null;

  cropCycle?: string | null;
  crop_cycle?: string | null;

  plantingDate?: string | null;
  planting_date?: string | null;
  sowingDate?: string | null;
  sowing_date?: string | null;

  expectedHarvestDate?: string | null;
  expected_harvest_date?: string | null;

  actualHarvestDate?: string | null;
  actual_harvest_date?: string | null;
  harvestedAt?: string | null;
  harvested_at?: string | null;

  harvestDate?: string | null;
  harvest_date?: string | null;

  /*
    İleride ERA5/ısı toplamı motoru bu alanı hesaplayıp verebilir.
    Şimdilik varsayılan 0.
  */
  phenologySeasonShiftDays?: number | null;
  phenology_season_shift_days?: number | null;
};

export type NdviTrendForPhenology = {
  direction?:
    | NdviTrendDirection
    | null;

  quality?:
    | NdviTrendQuality
    | null;

  latestAverage?:
    | number
    | null;

  changeFromPrevious?:
    | number
    | null;

  changeFromFirst?:
    | number
    | null;
} | null;

function firstNonEmpty(
  ...values:
    Array<
      string |
      null |
      undefined
    >
): string | null {
  for (
    const value
    of values
  ) {
    const normalized =
      String(
        value ?? '',
      ).trim();

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeCropCycle(
  value:
    | string
    | null
    | undefined,
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

function safeNumber(
  value: unknown,
): number | null {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function perennialSummary(
  cropName: string | null,
  stageLabel: string,
) {
  const crop =
    cropName ??
    'Ürün';

  return `${crop} için kaynak tabanlı yıllık takvimde mevcut dönem “${stageLabel}” olarak görünüyor.`;
}

function appendNdviEvidence(
  result: PhenologyResult,
  ndviTrend:
    NdviTrendForPhenology,
): PhenologyResult {
  if (
    !ndviTrend ||
    ndviTrend.quality !==
      'usable' ||
    !ndviTrend.direction ||
    ndviTrend.direction ===
      'unknown'
  ) {
    return result;
  }

  const basis = [
    ...result.basis,
    `NDVI trendi: ${ndviTrend.direction}`,
  ];

  const warnings = [
    ...result.warnings,
  ];

  /*
    NDVI evreyi BELİRLEMEZ.
    Sadece mevcut takvim evresine ek kanıt/uyarı verir.
  */
  if (
    (
      result.stage ===
        'bud_break' ||
      result.stage ===
        'flowering' ||
      result.stage ===
        'fruit_set' ||
      result.stage ===
        'fruit_growth'
    ) &&
    ndviTrend.direction ===
      'falling'
  ) {
    warnings.push(
      'Aktif büyüme/üreme döneminde NDVI düşüşü görülüyor; saha kontrolü gerekebilir.',
    );
  }

  if (
    (
      result.stage ===
        'dormancy' ||
      result.stage ===
        'leaf_fall'
    ) &&
    ndviTrend.direction ===
      'falling'
  ) {
    /*
      Bu dönemlerde düşüş doğal olabilir; risk uyarısı üretmiyoruz.
    */
  }

  return {
    ...result,
    basis,
    warnings,
  };
}

export function buildFieldPhenology(
  field:
    FieldForPhenology,
  ndviTrend?:
    NdviTrendForPhenology,
  currentDate?:
    | string
    | Date
    | null,
): PhenologyResult {
  const cropName =
    firstNonEmpty(
      field.cropName,
      field.crop,
    );

  const cropCycle =
    normalizeCropCycle(
      field.cropCycle ??
      field.crop_cycle,
    );

  const actualHarvestDate =
    firstNonEmpty(
      field.actualHarvestDate,
      field.actual_harvest_date,
      field.harvestedAt,
      field.harvested_at,
    );

  /*
    Gerçek hasat kaydı varsa en güçlü kanıt budur.
  */
  if (actualHarvestDate) {
    const harvested =
      evaluatePhenology({
        cropName,
        actualHarvestDate,
        currentDate:
          currentDate ??
          null,
        ndviTrend:
          ndviTrend
            ? {
                direction:
                  ndviTrend.direction ??
                  'unknown',
                quality:
                  ndviTrend.quality ??
                  'insufficient',
                latestAverage:
                  ndviTrend.latestAverage ??
                  null,
                changeFromPrevious:
                  ndviTrend.changeFromPrevious ??
                  null,
                changeFromFirst:
                  ndviTrend.changeFromFirst ??
                  null,
              }
            : null,
      });

    if (
      harvested.stage ===
      'post_harvest'
    ) {
      return harvested;
    }
  }

  /*
    ÇOK YILLIK ÜRÜN:
    Dikim yılı / plantDate yıllık fenoloji başlangıcı değildir.
    Kaynak tabanlı ürün takvimi kullanılır.
  */
  if (
    cropCycle ===
    'perennial'
  ) {
    const seasonShiftDays =
      safeNumber(
        field.phenologySeasonShiftDays ??
        field.phenology_season_shift_days,
      ) ??
      0;

    const calendar =
      resolveCropPhenologyCalendar({
        cropName,
        currentDate:
          currentDate ??
          null,
        seasonShiftDays,
      });

    if (
      !calendar.supported ||
      calendar.stage ===
        'unknown'
    ) {
      return {
        stage:
          'unknown',
        stageLabel:
          'Belirlenemedi',
        confidence:
          'low',
        dataStatus:
          'insufficient_data',
        progressPercent:
          null,
        daysSinceSowing:
          null,
        daysUntilExpectedHarvest:
          null,
        basis:
          calendar.basis,
        warnings:
          calendar.warnings,
        summary:
          `${cropName ?? 'Ürün'} için güvenilir yıllık fenoloji evresi belirlenemedi.`,
      };
    }

    const result:
      PhenologyResult = {
      stage:
        calendar.stage,
      stageLabel:
        calendar.stageLabel,
      confidence:
        calendar.confidence,
      dataStatus:
        'usable',
      progressPercent:
        null,
      daysSinceSowing:
        null,
      daysUntilExpectedHarvest:
        null,
      basis:
        calendar.basis,
      warnings:
        calendar.warnings,
      summary:
        perennialSummary(
          cropName,
          calendar.stageLabel,
        ),
    };

    return appendNdviEvidence(
      result,
      ndviTrend ??
      null,
    );
  }

  /*
    TEK YILLIK / BİLİNMEYEN ÜRÜN:
    Yalnızca açık sezon tarihleriyle hesapla.
  */
  const sowingDate =
    firstNonEmpty(
      field.sowingDate,
      field.sowing_date,
      field.plantingDate,
      field.planting_date,
    );

  const expectedHarvestDate =
    firstNonEmpty(
      field.expectedHarvestDate,
      field.expected_harvest_date,
    );

  return evaluatePhenology({
    cropName,
    sowingDate,
    expectedHarvestDate,
    actualHarvestDate:
      null,

    currentDate:
      currentDate ??
      null,

    ndviTrend:
      ndviTrend
        ? {
            direction:
              ndviTrend.direction ??
              'unknown',

            quality:
              ndviTrend.quality ??
              'insufficient',

            latestAverage:
              ndviTrend.latestAverage ??
              null,

            changeFromPrevious:
              ndviTrend.changeFromPrevious ??
              null,

            changeFromFirst:
              ndviTrend.changeFromFirst ??
              null,
          }
        : null,
  });
}
