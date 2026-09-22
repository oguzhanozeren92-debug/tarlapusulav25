import { supabase } from '../../../supabaseClient';

const FIELD_MAP_BUCKET = 'field-map-layers';
const STORAGE_MARKER = '__tp_field_map_storage_path';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredAssetMarker = {
  [STORAGE_MARKER]: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStoredAssetMarker(value: unknown): value is StoredAssetMarker {
  return (
    isRecord(value) &&
    typeof value[STORAGE_MARKER] === 'string' &&
    Boolean(String(value[STORAGE_MARKER]).trim())
  );
}

function safeSegment(value: string, fallback = 'item') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function imageExtension(type: string) {
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  return 'png';
}

function isPersistableImageUrl(value: string) {
  return value.startsWith('data:image/') || value.startsWith('blob:');
}

async function currentUserId() {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function uploadImageValue(
  userId: string,
  fieldId: string,
  namespace: string,
  cacheKey: string,
  slot: string,
  value: string,
): Promise<StoredAssetMarker | string> {
  if (!supabase || !isPersistableImageUrl(value)) return value;

  try {
    const response = await fetch(value);
    if (!response.ok) return value;

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return value;

    const path = [
      userId,
      fieldId,
      safeSegment(namespace, 'layer'),
      hashString(cacheKey),
      `${safeSegment(slot, 'image')}-${hashString(value)}.${imageExtension(blob.type)}`,
    ].join('/');

    const { error } = await supabase.storage
      .from(FIELD_MAP_BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || 'image/png',
        cacheControl: '3600',
      });

    if (error) {
      console.warn('Harita katmanı görseli buluta yazılamadı:', error.message);
      return value;
    }

    return { [STORAGE_MARKER]: path };
  } catch (error) {
    console.warn('Harita katmanı görseli hazırlanamadı:', error);
    return value;
  }
}

async function serializeForCloud(
  value: unknown,
  context: {
    userId: string;
    fieldId: string;
    namespace: string;
    cacheKey: string;
  },
  slot = 'root',
  depth = 0,
): Promise<unknown> {
  if (depth > 8 || value == null) return value;

  if (typeof value === 'string') {
    return uploadImageValue(
      context.userId,
      context.fieldId,
      context.namespace,
      context.cacheKey,
      slot,
      value,
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        serializeForCloud(item, context, `${slot}-${index}`, depth + 1),
      ),
    );
  }

  if (isRecord(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [
        key,
        await serializeForCloud(
          item,
          context,
          `${slot}-${key}`,
          depth + 1,
        ),
      ] as const),
    );

    return Object.fromEntries(entries);
  }

  return null;
}

async function resolveFromCloud(
  value: unknown,
  signedUrlSeconds: number,
  depth = 0,
): Promise<unknown> {
  if (depth > 8 || value == null || !supabase) return value;

  if (isStoredAssetMarker(value)) {
    const path = String(value[STORAGE_MARKER]);
    const { data, error } = await supabase.storage
      .from(FIELD_MAP_BUCKET)
      .createSignedUrl(path, signedUrlSeconds);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) =>
        resolveFromCloud(item, signedUrlSeconds, depth + 1),
      ),
    );
  }

  if (isRecord(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [
        key,
        await resolveFromCloud(item, signedUrlSeconds, depth + 1),
      ] as const),
    );

    return Object.fromEntries(entries);
  }

  return value;
}

export function fieldIdFromMapCacheKey(cacheKey: string) {
  const candidate = String(cacheKey ?? '').split(':')[0] ?? '';
  return UUID_RE.test(candidate) ? candidate : null;
}

export async function readFieldMapLayerCache<T>(
  fieldId: string,
  namespace: string,
  cacheKey: string,
  ttlMs: number,
  options: { allowExpired?: boolean } = {},
): Promise<T | null> {
  if (!supabase || !UUID_RE.test(fieldId)) return null;

  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('field_map_layer_cache')
    .select('payload, expires_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .eq('namespace', namespace)
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error || !data) return null;

  const expiresAt = new Date(String(data.expires_at ?? '')).getTime();
  // Expiry controls refresh, never destruction of the last successful result.
  if ((!Number.isFinite(expiresAt) || expiresAt <= Date.now()) && !options.allowExpired) {
    return null;
  }

  const signedUrlSeconds = Math.max(
    60 * 60,
    Math.ceil(ttlMs / 1000) + 60 * 60,
  );

  const resolved = await resolveFromCloud(
    data.payload,
    signedUrlSeconds,
  );

  return (resolved ?? null) as T | null;
}

export async function writeFieldMapLayerCache<T>(
  fieldId: string,
  namespace: string,
  cacheKey: string,
  data: T,
  ttlMs: number,
  requirePersistence = false,
): Promise<void> {
  if (!supabase || !UUID_RE.test(fieldId)) {
    if (requirePersistence) throw new Error('Uydu kaydı için geçerli tarla ve bağlantı gerekli.');
    return;
  }

  const userId = await currentUserId();
  if (!userId) {
    if (requirePersistence) throw new Error('Uydu kaydı için oturum gerekli.');
    return;
  }

  const payload = await serializeForCloud(data, {
    userId,
    fieldId,
    namespace,
    cacheKey,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const { error } = await supabase
    .from('field_map_layer_cache')
    .upsert(
      {
        user_id: userId,
        field_id: fieldId,
        namespace,
        cache_key: cacheKey,
        payload,
        saved_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        onConflict: 'user_id,field_id,namespace,cache_key',
      },
    );

  if (error) {
    console.warn('Harita katmanı bulut cache kaydı başarısız:', error.message);
    if (requirePersistence) throw error;
  }
}
