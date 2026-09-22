const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type LocationLevel = 'province' | 'district' | 'village';

type LocationRequest = {
  level?: LocationLevel;
  parentId?: number | string | null;
};

type LocationOption = {
  id: number;
  name: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });

const BASE_URLS = [
  'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi',
  'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/idariYapi',
] as const;

const pathFor = (level: LocationLevel, parentId: number | null) => {
  if (level === 'province') return 'ilListe';
  if (parentId === null || !Number.isFinite(parentId)) {
    throw new Error('parent_id_required');
  }
  if (level === 'district') return `ilceListe/${parentId}`;
  return `mahalleListe/${parentId}`;
};

const normalizeOptions = (payload: any): LocationOption[] => {
  const features = Array.isArray(payload?.features)
    ? payload.features
    : Array.isArray(payload)
      ? payload
      : [];

  const seen = new Set<number>();
  const options: LocationOption[] = [];

  for (const feature of features) {
    const properties = feature?.properties ?? feature ?? {};
    const id = Number(
      properties.id ??
        properties.kod ??
        properties.code ??
        feature?.id,
    );
    const name = String(
      properties.text ??
        properties.name ??
        properties.ad ??
        properties.label ??
        '',
    ).trim();

    if (!Number.isFinite(id) || !name || seen.has(id)) continue;
    seen.add(id);
    options.push({ id, name });
  }

  return options;
};

const fetchWithTimeout = async (url: string, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'TarlaPusula/1.0',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error: 'method_not_allowed',
        message: 'Sadece POST destekleniyor.',
      },
      405,
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as LocationRequest;
    const level = body.level;

    if (level !== 'province' && level !== 'district' && level !== 'village') {
      return jsonResponse(
        {
          error: 'invalid_level',
          message: 'Geçersiz idari seviye.',
        },
        400,
      );
    }

    const rawParentId = body.parentId;
    const parentId =
      rawParentId === null || rawParentId === undefined || rawParentId === ''
        ? null
        : Number(rawParentId);

    let path: string;
    try {
      path = pathFor(level, parentId);
    } catch {
      return jsonResponse(
        {
          error: 'parent_id_required',
          message: 'İlçe veya mahalle/köy listesi için üst kayıt kimliği gerekli.',
        },
        400,
      );
    }

    const attempts: Array<{ url: string; status?: number; error?: string }> = [];

    for (const baseUrl of BASE_URLS) {
      const url = `${baseUrl}/${path}`;

      try {
        const response = await fetchWithTimeout(url);
        attempts.push({ url, status: response.status });

        if (!response.ok) continue;

        const payload = await response.json();
        const options = normalizeOptions(payload);

        if (!options.length) continue;

        return jsonResponse({
          ok: true,
          source: 'TKGM_MEGSIS',
          level,
          parentId,
          fetchedAt: new Date().toISOString(),
          options,
        });
      } catch (error) {
        attempts.push({
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.error('TKGM location endpoints failed', attempts);

    return jsonResponse(
      {
        ok: false,
        error: 'tkgm_unavailable',
        message: 'TKGM il / ilçe / mahalle-köy servisine şu anda ulaşılamadı.',
      },
      502,
    );
  } catch (error) {
    console.error('tkgm-location-options internal error:', error);
    return jsonResponse(
      {
        ok: false,
        error: 'internal_error',
        message: 'Konum listesi alınırken teknik hata oluştu.',
      },
      500,
    );
  }
});
