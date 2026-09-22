import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const CURRENT_WINDOW_DAYS = 30;
const ERA5_LAG_DAYS = 6;
const BASELINE_START_YEAR = 1991;
const BASELINE_END_YEAR = 2020;
const REQUEST_TIMEOUT_MS = 25_000;

const DAILY_VARIABLES = [
  'temperature_2m_mean',
  'precipitation_sum',
  'et0_fao_evapotranspiration',
  'soil_moisture_0_to_7cm_mean',
  'soil_moisture_7_to_28cm_mean',
  'soil_moisture_28_to_100cm_mean',
] as const;

type EraDaily = {
  time?: unknown;
  temperature_2m_mean?: unknown;
  precipitation_sum?: unknown;
  et0_fao_evapotranspiration?: unknown;
  soil_moisture_0_to_7cm_mean?: unknown;
  soil_moisture_7_to_28cm_mean?: unknown;
  soil_moisture_28_to_100cm_mean?: unknown;
};

type WindowSummary = {
  start: string;
  end: string;
  validDays: number;
  temperatureMeanC: number | null;
  precipitationTotalMm: number | null;
  et0TotalMm: number | null;
  waterBalanceMm: number | null;
  soilMoisture0To7: number | null;
  soilMoisture7To28: number | null;
  soilMoisture28To100: number | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number | null, digits = 2) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return iso(date);
}

function validIsoDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function safeDateForYear(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return iso(new Date(Date.UTC(year, month - 1, Math.min(day, lastDay))));
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;

  return {
    latitude,
    longitude,
    source:
      field.parcel_centroid_lat != null && field.parcel_centroid_lng != null
        ? 'parcel_centroid'
        : 'field_coordinates',
  };
}

async function fetchEra5Land(
  latitude: number,
  longitude: number,
  start: string,
  end: string,
) {
  const url = new URL(OPEN_METEO_ARCHIVE);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', DAILY_VARIABLES.join(','));
  url.searchParams.set('models', 'era5_land');
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('cell_selection', 'land');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-AgroClimate/1.0' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) {
      throw new Error(payload?.reason ?? `ERA5-Land/Open-Meteo HTTP ${response.status}`);
    }
    return payload as { daily: EraDaily; latitude?: number; longitude?: number; elevation?: number };
  } finally {
    clearTimeout(timeout);
  }
}

function numericArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(finite)
    : [];
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sum(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0);
}

function summarizeWindow(daily: EraDaily, start: string, end: string): WindowSummary {
  const times = Array.isArray(daily.time) ? daily.time.map(String) : [];
  const temperature = numericArray(daily.temperature_2m_mean);
  const precipitation = numericArray(daily.precipitation_sum);
  const et0 = numericArray(daily.et0_fao_evapotranspiration);
  const sm0 = numericArray(daily.soil_moisture_0_to_7cm_mean);
  const sm1 = numericArray(daily.soil_moisture_7_to_28cm_mean);
  const sm2 = numericArray(daily.soil_moisture_28_to_100cm_mean);

  const indexes = times
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => date >= start && date <= end)
    .map(({ index }) => index);

  const pick = (values: Array<number | null>) => indexes.map((index) => values[index] ?? null);
  const precipitationTotalMm = sum(pick(precipitation));
  const et0TotalMm = sum(pick(et0));

  return {
    start,
    end,
    validDays: indexes.length,
    temperatureMeanC: average(pick(temperature)),
    precipitationTotalMm,
    et0TotalMm,
    waterBalanceMm:
      precipitationTotalMm !== null && et0TotalMm !== null
        ? precipitationTotalMm - et0TotalMm
        : null,
    soilMoisture0To7: average(pick(sm0)),
    soilMoisture7To28: average(pick(sm1)),
    soilMoisture28To100: average(pick(sm2)),
  };
}

function meanMetric(
  rows: WindowSummary[],
  key: keyof Pick<
    WindowSummary,
    | 'temperatureMeanC'
    | 'precipitationTotalMm'
    | 'et0TotalMm'
    | 'waterBalanceMm'
    | 'soilMoisture0To7'
    | 'soilMoisture7To28'
    | 'soilMoisture28To100'
  >,
) {
  return average(rows.map((row) => finite(row[key])));
}

function percentChange(current: number | null, baseline: number | null) {
  if (current === null || baseline === null || Math.abs(baseline) < 1e-9) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function percentileRank(current: number | null, baselineValues: Array<number | null>) {
  if (current === null) return null;
  const valid = baselineValues.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  const lowerOrEqual = valid.filter((value) => value <= current).length;
  return (lowerOrEqual / valid.length) * 100;
}

function classifyWaterStress(input: {
  precipitationRatioPct: number | null;
  soilMoisturePercentile: number | null;
  waterBalanceAnomalyMm: number | null;
}) {
  const { precipitationRatioPct, soilMoisturePercentile, waterBalanceAnomalyMm } = input;

  if (
    precipitationRatioPct !== null && precipitationRatioPct < 50 &&
    soilMoisturePercentile !== null && soilMoisturePercentile <= 20
  ) {
    return {
      class: 'strong_dry_signal',
      label: 'Belirgin kuraklık / su açığı sinyali',
      confidence: 'medium',
    } as const;
  }

  if (
    (precipitationRatioPct !== null && precipitationRatioPct < 75) ||
    (soilMoisturePercentile !== null && soilMoisturePercentile <= 30) ||
    (waterBalanceAnomalyMm !== null && waterBalanceAnomalyMm <= -25)
  ) {
    return {
      class: 'dry_signal',
      label: 'Normalden kuru / su açığı sinyali',
      confidence: 'low',
    } as const;
  }

  if (
    precipitationRatioPct !== null && precipitationRatioPct > 150 &&
    soilMoisturePercentile !== null && soilMoisturePercentile >= 70
  ) {
    return {
      class: 'wet_signal',
      label: 'Normalden ıslak dönem sinyali',
      confidence: 'low',
    } as const;
  }

  return {
    class: 'near_normal',
    label: 'İklim normali çevresinde',
    confidence: 'low',
  } as const;
}

async function fetchChirpsCurrent(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  fieldId: string,
  endDate: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/field-chirps-rain`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        field_id: fieldId,
        days: CURRENT_WINDOW_DAYS,
        end_date: endDate,
      }),
    });
    const payload = await response.json().catch(() => null);
    return {
      httpStatus: response.status,
      ok: response.ok && payload?.ok !== false,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!authorization || !supabaseUrl || !anonKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? body?.fieldId ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = [
      'latitude', 'longitude', 'geometry', 'parcel_geometry',
      'current_period', 'baseline_period', 'era5', 'chirps',
    ];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'İklim kanıtında koordinat, geometri veya sağlayıcı sonucu istemciden kabul edilmez.',
      }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);
    }

    const { data: field, error: fieldError } = await userClient
      .from('fields')
      .select('id,user_id,name,crop,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const location = resolveLocation(field as Record<string, unknown>);
    if (!location) {
      return json({
        ok: true,
        status: 'unavailable',
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        missing_inputs: ['field_location'],
      });
    }

    const maxEnd = daysAgo(ERA5_LAG_DAYS);
    const requestedEnd = validIsoDate(body?.as_of_date);
    const currentEnd = requestedEnd && requestedEnd < maxEnd ? requestedEnd : maxEnd;
    const currentStart = shiftDays(currentEnd, -(CURRENT_WINDOW_DAYS - 1));

    const endDate = new Date(`${currentEnd}T00:00:00Z`);
    const month = endDate.getUTCMonth() + 1;
    const day = endDate.getUTCDate();

    const baselineFetchStart = `${BASELINE_START_YEAR - 1}-12-01`;
    const baselineFetchEnd = `${BASELINE_END_YEAR + 1}-01-31`;

    const [currentResult, baselineResult, chirpsResult] = await Promise.allSettled([
      fetchEra5Land(location.latitude, location.longitude, currentStart, currentEnd),
      fetchEra5Land(location.latitude, location.longitude, baselineFetchStart, baselineFetchEnd),
      fetchChirpsCurrent(supabaseUrl, anonKey, authorization, fieldId, currentEnd),
    ]);

    if (currentResult.status !== 'fulfilled') {
      throw currentResult.reason instanceof Error
        ? currentResult.reason
        : new Error('ERA5-Land güncel dönem verisi alınamadı.');
    }

    const current = summarizeWindow(currentResult.value.daily, currentStart, currentEnd);

    const baselineRows: WindowSummary[] = [];
    if (baselineResult.status === 'fulfilled') {
      for (let year = BASELINE_START_YEAR; year <= BASELINE_END_YEAR; year += 1) {
        const end = safeDateForYear(year, month, day);
        const start = shiftDays(end, -(CURRENT_WINDOW_DAYS - 1));
        const summary = summarizeWindow(baselineResult.value.daily, start, end);
        if (summary.validDays >= CURRENT_WINDOW_DAYS - 2) baselineRows.push(summary);
      }
    }

    const baseline = baselineRows.length
      ? {
          years: `${BASELINE_START_YEAR}-${BASELINE_END_YEAR}`,
          yearsUsed: baselineRows.length,
          windowDays: CURRENT_WINDOW_DAYS,
          temperatureMeanC: meanMetric(baselineRows, 'temperatureMeanC'),
          precipitationTotalMm: meanMetric(baselineRows, 'precipitationTotalMm'),
          et0TotalMm: meanMetric(baselineRows, 'et0TotalMm'),
          waterBalanceMm: meanMetric(baselineRows, 'waterBalanceMm'),
          soilMoisture0To7: meanMetric(baselineRows, 'soilMoisture0To7'),
          soilMoisture7To28: meanMetric(baselineRows, 'soilMoisture7To28'),
          soilMoisture28To100: meanMetric(baselineRows, 'soilMoisture28To100'),
        }
      : null;

    const precipitationRatioPct =
      current.precipitationTotalMm !== null && baseline?.precipitationTotalMm
        ? (current.precipitationTotalMm / baseline.precipitationTotalMm) * 100
        : null;

    const temperatureAnomalyC =
      current.temperatureMeanC !== null && baseline?.temperatureMeanC !== null && baseline?.temperatureMeanC !== undefined
        ? current.temperatureMeanC - baseline.temperatureMeanC
        : null;

    const et0ChangePct = percentChange(current.et0TotalMm, baseline?.et0TotalMm ?? null);
    const waterBalanceAnomalyMm =
      current.waterBalanceMm !== null && baseline?.waterBalanceMm !== null && baseline?.waterBalanceMm !== undefined
        ? current.waterBalanceMm - baseline.waterBalanceMm
        : null;

    const soilMoisture0To7Percentile = percentileRank(
      current.soilMoisture0To7,
      baselineRows.map((row) => row.soilMoisture0To7),
    );
    const soilMoisture7To28Percentile = percentileRank(
      current.soilMoisture7To28,
      baselineRows.map((row) => row.soilMoisture7To28),
    );
    const soilMoisture28To100Percentile = percentileRank(
      current.soilMoisture28To100,
      baselineRows.map((row) => row.soilMoisture28To100),
    );

    const stress = classifyWaterStress({
      precipitationRatioPct,
      soilMoisturePercentile: soilMoisture7To28Percentile ?? soilMoisture0To7Percentile,
      waterBalanceAnomalyMm,
    });

    let chirps: any = null;
    if (chirpsResult.status === 'fulfilled') {
      const result = chirpsResult.value;
      const payload = result.payload;
      chirps = {
        available: payload?.available === true,
        pending: payload?.pending === true || result.httpStatus === 202,
        source: payload?.source ?? 'UCSB CHIRPS via SERVIR ClimateSERV',
        provider: payload?.provider ?? 'SERVIR ClimateSERV',
        dataset: payload?.dataset ?? 'Global CHIRPS (ClimateSERV datatype 0)',
        totalMm: finite(payload?.stats?.total_mm),
        validDayCount: finite(payload?.stats?.valid_day_count),
        period: payload?.period ?? { start: currentStart, end: currentEnd, days: CURRENT_WINDOW_DAYS },
        providerJobId: payload?.provider_job_id ?? null,
        note: payload?.note ?? null,
      };
    }

    const chirpsVsEra5DifferencePct =
      chirps?.totalMm !== null && chirps?.totalMm !== undefined && current.precipitationTotalMm !== null && current.precipitationTotalMm !== 0
        ? ((Number(chirps.totalMm) - current.precipitationTotalMm) / current.precipitationTotalMm) * 100
        : null;

    return json({
      ok: true,
      status: baseline ? 'ready' : 'partial',
      field_id: fieldId,
      field: {
        name: field.name ?? null,
        crop: field.crop ?? null,
      },
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      location_source: location.source,
      analysis: {
        windowDays: CURRENT_WINDOW_DAYS,
        currentPeriod: { start: currentStart, end: currentEnd },
        baselinePeriod: `${BASELINE_START_YEAR}-${BASELINE_END_YEAR}`,
        era5LagDays: ERA5_LAG_DAYS,
      },
      era5Land: {
        source: 'ECMWF ERA5-Land',
        access: 'Open-Meteo Historical Weather API',
        spatialResolution: '0.1° (~9-11 km)',
        current: {
          validDays: current.validDays,
          temperatureMeanC: round(current.temperatureMeanC),
          precipitationTotalMm: round(current.precipitationTotalMm),
          et0TotalMm: round(current.et0TotalMm),
          waterBalanceMm: round(current.waterBalanceMm),
          soilMoisture0To7: round(current.soilMoisture0To7, 4),
          soilMoisture7To28: round(current.soilMoisture7To28, 4),
          soilMoisture28To100: round(current.soilMoisture28To100, 4),
        },
        baseline: baseline
          ? {
              years: baseline.years,
              yearsUsed: baseline.yearsUsed,
              windowDays: baseline.windowDays,
              temperatureMeanC: round(baseline.temperatureMeanC),
              precipitationTotalMm: round(baseline.precipitationTotalMm),
              et0TotalMm: round(baseline.et0TotalMm),
              waterBalanceMm: round(baseline.waterBalanceMm),
              soilMoisture0To7: round(baseline.soilMoisture0To7, 4),
              soilMoisture7To28: round(baseline.soilMoisture7To28, 4),
              soilMoisture28To100: round(baseline.soilMoisture28To100, 4),
            }
          : null,
      },
      chirps,
      anomalies: {
        precipitationRatioPct: round(precipitationRatioPct, 1),
        precipitationDeficitPct:
          precipitationRatioPct === null ? null : round(100 - precipitationRatioPct, 1),
        temperatureAnomalyC: round(temperatureAnomalyC, 2),
        et0ChangePct: round(et0ChangePct, 1),
        waterBalanceAnomalyMm: round(waterBalanceAnomalyMm, 1),
        soilMoisture0To7Percentile: round(soilMoisture0To7Percentile, 1),
        soilMoisture7To28Percentile: round(soilMoisture7To28Percentile, 1),
        soilMoisture28To100Percentile: round(soilMoisture28To100Percentile, 1),
        chirpsVsEra5PrecipDifferencePct: round(chirpsVsEra5DifferencePct, 1),
      },
      climateWaterStress: stress,
      evidencePolicy: {
        neverBlindAverage: true,
        chirpsRole: 'independent_observed_rainfall_context',
        era5LandRole: 'reanalysis_climate_baseline_and_land_state_context',
        note: 'CHIRPS ve ERA5-Land ayrı tutulur. Kaynaklar arası fark belirsizlik olarak saklanır; tek bir sahte ortak yağış değeri üretilmez.',
      },
      warnings: [
        'ERA5-Land yaklaşık 0.1° reanalysis hücresidir; parsel içi mikroiklim ölçümü değildir.',
        'CHIRPS yaklaşık 0.05° yağış ürünüdür; saha yağış ölçeri değildir.',
        'Bu çıktı iklim/su stresi bağlamıdır; tek başına sulama, hastalık veya verim kararı değildir.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agroiklim karşılaştırması hazırlanamadı.';
    console.error('[agroclimate-baseline-evidence]', message);
    return json({ ok: false, error: message, production_authority: false }, /oturum|kullanıcı/i.test(message) ? 401 : 502);
  }
});
