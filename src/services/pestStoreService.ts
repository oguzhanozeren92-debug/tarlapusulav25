import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export type InventoryCategory = 'ilac' | 'gubre';
export type InventoryUnit = 'kg' | 'lt' | 'gr' | 'ml';
export type LabelCategory = 'pesticide' | 'fertilizer' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type LabelAnalysisSource = 'ai' | 'cache' | 'verified-local';

export type DosageRow = {
  crop: string;
  target: string;
  dosageLabel: string;
  dosagePer100L: string;
  applicationTiming: string;
  preHarvestIntervalDays: number | null;
};

export type BkuOfficialUse = {
  crop: string;
  target: string;
  dose: string;
  preHarvestIntervalDays: number | null;
  group: string | null;
  activeIngredients: string | null;
  formulation: string | null;
  sourceUrl: string | null;
};

export type BkuUsageSource =
  | 'official-bku'
  | 'grounded-label'
  | 'none';

export type BkuLookupResult = {
  status: 'exact' | 'probable' | 'not_found' | 'error';
  usageSource: BkuUsageSource;
  matchedProductName: string | null;
  matchedRegistrationNumber: string | null;
  matchedActiveIngredients: string | null;
  matchedFormulation: string | null;
  matchedGroup: string | null;
  uses: BkuOfficialUse[];
  sourceUrls: string[];
  checkedAt: string | null;
  note: string | null;
  diagnostics?: string[];
};


export type AiKnowledgeFallback = {
  status: 'available' | 'unavailable';
  summary: string | null;
  crops: string[];
  targets: string[];
  confidence: 'medium' | 'low';
  note: string;
};

export type UsageResolutionSource =
  | 'official-bku'
  | 'label-ocr'
  | 'verified-cache'
  | 'ai-knowledge'
  | 'identity-only';

export type ResolvedUsageRow = {
  crop: string;
  target: string;
  dose: string;
  preHarvestIntervalDays: number | null;
  sourceUrl: string | null;
};

export type ResolvedUsage = {
  source: UsageResolutionSource;
  originalSource?: 'official-bku' | 'label-ocr' | null;
  verified: boolean;
  summary: string | null;
  crops: string[];
  targets: string[];
  rows: ResolvedUsageRow[];
  doseAvailable: boolean;
  note: string | null;
  cachedAt?: string | null;
};

export type PesticideLabelAnalysis = {
  productName: string;
  category: LabelCategory;
  registrationNumber: string | null;
  activeIngredients: string | null;
  formulation: string | null;
  manufacturer: string | null;
  purpose: string | null;
  productType: string | null;
  supportedCrops: string[];
  targetOrganisms: string[];
  totalAmountFromLabel: number | null;
  unitFromLabel: InventoryUnit | null;
  dosageTable: DosageRow[];
  warnings: string | null;
  preHarvestIntervalDays: number | null;
  confidence: ConfidenceLevel;
  source?: LabelAnalysisSource;
  fallbackReason?: string | null;
  officialVerification?: boolean;
  bkuLookup?: BkuLookupResult | null;
  knowledgeFallback?: AiKnowledgeFallback | null;
  resolvedUsage?: ResolvedUsage | null;
};

export type InventoryProduct = {
  id: string;
  userId: string;
  productName: string;
  category: InventoryCategory;
  activeIngredients: string | null;
  registrationNumber: string | null;
  formulation: string | null;
  manufacturer: string | null;
  totalAmount: number;
  remainingAmount: number;
  unit: InventoryUnit;
  fieldIds: string[];
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryProductInput = Omit<
  InventoryProduct,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

const CACHE_PREFIX = 'tp_pest_store_products_v1_';
const LABEL_ANALYSIS_CACHE_PREFIX = 'tp_pest_label_analysis_v2_';
const LABEL_ANALYSIS_TIMEOUT_MS = 35_000;
const VERIFIED_USAGE_CACHE_PREFIX = 'tp_pest_verified_usage_v1_';
const VERIFIED_USAGE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type VerifiedUsageSnapshot = {
  identity: string;
  savedAt: string;
  originalSource: 'official-bku' | 'label-ocr';
  summary: string | null;
  crops: string[];
  targets: string[];
  rows: ResolvedUsageRow[];
};

function normalizeIdentityPart(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9%+./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usageIdentityFromAnalysis(
  analysis: Pick<
    PesticideLabelAnalysis,
    'productName' | 'activeIngredients' | 'formulation' | 'bkuLookup'
  >,
) {
  const productName =
    analysis.bkuLookup?.matchedProductName || analysis.productName;
  const activeIngredients =
    analysis.bkuLookup?.matchedActiveIngredients ||
    analysis.activeIngredients ||
    '';
  const formulation =
    analysis.bkuLookup?.matchedFormulation ||
    analysis.formulation ||
    '';

  const name = normalizeIdentityPart(productName);
  const active = normalizeIdentityPart(activeIngredients);
  const form = normalizeIdentityPart(formulation);

  // Başka ürünün verisini taşımamak için ürün adı + etken madde şart.
  if (!name || !active) return null;

  return `${name}|${active}|${form}`;
}

function usageCacheKey(identity: string) {
  return `${VERIFIED_USAGE_CACHE_PREFIX}${encodeURIComponent(identity)}`;
}

function loadVerifiedUsageSnapshot(
  analysis: PesticideLabelAnalysis,
): VerifiedUsageSnapshot | null {
  try {
    const identity = usageIdentityFromAnalysis(analysis);
    if (!identity) return null;

    const raw = window.localStorage.getItem(usageCacheKey(identity));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as VerifiedUsageSnapshot;

    if (!parsed || parsed.identity !== identity || !parsed.savedAt) {
      return null;
    }

    const age = Date.now() - new Date(parsed.savedAt).getTime();

    if (
      !Number.isFinite(age) ||
      age < 0 ||
      age > VERIFIED_USAGE_CACHE_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(usageCacheKey(identity));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveVerifiedUsageSnapshot(
  analysis: PesticideLabelAnalysis,
  resolved: ResolvedUsage,
) {
  if (
    resolved.source !== 'official-bku' &&
    resolved.source !== 'label-ocr'
  ) {
    return;
  }

  if (!resolved.rows.length && !resolved.crops.length) return;

  try {
    const identity = usageIdentityFromAnalysis(analysis);
    if (!identity) return;

    const snapshot: VerifiedUsageSnapshot = {
      identity,
      savedAt: new Date().toISOString(),
      originalSource: resolved.source,
      summary: resolved.summary,
      crops: resolved.crops,
      targets: resolved.targets,
      rows: resolved.rows,
    };

    window.localStorage.setItem(
      usageCacheKey(identity),
      JSON.stringify(snapshot),
    );
  } catch {
    // localStorage kapalıysa sessizce devam et.
  }
}

function normalizeKnowledgeFallback(raw: any): AiKnowledgeFallback | null {
  if (!raw || typeof raw !== 'object') return null;

  const crops = Array.isArray(raw.crops)
    ? raw.crops
        .map((item: any) => String(item ?? '').trim())
        .filter(Boolean)
    : [];

  const targets = Array.isArray(raw.targets)
    ? raw.targets
        .map((item: any) => String(item ?? '').trim())
        .filter(Boolean)
    : [];

  return {
    status: raw.status === 'available' ? 'available' : 'unavailable',
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : null,
    crops,
    targets,
    confidence: raw.confidence === 'medium' ? 'medium' : 'low',
    note:
      typeof raw.note === 'string' && raw.note.trim()
        ? raw.note.trim()
        : 'AI bilgi fallback durumu bilinmiyor.',
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean)),
  );
}

function resolveUsageData(
  analysis: PesticideLabelAnalysis,
): ResolvedUsage {
  const officialUses =
    analysis.bkuLookup?.usageSource === 'official-bku'
      ? analysis.bkuLookup.uses
      : [];

  if (officialUses.length) {
    return {
      source: 'official-bku',
      originalSource: 'official-bku',
      verified: true,
      summary:
        analysis.bkuLookup?.matchedGroup ||
        analysis.productType ||
        analysis.purpose ||
        null,
      crops: uniqueStrings(officialUses.map((row) => row.crop)),
      targets: uniqueStrings(officialUses.map((row) => row.target)),
      rows: officialUses.map((row) => ({
        crop: row.crop,
        target: row.target,
        dose: row.dose,
        preHarvestIntervalDays: row.preHarvestIntervalDays,
        sourceUrl: row.sourceUrl,
      })),
      doseAvailable: officialUses.some((row) => Boolean(row.dose)),
      note:
        analysis.bkuLookup?.note ||
        'Kullanım verisi resmî BKÜ kaydından alındı.',
    };
  }

  const labelRows = analysis.dosageTable.filter(
    (row) =>
      row.crop ||
      row.target ||
      row.dosageLabel ||
      row.dosagePer100L,
  );

  if (
    labelRows.length ||
    analysis.supportedCrops.length ||
    analysis.targetOrganisms.length
  ) {
    return {
      source: 'label-ocr',
      originalSource: 'label-ocr',
      verified: false,
      summary: analysis.productType || analysis.purpose || null,
      crops: uniqueStrings([
        ...analysis.supportedCrops,
        ...labelRows.map((row) => row.crop),
      ]),
      targets: uniqueStrings([
        ...analysis.targetOrganisms,
        ...labelRows.map((row) => row.target),
      ]),
      rows: labelRows.map((row) => ({
        crop: row.crop,
        target: row.target,
        dose: row.dosageLabel || row.dosagePer100L,
        preHarvestIntervalDays: row.preHarvestIntervalDays,
        sourceUrl: null,
      })),
      doseAvailable: labelRows.some(
        (row) => Boolean(row.dosageLabel || row.dosagePer100L),
      ),
      note:
        'BKÜ kullanım satırı bulunamadı; fotoğraftaki etiketten okunabilen bilgiler kullanılıyor.',
    };
  }

  const cached = loadVerifiedUsageSnapshot(analysis);

  if (cached) {
    return {
      source: 'verified-cache',
      originalSource: cached.originalSource,
      verified: cached.originalSource === 'official-bku',
      summary: cached.summary,
      crops: cached.crops,
      targets: cached.targets,
      rows: cached.rows,
      doseAvailable: cached.rows.some((row) => Boolean(row.dose)),
      note:
        cached.originalSource === 'official-bku'
          ? 'Canlı BKÜ bu sefer kullanım satırı döndürmedi; aynı ürün için daha önce alınmış resmî BKÜ kaydı kullanılıyor.'
          : 'Canlı BKÜ bu sefer kullanım satırı döndürmedi; aynı ürün için daha önce okunmuş etiket kaydı kullanılıyor.',
      cachedAt: cached.savedAt,
    };
  }

  const knowledge = analysis.knowledgeFallback;

  if (
    knowledge?.status === 'available' &&
    (knowledge.summary ||
      knowledge.crops.length ||
      knowledge.targets.length)
  ) {
    return {
      source: 'ai-knowledge',
      originalSource: null,
      verified: false,
      summary:
        knowledge.summary ||
        analysis.productType ||
        analysis.purpose ||
        null,
      crops: knowledge.crops,
      targets: knowledge.targets,
      rows: [],
      doseAvailable: false,
      note: knowledge.note,
    };
  }

  return {
    source: 'identity-only',
    originalSource: null,
    verified: false,
    summary:
      analysis.bkuLookup?.matchedGroup ||
      analysis.productType ||
      analysis.purpose ||
      null,
    crops: [],
    targets: [],
    rows: [],
    doseAvailable: false,
    note:
      analysis.bkuLookup?.note ||
      'Ürün kimliği okunabildi fakat kullanım alanı için yeterli kaynak bulunamadı.',
  };
}

function finalizeAnalysis(
  analysis: PesticideLabelAnalysis,
): PesticideLabelAnalysis {
  const resolvedUsage = resolveUsageData(analysis);

  if (
    resolvedUsage.source === 'official-bku' ||
    resolvedUsage.source === 'label-ocr'
  ) {
    saveVerifiedUsageSnapshot(analysis, resolvedUsage);
  }

  return {
    ...analysis,
    resolvedUsage,
  };
}


/**
 * Güvenli yerel fallback kataloğu.
 *
 * Buraya SADECE doğrulanmış bir etiket fotoğrafının SHA-256 hash'i ile,
 * o fotoğraftan/resmî kaynaktan doğrulanmış veri eklenmelidir.
 * Bilerek boş bırakılmıştır; ürün/doz uydurulmaz.
 */
const VERIFIED_LOCAL_LABELS: Record<string, PesticideLabelAnalysis> = {};

async function fileSha256(file: File): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buffer = await file.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

function loadCachedLabelAnalysis(hash: string): PesticideLabelAnalysis | null {
  try {
    const raw = window.localStorage.getItem(
      `${LABEL_ANALYSIS_CACHE_PREFIX}${hash}`,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return normalizeAnalysis(parsed);
  } catch {
    return null;
  }
}

function saveCachedLabelAnalysis(
  hash: string,
  analysis: PesticideLabelAnalysis,
) {
  try {
    window.localStorage.setItem(
      `${LABEL_ANALYSIS_CACHE_PREFIX}${hash}`,
      JSON.stringify({
        ...analysis,
        source: 'ai',
        fallbackReason: null,
        officialVerification: false,
      }),
    );
  } catch {
    // localStorage kapalıysa yalnızca canlı AI sonucu kullanılır.
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function friendlyAnalyzeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? '');

  const normalized = message.toLocaleLowerCase('tr-TR');

  if (normalized.includes('zaman aş')) {
    return 'Etiket AI servisi zaman aşımına uğradı.';
  }

  if (
    normalized.includes('gemini_api_key') ||
    normalized.includes('api key') ||
    normalized.includes('yapılandırılmamış')
  ) {
    return 'Etiket AI servisi yapılandırılmamış. Supabase Edge Function secret ayarlarında GEMINI_API_KEY kontrol edilmeli.';
  }

  if (
    normalized.includes('401') ||
    normalized.includes('oturum') ||
    normalized.includes('jwt')
  ) {
    return 'Etiket analizi için oturum doğrulanamadı. Çıkış yapıp tekrar giriş yapmayı dene.';
  }

  if (
    normalized.includes('429') ||
    normalized.includes('quota') ||
    normalized.includes('rate')
  ) {
    return 'AI servis kotası/geçici yoğunluk nedeniyle yanıt vermedi.';
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('cors')
  ) {
    return 'Etiket AI servisine ağ bağlantısı kurulamadı.';
  }

  return message || 'Etiket analiz servisi çalıştırılamadı.';
}

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

export function loadInventoryCache(userId: string): InventoryProduct[] {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInventoryCache(
  userId: string,
  products: InventoryProduct[],
) {
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(products));
  } catch {
    // localStorage kapalıysa Supabase ana kaynak olarak devam eder.
  }
}

export async function resolveInventoryUser(
  explicitUser?: User | null,
): Promise<User> {
  if (explicitUser) return explicitUser;
  if (!supabase) throw new Error('Supabase bağlantısı hazır değil.');

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('Depoyu kullanmak için giriş yapmalısın.');

  return user;
}

function rowToProduct(row: any): InventoryProduct {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    productName: row.product_name ?? 'İsimsiz ürün',
    category: row.category === 'gubre' ? 'gubre' : 'ilac',
    activeIngredients: row.active_ingredients ?? null,
    registrationNumber: row.registration_number ?? null,
    formulation: row.formulation ?? null,
    manufacturer: row.manufacturer ?? null,
    totalAmount: Number(row.total_amount ?? 0),
    remainingAmount: Number(row.remaining_amount ?? 0),
    unit: (row.unit ?? 'kg') as InventoryUnit,
    fieldIds: Array.isArray(row.field_ids)
      ? row.field_ids.map((item: unknown) => String(item))
      : [],
    photoUrl: row.photo_url ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function productToRow(userId: string, input: InventoryProductInput) {
  return {
    user_id: userId,
    product_name: input.productName,
    category: input.category,
    active_ingredients: input.activeIngredients,
    registration_number: input.registrationNumber,
    formulation: input.formulation,
    manufacturer: input.manufacturer,
    total_amount: input.totalAmount,
    remaining_amount: input.remainingAmount,
    unit: input.unit,
    field_ids: input.fieldIds,
    photo_url: input.photoUrl,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchInventoryProducts(
  userId: string,
): Promise<InventoryProduct[]> {
  if (!supabase) return loadInventoryCache(userId);

  const { data, error } = await supabase
    .from('farm_inventory_products')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const products = (data ?? []).map(rowToProduct);
  saveInventoryCache(userId, products);
  return products;
}

export async function createInventoryProduct(
  userId: string,
  input: InventoryProductInput,
): Promise<InventoryProduct> {
  if (!supabase) {
    const now = new Date().toISOString();
    return {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}`,
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
  }

  const { data, error } = await supabase
    .from('farm_inventory_products')
    .insert(productToRow(userId, input))
    .select('*')
    .single();

  if (error) throw error;
  return rowToProduct(data);
}

export async function updateInventoryProduct(
  userId: string,
  id: string,
  input: InventoryProductInput,
): Promise<InventoryProduct> {
  if (!supabase) {
    const now = new Date().toISOString();
    return {
      id,
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
  }

  const { data, error } = await supabase
    .from('farm_inventory_products')
    .update(productToRow(userId, input))
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return rowToProduct(data);
}

export async function removeInventoryProduct(
  userId: string,
  id: string,
) {
  if (!supabase) return;

  const { error } = await supabase
    .from('farm_inventory_products')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function uploadPesticideLabelPhoto(
  userId: string,
  file: File,
): Promise<string> {
  if (!supabase) return '';

  const extension =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    'jpg';
  const path = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from('pesticide-labels')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;
  return path;
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };

    reader.onerror = () =>
      reject(new Error('Etiket fotoğrafı okunamadı.'));

    reader.readAsDataURL(file);
  });
}

async function readInvokeError(error: any): Promise<string> {
  try {
    const response = error?.context;

    if (response && typeof response.clone === 'function') {
      const clone = response.clone();

      try {
        const body = await clone.json();
        const message =
          body?.userMessage ??
          body?.error ??
          body?.message ??
          body?.details;

        if (message) return String(message);
      } catch {
        try {
          const text = await clone.text();
          if (text?.trim()) return text.trim();
        } catch {
          // body okunamadı
        }
      }
    }
  } catch {
    // generic mesaja düş
  }

  return error?.message || 'Etiket analiz servisi çalıştırılamadı.';
}

function normalizeBkuLookup(raw: any): BkuLookupResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const validStatus = new Set(['exact', 'probable', 'not_found', 'error']);
  const status = validStatus.has(raw.status) ? raw.status : 'not_found';
  const validUsageSources = new Set([
    'official-bku',
    'grounded-label',
    'none',
  ]);
  const usageSource = validUsageSources.has(raw.usageSource)
    ? raw.usageSource
    : 'none';

  const uses: BkuOfficialUse[] = Array.isArray(raw.uses)
    ? raw.uses
        .map((item: any) => ({
          crop: String(item?.crop ?? '').trim(),
          target: String(item?.target ?? '').trim(),
          dose: String(item?.dose ?? '').trim(),
          preHarvestIntervalDays:
            Number.isFinite(Number(item?.preHarvestIntervalDays)) &&
            Number(item?.preHarvestIntervalDays) >= 0
              ? Number(item.preHarvestIntervalDays)
              : null,
          group:
            typeof item?.group === 'string' && item.group.trim()
              ? item.group.trim()
              : null,
          activeIngredients:
            typeof item?.activeIngredients === 'string' &&
            item.activeIngredients.trim()
              ? item.activeIngredients.trim()
              : null,
          formulation:
            typeof item?.formulation === 'string' && item.formulation.trim()
              ? item.formulation.trim()
              : null,
          sourceUrl:
            typeof item?.sourceUrl === 'string' && item.sourceUrl.trim()
              ? item.sourceUrl.trim()
              : null,
        }))
        .filter(
          (item: BkuOfficialUse) =>
            item.crop || item.target || item.dose || item.sourceUrl,
        )
    : [];

  const sourceUrls = Array.isArray(raw.sourceUrls)
    ? raw.sourceUrls
        .map((item: any) => String(item ?? '').trim())
        .filter((url: string) => /^https:\/\/bku\.tarimorman\.gov\.tr\//i.test(url))
    : [];

  return {
    status,
    usageSource,
    matchedProductName:
      typeof raw.matchedProductName === 'string' &&
      raw.matchedProductName.trim()
        ? raw.matchedProductName.trim()
        : null,
    matchedRegistrationNumber:
      typeof raw.matchedRegistrationNumber === 'string' &&
      raw.matchedRegistrationNumber.trim()
        ? raw.matchedRegistrationNumber.trim()
        : null,
    matchedActiveIngredients:
      typeof raw.matchedActiveIngredients === 'string' &&
      raw.matchedActiveIngredients.trim()
        ? raw.matchedActiveIngredients.trim()
        : null,
    matchedFormulation:
      typeof raw.matchedFormulation === 'string' &&
      raw.matchedFormulation.trim()
        ? raw.matchedFormulation.trim()
        : null,
    matchedGroup:
      typeof raw.matchedGroup === 'string' && raw.matchedGroup.trim()
        ? raw.matchedGroup.trim()
        : null,
    uses,
    sourceUrls,
    checkedAt:
      typeof raw.checkedAt === 'string' && raw.checkedAt.trim()
        ? raw.checkedAt.trim()
        : null,
    note:
      typeof raw.note === 'string' && raw.note.trim()
        ? raw.note.trim()
        : null,
    diagnostics: Array.isArray(raw.diagnostics)
      ? raw.diagnostics
          .map((item: any) => String(item ?? '').trim())
          .filter(Boolean)
      : [],
  };
}

function normalizeAnalysis(raw: any): PesticideLabelAnalysis {
  const dosageTable = Array.isArray(raw?.dosageTable)
    ? raw.dosageTable
        .map((item: any) => ({
          crop: String(item?.crop ?? '').trim(),
          target: String(item?.target ?? '').trim(),
          dosageLabel: String(
            item?.dosageLabel ?? item?.dosage ?? item?.dosagePer100L ?? '',
          ).trim(),
          dosagePer100L: String(item?.dosagePer100L ?? '').trim(),
          applicationTiming: String(item?.applicationTiming ?? '').trim(),
          preHarvestIntervalDays:
            Number.isFinite(Number(item?.preHarvestIntervalDays)) &&
            Number(item?.preHarvestIntervalDays) >= 0
              ? Number(item.preHarvestIntervalDays)
              : null,
        }))
        .filter(
          (item: DosageRow) =>
            item.crop ||
            item.target ||
            item.dosageLabel ||
            item.dosagePer100L ||
            item.applicationTiming,
        )
    : [];

  const numericAmount = Number(raw?.totalAmountFromLabel);

  const validUnits = new Set(['kg', 'lt', 'gr', 'ml']);
  const unitFromLabel = validUnits.has(raw?.unitFromLabel)
    ? (raw.unitFromLabel as InventoryUnit)
    : null;

  const validCategories = new Set([
    'pesticide',
    'fertilizer',
    'unknown',
  ]);

  const validConfidence = new Set(['high', 'medium', 'low']);

  return {
    productName:
      typeof raw?.productName === 'string' && raw.productName.trim()
        ? raw.productName.trim()
        : 'Etiketten ürün adı okunamadı',
    category: validCategories.has(raw?.category)
      ? raw.category
      : 'unknown',
    registrationNumber:
      typeof raw?.registrationNumber === 'string' &&
      raw.registrationNumber.trim()
        ? raw.registrationNumber.trim()
        : null,
    activeIngredients:
      typeof raw?.activeIngredients === 'string' &&
      raw.activeIngredients.trim()
        ? raw.activeIngredients.trim()
        : null,
    formulation:
      typeof raw?.formulation === 'string' && raw.formulation.trim()
        ? raw.formulation.trim()
        : null,
    manufacturer:
      typeof raw?.manufacturer === 'string' && raw.manufacturer.trim()
        ? raw.manufacturer.trim()
        : null,
    purpose:
      typeof raw?.purpose === 'string' && raw.purpose.trim()
        ? raw.purpose.trim()
        : null,
    productType:
      typeof raw?.productType === 'string' && raw.productType.trim()
        ? raw.productType.trim()
        : null,
    supportedCrops: Array.isArray(raw?.supportedCrops)
      ? raw.supportedCrops
          .map((item: any) => String(item ?? '').trim())
          .filter(Boolean)
      : Array.from(
          new Set(
            dosageTable
              .map((item) => item.crop)
              .filter(Boolean),
          ),
        ),
    targetOrganisms: Array.isArray(raw?.targetOrganisms)
      ? raw.targetOrganisms
          .map((item: any) => String(item ?? '').trim())
          .filter(Boolean)
      : Array.from(
          new Set(
            dosageTable
              .map((item) => item.target)
              .filter(Boolean),
          ),
        ),
    totalAmountFromLabel:
      Number.isFinite(numericAmount) && numericAmount > 0
        ? numericAmount
        : null,
    unitFromLabel,
    dosageTable,
    warnings:
      typeof raw?.warnings === 'string' && raw.warnings.trim()
        ? raw.warnings.trim()
        : null,
    preHarvestIntervalDays:
      Number.isFinite(Number(raw?.preHarvestIntervalDays)) &&
      Number(raw?.preHarvestIntervalDays) >= 0
        ? Number(raw.preHarvestIntervalDays)
        : null,
    confidence: validConfidence.has(raw?.confidence)
      ? raw.confidence
      : 'low',
    source:
      raw?.source === 'cache' || raw?.source === 'verified-local'
        ? raw.source
        : 'ai',
    fallbackReason:
      typeof raw?.fallbackReason === 'string' && raw.fallbackReason.trim()
        ? raw.fallbackReason.trim()
        : null,
    officialVerification: raw?.officialVerification === true,
    bkuLookup: normalizeBkuLookup(raw?.bkuLookup),
    knowledgeFallback: normalizeKnowledgeFallback(
      raw?.knowledgeFallback,
    ),
    resolvedUsage: null,
  };
}

export async function analyzePesticideLabel(
  file: File,
): Promise<PesticideLabelAnalysis> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  if (!allowedTypes.has(file.type || 'image/jpeg')) {
    throw new Error('Etiket için JPG, PNG veya WEBP görsel kullan.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      'Etiket fotoğrafı çok büyük. 10 MB altında bir görsel kullan.',
    );
  }

  const fileHash = await fileSha256(file);

  try {
    if (!supabase) {
      throw new Error('AI analizi için Supabase bağlantısı gerekli.');
    }

    const imageBase64 = await fileToBase64(file);

    const invokePromise = supabase.functions.invoke(
      'analyze-pesticide-label',
      {
        body: {
          imageBase64,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        },
      },
    );

    const { data, error } = await withTimeout(
      invokePromise,
      LABEL_ANALYSIS_TIMEOUT_MS,
      'Etiket AI servisi zaman aşımına uğradı.',
    );

    if (error) {
      throw new Error(await readInvokeError(error));
    }

    if (!data) {
      throw new Error('Etiket analiz servisinden sonuç alınamadı.');
    }

    if (data.error) {
      throw new Error(
        String(
          data.userMessage ??
            data.error ??
            'Etiket analizi başarısız.',
        ),
      );
    }

    const analysis = finalizeAnalysis(
      normalizeAnalysis({
        ...(data.analysis ?? data),
        source: 'ai',
        fallbackReason: null,
        officialVerification: data.officialVerification === true,
      }),
    );

    if (fileHash) {
      saveCachedLabelAnalysis(fileHash, analysis);
    }

    return analysis;
  } catch (error) {
    const reason = friendlyAnalyzeError(error);

    if (fileHash) {
      const verified = VERIFIED_LOCAL_LABELS[fileHash];

      if (verified) {
        return finalizeAnalysis(
          normalizeAnalysis({
            ...verified,
            source: 'verified-local',
            fallbackReason: reason,
            officialVerification: true,
          }),
        );
      }

      const cached = loadCachedLabelAnalysis(fileHash);

      if (cached) {
        return finalizeAnalysis(
          normalizeAnalysis({
            ...cached,
            source: 'cache',
            fallbackReason: reason,
            officialVerification: false,
          }),
        );
      }
    }

    throw new Error(
      `${reason} Aynı fotoğraf için doğrulanmış yerel kayıt bulunamadı; güvenlik nedeniyle etken madde, ruhsat veya doz bilgisi uydurulmadı.`,
    );
  }
}
