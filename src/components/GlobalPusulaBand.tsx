import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CloudSun, MapPin, Menu, Star } from 'lucide-react';
import PusulaGuide, { type PusulaInsight } from '../assets/pusula/PusulaGuide';
import { supabase } from '../supabaseClient';
import { useGamificationStore } from '../gamification/useGamificationStore';

const PUSULA_BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const PUSULA_NEEDLE_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp';

type GlobalPusulaBandProps = {
  screen: string;
  title?: string | null;
  fieldName?: string | null;
  onBack?: () => void;
  onMenu?: () => void;
  onOpenAi?: () => void;
  /** İsteğe bağlı: App.tsx verir ise Pusula doğrudan ekran değiştirebilir. */
  onNavigate?: (screen: string) => void;
  /** İsteğe bağlı: dışarıdan puan verilirse onu kullanır; yoksa merkezi gamification store kullanılır. */
  points?: number | null;
};

type UserGuideContext = {
  loading: boolean;
  userId: string | null;
  onboardingCompleted: boolean;
  fieldCount: number;
  hasCrop: boolean;
  hasFieldLocation: boolean;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  points: number | null;
};

type HeaderWeatherState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  temperature: number | null;
  weatherCode: number | null;
  condition: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt: number | null;
};

type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

type InteractiveGuideKind =
  | 'field-required'
  | 'weather-location'
  | 'support-location'
  | 'soil-lab';

type InteractiveGuideNeed = {
  id: string;
  kind: InteractiveGuideKind;
  title: string;
  text: string;
};

type InteractiveGuideStep =
  | 'main'
  | 'locating'
  | 'location-success'
  | 'location-denied'
  | 'soil-yes'
  | 'soil-no';

const INTERACTIVE_SNOOZE_KEY = 'tp_pusula_interactive_snooze_v1';
const INTERACTIVE_SESSION_PREFIX = 'tp_pusula_interactive_seen_v1:';
const SOIL_LAB_PREF_KEY = 'tp_pusula_soil_lab_known_v1';
const HEADER_WEATHER_CACHE_KEY = 'tp_pusula_header_weather_v1';
const HEADER_WEATHER_CACHE_MS = 15 * 60 * 1000;
const INTERACTIVE_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function weatherConditionFromCode(code: number | null) {
  if (code === null || !Number.isFinite(code)) return 'Hava';
  if (code === 0) return 'Açık';
  if (code === 1 || code === 2) return 'Parçalı bulutlu';
  if (code === 3) return 'Bulutlu';
  if (code === 45 || code === 48) return 'Sisli';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Çisenti';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Yağmurlu';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Karlı';
  if ([95, 96, 99].includes(code)) return 'Fırtınalı';
  return 'Hava';
}

function readSnoozes(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(INTERACTIVE_SNOOZE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isNeedSnoozed(id: string) {
  if (typeof window === 'undefined') return false;
  const until = Number(readSnoozes()[id] ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

function snoozeNeed(id: string) {
  try {
    const current = readSnoozes();
    current[id] = Date.now() + INTERACTIVE_SNOOZE_MS;
    window.localStorage.setItem(INTERACTIVE_SNOOZE_KEY, JSON.stringify(current));
  } catch {
    // localStorage kapalıysa yalnızca bu oturumda kapanır.
  }
}

function readHeaderWeatherCache(
  latitude: number,
  longitude: number,
): HeaderWeatherState | null {
  try {
    const raw = window.localStorage.getItem(HEADER_WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HeaderWeatherState;
    if (parsed?.status !== 'ready' || !parsed.updatedAt) return null;
    if (Date.now() - parsed.updatedAt > HEADER_WEATHER_CACHE_MS) return null;
    if (
      parsed.latitude === null ||
      parsed.longitude === null ||
      Math.abs(parsed.latitude - latitude) > 0.08 ||
      Math.abs(parsed.longitude - longitude) > 0.08
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveHeaderWeatherCache(value: HeaderWeatherState) {
  try {
    window.localStorage.setItem(HEADER_WEATHER_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Header hava özeti cache olmadan da çalışır.
  }
}

function NatureMenuIcon() {
  return <Menu className="tp-3d-menu-icon" aria-hidden="true" />;
}

function LeafPinIcon() {
  return <MapPin className="tp-3d-location-icon" aria-hidden="true" />;
}

function Sunny3DIcon() {
  return <CloudSun className="tp-3d-sun" aria-hidden="true" />;
}

function StarPointIcon() {
  return <Star className="tp-3d-star" aria-hidden="true" />;
}

function LeafBellIcon() {
  return <Bell className="tp-3d-bell" aria-hidden="true" />;
}

type CachedWeatherPusula = {
  fieldName?: string;
  fieldId?: string;
  crop?: string;
  savedAt?: number;
  insight?: PusulaInsight;
};

type DepotProductBrief = {
  id: string;
  productName: string;
  category: 'ilac' | 'gubre';
  activeIngredients?: string;
  registrationNumber?: string;
  remainingAmount: number;
  totalAmount: number;
  unit: string;
  fieldIds: string[];
};

type DepotFieldBrief = {
  id: string;
  name: string;
  crop?: string;
};

type DepotAssistantState = {
  loading: boolean;
  productCount: number;
  products: DepotProductBrief[];
  fields: DepotFieldBrief[];
};

type DepotStep =
  | 'welcome'
  | 'has-products'
  | 'know-purpose'
  | 'ready-scan'
  | 'scan-explain'
  | 'empty-confirm'
  | 'stock-home'
  | 'stock-field'
  | 'added';

const DEPOT_STATE_CACHE_KEY = 'tp_pusula_depot_state_v1';
const DEPOT_EMPTY_AUTO_KEY = 'tp_pusula_depot_empty_auto_seen_v1';


const WEATHER_PUSULA_CACHE_KEY = 'tp_pusula_weather_latest_v2';

const PUSULA_GUIDE_DELAY_MS = 5200;
const PUSULA_GUIDE_INTERVAL_MS = 9000;

type GuideMessage = {
  title: string;
  text: string;
};

const PUSULA_GUIDE_MESSAGES: Record<string, GuideMessage[]> = {
  marketHub: [
    {
      title: 'Piyasa verilerini yorumlarken kısa bir ipucu',
      text:
        'Ürün fiyatlarında yalnızca rakama değil, kayıt tarihine ve kaynağa da bak. En son kayıtlı fiyat her zaman bugünün fiyatı olmayabilir.',
    },
    {
      title: 'Piyasa Merkezi’nde karşılaştırma yapabilirsin',
      text:
        'Ürün, mazot ve gübre sekmelerini ayrı ayrı inceleyebilirsin. Pusula gerçek değerlendirmede bunları tarlanın diğer verileriyle birlikte ele alır.',
    },
    {
      title: 'Fiyat Alarmı takip işini kolaylaştırır',
      text:
        'İlgilendiğin ürün için hedef fiyat kaydedebilirsin; böylece fiyat ekranını sürekli elle kontrol etmek zorunda kalmazsın.',
    },
  ],
  weatherHub: [
    {
      title: 'Hava verilerini yorumlarken kısa bir ipucu',
      text:
        '5 günlük tahminde yalnızca yağış ihtimaline değil, rüzgâr ve sıcaklığa da birlikte bak. Saha zamanlaması tek bir değere göre yapılmamalı.',
    },
    {
      title: 'Tahmin kaynakları farklı sonuç verebilir',
      text:
        'Kaynaklar arasındaki fark normaldir. Pusula güncel tahminleri tarla kayıtlarınla birlikte değerlendirerek en anlamlı noktaları öne çıkarır.',
    },
    {
      title: 'İşlem zamanlamasında rüzgâr önemli olabilir',
      text:
        'Özellikle saha uygulamalarında rüzgârın yönü ve hızı önemli bir destek bilgisidir; karar verirken güncel tahmini kontrol et.',
    },
  ],
  fieldControlHub: [
    {
      title: 'Uydu verilerini yorumlarken kısa bir ipucu',
      text:
        'Katmanı incelerken görüntü tarihini mutlaka kontrol et. Tek bir uydu görüntüsüyle kesin sonuç çıkarmak yerine değişimi zaman içinde izle.',
    },
    {
      title: 'Katmanlar birbirini tamamlar',
      text:
        'Bitki sağlığı, radar, su ve iklim katmanları farklı şeyler anlatır. Pusula bunları tek başına değil, birlikte yorumlamaya çalışır.',
    },
    {
      title: 'Haritadaki değişim saha kontrolünü destekler',
      text:
        'Uydu üzerinde öne çıkan bir alan varsa bunu kesin teşhis olarak değil, arazide kontrol edilmesi gereken bir işaret olarak değerlendir.',
    },
  ],
  soilAnalysisHub: [
    {
      title: 'Toprak verilerini yorumlarken kısa bir ipucu',
      text:
        'Tahmini toprak profili ön bilgi sağlar. Elinde laboratuvar analizi varsa gerçek analiz sonucu her zaman önceliklidir.',
    },
    {
      title: 'pH tek başına yeterli değildir',
      text:
        'pH, organik karbon ve tekstür gibi değerleri birlikte okumak daha anlamlıdır. Pusula gerçek öneride bunları tarla ve ürün bilgisiyle eşleştirir.',
    },
    {
      title: 'Toprak sonucu zamanla değişebilir',
      text:
        'Numune tarihi ve örnekleme koşulları önemlidir. Eski bir sonucu bugünkü durumla aynı kabul etmemek gerekir.',
    },
  ],
  supportHub: [
    {
      title: 'Destekleri incelerken kısa bir ipucu',
      text:
        'Başvuru şartı, son tarih, il ve ürün kapsamını birlikte kontrol et. Her destek her üretici veya her tarla için geçerli olmayabilir.',
    },
    {
      title: 'Son başvuru tarihini kaçırma',
      text:
        'Uygun görünen bir destekte önce resmi başvuru takvimini ve gerekli belgeleri kontrol etmek en güvenli adımdır.',
    },
  ],
  agendaHub: [
    {
      title: 'Tarım gündemini yorumlarken kısa bir ipucu',
      text:
        'Genel bir gelişmenin tarlana etkisi her zaman aynı olmaz. Pusula gerçek değerlendirmede gündemi senin ürün ve tarla verilerinle ilişkilendirir.',
    },
    {
      title: 'Haberde tarih ve kaynak önemli',
      text:
        'Yeni gibi görünen bir gelişmenin yayın tarihini ve kaynağını kontrol et; eski bilgiyi güncel kararın temeli yapma.',
    },
  ],
  nutritionHub: [
    {
      title: 'Bitki besleme bilgisini yorumlarken kısa bir ipucu',
      text:
        'Tek bir görsel belirti besin eksikliğini kesin kanıtlamaz. Toprak, bitki dönemi ve diğer saha belirtileriyle birlikte değerlendirmek gerekir.',
    },
    {
      title: 'Besin maddeleri birbirini etkileyebilir',
      text:
        'Bir elementin yüksek veya düşük olması diğerlerinin alımını etkileyebilir. Bu nedenle tek değere bakarak uygulama kararı verilmemeli.',
    },
  ],
  pestGuideHub: [
    {
      title: 'Hastalık ve zararlı rehberinde kısa bir ipucu',
      text:
        'Benzer yaprak belirtileri farklı nedenlerden oluşabilir. Rehber olasılıkları daraltır; kesin teşhis için saha kontrolü önemlidir.',
    },
    {
      title: 'Fotoğraf kalitesi değerlendirmeyi etkiler',
      text:
        'Belirtiyi yakın, net ve mümkünse farklı açılardan görüntülemek karşılaştırmayı daha güvenilir hale getirir.',
    },
  ],
  producerMarketHub: [
    {
      title: 'Üretici Pazarı için kısa bir ipucu',
      text:
        'İlanda ürün, miktar, konum ve teslim koşullarını açık yazmak daha doğru eşleşme sağlar.',
    },
    {
      title: 'Teklifleri aynı ölçüyle karşılaştır',
      text:
        'Fiyat karşılaştırırken birim, kalite, teslim ve nakliye koşullarının aynı olup olmadığını kontrol et.',
    },
  ],
  fieldNotebookHub: [
    {
      title: 'Tarla Defteri Pusula’yı güçlendirir',
      text:
        'İşlemleri doğru tarih ve tarla ile kaydetmek sonraki Pusula değerlendirmelerinde daha güçlü bir geçmiş oluşturur.',
    },
    {
      title: 'Kısa notlar bile değerlidir',
      text:
        'Sulama, gübreleme, gözlem ve saha işlemlerini düzenli kaydetmek zaman içindeki değişimleri anlamayı kolaylaştırır.',
    },
  ],
  notificationsHub: [
    {
      title: 'Bildirimleri kullanırken kısa bir ipucu',
      text:
        'Kritik hava, yaklaşan görev ve önemli tarla uyarılarını açık tutmak yapılacak işleri kaçırma riskini azaltır.',
    },
    {
      title: 'Her bildirimin önceliği aynı değildir',
      text:
        'Pusula gerçek değerlendirmede acil riskleri sıradan bilgilendirmelerden ayırmaya çalışır.',
    },
  ],
  settingsHub: [
    {
      title: 'Ayarlar önerilerin doğruluğunu etkileyebilir',
      text:
        'Aktif tarla, konum ve ürün bilgilerinin doğru olması Pusula’nın kullandığı bağlamı güçlendirir.',
    },
    {
      title: 'Tarla bilgilerini güncel tut',
      text:
        'Ürün veya sezon değiştiğinde kaydı güncellemek eski bağlama göre öneri oluşmasını önler.',
    },
  ],
  calendar: [
    {
      title: 'Takvimi yorumlarken kısa bir ipucu',
      text:
        'Görev tarihini hava tahminiyle birlikte değerlendirmek saha işlerinin zamanlamasını daha anlamlı hale getirir.',
    },
    {
      title: 'Tamamlanan işleri işaretle',
      text:
        'Gerçekleşen görevları tamamlandı olarak kaydetmek Pusula’nın sıradaki işi daha doğru anlamasına yardımcı olur.',
    },
  ],
  aiAnalysis: [
    {
      title: 'AI Analiz için kısa bir ipucu',
      text:
        'Fotoğrafı net, yakın ve iyi ışıkta çekmek değerlendirmeyi güçlendirir. Mümkünse belirtinin farklı açılarını da kaydet.',
    },
    {
      title: 'Fotoğraf analizi kesin teşhis değildir',
      text:
        'AI sonucu bir ön değerlendirmedir; önemli hastalık ve uygulama kararlarında saha kontrolü ve gerektiğinde uzman doğrulaması gerekir.',
    },
  ],
};

function isGuideInsight(insight?: PusulaInsight | null) {
  const id = String(insight?.id ?? '');
  return (
    id.startsWith('pusula-guide-') ||
    id.startsWith('pusula-loading-') ||
    id.startsWith('market-guide-')
  );
}


function isFallbackOrTechnicalInsight(
  insight?: PusulaInsight | null,
) {
  if (!insight) return false;

  const text = [
    insight.gozlem,
    insight.yonlendirme,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR');

  const blockedPhrases = [
    'ai yorumu şu anda üretilemedi',
    'ai yorumu su anda üretilemedi',
    'zaman aşımına uğradı',
    'zaman asimina ugradi',
    'sağlayıcı geçici olarak yanıt vermedi',
    'saglayici gecici olarak yanit vermedi',
    'edge function returned',
    'non-2xx',
    'aborterror',
    'nvidia 30 saniye',
    'nvidia 60 saniye',
    'pusula önerisi şu anda oluşturulamadı',
    'pusula onerisi su anda olusturulamadi',
    'ham veriler uygulamada kullanılmaya devam ediyor',
    'ham veriler uygulamada kullanilmaya devam ediyor',
  ];

  return blockedPhrases.some((phrase) =>
    text.includes(phrase),
  );
}

function isRealUsableInsight(
  insight?: PusulaInsight | null,
) {
  return Boolean(
    insight?.id &&
      !isGuideInsight(insight) &&
      !isFallbackOrTechnicalInsight(insight),
  );
}

function buildLoadingInsight(
  screen: string,
  fieldName?: string | null,
): PusulaInsight {
  const field = String(fieldName ?? '').trim();

  const messages =
    PUSULA_GUIDE_MESSAGES[screen] ?? [
      {
        title: 'Pusula bu bölümü hazırlıyor',
        text:
          'Bu ekrandaki kayıtları diğer tarla verilerinle birlikte değerlendireceğim.',
      },
    ];

  const first = messages[0];

  return {
    id: `pusula-loading-${screen}-${Date.now()}`,
    gozlem: first.title,
    yonlendirme:
      `${first.text} ` +
      `${field ? `${field} için ` : ''}verilerin yükleniyor; ` +
      'Pusula güncel kayıtlarını bir araya getirip yorumluyor. ' +
      'Gerçek değerlendirme hazır olduğunda ayrıca göstereceğim.',
  };
}

function buildGuideInsight(
  screen: string,
  index: number,
): PusulaInsight {
  const messages =
    PUSULA_GUIDE_MESSAGES[screen] ?? [
      {
        title: 'Verilerini yorumlarken kısa bir ipucu',
        text:
          'Bu bölümdeki kayıtları hazırlıyorum. Gerçek Pusula değerlendirmesi hazır olduğunda rehber mesajının yerini otomatik olarak alacak.',
      },
    ];

  const message =
    messages[index % messages.length];

  return {
    id: `pusula-guide-${screen}-${index}-${Date.now()}`,
    gozlem: message.title,
    yonlendirme: message.text,
  };
}

function readCachedWeatherPusula(expectedFieldName?: string | null) {
  try {
    const raw = window.localStorage.getItem(WEATHER_PUSULA_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedWeatherPusula;
    if (!parsed?.insight?.id) return null;
    if (isFallbackOrTechnicalInsight(parsed.insight)) {
      try {
        window.localStorage.removeItem(WEATHER_PUSULA_CACHE_KEY);
      } catch {
        // Cache temizlenemese de teknik/fallback mesajı okunmaz.
      }
      return null;
    }

    const expected = String(expectedFieldName ?? '').trim();
    const cachedField = String(parsed.fieldName ?? '').trim();

    // Başka tarlanın eski yorumunu yanlışlıkla okutma.
    if (expected && cachedField && expected !== cachedField) return null;

    return parsed.insight;
  } catch {
    return null;
  }
}

/**
 * Sol menü ekranlarının ortak üst başlığı.
 * Masaüstü/mobil ortak düzen:
 *   ←  ☰  Sayfa adı        [Pusula tam merkezde]
 *
 * Pusula tek logodur ve mevcut PusulaGuide animasyonunu kullanır.
 */
export default function GlobalPusulaBand({
  screen,
  title,
  fieldName,
  onBack,
  onMenu,
  onOpenAi,
  onNavigate,
  points: pointsProp,
}: GlobalPusulaBandProps) {
  const gamification = useGamificationStore();
  const [insight, setInsight] = useState<PusulaInsight | null>(null);
  const latestPageInsightRef = useRef<PusulaInsight | null>(null);
  const latestWeatherInsightRef = useRef<PusulaInsight | null>(null);
  const guideDelayRef = useRef<number | null>(null);
  const guideTimerRef = useRef<number | null>(null);
  const guideIndexRef = useRef(0);
  const realInsightReadyRef = useRef(false);

  const [depotState, setDepotState] = useState<DepotAssistantState>({
    loading: true,
    productCount: 0,
    products: [],
    fields: [],
  });
  const [depotOpen, setDepotOpen] = useState(false);
  const [depotStep, setDepotStep] = useState<DepotStep>('welcome');
  const depotPreviousCountRef = useRef<number | null>(null);
  const depotAutoTimerRef = useRef<number | null>(null);

  const [userGuideContext, setUserGuideContext] = useState<UserGuideContext>({
    loading: true,
    userId: null,
    onboardingCompleted: false,
    fieldCount: 0,
    hasCrop: false,
    hasFieldLocation: false,
    city: '',
    district: '',
    latitude: null,
    longitude: null,
    points: null,
  });
  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionState>('unknown');
  const [headerWeather, setHeaderWeather] = useState<HeaderWeatherState>({
    status: 'idle',
    temperature: null,
    weatherCode: null,
    condition: 'Hava',
    locationLabel: '',
    latitude: null,
    longitude: null,
    updatedAt: null,
  });
  const [interactiveNeed, setInteractiveNeed] =
    useState<InteractiveGuideNeed | null>(null);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [interactiveStep, setInteractiveStep] =
    useState<InteractiveGuideStep>('main');
  const interactiveAutoTimerRef = useRef<number | null>(null);

  const pageTitle = String(title ?? 'TarlaPusula').trim() || 'TarlaPusula';

  const fieldSuffix = useMemo(() => {
    const name = String(fieldName ?? '').trim();
    return name ? ` Aktif tarla: ${name}.` : '';
  }, [fieldName]);


  const resolvedPoints =
    pointsProp !== undefined && pointsProp !== null
      ? pointsProp
      : gamification.status === 'ready'
        ? gamification.points
        : userGuideContext.points;

  const pointsAreLoading =
    pointsProp === undefined &&
    gamification.status !== 'ready' &&
    (resolvedPoints === null || resolvedPoints === undefined);

  const headerLocationLabel =
    headerWeather.locationLabel ||
    userGuideContext.city ||
    userGuideContext.district ||
    'Konum';

  const fetchHeaderWeather = async (
    latitude: number,
    longitude: number,
    locationLabel: string,
  ) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const cached = readHeaderWeatherCache(latitude, longitude);
    if (cached) {
      setHeaderWeather({
        ...cached,
        locationLabel: locationLabel || cached.locationLabel || 'Konum',
      });
      return;
    }

    setHeaderWeather((current) => ({
      ...current,
      status: 'loading',
      latitude,
      longitude,
      locationLabel: locationLabel || current.locationLabel || 'Konum',
    }));

    try {
      const params = new URLSearchParams({
        latitude: latitude.toFixed(5),
        longitude: longitude.toFixed(5),
        current: 'temperature_2m,weather_code',
        timezone: 'auto',
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`Open-Meteo ${response.status}`);
      }

      const payload = await response.json();
      const temperature = Number(payload?.current?.temperature_2m);
      const weatherCode = Number(payload?.current?.weather_code);

      const next: HeaderWeatherState = {
        status: 'ready',
        temperature: Number.isFinite(temperature) ? temperature : null,
        weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
        condition: weatherConditionFromCode(
          Number.isFinite(weatherCode) ? weatherCode : null,
        ),
        locationLabel: locationLabel || 'Konum',
        latitude,
        longitude,
        updatedAt: Date.now(),
      };

      setHeaderWeather(next);
      saveHeaderWeatherCache(next);
    } catch (error) {
      console.warn('[Pusula] Header hava özeti alınamadı:', error);
      setHeaderWeather((current) => ({
        ...current,
        status: 'error',
        locationLabel: locationLabel || current.locationLabel || 'Konum',
      }));
    }
  };

  // Pusula rehberinin kullanıcıyı gerçekten tanıyabilmesi için minimum bağlamı
  // doğrudan mevcut Supabase tablolarından okuyoruz. Mevcut sayfa verisini değiştirmez.
  useEffect(() => {
    let alive = true;

    const loadContext = async () => {
      if (!supabase) {
        if (alive) {
          setUserGuideContext((current) => ({ ...current, loading: false }));
        }
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user || !alive) {
          if (alive) {
            setUserGuideContext((current) => ({ ...current, loading: false }));
          }
          return;
        }

        const [profileResult, fieldsResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase
            .from('fields')
            .select(
              'id, name, city, district, crop, latitude, longitude, parcel_centroid_lat, parcel_centroid_lng, created_at',
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (!alive) return;

        if (profileResult.error) {
          console.warn('[Pusula] Profil bağlamı okunamadı:', profileResult.error);
        }
        if (fieldsResult.error) {
          console.warn('[Pusula] Tarla bağlamı okunamadı:', fieldsResult.error);
        }

        const profile = profileResult.data as Record<string, unknown> | null;
        const fields = Array.isArray(fieldsResult.data) ? fieldsResult.data : [];
        const expectedName = String(fieldName ?? '').trim();
        const selectedField =
          fields.find(
            (item: any) =>
              expectedName && String(item?.name ?? '').trim() === expectedName,
          ) ?? fields[0] ?? null;

        const latitudeCandidate = Number(
          selectedField?.parcel_centroid_lat ?? selectedField?.latitude,
        );
        const longitudeCandidate = Number(
          selectedField?.parcel_centroid_lng ?? selectedField?.longitude,
        );
        const latitude = Number.isFinite(latitudeCandidate)
          ? latitudeCandidate
          : null;
        const longitude = Number.isFinite(longitudeCandidate)
          ? longitudeCandidate
          : null;
        const city = String(selectedField?.city ?? '').trim();
        const district = String(selectedField?.district ?? '').trim();
        const locationLabel = city || district || expectedName || 'Konum';

        const possiblePoints = [
          profile?.points,
          profile?.total_points,
          profile?.score,
          profile?.gamification_points,
        ].find((value) => Number.isFinite(Number(value)));

        setUserGuideContext({
          loading: false,
          userId: user.id,
          onboardingCompleted: Boolean(profile?.onboarding_completed),
          fieldCount: fields.length,
          hasCrop: fields.some((item: any) => {
            const crop = String(item?.crop ?? '').trim().toLocaleLowerCase('tr-TR');
            return Boolean(crop && crop !== 'ürün belirtilmedi' && crop !== 'urun belirtilmedi');
          }),
          hasFieldLocation: latitude !== null && longitude !== null,
          city,
          district,
          latitude,
          longitude,
          points:
            possiblePoints === undefined ? null : Number(possiblePoints),
        });

        if (latitude !== null && longitude !== null) {
          void fetchHeaderWeather(latitude, longitude, locationLabel);
        }
      } catch (error) {
        console.warn('[Pusula] Kullanıcı rehber bağlamı hazırlanamadı:', error);
        if (alive) {
          setUserGuideContext((current) => ({ ...current, loading: false }));
        }
      }
    };

    void loadContext();

    return () => {
      alive = false;
    };
  }, [fieldName]);

  // Konum iznini sorgulamak izin penceresi açmaz; yalnızca mevcut durumu okur.
  useEffect(() => {
    let disposed = false;

    const checkPermission = async () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        if (!disposed) setLocationPermission('unsupported');
        return;
      }

      if (!navigator.permissions?.query) {
        if (!disposed) setLocationPermission('unknown');
        return;
      }

      try {
        const status = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (!disposed) {
          setLocationPermission(status.state as LocationPermissionState);
        }
        status.onchange = () => {
          if (!disposed) {
            setLocationPermission(status.state as LocationPermissionState);
          }
        };
      } catch {
        if (!disposed) setLocationPermission('unknown');
      }
    };

    void checkPermission();
    return () => {
      disposed = true;
    };
  }, []);

  // Kullanıcı daha önce konum izni verdiyse yeniden izin penceresi açmadan
  // üst bant hava bilgisini otomatik tamamla.
  useEffect(() => {
    if (locationPermission !== 'granted') return;
    if (userGuideContext.latitude !== null && userGuideContext.longitude !== null) return;
    if (headerWeather.latitude !== null && headerWeather.longitude !== null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetchHeaderWeather(
          position.coords.latitude,
          position.coords.longitude,
          'Konumun',
        );
      },
      () => {
        // Cihaz konumu geçici olarak alınamazsa mevcut tarla/konum verisi kullanılmaya devam eder.
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      },
    );
  }, [
    locationPermission,
    userGuideContext.latitude,
    userGuideContext.longitude,
    headerWeather.latitude,
    headerWeather.longitude,
  ]);

  const getInteractiveNeed = (): InteractiveGuideNeed | null => {
    if (userGuideContext.loading) return null;
    if (screen === 'inventoryHub') return null;

    if (
      ['fieldControlHub', 'calendar', 'aiAnalysis'].includes(screen) &&
      userGuideContext.fieldCount === 0
    ) {
      return {
        id: `field-required:${screen}`,
        kind: 'field-required',
        title: 'Önce ilk tarlanı ekleyelim.',
        text:
          'Bu bölümün sana özel çalışabilmesi için en az bir tarla kaydına ihtiyacım var. Birlikte ekleyebiliriz.',
      };
    }

    if (
      screen === 'weatherHub' &&
      !userGuideContext.hasFieldLocation &&
      locationPermission !== 'granted'
    ) {
      return {
        id: 'weather-location',
        kind: 'weather-location',
        title: 'Hava durumunu bulunduğun yere göre hazırlayayım mı?',
        text:
          'Kayıtlı tarlada kullanılabilir koordinat görünmüyor. Konumu açarsan bulunduğun yere göre güncel hava bilgisini gösterebilirim.',
      };
    }

    if (
      screen === 'supportHub' &&
      !userGuideContext.city &&
      !userGuideContext.district &&
      locationPermission !== 'granted'
    ) {
      return {
        id: 'support-location',
        kind: 'support-location',
        title: 'Destekleri konumuna göre daraltalım mı?',
        text:
          'İl ve ilçe bilgisi uygun destekleri ayırmamı kolaylaştırır. Konumunu açabilir veya daha sonra tarla bilginden tamamlayabilirsin.',
      };
    }

    if (screen === 'soilAnalysisHub' && userGuideContext.fieldCount === 0) {
      return {
        id: 'field-required:soilAnalysisHub',
        kind: 'field-required',
        title: 'Toprak profilini bir tarlaya bağlamam gerekiyor.',
        text:
          'Önce tarlanı ekleyelim; ardından tahmini toprak profili ve varsa laboratuvar sonucunu aynı tarla üzerinde karşılaştırabiliriz.',
      };
    }

    if (screen === 'soilAnalysisHub') {
      try {
        if (!window.localStorage.getItem(SOIL_LAB_PREF_KEY)) {
          return {
            id: 'soil-lab-question',
            kind: 'soil-lab',
            title: 'Elinde laboratuvar toprak analizi var mı?',
            text:
              'Varsa gerçek laboratuvar sonucunu öncelikli kullanırım. Yoksa tahmini toprak profilini ön bilgi olarak gösterebiliriz.',
          };
        }
      } catch {
        return {
          id: 'soil-lab-question',
          kind: 'soil-lab',
          title: 'Elinde laboratuvar toprak analizi var mı?',
          text:
            'Varsa gerçek laboratuvar sonucunu öncelikli kullanırım. Yoksa tahmini toprak profilini ön bilgi olarak gösterebiliriz.',
        };
      }
    }

    return null;
  };

  // Yeni kullanıcı / eksik veri senaryosu: ekrana göre yalnızca EN ÖNEMLİ tek ihtiyacı sor.
  // Aynı oturumda tekrar açılmaz; "Şimdi değil" denirse 3 gün sessiz kalır.
  useEffect(() => {
    if (interactiveAutoTimerRef.current != null) {
      window.clearTimeout(interactiveAutoTimerRef.current);
      interactiveAutoTimerRef.current = null;
    }

    setInteractiveOpen(false);
    setInteractiveStep('main');

    const need = getInteractiveNeed();
    setInteractiveNeed(need);
    if (!need || isNeedSnoozed(need.id)) return;

    try {
      const sessionKey = `${INTERACTIVE_SESSION_PREFIX}${need.id}`;
      if (window.sessionStorage.getItem(sessionKey) === '1') return;
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // sessionStorage kapalıysa otomatik açılış yine bir kez denenir.
    }

    interactiveAutoTimerRef.current = window.setTimeout(() => {
      setInsight(null);
      setInteractiveStep('main');
      setInteractiveOpen(true);
      interactiveAutoTimerRef.current = null;
    }, 900);

    return () => {
      if (interactiveAutoTimerRef.current != null) {
        window.clearTimeout(interactiveAutoTimerRef.current);
        interactiveAutoTimerRef.current = null;
      }
    };
  }, [
    screen,
    userGuideContext.loading,
    userGuideContext.fieldCount,
    userGuideContext.hasFieldLocation,
    userGuideContext.city,
    userGuideContext.district,
    locationPermission,
  ]);

  const requestBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocationPermission('unsupported');
      setInteractiveStep('location-denied');
      return;
    }

    setInteractiveStep('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLocationPermission('granted');
        setInteractiveStep('location-success');
        void fetchHeaderWeather(latitude, longitude, 'Konumun');

        window.dispatchEvent(
          new CustomEvent('tp-pusula-interactive-action', {
            detail: {
              screen,
              action: 'location-granted',
              latitude,
              longitude,
            },
          }),
        );
      },
      (error) => {
        console.warn('[Pusula] Konum izni alınamadı:', error);
        setLocationPermission(error.code === 1 ? 'denied' : 'unknown');
        setInteractiveStep('location-denied');
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      },
    );
  };

  const requestNavigation = (target: string, action?: string) => {
    setInteractiveOpen(false);

    if (target === 'aiAnalysis' && onOpenAi) {
      onOpenAi();
      return;
    }

    if (onNavigate) {
      onNavigate(target);
      return;
    }

    window.dispatchEvent(
      new CustomEvent('tp-pusula-interactive-action', {
        detail: {
          screen,
          action: action ?? 'navigate',
          target,
        },
      }),
    );
  };

  const dismissInteractive = (snooze = true) => {
    if (snooze && interactiveNeed?.id) {
      snoozeNeed(interactiveNeed.id);
    }
    setInteractiveOpen(false);
    setInteractiveStep('main');
  };

  const stopGuideRotation = () => {
    if (guideDelayRef.current != null) {
      window.clearTimeout(guideDelayRef.current);
      guideDelayRef.current = null;
    }

    if (guideTimerRef.current != null) {
      window.clearInterval(guideTimerRef.current);
      guideTimerRef.current = null;
    }
  };

  // Depo ekranı, ürün/stok bilgisini bu global banda event ile yollar.
  // Böylece Pusula'nın görseli yalnızca burada, üst bantta tek olarak kalır.
  useEffect(() => {
    if (screen !== 'inventoryHub') {
      setDepotOpen(false);
      depotPreviousCountRef.current = null;

      if (depotAutoTimerRef.current != null) {
        window.clearTimeout(depotAutoTimerRef.current);
        depotAutoTimerRef.current = null;
      }

      return;
    }

    const applyDepotState = (next: DepotAssistantState) => {
      setDepotState(next);

      if (next.loading) return;

      const previousCount = depotPreviousCountRef.current;
      depotPreviousCountRef.current = next.productCount;

      // Kullanıcı sihirbazdayken ilk ürün eklendiyse Pusula bunu fark etsin.
      if (
        previousCount !== null &&
        previousCount === 0 &&
        next.productCount > 0
      ) {
        setDepotStep('added');
        setDepotOpen(true);
        return;
      }

      // Var olan dolu depoda kullanıcıyı her girişte rahatsız etme.
      if (next.productCount > 0) return;

      // Tüm menüler aynı otomatik davranışı kullanır:
      // Depo da kendi kendine ayrı bir dialog açmaz.
      // Depo yardımcısı yalnızca kullanıcı Pusula'ya bastığında açılır.
      return;
    };

    // PestStore event'i bu component'ten hemen önce çalıştıysa son durumu kaçırma.
    try {
      const cached = window.sessionStorage.getItem(DEPOT_STATE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as DepotAssistantState;
        if (typeof parsed?.productCount === 'number') {
          applyDepotState(parsed);
        }
      }
    } catch {
      // Canlı event gelirse aşağıdaki listener çalışır.
    }

    const handleDepotState = (event: Event) => {
      const customEvent = event as CustomEvent<DepotAssistantState & {
        screen?: string;
      }>;

      if (customEvent.detail?.screen !== 'inventoryHub') return;

      applyDepotState({
        loading: Boolean(customEvent.detail.loading),
        productCount: Number(customEvent.detail.productCount ?? 0),
        products: Array.isArray(customEvent.detail.products)
          ? customEvent.detail.products
          : [],
        fields: Array.isArray(customEvent.detail.fields)
          ? customEvent.detail.fields
          : [],
      });
    };

    window.addEventListener(
      'tp-pusula-depot-state',
      handleDepotState as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp-pusula-depot-state',
        handleDepotState as EventListener,
      );

      if (depotAutoTimerRef.current != null) {
        window.clearTimeout(depotAutoTimerRef.current);
        depotAutoTimerRef.current = null;
      }
    };
  }, [screen]);

  // Sayfalar kendi gerçek verilerinden bir Pusula önerisi ürettiğinde
  // mevcut global Pusula animasyonuna aktar. Header yerleşimi değişmez.
  // Hava Durumu özelinde: otomatik konuşma oturumda yalnızca ilk gerçek veri geldiğinde olur.
  useEffect(() => {
    if (screen === 'weatherHub') {
      // Weather ekranı event'i bu header'dan hemen önce üretmiş olsa bile
      // son gerçek tarla yorumunu kaybetmeyelim. Burada sadece cache okunur;
      // yeni hava / AI API çağrısı yapılmaz.
      const cached = readCachedWeatherPusula(fieldName);
      if (cached) latestWeatherInsightRef.current = cached;
    }

    const handlePageInsight = (event: Event) => {
      const customEvent = event as CustomEvent<{
        screen?: string;
        fieldName?: string;
        fieldId?: string;
        crop?: string;
        insight?: PusulaInsight;
        autoEligible?: boolean;
      }>;

      if (customEvent.detail?.screen !== screen) return;
      if (!customEvent.detail?.insight?.id) return;

      const pageInsight = customEvent.detail.insight;
      const guideOnly = isGuideInsight(pageInsight);
      const fallbackOrTechnical =
        isFallbackOrTechnicalInsight(pageInsight);

      // Eski fallback/timeout mesajlarını gerçek Pusula önerisi sayma.
      // Kullanıcıya teknik hata göstermek yerine rehber akışını sürdür.
      if (fallbackOrTechnical) {
        try {
          window.sessionStorage.removeItem(
            `tp_pusula_screen_insight_${screen}`,
          );
        } catch {
          // Cache temizlenemese de teknik/fallback mesajını göstermiyoruz.
        }

        // İlk rehber zaten bir kez gösterildi.
        // AI geçici olarak yanıt vermezse kullanıcıyı tekrar tekrar rahatsız etme.
        return;
      }

      if (!guideOnly) {
        realInsightReadyRef.current = true;
        stopGuideRotation();
        latestPageInsightRef.current = pageInsight;
      }

      // Rehber veya gerçek kullanılabilir öneri cache'e yazılabilir.
      try {
        window.sessionStorage.setItem(
          `tp_pusula_screen_insight_${screen}`,
          JSON.stringify(customEvent.detail),
        );
      } catch {
        // Canlı state yeterli.
      }

      // Tüm ekranlarda aynı kural:
      // Başka tarladan gecikmiş bir event geldiyse gösterme.
      const expectedField = String(fieldName ?? '').trim();
      const incomingField = String(customEvent.detail.fieldName ?? '').trim();

      if (
        expectedField &&
        incomingField &&
        expectedField !== incomingField
      ) {
        return;
      }

      if (screen === 'weatherHub' && !guideOnly) {
        latestWeatherInsightRef.current = pageInsight;
      }

      // Rehber veya gerçek sonuç: bir event = bir gösterim.
      // Modüle özel ek otomatik tekrar yok.
      setInsight(pageInsight);
    };

    window.addEventListener('tp-pusula-insight', handlePageInsight as EventListener);

    return () => {
      window.removeEventListener(
        'tp-pusula-insight',
        handlePageInsight as EventListener,
      );
    };
  }, [screen, fieldName]);

  // Ekran değiştiğinde önceki ekranın önerisini taşımıyoruz.
  // Otomatik davranış:
  // 1) Gerçek cache varsa yalnızca gerçek öneriyi göster.
  // 2) Yoksa o ekran için TEK bir kısa rehber + "verilerin yükleniyor" mesajı göster.
  // 3) Sonra sus; gerçek günlük değerlendirme geldiğinde ikinci kez açıl.
  useEffect(() => {
    stopGuideRotation();

    setInsight(null);
    latestPageInsightRef.current = null;
    latestWeatherInsightRef.current = null;
    realInsightReadyRef.current = false;
    guideIndexRef.current = 0;

    // Önce bu ekran için daha önce hazır olmuş gerçek bir sonuç var mı bak.
    try {
      const raw = window.sessionStorage.getItem(
        `tp_pusula_screen_insight_${screen}`,
      );

      if (raw) {
        const cached = JSON.parse(raw) as {
          screen?: string;
          insight?: PusulaInsight;
        };

        if (
          cached?.screen === screen &&
          isRealUsableInsight(cached?.insight)
        ) {
          latestPageInsightRef.current = cached.insight!;
          realInsightReadyRef.current = true;

          const timer = window.setTimeout(() => {
            setInsight({
              ...cached.insight!,
              id: `${cached.insight!.id}-cache-${Date.now()}`,
            });
          }, 120);

          return () => {
            window.clearTimeout(timer);
            stopGuideRotation();
          };
        }

        if (
          cached?.insight &&
          isFallbackOrTechnicalInsight(cached.insight)
        ) {
          window.sessionStorage.removeItem(
            `tp_pusula_screen_insight_${screen}`,
          );
        }
      }
    } catch {
      // Cache yoksa aşağıdaki tek rehber mesajı gösterilir.
    }

    // Weather'ın kendi gerçek cache'i varsa rehber yerine onu kullan.
    if (screen === 'weatherHub') {
      const cachedWeather =
        readCachedWeatherPusula(fieldName);

      if (cachedWeather) {
        latestWeatherInsightRef.current = cachedWeather;
        latestPageInsightRef.current = cachedWeather;
        realInsightReadyRef.current = true;

        const timer = window.setTimeout(() => {
          setInsight({
            ...cachedWeather,
            id: `${cachedWeather.id}-cache-${Date.now()}`,
          });
        }, 120);

        return () => {
          window.clearTimeout(timer);
          stopGuideRotation();
        };
      }
    }

    // Sadece BİR KEZ açılır. Otomatik mesaj rotasyonu yok.
    setInsight(
      buildLoadingInsight(screen, fieldName),
    );

    return () => stopGuideRotation();
  }, [screen, fieldName]);

  // AI/Edge Function hatası kullanıcıya teknik metin olarak gösterilmez.
  // İlk rehber mesajı zaten bir kez gösterildiği için hata durumunda yeni balon açılmaz.
  useEffect(() => {
    const handlePusulaError = (event: Event) => {
      const customEvent = event as CustomEvent<{
        screen?: string;
        message?: string;
      }>;

      if (customEvent.detail?.screen !== screen) return;

      console.warn(
        '[Pusula] Günlük değerlendirme henüz hazır değil:',
        customEvent.detail?.message ?? 'Bilinmeyen hata',
      );
    };

    window.addEventListener(
      'tp-pusula-error',
      handlePusulaError as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp-pusula-error',
        handlePusulaError as EventListener,
      );
    };
  }, [screen]);

  const handlePusulaClick = () => {
    if (screen === 'inventoryHub') {
      if (depotOpen) {
        setDepotOpen(false);
        return;
      }

      setDepotStep(depotState.productCount > 0 ? 'stock-home' : 'welcome');
      setDepotOpen(true);
      return;
    }

    const currentNeed = getInteractiveNeed();
    if (currentNeed) {
      setInteractiveNeed(currentNeed);
      setInteractiveStep('main');
      setInsight(null);
      setInteractiveOpen((current) => !current);
      return;
    }

    if (screen === 'weatherHub') {
      const cached = readCachedWeatherPusula(fieldName);
      if (cached) latestWeatherInsightRef.current = cached;

      const latest = latestWeatherInsightRef.current ?? {
        id: 'weather-manual-fallback',
        gozlem: `Seçili tarla için gerçek hava verisi henüz hazır değil.${fieldSuffix}`,
        yonlendirme:
          'Veri geldiğinde ürün, tarih, yağış, rüzgâr, sıcaklık ve toprak nemini birlikte değerlendirip saha kararını söyleyeceğim.',
        guven_skoru: 'Düşük' as const,
      };

      setInsight({
        ...latest,
        id: `${latest.id}-manual-${Date.now()}`,
      });
      return;
    }

    let latest = latestPageInsightRef.current;

    if (latest && !isRealUsableInsight(latest)) {
      latest = null;
      latestPageInsightRef.current = null;
    }

    if (!latest) {
      try {
        const raw = window.sessionStorage.getItem(
          `tp_pusula_screen_insight_${screen}`,
        );
        const cached = raw
          ? (JSON.parse(raw) as { insight?: PusulaInsight })
          : null;

        if (isRealUsableInsight(cached?.insight)) {
          latest = cached!.insight!;
          latestPageInsightRef.current = cached!.insight!;
        } else if (
          cached?.insight &&
          isFallbackOrTechnicalInsight(cached.insight)
        ) {
          window.sessionStorage.removeItem(
            `tp_pusula_screen_insight_${screen}`,
          );
        }
      } catch {
        // Cache okunamazsa mevcut state kullanılır.
      }
    }

    if (!latest) {
      setInsight({
        ...buildGuideInsight(screen, guideIndexRef.current),
        id: `pusula-guide-manual-${screen}-${Date.now()}`,
      });
      guideIndexRef.current += 1;
      return;
    }

    // Her ekranda global logoya dokununca o ekranın son gerçek önerisini tekrar oynat.
    setInsight({
      ...latest,
      id: `${latest.id}-manual-${Date.now()}`,
    });
  };

  const depotLowStockCount = depotState.products.filter((product) => {
    const total = Number(product.totalAmount);
    const remaining = Number(product.remainingAmount);

    if (!Number.isFinite(total) || total <= 0) return false;
    if (!Number.isFinite(remaining)) return false;

    return remaining / total <= 0.25;
  }).length;

  const depotLinkedProducts = depotState.products.filter(
    (product) => product.fieldIds.length > 0,
  );

  const depotCrops = Array.from(
    new Set(
      depotState.fields
        .map((field) => String(field.crop ?? '').trim())
        .filter(Boolean),
    ),
  );

  const sendDepotAction = (action: 'scan' | 'stock') => {
    window.dispatchEvent(
      new CustomEvent('tp-pusula-depot-action', {
        detail: {
          screen: 'inventoryHub',
          action,
        },
      }),
    );
  };

  const startDepotScan = () => {
    sendDepotAction('scan');
    setDepotOpen(false);
  };

  const openDepotStock = () => {
    sendDepotAction('stock');
    setDepotOpen(false);
  };

  const renderInteractiveAssistant = () => {
    if (!interactiveNeed) return null;

    if (interactiveStep === 'locating') {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · KONUM</div>
          <h2>Konumunu alıyorum…</h2>
          <p>Yalnızca bulunduğun yere göre gerekli hava ve yerel bağlamı hazırlamak için kullanacağım.</p>
        </>
      );
    }

    if (interactiveStep === 'location-success') {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · KONUM HAZIR</div>
          <h2>Konum hazır.</h2>
          <p>Sağ üstteki hava kartını bu konuma göre güncelliyorum. İstersen daha sonra tarlanı ekleyerek tahmini doğrudan tarla koordinatına bağlayabilirsin.</p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={() => setInteractiveOpen(false)}>Tamam</button>
          </div>
        </>
      );
    }

    if (interactiveStep === 'location-denied') {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · KONUM</div>
          <h2>Konum izni açılmadı.</h2>
          <p>Sorun değil. Tarlanın il/ilçe ve parsel konumunu kaydedersen hava ve destek verilerini o konuma göre kullanabilirim.</p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={() => requestNavigation('addField', 'add-field')}>Tarla / Konum Ekle</button>
            <button type="button" className="secondary" onClick={() => dismissInteractive(true)}>Şimdi değil</button>
          </div>
        </>
      );
    }

    if (interactiveNeed.kind === 'soil-lab') {
      if (interactiveStep === 'soil-yes') {
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · TOPRAK ANALİZİ</div>
            <h2>Harika, gerçek sonucu öncelikli kullanalım.</h2>
            <p>Laboratuvar raporunu eklediğinde tahmini SoilGrids profilinin önüne gerçek analiz sonucunu koyacağım.</p>
            <div className="tp-depot-pusula-actions">
              <button
                type="button"
                onClick={() => {
                  try { window.localStorage.setItem(SOIL_LAB_PREF_KEY, 'yes'); } catch {}
                  requestNavigation('soilAnalysisHub', 'open-lab-upload');
                }}
              >
                Analizi Ekle
              </button>
              <button type="button" className="secondary" onClick={() => dismissInteractive(false)}>Sonra</button>
            </div>
          </>
        );
      }

      if (interactiveStep === 'soil-no') {
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · TAHMİNİ TOPRAK PROFİLİ</div>
            <h2>Tamam, tahmini profil ile başlayabiliriz.</h2>
            <p>pH, organik karbon ve tekstür gibi tahmini değerleri ön bilgi olarak göstereceğim. İleride laboratuvar sonucu eklersen otomatik olarak onu önceliklendiririz.</p>
            <div className="tp-depot-pusula-actions">
              <button
                type="button"
                onClick={() => {
                  try { window.localStorage.setItem(SOIL_LAB_PREF_KEY, 'no'); } catch {}
                  setInteractiveOpen(false);
                }}
              >
                Tahmini Profili Göster
              </button>
            </div>
          </>
        );
      }

      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · TOPRAK ANALİZİ</div>
          <h2>{interactiveNeed.title}</h2>
          <p>{interactiveNeed.text}</p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={() => setInteractiveStep('soil-yes')}>Evet</button>
            <button type="button" className="secondary" onClick={() => setInteractiveStep('soil-no')}>Hayır</button>
          </div>
        </>
      );
    }

    if (
      interactiveNeed.kind === 'weather-location' ||
      interactiveNeed.kind === 'support-location'
    ) {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · KONUM REHBERİ</div>
          <h2>{interactiveNeed.title}</h2>
          <p>{interactiveNeed.text}</p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={requestBrowserLocation}>Konumu Aç</button>
            <button type="button" className="secondary" onClick={() => requestNavigation('addField', 'manual-location')}>Elle Seç</button>
            <button type="button" className="secondary tp-pusula-later" onClick={() => dismissInteractive(true)}>Şimdi değil</button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="tp-depot-pusula-kicker">PUSULA · VERİ TAMAMLAMA</div>
        <h2>{interactiveNeed.title}</h2>
        <p>{interactiveNeed.text}</p>
        <div className="tp-depot-pusula-actions">
          <button type="button" onClick={() => requestNavigation('addField', 'add-field')}>Tarla Ekle</button>
          <button type="button" className="secondary" onClick={() => dismissInteractive(true)}>Şimdi değil</button>
        </div>
      </>
    );
  };

  const renderDepotAssistant = () => {
    if (depotState.loading) {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · DEPO REHBERİ</div>
          <h2>Depo verilerini hazırlıyorum…</h2>
          <p>
            Stok kayıtlarını yüklüyor ve yorumluyorum. Gerçek durum hazır olduğunda
            sana uygun adımı göstereceğim.
          </p>
        </>
      );
    }

    if (depotStep === 'added') {
      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · İLK ÜRÜN EKLENDİ</div>
          <h2>Güzel, depon artık boş değil.</h2>
          <p>
            Bundan sonra stok durumunu, ürünün bağlı olduğu tarlayı ve kayıtlı
            etiket/BKÜ bilgisini birlikte değerlendirebiliriz. Doz bilgisini
            kendim üretmem; kayıtlı ve doğrulanmış kaynağı esas alırım.
          </p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={() => setDepotStep('stock-field')}>
              Tarlam için değerlendir
            </button>
            <button type="button" className="secondary" onClick={openDepotStock}>
              Depomu göster
            </button>
          </div>
        </>
      );
    }

    if (depotState.productCount > 0) {
      if (depotStep === 'stock-field') {
        const linkedNames = depotLinkedProducts
          .slice(0, 3)
          .map((product) => product.productName)
          .join(', ');

        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · TARLA EŞLEŞMESİ</div>
            <h2>
              {depotLinkedProducts.length
                ? `${depotLinkedProducts.length} ürün tarlalarınla ilişkilendirilmiş.`
                : 'Ürünlerini henüz bir tarlayla ilişkilendirmemişsin.'}
            </h2>

            {depotLinkedProducts.length ? (
              <p>
                {linkedNames}
                {depotLinkedProducts.length > 3 ? ' ve diğerleri' : ''}.
                {depotCrops.length
                  ? ` Kayıtlı ürünlerin: ${depotCrops.slice(0, 3).join(', ')}.`
                  : ''}
                {' '}
                Kullanım değerlendirmesinde önce ürünün resmî/okunmuş etiket
                bilgisini, sonra tarla ve hava koşullarını birlikte ele alacağız.
              </p>
            ) : (
              <p>
                Ürünü bir tarlayla ilişkilendirirsen Pusula hangi ürünün hangi
                bitki için değerlendirileceğini daha doğru anlayabilir. Kullanım
                uygunluğu kesinleşmeden doz veya uygulama talimatı üretmeyeceğim.
              </p>
            )}

            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={openDepotStock}>
                Ürünlerimi aç
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotStep('stock-home')}
              >
                Geri
              </button>
            </div>
          </>
        );
      }

      return (
        <>
          <div className="tp-depot-pusula-kicker">PUSULA · DEPO DANIŞMANI</div>
          <h2>Deponda {depotState.productCount} ürün var.</h2>
          <p>
            {depotLowStockCount > 0
              ? `${depotLowStockCount} ürünün stoğu %25 veya altına düşmüş. `
              : ''}
            İstersen ürünlerini tarlalarınla birlikte değerlendirelim veya doğrudan
            stok listene geçelim.
          </p>
          <div className="tp-depot-pusula-actions">
            <button type="button" onClick={() => setDepotStep('stock-field')}>
              Tarlam için değerlendir
            </button>
            <button type="button" className="secondary" onClick={openDepotStock}>
              Stoklarımı göster
            </button>
          </div>
        </>
      );
    }

    switch (depotStep) {
      case 'has-products':
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · 1 / 3</div>
            <h2>Deponda şu anda ilaç veya gübre var mı?</h2>
            <p>Varsa birlikte tanıyıp düzenli şekilde depoya kaydedebiliriz.</p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={() => setDepotStep('know-purpose')}>
                Evet
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotStep('empty-confirm')}
              >
                Hayır
              </button>
            </div>
          </>
        );

      case 'know-purpose':
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · 2 / 3</div>
            <h2>Elindeki ürünün ne işe yaradığını biliyor musun?</h2>
            <p>
              Emin değilsen sorun değil. Etiket fotoğrafından ürün adı, türü,
              etken madde ve okunabilen kullanım bilgisini birlikte çıkarabiliriz.
            </p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={() => setDepotStep('ready-scan')}>
                Evet, biliyorum
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotStep('scan-explain')}
              >
                Tam emin değilim
              </button>
            </div>
          </>
        );

      case 'ready-scan':
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · 3 / 3</div>
            <h2>O zaman etiketi tarayarak kaydedelim.</h2>
            <p>
              Etiketi mümkün olduğunca net çek. Ürün kimliğini ve okunabilen
              kayıtları çıkarıp depoya ekleme ekranına götüreceğim.
            </p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={startDepotScan}>
                Etiketi Tara
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotStep('know-purpose')}
              >
                Geri
              </button>
            </div>
          </>
        );

      case 'scan-explain':
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · ÜRÜNÜ TANIYALIM</div>
            <h2>Ben etiketi okuyup ne olduğunu anlamana yardım edeyim.</h2>
            <p>
              Fotoğrafta açıkça görülen bilgileri okuyacağız. Ruhsat, kullanım
              alanı veya doz konusunda doğrulanmamış bir bilgi uydurmayacağım.
            </p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={startDepotScan}>
                Etiketi Tara
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotStep('know-purpose')}
              >
                Geri
              </button>
            </div>
          </>
        );

      case 'empty-confirm':
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · DEPO BOŞ</div>
            <h2>Tamam, şimdilik ekleyecek ürünün yok.</h2>
            <p>
              Daha sonra bir ilaç veya gübre aldığında etiketi taratarak buraya
              ekleyebilirsin. O zaman stok ve tarla eşleşmelerini ben takip ederim.
            </p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={startDepotScan}>
                Yine de ürün ekle
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotOpen(false)}
              >
                Sonra
              </button>
            </div>
          </>
        );

      case 'welcome':
      default:
        return (
          <>
            <div className="tp-depot-pusula-kicker">PUSULA · DEPO KURULUMU</div>
            <h2>Depon henüz boş görünüyor.</h2>
            <p>
              İstersen birkaç kısa soruyla ilaç ve gübrelerini birlikte
              düzenleyelim. Ürünlerini ekledikten sonra bu alan depo danışmanına
              dönüşecek.
            </p>
            <div className="tp-depot-pusula-actions">
              <button type="button" onClick={() => setDepotStep('has-products')}>
                Başlayalım
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setDepotOpen(false)}
              >
                Şimdilik geç
              </button>
            </div>
          </>
        );
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        .tp-global-page-header{
          position:fixed!important;
          z-index:2147482000!important;
          top:0!important;
          left:50%!important;
          transform:translateX(-50%)!important;
          width:min(100%,760px)!important;
          height:66px!important;
          padding:0 12px!important;
          box-sizing:border-box!important;
          display:flex!important;
          align-items:center!important;
          background:rgba(2,7,4,.985)!important;
          border-bottom:1px solid rgba(210,177,111,.16)!important;
          box-shadow:0 10px 28px rgba(0,0,0,.20)!important;
          backdrop-filter:blur(18px)!important;
          -webkit-backdrop-filter:blur(18px)!important;
          overflow:visible!important;
        }

        .tp-global-page-left{
          position:relative!important;
          z-index:3!important;
          display:flex!important;
          align-items:center!important;
          gap:7px!important;
          min-width:0!important;
          max-width:calc(50% - 34px)!important;
        }

        .tp-global-page-back,
        .tp-global-page-menu{
          flex:0 0 auto!important;
          width:38px!important;
          height:38px!important;
          min-width:38px!important;
          min-height:38px!important;
          padding:0!important;
          margin:0!important;
          border-radius:11px!important;
          border:1px solid rgba(210,177,111,.18)!important;
          background:rgba(10,20,14,.78)!important;
          color:#eee4d0!important;
          display:grid!important;
          place-items:center!important;
          font-family:Inter,sans-serif!important;
          line-height:1!important;
          cursor:pointer!important;
          box-shadow:none!important;
        }

        .tp-global-page-back{
          font-size:22px!important;
        }

        .tp-global-page-menu{
          position:relative!important;
          z-index:3!important;
          top:auto!important;
          right:auto!important;
          transform:none!important;
          font-size:20px!important;
          letter-spacing:-.08em!important;
        }

        .tp-global-page-title{
          min-width:0!important;
          margin:0!important;
          padding:0!important;
          color:#eee4d0!important;
          font-family:'Cinzel',serif!important;
          font-size:17px!important;
          font-weight:700!important;
          line-height:1.1!important;
          letter-spacing:-.01em!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          text-align:left!important;
        }

        .tp-global-page-right{
          position:absolute!important;
          z-index:3!important;
          top:50%!important;
          right:10px!important;
          transform:translateY(-50%)!important;
          display:flex!important;
          align-items:center!important;
          gap:7px!important;
          pointer-events:auto!important;
        }

        .tp-global-glass{
          height:44px!important;
          box-sizing:border-box!important;
          border-radius:15px!important;
          border:1px solid rgba(147,198,164,.22)!important;
          background:
            linear-gradient(180deg,rgba(25,47,35,.46),rgba(7,20,13,.32))!important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.055),
            0 9px 26px rgba(0,0,0,.20)!important;
          backdrop-filter:blur(18px) saturate(125%)!important;
          -webkit-backdrop-filter:blur(18px) saturate(125%)!important;
          color:#e8eee8!important;
        }

        .tp-global-weather-glass{
          min-width:164px!important;
          padding:0 10px!important;
          display:grid!important;
          grid-template-columns:26px minmax(0,1fr) 27px!important;
          align-items:center!important;
          gap:7px!important;
          cursor:pointer!important;
          text-align:left!important;
        }

        .tp-global-weather-copy{
          min-width:0!important;
          display:flex!important;
          flex-direction:column!important;
          justify-content:center!important;
          line-height:1.05!important;
        }

        .tp-global-weather-copy small{
          display:block!important;
          max-width:67px!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          white-space:nowrap!important;
          color:#a9b8ad!important;
          font:600 9px/1.1 Inter,sans-serif!important;
        }

        .tp-global-weather-value{
          min-width:0!important;
          margin-top:3px!important;
          display:flex!important;
          align-items:baseline!important;
          gap:5px!important;
          overflow:hidden!important;
        }

        .tp-global-weather-copy strong{
          flex:0 0 auto!important;
          color:#f2f4ef!important;
          font:800 14px/1 Inter,sans-serif!important;
        }

        .tp-global-weather-copy em{
          min-width:0!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          white-space:nowrap!important;
          color:#a9b8ad!important;
          font:650 8px/1 Inter,sans-serif!important;
          font-style:normal!important;
        }

        .tp-global-points-glass{
          min-width:76px!important;
          padding:0 10px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          gap:7px!important;
          border:1px solid rgba(147,198,164,.22)!important;
          cursor:pointer!important;
        }

        .tp-global-points-copy{
          display:flex!important;
          min-width:0!important;
          flex-direction:column!important;
          line-height:1!important;
        }

        .tp-global-points-copy small{
          color:#9ead9f!important;
          font:600 8px/1 Inter,sans-serif!important;
        }

        .tp-global-points-copy strong{
          margin-top:4px!important;
          color:#f1f4ee!important;
          font:800 12px/1 Inter,sans-serif!important;
        }

        .tp-3d-location-icon,
        .tp-3d-menu-icon,
        .tp-3d-sun,
        .tp-3d-star,
        .tp-3d-bell{
          display:block!important;
          object-fit:contain!important;
          flex:0 0 auto!important;
          user-select:none!important;
          pointer-events:none!important;
          background:transparent!important;
          border:0!important;
          filter:drop-shadow(0 5px 8px rgba(0,0,0,.34))!important;
        }

        .tp-3d-location-icon{
          width:27px!important;
          height:27px!important;
        }

        .tp-3d-menu-icon{
          width:27px!important;
          height:27px!important;
        }

        .tp-3d-sun{
          width:28px!important;
          height:28px!important;
        }

        .tp-3d-star{
          width:27px!important;
          height:27px!important;
        }

        .tp-3d-bell{
          width:27px!important;
          height:27px!important;
        }

        /* Logo ekranın geometrik merkezinde. Sağ/sol öğeler logoyu oynatmaz. */
        .tp-global-pusula-anchor{
          position:absolute!important;
          z-index:4!important;
          top:50%!important;
          left:50%!important;
          transform:translate(-50%,-50%)!important;
          width:50px!important;
          height:50px!important;
          min-width:50px!important;
          min-height:50px!important;
          margin:0!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          display:grid!important;
          place-items:center!important;
          overflow:visible!important;
          cursor:pointer!important;
          box-shadow:none!important;
          transition:
            top .58s cubic-bezier(.2,.8,.2,1),
            transform .58s cubic-bezier(.2,.8,.2,1),
            filter .35s ease!important;
        }

        .tp-global-pusula-anchor.tp-depot-pusula-active{
          top:calc(50% + 92px)!important;
          transform:translate(-50%,-50%) scale(1.28)!important;
          filter:drop-shadow(0 10px 22px rgba(0,0,0,.42))!important;
        }

        .tp-global-pusula-stage{
          position:relative!important;
          width:50px!important;
          height:50px!important;
          display:block!important;
        }

        .tp-global-pusula-stage img{
          position:absolute!important;
          inset:0!important;
          width:50px!important;
          height:50px!important;
          object-fit:contain!important;
          pointer-events:none!important;
          user-select:none!important;
        }

        .tp-global-pusula-body{
          z-index:1!important;
        }

        .tp-global-pusula-needle{
          z-index:2!important;
          transform-origin:50% 50%!important;
          animation:tp-depot-needle-idle 5.4s ease-in-out infinite!important;
          filter:drop-shadow(0 0 6px rgba(92,230,134,.28))!important;
        }

        .tp-global-pusula-anchor.tp-depot-pusula-active .tp-global-pusula-needle{
          animation:tp-depot-needle-talk 1.45s ease-in-out infinite!important;
        }

        @keyframes tp-depot-needle-idle{
          0%,100%{transform:rotate(-12deg)}
          50%{transform:rotate(13deg)}
        }

        @keyframes tp-depot-needle-talk{
          0%{transform:rotate(-18deg)}
          35%{transform:rotate(74deg)}
          58%{transform:rotate(42deg)}
          78%{transform:rotate(96deg)}
          100%{transform:rotate(-18deg)}
        }

        .tp-depot-pusula-card,
        .tp-interactive-pusula-card{
          position:fixed!important;
          z-index:2147481900!important;
          top:164px!important;
          left:50%!important;
          transform:translateX(-50%) translateY(-8px)!important;
          width:min(calc(100vw - 24px),440px)!important;
          box-sizing:border-box!important;
          padding:17px 17px 15px!important;
          border:1px solid rgba(166,207,160,.28)!important;
          border-radius:20px!important;
          background:
            radial-gradient(circle at 50% 0%,rgba(90,190,112,.12),transparent 36%),
            linear-gradient(180deg,rgba(7,17,11,.985),rgba(2,8,5,.992))!important;
          color:#eee4d0!important;
          box-shadow:
            0 22px 52px rgba(0,0,0,.46),
            inset 0 1px 0 rgba(255,255,255,.025)!important;
          animation:tp-depot-card-in .34s ease forwards!important;
        }

        .tp-depot-pusula-card::before,
        .tp-interactive-pusula-card::before{
          content:''!important;
          position:absolute!important;
          top:-12px!important;
          left:50%!important;
          width:22px!important;
          height:22px!important;
          transform:translateX(-50%) rotate(45deg)!important;
          border-left:1px solid rgba(166,207,160,.28)!important;
          border-top:1px solid rgba(166,207,160,.28)!important;
          background:#07110b!important;
        }

        @keyframes tp-depot-card-in{
          from{opacity:0;transform:translateX(-50%) translateY(-10px) scale(.985)}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
        }

        .tp-depot-pusula-close{
          position:absolute!important;
          top:10px!important;
          right:10px!important;
          width:31px!important;
          height:31px!important;
          border-radius:50%!important;
          border:1px solid rgba(210,177,111,.20)!important;
          background:rgba(255,255,255,.025)!important;
          color:#c8bfae!important;
          font-size:20px!important;
          line-height:1!important;
          display:grid!important;
          place-items:center!important;
          cursor:pointer!important;
        }

        .tp-depot-pusula-kicker{
          padding-right:38px!important;
          color:#a6cfa0!important;
          font-family:Inter,sans-serif!important;
          font-size:9px!important;
          font-weight:800!important;
          letter-spacing:.12em!important;
          text-transform:uppercase!important;
        }

        .tp-depot-pusula-card h2,
        .tp-interactive-pusula-card h2{
          margin:7px 38px 7px 0!important;
          color:#f4ead7!important;
          font-family:'Cinzel',serif!important;
          font-size:18px!important;
          line-height:1.28!important;
          font-weight:700!important;
        }

        .tp-depot-pusula-card p,
        .tp-interactive-pusula-card p{
          margin:0!important;
          color:#c8bfae!important;
          font-family:Inter,sans-serif!important;
          font-size:12.5px!important;
          line-height:1.55!important;
        }

        .tp-depot-pusula-actions{
          display:flex!important;
          flex-wrap:wrap!important;
          gap:8px!important;
          margin-top:14px!important;
        }

        .tp-depot-pusula-actions button{
          min-height:40px!important;
          padding:0 13px!important;
          border-radius:12px!important;
          border:1px solid rgba(166,207,160,.34)!important;
          background:linear-gradient(180deg,rgba(36,77,45,.96),rgba(18,47,27,.98))!important;
          color:#eaf4e8!important;
          font-family:Inter,sans-serif!important;
          font-size:11px!important;
          font-weight:700!important;
          cursor:pointer!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
        }

        .tp-depot-pusula-actions button.secondary{
          border-color:rgba(210,177,111,.20)!important;
          background:rgba(255,255,255,.025)!important;
          color:#d4cbb9!important;
        }

        .tp-global-pusula-anchor img{
          display:block!important;
          width:50px!important;
          height:50px!important;
          object-fit:contain!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          filter:drop-shadow(0 0 9px rgba(110,225,149,.14))!important;
        }

        .pusula-guide{
          z-index:2147483000!important;
        }

        ${screen === 'weatherHub' ? `
        /* Hava ekranında tıklamayı alttaki global Pusula butonu yönetir;
           böylece son güncel öneri isteğe bağlı tekrar oynatılır. */
        .pusula-guide__logo{
          pointer-events:none!important;
        }
        ` : ''}

        @media(max-width:560px){
          .tp-global-page-header{
            height:64px!important;
            padding:0 10px!important;
          }

          .tp-global-page-left{
            gap:5px!important;
            max-width:calc(50% - 30px)!important;
          }

          .tp-global-page-back,
          .tp-global-page-menu{
            width:36px!important;
            height:36px!important;
            min-width:36px!important;
            min-height:36px!important;
            border-radius:10px!important;
          }

          .tp-global-page-back{font-size:21px!important;}
          .tp-global-page-menu{font-size:19px!important;}
          .tp-global-page-title{font-size:15px!important;}

          .tp-global-pusula-anchor,
          .tp-global-pusula-anchor img{
            width:46px!important;
            height:46px!important;
            min-width:46px!important;
            min-height:46px!important;
          }

          .tp-global-pusula-stage,
          .tp-global-pusula-stage img{
            width:46px!important;
            height:46px!important;
          }

          .tp-global-pusula-anchor.tp-depot-pusula-active{
            top:calc(50% + 84px)!important;
            transform:translate(-50%,-50%) scale(1.24)!important;
          }

          .tp-depot-pusula-card,
          .tp-interactive-pusula-card{
            top:150px!important;
            width:min(calc(100vw - 18px),420px)!important;
            padding:15px 14px 13px!important;
            border-radius:18px!important;
          }

          .tp-depot-pusula-card h2,
          .tp-interactive-pusula-card h2{
            font-size:16px!important;
          }

          .tp-depot-pusula-card p,
          .tp-interactive-pusula-card p{
            font-size:12px!important;
          }

          .tp-depot-pusula-actions{
            display:grid!important;
            grid-template-columns:1fr 1fr!important;
          }

          .tp-global-page-title{display:none!important;}
          .tp-global-page-left{max-width:82px!important;}
          .tp-global-page-right{right:8px!important;gap:5px!important;}
          .tp-global-weather-glass{
            min-width:100px!important;
            width:100px!important;
            padding:0 6px!important;
            grid-template-columns:20px minmax(0,1fr)!important;
            gap:5px!important;
          }
          .tp-global-weather-glass>.tp-3d-sun{display:none!important;}
          .tp-global-weather-copy small{display:none!important;}
          .tp-global-weather-value{
            margin-top:0!important;
            flex-direction:column!important;
            align-items:flex-start!important;
            gap:2px!important;
          }
          .tp-global-weather-copy strong{font-size:11px!important;}
          .tp-global-weather-copy em{
            max-width:61px!important;
            font-size:7px!important;
          }
          .tp-3d-location-icon{width:22px!important;height:22px!important;}
          .tp-global-points-glass{min-width:54px!important;width:54px!important;padding:0 5px!important;gap:3px!important;}
          .tp-global-points-copy small{display:none!important;}
          .tp-global-points-copy strong{font-size:10px!important;}
          .tp-3d-star{width:21px!important;height:21px!important;}
          .tp-pusula-later{grid-column:1/-1!important;}
        }
      `}</style>

      {!interactiveOpen && !(screen === 'inventoryHub' && depotOpen) && (
        <PusulaGuide
          insight={insight}
          anchorSelector=".tp-global-pusula-anchor"
        />
      )}

      <header
        className={`tp-global-page-header${
          screen === 'inventoryHub' && depotOpen
            ? ' tp-depot-assistant-open'
            : ''
        }`}
      >
        <div className="tp-global-page-left">
          <button
            type="button"
            className="tp-global-page-back"
            onClick={onBack}
            aria-label="Geri dön"
            title="Geri"
          >
            ←
          </button>

          <button
            type="button"
            className="tp-global-page-menu"
            onClick={onMenu}
            aria-label="Menüyü aç"
            title="Menü"
          >
            <NatureMenuIcon />
          </button>

          <h1 className="tp-global-page-title">{pageTitle}</h1>
        </div>

        <button
          type="button"
          className={`tp-global-pusula-anchor${
            (screen === 'inventoryHub' && depotOpen) || interactiveOpen
              ? ' tp-depot-pusula-active'
              : ''
          }`}
          onClick={handlePusulaClick}
          aria-label="Pusula"
          title="Pusula"
        >
          {screen === 'inventoryHub' ? (
            <span className="tp-global-pusula-stage" aria-hidden="true">
              <img
                className="tp-global-pusula-body"
                src={PUSULA_BODY_SRC}
                crossOrigin="anonymous"
                alt=""
                draggable={false}
              />
              <img
                className="tp-global-pusula-needle"
                src={PUSULA_NEEDLE_SRC}
                crossOrigin="anonymous"
                alt=""
                draggable={false}
              />
            </span>
          ) : (
            <img
              src={PUSULA_BODY_SRC}
              crossOrigin="anonymous"
              alt="Pusula"
              draggable={false}
            />
          )}
        </button>

        <div className="tp-global-page-right">
          <button
            type="button"
            className="tp-global-glass tp-global-weather-glass"
            onClick={() => {
              const need = getInteractiveNeed();
              if (
                need?.kind === 'weather-location' ||
                need?.kind === 'support-location'
              ) {
                setInteractiveNeed(need);
                setInteractiveStep('main');
                setInteractiveOpen(true);
                return;
              }

              if (
                headerWeather.latitude !== null &&
                headerWeather.longitude !== null
              ) {
                void fetchHeaderWeather(
                  headerWeather.latitude,
                  headerWeather.longitude,
                  headerLocationLabel,
                );
              } else if (
                userGuideContext.latitude !== null &&
                userGuideContext.longitude !== null
              ) {
                void fetchHeaderWeather(
                  userGuideContext.latitude,
                  userGuideContext.longitude,
                  headerLocationLabel,
                );
              } else {
                setInteractiveNeed({
                  id: 'weather-location',
                  kind: 'weather-location',
                  title: 'Konumunu kullanarak hava bilgisini hazırlayayım mı?',
                  text: 'Konumu açabilir veya tarlanın konumunu elle ekleyebilirsin.',
                });
                setInteractiveStep('main');
                setInteractiveOpen(true);
              }
            }}
            aria-label="Konum ve hava durumu"
            title="Konum ve hava durumu"
          >
            <LeafPinIcon />
            <span className="tp-global-weather-copy">
              <small>{headerLocationLabel}</small>
              <span className="tp-global-weather-value">
                <strong>
                  {headerWeather.status === 'loading'
                    ? '…'
                    : headerWeather.temperature === null
                      ? '—°'
                      : `${Math.round(headerWeather.temperature)}°C`}
                </strong>
                <em>
                  {headerWeather.status === 'loading'
                    ? 'Hazırlanıyor'
                    : headerWeather.condition || 'Hava'}
                </em>
              </span>
            </span>
            <Sunny3DIcon />
          </button>

          <button
            type="button"
            className="tp-global-glass tp-global-points-glass"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('tp-pusula-interactive-action', {
                  detail: { screen, action: 'open-points' },
                }),
              )
            }
            aria-label="Pusula puanı"
            title="Pusula puanı"
          >
            <StarPointIcon />
            <span className="tp-global-points-copy">
              <small>Puan</small>
              <strong>
                {pointsAreLoading
                  ? '…'
                  : resolvedPoints === null || resolvedPoints === undefined
                    ? '0'
                    : `${resolvedPoints.toLocaleString('tr-TR')} P`}
              </strong>
            </span>
          </button>
        </div>

      </header>

      {interactiveOpen && interactiveNeed && (
        <section
          className="tp-interactive-pusula-card"
          role="dialog"
          aria-label="Pusula interaktif rehberi"
        >
          <button
            type="button"
            className="tp-depot-pusula-close"
            onClick={() => dismissInteractive(false)}
            aria-label="Pusula rehberini kapat"
          >
            ×
          </button>

          {renderInteractiveAssistant()}
        </section>
      )}

      {screen === 'inventoryHub' && depotOpen && (
        <section
          className="tp-depot-pusula-card"
          role="dialog"
          aria-label="Pusula depo yardımcısı"
        >
          <button
            type="button"
            className="tp-depot-pusula-close"
            onClick={() => setDepotOpen(false)}
            aria-label="Pusula depo yardımcısını kapat"
          >
            ×
          </button>

          {renderDepotAssistant()}
        </section>
      )}
    </>,
    document.body,
  );
}
