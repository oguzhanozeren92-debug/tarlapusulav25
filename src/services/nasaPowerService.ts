export type NasaPowerDay = {
  date: string;
  temperature: number | null;
  maxTemperature: number | null;
  minTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  solarRadiation: number | null;
};

export type NasaPowerSummary = {
  source: 'NASA POWER';
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;

  days: NasaPowerDay[];

  summary: {
    averageTemperature: number | null;
    totalPrecipitation: number | null;
    averageHumidity: number | null;
    averageWindSpeed: number | null;
    averageSolarRadiation: number | null;
  };

  fetchedAt: string;
};

const NASA_POWER_API =
  'https://power.larc.nasa.gov/api/temporal/daily/point';

const PARAMETERS = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'RH2M',
  'WS2M',
  'PRECTOTCORR',
  'ALLSKY_SFC_SW_DWN',
];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

function readableDate(value: string) {
  if (value.length !== 8) return value;

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

  // NASA POWER eksik veri için bazen -999 kullanabilir.
  if (parsed <= -900) return null;

  return parsed;
}

function average(values: Array<number | null>) {
  const valid = values.filter(
    (value): value is number => value !== null,
  );

  if (!valid.length) return null;

  return (
    valid.reduce((total, value) => total + value, 0) /
    valid.length
  );
}

function sum(values: Array<number | null>) {
  const valid = values.filter(
    (value): value is number => value !== null,
  );

  if (!valid.length) return null;

  return valid.reduce((total, value) => total + value, 0);
}

export async function fetchNasaPowerData(
  latitude: number,
  longitude: number,
  days = 7,
): Promise<NasaPowerSummary> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('NASA POWER için geçerli koordinat gerekli.');
  }

  const end = new Date();

  // POWER verisi bugünün tamamı oluşmamış olabileceği için
  // dünü son gün olarak kullanıyoruz.
  end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  return fetchNasaPowerRange(latitude, longitude, formatDate(start), formatDate(end));
}

/** Historic daily weather for an explicitly selected season; no request is made until called. */
export async function fetchNasaPowerRange(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<NasaPowerSummary> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Günlük hava için geçerli tarla konumu gerekli.');
  }
  if (!/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate) ||
      startDate > endDate ||
      !Number.isFinite(Date.parse(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6)}T00:00:00Z`)) ||
      !Number.isFinite(Date.parse(`${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6)}T00:00:00Z`))) {
    throw new Error('Sezonun başlangıç ve bitiş tarihi geçerli olmalı.');
  }

  const query = new URLSearchParams({
    parameters: PARAMETERS.join(','),
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: startDate,
    end: endDate,
    format: 'JSON',
    'time-standard': 'LST',
  });

  const response = await fetch(`${NASA_POWER_API}?${query.toString()}`);

  if (!response.ok) {
    throw new Error(
      `NASA POWER verisi alınamadı. HTTP ${response.status}`,
    );
  }

  const json = await response.json();

  const parameter = json?.properties?.parameter;

  if (!parameter) {
    throw new Error('NASA POWER beklenen veri yapısını döndürmedi.');
  }

  const dates = Object.keys(parameter.T2M ?? {});

  const rows: NasaPowerDay[] = dates.map((date) => ({
    date: readableDate(date),

    temperature: safeNumber(parameter.T2M?.[date]),
    maxTemperature: safeNumber(parameter.T2M_MAX?.[date]),
    minTemperature: safeNumber(parameter.T2M_MIN?.[date]),

    humidity: safeNumber(parameter.RH2M?.[date]),
    windSpeed: safeNumber(parameter.WS2M?.[date]),

    precipitation: safeNumber(parameter.PRECTOTCORR?.[date]),

    solarRadiation: safeNumber(
      parameter.ALLSKY_SFC_SW_DWN?.[date],
    ),
  }));

  return {
    source: 'NASA POWER',

    latitude,
    longitude,

    startDate: readableDate(startDate),
    endDate: readableDate(endDate),

    days: rows,

    summary: {
      averageTemperature: average(
        rows.map((row) => row.temperature),
      ),

      totalPrecipitation: sum(
        rows.map((row) => row.precipitation),
      ),

      averageHumidity: average(
        rows.map((row) => row.humidity),
      ),

      averageWindSpeed: average(
        rows.map((row) => row.windSpeed),
      ),

      averageSolarRadiation: average(
        rows.map((row) => row.solarRadiation),
      ),
    },

    fetchedAt: new Date().toISOString(),
  };
}
