import { supabase } from '../../../supabaseClient';
import type { PhenologyResult } from '../types/phenology';

export type CopernicusHrvppMetricProduct = {
  metric: string;
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

export type CopernicusHrvppCatalogYear = {
  year: number;
  season: 1;
  tileId: string | null;
  productVersion: string | null;
  resolutionM: number | null;
  availableMetricCount: number;
  availableMetrics: string[];
  products: Record<string, CopernicusHrvppMetricProduct>;
};

export type CopernicusHrvppYear = {
  year: number;
  season: 1;
  startOfSeasonDay: number | null;
  startOfSeasonDate: string | null;
  endOfSeasonDay: number | null;
  endOfSeasonDate: string | null;
  maximumDay: number | null;
  maximumDate: string | null;
  seasonLengthDays: number | null;
  seasonalProductivity: number | null;
  availableMetricCount: number;
};

export type CopernicusHrvppComparison = {
  latestYear: number;
  previousYear: number;
  startShiftDays: number | null;
  endShiftDays: number | null;
  seasonLengthChangeDays: number | null;
  seasonalProductivityChangePct: number | null;
};

export type CopernicusHrvppEvidence = {
  ok: boolean;
  status: 'ready' | 'catalog_ready' | 'unavailable';
  source: string;
  provider?: string | null;
  field_id: string;
  crop?: string | null;
  production_authority: false;
  diagnostic_authority?: false;
  confidence_authority?: false;
  input_authority?: 'server-derived';
  location_source?: string | null;
  coverage_verified?: boolean;
  sampling_mode?: string | null;
  resolution_m?: number | null;
  product_scope?: string | null;
  latest_catalog_year?: number | null;
  checked_years?: number[];
  catalog_collection?: string | null;
  latest?: CopernicusHrvppYear | CopernicusHrvppCatalogYear | null;
  previous?: CopernicusHrvppYear | CopernicusHrvppCatalogYear | null;
  history: Array<CopernicusHrvppYear | CopernicusHrvppCatalogYear>;
  comparison: CopernicusHrvppComparison | null;
  raw_sampling?: {
    status?: string | null;
    numeric_metrics_verified?: boolean;
    required_for?: string[];
    reason?: string | null;
  } | null;
  wms_validation?: {
    reachable?: boolean;
    statusCode?: number | null;
    version?: string | null;
    crs?: string | null;
    time?: string | null;
    layer?: string | null;
  } | null;
  warnings: string[];
  generated_at?: string | null;
  reason?: string | null;
};

type CacheRow = {
  expiresAt: number;
  value: CopernicusHrvppEvidence;
};

const CACHE_PREFIX = 'tp_copernicus_hrvpp_v2:';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const memoryCache = new Map<string, CacheRow>();

function cacheKey(fieldId: string) {
  return `${CACHE_PREFIX}${fieldId}`;
}

function validCached(row: CacheRow | null | undefined) {
  return Boolean(row && row.expiresAt > Date.now() && row.value);
}

function readLocal(fieldId: string): CacheRow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(fieldId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRow;
    if (!validCached(parsed)) {
      window.localStorage.removeItem(cacheKey(fieldId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(fieldId: string, value: CopernicusHrvppEvidence) {
  const row: CacheRow = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  };
  memoryCache.set(fieldId, row);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(cacheKey(fieldId), JSON.stringify(row));
    } catch {
      // localStorage is best-effort only.
    }
  }
}

function normalizeEvidence(value: unknown, fieldId: string): CopernicusHrvppEvidence {
  const raw = value as any;
  const status =
    raw?.status === 'ready'
      ? 'ready'
      : raw?.status === 'catalog_ready'
        ? 'catalog_ready'
        : 'unavailable';
  const history = Array.isArray(raw?.history) ? raw.history : [];

  return {
    ok: raw?.ok !== false,
    status,
    source: String(raw?.source ?? 'Copernicus Land Monitoring Service HR-VPP'),
    provider: raw?.provider ? String(raw.provider) : null,
    field_id: String(raw?.field_id ?? fieldId),
    crop: raw?.crop ? String(raw.crop) : null,
    production_authority: false,
    diagnostic_authority: false,
    confidence_authority: false,
    input_authority: raw?.input_authority === 'server-derived' ? 'server-derived' : undefined,
    location_source: raw?.location_source ? String(raw.location_source) : null,
    coverage_verified: raw?.coverage_verified === true,
    sampling_mode: raw?.sampling_mode ? String(raw.sampling_mode) : null,
    resolution_m: Number.isFinite(Number(raw?.resolution_m)) ? Number(raw.resolution_m) : null,
    product_scope: raw?.product_scope ? String(raw.product_scope) : null,
    latest_catalog_year: Number.isFinite(Number(raw?.latest_catalog_year))
      ? Number(raw.latest_catalog_year)
      : null,
    checked_years: Array.isArray(raw?.checked_years)
      ? raw.checked_years.map(Number).filter(Number.isFinite)
      : [],
    catalog_collection: raw?.catalog_collection ? String(raw.catalog_collection) : null,
    latest: raw?.latest ?? history[0] ?? null,
    previous: raw?.previous ?? history[1] ?? null,
    history,
    comparison: status === 'ready' ? raw?.comparison ?? null : null,
    raw_sampling: raw?.raw_sampling ?? null,
    wms_validation: raw?.wms_validation ?? null,
    warnings: Array.isArray(raw?.warnings)
      ? raw.warnings.filter((item: unknown) => typeof item === 'string')
      : [],
    generated_at: raw?.generated_at ? String(raw.generated_at) : null,
    reason: raw?.reason ? String(raw.reason) : null,
  };
}

export async function fetchCopernicusHrvppEvidence(
  fieldId: string,
  options?: { force?: boolean },
): Promise<CopernicusHrvppEvidence> {
  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) {
    throw new Error('Copernicus HR-VPP için tarla kimliği gerekli.');
  }

  if (!options?.force) {
    const memory = memoryCache.get(normalizedFieldId);
    if (validCached(memory)) return memory!.value;

    const local = readLocal(normalizedFieldId);
    if (validCached(local)) {
      memoryCache.set(normalizedFieldId, local!);
      return local!.value;
    }
  }

  const { data, error } = await supabase.functions.invoke('copernicus-hrvpp-evidence', {
    body: { field_id: normalizedFieldId },
  });

  if (error) throw error;
  if (data?.ok === false) {
    throw new Error(data?.error ?? 'Copernicus HR-VPP kanıtı alınamadı.');
  }

  const normalized = normalizeEvidence(data, normalizedFieldId);
  writeCache(normalizedFieldId, normalized);
  return normalized;
}

export function clearCopernicusHrvppCache(fieldId?: string) {
  if (fieldId) {
    const normalizedFieldId = String(fieldId).trim();
    memoryCache.delete(normalizedFieldId);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(cacheKey(normalizedFieldId));
        window.localStorage.removeItem(`tp_copernicus_hrvpp_v1:${normalizedFieldId}`);
      } catch {
        // no-op
      }
    }
    return;
  }

  memoryCache.clear();
  if (typeof window !== 'undefined') {
    try {
      const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      ).filter(
        (key): key is string =>
          Boolean(
            key?.startsWith(CACHE_PREFIX) ||
              key?.startsWith('tp_copernicus_hrvpp_v1:'),
          ),
      );
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // no-op
    }
  }
}

function isVerifiedRawYear(
  value: CopernicusHrvppYear | CopernicusHrvppCatalogYear | null | undefined,
): value is CopernicusHrvppYear {
  return Boolean(
    value &&
      'startOfSeasonDay' in value &&
      'endOfSeasonDay' in value &&
      'seasonalProductivity' in value,
  );
}

function signedDay(value: number | null, earlier: string, later: string) {
  if (value === null || !Number.isFinite(value) || value === 0) return null;
  const amount = Math.abs(Math.round(value));
  return `${amount} gün ${value < 0 ? earlier : later}`;
}

export function fusePhenologyWithCopernicusHrvpp(
  phenology: PhenologyResult,
  evidence: CopernicusHrvppEvidence | null,
): PhenologyResult {
  // Catalogue coverage is useful source-health evidence, but it is not a numeric
  // phenology observation. Only a future verified raw pixel/zonal sample may
  // enter the phenology basis below.
  if (
    !evidence ||
    evidence.status !== 'ready' ||
    evidence.raw_sampling?.numeric_metrics_verified !== true ||
    !isVerifiedRawYear(evidence.latest)
  ) {
    return phenology;
  }

  const latest = evidence.latest;
  const previous = isVerifiedRawYear(evidence.previous) ? evidence.previous : null;
  const basis = [...phenology.basis];
  const warnings = [...phenology.warnings];

  const latestBits = [
    latest.startOfSeasonDate ? `başlangıç ${latest.startOfSeasonDate}` : null,
    latest.maximumDate ? `tepe ${latest.maximumDate}` : null,
    latest.endOfSeasonDate ? `bitiş ${latest.endOfSeasonDate}` : null,
    latest.seasonLengthDays != null ? `uzunluk ${Math.round(latest.seasonLengthDays)} gün` : null,
  ].filter(Boolean);

  if (latestBits.length) {
    basis.push(`Copernicus HR-VPP ${latest.year} Season 1 (10 m): ${latestBits.join(', ')}.`);
  }

  if (previous && evidence.comparison) {
    const startShift = signedDay(evidence.comparison.startShiftDays, 'daha erken', 'daha geç');
    const endShift = signedDay(evidence.comparison.endShiftDays, 'daha erken', 'daha geç');
    const comparisonBits = [
      startShift ? `sezon başlangıcı ${startShift}` : null,
      endShift ? `sezon sonu ${endShift}` : null,
      evidence.comparison.seasonLengthChangeDays != null && evidence.comparison.seasonLengthChangeDays !== 0
        ? `sezon uzunluğu ${Math.abs(evidence.comparison.seasonLengthChangeDays)} gün ${
            evidence.comparison.seasonLengthChangeDays > 0 ? 'uzun' : 'kısa'
          }`
        : null,
      evidence.comparison.seasonalProductivityChangePct != null
        ? `mevsimsel üretkenlik farkı %${evidence.comparison.seasonalProductivityChangePct}`
        : null,
    ].filter(Boolean);

    if (comparisonBits.length) {
      basis.push(`HR-VPP ${latest.year}/${previous.year} karşılaştırması: ${comparisonBits.join(', ')}.`);
    }
  }

  warnings.push(
    'Copernicus HR-VPP tamamlanmış yılların uydu fenolojisidir; bugünkü ürün evresini tek başına değiştirmez.',
  );

  return {
    ...phenology,
    basis: Array.from(new Set(basis)),
    warnings: Array.from(new Set(warnings)),
  };
}
