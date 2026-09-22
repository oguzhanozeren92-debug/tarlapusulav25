import { supabase } from '../supabaseClient';

const env = import.meta.env;

function normalizeSupabaseProjectUrl(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) return '';

  return raw
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage|functions)\/v1$/i, '');
}

function getSupabaseRuntimeConfig() {
  const client = supabase as any;

  const rawUrl =
    env.VITE_SUPABASE_URL ??
    env.VITE_SUPABASE_PROJECT_URL ??
    client?.supabaseUrl ??
    '';

  const url =
    normalizeSupabaseProjectUrl(rawUrl);

  const key = String(
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      env.VITE_SUPABASE_ANON_KEY ??
      env.VITE_SUPABASE_KEY ??
      client?.supabaseKey ??
      '',
  ).trim();

  return { url, key };
}

export type PusulaTriggerSource =
  | 'home'
  | 'data_change'
  | 'user_action'
  | 'scheduled'
  | 'manual';

export type PusulaAiInsight = {
  id: string;
  gozlem: string;
  yonlendirme: string;
  guven_skoru: 'Yüksek' | 'Orta' | 'Düşük';
  puan_odulu: number;
};

export type PusulaAiResult = {
  insight: PusulaAiInsight | null;
  onerilen_aksiyon: string | null;
  generatedAt?: string;
  skipped?: boolean;
  skipReason?: 'cooldown' | 'same_context';
};

type RequestArgs = {
  fieldId: string;
  triggerSource?: PusulaTriggerSource;
  context: Record<string, unknown>;
  force?: boolean;
};

const MIN_CALL_INTERVAL_MS = 2 * 60 * 60 * 1000;
const SAME_CONTEXT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'tp_pusula_ai_v2:';

type CacheRow = {
  at: number;
  fingerprint: string;
};

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;

  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    if (typeof value === 'string' && value.length > 900) {
      return `${value.slice(0, 900)}…`;
    }
    return value ?? null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? Math.round(value * 10) / 10
      : null;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalizedKey = key.toLocaleLowerCase('tr-TR');

      if (
        normalizedKey.includes('image') ||
        normalizedKey.includes('base64') ||
        normalizedKey.includes('geometry') ||
        normalizedKey.includes('coordinates') ||
        normalizedKey.includes('polygon') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('password')
      ) {
        continue;
      }

      output[key] = sanitizeValue(raw, depth + 1);
    }

    return output;
  }

  return String(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getCache(fieldId: string): CacheRow | null {
  try {
    const raw = window.localStorage.getItem(
      `${STORAGE_PREFIX}${fieldId}`,
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      typeof parsed?.at !== 'number' ||
      typeof parsed?.fingerprint !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setCache(fieldId: string, row: CacheRow) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${fieldId}`,
      JSON.stringify(row),
    );
  } catch {
    // Cache kullanılamasa da Pusula çalışabilir.
  }
}

export async function requestPusulaInsight({
  fieldId,
  triggerSource = 'home',
  context,
  force = false,
}: RequestArgs): Promise<PusulaAiResult> {
  const cleanFieldId = String(fieldId || '').trim();

  if (!cleanFieldId) {
    throw new Error('Pusula AI için fieldId gerekli.');
  }

  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const cleanContext =
    sanitizeValue(context) as Record<string, unknown>;

  const fingerprint =
    hashString(stableStringify(cleanContext));

  const now = Date.now();
  const cached = getCache(cleanFieldId);

  if (!force && cached) {
    const age = now - cached.at;

    if (age < MIN_CALL_INTERVAL_MS) {
      return {
        insight: null,
        onerilen_aksiyon: null,
        skipped: true,
        skipReason: 'cooldown',
      };
    }

    if (
      cached.fingerprint === fingerprint &&
      age < SAME_CONTEXT_INTERVAL_MS
    ) {
      return {
        insight: null,
        onerilen_aksiyon: null,
        skipped: true,
        skipReason: 'same_context',
      };
    }
  }

  const {
    data: currentSessionData,
    error: currentSessionError,
  } = await supabase.auth.getSession();

  if (currentSessionError) {
    throw new Error(
      currentSessionError.message ||
        'Supabase oturumu okunamadı.',
    );
  }

  if (!currentSessionData.session) {
    throw new Error(
      'Aktif kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yap.',
    );
  }

  const {
    data: refreshedSessionData,
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError) {
    throw new Error(
      refreshError.message ||
        'Supabase oturumu yenilenemedi.',
    );
  }

  const accessToken =
    refreshedSessionData.session?.access_token ||
    currentSessionData.session.access_token;

  if (!accessToken) {
    throw new Error(
      'Geçerli erişim anahtarı alınamadı. Lütfen tekrar giriş yap.',
    );
  }

  const {
    data: verifiedUserData,
    error: verifiedUserError,
  } = await supabase.auth.getUser(accessToken);

  if (verifiedUserError || !verifiedUserData.user) {
    throw new Error(
      `Frontend oturum doğrulaması başarısız: ${
        verifiedUserError?.message || 'Kullanıcı doğrulanamadı.'
      }`,
    );
  }

  const { data, error } =
    await supabase.functions.invoke('pusula-ai', {
      body: {
        fieldId: cleanFieldId,
        triggerSource,
        context: cleanContext,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

  if (error) {
    const context =
      (error as any)?.context;

    let detail = '';

    try {
      if (context?.json) {
        const payload = await context.json();
        detail =
          payload?.userMessage ||
          payload?.error ||
          '';
      }
    } catch {
      // ignore
    }

    throw new Error(
      detail ||
        error.message ||
        'Pusula AI Edge Function çağrısı başarısız.',
    );
  }


  setCache(cleanFieldId, {
    at: now,
    fingerprint,
  });

  const raw = data?.insight;

  if (!raw) {
    return {
      insight: null,
      onerilen_aksiyon:
        typeof data?.onerilen_aksiyon === 'string'
          ? data.onerilen_aksiyon
          : null,
      generatedAt: data?.generatedAt,
    };
  }

  const confidence =
    raw.guven_skoru === 'Yüksek' ||
    raw.guven_skoru === 'Orta' ||
    raw.guven_skoru === 'Düşük'
      ? raw.guven_skoru
      : 'Düşük';

  return {
    insight: {
      id:
        String(raw.id || '').trim() ||
        `pusula-ai-${cleanFieldId}-${Date.now()}`,
      gozlem: String(raw.gozlem || '').trim(),
      yonlendirme: String(raw.yonlendirme || '').trim(),
      guven_skoru: confidence,
      puan_odulu: Math.max(
        0,
        Number(raw.puan_odulu || 0),
      ),
    },
    onerilen_aksiyon:
      typeof data?.onerilen_aksiyon === 'string'
        ? data.onerilen_aksiyon
        : null,
    generatedAt: data?.generatedAt,
  };
}
