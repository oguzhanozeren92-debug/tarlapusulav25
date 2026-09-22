import { fromUrl } from 'geotiff';
import type { EarthSearchScene, Position } from '../../../services/earthSearchService';

export type EarthSearchNdviRelativeZoneStatus = 'weaker' | 'similar' | 'stronger';

export type EarthSearchNdviRelativeZone = {
  area:
    | 'kuzeybatı'
    | 'kuzey'
    | 'kuzeydoğu'
    | 'batı'
    | 'merkez'
    | 'doğu'
    | 'güneybatı'
    | 'güney'
    | 'güneydoğu';
  sampleCount: number;
  mean: number;
  deltaFromFieldMean: number;
  relativeHealth: number;
  status: EarthSearchNdviRelativeZoneStatus;
};

export type EarthSearchNdviStats = {
  sceneId: string;
  datetime: string;
  cloudCover: number | null;
  sampleCount: number;
  mean: number;
  median: number | null;
  stdDev: number | null;
  min: number;
  max: number;
  healthyPercent: number;
  moderatePercent: number;
  stressedPercent: number;
  /** Parsel içindeki 3×3 gerçek NDVI bölge karşılaştırması. */
  relativeThreshold: number | null;
  relativeZones: EarthSearchNdviRelativeZone[];
  /** GeoBlaze başarısız olursa mevcut piksel-maskesi hesabı devreye girer. */
  engine: 'geoblaze' | 'native-fallback';
};

type XY = [number, number];

type GeoBlazeBandStats = {
  count?: number;
  valid?: number;
  invalid?: number;
  median?: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  histogram?: Record<
    string,
    number | {
      n?: number;
      ct?: number;
    }
  >;
};

const NDVI_NO_DATA = -9999;


const NDVI_RELATIVE_AREAS: EarthSearchNdviRelativeZone['area'][] = [
  'kuzeybatı',
  'kuzey',
  'kuzeydoğu',
  'batı',
  'merkez',
  'doğu',
  'güneybatı',
  'güney',
  'güneydoğu',
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildRelativeNdviZones(input: {
  redRaster: ArrayLike<number>;
  nirRaster: ArrayLike<number>;
  projectedRing: XY[];
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  x0: number;
  y0: number;
  windowWidth: number;
  windowHeight: number;
  fieldMean: number;
  fieldStdDev: number | null;
}) {
  const xs = input.projectedRing.map(([x]) => x);
  const ys = input.projectedRing.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(Number.EPSILON, maxX - minX);
  const spanY = Math.max(Number.EPSILON, maxY - minY);

  const zoneValues: number[][] = Array.from({ length: 9 }, () => []);
  const length = Math.min(
    input.redRaster.length,
    input.nirRaster.length,
    input.windowWidth * input.windowHeight,
  );

  for (let index = 0; index < length; index += 1) {
    const col = index % input.windowWidth;
    const row = Math.floor(index / input.windowWidth);
    const x = input.originX + (input.x0 + col + 0.5) * input.resX;
    const y = input.originY - (input.y0 + row + 0.5) * input.resY;

    if (!pointInRing([x, y], input.projectedRing)) continue;

    const ndvi = safeNdvi(input.redRaster[index], input.nirRaster[index]);
    if (ndvi === null) continue;

    const colIndex = Math.min(
      2,
      Math.max(0, Math.floor(clamp((x - minX) / spanX, 0, 0.999999) * 3)),
    );
    const rowIndex = Math.min(
      2,
      Math.max(0, Math.floor(clamp((maxY - y) / spanY, 0, 0.999999) * 3)),
    );

    zoneValues[rowIndex * 3 + colIndex].push(ndvi);
  }

  const spread =
    input.fieldStdDev != null && Number.isFinite(input.fieldStdDev)
      ? Math.abs(input.fieldStdDev)
      : 0;

  /*
   * Göreli fark için tek piksel gürültüsünü büyütmemek adına en az 0.04 NDVI
   * fark isteriz. Parsel kendi içinde çok değişkense eşik standart sapmayla
   * birlikte yükselir; ancak aşırı yükselip gerçek lokal farkları gizlememesi
   * için 0.12 ile sınırlandırılır.
   */
  const threshold = clamp(Math.max(0.04, spread * 0.6), 0.04, 0.12);

  const zones = zoneValues
    .map((values, index): EarthSearchNdviRelativeZone | null => {
      if (!values.length) return null;

      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const delta = mean - input.fieldMean;
      const status: EarthSearchNdviRelativeZoneStatus =
        delta <= -threshold
          ? 'weaker'
          : delta >= threshold
            ? 'stronger'
            : 'similar';

      /*
       * Eski spatial akışlarıyla uyumluluk için 0..1 göreli sağlık skoru da
       * taşıyoruz. Eşik kadar düşük bir bölge yaklaşık 0.25, eşik kadar yüksek
       * bir bölge yaklaşık 0.75 olur. Bu değer mutlak NDVI değildir.
       */
      const relativeHealth = clamp(
        0.5 + delta / Math.max(threshold * 4, 0.000001),
        0,
        1,
      );

      return {
        area: NDVI_RELATIVE_AREAS[index],
        sampleCount: values.length,
        mean,
        deltaFromFieldMean: delta,
        relativeHealth,
        status,
      };
    })
    .filter((zone): zone is EarthSearchNdviRelativeZone => Boolean(zone));

  return {
    threshold,
    zones,
  };
}

function pointInRing(point: XY, ring: XY[]) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function normalizeRing(ring: Position[]) {
  if (ring.length < 3) throw new Error('NDVI analizi için tarla sınırı eksik.');
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function clampWindow(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wgs84ToUtm([lon, lat]: Position, zone: number, south: boolean): XY {
  const a = 6378137;
  const eccSquared = 0.00669438;
  const k0 = 0.9996;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const n = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) ** 2);
  const t = Math.tan(latRad) ** 2;
  const c = eccPrimeSquared * Math.cos(latRad) ** 2;
  const aa = Math.cos(latRad) * (lonRad - lonOriginRad);
  const m = a * (
    (1 - eccSquared / 4 - (3 * eccSquared ** 2) / 64 - (5 * eccSquared ** 3) / 256) * latRad -
    ((3 * eccSquared) / 8 + (3 * eccSquared ** 2) / 32 + (45 * eccSquared ** 3) / 1024) * Math.sin(2 * latRad) +
    ((15 * eccSquared ** 2) / 256 + (45 * eccSquared ** 3) / 1024) * Math.sin(4 * latRad) -
    ((35 * eccSquared ** 3) / 3072) * Math.sin(6 * latRad)
  );
  const easting = k0 * n * (aa + ((1 - t + c) * aa ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * eccPrimeSquared) * aa ** 5) / 120) + 500000;
  let northing = k0 * (m + n * Math.tan(latRad) * (aa ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * aa ** 4) / 24 + ((61 - 58 * t + t ** 2 + 600 * c - 330 * eccPrimeSquared) * aa ** 6) / 720));
  if (south) northing += 10000000;
  return [easting, northing];
}

function getImageEpsg(image: any) {
  const geoKeys = image.getGeoKeys?.() ?? {};
  const epsg = Number(geoKeys.ProjectedCSTypeGeoKey ?? geoKeys.ProjectedCRSGeoKey);
  return Number.isFinite(epsg) ? epsg : null;
}

function projectRingForImage(image: any, ring: Position[]): XY[] {
  const epsg = getImageEpsg(image);
  if (epsg && epsg >= 32601 && epsg <= 32660) {
    const zone = epsg - 32600;
    return ring.map((point) => wgs84ToUtm(point, zone, false));
  }
  if (epsg && epsg >= 32701 && epsg <= 32760) {
    const zone = epsg - 32700;
    return ring.map((point) => wgs84ToUtm(point, zone, true));
  }
  throw new Error(`Sentinel-2 raster koordinat sistemi desteklenmiyor (EPSG:${epsg || 'bilinmiyor'}).`);
}

function safeNdvi(red: unknown, nir: unknown) {
  const redValue = Number(red);
  const nirValue = Number(nir);
  const denominator = nirValue + redValue;

  if (
    !Number.isFinite(redValue) ||
    !Number.isFinite(nirValue) ||
    denominator === 0
  ) {
    return null;
  }

  const ndvi = (nirValue - redValue) / denominator;
  return Number.isFinite(ndvi) && ndvi >= -1 && ndvi <= 1 ? ndvi : null;
}

function percentagesFromValues(values: number[]) {
  const total = values.length;
  if (!total) return null;

  const healthy = values.filter((value) => value >= 0.6).length;
  const moderate = values.filter((value) => value >= 0.3 && value < 0.6).length;
  const stressed = values.filter((value) => value < 0.3).length;

  return {
    healthyPercent: (healthy / total) * 100,
    moderatePercent: (moderate / total) * 100,
    stressedPercent: (stressed / total) * 100,
  };
}

function percentagesFromHistogram(histogram: GeoBlazeBandStats['histogram']) {
  if (!histogram) return null;

  let healthy = 0;
  let moderate = 0;
  let stressed = 0;
  let total = 0;

  for (const [key, rawEntry] of Object.entries(histogram)) {
    const value =
      typeof rawEntry === 'number'
        ? Number(key)
        : Number(rawEntry?.n ?? key);

    const count =
      typeof rawEntry === 'number'
        ? Number(rawEntry)
        : Number(rawEntry?.ct ?? 0);

    if (
      !Number.isFinite(value) ||
      !Number.isFinite(count) ||
      count <= 0 ||
      value === NDVI_NO_DATA ||
      value < -1 ||
      value > 1
    ) {
      continue;
    }

    total += count;

    if (value >= 0.6) healthy += count;
    else if (value >= 0.3) moderate += count;
    else stressed += count;
  }

  if (!total) return null;

  return {
    total,
    healthyPercent: (healthy / total) * 100,
    moderatePercent: (moderate / total) * 100,
    stressedPercent: (stressed / total) * 100,
  };
}

async function runGeoBlazeStats(input: {
  values: number[][];
  wgs84Ring: Position[];
  epsg: number;
  xmin: number;
  ymax: number;
  pixelWidth: number;
  pixelHeight: number;
}) {
  const [{ default: geoblaze }, georasterModule] = await Promise.all([
    import('geoblaze'),
    import('georaster'),
  ]);

  const parseGeoraster =
    (georasterModule as any).default ?? georasterModule;

  const georaster = await Promise.resolve(
    parseGeoraster(
      [input.values],
      {
        noDataValue: NDVI_NO_DATA,
        projection: input.epsg,
        xmin: input.xmin,
        ymax: input.ymax,
        pixelWidth: input.pixelWidth,
        pixelHeight: input.pixelHeight,
      },
    ),
  );

  const geometry = {
    geometry: {
      type: 'Polygon',
      coordinates: [input.wgs84Ring],
    },
    srs: 4326,
    densify: 3,
  };

  let result: GeoBlazeBandStats[];

  try {
    result = await (geoblaze as any).stats(georaster, geometry);
  } catch (error) {
    // Çok küçük/dar parsellerde GeoBlaze gerçek piksel kesişimini kaçırırsa
    // yalnızca gerektiğinde minimal sanal örnekleme ile yeniden dene.
    const message = error instanceof Error ? error.message : String(error);
    if (!/No Values were found/i.test(message)) throw error;

    result = await (geoblaze as any).stats(
      georaster,
      geometry,
      undefined,
      undefined,
      {
        vrm: 'minimal',
        rescale: true,
      },
    );
  }

  const stats = result?.[0];
  if (!stats) throw new Error('GeoBlaze NDVI istatistiği boş geldi.');

  const mean = Number(stats.mean);
  const min = Number(stats.min);
  const max = Number(stats.max);
  const median = Number(stats.median);
  const stdDev = Number(stats.std);
  const histogram = percentagesFromHistogram(stats.histogram);

  if (
    !Number.isFinite(mean) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min < -1.001 ||
    max > 1.001 ||
    !histogram
  ) {
    throw new Error('GeoBlaze NDVI sonucu beklenen -1…1 aralığında değil.');
  }

  const validCount = Number(stats.valid ?? stats.count ?? histogram.total);

  return {
    sampleCount: Number.isFinite(validCount)
      ? Math.max(1, Math.round(validCount))
      : Math.max(1, Math.round(histogram.total)),
    mean,
    median: Number.isFinite(median) ? median : null,
    stdDev: Number.isFinite(stdDev) ? stdDev : null,
    min,
    max,
    healthyPercent: histogram.healthyPercent,
    moderatePercent: histogram.moderatePercent,
    stressedPercent: histogram.stressedPercent,
  };
}

function runNativeFallback(input: {
  redRaster: ArrayLike<number>;
  nirRaster: ArrayLike<number>;
  projectedRing: XY[];
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  x0: number;
  y0: number;
  windowWidth: number;
  windowHeight: number;
}) {
  const values: number[] = [];
  const length = Math.min(
    input.redRaster.length,
    input.nirRaster.length,
    input.windowWidth * input.windowHeight,
  );

  for (let index = 0; index < length; index += 1) {
    const col = index % input.windowWidth;
    const row = Math.floor(index / input.windowWidth);
    const x = input.originX + (input.x0 + col + 0.5) * input.resX;
    const y = input.originY - (input.y0 + row + 0.5) * input.resY;

    if (!pointInRing([x, y], input.projectedRing)) continue;

    const ndvi = safeNdvi(input.redRaster[index], input.nirRaster[index]);
    if (ndvi !== null) values.push(ndvi);
  }

  if (!values.length) return null;

  values.sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const percentages = percentagesFromValues(values);

  if (!percentages) return null;

  return {
    sampleCount: values.length,
    mean,
    median,
    stdDev: Math.sqrt(variance),
    min: values[0],
    max: values[values.length - 1],
    ...percentages,
  };
}

/**
 * Sentinel-2 B04/B08 COG'larının yalnızca parseli çevreleyen küçük penceresini
 * okur. NDVI piksel matrisi gerçek bantlardan hesaplanır ve parsel içi zonal
 * istatistikler GeoBlaze ile üretilir. GeoBlaze herhangi bir geometri/ortam
 * sorununda sonuç üretmezse mevcut yerel piksel-maskesi hesabı güvenli fallback
 * olarak kalır. Sentetik değer üretilmez.
 */
export async function analyzeEarthSearchSceneNdvi(
  scene: EarthSearchScene,
  parcelRing: Position[],
): Promise<EarthSearchNdviStats | null> {
  if (!scene.redUrl || !scene.nirUrl) return null;

  const wgs84Ring = normalizeRing(parcelRing);
  const [redTiff, nirTiff] = await Promise.all([
    fromUrl(scene.redUrl),
    fromUrl(scene.nirUrl),
  ]);
  const [redImage, nirImage] = await Promise.all([
    redTiff.getImage(),
    nirTiff.getImage(),
  ]);

  const epsg = getImageEpsg(redImage);
  if (!epsg) {
    throw new Error('Sentinel-2 raster EPSG bilgisi okunamadı.');
  }

  const projectedRing = projectRingForImage(redImage, wgs84Ring);

  const redBox = redImage.getBoundingBox();
  const nirBox = nirImage.getBoundingBox();
  const minX = Math.max(redBox[0], nirBox[0], Math.min(...projectedRing.map(([x]) => x)));
  const minY = Math.max(redBox[1], nirBox[1], Math.min(...projectedRing.map(([, y]) => y)));
  const maxX = Math.min(redBox[2], nirBox[2], Math.max(...projectedRing.map(([x]) => x)));
  const maxY = Math.min(redBox[3], nirBox[3], Math.max(...projectedRing.map(([, y]) => y)));
  if (!(minX < maxX && minY < maxY)) return null;

  const width = redImage.getWidth();
  const height = redImage.getHeight();
  const [originX, originY] = redImage.getOrigin();
  const [resXRaw, resYRaw] = redImage.getResolution();
  const resX = Math.abs(resXRaw);
  const resY = Math.abs(resYRaw);
  const x0 = clampWindow(Math.floor((minX - originX) / resX), 0, width - 1);
  const x1 = clampWindow(Math.ceil((maxX - originX) / resX), x0 + 1, width);
  const y0 = clampWindow(Math.floor((originY - maxY) / resY), 0, height - 1);
  const y1 = clampWindow(Math.ceil((originY - minY) / resY), y0 + 1, height);
  const window: [number, number, number, number] = [x0, y0, x1, y1];
  const windowWidth = x1 - x0;
  const windowHeight = y1 - y0;

  const [redRaster, nirRaster] = await Promise.all([
    redImage.readRasters({ window, interleave: true }),
    nirImage.readRasters({
      window,
      width: windowWidth,
      height: windowHeight,
      interleave: true,
    }),
  ]);

  const ndviRows: number[][] = Array.from(
    { length: windowHeight },
    () => Array<number>(windowWidth).fill(NDVI_NO_DATA),
  );

  const rasterLength = Math.min(
    redRaster.length,
    nirRaster.length,
    windowWidth * windowHeight,
  );

  for (let index = 0; index < rasterLength; index += 1) {
    const ndvi = safeNdvi(redRaster[index], nirRaster[index]);
    if (ndvi === null) continue;

    const row = Math.floor(index / windowWidth);
    const col = index % windowWidth;
    if (row < windowHeight && col < windowWidth) {
      ndviRows[row][col] = ndvi;
    }
  }

  let engine: EarthSearchNdviStats['engine'] = 'geoblaze';
  let calculated:
    | Awaited<ReturnType<typeof runGeoBlazeStats>>
    | ReturnType<typeof runNativeFallback>;

  try {
    calculated = await runGeoBlazeStats({
      values: ndviRows,
      wgs84Ring,
      epsg,
      xmin: originX + x0 * resX,
      ymax: originY - y0 * resY,
      pixelWidth: resX,
      pixelHeight: resY,
    });
  } catch (error) {
    console.warn(
      '[GeoBlaze] Parsel NDVI zonal istatistiği fallback hesabına geçti:',
      error,
    );

    engine = 'native-fallback';
    calculated = runNativeFallback({
      redRaster,
      nirRaster,
      projectedRing,
      originX,
      originY,
      resX,
      resY,
      x0,
      y0,
      windowWidth,
      windowHeight,
    });
  }

  if (!calculated) return null;

  const relative = buildRelativeNdviZones({
    redRaster,
    nirRaster,
    projectedRing,
    originX,
    originY,
    resX,
    resY,
    x0,
    y0,
    windowWidth,
    windowHeight,
    fieldMean: calculated.mean,
    fieldStdDev: calculated.stdDev,
  });

  return {
    sceneId: scene.id,
    datetime: scene.datetime,
    cloudCover: scene.cloudCover,
    sampleCount: calculated.sampleCount,
    mean: calculated.mean,
    median: calculated.median,
    stdDev: calculated.stdDev,
    min: calculated.min,
    max: calculated.max,
    healthyPercent: calculated.healthyPercent,
    moderatePercent: calculated.moderatePercent,
    stressedPercent: calculated.stressedPercent,
    relativeThreshold: relative.threshold,
    relativeZones: relative.zones,
    engine,
  };
}
