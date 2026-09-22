import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { buildFieldCostSummary, type CostActivity } from '../services/fieldCostSummary';
import './FieldCostSummary.css';

const money = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(value);

export default function FieldCostSummary({ activities, area, loading, onAdd }: {
  activities: CostActivity[]; area: number | null | undefined; loading: boolean; onAdd: () => void;
}) {
  const [allYears, setAllYears] = useState(false);
  const now = new Date();
  const year = now.getFullYear();
  const today = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const summary = buildFieldCostSummary(activities, area, allYears ? null : year, today);
  return <section className="tp-field-cost" aria-label="Tarla işlem masrafları">
    <div className="tp-field-cost-head"><ReceiptText size={22} aria-hidden="true" /><div><small>MASRAF DEFTERİ</small><h2>Bu tarlaya ne harcadım?</h2></div></div>
    <div className="tp-field-cost-filter" role="group" aria-label="Masraf dönemi"><button type="button" aria-pressed={!allYears} onClick={() => setAllYears(false)}>Bu yıl · {year}</button><button type="button" aria-pressed={allYears} onClick={() => setAllYears(true)}>Tüm yıllar</button></div>
    {loading ? <p role="status">Masraf kayıtları yükleniyor…</p> : <>
      <div className="tp-field-cost-total"><small>Kaydedilen işlem gideri</small><strong>{summary.recordedCount ? money(summary.total) : 'Tutar kaydı yok'}</strong><span>{summary.recordedCount} kayıtta tutar var · {summary.activityCount} işlem</span></div>
      {summary.recordedCount > 0 && <p className="tp-field-cost-area">{summary.perDecare === null ? 'Dönüm başına hesap için tarla alanını tamamla.' : `Dönüm başına ${money(summary.perDecare)}`}</p>}
      {summary.missingCount > 0 && <p className="tp-field-cost-note">{summary.missingCount} işlemin tutarı eksik veya geçersiz. Bu toplam tarlanın bütün masrafını göstermiyor.</p>}
      {summary.undatedCount > 0 && <p className="tp-field-cost-note">{summary.undatedCount} kaydın tarihi okunamadığı için hesaba katılmadı.</p>}
      {summary.futureCount > 0 && <p className="tp-field-cost-note">{summary.futureCount} ileri tarihli kayıt gerçekleşen masrafa katılmadı.</p>}
      {summary.groups.length > 0 && <ul className="tp-field-cost-groups">{summary.groups.map((group) => <li key={group.type}><span>{group.type}<small>{group.count} kayıt</small></span><strong>{money(group.total)}</strong></li>)}</ul>}
      <p className="tp-field-cost-scope">İşlem kayıtlarına yazdığın toplam tutarlar kullanılır. Depo alışverişleri ve ayrı gider kayıtları bu toplama dahil değildir.</p>
      <button className="tp-field-cost-add" type="button" onClick={onAdd}>Masraflı işlem kaydet <span aria-hidden="true">＋</span></button>
    </>}
  </section>;
}
