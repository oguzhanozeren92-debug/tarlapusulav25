import { createClient } from "npm:@supabase/supabase-js@2";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "deepseek-ai/deepseek-v4-flash-0731";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function cleanJson(raw: string) {
  let value = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first !== -1 && last > first) value = value.slice(first, last + 1);
  return value;
}
function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}
function stringArray(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, limit);
}
function findCrop(snapshot: Record<string, unknown>) {
  const keys = new Set(["crop", "crop_name", "cropname", "product_name", "productname", "urun", "ürün"]);
  const queue: Array<{ value: unknown; depth: number }> = [{ value: snapshot, depth: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    if (!current.value || typeof current.value !== "object" || Array.isArray(current.value)) continue;
    for (const [key, value] of Object.entries(current.value as Record<string, unknown>)) {
      const normalizedKey = normalize(key).replace(/\s|-/g, "_");
      if (keys.has(normalizedKey) && typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
      if (current.depth < 3 && value && typeof value === "object" && !Array.isArray(value)) queue.push({ value, depth: current.depth + 1 });
    }
  }
  return null;
}
function topicsForLayer(layerType: string) {
  const layer = normalize(layerType);
  const topics = new Set<string>();
  if (/(ndvi|ndre|gndvi|savi|veget|plant|bitki)/.test(layer)) ["ndvi", "uydu", "bitki sağlığı", "vejetasyon"].forEach((x) => topics.add(x));
  if (/(water|moist|irrig|sulama|nem)/.test(layer)) ["sulama", "toprak nemi", "su stresi"].forEach((x) => topics.add(x));
  if (/(soil|toprak)/.test(layer)) ["toprak", "ph", "organik madde", "besin"].forEach((x) => topics.add(x));
  if (/(lst|temp|sicak|sıcak)/.test(layer)) ["sıcaklık", "yüzey sıcaklığı", "ısı stresi"].forEach((x) => topics.add(x));
  if (/(weather|hava|rain|yagis|yağış|wind|ruzgar|rüzgar)/.test(layer)) ["hava", "yağış", "nem", "rüzgar"].forEach((x) => topics.add(x));
  if (/(radar|\bvh\b|\bvv\b)/.test(layer)) ["radar", "toprak nemi", "bitki yapısı"].forEach((x) => topics.add(x));
  if (!topics.size && layer) topics.add(layer.replace(/[_-]+/g, " "));
  return [...topics];
}

type KnowledgeContext = {
  ref: string; claimId: string; claimText: string; crop: string | null; topics: string[]; tags: string[];
  sourcePage: number | null; sourceName: string; sourceUrl: string | null; documentTitle: string; documentId: string;
};

async function loadKnowledgeContext(supabaseAdmin: any, crop: string | null, topicTerms: string[]): Promise<KnowledgeContext[]> {
  if (!crop && topicTerms.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("knowledge_claims")
    .select(`id, claim_text, summary_tr, crop, topics, tags, source_page, reviewed_at,
      knowledge_documents!inner(id, title, source_name, source_url, status)`)
    .eq("status", "approved")
    .eq("knowledge_documents.status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(80);
  if (error) {
    console.error("[PUSULA_KNOWLEDGE_LOOKUP_ERROR]", error);
    return [];
  }

  const normalizedCrop = normalize(crop);
  const normalizedTopics = topicTerms.map(normalize).filter(Boolean);
  const scored = (data ?? []).map((row: any) => {
    const rowCrop = normalize(row.crop);
    if (normalizedCrop && rowCrop && rowCrop !== normalizedCrop) return null;
    if (!normalizedCrop && rowCrop) return null;
    const haystack = [...(Array.isArray(row.topics) ? row.topics : []), ...(Array.isArray(row.tags) ? row.tags : []), row.claim_text, row.summary_tr]
      .map(normalize).filter(Boolean);
    let hits = 0;
    for (const term of normalizedTopics) if (haystack.some((value) => value === term || value.includes(term) || term.includes(value))) hits += 1;
    const cropScore = normalizedCrop && rowCrop === normalizedCrop ? 5 : rowCrop ? 0 : 1;
    if (hits === 0 && cropScore < 5) return null;
    const document = Array.isArray(row.knowledge_documents) ? row.knowledge_documents[0] : row.knowledge_documents;
    if (!document) return null;
    return { row, document, score: cropScore + hits * 2 };
  }).filter(Boolean) as Array<{ row: any; document: any; score: number }>;
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(({ row, document }, index) => ({
    ref: `K${index + 1}`,
    claimId: String(row.id),
    claimText: String(row.claim_text ?? "").trim().slice(0, 900),
    crop: row.crop ? String(row.crop) : null,
    topics: stringArray(row.topics, 10),
    tags: stringArray(row.tags, 12),
    sourcePage: Number.isInteger(Number(row.source_page)) && Number(row.source_page) > 0 ? Number(row.source_page) : null,
    sourceName: String(document.source_name ?? "").trim(),
    sourceUrl: document.source_url ? String(document.source_url) : null,
    documentTitle: String(document.title ?? "").trim(),
    documentId: String(document.id),
  }));
}

function buildSystemPrompt(knowledge: KnowledgeContext[]) {
  const sourceBlock = knowledge.length
    ? knowledge.map((item) => `[${item.ref}] ${item.claimText}\nKaynak: ${item.sourceName || item.documentTitle}${item.sourcePage ? `, s.${item.sourcePage}` : ""}`).join("\n\n")
    : "Bu analiz için eşleşen onaylı kaynak bulunmadı.";
  return `Sen Pusula'sın — TarlaPusula uygulamasının akıllı tarım rehberisin.
Tarla, uydu/NDVI, hava, toprak ve geçmiş işlem verilerini birlikte değerlendir.

KURALLAR:
- Verilmeyen hiçbir bilgi, sayı, neden veya sonucu uydurma.
- NDVI düşüşünü otomatik olarak susuzluk, hastalık, zararlı veya besin eksikliğine bağlama.
- Yeterli veri yoksa kesin teşhis koyma; uydu verisini saha kontrolünün yerine koyma.
- Kanıtı olmayan hastalık, zararlı, kök sorunu veya besin eksikliğini isim isim sıralama.
- Gerekli veri yoksa sulama, gübreleme veya ilaçlama için kesin zaman, miktar veya doz verme.
- Veriler çelişiyorsa kısa şekilde belirt. Doğal ve sade Türkçe kullan.
- Knowledge Engine kayıtları yalnız GENEL KAYNAK BİLGİSİDİR; bu tarlada bir durumun bulunduğunun kanıtı değildir.
- Kaynak bilgisini saha/uydu/hava kanıtından ayrı tut. Kaynak kullanırsan yalnız verilen K referanslarını knowledge_refs alanına ekle.
- K referansı uydurma. Kaynak yoksa knowledge_refs boş dizi olsun.
- Kaynağa dayanarak kimyasal ürün, doz veya reçete tamamlama.

summary: En fazla 1-2 kısa cümle.
reasons: En fazla 2-3 çok kısa neden; yalnız gerçekten verilen tarla verilerine dayan.
detail: Daha kapsamlı değerlendirme; kaynak kullanılırsa genel kaynak bilgisi olduğunu ayır.
comparison_note: Önceki analiz varsa anlamlı farkı tek kısa cümleyle belirt, yoksa boş string.
knowledge_refs: Yalnız gerçekten kullanılan K1, K2 gibi verilen referanslar.

SADECE geçerli JSON:
{"summary":"kısa yorum","reasons":["kısa neden"],"detail":"detaylı analiz","comparison_note":"","knowledge_refs":[]}

ONAYLI KNOWLEDGE ENGINE BAĞLAMI:
${sourceBlock}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Sadece POST isteği kullanılabilir." }, 405);
  try {
    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!NVIDIA_API_KEY) return jsonResponse({ error: "NVIDIA_API_KEY bulunamadı." }, 500);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: "Supabase sunucu değişkenleri bulunamadı." }, 500);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonResponse({ error: "Geçerli kullanıcı oturumu gerekli." }, 401);
    const auth = await admin.auth.getUser(token);
    if (auth.error || !auth.data.user) return jsonResponse({ error: "Geçerli kullanıcı oturumu gerekli." }, 401);
    const userId = auth.data.user.id;

    let body: any;
    try { body = await req.json(); } catch { return jsonResponse({ error: "Geçerli JSON gönderilmedi." }, 400); }
    const { field_id, layer_type, analysis_date, source_snapshot, image_url } = body ?? {};
    if (!field_id) return jsonResponse({ error: "field_id gerekli." }, 400);
    if (!layer_type) return jsonResponse({ error: "layer_type gerekli." }, 400);
    if (!source_snapshot || typeof source_snapshot !== "object" || Array.isArray(source_snapshot)) return jsonResponse({ error: "source_snapshot bir JSON object olmalı." }, 400);
    const effectiveAnalysisDate = analysis_date || new Date().toISOString();

    const previous = await admin.from("map_ai_analyses").select("id,analysis_date,summary,reasons,source_snapshot")
      .eq("user_id", userId).eq("field_id", String(field_id)).eq("layer_type", String(layer_type))
      .order("analysis_date", { ascending: false }).limit(1).maybeSingle();
    if (previous.error) console.error("[PUSULA_PREVIOUS_ANALYSIS_LOOKUP]", previous.error);

    const knowledge = await loadKnowledgeContext(admin, findCrop(source_snapshot), topicsForLayer(String(layer_type)));
    const aiInput = {
      layer_type: String(layer_type), analysis_date: effectiveAnalysisDate, current_data: source_snapshot,
      previous_analysis: previous.data ? { analysis_date: previous.data.analysis_date, summary: previous.data.summary, reasons: previous.data.reasons, source_snapshot: previous.data.source_snapshot } : null,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    let response: Response;
    try {
      response = await fetch(NVIDIA_API_URL, {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [{ role: "system", content: buildSystemPrompt(knowledge) }, { role: "user", content: JSON.stringify(aiInput, null, 2) }],
          temperature: 0.2, top_p: 0.9, max_tokens: 800, stream: false,
        }),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === "AbortError") return jsonResponse({ error: "NVIDIA yanıtı zaman aşımına uğradı." }, 504);
      return jsonResponse({ error: "NVIDIA API bağlantısı kurulamadı." }, 502);
    }
    clearTimeout(timeoutId);
    if (!response.ok) {
      const providerText = await response.text();
      return jsonResponse({ error: "NVIDIA AI isteği başarısız oldu.", provider_status: response.status, provider_error: providerText.slice(0, 1500) }, 502);
    }

    const provider = await response.json();
    const raw = provider?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") return jsonResponse({ error: "NVIDIA boş cevap döndürdü." }, 502);
    let parsed: any;
    try { parsed = JSON.parse(cleanJson(raw)); } catch { return jsonResponse({ error: "AI cevabı JSON olarak işlenemedi.", raw }, 502); }

    const summary = String(parsed.summary || "").trim();
    const reasons = stringArray(parsed.reasons, 3);
    const detail = String(parsed.detail || "").trim();
    const comparisonNote = String(parsed.comparison_note || "").trim();
    if (!summary) return jsonResponse({ error: "AI kısa özet üretmedi.", raw }, 502);

    const allowedRefs = new Set(knowledge.map((item) => item.ref));
    const requestedRefs = stringArray(parsed.knowledge_refs, 5).filter((ref) => allowedRefs.has(ref));
    const used = requestedRefs.map((ref) => knowledge.find((item) => item.ref === ref)).filter(Boolean) as KnowledgeContext[];
    const knowledgeSources = used.map((item) => ({
      ref: item.ref, claim_id: item.claimId, claim_text: item.claimText, source_page: item.sourcePage,
      source_name: item.sourceName, source_url: item.sourceUrl, document_title: item.documentTitle, document_id: item.documentId,
    }));

    const saved = await admin.from("map_ai_analyses").insert({
      user_id: userId, field_id: String(field_id), layer_type: String(layer_type), analysis_date: effectiveAnalysisDate,
      summary, reasons, detail: detail || null, source_snapshot, image_url: image_url || null, model: NVIDIA_MODEL,
      comparison_note: comparisonNote || null, previous_analysis_id: previous.data?.id || null,
      status: "completed", generated_at: new Date().toISOString(), knowledge_sources: knowledgeSources,
    }).select().single();
    if (saved.error) return jsonResponse({
      error: "AI yorumu üretildi fakat veritabanına kaydedilemedi.", database_error: saved.error.message,
      pusula: { summary, reasons, detail, comparison_note: comparisonNote || null }, knowledge_sources: knowledgeSources,
    }, 500);

    return jsonResponse({
      success: true, test_mode: false, model: NVIDIA_MODEL,
      pusula: { summary, reasons, detail, comparison_note: comparisonNote || null },
      knowledge_sources: knowledgeSources, analysis: saved.data,
    });
  } catch (error) {
    console.error("[PUSULA_UNEXPECTED]", error);
    return jsonResponse({ error: "Beklenmeyen sunucu hatası.", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
