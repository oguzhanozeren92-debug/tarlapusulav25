import type {
  PhenologyInput,
  PhenologyResult,
  PhenologyStage,
} from '../types/phenology';

const DAY_MS = 86_400_000;

function parseDate(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) return null;

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function startOfDayUtc(date: Date) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function diffDays(from: Date, to: Date) {
  return Math.round(
    (startOfDayUtc(to) -
      startOfDayUtc(from)) /
      DAY_MS,
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function stageLabel(
  stage: PhenologyStage,
) {
  switch (stage) {
    case 'pre_sowing':
      return 'Ekim Öncesi';
    case 'establishment':
      return 'Çıkış / Yerleşme';
    case 'vegetative':
      return 'Vejetatif Gelişim';
    case 'reproductive':
      return 'Üreme / Çiçeklenme-Dane Oluşumu';
    case 'maturation':
      return 'Olgunlaşma';
    case 'harvest_window':
      return 'Hasat Penceresi';
    case 'post_harvest':
      return 'Hasat Sonrası';
    case 'dormancy':
      return 'Kış Dinlenmesi';
    case 'bud_swell':
      return 'Tomurcuk Kabarması';
    case 'bud_break':
      return 'Tomurcuk Uyanması / Sürme';
    case 'flowering':
      return 'Çiçeklenme';
    case 'fruit_set':
      return 'Meyve Tutumu';
    case 'fruit_growth':
      return 'Meyve Gelişimi';
    case 'veraison':
      return 'Ben Düşme';
    case 'leaf_fall':
      return 'Yaprak Yaşlanması / Dökümü';
    default:
      return 'Belirlenemedi';
  }
}

function genericSummary(
  stage: PhenologyStage,
  cropName: string | null,
  progressPercent: number | null,
) {
  const crop =
    cropName?.trim() ||
    'Ürün';

  switch (stage) {
    case 'pre_sowing':
      return `${crop} için kayıtlı ekim tarihi henüz gelmemiş görünüyor.`;

    case 'establishment':
      return `${crop} erken gelişim döneminde görünüyor.`;

    case 'vegetative':
      return `${crop} vejetatif gelişim döneminde görünüyor.`;

    case 'reproductive':
      return `${crop} üreme/verim oluşumu döneminde görünüyor.`;

    case 'maturation':
      return `${crop} olgunlaşma döneminde görünüyor.`;

    case 'harvest_window':
      return `${crop} beklenen hasat penceresinde görünüyor. Gerçek hasat kaydı olmadan hasat sonrası kabul edilmez.`;

    case 'post_harvest':
      return `${crop} için doğrulanmış hasat kaydı var; aktif gelişim önerileri verilmemeli.`;
    case 'dormancy':
      return `${crop} kış dinlenmesi döneminde görünüyor.`;
    case 'bud_swell':
      return `${crop} tomurcuk kabarması döneminde görünüyor.`;
    case 'bud_break':
      return `${crop} uyanma/sürme döneminde görünüyor.`;
    case 'flowering':
      return `${crop} çiçeklenme döneminde görünüyor.`;
    case 'fruit_set':
      return `${crop} meyve tutumu döneminde görünüyor.`;
    case 'fruit_growth':
      return `${crop} meyve gelişimi döneminde görünüyor.`;
    case 'veraison':
      return `${crop} ben düşme döneminde görünüyor.`;
    case 'leaf_fall':
      return `${crop} yaprak yaşlanması/dökümü döneminde görünüyor.`;

    default:
      return progressPercent === null
        ? `${crop} için gelişim evresi güvenilir biçimde belirlenemedi.`
        : `${crop} için takvim ilerlemesi yaklaşık %${progressPercent}.`;
  }
}

function unknownResult(params: {
  cropName: string | null;
  basis: string[];
  warnings: string[];
  daysSinceSowing: number | null;
  daysUntilExpectedHarvest: number | null;
  dataStatus?:
    | 'insufficient_data'
    | 'invalid_dates';
  summary?: string;
}): PhenologyResult {
  return {
    stage: 'unknown',
    stageLabel:
      stageLabel('unknown'),
    confidence: 'low',
    dataStatus:
      params.dataStatus ??
      'insufficient_data',
    progressPercent: null,
    daysSinceSowing:
      params.daysSinceSowing,
    daysUntilExpectedHarvest:
      params.daysUntilExpectedHarvest,
    basis: params.basis,
    warnings: params.warnings,
    summary:
      params.summary ??
      genericSummary(
        'unknown',
        params.cropName,
        null,
      ),
  };
}

export function evaluatePhenology(
  input: PhenologyInput,
): PhenologyResult {
  const today =
    parseDate(input.currentDate) ??
    new Date();

  const sowingDate =
    parseDate(input.sowingDate);

  const expectedHarvestDate =
    parseDate(
      input.expectedHarvestDate,
    );

  const actualHarvestDate =
    parseDate(
      input.actualHarvestDate,
    );

  const cropName =
    input.cropName?.trim() ||
    null;

  const basis: string[] = [];
  const warnings: string[] = [];

  if (cropName) {
    basis.push(
      `Ürün: ${cropName}`,
    );
  }

  /*
    KRİTİK KURAL:
    Hasat sonrası yalnızca doğrulanmış gerçek hasat tarihiyle oluşur.
    Beklenen tarihin geçmiş olması tek başına yeterli değildir.
  */
  if (
    actualHarvestDate &&
    today >= actualHarvestDate
  ) {
    const daysSinceSowing =
      sowingDate
        ? diffDays(
            sowingDate,
            today,
          )
        : null;

    basis.push(
      `Doğrulanmış gerçek hasat tarihi: ${actualHarvestDate
        .toISOString()
        .slice(0, 10)}`,
    );

    return {
      stage: 'post_harvest',
      stageLabel:
        stageLabel(
          'post_harvest',
        ),
      confidence: 'high',
      dataStatus: 'usable',
      progressPercent: 100,
      daysSinceSowing,
      daysUntilExpectedHarvest:
        expectedHarvestDate
          ? diffDays(
              today,
              expectedHarvestDate,
            )
          : null,
      basis,
      warnings,
      summary:
        genericSummary(
          'post_harvest',
          cropName,
          100,
        ),
    };
  }

  if (!sowingDate) {
    warnings.push(
      'Ekim tarihi olmadığı için gelişim evresi hesaplanamadı.',
    );

    return unknownResult({
      cropName,
      basis,
      warnings,
      daysSinceSowing: null,
      daysUntilExpectedHarvest:
        expectedHarvestDate
          ? diffDays(
              today,
              expectedHarvestDate,
            )
          : null,
    });
  }

  const daysSinceSowing =
    diffDays(
      sowingDate,
      today,
    );

  basis.push(
    `Ekim tarihi: ${sowingDate
      .toISOString()
      .slice(0, 10)}`,
  );

  if (daysSinceSowing < 0) {
    return {
      stage: 'pre_sowing',
      stageLabel:
        stageLabel(
          'pre_sowing',
        ),
      confidence: 'high',
      dataStatus: 'usable',
      progressPercent: 0,
      daysSinceSowing,
      daysUntilExpectedHarvest:
        expectedHarvestDate
          ? diffDays(
              today,
              expectedHarvestDate,
            )
          : null,
      basis,
      warnings,
      summary:
        genericSummary(
          'pre_sowing',
          cropName,
          0,
        ),
    };
  }

  const trend =
    input.ndviTrend?.direction ??
    'unknown';

  const trendQuality =
    input.ndviTrend?.quality ??
    'insufficient';

  if (
    trendQuality === 'usable' &&
    trend !== 'unknown'
  ) {
    basis.push(
      `NDVI trendi: ${trend}`,
    );
  }

  /*
    Sadece NDVI yönünden fenolojik evre uydurulmaz.
    Beklenen hasat tarihi yoksa güvenli sonuç "unknown".
  */
  if (!expectedHarvestDate) {
    warnings.push(
      'Beklenen hasat tarihi olmadığı için takvim tabanlı gelişim evresi belirlenemedi.',
    );

    if (
      trendQuality ===
        'usable' &&
      trend !== 'unknown'
    ) {
      warnings.push(
        'NDVI trendi mevcut ancak tek başına fenolojik evre belirlemek için kullanılmadı.',
      );
    }

    return unknownResult({
      cropName,
      basis,
      warnings,
      daysSinceSowing,
      daysUntilExpectedHarvest:
        null,
      summary:
        `${cropName ?? 'Ürün'} için ekimden ${daysSinceSowing} gün geçmiş; beklenen hasat tarihi olmadığı için evre uydurulmadı.`,
    });
  }

  basis.push(
    `Beklenen hasat tarihi: ${expectedHarvestDate
      .toISOString()
      .slice(0, 10)}`,
  );

  const totalDays =
    diffDays(
      sowingDate,
      expectedHarvestDate,
    );

  if (totalDays <= 0) {
    warnings.push(
      'Ekim ve beklenen hasat tarihleri birbiriyle uyumsuz.',
    );

    return unknownResult({
      cropName,
      basis,
      warnings,
      daysSinceSowing,
      daysUntilExpectedHarvest:
        diffDays(
          today,
          expectedHarvestDate,
        ),
      dataStatus:
        'invalid_dates',
    });
  }

  const daysUntilExpectedHarvest =
    diffDays(
      today,
      expectedHarvestDate,
    );

  const rawProgress =
    (daysSinceSowing /
      totalDays) *
    100;

  /*
    Beklenen hasat tarihi geçtiyse:
    - post_harvest DEMİYORUZ.
    - gerçek hasat kaydı yoksa "hasat penceresi"nde tutuyoruz.
  */
  if (
    today >
    expectedHarvestDate
  ) {
    warnings.push(
      'Beklenen hasat tarihi geçmiş ancak doğrulanmış gerçek hasat kaydı yok.',
    );

    if (
      trendQuality ===
        'usable' &&
      trend === 'rising'
    ) {
      warnings.push(
        'Beklenen hasat tarihi geçmiş olmasına rağmen NDVI yükseliyor; ekim/hasat tarihleri veya ürün durumu kontrol edilmeli.',
      );
    }

    return {
      stage:
        'harvest_window',
      stageLabel:
        stageLabel(
          'harvest_window',
        ),
      confidence: 'low',
      dataStatus: 'usable',
      progressPercent: 100,
      daysSinceSowing,
      daysUntilExpectedHarvest,
      basis,
      warnings,
      summary:
        `${cropName ?? 'Ürün'} için beklenen hasat tarihi geçmiş görünüyor; gerçek hasat kaydı olmadığı için hasat sonrası kabul edilmedi.`,
    };
  }

  const progressPercent =
    Math.round(
      clamp(
        rawProgress,
        0,
        100,
      ),
    );

  let stage:
    PhenologyStage;

  if (rawProgress < 12) {
    stage =
      'establishment';
  } else if (
    rawProgress < 50
  ) {
    stage =
      'vegetative';
  } else if (
    rawProgress < 78
  ) {
    stage =
      'reproductive';
  } else if (
    rawProgress < 95
  ) {
    stage =
      'maturation';
  } else {
    stage =
      'harvest_window';
  }

  if (
    trendQuality ===
      'usable' &&
    (
      stage ===
        'reproductive' ||
      stage ===
        'maturation'
    ) &&
    trend === 'rising'
  ) {
    warnings.push(
      'Takvim ilerlemiş olmasına rağmen NDVI yükseliyor; ürün çeşidi, ekim tarihi veya beklenen hasat tarihi kontrol edilmeli.',
    );
  }

  if (
    trendQuality ===
      'usable' &&
    (
      stage ===
        'establishment' ||
      stage ===
        'vegetative'
    ) &&
    trend === 'falling'
  ) {
    warnings.push(
      'Erken/aktif gelişim döneminde NDVI düşüşü görülüyor; saha kontrolü gerekebilir.',
    );
  }

  return {
    stage,
    stageLabel:
      stageLabel(stage),
    confidence: 'medium',
    dataStatus: 'usable',
    progressPercent,
    daysSinceSowing,
    daysUntilExpectedHarvest,
    basis,
    warnings,
    summary:
      genericSummary(
        stage,
        cropName,
        progressPercent,
      ),
  };
}
