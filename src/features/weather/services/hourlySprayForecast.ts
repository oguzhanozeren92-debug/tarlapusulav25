export type SprayHour = {
  time: number;
  windKmh: number | null;
  gustKmh: number | null;
  rainChance: number | null;
  rainMm: number | null;
  temperatureC: number | null;
  humidity: number | null;
  isDay: boolean | null;
};

export type HourlySprayForecast = {
  timezone: string;
  updatedAt: number;
  hours: SprayHour[];
};

const MAX_SPRAY_FORECAST_AGE_MS = 2 * 60 * 60 * 1000;

export function isHourlySprayForecastFresh(data: HourlySprayForecast | null | undefined, now = Date.now()): boolean {
  return Boolean(data && Number.isFinite(data.updatedAt) &&
    data.updatedAt <= now + 5 * 60 * 1000 && now - data.updatedAt <= MAX_SPRAY_FORECAST_AGE_MS);
}

export type HourlySprayState = {
  status: 'loading' | 'ready' | 'error';
  data?: HourlySprayForecast;
  message?: string;
};

export type SprayWindow = {
  from: number;
  to: number;
  maxWindKmh: number;
  maxRainChance: number;
};

export function sprayWindowStartsSoon(window: Pick<SprayWindow, 'from' | 'to'> | null | undefined, now: number): boolean {
  return Boolean(window && window.from > now && window.from - now <= 2 * 3600000 && window.to > now);
}

export type SprayHourPlan = {
  windows: SprayWindow[];
  message: string;
  nextRisk: string | null;
  nextRiskAt: number | null;
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchHourlySprayForecast(latitude: number, longitude: number): Promise<HourlySprayForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('hourly', 'wind_speed_10m,wind_gusts_10m,precipitation_probability,precipitation,temperature_2m,relative_humidity_2m,is_day');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('forecast_days', '2');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Saatlik hava tahmini alınamadı.');
  const payload = await response.json();
  const hourly = payload?.hourly;
  if (!Array.isArray(hourly?.time) || hourly.time.length === 0) {
    throw new Error('Bu tarla için saatlik tahmin bulunamadı.');
  }

  return {
    timezone: String(payload.timezone || 'Europe/Istanbul'),
    updatedAt: Date.now(),
    hours: hourly.time.map((timestamp: unknown, index: number) => ({
      time: Number(timestamp) * 1000,
      windKmh: finite(hourly.wind_speed_10m?.[index]),
      gustKmh: finite(hourly.wind_gusts_10m?.[index]),
      rainChance: finite(hourly.precipitation_probability?.[index]),
      rainMm: finite(hourly.precipitation?.[index]),
      temperatureC: finite(hourly.temperature_2m?.[index]),
      humidity: finite(hourly.relative_humidity_2m?.[index]),
      isDay: hourly.is_day?.[index] === 1 ? true : hourly.is_day?.[index] === 0 ? false : null,
    })).filter((hour: SprayHour) => Number.isFinite(hour.time)),
  };
}

export function localForecastDay(time: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
  }
}

export function formatForecastHour(time: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time);
  } catch {
    return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time);
  }
}

function immediateConcern(hour: SprayHour): string | null {
  if (hour.rainMm !== null && hour.rainMm >= 0.2) return 'yağış bekleniyor';
  if (hour.rainChance !== null && hour.rainChance >= 45) return `yağış olasılığı %${Math.round(hour.rainChance)}`;
  if (hour.windKmh !== null && hour.windKmh >= 20) return `rüzgâr ${Math.round(hour.windKmh)} km/sa`;
  if (hour.gustKmh !== null && hour.gustKmh >= 25) return `ani rüzgâr ${Math.round(hour.gustKmh)} km/sa`;
  return null;
}

function screenedHour(hour: SprayHour, following: SprayHour[]): boolean {
  if (hour.isDay !== true || hour.windKmh === null || hour.gustKmh === null ||
      hour.rainChance === null || hour.rainMm === null || hour.temperatureC === null ||
      hour.humidity === null || following.length < 2) return false;

  // İhtiyatlı meteorolojik ön eleme: ürün etiketi ve parsel ölçümü bu eşiklerden üstündür.
  if (hour.windKmh < 5 || hour.windKmh > 15 || hour.gustKmh > 20 ||
      hour.rainChance >= 25 || hour.rainMm >= 0.2 ||
      hour.temperatureC < 10 || hour.temperatureC > 28 || hour.humidity < 40) return false;

  return following.every((next, index) => next.time === hour.time + (index + 1) * 3600000 &&
    next.rainChance !== null && next.rainChance < 45 && next.rainMm !== null && next.rainMm < 0.2);
}

function blockingCondition(hour: SprayHour): string | null {
  if (hour.windKmh === null || hour.gustKmh === null || hour.rainChance === null ||
      hour.rainMm === null || hour.temperatureC === null || hour.humidity === null) {
    return 'Saatlik hava verisi eksik';
  }
  if (hour.windKmh < 5) return 'Rüzgâr çok hafif; ilaç sürüklenmesi riski olabilir';
  if (hour.windKmh > 15) return `Rüzgâr ${Math.round(hour.windKmh)} km/sa`;
  if (hour.gustKmh > 20) return `Ani rüzgâr ${Math.round(hour.gustKmh)} km/sa`;
  if (hour.rainChance >= 25) return `Yağış olasılığı %${Math.round(hour.rainChance)}`;
  if (hour.rainMm >= 0.2) return `Yağış ${hour.rainMm.toFixed(1)} mm`;
  if (hour.temperatureC < 10 || hour.temperatureC > 28) return `Sıcaklık ${Math.round(hour.temperatureC)}°C`;
  if (hour.humidity < 40) return `Nem %${Math.round(hour.humidity)}`;
  return null;
}

export function buildHourlySprayPlan(data: HourlySprayForecast | null | undefined, now = Date.now()): SprayHourPlan {
  if (!data?.hours.length) return { windows: [], message: 'Saatlik tahmin henüz yok.', nextRisk: null, nextRiskAt: null };
  if (!isHourlySprayForecastFresh(data, now)) return {
    windows: [], message: 'Saatlik hava tahmini eskidi. İlaçlama saati seçmeden önce tahmini yenile.', nextRisk: null, nextRiskAt: null,
  };
  const today = localForecastDay(now, data.timezone);
  const all = data.hours;
  const upcoming = all.filter((hour) => hour.time >= now && localForecastDay(hour.time, data.timezone) === today);
  if (!upcoming.length) return { windows: [], message: 'Bugün için kalan tahmin saati yok.', nextRisk: null, nextRiskAt: null };

  const nextRiskHour = upcoming.find((hour) => immediateConcern(hour));
  const nextRisk = nextRiskHour
    ? `${formatForecastHour(nextRiskHour.time, data.timezone)} civarı ${immediateConcern(nextRiskHour)}`
    : null;
  const acceptable = upcoming.filter((hour) => {
    const position = all.findIndex((entry) => entry.time === hour.time);
    return screenedHour(hour, all.slice(position + 1, position + 3));
  });
  const windows: SprayWindow[] = [];
  for (const hour of acceptable) {
    const previous = windows[windows.length - 1];
    if (previous && previous.to === hour.time) {
      previous.to = hour.time + 3600000;
      previous.maxWindKmh = Math.max(previous.maxWindKmh, hour.windKmh!);
      previous.maxRainChance = Math.max(previous.maxRainChance, hour.rainChance!);
    } else {
      windows.push({ from: hour.time, to: hour.time + 3600000, maxWindKmh: hour.windKmh!, maxRainChance: hour.rainChance! });
    }
  }

  // Tek bir saat işleme başlamak için yeterli zaman aralığı olarak sunulmaz.
  const useful = windows.filter((window) => window.to - window.from >= 2 * 3600000);
  const daylight = upcoming.filter((hour) => hour.isDay === true);
  const blockedHour = daylight.find((hour) => blockingCondition(hour) !== null);
  const blocker = blockedHour ? blockingCondition(blockedHour) : null;
  return {
    windows: useful,
    message: useful.length
      ? 'Bugün ilaçlama havası için değerlendirilebilecek saatler:'
      : daylight.length < 2
        ? 'Bugün en az iki saatlik gündüz aralığı kalmadı; ilaçlama için saat önerilmiyor.'
        : blocker
          ? `Bugün ilaçlama için uygun saat görünmüyor. Örneğin ${formatForecastHour(blockedHour!.time, data.timezone)} civarı ${blocker[0].toLocaleLowerCase('tr-TR')}${blocker.slice(1)}.`
          : 'Bugün en az iki saatlik uygun hava aralığı görünmüyor.',
    nextRisk,
    nextRiskAt: nextRiskHour?.time ?? null,
  };
}
