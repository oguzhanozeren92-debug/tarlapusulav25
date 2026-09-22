import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const models = [...new Set([(Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash").trim(), "gemini-3.7-flash", "gemini-3.6-flash"])];
const geminiBase = "https://generativelanguage.googleapis.com/v1beta/models";
const maxPdfBytes = 11 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function cleanJson(raw: string) {
  const value = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start >= 0 && end > start ? value.slice(start, end + 1) : value;
}
function stringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, limit);
}
function page(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function confidence(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  return raw === "strong" || raw === "medium" ? raw : "preliminary";
}
function normalize(value: any) {
  return {
    documentTitle: String(value?.documentTitle ?? "").trim().slice(0, 300),
    language: String(value?.language ?? "tr").trim().slice(0, 20) || "tr",
    pageCount: page(value?.pageCount),
    crops: stringList(value?.crops, 20),
    topics: stringList(value?.topics, 30),
    claims: (Array.isArray(value?.claims) ? value.claims : []).map((item: any) => ({
      claimText: String(item?.claimText ?? item?.claim ?? "").trim().slice(0, 1800),
      summaryTr: String(item?.summaryTr ?? "").trim().slice(0, 700),
      crop: String(item?.crop ?? "").trim().slice(0, 120) || null,
      topics: stringList(item?.topics, 10),
      tags: stringList(item?.tags, 12),
      sourcePage: page(item?.sourcePage ?? item?.page),
      evidenceExcerpt: String(item?.evidenceExcerpt ?? "").trim().slice(0, 320) || null,
      confidence: confidence(item?.confidence),
    })).filter((item: any) => item.claimText).slice(0, 60),
    relations: (Array.isArray(value?.relations) ? value.relations : []).map((item: any) => ({
      claimIndex: Number.isInteger(Number(item?.claimIndex)) ? Number(item.claimIndex) : null,
      subjectType: String(item?.subjectType ?? "concept").trim().slice(0, 80) || "concept",
      subjectName: String(item?.subjectName ?? item?.subject ?? "").trim().slice(0, 180),
      relation: String(item?.relation ?? "related_to").trim().slice(0, 120) || "related_to",
      objectType: String(item?.objectType ?? "concept").trim().slice(0, 80) || "concept",
      objectName: String(item?.objectName ?? item?.object ?? "").trim().slice(0, 180),
      sourcePage: page(item?.sourcePage ?? item?.page),
    })).filter((item: any) => item.subjectName && item.objectName).slice(0, 80),
  };
}
function prompt(title: string, sourceName: string) {
  return `Sen TarlaPusula Knowledge Engine belge çıkarım katmanısın.
Belge başlığı: ${title || "Bilinmiyor"}
Kaynak: ${sourceName || "Bilinmiyor"}

PDF'de AÇIKÇA yazan tarımsal bilgi iddialarını çıkar. Metinde bulunmayan bilgi, neden-sonuç, teşhis, doz, eşik veya öneri uydurma. Her iddiayı tek başına anlaşılabilir kısa cümle yap. sourcePage yalnız sayfayı güvenle eşleyebiliyorsan sayı, aksi halde null olsun. evidenceExcerpt yalnız iddiayı destekleyen çok kısa belge parçası olsun. crop yoksa null. confidence yalnız explicit metin + sayfa eşleşmesi güçlü ise strong, anlam açık ama bağlam/sayfa kısmen belirsizse medium, diğer durumda preliminary. Knowledge Graph relations yalnız belgede açıkça desteklenen ilişkileri içersin. relation kısa snake_case olsun. claimIndex 0 tabanlı claims dizisindeki ilgili iddiayı işaret etsin; eşleyemiyorsan null. Kimyasal ürün/doz/reçete üretme veya tamamlama yapma. En fazla 60 iddia, 80 ilişki. Yalnız geçerli JSON döndür.

{"documentTitle":"...","language":"tr","pageCount":12,"crops":["Buğday"],"topics":["fenoloji"],"claims":[{"claimText":"...","summaryTr":"...","crop":"Buğday veya null","topics":["..."],"tags":["..."],"sourcePage":3,"evidenceExcerpt":"...","confidence":"strong|medium|preliminary"}],"relations":[{"claimIndex":0,"subjectType":"crop|disease|pest|nutrient|practice|climate|soil|phenology|concept","subjectName":"...","relation":"associated_with","objectType":"concept","objectName":"...","sourcePage":3}]}`;
}
async function runGemini(apiKey: string, pdf: string, instruction: string) {
  const failures: string[] = [];
  for (const model of models) {
    try {
      const response = await fetch(`${geminiBase}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instruction }, { inlineData: { mimeType: "application/pdf", data: pdf } }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) {
        failures.push(`${model}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 160)}`);
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      const payload = await response.json();
      const raw = (payload?.candidates?.[0]?.content?.parts ?? []).map((part: any) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("\n").trim();
      if (!raw) { failures.push(`${model}: boş yanıt`); continue; }
      return { model, extraction: normalize(JSON.parse(cleanJson(raw))) };
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }
  throw new Error(`Belge çıkarımı tamamlanamadı. ${failures.join(" | ")}`);
}

async function runCropDiseaseNer(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
  extraction: ReturnType<typeof normalize>,
) {
  const text = extraction.claims
    .map((claim: any, index: number) => {
      const summary = claim.summaryTr ? `\nÖzet: ${claim.summaryTr}` : "";
      return `[${index + 1}] ${claim.claimText}${summary}`;
    })
    .join("\n\n")
    .slice(0, 18_000);

  if (text.length < 3) return null;

  const response = await fetch(`${supabaseUrl}/functions/v1/crop-disease-ner`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language: extraction.language,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false || payload?.error) {
    throw new Error(String(payload?.error || `Crop Disease NER HTTP ${response.status}`));
  }

  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Sadece POST." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) return reply({ error: "Knowledge Engine sunucu yapılandırması eksik." }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ error: "Oturum gerekli." }, 401);
  const user = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await user.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Geçersiz oturum." }, 401);
  const adminCheck = await user.rpc("is_admin");
  if (adminCheck.error || adminCheck.data !== true) return reply({ error: "Admin yetkisi gerekli." }, 403);

  let documentId = "";
  try {
    const body = await req.json();
    documentId = String(body?.documentId ?? "").trim();
    if (!documentId) return reply({ error: "documentId gerekli." }, 400);
    const documentResult = await admin.from("knowledge_documents").select("*").eq("id", documentId).maybeSingle();
    if (documentResult.error) throw documentResult.error;
    const document = documentResult.data;
    if (!document) return reply({ error: "Belge bulunamadı." }, 404);
    if (document.status === "approved") return reply({ error: "Yayındaki belge yeniden çıkarılamaz; önce yayından kaldırılmalı." }, 409);
    if (document.mime_type !== "application/pdf") return reply({ error: "Yalnızca PDF destekleniyor." }, 400);

    const now = new Date().toISOString();
    await admin.from("knowledge_documents").update({ status: "processing", error_message: null, updated_at: now }).eq("id", documentId);
    const download = await admin.storage.from(document.storage_bucket).download(document.storage_path);
    if (download.error || !download.data) throw download.error ?? new Error("PDF indirilemedi.");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (!bytes.length) throw new Error("PDF dosyası boş.");
    if (bytes.length > maxPdfBytes) throw new Error("PDF çıkarım için 11 MB sınırını aşıyor.");

    const result = await runGemini(geminiApiKey, bytesToBase64(bytes), prompt(document.title, document.source_name));
    if (!result.extraction.claims.length) throw new Error("Belgeden doğrulanabilir iddia adayı çıkarılamadı.");

    let ner: any = null;
    let nerError: string | null = null;
    try {
      ner = await runCropDiseaseNer(supabaseUrl, anonKey, authorization, result.extraction);
    } catch (error) {
      nerError = error instanceof Error ? error.message : "Crop Disease NER çalıştırılamadı.";
      console.warn("[KNOWLEDGE_NER_WARNING]", nerError);
    }

    const relationDelete = await admin.from("knowledge_relations").delete().eq("document_id", documentId).neq("status", "approved");
    if (relationDelete.error) throw relationDelete.error;
    const claimDelete = await admin.from("knowledge_claims").delete().eq("document_id", documentId).neq("status", "approved");
    if (claimDelete.error) throw claimDelete.error;

    const inserted = await admin.from("knowledge_claims").insert(result.extraction.claims.map((claim: any) => ({
      document_id: documentId, claim_text: claim.claimText, summary_tr: claim.summaryTr, crop: claim.crop,
      topics: claim.topics, tags: claim.tags, source_page: claim.sourcePage, evidence_excerpt: claim.evidenceExcerpt,
      extraction_confidence: claim.confidence, status: "candidate",
    }))).select("id");
    if (inserted.error) throw inserted.error;

    if (result.extraction.relations.length) {
      const graph = await admin.from("knowledge_relations").insert(result.extraction.relations.map((relation: any) => ({
        document_id: documentId,
        claim_id: relation.claimIndex !== null ? inserted.data?.[relation.claimIndex]?.id ?? null : null,
        subject_type: relation.subjectType, subject_name: relation.subjectName, relation: relation.relation,
        object_type: relation.objectType, object_name: relation.objectName, source_page: relation.sourcePage, status: "candidate",
      })));
      if (graph.error) throw graph.error;
    }

    let nerRelationCount = 0;
    if (Array.isArray(ner?.entities) && ner.entities.length) {
      const seen = new Set<string>();
      const nerRows = ner.entities
        .map((entity: any) => ({
          type: String(entity?.type ?? "concept").trim().slice(0, 80) || "concept",
          name: String(entity?.normalized ?? entity?.text ?? "").trim().slice(0, 180),
        }))
        .filter((entity: any) => {
          if (!entity.name) return false;
          const key = `${entity.type}:${entity.name.toLocaleLowerCase("tr-TR")}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 80)
        .map((entity: any) => ({
          document_id: documentId,
          claim_id: null,
          subject_type: "document",
          subject_name: String(document.title ?? "Belge").slice(0, 180),
          relation: "mentions",
          object_type: entity.type,
          object_name: entity.name,
          source_page: null,
          status: "candidate",
        }));

      if (nerRows.length) {
        const nerGraph = await admin.from("knowledge_relations").insert(nerRows);
        if (nerGraph.error) throw nerGraph.error;
        nerRelationCount = nerRows.length;
      }
    }

    const completedAt = new Date().toISOString();
    const totalRelationCount = result.extraction.relations.length + nerRelationCount;
    const update = await admin.from("knowledge_documents").update({
      language: result.extraction.language,
      status: "review",
      extraction_model: result.model,
      page_count: result.extraction.pageCount,
      metadata: {
        ...(document.metadata ?? {}),
        crops: result.extraction.crops,
        topics: result.extraction.topics,
        extractedClaimCount: result.extraction.claims.length,
        extractedRelationCount: totalRelationCount,
        extractedAt: completedAt,
        cropDiseaseNer: ner
          ? {
              model: ner.model ?? null,
              entityCount: Number(ner.entity_count ?? ner.entities?.length ?? 0),
              entityCounts: ner.entity_counts ?? {},
              researchReference: ner.research_reference ?? null,
              diagnosisAuthority: false,
              generatedAt: ner.generated_at ?? null,
            }
          : {
              error: nerError,
              diagnosisAuthority: false,
            },
      },
      error_message: null,
      updated_at: completedAt,
    }).eq("id", documentId);
    if (update.error) throw update.error;

    return reply({
      documentId,
      status: "review",
      model: result.model,
      claimCount: result.extraction.claims.length,
      relationCount: totalRelationCount,
      nerEntityCount: Number(ner?.entity_count ?? ner?.entities?.length ?? 0),
      nerError,
      pageCount: result.extraction.pageCount,
      crops: result.extraction.crops,
      topics: result.extraction.topics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    if (documentId) await admin.from("knowledge_documents").update({ status: "failed", error_message: message.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", documentId);
    console.error("[KNOWLEDGE_EXTRACT_ERROR]", error);
    return reply({ error: message }, 500);
  }
});
