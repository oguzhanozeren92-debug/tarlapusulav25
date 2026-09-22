import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  deleteKnowledgeDocument,
  extractKnowledgeDocument,
  listKnowledgeClaims,
  listKnowledgeDocuments,
  listKnowledgeRelations,
  publishKnowledgeDocument,
  rejectKnowledgeDocument,
  reviewKnowledgeClaim,
  reviewKnowledgeRelation,
  unpublishKnowledgeDocument,
  uploadKnowledgePdf,
  type KnowledgeClaimRow,
  type KnowledgeDocumentRow,
  type KnowledgeRelationRow,
  type KnowledgeReviewStatus,
} from '../services/knowledgeEngine';
import KnowledgeArticleRadar from './KnowledgeArticleRadar';
import './KnowledgeAdminPanel.css';

const DOCUMENT_STATUS: Record<string, string> = {
  queued: 'Sırada',
  processing: 'Çıkarılıyor',
  review: 'İnceleme',
  approved: 'Yayında',
  rejected: 'Reddedildi',
  failed: 'Hata',
};

const REVIEW_STATUS: Record<KnowledgeReviewStatus, string> = {
  candidate: 'Aday',
  approved: 'Onaylı',
  rejected: 'Reddedildi',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function KnowledgeAdminPanel() {
  const [documents, setDocuments] = useState<KnowledgeDocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [claims, setClaims] = useState<KnowledgeClaimRow[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [reviewView, setReviewView] = useState<'claims' | 'relations'>('claims');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const selected = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const claimCounts = useMemo(() => ({
    candidate: claims.filter((item) => item.status === 'candidate').length,
    approved: claims.filter((item) => item.status === 'approved').length,
    rejected: claims.filter((item) => item.status === 'rejected').length,
  }), [claims]);

  const relationCounts = useMemo(() => ({
    candidate: relations.filter((item) => item.status === 'candidate').length,
    approved: relations.filter((item) => item.status === 'approved').length,
    rejected: relations.filter((item) => item.status === 'rejected').length,
  }), [relations]);

  const clearMessages = () => {
    setMessage('');
    setErrorMessage('');
  };

  const refreshDocuments = async (preferredId?: string) => {
    const rows = await listKnowledgeDocuments();
    setDocuments(rows);
    const nextId = preferredId || selectedId || rows[0]?.id || '';
    if (nextId && rows.some((item) => item.id === nextId)) setSelectedId(nextId);
    else setSelectedId(rows[0]?.id || '');
    return rows;
  };

  const refreshDetail = async (documentId: string) => {
    if (!documentId) {
      setClaims([]);
      setRelations([]);
      return;
    }
    setDetailLoading(true);
    try {
      const [nextClaims, nextRelations] = await Promise.all([
        listKnowledgeClaims(documentId),
        listKnowledgeRelations(documentId),
      ]);
      setClaims(nextClaims);
      setRelations(nextRelations);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listKnowledgeDocuments();
        if (!active) return;
        setDocuments(rows);
        setSelectedId((current) => current || rows[0]?.id || '');
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Knowledge Engine verileri yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void refreshDetail(selectedId).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Belge detayları yüklenemedi.');
    });
  }, [selectedId]);

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    clearMessages();
    setBusy(key);
    try {
      await action();
      await refreshDocuments(selectedId);
      if (selectedId) await refreshDetail(selectedId);
      setMessage(success);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy('');
    }
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setErrorMessage('Önce bir PDF seç.');
      return;
    }
    clearMessages();
    setBusy('upload');
    try {
      const uploaded = await uploadKnowledgePdf({ file, title, sourceName, sourceUrl });
      await refreshDocuments(uploaded.id);
      setSelectedId(uploaded.id);
      await refreshDetail(uploaded.id);
      setFile(null);
      setTitle('');
      setSourceName('');
      setSourceUrl('');
      const fileInput = document.getElementById('tp-knowledge-pdf') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      setMessage('PDF işlendi. AI çıktıları aday olarak hazır; incelemeden hiçbir bilgi yayınlanmaz.');
    } catch (error) {
      await refreshDocuments().catch(() => undefined);
      setErrorMessage(error instanceof Error ? error.message : 'PDF işlenemedi.');
    } finally {
      setBusy('');
    }
  };

  const openPdf = async () => {
    if (!selected) return;
    clearMessages();
    setBusy('open-pdf');
    try {
      const { data, error } = await supabase.storage
        .from(selected.storage_bucket)
        .createSignedUrl(selected.storage_path, 600);
      if (error || !data?.signedUrl) throw error ?? new Error('PDF bağlantısı oluşturulamadı.');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDF açılamadı.');
    } finally {
      setBusy('');
    }
  };

  const handleClaimReview = async (claim: KnowledgeClaimRow, status: KnowledgeReviewStatus) => {
    await runAction(
      `claim:${claim.id}:${status}`,
      () => reviewKnowledgeClaim(claim.id, status),
      status === 'approved' ? 'Bilgi iddiası onaylandı.' : status === 'rejected' ? 'Bilgi iddiası reddedildi.' : 'İddia yeniden aday durumuna alındı.',
    );
  };

  const handleRelationReview = async (relation: KnowledgeRelationRow, status: KnowledgeReviewStatus) => {
    await runAction(
      `relation:${relation.id}:${status}`,
      () => reviewKnowledgeRelation(relation.id, status),
      status === 'approved' ? 'Knowledge Graph ilişkisi onaylandı.' : status === 'rejected' ? 'İlişki reddedildi.' : 'İlişki yeniden aday durumuna alındı.',
    );
  };

  return (
    <section className="tp-ka">
      <div className="tp-ka-card tp-ka-head">
        <div>
          <h2>Pusula Knowledge Engine</h2>
          <p className="tp-ka-sub">PDF → kaynak/sayfa/iddia → admin inceleme → yalnız onaylı bilgi retrieval. AI çıktısı tek başına yayınlanmaz.</p>
        </div>
        <span className="tp-ka-status">ADMIN REVIEW</span>
      </div>

      {message && <div className="tp-ka-message">{message}</div>}
      {errorMessage && <div className="tp-ka-message is-error">{errorMessage}</div>}

      <KnowledgeArticleRadar onImported={async () => { await refreshDocuments(selectedId); }} />

      <div className="tp-ka-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <form className="tp-ka-card tp-ka-form" onSubmit={handleUpload}>
            <div>
              <strong>Yeni PDF kaynağı</strong>
              <p className="tp-ka-sub">En fazla 11 MB. Dosya özel depoda tutulur.</p>
            </div>
            <label>PDF
              <input id="tp-knowledge-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next && !title.trim()) setTitle(next.name.replace(/\.pdf$/i, ''));
              }} />
            </label>
            <label>Belge başlığı
              <input className="tp-ka-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. Buğday Hastalıkları Teknik Rehberi" />
            </label>
            <label>Kaynak / kurum
              <input className="tp-ka-input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="TAGEM, FAO, üniversite…" required />
            </label>
            <label>Kaynak bağlantısı
              <input className="tp-ka-input" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://… (isteğe bağlı)" />
            </label>
            <p className="tp-ka-file-note">Gemini yalnız aday kayıt üretir. Sayfa ve kısa kanıt parçası senin incelemen için saklanır; onaylanmayan kayıt Pusula retrieval sonucuna giremez.</p>
            <button className="tp-ka-btn tp-ka-btn-primary" disabled={busy === 'upload'} type="submit">
              {busy === 'upload' ? 'PDF yükleniyor ve çıkarılıyor…' : 'PDF Yükle ve Adayları Çıkar'}
            </button>
          </form>

          <div className="tp-ka-card">
            <div className="tp-ka-head">
              <div>
                <strong>Kaynak belgeler</strong>
                <p className="tp-ka-sub">{documents.length} belge</p>
              </div>
              <button className="tp-ka-btn" disabled={loading} onClick={() => void refreshDocuments().catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Yenileme başarısız.'))}>Yenile</button>
            </div>
            <div className="tp-ka-doc-list">
              {loading && <div className="tp-ka-empty">Belgeler yükleniyor…</div>}
              {!loading && documents.length === 0 && <div className="tp-ka-empty">Henüz PDF kaynağı yok.</div>}
              {documents.map((document) => (
                <button key={document.id} className={`tp-ka-doc ${selectedId === document.id ? 'is-active' : ''}`} onClick={() => setSelectedId(document.id)}>
                  <span className="tp-ka-status" data-status={document.status}>{DOCUMENT_STATUS[document.status] ?? document.status}</span>
                  <strong style={{ marginTop: 7 }}>{document.title}</strong>
                  <small>{document.source_name || 'Kaynak belirtilmedi'} · {document.page_count ? `${document.page_count} sayfa` : 'sayfa sayısı bekleniyor'}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tp-ka-card">
          {!selected && <div className="tp-ka-empty">İncelemek için bir belge seç.</div>}
          {selected && (
            <>
              <div className="tp-ka-head">
                <div>
                  <span className="tp-ka-status" data-status={selected.status}>{DOCUMENT_STATUS[selected.status] ?? selected.status}</span>
                  <h3 style={{ marginTop: 8 }}>{selected.title}</h3>
                  <p className="tp-ka-sub">{selected.source_name || 'Kaynak yok'} · {formatDate(selected.created_at)}</p>
                </div>
                <div className="tp-ka-row-actions">
                  <button className="tp-ka-btn" disabled={busy === 'open-pdf'} onClick={() => void openPdf()}>PDF'yi aç</button>
                  {(selected.status === 'failed' || selected.status === 'review' || selected.status === 'rejected') && (
                    <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void runAction('extract', async () => { await extractKnowledgeDocument(selected.id); }, 'Belge yeniden çıkarıldı; adaylar güncellendi.')}>Yeniden çıkar</button>
                  )}
                </div>
              </div>

              <div className="tp-ka-stats">
                <span className="tp-ka-stat">İddia: {claims.length}</span>
                <span className="tp-ka-stat">Onaylı: {claimCounts.approved}</span>
                <span className="tp-ka-stat">Aday: {claimCounts.candidate}</span>
                <span className="tp-ka-stat">Graph: {relations.length}</span>
                {selected.extraction_model && <span className="tp-ka-stat">Model: {selected.extraction_model}</span>}
              </div>

              {selected.error_message && <div className="tp-ka-message is-error" style={{ marginTop: 10 }}>{selected.error_message}</div>}
              {selected.source_url && <p className="tp-ka-sub">Kaynak: <a className="tp-ka-link" href={selected.source_url} target="_blank" rel="noreferrer">{selected.source_url}</a></p>}

              <div className="tp-ka-row-actions" style={{ marginTop: 12 }}>
                {selected.status !== 'approved' ? (
                  <button className="tp-ka-btn tp-ka-btn-primary" disabled={Boolean(busy) || claimCounts.approved === 0} onClick={() => void runAction('publish', () => publishKnowledgeDocument(selected.id), 'Belge yayına alındı. Yalnız onaylı iddialar retrieval katmanında kullanılabilir.')}>Yayınla</button>
                ) : (
                  <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void runAction('unpublish', () => unpublishKnowledgeDocument(selected.id), 'Belge yayından kaldırıldı ve inceleme durumuna alındı.')}>Yayından kaldır</button>
                )}
                {selected.status !== 'rejected' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void runAction('reject-doc', () => rejectKnowledgeDocument(selected.id), 'Belge reddedildi.')}>Belgeyi reddet</button>}
                <button className="tp-ka-btn tp-ka-btn-danger" disabled={Boolean(busy)} onClick={() => {
                  if (!window.confirm('Belge, iddialar, ilişkiler ve özel PDF tamamen silinsin mi?')) return;
                  void runAction('delete-doc', async () => {
                    await deleteKnowledgeDocument(selected.id);
                    setSelectedId('');
                    setClaims([]);
                    setRelations([]);
                  }, 'Belge silindi.');
                }}>Sil</button>
              </div>

              {claimCounts.candidate > 0 && selected.status === 'approved' && (
                <p className="tp-ka-warning">Bu belgede hâlâ aday iddialar var. Belge yayında olsa bile bu adaylar retrieval sonucuna girmez.</p>
              )}

              <div className="tp-ka-tabs">
                <button className={`tp-ka-mini-tab ${reviewView === 'claims' ? 'is-active' : ''}`} onClick={() => setReviewView('claims')}>İddialar ({claims.length})</button>
                <button className={`tp-ka-mini-tab ${reviewView === 'relations' ? 'is-active' : ''}`} onClick={() => setReviewView('relations')}>Knowledge Graph ({relations.length})</button>
              </div>

              {detailLoading && <div className="tp-ka-empty" style={{ marginTop: 12 }}>Belge adayları yükleniyor…</div>}

              {!detailLoading && reviewView === 'claims' && (
                <div className="tp-ka-section">
                  {claims.length === 0 && <div className="tp-ka-empty">Bu belge için iddia adayı yok.</div>}
                  {claims.map((claim) => (
                    <article className="tp-ka-claim" key={claim.id}>
                      <div className="tp-ka-claim-top">
                        <div className="tp-ka-meta">
                          <span className="tp-ka-status" data-status={claim.status}>{REVIEW_STATUS[claim.status]}</span>
                          <span className="tp-ka-pill">Sayfa {claim.source_page ?? '?'}</span>
                          <span className="tp-ka-pill">{claim.extraction_confidence === 'strong' ? 'Güçlü veri' : claim.extraction_confidence === 'medium' ? 'Orta' : 'Ön kontrol'}</span>
                          {claim.crop && <span className="tp-ka-pill">{claim.crop}</span>}
                        </div>
                        <div className="tp-ka-row-actions">
                          {claim.status !== 'approved' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleClaimReview(claim, 'approved')}>Onayla</button>}
                          {claim.status !== 'rejected' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleClaimReview(claim, 'rejected')}>Reddet</button>}
                          {claim.status !== 'candidate' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleClaimReview(claim, 'candidate')}>Adaya al</button>}
                        </div>
                      </div>
                      <p>{claim.claim_text}</p>
                      {claim.summary_tr && <p className="tp-ka-sub">{claim.summary_tr}</p>}
                      {claim.evidence_excerpt && <blockquote>Kaynak parçası: “{claim.evidence_excerpt}”</blockquote>}
                      {(claim.topics.length > 0 || claim.tags.length > 0) && <div className="tp-ka-meta" style={{ marginTop: 9 }}>{[...claim.topics, ...claim.tags].map((item) => <span className="tp-ka-pill" key={`${claim.id}:${item}`}>{item}</span>)}</div>}
                    </article>
                  ))}
                </div>
              )}

              {!detailLoading && reviewView === 'relations' && (
                <div className="tp-ka-section">
                  {relations.length === 0 && <div className="tp-ka-empty">Bu belge için graph ilişkisi yok.</div>}
                  {relations.map((relation) => (
                    <article className="tp-ka-relation" key={relation.id}>
                      <div className="tp-ka-relation-top">
                        <div>
                          <div className="tp-ka-meta"><span className="tp-ka-status" data-status={relation.status}>{REVIEW_STATUS[relation.status]}</span><span className="tp-ka-pill">Sayfa {relation.source_page ?? '?'}</span></div>
                          <strong style={{ display: 'block', marginTop: 8 }}>{relation.subject_name} → {relation.relation} → {relation.object_name}</strong>
                          <p className="tp-ka-sub">{relation.subject_type} → {relation.object_type}</p>
                        </div>
                        <div className="tp-ka-row-actions">
                          {relation.status !== 'approved' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleRelationReview(relation, 'approved')}>Onayla</button>}
                          {relation.status !== 'rejected' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleRelationReview(relation, 'rejected')}>Reddet</button>}
                          {relation.status !== 'candidate' && <button className="tp-ka-btn" disabled={Boolean(busy)} onClick={() => void handleRelationReview(relation, 'candidate')}>Adaya al</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
