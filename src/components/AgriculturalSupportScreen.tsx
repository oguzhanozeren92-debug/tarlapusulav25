import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CalendarDays, CloudSun, House, MapPinned, Sparkles } from 'lucide-react';
import type { Field, Screen } from '../types';
import { supabase } from '../supabaseClient';
import './AgriculturalSupportScreen.css';

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface AgriculturalSupportScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

interface CropSupportRate {
  id: string;
  name: string;
  category: string;
  baseRatePerDekar: number;
  plannedRatePerDekar: number;
  waterScarcityRatePerDekar: number;
  certifiedSeedRatePerDekar: number;
  certifiedFidanRatePerDekar: number;
  waterScarcityExclusion?: boolean;
}

interface SupportCalculationItem {
  id: string;
  cropId: string;
  dekar: number;
  source?: 'manual' | 'field';
  fieldName?: string;
}

interface ConditionalSupports {
  plannedProduction: boolean;
  certifiedSeed: boolean;
  organicFarming: boolean;
  goodFarming: boolean;
  youngOrWomanFarmer: boolean;
  waterScarcityZone: boolean;
}

type CertificateMode = 'individual' | 'group';
type SupportProductGroup = 'group1' | 'group2' | 'group3';
type GoodFarmingMode = 'open' | 'covered';
type FeedTab = 'all' | 'varieties' | 'support' | 'disease' | 'food';

type IconName =
  | 'brand'
  | 'back'
  | 'menu'
  | 'home'
  | 'grid'
  | 'document'
  | 'alert'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'calendarBadge'
  | 'pin'
  | 'weather'
  | 'crop'
  | 'calculator'
  | 'food'
  | 'plus'
  | 'trash'
  | 'check'
  | 'seed'
  | 'organic'
  | 'shield'
  | 'person'
  | 'water'
  | 'info'
  | 'bell'
  | 'close'
  | 'chevron';

const SUPPORT_COEFFICIENT_VALUE = 310;

const CROP_SUPPORT_RATES: CropSupportRate[] = [
  {
    id: 'wheat',
    name: 'Buğday',
    category: '2. Kategori · Tahıllar',
    baseRatePerDekar: 403,
    plannedRatePerDekar: 403,
    waterScarcityRatePerDekar: 434,
    certifiedSeedRatePerDekar: 173.6,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'barley',
    name: 'Arpa',
    category: '2. Kategori · Tahıllar',
    baseRatePerDekar: 403,
    plannedRatePerDekar: 403,
    waterScarcityRatePerDekar: 434,
    certifiedSeedRatePerDekar: 173.6,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'corn',
    name: 'Mısır (dane)',
    category: '2. Kategori · Dane Mısır',
    baseRatePerDekar: 403,
    plannedRatePerDekar: 403,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 186,
    certifiedFidanRatePerDekar: 0,
    waterScarcityExclusion: true,
  },
  {
    id: 'rice',
    name: 'Çeltik',
    category: '4. Kategori',
    baseRatePerDekar: 697.5,
    plannedRatePerDekar: 0,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 173.6,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'cotton',
    name: 'Pamuk (kütlü)',
    category: '4. Kategori',
    baseRatePerDekar: 697.5,
    plannedRatePerDekar: 697.5,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 0,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'sunflower',
    name: 'Ayçiçeği (yağlık)',
    category: '3. Kategori',
    baseRatePerDekar: 465,
    plannedRatePerDekar: 465,
    waterScarcityRatePerDekar: 372,
    certifiedSeedRatePerDekar: 186,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'soy',
    name: 'Soya',
    category: '3. Kategori',
    baseRatePerDekar: 465,
    plannedRatePerDekar: 465,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 186,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'canola',
    name: 'Kolza (kanola)',
    category: '3. Kategori',
    baseRatePerDekar: 465,
    plannedRatePerDekar: 465,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 62,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'dry-bean',
    name: 'Fasulye (kuru)',
    category: '3. Kategori',
    baseRatePerDekar: 465,
    plannedRatePerDekar: 465,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 173.6,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'safflower',
    name: 'Aspir',
    category: '1. Kategori',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 310,
    waterScarcityRatePerDekar: 248,
    certifiedSeedRatePerDekar: 62,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'chickpea',
    name: 'Nohut',
    category: '1. Kategori',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 310,
    waterScarcityRatePerDekar: 248,
    certifiedSeedRatePerDekar: 124,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'lentil',
    name: 'Mercimek',
    category: '1. Kategori',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 310,
    waterScarcityRatePerDekar: 248,
    certifiedSeedRatePerDekar: 124,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'potato',
    name: 'Patates',
    category: '1. Kategori',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 310,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 682,
    certifiedFidanRatePerDekar: 0,
    waterScarcityExclusion: true,
  },
  {
    id: 'dry-onion',
    name: 'Soğan (kuru)',
    category: '1. Kategori',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 310,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 0,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'almond',
    name: 'Badem Bahçesi',
    category: 'Diğer Ürünler · Temel destek',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 0,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 0,
    certifiedFidanRatePerDekar: 1550,
  },
  {
    id: 'other',
    name: 'Diğer Ürünler',
    category: '1. Kategori / Diğer Ürünler',
    baseRatePerDekar: 310,
    plannedRatePerDekar: 0,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 0,
    certifiedFidanRatePerDekar: 0,
  },
  {
    id: 'fallow',
    name: 'Nadas',
    category: 'Nadas',
    baseRatePerDekar: 93,
    plannedRatePerDekar: 0,
    waterScarcityRatePerDekar: 0,
    certifiedSeedRatePerDekar: 0,
    certifiedFidanRatePerDekar: 0,
  },
];

const ORGANIC_RATES: Record<
  SupportProductGroup,
  Record<CertificateMode, number>
> = {
  group1: { individual: 372, group: 186 },
  group2: { individual: 186, group: 93 },
  group3: { individual: 124, group: 62 },
};

const GOOD_FARMING_RATES: Record<
  SupportProductGroup,
  {
    individual: number;
    group: number;
    coveredIndividual?: number;
    coveredGroup?: number;
  }
> = {
  group1: {
    individual: 217,
    group: 108.5,
    coveredIndividual: 527,
    coveredGroup: 263.5,
  },
  group2: {
    individual: 186,
    group: 93,
  },
  group3: {
    individual: 124,
    group: 62,
  },
};

interface AgriNewsRow {
  id: string;
  title: string;
  summary: string | null;
  category: 'support' | 'varieties' | 'disease' | 'food' | 'general';
  source_name: string;
  source_url: string;
  image_url: string | null;
  published_at: string | null;
  source_type: 'official' | 'admin' | 'user';
  raw?: { detail_text?: string | null } | null;
}

function dbCategoryToFeedTab(category: AgriNewsRow['category']): FeedTab {
  if (category === 'support') return 'support';
  if (category === 'varieties') return 'varieties';
  if (category === 'disease') return 'disease';
  if (category === 'food') return 'food';
  return 'all';
}

function formatNewsDate(value: string | null) {
  if (!value) return 'Yeni';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Yeni';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const FEED_TABS: Array<{
  id: FeedTab | 'calculator';
  label: string;
  icon: IconName;
}> = [
  { id: 'all', label: 'Tüm Haberler', icon: 'grid' },
  { id: 'varieties', label: 'Yeni Çeşitler', icon: 'crop' },
  { id: 'support', label: 'Destek & Mevzuat', icon: 'document' },
  { id: 'disease', label: 'Hastalık Uyarısı', icon: 'alert' },
  { id: 'food', label: 'Gıda', icon: 'food' },
  { id: 'calculator', label: 'Destek Hesapla', icon: 'calculator' },
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
          <path d="M12 21c4.4-3 7-6.6 7-11.1C19 6 16 3 12 3S5 6 5 9.9C5 14.4 7.6 18 12 21Z" />
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
    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1.3" />
          <rect x="14" y="4" width="6" height="6" rx="1.3" />
          <rect x="4" y="14" width="6" height="6" rx="1.3" />
          <rect x="14" y="14" width="6" height="6" rx="1.3" />
        </svg>
      );
    case 'document':
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5M9 12h6M9 16h6" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'food':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 5.5v13M5.5 12h13" opacity=".25" />
          <path d="M4 4v6a2 2 0 0 0 2 2V4M8 4v8M19 4v16M16.5 4v5.5a2.5 2.5 0 0 0 2.5 2.5" />
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
    case 'calendarBadge':
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
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2" />
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
    case 'crop':
      return (
        <svg {...common}>
          <path d="M12 21V5M12 9c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5Z" />
          <path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
        </svg>
      );
    case 'calculator':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2" />
        </svg>
      );
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case 'seed':
      return (
        <svg {...common}>
          <path d="M12 20v-8M12 13c-4 0-7-3-7-7 4 0 7 3 7 7ZM12 15c4 0 7-3 7-7-4 0-7 3-7 7Z" />
        </svg>
      );
    case 'organic':
      return (
        <svg {...common}>
          <path d="M20 4c-8 0-14 4-14 10 0 3 2 5 5 5 6 0 9-7 9-15Z" />
          <path d="M5 20c2-5 6-8 11-11" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'person':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'water':
      return (
        <svg {...common}>
          <path d="M12 3s6 6 6 11a6 6 0 1 1-12 0c0-5 6-11 6-11Z" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
        </svg>
      );
    case 'close':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
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
  if (label.includes('destek')) return 'calculator';

  return 'chevron';
}

function numberTr(value: number, max = 2) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: max,
    minimumFractionDigits: max === 2 ? 2 : 0,
  }).format(value);
}

function money(value: number) {
  return `${new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} TL`;
}

function matchCropRate(cropName: string): CropSupportRate {
  const normalized = normalizeText(cropName);

  const direct =
    CROP_SUPPORT_RATES.find(
      (crop) => normalizeText(crop.name) === normalized,
    ) ??
    CROP_SUPPORT_RATES.find((crop) => {
      const candidate = normalizeText(crop.name);
      return (
        normalized.includes(candidate) ||
        candidate.includes(normalized)
      );
    });

  if (direct) return direct;

  if (normalized.includes('badem')) {
    return CROP_SUPPORT_RATES.find((crop) => crop.id === 'almond')!;
  }

  if (normalized.includes('bugday')) {
    return CROP_SUPPORT_RATES.find((crop) => crop.id === 'wheat')!;
  }

  if (normalized.includes('arpa')) {
    return CROP_SUPPORT_RATES.find((crop) => crop.id === 'barley')!;
  }

  return CROP_SUPPORT_RATES.find((crop) => crop.id === 'other')!;
}

function organicRate(
  group: SupportProductGroup,
  certificate: CertificateMode,
) {
  return ORGANIC_RATES[group][certificate];
}

function goodFarmingRate(
  group: SupportProductGroup,
  certificate: CertificateMode,
  mode: GoodFarmingMode,
) {
  const row = GOOD_FARMING_RATES[group];

  if (group === 'group1' && mode === 'covered') {
    return certificate === 'individual'
      ? row.coveredIndividual ?? row.individual
      : row.coveredGroup ?? row.group;
  }

  return certificate === 'individual'
    ? row.individual
    : row.group;
}

export default function AgriculturalSupportScreen({
  fields,
  screen = 'supportHub',
  desktopMenuItems = [],
  sideMenuOpen = false,
  setScreen,
  setSideMenuOpen = () => undefined,
}: AgriculturalSupportScreenProps) {
  const realFields = useMemo(
    () => fields.filter((field) => !field.demo),
    [fields],
  );

  const [entryMode, setEntryMode] = useState<'manual' | 'fields'>(
    'manual',
  );
  const [activeFeedTab, setActiveFeedTab] = useState<FeedTab>('all');
  const [liveNews, setLiveNews] = useState<AgriNewsRow[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'feed' | 'calculator'>('feed');
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [items, setItems] = useState<SupportCalculationItem[]>([
    {
      id: 'support-row-1',
      cropId: 'wheat',
      dekar: 50,
      source: 'manual',
    },
  ]);
  const [conditional, setConditional] =
    useState<ConditionalSupports>({
      plannedProduction: false,
      certifiedSeed: false,
      organicFarming: false,
      goodFarming: false,
      youngOrWomanFarmer: false,
      waterScarcityZone: false,
    });

  const [organicGroup, setOrganicGroup] =
    useState<SupportProductGroup>('group1');
  const [organicCertificate, setOrganicCertificate] =
    useState<CertificateMode>('individual');
  const [goodFarmingGroup, setGoodFarmingGroup] =
    useState<SupportProductGroup>('group1');
  const [goodFarmingCertificate, setGoodFarmingCertificate] =
    useState<CertificateMode>('individual');
  const [goodFarmingMode, setGoodFarmingMode] =
    useState<GoodFarmingMode>('open');
  const [calculationVersion, setCalculationVersion] = useState(0);
  const [noticeEnabled, setNoticeEnabled] = useState(() => {
    try {
      return (
        window.localStorage.getItem('tp_support_decision_notices') ===
        'true'
      );
    } catch {
      return false;
    }
  });

  const totalEnteredDekar = items.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.dekar) ? Math.max(0, item.dekar) : 0),
    0,
  );

  const calculatedRows = useMemo(() => {
    return items.map((item) => {
      const crop =
        CROP_SUPPORT_RATES.find(
          (rate) => rate.id === item.cropId,
        ) ?? CROP_SUPPORT_RATES[0];

      const dekar =
        Number.isFinite(Number(item.dekar)) && Number(item.dekar) > 0
          ? Number(item.dekar)
          : 0;

      const supportParts: Array<{
        name: string;
        rate: number;
      }> = [];

      const blockedByWaterScarcity =
        conditional.waterScarcityZone &&
        Boolean(crop.waterScarcityExclusion);

      if (!blockedByWaterScarcity) {
        if (crop.baseRatePerDekar > 0) {
          supportParts.push({
            name: 'Temel Destek',
            rate: crop.baseRatePerDekar,
          });
        }

        if (
          conditional.plannedProduction &&
          crop.plannedRatePerDekar > 0
        ) {
          supportParts.push({
            name: 'Planlı Üretim',
            rate: crop.plannedRatePerDekar,
          });
        }

        if (conditional.certifiedSeed) {
          const seedOrFidanRate =
            crop.certifiedSeedRatePerDekar ||
            crop.certifiedFidanRatePerDekar;

          if (seedOrFidanRate > 0) {
            supportParts.push({
              name:
                crop.certifiedFidanRatePerDekar > 0
                  ? 'Sertifikalı Fidan'
                  : 'Sertifikalı Tohum',
              rate: seedOrFidanRate,
            });
          }
        }

        if (
          conditional.waterScarcityZone &&
          crop.waterScarcityRatePerDekar > 0
        ) {
          supportParts.push({
            name: 'Su Kısıtı',
            rate: crop.waterScarcityRatePerDekar,
          });
        }
      }

      if (conditional.organicFarming && dekar > 0) {
        supportParts.push({
          name: 'Organik Tarım*',
          rate: organicRate(
            organicGroup,
            organicCertificate,
          ),
        });
      }

      if (conditional.goodFarming && dekar > 0) {
        supportParts.push({
          name: 'İyi Tarım*',
          rate: goodFarmingRate(
            goodFarmingGroup,
            goodFarmingCertificate,
            goodFarmingMode,
          ),
        });
      }

      if (
        conditional.youngOrWomanFarmer &&
        dekar > 0 &&
        !blockedByWaterScarcity
      ) {
        supportParts.push({
          name: 'KOBÜKS Genç/Kadın İlavesi*',
          rate: SUPPORT_COEFFICIENT_VALUE * 3,
        });
      }

      const unitRate = supportParts.reduce(
        (sum, part) => sum + part.rate,
        0,
      );

      return {
        ...item,
        crop,
        dekar,
        supportParts,
        unitRate,
        total: unitRate * dekar,
        blockedByWaterScarcity,
      };
    });
  }, [
    items,
    conditional,
    organicGroup,
    organicCertificate,
    goodFarmingGroup,
    goodFarmingCertificate,
    goodFarmingMode,
    calculationVersion,
  ]);

  const totalSupport = calculatedRows.reduce(
    (sum, row) => sum + row.total,
    0,
  );

  const totalBase = calculatedRows.reduce((sum, row) => {
    if (row.blockedByWaterScarcity) return sum;

    return sum + row.crop.baseRatePerDekar * row.dekar;
  }, 0);

  const conditionalTotal = Math.max(0, totalSupport - totalBase);

  useEffect(() => {
    let cancelled = false;

    const loadNews = async () => {
      if (!supabase) {
        setNewsLoading(false);
        setNewsError('Supabase bağlantısı hazır değil.');
        return;
      }

      try {
        // Tarım Gündemi artık yalnızca TarlaPusula içinde eklenen içerikleri gösterir.
        // Bakanlık / dış kaynak otomatik senkronu kullanılmaz.
        const { data, error } = await supabase
          .from('agri_news')
          .select('id,title,summary,category,source_name,source_url,image_url,published_at,source_type,raw')
          .eq('is_published', true)
          .in('source_type', ['admin', 'user'])
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(50);

        if (error) throw error;

        if (!cancelled) {
          setLiveNews((data ?? []) as AgriNewsRow[]);
          setNewsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setNewsError(
            error instanceof Error
              ? error.message
              : 'Tarım Gündemi içerikleri yüklenemedi.',
          );
        }
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    };

    void loadNews();

    return () => {
      cancelled = true;
    };
  }, []);

  const liveStories = useMemo(() =>
    liveNews.map((item) => ({
      id: item.id,
      tag:
        item.category === 'support'
          ? 'Destek & Mevzuat'
          : item.category === 'varieties'
            ? 'Yeni Çeşitler'
            : item.category === 'disease'
              ? 'Hastalık Uyarısı'
              : item.category === 'food'
                ? 'Gıda'
                : item.source_name || 'Tarım Gündemi',
      tab: dbCategoryToFeedTab(item.category),
      date: formatNewsDate(item.published_at),
      title: item.title,
      excerpt: item.summary || 'Paylaşım detayını aç.',
      visual:
        item.category === 'disease'
          ? ('alert' as const)
          : item.category === 'support' || item.category === 'food'
            ? ('note' as const)
            : ('field' as const),
      sourceUrl: item.source_url,
      imageUrl: item.image_url,
      sourceName: item.source_name,
      sourceType: item.source_type,
      detailText: item.raw?.detail_text || item.summary || '',
    })),
  [liveNews]);

  const filteredStories = useMemo(() => {
    if (activeFeedTab === 'all') {
      return liveStories;
    }

    return liveStories.filter((story) => story.tab === activeFeedTab);
  }, [activeFeedTab, liveStories]);


  const importFields = () => {
    if (!realFields.length) {
      setEntryMode('fields');
      return;
    }

    setEntryMode('fields');
    setItems(
      realFields.map((field, index) => {
        const crop = matchCropRate(field.crop ?? '');

        return {
          id: `field-${String(field.id)}-${index}`,
          cropId: crop.id,
          dekar: Number(field.area ?? 0) || 0,
          source: 'field',
          fieldName: field.name,
        };
      }),
    );
  };

  const switchManual = () => {
    setEntryMode('manual');

    if (!items.length || items.every((item) => item.source === 'field')) {
      setItems([
        {
          id: `manual-${Date.now()}`,
          cropId: 'wheat',
          dekar: 0,
          source: 'manual',
        },
      ]);
    }
  };

  const addRow = () => {
    setItems((current) => [
      ...current,
      {
        id: `support-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        cropId: 'barley',
        dekar: 0,
        source: 'manual',
      },
    ]);
  };

  const removeRow = (id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);

      return next.length
        ? next
        : [
            {
              id: `support-${Date.now()}`,
              cropId: 'wheat',
              dekar: 0,
              source: 'manual',
            },
          ];
    });
  };

  const updateRow = (
    id: string,
    patch: Partial<SupportCalculationItem>,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  };

  const toggleConditional = (
    key: keyof ConditionalSupports,
  ) => {
    setConditional((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const sidebarItems = desktopMenuItems.filter(
    (item) => item.screen !== 'adminHub',
  );

  const toggleDecisionNotices = () => {
    const next = !noticeEnabled;
    setNoticeEnabled(next);

    try {
      window.localStorage.setItem(
        'tp_support_decision_notices',
        String(next),
      );
    } catch {
      // localStorage kapalıysa sadece bu oturumda tutulur.
    }
  };

  const focusCalculator = () => {
    setActiveView('calculator');
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleFeedTab = (tab: FeedTab | 'calculator') => {
    if (tab === 'calculator') {
      focusCalculator();
      return;
    }

    setActiveView('feed');
    setActiveFeedTab(tab);
  };

  const visualClass = (visual: 'field' | 'note' | 'alert') => {
    if (visual === 'note') return 'is-note';
    if (visual === 'alert') return 'is-alert';
    return 'is-field';
  };

  const visualIcon = (visual: 'field' | 'note' | 'alert'): IconName => {
    if (visual === 'note') return 'document';
    if (visual === 'alert') return 'alert';
    return 'crop';
  };

  return (
    <div className="tp-support-page">
      <div className="tp-support-content">
        <main className="tp-support-main">
          <section className={`tp-support-shell ${activeView === 'calculator' ? 'is-calculator' : 'is-feed'}`}>
            {activeView === 'feed' && (
            <div className="tp-support-feed-column">
              <section className="tp-support-page-intro">
                <div className="tp-support-hero-head tp-support-hero-head--compact">
                  <small>TARIMSAL GÜNDEM</small>
                  <h1>Tarım Gündemi</h1>
                  <p>Gündem · Uyarılar · Mevzuat · Gıda</p>
                </div>
              </section>

              <section className="tp-support-filter-row tp-support-global-tabs">
                {FEED_TABS.map((tab) => {
                  const active =
                    tab.id !== 'calculator' && activeFeedTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={active ? 'active' : ''}
                      onClick={() => handleFeedTab(tab.id)}
                    >
                      <Icon name={tab.icon} size={15} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </section>

              {(newsLoading || newsError) && (
                <div className={`tp-support-news-status ${newsError ? 'is-error' : ''}`}>
                  {newsLoading
                    ? 'Tarım Gündemi yükleniyor…'
                    : 'Tarım Gündemi içerikleri şu anda yüklenemedi.'}
                </div>
              )}

              {filteredStories.length > 0 ? (
                <section className="tp-support-news-rail" aria-label="Tarım Gündemi haberleri">
                  <div className="tp-support-news-rail-head">
                    <div>
                      <small>SON PAYLAŞIMLAR</small>
                      <strong>{activeFeedTab === 'all' ? 'Tarım Gündemi' : FEED_TABS.find((item) => item.id === activeFeedTab)?.label}</strong>
                    </div>
                    <span>Kaydırarak diğer haberlere geç</span>
                  </div>

                  <div className="tp-support-news-carousel">
                    {filteredStories.map((story) => (
                      <button
                        key={story.id}
                        type="button"
                        className="tp-support-news-card"
                        onClick={() => setSelectedStory(story)}
                        aria-label={`${story.title} haberini aç`}
                      >
                        <div className={`tp-support-news-card-media ${visualClass(story.visual)} ${story.imageUrl ? 'has-real-image' : ''}`}>
                          {story.imageUrl ? (
                            <img
                              src={story.imageUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="tp-support-news-card-placeholder">
                              <Icon name={visualIcon(story.visual)} size={34} />
                            </div>
                          )}

                          <div className="tp-support-news-card-shade" />
                          <div className="tp-support-news-card-copy">
                            <span className="tp-support-story-tag">{story.tag}</span>
                            <h2>{story.title}</h2>
                            <small>{story.date}</small>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : !newsLoading ? (
                <section className="tp-support-empty-feed">
                  <div className="tp-support-empty-feed-icon">
                    <Icon name="crop" size={28} />
                  </div>
                  <small>TARIM GÜNDEMİ</small>
                  <h2>Henüz paylaşım yok</h2>
                  <p>Burada admin tarafından yayınlanan TarlaPusula içerikleri gösterilecek.</p>
                </section>
              ) : null}
            </div>
            )}

            {activeView === 'calculator' && (
            <aside
              className="tp-support-calc-column"
              id="tp-support-calculator-panel"
            >
              <div className="tp-support-sticky-stack">
                <div className="tp-support-calculator-head">
                  <button type="button" onClick={() => setActiveView('feed')}>
                    <Icon name="back" size={16} />
                    Tarım Gündemine Dön
                  </button>
                  <div>
                    <small>TARIMSAL DESTEK</small>
                    <h1>Destek Hesapla</h1>
                    <p>Ürün ve alan bilgilerini gir; tahmini temel ve ilave destekleri hesapla.</p>
                  </div>
                </div>

                <article className="tp-support-summary-card">
                  <div className="tp-support-summary-top">
                    <div>
                      <small>DESTEK HESAPLA</small>
                      <strong>{money(totalSupport)}</strong>
                      <span>Tahmini toplam destek</span>
                    </div>
                    <button type="button" onClick={() => setCalculationVersion((current) => current + 1)}>
                      Güncelle
                    </button>
                  </div>

                  <div className="tp-support-summary-metrics">
                    <article>
                      <small>Toplam Alan</small>
                      <strong>{numberTr(totalEnteredDekar, 1)} da</strong>
                    </article>
                    <article>
                      <small>Temel</small>
                      <strong>{money(totalBase)}</strong>
                    </article>
                    <article>
                      <small>İlave</small>
                      <strong>{money(conditionalTotal)}</strong>
                    </article>
                  </div>
                </article>

                <article className="tp-support-side-card">
                  <div className="tp-support-card-head compact">
                    <div>
                      <span>ÜRETİM ALANLARI</span>
                      <h2>Destek Hesapla</h2>
                    </div>
                  </div>

                  <div className="tp-support-entry-tabs">
                    <button
                      type="button"
                      className={entryMode === 'manual' ? 'active' : ''}
                      onClick={switchManual}
                    >
                      Manuel Giriş
                    </button>
                    <button
                      type="button"
                      className={entryMode === 'fields' ? 'active' : ''}
                      onClick={importFields}
                    >
                      Tarlalarımdan Seç
                    </button>
                  </div>

                  {entryMode === 'fields' && realFields.length === 0 && (
                    <div className="tp-support-inline-note">
                      <Icon name="info" size={15} />
                      <span>
                        Aktarılabilecek gerçek tarla kaydı bulunamadı.
                        Manuel giriş kullanabilirsin.
                      </span>
                    </div>
                  )}

                  <div className="tp-support-product-list compact">
                    {items.map((item, index) => {
                      const crop =
                        CROP_SUPPORT_RATES.find(
                          (rate) => rate.id === item.cropId,
                        ) ?? CROP_SUPPORT_RATES[0];

                      return (
                        <article className="tp-support-product-row" key={item.id}>
                          <div className="tp-support-row-top compact">
                            <label>
                              <span>
                                Ürün {index + 1}
                                {item.fieldName ? ` · ${item.fieldName}` : ''}
                              </span>
                              <select
                                value={item.cropId}
                                onChange={(event) =>
                                  updateRow(item.id, {
                                    cropId: event.target.value,
                                    source: 'manual',
                                  })
                                }
                              >
                                {CROP_SUPPORT_RATES.map((rate) => (
                                  <option value={rate.id} key={rate.id}>
                                    {rate.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span>Alan (dekar)</span>
                              <input
                                inputMode="decimal"
                                value={
                                  Number.isFinite(item.dekar)
                                    ? item.dekar
                                    : ''
                                }
                                onChange={(event) =>
                                  updateRow(item.id, {
                                    dekar:
                                      Number(
                                        event.target.value.replace(',', '.'),
                                      ) || 0,
                                    source: 'manual',
                                  })
                                }
                                placeholder="Örn. 68,2"
                              />
                            </label>

                            <button
                              type="button"
                              className="tp-support-delete-row"
                              onClick={() => removeRow(item.id)}
                              aria-label="Satırı sil"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>

                          <div className="tp-support-rate-hint">
                            <span>{crop.category}</span>
                            <strong>
                              {numberTr(
                                crop.baseRatePerDekar,
                                crop.baseRatePerDekar % 1 ? 2 : 0,
                              )}{' '}
                              TL/da
                            </strong>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="tp-support-input-actions compact">
                    <button type="button" onClick={addRow}>
                      <Icon name="plus" size={14} />
                      Ürün Ekle
                    </button>

                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        setCalculationVersion((current) => current + 1)
                      }
                    >
                      <Icon name="calculator" size={15} />
                      Hesabı Güncelle
                    </button>
                  </div>
                </article>

                <article className="tp-support-side-card">
                  <div className="tp-support-card-head compact">
                    <div>
                      <span>SONUÇ</span>
                      <h2>Tahmini destek kırılımı</h2>
                    </div>
                  </div>

                  <div className="tp-support-breakdown-list">
                    {calculatedRows.map((row) => (
                      <article className="tp-support-breakdown-row" key={`result-${row.id}`}>
                        <div className="tp-support-breakdown-main">
                          <div>
                            <strong>{row.crop.name}</strong>
                            <small>
                              {row.fieldName ? `${row.fieldName} · ` : ''}
                              {numberTr(row.dekar, 1)} da
                            </small>
                          </div>
                          <b>{money(row.total)}</b>
                        </div>

                        <div className="tp-support-breakdown-meta">
                          <span>
                            {row.supportParts.length
                              ? row.supportParts.map((part) => part.name).join(' · ')
                              : 'Uygun destek bulunamadı'}
                          </span>
                          <small>
                            {numberTr(row.unitRate, row.unitRate % 1 ? 2 : 0)} TL/da
                          </small>
                        </div>

                        {row.blockedByWaterScarcity && (
                          <div className="tp-support-breakdown-warning">
                            Su kısıtı kuralı nedeniyle bu kalem hesap dışında.
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </article>

                <article className="tp-support-side-card">
                  <div className="tp-support-card-head compact">
                    <div>
                      <span>İLAVE DESTEKLER</span>
                      <h2>Ek destekleri dahil et</h2>
                    </div>
                  </div>

                  <div className="tp-support-check-grid compact">
                    <label className={conditional.plannedProduction ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={conditional.plannedProduction}
                        onChange={() => toggleConditional('plannedProduction')}
                      />
                      <span className="icon">
                        <Icon name="calendarBadge" size={16} />
                      </span>
                      <span>
                        <strong>Planlı Üretim</strong>
                        <small>Kategori tutarı kadar ilave destek.</small>
                      </span>
                    </label>

                    <label className={conditional.certifiedSeed ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={conditional.certifiedSeed}
                        onChange={() => toggleConditional('certifiedSeed')}
                      />
                      <span className="icon">
                        <Icon name="seed" size={16} />
                      </span>
                      <span>
                        <strong>Sertifikalı Tohum / Fidan</strong>
                        <small>Ürüne özel birim fiyatı uygular.</small>
                      </span>
                    </label>

                    <label className={conditional.waterScarcityZone ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={conditional.waterScarcityZone}
                        onChange={() => toggleConditional('waterScarcityZone')}
                      />
                      <span className="icon">
                        <Icon name="water" size={16} />
                      </span>
                      <span>
                        <strong>Su Kısıtı</strong>
                        <small>Uygun havza ürünlerinde ek destek hesaplar.</small>
                      </span>
                    </label>

                    <label className={conditional.youngOrWomanFarmer ? 'selected' : ''}>
                      <input
                        type="checkbox"
                        checked={conditional.youngOrWomanFarmer}
                        onChange={() => toggleConditional('youngOrWomanFarmer')}
                      />
                      <span className="icon">
                        <Icon name="person" size={16} />
                      </span>
                      <span>
                        <strong>Genç / Kadın Üretici</strong>
                        <small>KOBÜKS ilavesi uygular.</small>
                      </span>
                    </label>

                    <div className={`tp-support-expandable ${conditional.organicFarming ? 'selected' : ''}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={conditional.organicFarming}
                          onChange={() => toggleConditional('organicFarming')}
                        />
                        <span className="icon">
                          <Icon name="organic" size={16} />
                        </span>
                        <span>
                          <strong>Organik Tarım</strong>
                          <small>Sertifika türü ve ürün grubuna göre hesaplanır.</small>
                        </span>
                      </label>

                      {conditional.organicFarming && (
                        <div className="tp-support-extra-controls compact">
                          <select
                            value={organicGroup}
                            onChange={(event) =>
                              setOrganicGroup(event.target.value as SupportProductGroup)
                            }
                          >
                            <option value="group1">1. Grup Ürün</option>
                            <option value="group2">2. Grup Ürün</option>
                            <option value="group3">3. Grup Ürün</option>
                          </select>

                          <select
                            value={organicCertificate}
                            onChange={(event) =>
                              setOrganicCertificate(event.target.value as CertificateMode)
                            }
                          >
                            <option value="individual">Bireysel Sertifika</option>
                            <option value="group">Grup Sertifikası</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className={`tp-support-expandable ${conditional.goodFarming ? 'selected' : ''}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={conditional.goodFarming}
                          onChange={() => toggleConditional('goodFarming')}
                        />
                        <span className="icon">
                          <Icon name="shield" size={16} />
                        </span>
                        <span>
                          <strong>İyi Tarım</strong>
                          <small>Ürün grubu ve sertifika yapısına göre hesaplanır.</small>
                        </span>
                      </label>

                      {conditional.goodFarming && (
                        <div className="tp-support-extra-controls compact">
                          <select
                            value={goodFarmingGroup}
                            onChange={(event) =>
                              setGoodFarmingGroup(event.target.value as SupportProductGroup)
                            }
                          >
                            <option value="group1">1. Grup Ürün</option>
                            <option value="group2">2. Grup Ürün</option>
                            <option value="group3">3. Grup Ürün</option>
                          </select>

                          <select
                            value={goodFarmingCertificate}
                            onChange={(event) =>
                              setGoodFarmingCertificate(event.target.value as CertificateMode)
                            }
                          >
                            <option value="individual">Bireysel Sertifika</option>
                            <option value="group">Grup Sertifikası</option>
                          </select>

                          {goodFarmingGroup === 'group1' && (
                            <select
                              value={goodFarmingMode}
                              onChange={(event) =>
                                setGoodFarmingMode(event.target.value as GoodFarmingMode)
                              }
                            >
                              <option value="open">Açıkta Üretim</option>
                              <option value="covered">Örtüaltı / Kapalı Ortam</option>
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {conditional.waterScarcityZone &&
                    calculatedRows.some((row) => row.blockedByWaterScarcity) && (
                      <div className="tp-support-rule-warning">
                        <Icon name="info" size={16} />
                        <p>
                          Su kısıtı ilan edilen havzalarda dane mısır ve patates ekilişlerine temel ve planlı üretim desteği ödenmez. Bu satırlar tahmini toplamda otomatik olarak dışarıda bırakıldı.
                        </p>
                      </div>
                    )}
                </article>

                <article className="tp-support-side-card">
                  <div className="tp-support-card-head compact">
                    <div>
                      <span>2026 REFERANS</span>
                      <h2>Birim fiyat özeti</h2>
                    </div>
                  </div>

                  <div className="tp-support-rate-list compact">
                    <div>
                      <span>Arpa, Buğday, Dane Mısır</span>
                      <strong>403 TL/da</strong>
                    </div>
                    <div>
                      <span>Çeltik, Pamuk (kütlü)</span>
                      <strong>697,50 TL/da</strong>
                    </div>
                    <div>
                      <span>1. Kategori / Diğer Ürünler</span>
                      <strong>310 TL/da</strong>
                    </div>
                    <div>
                      <span>Ayçiçeği, Kanola, Fasulye, Soya</span>
                      <strong>465 TL/da</strong>
                    </div>
                    <div>
                      <span>Nadas</span>
                      <strong>93 TL/da</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tp-support-source-button"
                    onClick={() =>
                      window.open(
                        'https://www.tarimorman.gov.tr/BUGEM/Belgeler/Tar%C4%B1m%20Havzalar%C4%B1/2026%20Y%C4%B1l%C4%B1%20Destekleme%20Birim%20Fiyatlar%C4%B1.pdf',
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                  >
                    Resmî 2026 Birim Fiyatlarını Aç
                  </button>
                </article>

                <article className="tp-support-mini-grid">
                  <article className="tp-support-info-card compact">
                    <div>
                      <Icon name="info" size={18} />
                      <div>
                        <small>ÖNEMLİ BİLGİ</small>
                        <h2>Bu tutar tahminidir</h2>
                      </div>
                    </div>
                    <p>
                      Kesin destek hak edişi; ÇKS/ÖKS/KOBÜKS kaydı, ürün-havza eşleşmesi, sertifika ve başvuru takvimine göre belirlenir.
                    </p>
                  </article>

                  <article className="tp-support-notice-card compact">
                    <div>
                      <Icon name="bell" size={18} />
                      <div>
                        <small>DESTEK KARARLARI</small>
                        <h2>Değişiklikleri kaçırma</h2>
                      </div>
                    </div>

                    <p>
                      Yeni destek kararı veya başvuru dönemi yayınlandığında hatırlatma tercihini açık tut.
                    </p>

                    <button
                      type="button"
                      className={noticeEnabled ? 'enabled' : ''}
                      onClick={toggleDecisionNotices}
                    >
                      <Icon name={noticeEnabled ? 'check' : 'bell'} size={15} />
                      {noticeEnabled
                        ? 'Bildirim Tercihi Açık'
                        : 'Destekleme Bildirimlerini Aç'}
                    </button>
                  </article>
                </article>
              </div>
            </aside>
            )}
          </section>
        </main>
      </div>

      {selectedStory && (
        <div className="tp-support-news-modal-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="tp-support-news-modal-backdrop"
            onClick={() => setSelectedStory(null)}
            aria-label="Haber detayını kapat"
          />

          <article className="tp-support-news-modal">
            <div className="tp-support-news-modal-head">
              <div>
                <span className="tp-support-story-tag">{selectedStory.tag}</span>
                <small>{selectedStory.date}</small>
              </div>
              <button type="button" onClick={() => setSelectedStory(null)} aria-label="Kapat">
                <Icon name="close" size={17} />
              </button>
            </div>

            {selectedStory.imageUrl && (
              <div className="tp-support-news-modal-image">
                <img src={selectedStory.imageUrl} alt="" referrerPolicy="no-referrer" />
              </div>
            )}

            <div className="tp-support-news-modal-body">
              <h2>{selectedStory.title}</h2>
              {selectedStory.sourceName && (
                <div className="tp-support-news-source-line">
                  <span>Kaynak</span>
                  <strong>{selectedStory.sourceName}</strong>
                </div>
              )}

              <p className="tp-support-news-lead">{selectedStory.excerpt}</p>

              {selectedStory.detailText && selectedStory.detailText !== selectedStory.excerpt && (
                <div className="tp-support-news-detail-text">
                  {String(selectedStory.detailText)
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .slice(0, 30)
                    .map((paragraph: string, index: number) => {
                      const trimmed = paragraph.trim();
                      const emphasized = trimmed.startsWith('**') && trimmed.endsWith('**');
                      const text = emphasized ? trimmed.slice(2, -2).trim() : trimmed;

                      return emphasized ? (
                        <h3 key={`detail-${index}`}>{text}</h3>
                      ) : (
                        <p key={`detail-${index}`}>{text}</p>
                      );
                    })}
                </div>
              )}

              <div className="tp-support-news-modal-actions">
                {'sourceUrl' in selectedStory && selectedStory.sourceUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(selectedStory.sourceUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Kaynağı Aç
                    <Icon name="chevron" size={14} />
                  </button>
                )}
                <button type="button" className="secondary" onClick={() => setSelectedStory(null)}>
                  Kapat
                </button>
              </div>
            </div>
          </article>
        </div>
      )}

      <nav className="tp-bottom" aria-label="Ana menü">
        <button type="button" onClick={() => navigate('home')}>
          <span className="tp-bottom-icon-shell">
            <House className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Ana Sayfa
        </button>

        <button
          type="button"
          onClick={() => navigate('weatherHub')}
          aria-label="Hava Durumu"
        >
          <span className="tp-bottom-icon-shell">
            <CloudSun className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Hava Durumu
        </button>

        <button
          className="ai"
          type="button"
          onClick={() => navigate('aiAnalysis')}
        >
          <span className="tp-bottom-ai-shell">
            <Sparkles className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Pusula AI
        </button>

        <button type="button" onClick={() => navigate('calendar')}>
          <span className="tp-bottom-icon-shell">
            <CalendarDays className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Takvim
        </button>

        <button
          type="button"
          aria-label="Tarlalarım listesini aç"
          onClick={() => {
            setScreen?.('home');
            setSideMenuOpen(false);
            window.setTimeout(() => {
              const target = document.querySelector(
                'button[aria-label="Tarlalarım listesini aç"]',
              ) as HTMLButtonElement | null;
              target?.click();
            }, 80);
          }}
        >
          <span className="tp-bottom-icon-shell">
            <MapPinned className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Tarlalarım
        </button>
      </nav>

      {sideMenuOpen && (
        <div className="tp-support-drawer-layer">
          <button
            type="button"
            className="tp-support-drawer-backdrop"
            onClick={() => setSideMenuOpen(false)}
            aria-label="Menüyü kapat"
          />

          <aside className="tp-support-drawer">
            <div className="tp-support-drawer-head">
              <div>
                <Icon name="brand" size={19} />
                <strong>TarlaPusula</strong>
              </div>

              <button
                type="button"
                onClick={() => setSideMenuOpen(false)}
                aria-label="Menüyü kapat"
              >
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
                  <span>
                    <Icon name={menuIcon(item)} size={16} />
                  </span>
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
