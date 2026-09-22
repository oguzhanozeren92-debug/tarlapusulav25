import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATALOG_BASE = 'https://phenology.vgt.vito.be';
const WMS_URL = `${CATALOG_BASE}/wms`;
const COLLECTION = 'copernicus_r_utm-wgs84_10_m_hrvpp-vpp_p_2017-now_v01';
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_YEAR = 2017;
const MAX_YEAR_LOOKBACK = 5;
const SEARCH_RADIUS_M = 1_000;
const METRIC_TYPES = ['SOSD', 'EOSD', 'MAXD', 'LENGTH', 'SPROD', 'QFLAG'] as const;

type MetricType = (typeof METRIC_TYPES)[number];

type Point = {
  latitude: number;
  longitude: number;
  source: 'parcel_centroid' | 'field_coordinates';
};

type CatalogProduct = {
  metric: MetricType;
  identifier: string;
  title: string | null;
  year: number;
  season: 1;
  tileId: string | null;
  productVersion: string | null;
  resolutionM: number | null;
  bbox: number[] | null;
  dataAssetAvailable: boolean;
  dataAssetScheme: string | null;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolvePoint(field: Record<string, unknown>): Point | null {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);

  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
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

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/geo+json,application/json,image/png,*/*;q=0.5',
        'User-Agent': 'TarlaPusula-Copernicus-HRVPP/2.0',
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function catalogUrl(point: Point, year: number, metric: MetricType) {
  const url = new URL(`${CATALOG_BASE}/products.geojson`);
  url.searchParams.set('collection', COLLECTION);
  url.searchParams.set('count', '5');
  url.searchParams.set('productType', metric);
  url.searchParams.set('productGroupId', 's1');
  url.searchParams.set('start', `${year}-01-01`);
  url.searchParams.set('end', `${year}-12-31`);
  url.searchParams.set('lat', String(point.latitude));
  url.searchParams.set('lon', String(point.longitude));
  url.searchParams.set('radius', String(SEARCH_RADIUS_M));
  return url.toString();
}

function assetScheme(href: unknown) {
  const text = String(href ?? '').trim();
  const match = text.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  return match?.[1]?.toLowerCase() ?? null;
}

function parseProduct(feature: any, metric: MetricType, requestedYear: number): CatalogProduct | null {
  if (!feature || typeof feature !== 'object') return null;

  const properties = feature.properties ?? {};
  const info = properties.productInformation ?? {};
  const acquisition = Array.isArray(properties.acquisitionInformation)
    ? properties.acquisitionInformation[0]
    : null;
  const dataLinks = Array.isArray(properties?.links?.data) ? properties.links.data : [];
  const identifier = String(properties.identifier ?? feature.id ?? '').trim();
  if (!identifier) return null;

  const propertyDate = String(properties.date ?? '').trim();
  const parsedYear = /^\d{4}-/.test(propertyDate) ? Number(propertyDate.slice(0, 4)) : requestedYear;
  const tileId = String(acquisition?.acquisitionParameters?.tileId ?? '').trim() || null;
  const version = String(info.productVersion ?? '').trim() || null;
  const resolution = finite(properties?.additionalAttributes?.resolution);
  const bbox = Array.isArray(feature.bbox)
    ? feature.bbox.map((item: unknown) => finite(item)).filter((item: number | null): item is number => item !== null)
    : null;
  const href = dataLinks[0]?.href ?? null;

  return {
    metric,
    identifier,
    title: String(properties.title ?? '').trim() || null,
    year: Number.isFinite(parsedYear) ? parsedYear : requestedYear,
    season: 1,
    tileId,
    productVersion: version,
    resolutionM: resolution,
    bbox: bbox && bbox.length === 4 ? bbox : null,
    dataAssetAvailable: Boolean(href),
    dataAssetScheme: assetScheme(href),
  };
}

async function findProduct(point: Point, year: number, metric: MetricType) {
  const response = await fetchWithTimeout(catalogUrl(point, year, metric));
  if (!response.ok) {
    throw new Error(`HR-VPP OpenSearch ${metric}/${year} HTTP ${response.status}`);
  }

  const payload = await response.json().catch(() => null) as any;
  const features = Array.isArray(payload?.features) ? payload.features : [];
  if (!features.length) return null;

  const parsed = features
    .map((feature: unknown) => parseProduct(feature, metric, year))
    .filter((item: CatalogProduct | null): item is CatalogProduct => Boolean(item));

  if (!parsed.length) return null;

  // Prefer the highest product revision/version if catalogue returns more than one.
  return parsed.sort((a, b) => String(b.productVersion ?? '').localeCompare(String(a.productVersion ?? '')))[0];
}

async function discoverYear(point: Point, year: number) {
  const sosd = await findProduct(point, year, 'SOSD');
  if (!sosd) return null;

  const rest = await Promise.all(
    METRIC_TYPES.filter((metric) => metric !== 'SOSD').map(async (metric) => {
      try {
        return await findProduct(point, year, metric);
      } catch (error) {
        console.warn('[copernicus-hrvpp] metric catalogue lookup failed', {
          year,
          metric,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }),
  );

  const products = [sosd, ...rest].filter((item): item is CatalogProduct => Boolean(item));
  const byMetric = Object.fromEntries(products.map((item) => [item.metric, item]));
  const tileId = products.find((item) => item.tileId)?.tileId ?? null;
  const version = products.find((item) => item.productVersion)?.productVersion ?? null;

  return {
    year: sosd.year,
    season: 1 as const,
    tileId,
    productVersion: version,
    resolutionM: products.find((item) => item.resolutionM)?.resolutionM ?? 10,
    availableMetricCount: products.length,
    availableMetrics: products.map((item) => item.metric),
    products: byMetric,
  };
}

function toWebMercator(point: Point) {
  const radius = 6_378_137;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const x = radius * point.longitude * Math.PI / 180;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  return { x, y };
}

async function validateWmsVisualization(point: Point, year: number) {
  const { x, y } = toWebMercator(point);
  const halfSizeM = 100;
  const url = new URL(WMS_URL);
  url.searchParams.set('SERVICE', 'WMS');
  url.searchParams.set('REQUEST', 'GetMap');
  url.searchParams.set('VERSION', '1.1.1');
  url.searchParams.set('LAYERS', 'CLMS_HRVPP_VPP_SOSD_SEASON1_10M');
  url.searchParams.set('STYLES', '');
  url.searchParams.set('SRS', 'EPSG:3857');
  url.searchParams.set('BBOX', `${x - halfSizeM},${y - halfSizeM},${x + halfSizeM},${y + halfSizeM}`);
  url.searchParams.set('WIDTH', '16');
  url.searchParams.set('HEIGHT', '16');
  url.searchParams.set('FORMAT', 'image/png');
  url.searchParams.set('TRANSPARENT', 'true');
  url.searchParams.set('TIME', `${year}-01-01`);

  try {
    const response = await fetchWithTimeout(url.toString());
    const contentType = response.headers.get('content-type') ?? '';
    return {
      reachable: response.ok && /image\/png/i.test(contentType),
      statusCode: response.status,
      version: '1.1.1',
      crs: 'EPSG:3857',
      time: `${year}-01-01`,
      layer: 'CLMS_HRVPP_VPP_SOSD_SEASON1_10M',
    };
  } catch (error) {
    return {
      reachable: false,
      statusCode: null,
      version: '1.1.1',
      crs: 'EPSG:3857',
      time: `${year}-01-01`,
      layer: 'CLMS_HRVPP_VPP_SOSD_SEASON1_10M',
      error: error instanceof Error ? error.message : String(error),
    };
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
      return json({ ok: false, error: 'Oturum veya Supabase sunucu yapılandırması eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? body?.fieldId ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const forbidden = ['latitude', 'longitude', 'geometry', 'parcel_geometry', 'year', 'season'];
    if (forbidden.some((key) => key in body)) {
      return json({
        ok: false,
        error: 'Copernicus HR-VPP kanıtında koordinat, geometri, yıl veya sezon istemciden kabul edilmez.',
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

    const point = resolvePoint(field as Record<string, unknown>);
    if (!point) {
      return json({
        ok: true,
        status: 'unavailable',
        source: 'Copernicus Land Monitoring Service HR-VPP',
        field_id: fieldId,
        production_authority: false,
        diagnostic_authority: false,
        input_authority: 'server-derived',
        reason: 'field_location_missing',
        history: [],
        comparison: null,
        warnings: ['HR-VPP için geçerli tarla merkezi bulunamadı.'],
        generated_at: new Date().toISOString(),
      });
    }

    const currentYear = new Date().getUTCFullYear();
    const candidateYears = Array.from(
      { length: MAX_YEAR_LOOKBACK + 1 },
      (_, index) => currentYear - 1 - index,
    ).filter((year) => year >= MIN_YEAR);

    const history: any[] = [];
    const checkedYears: number[] = [];

    for (const year of candidateYears) {
      checkedYears.push(year);
      try {
        const result = await discoverYear(point, year);
        if (result) history.push(result);
      } catch (error) {
        console.warn('[copernicus-hrvpp] catalogue year lookup failed', {
          year,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (history.length >= 2) break;
    }

    if (!history.length) {
      return json({
        ok: true,
        status: 'unavailable',
        source: 'Copernicus Land Monitoring Service HR-VPP',
        provider: 'European Union / EEA / VITO',
        field_id: fieldId,
        crop: field.crop ?? null,
        production_authority: false,
        diagnostic_authority: false,
        confidence_authority: false,
        input_authority: 'server-derived',
        client_supplied_coordinates_accepted: false,
        location_source: point.source,
        coverage_verified: false,
        catalog_collection: COLLECTION,
        checked_years: checkedYears,
        history: [],
        comparison: null,
        raw_sampling: {
          status: 'not_attempted',
          numeric_metrics_verified: false,
        },
        warnings: [
          'Copernicus HR-VPP açık kataloğunda bu tarla merkezi için son yıllarda Season 1 ürünü bulunamadı.',
          'Sayısal HR-VPP değerleri bulunmadığında fenoloji motoruna sentetik tarih veya üretkenlik değeri eklenmez.',
        ],
        generated_at: new Date().toISOString(),
      });
    }

    const latest = history[0];
    const previous = history[1] ?? null;
    const wmsValidation = await validateWmsVisualization(point, latest.year);

    return json({
      ok: true,
      status: 'catalog_ready',
      source: 'Copernicus Land Monitoring Service HR-VPP',
      provider: 'European Union / EEA / VITO',
      field_id: fieldId,
      crop: field.crop ?? null,
      production_authority: false,
      diagnostic_authority: false,
      confidence_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      location_source: point.source,
      coverage_verified: true,
      sampling_mode: 'public_opensearch_catalog_coverage_only',
      resolution_m: latest.resolutionM ?? 10,
      temporal_extent: '2017-present',
      product_scope: 'VPP Season 1 yearly product metadata',
      catalog_collection: COLLECTION,
      checked_years: checkedYears,
      latest_catalog_year: latest.year,
      latest,
      previous,
      history,
      comparison: null,
      wms_validation: wmsValidation,
      raw_sampling: {
        status: 'access_required',
        numeric_metrics_verified: false,
        required_for: ['SOSD', 'EOSD', 'MAXD', 'LENGTH', 'SPROD', 'QFLAG'],
        reason:
          'HR-VPP WMS bu katmanlarda GetFeatureInfo sağlamıyor. Açık katalog ürün/tile kapsamını doğruluyor; gerçek piksel değerleri için ham GeoTIFF erişimi gerekir.',
      },
      attribution: '© European Union, Copernicus Land Monitoring Service, European Environment Agency (EEA)',
      source_url: 'https://land.copernicus.eu/en/products/vegetation',
      catalog_url: `${CATALOG_BASE}/description.geojson?collection=${COLLECTION}`,
      wms_url: WMS_URL,
      warnings: [
        'Copernicus HR-VPP ürününün bu tarla konumunu kapsadığı açık katalogdan doğrulandı; bu cevap henüz ham piksel değerlerini içermez.',
        'WMS EPSG:3857 görselleştirme için kullanılır; HR-VPP VPP katmanlarında GetFeatureInfo desteklenmediği için WMS görüntüsünden sayısal fenoloji değeri uydurulmaz.',
        'Sayısal sezon başlangıcı/bitişi ve üretkenlik değerleri ancak ham GeoTIFF güvenli biçimde örneklendiğinde fenoloji harmanlamasına alınacaktır.',
        'Season 1 kullanılır. Season 2 desteği ayrı doğrulama sonrası eklenmelidir.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Copernicus HR-VPP kanıtı hazırlanamadı.';
    console.error('[copernicus-hrvpp-evidence]', message);
    return json({
      ok: false,
      error: message,
      production_authority: false,
      diagnostic_authority: false,
    }, 500);
  }
});
