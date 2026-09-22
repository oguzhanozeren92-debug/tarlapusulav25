import type { NasaPowerDay } from '../../../services/nasaPowerService';
import { fetchNasaPowerRange } from '../../../services/nasaPowerService';
import { supabase } from '../../../supabaseClient';

export type SeasonWeatherCoverage = {
  expectedDays: number;
  completeDays: number;
  /** Sum of max(0, (daily min + max) / 2 - 10°C); null if any temperature day is missing. */
  heatSum10C: number | null;
  missing: { temperature: number; rain: number; radiation: number; wind: number };
  start: string;
  end: string;
  source: 'NASA POWER';
};

function isValue(value: number | null, allowNegative = false) {
  return value !== null && Number.isFinite(value) && (allowNegative || value >= 0);
}

/** Count each expected calendar day, not merely the rows returned by a provider. */
export function countSeasonWeatherDays(days: NasaPowerDay[], start: string, end: string): SeasonWeatherCoverage {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const missing = { temperature: 0, rain: 0, radiation: 0, wind: 0 };
  let expectedDays = 0;
  let completeDays = 0;
  let heatSum10C = 0;
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 730 * 86400000) {
    throw new Error('Günlük hava için geçerli bir sezon aralığı gerekli.');
  }
  for (let time = first; time <= last; time += 86400000) {
    expectedDays += 1;
    const row = byDate.get(new Date(time).toISOString().slice(0, 10));
    const temperature = Boolean(row && isValue(row.minTemperature, true) && isValue(row.maxTemperature, true) &&
      row.maxTemperature! >= row.minTemperature!);
    const rain = Boolean(row && isValue(row.precipitation));
    const radiation = Boolean(row && isValue(row.solarRadiation));
    const wind = Boolean(row && isValue(row.windSpeed));
    if (!temperature) missing.temperature += 1;
    else heatSum10C += Math.max(0, (row!.minTemperature! + row!.maxTemperature!) / 2 - 10);
    if (!rain) missing.rain += 1;
    if (!radiation) missing.radiation += 1;
    if (!wind) missing.wind += 1;
    if (temperature && rain && radiation && wind) completeDays += 1;
  }
  return { expectedDays, completeDays, heatSum10C: missing.temperature === 0 ? Math.round(heatSum10C * 10) / 10 : null,
    missing, start, end, source: 'NASA POWER' };
}

const cache = new Map<string, { coverage: SeasonWeatherCoverage; at: number }>();

export async function checkSeasonWeather(fieldId: string, latitude: number, longitude: number, start: string, end: string) {
  const key = `${fieldId}:${start}:${end}:${latitude}:${longitude}`;
  const stored = cache.get(key);
  if (stored && Date.now() - stored.at < 6 * 3600000) return stored.coverage;
  const weather = await fetchNasaPowerRange(latitude, longitude, start.replaceAll('-', ''), end.replaceAll('-', ''));
  const coverage = countSeasonWeatherDays(weather.days, start, end);
  cache.set(key, { coverage, at: Date.now() });
  return coverage;
}

export async function hasFieldSoilReport(fieldId: string): Promise<boolean> {
  if (!supabase) throw new Error('Veritabanı bağlantısı kullanılamıyor.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Toprak raporunu görmek için giriş yapmalısın.');
  const { data, error } = await supabase.from('soil_analyses')
    .select('id, report_path, pdf_path')
    .eq('user_id', user.id).eq('field_id', fieldId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).some((item) => Boolean(item.report_path || item.pdf_path));
}
