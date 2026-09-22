import { supabase } from '../../../supabaseClient';

export type KnowledgeArticleStatus = 'candidate' | 'ignored' | 'imported';

export interface KnowledgeArticleCandidate {
  id: string;
  provider: string;
  provider_id: string;
  title: string;
  doi: string | null;
  publication_date: string | null;
  publication_year: number | null;
  work_type: string | null;
  language: string | null;
  authors: Array<{ name: string; orcid?: string | null }>;
  source_name: string | null;
  cited_by_count: number;
  topics: string[];
  is_oa: boolean;
  oa_status: string | null;
  oa_url: string | null;
  pdf_url: string | null;
  license: string | null;
  status: KnowledgeArticleStatus;
  search_query: string | null;
  document_id: string | null;
  metadata: Record<string, unknown>;
  discovered_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface ArticleRadarScanResult {
  success: true;
  provider: 'openalex';
  query: string;
  fromYear: number;
  openAccessOnly: boolean;
  found: number;
  stored: number;
  providerCost?: number | null;
}

export interface ArticleRadarImportResult {
  success: true;
  imported?: boolean;
  alreadyImported?: boolean;
  documentId: string;
  extraction?: {
    status?: string;
    claimCount?: number;
    relationCount?: number;
  } | null;
  extractionError?: string | null;
}

export async function listArticleRadarCandidates(status?: KnowledgeArticleStatus | 'all') {
  let query = supabase
    .from('knowledge_article_candidates')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as KnowledgeArticleCandidate[];
}

export async function scanArticleRadar(input: {
  query: string;
  fromYear?: number;
  openAccessOnly?: boolean;
  limit?: number;
}) {
  const search = input.query.trim();
  if (search.length < 3) throw new Error('Makale araması en az 3 karakter olmalı.');
  const { data, error } = await supabase.functions.invoke('knowledge-article-radar', {
    body: {
      action: 'scan',
      query: search,
      fromYear: input.fromYear,
      openAccessOnly: input.openAccessOnly !== false,
      limit: Math.max(1, Math.min(input.limit ?? 20, 30)),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as ArticleRadarScanResult;
}

export async function importArticleRadarCandidate(candidateId: string) {
  const { data, error } = await supabase.functions.invoke('knowledge-article-radar', {
    body: { action: 'import', candidateId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as ArticleRadarImportResult;
}

export async function setArticleRadarCandidateStatus(id: string, status: Exclude<KnowledgeArticleStatus, 'imported'>) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Admin oturumu bulunamadı.');
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('knowledge_article_candidates')
    .update({
      status,
      reviewed_by: status === 'ignored' ? authData.user.id : null,
      reviewed_at: status === 'ignored' ? now : null,
      updated_at: now,
    })
    .eq('id', id);
  if (error) throw error;
}
