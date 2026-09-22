import type {
  UnifiedMapAiResult,
  UnifiedMapActiveLayer,
} from '../../../services/unifiedMapAiService';

import type {
  FieldPhenologySnapshot,
} from './fieldPhenologySnapshot.service';

function uniquePush(
  items: string[],
  value: string,
) {
  if (
    value &&
    !items.includes(value)
  ) {
    items.push(value);
  }
}

function cropLabel(
  snapshot: FieldPhenologySnapshot,
) {
  return (
    snapshot.context.cropName ??
    'Ürün'
  );
}

function withPhenologyEvidence(
  analysis: UnifiedMapAiResult,
  snapshot: FieldPhenologySnapshot,
) {
  const reasons = [
    ...(Array.isArray(analysis.reasons)
      ? analysis.reasons
      : []),
  ];

  const stageLabel =
    snapshot.phenology.stageLabel;

  if (stageLabel) {
    uniquePush(
      reasons,
      `Fenolojik dönem: ${stageLabel}.`,
    );
  }

  if (
    snapshot.climateShift.status ===
      'ready' &&
    snapshot.climateShift.shiftDays !==
      0
  ) {
    uniquePush(
      reasons,
      `ERA5-Land fenoloji takvim düzeltmesi ${snapshot.climateShift.shiftDays > 0 ? '+' : ''}${snapshot.climateShift.shiftDays} gün.`,
    );
  }

  if (
    snapshot.ndvi.status === 'ready' &&
    snapshot.ndvi.quality === 'usable' &&
    snapshot.ndvi.direction !== 'unknown'
  ) {
    uniquePush(
      reasons,
      `90 günlük NDVI trendi: ${snapshot.ndvi.direction}.`,
    );
  }

  return {
    ...analysis,
    reasons: reasons.slice(0, 5),
  };
}

function protectDormantOrFinishedStage(
  analysis: UnifiedMapAiResult,
  snapshot: FieldPhenologySnapshot,
  activeLayer: UnifiedMapActiveLayer,
): UnifiedMapAiResult {
  const stage =
    snapshot.phenology.stage;

  if (
    activeLayer !== 'vegetation' ||
    ![
      'dormancy',
      'leaf_fall',
      'post_harvest',
    ].includes(stage)
  ) {
    return analysis;
  }

  const crop = cropLabel(snapshot);
  const hasImportantArea =
    Boolean(analysis.importantArea);

  let label =
    snapshot.phenology.stageLabel;

  let summary =
    `${crop} ${label.toLocaleLowerCase('tr-TR')} döneminde. Bu dönemde düşük veya azalan NDVI tek başına aktif sezon stresi olarak yorumlanmamalı.`;

  if (hasImportantArea) {
    summary +=
      ` Ancak ${analysis.importantArea?.area} bölümündeki parsel içi fark yine saha karşılaştırması açısından anlamlı olabilir.`;
  }

  return {
    ...analysis,
    status:
      hasImportantArea
        ? analysis.status === 'kontrol'
          ? 'dikkat'
          : analysis.status
        : 'normal',
    headline:
      `${label} · NDVI fenolojiye göre yorumlandı`,
    summary,
    action:
      hasImportantArea
        ? `${analysis.importantArea?.area} bölümünü komşu alanla karşılaştır; aktif büyüme, gübreleme veya hastalık teşhisi sonucu çıkarma.`
        : `Aktif gelişim önerisi verme; ${label.toLocaleLowerCase('tr-TR')} dönemine uygun bakım ve sezon kayıtlarını esas al.`,
    caution:
      `${analysis.caution} Fenolojik dönem nedeniyle düşük bitki indeksi doğal mevsimsel değişimden kaynaklanabilir.`,
  };
}

function protectHarvestWindow(
  analysis: UnifiedMapAiResult,
  snapshot: FieldPhenologySnapshot,
  activeLayer: UnifiedMapActiveLayer,
): UnifiedMapAiResult {
  if (
    activeLayer !== 'vegetation' ||
    snapshot.phenology.stage !==
      'harvest_window'
  ) {
    return analysis;
  }

  const crop = cropLabel(snapshot);
  const falling =
    snapshot.ndvi.quality === 'usable' &&
    snapshot.ndvi.direction === 'falling';

  const hasImportantArea =
    Boolean(analysis.importantArea);

  let summary =
    `${crop} hasat penceresinde. NDVI seviyesi bu nedenle aktif gelişim dönemindeki eşiklerle tek başına değerlendirilmemeli.`;

  if (falling) {
    summary +=
      ' NDVI düşüşü olgunlaşma/hasada yaklaşımın doğal parçası olabilir.';
  }

  if (hasImportantArea) {
    summary +=
      ` ${analysis.importantArea?.area} bölümündeki göreli fark yine saha kontrolünde karşılaştırılmalı.`;
  }

  return {
    ...analysis,
    status:
      !hasImportantArea &&
      analysis.status === 'kontrol'
        ? 'dikkat'
        : analysis.status,
    headline:
      'Hasat penceresi · NDVI bağlama göre değerlendirildi',
    summary,
    action:
      hasImportantArea
        ? `${analysis.importantArea?.area} bölümünde olgunluk, hasat durumu ve bitki görünümünü komşu alanla karşılaştır.`
        : 'Hasat olgunluğunu ve saha durumunu kontrol et; yalnızca NDVI düşüşüne dayanarak stres müdahalesi önerme.',
    caution:
      `${analysis.caution} Hasat döneminde NDVI düşüşü doğal senesens/olgunlaşmayla ilişkili olabilir.`,
  };
}

function strengthenSensitiveGrowthStage(
  analysis: UnifiedMapAiResult,
  snapshot: FieldPhenologySnapshot,
  activeLayer: UnifiedMapActiveLayer,
): UnifiedMapAiResult {
  if (
    activeLayer !== 'vegetation'
  ) {
    return analysis;
  }

  const sensitiveStage =
    [
      'bud_break',
      'flowering',
      'fruit_set',
      'fruit_growth',
    ].includes(
      snapshot.phenology.stage,
    );

  const fallingTrend =
    snapshot.ndvi.status === 'ready' &&
    snapshot.ndvi.quality === 'usable' &&
    snapshot.ndvi.direction === 'falling';

  if (
    !sensitiveStage ||
    !fallingTrend
  ) {
    return analysis;
  }

  const stageLabel =
    snapshot.phenology.stageLabel;

  return {
    ...analysis,
    status:
      analysis.status === 'normal'
        ? 'dikkat'
        : analysis.status,
    headline:
      analysis.status === 'normal'
        ? `${stageLabel} döneminde NDVI düşüşü izlenmeli`
        : analysis.headline,
    summary:
      `${analysis.summary} ${stageLabel} gibi aktif ve hassas bir dönemde 90 günlük NDVI trendinin düşmesi saha kontrolünü daha önemli hale getiriyor.`,
    action:
      analysis.importantArea
        ? `${analysis.importantArea.area} bölümünü öncelikli kontrol et; su, beslenme, zararlı/hastalık belirtisi ve gelişim farkını karşılaştır.`
        : 'Aktif gelişim dönemindeki NDVI düşüşünü sahada doğrula; su, beslenme ve bitki sağlığı belirtilerini birlikte kontrol et.',
  };
}


function protectNonBearingPerennial(
  analysis: UnifiedMapAiResult,
  snapshot: FieldPhenologySnapshot,
  activeLayer: UnifiedMapActiveLayer,
): UnifiedMapAiResult {
  if (
    activeLayer !== 'vegetation' ||
    snapshot.context.cropCycle !==
      'perennial' ||
    snapshot.context.bearing !==
      false
  ) {
    return analysis;
  }

  const stage =
    snapshot.phenology.stage;

  const productionStages = [
    'flowering',
    'fruit_set',
    'fruit_growth',
    'maturation',
    'harvest_window',
  ];

  if (
    !productionStages.includes(
      stage,
    )
  ) {
    return analysis;
  }

  const crop =
    cropLabel(snapshot);

  const stageLabel =
    snapshot.phenology.stageLabel;

  const hasImportantArea =
    Boolean(
      analysis.importantArea,
    );

  const plantingYear =
    snapshot.context
      .plantingYear;

  const ageText =
    plantingYear
      ? ` Dikim yılı ${plantingYear}.`
      : '';

  const reasons = [
    ...(Array.isArray(
      analysis.reasons,
    )
      ? analysis.reasons
      : []),
  ];

  uniquePush(
    reasons,
    'Üretim durumu: henüz ürün vermiyor.',
  );

  uniquePush(
    reasons,
    `Ürün takvimindeki dönem: ${stageLabel}.`,
  );

  let summary =
    `${crop} henüz ürün vermiyor olarak kayıtlı.${ageText} Ürün takviminde “${stageLabel}” dönemi görünse de bu parsel için meyve, olgunluk veya hasat önerisi üretilmez. NDVI yalnızca ağaç/taç gelişimi ve parsel içindeki göreli fark açısından yorumlanır.`;

  if (
    hasImportantArea
  ) {
    summary +=
      ` ${analysis.importantArea?.area} bölümündeki göreli fark, ağaç gelişimi ve saha koşulları açısından karşılaştırılmalı.`;
  }

  return {
    ...analysis,

    headline:
      stage ===
        'harvest_window' ||
      stage ===
        'maturation'
        ? 'Ürün Vermeyen Ağaç · Sezon Sonu Gelişimi'
        : 'Ürün Vermeyen Ağaç · Vejetatif Gelişim',

    summary,

    action:
      hasImportantArea
        ? `${analysis.importantArea?.area} bölümünde ağaç gelişimi, sürgün/taç durumu, su ve beslenme koşullarını komşu alanla karşılaştır; hasat veya olgunluk müdahalesi önerme.`
        : 'Ağaç gelişimini, sürgün/taç durumunu ve sezon bakımını takip et; hasat veya olgunluk önerisi uygulama.',

    reasons:
      reasons.slice(
        0,
        5,
      ),

    caution:
      `${analysis.caution} Bu tarla ürün vermiyor olarak kayıtlı olduğu için ürün/hasat odaklı fenoloji önerileri bastırılmıştır.`,
  };
}

export function applyPhenologyToMapAnalysis(
  analysis: UnifiedMapAiResult,
  snapshot:
    | FieldPhenologySnapshot
    | null
    | undefined,
  activeLayer: UnifiedMapActiveLayer,
): UnifiedMapAiResult {
  if (
    !snapshot ||
    snapshot.phenology.dataStatus !==
      'usable' ||
    snapshot.phenology.stage ===
      'unknown'
  ) {
    return analysis;
  }

  let result =
    withPhenologyEvidence(
      analysis,
      snapshot,
    );

  result =
    protectDormantOrFinishedStage(
      result,
      snapshot,
      activeLayer,
    );

  result =
    protectHarvestWindow(
      result,
      snapshot,
      activeLayer,
    );

  result =
    strengthenSensitiveGrowthStage(
      result,
      snapshot,
      activeLayer,
    );

  /*
    En son uygulanır:
    bearing=false ise önceki hasat/meyve metinlerini
    kesin olarak bastırır.
  */
  result =
    protectNonBearingPerennial(
      result,
      snapshot,
      activeLayer,
    );

  return result;
}
