import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PHOTO_BUCKET = 'field-activity-photos';
const R2_MARKER = 'r2:';
const MAX_IMAGE_BYTES = 8_000_000;
const REQUEST_TIMEOUT_MS = 55_000;

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

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeMime(value: unknown) {
  const mime = String(value ?? '').trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime.startsWith('image/') ? mime : 'image/jpeg';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Görsel kanıt için Supabase sunucu ayarı veya kullanıcı oturumu eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    const authError = new Error('Görsel kanıt için geçerli kullanıcı oturumu gerekli.');
    (authError as any).status = 401;
    throw authError;
  }

  return {
    user: data.user,
    serviceClient,
    supabaseUrl,
    anonKey,
    authorization,
  };
}

async function signedR2Url(input: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  storedPath: string;
}) {
  const rawPath = input.storedPath.slice(R2_MARKER.length).replace(/^\/+/, '');
  const response = await fetchWithTimeout(`${input.supabaseUrl}/functions/v1/r2-storage`, {
    method: 'POST',
    headers: {
      Authorization: input.authorization,
      apikey: input.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'download',
      namespace: PHOTO_BUCKET,
      paths: [rawPath],
    }),
  });

  const payload = await response.json().catch(() => null);
  const url = clean(payload?.items?.[0]?.url);
  if (!response.ok || !url) {
    throw new Error(payload?.error ?? `R2 fotoğraf bağlantısı hazırlanamadı (HTTP ${response.status}).`);
  }
  return url;
}

async function loadPhotoBytes(input: {
  serviceClient: any;
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  storagePath: string;
  mimeType: string;
}) {
  let url: string;

  if (input.storagePath.startsWith(R2_MARKER)) {
    url = await signedR2Url({
      supabaseUrl: input.supabaseUrl,
      anonKey: input.anonKey,
      authorization: input.authorization,
      storedPath: input.storagePath,
    });
  } else {
    const signed = await input.serviceClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(input.storagePath, 300);

    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ?? new Error('Görsel kanıt için fotoğraf bağlantısı hazırlanamadı.');
    }
    url = signed.data.signedUrl;
  }

  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'image/*' },
  });
  if (!response.ok) {
    throw new Error(`Görsel kanıt fotoğrafı okunamadı (HTTP ${response.status}).`);
  }

  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    throw new Error('Görsel kanıt için fotoğraf 8 MB sınırını aşıyor.');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Görsel kanıt fotoğraf dosyası boş.');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('Görsel kanıt için fotoğraf 8 MB sınırını aşıyor.');
  }

  return {
    bytes,
    mimeType: normalizeMime(response.headers.get('content-type') || input.mimeType),
  };
}

function gatewayConfig() {
  return {
    url: (Deno.env.get('MODEL_GATEWAY_URL') ?? '').replace(/\/$/, ''),
    key: Deno.env.get('MODEL_GATEWAY_SHARED_KEY') ?? '',
  };
}

function gatewayUnavailable(engine: string, mode: string, fieldId: string, jobId: string) {
  return {
    ok: true,
    blocked: true,
    engine,
    mode,
    field_id: fieldId,
    job_id: jobId,
    production_authority: false,
    diagnostic_authority: false,
    confidence_authority: false,
    reason: 'model_gateway_connection_missing',
    warnings: ['Model Gateway bağlantısı yapılandırılmadığı için bu görsel kanıt motoru çalıştırılmadı.'],
  };
}

async function callPlantCvGateway(input: {
  fieldId: string;
  jobId: string;
  mimeType: string;
  imageBase64: string;
}) {
  const gateway = gatewayConfig();
  if (!gateway.url || !gateway.key) {
    return gatewayUnavailable('plantcv', 'photo_evidence', input.fieldId, input.jobId);
  }

  const response = await fetchWithTimeout(`${gateway.url}/v1/vision/plantcv/evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Model-Gateway-Key': gateway.key,
    },
    body: JSON.stringify({
      field_id: input.fieldId,
      job_id: input.jobId,
      mime_type: input.mimeType,
      image_base64: input.imageBase64,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.detail ?? payload?.error ?? `PlantCV Model Gateway HTTP ${response.status}`);
  }

  if (
    payload.engine !== 'plantcv' ||
    payload.mode !== 'photo_evidence' ||
    payload.production_authority !== false ||
    payload.diagnostic_authority !== false
  ) {
    throw new Error('PlantCV Model Gateway güven sınırı doğrulanamadı.');
  }

  return payload;
}

async function callPlantVillageGateway(input: {
  fieldId: string;
  jobId: string;
  crop: string | null;
  mimeType: string;
  imageBase64: string;
}) {
  const gateway = gatewayConfig();
  if (!gateway.url || !gateway.key) {
    return gatewayUnavailable(
      'plantvillage-onnx-shadow',
      'disease_classification_shadow',
      input.fieldId,
      input.jobId,
    );
  }

  const response = await fetchWithTimeout(`${gateway.url}/v1/vision/plantvillage/shadow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Model-Gateway-Key': gateway.key,
    },
    body: JSON.stringify({
      field_id: input.fieldId,
      job_id: input.jobId,
      crop: input.crop,
      mime_type: input.mimeType,
      image_base64: input.imageBase64,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.detail ?? payload?.error ?? `PlantVillage Model Gateway HTTP ${response.status}`);
  }

  if (
    payload.engine !== 'plantvillage-onnx-shadow' ||
    payload.mode !== 'disease_classification_shadow' ||
    payload.production_authority !== false ||
    payload.diagnostic_authority !== false ||
    payload.confidence_authority !== false
  ) {
    throw new Error('PlantVillage gölge modeli güven sınırı doğrulanamadı.');
  }

  return payload;
}

function failedEvidence(engine: string, mode: string, error: unknown) {
  return {
    ok: false,
    blocked: true,
    engine,
    mode,
    production_authority: false,
    diagnostic_authority: false,
    confidence_authority: false,
    reason: 'runtime_error',
    warnings: [error instanceof Error ? error.message : 'Görsel kanıt motoru çalıştırılamadı.'],
  };
}

async function persistEvidenceBestEffort(
  serviceClient: any,
  jobId: string,
  userId: string,
  diagnosisSessionId: string | null,
  existingAnalysis: unknown,
  plantCvEvidence: unknown,
  plantVillageShadow: unknown,
) {
  if (!existingAnalysis || typeof existingAnalysis !== 'object' || Array.isArray(existingAnalysis)) {
    return;
  }

  const nextAnalysis = {
    ...(existingAnalysis as Record<string, unknown>),
    plantCvEvidence,
    plantVillageShadow,
  };
  const updatedAt = new Date().toISOString();

  const { error } = await serviceClient
    .from('ai_image_analysis_jobs')
    .update({ analysis: nextAnalysis, updated_at: updatedAt })
    .eq('id', jobId)
    .eq('user_id', userId);

  if (error) {
    console.warn('[plantcv-photo-evidence] evidence persistence failed', error.message);
    return;
  }

  if (diagnosisSessionId) {
    const { error: sessionError } = await serviceClient
      .from('ai_diagnosis_sessions')
      .update({ current_analysis: nextAnalysis, updated_at: updatedAt })
      .eq('id', diagnosisSessionId)
      .eq('user_id', userId);

    if (sessionError) {
      console.warn('[plantcv-photo-evidence] session mirror failed', sessionError.message);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = clean(body?.jobId ?? body?.job_id);
    if (!jobId) return json({ ok: false, error: 'jobId gerekli.' }, 400);

    const forbidden = ['image', 'image_base64', 'storage_path', 'storagePath', 'field_id', 'fieldId', 'crop'];
    if (forbidden.some((key) => key in body)) {
      return json(
        {
          ok: false,
          error: 'Görsel, tarla ve ürün bağlamı istemciden kabul edilmez; yalnız jobId gönderilir.',
        },
        400,
      );
    }

    const { user, serviceClient, supabaseUrl, anonKey, authorization } = await authenticatedClients(req);

    const { data: job, error: jobError } = await serviceClient
      .from('ai_image_analysis_jobs')
      .select('id,user_id,field_id,crop,storage_bucket,storage_path,mime_type,status,analysis,diagnosis_session_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return json({ ok: false, error: 'Fotoğraf analiz işi bulunamadı veya erişim yetkin yok.' }, 404);
    if (String(job.storage_bucket ?? '') !== PHOTO_BUCKET) {
      return json({ ok: false, error: 'Görsel kanıt yalnız kayıtlı saha fotoğrafı alanını işler.' }, 422);
    }

    const fieldId = clean(job.field_id);
    const storagePath = clean(job.storage_path);
    if (!fieldId || !storagePath) {
      return json({ ok: false, error: 'Görsel kanıt için kayıtlı tarla veya fotoğraf yolu eksik.' }, 422);
    }

    const image = await loadPhotoBytes({
      serviceClient,
      supabaseUrl,
      anonKey,
      authorization,
      storagePath,
      mimeType: normalizeMime(job.mime_type),
    });
    const imageBase64 = bytesToBase64(image.bytes);

    const [plantCvAttempt, plantVillageAttempt] = await Promise.allSettled([
      callPlantCvGateway({
        fieldId,
        jobId,
        mimeType: image.mimeType,
        imageBase64,
      }),
      callPlantVillageGateway({
        fieldId,
        jobId,
        crop: clean(job.crop),
        mimeType: image.mimeType,
        imageBase64,
      }),
    ]);

    const plantCvEvidence = plantCvAttempt.status === 'fulfilled'
      ? plantCvAttempt.value
      : failedEvidence('plantcv', 'photo_evidence', plantCvAttempt.reason);
    const plantVillageShadow = plantVillageAttempt.status === 'fulfilled'
      ? plantVillageAttempt.value
      : failedEvidence('plantvillage-onnx-shadow', 'disease_classification_shadow', plantVillageAttempt.reason);

    await persistEvidenceBestEffort(
      serviceClient,
      jobId,
      user.id,
      clean(job.diagnosis_session_id),
      job.analysis,
      plantCvEvidence,
      plantVillageShadow,
    );

    return json({
      ok: true,
      field_id: fieldId,
      job_id: jobId,
      input_authority: 'server-derived',
      production_authority: false,
      diagnostic_authority: false,
      plantCvEvidence,
      plantVillageShadow,
      sources: [
        {
          source: 'PlantCV',
          upstream: 'danforthcenter/plantcv',
          license: 'MPL-2.0',
        },
        {
          source: 'PlantVillage ONNX shadow',
          upstream: 'imaflower/plantvillage-mobilenetv3',
          license: 'MIT',
        },
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fotoğraf görsel kanıtı hazırlanamadı.';
    console.error('[plantcv-photo-evidence]', message);
    const explicitStatus = Number((error as any)?.status);
    const status =
      Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : /oturum|kullanıcı/i.test(message)
          ? 401
          : 500;

    return json({ ok: false, error: message, production_authority: false, diagnostic_authority: false }, status);
  }
});
