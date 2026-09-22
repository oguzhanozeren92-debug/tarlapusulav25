import { useEffect, useMemo, useState } from 'react';
import { collectPusulaContext } from '../services/pusulaContextRegistry';
import {
  getOrCreatePusulaDailyBrief,
  getPusulaDailySection,
} from '../services/pusulaDailyBrief';
import type { Field, Screen } from '../types';
import {
  fetchMarketData,
  getFeaturedCropMarkets,
  getLatestRowsByKey,
  getFuelProvinceSummaries,
  type MarketCropPrice,
  type MarketData,
  type MarketFertilizerPrice,
  type MarketFuelPrice,
  type MarketLocation,
} from '../services/marketPricesService';
import './MarketPricesScreen.css';
import ClassicBottomNav from './ClassicBottomNav';

type Props = {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  setScreen?: (screen: Screen) => void;
};

type Tab = 'crop' | 'fuel' | 'fertilizer';


const MARKET_ICON_BASES = [
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/premium',
] as const;

const MARKET_ICON_FILES = {
  crop: '12-urun-fiyatlari.webp',
  fuel: '13-mazot-fiyatlari.webp',
  fertilizer: '14-gubre-fiyatlari.webp',
  exchange: '12-urun-fiyatlari.webp',
  alarm: '15-fiyat-alarmi.webp',
  analysis: '16-piyasa-analizi.webp',
} as const;

const MARKET_ICON_FALLBACKS = {
  crop: 'crop',
  fuel: 'fuel',
  fertilizer: 'fertilizer',
  exchange: 'trend',
  alarm: 'bell',
  analysis: 'trend',
} as const;

function MarketImageIcon({
  name,
  size = 28,
  className = '',
}: {
  name: keyof typeof MARKET_ICON_FILES;
  size?: number;
  className?: string;
}) {
  const [sourceIndex, setSourceIndex] = useState(0);

  if (sourceIndex >= MARKET_ICON_BASES.length) {
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        <Icon
          name={MARKET_ICON_FALLBACKS[name]}
          size={Math.max(16, Math.round(size * 0.72))}
        />
      </span>
    );
  }

  return (
    <img
      src={`${MARKET_ICON_BASES[sourceIndex]}/${MARKET_ICON_FILES[name]}`}
      alt=""
      aria-hidden="true"
      crossOrigin="anonymous"
      className={className}
      onError={() => setSourceIndex((current) => current + 1)}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flex: '0 0 auto',
        display: 'block',
      }}
    />
  );
}

const TURKISH_PRODUCT_WORD_FIXES: Array<[RegExp, string]> = [
  [/\bBUGDAY\b/g, 'BUĞDAY'],
  [/\bYEMLIK\b/g, 'YEMLİK'],
  [/\bYAGLIK\b/g, 'YAĞLIK'],
  [/\bCEREZLIK\b/g, 'ÇEREZLİK'],
  [/\bAYCICEGI\b/g, 'AYÇİÇEĞİ'],
  [/\bFISTIGI\b/g, 'FISTIĞI'],
  [/\bKOFTELIK\b/g, 'KÖFTELİK'],
  [/\bNATUREL\b/g, 'NATÜREL'],
  [/\bUZUM\b/g, 'ÜZÜM'],
  [/\bCAVDAR\b/g, 'ÇAVDAR'],
  [/\bSEFTALI\b/g, 'ŞEFTALİ'],
  [/\bCEKIRDEK\b/g, 'ÇEKİRDEK'],
  [/\bSEKER\b/g, 'ŞEKER'],
  [/\bIC\b/g, 'İÇ'],
];

const repairTurkishEncoding = (value: unknown) =>
  String(value ?? '')
    /* Kaynakta bozuk tek-karakter kodlamaları farklı byte varyantlarıyla gelebiliyor.
       Kelime kalıbını onar; doğru yazılmış hâli de aynı doğru sonuca gider. */
    .replace(/bu.day/gi, 'BUĞDAY')
    .replace(/ya.l.k/gi, 'YAĞLIK')
    .replace(/f.st..i/gi, 'FISTIĞI')
    .replace(/ay.i.e.i/gi, 'AYÇİÇEĞİ')
    .replace(/.erezlik/gi, 'ÇEREZLİK')
    .replace(/k.ftelik/gi, 'KÖFTELİK')
    .replace(/nat.rel/gi, 'NATÜREL')
    .replace(/.z.m/gi, 'ÜZÜM')
    .replace(/.avdar/gi, 'ÇAVDAR')
    .replace(/.eftali/gi, 'ŞEFTALİ')
    .replace(/.ekirdek/gi, 'ÇEKİRDEK')
    .replace(/.eker/gi, 'ŞEKER')
    .replace(/Äž/g, 'Ğ')
    .replace(/ÄŸ/g, 'ğ')
    .replace(/Ä°/g, 'İ')
    .replace(/Ä±/g, 'ı')
    .replace(/Åž/g, 'Ş')
    .replace(/ÅŸ/g, 'ş')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ã§/g, 'ç');

const formatCropName = (value: unknown) => {
  let text = repairTurkishEncoding(value)
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  text = text.toLocaleUpperCase('tr-TR');
  TURKISH_PRODUCT_WORD_FIXES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/\(\s*(\d+)\s*\.\s*DERECE\s*\)/g, '($1. DERECE)')
    .replace(/\s+([),])/g, '$1')
    .replace(/([(/-])\s+/g, '$1')
    .replace(/�/g, '');

  const lower = text.toLocaleLowerCase('tr-TR');
  return lower.replace(
    /(^|[\s(/-])([a-zçğıöşü])/g,
    (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('tr-TR')}`,
  );
};

const formatMarketLabel = (value: unknown) => {
  const text = repairTurkishEncoding(value)
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/�/g, '')
    .trim();

  if (!text) return '';

  const lower = text.toLocaleLowerCase('tr-TR');
  return lower.replace(
    /(^|[\s(/-])([a-zçğıöşü])/g,
    (_match: string, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('tr-TR')}`,
  );
};

const normalize = (value: unknown) =>
  formatCropName(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const TURKISH_CROP_COLLATOR = new Intl.Collator('tr-TR', {
  sensitivity: 'base',
  numeric: true,
});

const cropNameOf = (field: Field) =>
  String(
    (field as any).crop ??
      (field as any).cropName ??
      (field as any).product ??
      '',
  ).trim();

const fieldLocation = (field?: Field | null): MarketLocation => {
  if (!field) {
    return {
      label: 'Türkiye Geneli',
    };
  }

  const city = String((field as any).city ?? '').trim();
  const district = String((field as any).district ?? '').trim();

  const latitude = Number(
    (field as any).parcelCentroidLat ??
      (field as any).latitude ??
      (field as any).lat ??
      NaN,
  );

  const longitude = Number(
    (field as any).parcelCentroidLng ??
      (field as any).longitude ??
      (field as any).lng ??
      NaN,
  );

  return {
    city: city || undefined,
    district: district || undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    label:
      [city, district].filter(Boolean).join(' / ') ||
      String((field as any).name ?? 'Türkiye Geneli'),
  };
};

const formatPrice = (value?: number | null, digits = 2) => {
  if (!Number.isFinite(Number(value))) return '—';

  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
};

const formatCropPriceUnit = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'TL/kg';

  const normalized = raw
    .toLocaleLowerCase('tr-TR')
    .replace(/₺/g, 'tl')
    .replace(/\s+/g, '')
    .replace(/litre|liter/g, 'l');

  if (normalized === 'kg' || normalized === 'tl/kg' || normalized === 'tlkg') {
    return 'TL/kg';
  }

  if (
    normalized === 'ton' ||
    normalized === 'tonne' ||
    normalized === 'tl/ton' ||
    normalized === 'tlton'
  ) {
    return 'TL/ton';
  }

  if (normalized === 'l' || normalized === 'lt' || normalized === 'tl/l' || normalized === 'tll') {
    return 'TL/L';
  }

  return raw;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Tarih yok';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const ageDays = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
  );
};

const dateBadge = (value?: string | null) => {
  const days = ageDays(value);

  if (days === null) return { text: 'Tarih yok', tone: 'old' };
  if (days <= 7) return { text: 'Güncel kayıt', tone: 'fresh' };
  if (days <= 30) return { text: 'Yakın tarihli', tone: 'recent' };

  return { text: 'Son kayıt', tone: 'old' };
};

function Icon({
  name,
  size = 18,
}: {
  name:
    | 'crop'
    | 'fuel'
    | 'fertilizer'
    | 'bell'
    | 'pin'
    | 'trend'
    | 'refresh'
    | 'source'
    | 'chevron'
    | 'info';
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
    case 'crop':
      return (
        <svg {...common}>
          <path d="M12 21V7" />
          <path d="M12 12c-4 0-6-2-7-5 4 0 6 2 7 5Z" />
          <path d="M12 9c3.7 0 5.7-1.8 7-5-3.8 0-5.8 1.8-7 5Z" />
          <path d="M6 21h12" />
        </svg>
      );
    case 'fuel':
      return (
        <svg {...common}>
          <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
          <path d="M4 21h13" />
          <path d="M8 7h5v4H8z" />
          <path d="M16 8h2l2 2v7a2 2 0 0 1-4 0v-3" />
        </svg>
      );
    case 'fertilizer':
      return (
        <svg {...common}>
          <path d="M7 5h10l2 4-2 12H7L5 9l2-4Z" />
          <path d="M9 5V3h6v2" />
          <path d="M12 17v-6" />
          <path d="M12 13c-2.5 0-4-1.2-4.7-3.4 2.5 0 4 1.1 4.7 3.4Z" />
          <path d="M12 11c2.3 0 3.8-1 4.7-3.1-2.4 0-3.9 1-4.7 3.1Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'trend':
      return (
        <svg {...common}>
          <path d="M4 18 10 12l4 4 6-8" />
          <path d="M15 8h5v5" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6.1 9a7 7 0 0 1 11.5-2L20 12M4 12l2.4 5a7 7 0 0 0 11.5-2" />
        </svg>
      );
    case 'source':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
  }
}

function MiniTrend({
  rows,
  unit,
}: {
  rows: Array<{ date: string; price: number }>;
  unit: string;
}) {
  const data = [...rows]
    .filter((item) => Number.isFinite(Number(item.price)))
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  if (data.length < 2) {
    return (
      <div className="tp-market-mini-chart empty">
        <span>Trend için yeterli geçmiş kayıt yok</span>
      </div>
    );
  }

  const width = 260;
  const height = 86;
  const pad = 7;

  const prices = data.map((item) => Number(item.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(0.0001, max - min);

  const points = data
    .map((item, index) => {
      const x =
        pad +
        (index / Math.max(1, data.length - 1)) * (width - pad * 2);
      const y =
        height -
        pad -
        ((Number(item.price) - min) / range) * (height - pad * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = first ? ((last - first) / first) * 100 : 0;

  return (
    <div className="tp-market-mini-chart">
      <div className="tp-market-mini-chart-head">
        <span>{formatPrice(last)} {unit}</span>
        <strong className={change >= 0 ? 'up' : 'down'}>
          {change >= 0 ? '▲' : '▼'} %{formatPrice(Math.abs(change), 2)}
        </strong>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
    </div>
  );
}

export default function MarketPricesScreen({
  fields,
  selectedFieldId = '',
  screen = 'marketHub',
}: Props) {
  const realFields = useMemo(
    () => fields.filter((field) => !(field as any).demo),
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

  const location = useMemo(
    () => fieldLocation(selectedField),
    [selectedField],
  );

  const fieldCrops = useMemo(
    () =>
      Array.from(
        new Set(
          realFields
            .map(cropNameOf)
            .map(formatCropName)
            .filter(Boolean),
        ),
      ),
    [realFields],
  );

  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('crop');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [alarmProduct, setAlarmProduct] = useState('');
  const [alarmTarget, setAlarmTarget] = useState('');
  const [alarmMessage, setAlarmMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await fetchMarketData(location);
      setData(result);

      if (result.dataSource === 'unavailable') {
        setMessage(
          'Güvenilir piyasa verisi henüz bağlı değil. TarlaPusula örnek fiyat üretmez; gerçek kaynak kaydı geldiğinde bu ekran otomatik dolar.',
        );
      }
    } catch (error) {
      setData(null);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Piyasa verileri alınamadı.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    location.city,
    location.district,
    location.latitude,
    location.longitude,
  ]);

  const cropOptions = useMemo(() => {
    /*
     * Dropdown yalnızca gerçek piyasa kaydı bulunan ürünlerden oluşur.
     * Tarladaki ürün fiyat kaydı yoksa listeye eklenmez.
     */
    const fromMarket =
      data?.cropPrices
        .map((row) => formatCropName(row.product))
        .filter(Boolean) ?? [];

    return Array.from(new Set(fromMarket)).sort((a, b) =>
      TURKISH_CROP_COLLATOR.compare(a, b),
    );
  }, [data]);

  useEffect(() => {
    if (selectedCrop) return;

    const preferred =
      fieldCrops.find((crop) =>
        cropOptions.some(
          (option) => normalize(option) === normalize(crop),
        ),
      ) ??
      cropOptions[0] ??
      '';

    setSelectedCrop(preferred);
    setAlarmProduct(preferred);
  }, [cropOptions, fieldCrops, selectedCrop]);

  const cropRows = useMemo(
    () =>
      (data?.cropPrices ?? []).filter(
        (row) => normalize(row.product) === normalize(selectedCrop),
      ),
    [data, selectedCrop],
  );

  const latestMarketRows = useMemo(
    () => getLatestRowsByKey(cropRows, (row) => row.marketName),
    [cropRows],
  );

  const featuredMarkets = useMemo(() => {
    const raw = getFeaturedCropMarkets(
      latestMarketRows,
      location,
      selectedCrop,
    );

    const unique = new Map<string, MarketCropPrice>();

    raw.forEach((row) => {
      const marketName = formatMarketLabel(row.marketName || row.city || '');
      const city = formatMarketLabel(row.city || '');
      const key = [
        normalize(marketName || city),
        normalize(city),
      ].join('|');

      if (unique.has(key)) return;

      unique.set(key, {
        ...row,
        marketName: marketName || city || row.marketName,
        city: city || row.city,
      });
    });

    return Array.from(unique.values()).slice(0, 3);
  }, [latestMarketRows, location, selectedCrop]);

  const fuelSummaries = useMemo(
    () => getFuelProvinceSummaries(data?.fuelPrices ?? []),
    [data],
  );

  const fertilizerRowsLatest = useMemo(
    () =>
      getLatestRowsByKey(
        data?.fertilizerPrices ?? [],
        (row) => row.product,
      ),
    [data],
  );

  const latestFuelSummary =
    fuelSummaries.find(
      (row) =>
        location.city &&
        normalize(row.city) === normalize(location.city),
    ) ??
    fuelSummaries[0] ??
    null;

  const fuelHistory = useMemo(() => {
    if (!latestFuelSummary) return [];

    const grouped = new Map<string, number[]>();

    for (const row of data?.fuelPrices ?? []) {
      if (normalize(row.city) !== normalize(latestFuelSummary.city)) continue;
      const day = row.date.slice(0, 10);
      if (!day) continue;
      const bucket = grouped.get(day) ?? [];
      bucket.push(row.price);
      grouped.set(day, bucket);
    }

    return Array.from(grouped.entries())
      .map(([date, prices]) => ({
        date,
        price: prices.reduce((sum, value) => sum + value, 0) / prices.length,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, latestFuelSummary]);

  const fuelHistory7 = fuelHistory.slice(-7);
  const fuelHistory30 = fuelHistory.slice(-30);

  const selectedCropLatestDate = featuredMarkets
    .map((row) => row.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const selectedCropBadge = dateBadge(selectedCropLatestDate);

  const latestCropAverage =
    featuredMarkets.length > 0
      ? featuredMarkets.reduce(
          (sum, row) => sum + row.avgPrice,
          0,
        ) / featuredMarkets.length
      : null;

  const selectedCropSourceNames = Array.from(
    new Set(featuredMarkets.map((row) => row.sourceName).filter(Boolean)),
  );

  useEffect(() => {
    if (loading || !data || !selectedField?.id) return;

    let cancelled = false;

    const runPusula = async () => {
      const localDate =
        new Date().toLocaleDateString('en-CA');

      try {
        const marketSnapshot = {
          selectedCrop,
          crop: {
            latestRecordedDate:
              selectedCropLatestDate ?? null,
            averagePrice: latestCropAverage,
            featuredMarkets,
            sources: selectedCropSourceNames,
          },
          fuel: {
            location: location.label,
            latestFuelSummary,
            history7: fuelHistory7,
            history30: fuelHistory30,
            nearbyProvinceSummaries:
              fuelSummaries.slice(0, 5),
          },
          fertilizer: {
            rows: fertilizerRowsLatest,
          },
        };

        const context =
          await collectPusulaContext({
            focus: {
              module: 'market',
              screen: 'marketHub',
              title: 'Piyasa Fiyatları',
              data: marketSnapshot,
            },
            field: {
              id: String(selectedField.id),
              name: String(
                (selectedField as any).name ?? '',
              ),
              crop:
                cropNameOf(selectedField) || null,
              city:
                String(
                  (selectedField as any).city ?? '',
                ) || null,
              district:
                String(
                  (selectedField as any).district ?? '',
                ) || null,
            },
          });

        const supporting =
          (context as any)?.supportingContext ?? {};

        const response =
          await getOrCreatePusulaDailyBrief({
            field: {
              id: String(selectedField.id),
              name: String(
                (selectedField as any).name ?? '',
              ),
              crop:
                cropNameOf(selectedField) || null,
              city:
                String(
                  (selectedField as any).city ?? '',
                ) || null,
              district:
                String(
                  (selectedField as any).district ?? '',
                ) || null,
            },
            snapshot: {
              appDate: localDate,
              market: marketSnapshot,
              weather:
                supporting.weather ?? null,
              soil:
                supporting.soil ?? null,
              inventory:
                supporting.inventory ?? null,
              calendar:
                supporting.calendar ?? null,
              satellite:
                supporting.satellite ??
                supporting.map ??
                null,
            },
            forceRefresh: false,
            triggerReason: 'daily',
          });

        if (cancelled) return;

        // Pending/fallback/error durumunda Piyasa ekranı hiçbir ekstra
        // Pusula mesajı üretmez. GlobalPusulaBand bütün ekranlarda
        // aynı tek-seferlik yükleme/rehber davranışını yönetir.
        if (
          response.pending ||
          response.usedFallback ||
          response.brief?.status === 'fallback' ||
          response.brief?.status === 'generating'
        ) {
          return;
        }

        const section =
          getPusulaDailySection(
            response.brief,
            'market',
          );

        if (
          !section ||
          !section.headline ||
          !section.summary
        ) {
          return;
        }

        const confidence =
          section.confidence === 'yuksek'
            ? 'Yüksek'
            : section.confidence === 'dusuk'
              ? 'Düşük'
              : 'Orta';

        const guideText = [
          section.headline,
          section.summary,
        ]
          .filter(Boolean)
          .join('. ')
          .replace(/\.\s*\./g, '.');

        const reasonText =
          Array.isArray(section.reasons)
            ? section.reasons
                .slice(0, 2)
                .filter(Boolean)
                .join(' · ')
            : '';

        const globalDetail = {
          screen: String(
            screen || 'marketHub',
          ),
          fieldName: String(
            (selectedField as any).name ?? '',
          ),
          fieldId:
            String(selectedField.id),
          crop:
            cropNameOf(selectedField),
          autoEligible: true,
          insight: {
            id: `daily-market-${
              response.brief?.id || localDate
            }`,
            gozlem: guideText,
            yonlendirme:
              reasonText || undefined,
            guven_skoru: confidence,
          },
        };

        try {
          window.sessionStorage.setItem(
            `tp_pusula_screen_insight_${String(
              screen || 'marketHub',
            )}`,
            JSON.stringify(globalDetail),
          );
        } catch {
          // Canlı event yeterli.
        }

        // Sadece gerçek günlük yorum hazır olduğunda event gönder.
        window.dispatchEvent(
          new CustomEvent(
            'tp-pusula-insight',
            {
              detail: globalDetail,
            },
          ),
        );
      } catch (error) {
        console.error(
          'Pusula günlük piyasa brief hatası:',
          error,
        );
        // Kullanıcıya modüle özel hata/rehber mesajı gönderme.
      }
    };

    void runPusula();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    data,
    loading,
    selectedCrop,
    selectedField?.id,
    screen,
  ]);

  const saveAlarm = () => {
    const target = Number(alarmTarget.replace(',', '.'));

    if (!alarmProduct) {
      setAlarmMessage('Önce takip edilecek ürünü seç.');
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      setAlarmMessage('Geçerli bir hedef fiyat gir.');
      return;
    }

    try {
      const raw =
        window.localStorage.getItem('tp_market_price_alarms_v3') ?? '[]';
      const current = JSON.parse(raw);
      const next = Array.isArray(current) ? current : [];

      next.unshift({
        id: `market-alarm-${Date.now()}`,
        product: alarmProduct,
        targetPrice: target,
        createdAt: new Date().toISOString(),
      });

      window.localStorage.setItem(
        'tp_market_price_alarms_v3',
        JSON.stringify(next),
      );

      setAlarmMessage('Fiyat alarmı kaydedildi.');
    } catch {
      setAlarmMessage('Fiyat alarmı kaydedilemedi.');
    }
  };

  return (
    <div className="tp-market-ref-page">
      <main className="tp-market-ref-main">
        <section className="tp-market-ref-heading">
          <div>
            <span>PİYASA MERKEZİ</span>
            <h1>Piyasa Fiyatları</h1>
            <p>
              Bitkisel ürün, mazot ve gübre piyasasının en son kayıtlı
              fiyatlarını takip et.
            </p>
          </div>

          <div className="tp-market-ref-heading-actions">
            <div className="tp-market-ref-location">
              <Icon name="pin" size={15} />
              <span>
                <small>KONUM</small>
                <strong>{location.label}</strong>
              </span>
            </div>

            <button type="button" onClick={() => void load()}>
              <Icon name="refresh" size={15} />
              Yenile
            </button>

            <button
              type="button"
              className="alarm"
              onClick={() => {
                setAlarmMessage('');
                setAlarmOpen(true);
              }}
            >
              <MarketImageIcon name="alarm" size={26} />
              Fiyat Alarmı
            </button>
          </div>
        </section>

        <section className="tp-market-ref-tabs">
          <button
            type="button"
            className={activeTab === 'crop' ? 'active' : ''}
            onClick={() => setActiveTab('crop')}
          >
            <MarketImageIcon name="crop" size={30} />
            Ürün Fiyatları
          </button>
          <button
            type="button"
            className={activeTab === 'fuel' ? 'active' : ''}
            onClick={() => setActiveTab('fuel')}
          >
            <MarketImageIcon name="fuel" size={30} />
            Mazot Fiyatları
          </button>
          <button
            type="button"
            className={activeTab === 'fertilizer' ? 'active' : ''}
            onClick={() => setActiveTab('fertilizer')}
          >
            <MarketImageIcon name="fertilizer" size={30} />
            Gübre Fiyatları
          </button>

          <div className="tp-market-ref-source-state">
            <span
              className={
                data?.dataSource === 'supabase'
                  ? 'live'
                  : 'offline'
              }
            />
            {data?.dataSource === 'supabase'
              ? 'Gerçek veri kaynağı'
              : 'Kaynak bekleniyor'}
          </div>
        </section>

        {activeTab === 'crop' && (
          <>
            <section className="tp-market-ref-top-grid">
              <article className="tp-market-ref-card crop-card">
                <header className="tp-market-ref-card-head">
                  <div>
                    <span>YAKIN / REFERANS TİCARET BORSALARI</span>
                    <h2>
                      {selectedCrop || 'Ürün'} · En Son Kayıtlı Fiyat
                    </h2>
                  </div>

                  <select
                    value={selectedCrop}
                    onChange={(event) => {
                      setSelectedCrop(event.target.value);
                      setAlarmProduct(event.target.value);
                    }}
                  >
                    {!cropOptions.length && (
                      <option value="">Ürün kaydı yok</option>
                    )}
                    {cropOptions.map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                </header>

                <div className="tp-market-ref-date-banner">
                  <div>
                    <span
                      className={`tp-market-ref-date-dot ${selectedCropBadge.tone}`}
                    />
                    <strong>{selectedCropBadge.text}</strong>
                  </div>
                  <p>
                    Bu tablo “şu anki fiyatı” değil, her borsada bulunan
                    <b> en son kayıtlı fiyatı </b>
                    gösterir.
                  </p>
                </div>

                {loading ? (
                  <div className="tp-market-ref-loading">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : featuredMarkets.length > 0 ? (
                  <div className="tp-market-ref-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Borsa</th>
                          <th>En Düşük</th>
                          <th>Ortalama</th>
                          <th>En Yüksek</th>
                          <th>Son Kayıt</th>
                          <th>Kaynak</th>
                        </tr>
                      </thead>

                      <tbody>
                        {featuredMarkets.map((row, index) => (
                          <tr key={row.id}>
                            <td>
                              <div className="tp-market-ref-market-name">
                                <MarketImageIcon name="exchange" size={34} />
                                <b>{index + 1}</b>
                                <span>
                                  <strong>{formatMarketLabel(row.marketName)}</strong>
                                  <small>
                                    {index === 0
                                      ? 'En yakın'
                                      : index === 1
                                        ? '2. en yakın'
                                        : 'Referans borsa'}
                                    {row.distanceKm < 9999
                                      ? ` · ${formatPrice(
                                          row.distanceKm,
                                          0,
                                        )} km`
                                      : ''}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>
                              {formatPrice(row.minPrice)} {formatCropPriceUnit(row.unit)}
                            </td>
                            <td className="average">
                              {formatPrice(row.avgPrice)} {formatCropPriceUnit(row.unit)}
                            </td>
                            <td>
                              {formatPrice(row.maxPrice)} {formatCropPriceUnit(row.unit)}
                            </td>
                            <td>
                              <strong>{formatDate(row.date)}</strong>
                              <small
                                className={`tp-market-ref-age ${dateBadge(row.date).tone}`}
                              >
                                {dateBadge(row.date).text}
                              </small>
                            </td>
                            <td>
                              <span className="tp-market-ref-source">
                                {row.sourceName}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="tp-market-ref-empty">
                    <MarketImageIcon name="crop" size={46} />
                    <div>
                      <h3>Bu ürün için piyasa kaydı bulunamadı</h3>
                      <p>
                        TarlaPusula fiyat uydurmaz. Ticaret borsası kaydı
                        geldiğinde en yakın iki borsa ve bir referans borsa
                        burada gösterilecek.
                      </p>
                    </div>
                  </div>
                )}

                <footer className="tp-market-ref-crop-footer">
                  <div>
                    <small>3 Borsa Ortalaması</small>
                    <strong>
                      {latestCropAverage == null
                        ? '—'
                        : `${formatPrice(latestCropAverage)} ${
                            formatCropPriceUnit(featuredMarkets[0]?.unit)
                          }`}
                    </strong>
                  </div>

                  <div>
                    <small>En Son Kayıt Tarihi</small>
                    <strong>{formatDate(selectedCropLatestDate)}</strong>
                  </div>

                  <div>
                    <small>Kaynaklar</small>
                    <strong>
                      {selectedCropSourceNames.length
                        ? selectedCropSourceNames.join(' · ')
                        : '—'}
                    </strong>
                  </div>
                </footer>
              </article>

              <article className="tp-market-ref-card fuel-preview">
                <header className="tp-market-ref-card-head">
                  <div>
                    <span>MAZOT / MOTORİN</span>
                    <h2>
                      {latestFuelSummary?.city || location.city || 'Türkiye'} · En Son Kayıtlı Motorin
                    </h2>
                  </div>

                  <div className="tp-market-ref-fuel-tools">
                    <button
                      type="button"
                      className="tp-market-ref-fuel-refresh"
                      onClick={() => void load()}
                      disabled={loading}
                      aria-label="Mazot verisini güncelle"
                      title="Mazot verisini yeniden kontrol et"
                    >
                      <Icon name="refresh" size={13} />
                      {loading ? 'Güncelleniyor' : 'Güncelle'}
                    </button>

                    <div className="tp-market-ref-big-price">
                      <strong>
                        {latestFuelSummary
                          ? formatPrice(latestFuelSummary.averagePrice)
                          : '—'}
                      </strong>
                      <span>{latestFuelSummary?.unit ?? 'TL/L'} · ortalama</span>
                      <small>{formatDate(latestFuelSummary?.date)}</small>
                    </div>
                  </div>
                </header>

                <div className="tp-market-ref-trend-grid">
                  <div>
                    <header>
                      <span>7 Kayıtlık Eğilim</span>
                    </header>
                    <MiniTrend
                      rows={fuelHistory7}
                      unit={latestFuelSummary?.unit ?? 'TL/L'}
                    />
                  </div>

                  <div>
                    <header>
                      <span>30 Kayıtlık Eğilim</span>
                    </header>
                    <MiniTrend
                      rows={fuelHistory30}
                      unit={latestFuelSummary?.unit ?? 'TL/L'}
                    />
                  </div>
                </div>

                <div className="tp-market-ref-nearby">
                  <span>YAKIN İLLER · SON KAYITLI MOTORİN</span>

                  <div>
                    {fuelSummaries.slice(0, 5).map((row) => (
                      <article key={`${row.city}-${row.date}`}>
                        <strong>{row.city}</strong>
                        <span>
                          {formatPrice(row.averagePrice)} {row.unit}
                        </span>
                        <small>{formatDate(row.date)} · {row.brandCount} marka</small>
                      </article>
                    ))}
                  </div>
                </div>
              </article>
            </section>

            <section className="tp-market-ref-bottom-grid">
              <article className="tp-market-ref-card fertilizer-preview">
                <header className="tp-market-ref-card-head">
                  <div>
                    <span>GÜBRE PİYASASI</span>
                    <h2>Gübre Fiyatları · En Son Kayıtlar</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('fertilizer')}
                  >
                    Tümünü Gör
                    <Icon name="chevron" size={13} />
                  </button>
                </header>

                {fertilizerRowsLatest.length > 0 ? (
                  <div className="tp-market-ref-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Gübre</th>
                          <th>Ortalama</th>
                          <th>Birim</th>
                          <th>Son Kayıt</th>
                          <th>Kaynak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fertilizerRowsLatest
                          .slice(0, 6)
                          .map((row) => (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.product}</strong>
                              </td>
                              <td className="average">
                                {formatPrice(row.avgPrice)}
                              </td>
                              <td>{row.unit}</td>
                              <td>{formatDate(row.date)}</td>
                              <td>
                                <span className="tp-market-ref-source">
                                  {row.sourceName}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="tp-market-ref-inline-empty">
                    Gübre fiyat kaynağı bağlandığında en son kayıtlar burada
                    görünecek.
                  </div>
                )}
              </article>

              <aside className="tp-market-ref-side-stack">
                <article>
                  <span>VERİ NOTU</span>
                  <Icon name="info" size={20} />
                  <strong>Fiyat tarihi her zaman görünür</strong>
                  <p>
                    Sezon dışında eski kayıt görüntülenebilir. Bu nedenle hiçbir
                    veri “bugünkü fiyat” olarak etiketlenmez.
                  </p>
                </article>

                <article>
                  <span>FİYAT ALARMI</span>
                  <MarketImageIcon name="alarm" size={40} />
                  <strong>Ürünü takip et</strong>
                  <p>
                    Belirlediğin hedef fiyat için kayıt oluştur.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAlarmMessage('');
                      setAlarmOpen(true);
                    }}
                  >
                    Alarm Ayarla
                  </button>
                </article>
              </aside>
            </section>
          </>
        )}

        {activeTab === 'fuel' && (
          <section className="tp-market-ref-card full-page-card">
            <header className="tp-market-ref-card-head">
              <div>
                <span>MAZOT / MOTORİN</span>
                <h2>Bölgesel En Son Kayıtlı Fiyatlar</h2>
              </div>
            </header>

            {fuelSummaries.length > 0 ? (
              <div className="tp-market-ref-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>İl</th>
                      <th>En Düşük</th>
                      <th>Ortalama</th>
                      <th>En Yüksek</th>
                      <th>Marka</th>
                      <th>Son Kayıt</th>
                      <th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelSummaries.map((row) => (
                      <tr key={`${row.city}-${row.date}`}>
                        <td><strong>{row.city}</strong></td>
                        <td>{formatPrice(row.minPrice)} {row.unit}</td>
                        <td className="average">{formatPrice(row.averagePrice)} {row.unit}</td>
                        <td>{formatPrice(row.maxPrice)} {row.unit}</td>
                        <td>{row.brandCount}</td>
                        <td>
                          {formatDate(row.date)}
                          <small className={`tp-market-ref-age ${dateBadge(row.date).tone}`}>
                            {dateBadge(row.date).text}
                          </small>
                        </td>
                        <td>
                          <span className="tp-market-ref-source">{row.sourceName}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tp-market-ref-empty">
                <MarketImageIcon name="fuel" size={46} />
                <div>
                  <h3>Mazot fiyat kaydı bulunamadı</h3>
                  <p>Gerçek kaynak verisi geldiğinde burada görünecek.</p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'fertilizer' && (
          <section className="tp-market-ref-card full-page-card">
            <header className="tp-market-ref-card-head">
              <div>
                <span>GÜBRE PİYASASI</span>
                <h2>En Son Kayıtlı Gübre Fiyatları</h2>
              </div>
            </header>

            {fertilizerRowsLatest.length > 0 ? (
              <div className="tp-market-ref-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Gübre</th>
                      <th>Piyasa Ortalaması</th>
                      <th>50 kg Karşılığı</th>
                      <th>Birim</th>
                      <th>Dönem</th>
                      <th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fertilizerRowsLatest.map(
                      (row: MarketFertilizerPrice) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.product}</strong>
                          </td>
                          <td className="average">
                            {formatPrice(row.price)}
                          </td>
                          <td>
                            {row.equivalent50Kg != null
                              ? `${formatPrice(row.equivalent50Kg)} TL`
                              : '—'}
                          </td>
                          <td>{row.unit}</td>
                          <td>
                            {formatDate(row.date)}
                            <small className={`tp-market-ref-age ${dateBadge(row.date).tone}`}>
                              {dateBadge(row.date).text}
                            </small>
                          </td>
                          <td>
                            <span className="tp-market-ref-source">
                              {row.sourceName}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tp-market-ref-empty">
                <MarketImageIcon name="fertilizer" size={46} />
                <div>
                  <h3>Gübre fiyat kaydı bulunamadı</h3>
                  <p>Gerçek kaynak verisi geldiğinde burada görünecek.</p>
                </div>
              </div>
            )}
          </section>
        )}


        {message && (
          <section className="tp-market-ref-notice">
            <Icon name="source" size={17} />
            <span>{message}</span>
          </section>
        )}

        <section className="tp-market-ref-disclaimer">
          <Icon name="info" size={15} />
          <span>
            Fiyatlar bilgilendirme amaçlıdır. Ürün fiyatları TOBB borsa kayıtlarından, motorin EPDK kayıtlarından, gübre fiyatları TZOB aylık Türkiye piyasa ortalamasından gelir. 50 kg gübre değeri ton fiyatından matematiksel karşılık olarak hesaplanır; bayi satış fiyatı değildir.
          </span>
        </section>
      </main>

      <ClassicBottomNav
        activeScreen="marketHub"
        setScreen={setScreen}
      />

      {alarmOpen && (
        <div className="tp-market-ref-modal-layer">
          <button
            type="button"
            className="tp-market-ref-modal-backdrop"
            onClick={() => setAlarmOpen(false)}
            aria-label="Kapat"
          />

          <section
            className="tp-market-ref-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>FİYAT ALARMI</span>
                <h2>Hedef fiyat belirle</h2>
              </div>
              <button
                type="button"
                onClick={() => setAlarmOpen(false)}
              >
                ×
              </button>
            </header>

            <label>
              <span>Ürün</span>
              <select
                value={alarmProduct}
                onChange={(event) =>
                  setAlarmProduct(event.target.value)
                }
              >
                {!cropOptions.length && (
                  <option value="">Ürün kaydı yok</option>
                )}
                {cropOptions.map((crop) => (
                  <option key={crop} value={crop}>
                    {crop}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Hedef fiyat (TL)</span>
              <input
                inputMode="decimal"
                value={alarmTarget}
                onChange={(event) =>
                  setAlarmTarget(event.target.value)
                }
                placeholder="Örn. 50"
              />
            </label>

            {alarmMessage && (
              <div className="tp-market-ref-alarm-message">
                {alarmMessage}
              </div>
            )}

            <footer>
              <button
                type="button"
                onClick={() => setAlarmOpen(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="primary"
                onClick={saveAlarm}
              >
                <MarketImageIcon name="alarm" size={24} />
                Alarmı Kaydet
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
