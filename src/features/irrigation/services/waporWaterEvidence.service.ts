import { fromUrl } from 'geotiff';

import {
  readFieldMapLayerCache,
  writeFieldMapLayerCache,
} from '../../home-map/services/fieldMapLayerCache';

export type WaporEvidenceStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'error';

export type WaporWaterSeriesPoint = {
  code: string;
  date: string | null;
  valueMmDay: number;
};

export type WaporWaterEvidence = {
  status: WaporEvidenceStatus;
  source: 'FAO WaPOR v3';
  productionAuthority: false;
  fieldId: string;
  latitude: number;
  longitude: number;
  aeti: {
    mapset: 'L1-AETI-D';
    pixelSizeM: number;
    points: WaporWaterSeriesPoint[];
    latestMmDay: number | null;
    previousMmDay: number | null;
    changeMmDay: number | null;
  };
  ret: {
    mapset: 'L1-RET-D';
    pixelSizeM: number;
    points: WaporWaterSeriesPoint[];
    latestMmDay: number | null;
  };
  actualToReferenceRatio: number | null;
  observedAt: string | null;
  evidence: string[];
  warnings: string[];
  generatedAt: string;
};

type RasterCatalogItem = {
  code: string;
  url: string;
};

type MapsetDefinition = {
  code: 'L1-AETI-D' | 'L1-RET-D';
  scale: number;
  pixelSizeM: number;
};

const API_ROOT =
  'https://data.apps.fao.org/gismgr/api/v2/catalog/workspaces/WAPOR-3/mapsets';

const WAPOR_STORAGE_ROOT =
  'https://storage.googleapis.com/fao-gismgr-wapor-3-data/DATA/WAPOR-3/MAPSET';

const CACHE_NAMESPACE = 'wapor-water-v3';
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_CATALOG_PAGES = 12;

const MAPSETS: Record<
  MapsetDefinition['code'],
  MapsetDefinition
> = {
  'L1-AETI-D': {
    code: 'L1-AETI-D',
    scale: 0.1,
    pixelSizeM: 326.13,
  },
  'L1-RET-D': {
    code: 'L1-RET-D',
    scale: 0.1,
    pixelSizeM: 18924,
  },
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number | null, digits = 2) {
  if (value == null) return null;

  return Number(value.toFixed(digits));
}

function rasterDate(code: string) {
  const match = code.match(
    /\.(\d{4})-(\d{2})-D([123])$/,
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const dekad = Number(match[3]);

  const day =
    dekad === 1
      ? 1
      : dekad === 2
        ? 11
        : 21;

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function itemUrl(
  mapset: MapsetDefinition['code'],
  item: any,
) {
  const directCandidates = [
    item?.downloadUrl,
    item?.download_url,
    item?.path,
    item?.url,
    item?.href,
  ];

  for (const value of directCandidates) {
    const url = String(value ?? '').trim();

    if (/^https?:\/\//i.test(url) && /\.tif(?:$|\?)/i.test(url)) {
      return url;
    }
  }

  const links = Array.isArray(item?.links)
    ? item.links
    : [];

  for (const link of links) {
    const href = String(link?.href ?? '').trim();

    if (/^https?:\/\//i.test(href) && /\.tif(?:$|\?)/i.test(href)) {
      return href;
    }
  }

  const code = String(item?.code ?? '').trim();

  return code
    ? `${WAPOR_STORAGE_ROOT}/${mapset}/${code}.tif`
    : '';
}

async function collectLatestRasters(
  mapset: MapsetDefinition['code'],
  count = 2,
): Promise<RasterCatalogItem[]> {
  let nextUrl =
    `${API_ROOT}/${mapset}/rasters`;

  const found = new Map<string, RasterCatalogItem>();

  for (
    let page = 0;
    page < MAX_CATALOG_PAGES && nextUrl;
    page += 1
  ) {
    const response = await fetch(nextUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `WaPOR katalogu alınamadı (${response.status}).`,
      );
    }

    const json = await response.json();
    const payload =
      json?.response ??
      json;

    const items = Array.isArray(payload?.items)
      ? payload.items
      : [];

    for (const item of items) {
      const code = String(item?.code ?? '').trim();

      if (!code || !code.includes(`.${mapset}.`)) continue;

      const url = itemUrl(mapset, item);

      if (!url) continue;

      found.set(code, {
        code,
        url,
      });
    }

    const links = Array.isArray(payload?.links)
      ? payload.links
      : [];

    const nextLink = links.find(
      (link: any) =>
        String(link?.rel ?? '').toLowerCase() === 'next',
    );

    nextUrl = String(nextLink?.href ?? '').trim();
  }

  return [...found.values()]
    .sort((a, b) => b.code.localeCompare(a.code))
    .slice(0, count);
}

function validRawPixel(
  value: unknown,
  noData: number | null,
) {
  const number = finite(value);

  if (number == null) return null;

  if (
    noData != null &&
    Math.abs(number - noData) < 1e-9
  ) {
    return null;
  }

  /*
   * WaPOR COG'larında nodata çoğunlukla negatif/sentinel değerlerdir.
   * Fakat gerçek ET/RET ham değerleri negatif olamaz. Bu koruma, metadata
   * okunamadığında -9999 benzeri hücrelerin ortalamaya karışmasını engeller.
   */
  if (number < 0 || number >= 65000) return null;

  return number;
}

async function sampleCogAtPoint(
  url: string,
  longitude: number,
  latitude: number,
  scale: number,
) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();

  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();

  const [
    minX,
    minY,
    maxX,
    maxY,
  ] = bbox;

  /*
   * WaPOR v3 global Level-1 COG'ları coğrafi koordinatlarla servis edilir.
   * Eğer beklenmedik bir projeksiyonlu raster gelirse yanlış hücre okumaktansa
   * duruyoruz.
   */
  if (
    longitude < minX ||
    longitude > maxX ||
    latitude < minY ||
    latitude > maxY
  ) {
    throw new Error(
      'WaPOR rasterı tarla koordinatını kapsamıyor.',
    );
  }

  const x = clamp(
    Math.floor(
      ((longitude - minX) /
        Math.max(Number.EPSILON, maxX - minX)) *
        width,
    ),
    0,
    width - 1,
  );

  const y = clamp(
    Math.floor(
      ((maxY - latitude) /
        Math.max(Number.EPSILON, maxY - minY)) *
        height,
    ),
    0,
    height - 1,
  );

  const radius = 1;
  const x0 = clamp(x - radius, 0, width - 1);
  const y0 = clamp(y - radius, 0, height - 1);
  const x1 = clamp(x + radius + 1, 1, width);
  const y1 = clamp(y + radius + 1, 1, height);

  const raster = await image.readRasters({
    window: [
      x0,
      y0,
      x1,
      y1,
    ],
    samples: [0],
    interleave: true,
  });

  const noData =
    typeof (image as any).getGDALNoData === 'function'
      ? finite((image as any).getGDALNoData())
      : null;

  const values = Array.from(raster as ArrayLike<number>)
    .map((value) => validRawPixel(value, noData))
    .filter((value): value is number => value != null);

  if (!values.length) {
    throw new Error(
      'WaPOR rasterında tarla konumu için geçerli piksel bulunamadı.',
    );
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  return round(mean * scale, 2)!;
}

async function loadSeries(
  definition: MapsetDefinition,
  longitude: number,
  latitude: number,
  count: number,
) {
  const rasters = await collectLatestRasters(
    definition.code,
    count,
  );

  const settled = await Promise.allSettled(
    rasters.map(async (raster) => ({
      code: raster.code,
      date: rasterDate(raster.code),
      valueMmDay: await sampleCogAtPoint(
        raster.url,
        longitude,
        latitude,
        definition.scale,
      ),
    })),
  );

  return settled
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<WaporWaterSeriesPoint> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function cacheKey(
  fieldId: string,
  latitude: number,
  longitude: number,
) {
  return [
    fieldId,
    'wapor-water',
    latitude.toFixed(4),
    longitude.toFixed(4),
  ].join(':');
}

export async function getWaporWaterEvidence(input: {
  fieldId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  forceRefresh?: boolean;
}): Promise<WaporWaterEvidence> {
  const fieldId = String(input.fieldId ?? '').trim();
  const latitude = finite(input.latitude);
  const longitude = finite(input.longitude);
  const generatedAt = new Date().toISOString();

  if (
    !fieldId ||
    latitude == null ||
    longitude == null
  ) {
    return {
      status: 'unavailable',
      source: 'FAO WaPOR v3',
      productionAuthority: false,
      fieldId,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      aeti: {
        mapset: 'L1-AETI-D',
        pixelSizeM: MAPSETS['L1-AETI-D'].pixelSizeM,
        points: [],
        latestMmDay: null,
        previousMmDay: null,
        changeMmDay: null,
      },
      ret: {
        mapset: 'L1-RET-D',
        pixelSizeM: MAPSETS['L1-RET-D'].pixelSizeM,
        points: [],
        latestMmDay: null,
      },
      actualToReferenceRatio: null,
      observedAt: null,
      evidence: [],
      warnings: [
        'WaPOR su kullanımı kanıtı için tarla koordinatı bulunamadı.',
      ],
      generatedAt,
    };
  }

  const key = cacheKey(
    fieldId,
    latitude,
    longitude,
  );

  if (!input.forceRefresh) {
    const cached =
      await readFieldMapLayerCache<WaporWaterEvidence>(
        fieldId,
        CACHE_NAMESPACE,
        key,
        CACHE_TTL_MS,
      );

    if (cached?.source === 'FAO WaPOR v3') {
      return cached;
    }
  }

  try {
    const [
      aetiPoints,
      retPoints,
    ] = await Promise.all([
      loadSeries(
        MAPSETS['L1-AETI-D'],
        longitude,
        latitude,
        2,
      ),
      loadSeries(
        MAPSETS['L1-RET-D'],
        longitude,
        latitude,
        1,
      ),
    ]);

    const latestAeti =
      aetiPoints.at(-1)?.valueMmDay ??
      null;

    const previousAeti =
      aetiPoints.at(-2)?.valueMmDay ??
      null;

    const latestRet =
      retPoints.at(-1)?.valueMmDay ??
      null;

    const change =
      latestAeti != null &&
      previousAeti != null
        ? round(latestAeti - previousAeti, 2)
        : null;

    const ratio =
      latestAeti != null &&
      latestRet != null &&
      latestRet > 0
        ? round(latestAeti / latestRet, 2)
        : null;

    const observedAt =
      aetiPoints.at(-1)?.date ??
      retPoints.at(-1)?.date ??
      null;

    const status: WaporEvidenceStatus =
      latestAeti != null &&
      latestRet != null
        ? 'ready'
        : latestAeti != null ||
            latestRet != null
          ? 'partial'
          : 'unavailable';

    const evidence = [
      latestAeti != null
        ? `FAO WaPOR gerçek evapotranspirasyon: ${latestAeti.toFixed(2)} mm/gün${aetiPoints.at(-1)?.date ? ` · ${aetiPoints.at(-1)!.date}` : ''}.`
        : null,
      latestRet != null
        ? `FAO WaPOR referans evapotranspirasyon: ${latestRet.toFixed(2)} mm/gün${retPoints.at(-1)?.date ? ` · ${retPoints.at(-1)!.date}` : ''}.`
        : null,
      ratio != null
        ? `WaPOR AETI/RET oranı: ${ratio.toFixed(2)}.`
        : null,
      change != null
        ? `Gerçek evapotranspirasyon önceki dekada göre ${change >= 0 ? '+' : ''}${change.toFixed(2)} mm/gün değişti.`
        : null,
    ].filter((value): value is string => Boolean(value));

    const warnings = [
      'WaPOR üretim sulama kararını değiştirmez; bağımsız uzaktan algılama kanıtıdır.',
      'AETI yaklaşık 326 m, RET yaklaşık 18.9 km piksel çözünürlüğündedir; sonuç tarla merkezindeki çevre piksellerinin destekleyici özetidir.',
      'AETI/RET oranı tek başına su stresi, sulama yeterliliği veya verim kaybı kanıtı değildir.',
    ];

    const result: WaporWaterEvidence = {
      status,
      source: 'FAO WaPOR v3',
      productionAuthority: false,
      fieldId,
      latitude,
      longitude,
      aeti: {
        mapset: 'L1-AETI-D',
        pixelSizeM: MAPSETS['L1-AETI-D'].pixelSizeM,
        points: aetiPoints,
        latestMmDay: latestAeti,
        previousMmDay: previousAeti,
        changeMmDay: change,
      },
      ret: {
        mapset: 'L1-RET-D',
        pixelSizeM: MAPSETS['L1-RET-D'].pixelSizeM,
        points: retPoints,
        latestMmDay: latestRet,
      },
      actualToReferenceRatio: ratio,
      observedAt,
      evidence,
      warnings,
      generatedAt,
    };

    if (status !== 'unavailable') {
      await writeFieldMapLayerCache(
        fieldId,
        CACHE_NAMESPACE,
        key,
        result,
        CACHE_TTL_MS,
      );
    }

    return result;
  } catch (error) {
    return {
      status: 'error',
      source: 'FAO WaPOR v3',
      productionAuthority: false,
      fieldId,
      latitude,
      longitude,
      aeti: {
        mapset: 'L1-AETI-D',
        pixelSizeM: MAPSETS['L1-AETI-D'].pixelSizeM,
        points: [],
        latestMmDay: null,
        previousMmDay: null,
        changeMmDay: null,
      },
      ret: {
        mapset: 'L1-RET-D',
        pixelSizeM: MAPSETS['L1-RET-D'].pixelSizeM,
        points: [],
        latestMmDay: null,
      },
      actualToReferenceRatio: null,
      observedAt: null,
      evidence: [],
      warnings: [
        error instanceof Error
          ? error.message
          : 'FAO WaPOR verisi alınamadı.',
      ],
      generatedAt,
    };
  }
}
