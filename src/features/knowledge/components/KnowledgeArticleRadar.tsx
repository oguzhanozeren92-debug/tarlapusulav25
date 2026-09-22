import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  importArticleRadarCandidate,
  listArticleRadarCandidates,
  scanArticleRadar,
  setArticleRadarCandidateStatus,
  type KnowledgeArticleCandidate,
  type KnowledgeArticleStatus,
} from '../services/articleRadar';
import './KnowledgeArticleRadar.css';

const AUTO_IMPORT_LICENSES = new Set(['cc0', 'cc-by', 'public-domain']);

function normalizedLicense(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function canAutoImport(candidate: KnowledgeArticleCandidate) {
  return Boolean(candidate.pdf_url && AUTO_IMPORT_LICENSES.has(normalizedLicense(candidate.license)));
}

function statusLabel(status: KnowledgeArticleStatus) {
  if (status === 'imported') return 'Bilgi Motoruna alındı';
  if (status === 'ignored') return 'Gizlendi';
  return 'Aday';
}

function authorText(candidate: KnowledgeArticleCandidate) {
  const names = (candidate.authors ?? []).map((item) => item?.name).filter(Boolean).slice(0, 4);
  if (!names.length) return '';
  return `${names.join(', ')}${(candidate.authors?.length ?? 0) > 4 ? ' ve diğerleri' : ''}`;
}

export default function KnowledgeArticleRadar({ onImported }: { onImported?: () => void | Promise<void> }) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState('');
  const [fromYear, setFromYear] = useState(Math.max(2000, currentYear - 5));
  const [openAccessOnly, setOpenAccessOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<KnowledgeArticleStatus | 'all'>('candidate');
  const [candidates, setCandidates] = useState<KnowledgeArticleCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const visible = useMemo(() => candidates, [candidates]);

  const refresh = async (filter: KnowledgeArticleStatus | 'all' = statusFilter) => {
    setLoading(true);
    try {
      const rows = await listArticleRadarCandidates(filter);
      setCandidates(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(statusFilter).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Makale adayları yüklenemedi.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const scan = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');
    setBusy('scan');
    try {
      const result = await scanArticleRadar({ query, fromYear, openAccessOnly, limit: 20 });
      setStatusFilter('candidate');
      const rows = await listArticleRadarCandidates('candidate');
      setCandidates(rows);
      setMessage(`${result.found} çalışma bulundu; ${result.stored} aday güncellendi. Sonuçlar yayınlanmaz, önce sen incelersin.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Makale taraması tamamlanamadı.');
    } finally {
      setBusy('');
    }
  };

  const updateStatus = async (candidate: KnowledgeArticleCandidate, status: 'candidate' | 'ignored') => {
    setMessage('');
    setErrorMessage('');
    setBusy(`status:${candidate.id}`);
    try {
      await setArticleRadarCandidateStatus(candidate.id, status);
      await refresh(statusFilter);
      setMessage(status === 'ignored' ? 'Makale adayı gizlendi.' : 'Makale yeniden aday listesine alındı.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Makale durumu güncellenemedi.');
    } finally {
      setBusy('');
    }
  };

  const importCandidate = async (candidate: KnowledgeArticleCandidate) => {
    setMessage('');
    setErrorMessage('');
    setBusy(`import:${candidate.id}`);
    try {
      const result = await importArticleRadarCandidate(candidate.id);
      await refresh(statusFilter);
      await onImported?.();
      if (result.extractionError) {
        setMessage(`PDF Bilgi Motoruna alındı fakat otomatik çıkarım tamamlanamadı: ${result.extractionError}. Belgeyi panelden yeniden çıkarabilirsin.`);
      } else if (result.extraction) {
        setMessage(`Kaynak Bilgi Motoruna alındı; ${result.extraction.claimCount ?? 0} iddia ve ${result.extraction.relationCount ?? 0} ilişki inceleme kuyruğuna geldi.`);
      } else {
        setMessage(result.alreadyImported ? 'Bu çalışma zaten Bilgi Motorunda.' : 'Kaynak Bilgi Motoruna alındı ve inceleme kuyruğuna gönderildi.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Makale Bilgi Motoruna alınamadı.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="tp-ka-card tp-kar">
      <div className="tp-ka-head">
        <div>
          <h3>Makale Radarı</h3>
          <p className="tp-ka-sub">OpenAlex üzerinden akademik çalışma adaylarını bulur. Açık erişim ve lisans bilgisi gösterilir; hiçbir çalışma otomatik yayınlanmaz.</p>
        </div>
        <span className="tp-ka-status">OPENALEX</span>
      </div>

      <form className="tp-kar-toolbar" onSubmit={scan}>
        <label className="tp-kar-search">Konu / ürün / araştırma
          <input className="tp-ka-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. wheat stripe rust remote sensing" />
        </label>
        <label>Başlangıç yılı
          <input className="tp-ka-input" type="number" min="1900" max={currentYear + 1} value={fromYear} onChange={(event) => setFromYear(Number(event.target.value) || currentYear - 5)} />
        </label>
        <label className="tp-kar-check">
          <input type="checkbox" checked={openAccessOnly} onChange={(event) => setOpenAccessOnly(event.target.checked)} />
          Açık erişim
        </label>
        <button className="tp-ka-btn tp-ka-btn-primary tp-kar-submit" type="submit" disabled={busy === 'scan' || query.trim().length < 3}>
          {busy === 'scan' ? 'Taranıyor…' : 'Makaleleri Tara'}
        </button>
      </form>

      <p className="tp-kar-note">Otomatik PDF aktarımı bilinçli olarak yalnız CC0, CC BY veya public-domain lisanslı doğrudan açık PDF kopyalarında açılır. Diğer sonuçlarda kaynağı inceleyip uygun dosyayı yukarıdaki PDF yükleme alanından ekleyebilirsin.</p>

      {message && <div className="tp-kar-result">{message}</div>}
      {errorMessage && <div className="tp-kar-result is-error">{errorMessage}</div>}

      <div className="tp-kar-status-tabs">
        {(['candidate', 'imported', 'ignored', 'all'] as const).map((status) => (
          <button key={status} type="button" className={`tp-kar-status-tab ${statusFilter === status ? 'is-active' : ''}`} onClick={() => setStatusFilter(status)}>
            {status === 'candidate' ? 'Adaylar' : status === 'imported' ? 'Alınanlar' : status === 'ignored' ? 'Gizlenenler' : 'Tümü'}
          </button>
        ))}
      </div>

      <div className="tp-kar-list">
        {loading && <div className="tp-kar-empty">Makale adayları yükleniyor…</div>}
        {!loading && visible.length === 0 && <div className="tp-kar-empty">Bu görünümde makale adayı yok.</div>}
        {!loading && visible.map((candidate) => {
          const autoImport = canAutoImport(candidate);
          const authors = authorText(candidate);
          return (
            <article className="tp-kar-article" key={candidate.id}>
              <div className="tp-kar-top">
                <div>
                  <h4 className="tp-kar-title">{candidate.title}</h4>
                  <p className="tp-kar-source">
                    {[candidate.source_name, candidate.publication_year ? String(candidate.publication_year) : null].filter(Boolean).join(' · ') || 'Kaynak bilgisi yok'}
                  </p>
                  {authors && <div className="tp-kar-author">{authors}</div>}
                </div>
                <span className="tp-ka-status" data-status={candidate.status === 'imported' ? 'approved' : candidate.status === 'ignored' ? 'rejected' : 'review'}>{statusLabel(candidate.status)}</span>
              </div>

              <div className="tp-kar-meta">
                {candidate.is_oa && <span className="tp-kar-pill">Açık erişim</span>}
                {candidate.oa_status && <span className="tp-kar-pill">OA: {candidate.oa_status}</span>}
                {candidate.license && <span className={`tp-kar-pill ${autoImport ? 'is-license' : 'is-warning'}`}>Lisans: {candidate.license}</span>}
                <span className="tp-kar-pill">Atıf: {candidate.cited_by_count ?? 0}</span>
                {candidate.language && <span className="tp-kar-pill">Dil: {candidate.language}</span>}
                {(candidate.topics ?? []).slice(0, 4).map((topic) => <span className="tp-kar-pill" key={`${candidate.id}:${topic}`}>{topic}</span>)}
              </div>

              <div className="tp-kar-actions">
                {candidate.oa_url && <a className="tp-ka-btn" href={candidate.oa_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Kaynağı aç</a>}
                {!candidate.oa_url && candidate.doi && <a className="tp-ka-btn" href={candidate.doi} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>DOI aç</a>}
                {candidate.pdf_url && <a className="tp-ka-btn" href={candidate.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Açık PDF</a>}
                {candidate.status === 'candidate' && (
                  <button className="tp-ka-btn tp-ka-btn-primary" type="button" disabled={!autoImport || Boolean(busy)} title={!autoImport ? 'Otomatik aktarım için doğrudan PDF ve CC0 / CC BY / public-domain lisansı gerekli.' : undefined} onClick={() => void importCandidate(candidate)}>
                    {busy === `import:${candidate.id}` ? 'Alınıyor…' : 'Bilgi Motoruna Al'}
                  </button>
                )}
                {candidate.status === 'candidate' && <button className="tp-ka-btn" type="button" disabled={Boolean(busy)} onClick={() => void updateStatus(candidate, 'ignored')}>Gizle</button>}
                {candidate.status === 'ignored' && <button className="tp-ka-btn" type="button" disabled={Boolean(busy)} onClick={() => void updateStatus(candidate, 'candidate')}>Adaylara döndür</button>}
              </div>

              {candidate.status === 'imported' && <div className="tp-kar-import-ok">PDF Bilgi Motoruna bağlandı. Yayına girmesi için çıkarılan iddiaların ayrıca admin onayı gerekir.</div>}
              {candidate.status === 'candidate' && !autoImport && <div className="tp-kar-note">Otomatik aktarım kapalı: {candidate.pdf_url ? `lisans ${candidate.license || 'belirsiz'}` : 'doğrudan açık PDF bulunamadı'}. Kaynağı açıp lisansını doğruladıktan sonra uygun PDF’yi elle yükleyebilirsin.</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
