const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ParcelGeometry = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
};

type SatelliteRequest = {
  geometry?: ParcelGeometry;
  daysBack?: number;
  maxCloudCoverage?: number;
  imageDate?: string;
  listScenes?: boolean;
};

type TimeRange = { from: string; to: string };

type CatalogScene = {
  id: string | null;
  datetime: string;
  date: string;
  cloudCoverage: number | null;
};

const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

// Güncel Copernicus Data Space Sentinel Hub uç noktaları.
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/process/v1';
const STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1';
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const safeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

const buildTimeRange = (daysBack: number): TimeRange => {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);

  return {
    from: `${dateOnly(start)}T00:00:00Z`,
    to: `${dateOnly(end)}T23:59:59Z`,
  };
};

const buildDayTimeRange = (date: string): TimeRange => ({
  from: `${date}T00:00:00Z`,
  to: `${date}T23:59:59Z`,
});

const getToken = async () => {
  const clientId = Deno.env.get('COPERNICUS_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('COPERNICUS_CLIENT_SECRET')?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('Copernicus Client ID veya Client Secret bulunamadı.');
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Copernicus OAuth error:', response.status, detail);
    throw new Error('Copernicus yetkilendirmesi başarısız.');
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('Copernicus access token alınamadı.');
  }

  return String(data.access_token);
};

const collectCoordinates = (
  coordinates: any,
  result: [number, number][] = [],
) => {
  if (!Array.isArray(coordinates)) return result;

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    result.push([Number(coordinates[0]), Number(coordinates[1])]);
    return result;
  }

  for (const item of coordinates) collectCoordinates(item, result);
  return result;
};

const calculateBBox = (geometry: ParcelGeometry) => {
  const points = collectCoordinates(geometry.geometry.coordinates);
  if (!points.length) return null;

  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
};

const makeBounds = (geometry: ParcelGeometry) => ({
  geometry: {
    type: geometry.geometry.type,
    coordinates: geometry.geometry.coordinates,
  },
  properties: {
    crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
  },
});

const fetchSceneList = async (
  token: string,
  geometry: ParcelGeometry,
  timeRange: TimeRange,
  maxCloudCoverage: number,
): Promise<CatalogScene[]> => {
  const response = await fetch(CATALOG_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      datetime: `${timeRange.from}/${timeRange.to}`,
      intersects: geometry.geometry,
      limit: 100,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Catalog API error:', response.status, detail);
    throw new Error('Uydu tarih listesi alınamadı.');
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  const scenes = features
    .map((feature: any) => {
      const rawDatetime = String(
        feature?.properties?.datetime ??
          feature?.properties?.start_datetime ??
          '',
      ).trim();

      if (!rawDatetime) return null;

      const parsed = new Date(rawDatetime);
      if (Number.isNaN(parsed.getTime())) return null;

      const cloudCoverage = safeNumber(feature?.properties?.['eo:cloud_cover']);

      return {
        id: feature?.id ? String(feature.id) : null,
        datetime: parsed.toISOString(),
        date: parsed.toISOString().slice(0, 10),
        cloudCoverage,
      } satisfies CatalogScene;
    })
    .filter(Boolean) as CatalogScene[];

  const suitable = scenes.filter(
    (scene) =>
      scene.cloudCoverage === null || scene.cloudCoverage <= maxCloudCoverage,
  );

  suitable.sort(
    (a, b) =>
      new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  );

  return suitable;
};

const fetchLatestScene = async (...args: Parameters<typeof fetchSceneList>): Promise<CatalogScene | null> => {
  try { return (await fetchSceneList(...args))[0] ?? null; } catch { return null; }
};

const NDVI_IMAGE_SCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}
function validPixel(scl) {
  return !(scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0 || !validPixel(sample.SCL)) return [0,0,0,0];
  let denom = sample.B08 + sample.B04;
  if (denom === 0) return [0,0,0,0];
  let ndvi = (sample.B08 - sample.B04) / denom;
  if (ndvi < 0.20) return [0.90,0.10,0.08,0.88];
  if (ndvi < 0.35) return [0.96,0.43,0.10,0.86];
  if (ndvi < 0.50) return [0.95,0.76,0.12,0.80];
  if (ndvi < 0.65) return [0.44,0.75,0.24,0.76];
  return [0.05,0.48,0.18,0.76];
}
`;

const TRUE_COLOR_SCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}
function validPixel(scl) {
  return !(scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0 || !validPixel(sample.SCL)) return [0,0,0,0];
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, 1];
}
`;

const NDVI_STATS_SCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "default", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function validPixel(scl) {
  return !(scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
}
function evaluatePixel(sample) {
  let valid = sample.dataMask === 1 && validPixel(sample.SCL);
  if (!valid) return { default: [0], dataMask: [0] };
  let denom = sample.B08 + sample.B04;
  if (denom === 0) return { default: [0], dataMask: [0] };
  return {
    default: [(sample.B08 - sample.B04) / denom],
    dataMask: [1]
  };
}
`;

const responseToBase64 = async (response: Response) => {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

const fetchImage = async (
  token: string,
  geometry: ParcelGeometry,
  timeRange: TimeRange,
  maxCloudCoverage: number,
  evalscript: string,
) => {
  const response = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    },
    body: JSON.stringify({
      input: {
        bounds: makeBounds(geometry),
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange,
              mosaickingOrder: 'mostRecent',
              maxCloudCoverage,
            },
          },
        ],
      },
      output: {
        width: 768,
        height: 768,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/png' },
          },
        ],
      },
      evalscript,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Process API error:', response.status, detail);
    throw new Error('Sentinel-2 görüntüsü üretilemedi.');
  }

  return responseToBase64(response);
};

const fetchStatistics = async (
  token: string,
  geometry: ParcelGeometry,
  timeRange: TimeRange,
  maxCloudCoverage: number,
) => {
  const response = await fetch(STATISTICS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      input: {
        bounds: makeBounds(geometry),
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              mosaickingOrder: 'mostRecent',
              maxCloudCoverage,
            },
          },
        ],
      },
      aggregation: {
        timeRange,
        aggregationInterval: { of: 'P1D' },
        resx: 10,
        resy: 10,
        evalscript: NDVI_STATS_SCRIPT,
      },
      calculations: { default: {} },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Statistics API error:', response.status, detail);
    return null;
  }

  return response.json();
};

const extractStatistics = (data: any) => {
  const intervals = Array.isArray(data?.data) ? data.data : [];
  const valid = intervals.filter((item: any) => {
    const stats = item?.outputs?.default?.bands?.B0?.stats;
    if (!stats) return false;

    const sampleCount = safeNumber(stats.sampleCount) ?? 0;
    const noDataCount = safeNumber(stats.noDataCount) ?? 0;

    return sampleCount > noDataCount && safeNumber(stats.mean) !== null;
  });

  if (!valid.length) {
    return {
      latestImageDate: null,
      ndviAverage: null,
      ndviMin: null,
      ndviMax: null,
    };
  }

  const latest = valid[valid.length - 1];
  const stats = latest.outputs.default.bands.B0.stats;
  const mean = safeNumber(stats.mean);
  const min = safeNumber(stats.min);
  const max = safeNumber(stats.max);

  return {
    latestImageDate: latest.interval?.from
      ? String(latest.interval.from).slice(0, 10)
      : null,
    ndviAverage: mean === null ? null : Number(mean.toFixed(3)),
    ndviMin: min === null ? null : Number(min.toFixed(3)),
    ndviMax: max === null ? null : Number(max.toFixed(3)),
  };
};

const healthFromNdvi = (
  average: number | null,
  min: number | null,
) => {
  if (average === null) {
    return { status: 'unknown', statusLabel: 'Analiz yapılamadı' };
  }

  if (average >= 0.55 && (min === null || min >= 0.25)) {
    return { status: 'good', statusLabel: 'İyi' };
  }

  if (average >= 0.35) {
    return { status: 'check', statusLabel: 'Kontrol Öneriliyor' };
  }

  return { status: 'alert', statusLabel: 'Dikkat Gerekiyor' };
};

const makeSummary = (
  average: number | null,
  min: number | null,
) => {
  if (average === null) {
    return 'Uygun bulutsuz Sentinel-2 görüntüsü bulunamadı.';
  }

  if (average >= 0.55 && (min === null || min >= 0.25)) {
    return 'Parsel genelinde bitki gelişimi dengeli görünüyor.';
  }

  if (average >= 0.55 && min !== null && min < 0.25) {
    return 'Parselin genel durumu iyi ancak bazı bölgelerde belirgin gelişim farkı görülüyor.';
  }

  if (average >= 0.35) {
    return 'Parselde bitki gelişim farklılıkları görülüyor. Sarı ve turuncu bölgelerin sahada kontrol edilmesi önerilir.';
  }

  return 'Parselde belirgin gelişim zayıflığı görülüyor. Kırmızı bölgelerin öncelikli saha kontrolüne alınması önerilir.';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'method_not_allowed',
        message: 'Sadece POST destekleniyor.',
      },
      405,
    );
  }

  try {
    const body = (await req.json()) as SatelliteRequest;
    const geometry = body.geometry;

    if (
      !geometry ||
      geometry.type !== 'Feature' ||
      !geometry.geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)
    ) {
      return jsonResponse(
        {
          success: false,
          error: 'invalid_geometry',
          message: 'Geçerli parsel GeoJSON geometrisi gerekli.',
        },
        400,
      );
    }

    const bbox = calculateBBox(geometry);
    if (!bbox) {
      return jsonResponse(
        {
          success: false,
          error: 'invalid_geometry',
          message: 'Parsel koordinatları okunamadı.',
        },
        400,
      );
    }

    const daysBack = clamp(Number(body.daysBack ?? 45), 7, 90);
    const maxCloudCoverage = clamp(
      Number(body.maxCloudCoverage ?? 30),
      0,
      100,
    );

    const requestedDate = String(body.imageDate ?? '').trim();
    if (requestedDate) {
      const parsed = new Date(requestedDate + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !Number.isFinite(parsed.getTime())
        || dateOnly(parsed) !== requestedDate || requestedDate > dateOnly(new Date())) {
        return jsonResponse({ success: false, message: 'Geçerli bir geçmiş ölçüm tarihi seç.' }, 400);
      }
    }
    const searchTimeRange = requestedDate ? buildDayTimeRange(requestedDate)
      : buildTimeRange(body.listScenes ? clamp(Number(body.daysBack ?? 180), 7, 180) : daysBack);
    const token = await getToken();
    if (body.listScenes) {
      const scenes = await fetchSceneList(token, geometry, searchTimeRange, maxCloudCoverage);
      const dates = [...new Set(scenes.map(scene => scene.date))];
      return jsonResponse({ success: true, dates, source: 'Sentinel-2 L2A', period: searchTimeRange });
    }

    const selectedScene = await fetchLatestScene(
      token,
      geometry,
      searchTimeRange,
      maxCloudCoverage,
    );

    if (requestedDate && (!selectedScene || selectedScene.date !== requestedDate)) {
      return jsonResponse({ success: false, message: 'Bu tarihte uygun uydu ölçümü bulunamadı.' });
    }

    const imageTimeRange = selectedScene
      ? buildDayTimeRange(selectedScene.date)
      : searchTimeRange;

    const [statisticsRaw, ndviBase64, trueColorBase64] = await Promise.all([
      fetchStatistics(
        token,
        geometry,
        imageTimeRange,
        maxCloudCoverage,
      ),
      fetchImage(
        token,
        geometry,
        imageTimeRange,
        maxCloudCoverage,
        NDVI_IMAGE_SCRIPT,
      ),
      fetchImage(
        token,
        geometry,
        imageTimeRange,
        maxCloudCoverage,
        TRUE_COLOR_SCRIPT,
      ),
    ]);

    const statistics = extractStatistics(statisticsRaw);
    const latestImageDate =
      selectedScene?.date ?? statistics.latestImageDate;

    const health = healthFromNdvi(
      statistics.ndviAverage,
      statistics.ndviMin,
    );

    const summary = makeSummary(
      statistics.ndviAverage,
      statistics.ndviMin,
    );

    const recommendations =
      health.status === 'good'
        ? [
            'Planlı saha kontrollerini sürdür.',
            'Uydu değişimini periyodik takip et.',
          ]
        : health.status === 'check'
          ? [
              'Sarı ve turuncu bölgeleri sahada kontrol et.',
              'Toprak nemi ve sulama durumunu değerlendir.',
              'Besleme planını gözden geçir.',
            ]
          : [
              'Kırmızı bölgeleri öncelikli saha kontrolüne al.',
              'Sulama, besin ve hastalık belirtilerini kontrol et.',
              'Gerekirse fotoğraf analizi ile ikinci kontrol yap.',
            ];

    return jsonResponse({
      success: true,
      source: 'Copernicus Data Space · Sentinel-2 L2A',
      status: health.status,
      statusLabel: health.statusLabel,
      summary,
      recommendations,
      bbox,
      timeRange: imageTimeRange,
      searchTimeRange,
      latestImageDate,
      ndviAverage: statistics.ndviAverage,
      ndviMin: statistics.ndviMin,
      ndviMax: statistics.ndviMax,
      ndviImage: `data:image/png;base64,${ndviBase64}`,
      trueColorImage: `data:image/png;base64,${trueColorBase64}`,
      healthyPercent: null,
      warningPercent: null,
      stressedPercent: null,
      selectedSceneId: selectedScene?.id ?? null,
      selectedSceneCloudCoverage: selectedScene?.cloudCoverage ?? null,
      selectedSceneDatetime: selectedScene?.datetime ?? null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('satellite-field-analysis:', error);

    return jsonResponse(
      {
        success: false,
        error: 'satellite_analysis_error',
        message:
          error instanceof Error
            ? error.message
            : 'Uydu analizi sırasında teknik hata oluştu.',
      },
      200,
    );
  }
});

