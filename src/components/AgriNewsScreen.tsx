import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Field, Screen } from '../types';
import './AgriNewsScreen.css';

export type NewsCategory =
  | 'all'
  | 'varieties'
  | 'support'
  | 'pest_warning'
  | 'developments';

export interface NewsItem {
  id: string;
  category: NewsCategory;
  categoryLabel: string;
  badgeType: 'green' | 'yellow' | 'red' | 'blue';
  title: string;
  summary: string;
  date: string;
  sourceName: string;
  sourceUrl?: string;
  imageUrl?: string;
  actionText?: string;
  actionScreen?: string;
  tags?: string[];
  recommendedRegions?: string[];
}

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface AgriNewsScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type IconName =
  | 'brand'
  | 'back'
  | 'menu'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'all'
  | 'variety'
  | 'document'
  | 'warning'
  | 'tractor'
  | 'pin'
  | 'weather'
  | 'bell'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'calculator'
  | 'checklist'
  | 'book'
  | 'shield'
  | 'chart'
  | 'crop'
  | 'info'
  | 'close'
  | 'chevron';

const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'featured-barley-anka',
    category: 'varieties',
    categoryLabel: 'YENİ ÇEŞİT',
    badgeType: 'green',
    title: 'Yeni tescil edilen arpa çeşidi: Anka 2026',
    summary:
      'Yüksek verim potansiyeli ve kuraklığa toleransı ile öne çıkan örnek arpa çeşidi için bölgesel uygunluk, gelişim özellikleri ve tarla planlama notlarını inceleyin.',
    date: '15 Mayıs 2026',
    sourceName: 'TTSM / Demo İçerik',
    imageUrl:
      'https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?auto=format&fit=crop&w=1200&q=82',
    actionText: 'Çeşidi İncele',
    tags: [
      'Kuraklığa Toleranslı',
      'Yüksek Verim',
      'Orta Erkenci',
      'Küllemeye Dayanıklı',
    ],
    recommendedRegions: [
      'İç Anadolu',
      'Doğu Anadolu',
      'Geçit Bölgeleri',
    ],
  },
  {
    id: 'support-2026-update',
    category: 'support',
    categoryLabel: 'DESTEK & MEVZUAT',
    badgeType: 'yellow',
    title: '2026 destek ödemeleri için hesaplama rehberi güncellendi',
    summary:
      'Temel destek, planlı üretim, su kısıtı ve sertifikalı materyal kalemlerinin üretici üzerindeki tahmini etkisini TarlaPusula hesaplayıcısı ile karşılaştırın.',
    date: '14 Mayıs 2026',
    sourceName: 'T.C. Tarım ve Orman Bakanlığı / Demo Akış',
    imageUrl:
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=82',
    actionText: 'Bana Etkisini Hesapla',
    actionScreen: 'supportHub',
    tags: ['2026 Destekleri', 'Planlı Üretim', 'ÇKS'],
    recommendedRegions: ['Türkiye Geneli'],
  },
  {
    id: 'yellow-rust-warning',
    category: 'pest_warning',
    categoryLabel: 'HASTALIK / ZARARLI UYARISI',
    badgeType: 'red',
    title: 'Buğdayda sarı pas riski için saha kontrolü önerisi',
    summary:
      'Serin ve nemli koşulların devam ettiği bölgelerde buğday yapraklarında sarı pas belirtilerine karşı düzenli saha kontrolü yapılması öneriliyor.',
    date: '13 Mayıs 2026',
    sourceName: 'TAGEM / Demo Uyarı Akışı',
    imageUrl:
      'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=1200&q=82',
    actionText: 'Kontrol Listesini Gör',
    actionScreen: 'pestGuideHub',
    tags: ['Buğday', 'Sarı Pas', 'Saha Kontrolü'],
    recommendedRegions: [
      'İç Anadolu',
      'Doğu Anadolu',
      'Karadeniz Geçitleri',
    ],
  },
  {
    id: 'irrigation-guide',
    category: 'developments',
    categoryLabel: 'TARIMSAL GELİŞMELER',
    badgeType: 'blue',
    title: 'Su tasarruflu sulama teknolojileri rehberi',
    summary:
      'Basınçlı sulama, damla sulama ve sulama zamanlaması konusunda üretici kararlarını destekleyecek örnek rehber akışı hazırlandı.',
    date: '12 Mayıs 2026',
    sourceName: 'Tarımsal Sulama / Demo İçerik',
    imageUrl:
      'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=1200&q=82',
    actionText: 'Rehberi Oku',
    actionScreen: 'weatherHub',
    tags: ['Su Tasarrufu', 'Damla Sulama', 'Verimlilik'],
    recommendedRegions: ['Türkiye Geneli'],
  },
  {
    id: 'wheat-varieties',
    category: 'varieties',
    categoryLabel: 'YENİ ÇEŞİT',
    badgeType: 'green',
    title: 'Ekime uygun yeni buğday çeşitlerini karşılaştır',
    summary:
      'Kayıtlı ürünlerinize göre erkencilik, kuraklık toleransı ve verim potansiyeli gibi özellikleri karşılaştırın.',
    date: '11 Mayıs 2026',
    sourceName: 'TTSM / Demo İçerik',
    imageUrl:
      'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=900&q=80',
    actionText: 'İncele',
    tags: ['Buğday', 'Çeşit Seçimi'],
    recommendedRegions: ['İç Anadolu', 'Doğu Anadolu'],
  },
  {
    id: 'fuel-fertilizer-reminder',
    category: 'support',
    categoryLabel: 'DESTEK & MEVZUAT',
    badgeType: 'yellow',
    title: 'Mazot ve gübre desteği için kayıt kontrollerini unutmayın',
    summary:
      'ÇKS kaydı ve üretim bilgilerinizin başvuru dönemi öncesinde güncel olduğundan emin olun.',
    date: '10 Mayıs 2026',
    sourceName: 'TarlaPusula / Demo Hatırlatma',
    actionText: 'Destekleri Hesapla',
    actionScreen: 'supportHub',
    tags: ['ÇKS', 'Mazot', 'Gübre'],
    recommendedRegions: ['Türkiye Geneli'],
  },
  {
    id: 'hail-risk',
    category: 'developments',
    categoryLabel: 'TARIMSAL GELİŞMELER',
    badgeType: 'blue',
    title: 'Dolu riski olan günlerde tarla planınızı kontrol edin',
    summary:
      'Kısa süreli kuvvetli yağış ve dolu olasılığı görülen dönemlerde saha faaliyetlerini hava tahmini ile birlikte planlayın.',
    date: '9 Mayıs 2026',
    sourceName: 'TarlaPusula Hava / Demo Uyarı',
    actionText: 'Hava Durumunu Gör',
    actionScreen: 'weatherHub',
    tags: ['Dolu', 'Hava Riski', 'Saha Planı'],
    recommendedRegions: ['Yerel Konuma Göre'],
  },
];

const FILTERS: Array<{
  id: NewsCategory;
  label: string;
  icon: IconName;
}> = [
  { id: 'all', label: 'Tüm Haberler', icon: 'all' },
  { id: 'varieties', label: 'Yeni Çeşitler', icon: 'variety' },
  { id: 'support', label: 'Destek & Mevzuat', icon: 'document' },
  {
    id: 'pest_warning',
    label: 'Hastalık / Zararlı Uyarıları',
    icon: 'warning',
  },
  {
    id: 'developments',
    label: 'Tarımsal Gelişmeler',
    icon: 'tractor',
  },
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
    case 'all':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );
    case 'variety':
    case 'crop':
      return (
        <svg {...common}>
          <path d="M12 21V5M12 9c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5Z" />
          <path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
        </svg>
      );
    case 'document':
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6V3Z" />
          <path d="M14 3v5h5M9 12h6M9 16h6" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      );
    case 'tractor':
      return (
        <svg {...common}>
          <circle cx="7" cy="17" r="3" />
          <circle cx="17" cy="17" r="4" />
          <path d="M4 14V8h8l2 5M8 8V5h5l2 5M2 17h2M10 17h3" />
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
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
        </svg>
      );
    case 'arrowLeft':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'arrowRight':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'arrowUpRight':
      return (
        <svg {...common}>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      );
    case 'calculator':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2" />
        </svg>
      );
    case 'checklist':
      return (
        <svg {...common}>
          <path d="m4 7 2 2 3-4M11 7h9M4 14l2 2 3-4M11 14h9M11 20h9" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5ZM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
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
  if (label.includes('gundem')) return 'document';

  return 'chevron';
}

function actionIcon(item: NewsItem): IconName {
  if (item.category === 'support') return 'calculator';
  if (item.category === 'pest_warning') return 'checklist';
  if (item.category === 'developments') return 'book';
  return 'arrowRight';
}

export default function AgriNewsScreen({
  fields,
  selectedFieldId = '',
  screen = 'agendaHub',
  desktopMenuItems = [],
  sideMenuOpen = false,
  setScreen,
  setSideMenuOpen = () => undefined,
}: AgriNewsScreenProps) {
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

  const [selectedCategory, setSelectedCategory] =
    useState<NewsCategory>('all');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [detailItem, setDetailItem] = useState<NewsItem | null>(
    null,
  );
  const [notificationOpen, setNotificationOpen] =
    useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<
    Record<Exclude<NewsCategory, 'all'>, boolean>
  >(() => {
    try {
      const raw = window.localStorage.getItem(
        'tp_agri_news_notification_prefs_v1',
      );

      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          varieties: Boolean(parsed.varieties),
          support:
            parsed.support === undefined
              ? true
              : Boolean(parsed.support),
          pest_warning:
            parsed.pest_warning === undefined
              ? true
              : Boolean(parsed.pest_warning),
          developments: Boolean(parsed.developments),
        };
      }
    } catch {
      // defaults below
    }

    return {
      varieties: false,
      support: true,
      pest_warning: true,
      developments: false,
    };
  });

  const featuredItems = NEWS_ITEMS.slice(0, 3);
  const featured =
    featuredItems[carouselIndex] ?? featuredItems[0];

  const locationLabel =
    [selectedField?.city, selectedField?.district]
      .filter(Boolean)
      .join(' / ') || 'Türkiye Geneli';

  const cropNames = useMemo(
    () =>
      realFields
        .map((field) => String(field.crop ?? '').trim())
        .filter(Boolean),
    [realFields],
  );

  const filteredNews = useMemo(() => {
    if (selectedCategory === 'all') {
      return NEWS_ITEMS.slice(1, 4);
    }

    return NEWS_ITEMS.filter(
      (item) => item.category === selectedCategory,
    ).slice(0, 6);
  }, [selectedCategory]);

  const personalItems = useMemo(() => {
    const normalizedCrops = cropNames.map(normalizeText);

    const wheatRelevant = normalizedCrops.some(
      (crop) =>
        crop.includes('bugday') || crop.includes('arpa'),
    );

    const base = [
      NEWS_ITEMS.find((item) => item.id === 'wheat-varieties'),
      NEWS_ITEMS.find(
        (item) => item.id === 'fuel-fertilizer-reminder',
      ),
      NEWS_ITEMS.find((item) => item.id === 'hail-risk'),
    ].filter(Boolean) as NewsItem[];

    if (wheatRelevant) {
      const rust = NEWS_ITEMS.find(
        (item) => item.id === 'yellow-rust-warning',
      );

      if (rust) {
        return [rust, ...base].slice(0, 3);
      }
    }

    return base.slice(0, 3);
  }, [cropNames]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCarouselIndex(
        (current) => (current + 1) % featuredItems.length,
      );
    }, 6500);

    return () => window.clearInterval(timer);
  }, [featuredItems.length]);

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const handleAction = (item: NewsItem) => {
    if (item.actionScreen) {
      navigate(item.actionScreen as Screen);
      return;
    }

    setDetailItem(item);
  };

  const saveNotificationPrefs = () => {
    try {
      window.localStorage.setItem(
        'tp_agri_news_notification_prefs_v1',
        JSON.stringify(notificationPrefs),
      );
    } catch {
      // localStorage kapalıysa state bu oturumda kalır.
    }

    setNotificationOpen(false);
  };

  const sidebarItems = desktopMenuItems.filter(
    (item) => item.screen !== 'adminHub',
  );

  return (
    <div className="tp-agri-news-page">
      <aside className="tp-agri-news-sidebar">
        <div className="tp-agri-news-brand">
          <span>
            <Icon name="brand" size={21} />
          </span>
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
              className={
                item.screen === screen ? 'active' : ''
              }
              onClick={() => navigate(item.screen as Screen)}
            >
              <span>
                <Icon name={menuIcon(item)} size={17} />
              </span>
              <strong>{item.label}</strong>
              {item.badge && <i>{item.badge}</i>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="tp-agri-news-content">
        <header className="tp-agri-news-topbar">
          <button
            type="button"
            onClick={() => navigate('home')}
            aria-label="Ana sayfaya dön"
          >
            <Icon name="back" size={18} />
          </button>

          <div>
            <strong>Tarım Gündemi</strong>
            <small>
              Ürünlerin ve bölgen için önemli gelişmeleri takip et
            </small>
          </div>

          <button
            type="button"
            className="tp-agri-news-mobile-menu"
            onClick={() => setSideMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon name="menu" size={18} />
          </button>
        </header>

        <main className="tp-agri-news-main">
          <section className="tp-agri-news-heading">
            <div>
              <span>GÜNDEM · UYARILAR · MEVZUAT</span>
              <h1>
                Tarım Gündemi
                <em>
                  Ürünlerin ve bölgen için önemli gelişmeleri
                  takip et.
                </em>
              </h1>
            </div>

            <div className="tp-agri-news-widgets">
              <article>
                <Icon name="pin" size={16} />
                <div>
                  <small>KONUM</small>
                  <strong>{locationLabel}</strong>
                  <span>
                    {selectedField
                      ? `${selectedField.name} referans alınıyor`
                      : 'Türkiye geneli akış'}
                  </span>
                </div>
              </article>

              <article>
                <Icon name="weather" size={16} />
                <div>
                  <small>HAVA BAĞLANTISI</small>
                  <strong>Tarla hava modülü</strong>
                  <span>
                    Yerel uyarılar hava ekranı ile birlikte izlenir
                  </span>
                </div>
              </article>

              <button
                type="button"
                onClick={() => setNotificationOpen(true)}
              >
                <Icon name="bell" size={16} />
                <div>
                  <small>BİLDİRİMLER</small>
                  <strong>Tercihleri Yönet</strong>
                  <span>Destek ve risk uyarılarını seç</span>
                </div>
              </button>
            </div>
          </section>

          <div className="tp-agri-news-demo-notice">
            <span />
            V1 gündem içerikleri demo / mock veridir. Canlı haber
            servisi bağlandığında kaynak ve yayın tarihi backend
            üzerinden doğrulanmalıdır.
          </div>

          <div className="tp-agri-news-filters">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={
                  selectedCategory === filter.id
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setSelectedCategory(filter.id)
                }
              >
                <Icon name={filter.icon} size={15} />
                {filter.label}
              </button>
            ))}
          </div>

          <section className="tp-agri-news-featured">
            <div className="tp-agri-news-feature-image">
              <img
                src={featured.imageUrl}
                alt=""
              />
              <span
                className={`tp-agri-news-badge ${featured.badgeType}`}
              >
                {featured.categoryLabel}
              </span>

              <div className="tp-agri-news-feature-controls">
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex(
                      (current) =>
                        (current -
                          1 +
                          featuredItems.length) %
                        featuredItems.length,
                    )
                  }
                  aria-label="Önceki manşet"
                >
                  <Icon name="arrowLeft" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex(
                      (current) =>
                        (current + 1) %
                        featuredItems.length,
                    )
                  }
                  aria-label="Sonraki manşet"
                >
                  <Icon name="arrowRight" size={16} />
                </button>
              </div>
            </div>

            <article className="tp-agri-news-feature-copy">
              <span>{featured.date}</span>
              <h2>{featured.title}</h2>
              <p>{featured.summary}</p>

              {featured.tags?.length ? (
                <div className="tp-agri-news-tags">
                  {featured.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="tp-agri-news-feature-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleAction(featured)}
                >
                  <Icon
                    name={actionIcon(featured)}
                    size={15}
                  />
                  {featured.actionText ?? 'Haberi İncele'}
                </button>

                <button
                  type="button"
                  onClick={() => setDetailItem(featured)}
                >
                  <Icon name="pin" size={14} />
                  Bölgeme Uygunluğunu Gör
                </button>
              </div>

              <small className="tp-agri-news-source">
                {featured.sourceName}
              </small>

              <div className="tp-agri-news-dots">
                {featuredItems.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={
                      index === carouselIndex ? 'active' : ''
                    }
                    onClick={() => setCarouselIndex(index)}
                    aria-label={`Manşet ${index + 1}`}
                  />
                ))}
              </div>
            </article>

            <aside className="tp-agri-news-region-card">
              <div>
                <span>ÖNERİLEN BÖLGELER</span>
                <h3>Bölgesel Uygunluk</h3>
                <p>
                  Haber içeriğinde belirtilen örnek bölgesel
                  kapsama göre görselleştirilmiştir.
                </p>
              </div>

              <div className="tp-agri-news-map">
                <svg
                  viewBox="0 0 300 160"
                  role="img"
                  aria-label="İllüstratif Türkiye bölge görünümü"
                >
                  <path
                    d="M20 82 42 58l36 3 22-22 36 10 27-19 33 15 39-6 25 24 20 13-11 24-41 8-20 22-39-4-34 16-27-12-37 4-16-22-28-5Z"
                    fill="currentColor"
                    opacity=".16"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="146" cy="77" r="18" />
                  <circle cx="202" cy="83" r="13" />
                  <circle cx="114" cy="92" r="10" />
                </svg>

                <div>
                  {featured.recommendedRegions?.map(
                    (region) => (
                      <span key={region}>{region}</span>
                    ),
                  )}
                </div>
              </div>

              <small>
                İllüstratif görünüm · kesin çeşit / hastalık
                uygunluğu için resmî teknik tavsiyeler esas alınır.
              </small>
            </aside>
          </section>

          <section className="tp-agri-news-grid">
            {filteredNews.map((item) => (
              <article
                className="tp-agri-news-card"
                key={item.id}
              >
                <div className="tp-agri-news-card-top">
                  <span
                    className={`tp-agri-news-badge ${item.badgeType}`}
                  >
                    {item.categoryLabel}
                  </span>
                  <time>{item.date}</time>
                </div>

                <div className="tp-agri-news-card-icon">
                  <Icon
                    name={
                      item.category === 'support'
                        ? 'document'
                        : item.category === 'pest_warning'
                          ? 'warning'
                          : item.category === 'developments'
                            ? 'tractor'
                            : 'variety'
                    }
                    size={22}
                  />
                </div>

                <h3>{item.title}</h3>
                <p>{item.summary}</p>

                <button
                  type="button"
                  onClick={() => handleAction(item)}
                >
                  <Icon name={actionIcon(item)} size={15} />
                  {item.actionText ?? 'İncele'}
                </button>

                <small>
                  Kaynak: {item.sourceName}
                  <Icon name="arrowUpRight" size={11} />
                </small>
              </article>
            ))}
          </section>

          <section className="tp-agri-news-personal">
            <div className="tp-agri-news-section-head">
              <div>
                <span>
                  SANA ÖZEL ÖNE ÇIKANLAR
                  <Icon name="info" size={12} />
                </span>
                <h2>
                  {cropNames.length
                    ? `${cropNames
                        .slice(0, 2)
                        .join(' · ')} için hızlı akış`
                    : 'Tarla kayıtlarına göre hızlı akış'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
              >
                Tümünü Gör
                <Icon name="arrowRight" size={13} />
              </button>
            </div>

            <div className="tp-agri-news-personal-list">
              {personalItems.map((item) => (
                <article key={`personal-${item.id}`}>
                  <div
                    className={`tp-agri-news-personal-image ${item.badgeType}`}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <Icon
                        name={
                          item.category === 'support'
                            ? 'document'
                            : item.category === 'pest_warning'
                              ? 'warning'
                              : 'weather'
                        }
                        size={23}
                      />
                    )}
                  </div>

                  <div>
                    <span>{item.date}</span>
                    <strong>{item.title}</strong>
                    <small>{item.categoryLabel}</small>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAction(item)}
                    aria-label={item.actionText ?? 'İncele'}
                  >
                    <Icon name="arrowRight" size={14} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      <nav className="tp-agri-news-bottom-nav">
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
          className="tp-agri-news-bottom-ai"
          onClick={() => navigate('aiAnalysis')}
        >
          <b>
            <Icon name="ai" size={19} />
          </b>
          <span>AI Analiz</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('calendar')}
        >
          <Icon name="calendar" size={18} />
          <span>Takvim</span>
        </button>

        <button
          type="button"
          onClick={() => setSideMenuOpen(true)}
        >
          <Icon name="more" size={18} />
          <span>Daha Fazla</span>
        </button>
      </nav>

      {sideMenuOpen && (
        <div className="tp-agri-news-drawer-layer">
          <button
            type="button"
            className="tp-agri-news-drawer-backdrop"
            onClick={() => setSideMenuOpen(false)}
            aria-label="Menüyü kapat"
          />

          <aside className="tp-agri-news-drawer">
            <div className="tp-agri-news-drawer-head">
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
                  className={
                    item.screen === screen ? 'active' : ''
                  }
                  key={`drawer-${item.screen}-${index}`}
                  onClick={() =>
                    navigate(item.screen as Screen)
                  }
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

      {detailItem && (
        <div className="tp-agri-news-modal-layer">
          <button
            type="button"
            className="tp-agri-news-modal-backdrop"
            onClick={() => setDetailItem(null)}
            aria-label="Detay penceresini kapat"
          />

          <section
            className="tp-agri-news-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Gündem detayı"
          >
            <div className="tp-agri-news-modal-head">
              <div>
                <span
                  className={`tp-agri-news-badge ${detailItem.badgeType}`}
                >
                  {detailItem.categoryLabel}
                </span>
                <small>{detailItem.date}</small>
              </div>

              <button
                type="button"
                onClick={() => setDetailItem(null)}
                aria-label="Kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            {detailItem.imageUrl && (
              <img
                className="tp-agri-news-modal-image"
                src={detailItem.imageUrl}
                alt=""
              />
            )}

            <h2>{detailItem.title}</h2>
            <p>{detailItem.summary}</p>

            {detailItem.tags?.length ? (
              <div className="tp-agri-news-tags">
                {detailItem.tags.map((tag) => (
                  <span key={`modal-${tag}`}>{tag}</span>
                ))}
              </div>
            ) : null}

            {detailItem.recommendedRegions?.length ? (
              <div className="tp-agri-news-modal-regions">
                <strong>Önerilen / ilgili bölgeler</strong>
                <div>
                  {detailItem.recommendedRegions.map((region) => (
                    <span key={`region-${region}`}>
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="tp-agri-news-modal-source">
              <Icon name="info" size={15} />
              <span>
                Kaynak etiketi: {detailItem.sourceName}. Bu V1
                içerik demo veridir ve canlı resmî haber doğrulaması
                yapılmamaktadır.
              </span>
            </div>

            <div className="tp-agri-news-modal-actions">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
              >
                Kapat
              </button>

              {detailItem.actionScreen && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setDetailItem(null);
                    navigate(
                      detailItem.actionScreen as Screen,
                    );
                  }}
                >
                  İlgili Modülü Aç
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {notificationOpen && (
        <div className="tp-agri-news-modal-layer">
          <button
            type="button"
            className="tp-agri-news-modal-backdrop"
            onClick={() => setNotificationOpen(false)}
            aria-label="Bildirim penceresini kapat"
          />

          <section
            className="tp-agri-news-modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Tarım gündemi bildirim tercihleri"
          >
            <div className="tp-agri-news-modal-head">
              <div>
                <small>BİLDİRİM TERCİHLERİ</small>
                <h2>Hangi gelişmeleri takip edelim?</h2>
              </div>

              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
                aria-label="Kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <div className="tp-agri-news-pref-list">
              {FILTERS.filter(
                (filter) => filter.id !== 'all',
              ).map((filter) => {
                const key =
                  filter.id as Exclude<NewsCategory, 'all'>;

                return (
                  <label
                    key={`pref-${key}`}
                    className={
                      notificationPrefs[key] ? 'selected' : ''
                    }
                  >
                    <input
                      type="checkbox"
                      checked={notificationPrefs[key]}
                      onChange={() =>
                        setNotificationPrefs((current) => ({
                          ...current,
                          [key]: !current[key],
                        }))
                      }
                    />

                    <span>
                      <Icon name={filter.icon} size={17} />
                    </span>

                    <strong>{filter.label}</strong>
                  </label>
                );
              })}
            </div>

            <div className="tp-agri-news-modal-source">
              <Icon name="info" size={15} />
              <span>
                Bu tercih V1'de cihazda saklanır. Gerçek push haber
                bildirimi backend akışı bağlandığında bu tercih
                kullanılabilir.
              </span>
            </div>

            <div className="tp-agri-news-modal-actions">
              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="primary"
                onClick={saveNotificationPrefs}
              >
                Tercihleri Kaydet
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
