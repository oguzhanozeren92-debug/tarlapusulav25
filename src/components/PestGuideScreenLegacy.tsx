import {
  useMemo,
  useState,
} from 'react';
import type { Field, Screen } from '../types';
import './PestGuideScreen.css';

export type GuideCategory = 'disease' | 'pest' | 'weed';
export type RiskLevel = 'low' | 'medium' | 'high';
export type DetailTab =
  | 'general'
  | 'symptoms'
  | 'lifecycle'
  | 'control';

export interface GuideItem {
  id: string;
  name: string;
  scientificName?: string;
  category: GuideCategory;
  categoryLabel: string;
  crops: string[];
  summary: string;
  period: string;
  riskLevel: RiskLevel;
  symptoms: string[];
  riskConditions: string[];
  scouting: string;
  lifecycle: string;
  controlNotes: string[];
  images: string[];
  compareIds?: string[];
}

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface PestGuideScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type CropFilter = 'barley' | 'wheat' | 'almond' | 'all';

type IconName =
  | 'brand'
  | 'back'
  | 'menu'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'leaf'
  | 'bug'
  | 'weed'
  | 'search'
  | 'filter'
  | 'camera'
  | 'shield'
  | 'weather'
  | 'bell'
  | 'star'
  | 'share'
  | 'crop'
  | 'clock'
  | 'warning'
  | 'thermometer'
  | 'droplet'
  | 'target'
  | 'info'
  | 'chevron'
  | 'close'
  | 'check';

const IMAGES = {
  barleyRust:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Puccinia%20hordei%20G.H.%20Otth%205410689.jpg',
  barleyRust2:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Puccinia%20hordei%20G.H.%20Otth%205410688.jpg',
  sunn:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Eurygaster%20integriceps.jpg',
  sunn2:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Eurygaster%20integriceps%20Puton.jpg',
  oat:
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=82',
  wheat:
    'https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?auto=format&fit=crop&w=1000&q=82',
  leaf:
    'https://images.unsplash.com/photo-1531058240690-006c446962d8?auto=format&fit=crop&w=1000&q=82',
  almond:
    'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=1000&q=82',
};

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'barley-leaf-rust',
    name: 'Arpa Yaprak Pası',
    scientificName: 'Puccinia hordei',
    category: 'disease',
    categoryLabel: 'Hastalık',
    crops: ['Arpa'],
    summary:
      'Yapraklarda turuncu-kahverengi püstüllerle görülen fungal bir pas hastalığıdır.',
    period: 'İlkbahar · Serin-nemli dönem',
    riskLevel: 'medium',
    symptoms: [
      'Yaprak yüzeyinde küçük, dairesel turuncu-kahverengi püstüller.',
      'İleri enfeksiyonda yaprakların erken sararıp kuruması.',
      'Fotosentetik yaprak alanında azalma.',
    ],
    riskConditions: [
      'Ilıman sıcaklık ve uzun süreli yaprak ıslaklığı.',
      'Sık ekim ve hava dolaşımının zayıf olması.',
      'Hassas çeşit ve gönüllü tahılların bulunması.',
    ],
    scouting:
      'Alt ve orta yapraklardan başlayarak özellikle üst yaprak yüzeyini ve yaprak kınlarını kontrol edin.',
    lifecycle:
      'Pas etmeni uygun sıcaklık ve nemde spor üretir; rüzgârla taşınan sporlar yeni yaprak enfeksiyonları oluşturabilir.',
    controlNotes: [
      'Dayanıklı çeşit ve dengeli gübreleme tercih edin.',
      'Hastalığı doğrulamadan kimyasal uygulamaya başlamayın.',
      'Yerel teknik talimat ve ruhsatlı ürün etiketini esas alın.',
    ],
    images: [IMAGES.barleyRust, IMAGES.barleyRust2, IMAGES.wheat],
    compareIds: ['yellow-rust', 'nitrogen-like', 'septoria-like'],
  },
  {
    id: 'sunn-pest',
    name: 'Arpa Sünesi',
    scientificName: 'Eurygaster integriceps',
    category: 'pest',
    categoryLabel: 'Zararlı',
    crops: ['Arpa', 'Buğday'],
    summary:
      'Tahıllarda sap, yaprak ve özellikle dane gelişim döneminde beslenerek verim ve kaliteyi olumsuz etkileyebilen önemli bir zararlıdır.',
    period: 'Nisan – Haziran',
    riskLevel: 'high',
    symptoms: [
      'Danelerde büzüşme, şekil bozukluğu ve ağırlık kaybı.',
      'Başakta beslenmeye bağlı boş veya zayıf dane.',
      'Yoğun zararda kalite kaybı.',
    ],
    riskConditions: [
      'İlkbaharda uygun sıcaklıklar ve hızlı popülasyon artışı.',
      'Tahıl alanlarının yoğun olduğu geniş üretim bölgeleri.',
      'Tarla ve çevresinde uygun konukçu bitkilerin bulunması.',
    ],
    scouting:
      'Başaklarda, üst yapraklarda ve başak saplarının boğumlarında ergin ve nimfleri arayın.',
    lifecycle:
      'Kışı ergin halde geçirebilir. İlkbaharda tahıl alanlarına göç eder; yumurta, nimf ve ergin dönemleri sezon içinde görülür.',
    controlNotes: [
      'Karar vermeden önce tarlada yoğunluk ve dönem kontrolü yapın.',
      'Bölgesel sürvey ve resmî mücadele eşiklerini takip edin.',
      'Gereksiz ve erken kimyasal uygulamadan kaçının.',
    ],
    images: [IMAGES.sunn, IMAGES.sunn2, IMAGES.wheat],
    compareIds: ['barley-leaf-rust', 'yellow-rust', 'nitrogen-like'],
  },
  {
    id: 'wild-oat',
    name: 'Yabani Yulaf',
    scientificName: 'Avena spp.',
    category: 'weed',
    categoryLabel: 'Yabancı Ot',
    crops: ['Arpa', 'Buğday'],
    summary:
      'Tahıllarla su, ışık ve besin için güçlü rekabete giren, yoğunluğa bağlı olarak verimi düşürebilen yabancı ottur.',
    period: 'Ekim – İlkbahar gelişimi',
    riskLevel: 'medium',
    symptoms: [
      'Tahıl sıraları arasında farklı görünümlü dar yapraklı bitkiler.',
      'Hızlı kardeşlenme ve rekabet.',
      'Olgun dönemde salkım yapısının belirginleşmesi.',
    ],
    riskConditions: [
      'Tohum bankasının yüksek olduğu tarlalar.',
      'Monokültür tahıl üretimi.',
      'Geç veya yetersiz yabancı ot kontrolü.',
    ],
    scouting:
      'Sıra araları, tarla kenarları ve önceki yıllarda yoğunluk görülen bölgeleri düzenli kontrol edin.',
    lifecycle:
      'Tohumla çoğalır; uygun koşullarda tahılla birlikte çıkış yapabilir ve olgunlaşan tohumlar toprak tohum bankasını besler.',
    controlNotes: [
      'Münavebe ve temiz tohumluk kullanın.',
      'Yoğunluğu erken dönemde belirleyin.',
      'Herbisit seçilecekse ürün, dönem ve etiket talimatına göre hareket edin.',
    ],
    images: [IMAGES.oat, IMAGES.wheat, IMAGES.leaf],
    compareIds: ['barley-leaf-rust'],
  },
  {
    id: 'yellow-rust',
    name: 'Sarı Pas',
    scientificName: 'Puccinia striiformis',
    category: 'disease',
    categoryLabel: 'Hastalık',
    crops: ['Buğday', 'Arpa'],
    summary:
      'Yapraklarda sarı-turuncu çizgiler halinde spor kümeleri oluşturabilen önemli bir pas hastalığıdır.',
    period: 'Serin ve nemli ilkbahar',
    riskLevel: 'high',
    symptoms: [
      'Yaprak damarlarına paralel sarı-turuncu çizgiler.',
      'Yoğun enfeksiyonda yaprak alanında hızlı kayıp.',
      'Üst yaprakların erken yaşlanması.',
    ],
    riskConditions: [
      'Serin hava ve uzun süreli nem.',
      'Hassas çeşitler.',
      'Sık ve yoğun ekim.',
    ],
    scouting:
      'Alt yapraklardan başlayıp bayrak yaprağa kadar çizgisel spor oluşumu açısından kontrol edin.',
    lifecycle:
      'Rüzgârla taşınan sporlar uygun koşullarda yeni enfeksiyonlara neden olabilir.',
    controlNotes: [
      'Çeşit dayanıklılığı ve erken tespit önemlidir.',
      'Kimyasal mücadelede resmî tavsiye ve ruhsatlı ürün etiketini izleyin.',
    ],
    images: [IMAGES.barleyRust2, IMAGES.barleyRust, IMAGES.wheat],
    compareIds: ['barley-leaf-rust', 'septoria-like'],
  },
  {
    id: 'almond-aphid',
    name: 'Badem Yaprak Biti',
    scientificName: 'Aphididae',
    category: 'pest',
    categoryLabel: 'Zararlı',
    crops: ['Badem'],
    summary:
      'Genç sürgün ve yapraklarda özsu emerek kıvrılma, zayıf gelişim ve balözü oluşumuna neden olabilen yaprak biti grubudur.',
    period: 'İlkbahar · Genç sürgün dönemi',
    riskLevel: 'medium',
    symptoms: [
      'Genç yapraklarda kıvrılma.',
      'Sürgünlerde koloni görünümü.',
      'Yapışkan balözü ve ikincil fumajin.',
    ],
    riskConditions: [
      'Aşırı azotlu ve yumuşak sürgün gelişimi.',
      'Doğal düşman baskısının azalması.',
      'Ilıman ilkbahar koşulları.',
    ],
    scouting:
      'Genç sürgün uçlarını ve yaprak altlarını koloni oluşumu açısından kontrol edin.',
    lifecycle:
      'Uygun koşullarda kısa sürede çoğalabilir; doğal düşmanlar popülasyon üzerinde önemli baskı oluşturabilir.',
    controlNotes: [
      'Önce doğal düşman varlığını değerlendirin.',
      'Yoğunluk ve zarar düzeyini doğrulamadan uygulama yapmayın.',
      'Ruhsatlı ürün ve etiket talimatlarını esas alın.',
    ],
    images: [IMAGES.almond, IMAGES.leaf, IMAGES.wheat],
    compareIds: ['nitrogen-like'],
  },
  {
    id: 'septoria-like',
    name: 'Septorya Yaprak Lekesi',
    scientificName: 'Zymoseptoria / Septoria spp.',
    category: 'disease',
    categoryLabel: 'Hastalık',
    crops: ['Buğday'],
    summary:
      'Yapraklarda düzensiz lekeler ve ileri dönemde doku kaybıyla seyredebilir.',
    period: 'Nemli ilkbahar',
    riskLevel: 'medium',
    symptoms: [
      'Yapraklarda açık kahverengi-düzensiz lekeler.',
      'Lekelerde koyu noktacıklar görülebilmesi.',
      'İleri durumda yaprak alanının kuruması.',
    ],
    riskConditions: [
      'Uzun yaprak ıslaklığı.',
      'Enfekteli bitki artıkları.',
      'Sık ekim.',
    ],
    scouting:
      'Alt yapraklardan başlayarak lekelerin şekli, dağılımı ve koyu noktacıkları kontrol edin.',
    lifecycle:
      'Bitki artıkları üzerinde kalabilir ve yağmur sıçramasıyla alt yapraklardan yukarı taşınabilir.',
    controlNotes: [
      'Bitki artığı ve münavebe yönetimini değerlendirin.',
      'Kesin teşhis olmadan kimyasal uygulama yapmayın.',
    ],
    images: [IMAGES.leaf, IMAGES.wheat, IMAGES.barleyRust2],
    compareIds: ['yellow-rust', 'barley-leaf-rust'],
  },
  {
    id: 'nitrogen-like',
    name: 'Besin Noksanlığı Benzeri',
    category: 'disease',
    categoryLabel: 'Diğer',
    crops: ['Arpa', 'Buğday', 'Badem'],
    summary:
      'Azot veya diğer besin noksanlıkları bazı hastalık belirtileriyle karışabilir.',
    period: 'Gelişim dönemi boyunca',
    riskLevel: 'low',
    symptoms: [
      'Genel veya damar arası sararma.',
      'Zayıf gelişim.',
      'Yaşlı yapraklardan başlayan renk değişimi.',
    ],
    riskConditions: [
      'Düşük toprak besin düzeyi.',
      'Kök bölgesi problemi.',
      'pH ve su stresi.',
    ],
    scouting:
      'Belirtinin tarladaki dağılımına, yaprağın yaşına ve kök bölgesine birlikte bakın.',
    lifecycle:
      'Bulaşıcı değildir; besin, kök, pH veya su koşullarına bağlı gelişir.',
    controlNotes: [
      'Toprak ve gerekirse yaprak analiziyle doğrulayın.',
      'Görsel belirtiye bakarak rastgele gübreleme yapmayın.',
    ],
    images: [IMAGES.wheat, IMAGES.leaf, IMAGES.almond],
    compareIds: ['barley-leaf-rust', 'yellow-rust'],
  },
];

const CROP_FILTERS: Array<{
  id: CropFilter;
  label: string;
}> = [
  { id: 'barley', label: 'Arpa' },
  { id: 'wheat', label: 'Buğday' },
  { id: 'almond', label: 'Badem' },
  { id: 'all', label: 'Tüm Ürünler' },
];

const CATEGORY_FILTERS: Array<{
  id: GuideCategory;
  label: string;
  icon: IconName;
}> = [
  { id: 'disease', label: 'Hastalıklar', icon: 'leaf' },
  { id: 'pest', label: 'Zararlılar', icon: 'bug' },
  { id: 'weed', label: 'Yabancı Otlar', icon: 'weed' },
];

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'brand':
      return (
        <svg {...common}>
          <path d="M12 21c4.3-2.9 7-6.6 7-11.1C19 6 16 3 12 3S5 6 5 9.9C5 14.4 7.7 18.1 12 21Z" />
          <path d="M12 17V8" />
          <path d="M12 12c-2.5-.2-4.1-1.3-5-3M12 10c2.3-.1 4-1 5-2.6" />
        </svg>
      );
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'menu':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 11 9-7 9 7" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </svg>
      );
    case 'field':
      return (
        <svg {...common}>
          <path d="M4 20c4-7 8-11 16-16" />
          <path d="M4 15c4 0 7 1 10 5M9 8c3 0 5 1 7 3" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
          <path d="m18.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M20 4c-8 0-14 4-14 10 0 3 2 5 5 5 6 0 9-7 9-15Z" />
          <path d="M5 20c2-5 6-8 11-11" />
        </svg>
      );
    case 'bug':
      return (
        <svg {...common}>
          <path d="M9 8a3 3 0 0 1 6 0M8 10h8v7a4 4 0 0 1-8 0v-7Z" />
          <path d="M12 10v10M5 12h3M16 12h3M5 17h3M16 17h3M9 5 7 3M15 5l2-2" />
        </svg>
      );
    case 'weed':
      return (
        <svg {...common}>
          <path d="M12 21V8M12 12c-3-3-6-3-8-2 1 4 4 6 8 6M12 9c3-3 6-3 8-2-1 4-4 6-8 6" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case 'filter':
      return <svg {...common}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 7h4l2-3h4l2 3h4v12H4V7Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'weather':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 2V1M8 15v-1M2 8H1M15 8h-1" />
          <path d="M8 19h10a3 3 0 0 0 0-6 5 5 0 0 0-9.4 1.2A2.7 2.7 0 0 0 8 19Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.9-5.4 2.9 1-5.9-4.3-4.2 6-.9L12 3Z" />
        </svg>
      );
    case 'share':
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="m8 11 8-5M8 13l8 5" />
        </svg>
      );
    case 'crop':
      return (
        <svg {...common}>
          <path d="M12 21V5M12 9c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5Z" />
          <path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      );
    case 'thermometer':
      return (
        <svg {...common}>
          <path d="M9 4a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0V4Z" />
          <path d="M12 8v8" />
        </svg>
      );
    case 'droplet':
      return <svg {...common}><path d="M12 3s6 6 6 11a6 6 0 1 1-12 0c0-5 6-11 6-11Z" /></svg>;
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      );
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'close':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
  }
}

function normalizeText(value: string) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function menuIcon(item: MenuItem): IconName {
  const label = normalizeText(item.label);

  if (item.screen === 'home') return 'home';
  if (label.includes('takvim')) return 'calendar';
  if (label.includes('ai')) return 'ai';
  if (label.includes('tarla')) return 'field';
  if (label.includes('hastalik') || label.includes('zararli')) return 'bug';

  return 'chevron';
}

function cropFilterMatches(crops: string[], filter: CropFilter) {
  if (filter === 'all') return true;
  const joined = normalizeText(crops.join(' '));
  if (filter === 'barley') return joined.includes('arpa');
  if (filter === 'wheat') return joined.includes('bugday');
  if (filter === 'almond') return joined.includes('badem');
  return true;
}

function riskLabel(risk: RiskLevel) {
  if (risk === 'high') return 'Yüksek';
  if (risk === 'medium') return 'Orta';
  return 'Düşük';
}

function categoryClass(category: GuideCategory) {
  if (category === 'pest') return 'pest';
  if (category === 'weed') return 'weed';
  return 'disease';
}

export default function PestGuideScreen({
  fields,
  selectedFieldId = '',
  screen = 'pestGuideHub',
  desktopMenuItems = [],
  sideMenuOpen = false,
  setScreen,
  setSideMenuOpen = () => undefined,
}: PestGuideScreenProps) {
  const realFields = useMemo(
    () => fields.filter((field) => !field.demo),
    [fields],
  );

  const selectedField = useMemo(
    () =>
      realFields.find(
        (field) => String(field.id) === String(selectedFieldId),
      ) ??
      realFields[0] ??
      null,
    [realFields, selectedFieldId],
  );

  const defaultCrop = useMemo<CropFilter>(() => {
    const crop = normalizeText(selectedField?.crop ?? '');
    if (crop.includes('arpa')) return 'barley';
    if (crop.includes('bugday')) return 'wheat';
    if (crop.includes('badem')) return 'almond';
    return 'all';
  }, [selectedField]);

  const [cropFilter, setCropFilter] = useState<CropFilter>(defaultCrop);
  const [categoryFilter, setCategoryFilter] =
    useState<GuideCategory>('disease');
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] =
    useState<string>('sunn-pest');
  const [detailTab, setDetailTab] = useState<DetailTab>('general');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [riskAlerts, setRiskAlerts] = useState(false);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);

    return GUIDE_ITEMS.filter((item) => {
      if (item.category !== categoryFilter) return false;
      if (!cropFilterMatches(item.crops, cropFilter)) return false;
      if (!q) return true;

      return normalizeText(
        `${item.name} ${item.scientificName ?? ''} ${item.summary} ${item.crops.join(' ')}`,
      ).includes(q);
    });
  }, [categoryFilter, cropFilter, search]);

  const selectedItem =
    GUIDE_ITEMS.find((item) => item.id === selectedItemId) ??
    filteredItems[0] ??
    GUIDE_ITEMS[1];

  const compareItems = useMemo(() => {
    const ids = selectedItem.compareIds ?? [];
    return ids
      .map((id) => GUIDE_ITEMS.find((item) => item.id === id))
      .filter(Boolean) as GuideItem[];
  }, [selectedItem]);

  const sidebarItems = desktopMenuItems.filter(
    (item) => item.screen !== 'adminHub',
  );

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const openItem = (item: GuideItem) => {
    setSelectedItemId(item.id);
    setSelectedImageIndex(0);
    setDetailTab('general');
  };

  return (
    <div className="tp-pest-guide-page">
      <aside className="tp-pest-guide-sidebar">
        <div className="tp-pest-guide-brand">
          <span><Icon name="brand" size={21} /></span>
          <div>
            <strong>TarlaPusula</strong>
            <small>Akıllı üretici paneli</small>
          </div>
        </div>

        <nav>
          {sidebarItems.map((item, index) => (
            <button
              key={`${item.screen}-${item.label}-${index}`}
              type="button"
              className={item.screen === screen ? 'active' : ''}
              onClick={() => navigate(item.screen as Screen)}
            >
              <span><Icon name={menuIcon(item)} size={17} /></span>
              <strong>{item.label}</strong>
              {item.badge && <i>{item.badge}</i>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="tp-pest-guide-content">
        <header className="tp-pest-guide-topbar">
          <button type="button" onClick={() => navigate('home')}>
            <Icon name="back" size={18} />
          </button>
          <div>
            <strong>Hastalık & Zararlı Rehberi</strong>
            <small>Ürününe göre tanı, saha kontrolü ve risk rehberi</small>
          </div>
          <button
            type="button"
            className="tp-pest-guide-mobile-menu"
            onClick={() => setSideMenuOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
        </header>

        <main className="tp-pest-guide-main">
          <section className="tp-pest-guide-heading">
            <div>
              <span className="tp-pest-guide-kicker">
                HASTALIK · ZARARLI · YABANCI OT
                <b>YENİ</b>
              </span>
              <h1>Hastalık & Zararlı Rehberi</h1>
              <p>
                Kayıtlı tarlalarındaki ürünlere göre hastalıkları,
                zararlıları ve yabancı otları keşfet. Tanıyı destekleyen
                belirtileri, risk dönemlerini ve tarlada nereye bakman
                gerektiğini tek ekranda gör.
              </p>
            </div>

            <div className="tp-pest-guide-quick-cards">
              <article>
                <span><Icon name="leaf" size={18} /></span>
                <div>
                  <strong>Ürüne göre kişiselleştirilmiş içerik</strong>
                  <small>{selectedField?.crop || 'Kayıtlı ürünlere göre filtreleme'}</small>
                </div>
              </article>
              <article>
                <span><Icon name="camera" size={18} /></span>
                <div>
                  <strong>Görsel belirtiler ve detaylı bilgiler</strong>
                  <small>Fotoğraflı saha karşılaştırması</small>
                </div>
              </article>
              <article>
                <span><Icon name="shield" size={18} /></span>
                <div>
                  <strong>Tarlanla ilişkilendir ve kontrol et</strong>
                  <small>AI fotoğraf analizi ve hava bağlantısı</small>
                </div>
              </article>
            </div>
          </section>

          <div className="tp-pest-guide-note">
            <Icon name="info" size={14} />
            <span>
              Rehber görsel teşhisi destekler; kesin hastalık/zararlı
              tanısı ve mücadele kararı için saha doğrulaması, resmî
              teknik talimatlar ve gerektiğinde uzman görüşü esas alınmalıdır.
            </span>
          </div>

          <section className="tp-pest-guide-workspace">
            <aside className="tp-pest-guide-browser">
              <div className="tp-pest-guide-crop-tabs">
                {CROP_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    className={cropFilter === filter.id ? 'active' : ''}
                    onClick={() => setCropFilter(filter.id)}
                  >
                    <Icon name={filter.id === 'almond' ? 'leaf' : 'crop'} size={14} />
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="tp-pest-guide-category-tabs">
                {CATEGORY_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    className={categoryFilter === filter.id ? 'active' : ''}
                    onClick={() => setCategoryFilter(filter.id)}
                  >
                    <Icon name={filter.icon} size={14} />
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="tp-pest-guide-search-row">
                <label>
                  <Icon name="search" size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Hastalık, zararlı veya yabancı ot ara..."
                  />
                </label>
                <button type="button" aria-label="Filtre">
                  <Icon name="filter" size={15} />
                </button>
              </div>

              <div className="tp-pest-guide-list">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={selectedItem.id === item.id ? 'selected' : ''}
                      onClick={() => openItem(item)}
                    >
                      <img src={item.images[0]} alt="" />
                      <div className="copy">
                        <div>
                          <strong>{item.name}</strong>
                          <b className={categoryClass(item.category)}>
                            {item.categoryLabel}
                          </b>
                        </div>
                        <small>{item.crops.join(' · ')}</small>
                        <p>{item.summary}</p>
                        <span className={`risk ${item.riskLevel}`}>
                          Risk Dönemi: {riskLabel(item.riskLevel)}
                        </span>
                      </div>
                      <Icon name="chevron" size={14} />
                    </button>
                  ))
                ) : (
                  <div className="tp-pest-guide-empty">
                    <Icon name="search" size={18} />
                    <strong>Bu filtrede kayıt bulunamadı</strong>
                    <small>Ürün, kategori veya arama filtresini değiştir.</small>
                  </div>
                )}
              </div>
            </aside>

            <article className="tp-pest-guide-detail">
              <div className="tp-pest-guide-detail-hero">
                <img
                  src={selectedItem.images[selectedImageIndex] ?? selectedItem.images[0]}
                  alt=""
                />

                <div className="tp-pest-guide-detail-actions">
                  <button
                    type="button"
                    className={favorite ? 'active' : ''}
                    onClick={() => setFavorite((value) => !value)}
                  >
                    <Icon name="star" size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const text = `${selectedItem.name} · TarlaPusula Hastalık & Zararlı Rehberi`;
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: selectedItem.name, text });
                        } else {
                          await navigator.clipboard?.writeText(text);
                        }
                      } catch {
                        // paylaşım iptal edildi
                      }
                    }}
                  >
                    <Icon name="share" size={17} />
                  </button>
                </div>

                <div className="tp-pest-guide-thumbs">
                  {selectedItem.images.slice(0, 3).map((image, index) => (
                    <button
                      type="button"
                      key={`${selectedItem.id}-${index}`}
                      className={selectedImageIndex === index ? 'active' : ''}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                  <button type="button" className="more">+3</button>
                </div>
              </div>

              <div className="tp-pest-guide-detail-body">
                <div className="tp-pest-guide-title-row">
                  <div>
                    <span className={`tp-pest-guide-category ${categoryClass(selectedItem.category)}`}>
                      {selectedItem.categoryLabel}
                    </span>
                    <h2>{selectedItem.name}</h2>
                    {selectedItem.scientificName && (
                      <small>{selectedItem.scientificName}</small>
                    )}
                  </div>
                </div>

                <div className="tp-pest-guide-fact-grid">
                  <div>
                    <Icon name="crop" size={16} />
                    <span>
                      <small>Ürünler</small>
                      <strong>{selectedItem.crops.join(', ')}</strong>
                    </span>
                  </div>
                  <div>
                    <Icon name="clock" size={16} />
                    <span>
                      <small>Görüldüğü Dönem</small>
                      <strong>{selectedItem.period}</strong>
                    </span>
                  </div>
                  <div>
                    <Icon name="warning" size={16} />
                    <span>
                      <small>Risk Düzeyi</small>
                      <strong className={selectedItem.riskLevel}>
                        {riskLabel(selectedItem.riskLevel)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="tp-pest-guide-detail-tabs">
                  {(
                    [
                      ['general', 'Genel Bilgiler'],
                      ['symptoms', 'Belirtiler'],
                      ['lifecycle', 'Yaşam Döngüsü'],
                      ['control', 'Mücadele Yöntemleri'],
                    ] as Array<[DetailTab, string]>
                  ).map(([id, label]) => (
                    <button
                      type="button"
                      key={id}
                      className={detailTab === id ? 'active' : ''}
                      onClick={() => setDetailTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {detailTab === 'general' && (
                  <div className="tp-pest-guide-info-stack">
                    <p className="intro">{selectedItem.summary}</p>

                    <article>
                      <span><Icon name="leaf" size={17} /></span>
                      <div>
                        <strong>Belirtiler</strong>
                        <p>{selectedItem.symptoms[0]}</p>
                      </div>
                      <img src={selectedItem.images[1] ?? selectedItem.images[0]} alt="" />
                    </article>

                    <article>
                      <span><Icon name="calendar" size={17} /></span>
                      <div>
                        <strong>En Sık Görüldüğü Dönem</strong>
                        <p>{selectedItem.period}</p>
                      </div>
                      <div className="tp-pest-guide-month-strip">
                        {['Mar', 'Nis', 'May', 'Haz', 'Tem'].map((month, index) => (
                          <b key={month} className={index > 0 && index < 4 ? 'hot' : ''}>
                            {month}
                          </b>
                        ))}
                      </div>
                    </article>

                    <article>
                      <span><Icon name="target" size={17} /></span>
                      <div>
                        <strong>Riskini Artıran Koşullar</strong>
                        <p>{selectedItem.riskConditions.slice(0, 2).join(' ')}</p>
                      </div>
                      <div className="tp-pest-guide-weather-mini">
                        <span><Icon name="thermometer" size={14} /> 18–28°C</span>
                        <span><Icon name="droplet" size={14} /> Nem / yağışa bağlı</span>
                      </div>
                    </article>

                    <article>
                      <span><Icon name="search" size={17} /></span>
                      <div>
                        <strong>Tarlada Nereye Bakmalısın?</strong>
                        <p>{selectedItem.scouting}</p>
                      </div>
                      <Icon name="chevron" size={16} />
                    </article>
                  </div>
                )}

                {detailTab === 'symptoms' && (
                  <div className="tp-pest-guide-tab-panel">
                    <h3>Belirti Kontrol Listesi</h3>
                    {selectedItem.symptoms.map((symptom) => (
                      <div key={symptom}>
                        <Icon name="check" size={15} />
                        <span>{symptom}</span>
                      </div>
                    ))}
                  </div>
                )}

                {detailTab === 'lifecycle' && (
                  <div className="tp-pest-guide-tab-panel">
                    <h3>Yaşam Döngüsü / Gelişim</h3>
                    <p>{selectedItem.lifecycle}</p>
                    <div className="tp-pest-guide-stage-row">
                      <span>Başlangıç</span>
                      <i />
                      <span>Gelişim</span>
                      <i />
                      <span>Aktif Dönem</span>
                    </div>
                  </div>
                )}

                {detailTab === 'control' && (
                  <div className="tp-pest-guide-tab-panel">
                    <h3>Mücadele Yaklaşımı</h3>
                    {selectedItem.controlNotes.map((note) => (
                      <div key={note}>
                        <Icon name="shield" size={15} />
                        <span>{note}</span>
                      </div>
                    ))}
                    <div className="tp-pest-guide-control-warning">
                      <Icon name="info" size={14} />
                      Kimyasal ürün adı/dozu bu rehberde otomatik önerilmez.
                      Ruhsatlı ürün etiketi ve resmî teknik talimat esas alınmalıdır.
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="tp-pest-guide-photo-analysis"
                  onClick={() => navigate('aiAnalysis')}
                >
                  <Icon name="camera" size={17} />
                  Tarlamı Kontrol Et (Fotoğraf Analizi)
                </button>
              </div>
            </article>
          </section>

          <section className="tp-pest-guide-smart-row">
            <article>
              <div>
                <span><Icon name="camera" size={18} /></span>
                <div>
                  <strong>Tarlanla İlişkilendir</strong>
                  <p>
                    Bu belirtilerden birini tarlada gördün mü?
                    Fotoğraf çekerek AI analiz ekranından kontrol et.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => navigate('aiAnalysis')}>
                Fotoğraf Analizi
                <Icon name="chevron" size={13} />
              </button>
            </article>

            <article>
              <div>
                <span><Icon name="weather" size={18} /></span>
                <div>
                  <strong>Hava ile Risk Takibi</strong>
                  <p>
                    Bölgenizdeki sıcaklık ve nem koşullarını rehberdeki
                    risk koşullarıyla birlikte değerlendir.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => navigate('weatherHub')}>
                Riskleri Görüntüle
                <Icon name="chevron" size={13} />
              </button>
            </article>

            <article>
              <div>
                <span><Icon name="bell" size={18} /></span>
                <div>
                  <strong>Uyarı Al</strong>
                  <p>
                    Önemli risk dönemleri ve saha kontrol hatırlatmaları
                    için bildirim tercihini aç.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRiskAlerts((value) => !value)}
                className={riskAlerts ? 'enabled' : ''}
              >
                {riskAlerts ? 'Uyarılar Açık' : 'Uyarıları Aç'}
                <Icon name={riskAlerts ? 'check' : 'bell'} size={13} />
              </button>
            </article>
          </section>

          <section className="tp-pest-guide-compare-section">
            <div className="tp-pest-guide-section-head">
              <div>
                <span>BUNUNLA KARIŞTIRILABİLİR</span>
                <h2>Benzer belirtileri karşılaştır</h2>
              </div>
            </div>

            <div className="tp-pest-guide-compare-grid">
              {compareItems.map((item) => (
                <button
                  type="button"
                  key={`compare-${item.id}`}
                  onClick={() => openItem(item)}
                >
                  <img src={item.images[0]} alt="" />
                  <div>
                    <span className={`tp-pest-guide-category ${categoryClass(item.category)}`}>
                      {item.categoryLabel}
                    </span>
                    <strong>{item.name}</strong>
                    <small>Belirtileri benzeyebilir.</small>
                    <b>İncele <Icon name="chevron" size={11} /></b>
                  </div>
                </button>
              ))}

              <article className="tp-pest-guide-expert-tip">
                <span><Icon name="info" size={18} /></span>
                <div>
                  <strong>Uzman İpucu</strong>
                  <p>
                    Doğru teşhis, doğru mücadele için ilk adımdır.
                    Şüphe durumunda fotoğraf analizi ile kontrol et;
                    kesin karar öncesi uzman değerlendirmesi al.
                  </p>
                </div>
                <button type="button" onClick={() => navigate('aiAnalysis')}>
                  <Icon name="camera" size={14} />
                  Fotoğraf Analizi Yap
                </button>
              </article>
            </div>
          </section>

          <footer className="tp-pest-guide-footer">
            <Icon name="shield" size={14} />
            <span>
              Bilgiler eğitim ve saha farkındalığı amacıyla hazırlanmıştır.
              Kimyasal mücadelede resmî teknik talimatlar ve ürün etiketi esas alınmalıdır.
            </span>
            <small>TarlaPusula Rehber V1</small>
          </footer>
        </main>
      </div>

      <nav className="tp-pest-guide-bottom-nav">
        <button type="button" onClick={() => navigate('home')}>
          <Icon name="home" size={18} />
          <span>Ana Sayfa</span>
        </button>
        <button type="button" onClick={() => navigate('home')}>
          <Icon name="field" size={18} />
          <span>Tarlalarım</span>
        </button>
        <button
          type="button"
          className="tp-pest-guide-bottom-ai"
          onClick={() => navigate('aiAnalysis')}
        >
          <b><Icon name="ai" size={19} /></b>
          <span>AI Analiz</span>
        </button>
        <button type="button" onClick={() => navigate('calendar')}>
          <Icon name="calendar" size={18} />
          <span>Takvim</span>
        </button>
        <button type="button" onClick={() => setSideMenuOpen(true)}>
          <Icon name="more" size={18} />
          <span>Daha Fazla</span>
        </button>
      </nav>

      {sideMenuOpen && (
        <div className="tp-pest-guide-drawer-layer">
          <button
            type="button"
            className="tp-pest-guide-drawer-backdrop"
            onClick={() => setSideMenuOpen(false)}
          />
          <aside className="tp-pest-guide-drawer">
            <div className="tp-pest-guide-drawer-head">
              <div>
                <Icon name="brand" size={19} />
                <strong>TarlaPusula</strong>
              </div>
              <button type="button" onClick={() => setSideMenuOpen(false)}>
                <Icon name="close" size={17} />
              </button>
            </div>
            <nav>
              {sidebarItems.map((item, index) => (
                <button
                  type="button"
                  className={item.screen === screen ? 'active' : ''}
                  key={`drawer-${item.screen}-${index}`}
                  onClick={() => navigate(item.screen as Screen)}
                >
                  <span><Icon name={menuIcon(item)} size={16} /></span>
                  <strong>{item.label}</strong>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
