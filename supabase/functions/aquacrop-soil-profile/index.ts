import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { fromArrayBuffer } from 'npm:geotiff@2.1.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PropertyKey = 'sand' | 'clay' | 'soc';
type DepthKey = '0-5cm' | '5-15cm' | '15-30cm' | '30-60cm' | '60-100cm' | '100-200cm';

const PROPERTIES: PropertyKey[] = ['sand', 'clay', 'soc'];
const DEPTHS: Array<{ key: DepthKey; fromCm: number; toCm: number }> = [
  { key: '0-5cm', fromCm: 0, toCm: 5 },
  { key: '5-15cm', fromCm: 5, toCm: 15 },
  { key: '15-30cm', fromCm: 15, toCm: 30 },
  { key: '30-60cm', fromCm: 30, toCm: 60 },
  { key: '60-100cm', fromCm: 60, toCm: 100 },
  { key: '100-200cm', fromCm: 100, toCm: 200 },
];

const META: Record<PropertyKey, { divisor: number; unit: string }> = {
  sand: { divisor: 10, unit: '%' },
  clay: { divisor: 10, unit: '%' },
  soc: { divisor: 10, unit: 'g/kg' },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function coverage(property: PropertyKey, depth: DepthKey) {
  return `${property}_${depth}_mean`;
}

function buildWcsUrl(property: PropertyKey, depth: DepthKey, latitude: number, longitude: number, delta: number) {
  const cosLat = Math.max(0.25, Math.cos((latitude * Math.PI) / 180));
  const lonDelta = delta / cosLat;
  const params = new URLSearchParams();
  params.set('map', `/map/${property}.map`);
  params.set('SERVICE', 'WCS');
  params.set('VERSION', '2.0.1');
  params.set('REQUEST', 'GetCoverage');
  params.set('COVERAGEID', coverage(property, depth));
  params.set('FORMAT', 'GEOTIFF_INT16');
  params.append('SUBSET', `X(${longitude - lonDelta},${longitude + lonDelta})`);
  params.append('SUBSET', `Y(${latitude - delta},${latitude + delta})`);
  params.set('SUBSETTINGCRS', 'http://www.opengis.net/def/crs/EPSG/0/4326');
  params.set('OUTPUTCRS', 'http://www.opengis.net/def/crs/EPSG/0/4326');
  return `https://maps.isric.org/mapserv?${params.toString()}`;
}

function plausibleRaw(property: PropertyKey, value: number) {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (property === 'soc') return value <= 5000;
  return value <= 1000;
}

function pickNearestValidPixel(raster: ArrayLike<number>, width: number, height: number, noData: number | null, property: PropertyKey) {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const candidates: Array<{ index: number; distance: number }> = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      candidates.push({ index: y * width + x, distance: Math.abs(x - centerX) + Math.abs(y - centerY) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  for (const candidate of candidates) {
    const value = Number(raster[candidate.index]);
    if (!Number.isFinite(value)) continue;
    if (noData !== null && value === noData) continue;
    if (value <= -32000 || !plausibleRaw(property, value)) continue;
    return value;
  }
  return null;
}

async function fetchCoverageAttempt(property: PropertyKey, depth: DepthKey, latitude: number, longitude: number, delta: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(buildWcsUrl(property, depth, latitude, longitude, delta), {
      signal: controller.signal,
      headers: {
        Accept: 'image/tiff,application/geotiff,application/octet-stream,*/*;q=0.5',
        'User-Agent': 'TarlaPusula-AquaCrop-Pilot/1.0',
      },
    });
    if (!response.ok) throw new Error(`ISRIC HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 128) throw new Error('GeoTIFF response too small');
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const rawNoData = image.getGDALNoData();
    const noData = rawNoData === null || rawNoData === undefined || rawNoData === '' ? null : Number(rawNoData);
    const raw = pickNearestValidPixel(rasters[0], image.getWidth(), image.getHeight(), noData !== null && Number.isFinite(noData) ? noData : null, property);
    if (raw === null) throw new Error('No valid SoilGrids pixel');
    return raw / META[property].divisor;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLayer(property: PropertyKey, depth: DepthKey, latitude: number, longitude: number) {
  let lastError = '';
  for (const delta of [0.005, 0.02, 0.05]) {
    try {
      return await fetchCoverageAttempt(property, depth, latitude, longitude, delta);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown SoilGrids error';
    }
  }
  throw new Error(`${property}/${depth}: ${lastError}`);
}

function deriveHydraulics(sandPercent: number, clayPercent: number, socGKg: number) {
  const sand = clamp(sandPercent / 100, 0, 1);
  const clay = clamp(clayPercent / 100, 0, 1);
  const organicCarbonPercent = Math.max(0, socGKg / 10);
  const organicMatterPercent = clamp(organicCarbonPercent * 1.724, 0, 20);
  const predWp = -0.024 * sand + 0.487 * clay + 0.006 * organicMatterPercent + 0.005 * sand * organicMatterPercent - 0.013 * clay * organicMatterPercent + 0.068 * sand * clay + 0.031;
  const thWp = predWp + 0.14 * predWp - 0.02;
  const predFc = -0.251 * sand + 0.195 * clay + 0.011 * organicMatterPercent + 0.006 * sand * organicMatterPercent - 0.027 * clay * organicMatterPercent + 0.452 * sand * clay + 0.299;
  const thFc = predFc + 1.283 * predFc * predFc - 0.374 * predFc - 0.015;
  const predS33 = 0.278 * sand + 0.034 * clay + 0.022 * organicMatterPercent - 0.018 * sand * organicMatterPercent - 0.027 * clay * organicMatterPercent - 0.584 * sand * clay + 0.078;
  const predAdjS33 = predS33 + 0.636 * predS33 - 0.107;
  const predS = thFc + predAdjS33 + (-0.097 * sand + 0.043);
  const thS = clamp(predS, thFc + 0.01, 0.75);
  const safeWp = clamp(thWp, 0.02, Math.max(0.02, thFc - 0.01));
  const safeFc = clamp(thFc, safeWp + 0.01, thS - 0.005);
  const denominator = Math.log(safeFc) - Math.log(safeWp);
  const lambda = Math.abs(denominator) > 1e-9 ? 1 / ((Math.log(1500) - Math.log(33)) / denominator) : null;
  const ksat = lambda === null ? null : Math.max(0.1, 1930 * Math.pow(Math.max(0.001, thS - safeFc), 3 - lambda) * 24);
  return {
    thWP: round(safeWp, 3),
    thFC: round(safeFc, 3),
    thS: round(thS, 3),
    ksatMmDay: ksat === null || !Number.isFinite(ksat) ? null : round(ksat, 1),
    organicMatterPercent: round(organicMatterPercent, 2),
    method: 'AquaCrop-compatible Saxton-Rawls 2006',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const latitude = finite(body?.latitude);
    const longitude = finite(body?.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return json({ ok: false, error: 'Geçerli latitude/longitude gerekli.' }, 400);
    }
    const requests = DEPTHS.flatMap((depth) => PROPERTIES.map((property) => ({ depth, property })));
    const values = new Map<string, number>();
    const warnings: string[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < requests.length) {
        const index = cursor++;
        const item = requests[index];
        try {
          const value = await fetchLayer(item.property, item.depth.key, latitude, longitude);
          values.set(`${item.depth.key}:${item.property}`, value);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : `${item.property}/${item.depth.key} failed`);
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    const layers = DEPTHS.map((depth) => {
      const sandRaw = values.get(`${depth.key}:sand`);
      const clayRaw = values.get(`${depth.key}:clay`);
      const soc = values.get(`${depth.key}:soc`);
      if (sandRaw === undefined || clayRaw === undefined || soc === undefined) return { depth: depth.key, fromCm: depth.fromCm, toCm: depth.toCm, available: false };
      const siltRaw = 100 - sandRaw - clayRaw;
      if (siltRaw <= 0) {
        warnings.push(`${depth.key}: texture sum is invalid`);
        return { depth: depth.key, fromCm: depth.fromCm, toCm: depth.toCm, available: false };
      }
      const total = sandRaw + clayRaw + siltRaw;
      const sand = (sandRaw / total) * 100;
      const clay = (clayRaw / total) * 100;
      const silt = (siltRaw / total) * 100;
      const hydraulic = deriveHydraulics(sand, clay, soc);
      const available = hydraulic.ksatMmDay !== null;
      return {
        depth: depth.key,
        fromCm: depth.fromCm,
        toCm: depth.toCm,
        thicknessM: round((depth.toCm - depth.fromCm) / 100, 2),
        available,
        texture: { sandPercent: round(sand, 2), clayPercent: round(clay, 2), siltPercent: round(silt, 2), socGKg: round(soc, 2) },
        hydraulic,
        penetrabilityPercent: 100,
        penetrabilitySource: 'AquaCrop neutral model default; not measured',
      };
    });
    const contiguous: typeof layers = [];
    for (const layer of layers) {
      if (!layer.available) break;
      contiguous.push(layer);
    }
    const coverageDepthCm = contiguous.length ? contiguous[contiguous.length - 1].toCm : 0;
    const modelReady = coverageDepthCm >= 200 && contiguous.length === DEPTHS.length;
    return json({
      ok: true,
      engine: 'aquacrop',
      mode: 'soil-profile-adapter',
      production_authority: false,
      input_authority: 'server-derived',
      adapter_contract_version: 2,
      pedotransfer_method: 'Saxton-Rawls 2006',
      source: { provider: 'ISRIC SoilGrids', product: 'SoilGrids250m 2.0', license: 'CC BY 4.0', dataType: 'model-estimate', spatialResolutionMeters: 250, accessMethod: 'OGC WCS 2.0.1', statistic: 'mean' },
      requested_location: { latitude, longitude },
      model_ready: modelReady,
      profile_depth_cm: coverageDepthCm,
      layers: contiguous,
      assumptions: [
        'Hydraulic properties are pedotransfer estimates from real SoilGrids texture and SOC, not lab measurements.',
        'Layer penetrability uses AquaCrop neutral 100% model default and is explicitly non-measured.',
      ],
      warnings,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AquaCrop soil profile adapter başarısız oldu.';
    console.error('[aquacrop-soil-profile]', message);
    return json({ ok: false, error: message }, 500);
  }
});
