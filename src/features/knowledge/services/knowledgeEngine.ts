import { supabase } from '../../../supabaseClient';

export type KnowledgeDocumentStatus =
  | 'queued'
  | 'processing'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'failed';

export type KnowledgeReviewStatus = 'candidate' | 'approved' | 'rejected';

export interface KnowledgeDocumentRow {
  id: string;
  title: string;
  source_name: string;
  source_url: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: number | null;
  language: string;
  status: KnowledgeDocumentStatus;
  extraction_model: string | null;
  page_count: number | null;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface KnowledgeClaimRow {
  id: string;
  document_id: string;
  claim_text: string;
  summary_tr: string;
  crop: string | null;
  topics: string[];
  tags: string[];
  source_page: number | null;
  evidence_excerpt: string | null;
  extraction_confidence: 'strong' | 'medium' | 'preliminary';
  status: KnowledgeReviewStatus;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface KnowledgeRelationRow {
  id: string;
  document_id: string;
  claim_id: string | null;
  subject_type: string;
  subject_name: string;
  relation: string;
  object_type: string;
  object_name: string;
  source_page: number | null;
  status: KnowledgeReviewStatus;
  created_at: string;
  reviewed_at: string | null;
}

export interface KnowledgeRetrievalResult {
  claim_id: string;
  claim_text: string;
  summary_tr: string;
  crop: string | null;
  topics: string[];
  tags: string[];
  source_page: number | null;
  source_name: string;
  source_url: string | null;
  document_title: string;
  document_id: string;
  approved_at: string | null;
}

const KNOWLEDGE_BUCKET = 'knowledge-documents';
const MAX_PDF_BYTES = 11 * 1024 * 1024;

function safePdfName(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-100);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'kaynak'}.pdf`;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Admin oturumu bulunamadı.');
  return data.user.id;
}

export async function listKnowledgeDocuments() {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeDocumentRow[];
}

export async function listKnowledgeClaims(documentId: string) {
  if (!documentId) return [] as KnowledgeClaimRow[];
  const { data, error } = await supabase
    .from('knowledge_claims')
    .select('*')
    .eq('document_id', documentId)
    .order('source_page', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowledgeClaimRow[];
}

export async function listKnowledgeRelations(documentId: string) {
  if (!documentId) return [] as KnowledgeRelationRow[];
  const { data, error } = await supabase
    .from('knowledge_relations')
    .select('*')
    .eq('document_id', documentId)
    .order('source_page', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowledgeRelationRow[];
}

export async function extractKnowledgeDocument(documentId: string) {
  const { data, error } = await supabase.functions.invoke('knowledge-document-extract', {
    body: { documentId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as {
    documentId: string;
    status: 'review';
    model: string;
    claimCount: number;
    relationCount: number;
    pageCount: number | null;
    crops: string[];
    topics: string[];
  };
}

export async function uploadKnowledgePdf(input: {
  file: File;
  title: string;
  sourceName: string;
  sourceUrl?: string;
}) {
  const { file } = input;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Yalnızca PDF yükleyebilirsin.');
  }
  if (file.size <= 0) throw new Error('PDF dosyası boş.');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF en fazla 11 MB olabilir.');

  const userId = await currentUserId();
  const title = input.title.trim() || file.name.replace(/\.pdf$/i, '');
  const sourceName = input.sourceName.trim();
  if (!sourceName) throw new Error('Kaynak/kurum adı gerekli.');

  const sourceUrl = input.sourceUrl?.trim() || null;
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    throw new Error('Kaynak bağlantısı http:// veya https:// ile başlamalı.');
  }

  const path = `${userId}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${safePdfName(file.name)}`;
  const upload = await supabase.storage.from(KNOWLEDGE_BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const insert = await supabase
    .from('knowledge_documents')
    .insert({
      title,
      source_name: sourceName,
      source_url: sourceUrl,
      storage_bucket: KNOWLEDGE_BUCKET,
      storage_path: path,
      mime_type: 'application/pdf',
      file_size: file.size,
      status: 'queued',
      created_by: userId,
      metadata: { originalFileName: file.name },
    })
    .select('*')
    .single();

  if (insert.error || !insert.data) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove([path]);
    throw insert.error ?? new Error('Belge kaydı oluşturulamadı.');
  }

  try {
    await extractKnowledgeDocument(String(insert.data.id));
  } catch (error) {
    // Edge Function belge durumunu failed olarak kaydeder; PDF silinmez ki yeniden denenebilsin.
    throw error;
  }

  return insert.data as KnowledgeDocumentRow;
}

export async function reviewKnowledgeClaim(id: string, status: KnowledgeReviewStatus) {
  const userId = await currentUserId();
  const reviewed = status === 'candidate' ? null : new Date().toISOString();
  const { error } = await supabase
    .from('knowledge_claims')
    .update({
      status,
      reviewed_by: reviewed ? userId : null,
      reviewed_at: reviewed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function reviewKnowledgeRelation(id: string, status: KnowledgeReviewStatus) {
  const userId = await currentUserId();
  const reviewed = status === 'candidate' ? null : new Date().toISOString();
  const { error } = await supabase
    .from('knowledge_relations')
    .update({
      status,
      reviewed_by: reviewed ? userId : null,
      reviewed_at: reviewed,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function publishKnowledgeDocument(documentId: string) {
  const userId = await currentUserId();
  const approvedClaims = await supabase
    .from('knowledge_claims')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('status', 'approved');
  if (approvedClaims.error) throw approvedClaims.error;
  if (!approvedClaims.count) {
    throw new Error('Yayınlamak için en az bir bilgi iddiasını onayla.');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('knowledge_documents')
    .update({ status: 'approved', reviewed_by: userId, reviewed_at: now, updated_at: now, error_message: null })
    .eq('id', documentId);
  if (error) throw error;
}

export async function unpublishKnowledgeDocument(documentId: string) {
  const { error } = await supabase
    .from('knowledge_documents')
    .update({ status: 'review', updated_at: new Date().toISOString() })
    .eq('id', documentId);
  if (error) throw error;
}

export async function rejectKnowledgeDocument(documentId: string) {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('knowledge_documents')
    .update({ status: 'rejected', reviewed_by: userId, reviewed_at: now, updated_at: now })
    .eq('id', documentId);
  if (error) throw error;
}

export async function deleteKnowledgeDocument(documentId: string) {
  const documentResult = await supabase
    .from('knowledge_documents')
    .select('storage_bucket,storage_path')
    .eq('id', documentId)
    .single();
  if (documentResult.error) throw documentResult.error;

  const { error: deleteError } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', documentId);
  if (deleteError) throw deleteError;

  const bucket = String(documentResult.data.storage_bucket || KNOWLEDGE_BUCKET);
  const path = String(documentResult.data.storage_path || '');
  if (path) await supabase.storage.from(bucket).remove([path]);
}

export async function searchApprovedKnowledge(input: {
  query?: string;
  crop?: string | null;
  topics?: string[];
  limit?: number;
}) {
  const { data, error } = await supabase.rpc('retrieve_knowledge', {
    p_query: input.query?.trim() ?? '',
    p_crop: input.crop?.trim() || null,
    p_topics: input.topics ?? [],
    p_limit: Math.max(1, Math.min(input.limit ?? 8, 20)),
  });
  if (error) throw error;
  return (data ?? []) as KnowledgeRetrievalResult[];
}
