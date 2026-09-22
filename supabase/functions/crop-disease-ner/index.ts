import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const models = [
  ...new Set([
    (Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash').trim(),
    'gemini-3.7-flash',
    'gemini-3.6-flash',
  ]),
];

const geminiBase = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_TEXT_CHARS = 18_000;
const MAX_ENTITIES = 120;
const REQUEST_TIMEOUT_MS = 45_000;

export type CropDiseaseEntityType =
  | 'crop'
  | 'disease'
  | 'pest'
  | 'pathogen'
  | 'symptom'
  | 'location'
  | 'control_method'
  | 'chemical';

type RawEntity = {
  text?: unknown;
  type?: unknown;
  normalized?: unknown;
  scientificName?: unknown;
  confidence?: unknown;
};

type CropDiseaseEntity = {
  text: string;
  type: CropDiseaseEntityType;
  normalized: string | null;
  scientific_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  start: number;
  end: number;
};

const ALLOWED_TYPES = new Set<CropDiseaseEntityType>([
  'crop',
  'disease',
  'pest',
  'pathogen',
  'symptom',
  'location',
  'control_method',
  'chemical',
]);

function clean(value: unknown, max = 240) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, max) : null;
}

function cleanJson(raw: string) {
  const value = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  return start >= 0 && end > start ? value.slice(start, end + 1) : value;
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('tr-TR');
}

function confidence(value: unknown): 'high' | 'medium' | 'low' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

function locateExactMention(sourceText: string, entityText: string) {
  const exactIndex = sourceText.indexOf(entityText);
  if (exactIndex >= 0) {
    return {
      start: exactIndex,
      end: exactIndex + entityText.length,
      text: sourceText.slice(exactIndex, exactIndex + entityText.length),
    };
  }

  const sourceLower = normalizeSearch(sourceText);
  const entityLower = normalizeSearch(entityText);
  const foldedIndex = sourceLower.indexOf(entityLower);

  if (foldedIndex < 0) return null;

  return {
    start: foldedIndex,
    end: foldedIndex + entityText.length,
    text: sourceText.slice(foldedIndex, foldedIndex + entityText.length),
  };
}

function normalizeEntities(sourceText: string, value: unknown) {
  const rawEntities = Array.isArray((value as any)?.entities)
    ? (value as any).entities
    : [];

  const entities: CropDiseaseEntity[] = [];
  const seen = new Set<string>();

  for (const raw of rawEntities as RawEntity[]) {
    const entityText = clean(raw?.text, 220);
    const rawType = clean(raw?.type, 60)?.toLowerCase() as CropDiseaseEntityType | undefined;

    if (!entityText || !rawType || !ALLOWED_TYPES.has(rawType)) continue;

    const mention = locateExactMention(sourceText, entityText);
    if (!mention) continue;

    const key = `${rawType}:${mention.start}:${mention.end}:${normalizeSearch(mention.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entities.push({
      text: mention.text,
      type: rawType,
      normalized: clean(raw?.normalized, 220),
      scientific_name: clean(raw?.scientificName, 220),
      confidence: confidence(raw?.confidence),
      start: mention.start,
      end: mention.end,
    });

    if (entities.length >= MAX_ENTITIES) break;
  }

  return entities.sort((a, b) => a.start - b.start || a.end - b.end);
}

function buildSummary(entities: CropDiseaseEntity[]) {
  const counts: Record<string, number> = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }
  return counts;
}

function prompt(text: string, language: string | null) {
  return `Sen TarlaPusula tarımsal Named Entity Recognition katmanısın.

Amaç: Aşağıdaki metinde AÇIKÇA geçen tarımsal varlıkları etiketle.
Metinde bulunmayan hiçbir varlığı üretme. Tedavi, doz, ilaç önerisi veya teşhis yapma.
Entity text alanı METİNDE BİREBİR GEÇEN ifade olmalı; çeviri veya yeniden yazım yapma.

İzin verilen türler:
- crop: ürün / bitki / çeşit
- disease: bitki hastalığı adı
- pest: zararlı böcek, akar, nematod vb.
- pathogen: mantar, bakteri, virüs, oomycete vb. patojen adı
- symptom: bitkide gözlenen belirti/bulgu
- location: hastalık/zararlı bağlamında geçen coğrafi yer
- control_method: metinde geçen kültürel/biyolojik/mekanik mücadele yöntemi
- chemical: metinde geçen aktif madde veya kimyasal/ilaç adı; bu yalnızca varlık etiketidir, öneri değildir

normalized alanı varsa Türkçe/standart kısa adı; yoksa null.
scientificName yalnız metin veya güçlü terminolojik eşleşme açıkça destekliyorsa bilimsel ad; aksi halde null.
confidence yalnız high|medium|low.

Dil ipucu: ${language || 'otomatik'}
Yalnız geçerli JSON döndür:
{"entities":[{"text":"...","type":"crop|disease|pest|pathogen|symptom|location|control_method|chemical","normalized":"... veya null","scientificName":"... veya null","confidence":"high|medium|low"}]}

METİN:
${text}`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runGemini(apiKey: string, instruction: string) {
  const failures: string[] = [];

  for (const model of models) {
    try {
      const response = await fetchWithTimeout(
        `${geminiBase}/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: instruction }],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        failures.push(
          `${model}: HTTP ${response.status} ${(await response.text().catch(() => '')).slice(0, 180)}`,
        );
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }

      const payload = await response.json();
      const raw = (payload?.candidates?.[0]?.content?.parts ?? [])
        .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      if (!raw) {
        failures.push(`${model}: boş yanıt`);
        continue;
      }

      return {
        model,
        payload: JSON.parse(cleanJson(raw)),
      };
    } catch (error) {
      failures.push(
        `${model}: ${error instanceof Error ? error.message : 'bilinmeyen hata'}`,
      );
    }
  }

  throw new Error(`Crop Disease NER tamamlanamadı. ${failures.join(' | ')}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Sadece POST.' }, 405);

  const apiKey = (Deno.env.get('GEMINI_API_KEY') ?? '').trim();
  if (!apiKey) {
    return reply({ error: 'GEMINI_API_KEY yapılandırılmadı.' }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawText = String(body?.text ?? '').trim();
    const language = clean(body?.language, 30);

    if (rawText.length < 3) {
      return reply({ error: 'NER için en az 3 karakter metin gerekli.' }, 400);
    }

    const text = rawText.slice(0, MAX_TEXT_CHARS);
    const truncated = rawText.length > text.length;

    const result = await runGemini(apiKey, prompt(text, language));
    const entities = normalizeEntities(text, result.payload);

    return reply({
      ok: true,
      source: 'TarlaPusula Crop Disease NER',
      model: result.model,
      text_length: text.length,
      truncated,
      entities,
      entity_count: entities.length,
      entity_counts: buildSummary(entities),
      production_authority: false,
      diagnosis_authority: false,
      research_reference: {
        project: 'shenjie-hyc/CropDiseaseNer',
        role: 'task-taxonomy-reference-only',
        upstream_data_used: false,
        upstream_license_status: 'not-declared',
        note:
          'Upstream veri seti uygulamaya kopyalanmaz veya paketlenmez. Yalnız tarımsal NER görev sınıfları araştırma referansı olarak kullanılır.',
      },
      safeguards: [
        'Yalnız kaynak metinde birebir bulunan entity mention kayıtları kabul edilir.',
        'Kimyasal isimler yalnız metin varlığıdır; uygulama önerisi veya reçete değildir.',
        'NER çıktısı hastalık teşhisi sayılmaz; PHI-base, saha fotoğrafı, hava ve uydu kanıtlarıyla ayrıca doğrulanmalıdır.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CROP_DISEASE_NER_ERROR]', error);
    return reply(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Crop Disease NER çalıştırılamadı.',
      },
      500,
    );
  }
});
