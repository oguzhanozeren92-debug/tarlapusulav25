import { supabase } from '../supabaseClient';

export const R2_MARKER = 'r2:' as const;

export type R2Namespace =
  | 'field-activity-photos'
  | 'field-observation-photos'
  | 'user-documents'
  | 'reports';

type SignedItem = {
  path: string;
  url: string;
  contentType?: string | null;
};

type SignResponse = {
  items?: SignedItem[];
  error?: string;
};

function cleanPath(path: string) {
  return String(path ?? '')
    .replace(/^r2:/, '')
    .replace(/^\/+/, '')
    .trim();
}

export function isR2Path(path?: string | null) {
  return typeof path === 'string' && path.startsWith(R2_MARKER);
}

export function markR2Path(path: string) {
  return `${R2_MARKER}${cleanPath(path)}`;
}

export function unmarkR2Path(path: string) {
  return cleanPath(path);
}

async function sign(
  action: 'upload' | 'download' | 'delete',
  namespace: R2Namespace,
  paths: string[],
  contentTypes?: Array<string | null | undefined>,
) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const normalized = paths.map(cleanPath).filter(Boolean);
  if (!normalized.length) return [] as SignedItem[];

  const { data, error } = await supabase.functions.invoke<SignResponse>('r2-storage', {
    body: {
      action,
      namespace,
      paths: normalized,
      contentTypes:
        action === 'upload'
          ? normalized.map((_, index) => contentTypes?.[index] || 'application/octet-stream')
          : undefined,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return Array.isArray(data?.items) ? data.items : [];
}


export async function testR2Connection() {
  if (!supabase) {
    return { ok: false, error: 'Supabase bağlantısı hazır değil.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      stage?: string;
      error?: string;
      message?: string;
      code?: string | null;
      httpStatus?: number | null;
      bucket?: string;
      endpointHost?: string;
    }>('r2-storage', {
      body: { action: 'healthcheck' },
    });

    if (error) {
      return { ok: false, error: error.message || 'Healthcheck çağrısı başarısız.' };
    }

    if (data?.ok) {
      return { ok: true, stage: data.stage || 'complete' };
    }

    const detailParts = [
      data?.code ? `kod: ${data.code}` : '',
      data?.httpStatus ? `HTTP ${data.httpStatus}` : '',
      data?.message || data?.error || '',
    ].filter(Boolean);

    return {
      ok: false,
      stage: data?.stage,
      error:
        detailParts.join(' · ') ||
        'R2 healthcheck başarısız.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'R2 healthcheck başarısız.',
    };
  }
}

export async function uploadPrivateFile(
  namespace: R2Namespace,
  path: string,
  file: Blob,
  contentType?: string,
) {
  const clean = cleanPath(path);
  const type = contentType || file.type || 'application/octet-stream';

  // StackBlitz / geliştirme testinde önce sunucunun R2'ye gerçekten erişebildiğini
  // doğrula. Böylece secret/bucket hatasını tarayıcı CORS hatasından ayırıyoruz.
  if (import.meta.env.DEV) {
    const health = await testR2Connection();

    if (!health.ok) {
      throw new Error(
        `Cloudflare R2 sunucu testi başarısız${health.stage ? ` (${health.stage})` : ''}: ` +
          `${health.error || 'R2 secret, bucket ve yetkilerini kontrol et.'}`,
      );
    }
  }

  const [signed] = await sign('upload', namespace, [clean], [type]);

  if (!signed?.url) {
    throw new Error('R2 yükleme bağlantısı hazırlanamadı.');
  }

  let response: Response;

  try {
    response = await fetch(signed.url, {
      method: 'PUT',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': type,
      },
      body: file,
    });
  } catch (error) {
    let host = 'Cloudflare R2';
    try {
      host = new URL(signed.url).host;
    } catch {
      // Signed URL hata mesajına eklenmez; imza gizli kalır.
    }

    console.error('R2 doğrudan yükleme isteği başarısız:', {
      host,
      namespace,
      path: clean,
      error,
    });

    const health = await testR2Connection();

    if (health.ok) {
      throw new Error(
        'Cloudflare R2 sunucu bağlantısı sağlam, ancak tarayıcı yüklemeyi engelliyor. ' +
          'Bucket CORS ayarını kontrol et.',
      );
    }

    throw new Error(
      `Cloudflare R2 sunucu testi başarısız${health.stage ? ` (${health.stage})` : ''}: ` +
        `${health.error || 'R2 yapılandırmasını kontrol et.'}`,
    );
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('R2 yükleme HTTP hatası:', {
      status: response.status,
      namespace,
      path: clean,
      details: details.slice(0, 300),
    });

    throw new Error(
      `Cloudflare R2 yükleme başarısız (HTTP ${response.status}).`,
    );
  }

  return markR2Path(clean);
}

export async function getPrivateFileUrl(
  namespace: R2Namespace,
  storedPath: string,
  legacySupabaseBucket?: string,
) {
  if (!storedPath) return null;

  if (isR2Path(storedPath)) {
    const [signed] = await sign('download', namespace, [unmarkR2Path(storedPath)]);
    return signed?.url ?? null;
  }

  if (!legacySupabaseBucket || !supabase) return null;

  const { data, error } = await supabase.storage
    .from(legacySupabaseBucket)
    .createSignedUrl(storedPath, 60 * 60);

  if (error) {
    console.warn('Eski Supabase dosya URL’i hazırlanamadı:', error);
    return null;
  }

  return data?.signedUrl ?? null;
}

export async function getPrivateFileUrls(
  namespace: R2Namespace,
  storedPaths: string[],
  legacySupabaseBucket?: string,
) {
  const result = new Map<string, string>();
  const r2Paths = storedPaths.filter(isR2Path);
  const legacyPaths = storedPaths.filter((path) => path && !isR2Path(path));

  if (r2Paths.length) {
    const signed = await sign(
      'download',
      namespace,
      r2Paths.map(unmarkR2Path),
    );

    signed.forEach((item) => {
      if (item?.path && item?.url) {
        result.set(markR2Path(item.path), item.url);
      }
    });
  }

  if (legacyPaths.length && legacySupabaseBucket && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(legacySupabaseBucket)
        .createSignedUrls(legacyPaths, 60 * 60);

      if (!error) {
        legacyPaths.forEach((path, index) => {
          const url = data?.[index]?.signedUrl;
          if (url) result.set(path, url);
        });
      }
    } catch (error) {
      console.warn('Eski Supabase dosya URL’leri hazırlanamadı:', error);
    }
  }

  return result;
}

export async function deletePrivateFile(
  namespace: R2Namespace,
  storedPath: string,
  legacySupabaseBucket?: string,
) {
  if (!storedPath) return;

  if (isR2Path(storedPath)) {
    const [signed] = await sign('delete', namespace, [unmarkR2Path(storedPath)]);
    if (!signed?.url) return;

    const response = await fetch(signed.url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 dosya silme başarısız (${response.status}).`);
    }
    return;
  }

  if (!legacySupabaseBucket || !supabase) return;

  const { error } = await supabase.storage
    .from(legacySupabaseBucket)
    .remove([storedPath]);

  if (error) throw error;
}
