import {
  readFieldMapLayerCache,
  writeFieldMapLayerCache,
} from '../features/home-map/services/fieldMapLayerCache';
import {
  fetchSoilGridsProfile,
  type SoilGridsProfile,
} from './soilGridsService';

export type RothCPool = 'DPM' | 'RPM' | 'BIO' | 'HUM';
export type RothCContextStatus = 'ready' | 'partial' | 'blocked' | 'error';

export type RothCMonthlyContext = {
  month: string;
  meanTemperatureC: number;
  precipitationMm: number;
  et0Mm: number;
  openPanEvaporationProxyMm: number;
  covered: {
    accumulatedTsmdMm: number;
    temperatureModifier: number;
    moistureModifier: number;
    coverModifier: 0.6;
    combinedModifier: number;
  };
  bare: {
    accumulatedTsmdMm: number;
    temperatureModifier: number;
    moistureModifier: number;
    coverModifier: 1;
    combinedModifier: number;
  };
};

export type RothCCarbonContext = {
  status: RothCContextStatus;
  source: 'RothC / Rothamsted Research';
  mode: 'turnover-context';
  productionAuthority: false;
  fieldId: string;
  latitude: number;
  longitude: number;
  climatePeriod: { start: string | null; end: string | null; completeMonths: number };
  soil: {
    source: 'SoilGrids';
    clayPercent: number | null;
    organicCarbonGKg0To30: number | null;
    modelDepthCm: number;
    soilGridsResolutionM: number | null;
  };
  clayPartition: {
    co2Fraction: number | null;
    bioHumFraction: number | null;
    bioFractionOfRetained: 0.46;
    humFractionOfRetained: 0.54;
  };
  monthly: RothCMonthlyContext[];
  annual: {
    meanCoveredModifier: number | null;
    meanBareModifier: number | null;
    highestTurnoverMonth: string | null;
    lowestTurnoverMonth: string | null;
    decompositionPotentialCovered: Record<RothCPool, number> | null;
    decompositionPotentialBare: Record<RothCPool, number> | null;
  };
  fullSimulation: {
    ready: false;
    missingInputs: string[];
    note: string;
  };
  evidence: string[];
  warnings: string[];
  generatedAt: string;
};

type DailyClimate = {
  date: string;
  temperatureC: number;
  precipitationMm: number;
  et0Mm: number;
};

type MonthlyClimate = {
  month: string;
  meanTemperatureC: number;
  precipitationMm: number;
  et0Mm: number;
};

const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_NAMESPACE = 'rothc-carbon-context-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STANDARD_TOPSOIL_DEPTH_CM = 23;
const DECOMPOSITION_RATE_PER_YEAR: Record<RothCPool, number> = {
  DPM: 10,
  RPM: 0.3,
  BIO: 0.66,
  HUM: 0.02,
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number | null, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function completeTwelveMonthWindow(reference = new Date()) {
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  return { start, end };
}

/** Standard RothC temperature rate modifier. */
export function rothcTemperatureModifier(meanTemperatureC: number) {
  if (!Number.isFinite(meanTemperatureC) || meanTemperatureC < -5) return 0;
  return 47.91 / (Math.exp(106.06 / (meanTemperatureC + 18.27)) + 1);
}

/** Standard RothC maximum topsoil moisture deficit (TSMD). */
export function rothcMaximumTsmdMm(
  clayPercent: number,
  soilDepthCm = STANDARD_TOPSOIL_DEPTH_CM,
  bare = false,
) {
  const clay = clamp(clayPercent, 0, 100);
  const depth = Math.max(1, soilDepthCm);
  const covered = -(20 + 1.3 * clay - 0.01 * clay * clay) * (depth / 23);
  return bare ? covered / 1.8 : covered;
}

/** Standard RothC moisture rate modifier from accumulated TSMD. */
export function rothcMoistureModifier(
  accumulatedTsmdMm: number,
  maximumTsmdMm: number,
) {
  const maxTsmd = Math.min(-0.000001, maximumTsmdMm);
  const acc = clamp(accumulatedTsmdMm, maxTsmd, 0);
  const threshold = 0.444 * maxTsmd;
  if (acc > threshold) return 1;
  return clamp(
    0.2 + 0.8 * ((maxTsmd - acc) / (maxTsmd - threshold)),
    0.2,
    1,
  );
}

/** Standard RothC clay-controlled CO2 versus BIO+HUM partition. */
export function rothcClayPartition(clayPercent: number) {
  const clay = clamp(clayPercent, 0, 100);
  const ratio = 1.67 * (1.85 + 1.6 * Math.exp(-0.0786 * clay));
  return {
    co2Fraction: ratio / (ratio + 1),
    bioHumFraction: 1 / (ratio + 1),
  };
}

function updateTsmd(
  previousTsmd: number,
  precipitationMm: number,
  openPanEvaporationMm: number,
  maximumTsmdMm: number,
) {
  // RothC uses rainfall - 0.75 * open-pan evaporation.
  const balance = precipitationMm - 0.75 * openPanEvaporationMm;
  return Math.max(maximumTsmdMm, Math.min(0, previousTsmd + balance));
}

function annualDecompositionPotential(monthlyModifiers: number[]) {
  if (!monthlyModifiers.length) return null;
  const modifierSum = monthlyModifiers.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(DECOMPOSITION_RATE_PER_YEAR).map(([pool, k]) => [
      pool,
      Number((1 - Math.exp((-k * modifierSum) / 12)).toFixed(4)),
    ]),
  ) as Record<RothCPool, number>;
}

async function fetchCompleteClimateYear(latitude: number, longitude: number) {
  const window = completeTwelveMonthWindow();
  const query = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    start_date: isoDate(window.start),
    end_date: isoDate(window.end),
    daily: 'temperature_2m_mean,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'UTC',
  });
  const response = await fetch(`${OPEN_METEO_ARCHIVE}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`RothC iklim bağlamı alınamadı. Open-Meteo ${response.status} hatası verdi.`);
  }
  const payload = await response.json();
  const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
  const temperatures = Array.isArray(payload?.daily?.temperature_2m_mean)
    ? payload.daily.temperature_2m_mean : [];
  const precipitation = Array.isArray(payload?.daily?.precipitation_sum)
    ? payload.daily.precipitation_sum : [];
  const et0 = Array.isArray(payload?.daily?.et0_fao_evapotranspiration)
    ? payload.daily.et0_fao_evapotranspiration : [];
  const daily = dates.map((date: unknown, index: number): DailyClimate | null => {
    const temperatureC = finite(temperatures[index]);
    const precipitationMm = finite(precipitation[index]);
    const et0Mm = finite(et0[index]);
    if (!date || temperatureC == null || precipitationMm == null || et0Mm == null) return null;
    return {
      date: String(date),
      temperatureC,
      precipitationMm: Math.max(0, precipitationMm),
      et0Mm: Math.max(0, et0Mm),
    };
  }).filter((row: DailyClimate | null): row is DailyClimate => row !== null);
  if (daily.length < 300) {
    throw new Error(`RothC için 12 aylık iklim serisi eksik (${daily.length} geçerli gün).`);
  }
  return { daily, start: isoDate(window.start), end: isoDate(window.end) };
}

function aggregateMonthly(daily: DailyClimate[]): MonthlyClimate[] {
  const groups = new Map<string, { temperatures: number[]; precipitationMm: number; et0Mm: number }>();
  daily.forEach((row) => {
    const month = row.date.slice(0, 7);
    const group = groups.get(month) ?? { temperatures: [], precipitationMm: 0, et0Mm: 0 };
    group.temperatures.push(row.temperatureC);
    group.precipitationMm += row.precipitationMm;
    group.et0Mm += row.et0Mm;
    groups.set(month, group);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    month,
    meanTemperatureC: value.temperatures.reduce((sum, item) => sum + item, 0) / value.temperatures.length,
    precipitationMm: value.precipitationMm,
    et0Mm: value.et0Mm,
  }));
}

function buildMonthlyContext(
  monthlyClimate: MonthlyClimate[],
  clayPercent: number,
  soilDepthCm: number,
) {
  const coveredMaxTsmd = rothcMaximumTsmdMm(clayPercent, soilDepthCm, false);
  const bareMaxTsmd = rothcMaximumTsmdMm(clayPercent, soilDepthCm, true);
  let coveredTsmd = 0;
  let bareTsmd = 0;
  return monthlyClimate.map((climate): RothCMonthlyContext => {
    // ET0 is not observed pan evaporation. ET0/0.75 is used only as an explicit proxy.
    const openPanProxy = climate.et0Mm / 0.75;
    coveredTsmd = updateTsmd(coveredTsmd, climate.precipitationMm, openPanProxy, coveredMaxTsmd);
    bareTsmd = updateTsmd(bareTsmd, climate.precipitationMm, openPanProxy, bareMaxTsmd);
    const temperatureModifier = rothcTemperatureModifier(climate.meanTemperatureC);
    const coveredMoisture = rothcMoistureModifier(coveredTsmd, coveredMaxTsmd);
    const bareMoisture = rothcMoistureModifier(bareTsmd, bareMaxTsmd);
    return {
      month: climate.month,
      meanTemperatureC: round(climate.meanTemperatureC, 2)!,
      precipitationMm: round(climate.precipitationMm, 2)!,
      et0Mm: round(climate.et0Mm, 2)!,
      openPanEvaporationProxyMm: round(openPanProxy, 2)!,
      covered: {
        accumulatedTsmdMm: round(coveredTsmd, 2)!,
        temperatureModifier: round(temperatureModifier, 4)!,
        moistureModifier: round(coveredMoisture, 4)!,
        coverModifier: 0.6,
        combinedModifier: round(temperatureModifier * coveredMoisture * 0.6, 4)!,
      },
      bare: {
        accumulatedTsmdMm: round(bareTsmd, 2)!,
        temperatureModifier: round(temperatureModifier, 4)!,
        moistureModifier: round(bareMoisture, 4)!,
        coverModifier: 1,
        combinedModifier: round(temperatureModifier * bareMoisture, 4)!,
      },
    };
  });
}

function cacheKey(fieldId: string, latitude: number, longitude: number) {
  return `${fieldId}:rothc:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

function errorResult(input: {
  fieldId: string;
  latitude: number;
  longitude: number;
  message: string;
}): RothCCarbonContext {
  return {
    status: 'error',
    source: 'RothC / Rothamsted Research',
    mode: 'turnover-context',
    productionAuthority: false,
    fieldId: input.fieldId,
    latitude: input.latitude,
    longitude: input.longitude,
    climatePeriod: { start: null, end: null, completeMonths: 0 },
    soil: {
      source: 'SoilGrids',
      clayPercent: null,
      organicCarbonGKg0To30: null,
      modelDepthCm: STANDARD_TOPSOIL_DEPTH_CM,
      soilGridsResolutionM: null,
    },
    clayPartition: {
      co2Fraction: null,
      bioHumFraction: null,
      bioFractionOfRetained: 0.46,
      humFractionOfRetained: 0.54,
    },
    monthly: [],
    annual: {
      meanCoveredModifier: null,
      meanBareModifier: null,
      highestTurnoverMonth: null,
      lowestTurnoverMonth: null,
      decompositionPotentialCovered: null,
      decompositionPotentialBare: null,
    },
    fullSimulation: {
      ready: false,
      missingInputs: [
        'monthly_plant_carbon_input',
        'monthly_fym_carbon_input',
        'dpm_rpm_ratio',
        'calibrated_initial_carbon_pools_or_spinup',
        'validated_soil_carbon_stock',
      ],
      note: 'İklim veya toprak bağlamı hazırlanamadığı için RothC tam simülasyonu çalıştırılmadı.',
    },
    evidence: [],
    warnings: [input.message],
    generatedAt: new Date().toISOString(),
  };
}

export async function getRothCCarbonContext(input: {
  fieldId: string;
  latitude: number;
  longitude: number;
  soilProfile?: SoilGridsProfile | null;
  soilDepthCm?: number;
  forceRefresh?: boolean;
}): Promise<RothCCarbonContext> {
  const fieldId = String(input.fieldId ?? '').trim();
  const latitude = finite(input.latitude);
  const longitude = finite(input.longitude);
  if (!fieldId || latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return errorResult({
      fieldId,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      message: 'RothC bağlamı için geçerli tarla kimliği ve koordinat gerekli.',
    });
  }

  const key = cacheKey(fieldId, latitude, longitude);
  if (!input.forceRefresh) {
    const cached = await readFieldMapLayerCache<RothCCarbonContext>(
      fieldId,
      CACHE_NAMESPACE,
      key,
      CACHE_TTL_MS,
    );
    if (cached?.source === 'RothC / Rothamsted Research') return cached;
  }

  try {
    const [soil, climate] = await Promise.all([
      input.soilProfile
        ? Promise.resolve(input.soilProfile)
        : fetchSoilGridsProfile(latitude, longitude),
      fetchCompleteClimateYear(latitude, longitude),
    ]);
    const clayPercent = finite(soil.texture?.clayPercent);
    const organicCarbonGKg = finite(soil.properties?.organicCarbon?.topsoil0To30);
    if (clayPercent == null) throw new Error('RothC için SoilGrids kil yüzdesi bulunamadı.');
    const soilDepthCm = clamp(finite(input.soilDepthCm) ?? STANDARD_TOPSOIL_DEPTH_CM, 5, 100);
    const monthlyClimate = aggregateMonthly(climate.daily);
    if (monthlyClimate.length !== 12) {
      throw new Error(`RothC için 12 tam ay gerekli; ${monthlyClimate.length} ay hazır.`);
    }
    const monthly = buildMonthlyContext(monthlyClimate, clayPercent, soilDepthCm);
    const coveredModifiers = monthly.map((item) => item.covered.combinedModifier);
    const bareModifiers = monthly.map((item) => item.bare.combinedModifier);
    const meanCovered = coveredModifiers.reduce((sum, value) => sum + value, 0) / coveredModifiers.length;
    const meanBare = bareModifiers.reduce((sum, value) => sum + value, 0) / bareModifiers.length;
    const highest = [...monthly].sort((a, b) => b.covered.combinedModifier - a.covered.combinedModifier)[0] ?? null;
    const lowest = [...monthly].sort((a, b) => a.covered.combinedModifier - b.covered.combinedModifier)[0] ?? null;
    const partition = rothcClayPartition(clayPercent);

    const result: RothCCarbonContext = {
      status: organicCarbonGKg != null ? 'ready' : 'partial',
      source: 'RothC / Rothamsted Research',
      mode: 'turnover-context',
      productionAuthority: false,
      fieldId,
      latitude,
      longitude,
      climatePeriod: { start: climate.start, end: climate.end, completeMonths: monthly.length },
      soil: {
        source: 'SoilGrids',
        clayPercent: round(clayPercent, 2),
        organicCarbonGKg0To30: round(organicCarbonGKg, 2),
        modelDepthCm: soilDepthCm,
        soilGridsResolutionM: finite(soil.spatialResolutionMeters),
      },
      clayPartition: {
        co2Fraction: round(partition.co2Fraction, 4),
        bioHumFraction: round(partition.bioHumFraction, 4),
        bioFractionOfRetained: 0.46,
        humFractionOfRetained: 0.54,
      },
      monthly,
      annual: {
        meanCoveredModifier: round(meanCovered, 4),
        meanBareModifier: round(meanBare, 4),
        highestTurnoverMonth: highest?.month ?? null,
        lowestTurnoverMonth: lowest?.month ?? null,
        decompositionPotentialCovered: annualDecompositionPotential(coveredModifiers),
        decompositionPotentialBare: annualDecompositionPotential(bareModifiers),
      },
      fullSimulation: {
        ready: false,
        missingInputs: [
          'monthly_plant_carbon_input',
          'monthly_fym_carbon_input',
          'dpm_rpm_ratio',
          'calibrated_initial_carbon_pools_or_spinup',
          'validated_soil_carbon_stock',
        ],
        note: 'Bu aşama RothC turnover-context motorudur. Eksik yönetim ve havuz başlangıç verileri sentetik olarak doldurulmadığı için t C/ha veya karbon sekestrasyonu tahmini üretilmez.',
      },
      evidence: [
        `SoilGrids kil tahmini: ${clayPercent.toFixed(1)}%.`,
        organicCarbonGKg != null
          ? `SoilGrids 0–30 cm organik karbon bağlamı: ${organicCarbonGKg.toFixed(2)} g/kg.`
          : 'SoilGrids organik karbon bağlamı bulunamadı.',
        `RothC iklim değiştiricileri ${climate.start}–${climate.end} arasındaki 12 tam ay üzerinden hesaplandı.`,
        `Bitki örtülü senaryoda ortalama birleşik ayrışma değiştiricisi ${meanCovered.toFixed(3)}.`,
        highest ? `İklim açısından en yüksek göreli ayrışma baskısı ${highest.month} döneminde.` : '',
      ].filter(Boolean),
      warnings: [
        'SoilGrids bir model tahminidir; laboratuvar toprak analizi varsa öncelik laboratuvar verisindedir.',
        'Open-Meteo FAO-56 ET₀, gözlenmiş açık tava buharlaşması değildir. RothC nem fonksiyonu için ET₀/0.75 yalnızca açıkça işaretlenmiş bir çevrim bağlamı proxy’si olarak kullanılır.',
        'RothC tam karbon stok simülasyonu değildir; bitki artığı karbon girdisi, FYM/manure karbonu, DPM:RPM ve başlangıç karbon havuzları olmadan t C/ha değişimi hesaplanmaz.',
        `Standart RothC üst toprak derinliği bağlamı ${soilDepthCm.toFixed(0)} cm olarak kullanıldı.`,
      ],
      generatedAt: new Date().toISOString(),
    };

    await writeFieldMapLayerCache(fieldId, CACHE_NAMESPACE, key, result, CACHE_TTL_MS);
    return result;
  } catch (error) {
    return errorResult({
      fieldId,
      latitude,
      longitude,
      message: error instanceof Error ? error.message : 'RothC karbon bağlamı hazırlanamadı.',
    });
  }
}
