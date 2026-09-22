const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
type ParcelFeature = { type: 'Feature'; properties?: Record<string, unknown>; geometry: GeoGeometry };
type RequestBody = { geometry?: ParcelFeature | GeoGeometry; daysBack?: number; maxCloudCoverage?: number };
type TimeSeriesPoint = { date: string; average: number; min: number | null; max: number | null; sampleCount: number | null; noDataCount: number | null };

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1';
const DAY_MS = 86_400_000;

const NDVI_STATS_SCRIPT = `
//VERSION=3
function setup() { return { input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }], output: [{ id: "default", bands: 1, sampleType: "FLOAT32" }, { id: "dataMask", bands: 1 }] }; }
function validPixel(scl) { return !(scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11); }
function evaluatePixel(sample) {
  const valid = sample.dataMask === 1 && validPixel(sample.SCL);
  if (!valid) return { default: [0], dataMask: [0] };
  const denom = sample.B08 + sample.B04;
  if (denom === 0) return { default: [0], dataMask: [0] };
  return { default: [(sample.B08 - sample.B04) / denom], dataMask: [1] };
}`;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const safeNumber = (value: unknown): number | null => { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function normalizeGeometry(value: unknown): ParcelFeature | null {
  const raw = value as any;
  if (raw?.type === 'Feature' && raw?.geometry && (raw.geometry.type === 'Polygon' || raw.geometry.type === 'MultiPolygon') && Array.isArray(raw.geometry.coordinates)) return { type: 'Feature', properties: raw.properties ?? {}, geometry: raw.geometry };
  if ((raw?.type === 'Polygon' || raw?.type === 'MultiPolygon') && Array.isArray(raw.coordinates)) return { type: 'Feature', properties: {}, geometry: raw };
  return null;
}
function collectCoordinates(value: unknown, out: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) { out.push([Number(value[0]), Number(value[1])]); return; }
  for (const child of value) collectCoordinates(child, out);
}
function geometryResolutionDegrees(feature: ParcelFeature) {
  const points: Array<[number, number]> = []; collectCoordinates(feature.geometry.coordinates, points);
  const avgLat = points.length ? points.reduce((sum, point) => sum + point[1], 0) / points.length : 39;
  const meters = 10; const latDegrees = meters / 111_320; const cosLat = Math.max(0.2, Math.cos((avgLat * Math.PI) / 180)); const lonDegrees = meters / (111_320 * cosLat);
  return { resx: Number(lonDegrees.toFixed(8)), resy: Number(latDegrees.toFixed(8)) };
}
const getToken = async () => {
  const clientId = Deno.env.get('COPERNICUS_CLIENT_ID')?.trim(); const clientSecret = Deno.env.get('COPERNICUS_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) throw new Error('Copernicus Client ID veya Client Secret bulunamadı.');
  const params = new URLSearchParams(); params.set('grant_type', 'client_credentials'); params.set('client_id', clientId); params.set('client_secret', clientSecret);
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!response.ok) { console.error('Copernicus OAuth error:', response.status, await response.text()); throw new Error('Copernicus yetkilendirmesi başarısız.'); }
  const payload = await response.json(); if (!payload?.access_token) throw new Error('Copernicus access token alınamadı.'); return String(payload.access_token);
};
const makeBounds = (feature: ParcelFeature) => ({ geometry: { type: feature.geometry.type, coordinates: feature.geometry.coordinates }, properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } });
const buildPeriod = (daysBack: number) => { const end = new Date(); const start = new Date(); start.setUTCDate(start.getUTCDate() - daysBack); return { from: `${isoDate(start)}T00:00:00Z`, to: `${isoDate(end)}T23:59:59Z` }; };
const fetchStatistics = async (token: string, geometry: ParcelFeature, period: { from: string; to: string }, maxCloudCoverage: number) => {
  const resolution = geometryResolutionDegrees(geometry);
  const response = await fetch(STATISTICS_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ input: { bounds: makeBounds(geometry), data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: period, mosaickingOrder: 'mostRecent', maxCloudCoverage } }] }, aggregation: { timeRange: period, aggregationInterval: { of: 'P1D' }, resx: resolution.resx, resy: resolution.resy, evalscript: NDVI_STATS_SCRIPT }, calculations: { default: {} } }) });
  if (!response.ok) { console.error('Copernicus Statistics API error:', response.status, await response.text()); throw new Error(`Sentinel-2 zaman serisi üretilemedi (${response.status}).`); }
  return response.json();
};
const extractPoints = (payload: any): TimeSeriesPoint[] => {
  const intervals = Array.isArray(payload?.data) ? payload.data : []; const byDate = new Map<string, TimeSeriesPoint>();
  for (const item of intervals) {
    const stats = item?.outputs?.default?.bands?.B0?.stats; const date = item?.interval?.from ? String(item.interval.from).slice(0, 10) : ''; if (!stats || !date) continue;
    const mean = safeNumber(stats.mean); const sampleCount = safeNumber(stats.sampleCount); const noDataCount = safeNumber(stats.noDataCount); if (mean === null || mean < -1 || mean > 1) continue;
    if (sampleCount !== null && noDataCount !== null && sampleCount <= noDataCount) continue;
    if (sampleCount !== null && noDataCount !== null && sampleCount > 0 && (sampleCount - noDataCount) / sampleCount < 0.10) continue;
    const min = safeNumber(stats.min); const max = safeNumber(stats.max);
    byDate.set(date, { date, average: Number(mean.toFixed(4)), min: min !== null && min >= -1 && min <= 1 ? Number(min.toFixed(4)) : null, max: max !== null && max >= -1 && max <= 1 ? Number(max.toFixed(4)) : null, sampleCount, noDataCount });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};
const calculateTrend = (points: TimeSeriesPoint[]) => {
  const base = { direction: 'unknown' as 'rising' | 'stable' | 'falling' | 'unknown', slopePerDay: null as number | null, changeFromPrevious: null as number | null, changeFromFirst: null as number | null, latestAverage: null as number | null, previousAverage: null as number | null, firstAverage: null as number | null, observationCount: points.length, spanDays: null as number | null, quality: 'insufficient' as 'usable' | 'insufficient' };
  if (!points.length) return base;
  const latest = points[points.length - 1]; const previous = points.length > 1 ? points[points.length - 2] : null; const first = points[0]; const baseTime = new Date(first.date).getTime(); const latestTime = new Date(latest.date).getTime(); const spanDays = Number.isFinite(baseTime) && Number.isFinite(latestTime) ? Math.max(0, Math.round((latestTime - baseTime) / DAY_MS)) : null;
  const changeFromPrevious = previous ? latest.average - previous.average : null; const changeFromFirst = latest.average - first.average;
  const common = { ...base, changeFromPrevious: changeFromPrevious === null ? null : Number(changeFromPrevious.toFixed(4)), changeFromFirst: Number(changeFromFirst.toFixed(4)), latestAverage: latest.average, previousAverage: previous?.average ?? null, firstAverage: first.average, spanDays };
  if (points.length < 3 || spanDays === null || spanDays < 12) return common;
  const xy = points.map(point => ({ x: (new Date(point.date).getTime() - baseTime) / DAY_MS, y: point.average })).filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)); if (xy.length < 3) return common;
  const n = xy.length; const sumX = xy.reduce((s, i) => s + i.x, 0); const sumY = xy.reduce((s, i) => s + i.y, 0); const sumXY = xy.reduce((s, i) => s + i.x * i.y, 0); const sumXX = xy.reduce((s, i) => s + i.x * i.x, 0); const denominator = n * sumXX - sumX * sumX; if (!Number.isFinite(denominator) || denominator === 0) return common;
  const slopePerDay = (n * sumXY - sumX * sumY) / denominator; let direction: 'rising' | 'stable' | 'falling' = 'stable'; if (slopePerDay >= 0.0015) direction = 'rising'; else if (slopePerDay <= -0.0015) direction = 'falling';
  return { ...common, direction, slopePerDay: Number(slopePerDay.toFixed(5)), quality: 'usable' as const };
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'method_not_allowed', message: 'Sadece POST destekleniyor.' }, 405);
  try {
    const body = (await req.json()) as RequestBody; const geometry = normalizeGeometry(body.geometry);
    if (!geometry) return jsonResponse({ success: false, error: 'invalid_geometry', message: 'NDVI zaman serisi için geçerli Polygon/MultiPolygon parsel geometrisi gerekli.' }, 400);
    const daysBack = clamp(Number(body.daysBack ?? 90), 14, 180); const maxCloudCoverage = clamp(Number(body.maxCloudCoverage ?? 35), 0, 100); const period = buildPeriod(daysBack); const token = await getToken(); const raw = await fetchStatistics(token, geometry, period, maxCloudCoverage); const points = extractPoints(raw); const trend = calculateTrend(points);
    let message: string | null = null; if (!points.length) message = 'Seçilen dönemde kullanılabilir bulutsuz NDVI gözlemi bulunamadı.'; else if (trend.quality === 'insufficient') message = 'NDVI gözlemi var ancak trend yönü için veri henüz yetersiz.';
    return jsonResponse({ success: true, source: 'Copernicus Data Space · Sentinel-2 L2A', period, points, trend, generatedAt: new Date().toISOString(), message });
  } catch (error) { console.error('satellite-ndvi-timeseries:', error); return jsonResponse({ success: false, error: 'ndvi_timeseries_error', message: error instanceof Error ? error.message : 'NDVI zaman serisi sırasında teknik hata oluştu.' }, 200); }
});
