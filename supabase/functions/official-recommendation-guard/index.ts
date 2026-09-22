import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BKU_SEARCH_URL = "https://bku.tarimorman.gov.tr/Arama/Index";
const GTS_URL = "https://gts.tarimorman.gov.tr/";
const GUARD_VERSION = "official-guard-v6-vision-shadow";
const VALIDATION_MAX_AGE_DAYS = 14;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function cleanText(value: unknown, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.slice(0, max);
}

function normalized(value: unknown) {
  return cleanText(value, 500).toLocaleLowerCase("tr-TR");
}

function normalizedIssue(analysis: any) {
  const possibleIssue = cleanText(analysis?.possibleIssue, 180);
  return possibleIssue && possibleIssue.toLocaleLowerCase("tr-TR") !== "belirsiz"
    ? possibleIssue
    : null;
}

function isDoseInstruction(value: unknown) {
  const text = cleanText(value, 500).toLocaleLowerCase("tr-TR");
  if (!text) return false;
  const dosePattern = /\b\d+(?:[.,]\d+)?\s*(?:ml|l|lt|g|gr|kg)\s*\/?\s*(?:da|dekar|ha|100\s*(?:l|lt)|su)?\b/i;
  return dosePattern.test(text) || /\bdoz\b/i.test(text);
}

function looksLikeChemicalInstruction(value: unknown) {
  const text = cleanText(value, 500).toLocaleLowerCase("tr-TR");
  if (!text) return false;

  const chemicalPattern = /(aktif madde|etken madde|ticari isim|pestisit|fungisit|insektisit|herbisit|akarisit|nematisit|bitki koruma ürünü|bitki koruma urunu|ilaç|ilac|formülasyon|formulasyon)/i;
  const applicationPattern = /(uygula|uygulayın|uygulayin|kullan|kullanın|kullanin|atım|atim|püskürt|puskurt|ilaçla|ilacla|doz)/i;

  return isDoseInstruction(text) || (chemicalPattern.test(text) && applicationPattern.test(text));
}

function labelsMatch(left: unknown, right: unknown) {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false;
  return a.includes(b) || b.includes(a);
}

function recordIsFresh(record: any, now = Date.now()) {
  if (record?.verification_status !== "verified") return false;

  const validUntil = record?.valid_until ? Date.parse(record.valid_until) : null;
  if (validUntil != null && Number.isFinite(validUntil) && validUntil < now) return false;

  const observedAt = record?.source_observed_at ? Date.parse(record.source_observed_at) : NaN;
  if (!Number.isFinite(observedAt)) return false;

  const maxAgeMs = VALIDATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return now - observedAt <= maxAgeMs;
}

function findMatchingPlantProtectionRecords(records: any[], crop: string | null, issue: string | null) {
  if (!crop || !issue) return [];
  return records
    .filter((record) => recordIsFresh(record))
    .filter((record) => labelsMatch(record?.crop, crop))
    .filter((record) => labelsMatch(record?.pest_or_disease ?? record?.subject_name, issue))
    .sort((a, b) => String(b?.source_observed_at ?? "").localeCompare(String(a?.source_observed_at ?? "")));
}

function recommendationMatchesOfficialRecord(value: unknown, records: any[]) {
  if (isDoseInstruction(value)) return false;
  if (!looksLikeChemicalInstruction(value)) return true;

  const recommendation = normalized(value);
  return records.some((record) => {
    const active = normalized(record?.active_ingredient);
    const product = normalized(record?.product_name);
    return (active && recommendation.includes(active)) || (product && recommendation.includes(product));
  });
}

function sanitizePlantProtectionAnalysis(analysis: any, matchingRecords: any[]) {
  const recommendations = Array.isArray(analysis?.recommendations)
    ? analysis.recommendations.map((item: unknown) => cleanText(item, 500)).filter(Boolean)
    : [];

  const blocked: string[] = [];
  const safe: string[] = [];

  for (const item of recommendations) {
    if (!looksLikeChemicalInstruction(item)) {
      safe.push(item);
      continue;
    }

    if (recommendationMatchesOfficialRecord(item, matchingRecords)) {
      safe.push(item);
    } else {
      blocked.push(item);
    }
  }

  if (blocked.length > 0) {
    safe.push(
      matchingRecords.length > 0
        ? "BKU eşleşmesi bulunan ürün/aktif madde için bile doz ve uygulama ayrıntısı güncel ruhsat etiketi üzerinden ayrıca doğrulanmalı."
        : "Kimyasal uygulama düşünülüyorsa ürün, aktif madde ve doz yalnızca güncel Tarım ve Orman Bakanlığı BKU kaydından doğrulandıktan sonra seçilmeli.",
    );
  }

  return {
    analysis: {
      ...analysis,
      recommendations: Array.from(new Set(safe)).slice(0, 5),
    },
    blocked,
  };
}

async function checkOfficialSource(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "TarlaPusula-Official-Verification/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

function validPlantCvEvidence(value: any) {
  return Boolean(
    value &&
    value.engine === "plantcv" &&
    value.mode === "photo_evidence" &&
    value.production_authority === false &&
    value.diagnostic_authority === false
  );
}

function validPlantVillageShadow(value: any) {
  return Boolean(
    value &&
    value.engine === "plantvillage-onnx-shadow" &&
    value.mode === "disease_classification_shadow" &&
    value.production_authority === false &&
    value.diagnostic_authority === false &&
    value.confidence_authority === false
  );
}

async function getVisionShadowEvidence(input: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  jobId: string;
}) {
  if (!input.anonKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch(`${input.supabaseUrl}/functions/v1/plantcv-photo-evidence`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: input.authorization,
          apikey: input.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: input.jobId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload?.ok === false) {
        console.warn(
          "Vision shadow evidence unavailable:",
          payload?.error ?? `HTTP ${response.status}`,
        );
        return null;
      }

      if (
        payload?.production_authority !== false ||
        payload?.diagnostic_authority !== false ||
        !validPlantCvEvidence(payload?.plantCvEvidence) ||
        !validPlantVillageShadow(payload?.plantVillageShadow)
      ) {
        console.warn("Vision shadow evidence rejected: trust boundary mismatch");
        return null;
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.warn(
      "Vision shadow evidence request failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function scheduleVisionShadowEvidence(input: {
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
  jobId: string;
}) {
  const task = getVisionShadowEvidence(input).then(() => undefined);
  const edgeRuntime = (globalThis as any).EdgeRuntime;

  if (edgeRuntime && typeof edgeRuntime.waitUntil === "function") {
    edgeRuntime.waitUntil(task);
    return;
  }

  void task;
}

function providerDefaults(providerKey: string) {
  if (providerKey === "tr_gts") {
    return {
      source: "GTS",
      name: "Tarım ve Orman Bakanlığı · Gübre Takip Sistemi",
      url: GTS_URL,
    };
  }
  return {
    source: "BKU",
    name: "Tarım ve Orman Bakanlığı · Bitki Koruma Ürünleri Veri Tabanı",
    url: BKU_SEARCH_URL,
  };
}

function buildVerification(input: {
  job: any;
  analysis: any;
  registry: any | null;
  sourceAvailability: "reachable" | "unreachable" | "unchecked";
  blockedCount: number;
  matchingRecords: any[];
}) {
  const issueType = cleanText(input.analysis?.issueType, 40).toLowerCase();
  const crop = cleanText(input.job?.crop, 120) || null;
  const issue = normalizedIssue(input.analysis);
  const evaluatedAt = new Date().toISOString();

  if (issueType === "disease" || issueType === "pest") {
    const defaults = providerDefaults("tr_bku");
    const record = input.matchingRecords[0] ?? null;
    const verified = Boolean(record);
    const providerRecordId = cleanText(record?.provider_record_id, 160) || cleanText(record?.id, 160) || null;
    const sourceUrl = cleanText(record?.source_url, 500) || BKU_SEARCH_URL;

    return {
      domain: "plant_protection",
      source: "BKU",
      sourceName: input.registry?.name
        ? `${input.registry.authority} · ${input.registry.name}`
        : defaults.name,
      status: verified ? "verified" : "requires_verification",
      sourceUrl,
      crop,
      issue,
      officialRecordId: providerRecordId,
      verifiedAt: verified ? evaluatedAt : null,
      sourceObservedAt: record?.source_observed_at ?? null,
      matchedRecordCount: input.matchingRecords.length,
      verificationBasis: verified ? "admin_reviewed_official_snapshot" : "official_source_reachability_only",
      guardEvaluatedAt: evaluatedAt,
      sourceMode: verified ? "admin_snapshot" : "official_web_check",
      sourceAvailability: input.sourceAvailability,
      blockedRecommendationCount: input.blockedCount,
      guardVersion: GUARD_VERSION,
      note: verified
        ? input.blockedCount > 0
          ? `BKU için ürün + hastalık/zararlı eşleşmesini doğrulayan güncel resmî snapshot bulundu. ${input.blockedCount} doz veya kayıtla eşleşmeyen kimyasal öneri yine engellendi; uygulama ayrıntısı güncel ruhsat etiketi üzerinden doğrulanmalıdır.`
          : "BKU için ürün + hastalık/zararlı eşleşmesini doğrulayan güncel, admin-onaylı resmî snapshot bulundu. Bu doğrulama doz reçetesi anlamına gelmez; etiket ve güncel ruhsat koşulları uygulama öncesi ayrıca kontrol edilmelidir."
        : input.blockedCount > 0
          ? `${input.blockedCount} doğrulanmamış kimyasal öneri güvenlik kapısı tarafından çıkarıldı. BKU kaydı ürün + bitki + zararlı/hastalık eşleşmesiyle doğrulanmadan ürün, aktif madde veya doz önerilmez.`
          : "Pusula AI ürün, aktif madde veya doz reçetesi üretmez. Kimyasal uygulama düşünülüyorsa güncel ruhsat ve bitki-zararlı/hastalık tavsiyesi resmî BKU kaydından doğrulanmalıdır.",
    };
  }

  if (issueType === "nutrition") {
    const defaults = providerDefaults("tr_gts");
    return {
      domain: "fertilizer",
      source: "GTS",
      sourceName: input.registry?.name
        ? `${input.registry.authority} · ${input.registry.name}`
        : defaults.name,
      status: "requires_verification",
      sourceUrl: input.registry?.base_url ?? GTS_URL,
      crop,
      issue,
      officialRecordId: null,
      verifiedAt: null,
      sourceObservedAt: null,
      matchedRecordCount: 0,
      verificationBasis: "official_source_reachability_only",
      guardEvaluatedAt: evaluatedAt,
      sourceMode: "official_web_check",
      sourceAvailability: input.sourceAvailability,
      blockedRecommendationCount: 0,
      guardVersion: GUARD_VERSION,
      note:
        "Pusula AI gübre markası veya resmî ürün kimliği doğrulaması yapmaz. Kullanılacak gübrenin kimliği ve izlenebilirliği GTS/karekod akışından doğrulanmalıdır.",
    };
  }

  return {
    domain: "plant_protection",
    source: "BKU",
    sourceName: "Tarım ve Orman Bakanlığı · Resmî doğrulama katmanı",
    status: "not_applicable",
    sourceUrl: BKU_SEARCH_URL,
    crop,
    issue,
    officialRecordId: null,
    verifiedAt: null,
    sourceObservedAt: null,
    matchedRecordCount: 0,
    verificationBasis: "not_applicable",
    guardEvaluatedAt: evaluatedAt,
    sourceMode: "official_web_check",
    sourceAvailability: input.sourceAvailability,
    blockedRecommendationCount: 0,
    guardVersion: GUARD_VERSION,
    note: "Bu görsel ön değerlendirme şu aşamada resmî ürün doğrulaması gerektiren bir tavsiye üretmiyor.",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Sadece POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ error: "Sunucu yapılandırması eksik." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ error: "Oturum gerekli." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Geçersiz oturum." }, 401);

  try {
    const body = await req.json();
    const jobId = cleanText(body?.jobId, 80);
    if (!jobId) return reply({ error: "jobId gerekli." }, 400);

    const { data: job, error: jobError } = await admin
      .from("ai_image_analysis_jobs")
      .select("id,user_id,field_id,crop,status,analysis,diagnosis_session_id")
      .eq("id", jobId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return reply({ error: "Analiz işi bulunamadı." }, 404);
    if (job.status !== "completed" || !job.analysis) {
      return reply({ error: "Önce görsel analiz tamamlanmalı." }, 409);
    }

    const issueType = cleanText(job.analysis?.issueType, 40).toLowerCase();
    const providerKey = issueType === "nutrition" ? "tr_gts" : "tr_bku";

    const { data: registry } = await admin
      .from("official_source_registry")
      .select("provider_key,domain,name,authority,base_url,verification_mode,programmatic_access,enabled")
      .eq("provider_key", providerKey)
      .eq("enabled", true)
      .maybeSingle();

    const sourceUrl = providerKey === "tr_gts"
      ? cleanText(registry?.base_url, 500) || GTS_URL
      : BKU_SEARCH_URL;
    const sourceAvailability = await checkOfficialSource(sourceUrl);

    let matchingRecords: any[] = [];
    if (providerKey === "tr_bku") {
      const { data: records, error: recordsError } = await admin
        .from("official_validation_records")
        .select("id,provider_key,provider_record_id,domain,subject_type,subject_name,crop,pest_or_disease,active_ingredient,product_name,verification_status,source_url,source_observed_at,valid_until,source_snapshot,metadata")
        .eq("provider_key", "tr_bku")
        .eq("verification_status", "verified")
        .order("source_observed_at", { ascending: false })
        .limit(250);
      if (recordsError) throw recordsError;

      matchingRecords = findMatchingPlantProtectionRecords(
        records ?? [],
        cleanText(job.crop, 120) || null,
        normalizedIssue(job.analysis),
      );
    }

    const sanitized =
      issueType === "disease" || issueType === "pest"
        ? sanitizePlantProtectionAnalysis(job.analysis, matchingRecords)
        : { analysis: job.analysis, blocked: [] as string[] };

    const officialVerification = buildVerification({
      job,
      analysis: sanitized.analysis,
      registry: registry ?? null,
      sourceAvailability,
      blockedCount: sanitized.blocked.length,
      matchingRecords,
    });

    const guardedAnalysis = {
      ...sanitized.analysis,
      officialVerification,
    };
    const updatedAt = new Date().toISOString();

    const { error: jobUpdateError } = await admin
      .from("ai_image_analysis_jobs")
      .update({ analysis: guardedAnalysis, updated_at: updatedAt })
      .eq("id", job.id)
      .eq("user_id", authData.user.id);
    if (jobUpdateError) throw jobUpdateError;

    if (job.diagnosis_session_id) {
      const { error: sessionUpdateError } = await admin
        .from("ai_diagnosis_sessions")
        .update({ current_analysis: guardedAnalysis, updated_at: updatedAt })
        .eq("id", job.diagnosis_session_id)
        .eq("user_id", authData.user.id);
      if (sessionUpdateError) {
        console.warn("Official verification session mirror failed:", sessionUpdateError.message);
      }
    }

    // Quantitative PlantCV + independent PlantVillage classifier are best-effort
    // shadow evidence only. The guarded answer is stored first, then the Edge
    // runtime continues this work in the background and mirrors the evidence
    // back into the same job/session without delaying the farmer-facing result.
    scheduleVisionShadowEvidence({
      supabaseUrl,
      anonKey,
      authorization,
      jobId: String(job.id),
    });

    const { error: auditError } = await admin
      .from("official_verification_events")
      .insert({
        user_id: authData.user.id,
        field_id: job.field_id,
        job_id: job.id,
        domain: officialVerification.domain,
        source: officialVerification.source,
        status: officialVerification.status,
        source_url: officialVerification.sourceUrl,
        source_reachable: sourceAvailability === "reachable",
        crop: officialVerification.crop,
        issue: officialVerification.issue,
        blocked_recommendations: sanitized.blocked,
        verification: officialVerification,
      });

    if (auditError) {
      console.warn("Official verification audit write failed:", auditError.message);
    }

    return reply({
      success: true,
      analysis: guardedAnalysis,
      officialVerification,
      visionShadowEvidenceScheduled: Boolean(anonKey),
      blockedRecommendations: sanitized.blocked,
      matchingOfficialRecords: matchingRecords.map((record) => ({
        id: record.id,
        providerRecordId: record.provider_record_id,
        sourceUrl: record.source_url,
        sourceObservedAt: record.source_observed_at,
      })),
      sourceAvailability,
    });
  } catch (error) {
    console.error("official-recommendation-guard error", error);
    return reply(
      {
        error: error instanceof Error ? error.message : "Resmî doğrulama kapısı çalıştırılamadı.",
      },
      500,
    );
  }
});
