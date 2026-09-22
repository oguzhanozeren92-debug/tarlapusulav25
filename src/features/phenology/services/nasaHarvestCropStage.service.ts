import type { NdviTimeSeriesPoint } from '../../satellite/types/ndviTimeSeries';
import type {
  PhenologyConfidence,
  PhenologyResult,
  PhenologyStage,
} from '../types/phenology';

/**
 * TarlaPusula adapter for NASA Harvest's Apache-2.0 crop-stage-detection project.
 * Reference implementation:
 * https://github.com/nasaharvest/crop-stage-detection/blob/main/src/crop_stage.py
 *
 * We keep the project's crop-agnostic A-E adaptive stage logic, including:
 * - daily interpolation of irregular NDVI observations,
 * - Whittaker smoothing (lambda=6000, second differences),
 * - adaptive 90th-percentile peak threshold with a 0.50 floor,
 * - 0.35 lower threshold,
 * - Kalman velocity,
 * - confirmed peak history before assigning senescence/post-harvest.
 *
 * The upstream implementation uses PCHIP for daily interpolation. This browser
 * adapter uses bounded linear interpolation before the same Whittaker smoother;
 * therefore the source is deliberately described as an "uyarlama", not as the
 * upstream Python package executing verbatim.
 */

export type NasaHarvestStageCode = 'A' | 'B' | 'C' | 'D' | 'E';

export type NasaHarvestCropStageResult = {
  status: 'usable' | 'insufficient_data';
  engine: 'nasa-harvest-crop-stage';
  source: 'NASA Harvest crop-stage-detection';
  algorithm: 'adaptive-ndvi-a-e-v1';
  stageCode: NasaHarvestStageCode | null;
  stageDescription: string;
  canonicalStage: PhenologyStage;
  stageLabel: string;
  currentNdvi: number | null;
  velocityPerDay: number | null;
  upperThreshold: number | null;
  lowerThreshold: number;
  peakDate: string | null;
  daysSincePeak: number | null;
  observationCount: number;
  dailyPointCount: number;
  spanDays: number | null;
  latestDate: string | null;
  confidence: PhenologyConfidence;
  basis: string[];
  warnings: string[];
};

const DAY_MS = 86_400_000;
const UPPER_PERCENTILE = 90;
const MIN_PEAK_NDVI = 0.5;
const LOWER_THRESHOLD = 0.35;
const MIN_PEAK_WIDTH_DAYS = 5;
const MIN_DAILY_OBSERVATIONS = 30;
const WHITTAKER_LAMBDA = 6_000;
const MAX_CURRENT_OBSERVATION_AGE_DAYS = 20;

const STAGE_DESCRIPTIONS: Record<NasaHarvestStageCode, string> = {
  A: 'Çıplak toprak / ekim / çıkış',
  B: 'Yeşillenme / hızlı gelişim',
  C: 'Tepe gelişim',
  D: 'Yaşlanma / olgunlaşmaya geçiş',
  E: 'Hasat sonrası / bitki artığı / çıplak toprak',
};

const CANONICAL_STAGE: Record<NasaHarvestStageCode, PhenologyStage> = {
  A: 'establishment',
  B: 'vegetative',
  C: 'reproductive',
  D: 'maturation',
  E: 'post_harvest',
};

const CANONICAL_LABEL: Record<NasaHarvestStageCode, string> = {
  A: 'Çıkış / kuruluş',
  B: 'Vejetatif gelişim',
  C: 'Tepe gelişim',
  D: 'Olgunlaşmaya geçiş',
  E: 'Hasat sonrası',
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function dateMs(value: unknown): number | null {
  const raw = String(value ?? '').trim().slice(0, 10);
  if (!raw) return null;
  const parsed = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (clamp(p, 0, 100) / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const fraction = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

function sanitizePoints(points: NdviTimeSeriesPoint[]) {
  const byDay = new Map<string, { date: string; ms: number; ndvi: number }>();

  for (const point of points ?? []) {
    const ms = dateMs(point?.date);
    const ndvi = Number(point?.average);
    if (ms === null || !Number.isFinite(ndvi)) continue;
    if (ndvi < -1 || ndvi > 1) continue;
    const date = isoDate(ms);
    byDay.set(date, { date, ms, ndvi });
  }

  return [...byDay.values()].sort((a, b) => a.ms - b.ms);
}

function dailyLinearInterpolation(
  observations: Array<{ date: string; ms: number; ndvi: number }>,
) {
  if (!observations.length) return [] as Array<{ date: string; ms: number; ndvi: number }>;
  if (observations.length === 1) return [observations[0]];

  const first = observations[0].ms;
  const last = observations.at(-1)!.ms;
  const output: Array<{ date: string; ms: number; ndvi: number }> = [];
  let rightIndex = 1;

  for (let ms = first; ms <= last; ms += DAY_MS) {
    while (rightIndex < observations.length - 1 && observations[rightIndex].ms < ms) {
      rightIndex += 1;
    }

    const right = observations[rightIndex];
    const left = observations[Math.max(0, rightIndex - 1)];
    const interval = Math.max(DAY_MS, right.ms - left.ms);
    const ratio = clamp((ms - left.ms) / interval, 0, 1);
    const ndvi = left.ndvi + (right.ndvi - left.ndvi) * ratio;
    output.push({ date: isoDate(ms), ms, ndvi });
  }

  return output;
}

function solveLinearSystem(matrix: number[][], rhs: number[]) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);

  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    let pivotAbs = Math.abs(a[column][column]);
    for (let row = column + 1; row < n; row += 1) {
      const candidate = Math.abs(a[row][column]);
      if (candidate > pivotAbs) {
        pivot = row;
        pivotAbs = candidate;
      }
    }

    if (pivotAbs < 1e-12) throw new Error('Whittaker sistemi çözülemedi.');
    if (pivot !== column) [a[column], a[pivot]] = [a[pivot], a[column]];

    const divisor = a[column][column];
    for (let j = column; j <= n; j += 1) a[column][j] /= divisor;

    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      if (Math.abs(factor) < 1e-16) continue;
      for (let j = column; j <= n; j += 1) {
        a[row][j] -= factor * a[column][j];
      }
    }
  }

  return a.map((row) => row[n]);
}

function whittakerSmooth(values: number[], lambda = WHITTAKER_LAMBDA) {
  const n = values.length;
  if (n < 3) return [...values];

  const matrix = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, column) => (row === column ? 1 : 0)),
  );

  // D is the second-order finite-difference operator with row [1, -2, 1].
  for (let i = 0; i < n - 2; i += 1) {
    const indices = [i, i + 1, i + 2];
    const coefficients = [1, -2, 1];
    for (let a = 0; a < 3; a += 1) {
      for (let b = 0; b < 3; b += 1) {
        matrix[indices[a]][indices[b]] +=
          lambda * coefficients[a] * coefficients[b];
      }
    }
  }

  return solveLinearSystem(matrix, values).map((value) => clamp(value, -1, 1));
}

function movingAverageFallback(values: number[], radius = 3) {
  return values.map((_, index) => {
    let total = 0;
    let count = 0;
    for (let i = Math.max(0, index - radius); i <= Math.min(values.length - 1, index + radius); i += 1) {
      total += values[i];
      count += 1;
    }
    return count ? total / count : values[index];
  });
}

function kalmanVelocity(values: number[]) {
  if (values.length < 2) return 0;

  const measurementNoise = 0.005;
  const processNoiseLevel = 0.001;
  const processNoiseVelocity = 0.0001;

  let level = values[0];
  let velocity = 0;
  let p00 = 1;
  let p01 = 0;
  let p10 = 0;
  let p11 = 1;

  for (let i = 1; i < values.length; i += 1) {
    const dt = 1;
    const predictedLevel = level + dt * velocity;
    const predictedVelocity = velocity;
    const pp00 = p00 + dt * (p01 + p10) + dt * dt * p11 + processNoiseLevel * dt;
    const pp01 = p01 + dt * p11;
    const pp10 = p10 + dt * p11;
    const pp11 = p11 + processNoiseVelocity * dt;
    const innovation = values[i] - predictedLevel;
    const s = pp00 + measurementNoise;
    const k0 = pp00 / s;
    const k1 = pp10 / s;

    level = predictedLevel + k0 * innovation;
    velocity = predictedVelocity + k1 * innovation;
    p00 = (1 - k0) * pp00;
    p01 = (1 - k0) * pp01;
    p10 = pp10 - k1 * pp00;
    p11 = pp11 - k1 * pp01;
  }

  return velocity;
}

function findLastPeak(values: number[], upperThreshold: number) {
  let lastPeakIndex: number | null = null;
  let index = 0;

  while (index < values.length) {
    if (values[index] >= upperThreshold) {
      let end = index;
      while (end < values.length && values[end] >= upperThreshold) end += 1;
      if (end - index >= MIN_PEAK_WIDTH_DAYS) {
        let peakIndex = index;
        for (let i = index + 1; i < end; i += 1) {
          if (values[i] > values[peakIndex]) peakIndex = i;
        }
        lastPeakIndex = peakIndex;
      }
      index = end;
    } else {
      index += 1;
    }
  }

  return lastPeakIndex;
}

function maxGapDays(observations: Array<{ ms: number }>) {
  let max = 0;
  for (let i = 1; i < observations.length; i += 1) {
    max = Math.max(max, Math.round((observations[i].ms - observations[i - 1].ms) / DAY_MS));
  }
  return max;
}

function insufficient(
  observations: Array<{ date: string; ms: number; ndvi: number }>,
  dailyCount: number,
  message: string,
): NasaHarvestCropStageResult {
  const spanDays = observations.length >= 2
    ? Math.round((observations.at(-1)!.ms - observations[0].ms) / DAY_MS)
    : null;

  return {
    status: 'insufficient_data',
    engine: 'nasa-harvest-crop-stage',
    source: 'NASA Harvest crop-stage-detection',
    algorithm: 'adaptive-ndvi-a-e-v1',
    stageCode: null,
    stageDescription: 'Güvenilir evre tahmini için veri yetersiz',
    canonicalStage: 'unknown',
    stageLabel: 'Belirlenemedi',
    currentNdvi: observations.at(-1)?.ndvi ?? null,
    velocityPerDay: null,
    upperThreshold: null,
    lowerThreshold: LOWER_THRESHOLD,
    peakDate: null,
    daysSincePeak: null,
    observationCount: observations.length,
    dailyPointCount: dailyCount,
    spanDays,
    latestDate: observations.at(-1)?.date ?? null,
    confidence: 'low',
    basis: observations.length
      ? [`${observations.length} gerçek tarihli NDVI gözlemi bulundu.`]
      : [],
    warnings: [message],
  };
}

export function estimateNasaHarvestCropStage(
  points: NdviTimeSeriesPoint[],
  now = new Date(),
): NasaHarvestCropStageResult {
  const observations = sanitizePoints(points);
  if (observations.length < 3) {
    return insufficient(
      observations,
      observations.length,
      'NASA Harvest uyarlaması için en az 3 gerçek tarihli NDVI gözlemi gerekiyor.',
    );
  }

  const latest = observations.at(-1)!;
  const latestAgeDays = Math.floor((now.getTime() - latest.ms) / DAY_MS);
  if (latestAgeDays > MAX_CURRENT_OBSERVATION_AGE_DAYS) {
    return insufficient(
      observations,
      0,
      `Son NDVI gözlemi ${latestAgeDays} gün önce; güncel gelişim evresi olarak kullanılmadı.`,
    );
  }

  const daily = dailyLinearInterpolation(observations);
  if (daily.length < MIN_DAILY_OBSERVATIONS) {
    return insufficient(
      observations,
      daily.length,
      `Günlük seri ${daily.length} gün; NASA Harvest karar mantığı en az ${MIN_DAILY_OBSERVATIONS} günlük eğri gerektiriyor.`,
    );
  }

  const rawDaily = daily.map((point) => point.ndvi);
  let smoothed: number[];
  let smootherFallback = false;
  try {
    smoothed = whittakerSmooth(rawDaily);
  } catch {
    smootherFallback = true;
    smoothed = movingAverageFallback(rawDaily);
  }

  const upperThreshold = Math.max(
    percentile(smoothed, UPPER_PERCENTILE),
    MIN_PEAK_NDVI,
  );
  const current = smoothed.at(-1)!;
  let stageCode: NasaHarvestStageCode;
  let velocity: number | null = null;
  let peakIndex: number | null = null;

  if (current >= upperThreshold) {
    stageCode = 'C';
  } else {
    velocity = kalmanVelocity(smoothed);
    peakIndex = findLastPeak(smoothed, upperThreshold);
    const hadPeak = peakIndex !== null;

    if (current >= LOWER_THRESHOLD) {
      stageCode = hadPeak && velocity <= 0 ? 'D' : 'B';
    } else {
      stageCode = hadPeak ? 'E' : 'A';
    }
  }

  // Upstream returns no Peak_date while the latest point itself is in stage C.
  // Keep that behavior rather than fabricating a peak date.
  const peakDate = peakIndex === null ? null : daily[peakIndex]?.date ?? null;
  const daysSincePeak = peakIndex === null
    ? null
    : Math.max(0, daily.length - 1 - peakIndex);
  const spanDays = Math.round((latest.ms - observations[0].ms) / DAY_MS);
  const gapDays = maxGapDays(observations);
  const warnings: string[] = [
    'Bu sonuç ürün-spesifik BBCH evresi değildir; NDVI sezon eğrisinden üretilen genel A–E gelişim evresidir.',
  ];
  if (gapDays > 20) {
    warnings.push(`Gerçek uydu gözlemleri arasında en uzun boşluk ${gapDays} gün; saha doğrulaması önerilir.`);
  }
  if (smootherFallback) {
    warnings.push('Whittaker çözümü kullanılamadı; güvenli hareketli ortalama yedeği kullanıldı.');
  }

  const confidence: PhenologyConfidence =
    observations.length >= 8 && spanDays >= 60 && gapDays <= 20 && !smootherFallback
      ? 'high'
      : 'medium';

  return {
    status: 'usable',
    engine: 'nasa-harvest-crop-stage',
    source: 'NASA Harvest crop-stage-detection',
    algorithm: 'adaptive-ndvi-a-e-v1',
    stageCode,
    stageDescription: STAGE_DESCRIPTIONS[stageCode],
    canonicalStage: CANONICAL_STAGE[stageCode],
    stageLabel: CANONICAL_LABEL[stageCode],
    currentNdvi: current,
    velocityPerDay: velocity,
    upperThreshold,
    lowerThreshold: LOWER_THRESHOLD,
    peakDate,
    daysSincePeak,
    observationCount: observations.length,
    dailyPointCount: daily.length,
    spanDays,
    latestDate: latest.date,
    confidence,
    basis: [
      'NASA Harvest crop-stage-detection adaptif A–E evre mantığı',
      `${observations.length} gerçek NDVI tarihi · ${spanDays} günlük dönem`,
      `Günlük ara değerleme + Whittaker yumuşatma · son uydu ${latest.date}`,
    ],
    warnings,
  };
}

function stageRank(stage: PhenologyStage) {
  switch (stage) {
    case 'pre_sowing': return -1;
    case 'establishment': return 0;
    case 'vegetative': return 1;
    case 'reproductive':
    case 'flowering': return 2;
    case 'maturation':
    case 'fruit_set':
    case 'fruit_growth':
    case 'veraison': return 3;
    case 'harvest_window': return 4;
    case 'post_harvest': return 5;
    default: return null;
  }
}

function fromNasaHarvest(
  nasa: NasaHarvestCropStageResult,
  base?: PhenologyResult | null,
): PhenologyResult {
  return {
    stage: nasa.canonicalStage,
    stageLabel: nasa.stageLabel,
    confidence: nasa.confidence,
    dataStatus: nasa.status === 'usable' ? 'usable' : 'insufficient_data',
    progressPercent: base?.progressPercent ?? null,
    daysSinceSowing: base?.daysSinceSowing ?? null,
    daysUntilExpectedHarvest: base?.daysUntilExpectedHarvest ?? null,
    basis: nasa.basis,
    warnings: nasa.warnings,
    summary: nasa.status === 'usable'
      ? `NASA Harvest uyarlaması, güncel NDVI sezon eğrisini “${nasa.stageLabel}” evresinde gösteriyor.`
      : 'NASA Harvest NDVI evresi için yeterli güncel uydu geçmişi yok.',
  };
}

export function fusePhenologyWithNasaHarvest(
  base: PhenologyResult | null | undefined,
  nasa: NasaHarvestCropStageResult | null | undefined,
): PhenologyResult | null {
  if (!nasa || nasa.status !== 'usable' || nasa.canonicalStage === 'unknown') {
    return base ?? null;
  }

  if (!base || base.dataStatus !== 'usable' || base.stage === 'unknown') {
    return fromNasaHarvest(nasa, base);
  }

  const baseUsesWofost = base.basis.some((item) => /wofost|pcse/i.test(String(item)));
  const crossModelBasis = baseUsesWofost
    ? ['Model çapraz kontrolü: PCSE/WOFOST ↔ NASA Harvest NDVI']
    : [];

  // An explicit harvest/post-harvest state is authoritative; NDVI cannot reopen a season.
  if (base.stage === 'post_harvest') {
    return {
      ...base,
      basis: [...new Set([...base.basis, ...nasa.basis, ...crossModelBasis])],
      warnings: [...new Set([...base.warnings, ...nasa.warnings])],
    };
  }

  const baseRank = stageRank(base.stage);
  const nasaRank = stageRank(nasa.canonicalStage);

  if (baseRank === null || nasaRank === null) {
    return {
      ...base,
      basis: [...new Set([...base.basis, ...nasa.basis, ...crossModelBasis])],
    };
  }

  const distance = Math.abs(baseRank - nasaRank);

  // A low-confidence calendar/local estimate can be replaced by a usable observed NDVI curve.
  if (base.confidence === 'low' && nasa.confidence !== 'low') {
    const observed = fromNasaHarvest(nasa, base);
    return {
      ...observed,
      basis: [...new Set([...base.basis, ...observed.basis, ...crossModelBasis])],
      warnings: [...new Set([...base.warnings, ...observed.warnings])],
    };
  }

  if (distance <= 1) {
    const sameStage = base.stage === nasa.canonicalStage;
    return {
      ...base,
      confidence: sameStage && base.confidence !== 'low' && nasa.confidence === 'high'
        ? 'high'
        : base.confidence === 'high'
          ? 'high'
          : 'medium',
      basis: [...new Set([...base.basis, ...nasa.basis, ...crossModelBasis])],
      warnings: [...new Set([...base.warnings, ...nasa.warnings])],
      summary: sameStage
        ? `${base.summary} ${baseUsesWofost ? 'PCSE/WOFOST ile NASA Harvest NDVI aynı genel gelişim evresini gösteriyor.' : 'NASA Harvest NDVI eğrisi de aynı genel gelişim evresini destekliyor.'}`
        : `${base.summary} NASA Harvest NDVI eğrisi yakın bir gelişim fazı gösteriyor; iki kaynak birlikte izleniyor.`,
    };
  }

  return {
    ...base,
    confidence: 'low',
    basis: [...new Set([...base.basis, ...nasa.basis])],
    warnings: [
      ...new Set([
        ...base.warnings,
        ...nasa.warnings,
        `Gelişim kaynakları uyuşmuyor: ${baseUsesWofost ? 'PCSE/WOFOST' : 'mevcut model/takvim'} “${base.stageLabel}”, NASA Harvest NDVI “${nasa.stageLabel}” gösteriyor. Saha kontrolüyle doğrula.`,
      ]),
    ],
    summary: `${base.summary} NDVI eğrisiyle belirgin evre farkı görüldüğü için sonuç ön kontrol seviyesine düşürüldü.`,
  };
}
