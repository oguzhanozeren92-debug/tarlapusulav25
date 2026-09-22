const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Point = { date: string; average: number };
type Body = { points?: unknown };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const DAY_MS = 86_400_000;
const MIN_OBSERVATIONS = 5;
const MIN_SPAN_DAYS = 20;

function normalizePoints(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  const byDate = new Map<string, Point>();
  for (const raw of value) {
    const date = String((raw as any)?.date ?? '').trim();
    const average = Number((raw as any)?.average);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(average) || average < -1 || average > 1) continue;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    byDate.set(date, { date, average });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function analyze(points: Point[]) {
  const base = {
    quality: 'insufficient' as 'insufficient' | 'usable',
    anomaly: false,
    direction: 'unknown' as 'unknown' | 'negative' | 'positive' | 'none',
    latestDate: points.at(-1)?.date ?? null,
    latestAverage: points.at(-1)?.average ?? null,
    baselineMedian: null as number | null,
    deviation: null as number | null,
    mad: null as number | null,
    robustScore: null as number | null,
    observationCount: points.length,
    spanDays: null as number | null,
    reason: 'Gerçek gözlem sayısı veya dönem uzunluğu anomali değerlendirmesi için yetersiz.',
  };
  if (points.length < MIN_OBSERVATIONS) return base;

  const firstMs = new Date(`${points[0].date}T00:00:00Z`).getTime();
  const lastMs = new Date(`${points.at(-1)!.date}T00:00:00Z`).getTime();
  const spanDays = Math.round((lastMs - firstMs) / DAY_MS);
  base.spanDays = spanDays;
  if (spanDays < MIN_SPAN_DAYS) return base;

  const latest = points.at(-1)!;
  const baseline = points.slice(0, -1).map(p => p.average);
  const baselineMedian = median(baseline);
  if (baselineMedian === null) return base;
  const deviations = baseline.map(v => Math.abs(v - baselineMedian));
  const mad = median(deviations);
  const deviation = latest.average - baselineMedian;

  // Robust z-score yalnızca gözlenen seri içinden hesaplanır. MAD=0 ise skor/karar uydurulmaz.
  if (mad === null || mad === 0) {
    return { ...base, baselineMedian: Number(baselineMedian.toFixed(4)), deviation: Number(deviation.toFixed(4)), mad: mad === null ? null : 0, reason: 'Baz dönem değişkenliği sıfır olduğu için güvenilir robust anomali skoru üretilemedi.' };
  }

  const robustScore = 0.6745 * deviation / mad;
  const anomaly = Math.abs(robustScore) >= 3.5;
  return {
    ...base,
    quality: 'usable' as const,
    anomaly,
    direction: anomaly ? (robustScore < 0 ? 'negative' as const : 'positive' as const) : 'none' as const,
    baselineMedian: Number(baselineMedian.toFixed(4)),
    deviation: Number(deviation.toFixed(4)),
    mad: Number(mad.toFixed(4)),
    robustScore: Number(robustScore.toFixed(3)),
    reason: anomaly ? 'Son NDVI gözlemi, aynı gerçek zaman serisinin robust baz dağılımından belirgin biçimde ayrışıyor.' : 'Son NDVI gözlemi robust baz dağılımı içinde.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);
  try {
    const body = await req.json() as Body;
    const points = normalizePoints(body.points);
    const result = analyze(points);
    return json({ success: true, method: 'median_mad_robust_z', thresholds: { minObservations: MIN_OBSERVATIONS, minSpanDays: MIN_SPAN_DAYS, robustZ: 3.5 }, ...result, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('satellite-ndvi-anomaly:', error);
    return json({ success: false, error: 'ndvi_anomaly_error', message: error instanceof Error ? error.message : 'NDVI anomali analizi sırasında teknik hata oluştu.' }, 200);
  }
});
