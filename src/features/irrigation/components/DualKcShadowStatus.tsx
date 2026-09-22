import { useEffect, useMemo, useState } from 'react';
import {
  loadLatestDualKcShadowAudit,
  runDualKcShadowEvidence,
  summarizeDualKcShadowRange,
  type DualKcShadowAudit,
} from '../services/dualKcShadow.service';

const CSS = String.raw`
.tp-dual-water-status{margin-top:12px;padding:16px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;color:#171717;box-shadow:0 8px 24px rgba(0,0,0,.045)}
.tp-dual-water-status-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.tp-dual-water-status-kicker{display:block;color:#737373;font-size:9px;font-weight:800;letter-spacing:.10em}
.tp-dual-water-status h3{margin:5px 0 0;font-size:16px;line-height:1.25;color:#171717}
.tp-dual-water-status-pill{flex:0 0 auto;padding:7px 9px;border-radius:999px;background:#f5f5f5;border:1px solid #e5e5e5;color:#404040;font-size:10px;font-weight:800}
.tp-dual-water-status-main{margin-top:14px;padding:13px 14px;border-radius:14px;background:#f7f7f8}
.tp-dual-water-status-main span{display:block;color:#737373;font-size:10px}
.tp-dual-water-status-main strong{display:block;margin-top:4px;color:#171717;font-size:20px}
.tp-dual-water-status-main p,.tp-dual-water-status-note{margin:7px 0 0;color:#737373;font-size:10.5px;line-height:1.45}
.tp-dual-water-status ul{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:7px}
.tp-dual-water-status li{padding:9px 10px;border-radius:12px;background:#fafafa;border:1px solid #ededed;color:#525252;font-size:10.5px;line-height:1.35}
`;

type Props = { fieldId: string; irrigationStatus?: string | null };

const FRIENDLY_MISSING: Record<string, string> = {
  field_location: 'Tarla konumu doğrulanmalı.',
  crop_water_reference_profile: 'Ürün için su referansı henüz hazır değil.',
  canopy_height: 'Ortalama ağaç boyu / bitki yüksekliği gerekli.',
  canopy_cover: 'Taç gelişimi veya örtü oranı gerekli.',
  kcb_context: 'Bitkinin bugünkü gelişim bağlamı hazırlanamadı.',
  validated_basal_kcb: 'Bugünkü gelişim evresini sahada doğrulamak gerekiyor.',
  fao56_basal_kcb_profile: 'Ürün gelişim katsayısı referansı doğrulanamadı.',
  water_balance_inputs: 'Su dengesi girdileri henüz tamamlanmadı.',
  root_zone_soil_hydraulics: 'Kök bölgesi toprak su kapasitesi hazırlanamadı.',
  current_root_zone_depletion: 'Kök bölgesi için güncel su durumu gerekiyor.',
  surface_evaporation_depth: 'Yüzey su dengesi derinliği hazırlanamadı.',
  current_surface_depletion_measurement: '0–15 cm yüzey katmanı için gerçek toprak nem ölçümü gerekiyor.',
  soil_evaporation_context: 'Toprak yüzeyi buharlaşma bağlamı hazırlanamadı.',
  fao56_rew_reference_range: 'Toprak yüzeyi su referansı doğrulanamadı.',
  depletion_fraction_p: 'Ürünün su stresi eşiği referansı doğrulanamadı.',
  dem_elevation: 'Tarla rakımı alınamadı.',
  forecast_weather: 'Kısa dönem hava tahmini alınamadı.',
  model_gateway_connection: 'Su modeli servisine şu an ulaşılamıyor.',
};

function labelForMissing(value: string) {
  return FRIENDLY_MISSING[value] ?? 'Bir model girdisi henüz doğrulanmadı.';
}

function formatRange(range: { min: number; max: number } | null) {
  if (!range) return '—';
  const min = range.min.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const max = range.max.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  return Math.abs(range.max - range.min) < 0.05 ? `${min} mm` : `${min}–${max} mm`;
}

export default function DualKcShadowStatus({ fieldId, irrigationStatus }: Props) {
  const [audit, setAudit] = useState<DualKcShadowAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fieldSaysRainfed = String(irrigationStatus ?? '').toLowerCase() === 'rainfed';
  const rainfed = audit ? audit.notApplicable : fieldSaysRainfed;

  const reload = async (reEvaluate = false) => {
    const id = String(fieldId ?? '').trim();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      if (reEvaluate) {
        await runDualKcShadowEvidence(id);
      }
      const latest = await loadLatestDualKcShadowAudit(id);
      setAudit(latest);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Su modeli durumu okunamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(true); }, [fieldId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      if (String(detail?.fieldId ?? '') !== String(fieldId)) return;
      void reload(false);
    };
    window.addEventListener('tp:dual-kc-shadow-updated', onUpdated as EventListener);
    return () => window.removeEventListener('tp:dual-kc-shadow-updated', onUpdated as EventListener);
  }, [fieldId]);

  const range = useMemo(() => summarizeDualKcShadowRange(audit), [audit]);
  const statusLabel = rainfed ? 'Sulama modeli yok' : loading ? 'Kontrol ediliyor' : audit?.status === 'completed' ? 'Model hazır' : audit?.status === 'running' || audit?.status === 'queued' ? 'Hazırlanıyor' : audit?.status === 'failed' ? 'Kontrol gerekli' : 'Veri bekliyor';
  const missing = [...new Set(audit?.missingInputs ?? [])].map(labelForMissing).slice(0, 5);

  return (
    <section className="tp-dual-water-status" aria-label="Gelişmiş su modeli durumu">
      <style>{CSS}</style>
      <div className="tp-dual-water-status-head">
        <div><small className="tp-dual-water-status-kicker">SU DENGESİ · MODEL KANITI</small><h3>Su modeli</h3></div>
        <span className="tp-dual-water-status-pill">{statusLabel}</span>
      </div>
      {rainfed ? (
        <p className="tp-dual-water-status-note">Tarla susuz olarak kayıtlı. Bu sulama modeli bu tarla için reçete üretmez; yağış ve kuraklık riski ayrı izlenir.</p>
      ) : range?.rootDepletionMm ? (
        <div className="tp-dual-water-status-main">
          <span>Kök bölgesi tahmini su açığı · deneme modeli</span>
          <strong>{formatRange(range.rootDepletionMm)}</strong>
          <p>Belirsizlik aralığı korunur. Bu sonuç henüz otomatik sulama emri veya kesin su miktarı değildir.</p>
        </div>
      ) : (
        <p className="tp-dual-water-status-note">{loading ? 'Gerçek saha verileri ve model kanıtları kontrol ediliyor.' : 'Model, eksik saha verisi varken değer uydurmaz. Gerekli bilgiler tamamlandıkça otomatik yeniden kontrol edilir.'}</p>
      )}
      {!rainfed && missing.length > 0 ? <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {error ? <p className="tp-dual-water-status-note" role="alert">{error}</p> : null}
      {!rainfed ? <p className="tp-dual-water-status-note">Bu kart yalnız model kanıtını gösterir. TarlaPusula sulama kararında production otoritesi olarak kullanılmıyor.</p> : null}
    </section>
  );
}
