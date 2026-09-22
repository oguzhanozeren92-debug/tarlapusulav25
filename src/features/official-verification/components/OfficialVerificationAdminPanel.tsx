import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../../supabaseClient';

type SourceRow = {
  provider_key: string;
  domain: string;
  name: string;
  authority: string;
  base_url: string;
  verification_mode: string;
  programmatic_access: string;
  enabled: boolean;
  updated_at: string;
};

type ValidationRow = {
  id: string;
  provider_key: string;
  provider_record_id: string | null;
  crop: string | null;
  pest_or_disease: string | null;
  active_ingredient: string | null;
  product_name: string | null;
  verification_status: string;
  source_url: string;
  source_observed_at: string;
  valid_until: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  domain: string;
  source: string;
  status: string;
  crop: string | null;
  issue: string | null;
  source_url: string | null;
  source_reachable: boolean | null;
  blocked_recommendations: unknown;
  verification: Record<string, unknown> | null;
  created_at: string;
};

type FormState = {
  providerRecordId: string;
  crop: string;
  issue: string;
  activeIngredient: string;
  productName: string;
  sourceUrl: string;
  observedAt: string;
  validUntil: string;
  note: string;
};

const BKU_SEARCH_URL = 'https://bku.tarimorman.gov.tr/Arama/Index';

const EMPTY_FORM: FormState = {
  providerRecordId: '',
  crop: '',
  issue: '',
  activeIngredient: '',
  productName: '',
  sourceUrl: BKU_SEARCH_URL,
  observedAt: new Date().toISOString().slice(0, 10),
  validUntil: '',
  note: '',
};

const CSS = String.raw`
.tp-official-admin{display:grid;gap:14px;color:#173526}
.tp-official-admin-card{background:#fff;border:1px solid #dfe7df;border-radius:16px;padding:16px;box-shadow:0 8px 22px rgba(22,60,39,.04)}
.tp-official-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tp-official-admin-head h2,.tp-official-admin-head h3{margin:0;color:#173526}
.tp-official-admin-head p{margin:5px 0 0;color:#708078;font-size:12px;line-height:1.5;max-width:760px}
.tp-official-admin-actions{display:flex;gap:7px;flex-wrap:wrap}
.tp-official-admin button,.tp-official-admin a.tp-official-admin-btn{min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;border:1px solid #d8e2d9;border-radius:10px;background:#fff;color:#294436;text-decoration:none;font:800 11px/1 Inter,system-ui,sans-serif;cursor:pointer}
.tp-official-admin button.primary{background:#1f5a38;border-color:#1f5a38;color:#fff}
.tp-official-admin button:disabled{opacity:.55;cursor:wait}
.tp-official-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
.tp-official-admin label{display:grid;gap:5px;color:#31493a;font-size:11px;font-weight:800}
.tp-official-admin input,.tp-official-admin textarea,.tp-official-admin select{width:100%;box-sizing:border-box;border:1px solid #d7e1d8;border-radius:10px;background:#fff;color:#173526;font:inherit}
.tp-official-admin input,.tp-official-admin select{height:40px;padding:0 11px}.tp-official-admin textarea{min-height:82px;padding:10px;resize:vertical}
.tp-official-admin-wide{grid-column:1/-1}
.tp-official-admin-note{padding:10px 12px;border:1px solid #dfe7df;border-radius:12px;background:#f6f8f6;color:#586a60;font-size:11px;line-height:1.5}
.tp-official-admin-message{padding:10px 12px;border-radius:12px;background:#eef6f0;color:#315a42;font-size:11px;font-weight:800}
.tp-official-admin-source-list,.tp-official-admin-record-list,.tp-official-admin-audit-list{display:grid;gap:8px;margin-top:12px}
.tp-official-admin-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #e2e9e2;border-radius:12px;background:#fff}
.tp-official-admin-row strong{display:block;color:#173526;font-size:12px}.tp-official-admin-row small{display:block;margin-top:3px;color:#78867e;font-size:10px;line-height:1.4}
.tp-official-admin-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.tp-official-admin-chip{padding:4px 7px;border-radius:999px;background:#f1f4f1;color:#5a6a61;font-size:8px;font-weight:900}.tp-official-admin-chip.verified{background:#173526;color:#fff}.tp-official-admin-chip.warning{background:#fff1dc;color:#8a5a12}
.tp-official-admin-empty{margin-top:12px;color:#7b8881;font-size:11px}
@media(max-width:720px){.tp-official-admin-grid{grid-template-columns:1fr}.tp-official-admin-wide{grid-column:auto}.tp-official-admin-row{grid-template-columns:1fr}}
`;

function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function blockedCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default function OfficialVerificationAdminPanel() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [records, setRecords] = useState<ValidationRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const bku = useMemo(
    () => sources.find((source) => source.provider_key === 'tr_bku') ?? null,
    [sources],
  );

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [sourceResult, recordResult, auditResult] = await Promise.all([
        supabase
          .from('official_source_registry')
          .select('*')
          .order('provider_key'),
        supabase
          .from('official_validation_records')
          .select('id,provider_key,provider_record_id,crop,pest_or_disease,active_ingredient,product_name,verification_status,source_url,source_observed_at,valid_until,created_at')
          .order('source_observed_at', { ascending: false })
          .limit(80),
        supabase
          .from('official_verification_events')
          .select('id,domain,source,status,crop,issue,source_url,source_reachable,blocked_recommendations,verification,created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ]);

      if (sourceResult.error) throw sourceResult.error;
      if (recordResult.error) throw recordResult.error;
      if (auditResult.error) throw auditResult.error;

      setSources((sourceResult.data ?? []) as SourceRow[]);
      setRecords((recordResult.data ?? []) as ValidationRow[]);
      setAudits((auditResult.data ?? []) as AuditRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Resmî doğrulama verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveBkuSnapshot = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.crop.trim() || !form.issue.trim() || !form.sourceUrl.trim()) {
      setMessage('BKU kaydı için ürün, hastalık/zararlı ve resmî kaynak bağlantısı gerekli.');
      return;
    }
    if (!/^https:\/\/bku\.tarimorman\.gov\.tr\//i.test(form.sourceUrl.trim())) {
      setMessage('BKU snapshot kaynağı bku.tarimorman.gov.tr alanında olmalı.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Admin oturumu bulunamadı.');

      const observedIso = new Date(`${form.observedAt}T12:00:00Z`).toISOString();
      const validUntilIso = form.validUntil
        ? new Date(`${form.validUntil}T23:59:59Z`).toISOString()
        : null;
      const subjectName = form.productName.trim() || form.activeIngredient.trim() || form.issue.trim();

      const { error } = await supabase.from('official_validation_records').insert({
        provider_key: 'tr_bku',
        provider_record_id: form.providerRecordId.trim() || null,
        domain: 'plant_protection',
        subject_type: form.productName.trim()
          ? 'product_recommendation'
          : form.activeIngredient.trim()
            ? 'active_ingredient_recommendation'
            : 'crop_issue_recommendation',
        subject_name: subjectName,
        crop: form.crop.trim(),
        pest_or_disease: form.issue.trim(),
        active_ingredient: form.activeIngredient.trim() || null,
        product_name: form.productName.trim() || null,
        verification_status: 'verified',
        source_url: form.sourceUrl.trim(),
        source_observed_at: observedIso,
        valid_until: validUntilIso,
        source_snapshot: {
          source: 'BKU',
          manuallyReviewed: true,
          crop: form.crop.trim(),
          issue: form.issue.trim(),
          activeIngredient: form.activeIngredient.trim() || null,
          productName: form.productName.trim() || null,
          providerRecordId: form.providerRecordId.trim() || null,
          sourceUrl: form.sourceUrl.trim(),
          observedAt: observedIso,
        },
        metadata: {
          reviewMode: 'admin_official_web',
          note: form.note.trim() || null,
        },
        verified_by: authData.user.id,
      });
      if (error) throw error;

      setForm({ ...EMPTY_FORM, observedAt: new Date().toISOString().slice(0, 10) });
      setMessage('BKU resmî snapshot kaydı doğrulama havuzuna eklendi.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'BKU snapshot kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const markStale = async (id: string) => {
    if (!window.confirm('Bu resmî snapshot eski/geçersiz olarak işaretlensin mi?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('official_validation_records')
        .update({ verification_status: 'stale', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setMessage('Snapshot stale olarak işaretlendi; Pusula artık bunu doğrulama için kullanmayacak.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Snapshot güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="tp-official-admin">
      <style>{CSS}</style>

      <div className="tp-official-admin-card">
        <div className="tp-official-admin-head">
          <div>
            <h2>Türkiye Resmî Doğrulama</h2>
            <p>
              Pusula AI kimyasal ürün veya doz önerisini tek başına yayınlamaz. BKU için yalnız admin tarafından güncel resmî sayfadan doğrulanıp kaydedilen snapshotlar eşleşme kanıtı sayılır.
            </p>
          </div>
          <div className="tp-official-admin-actions">
            <a className="tp-official-admin-btn" href={BKU_SEARCH_URL} target="_blank" rel="noreferrer noopener">BKU resmî aramayı aç ↗</a>
            <button type="button" onClick={() => void load()} disabled={loading || saving}>↻ Yenile</button>
          </div>
        </div>
        {message ? <div className="tp-official-admin-message" style={{ marginTop: 12 }}>{message}</div> : null}
      </div>

      <div className="tp-official-admin-card">
        <div className="tp-official-admin-head">
          <div>
            <h3>Resmî kaynak kayıtları</h3>
            <p>Programatik erişim doğrulanana kadar BKU/GTS/TAGEM için web kaynağı + admin snapshot yaklaşımı kullanılır.</p>
          </div>
        </div>
        <div className="tp-official-admin-source-list">
          {sources.map((source) => (
            <div className="tp-official-admin-row" key={source.provider_key}>
              <div>
                <strong>{source.authority} · {source.name}</strong>
                <small>{source.domain} · {source.verification_mode}</small>
                <div className="tp-official-admin-chips">
                  <span className={`tp-official-admin-chip ${source.enabled ? 'verified' : 'warning'}`}>{source.enabled ? 'AKTİF' : 'KAPALI'}</span>
                  <span className="tp-official-admin-chip">API: {source.programmatic_access}</span>
                </div>
              </div>
              <a className="tp-official-admin-btn" href={source.base_url} target="_blank" rel="noreferrer noopener">Kaynağı aç</a>
            </div>
          ))}
        </div>
      </div>

      <form className="tp-official-admin-card" onSubmit={saveBkuSnapshot}>
        <div className="tp-official-admin-head">
          <div>
            <h3>BKU doğrulama snapshotı ekle</h3>
            <p>Bu kayıt “ruhsat etiketi yerine geçmez”. Pusula yalnız ürün + bitki + hastalık/zararlı eşleşmesinin güncel resmî kayıtta görüldüğünü kanıt olarak kullanır.</p>
          </div>
          {bku ? <span className="tp-official-admin-chip verified">{bku.provider_key}</span> : null}
        </div>
        <div className="tp-official-admin-grid">
          <label>Ürün / bitki<input value={form.crop} onChange={(e) => setForm((x) => ({ ...x, crop: e.target.value }))} placeholder="Örn. Buğday" /></label>
          <label>Hastalık / zararlı<input value={form.issue} onChange={(e) => setForm((x) => ({ ...x, issue: e.target.value }))} placeholder="Örn. Sarı pas" /></label>
          <label>Aktif madde<input value={form.activeIngredient} onChange={(e) => setForm((x) => ({ ...x, activeIngredient: e.target.value }))} placeholder="Varsa" /></label>
          <label>Ticari ürün<input value={form.productName} onChange={(e) => setForm((x) => ({ ...x, productName: e.target.value }))} placeholder="Varsa" /></label>
          <label>BKU kayıt/ref no<input value={form.providerRecordId} onChange={(e) => setForm((x) => ({ ...x, providerRecordId: e.target.value }))} placeholder="Varsa resmî referans" /></label>
          <label>Kaynak kontrol tarihi<input type="date" value={form.observedAt} onChange={(e) => setForm((x) => ({ ...x, observedAt: e.target.value }))} /></label>
          <label>Geçerlilik sonu<input type="date" value={form.validUntil} onChange={(e) => setForm((x) => ({ ...x, validUntil: e.target.value }))} /></label>
          <label className="tp-official-admin-wide">BKU kaynak URL<input value={form.sourceUrl} onChange={(e) => setForm((x) => ({ ...x, sourceUrl: e.target.value }))} /></label>
          <label className="tp-official-admin-wide">Admin notu<textarea value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} placeholder="Kaydı hangi BKU ekranından ve hangi eşleşmeyle doğruladın?" /></label>
        </div>
        <div className="tp-official-admin-note" style={{ marginTop: 12 }}>
          Doz bilgisi bu snapshot üzerinden otomatik reçeteye dönüşmez. Pusula Guard doz içeren kimyasal talimatı her durumda ayrıca engeller; uygulama etiketi kullanıcı tarafından güncel BKU kaydından kontrol edilir.
        </div>
        <button className="primary" type="submit" disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Kaydediliyor…' : 'Doğrulanmış snapshotı kaydet'}</button>
      </form>

      <div className="tp-official-admin-card">
        <div className="tp-official-admin-head"><div><h3>Doğrulama snapshotları</h3><p>Guard yalnız “verified”, süresi dolmamış ve son 14 gün içinde kontrol edilmiş kayıtları kullanır.</p></div></div>
        <div className="tp-official-admin-record-list">
          {records.length === 0 ? <div className="tp-official-admin-empty">Henüz resmî doğrulama snapshotı yok.</div> : records.map((record) => (
            <div className="tp-official-admin-row" key={record.id}>
              <div>
                <strong>{record.crop || 'Ürün yok'} · {record.pest_or_disease || 'Hedef yok'}</strong>
                <small>{record.product_name || record.active_ingredient || 'Ürün/aktif madde belirtilmedi'} · kaynak: {dateTime(record.source_observed_at)}</small>
                <div className="tp-official-admin-chips">
                  <span className={`tp-official-admin-chip ${record.verification_status === 'verified' ? 'verified' : 'warning'}`}>{record.verification_status.toLocaleUpperCase('tr-TR')}</span>
                  {record.provider_record_id ? <span className="tp-official-admin-chip">REF {record.provider_record_id}</span> : null}
                </div>
              </div>
              <div className="tp-official-admin-actions">
                <a className="tp-official-admin-btn" href={record.source_url} target="_blank" rel="noreferrer noopener">Kaynak</a>
                {record.verification_status === 'verified' ? <button type="button" onClick={() => void markStale(record.id)} disabled={saving}>Stale yap</button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tp-official-admin-card">
        <div className="tp-official-admin-head"><div><h3>Guard denetim izi</h3><p>Son AI analizlerinde hangi resmî kaynağın kontrol edildiğini ve kaç doğrulanmamış kimyasal önerinin engellendiğini gösterir.</p></div></div>
        <div className="tp-official-admin-audit-list">
          {audits.length === 0 ? <div className="tp-official-admin-empty">Henüz doğrulama olayı yok.</div> : audits.map((audit) => {
            const blocked = blockedCount(audit.blocked_recommendations);
            return (
              <div className="tp-official-admin-row" key={audit.id}>
                <div>
                  <strong>{audit.source} · {audit.status}</strong>
                  <small>{audit.crop || 'ürün yok'} · {audit.issue || 'ön değerlendirme yok'} · {dateTime(audit.created_at)}</small>
                  <div className="tp-official-admin-chips">
                    <span className={`tp-official-admin-chip ${audit.status === 'verified' ? 'verified' : 'warning'}`}>{audit.status.toLocaleUpperCase('tr-TR')}</span>
                    <span className="tp-official-admin-chip">Kaynak {audit.source_reachable ? 'erişilebilir' : 'erişim yok/ölçülmedi'}</span>
                    {blocked > 0 ? <span className="tp-official-admin-chip warning">{blocked} öneri engellendi</span> : null}
                  </div>
                </div>
                {audit.source_url ? <a className="tp-official-admin-btn" href={audit.source_url} target="_blank" rel="noreferrer noopener">Kaynak</a> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
