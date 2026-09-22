import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ContentAdminPanel.css';

type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'held';
type CandidateType = 'news' | 'knowledge_new' | 'knowledge_update';

type Candidate = {
  id: string;
  candidate_type: CandidateType;
  title_suggested: string;
  short_summary: string | null;
  body_draft: string | null;
  source_refs: Array<Record<string, unknown>> | null;
  suggested_category: string | null;
  suggested_tags: string[] | null;
  suggested_crops: string[] | null;
  original_language: string | null;
  relevance_score: number | null;
  trust_score: number | null;
  novelty_score: number | null;
  copyright_status: 'safe' | 'review' | 'blocked';
  workflow_status: CandidateStatus;
  target_content_id: string | null;
  generated_at: string;
  reviewed_at: string | null;
  admin_score: number | null;
  admin_note: string | null;
};

type ContentItem = {
  id: string;
  content_type: 'news' | 'knowledge';
  title: string;
  excerpt: string | null;
  body: string;
  status: 'draft' | 'approved' | 'published' | 'archived' | 'removed';
  published_at: string | null;
  updated_at: string;
};

type ContentSource = {
  id: string;
  name: string;
  base_url: string;
  source_type: string;
  language: string;
  country: string | null;
  trust_score: number;
  active: boolean;
  scan_frequency_hours: number;
  last_scanned_at: string | null;
};

type ContentImage = {
  id: string;
  candidate_id: string | null;
  content_id: string | null;
  public_url: string | null;
  original_url: string | null;
  license_type: string | null;
  credit_text: string | null;
  status: string;
  is_cover: boolean;
};

type CandidateEdits = {
  score: number;
  note: string;
};

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const slugify = (value: string, suffix: string) => {
  const base = value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${base || 'icerik'}-${suffix.slice(0, 8)}`;
};

const sourceName = (candidate: Candidate) => {
  const first = candidate.source_refs?.[0];
  const name = first?.source_name;
  return typeof name === 'string' && name.trim() ? name : 'Kaynak';
};

const sourceUrl = (candidate: Candidate) => {
  const first = candidate.source_refs?.[0];
  const url = first?.url;
  return typeof url === 'string' ? url : '';
};

const typeLabel = (type: CandidateType) => {
  if (type === 'news') return 'Haber';
  if (type === 'knowledge_update') return 'Bilgi güncellemesi';
  return 'Yeni bilgi';
};

export default function ContentAdminPanel() {
  const [activeTab, setActiveTab] = useState<'queue' | 'published' | 'sources'>('queue');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [published, setPublished] = useState<ContentItem[]>([]);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [images, setImages] = useState<ContentImage[]>([]);
  const [edits, setEdits] = useState<Record<string, CandidateEdits>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [candidateRes, itemRes, sourceRes, imageRes] = await Promise.all([
        supabase
          .from('content_candidates')
          .select('*')
          .order('generated_at', { ascending: false })
          .limit(250),
        supabase
          .from('content_items')
          .select('id,content_type,title,excerpt,body,status,published_at,updated_at')
          .in('status', ['published', 'approved', 'removed'])
          .order('updated_at', { ascending: false })
          .limit(250),
        supabase
          .from('content_sources')
          .select('id,name,base_url,source_type,language,country,trust_score,active,scan_frequency_hours,last_scanned_at')
          .order('trust_score', { ascending: false }),
        supabase
          .from('content_images')
          .select('id,candidate_id,content_id,public_url,original_url,license_type,credit_text,status,is_cover')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (candidateRes.error) throw candidateRes.error;
      if (itemRes.error) throw itemRes.error;
      if (sourceRes.error) throw sourceRes.error;
      if (imageRes.error) throw imageRes.error;

      const nextCandidates = (candidateRes.data ?? []) as Candidate[];
      setCandidates(nextCandidates);
      setPublished((itemRes.data ?? []) as ContentItem[]);
      setSources((sourceRes.data ?? []) as ContentSource[]);
      setImages((imageRes.data ?? []) as ContentImage[]);
      setEdits((current) => {
        const next = { ...current };
        nextCandidates.forEach((candidate) => {
          if (!next[candidate.id]) {
            next[candidate.id] = {
              score: candidate.admin_score ?? 5,
              note: candidate.admin_note ?? '',
            };
          }
        });
        return next;
      });
    } catch (error: any) {
      setMessage(error?.message || 'İçerik merkezi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const queue = useMemo(
    () => candidates.filter((candidate) => ['pending', 'held'].includes(candidate.workflow_status)),
    [candidates],
  );

  const imageForCandidate = (candidateId: string) =>
    images.find((image) => image.candidate_id === candidateId && image.is_cover) ??
    images.find((image) => image.candidate_id === candidateId);

  const setCandidateEdit = (candidateId: string, patch: Partial<CandidateEdits>) => {
    setEdits((current) => ({
      ...current,
      [candidateId]: {
        score: current[candidateId]?.score ?? 5,
        note: current[candidateId]?.note ?? '',
        ...patch,
      },
    }));
  };

  const reviewCandidate = async (candidate: Candidate, status: 'held' | 'rejected') => {
    setWorkingId(candidate.id);
    setMessage('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Admin oturumu bulunamadı.');
      const edit = edits[candidate.id] ?? { score: 5, note: '' };
      const { error } = await supabase
        .from('content_candidates')
        .update({
          workflow_status: status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user.id,
          admin_score: edit.score,
          admin_note: edit.note || null,
        })
        .eq('id', candidate.id);
      if (error) throw error;

      await supabase.from('content_feedback').insert({
        candidate_id: candidate.id,
        score: edit.score,
        feedback_note: edit.note || null,
        created_by: auth.user.id,
      });

      setMessage(status === 'held' ? 'İçerik beklemeye alındı.' : 'İçerik reddedildi.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || 'İşlem tamamlanamadı.');
    } finally {
      setWorkingId('');
    }
  };

  const publishCandidate = async (candidate: Candidate) => {
    setWorkingId(candidate.id);
    setMessage('');
    try {
      if (candidate.copyright_status === 'blocked') {
        throw new Error('Telif durumu engelli olan içerik yayınlanamaz.');
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Admin oturumu bulunamadı.');

      const edit = edits[candidate.id] ?? { score: 5, note: '' };
      const now = new Date().toISOString();
      let contentId = candidate.target_content_id;

      if (candidate.candidate_type === 'knowledge_update' && candidate.target_content_id) {
        const { error } = await supabase
          .from('content_items')
          .update({
            title: candidate.title_suggested,
            excerpt: candidate.short_summary,
            body: candidate.body_draft || candidate.short_summary || '',
            tags: candidate.suggested_tags ?? [],
            crop_tags: candidate.suggested_crops ?? [],
            source_refs: candidate.source_refs ?? [],
            status: 'published',
            published_at: now,
            last_scientific_update_at: now,
            updated_by: auth.user.id,
            updated_at: now,
          })
          .eq('id', candidate.target_content_id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('content_items')
          .insert({
            content_type: candidate.candidate_type === 'news' ? 'news' : 'knowledge',
            title: candidate.title_suggested,
            slug: slugify(candidate.title_suggested, candidate.id),
            excerpt: candidate.short_summary,
            body: candidate.body_draft || candidate.short_summary || '',
            tags: candidate.suggested_tags ?? [],
            crop_tags: candidate.suggested_crops ?? [],
            source_refs: candidate.source_refs ?? [],
            status: 'published',
            created_from_candidate_id: candidate.id,
            published_at: now,
            last_scientific_update_at: candidate.candidate_type === 'news' ? null : now,
            created_by: auth.user.id,
            updated_by: auth.user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        contentId = data.id;
      }

      const { error: candidateError } = await supabase
        .from('content_candidates')
        .update({
          workflow_status: 'approved',
          target_content_id: contentId,
          reviewed_at: now,
          reviewed_by: auth.user.id,
          admin_score: edit.score,
          admin_note: edit.note || null,
        })
        .eq('id', candidate.id);
      if (candidateError) throw candidateError;

      await supabase.from('content_feedback').insert({
        candidate_id: candidate.id,
        content_id: contentId,
        score: edit.score,
        feedback_note: edit.note || null,
        created_by: auth.user.id,
      });

      const candidateImages = images.filter((image) => image.candidate_id === candidate.id);
      if (candidateImages.length && contentId) {
        const safeImageIds = candidateImages
          .filter((image) => image.license_type && !['review_required', 'unknown'].includes(image.license_type))
          .map((image) => image.id);
        if (safeImageIds.length) {
          await supabase
            .from('content_images')
            .update({ content_id: contentId, status: 'approved' })
            .in('id', safeImageIds);
        }
      }

      setMessage('İçerik onaylandı ve yayınlandı.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || 'Yayınlama tamamlanamadı.');
    } finally {
      setWorkingId('');
    }
  };

  const removePublished = async (item: ContentItem) => {
    setWorkingId(item.id);
    setMessage('');
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) throw error;
      setMessage('İçerik yayından kaldırıldı.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || 'İçerik yayından kaldırılamadı.');
    } finally {
      setWorkingId('');
    }
  };

  const toggleSource = async (source: ContentSource) => {
    setWorkingId(source.id);
    setMessage('');
    try {
      const { error } = await supabase
        .from('content_sources')
        .update({ active: !source.active, updated_at: new Date().toISOString() })
        .eq('id', source.id);
      if (error) throw error;
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || 'Kaynak durumu değiştirilemedi.');
    } finally {
      setWorkingId('');
    }
  };

  const scanSource = async (source: ContentSource) => {
    setWorkingId(source.id);
    setMessage(`${source.name} taranıyor…`);
    try {
      const { data, error } = await supabase.functions.invoke('content-engine-scan', {
        body: {
          sourceId: source.id,
          maxSources: 1,
          maxItemsPerSource: 4,
        },
      });
      if (error) throw error;
      const created = Number(data?.candidatesCreated ?? 0);
      setMessage(`${source.name} tarandı. ${created} yeni aday kuyruğa eklendi.`);
      await loadAll();
    } catch (error: any) {
      setMessage(error?.message || 'Kaynak taranamadı.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="tp-content-admin">
      <header className="tp-content-admin__head">
        <div>
          <span>ADMIN · OTOMATİK İÇERİK MOTORU</span>
          <h2>İçerik Merkezi</h2>
          <p>Motor bulur ve taslağı hazırlar. Yayına çıkacak son içeriği yalnız admin belirler.</p>
        </div>
        <button type="button" onClick={() => void loadAll()} disabled={loading}>Yenile</button>
      </header>

      <div className="tp-content-admin__stats">
        <article><strong>{queue.length}</strong><span>Onay bekleyen</span></article>
        <article><strong>{published.filter((item) => item.status === 'published').length}</strong><span>Yayında</span></article>
        <article><strong>{sources.filter((source) => source.active).length}</strong><span>Aktif kaynak</span></article>
        <article><strong>{sources.length}</strong><span>Toplam kaynak</span></article>
      </div>

      <nav className="tp-content-admin__tabs">
        <button className={activeTab === 'queue' ? 'active' : ''} onClick={() => setActiveTab('queue')}>Onay Kuyruğu</button>
        <button className={activeTab === 'published' ? 'active' : ''} onClick={() => setActiveTab('published')}>Yayınlananlar</button>
        <button className={activeTab === 'sources' ? 'active' : ''} onClick={() => setActiveTab('sources')}>Kaynaklar</button>
      </nav>

      {message && <div className="tp-content-admin__message">{message}</div>}
      {loading && <div className="tp-content-admin__empty">İçerik merkezi yükleniyor…</div>}

      {!loading && activeTab === 'queue' && (
        <div className="tp-content-admin__list">
          {!queue.length && <div className="tp-content-admin__empty">Şu anda onay bekleyen içerik yok.</div>}
          {queue.map((candidate) => {
            const cover = imageForCandidate(candidate.id);
            const url = sourceUrl(candidate);
            const edit = edits[candidate.id] ?? { score: 5, note: '' };
            return (
              <article className="tp-content-card" key={candidate.id}>
                <div className="tp-content-card__main">
                  {cover?.original_url && (
                    <div className="tp-content-card__image">
                      <img src={cover.public_url || cover.original_url} alt="" />
                      <span>{cover.license_type || 'lisans incelenecek'}</span>
                    </div>
                  )}
                  <div className="tp-content-card__copy">
                    <div className="tp-content-card__chips">
                      <span>{typeLabel(candidate.candidate_type)}</span>
                      <span>{candidate.suggested_category || 'genel'}</span>
                      <span className={`copyright ${candidate.copyright_status}`}>Telif: {candidate.copyright_status}</span>
                      <span>{candidate.workflow_status === 'held' ? 'Beklemede' : 'Yeni'}</span>
                    </div>
                    <h3>{candidate.title_suggested}</h3>
                    <p>{candidate.short_summary || 'Kısa özet oluşturulmamış.'}</p>
                    <div className="tp-content-card__scores">
                      <span>İlgi <b>{candidate.relevance_score ?? '—'}</b></span>
                      <span>Güven <b>{candidate.trust_score ?? '—'}</b></span>
                      <span>Yenilik <b>{candidate.novelty_score ?? '—'}</b></span>
                    </div>
                    <div className="tp-content-card__source">
                      <b>{sourceName(candidate)}</b>
                      <span>{fmtDate(candidate.generated_at)}</span>
                      {url && <a href={url} target="_blank" rel="noreferrer">Kaynağı aç ↗</a>}
                    </div>
                    {candidate.body_draft && <details><summary>Taslağın tamamını gör</summary><div className="tp-content-card__body">{candidate.body_draft}</div></details>}
                  </div>
                </div>

                <div className="tp-content-card__review">
                  <label>
                    Admin puanı
                    <select value={edit.score} onChange={(event) => setCandidateEdit(candidate.id, { score: Number(event.target.value) })}>
                      <option value={5}>5 — Çok iyi</option>
                      <option value={4}>4 — İyi</option>
                      <option value={3}>3 — Orta</option>
                      <option value={2}>2 — Zayıf</option>
                      <option value={1}>1 — Kötü</option>
                    </select>
                  </label>
                  <label className="note">
                    Not
                    <textarea value={edit.note} onChange={(event) => setCandidateEdit(candidate.id, { note: event.target.value })} placeholder="Motorun sonraki taslaklarda öğrenmesini istediğin not…" />
                  </label>
                </div>

                <div className="tp-content-card__actions">
                  <button className="publish" disabled={workingId === candidate.id || candidate.copyright_status === 'blocked'} onClick={() => void publishCandidate(candidate)}>Onayla & Yayınla</button>
                  <button disabled={workingId === candidate.id} onClick={() => void reviewCandidate(candidate, 'held')}>Beklet</button>
                  <button className="danger" disabled={workingId === candidate.id} onClick={() => void reviewCandidate(candidate, 'rejected')}>Reddet</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && activeTab === 'published' && (
        <div className="tp-content-admin__list">
          {!published.length && <div className="tp-content-admin__empty">Henüz yayınlanan içerik yok.</div>}
          {published.map((item) => (
            <article className="tp-published-row" key={item.id}>
              <div>
                <span>{item.content_type === 'news' ? 'Haber' : 'Bilgi Merkezi'}</span>
                <h3>{item.title}</h3>
                <p>{item.excerpt || 'Özet yok.'}</p>
                <small>{item.status} · {fmtDate(item.published_at || item.updated_at)}</small>
              </div>
              {item.status === 'published' && <button className="danger" disabled={workingId === item.id} onClick={() => void removePublished(item)}>Yayından kaldır</button>}
            </article>
          ))}
        </div>
      )}

      {!loading && activeTab === 'sources' && (
        <div className="tp-source-grid">
          {sources.map((source) => (
            <article className="tp-source-card" key={source.id}>
              <div className="tp-source-card__top">
                <div>
                  <span>{source.source_type.toUpperCase()} · {source.language.toUpperCase()}</span>
                  <h3>{source.name}</h3>
                </div>
                <label className="tp-switch">
                  <input type="checkbox" checked={source.active} onChange={() => void toggleSource(source)} disabled={workingId === source.id} />
                  <i />
                </label>
              </div>
              <a href={source.base_url} target="_blank" rel="noreferrer">{source.base_url}</a>
              <div className="tp-source-card__meta">
                <span>Güven: <b>{source.trust_score}/100</b></span>
                <span>Sıklık: <b>{source.scan_frequency_hours} sa.</b></span>
                <span>Son tarama: <b>{fmtDate(source.last_scanned_at)}</b></span>
              </div>
              <button type="button" disabled={!source.active || workingId === source.id} onClick={() => void scanSource(source)}>{workingId === source.id ? 'Taranıyor…' : 'Şimdi tara'}</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
