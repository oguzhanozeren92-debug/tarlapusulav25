import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WOFOST_BRANCH = 'wofost72';
const WOFOST_RAW_BASE = `https://raw.githubusercontent.com/ajwdewit/WOFOST_crop_parameters/${WOFOST_BRANCH}`;
const WOFOST_VIEW_BASE = `https://github.com/ajwdewit/WOFOST_crop_parameters/blob/${WOFOST_BRANCH}`;
const CROP_KEY_PATTERN = /^[a-z0-9_]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function parseVarietyKeys(yamlText: string) {
  const lines = yamlText.split(/\r?\n/);
  const varieties: string[] = [];
  let insideVarieties = false;

  for (const line of lines) {
    if (!insideVarieties) {
      if (/^\s{4}Varieties:\s*$/.test(line)) insideVarieties = true;
      continue;
    }

    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    if (indent <= 4) break;
    if (indent !== 8) continue;

    const match = line.match(/^\s{8}([^:#][^:]*):\s*(?:&[^\s]+\s*)?$/);
    if (!match) continue;

    const key = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (key && !varieties.includes(key)) varieties.push(key);
  }

  return varieties.sort((a, b) => a.localeCompare(b, 'en'));
}

async function fetchOfficialVarieties(cropKey: string) {
  if (!CROP_KEY_PATTERN.test(cropKey)) {
    throw new Error('Geçersiz WOFOST crop key.');
  }

  const rawUrl = `${WOFOST_RAW_BASE}/${cropKey}.yaml`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-PCSE-Variety-Admin/1.0' },
    });
    if (!response.ok) throw new Error(`WOFOST crop YAML HTTP ${response.status}`);

    const yamlText = await response.text();
    const varieties = parseVarietyKeys(yamlText);
    if (!varieties.length) throw new Error('WOFOST YAML içinde çeşit anahtarı bulunamadı.');

    return {
      cropKey,
      varieties,
      sourceLabel: 'WOFOST crop parameters 7.2',
      sourceUrl: `${WOFOST_VIEW_BASE}/${cropKey}.yaml`,
      rawUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticatedAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw Object.assign(new Error('Admin servisi için oturum veya sunucu kimlik bilgileri eksik.'), { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    throw Object.assign(new Error('Geçerli kullanıcı oturumu gerekli.'), { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin');
  if (adminError) throw adminError;
  if (isAdmin !== true) {
    throw Object.assign(new Error('Bu işlem yalnızca yönetici içindir.'), { status: 403 });
  }

  return { user: authData.user, serviceClient };
}

async function loadRequest(serviceClient: any, requestId: string) {
  const { data, error } = await serviceClient
    .from('pcse_variety_mapping_requests')
    .select('id,crop_name,local_variety_name,normalized_local_variety_name,wofost_crop_key,model_family,model_version,status,first_seen_at,last_seen_at')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Çeşit eşleme isteği bulunamadı.'), { status: 404 });
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body?.action || 'pending').toLowerCase();
    const { serviceClient } = await authenticatedAdmin(req);

    if (action === 'pending') {
      const limit = Math.min(100, Math.max(1, Number(body?.limit) || 50));
      const { data, error } = await serviceClient
        .from('pcse_variety_mapping_requests')
        .select('id,crop_name,local_variety_name,normalized_local_variety_name,wofost_crop_key,model_family,model_version,status,first_seen_at,last_seen_at')
        .eq('status', 'pending')
        .order('last_seen_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      return json({
        ok: true,
        action,
        requests: data ?? [],
        source: 'server-only mapping queue',
      });
    }

    const requestId = cleanText(body?.request_id);
    if (!requestId) return json({ ok: false, error: 'request_id gerekli.' }, 400);
    const mappingRequest = await loadRequest(serviceClient, requestId);

    if (action === 'candidates') {
      const official = await fetchOfficialVarieties(String(mappingRequest.wofost_crop_key));
      return json({
        ok: true,
        action,
        request: mappingRequest,
        candidates: official.varieties,
        candidate_count: official.varieties.length,
        source_label: official.sourceLabel,
        source_url: official.sourceUrl,
        auto_selected: false,
        note: 'Adaylar resmi WOFOST 7.2 parametre dosyasından gelir; yerel çeşide eşdeğer aday yönetici doğrulaması olmadan seçilmez.',
      });
    }

    if (action === 'ignore') {
      const { error } = await serviceClient
        .from('pcse_variety_mapping_requests')
        .update({ status: 'ignored', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      return json({ ok: true, action, request_id: requestId, status: 'ignored' });
    }

    if (action === 'map') {
      const selectedVariety = cleanText(body?.wofost_variety_key);
      if (!selectedVariety) return json({ ok: false, error: 'wofost_variety_key gerekli.' }, 400);

      const official = await fetchOfficialVarieties(String(mappingRequest.wofost_crop_key));
      if (!official.varieties.includes(selectedVariety)) {
        return json({
          ok: false,
          error: 'Seçilen çeşit anahtarı resmi WOFOST 7.2 aday listesinde yok.',
          verified: false,
        }, 400);
      }

      const now = new Date().toISOString();
      const mapping = {
        crop_name: mappingRequest.crop_name,
        local_variety_name: mappingRequest.local_variety_name,
        normalized_local_variety_name: mappingRequest.normalized_local_variety_name,
        wofost_crop_key: mappingRequest.wofost_crop_key,
        wofost_variety_key: selectedVariety,
        model_family: mappingRequest.model_family || 'WOFOST',
        model_version: mappingRequest.model_version || '7.2',
        source_label: official.sourceLabel,
        source_url: official.sourceUrl,
        verified: true,
        updated_at: now,
      };

      const { data: mappingRow, error: mappingError } = await serviceClient
        .from('pcse_variety_mappings')
        .upsert(mapping, {
          onConflict: 'crop_name,normalized_local_variety_name,model_version',
        })
        .select('id,crop_name,local_variety_name,wofost_crop_key,wofost_variety_key,model_version,verified,source_url,updated_at')
        .single();
      if (mappingError) throw mappingError;

      const { error: requestError } = await serviceClient
        .from('pcse_variety_mapping_requests')
        .update({ status: 'mapped', updated_at: now, last_seen_at: now })
        .eq('id', requestId);
      if (requestError) throw requestError;

      return json({
        ok: true,
        action,
        verified: true,
        mapping: mappingRow,
        source_label: official.sourceLabel,
        source_url: official.sourceUrl,
        auto_selected: false,
      });
    }

    return json({ ok: false, error: 'Desteklenmeyen action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PCSE çeşit admin işlemi başarısız oldu.';
    const status = Number((error as any)?.status);
    console.error('[pcse-variety-admin]', message);
    return json({
      ok: false,
      error: message,
    }, Number.isFinite(status) && status >= 400 && status < 600 ? status : 500);
  }
});
