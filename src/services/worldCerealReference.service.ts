export type WorldCerealReferenceSample = {
  collectionId: string;
  collectionTitle: string | null;
  sampleId: string | null;
  ewocCode: number | null;
  irrigationStatus: number | null;
  validityDate: string | null;
  imageryDate: string | null;
  landCoverQualityScore: number | null;
  cropTypeQualityScore: number | null;
  h3Index: string | null;
};

export type WorldCerealReferenceContext = {
  status: 'ready' | 'partial' | 'unavailable' | 'error';
  source: 'ESA WorldCereal RDM';
  latitude: number;
  longitude: number;
  radiusKm: number;
  bbox: [number, number, number, number];
  collectionsMatched: number;
  collectionsQueried: number;
  sampleCount: number;
  samples: WorldCerealReferenceSample[];
  cropCodeSummary: Array<{
    ewocCode: number;
    count: number;
  }>;
  irrigationCodeSummary: Array<{
    irrigationStatus: number;
    count: number;
  }>;
  latestValidityDate: string | null;
  productCatalog: {
    globalMapYear: 2021;
    spatialResolutionMeters: 10;
    products: string[];
    pixelSamplingReady: false;
    note: string;
  };
  evidence: string[];
  warnings: string[];
  generatedAt: string;
};

type CollectionRow = {
  collectionId: string;
  title: string | null;
  featureCount: number;
  bbox: [number, number, number, number] | null;
};

const API_ROOT = 'https://ewoc-rdm-api.iiasa.ac.at/data';
const CACHE_PREFIX = 'tp_worldcereal_rdm_v1:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_COLLECTIONS = 8;
const MAX_SAMPLES_PER_COLLECTION = 12;

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function safeDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw.slice(0, 10);

  return new Date(parsed).toISOString().slice(0, 10);
}

function radiusBbox(
  latitude: number,
  longitude: number,
  radiusKm: number,
): [number, number, number, number] {
  const latDelta = radiusKm / 111.32;
  const longitudeKmPerDegree = Math.max(
    20,
    111.32 * Math.cos((latitude * Math.PI) / 180),
  );
  const lonDelta = radiusKm / longitudeKmPerDegree;

  return [
    Number((longitude - lonDelta).toFixed(6)),
    Number((latitude - latDelta).toFixed(6)),
    Number((longitude + lonDelta).toFixed(6)),
    Number((latitude + latDelta).toFixed(6)),
  ];
}

function intersects(
  left: [number, number, number, number],
  right: [number, number, number, number],
) {
  return !(
    left[2] < right[0] ||
    left[0] > right[2] ||
    left[3] < right[1] ||
    left[1] > right[3]
  );
}

function parseBbox(value: any): [number, number, number, number] | null {
  const direct =
    value?.spatial?.bbox?.[0] ??
    value?.Spatial?.Bbox?.[0] ??
    value?.bbox?.[0] ??
    value?.Bbox?.[0] ??
    null;

  if (!Array.isArray(direct) || direct.length < 4) return null;

  const numbers = direct.slice(0, 4).map(Number);
  if (!numbers.every(Number.isFinite)) return null;

  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}

function normalizeCollection(row: any): CollectionRow | null {
  const collectionId = text(row?.collectionId ?? row?.CollectionId);
  if (!collectionId) return null;

  return {
    collectionId,
    title: text(row?.title ?? row?.Title),
    featureCount:
      finite(row?.featureCount ?? row?.FeatureCount) ?? 0,
    bbox: parseBbox(row?.extent ?? row?.Extent),
  };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/geo+json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `WorldCereal RDM HTTP ${response.status} hatası verdi.`,
      );
    }

    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function cacheKey(
  latitude: number,
  longitude: number,
  radiusKm: number,
) {
  return `${CACHE_PREFIX}${latitude.toFixed(3)}:${longitude.toFixed(3)}:${Math.round(radiusKm)}`;
}

function readCache(
  latitude: number,
  longitude: number,
  radiusKm: number,
): WorldCerealReferenceContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(
      cacheKey(latitude, longitude, radiusKm),
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: WorldCerealReferenceContext;
    };

    if (!parsed.savedAt || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;

    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(
  latitude: number,
  longitude: number,
  radiusKm: number,
  data: WorldCerealReferenceContext,
) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      cacheKey(latitude, longitude, radiusKm),
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    // Cache only optimizes network use.
  }
}

async function loadCollections() {
  const url = new URL(`${API_ROOT}/collections`);
  url.searchParams.set('MaxResultCount', '250');
  url.searchParams.set('SkipCount', '0');

  const payload = await fetchJson(url.toString());

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.Items)
        ? payload.Items
        : [];

  return rows
    .map(normalizeCollection)
    .filter((row: CollectionRow | null): row is CollectionRow => row !== null);
}

function addRepeatedBbox(
  params: URLSearchParams,
  bbox: [number, number, number, number],
) {
  bbox.forEach((value) => {
    params.append('Bbox', String(value));
  });
}

function normalizeSample(
  collection: CollectionRow,
  feature: any,
): WorldCerealReferenceSample | null {
  const properties = feature?.properties ?? feature?.Properties ?? {};

  const ewocCode = finite(
    properties?.ewoc_code ?? properties?.EwocCode,
  );

  const irrigationStatus = finite(
    properties?.irrigation_status ?? properties?.IrrigationStatus,
  );

  const sampleId = text(
    properties?.sample_id ?? properties?.SampleId ?? feature?.id,
  );

  if (
    !sampleId &&
    ewocCode === null &&
    irrigationStatus === null
  ) {
    return null;
  }

  return {
    collectionId: collection.collectionId,
    collectionTitle: collection.title,
    sampleId,
    ewocCode,
    irrigationStatus,
    validityDate: safeDate(
      properties?.valid_time ?? properties?.ValidityTime,
    ),
    imageryDate: safeDate(
      properties?.image_time ?? properties?.ImageryTime,
    ),
    landCoverQualityScore: finite(
      properties?.quality_score_lc ?? properties?.LandCoverQualityScore,
    ),
    cropTypeQualityScore: finite(
      properties?.quality_score_ct ?? properties?.CropTypeQualityScore,
    ),
    h3Index: text(
      properties?.h3_l3_cell ?? properties?.H3Index,
    ),
  };
}

async function loadCollectionSamples(
  collection: CollectionRow,
  bbox: [number, number, number, number],
) {
  const url = new URL(
    `${API_ROOT}/collections/${encodeURIComponent(collection.collectionId)}/items`,
  );

  addRepeatedBbox(url.searchParams, bbox);
  url.searchParams.set(
    'MaxResultCount',
    String(MAX_SAMPLES_PER_COLLECTION),
  );
  url.searchParams.set('SkipCount', '0');

  const payload = await fetchJson(url.toString());

  const features = Array.isArray(payload?.features)
    ? payload.features
    : Array.isArray(payload?.Features)
      ? payload.Features
      : [];

  return features
    .map((feature: any) => normalizeSample(collection, feature))
    .filter(
      (
        sample: WorldCerealReferenceSample | null,
      ): sample is WorldCerealReferenceSample => sample !== null,
    );
}

function summarizeNumber(
  values: Array<number | null>,
  key: string,
) {
  const counts = new Map<number, number>();

  values.forEach((value) => {
    if (value === null || !Number.isFinite(value)) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      [key]: value,
      count,
    }));
}

function unavailableResult(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  bbox: [number, number, number, number];
  status?: WorldCerealReferenceContext['status'];
  warning: string;
}): WorldCerealReferenceContext {
  return {
    status: input.status ?? 'unavailable',
    source: 'ESA WorldCereal RDM',
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    bbox: input.bbox,
    collectionsMatched: 0,
    collectionsQueried: 0,
    sampleCount: 0,
    samples: [],
    cropCodeSummary: [],
    irrigationCodeSummary: [],
    latestValidityDate: null,
    productCatalog: {
      globalMapYear: 2021,
      spatialResolutionMeters: 10,
      products: [
        'temporary crops',
        'active cropland',
        'active irrigation',
        'maize',
        'winter cereals',
        'spring cereals',
      ],
      pixelSamplingReady: false,
      note:
        'Bu servis WorldCereal RDM yakın saha referans örneklerini kullanır. 10 m 2021 sınıflandırma rasterının piksel örneklemesi ayrıca backend/GEE-COG erişim katmanı gerektirir.',
    },
    evidence: [],
    warnings: [input.warning],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchWorldCerealReferenceContext(
  latitude: number,
  longitude: number,
  options?: {
    radiusKm?: number;
    forceRefresh?: boolean;
  },
): Promise<WorldCerealReferenceContext> {
  const radiusKm = Math.max(
    5,
    Math.min(40, Number(options?.radiusKm ?? 15)),
  );

  const bbox = radiusBbox(latitude, longitude, radiusKm);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return unavailableResult({
      latitude,
      longitude,
      radiusKm,
      bbox,
      warning:
        'WorldCereal referans bağlamı için geçerli tarla koordinatı gerekli.',
    });
  }

  if (!options?.forceRefresh) {
    const cached = readCache(latitude, longitude, radiusKm);
    if (cached) return cached;
  }

  try {
    const collections = await loadCollections();

    const matched = collections
      .filter((collection) => {
        if (!collection.bbox || collection.featureCount <= 0) return false;
        return intersects(collection.bbox, bbox);
      })
      .sort((a, b) => b.featureCount - a.featureCount);

    if (!matched.length) {
      const result = unavailableResult({
        latitude,
        longitude,
        radiusKm,
        bbox,
        warning:
          'WorldCereal RDM kataloğunda bu çevreyle kesişen açık referans koleksiyonu bulunamadı.',
      });

      writeCache(latitude, longitude, radiusKm, result);
      return result;
    }

    const selected = matched.slice(0, MAX_COLLECTIONS);

    const settled = await Promise.allSettled(
      selected.map((collection) =>
        loadCollectionSamples(collection, bbox),
      ),
    );

    const samples = settled
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<WorldCerealReferenceSample[]> =>
          result.status === 'fulfilled',
      )
      .flatMap((result) => result.value)
      .slice(0, 40);

    const latestValidityDate = samples
      .map((sample) => sample.validityDate)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    const cropCodeSummary = summarizeNumber(
      samples.map((sample) => sample.ewocCode),
      'ewocCode',
    ) as WorldCerealReferenceContext['cropCodeSummary'];

    const irrigationCodeSummary = summarizeNumber(
      samples.map((sample) => sample.irrigationStatus),
      'irrigationStatus',
    ) as WorldCerealReferenceContext['irrigationCodeSummary'];

    const successfulCollectionCount = settled.filter(
      (result) => result.status === 'fulfilled',
    ).length;

    const status: WorldCerealReferenceContext['status'] =
      samples.length > 0
        ? successfulCollectionCount === selected.length
          ? 'ready'
          : 'partial'
        : 'unavailable';

    const result: WorldCerealReferenceContext = {
      status,
      source: 'ESA WorldCereal RDM',
      latitude,
      longitude,
      radiusKm,
      bbox,
      collectionsMatched: matched.length,
      collectionsQueried: selected.length,
      sampleCount: samples.length,
      samples,
      cropCodeSummary,
      irrigationCodeSummary,
      latestValidityDate,
      productCatalog: {
        globalMapYear: 2021,
        spatialResolutionMeters: 10,
        products: [
          'temporary crops',
          'active cropland',
          'active irrigation',
          'maize',
          'winter cereals',
          'spring cereals',
        ],
        pixelSamplingReady: false,
        note:
          'TarlaPusula şu aşamada WorldCereal RDM açık saha referanslarını kanıt olarak alır. 2021 küresel 10 m raster ürünleri ayrı piksel örnekleme katmanı olarak bağlanacaktır.',
      },
      evidence: [
        samples.length
          ? `WorldCereal RDM: tarla çevresinde ${samples.length} açık referans örneği bulundu.`
          : 'WorldCereal RDM: tarla çevresinde açık referans örneği bulunamadı.',
        cropCodeSummary.length
          ? `Yakın referanslarda ${cropCodeSummary.length} farklı EWOC ürün kodu var.`
          : '',
        irrigationCodeSummary.length
          ? `Yakın referanslarda ${irrigationCodeSummary.length} farklı sulama durum kodu var.`
          : '',
        latestValidityDate
          ? `En yeni referans geçerlilik tarihi: ${latestValidityDate}.`
          : '',
      ].filter(Boolean),
      warnings: [
        'WorldCereal RDM örnekleri saha referans verisidir; kullanıcının parselinin ürününü veya sulama durumunu doğrudan sınıflandırmaz.',
        'EWOC ve irrigation_status değerleri ham kod olarak korunur; güvenilir kod sözlüğü olmadan çiftçiye isimlendirilmez.',
        'WorldCereal 2021 10 m raster ürünleri tarihsel taban bağlamıdır; 2026 güncel tarla durumu yerine kullanılamaz.',
      ],
      generatedAt: new Date().toISOString(),
    };

    writeCache(latitude, longitude, radiusKm, result);
    return result;
  } catch (error) {
    const result = unavailableResult({
      latitude,
      longitude,
      radiusKm,
      bbox,
      status: 'error',
      warning:
        error instanceof Error
          ? error.message
          : 'WorldCereal RDM referans bağlamı alınamadı.',
    });

    return result;
  }
}

export function compactWorldCerealReference(
  context: WorldCerealReferenceContext | null | undefined,
) {
  if (!context) return null;

  return {
    status: context.status,
    source: context.source,
    radiusKm: context.radiusKm,
    sampleCount: context.sampleCount,
    cropCodeSummary: context.cropCodeSummary.slice(0, 5),
    irrigationCodeSummary: context.irrigationCodeSummary.slice(0, 5),
    latestValidityDate: context.latestValidityDate,
    evidence: context.evidence.slice(0, 4),
    warnings: context.warnings.slice(0, 3),
    globalMapBaseline: {
      year: context.productCatalog.globalMapYear,
      resolutionMeters: context.productCatalog.spatialResolutionMeters,
      pixelSamplingReady: context.productCatalog.pixelSamplingReady,
    },
    generatedAt: context.generatedAt,
  };
}
