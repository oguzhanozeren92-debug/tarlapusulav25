import { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import type { FieldActivity, FieldSeason } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { refreshModelReadiness } from '../../../services/modelReadiness.service';
import { buildFieldSeasonSummaries } from '../services/fieldSeasonSummary';
import './FieldSeasonSummary.css';

const money = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

function SeasonVarietyEditor({ season }: { season: FieldSeason }) {
  const [value, setValue] = useState(season.varietyName ?? '');
  const [savedValue, setSavedValue] = useState(season.varietyName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setValue(season.varietyName ?? '');
    setSavedValue(season.varietyName ?? '');
    setMessage('');
  }, [season.id, season.varietyName]);

  const save = async () => {
    if (busy) return;
    const normalized = value.trim();
    if (normalized.length > 120) {
      setMessage('Çeşit adı 120 karakteri geçemez.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Çeşit bilgisini kaydetmek için oturum gerekli.');

      const { error } = await supabase
        .from('field_seasons')
        .update({ variety_name: normalized || null })
        .eq('id', season.id)
        .eq('field_id', season.fieldId)
        .eq('user_id', user.id);
      if (error) throw error;

      setSavedValue(normalized);
      setValue(normalized);
      setMessage(normalized ? 'Çeşit kaydedildi.' : 'Çeşit bilgisi kaldırıldı.');

      const readiness = await refreshModelReadiness(season.fieldId, 'pcse');
      if (!readiness.ok) {
        console.warn('[season-variety] PCSE readiness refresh failed', readiness.error);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Çeşit kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const changed = value.trim() !== savedValue;

  return (
    <div className="tp-field-season-variety">
      <label>
        Çeşit (varsa)
        <input
          value={value}
          maxLength={120}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage('');
          }}
          placeholder="Örn. Bezostaja, Esperia..."
        />
      </label>
      <button type="button" onClick={() => void save()} disabled={busy || !changed}>
        {busy ? 'Kaydediliyor…' : 'Çeşidi kaydet'}
      </button>
      {message && <small role="status">{message}</small>}
      <p>Bu çiftçinin gerçek çeşit bilgisidir. Model çeşidi ayrıca doğrulanır; sistem varsayılan model çeşidi seçmez.</p>
    </div>
  );
}

export default function FieldSeasonSummary({ seasons, activities, loading }: {
  seasons: FieldSeason[]; activities: FieldActivity[]; loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const summaries = buildFieldSeasonSummaries(seasons, activities, today);
  return <section className="tp-field-season-summary" aria-label="Sezon masraf ve hasat özeti">
    <div className="tp-field-season-summary-head"><CalendarRange size={22} aria-hidden="true" /><div><small>SEZON DEFTERİ</small><h3>Bir sezonda ne yaptım?</h3></div></div>
    {loading ? <p role="status">Sezon ve işlem kayıtları yükleniyor…</p> : summaries.length === 0 ? <p>Sezon kaydını ekleyince o sezonun masrafı ve kaydedilen hasadı burada birleşecek.</p> : <>
      {(expanded ? summaries : summaries.slice(0, 2)).map((summary) => {
        const season = seasons.find((item) => item.id === summary.id);
        return <details key={summary.id} className="tp-field-season-summary-item">
          <summary><span><strong>{summary.year} · {summary.crop}</strong><small>{summary.complete ? 'Hasat tarihi kayıtlı' : 'Sezon kaydı devam ediyor'}</small></span><span aria-hidden="true">⌄</span></summary>
          {summary.message ? <p>{summary.message}</p> : <div className="tp-field-season-summary-content">
            <p>{dateLabel(summary.start!)} – {dateLabel(summary.end)}{!summary.complete ? ' · bugüne kadar' : ''}</p>
            <div><span>Kaydedilen işlem masrafı</span><strong>{summary.cost?.recordedCount ? money(summary.cost.total) : 'Tutar kaydı yok'}</strong></div>
            <div><span>Kaydedilen hasat</span><strong>{summary.harvestKg === null ? 'Miktar kaydı yok' : `${summary.harvestKg.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg`}</strong></div>
            {summary.cost && summary.cost.missingCount > 0 && <p>{summary.cost.missingCount} işlemin tutarı eksik veya geçersiz; masraf toplamı eksik olabilir.</p>}
            {summary.missingHarvestCount > 0 && <p>{summary.missingHarvestCount} hasat kaydında miktar veya kg/ton birimi eksik. Bunlar hasat toplamına katılmadı.</p>}
            <p>{summary.cost?.activityCount ?? 0} işlem kaydı bu tarih aralığında.</p>
            {season && <SeasonVarietyEditor season={season} />}
          </div>}
        </details>;
      })}
      {summaries.length > 2 && <button type="button" className="tp-field-season-summary-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Son iki sezonu göster' : `Diğer sezonları göster · ${summaries.length - 2}`}</button>}
    </>}
    <p className="tp-field-season-summary-note">Ekim–hasat arasındaki tarla işlem kayıtları kullanılır. Satış geliri kaydı olmadığı için kâr hesabı yapılmaz.</p>
  </section>;
}
