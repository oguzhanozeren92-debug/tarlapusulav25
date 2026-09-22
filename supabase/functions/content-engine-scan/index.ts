import { createClient } from "npm:@supabase/supabase-js@2";
import * as cheerio from "npm:cheerio@1.0.0";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "z-ai/glm-5.3-flash";
const SAFE_LICENSES = new Set([
  "cc0",
  "cc-by",
  "cc-by-sa",
  "public-domain",
  "public_domain",
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Source = {
  id: string;
  name: string;
  base_url: string;
  source_type: string;
  language: string;
  country: string | null;
  trust_score: number;
  scan_frequency_hours: number;
  last_scanned_at: string | null;
  metadata: Record<string, unknown> | null;
};

type Found = {
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  body: string;
  language: string;
  imageUrl: string | null;
  imageLicense: string | null;
  imageCredit: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function clean(value: unknown, max = 2000) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function list(value: unknown, max = 10) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 80)).filter(Boolean))].slice(
        0,
        max,
      )
    : [];
}

function score(value: unknown, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : fallback;
}

function license(value: unknown) {
  return clean(value, 80).toLowerCase().replace(/\s+/g, "-");
}

function absoluteUrl(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function date(value: unknown) {
  const timestamp = Date.parse(clean(value, 120));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bodyText($: cheerio.CheerioAPI) {
  for (const selector of [
    "article",
    "main",
    ".content",
    ".detail",
    ".news-detail",
    ".page-content",
  ]) {
    const node = $(selector).first();
    if (!node.length) continue;

    const clone = node.clone();
    clone
      .find("script,style,nav,header,footer,aside,form,button,.share,.social")
      .remove();

    const value = clean(clone.text(), 14000);
    if (value.length > 180) return value;
  }

  return "";
}

function imageFrom($: cheerio.CheerioAPI, pageUrl: string) {
  const meta =
    $("meta[property='og:image']").attr("content") ??
    $("meta[name='twitter:image']").attr("content");

  if (meta) return absoluteUrl(meta, pageUrl);

  const image = $("article img, main img, .content img").first();
  if (!image.length) return null;

  return absoluteUrl(
    clean(image.attr("src") ?? image.attr("data-src"), 1200),
    pageUrl,
  );
}

async function enrich(item: Found) {
  try {
    const response = await fetch(item.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "TarlaPusula-ContentEngine/1.1",
      },
    });

    if (
      !response.ok ||
      !(response.headers.get("content-type") ?? "").includes("html")
    ) {
      return item;
    }

    const $ = cheerio.load(await response.text());
    return {
      ...item,
      body: bodyText($) || item.body,
      summary:
        item.summary || clean($("meta[name='description']").attr("content"), 1600),
      imageUrl: item.imageUrl || imageFrom($, item.url),
    };
  } catch {
    return item;
  }
}

function parseFeed(raw: string, source: Source, limit: number): Found[] {
  const $ = cheerio.load(raw, { xmlMode: true });
  const output: Found[] = [];

  $("item,entry").each((_, element) => {
    if (output.length >= limit) return false;

    const node = $(element);
    const title = clean(node.find("title").first().text(), 700);
    const linkNode = node.find("link").first();
    const url = absoluteUrl(
      clean(linkNode.attr("href") ?? linkNode.text(), 1200),
      source.base_url,
    );

    if (!title || !url) return;

    const media = clean(
      node
        .find("media\\:content,media\\:thumbnail,enclosure")
        .first()
        .attr("url"),
      1200,
    );

    output.push({
      title,
      url,
      publishedAt: date(
        node.find("pubDate,published,updated,date").first().text(),
      ),
      summary: clean(
        node
          .find("description,summary,content\\:encoded,content")
          .first()
          .text(),
        2200,
      ),
      body: "",
      language: source.language || "tr",
      imageUrl: media ? absoluteUrl(media, source.base_url) : null,
      imageLicense: clean(source.metadata?.image_license, 80) || null,
      imageCredit: clean(source.metadata?.image_credit, 180) || null,
    });
  });

  return output;
}

function parseHtml(raw: string, source: Source, limit: number): Found[] {
  const $ = cheerio.load(raw);
  const output: Found[] = [];
  const seen = new Set<string>();
  const metadata = source.metadata ?? {};
  const selector =
    clean(metadata.item_selector, 300) ||
    "article a[href], main a[href], .news a[href], .duyuru a[href], .post a[href]";

  let include: RegExp | null = null;
  let exclude: RegExp | null = null;

  try {
    if (clean(metadata.include_pattern, 500)) {
      include = new RegExp(clean(metadata.include_pattern, 500), "i");
    }
  } catch {
    // Admin regex'i geçersizse filtreyi atla.
  }

  try {
    if (clean(metadata.exclude_pattern, 500)) {
      exclude = new RegExp(clean(metadata.exclude_pattern, 500), "i");
    }
  } catch {
    // Admin regex'i geçersizse filtreyi atla.
  }

  $(selector).each((_, element) => {
    if (output.length >= limit) return false;

    const anchor = $(element);
    const title = clean(anchor.attr("title") || anchor.text(), 700);
    const url = absoluteUrl(clean(anchor.attr("href"), 1200), source.base_url);

    if (!title || title.length < 18 || !url || seen.has(url)) return;

    try {
      const targetHost = new URL(url).hostname.replace(/^www\./, "");
      const sourceHost = new URL(source.base_url).hostname.replace(/^www\./, "");
      if (targetHost !== sourceHost) return;
    } catch {
      return;
    }

    const haystack = `${title} ${url}`;
    if (include && !include.test(haystack)) return;
    if (exclude && exclude.test(haystack)) return;

    seen.add(url);
    const box = anchor.closest("article,li,.item,.row,.news,.post,div");
    const image = clean(
      box.find("img").first().attr("src") ??
        box.find("img").first().attr("data-src"),
      1200,
    );

    output.push({
      title,
      url,
      publishedAt: date(
        box.find("time").first().attr("datetime") ??
          box.find("time,.date,.tarih").first().text(),
      ),
      summary: clean(
        box.find("p,.summary,.spot,.excerpt").first().text(),
        1800,
      ),
      body: "",
      language: source.language || "tr",
      imageUrl: image ? absoluteUrl(image, source.base_url) : null,
      imageLicense: clean(metadata.image_license, 80) || null,
      imageCredit: clean(metadata.image_credit, 180) || null,
    });
  });

  return output;
}

async function discover(source: Source, limit: number) {
  if (["api", "image_library"].includes(source.source_type)) return [];

  const response = await fetch(source.base_url, {
    redirect: "follow",
    signal: AbortSignal.timeout(18000),
    headers: {
      "User-Agent": "TarlaPusula-ContentEngine/1.1",
      Accept:
        "text/html,application/rss+xml,application/atom+xml,application/xml,*/*",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const raw = await response.text();
  const base =
    source.source_type === "rss" || /<rss\b|<feed\b/i.test(raw.slice(0, 1000))
      ? parseFeed(raw, source, limit)
      : parseHtml(raw, source, limit);

  const output: Found[] = [];
  for (const item of base.slice(0, limit)) {
    output.push(await enrich(item));
  }
  return output;
}

function parseAi(raw: string) {
  let value = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first >= 0 && last > first) value = value.slice(first, last + 1);
  return JSON.parse(value);
}

async function synthesize(
  item: Found,
  source: Source,
  apiKey: string,
  knowledge: any[],
  feedback: any[],
) {
  const preferred = feedback
    .filter((entry) => entry.admin_score === 5)
    .slice(0, 10)
    .map((entry) => ({
      title: entry.title_suggested,
      type: entry.candidate_type,
      category: entry.suggested_category,
      tags: entry.suggested_tags ?? [],
    }));

  const disliked = feedback
    .filter((entry) => Number(entry.admin_score) <= 2)
    .slice(0, 6)
    .map((entry) => entry.title_suggested);

  const existing = knowledge.slice(0, 70).map((entry) => ({
    id: entry.id,
    title: entry.title,
    tags: entry.tags ?? [],
    crops: entry.crop_tags ?? [],
  }));

  const systemPrompt = `TarlaPusula için editoryal taslak üret. Yalnız verilen kaynak olgularına dayan. Kaynak metni/abstractı kopyalama veya yakın paraphrase etme; bilgiyi kendi cümlelerinle özgün ve doğal Türkçe sentezle. Yabancı teknik terimi doğru Türkçeleştir. Sayı, neden, sonuç, alıntı, teşhis, kimyasal ürün/doz uydurma. Zamana bağlı gelişme=news; kalıcı bilimsel/pratik bilgi=knowledge_new. existing_knowledge içinde aynı konu açıkça varsa knowledge_update seç ve yalnız listedeki id'yi target_content_id yap. Adminin 5/5 örneklerinin sadelik/konu/yapı eğilimini izle, içeriklerini kopyalama; 1-2/5 yaklaşımlardan uzak dur. Açık lisans açıkça yoksa copyright_status=review. relevance_score Türkiye üreticisi/TarlaPusula için pratik değer; novelty_score yenilik. SADECE JSON: {"candidate_type":"news|knowledge_new|knowledge_update","target_content_id":null,"title_tr":"","short_summary_tr":"","body_tr":"","category":"","tags":[],"crops":[],"relevance_score":0,"novelty_score":0,"copyright_status":"safe|review|blocked"}`;

  const payload = {
    source: {
      name: source.name,
      url: item.url,
      language: item.language,
      trust_score: source.trust_score,
      content_license: source.metadata?.content_license ?? null,
    },
    article: {
      title: item.title,
      published_at: item.publishedAt,
      summary: item.summary,
      body: item.body.slice(0, 14000),
    },
    existing_knowledge: existing,
    admin_preferences_5_of_5: preferred,
    admin_disliked_1_2: disliked,
  };

  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(90000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.15,
      top_p: 0.9,
      max_tokens: 1600,
      reasoning_effort: "low",
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`AI HTTP ${response.status}`);

  const provider = await response.json();
  const raw = provider?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("AI boş cevap");

  const parsed = parseAi(raw);
  const type = ["news", "knowledge_new", "knowledge_update"].includes(
    parsed.candidate_type,
  )
    ? parsed.candidate_type
    : "news";
  const allowedTargets = new Set(existing.map((entry) => entry.id));
  const target = clean(parsed.target_content_id, 100);

  let copyright = ["safe", "review", "blocked"].includes(
    parsed.copyright_status,
  )
    ? parsed.copyright_status
    : "review";

  if (SAFE_LICENSES.has(license(source.metadata?.content_license))) {
    copyright = copyright === "blocked" ? "blocked" : "safe";
  }

  return {
    type:
      type === "knowledge_update" && !allowedTargets.has(target)
        ? "knowledge_new"
        : type,
    target:
      type === "knowledge_update" && allowedTargets.has(target) ? target : null,
    title: clean(parsed.title_tr, 700) || item.title,
    summary: clean(parsed.short_summary_tr, 1800),
    body: String(parsed.body_tr ?? "").trim().slice(0, 18000),
    category: clean(parsed.category, 100) || "genel",
    tags: list(parsed.tags, 12),
    crops: list(parsed.crops, 8),
    relevance: score(parsed.relevance_score),
    novelty: score(parsed.novelty_score),
    copyright,
  };
}

async function authorized(req: Request, admin: any) {
  const cronToken = req.headers.get("x-cron-token")?.trim() ?? "";
  if (cronToken) {
    const result = await admin.rpc("content_engine_check_cron_token", {
      p_token: cronToken,
    });
    if (!result.error && result.data === true) return "cron";
  }

  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return "";

  const auth = await admin.auth.getUser(token);
  if (auth.error || !auth.data.user) return "";

  const membership = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.data.user.id)
    .maybeSingle();

  return membership.data ? "admin" : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Sadece POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const aiKey = Deno.env.get("NVIDIA_API_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !aiKey) {
    return json({ error: "Sunucu yapılandırması eksik." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const mode = await authorized(req, admin);
  if (!mode) return json({ error: "Admin veya cron yetkisi gerekli." }, 403);

  try {
    const request = await req.json().catch(() => ({}));
    const settings = (
      await admin
        .from("content_engine_settings")
        .select("*")
        .eq("id", true)
        .single()
    ).data;

    if (mode === "cron" && settings?.daily_scan_enabled === false) {
      return json({ ok: true, skipped: "disabled" });
    }

    const maxSources = Math.min(
      Math.max(Number(request.maxSources) || settings?.max_sources_per_run || 20, 1),
      40,
    );
    const discoveryLimit = Math.min(
      Math.max(
        Number(request.maxItemsPerSource) || settings?.max_items_per_source || 8,
        1,
      ),
      12,
    );
    const maxAiAttemptsPerSource = Math.min(
      Math.max(
        Number(request.maxAiAttemptsPerSource) || (mode === "cron" ? 1 : 2),
        1,
      ),
      3,
    );

    let sourceQuery = admin
      .from("content_sources")
      .select("*")
      .eq("active", true)
      .neq("source_type", "image_library")
      .order("trust_score", { ascending: false })
      .limit(maxSources);

    if (request.sourceId) {
      sourceQuery = sourceQuery.eq("id", clean(request.sourceId, 100));
    }

    const sourceResult = await sourceQuery;
    if (sourceResult.error) throw sourceResult.error;

    const now = Date.now();
    const sources = (sourceResult.data as Source[]).filter(
      (source) =>
        request.sourceId ||
        !source.last_scanned_at ||
        (now - Date.parse(source.last_scanned_at)) / 3600000 >=
          source.scan_frequency_hours,
    );

    const knowledge =
      (
        await admin
          .from("content_items")
          .select("id,title,tags,crop_tags")
          .eq("content_type", "knowledge")
          .in("status", ["approved", "published"])
          .order("updated_at", { ascending: false })
          .limit(100)
      ).data ?? [];

    const feedback =
      (
        await admin
          .from("content_candidates")
          .select(
            "title_suggested,candidate_type,suggested_category,suggested_tags,admin_score",
          )
          .not("admin_score", "is", null)
          .order("reviewed_at", { ascending: false })
          .limit(40)
      ).data ?? [];

    let created = 0;
    let found = 0;
    let fresh = 0;
    const report: any[] = [];

    for (const source of sources) {
      const sourceReport: any = {
        source: source.name,
        found: 0,
        new: 0,
        candidates: 0,
        aiAttempts: 0,
      };

      try {
        const items = await discover(source, discoveryLimit);
        sourceReport.found = items.length;
        found += items.length;

        for (const item of items) {
          const fingerprint = await hash(
            `${source.id}|${item.url}|${item.title}`,
          );

          const saved = await admin
            .from("content_source_items")
            .upsert(
              {
                source_id: source.id,
                external_id: item.url,
                url: item.url,
                title: item.title,
                published_at: item.publishedAt,
                detected_language: item.language,
                raw_summary:
                  item.summary || item.body.slice(0, 2000) || null,
                fingerprint,
                raw_metadata: {
                  image_url: item.imageUrl,
                  image_license: item.imageLicense,
                  image_credit: item.imageCredit,
                },
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "source_id,fingerprint" },
            )
            .select("id")
            .single();

          if (saved.error || !saved.data) throw saved.error;

          const existingCandidate = await admin
            .from("content_candidates")
            .select("id")
            .eq("source_item_id", saved.data.id)
            .maybeSingle();

          if (existingCandidate.data) continue;

          fresh += 1;
          sourceReport.new += 1;

          if (sourceReport.aiAttempts >= maxAiAttemptsPerSource) continue;
          sourceReport.aiAttempts += 1;

          const ai = await synthesize(
            item,
            source,
            aiKey,
            knowledge,
            feedback,
          );

          if (ai.relevance < 45 || ai.copyright === "blocked") continue;

          const candidate = await admin
            .from("content_candidates")
            .insert({
              source_item_id: saved.data.id,
              candidate_type: ai.type,
              target_content_id: ai.target,
              title_suggested: ai.title,
              short_summary: ai.summary,
              body_draft: ai.body,
              source_refs: [
                {
                  source_id: source.id,
                  source_name: source.name,
                  title: item.title,
                  url: item.url,
                  published_at: item.publishedAt,
                  language: item.language,
                },
              ],
              suggested_category: ai.category,
              suggested_tags: ai.tags,
              suggested_crops: ai.crops,
              original_language: item.language,
              relevance_score: ai.relevance,
              trust_score: score(source.trust_score, 70),
              novelty_score: ai.novelty,
              copyright_status: ai.copyright,
              workflow_status: "pending",
            })
            .select("id")
            .single();

          if (candidate.error || !candidate.data) throw candidate.error;

          if (item.imageUrl) {
            let domain = "";
            try {
              domain = new URL(item.imageUrl).hostname;
            } catch {
              // Geçersiz görsel URL'si kayıt dışı bırakılmaz; domain null olur.
            }

            await admin.from("content_images").insert({
              candidate_id: candidate.data.id,
              original_url: item.imageUrl,
              source_domain: domain || null,
              license_type:
                license(item.imageLicense) || "review_required",
              credit_text: item.imageCredit,
              alt_text: ai.title,
              image_type: "cover",
              status: "pending_review",
              is_cover: true,
            });
          }

          await admin.from("content_notifications").insert({
            candidate_id: candidate.data.id,
            notification_type: "candidate_ready",
            title:
              ai.type === "news"
                ? "Yeni haber adayı"
                : ai.type === "knowledge_update"
                  ? "Bilgi Merkezi güncellemesi"
                  : "Yeni Bilgi Merkezi adayı",
            message: `${source.name}: ${ai.title}`,
          });

          created += 1;
          sourceReport.candidates += 1;
        }

        await admin
          .from("content_sources")
          .update({
            last_scanned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", source.id);
      } catch (error) {
        sourceReport.error =
          error instanceof Error ? error.message : String(error);
      }

      report.push(sourceReport);
    }

    return json({
      ok: true,
      mode,
      sourcesChecked: sources.length,
      found,
      newItems: fresh,
      candidatesCreated: created,
      report,
    });
  } catch (error) {
    console.error("[CONTENT_ENGINE]", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Tarama başarısız.",
      },
      500,
    );
  }
});
