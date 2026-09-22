import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_PDF_BYTES = 11 * 1024 * 1024;
const AUTO_IMPORT_LICENSES = new Set(["cc0", "cc-by", "public-domain"]);
function cleanText(value: unknown, max = 500) { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max); }
function stringList(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 160)).filter(Boolean))].slice(0, limit);
}
function yearValue(value: unknown) {
  const year = Number(value); const current = new Date().getUTCFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= current + 1 ? year : null;
}
function compactAuthors(authorships: any[]) {
  if (!Array.isArray(authorships)) return [];
  return authorships.slice(0, 20).map((item) => ({ name: cleanText(item?.author?.display_name, 180), orcid: item?.author?.orcid ? cleanText(item.author.orcid, 220) : null })).filter((item) => item.name);
}
function compactTopics(topics: any[]) {
  if (!Array.isArray(topics)) return [];
  return stringList(topics.map((item) => item?.display_name), 12);
}
function safeId(value: string) { return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(-100) || crypto.randomUUID(); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Sadece POST." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return reply({ error: "Sunucu yapılandırması eksik." }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ error: "Oturum gerekli." }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const authResult = await userClient.auth.getUser(token);
  if (authResult.error || !authResult.data.user) return reply({ error: "Geçersiz oturum." }, 401);
  const adminCheck = await userClient.rpc("is_admin");
  if (adminCheck.error || adminCheck.data !== true) return reply({ error: "Admin yetkisi gerekli." }, 403);
  const userId = authResult.data.user.id;

  try {
    const body = await req.json();
    const action = cleanText(body?.action || "scan", 30).toLowerCase();

    if (action === "import") {
      const candidateId = cleanText(body?.candidateId, 100);
      if (!candidateId) return reply({ error: "candidateId gerekli." }, 400);
      const candidateResult = await admin.from("knowledge_article_candidates").select("*").eq("id", candidateId).maybeSingle();
      if (candidateResult.error) throw candidateResult.error;
      const candidate = candidateResult.data;
      if (!candidate) return reply({ error: "Makale adayı bulunamadı." }, 404);
      if (candidate.document_id) return reply({ success: true, alreadyImported: true, documentId: candidate.document_id });

      const license = cleanText(candidate.license, 120).toLowerCase();
      if (!candidate.pdf_url) return reply({ error: "Bu aday için doğrudan açık PDF bağlantısı yok." }, 400);
      if (!AUTO_IMPORT_LICENSES.has(license)) {
        return reply({ error: "Otomatik PDF aktarımı yalnız CC0, CC BY veya public-domain lisanslı açık kopyalarda yapılır. Diğer kaynakları bağlantısından inceleyip elle yükleyebilirsin." }, 400);
      }

      const pdfResponse = await fetch(String(candidate.pdf_url), { redirect: "follow", headers: { "User-Agent": "TarlaPusula-Knowledge-Radar/1.0" } });
      if (!pdfResponse.ok) return reply({ error: `Açık PDF indirilemedi (HTTP ${pdfResponse.status}).` }, 502);
      const declaredSize = Number(pdfResponse.headers.get("content-length") || 0);
      if (declaredSize > MAX_PDF_BYTES) return reply({ error: "Açık PDF 11 MB sınırını aşıyor." }, 400);
      const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_PDF_BYTES) return reply({ error: "PDF boş veya 11 MB sınırını aşıyor." }, 400);
      const magic = new TextDecoder().decode(bytes.subarray(0, Math.min(5, bytes.length)));
      if (!magic.startsWith("%PDF")) return reply({ error: "Açık erişim bağlantısı geçerli bir PDF döndürmedi." }, 400);

      const providerTail = safeId(String(candidate.provider_id).split("/").pop() || candidate.id);
      const path = `${userId}/radar/${new Date().getUTCFullYear()}/${providerTail}.pdf`;
      const upload = await admin.storage.from("knowledge-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw upload.error;

      const inserted = await admin.from("knowledge_documents").insert({
        title: candidate.title,
        source_name: candidate.source_name || "OpenAlex",
        source_url: candidate.oa_url || candidate.doi || null,
        storage_bucket: "knowledge-documents",
        storage_path: path,
        mime_type: "application/pdf",
        file_size: bytes.length,
        language: candidate.language || "tr",
        status: "queued",
        created_by: userId,
        metadata: {
          origin: "openalex-radar",
          candidateId: candidate.id,
          openalexId: candidate.provider_id,
          doi: candidate.doi,
          license: candidate.license,
          publicationYear: candidate.publication_year,
        },
      }).select("*").single();
      if (inserted.error || !inserted.data) {
        await admin.storage.from("knowledge-documents").remove([path]);
        throw inserted.error ?? new Error("Knowledge belgesi oluşturulamadı.");
      }

      const now = new Date().toISOString();
      const mark = await admin.from("knowledge_article_candidates").update({
        status: "imported", document_id: inserted.data.id, reviewed_by: userId, reviewed_at: now, updated_at: now,
      }).eq("id", candidate.id);
      if (mark.error) console.error("[RADAR_MARK_IMPORTED]", mark.error);

      let extraction: any = null;
      let extractionError: string | null = null;
      try {
        const extractionResponse = await fetch(`${supabaseUrl}/functions/v1/knowledge-document-extract`, {
          method: "POST",
          headers: { Authorization: authorization, apikey: anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: inserted.data.id }),
        });
        const extractionPayload = await extractionResponse.json().catch(() => ({}));
        if (!extractionResponse.ok || extractionPayload?.error) extractionError = cleanText(extractionPayload?.error || `HTTP ${extractionResponse.status}`, 1000);
        else extraction = extractionPayload;
      } catch (error) {
        extractionError = error instanceof Error ? error.message : "Belge çıkarımı başlatılamadı.";
      }

      return reply({ success: true, imported: true, documentId: inserted.data.id, extraction, extractionError });
    }

    if (action !== "scan") return reply({ error: "Geçersiz radar işlemi." }, 400);
    const query = cleanText(body?.query, 240);
    if (query.length < 3) return reply({ error: "Arama en az 3 karakter olmalı." }, 400);
    const currentYear = new Date().getUTCFullYear();
    const fromYear = yearValue(body?.fromYear) ?? Math.max(2000, currentYear - 5);
    const perPage = Math.max(1, Math.min(Number(body?.limit) || 20, 30));
    const openAccessOnly = body?.openAccessOnly !== false;

    const params = new URLSearchParams({
      search: query,
      sort: "-relevance_score",
      "per-page": String(perPage),
      select: "id,doi,title,publication_year,publication_date,type,language,cited_by_count,open_access,best_oa_location,primary_location,authorships,topics",
    });
    const filters = [`from_publication_date:${fromYear}-01-01`];
    if (openAccessOnly) filters.push("open_access.is_oa:true");
    params.set("filter", filters.join(","));
    const apiKey = cleanText(Deno.env.get("OPENALEX_API_KEY"), 240);
    if (apiKey) params.set("api_key", apiKey);

    const response = await fetch(`https://api.openalex.org/works?${params.toString()}`, { headers: { "User-Agent": "TarlaPusula-Knowledge-Radar/1.0" } });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return reply({
        error: response.status === 401 || response.status === 403 ? "OpenAlex erişimi API anahtarı istiyor. OPENALEX_API_KEY eklenmeli." : "OpenAlex taraması başarısız oldu.",
        provider_status: response.status,
        provider_detail: detail.slice(0, 500),
      }, 502);
    }

    const payload = await response.json();
    const works = Array.isArray(payload?.results) ? payload.results : [];
    const rows = works.map((work: any) => {
      const best = work?.best_oa_location ?? null;
      const primary = work?.primary_location ?? null;
      const source = primary?.source ?? best?.source ?? null;
      return {
        provider: "openalex", provider_id: cleanText(work?.id, 240), title: cleanText(work?.title, 700),
        doi: work?.doi ? cleanText(work.doi, 280) : null,
        publication_date: /^\d{4}-\d{2}-\d{2}$/.test(String(work?.publication_date ?? "")) ? work.publication_date : null,
        publication_year: yearValue(work?.publication_year), work_type: cleanText(work?.type, 100) || null,
        language: cleanText(work?.language, 30) || null, authors: compactAuthors(work?.authorships),
        source_name: cleanText(source?.display_name, 300) || null, cited_by_count: Math.max(0, Number(work?.cited_by_count) || 0),
        topics: compactTopics(work?.topics), is_oa: work?.open_access?.is_oa === true,
        oa_status: cleanText(work?.open_access?.oa_status, 50) || null,
        oa_url: work?.open_access?.oa_url ? cleanText(work.open_access.oa_url, 1000) : null,
        pdf_url: best?.pdf_url ? cleanText(best.pdf_url, 1000) : null,
        license: best?.license ? cleanText(best.license, 120) : null,
        search_query: query,
        metadata: { bestOaVersion: best?.version ?? null, sourceIsInDoaj: source?.is_in_doaj ?? null, sourceType: source?.type ?? null },
        updated_at: new Date().toISOString(),
      };
    }).filter((row: any) => row.provider_id && row.title);

    if (rows.length) {
      const upsert = await admin.from("knowledge_article_candidates").upsert(rows, { onConflict: "provider,provider_id", ignoreDuplicates: false });
      if (upsert.error) throw upsert.error;
    }
    return reply({ success: true, provider: "openalex", query, fromYear, openAccessOnly, found: works.length, stored: rows.length, providerCost: payload?.meta?.cost_usd ?? null });
  } catch (error) {
    console.error("[KNOWLEDGE_ARTICLE_RADAR_ERROR]", error);
    return reply({ error: error instanceof Error ? error.message : "Makale radarı çalıştırılamadı." }, 500);
  }
});
