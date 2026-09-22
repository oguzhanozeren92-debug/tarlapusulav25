import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';
import Papa from 'npm:papaparse@5.4.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PHIBASE_META_URL =
  'https://api.github.com/repos/PHI-base/data/contents/releases/phi-base_current.csv?ref=master';
const PHIBASE_REPO_URL = 'https://github.com/PHI-base/data';
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_RESULTS = 12;

type HostMapping = {
  canonical: string;
  aliases: string[];
};

type PathogenAggregate = {
  pathogenSpecies: string;
  diseases: Set<string>;
  genes: Set<string>;
  phenotypes: Set<string>;
  interactionPhenotypes: Set<string>;
  pmids: Set<string>;
  dois: Set<string>;
  years: Set<string>;
  tissues: Set<string>;
  recordCount: number;
};

const HOSTS: Record<string, HostMapping> = {
  bugday: { canonical: 'Triticum aestivum', aliases: ['Triticum aestivum', 'Triticum'] },
  arpa: { canonical: 'Hordeum vulgare', aliases: ['Hordeum vulgare', 'Hordeum'] },
  misir: { canonical: 'Zea mays', aliases: ['Zea mays', 'Zea'] },
  'seker misiri': { canonical: 'Zea mays', aliases: ['Zea mays', 'Zea'] },
  cavdar: { canonical: 'Secale cereale', aliases: ['Secale cereale', 'Secale'] },
  yulaf: { canonical: 'Avena sativa', aliases: ['Avena sativa', 'Avena'] },
  tritikale: { canonical: 'Triticosecale', aliases: ['Triticosecale', 'x Triticosecale', '× Triticosecale'] },
  aycicegi: { canonical: 'Helianthus annuus', aliases: ['Helianthus annuus', 'Helianthus'] },
  pamuk: { canonical: 'Gossypium hirsutum', aliases: ['Gossypium hirsutum', 'Gossypium'] },
  'cukurova pamugu': { canonical: 'Gossypium hirsutum', aliases: ['Gossypium hirsutum', 'Gossypium'] },
  'soya fasulyesi': { canonical: 'Glycine max', aliases: ['Glycine max', 'Glycine'] },
  pancar: { canonical: 'Beta vulgaris', aliases: ['Beta vulgaris', 'Beta'] },
  'seker pancari': { canonical: 'Beta vulgaris', aliases: ['Beta vulgaris', 'Beta'] },
  patates: { canonical: 'Solanum tuberosum', aliases: ['Solanum tuberosum'] },
  domates: { canonical: 'Solanum lycopersicum', aliases: ['Solanum lycopersicum', 'Lycopersicon esculentum'] },
  biber: { canonical: 'Capsicum annuum', aliases: ['Capsicum annuum', 'Capsicum'] },
  patlican: { canonical: 'Solanum melongena', aliases: ['Solanum melongena'] },
  hiyar: { canonical: 'Cucumis sativus', aliases: ['Cucumis sativus'] },
  karpuz: { canonical: 'Citrullus lanatus', aliases: ['Citrullus lanatus', 'Citrullus'] },
  kavun: { canonical: 'Cucumis melo', aliases: ['Cucumis melo'] },
  kabak: { canonical: 'Cucurbita', aliases: ['Cucurbita pepo', 'Cucurbita maxima', 'Cucurbita moschata', 'Cucurbita'] },
  'bal kabagi': { canonical: 'Cucurbita', aliases: ['Cucurbita pepo', 'Cucurbita maxima', 'Cucurbita moschata', 'Cucurbita'] },
  'cerezlik kabak': { canonical: 'Cucurbita pepo', aliases: ['Cucurbita pepo', 'Cucurbita'] },
  fasulye: { canonical: 'Phaseolus vulgaris', aliases: ['Phaseolus vulgaris', 'Phaseolus'] },
  'kuru fasulye': { canonical: 'Phaseolus vulgaris', aliases: ['Phaseolus vulgaris', 'Phaseolus'] },
  bezelye: { canonical: 'Pisum sativum', aliases: ['Pisum sativum', 'Pisum'] },
  nohut: { canonical: 'Cicer arietinum', aliases: ['Cicer arietinum', 'Cicer'] },
  mercimek: { canonical: 'Lens culinaris', aliases: ['Lens culinaris', 'Lens'] },
  bakla: { canonical: 'Vicia faba', aliases: ['Vicia faba'] },
  'aci bakla': { canonical: 'Lupinus', aliases: ['Lupinus angustifolius', 'Lupinus albus', 'Lupinus'] },
  'kolza kanola': { canonical: 'Brassica napus', aliases: ['Brassica napus'] },
  'kolza (kanola)': { canonical: 'Brassica napus', aliases: ['Brassica napus'] },
  'beyaz lahana': { canonical: 'Brassica oleracea', aliases: ['Brassica oleracea'] },
  'kirmizi lahana': { canonical: 'Brassica oleracea', aliases: ['Brassica oleracea'] },
  brokoli: { canonical: 'Brassica oleracea', aliases: ['Brassica oleracea'] },
  karnabahar: { canonical: 'Brassica oleracea', aliases: ['Brassica oleracea'] },
  alabas: { canonical: 'Brassica oleracea', aliases: ['Brassica oleracea'] },
  marul: { canonical: 'Lactuca sativa', aliases: ['Lactuca sativa', 'Lactuca'] },
  sogan: { canonical: 'Allium cepa', aliases: ['Allium cepa'] },
  sarimsak: { canonical: 'Allium sativum', aliases: ['Allium sativum'] },
  havuc: { canonical: 'Daucus carota', aliases: ['Daucus carota'] },
  ispanak: { canonical: 'Spinacia oleracea', aliases: ['Spinacia oleracea'] },
  elma: { canonical: 'Malus domestica', aliases: ['Malus domestica', 'Malus x domestica', 'Malus'] },
  armut: { canonical: 'Pyrus communis', aliases: ['Pyrus communis', 'Pyrus'] },
  uzum: { canonical: 'Vitis vinifera', aliases: ['Vitis vinifera', 'Vitis'] },
  findik: { canonical: 'Corylus avellana', aliases: ['Corylus avellana', 'Corylus'] },
  zeytin: { canonical: 'Olea europaea', aliases: ['Olea europaea', 'Olea'] },
  seftali: { canonical: 'Prunus persica', aliases: ['Prunus persica'] },
  nektarin: { canonical: 'Prunus persica', aliases: ['Prunus persica'] },
  kayisi: { canonical: 'Prunus armeniaca', aliases: ['Prunus armeniaca'] },
  kiraz: { canonical: 'Prunus avium', aliases: ['Prunus avium'] },
  visne: { canonical: 'Prunus cerasus', aliases: ['Prunus cerasus'] },
  erik: { canonical: 'Prunus domestica', aliases: ['Prunus domestica', 'Prunus'] },
  badem: { canonical: 'Prunus dulcis', aliases: ['Prunus dulcis', 'Prunus amygdalus'] },
  incir: { canonical: 'Ficus carica', aliases: ['Ficus carica', 'Ficus'] },
  nar: { canonical: 'Punica granatum', aliases: ['Punica granatum', 'Punica'] },
  cilek: { canonical: 'Fragaria x ananassa', aliases: ['Fragaria x ananassa', 'Fragaria × ananassa', 'Fragaria'] },
  portakal: { canonical: 'Citrus sinensis', aliases: ['Citrus sinensis', 'Citrus'] },
  limon: { canonical: 'Citrus limon', aliases: ['Citrus limon', 'Citrus'] },
  mandalina: { canonical: 'Citrus reticulata', aliases: ['Citrus reticulata', 'Citrus'] },
  greyfurt: { canonical: 'Citrus paradisi', aliases: ['Citrus paradisi', 'Citrus'] },
  kivi: { canonical: 'Actinidia', aliases: ['Actinidia deliciosa', 'Actinidia chinensis', 'Actinidia'] },
  cay: { canonical: 'Camellia sinensis', aliases: ['Camellia sinensis', 'Camellia'] },
  'yer fistigi': { canonical: 'Arachis hypogaea', aliases: ['Arachis hypogaea', 'Arachis'] },
  susam: { canonical: 'Sesamum indicum', aliases: ['Sesamum indicum', 'Sesamum'] },
  keten: { canonical: 'Linum usitatissimum', aliases: ['Linum usitatissimum', 'Linum'] },
  hashas: { canonical: 'Papaver somniferum', aliases: ['Papaver somniferum', 'Papaver'] },
  yonca: { canonical: 'Medicago sativa', aliases: ['Medicago sativa', 'Medicago'] },
  sorgum: { canonical: 'Sorghum bicolor', aliases: ['Sorghum bicolor', 'Sorghum'] },
  'tatli patates': { canonical: 'Ipomoea batatas', aliases: ['Ipomoea batatas', 'Ipomoea'] },
  'antep fistigi': { canonical: 'Pistacia vera', aliases: ['Pistacia vera', 'Pistacia'] },
  ahududu: { canonical: 'Rubus idaeus', aliases: ['Rubus idaeus', 'Rubus'] },
  bogurtlen: { canonical: 'Rubus', aliases: ['Rubus fruticosus', 'Rubus'] },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/×/g, 'x')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitValues(value: unknown) {
  return String(value ?? '')
    .split(/[;|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return null;
}

function addSet(target: Set<string>, value: string | null, max = 12) {
  if (!value || target.size >= max) return;
  for (const item of splitValues(value)) {
    if (target.size >= max) break;
    target.add(item);
  }
}

function matchesHost(host: string | null, aliases: string[]) {
  if (!host) return false;
  const normalizedHost = normalize(host);
  if (!normalizedHost) return false;

  return aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) return false;
    return (
      normalizedHost === normalizedAlias ||
      normalizedHost.startsWith(`${normalizedAlias} `) ||
      normalizedAlias.startsWith(`${normalizedHost} `)
    );
  });
}

function resolveHostMapping(crop: string): HostMapping | null {
  const key = normalize(crop);
  if (HOSTS[key]) return HOSTS[key];

  if (/^[a-z]+\s+[a-z-]+$/i.test(crop.trim())) {
    return {
      canonical: crop.trim(),
      aliases: [crop.trim()],
    };
  }

  return null;
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

async function getCurrentRelease() {
  const response = await fetchWithTimeout(PHIBASE_META_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TarlaPusula-PHIbase/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`PHI-base sürüm bilgisi alınamadı (HTTP ${response.status}).`);
  }

  const payload: any = await response.json();
  const downloadUrl = clean(payload?.download_url);
  const sha = clean(payload?.sha);

  if (!downloadUrl) {
    throw new Error('PHI-base güncel CSV indirme bağlantısı bulunamadı.');
  }

  return {
    downloadUrl,
    sha,
    sizeBytes: Number.isFinite(Number(payload?.size)) ? Number(payload.size) : null,
  };
}

async function authenticatedField(req: Request, fieldId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !authorization) {
    throw new Error('PHI-base kanıtı için sunucu ayarı veya kullanıcı oturumu eksik.');
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    const error = new Error('PHI-base kanıtı için geçerli kullanıcı oturumu gerekli.');
    (error as any).status = 401;
    throw error;
  }

  const { data: field, error: fieldError } = await client
    .from('fields')
    .select('id,user_id,name,crop')
    .eq('id', fieldId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (fieldError) throw fieldError;
  if (!field) {
    const error = new Error('Tarla bulunamadı veya erişim yetkin yok.');
    (error as any).status = 404;
    throw error;
  }

  return field;
}

function summarizeAggregate(value: PathogenAggregate) {
  return {
    pathogen_species: value.pathogenSpecies,
    record_count: value.recordCount,
    diseases: [...value.diseases].slice(0, 8),
    genes: [...value.genes].slice(0, 8),
    mutant_phenotypes: [...value.phenotypes].slice(0, 6),
    interaction_phenotypes: [...value.interactionPhenotypes].slice(0, 6),
    tissues: [...value.tissues].slice(0, 6),
    pmids: [...value.pmids].slice(0, 6),
    dois: [...value.dois].slice(0, 6),
    years: [...value.years]
      .filter((item) => /^\d{4}$/.test(item))
      .sort((a, b) => Number(b) - Number(a))
      .slice(0, 6),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = clean(body?.field_id ?? body?.fieldId);

    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if ('crop' in body || 'host' in body || 'host_species' in body) {
      return json(
        {
          ok: false,
          error: 'Ürün/konak istemciden kabul edilmez; kayıtlı tarla ürününden sunucu tarafında okunur.',
        },
        400,
      );
    }

    const field = await authenticatedField(req, fieldId);
    const crop = clean(field.crop);

    if (!crop) {
      return json({
        ok: true,
        supported: false,
        field_id: fieldId,
        field_name: field.name ?? null,
        crop: null,
        reason: 'Tarlada ürün bilgisi olmadığı için PHI-base konak eşleştirmesi yapılamadı.',
        source: 'PHI-base',
        production_authority: false,
        generated_at: new Date().toISOString(),
      });
    }

    const mapping = resolveHostMapping(crop);
    if (!mapping) {
      return json({
        ok: true,
        supported: false,
        field_id: fieldId,
        field_name: field.name ?? null,
        crop,
        reason: 'Bu ürün için PHI-base bilimsel konak eşleştirmesi henüz tanımlı değil.',
        source: 'PHI-base',
        production_authority: false,
        generated_at: new Date().toISOString(),
      });
    }

    const release = await getCurrentRelease();
    const csvResponse = await fetchWithTimeout(release.downloadUrl, {
      headers: { 'User-Agent': 'TarlaPusula-PHIbase/1.0' },
    });

    if (!csvResponse.ok) {
      throw new Error(`PHI-base veri dosyası alınamadı (HTTP ${csvResponse.status}).`);
    }

    const csv = await csvResponse.text();
    const parsed = Papa.parse<Record<string, unknown>>(csv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors?.length && !parsed.data?.length) {
      throw new Error(`PHI-base CSV ayrıştırılamadı: ${parsed.errors[0]?.message ?? 'bilinmeyen hata'}`);
    }

    const aggregates = new Map<string, PathogenAggregate>();
    let matchedRecords = 0;

    for (const row of parsed.data ?? []) {
      const host = pick(row, 'Host species', 'targetTaxonName');
      if (!matchesHost(host, mapping.aliases)) continue;

      const pathogen = pick(row, 'Pathogen species', 'sourceTaxonName');
      if (!pathogen) continue;

      matchedRecords += 1;
      const key = normalize(pathogen);
      const aggregate = aggregates.get(key) ?? {
        pathogenSpecies: pathogen,
        diseases: new Set<string>(),
        genes: new Set<string>(),
        phenotypes: new Set<string>(),
        interactionPhenotypes: new Set<string>(),
        pmids: new Set<string>(),
        dois: new Set<string>(),
        years: new Set<string>(),
        tissues: new Set<string>(),
        recordCount: 0,
      };

      aggregate.recordCount += 1;
      addSet(aggregate.diseases, pick(row, 'Disease'));
      addSet(aggregate.genes, pick(row, 'Gene'));
      addSet(aggregate.phenotypes, pick(row, 'Mutant Phenotype'));
      addSet(aggregate.interactionPhenotypes, pick(row, 'Interaction phenotype'));
      addSet(aggregate.tissues, pick(row, 'Tissue'));
      addSet(aggregate.pmids, pick(row, 'PMID', 'referenceUrl'));
      addSet(aggregate.dois, pick(row, 'DOI', 'referenceDoi'));
      addSet(aggregate.years, pick(row, 'Year'));
      aggregates.set(key, aggregate);
    }

    const pathogens = [...aggregates.values()]
      .sort((a, b) => b.recordCount - a.recordCount || a.pathogenSpecies.localeCompare(b.pathogenSpecies))
      .slice(0, MAX_RESULTS)
      .map(summarizeAggregate);

    const distinctDiseases = [
      ...new Set(pathogens.flatMap((item) => item.diseases)),
    ].slice(0, 20);

    return json({
      ok: true,
      supported: true,
      source: 'PHI-base',
      source_description: 'Pathogen-Host Interactions Database',
      source_repository: PHIBASE_REPO_URL,
      license: 'CC BY 4.0',
      field_id: fieldId,
      field_name: field.name ?? null,
      crop,
      host_taxon: mapping.canonical,
      host_aliases: mapping.aliases,
      matched_record_count: matchedRecords,
      distinct_pathogen_count: aggregates.size,
      diseases: distinctDiseases,
      pathogens,
      release: {
        file: 'releases/phi-base_current.csv',
        sha: release.sha,
        size_bytes: release.sizeBytes,
      },
      interpretation: {
        scope: 'curated-experimental-host-pathogen-evidence',
        diagnosis: false,
        field_incidence: false,
        treatment_recommendation: false,
      },
      production_authority: false,
      evidence: [
        'PHI-base kayıtları deneysel olarak incelenmiş patojen-konak etkileşimlerinden türetilir.',
        'TarlaPusula yalnız kayıtlı ürünle eşleşen konak kayıtlarını özetler.',
        'Bu kanıt, tarlada hastalığın bulunduğunu veya çıkacağını tek başına göstermez.',
      ],
      warnings: [
        'PHI-base bir saha prevalans/verim kaybı veri kaynağı değildir; risk veya teşhis için hava, fenoloji, uydu ve saha fotoğrafı gibi güncel kanıtlarla birlikte yorumlanmalıdır.',
        'Gen ve mutant fenotip kayıtları bilimsel bağlam içindir; doğrudan ürün koruma uygulaması önerisi olarak kullanılmaz.',
      ],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PHI-base kanıtı hazırlanamadı.';
    console.error('[phibase-evidence]', message);

    const explicitStatus = Number((error as any)?.status);
    const status =
      Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : /oturum|kullanıcı/i.test(message)
          ? 401
          : 500;

    return json({ ok: false, error: message }, status);
  }
});
