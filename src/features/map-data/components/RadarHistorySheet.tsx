import { useEffect, useMemo, useRef } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  RotateCcw,
  Satellite,
  X,
} from 'lucide-react';

import type {
  Sentinel1RadarMode,
  Sentinel1RadarResponse,
  Sentinel1RadarScene,
} from '../../../services/sentinel1Service';

type Props = {
  open: boolean;
  fieldName: string;
  mode: Sentinel1RadarMode;
  scenes: Sentinel1RadarScene[];
  comparisonBasis?: string | null;
  loading: boolean;
  error?: string | null;
  currentData?: Sentinel1RadarResponse | null;
  selectedData?: Sentinel1RadarResponse | null;
  selectedScene?: Sentinel1RadarScene | null;
  geometry?: unknown;
  onSelect: (scene: Sentinel1RadarScene) => void;
  onResetCurrent: () => void;
  onClose: () => void;
};

const CSS = `
.tp-radar-history-dialog{
  width:min(760px,calc(100vw - 18px));
  max-height:min(820px,calc(100dvh - 20px));
  margin:auto;
  padding:0;
  border:1px solid #e5e7eb;
  border-radius:22px;
  background:#fff;
  color:#111827;
  box-shadow:0 24px 70px rgba(15,23,42,.24);
  overflow:hidden;
}
.tp-radar-history-dialog::backdrop{
  background:rgba(15,23,42,.42);
  backdrop-filter:blur(5px);
}
.tp-radar-history-shell{
  display:grid;
  grid-template-rows:auto minmax(0,1fr);
  max-height:min(820px,calc(100dvh - 20px));
  background:#fff;
}
.tp-radar-history-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  padding:16px 18px 13px;
  border-bottom:1px solid #eef0f2;
  background:#fff;
}
.tp-radar-history-head-copy{display:grid;gap:3px;min-width:0}
.tp-radar-history-kicker{
  display:flex;
  align-items:center;
  gap:6px;
  color:#4b5563;
  font-size:9.5px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.tp-radar-history-head h2{
  margin:0;
  color:#111827;
  font-size:18px;
  line-height:1.2;
}
.tp-radar-history-head p{
  margin:1px 0 0;
  color:#6b7280;
  font-size:10.5px;
  line-height:1.35;
}
.tp-radar-history-close{
  width:34px;
  height:34px;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  border:1px solid #dfe3e8;
  border-radius:11px;
  background:#fff;
  color:#111827;
  cursor:pointer;
}
.tp-radar-history-close:hover{background:#f6f7f8}
.tp-radar-history-body{
  overflow:auto;
  padding:14px 15px 17px;
  display:grid;
  gap:13px;
  background:#f7f8f9;
}
.tp-radar-history-loading,
.tp-radar-history-error,
.tp-radar-history-empty{
  padding:22px 14px;
  text-align:center;
  border:1px solid #e5e7eb;
  border-radius:15px;
  background:#fff;
  font-size:11px;
  color:#6b7280;
}
.tp-radar-history-error{
  color:#991b1b;
  background:#fff7f7;
  border-color:#fecaca;
}
.tp-radar-date-section{
  display:grid;
  gap:8px;
}
.tp-radar-date-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:0 2px;
}
.tp-radar-date-head strong{font-size:11px;color:#1f2937}
.tp-radar-date-head span{font-size:9px;color:#9ca3af}
.tp-radar-date-strip{
  display:flex;
  gap:7px;
  overflow-x:auto;
  padding:1px 1px 5px;
  scrollbar-width:thin;
}
.tp-radar-date-card{
  min-width:94px;
  min-height:52px;
  display:grid;
  align-content:center;
  gap:3px;
  position:relative;
  padding:8px 10px;
  border:1px solid #dfe3e8;
  border-radius:12px;
  background:#fff;
  color:#374151;
  text-align:left;
  cursor:pointer;
}
.tp-radar-date-card:hover{border-color:#aeb5bd;background:#fafafa}
.tp-radar-date-card.selected{
  border-color:#111827;
  box-shadow:inset 0 0 0 1px #111827;
}
.tp-radar-date-card.current{
  background:#f3f4f6;
}
.tp-radar-date-card strong{font-size:10px;line-height:1.1}
.tp-radar-date-card small{font-size:8px;color:#8b929b}
.tp-radar-date-check{
  position:absolute;
  right:6px;
  top:6px;
  width:15px;
  height:15px;
  display:grid;
  place-items:center;
  border-radius:999px;
  background:#111827;
  color:#fff;
}
.tp-radar-compare-stage{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}
.tp-radar-map-card{
  min-width:0;
  overflow:hidden;
  border:1px solid #e1e5e9;
  border-radius:16px;
  background:#fff;
}
.tp-radar-map-card-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:10px 11px 8px;
}
.tp-radar-map-card-head div{display:grid;gap:1px}
.tp-radar-map-card-head b{
  font-size:9px;
  letter-spacing:.06em;
  color:#6b7280;
  text-transform:uppercase;
}
.tp-radar-map-card-head strong{font-size:11.5px;color:#111827}
.tp-radar-map-card-head span{font-size:9px;color:#8b929b}
.tp-radar-map-image{
  position:relative;
  width:100%;
  aspect-ratio:1/1;
  display:grid;
  place-items:center;
  box-sizing:border-box;
  background:#eef0f2;
  overflow:hidden;
  border-top:1px solid #eef0f2;
  border-bottom:1px solid #eef0f2;
}
.tp-radar-map-image img{
  width:100%;
  height:100%;
  display:block;
  object-fit:contain;
  object-position:center center;
  background:#111827;
}
.tp-radar-parcel-overlay{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  pointer-events:none;
  overflow:visible;
}
.tp-radar-parcel-shadow{
  fill:transparent;
  stroke:rgba(0,0,0,.86);
  stroke-width:6;
  vector-effect:non-scaling-stroke;
  stroke-linejoin:round;
  stroke-linecap:round;
}
.tp-radar-parcel-line{
  fill:transparent;
  stroke:#22c55e;
  stroke-width:2.6;
  vector-effect:non-scaling-stroke;
  stroke-linejoin:round;
  stroke-linecap:round;
}
.tp-radar-map-placeholder{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  padding:20px;
  text-align:center;
  color:#9ca3af;
  font-size:10px;
  line-height:1.45;
}
.tp-radar-map-metric{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:9px 11px 10px;
}
.tp-radar-map-metric span{font-size:9px;color:#8b929b}
.tp-radar-map-metric strong{font-size:14px;color:#111827}
.tp-radar-summary{
  display:grid;
  gap:7px;
  padding:12px 13px;
  border:1px solid #e1e5e9;
  border-radius:15px;
  background:#fff;
}
.tp-radar-summary-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.tp-radar-summary-head strong{font-size:11.5px;color:#111827}
.tp-radar-trend-badge{
  display:inline-flex;
  align-items:center;
  gap:4px;
  padding:5px 8px;
  border:1px solid #e5e7eb;
  border-radius:999px;
  background:#f8f9fa;
  color:#374151;
  font-size:9px;
  font-weight:850;
  white-space:nowrap;
}
.tp-radar-change-hero{
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;
  gap:10px;
  padding:11px 12px;
  border:1px solid #dfe3e8;
  border-radius:13px;
  background:#f7f8f9;
}
.tp-radar-change-icon{
  width:34px;
  height:34px;
  display:grid;
  place-items:center;
  border-radius:999px;
  background:#111827;
  color:#fff;
}
.tp-radar-change-copy{display:grid;gap:2px;min-width:0}
.tp-radar-change-copy small{font-size:8px;color:#8b929b;text-transform:uppercase;letter-spacing:.05em}
.tp-radar-change-copy strong{font-size:17px;line-height:1.05;color:#111827}
.tp-radar-change-copy span{font-size:9px;color:#6b7280;line-height:1.35}
.tp-radar-change-status{
  padding:5px 8px;
  border:1px solid #dfe3e8;
  border-radius:999px;
  background:#fff;
  color:#374151;
  font-size:9px;
  font-weight:850;
  white-space:nowrap;
}
.tp-radar-delta-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:7px;
}
.tp-radar-delta-item{
  display:grid;
  gap:2px;
  padding:8px 9px;
  border-radius:11px;
  background:#f7f8f9;
}
.tp-radar-delta-item small{font-size:8px;color:#8b929b;text-transform:uppercase}
.tp-radar-delta-item strong{font-size:12px;color:#111827}
.tp-radar-summary p{
  margin:0;
  color:#5f6670;
  font-size:10px;
  line-height:1.45;
}
.tp-radar-farmer-note{
  display:grid;
  gap:5px;
  padding:11px 12px;
  border:1px solid #dfe3e8;
  border-radius:12px;
  background:#fff;
}
.tp-radar-farmer-note strong{
  color:#111827;
  font-size:11px;
}
.tp-radar-farmer-note p{
  color:#3f4650;
  font-size:10.5px;
  line-height:1.5;
}
.tp-radar-farmer-note span{
  display:block;
  padding-top:2px;
  color:#6b7280;
  font-size:9.5px;
  line-height:1.45;
}
.tp-radar-caution{
  color:#7c6b42!important;
  font-size:9px!important;
}
.tp-radar-reset{
  min-height:34px;
  border:1px solid #dfe3e8;
  border-radius:11px;
  background:#fff;
  color:#374151;
  font-size:9.5px;
  font-weight:800;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  cursor:pointer;
}
.tp-radar-reset:hover{background:#f7f8f9}
.tp-radar-trust-note{
  margin:0;
  text-align:center;
  color:#9ca3af;
  font-size:8.5px;
  line-height:1.4;
}
@media(max-width:560px){
  .tp-radar-history-dialog{
    width:calc(100vw - 10px);
    max-height:calc(100dvh - 10px);
    border-radius:18px;
  }
  .tp-radar-history-shell{max-height:calc(100dvh - 10px)}
  .tp-radar-history-head{padding:13px 13px 11px}
  .tp-radar-history-body{padding:11px 10px 14px}
  .tp-radar-compare-stage{gap:7px}
  .tp-radar-map-card-head{padding:8px 8px 7px}
  .tp-radar-map-image{aspect-ratio:1/1}
  .tp-radar-map-metric{padding:8px}
  .tp-radar-map-metric strong{font-size:12px}
  .tp-radar-change-hero{grid-template-columns:auto minmax(0,1fr);gap:8px;padding:9px}
  .tp-radar-change-status{grid-column:2;justify-self:start}
  .tp-radar-change-copy strong{font-size:15px}
  .tp-radar-delta-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
  .tp-radar-delta-item{padding:7px 6px}
  .tp-radar-delta-item strong{font-size:10.5px}
}
`;

function formatDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function shortDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function modeLabel(mode: Sentinel1RadarMode) {
  if (mode === 'vv') return 'VV · Toprak yüzeyi / nem sinyali';
  if (mode === 'vh') return 'VH · Bitki ve yüzey yapısı';
  if (mode === 'water') return 'Su birikimi · Radar su adayı';
  return 'Sentinel-1 radar';
}

function metricLabel(mode: Sentinel1RadarMode) {
  if (mode === 'vv') return 'VV radar değeri';
  if (mode === 'vh') return 'VH radar değeri';
  if (mode === 'water') return 'Su adayı alan';
  return 'Radar değeri';
}

function metricNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMetric(mode: Sentinel1RadarMode, value: unknown) {
  const numeric = metricNumber(value);
  if (numeric === null) return '—';
  if (mode === 'water') return `%${Math.round(numeric * 100)}`;
  return `${numeric.toFixed(2)} dB`;
}

function formatDelta(mode: Sentinel1RadarMode, value: number | null) {
  if (value == null) return '—';
  if (mode === 'water') {
    return `${value >= 0 ? '+' : ''}${Math.round(value * 100)} puan`;
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} dB`;
}

function deltaThreshold(mode: Sentinel1RadarMode) {
  return mode === 'water' ? 0.05 : 0.75;
}

function trend(mode: Sentinel1RadarMode, current: unknown, historical: unknown) {
  const now = metricNumber(current);
  const old = metricNumber(historical);
  if (now === null || old === null) {
    return { key: 'unknown', delta: null as number | null };
  }

  /*
   * Su katmanında üstte gösterdiğimiz değerler tam yüzdeye yuvarlanıyor.
   * Farkı ham 0..1 skordan hesaplamak %1 -> %0 görünürken "0 puan"
   * gibi çelişkiler üretebiliyordu. Bu nedenle su farkı, kullanıcının
   * ekranda gördüğü iki yüzde arasındaki gerçek yüzde-puan farkıdır.
   */
  const delta =
    mode === 'water'
      ? (Math.round(now * 100) - Math.round(old * 100)) / 100
      : now - old;

  const threshold = deltaThreshold(mode);
  return {
    key: delta > threshold ? 'up' : delta < -threshold ? 'down' : 'stable',
    delta,
  };
}

function trendCopy(
  mode: Sentinel1RadarMode,
  delta: number | null,
  key: string,
) {
  if (delta == null) {
    return 'Bu iki çekimin sayısal farkı çıkarılamadı. Haritaları yine yan yana gözle karşılaştırabilirsin.';
  }

  const absolute = Math.abs(delta);
  const amount =
    mode === 'water'
      ? `${Math.round(absolute * 100)} puan`
      : `${absolute.toFixed(2)} dB`;

  if (key === 'stable') {
    return `Fark yalnızca ${amount}. Bu kadar küçük değişimi uygulama pratikte aynı seviyede kabul ediyor.`;
  }

  if (mode === 'water') {
    return key === 'up'
      ? `Radar-su adayı alan önceki çekime göre ${amount} artmış.`
      : `Radar-su adayı alan önceki çekime göre ${amount} azalmış.`;
  }

  return key === 'up'
    ? `Radar sinyali önceki çekime göre ${amount} daha güçlü.`
    : `Radar sinyali önceki çekime göre ${amount} daha zayıf.`;
}

function changeDetail(
  mode: Sentinel1RadarMode,
  delta: number | null,
  key: string,
) {
  if (delta === null) {
    return 'Sayısal fark yok; iki görüntü gözle karşılaştırılabilir.';
  }

  if (key === 'stable') {
    return 'Belirgin değişiklik yok';
  }

  if (mode === 'water') {
    return key === 'up'
      ? 'Su adayı alan artmış'
      : 'Su adayı alan azalmış';
  }

  return key === 'up'
    ? 'Radar dönüşü güçlenmiş'
    : 'Radar dönüşü zayıflamış';
}

function farmerInterpretation(
  mode: Sentinel1RadarMode,
  delta: number | null,
  key: string,
) {
  if (delta === null) {
    return {
      title: 'Bu ne demek?',
      body: 'İki tarih için güvenilir sayısal fark çıkarılamadı. Görüntüler aynı alanı gösteriyor; gözle karşılaştırabilirsin.',
      action: 'Sayısal değer gelmediğinde Pusula bu görüntülerden kesin sonuç üretmez.',
    };
  }

  const amount =
    mode === 'water'
      ? `${Math.round(Math.abs(delta) * 100)} puan`
      : `${Math.abs(delta).toFixed(2)} dB`;

  if (mode === 'vv') {
    if (key === 'up') {
      return {
        title: 'Çiftçi yorumu · yüzey sinyali artmış',
        body: `Önceki çekime göre ${amount} artış var. Bu; yağış veya sulama sonrası nem artışı, sürüm sonrası yüzeyin kabalaşması ya da yüzey koşullarındaki başka bir değişimle ilişkili olabilir.`,
        action: 'Son yağış ve sulama kaydına bak. Değişim tarlanın belli bir bölümündeyse sahada o alanı kontrol etmek daha anlamlıdır.',
      };
    }
    if (key === 'down') {
      return {
        title: 'Çiftçi yorumu · yüzey sinyali azalmış',
        body: `Önceki çekime göre ${amount} azalma var. Yüzeyin kuruması, daha düzgün hale gelmesi veya tarla üzerindeki örtünün değişmesi bu sonucu etkileyebilir.`,
        action: 'Yağış/sulama olmadıysa bu değişim normal olabilir. Nem kararı vermeden önce hava ve saha gözlemiyle birlikte değerlendir.',
      };
    }
    return {
      title: 'Çiftçi yorumu · belirgin değişiklik yok',
      body: `İki çekim arasındaki fark ${amount}. Tarlanın yüzey ve nemle ilişkili radar sinyali önceki çekime çok yakın.`,
      action: 'Bu sonuç “toprak nemi aynıdır” demek değildir; yağış, sulama, sürüm ve yüzey pürüzlülüğü de VV değerini etkiler.',
    };
  }

  if (mode === 'vh') {
    if (key === 'up') {
      return {
        title: 'Çiftçi yorumu · bitki/yapı sinyali artmış',
        body: `Önceki çekime göre ${amount} artış var. Bitki örtüsünün dal-yaprak yapısı, yoğunluğu veya yüzeyin yapısı değişmiş olabilir.`,
        action: 'Ürünün gelişim dönemiyle kıyasla. Budama, hızlı gelişim veya tarla yüzeyindeki işlem varsa bu değişimi açıklayabilir.',
      };
    }
    if (key === 'down') {
      return {
        title: 'Çiftçi yorumu · bitki/yapı sinyali azalmış',
        body: `Önceki çekime göre ${amount} azalma var. Bitki örtüsünün seyrelmesi, hasat/budama veya yüzey yapısındaki değişim etkili olabilir.`,
        action: 'Bunu doğrudan “bitki kötüleşti” diye okuma. Ürün dönemi ve saha görüntüsüyle birlikte kontrol et.',
      };
    }
    return {
      title: 'Çiftçi yorumu · yapı büyük ölçüde aynı',
      body: `İki çekim arasında yalnızca ${amount} fark var. Radar, bitki ve yüzey yapısında belirgin bir değişiklik görmüyor.`,
      action: 'Bu sonuç hastalık veya gelişim teşhisi değildir; belirgin sorun varsa fotoğraf ve NDVI ile birlikte bakmak daha doğru olur.',
    };
  }

  if (mode === 'water') {
    if (key === 'up') {
      return {
        title: 'Çiftçi yorumu · su adayı alan artmış',
        body: `Önceki çekime göre parselde radar-su adayı olarak işaretlenen alan ${amount} artmış. Bu özellikle yağış veya sulama sonrası çukur ve drenajı zayıf bölümlerde göllenme ihtimalini artırabilir.`,
        action: 'Haritadaki su adayı bölgeleri sahada kontrol et. Bu yüzde açık su veya su baskını teşhisi değildir.',
      };
    }
    if (key === 'down') {
      return {
        title: 'Çiftçi yorumu · su adayı alan azalmış',
        body: `Önceki çekime göre radar-su adayı alan ${amount} azalmış. Yüzeydeki su etkisi azalmış veya alan kurumuş olabilir.`,
        action: 'Drenaj ve kuruma sürecini sonraki radar çekimiyle tekrar karşılaştır.',
      };
    }
    return {
      title: 'Çiftçi yorumu · su adayı alan benzer',
      body: `İki çekim arasında yalnızca ${amount} fark var. Parselde radar-su adayı olarak işaretlenen alan belirgin biçimde değişmemiş.`,
      action: 'Yoğun yağış olduysa düşük noktaları yine de saha gözlemiyle kontrol et; radar tek başına kesin su teşhisi değildir.',
    };
  }

  return {
    title: 'Çiftçi yorumu',
    body: 'Radar değişimi önceki çekimle karşılaştırıldı.',
    action: 'Radar verisini saha gözlemiyle birlikte değerlendir.',
  };
}

function trendLabel(key: string) {
  if (key === 'up') return 'Yükseldi';
  if (key === 'down') return 'Düştü';
  if (key === 'stable') return 'Benzer';
  return 'Veri yok';
}


function normalizedGeometry(value: unknown): any | null {
  let geometry: any = value;

  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return null;
    }
  }

  if (geometry?.type === 'Feature') geometry = geometry.geometry;
  if (geometry?.type === 'FeatureCollection') {
    geometry = geometry.features?.[0]?.geometry ?? null;
  }

  if (!geometry || !['Polygon', 'MultiPolygon'].includes(String(geometry.type))) {
    return null;
  }

  return geometry;
}

function parcelOverlayPaths(
  geometryValue: unknown,
  bboxValue: unknown,
) {
  const geometry = normalizedGeometry(geometryValue);
  const bbox = Array.isArray(bboxValue) ? bboxValue.map(Number) : [];

  if (!geometry || bbox.length !== 4 || !bbox.every(Number.isFinite)) {
    return [] as string[];
  }

  const [west, south, east, north] = bbox;
  const width = east - west;
  const height = north - south;
  if (!(width > 0) || !(height > 0)) return [] as string[];

  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.coordinates;

  const paths: string[] = [];

  for (const polygon of polygons ?? []) {
    for (const ring of polygon ?? []) {
      if (!Array.isArray(ring) || ring.length < 3) continue;

      const commands = ring
        .map((coordinate: any, index: number) => {
          const lng = Number(coordinate?.[0]);
          const lat = Number(coordinate?.[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

          const x = ((lng - west) / width) * 1000;
          const y = ((north - lat) / height) * 1000;
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .filter(Boolean);

      if (commands.length >= 3) {
        paths.push(`${commands.join(' ')} Z`);
      }
    }
  }

  return paths;
}

function radarImageAspect(data?: Sentinel1RadarResponse | null) {
  const size = (data as any)?.imageSize;
  const width = Number(size?.width);
  const height = Number(size?.height);

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return `${width} / ${height}`;
  }

  return '1 / 1';
}

function ParcelOutline({
  geometry,
  bbox,
}: {
  geometry: unknown;
  bbox: unknown;
}) {
  const paths = parcelOverlayPaths(geometry, bbox);
  if (!paths.length) return null;

  return (
    <svg
      className="tp-radar-parcel-overlay"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((path, index) => (
        <g key={`${index}:${path.slice(0, 24)}`}>
          <path className="tp-radar-parcel-shadow" d={path} />
          <path className="tp-radar-parcel-line" d={path} />
        </g>
      ))}
    </svg>
  );
}

export default function RadarHistorySheet(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (props.open && !element.open) {
      element.showModal();
    } else if (!props.open && element.open) {
      element.close();
    }
  }, [props.open]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    const onCancel = (event: Event) => {
      event.preventDefault();
      props.onClose();
    };

    const onClose = () => {
      if (props.open) props.onClose();
    };

    element.addEventListener('cancel', onCancel);
    element.addEventListener('close', onClose);
    return () => {
      element.removeEventListener('cancel', onCancel);
      element.removeEventListener('close', onClose);
    };
  }, [props.onClose, props.open]);

  const currentScene = props.currentData?.scene ?? props.scenes[0] ?? null;
  const historicalScene = props.selectedScene ?? null;
  const currentMean = props.currentData?.stats?.mean ?? null;
  const historicalMean = props.selectedData?.stats?.mean ?? null;
  const currentImage = props.currentData?.imageDataUrl ?? null;
  const historicalImage = props.selectedData?.imageDataUrl ?? null;

  const comparison = useMemo(
    () => trend(props.mode, currentMean, historicalMean),
    [props.mode, currentMean, historicalMean],
  );

  const comparisonText = useMemo(
    () => trendCopy(props.mode, comparison.delta, comparison.key),
    [props.mode, comparison.delta, comparison.key],
  );

  const comparisonDetail = useMemo(
    () => changeDetail(props.mode, comparison.delta, comparison.key),
    [props.mode, comparison.delta, comparison.key],
  );

  const farmerNote = useMemo(
    () => farmerInterpretation(props.mode, comparison.delta, comparison.key),
    [props.mode, comparison.delta, comparison.key],
  );

  const selectedId = historicalScene?.id ?? null;

  return (
    <dialog ref={dialog} className="tp-radar-history-dialog">
      <style>{CSS}</style>
      <div className="tp-radar-history-shell">
        <header className="tp-radar-history-head">
          <div className="tp-radar-history-head-copy">
            <span className="tp-radar-history-kicker">
              <Satellite size={13} /> SENTINEL-1 GEÇMİŞ
            </span>
            <h2>{modeLabel(props.mode)}</h2>
            <p>{props.fieldName} · aynı tarlanın eski ve yeni radar çekimini yan yana karşılaştır.</p>
          </div>
          <button
            type="button"
            className="tp-radar-history-close"
            onClick={props.onClose}
            aria-label="Radar geçmişini kapat"
          >
            <X size={19} />
          </button>
        </header>

        <div className="tp-radar-history-body">
          {props.error ? (
            <div className="tp-radar-history-error" role="alert">
              {props.error}
            </div>
          ) : null}

          {props.loading && !props.scenes.length ? (
            <div className="tp-radar-history-loading" role="status">
              Radar arşivi hazırlanıyor…
            </div>
          ) : null}

          {!props.loading && !props.error && !props.scenes.length ? (
            <div className="tp-radar-history-empty">
              Bu parsel için karşılaştırılabilir Sentinel-1 sahnesi bulunamadı.
            </div>
          ) : null}

          {props.scenes.length ? (
            <section className="tp-radar-date-section">
              <div className="tp-radar-date-head">
                <strong>Geçmiş çekimi seç</strong>
                <span>sağa kaydır</span>
              </div>

              <div className="tp-radar-date-strip" aria-label="Radar geçmiş tarihleri">
                {props.scenes.map((scene, index) => {
                  const isCurrent =
                    scene.id === currentScene?.id ||
                    scene.datetime === currentScene?.datetime ||
                    index === 0;
                  const isSelected = scene.id === selectedId;

                  return (
                    <button
                      key={`${scene.id}:${scene.datetime}`}
                      type="button"
                      className={`tp-radar-date-card ${
                        isSelected ? 'selected' : ''
                      } ${isCurrent ? 'current' : ''}`}
                      disabled={props.loading}
                      onClick={() => {
                        if (isCurrent) {
                          props.onResetCurrent();
                        } else {
                          props.onSelect(scene);
                        }
                      }}
                    >
                      <strong>{isCurrent ? 'Güncel' : shortDate(scene.datetime)}</strong>
                      <small>{isCurrent ? shortDate(scene.datetime) : 'Sentinel-1'}</small>
                      {isSelected ? (
                        <span className="tp-radar-date-check" aria-hidden="true">
                          <Check size={10} strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {currentScene ? (
            <section className="tp-radar-compare-stage" aria-label="Radar görüntüsü karşılaştırması">
              <article className="tp-radar-map-card">
                <div className="tp-radar-map-card-head">
                  <div>
                    <b>ÖNCE</b>
                    <strong>
                      {historicalScene ? formatDate(historicalScene.datetime) : 'Tarih seç'}
                    </strong>
                  </div>
                  <span>{historicalScene ? 'Sentinel-1' : 'Geçmiş'}</span>
                </div>

                <div
                  className="tp-radar-map-image"
                  style={{ aspectRatio: radarImageAspect(props.selectedData) }}
                >
                  {historicalImage ? (
                    <>
                      <img
                        src={historicalImage}
                        alt={`${formatDate(historicalScene?.datetime)} radar görüntüsü`}
                        draggable={false}
                      />
                      <ParcelOutline
                        geometry={props.geometry}
                        bbox={props.selectedData?.bbox}
                      />
                    </>
                  ) : (
                    <div className="tp-radar-map-placeholder">
                      Yukarıdan bir geçmiş tarih seç. Eski radar haritası burada görünecek.
                    </div>
                  )}
                </div>

                <div className="tp-radar-map-metric">
                  <span>{metricLabel(props.mode)}</span>
                  <strong>{formatMetric(props.mode, historicalMean)}</strong>
                </div>
              </article>

              <article className="tp-radar-map-card">
                <div className="tp-radar-map-card-head">
                  <div>
                    <b>GÜNCEL</b>
                    <strong>{formatDate(currentScene.datetime)}</strong>
                  </div>
                  <span>Sentinel-1</span>
                </div>

                <div
                  className="tp-radar-map-image"
                  style={{ aspectRatio: radarImageAspect(props.currentData) }}
                >
                  {currentImage ? (
                    <>
                      <img
                        src={currentImage}
                        alt={`${formatDate(currentScene.datetime)} güncel radar görüntüsü`}
                        draggable={false}
                      />
                      <ParcelOutline
                        geometry={props.geometry}
                        bbox={props.currentData?.bbox}
                      />
                    </>
                  ) : (
                    <div className="tp-radar-map-placeholder">
                      Güncel radar görüntüsü hazırlanıyor.
                    </div>
                  )}
                </div>

                <div className="tp-radar-map-metric">
                  <span>{metricLabel(props.mode)}</span>
                  <strong>{formatMetric(props.mode, currentMean)}</strong>
                </div>
              </article>
            </section>
          ) : null}

          {historicalScene && props.selectedData ? (
            <section className="tp-radar-summary">
              <div className="tp-radar-summary-head">
                <strong>Değişim özeti</strong>
                <span className="tp-radar-trend-badge">
                  {comparison.key === 'up' ? (
                    <ArrowUp size={12} />
                  ) : comparison.key === 'down' ? (
                    <ArrowDown size={12} />
                  ) : (
                    <ArrowRight size={12} />
                  )}
                  {trendLabel(comparison.key)}
                </span>
              </div>

              <div className="tp-radar-change-hero" aria-label="Radar değişim özeti">
                <span className="tp-radar-change-icon" aria-hidden="true">
                  {comparison.key === 'up' ? (
                    <ArrowUp size={17} />
                  ) : comparison.key === 'down' ? (
                    <ArrowDown size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </span>
                <span className="tp-radar-change-copy">
                  <small>Önce → güncel değişim</small>
                  <strong>{formatDelta(props.mode, comparison.delta)}</strong>
                  <span>{comparisonDetail}</span>
                </span>
                <span className="tp-radar-change-status">
                  {trendLabel(comparison.key)}
                </span>
              </div>

              <div className="tp-radar-delta-grid">
                <div className="tp-radar-delta-item">
                  <small>Önce</small>
                  <strong>{formatMetric(props.mode, historicalMean)}</strong>
                </div>
                <div className="tp-radar-delta-item">
                  <small>Güncel</small>
                  <strong>{formatMetric(props.mode, currentMean)}</strong>
                </div>
                <div className="tp-radar-delta-item">
                  <small>Fark</small>
                  <strong>{formatDelta(props.mode, comparison.delta)}</strong>
                </div>
              </div>

              <div className="tp-radar-farmer-note">
                <strong>{farmerNote.title}</strong>
                <p>{farmerNote.body}</p>
                <span>{farmerNote.action}</span>
              </div>

              <p>{comparisonText}</p>
              <p className="tp-radar-caution">
                Radar bir işarettir; kesin karar için hava, sulama kaydı ve saha gözlemiyle birlikte değerlendirilir.
              </p>

              <button
                type="button"
                className="tp-radar-reset"
                onClick={props.onResetCurrent}
              >
                <RotateCcw size={14} /> Güncel görüntüye dön
              </button>
            </section>
          ) : null}

          {props.scenes.length ? (
            <p className="tp-radar-trust-note">
              Uygulama aynı tarlayı karşılaştırmaya uygun radar çekimlerini arka planda otomatik seçer.
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
