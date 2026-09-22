import {
  useMemo,
  useState,
} from 'react';
import type { Field, Screen } from '../types';
import './ProducerMarketScreen.css';

export interface MarketListing {
  id: string;
  title: string;
  cropType: string;
  location: string;
  listingNumber: string;
  publishDate: string;
  status: 'active' | 'sold' | 'archived';
  amountKg: number;
  pricePerKg: number;
  deliveryType: string;
  harvestDate: string;
  grade: string;
  moisturePercent: number;
  description: string;
  images: string[];
  seller: {
    id: string;
    name: string;
    role: string;
    isVerified: boolean;
    rating: number;
    reviewCount: number;
    memberYears: number;
    successfulDeals: number;
  };
  stats: {
    views: number;
    favorites: number;
    messages: number;
    commentsCount: number;
  };
  marketAvgPrice: number;
}

export interface ListingComment {
  id: string;
  authorName: string;
  authorRole: 'buyer' | 'seller' | 'user';
  isSeller: boolean;
  timeAgo: string;
  text: string;
  usefulCount: number;
  isNew?: boolean;
  replies?: ListingComment[];
}

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface ProducerMarketScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type MarketTab =
  | 'discover'
  | 'myListings'
  | 'newListing'
  | 'messages'
  | 'favorites';

type IconName =
  | 'brand'
  | 'back'
  | 'menu'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'search'
  | 'list'
  | 'plus'
  | 'message'
  | 'heart'
  | 'pin'
  | 'weather'
  | 'bell'
  | 'camera'
  | 'phone'
  | 'verified'
  | 'star'
  | 'shield'
  | 'package'
  | 'eye'
  | 'comment'
  | 'share'
  | 'whatsapp'
  | 'link'
  | 'chart'
  | 'check'
  | 'edit'
  | 'closeCircle'
  | 'info'
  | 'flag'
  | 'thumb'
  | 'chevron'
  | 'close'
  | 'user';

const LISTING_IMAGES = [
  'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1400&q=84',
  'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=82',
];

const INITIAL_LISTING: MarketListing = {
  id: 'listing-corn-2026-0001245',
  title: 'Satılık Dane Mısır',
  cropType: 'Dane Mısır',
  location: 'Bafra / Samsun',
  listingNumber: '2026-0001245',
  publishDate: '18 Eylül 2026',
  status: 'active',
  amountKg: 24000,
  pricePerKg: 10.2,
  deliveryType: 'Depodan Teslim',
  harvestDate: '18 Eylül 2026',
  grade: '1. Sınıf',
  moisturePercent: 14,
  description:
    '2026 hasadı, kuru ve temiz dane mısır. Depoda korunaklı şekilde muhafaza edilmektedir. Ürün bilgileri ve varsa analiz sonuçları alıcıyla doğrudan paylaşılabilir.',
  images: LISTING_IMAGES,
  seller: {
    id: 'seller-mehmet-yilmaz',
    name: 'Mehmet Yılmaz',
    role: 'Üretici',
    isVerified: true,
    rating: 4.8,
    reviewCount: 23,
    memberYears: 3,
    successfulDeals: 12,
  },
  stats: {
    views: 186,
    favorites: 12,
    messages: 7,
    commentsCount: 5,
  },
  marketAvgPrice: 9.85,
};

const INITIAL_COMMENTS: ListingComment[] = [
  {
    id: 'comment-ali-kaya',
    authorName: 'Ali Kaya',
    authorRole: 'buyer',
    isSeller: false,
    timeAgo: '5 dakika önce',
    text:
      'Ürünün nem oranı belli mi? Analiz sonucunu paylaşabilir misiniz?',
    usefulCount: 1,
    isNew: true,
    replies: [
      {
        id: 'reply-mehmet',
        authorName: 'Mehmet Yılmaz',
        authorRole: 'seller',
        isSeller: true,
        timeAgo: '2 dakika önce',
        text:
          'Son ölçümde %14 civarındaydı. Analiz sonucunu ilan görsellerine ekledim, inceleyebilirsiniz.',
        usefulCount: 0,
      },
    ],
  },
  {
    id: 'comment-hasan-demir',
    authorName: 'Hasan Demir',
    authorRole: 'buyer',
    isSeller: false,
    timeAgo: '1 saat önce',
    text:
      'Depodan teslim mi, tarladan mı? Nakliye konusunda yardımcı oluyor musunuz?',
    usefulCount: 0,
    replies: [],
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
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'message':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5Z" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
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
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 7h4l2-3h4l2 3h4v12H4V7Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M6 3h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 2-2 3-4 3C9 20 4 15 3 7c0-2 1-4 3-4Z" />
        </svg>
      );
    case 'verified':
      return (
        <svg {...common}>
          <path d="m12 3 2 2.2 3-.3.8 2.9 2.7 1.4-1.2 2.8 1.2 2.8-2.7 1.4-.8 2.9-3-.3L12 21l-2-2.2-3 .3-.8-2.9-2.7-1.4L4.7 12 3.5 9.2l2.7-1.4.8-2.9 3 .3L12 3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.9-5.4 2.9 1-5.9-4.3-4.2 6-.9L12 3Z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'comment':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4V5Z" />
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
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M20 11.8a8 8 0 0 1-11.8 7L4 20l1.3-4A8 8 0 1 1 20 11.8Z" />
          <path d="M9 8c.6 3 2.2 4.7 5 5.6" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
          <path d="m13.5 6.5 3.5 3.5" />
        </svg>
      );
    case 'closeCircle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <path d="M5 21V4M5 5h11l-2 4 2 4H5" />
        </svg>
      );
    case 'thumb':
      return (
        <svg {...common}>
          <path d="M8 11 11 4c.7-1.5 3-1 3 .7V9h4a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H8V11ZM4 11h4v9H4z" />
        </svg>
      );
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'close':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
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
  if (label.includes('pazar')) return 'package';

  return 'chevron';
}

function numberTr(value: number, digits = 0) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function listingStatusLabel(status: MarketListing['status']) {
  if (status === 'active') return 'AKTİF';
  if (status === 'sold') return 'SATILDI';
  return 'ARŞİVLENDİ';
}

function roleLabel(comment: ListingComment) {
  if (comment.isSeller) return 'İLAN SAHİBİ';
  if (comment.authorRole === 'buyer') return 'ALICI';
  return 'KULLANICI';
}

export default function ProducerMarketScreen({
  fields,
  selectedFieldId = '',
  screen = 'producerMarketHub',
  desktopMenuItems = [],
  sideMenuOpen = false,
  setScreen,
  setSideMenuOpen = () => undefined,
}: ProducerMarketScreenProps) {
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

  const [listing, setListing] =
    useState<MarketListing>(INITIAL_LISTING);
  const [comments, setComments] =
    useState<ListingComment[]>(INITIAL_COMMENTS);
  const [activeMarketTab, setActiveMarketTab] =
    useState<MarketTab>('discover');
  const [selectedImage, setSelectedImage] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSort, setCommentSort] =
    useState<'newest' | 'useful'>('newest');
  const [commentNotifications, setCommentNotifications] =
    useState(true);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSent, setMessageSent] = useState('');
  const [amountModalOpen, setAmountModalOpen] = useState(false);
  const [amountDraft, setAmountDraft] = useState(
    String(INITIAL_LISTING.amountKg),
  );
  const [ownerMessage, setOwnerMessage] = useState('');

  const locationLabel =
    [selectedField?.city, selectedField?.district]
      .filter(Boolean)
      .join(' / ') || listing.location;

  const sortedComments = useMemo(() => {
    if (commentSort === 'useful') {
      return [...comments].sort(
        (a, b) => b.usefulCount - a.usefulCount,
      );
    }

    return comments;
  }, [comments, commentSort]);

  const totalComments = comments.reduce(
    (sum, comment) =>
      sum + 1 + (comment.replies?.length ?? 0),
    0,
  );

  const priceDifference =
    listing.pricePerKg - listing.marketAvgPrice;

  const sidebarItems = desktopMenuItems.filter(
    (item) => item.screen !== 'adminHub',
  );

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const toggleFavorite = () => {
    setFavorite((current) => {
      const next = !current;

      setListing((listingCurrent) => ({
        ...listingCurrent,
        stats: {
          ...listingCurrent.stats,
          favorites: Math.max(
            0,
            listingCurrent.stats.favorites +
              (next ? 1 : -1),
          ),
        },
      }));

      return next;
    });
  };

  const markUseful = (commentId: string) => {
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              usefulCount: comment.usefulCount + 1,
            }
          : comment,
      ),
    );
  };

  const addComment = () => {
    const text = commentText.trim();

    if (!text) return;

    const newComment: ListingComment = {
      id: `comment-${Date.now()}`,
      authorName: 'Siz',
      authorRole: 'user',
      isSeller: false,
      timeAgo: 'Şimdi',
      text,
      usefulCount: 0,
      isNew: true,
      replies: [],
    };

    setComments((current) => [newComment, ...current]);
    setListing((current) => ({
      ...current,
      stats: {
        ...current.stats,
        commentsCount: current.stats.commentsCount + 1,
      },
    }));
    setCommentText('');
  };

  const sendMessage = () => {
    const text = messageText.trim();

    if (!text) {
      setMessageSent('Mesaj yazmadan gönderemezsin.');
      return;
    }

    setListing((current) => ({
      ...current,
      stats: {
        ...current.stats,
        messages: current.stats.messages + 1,
      },
    }));
    setMessageSent('Mesaj satıcıya iletildi olarak kaydedildi.');
    setMessageText('');
  };

  const keepActive = () => {
    setListing((current) => ({
      ...current,
      status: 'active',
    }));
    setOwnerMessage(
      'İlan aktif olarak işaretlendi ve son durum yenilendi.',
    );
  };

  const closeListing = () => {
    setListing((current) => ({
      ...current,
      status: 'sold',
    }));
    setOwnerMessage(
      'İlan satıldı olarak işaretlendi. İstersen daha sonra tekrar aktif hale getirebilirsin.',
    );
  };

  const saveAmount = () => {
    const nextAmount = Number(
      amountDraft.replace(/\./g, '').replace(',', '.'),
    );

    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setOwnerMessage('Geçerli bir miktar gir.');
      return;
    }

    setListing((current) => ({
      ...current,
      amountKg: nextAmount,
    }));
    setAmountModalOpen(false);
    setOwnerMessage('İlan miktarı güncellendi.');
  };

  const shareListing = async () => {
    const shareText = `${listing.title} · ${numberTr(
      listing.pricePerKg,
      2,
    )} TL/kg · ${listing.location}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text: shareText,
        });
        return;
      }

      await navigator.clipboard?.writeText(shareText);
      setOwnerMessage('İlan bilgisi panoya kopyalandı.');
    } catch {
      setOwnerMessage('Paylaşım işlemi tamamlanamadı.');
    }
  };

  return (
    <div className="tp-producer-market-page">
      <aside className="tp-producer-market-sidebar">
        <div className="tp-producer-market-brand">
          <span>
            <Icon name="brand" size={21} />
          </span>
          <div>
            <strong>TarlaPusula</strong>
            <small>Akıllı üretici paneli</small>
          </div>
        </div>

        <nav className="tp-producer-market-global-nav">
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

        <div className="tp-producer-market-subnav">
          <small>ÜRETİCİ PAZARI</small>

          <button
            type="button"
            className={
              activeMarketTab === 'discover' ? 'active' : ''
            }
            onClick={() => setActiveMarketTab('discover')}
          >
            <Icon name="search" size={15} />
            <span>Keşfet</span>
          </button>

          <button
            type="button"
            className={
              activeMarketTab === 'myListings' ? 'active' : ''
            }
            onClick={() => setActiveMarketTab('myListings')}
          >
            <Icon name="list" size={15} />
            <span>İlanlarım</span>
          </button>

          <button
            type="button"
            className={
              activeMarketTab === 'newListing' ? 'active' : ''
            }
            onClick={() => setActiveMarketTab('newListing')}
          >
            <Icon name="plus" size={15} />
            <span>İlan Ver</span>
          </button>

          <button
            type="button"
            className={
              activeMarketTab === 'messages' ? 'active' : ''
            }
            onClick={() => setActiveMarketTab('messages')}
          >
            <Icon name="message" size={15} />
            <span>Mesajlar</span>
            <b>3</b>
          </button>

          <button
            type="button"
            className={
              activeMarketTab === 'favorites' ? 'active' : ''
            }
            onClick={() => setActiveMarketTab('favorites')}
          >
            <Icon name="heart" size={15} />
            <span>Favoriler</span>
          </button>
        </div>
      </aside>

      <div className="tp-producer-market-content">
        <header className="tp-producer-market-topbar">
          <button
            type="button"
            onClick={() => navigate('home')}
            aria-label="Ana sayfaya dön"
          >
            <Icon name="back" size={18} />
          </button>

          <div>
            <strong>Üretici Pazarı</strong>
            <small>İlan Detayı</small>
          </div>

          <button
            type="button"
            className="tp-producer-market-mobile-menu"
            onClick={() => setSideMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon name="menu" size={18} />
          </button>
        </header>

        <main className="tp-producer-market-main">
          <section className="tp-producer-market-header-row">
            <div className="tp-producer-market-breadcrumb">
              <button
                type="button"
                onClick={() => navigate('producerMarketHub')}
              >
                Üretici Pazarı
              </button>
              <Icon name="chevron" size={12} />
              <span>İlan Detayı</span>
            </div>

            <div className="tp-producer-market-widgets">
              <article>
                <Icon name="pin" size={16} />
                <div>
                  <small>KONUM</small>
                  <strong>{locationLabel}</strong>
                  <span>
                    Kayıtlı tarla konumu varsa öncelikli gösterilir
                  </span>
                </div>
              </article>

              <article>
                <Icon name="weather" size={16} />
                <div>
                  <small>HAVA</small>
                  <strong>Saha hava modülü</strong>
                  <span>
                    Teslim ve hasat planında birlikte değerlendirin
                  </span>
                </div>
              </article>

              <button
                type="button"
                onClick={() => setCommentNotifications((v) => !v)}
                aria-label="Bildirim tercihini değiştir"
              >
                <Icon name="bell" size={16} />
                <div>
                  <small>BİLDİRİMLER</small>
                  <strong>
                    {commentNotifications ? 'Açık' : 'Kapalı'}
                  </strong>
                  <span>İlan yorumu ve durum güncellemeleri</span>
                </div>
              </button>
            </div>
          </section>

          <section className="tp-producer-market-hero-grid">
            <article className="tp-producer-market-gallery">
              <div className="tp-producer-market-main-image">
                <img
                  src={listing.images[selectedImage]}
                  alt=""
                />

                <b className={`status ${listing.status}`}>
                  {listingStatusLabel(listing.status)}
                </b>

                <span className="photo-count">
                  <Icon name="camera" size={13} />
                  {selectedImage + 1}/{listing.images.length}
                </span>
              </div>

              <div className="tp-producer-market-thumbs">
                {listing.images.slice(0, 5).map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    className={
                      selectedImage === index ? 'active' : ''
                    }
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}

                {listing.images.length > 5 && (
                  <button
                    type="button"
                    className="more"
                    onClick={() =>
                      setSelectedImage(
                        Math.min(5, listing.images.length - 1),
                      )
                    }
                  >
                    +{listing.images.length - 5}
                  </button>
                )}
              </div>
            </article>

            <article className="tp-producer-market-listing-card">
              <div className="tp-producer-market-listing-head">
                <div>
                  <span>{listing.cropType}</span>
                  <h1>{listing.title}</h1>
                </div>

                <strong>
                  {numberTr(listing.pricePerKg, 2)}
                  <small> TL/kg</small>
                </strong>
              </div>

              <div className="tp-producer-market-meta">
                <span>
                  <Icon name="pin" size={13} />
                  {listing.location}
                </span>
                <span>İlan No: {listing.listingNumber}</span>
                <span>{listing.publishDate}</span>
              </div>

              <div className="tp-producer-market-feature-grid">
                <div>
                  <small>Miktar</small>
                  <strong>
                    {numberTr(listing.amountKg)} kg
                  </strong>
                </div>
                <div>
                  <small>Fiyat</small>
                  <strong>
                    {numberTr(listing.pricePerKg, 2)} TL/kg
                  </strong>
                </div>
                <div>
                  <small>Teslim Şekli</small>
                  <strong>{listing.deliveryType}</strong>
                </div>
                <div>
                  <small>Hasat Tarihi</small>
                  <strong>{listing.harvestDate}</strong>
                </div>
                <div>
                  <small>Ürün Sınıfı</small>
                  <strong>{listing.grade}</strong>
                </div>
                <div>
                  <small>Nem Oranı</small>
                  <strong>
                    %{numberTr(listing.moisturePercent)} ± 1
                  </strong>
                </div>
              </div>

              <div className="tp-producer-market-description">
                <span>AÇIKLAMA</span>
                <p>{listing.description}</p>
              </div>

              <div className="tp-producer-market-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setMessageSent('');
                    setMessageOpen(true);
                  }}
                >
                  <Icon name="message" size={15} />
                  Mesaj Gönder
                </button>

                <button
                  type="button"
                  onClick={() => setShowPhone((current) => !current)}
                >
                  <Icon name="phone" size={15} />
                  {showPhone
                    ? '+90 5•• ••• •• 24'
                    : 'Telefonu Göster'}
                </button>

                <button
                  type="button"
                  className={favorite ? 'favorited' : ''}
                  onClick={toggleFavorite}
                >
                  <Icon name="heart" size={15} />
                  {favorite ? 'Favorilerde' : 'Favoriye Ekle'}
                </button>
              </div>
            </article>

            <aside className="tp-producer-market-seller-card">
              <div className="tp-producer-market-profile">
                <div className="avatar">
                  <Icon name="user" size={27} />
                </div>

                <div>
                  <small>İLAN SAHİBİ</small>
                  <strong>{listing.seller.name}</strong>
                  <span>{listing.seller.role}</span>
                </div>
              </div>

              {listing.seller.isVerified && (
                <div className="tp-producer-market-verified">
                  <Icon name="verified" size={15} />
                  Doğrulanmış Profil
                </div>
              )}

              <div className="tp-producer-market-rating">
                <Icon name="star" size={15} />
                <strong>
                  {numberTr(listing.seller.rating, 1)}
                </strong>
                <span>
                  ({listing.seller.reviewCount} değerlendirme)
                </span>
              </div>

              <div className="tp-producer-market-trust-list">
                <div>
                  <Icon name="check" size={14} />
                  <span>Telefon doğrulandı</span>
                </div>
                <div>
                  <Icon name="check" size={14} />
                  <span>E-posta doğrulandı</span>
                </div>
                <div>
                  <Icon name="shield" size={14} />
                  <span>
                    {listing.seller.memberYears} yıldır üye
                  </span>
                </div>
                <div>
                  <Icon name="package" size={14} />
                  <span>
                    {listing.seller.successfulDeals} başarılı işlem
                  </span>
                </div>
              </div>

              <button type="button">
                Tüm İlanları Gör
                <Icon name="chevron" size={13} />
              </button>
            </aside>
          </section>

          <section className="tp-producer-market-body-grid">
            <article className="tp-producer-market-comments-card">
              <div className="tp-producer-market-comments-head">
                <div>
                  <span>YORUMLAR & SORU-CEVAP</span>
                  <h2>Yorumlar ({totalComments})</h2>
                </div>

                <div className="controls">
                  <select
                    value={commentSort}
                    onChange={(event) =>
                      setCommentSort(
                        event.target.value as
                          | 'newest'
                          | 'useful',
                      )
                    }
                  >
                    <option value="newest">En Yeniler</option>
                    <option value="useful">En Faydalı</option>
                  </select>

                  <label>
                    <span>Yeni yorumlardan haberdar ol</span>
                    <input
                      type="checkbox"
                      checked={commentNotifications}
                      onChange={() =>
                        setCommentNotifications(
                          (current) => !current,
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="tp-producer-market-comment-list">
                {sortedComments.map((comment) => (
                  <article
                    className="tp-producer-market-comment"
                    key={comment.id}
                  >
                    <div className="avatar">
                      <Icon name="user" size={18} />
                    </div>

                    <div className="content">
                      <div className="meta">
                        <strong>{comment.authorName}</strong>
                        <b
                          className={
                            comment.isSeller
                              ? 'seller'
                              : comment.authorRole === 'buyer'
                                ? 'buyer'
                                : 'user'
                          }
                        >
                          {roleLabel(comment)}
                        </b>
                        <span>{comment.timeAgo}</span>
                        {comment.isNew && <i>YENİ</i>}
                      </div>

                      <p>{comment.text}</p>

                      <div className="actions">
                        <button type="button">Yanıtla</button>
                        <button
                          type="button"
                          onClick={() =>
                            markUseful(comment.id)
                          }
                        >
                          <Icon name="thumb" size={13} />
                          Faydalı ({comment.usefulCount})
                        </button>
                        <button type="button">
                          <Icon name="flag" size={13} />
                          Şikayet Et
                        </button>
                      </div>

                      {comment.replies?.map((reply) => (
                        <article
                          className="tp-producer-market-reply"
                          key={reply.id}
                        >
                          <div className="avatar">
                            <Icon name="user" size={16} />
                          </div>

                          <div>
                            <div className="meta">
                              <strong>{reply.authorName}</strong>
                              <b className="seller">
                                İLAN SAHİBİ
                              </b>
                              <span>{reply.timeAgo}</span>
                            </div>
                            <p>{reply.text}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="tp-producer-market-comment-form">
                <div className="avatar">
                  <Icon name="user" size={18} />
                </div>

                <div>
                  <textarea
                    value={commentText}
                    onChange={(event) =>
                      setCommentText(event.target.value)
                    }
                    placeholder="Yorum yazın..."
                  />

                  <div>
                    <small>
                      Yorum yaparak Topluluk Kurallarını kabul etmiş
                      olursunuz.
                    </small>
                    <button
                      type="button"
                      onClick={addComment}
                    >
                      Gönder
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <aside className="tp-producer-market-info-column">
              <article className="tp-producer-market-stats-card">
                <span>BU İLAN HAKKINDA</span>
                <h2>İlan İstatistikleri</h2>

                <div className="tp-producer-market-stats-grid">
                  <div>
                    <Icon name="eye" size={16} />
                    <small>Görüntülenme</small>
                    <strong>{listing.stats.views}</strong>
                  </div>
                  <div>
                    <Icon name="heart" size={16} />
                    <small>Favori</small>
                    <strong>{listing.stats.favorites}</strong>
                  </div>
                  <div>
                    <Icon name="message" size={16} />
                    <small>Mesaj</small>
                    <strong>{listing.stats.messages}</strong>
                  </div>
                  <div>
                    <Icon name="comment" size={16} />
                    <small>Yorum</small>
                    <strong>{listing.stats.commentsCount}</strong>
                  </div>
                </div>

                <div className="tp-producer-market-share-row">
                  <small>İLANI PAYLAŞ</small>
                  <button
                    type="button"
                    onClick={shareListing}
                  >
                    <Icon name="whatsapp" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={shareListing}
                  >
                    <Icon name="link" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={shareListing}
                  >
                    <Icon name="share" size={15} />
                  </button>
                </div>
              </article>

              <article className="tp-producer-market-price-card">
                <span>PİYASA KIYASLAMASI</span>
                <h2>Dane Mısır Fiyatı</h2>

                <div>
                  <small>Borsa Ortalama Fiyatı</small>
                  <strong>
                    {numberTr(listing.marketAvgPrice, 2)} TL/kg
                  </strong>
                </div>

                <div>
                  <small>Sizin Fiyatınız</small>
                  <strong>
                    {numberTr(listing.pricePerKg, 2)} TL/kg
                  </strong>
                </div>

                <p
                  className={
                    priceDifference > 0 ? 'above' : 'below'
                  }
                >
                  {priceDifference > 0 ? '+' : ''}
                  {numberTr(priceDifference, 2)} TL/kg piyasa
                  ortalamasına göre fark
                </p>

                <button
                  type="button"
                  onClick={() => navigate('marketHub')}
                >
                  <Icon name="chart" size={14} />
                  Detaylı Piyasa Verileri
                </button>
              </article>
            </aside>

            <aside className="tp-producer-market-owner-column">
              <article className="tp-producer-market-owner-card">
                <div>
                  <span>AKILLI İLAN HATIRLATMASI</span>
                  <h2>İlanınız hâlâ güncel mi?</h2>
                </div>

                <p>
                  İlanınız 15 gündür aktif görünüyor. Ürününüz hâlâ
                  satışta mı?
                </p>

                <small>Son güncelleme: 18 Eylül 2026</small>

                <div className="actions">
                  <button
                    type="button"
                    className="keep"
                    onClick={keepActive}
                  >
                    <Icon name="check" size={14} />
                    Evet, Satışta
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAmountDraft(
                        String(listing.amountKg),
                      );
                      setAmountModalOpen(true);
                    }}
                  >
                    <Icon name="edit" size={14} />
                    Miktarı Güncelle
                  </button>

                  <button
                    type="button"
                    className="close-listing"
                    onClick={closeListing}
                  >
                    <Icon name="closeCircle" size={14} />
                    Satıldı, İlanı Kapat
                  </button>
                </div>

                {ownerMessage && (
                  <div className="tp-producer-market-owner-message">
                    {ownerMessage}
                  </div>
                )}
              </article>

              <article className="tp-producer-market-notifications-card">
                <span>İLAN BİLDİRİMLERİ</span>
                <h2>Son hareketler</h2>

                <div>
                  <article>
                    <Icon name="comment" size={15} />
                    <div>
                      <strong>İlanınıza yeni yorum geldi</strong>
                      <small>Ali K. · 5 dk önce</small>
                    </div>
                  </article>

                  <article>
                    <Icon name="eye" size={15} />
                    <div>
                      <strong>
                        İlanınız {listing.stats.views} kez görüntülendi
                      </strong>
                      <small>Bugün · 10:34</small>
                    </div>
                  </article>

                  <article>
                    <Icon name="chart" size={15} />
                    <div>
                      <strong>
                        Fiyatınızı güncellemek ister misiniz?
                      </strong>
                      <small>
                        Piyasa ortalaması:{' '}
                        {numberTr(
                          listing.marketAvgPrice,
                          2,
                        )}{' '}
                        TL/kg
                      </small>
                    </div>
                  </article>
                </div>

                <button type="button">
                  Tüm Bildirimleri Gör
                  <Icon name="chevron" size={13} />
                </button>
              </article>

              <article className="tp-producer-market-legal-card">
                <Icon name="info" size={17} />
                <div>
                  <strong>Önemli Bilgilendirme</strong>
                  <p>
                    TarlaPusula, ilan veren ve alıcı arasında
                    gerçekleştirilen satışın tarafı değildir. Ürün
                    miktarı, kalite, fiyat, teslim ve ödeme şartları
                    taraflar arasında kararlaştırılır.
                  </p>
                </div>
              </article>
            </aside>
          </section>

          <footer className="tp-producer-market-footer">
            <Icon name="shield" size={15} />
            <span>
              Bu ilan, TarlaPusula Topluluk Kuralları çerçevesinde
              yayınlanmaktadır.
            </span>
            <button type="button">Kullanım Koşulları</button>
          </footer>
        </main>
      </div>

      <nav className="tp-producer-market-bottom-nav">
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
          className="tp-producer-market-bottom-ai"
          onClick={() => navigate('aiAnalysis')}
        >
          <b><Icon name="ai" size={19} /></b>
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
        <div className="tp-producer-market-drawer-layer">
          <button
            type="button"
            className="tp-producer-market-drawer-backdrop"
            onClick={() => setSideMenuOpen(false)}
            aria-label="Menüyü kapat"
          />

          <aside className="tp-producer-market-drawer">
            <div className="tp-producer-market-drawer-head">
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

      {messageOpen && (
        <div className="tp-producer-market-modal-layer">
          <button
            type="button"
            className="tp-producer-market-modal-backdrop"
            onClick={() => setMessageOpen(false)}
            aria-label="Mesaj penceresini kapat"
          />

          <section
            className="tp-producer-market-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Satıcıya mesaj gönder"
          >
            <div className="tp-producer-market-modal-head">
              <div>
                <small>MESAJ GÖNDER</small>
                <h2>{listing.seller.name}</h2>
              </div>

              <button
                type="button"
                onClick={() => setMessageOpen(false)}
                aria-label="Kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <textarea
              value={messageText}
              onChange={(event) =>
                setMessageText(event.target.value)
              }
              placeholder="İlanla ilgili mesajınızı yazın..."
            />

            {messageSent && (
              <div className="tp-producer-market-modal-note">
                {messageSent}
              </div>
            )}

            <div className="tp-producer-market-modal-actions">
              <button
                type="button"
                onClick={() => setMessageOpen(false)}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="primary"
                onClick={sendMessage}
              >
                Gönder
              </button>
            </div>
          </section>
        </div>
      )}

      {amountModalOpen && (
        <div className="tp-producer-market-modal-layer">
          <button
            type="button"
            className="tp-producer-market-modal-backdrop"
            onClick={() => setAmountModalOpen(false)}
            aria-label="Miktar penceresini kapat"
          />

          <section
            className="tp-producer-market-modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="İlan miktarını güncelle"
          >
            <div className="tp-producer-market-modal-head">
              <div>
                <small>İLAN YÖNETİMİ</small>
                <h2>Miktarı Güncelle</h2>
              </div>

              <button
                type="button"
                onClick={() => setAmountModalOpen(false)}
                aria-label="Kapat"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <label className="tp-producer-market-modal-field">
              <span>Kalan miktar (kg)</span>
              <input
                inputMode="decimal"
                value={amountDraft}
                onChange={(event) =>
                  setAmountDraft(event.target.value)
                }
              />
            </label>

            <div className="tp-producer-market-modal-actions">
              <button
                type="button"
                onClick={() => setAmountModalOpen(false)}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="primary"
                onClick={saveAmount}
              >
                Kaydet
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
