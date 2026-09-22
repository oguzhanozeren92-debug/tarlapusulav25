import {
  readMapLayerArchive,
  writeMapLayerArchive,
} from '../features/map-data/services/mapLayerArchive';

export type WaterClimateVariable =
  | 'surface_temperature'
  | 'et0_fao_evapotranspiration'
  | 'rain_history'
  | 'frost_risk';

export type WaterClimatePointResult = {
  layer: 'climate';
  source: string;
  provider: 'open-meteo-water-climate';
  variable: WaterClimateVariable;
  variableLabel: string;
  unit: '°C' | 'mm';
  period: { start: string; end: string };
  stats: {
    average: number;
    min: number;
    max: number;
    validCellCount: number;
  };
  generatedAt: string;
  dataKind:
    | 'model-surface-temperature-proxy'
    | 'fao56-reference-et0'
    | 'reanalysis-rainfall'
    | 'forecast-minimum-temperature';
  satelliteProduct: null;
  cache?: 'device';
};

const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const CACHE_NAMESPACE = 'weather-field-condition-cards';
const CACHE_VERSION = 'weather-field-condition-v3';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const iso = (date: Date) => date.toISOString().slice(0, 10);

function finite(values: unknown[]) {
  return values.map(Number).filter(Number.isFinite);
}

function round3(value: number) {
  return Number(value.toFixed(3));
}

function cacheKey(
  latitude: number,
  longitude: number,
  variable: WaterClimateVariable,
  periodDays: number,
) {
  return [
    latitude.toFixed(5),
    longitude.toFixed(5),
    variable,
    Math.max(1, Math.round(periodDays)),
  ].join(':');
}

function labelFor(variable: WaterClimateVariable) {
  const labels: Record<WaterClimateVariable, string> = {
    surface_temperature: 'Yüzeye Yakın Toprak Sıcaklığı',
    et0_fao_evapotranspiration: 'Referans Su Talebi (ET₀)',
    rain_history: 'Yağış Geçmişi',
    frost_risk: 'Don Riski',
  };
  return labels[variable];
}

async function fetchArchiveSeries(input: {
  latitude: number;
  longitude: number;
  variable: 'surface_temperature' | 'et0_fao_evapotranspiration' | 'rain_history';
  periodDays: number;
}) {
  // ERA5 / ERA5-Land arşivinin birkaç günlük yayın gecikmesi vardır.
  // Kartlarda tamamlanmış ve sonradan değişmeyecek dönem kullanıyoruz.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 6);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(6, input.periodDays - 1));

  const params = new URLSearchParams({
    latitude: input.latitude.toFixed(5),
    longitude: input.longitude.toFixed(5),
    start_date: iso(start),
    end_date: iso(end),
    timezone: 'UTC',
  });

  if (input.variable === 'surface_temperature') {
    params.set('hourly', 'soil_temperature_0_to_7cm');
  } else if (input.variable === 'et0_fao_evapotranspiration') {
    params.set('daily', 'et0_fao_evapotranspiration');
  } else {
    params.set('daily', 'precipitation_sum');
  }

  const response = await fetch(`${OPEN_METEO_ARCHIVE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Su ve iklim arşiv servisi ${response.status} hatası verdi.`);
  }

  const payload = await response.json();
  let values: number[] = [];

  if (input.variable === 'surface_temperature') {
    values = finite(payload?.hourly?.soil_temperature_0_to_7cm ?? []);
  } else if (input.variable === 'et0_fao_evapotranspiration') {
    values = finite(payload?.daily?.et0_fao_evapotranspiration ?? []);
  } else {
    values = finite(payload?.daily?.precipitation_sum ?? []);
  }

  if (!values.length) {
    throw new Error(`${labelFor(input.variable)} için kullanılabilir veri yok.`);
  }

  return { values, start, end };
}

async function fetchFrostSeries(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    timezone: 'UTC',
    hourly: 'temperature_2m',
    forecast_days: '7',
  });

  const response = await fetch(`${OPEN_METEO_FORECAST}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Don riski servisi ${response.status} hatası verdi.`);
  }

  const payload = await response.json();
  const values = finite(payload?.hourly?.temperature_2m ?? []);
  if (!values.length) throw new Error('Don riski için kullanılabilir sıcaklık verisi yok.');

  const start = new Date();
  const end = new Date(Date.now() + 6 * 86400000);
  return { values, start, end };
}

export async function fetchWaterClimatePoint(
  latitude: number,
  longitude: number,
  variable: WaterClimateVariable,
  periodDays = 30,
): Promise<WaterClimatePointResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Su ve iklim kartları için geçerli tarla koordinatı gerekli.');
  }

  const normalizedPeriod =
    variable === 'rain_history'
      ? Math.max(30, periodDays)
      : variable === 'surface_temperature' || variable === 'et0_fao_evapotranspiration'
        ? 7
        : 7;

  const key = cacheKey(latitude, longitude, variable, normalizedPeriod);
  const cached = await readMapLayerArchive<WaterClimatePointResult>({
    namespace: CACHE_NAMESPACE,
    key,
    processingVersion: CACHE_VERSION,
    ttlMs: CACHE_TTL_MS,
  });

  if (cached) return { ...cached, cache: 'device' };

  const series =
    variable === 'frost_risk'
      ? await fetchFrostSeries(latitude, longitude)
      : await fetchArchiveSeries({
          latitude,
          longitude,
          variable,
          periodDays: normalizedPeriod,
        });

  const { values, start, end } = series;
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const value =
    variable === 'rain_history' || variable === 'et0_fao_evapotranspiration'
      ? sum
      : variable === 'frost_risk'
        ? Math.min(...values)
        : mean;

  const result: WaterClimatePointResult = {
    layer: 'climate',
    source:
      variable === 'frost_risk'
        ? 'Open-Meteo Tahmin'
        : variable === 'rain_history'
          ? 'ERA5 / Open-Meteo Arşiv'
          : 'ERA5-Land / Open-Meteo Arşiv',
    provider: 'open-meteo-water-climate',
    variable,
    variableLabel: labelFor(variable),
    unit:
      variable === 'surface_temperature' || variable === 'frost_risk' ? '°C' : 'mm',
    period: { start: iso(start), end: iso(end) },
    stats: {
      average: round3(value),
      min: round3(Math.min(...values)),
      max: round3(Math.max(...values)),
      validCellCount: values.length,
    },
    generatedAt: new Date().toISOString(),
    dataKind:
      variable === 'surface_temperature'
        ? 'model-surface-temperature-proxy'
        : variable === 'et0_fao_evapotranspiration'
          ? 'fao56-reference-et0'
          : variable === 'rain_history'
            ? 'reanalysis-rainfall'
            : 'forecast-minimum-temperature',
    satelliteProduct: null,
  };

  await writeMapLayerArchive({
    namespace: CACHE_NAMESPACE,
    key,
    processingVersion: CACHE_VERSION,
    data: result,
    ttlMs: CACHE_TTL_MS,
  });

  return result;
}
