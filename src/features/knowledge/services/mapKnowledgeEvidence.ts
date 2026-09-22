import { supabase } from '../../../supabaseClient';
import {
  searchApprovedKnowledge,
  type KnowledgeRetrievalResult,
} from './knowledgeEngine';

export type MapKnowledgeEvidenceSource = {
  claimId: string;
  documentId: string;
  documentTitle: string;
  sourceName: string;
  sourceUrl: string | null;
  sourcePage: number | null;
  summary: string;
  claimText: string;
  crop: string | null;
  topics: string[];
  tags: string[];
  approvedAt: string | null;
};

type MapKnowledgeEvidenceInput = {
  activeLayer?: string | null;
  crop?: string | null;
  soilProperty?: string | null;
  climateLayer?: string | null;
};

const MEMORY = new Map<string, { at: number; rows: MapKnowledgeEvidenceSource[] }>();
const CACHE_MS = 5 * 60 * 1000;

function norm(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function keywordsFor(input: MapKnowledgeEvidenceInput) {
  const layer = norm(input.activeLayer);
  const soil = norm(input.soilProperty);
  const climate = norm(input.climateLayer);

  if (layer === 'vegetation') return ['NDVI', 'vejetasyon'];
  if (layer === 'radar-vv') return ['Sentinel-1', 'radar'];
  if (layer === 'radar-vh') return ['Sentinel-1', 'bitki yapısı'];
  if (layer === 'radar-water') return ['drenaj', 'su birikimi'];

  if (layer === 'soil') {
    if (soil === 'phh2o') return ['toprak pH', 'pH'];
    if (soil === 'soc') return ['organik karbon', 'toprak organik madde'];
    if (soil === 'clay') return ['kil', 'toprak'];
    if (soil === 'sand') return ['kum', 'toprak'];
    if (soil === 'silt') return ['silt', 'toprak'];
    return ['toprak'];
  }

  if (layer === 'surface-temperature') return ['yüzey sıcaklığı', 'sıcaklık'];
  if (layer === 'evapotranspiration' || layer === 'water-demand') {
    return ['evapotranspirasyon', 'ET0'];
  }
  if (layer === 'rainfall-history' || layer === 'rain-history') return ['yağış'];
  if (layer === 'frost-risk') return ['don', 'düşük sıcaklık'];

  if (layer === 'climate') {
    if (climate.includes('soil-moisture')) return ['toprak nemi', 'nem'];
    if (climate.includes('soil-temperature')) return ['toprak sıcaklığı', 'sıcaklık'];
    if (climate.includes('precip')) return ['yağış'];
    if (climate.includes('frost')) return ['don'];
    return ['iklim', 'hava'];
  }

  return [];
}

function toEvidence(row: KnowledgeRetrievalResult): MapKnowledgeEvidenceSource {
  return {
    claimId: String(row.claim_id),
    documentId: String(row.document_id),
    documentTitle: String(row.document_title || 'Kaynak belge'),
    sourceName: String(row.source_name || 'Kaynak'),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    sourcePage: Number.isFinite(Number(row.source_page)) ? Number(row.source_page) : null,
    summary: String(row.summary_tr || row.claim_text || '').trim(),
    claimText: String(row.claim_text || '').trim(),
    crop: row.crop ? String(row.crop) : null,
    topics: Array.isArray(row.topics) ? row.topics.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    approvedAt: row.approved_at ? String(row.approved_at) : null,
  };
}

function scoreEvidence(
  row: MapKnowledgeEvidenceSource,
  crop: string,
  keywords: string[],
) {
  let score = 0;
  const haystack = norm([
    row.summary,
    row.claimText,
    row.crop,
    ...row.topics,
    ...row.tags,
  ].join(' '));

  if (crop) {
    if (norm(row.crop) === crop) score += 30;
    if (row.tags.some((tag) => norm(tag) === crop)) score += 20;
    if (haystack.includes(crop)) score += 8;
  }

  keywords.forEach((keyword, index) => {
    if (haystack.includes(norm(keyword))) score += Math.max(3, 12 - index * 3);
  });

  if (row.sourcePage != null) score += 2;
  if (row.sourceUrl) score += 1;
  return score;
}

export async function loadMapKnowledgeEvidence(
  input: MapKnowledgeEvidenceInput,
): Promise<MapKnowledgeEvidenceSource[]> {
  const keywords = keywordsFor(input).slice(0, 2);
  if (!keywords.length) return [];

  const crop = norm(input.crop);
  const cacheKey = [norm(input.activeLayer), norm(input.soilProperty), norm(input.climateLayer), crop].join(':');
  const cached = MEMORY.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rows;

  try {
    const batches = await Promise.all(
      keywords.map((query) =>
        searchApprovedKnowledge({
          query,
          crop: null,
          topics: [],
          limit: 8,
        }),
      ),
    );

    const unique = new Map<string, MapKnowledgeEvidenceSource>();
    for (const row of batches.flat()) {
      const evidence = toEvidence(row);
      if (!unique.has(evidence.claimId)) unique.set(evidence.claimId, evidence);
    }

    const rows = [...unique.values()]
      .sort((a, b) => scoreEvidence(b, crop, keywords) - scoreEvidence(a, crop, keywords))
      .slice(0, 3);

    MEMORY.set(cacheKey, { at: Date.now(), rows });
    return rows;
  } catch (error) {
    console.warn('[Knowledge Engine] Pusula kaynakları alınamadı:', error);
    return [];
  }
}

export async function attachKnowledgeEvidenceToObservation(
  observationId: string | null | undefined,
  sources: MapKnowledgeEvidenceSource[],
) {
  if (!observationId || !sources.length) return;

  try {
    const { error } = await supabase
      .from('field_ai_observations')
      .update({ knowledge_sources: sources })
      .eq('id', observationId);

    if (error) throw error;
  } catch (error) {
    // Kaynak audit kaydı ana Pusula yorumunu bozmaz.
    console.warn('[Knowledge Engine] Pusula kaynak audit kaydı yazılamadı:', error);
  }
}
