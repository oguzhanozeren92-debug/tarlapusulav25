import { supabase } from './supabaseClient';
import FieldMap from './components/FieldMap';
import MobileWheelPicker from './components/MobileWheelPicker';
import SatelliteHealthMap from './components/SatelliteHealthMap';
import { analyzeFieldSatellite, type SatelliteHealthResult } from './lib/satelliteService';
import SoilAnalysisPage from './pages/SoilAnalysis/SoilAnalysisPage';
import { lookupParcel } from './lib/parcelService';
import { useEffect, useState, type FormEvent } from 'react';

type Screen =
  | 'welcome'
  | 'login'
  | 'emailRegister'
  | 'emailLogin'
  | 'emailVerification'
  | 'onboarding'
  | 'ready'
  | 'addField'
  | 'fieldDetail'
  | 'aiAnalysis'
  | 'calendar'
  | 'weatherHub'
  | 'fieldControlHub'
  | 'soilAnalysisHub'
  | 'inventoryHub'
  | 'marketHub'
  | 'supportHub'
  | 'agendaHub'
  | 'nutritionHub'
  | 'pestGuideHub'
  | 'producerMarketHub'
  | 'fieldNotebookHub'
  | 'notificationsHub'
  | 'settingsHub'
  | 'adminHub'
  | 'home';

type FieldStatus = 'good' | 'check' | 'urgent';
type CropCycle = 'annual' | 'perennial';

type LocationOption = {
  id: number;
  name: string;
};

type Field = {
  id: number | string;
  name: string;
  ada: number;
  parsel: number;
  area: number;
  crop: string;
  season: number;
  status: FieldStatus;
  demo?: boolean;
  city?: string;
  district?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  parcelGeometry?: any | null;
  parcelCentroidLat?: number | null;
  parcelCentroidLng?: number | null;
  parcelLookupStatus?: string | null;
  parcelLookupSource?: string | null;
  cropCycle?: CropCycle;
  plantingYear?: number | null;
  bearing?: boolean | null;
};

type FieldSection = {
  id: string;
  fieldId: string;
  name: string;
  crop: string;
  area: number | null;
};

type FieldSeason = {
  id: string;
  year: number;
  crop: string;
  plantingDate: string | null;
  harvestDate: string | null;
  notes: string | null;
};

type PerennialYield = {
  id: string;
  year: number;
  yieldKg: number | null;
  harvestDate: string | null;
  notes: string | null;
};

type AiFieldAnalysis = {
  status: 'normal' | 'attention' | 'urgent' | 'uncertain';
  headline: string;
  possibleIssue: string;
  confidence: number;
  observations: string[];
  recommendations: string[];
  disclaimer: string;
};

type AiAccessStatus = {
  plan: string;
  dailyFreeUsed: boolean;
  freeRemaining: number;
  rewardCredits: number;
  unlimited: boolean;
};

type CalendarReminder = {
  id: string;
  fieldId: string;
  fieldName: string;
  reminderType: string;
  title: string;
  reminderDate: string;
  reminderTime: string | null;
  notes: string | null;
  completed: boolean;
};

type FieldActivity = {
  id: string;
  type: string;
  title: string;
  activityDate: string;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  notes: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  aiAnalysis: AiFieldAnalysis | null;
};


type WeatherForecastDay = {
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  humidity: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
  condition: string;
};

type WeatherProviderResult = {
  name: string;
  forecast: WeatherForecastDay[];
};

type FieldWeatherState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  locationLabel?: string;
  forecast: WeatherForecastDay[];
  providers?: WeatherProviderResult[];
  message?: string;
};

type FieldSatelliteState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: SatelliteHealthResult;
  message?: string;
};


type CropCatalogueItem = {
  name: string;
  cycle: CropCycle;
};

const TURKEY_CROPS: CropCatalogueItem[] = [
  { name: 'Acı Bakla', cycle: 'annual' },
  { name: 'Adaçayı', cycle: 'perennial' },
  { name: 'Ahududu', cycle: 'perennial' },
  { name: 'Alabaş', cycle: 'annual' },
  { name: 'Anason', cycle: 'annual' },
  { name: 'Antep Fıstığı', cycle: 'perennial' },
  { name: 'Armut', cycle: 'perennial' },
  { name: 'Arpa', cycle: 'annual' },
  { name: 'Aronya', cycle: 'perennial' },
  { name: 'Ayçiçeği', cycle: 'annual' },
  { name: 'Ayva', cycle: 'perennial' },
  { name: 'Badem', cycle: 'perennial' },
  { name: 'Bakla', cycle: 'annual' },
  { name: 'Bal Kabağı', cycle: 'annual' },
  { name: 'Bamya', cycle: 'annual' },
  { name: 'Beyaz Lahana', cycle: 'annual' },
  { name: 'Bezelye', cycle: 'annual' },
  { name: 'Biber', cycle: 'annual' },
  { name: 'Biberiye', cycle: 'perennial' },
  { name: 'Böğürtlen', cycle: 'perennial' },
  { name: 'Brokoli', cycle: 'annual' },
  { name: 'Brüksel Lahanası', cycle: 'annual' },
  { name: 'Buğday', cycle: 'annual' },
  { name: 'Çavdar', cycle: 'annual' },
  { name: 'Çay', cycle: 'perennial' },
  { name: 'Çayır Otu', cycle: 'perennial' },
  { name: 'Çemen', cycle: 'annual' },
  { name: 'Çerezlik Kabak', cycle: 'annual' },
  { name: 'Çilek', cycle: 'perennial' },
  { name: 'Çörek Otu', cycle: 'annual' },
  { name: 'Çöven', cycle: 'perennial' },
  { name: 'Çukurova Pamuğu', cycle: 'annual' },
  { name: 'Darı', cycle: 'annual' },
  { name: 'Defne', cycle: 'perennial' },
  { name: 'Dereotu', cycle: 'annual' },
  { name: 'Domates', cycle: 'annual' },
  { name: 'Dut', cycle: 'perennial' },
  { name: 'Elma', cycle: 'perennial' },
  { name: 'Enginar', cycle: 'perennial' },
  { name: 'Erik', cycle: 'perennial' },
  { name: 'Fasulye', cycle: 'annual' },
  { name: 'Fiğ', cycle: 'annual' },
  { name: 'Fındık', cycle: 'perennial' },
  { name: 'Frenk Üzümü', cycle: 'perennial' },
  { name: 'Gazanya', cycle: 'perennial' },
  { name: 'Geven', cycle: 'perennial' },
  { name: 'Greyfurt', cycle: 'perennial' },
  { name: 'Gül', cycle: 'perennial' },
  { name: 'Havuç', cycle: 'annual' },
  { name: 'Haşhaş', cycle: 'annual' },
  { name: 'Hıyar', cycle: 'annual' },
  { name: 'Hindiba', cycle: 'perennial' },
  { name: 'Hünnap', cycle: 'perennial' },
  { name: 'Ispanak', cycle: 'annual' },
  { name: 'Isırgan', cycle: 'perennial' },
  { name: 'İğde', cycle: 'perennial' },
  { name: 'İncir', cycle: 'perennial' },
  { name: 'İtalyan Çimi', cycle: 'annual' },
  { name: 'Kabak', cycle: 'annual' },
  { name: 'Karnabahar', cycle: 'annual' },
  { name: 'Karpuz', cycle: 'annual' },
  { name: 'Kavun', cycle: 'annual' },
  { name: 'Kayısı', cycle: 'perennial' },
  { name: 'Keçiboynuzu', cycle: 'perennial' },
  { name: 'Kekik', cycle: 'perennial' },
  { name: 'Kereviz', cycle: 'annual' },
  { name: 'Keten', cycle: 'annual' },
  { name: 'Kestane', cycle: 'perennial' },
  { name: 'Kırmızı Lahana', cycle: 'annual' },
  { name: 'Kiraz', cycle: 'perennial' },
  { name: 'Kişniş', cycle: 'annual' },
  { name: 'Kivi', cycle: 'perennial' },
  { name: 'Kolza (Kanola)', cycle: 'annual' },
  { name: 'Korunga', cycle: 'perennial' },
  { name: 'Kuşkonmaz', cycle: 'perennial' },
  { name: 'Kuş Üzümü', cycle: 'perennial' },
  { name: 'Kuru Fasulye', cycle: 'annual' },
  { name: 'Lavanta', cycle: 'perennial' },
  { name: 'Limon', cycle: 'perennial' },
  { name: 'Macar Fiği', cycle: 'annual' },
  { name: 'Mandalina', cycle: 'perennial' },
  { name: 'Marul', cycle: 'annual' },
  { name: 'Mercanköşk', cycle: 'perennial' },
  { name: 'Mercimek', cycle: 'annual' },
  { name: 'Mısır', cycle: 'annual' },
  { name: 'Muşmula', cycle: 'perennial' },
  { name: 'Mürdümük', cycle: 'annual' },
  { name: 'Nane', cycle: 'perennial' },
  { name: 'Nar', cycle: 'perennial' },
  { name: 'Nektarin', cycle: 'perennial' },
  { name: 'Nohut', cycle: 'annual' },
  { name: 'Pamuk', cycle: 'annual' },
  { name: 'Pancar', cycle: 'annual' },
  { name: 'Patates', cycle: 'annual' },
  { name: 'Patlıcan', cycle: 'annual' },
  { name: 'Pazı', cycle: 'annual' },
  { name: 'Pekan Cevizi', cycle: 'perennial' },
  { name: 'Pırasa', cycle: 'annual' },
  { name: 'Portakal', cycle: 'perennial' },
  { name: 'Reyhan', cycle: 'annual' },
  { name: 'Roka', cycle: 'annual' },
  { name: 'Safran', cycle: 'perennial' },
  { name: 'Sarımsak', cycle: 'annual' },
  { name: 'Semizotu', cycle: 'annual' },
  { name: 'Şeftali', cycle: 'perennial' },
  { name: 'Şeker Pancarı', cycle: 'annual' },
  { name: 'Şeker Mısırı', cycle: 'annual' },
  { name: 'Susam', cycle: 'annual' },
  { name: 'Soya Fasulyesi', cycle: 'annual' },
  { name: 'Soğan', cycle: 'annual' },
  { name: 'Sorgum', cycle: 'annual' },
  { name: 'Sudan Otu', cycle: 'annual' },
  { name: 'Taflan', cycle: 'perennial' },
  { name: 'Tarhun', cycle: 'perennial' },
  { name: 'Tatlı Patates', cycle: 'annual' },
  { name: 'Tere', cycle: 'annual' },
  { name: 'Tıbbi Papatya', cycle: 'annual' },
  { name: 'Tritikale', cycle: 'annual' },
  { name: 'Turp', cycle: 'annual' },
  { name: 'Trabzon Hurması', cycle: 'perennial' },
  { name: 'Üçgül', cycle: 'perennial' },
  { name: 'Üzüm', cycle: 'perennial' },
  { name: 'Vişne', cycle: 'perennial' },
  { name: 'Yaban Mersini', cycle: 'perennial' },
  { name: 'Yer Elması', cycle: 'perennial' },
  { name: 'Yer Fıstığı', cycle: 'annual' },
  { name: 'Yonca', cycle: 'perennial' },
  { name: 'Yulaf', cycle: 'annual' },
  { name: 'Zeytin', cycle: 'perennial' },
].sort((a, b) =>
  a.name.localeCompare(b.name, 'tr-TR', {
    sensitivity: 'base',
    numeric: true,
  }),
);

const TURKEY_CROP_PICKER_OPTIONS = TURKEY_CROPS.map((crop) => ({
  value: crop.name,
  label: crop.name,
}));

const onboardingQuestions = [
  {
    title: 'TarlaPusula’yı nasıl kullanacaksın?',
    subtitle: 'Sana en uygun deneyimi sunmak için öğrenmek istiyoruz.',
    multi: false,
    options: [
      ['👨‍🌾', 'Üreticiyim'],
      ['👨‍🔬', 'Ziraat uzmanı / danışmanım'],
      ['🛒', 'Ürün almak için kullanacağım'],
      ['👀', 'Şimdilik inceliyorum'],
    ],
  },
  {
    title: 'Ne yetiştiriyorsun?',
    subtitle: 'Birden fazla alan seçebilirsin.',
    multi: true,
    options: [
      ['🌾', 'Tarla bitkileri'],
      ['🍇', 'Bağ'],
      ['🌳', 'Bahçe'],
      ['🥬', 'Sebze'],
      ['🌱', 'Birden fazla'],
    ],
  },
  {
    title: 'Hangi ürünleri yetiştiriyorsun?',
    subtitle: 'Birden fazla seçebilirsin.',
    multi: true,
    options: [
      ['🌾', 'Buğday / Arpa'],
      ['🌽', 'Mısır'],
      ['🌻', 'Ayçiçeği'],
      ['🌾', 'Çeltik'],
      ['🍇', 'Bağ / Üzüm'],
      ['🍊', 'Turunçgiller'],
      ['🌰', 'Fındık'],
      ['🌳', 'Antep Fıstığı'],
      ['🫒', 'Zeytin'],
      ['🍎', 'Meyve / Meyve Bahçesi'],
      ['🥬', 'Sebze'],
      ['🌱', 'Baklagiller'],
      ['➕', 'Diğer ürün'],
    ],
  },
  {
    title: 'Yaklaşık ne kadar alanda üretim yapıyorsun?',
    subtitle: 'Bu bilgi yalnızca deneyimi kişiselleştirmek için kullanılacak.',
    multi: false,
    options: [
      ['📐', '0 - 50 da'],
      ['📐', '51 - 200 da'],
      ['📐', '201 - 500 da'],
      ['📐', '500+ da'],
    ],
  },
  {
    title: 'En çok hangi konularda yardımcı olalım?',
    subtitle: 'İstediğin kadarını seçebilirsin.',
    multi: true,
    options: [
      ['🌦️', 'Hava & risk'],
      ['🐛', 'Hastalık & zararlı'],
      ['🧪', 'Gübre / toprak'],
      ['💰', 'Maliyet yönetimi'],
      ['📈', 'Piyasa takibi'],
      ['🏛️', 'Destekler / teşvikler'],
    ],
  },
];



type CmsPageRow = {
  id: string;
  page_key: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  icon_size: number;
  icon_position: string;
  menu_order: number;
  is_visible: boolean;
  layout: string;
  columns_desktop: number;
  columns_tablet: number;
  columns_mobile: number;
  padding_top: number;
  padding_bottom: number;
  background_type: string;
  background_value: string | null;
};

type CmsBlockRow = {
  id: string;
  page_key: string;
  block_key: string;
  block_type: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  icon: string | null;
  icon_size: number;
  icon_position: string;
  image_path: string | null;
  image_url: string | null;
  button_text: string | null;
  button_action: string | null;
  button_target: string | null;
  position: number;
  width_desktop: number;
  width_tablet: number;
  width_mobile: number;
  align_horizontal: string;
  align_vertical: string;
  is_visible: boolean;
  style_config: Record<string, any>;
  content_data: Record<string, any>;
};

type CmsMenuRow = {
  id: string;
  menu_key: string;
  page_key: string | null;
  label: string;
  icon: string | null;
  position: number;
  is_visible: boolean;
  badge_text: string | null;
  badge_type: string | null;
  parent_menu_key: string | null;
  show_desktop: boolean;
  show_mobile: boolean;
  show_bottom_nav: boolean;
  admin_only: boolean;
};

type CmsMediaRow = {
  id: string;
  title: string | null;
  alt_text: string | null;
  file_path: string;
  public_url: string;
  mime_type: string | null;
  category: string;
  created_at: string;
};

const CMS_DEFAULT_PAGES: Array<{ page_key:string; title:string; subtitle:string; icon:string; menu_order:number }> = [
  { page_key:'home', title:'Ana Sayfa', subtitle:'TarlaPusula ana ekranı ve günlük üretici özeti.', icon:'⌂', menu_order:1 },
  { page_key:'aiAnalysis', title:'AI Analiz', subtitle:'Tarla fotoğrafını yapay zekâ ile ön analiz et.', icon:'✦', menu_order:2 },
  { page_key:'calendar', title:'Takvim', subtitle:'Tarla işlerini ve hatırlatmaları takvimden takip et.', icon:'▣', menu_order:16 },
  { page_key:'weatherHub', title:'Hava Durumu', subtitle:'Tarlalarına özel tahminleri ve üretici özetini tek ekranda takip et.', icon:'☀️', menu_order:3 },
  { page_key:'fieldControlHub', title:'Tarla Kontrolü', subtitle:'Uydu görünümü, saha kayıtları ve gelişim durumunu birlikte değerlendir.', icon:'🛰️', menu_order:4 },
  { page_key:'soilAnalysisHub', title:'Toprak Analizi', subtitle:'Toprak analizlerini ve önerileri yönet.', icon:'🧪', menu_order:5 },
  { page_key:'inventoryHub', title:'İlaç & Gübre Depom', subtitle:'Stoklarını, son kullanma tarihlerini ve tarla kullanımını takip et.', icon:'📦', menu_order:6 },
  { page_key:'marketHub', title:'Piyasa Fiyatları', subtitle:'Ürün, mazot ve gübre fiyatlarını tek ekranda karşılaştır.', icon:'📈', menu_order:7 },
  { page_key:'supportHub', title:'Tarımsal Destek', subtitle:'Tarlan ve ürününe göre destekleri görüntüle ve tahmini tutarı hesapla.', icon:'🧮', menu_order:8 },
  { page_key:'agendaHub', title:'Tarım Gündemi', subtitle:'Yeni çeşitler, destekler, hastalık uyarıları ve tarımsal gelişmeler.', icon:'📰', menu_order:9 },
  { page_key:'nutritionHub', title:'Bitki Besin Maddeleri Rehberi', subtitle:'Besin elementlerini, eksiklik belirtilerini ve gübre kaynaklarını öğren.', icon:'🌿', menu_order:10 },
  { page_key:'pestGuideHub', title:'Hastalık & Zararlı Rehberi', subtitle:'Ürününe göre hastalıkları, zararlıları ve yabancı otları keşfet.', icon:'🐞', menu_order:11 },
  { page_key:'producerMarketHub', title:'Üretici Pazarı', subtitle:'Ürün ilanlarını keşfet, kendi ilanını oluştur ve üreticilerle iletişim kur.', icon:'🛒', menu_order:12 },
  { page_key:'fieldNotebookHub', title:'Tarla Defteri', subtitle:'Ekimden hasada tüm faaliyetleri ve sezon geçmişini kayıt altında tut.', icon:'📒', menu_order:13 },
  { page_key:'notificationsHub', title:'Bildirimler', subtitle:'Tarlaların, hava durumu ve önemli tarımsal gelişmeler için uyarılarını yönet.', icon:'🔔', menu_order:14 },
  { page_key:'settingsHub', title:'Ayarlar', subtitle:'Hesap, bildirim, konum ve uygulama tercihlerini yönet.', icon:'⚙️', menu_order:15 },
  { page_key:'adminHub', title:'İçerik Yönetimi', subtitle:'TarlaPusula uygulamasındaki ekranları, görselleri ve içerikleri yönet.', icon:'🛡️', menu_order:99 },
];
const CMS_DEFAULT_MENUS = [
  ['home-main','home','Ana Sayfa','⌂',1,null,false], ['fields-main','home','Tarlalarım','▦',2,null,false], ['weather-main','weatherHub','Hava Durumu','☀',3,null,false], ['field-control-main','fieldControlHub','Tarla Kontrolü','⌖',4,null,false], ['soil-main','soilAnalysisHub','Toprak Analizi','♧',5,null,false], ['inventory-main','inventoryHub','İlaç & Gübre Depom','▣',6,null,false], ['market-main','marketHub','Piyasa Fiyatları','▥',7,null,false], ['support-main','supportHub','Tarımsal Destek','▤',8,null,false], ['agenda-main','agendaHub','Tarım Gündemi','♧',9,'YENİ',false], ['nutrition-main','nutritionHub','Bitki Besin Maddeleri','◉',10,'YENİ',false], ['pest-main','pestGuideHub','Hastalık & Zararlı Rehberi','✥',11,null,false], ['producer-market-main','producerMarketHub','Üretici Pazarı','▱',12,'YENİ',false], ['notebook-main','fieldNotebookHub','Tarla Defteri','▧',13,null,false], ['notifications-main','notificationsHub','Bildirimler','♢',14,null,false], ['settings-main','settingsHub','Ayarlar','⚙',15,null,false], ['admin-main','adminHub','Yönetim','◆',99,'ADMIN',true],
 ['ai-main','aiAnalysis','AI Analiz','✦',101,null,false],['calendar-main','calendar','Takvim','▣',102,null,false],['more-main','settingsHub','Daha Fazla','•••',103,null,false],
] as const;
const CMS_DEFAULT_BLOCKS = [
 ['home','topbar-brand','TARLAPUSULA',0],
 ['home','hero','Bugünün tarla planı hazır.',1],
 ['home','daily-plan','Bugünkü Tarla Planın',2],
 ['home','plan-weather','Hava Durumu',21],
 ['home','plan-field-control','Tarla Kontrolü',22],
 ['home','plan-soil','Toprak Analizi',23],
 ['home','plan-inventory','İlaç & Gübre',24],
 ['home','plan-notebook','Tarla Günlüğü',25],
 ['home','selected-field','Seçili Tarlan',26],
 ['home','quick-actions','Hızlı İşlemler',3],
 ['home','quick-fields','Tarlalarım',31],
 ['home','quick-ai','Fotoğraf Analizi',32],
 ['home','quick-inventory','Depoma Ürün Ekle',33],
 ['home','quick-notebook','Gider / Kayıt Ekle',34],
 ['home','quick-soil','Toprak Analizi',35],
 ['home','fields-shortcut','Tarlalarım',36],
 ['home','status-summary','Tarla Durum Özeti',37],
 ['home','status-good','İyi',371],
 ['home','status-check','Kontrol Et',372],
 ['home','status-urgent','İlgilen',373],
 ['home','fields','Tarlalarım',4],
 ['weatherHub','forecast','5 Günlük Tahmin',1],['weatherHub','rain-humidity','Yağış & Nem',2],['weatherHub','producer-summary','Üretici Özeti',3],
 ['fieldControlHub','satellite','Uydu Görünümü',1],['fieldControlHub','field-check','Saha Kontrolü',2],['fieldControlHub','risk-zones','Risk Bölgeleri',3],
 ['inventoryHub','fertilizer-stock','Gübre Stoğu',1],['inventoryHub','pesticide-stock','İlaç Stoğu',2],['inventoryHub','smart-reminder','Akıllı Hatırlatma',3],
 ['marketHub','crop-prices','Ürün Fiyatları',1],['marketHub','diesel-prices','Mazot Fiyatları',2],['marketHub','fertilizer-prices','Gübre Fiyatları',3],
 ['supportHub','support-calc','Destek Hesapla',1],['supportHub','support-2026','2026 Destekleri',2],['supportHub','application-rules','Başvuru Koşulları',3],
 ['agendaHub','new-varieties','Yeni Çeşitler',1],['agendaHub','regulation','Destek & Mevzuat',2],['agendaHub','developments','Tarımsal Gelişmeler',3],
 ['nutritionHub','nutrition-management','Besin Yönetimi',1],['nutritionHub','deficiency','Eksiklik Belirtileri',2],['nutritionHub','fertilizers','Temel Gübreler',3],
 ['pestGuideHub','diseases','Hastalıklar',1],['pestGuideHub','pests','Zararlılar',2],['pestGuideHub','weeds','Yabancı Otlar',3],
 ['producerMarketHub','discover','Keşfet',1],['producerMarketHub','create-listing','İlan Ver',2],['producerMarketHub','my-listings','İlanlarım',3],
 ['fieldNotebookHub','add-activity','Faaliyet Ekle',1],['fieldNotebookHub','season-history','Sezon Geçmişi',2],['fieldNotebookHub','expenses','Gider Kayıtları',3],
 ['notificationsHub','field-alerts','Tarla Uyarıları',1],['notificationsHub','weather-alerts','Hava Uyarıları',2],['notificationsHub','price-alerts','Fiyat Alarmları',3],
 ['settingsHub','account','Hesap',1],['settingsHub','notification-settings','Bildirim Tercihleri',2],['settingsHub','app-settings','Uygulama Ayarları',3],
 ['calendar','page-header','Takvim & Hatırlatmalar',1],['calendar','hero','Tarladaki işleri zamanı gelmeden hatırla.',2],['calendar','push-card','Telefon Bildirimleri',3],['calendar','toolbar','Tarla görevleri',4],
 ['aiAnalysis','page-header','Fotoğraftan Ön Analiz',1],['aiAnalysis','hero','Fotoğrafı çek, tarladaki belirtiyi birlikte inceleyelim.',2],['aiAnalysis','access','Kullanım Hakkı',3],['aiAnalysis','field-step','Analizin hangi tarlaya ait?',4],['aiAnalysis','photo-step','Belirtiyi net gösteren bir görüntü ekle',5],['aiAnalysis','photo-picker','Fotoğraf Çek / Galeriden Seç',6],['aiAnalysis','note','Gözlemin (isteğe bağlı)',7],['aiAnalysis','analyze-button','AI ile Analiz Et',8],
 ['fieldControlHub','page-header','Tarla Kontrolü',10],['fieldControlHub','hero','Tarlanı yukarıdan, daha net gör.',11],['fieldControlHub','start-analysis','Uydu analizi hazır',12],['fieldControlHub','recommendations','Önerilen İşlemler',13],['fieldControlHub','refresh','Yenile',14],
 ['weatherHub','page-header','Hava Durumu',10],['weatherHub','hero','Hava Durumu',11],['weatherHub','forecast-title','5 Günlük Tahmin',12],['weatherHub','producer-summary-title','Üretici Özeti',13],
] as const;

const emitCmsUpdated = () => {
  window.dispatchEvent(new Event('tp-cms-updated'));
};

function AdminPageBuilder({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'pages' | 'menu' | 'media' | 'theme'>('pages');
  const [pages, setPages] = useState<CmsPageRow[]>([]);
  const [blocks, setBlocks] = useState<CmsBlockRow[]>([]);
  const [menus, setMenus] = useState<CmsMenuRow[]>([]);
  const [media, setMedia] = useState<CmsMediaRow[]>([]);
  const [selectedPageKey, setSelectedPageKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pageModal, setPageModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [editingPage, setEditingPage] = useState<Partial<CmsPageRow> | null>(null);
  const [editingBlock, setEditingBlock] = useState<Partial<CmsBlockRow> | null>(null);
  const [editingMenu, setEditingMenu] = useState<Partial<CmsMenuRow> | null>(null);
  const [theme, setTheme] = useState<Record<string, any>>({ borderRadius:18, cardGap:16, contentMaxWidth:1440, sidebarWidth:260, mobileBottomNavHeight:72, fontScale:1 });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaAlt, setMediaAlt] = useState('');
  const [mediaCategory, setMediaCategory] = useState('general');

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [pageRes, blockRes, menuRes, themeRes, mediaRes] = await Promise.all([
        supabase.from('app_pages').select('*').order('menu_order'),
        supabase.from('app_blocks').select('*').order('position'),
        supabase.from('app_menu_items').select('*').order('position'),
        supabase.from('app_theme_settings').select('setting_value').eq('setting_key','global').maybeSingle(),
        supabase.from('app_media').select('*').order('created_at', { ascending:false }),
      ]);
      if (pageRes.error) throw pageRes.error;
      if (blockRes.error) throw blockRes.error;
      if (menuRes.error) throw menuRes.error;
      if (themeRes.error) throw themeRes.error;
      if (mediaRes.error) throw mediaRes.error;
      const nextPages = (pageRes.data ?? []) as CmsPageRow[];
      setPages(nextPages);
      setBlocks((blockRes.data ?? []) as CmsBlockRow[]);
      setMenus((menuRes.data ?? []) as CmsMenuRow[]);
      setMedia((mediaRes.data ?? []) as CmsMediaRow[]);
      if (themeRes.data?.setting_value) setTheme(themeRes.data.setting_value as Record<string, any>);
      if (!selectedPageKey && nextPages.length) setSelectedPageKey(nextPages[0].page_key);
    } catch (error:any) {
      setMessage(error?.message || 'Yönetim verileri yüklenemedi.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const importCurrentAppToCms = async () => {
    setSaving(true); setMessage('Mevcut TarlaPusula ekranları CMS’ye aktarılıyor...');
    try {
      const pagePayload = CMS_DEFAULT_PAGES.map(p=>({...p,icon_size:22,icon_position:'left',is_visible:true,layout:'grid',columns_desktop:3,columns_tablet:2,columns_mobile:1,padding_top:24,padding_bottom:24,background_type:'default'}));
      const { error:pageError } = await supabase.from('app_pages').upsert(pagePayload,{onConflict:'page_key',ignoreDuplicates:true}); if(pageError) throw pageError;
      const menuPayload = CMS_DEFAULT_MENUS.map(([menu_key,page_key,label,icon,position,badge_text,admin_only])=>({menu_key,page_key,label,icon,position,badge_text,badge_type:badge_text?'info':null,parent_menu_key:null,is_visible:true,show_desktop:true,show_mobile:true,show_bottom_nav:false,admin_only}));
      const { error:menuError } = await supabase.from('app_menu_items').upsert(menuPayload,{onConflict:'menu_key',ignoreDuplicates:true}); if(menuError) throw menuError;
      const HOME_BLOCK_PRESETS: Record<string, Partial<CmsBlockRow>> = {
        'topbar-brand': { icon:'🧭' },
        'hero': { icon:'🌿', subtitle:'Tarlana ait önemli bilgileri tek ekranda takip et.' },
        'daily-plan': { subtitle:'Öncelikli kontroller ve hızlı işlemler' },
        'plan-weather': { icon:'🌦️', subtitle:'3 kaynaktan güncel tahmini kontrol et.' },
        'plan-field-control': { icon:'🛰️', subtitle:'Sentinel-2 ile bitki gelişimini ve zayıf bölgeleri kontrol et.' },
        'plan-soil': { icon:'🧪', subtitle:'Numune ve analiz kayıtlarını gözden geçir.' },
        'plan-inventory': { icon:'📦', subtitle:'Depo stoklarını ve uygulama planını kontrol et.' },
        'plan-notebook': { icon:'📝', subtitle:'Bugünkü işlemleri kaydet ve geçmişi takip et.' },
        'selected-field': { icon:'🌾', button_text:'Detayları Gör' },
        'quick-fields': { icon:'🌾' }, 'quick-ai': { icon:'📷' }, 'quick-inventory': { icon:'📦' }, 'quick-notebook': { icon:'📝' }, 'quick-soil': { icon:'🧪' },
        'fields-shortcut': { icon:'🌾', button_text:'Tümünü Gör →' },
        'status-good': { subtitle:'Her şey yolunda' }, 'status-check': { subtitle:'Kontrol öneriliyor' }, 'status-urgent': { subtitle:'Öncelikli durum' },
        'fields': { button_text:'+ Tarla Ekle' },
      };
      const blockPayload = CMS_DEFAULT_BLOCKS.map(([page_key,block_key,title,position])=>({page_key,block_key,title,position,block_type:'card',icon_size:22,icon_position:'left',width_desktop:1,width_tablet:1,width_mobile:1,align_horizontal:'left',align_vertical:'center',is_visible:true,style_config:{},content_data:{}, ...(page_key==='home' ? (HOME_BLOCK_PRESETS[block_key] || {}) : {})}));

      // app_blocks.page_key -> app_pages.page_key foreign key olduğu için,
      // blok eklemeden önce blokların referans verdiği tüm sayfaların varlığını garanti et.
      const existingPageKeys = new Set(pagePayload.map((page) => page.page_key));
      const fallbackPages = Array.from(new Set(blockPayload.map((block) => block.page_key)))
        .filter((pageKey) => !existingPageKeys.has(pageKey))
        .map((pageKey, index) => ({
          page_key: pageKey,
          title: pageKey === 'aiAnalysis' ? 'AI Analiz' : pageKey === 'calendar' ? 'Takvim' : pageKey,
          subtitle: null,
          icon: pageKey === 'aiAnalysis' ? '✦' : pageKey === 'calendar' ? '▣' : '▦',
          icon_size: 22,
          icon_position: 'left',
          menu_order: 200 + index,
          is_visible: true,
          layout: 'grid',
          columns_desktop: 3,
          columns_tablet: 2,
          columns_mobile: 1,
          padding_top: 24,
          padding_bottom: 24,
          background_type: 'default',
          background_value: null,
        }));

      if (fallbackPages.length) {
        const { error: fallbackPageError } = await supabase
          .from('app_pages')
          .upsert(fallbackPages, { onConflict:'page_key', ignoreDuplicates:true });
        if (fallbackPageError) throw fallbackPageError;
      }

      const { error:blockError } = await supabase.from('app_blocks').upsert(blockPayload,{onConflict:'page_key,block_key',ignoreDuplicates:true}); if(blockError) throw blockError;
      setMessage('Aktarım tamamlandı. Ana sayfa dahil CMS değişiklikleri uygulamaya bağlandı.'); await loadAll();
    } catch(error:any){ setMessage(error?.message || 'Aktarım başarısız.'); } finally { setSaving(false); }
  };

  const savePage = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPage?.page_key?.trim() || !editingPage?.title?.trim()) return setMessage('Sayfa anahtarı ve başlık gerekli.');
    setSaving(true); setMessage('');
    try {
      const payload = {
        page_key: editingPage.page_key.trim(), title: editingPage.title.trim(), subtitle: editingPage.subtitle || null,
        icon: editingPage.icon || null, icon_size:Number(editingPage.icon_size ?? 22), icon_position:editingPage.icon_position || 'left',
        menu_order:Number(editingPage.menu_order ?? 0), is_visible:editingPage.is_visible ?? true, layout:editingPage.layout || 'grid',
        columns_desktop:Number(editingPage.columns_desktop ?? 3), columns_tablet:Number(editingPage.columns_tablet ?? 2), columns_mobile:Number(editingPage.columns_mobile ?? 1),
        padding_top:Number(editingPage.padding_top ?? 24), padding_bottom:Number(editingPage.padding_bottom ?? 24),
        background_type:editingPage.background_type || 'default', background_value:editingPage.background_value || null,
      };
      const query = editingPage.id ? supabase.from('app_pages').update(payload).eq('id', editingPage.id) : supabase.from('app_pages').insert(payload);
      const { error } = await query; if (error) throw error;
      setPageModal(false); setEditingPage(null); setMessage('Sayfa kaydedildi.'); await loadAll(); emitCmsUpdated();
    } catch (error:any) { setMessage(error?.message || 'Sayfa kaydedilemedi.'); } finally { setSaving(false); }
  };

  const saveBlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBlock?.page_key || !editingBlock?.block_key?.trim()) return setMessage('Sayfa ve blok anahtarı gerekli.');
    setSaving(true); setMessage('');
    try {
      const payload = {
        page_key:editingBlock.page_key, block_key:editingBlock.block_key.trim(), block_type:editingBlock.block_type || 'card',
        title:editingBlock.title || null, subtitle:editingBlock.subtitle || null, description:editingBlock.description || null,
        icon:editingBlock.icon || null, icon_size:Number(editingBlock.icon_size ?? 22), icon_position:editingBlock.icon_position || 'left',
        image_path:editingBlock.image_path || null, image_url:editingBlock.image_url || null,
        button_text:editingBlock.button_text || null, button_action:editingBlock.button_action || null, button_target:editingBlock.button_target || null,
        position:Number(editingBlock.position ?? 0), width_desktop:Number(editingBlock.width_desktop ?? 1), width_tablet:Number(editingBlock.width_tablet ?? 1), width_mobile:Number(editingBlock.width_mobile ?? 1),
        align_horizontal:editingBlock.align_horizontal || 'left', align_vertical:editingBlock.align_vertical || 'center', is_visible:editingBlock.is_visible ?? true,
        style_config:editingBlock.style_config ?? {}, content_data:editingBlock.content_data ?? {},
      };
      const query = editingBlock.id ? supabase.from('app_blocks').update(payload).eq('id', editingBlock.id) : supabase.from('app_blocks').insert(payload);
      const { error } = await query; if (error) throw error;
      setBlockModal(false); setEditingBlock(null); setMessage('Blok kaydedildi.'); await loadAll(); emitCmsUpdated();
    } catch (error:any) { setMessage(error?.message || 'Blok kaydedilemedi.'); } finally { setSaving(false); }
  };

  const saveMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingMenu?.menu_key?.trim() || !editingMenu?.label?.trim()) return setMessage('Menü anahtarı ve adı gerekli.');
    setSaving(true); setMessage('');
    try {
      const payload = {
        menu_key:editingMenu.menu_key.trim(), page_key:editingMenu.page_key || null, label:editingMenu.label.trim(), icon:editingMenu.icon || null,
        position:Number(editingMenu.position ?? 0), is_visible:editingMenu.is_visible ?? true, badge_text:editingMenu.badge_text || null,
        badge_type:editingMenu.badge_type || null, parent_menu_key:editingMenu.parent_menu_key || null,
        show_desktop:editingMenu.show_desktop ?? true, show_mobile:editingMenu.show_mobile ?? true,
        show_bottom_nav:editingMenu.show_bottom_nav ?? false, admin_only:editingMenu.admin_only ?? false,
      };
      const query = editingMenu.id ? supabase.from('app_menu_items').update(payload).eq('id', editingMenu.id) : supabase.from('app_menu_items').insert(payload);
      const { error } = await query; if (error) throw error;
      setMenuModal(false); setEditingMenu(null); setMessage('Menü kaydedildi.'); await loadAll(); emitCmsUpdated();
    } catch (error:any) { setMessage(error?.message || 'Menü kaydedilemedi.'); } finally { setSaving(false); }
  };

  const saveTheme = async () => {
    setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('app_theme_settings').upsert({ setting_key:'global', setting_value:theme }, { onConflict:'setting_key' });
      if (error) throw error; setMessage('Tema ayarları kaydedildi.'); emitCmsUpdated();
    } catch (error:any) { setMessage(error?.message || 'Tema kaydedilemedi.'); } finally { setSaving(false); }
  };

  const uploadMedia = async (e: FormEvent) => {
    e.preventDefault(); if (!mediaFile) return setMessage('Önce bir görsel seç.');
    setSaving(true); setMessage('');
    try {
      const { data:{ user }, error:userError } = await supabase.auth.getUser(); if (userError) throw userError; if (!user) throw new Error('Oturum bulunamadı.');
      const safe = mediaFile.name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9._-]+/g,'-');
      const path = `media/${Date.now()}-${safe}`;
      const { error:uploadError } = await supabase.storage.from('app-images').upload(path, mediaFile, { upsert:false }); if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from('app-images').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('app_media').insert({ title:mediaTitle || mediaFile.name, alt_text:mediaAlt || null, file_path:path, public_url:publicUrl, mime_type:mediaFile.type, file_size:mediaFile.size, category:mediaCategory, created_by:user.id });
      if (error) { await supabase.storage.from('app-images').remove([path]); throw error; }
      setMediaFile(null); setMediaTitle(''); setMediaAlt(''); setMediaCategory('general'); setMessage('Görsel yüklendi.'); await loadAll();
    } catch (error:any) { setMessage(error?.message || 'Görsel yüklenemedi.'); } finally { setSaving(false); }
  };

  const removeRow = async (table:string, id:string, label:string) => {
    if (!window.confirm(`${label} silinsin mi?`)) return;
    const { error } = await supabase.from(table).delete().eq('id',id); if (error) setMessage(error.message); else await loadAll();
  };

  const selectedBlocks = blocks.filter(x => x.page_key === selectedPageKey).sort((a,b)=>a.position-b.position);
  const cardStyle: React.CSSProperties = { background:'#fff',border:'1px solid #dfe7df',borderRadius:16,padding:16,boxShadow:'0 8px 22px rgba(22,60,39,.04)' };
  const inputStyle: React.CSSProperties = { width:'100%',height:40,border:'1px solid #d7e1d8',borderRadius:10,padding:'0 11px',boxSizing:'border-box',font:'inherit',background:'#fff' };
  const labelStyle: React.CSSProperties = { display:'grid',gap:5,fontSize:11,fontWeight:800,color:'#31493a' };
  const buttonStyle: React.CSSProperties = { minHeight:38,border:'1px solid #d8e2d9',borderRadius:10,background:'#fff',padding:'0 12px',fontWeight:800,cursor:'pointer',color:'#294436' };

  const Modal = ({ title, onClose, children }:{ title:string; onClose:()=>void; children:any }) => (
    <div onMouseDown={e=>{ if(e.target===e.currentTarget && !saving) onClose(); }} style={{position:'fixed',inset:0,zIndex:10000,background:'rgba(9,30,20,.55)',backdropFilter:'blur(5px)',display:'grid',placeItems:'center',padding:16}}>
      <div style={{width:'min(720px,100%)',maxHeight:'92vh',overflow:'auto',background:'#fff',borderRadius:20,boxShadow:'0 30px 80px rgba(0,0,0,.28)'}}>
        <div style={{position:'sticky',top:0,zIndex:2,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'15px 18px',background:'#fff',borderBottom:'1px solid #e7ede7'}}><strong>{title}</strong><button onClick={onClose} style={{...buttonStyle,width:36,padding:0,fontSize:18}}>×</button></div>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#f4f7f3',color:'#173526',fontFamily:'Inter,system-ui,sans-serif'}}>
      <header style={{height:64,background:'#fff',borderBottom:'1px solid #e2e9e2',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',position:'sticky',top:0,zIndex:30}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><button onClick={onBack} style={{...buttonStyle,width:38,padding:0}}>←</button><div><strong style={{display:'block'}}>TarlaPusula Yönetim</strong><small style={{color:'#7c8b82'}}>Sayfa tasarımcısı ve içerik merkezi</small></div></div>
        <span style={{padding:'6px 10px',borderRadius:999,background:'#e8f3eb',color:'#266a3e',fontSize:11,fontWeight:900}}>TAM YETKİ • ADMIN</span>
      </header>
      <main style={{width:'min(1180px,calc(100% - 26px))',margin:'0 auto',padding:'20px 0 70px'}}>
        <section style={{...cardStyle,background:'linear-gradient(135deg,#153b29,#2f6545)',color:'#fff',border:0,padding:22}}>
          <small style={{opacity:.72,fontWeight:900,letterSpacing:1}}>TARLAPUSULA CMS</small><h1 style={{margin:'6px 0 7px',fontSize:27}}>Uygulamayı panelden yönet</h1><p style={{margin:0,opacity:.8,maxWidth:760}}>Sayfalar, kartlar, ikonlar, sıralama, görünürlük, menüler, mobil/masaüstü yerleşimi, görseller ve genel ölçüler burada yönetilir.</p><div style={{marginTop:14,display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" disabled={saving} onClick={importCurrentAppToCms} style={{...buttonStyle,background:'#fff',color:'#1f5a38',borderColor:'rgba(255,255,255,.75)'}}>↻ Mevcut Uygulamayı CMS’ye Aktar</button><span style={{fontSize:12,opacity:.78,alignSelf:'center'}}>İlk kurulumda bir kez çalıştırman yeterli.</span></div>
        </section>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}>
          {([['pages','▦ Sayfa Tasarımcısı'],['menu','☰ Menü Yönetimi'],['media','🖼 Görseller'],['theme','⚙ Tema & Ölçüler']] as const).map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{...buttonStyle,background:tab===key?'#1f5a38':'#fff',color:tab===key?'#fff':'#294436',borderColor:tab===key?'#1f5a38':'#d8e2d9'}}>{label}</button>)}
        </div>
        {message && <div style={{...cardStyle,padding:'10px 13px',marginBottom:12,color:'#315a42'}}>{message}</div>}
        {loading ? <div style={cardStyle}>Yönetim verileri yükleniyor...</div> : null}

        {!loading && tab==='pages' && <div style={{display:'grid',gridTemplateColumns:'minmax(220px,310px) minmax(0,1fr)',gap:14,alignItems:'start'}}>
          <aside style={cardStyle}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}><strong>Sayfalar</strong><button style={buttonStyle} onClick={()=>{setEditingPage({page_key:'',title:'',icon:'▦',icon_size:22,icon_position:'left',menu_order:pages.length,is_visible:true,layout:'grid',columns_desktop:3,columns_tablet:2,columns_mobile:1,padding_top:24,padding_bottom:24,background_type:'default'});setPageModal(true)}}>＋ Ekle</button></div>
            <div style={{display:'grid',gap:7}}>{pages.length===0 && <small style={{color:'#7e8b83'}}>Henüz sayfa kaydı yok. İlk sayfayı ekleyebilirsin.</small>}{pages.map(p=><button key={p.id} onClick={()=>setSelectedPageKey(p.page_key)} style={{...buttonStyle,height:'auto',padding:'10px',display:'flex',justifyContent:'space-between',textAlign:'left',background:selectedPageKey===p.page_key?'#eef6f0':'#fff'}}><span><b>{p.icon || '▦'} {p.title}</b><small style={{display:'block',color:'#849087',marginTop:2}}>{p.page_key}</small></span><span>{p.is_visible?'●':'○'}</span></button>)}</div>
          </aside>
          <section style={{display:'grid',gap:12}}>
            {selectedPageKey && pages.find(p=>p.page_key===selectedPageKey) && (()=>{ const p=pages.find(p=>p.page_key===selectedPageKey)!; return <div style={cardStyle}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><small style={{color:'#79877f'}}>{p.page_key}</small><h2 style={{margin:'3px 0 4px'}}>{p.icon || '▦'} {p.title}</h2><span style={{fontSize:12,color:'#718078'}}>{p.columns_desktop}/{p.columns_tablet}/{p.columns_mobile} kolon • üst {p.padding_top}px • alt {p.padding_bottom}px</span></div><div style={{display:'flex',gap:7}}><button style={buttonStyle} onClick={()=>{setEditingPage({...p});setPageModal(true)}}>✎ Sayfayı Düzenle</button><button style={buttonStyle} onClick={()=>removeRow('app_pages',p.id,p.title)}>Sil</button></div></div></div> })()}
            <div style={cardStyle}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12}}><div><strong>Bloklar / Kartlar</strong><small style={{display:'block',color:'#819087',marginTop:2}}>Sıra, ikon, konum, genişlik ve içerik</small></div><button disabled={!selectedPageKey} style={buttonStyle} onClick={()=>{setEditingBlock({page_key:selectedPageKey,block_key:'',block_type:'card',icon:'▦',icon_size:22,icon_position:'left',position:selectedBlocks.length,width_desktop:1,width_tablet:1,width_mobile:1,align_horizontal:'left',align_vertical:'center',is_visible:true,style_config:{},content_data:{}});setBlockModal(true)}}>＋ Blok Ekle</button></div>
              <div style={{display:'grid',gap:8}}>{selectedBlocks.length===0 && <small style={{color:'#839087'}}>Bu sayfada henüz blok yok.</small>}{selectedBlocks.map(b=><div key={b.id} style={{border:'1px solid #e2e9e2',borderRadius:12,padding:11,display:'grid',gridTemplateColumns:'42px minmax(0,1fr) auto',gap:10,alignItems:'center'}}><div style={{width:40,height:40,borderRadius:10,background:'#eef5ef',display:'grid',placeItems:'center',fontSize:Math.min(b.icon_size || 22,30)}}>{b.icon || '▦'}</div><div><strong>{b.title || b.block_key}</strong><small style={{display:'block',color:'#829087'}}>#{b.position} • {b.block_type} • genişlik {b.width_desktop}/{b.width_tablet}/{b.width_mobile} • {b.is_visible?'görünür':'gizli'}</small></div><div style={{display:'flex',gap:6}}><button style={buttonStyle} onClick={()=>{setEditingBlock({...b});setBlockModal(true)}}>Düzenle</button><button style={buttonStyle} onClick={()=>removeRow('app_blocks',b.id,b.title || b.block_key)}>Sil</button></div></div>)}</div>
            </div>
          </section>
        </div>}

        {!loading && tab==='menu' && <section style={cardStyle}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div><strong>Menü Yönetimi</strong><small style={{display:'block',color:'#829087'}}>Ad, ikon, sıra ve hangi cihazlarda gösterileceği</small></div><button style={buttonStyle} onClick={()=>{setEditingMenu({menu_key:'',label:'',icon:'▦',position:menus.length,is_visible:true,show_desktop:true,show_mobile:true,show_bottom_nav:false,admin_only:false});setMenuModal(true)}}>＋ Menü Ekle</button></div><div style={{display:'grid',gap:8}}>{menus.length===0&&<small style={{color:'#829087'}}>Henüz menü kaydı yok.</small>}{menus.map(m=><div key={m.id} style={{border:'1px solid #e2e9e2',borderRadius:12,padding:11,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><div><strong>{m.icon || '▦'} {m.label}</strong><small style={{display:'block',color:'#829087'}}>#{m.position} • {m.page_key || 'sayfa yok'} • {m.show_desktop?'masaüstü ':''}{m.show_mobile?'mobil ':''}{m.show_bottom_nav?'alt menü ':''}{m.admin_only?'admin':''}</small></div><div style={{display:'flex',gap:6}}><button style={buttonStyle} onClick={()=>{setEditingMenu({...m});setMenuModal(true)}}>Düzenle</button><button style={buttonStyle} onClick={()=>removeRow('app_menu_items',m.id,m.label)}>Sil</button></div></div>)}</div></section>}

        {!loading && tab==='media' && <div style={{display:'grid',gridTemplateColumns:'minmax(260px,360px) minmax(0,1fr)',gap:14,alignItems:'start'}}><form onSubmit={uploadMedia} style={{...cardStyle,display:'grid',gap:10}}><strong>Yeni Görsel Yükle</strong><label style={labelStyle}>Dosya<input type="file" accept="image/*" onChange={e=>setMediaFile(e.target.files?.[0]??null)} /></label><label style={labelStyle}>Başlık<input style={inputStyle} value={mediaTitle} onChange={e=>setMediaTitle(e.target.value)} /></label><label style={labelStyle}>Alt metin<input style={inputStyle} value={mediaAlt} onChange={e=>setMediaAlt(e.target.value)} /></label><label style={labelStyle}>Kategori<input style={inputStyle} value={mediaCategory} onChange={e=>setMediaCategory(e.target.value)} /></label><button disabled={saving} type="submit" style={{...buttonStyle,background:'#1f5a38',color:'#fff',borderColor:'#1f5a38'}}>{saving?'Yükleniyor...':'Görseli Yükle'}</button></form><section style={cardStyle}><strong>Görsel Kütüphanesi</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginTop:12}}>{media.map(m=><div key={m.id} style={{border:'1px solid #e1e8e1',borderRadius:12,overflow:'hidden'}}><img src={m.public_url} alt={m.alt_text || m.title || ''} style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',display:'block'}}/><div style={{padding:9}}><strong style={{display:'block',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.title || 'Görsel'}</strong><small style={{color:'#819087'}}>{m.category}</small></div></div>)}</div></section></div>}

        {!loading && tab==='theme' && <section style={{...cardStyle,maxWidth:700}}><div><strong>Tema & Yerleşim Ölçüleri</strong><small style={{display:'block',color:'#829087',marginTop:2}}>Genel radius, boşluk, genişlik ve mobil alt menü yüksekliği</small></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:11,marginTop:14}}>{[['borderRadius','Köşe Yuvarlaklığı'],['cardGap','Kart Aralığı'],['contentMaxWidth','İçerik Maks. Genişliği'],['sidebarWidth','Sol Menü Genişliği'],['mobileBottomNavHeight','Mobil Alt Menü Yüksekliği'],['fontScale','Yazı Ölçeği']].map(([key,label])=><label key={key} style={labelStyle}>{label}<input type="number" step={key==='fontScale'?'0.05':'1'} style={inputStyle} value={theme[key] ?? ''} onChange={e=>setTheme(x=>({...x,[key]:Number(e.target.value)}))}/></label>)}</div><button disabled={saving} onClick={saveTheme} style={{...buttonStyle,marginTop:14,background:'#1f5a38',color:'#fff',borderColor:'#1f5a38'}}>Tema Ayarlarını Kaydet</button></section>}
      </main>

      {pageModal && editingPage && <Modal title={editingPage.id?'Sayfayı Düzenle':'Yeni Sayfa'} onClose={()=>setPageModal(false)}><form onSubmit={savePage} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Sayfa anahtarı<input disabled={!!editingPage.id} style={inputStyle} value={editingPage.page_key||''} onChange={e=>setEditingPage(x=>({...x!,page_key:e.target.value}))}/></label><label style={labelStyle}>Başlık<input style={inputStyle} value={editingPage.title||''} onChange={e=>setEditingPage(x=>({...x!,title:e.target.value}))}/></label></div><label style={labelStyle}>Alt başlık<input style={inputStyle} value={editingPage.subtitle||''} onChange={e=>setEditingPage(x=>({...x!,subtitle:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingPage.icon||''} onChange={e=>setEditingPage(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>İkon boyutu<input type="number" style={inputStyle} value={editingPage.icon_size??22} onChange={e=>setEditingPage(x=>({...x!,icon_size:Number(e.target.value)}))}/></label><label style={labelStyle}>İkon konumu<select style={inputStyle} value={editingPage.icon_position||'left'} onChange={e=>setEditingPage(x=>({...x!,icon_position:e.target.value}))}><option value="left">Sol</option><option value="right">Sağ</option><option value="top">Üst</option><option value="center">Orta</option></select></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Masaüstü kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_desktop??3} onChange={e=>setEditingPage(x=>({...x!,columns_desktop:Number(e.target.value)}))}/></label><label style={labelStyle}>Tablet kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_tablet??2} onChange={e=>setEditingPage(x=>({...x!,columns_tablet:Number(e.target.value)}))}/></label><label style={labelStyle}>Mobil kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_mobile??1} onChange={e=>setEditingPage(x=>({...x!,columns_mobile:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingPage.menu_order??0} onChange={e=>setEditingPage(x=>({...x!,menu_order:Number(e.target.value)}))}/></label><label style={labelStyle}>Üst boşluk<input type="number" style={inputStyle} value={editingPage.padding_top??24} onChange={e=>setEditingPage(x=>({...x!,padding_top:Number(e.target.value)}))}/></label><label style={labelStyle}>Alt boşluk<input type="number" style={inputStyle} value={editingPage.padding_bottom??24} onChange={e=>setEditingPage(x=>({...x!,padding_bottom:Number(e.target.value)}))}/></label></div><label style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={editingPage.is_visible??true} onChange={e=>setEditingPage(x=>({...x!,is_visible:e.target.checked}))}/> Uygulamada göster</label><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setPageModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}

      {blockModal && editingBlock && <Modal title={editingBlock.id?'Bloğu Düzenle':'Yeni Blok'} onClose={()=>setBlockModal(false)}><form onSubmit={saveBlock} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Sayfa<select style={inputStyle} value={editingBlock.page_key||selectedPageKey} onChange={e=>setEditingBlock(x=>({...x!,page_key:e.target.value}))}>{pages.map(p=><option key={p.id} value={p.page_key}>{p.title}</option>)}</select></label><label style={labelStyle}>Blok anahtarı<input disabled={!!editingBlock.id} style={inputStyle} value={editingBlock.block_key||''} onChange={e=>setEditingBlock(x=>({...x!,block_key:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}><label style={labelStyle}>Başlık<input style={inputStyle} value={editingBlock.title||''} onChange={e=>setEditingBlock(x=>({...x!,title:e.target.value}))}/></label><label style={labelStyle}>Tür<select style={inputStyle} value={editingBlock.block_type||'card'} onChange={e=>setEditingBlock(x=>({...x!,block_type:e.target.value}))}>{['card','hero','button','text','image','banner','list','weather','field','ai','custom'].map(x=><option key={x}>{x}</option>)}</select></label></div><label style={labelStyle}>Alt başlık<input style={inputStyle} value={editingBlock.subtitle||''} onChange={e=>setEditingBlock(x=>({...x!,subtitle:e.target.value}))}/></label><label style={labelStyle}>Açıklama<textarea rows={3} style={{...inputStyle,height:'auto',padding:10}} value={editingBlock.description||''} onChange={e=>setEditingBlock(x=>({...x!,description:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingBlock.icon||''} onChange={e=>setEditingBlock(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>İkon px<input type="number" style={inputStyle} value={editingBlock.icon_size??22} onChange={e=>setEditingBlock(x=>({...x!,icon_size:Number(e.target.value)}))}/></label><label style={labelStyle}>İkon yeri<select style={inputStyle} value={editingBlock.icon_position||'left'} onChange={e=>setEditingBlock(x=>({...x!,icon_position:e.target.value}))}><option value="left">Sol</option><option value="right">Sağ</option><option value="top">Üst</option><option value="center">Orta</option></select></label><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingBlock.position??0} onChange={e=>setEditingBlock(x=>({...x!,position:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Genişlik masaüstü<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_desktop??1} onChange={e=>setEditingBlock(x=>({...x!,width_desktop:Number(e.target.value)}))}/></label><label style={labelStyle}>Tablet<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_tablet??1} onChange={e=>setEditingBlock(x=>({...x!,width_tablet:Number(e.target.value)}))}/></label><label style={labelStyle}>Mobil<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_mobile??1} onChange={e=>setEditingBlock(x=>({...x!,width_mobile:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Yatay hizalama<select style={inputStyle} value={editingBlock.align_horizontal||'left'} onChange={e=>setEditingBlock(x=>({...x!,align_horizontal:e.target.value}))}><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select></label><label style={labelStyle}>Dikey hizalama<select style={inputStyle} value={editingBlock.align_vertical||'center'} onChange={e=>setEditingBlock(x=>({...x!,align_vertical:e.target.value}))}><option value="top">Üst</option><option value="center">Orta</option><option value="bottom">Alt</option></select></label></div><label style={labelStyle}>Görsel URL<input style={inputStyle} value={editingBlock.image_url||''} onChange={e=>setEditingBlock(x=>({...x!,image_url:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Buton yazısı<input style={inputStyle} value={editingBlock.button_text||''} onChange={e=>setEditingBlock(x=>({...x!,button_text:e.target.value}))}/></label><label style={labelStyle}>Buton hedefi<input style={inputStyle} value={editingBlock.button_target||''} onChange={e=>setEditingBlock(x=>({...x!,button_target:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Arka plan<input style={inputStyle} value={editingBlock.style_config?.backgroundColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),backgroundColor:e.target.value}}))}/></label><label style={labelStyle}>Yazı rengi<input style={inputStyle} value={editingBlock.style_config?.textColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),textColor:e.target.value}}))}/></label><label style={labelStyle}>Kenar rengi<input style={inputStyle} value={editingBlock.style_config?.borderColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),borderColor:e.target.value}}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><label style={labelStyle}>Köşe px<input type="number" style={inputStyle} value={editingBlock.style_config?.borderRadius??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),borderRadius:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>İç boşluk px<input type="number" style={inputStyle} value={editingBlock.style_config?.padding??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),padding:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>Min yükseklik<input type="number" style={inputStyle} value={editingBlock.style_config?.minHeight??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),minHeight:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>Yazı px<input type="number" style={inputStyle} value={editingBlock.style_config?.fontSize??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),fontSize:e.target.value===''?undefined:Number(e.target.value)}}))}/></label></div><label style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={editingBlock.is_visible??true} onChange={e=>setEditingBlock(x=>({...x!,is_visible:e.target.checked}))}/> Bloğu göster</label><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setBlockModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}

      {menuModal && editingMenu && <Modal title={editingMenu.id?'Menüyü Düzenle':'Yeni Menü'} onClose={()=>setMenuModal(false)}><form onSubmit={saveMenu} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Menü anahtarı<input disabled={!!editingMenu.id} style={inputStyle} value={editingMenu.menu_key||''} onChange={e=>setEditingMenu(x=>({...x!,menu_key:e.target.value}))}/></label><label style={labelStyle}>Menü adı<input style={inputStyle} value={editingMenu.label||''} onChange={e=>setEditingMenu(x=>({...x!,label:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingMenu.icon||''} onChange={e=>setEditingMenu(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingMenu.position??0} onChange={e=>setEditingMenu(x=>({...x!,position:Number(e.target.value)}))}/></label><label style={labelStyle}>Sayfa<select style={inputStyle} value={editingMenu.page_key||''} onChange={e=>setEditingMenu(x=>({...x!,page_key:e.target.value||null}))}><option value="">—</option>{pages.map(p=><option key={p.id} value={p.page_key}>{p.title}</option>)}</select></label></div><label style={labelStyle}>Rozet yazısı<input style={inputStyle} value={editingMenu.badge_text||''} onChange={e=>setEditingMenu(x=>({...x!,badge_text:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>{([['is_visible','Göster'],['show_desktop','Masaüstünde göster'],['show_mobile','Mobilde göster'],['show_bottom_nav','Alt menüde göster'],['admin_only','Sadece admin']] as const).map(([key,label])=><label key={key} style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={Boolean(editingMenu[key])} onChange={e=>setEditingMenu(x=>({...x!,[key]:e.target.checked}))}/>{label}</label>)}</div><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setMenuModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}
    </div>
  );
}


export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cmsPages, setCmsPages] = useState<CmsPageRow[]>([]);
  const [cmsBlocks, setCmsBlocks] = useState<CmsBlockRow[]>([]);
  const [cmsMenus, setCmsMenus] = useState<CmsMenuRow[]>([]);
  const [cmsTheme, setCmsTheme] = useState<Record<string, any>>({});
  const [favoriteFieldId, setFavoriteFieldId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('tp_favorite_field_id') ?? '';
    } catch {
      return '';
    }
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [otherProduct, setOtherProduct] = useState('');
  const [openField, setOpenField] = useState<number | string | null>('demo-field');
  const [demoVisible, setDemoVisible] = useState(true);
  const [fieldQuickViews, setFieldQuickViews] = useState<
    Record<string, 'satellite' | 'weather' | 'check'>
  >({});

  useEffect(() => {
    let active = true;

    const checkAdminRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        if (!user) {
          setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('Admin rolü kontrol edilemedi:', error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data?.role === 'admin');
      } catch (error) {
        console.error('Admin rolü kontrol edilemedi:', error);
        if (active) setIsAdmin(false);
      }
    };

    if (!supabase) {
      console.error('Supabase client oluşturulamadı.');
      setIsAdmin(false);
      return;
    }
    
    checkAdminRole();
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdminRole();
    });
    
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      console.error('Supabase client oluşturulamadı.');
      return;
    }

    const loadCmsConfig = async () => {
      try {
        const [pageRes, blockRes, menuRes, themeRes] = await Promise.all([
          supabase.from('app_pages').select('*').order('menu_order'),
          supabase.from('app_blocks').select('*').order('position'),
          supabase.from('app_menu_items').select('*').order('position'),
          supabase.from('app_theme_settings').select('setting_value').eq('setting_key', 'global').maybeSingle(),
        ]);

        if (!active) return;
        if (pageRes.error) console.error('CMS pages okunamadı:', pageRes.error);
        else setCmsPages((pageRes.data ?? []) as CmsPageRow[]);

        if (blockRes.error) console.error('CMS blocks okunamadı:', blockRes.error);
        else setCmsBlocks((blockRes.data ?? []) as CmsBlockRow[]);

        if (menuRes.error) console.error('CMS menu okunamadı:', menuRes.error);
        else setCmsMenus((menuRes.data ?? []) as CmsMenuRow[]);

        if (themeRes.error) console.error('CMS theme okunamadı:', themeRes.error);
        else setCmsTheme((themeRes.data?.setting_value ?? {}) as Record<string, any>);
      } catch (error) {
        console.error('CMS ayarları yüklenemedi:', error);
      }
    };

    const handleCmsUpdated = () => { void loadCmsConfig(); };
    window.addEventListener('tp-cms-updated', handleCmsUpdated);

    const channel = supabase
      .channel('tp-cms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_pages' }, handleCmsUpdated)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_blocks' }, handleCmsUpdated)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_menu_items' }, handleCmsUpdated)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_theme_settings' }, handleCmsUpdated)
      .subscribe();

    void loadCmsConfig();

    return () => {
      active = false;
      window.removeEventListener('tp-cms-updated', handleCmsUpdated);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event('tp-cms-updated'));
  }, [screen]);

  useEffect(() => {
    const pageKey = screen;
    const refreshActivePageCms = async () => {
      try {
        const [pageRes, blockRes] = await Promise.all([
          supabase.from('app_pages').select('*').eq('page_key', pageKey).maybeSingle(),
          supabase.from('app_blocks').select('*').eq('page_key', pageKey).order('position'),
        ]);

        if (pageRes.error) {
          console.error('Aktif sayfa CMS kaydı okunamadı:', pageRes.error);
        } else if (pageRes.data) {
          setCmsPages((prev) => [
            ...prev.filter((item) => item.page_key !== pageKey),
            pageRes.data as CmsPageRow,
          ]);
        }

        if (blockRes.error) {
          console.error('Aktif sayfa CMS blokları okunamadı:', blockRes.error);
        } else {
          const nextBlocks = (blockRes.data ?? []) as CmsBlockRow[];
          setCmsBlocks((prev) => [
            ...prev.filter((item) => item.page_key !== pageKey),
            ...nextBlocks,
          ]);
          console.log(
            '[TarlaPusula CMS]',
            pageKey,
            nextBlocks.map((item) => ({
              block_key: item.block_key,
              title: item.title,
              is_visible: item.is_visible,
            })),
          );
        }
      } catch (error) {
        console.error('Aktif sayfa CMS yenileme hatası:', error);
      }
    };

    void refreshActivePageCms();
  }, [screen]);

  const cmsRuntimeCss = `
    :root{
      --tp-cms-radius:${Number(cmsTheme.borderRadius ?? 18)}px;
      --tp-cms-gap:${Number(cmsTheme.cardGap ?? 16)}px;
      --tp-cms-max:${Number(cmsTheme.contentMaxWidth ?? 1440)}px;
      --tp-cms-sidebar:${Number(cmsTheme.sidebarWidth ?? 260)}px;
      --tp-cms-bottom:${Number(cmsTheme.mobileBottomNavHeight ?? 72)}px;
      --tp-cms-font-scale:${Number(cmsTheme.fontScale ?? 1)};
    }
    .content,.tp-content,.tp-placeholder-main,.tp-admin-main{max-width:var(--tp-cms-max);}
    .tp-desktop-sidebar{width:var(--tp-cms-sidebar)!important;}
    .bottomNav{min-height:var(--tp-cms-bottom)!important;}
    .tp-home-panel,.tp-placeholder-cards article,.fieldCard,.card,.weatherCard{border-radius:var(--tp-cms-radius)!important;}
    .tp-home-dashboard,.tp-placeholder-cards{gap:var(--tp-cms-gap)!important;}
    .app,.tp-desktop-shell{font-size:calc(1em * var(--tp-cms-font-scale));}
  `;

  const cmsBlockStyle = (block?: CmsBlockRow) => {
    const style = block?.style_config || {};
    return {
      ...(style.backgroundColor ? { background: style.backgroundColor } : {}),
      ...(style.textColor ? { color: style.textColor } : {}),
      ...(style.borderColor ? { borderColor: style.borderColor } : {}),
      ...(style.borderRadius !== undefined ? { borderRadius: Number(style.borderRadius) } : {}),
      ...(style.padding !== undefined ? { padding: Number(style.padding) } : {}),
      ...(style.marginTop !== undefined ? { marginTop: Number(style.marginTop) } : {}),
      ...(style.marginBottom !== undefined ? { marginBottom: Number(style.marginBottom) } : {}),
      ...(style.minHeight !== undefined ? { minHeight: Number(style.minHeight) } : {}),
      ...(style.fontSize !== undefined ? { fontSize: Number(style.fontSize) } : {}),
      ...(style.fontWeight !== undefined ? { fontWeight: Number(style.fontWeight) } : {}),
      ...(style.boxShadow ? { boxShadow: style.boxShadow } : {}),
      textAlign: (block?.align_horizontal as any) || undefined,
    } as any;
  };

  const getFieldQuickView = (fieldId: string | number) =>
    fieldQuickViews[String(fieldId)] ?? 'satellite';

  const setFieldQuickView = (
    fieldId: string | number,
    view: 'satellite' | 'weather' | 'check',
  ) => {
    setFieldQuickViews((current) => ({
      ...current,
      [String(fieldId)]: view,
    }));
  };

  const getCropEmoji = (crop: string) => {
    const value = crop.toLocaleLowerCase('tr-TR');

    if (value.includes('mısır')) return '🌽';
    if (value.includes('arpa') || value.includes('buğday')) return '🌾';
    if (value.includes('ayçiçe')) return '🌻';
    if (value.includes('pamuk')) return '🌱';
    if (value.includes('üzüm') || value.includes('bağ')) return '🍇';
    if (value.includes('zeytin')) return '🫒';
    if (value.includes('ceviz') || value.includes('fındık')) return '🌳';
    if (value.includes('kiraz') || value.includes('elma')) return '🍎';

    return '🌿';
  };


  const handleFieldCropSelection = (cropName: string) => {
    const crop = TURKEY_CROPS.find((item) => item.name === cropName);

    setFieldCrop(cropName);

    if (!crop) return;

    setFieldCropCycle(crop.cycle);

    if (crop.cycle === 'annual') {
      setFieldPlantingYear('');
      setFieldBearing(true);
    }
  };

  const SatelliteIcon = ({ className = '' }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      style={{ width: 22, height: 22, maxWidth: 22, maxHeight: 22, flex: '0 0 22px' }}
      fill="none"
      aria-hidden="true"
    >
      <path d="M9.5 14.5 5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m14.5 9.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1.6" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4.8 6.8 8 10 5.8 12.2 2.6 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="m16 14 3.2 3.2 2.2-2.2-3.2-3.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M5.2 16.9c1.1 1.1 1.1 2.9 0 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M2.8 15.6c1.8 1.8 1.8 4.7 0 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

  const WeatherIcon = ({ className = '' }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7.2" cy="7" r="2.5" stroke="#F59E0B" strokeWidth="1.8"/>
      <path d="M7.2 1.8v1.3M7.2 10.9v1.3M2 7h1.3M11.1 7h1.3M3.5 3.3l.9.9M10 9.8l.9.9M10.9 3.3l-.9.9" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M7.6 18.5h9.2a4.2 4.2 0 0 0 .5-8.4 5.4 5.4 0 0 0-10.2 1.5 3.5 3.5 0 0 0 .5 6.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const CameraCheckIcon = ({ className = '' }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4.5 8.4h2.2l1.3-2h5.1l1.3 2h2.2A2.4 2.4 0 0 1 19 10.8v4.8A2.4 2.4 0 0 1 16.6 18H7.4A2.4 2.4 0 0 1 5 15.6v-4.8a2.4 2.4 0 0 1 2.4-2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="11.3" cy="13.1" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="18.3" cy="18.2" r="3.1" fill="#fff" stroke="#22A447" strokeWidth="1.6"/>
      <path d="m16.9 18.2.9.9 1.8-2" stroke="#22A447" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const ClipboardIcon = ({ className = '' }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="5" y="4.8" width="14" height="16" rx="2.3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M9 4.8v-1h6v1M8.6 9h6.8M8.6 12.5h6.8M8.6 16h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );

const getWeatherIcon = (condition?: string) => {
    const value = (condition ?? '').toLocaleLowerCase('tr-TR');

    if (value.includes('gök') || value.includes('thunder')) return '⛈️';
    if (value.includes('kar') || value.includes('snow')) return '🌨️';
    if (value.includes('sağanak') || value.includes('rain') || value.includes('yağmur')) return '🌧️';
    if (value.includes('sis') || value.includes('fog')) return '🌫️';
    if (value.includes('kapalı') || value.includes('cloudy')) return '☁️';
    if (value.includes('parçalı') || value.includes('partly')) return '🌤️';
    if (value.includes('açık') || value.includes('clear')) return '☀️';

    return '🌦️';
  };

  const formatWeatherDay = (dateValue: string, index: number) => {
    if (index === 0) return 'Bugün';
    if (index === 1) return 'Yarın';

    return new Intl.DateTimeFormat('tr-TR', {
      weekday: 'short',
    }).format(new Date(`${dateValue}T12:00:00`));
  };

  const getWeatherRecommendation = (day?: WeatherForecastDay) => {
    if (!day) return 'Hava tahmini hazırlanıyor.';

    const rainChance = day.precipitationProbability ?? 0;
    const rainAmount = day.precipitation ?? 0;
    const wind = day.windSpeed ?? 0;
    const maxTemp = day.tempMax ?? 0;

    if (rainChance >= 70 || rainAmount >= 8) {
      return 'Yağış ihtimali yüksek. İlaçlama ve gübreleme planını yağış saatlerine göre düzenle.';
    }

    if (wind >= 30) {
      return 'Rüzgâr kuvvetli görünüyor. İlaçlama gibi sürüklenmeden etkilenen uygulamaları ertelemen daha güvenli olabilir.';
    }

    if (maxTemp >= 34) {
      return 'Sıcaklık yüksek. Sulama ve saha çalışmalarını günün daha serin saatlerine planlamak faydalı olabilir.';
    }

    if (rainChance >= 35) {
      return 'Yağış ihtimali var. Saha işlerinden önce güncel tahmini tekrar kontrol et.';
    }

    return 'Hava koşulları saha çalışmaları için genel olarak uygun görünüyor.';
  };

  const geocodeFieldLocation = async (field: Field) => {
    if (field.demo) {
      return {
        latitude: 39.9334,
        longitude: 32.8597,
        label: 'Örnek konum',
      };
    }

    const searchCandidates = [
      [field.village, field.district, field.city].filter(Boolean).join(', '),
      [field.district, field.city].filter(Boolean).join(', '),
      field.city ?? '',
    ].filter((value, index, all) => value && all.indexOf(value) === index);

    for (const query of searchCandidates) {
      try {
        const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
        url.searchParams.set('name', query);
        url.searchParams.set('count', '1');
        url.searchParams.set('language', 'tr');
        url.searchParams.set('format', 'json');
        url.searchParams.set('countryCode', 'TR');

        const response = await fetch(url);
        if (!response.ok) continue;

        const payload = await response.json();
        const result = payload?.results?.[0];

        if (
          result &&
          Number.isFinite(Number(result.latitude)) &&
          Number.isFinite(Number(result.longitude))
        ) {
          return {
            latitude: Number(result.latitude),
            longitude: Number(result.longitude),
            label:
              [field.village, field.district, field.city]
                .filter(Boolean)
                .join(' / ') || result.name || 'Tarla konumu',
          };
        }
      } catch (error) {
        console.warn('Tarla konumu çözümlenemedi:', error);
      }
    }

    return null;
  };

  const weatherCodeToCondition = (code: number) => {
    if (code === 0) return 'Açık';
    if ([1, 2].includes(code)) return 'Parçalı bulutlu';
    if (code === 3) return 'Kapalı';
    if ([45, 48].includes(code)) return 'Sisli';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Çisenti';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Yağmurlu';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Karlı';
    if ([95, 96, 99].includes(code)) return 'Gök gürültülü';
    return 'Değişken';
  };

  const fetchOpenMeteoForecast = async (latitude: number, longitude: number) => {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '5');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Hava servisi yanıt vermedi (${response.status}).`);
    }

    const data = await response.json();
    const daily = data?.daily;
    if (!Array.isArray(daily?.time) || daily.time.length === 0) {
      throw new Error('Hava tahmini alınamadı.');
    }

    const forecast: WeatherForecastDay[] = daily.time.slice(0, 5).map(
      (date: string, index: number) => ({
        date,
        tempMin: Number.isFinite(Number(daily.temperature_2m_min?.[index]))
          ? Number(daily.temperature_2m_min[index])
          : null,
        tempMax: Number.isFinite(Number(daily.temperature_2m_max?.[index]))
          ? Number(daily.temperature_2m_max[index])
          : null,
        humidity: null,
        precipitation: Number.isFinite(Number(daily.precipitation_sum?.[index]))
          ? Number(daily.precipitation_sum[index])
          : null,
        precipitationProbability: Number.isFinite(
          Number(daily.precipitation_probability_max?.[index]),
        )
          ? Number(daily.precipitation_probability_max[index])
          : null,
        windSpeed: Number.isFinite(Number(daily.wind_speed_10m_max?.[index]))
          ? Number(daily.wind_speed_10m_max[index])
          : null,
        condition: weatherCodeToCondition(Number(daily.weather_code?.[index] ?? -1)),
      }),
    );

    return forecast;
  };

  const getDeviceWeatherLocation = () =>
    new Promise<{ latitude: number; longitude: number; label: string } | null>(
      (resolve) => {
        if (!('geolocation' in navigator)) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              label: 'Mevcut konum',
            });
          },
          () => resolve(null),
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 10 * 60 * 1000,
          },
        );
      },
    );

  const resolveHomeWeatherLocation = async (field?: Field | null) => {
    // 1) Kullanıcının tarayıcı/telefon konumu açıksa onu kullan.
    const deviceLocation = await getDeviceWeatherLocation();
    if (deviceLocation) return deviceLocation;

    // 2) Konum izni yoksa kayıtlı tarlanın gerçek koordinatını kullan.
    if (field && !field.demo) {
      const latitude = field.parcelCentroidLat ?? field.latitude;
      const longitude = field.parcelCentroidLng ?? field.longitude;

      if (
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined &&
        Number.isFinite(Number(latitude)) &&
        Number.isFinite(Number(longitude))
      ) {
        return {
          latitude: Number(latitude),
          longitude: Number(longitude),
          label:
            [field.village, field.district, field.city].filter(Boolean).join(' / ') ||
            field.name ||
            'Tarla konumu',
        };
      }

      // Koordinat yoksa tarlanın il/ilçe bilgisini Open-Meteo geocoding ile çöz.
      const geocoded = await geocodeFieldLocation(field);
      if (geocoded) return geocoded;
    }

    // 3) Ne kullanıcı konumu ne de tarla konumu varsa Elazığ.
    return {
      latitude: 38.6743,
      longitude: 39.2232,
      label: 'Elazığ',
    };
  };

  const loadHomeWeather = async (field?: Field | null) => {
    const key = '__home__';

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      const location = await resolveHomeWeatherLocation(field);
      const forecast = await fetchOpenMeteoForecast(
        location.latitude,
        location.longitude,
      );

      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast,
          providers: [{ name: 'Open-Meteo', forecast }],
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Ana sayfa hava durumu yüklenemedi:', error);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel ?? 'Elazığ',
          message:
            error instanceof Error ? error.message : 'Hava tahmini alınamadı.',
        },
      }));
    }
  };

  const loadFieldWeather = async (field: Field) => {
    const key = String(field.id);

    if (fieldWeather[key]?.status === 'loading') return;

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      if (!supabase) {
        throw new Error('Hava servisine bağlanılamadı.');
      }

      const location = await geocodeFieldLocation(field);

      if (!location) {
        throw new Error(
          'Bu tarla için hava tahmini göstermek üzere il veya ilçe bilgisi gerekli.',
        );
      }

      const { data, error } = await supabase.functions.invoke('weather-compare', {
        body: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });

      if (error) throw error;

      const forecast = Array.isArray(data?.forecast)
        ? (data.forecast as WeatherForecastDay[]).slice(0, 5)
        : [];

      const rawProviders = Array.isArray(data?.providers)
        ? data.providers
        : Array.isArray(data?.sources)
          ? data.sources
          : Array.isArray(data?.results)
            ? data.results
            : [];

      const providers: WeatherProviderResult[] = rawProviders
        .map((provider: any, index: number) => {
          const providerForecast = Array.isArray(provider?.forecast)
            ? provider.forecast.slice(0, 5)
            : Array.isArray(provider?.days)
              ? provider.days.slice(0, 5)
              : [];

          return {
            name:
              String(
                provider?.name ??
                  provider?.provider ??
                  provider?.source ??
                  `Kaynak ${index + 1}`,
              ).trim() || `Kaynak ${index + 1}`,
            forecast: providerForecast,
          };
        })
        .filter((provider: WeatherProviderResult) => provider.forecast.length > 0)
        .slice(0, 3);

      if (!forecast.length && providers.length === 0) {
        setFieldWeather((current) => ({
          ...current,
          [key]: {
            status: 'error',
            forecast: [],
            providers: [],
            locationLabel: location.label,
            message: data?.message ?? 'Hava tahmini güncelleniyor.',
          },
        }));
        return;
      }

      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast: forecast.length ? forecast : providers[0]?.forecast ?? [],
          providers,
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Tarla hava durumu yüklenemedi:', error);

      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel,
          message:
            error instanceof Error
              ? error.message
              : 'Hava tahmini güncelleniyor.',
        },
      }));
    }
  };


  const loadFieldSatellite = async (field: Field, force = false) => {
    const key = String(field.id);
    const currentState = satelliteByField[key];

    if (currentState?.status === 'loading') return;
    if (!force && currentState?.status === 'ready') return;

    if (!field.parcelGeometry) {
      setSatelliteByField((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: 'Uydu analizi için önce gerçek ada/parsel sınırı bulunmalı.',
        },
      }));
      return;
    }

    setSatelliteByField((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        data: current[key]?.data,
      },
    }));

    try {
      const data = await analyzeFieldSatellite(field.parcelGeometry);

      setSatelliteByField((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          data,
        },
      }));
    } catch (error) {
      setSatelliteByField((current) => ({
        ...current,
        [key]: {
          status: 'error',
          data: current[key]?.data,
          message:
            error instanceof Error
              ? error.message
              : 'Uydu analizi yüklenemedi.',
        },
      }));
    }
  };


  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const demoField: Field = {
    id: 'demo-field',
    name: 'Örnek Arpa Tarlası',
    ada: 87,
    parsel: 6,
    area: 68.2,
    crop: 'Arpa',
    season: 2026,
    status: 'check',
    demo: true,
  };

  const [realFields, setRealFields] = useState<Field[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldWeather, setFieldWeather] = useState<Record<string, FieldWeatherState>>({});
  const [weatherHubFieldId, setWeatherHubFieldId] = useState('');
  const [satelliteByField, setSatelliteByField] = useState<Record<string, FieldSatelliteState>>({});
  const [fieldControlFieldId, setFieldControlFieldId] = useState('');
  const [soilFieldId, setSoilFieldId] = useState('');
  const [soilReportFileName, setSoilReportFileName] = useState('');
  const [soilReportFileType, setSoilReportFileType] = useState('');
  const [soilDeviceLocation, setSoilDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [soilLocationLoading, setSoilLocationLoading] = useState(false);
  const [soilLocationMessage, setSoilLocationMessage] = useState('');
  const [soilManualCity, setSoilManualCity] = useState('');
  const [soilManualDistrict, setSoilManualDistrict] = useState('');
  const [soilAiMessage, setSoilAiMessage] = useState('');
  const [fieldFormLoading, setFieldFormLoading] = useState(false);
  const [fieldFormMessage, setFieldFormMessage] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldCity, setFieldCity] = useState('');
  const [fieldDistrict, setFieldDistrict] = useState('');
  const [fieldVillage, setFieldVillage] = useState('');

  const [provinceOptions, setProvinceOptions] = useState<LocationOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LocationOption[]>([]);
  const [villageOptions, setVillageOptions] = useState<LocationOption[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);
  const [locationOptionsMessage, setLocationOptionsMessage] = useState('');
  const [fieldAda, setFieldAda] = useState('');
  const [fieldParcel, setFieldParcel] = useState('');
  const [fieldLatitude, setFieldLatitude] = useState<number | null>(null);
  const [fieldLongitude, setFieldLongitude] = useState<number | null>(null);
  const [parcelLocationLoading, setParcelLocationLoading] = useState(false);
  const [parcelLocationMessage, setParcelLocationMessage] = useState('');
  const [showSatellitePreview, setShowSatellitePreview] = useState(false);
  const [parcelLookupLoading, setParcelLookupLoading] = useState(false);
  const [parcelLookupMessage, setParcelLookupMessage] = useState('');
  const [parcelGeometry, setParcelGeometry] = useState<any | null>(null);
  const [parcelLookupSource, setParcelLookupSource] = useState('');
  const [fieldArea, setFieldArea] = useState('');
  const [fieldCrop, setFieldCrop] = useState('');
  const [fieldSeason, setFieldSeason] = useState(String(new Date().getFullYear()));
  const [fieldCropCycle, setFieldCropCycle] = useState<CropCycle>('annual');
  const [fieldPlantingYear, setFieldPlantingYear] = useState('');
  const [fieldBearing, setFieldBearing] = useState(true);

  const [fieldSections, setFieldSections] = useState<FieldSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [sectionFormLoading, setSectionFormLoading] = useState(false);
  const [sectionFormMessage, setSectionFormMessage] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionCrop, setSectionCrop] = useState('');
  const [sectionArea, setSectionArea] = useState('');

  const [annualSeasons, setAnnualSeasons] = useState<FieldSeason[]>([]);
  const [perennialYields, setPerennialYields] = useState<PerennialYield[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');

  const [annualFormOpen, setAnnualFormOpen] = useState(false);
  const [annualFormLoading, setAnnualFormLoading] = useState(false);
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
  const [annualCrop, setAnnualCrop] = useState('');
  const [annualPlantingDate, setAnnualPlantingDate] = useState('');
  const [annualHarvestDate, setAnnualHarvestDate] = useState('');
  const [annualNotes, setAnnualNotes] = useState('');

  const [yieldFormOpen, setYieldFormOpen] = useState(false);
  const [yieldFormLoading, setYieldFormLoading] = useState(false);
  const [yieldYear, setYieldYear] = useState(String(new Date().getFullYear()));
  const [yieldKg, setYieldKg] = useState('');
  const [yieldHarvestDate, setYieldHarvestDate] = useState('');
  const [yieldNotes, setYieldNotes] = useState('');

  const [productionProfileOpen, setProductionProfileOpen] = useState(false);
  const [productionProfileLoading, setProductionProfileLoading] = useState(false);
  const [productionProfileMessage, setProductionProfileMessage] = useState('');
  const [detailCropCycle, setDetailCropCycle] = useState<CropCycle>('annual');
  const [detailPlantingYear, setDetailPlantingYear] = useState('');
  const [detailBearing, setDetailBearing] = useState(true);

  const [activities, setActivities] = useState<FieldActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [activityFormLoading, setActivityFormLoading] = useState(false);
  const [activityMessage, setActivityMessage] = useState('');
  const [activityType, setActivityType] = useState('Saha Kontrolü');
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [activityProductName, setActivityProductName] = useState('');
  const [activityQuantity, setActivityQuantity] = useState('');
  const [activityUnit, setActivityUnit] = useState('');
  const [activityDoseMode, setActivityDoseMode] = useState<'per_decare' | 'total'>('per_decare');
  const [activityWaterM3, setActivityWaterM3] = useState('');
  const [activityDurationHours, setActivityDurationHours] = useState('');
  const [activityCost, setActivityCost] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [activityPhoto, setActivityPhoto] = useState<File | null>(null);
  const [activityPhotoPreview, setActivityPhotoPreview] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<AiFieldAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [aiAccessStatus, setAiAccessStatus] = useState<AiAccessStatus | null>(null);
  const [aiAccessLoading, setAiAccessLoading] = useState(false);

  const [calendarReminders, setCalendarReminders] = useState<CalendarReminder[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderFormLoading, setReminderFormLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderFieldId, setReminderFieldId] = useState('');
  const [reminderType, setReminderType] = useState('Saha Kontrolü');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().slice(0,10));
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  const [pushSupported, setPushSupported] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [fieldFabOpen, setFieldFabOpen] = useState(false);

  const statusInfo = {
    good: {
      label: 'İyi',
      color: '#2f7d32',
      bg: '#edf7ed',
    },
    check: {
      label: 'Kontrol Et',
      color: '#d58b00',
      bg: '#fff7df',
    },
    urgent: {
      label: 'İlgilen',
      color: '#d8453a',
      bg: '#fff0ee',
    },
  };

  const currentQuestion = onboardingQuestions[onboardingStep];

  const selectAnswer = (value: string) => {
    const current = answers[onboardingStep] || [];

    if (currentQuestion.multi) {
      const exists = current.includes(value);

      setAnswers({
        ...answers,
        [onboardingStep]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      });

      if (value === 'Diğer ürün' && exists) {
        setOtherProduct('');
      }
    } else {
      setAnswers({
        ...answers,
        [onboardingStep]: [value],
      });
    }
  };

  const startOnboarding = () => {
    setOnboardingStep(0);
    setAnswers({});
    setOtherProduct('');
    setAuthMessage('');
    setScreen('onboarding');
  };

  const saveOnboarding = async () => {
    if (!supabase) {
      setAuthMessage('Supabase bağlantısı hazır değil.');
      return false;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setScreen('ready');
        return true;
      }

      const { error: onboardingError } = await supabase
        .from('onboarding_answers')
        .upsert(
          {
            user_id: user.id,
            usage_type: answers[0]?.[0] ?? null,
            production_types: answers[1] ?? [],
            products: answers[2] ?? [],
            other_product: otherProduct.trim() || null,
            production_area: answers[3]?.[0] ?? null,
            interests: answers[4] ?? [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (onboardingError) {
        throw onboardingError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      setScreen('ready');
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Onboarding kaydedilemedi.';
      console.error('Onboarding kayıt hatası:', error);
      setAuthMessage(message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const nextOnboardingStep = async () => {
    if (onboardingStep === onboardingQuestions.length - 1) {
      await saveOnboarding();
      return;
    }

    setOnboardingStep(onboardingStep + 1);
  };

  const skipOnboardingStep = async () => {
    await nextOnboardingStep();
  };

  const handleEmailRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setAuthMessage('Supabase bağlantısı hazır değil.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !cleanUsername || !password) {
      setAuthMessage('Lütfen tüm alanları doldur.');
      return;
    }

    if (cleanUsername.length < 3) {
      setAuthMessage('Kullanıcı adı en az 3 karakter olmalı.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session && data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: cleanUsername,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.user.id);

        if (profileError) {
          throw profileError;
        }

        startOnboarding();
        return;
      }

      setVerificationEmail(cleanEmail);
      setScreen('emailVerification');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Hesap oluşturulamadı.';
      console.error('Kayıt hatası:', error);
      setAuthMessage(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setAuthMessage('Supabase bağlantısı hazır değil.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthMessage('E-posta ve şifreni gir.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw error;
      }

      const metadataUsername =
        typeof data.user.user_metadata?.username === 'string'
          ? data.user.user_metadata.username.trim()
          : '';

      if (metadataUsername) {
        const { error: usernameError } = await supabase
          .from('profiles')
          .update({
            username: metadataUsername,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.user.id)
          .is('username', null);

        if (usernameError && usernameError.code !== '23505') {
          console.warn('Kullanıcı adı profile aktarılamadı:', usernameError);
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (profile?.onboarding_completed) {
        setScreen('home');
      } else {
        startOnboarding();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Giriş yapılamadı.';
      console.error('Giriş hatası:', error);
      setAuthMessage(message);
    } finally {
      setAuthLoading(false);
    }
  };


  const loadFields = async () => {
    if (!supabase) return;

    setFieldsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRealFields([]);
        return;
      }

      const { data, error } = await supabase
        .from('fields')
        .select('id, name, city, district, village, ada, parcel, area_decare, crop, season, status, crop_cycle, planting_year, bearing, latitude, longitude, parcel_geometry, parcel_centroid_lat, parcel_centroid_lng, parcel_lookup_status, parcel_lookup_source')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized: Field[] = (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        ada: Number(item.ada ?? 0),
        parsel: Number(item.parcel ?? 0),
        area: Number(item.area_decare ?? 0),
        crop: item.crop ?? 'Ürün belirtilmedi',
        season: Number(item.season ?? new Date().getFullYear()),
        status: (item.status ?? 'good') as FieldStatus,
        city: item.city ?? undefined,
        district: item.district ?? undefined,
        village: item.village ?? undefined,
        latitude:
          item.latitude === null || item.latitude === undefined
            ? null
            : Number(item.latitude),
        longitude:
          item.longitude === null || item.longitude === undefined
            ? null
            : Number(item.longitude),
        parcelGeometry: item.parcel_geometry ?? null,
        parcelCentroidLat:
          item.parcel_centroid_lat === null || item.parcel_centroid_lat === undefined
            ? null
            : Number(item.parcel_centroid_lat),
        parcelCentroidLng:
          item.parcel_centroid_lng === null || item.parcel_centroid_lng === undefined
            ? null
            : Number(item.parcel_centroid_lng),
        parcelLookupStatus: item.parcel_lookup_status ?? null,
        parcelLookupSource: item.parcel_lookup_source ?? null,
        cropCycle: (item.crop_cycle ?? 'annual') as CropCycle,
        plantingYear:
          item.planting_year === null || item.planting_year === undefined
            ? null
            : Number(item.planting_year),
        bearing:
          item.bearing === null || item.bearing === undefined
            ? null
            : Boolean(item.bearing),
      }));

      setRealFields(normalized);
      setDemoVisible(normalized.length === 0);

      if (screen === 'home') {
        const preferredHomeField =
          normalized.find((field) => String(field.id) === favoriteFieldId) ??
          normalized[0] ??
          null;
        void loadHomeWeather(preferredHomeField);
      }
    } catch (error) {
      console.error('Tarlalar yüklenemedi:', error);
    } finally {
      setFieldsLoading(false);
    }
  };

  const sortTurkishLocationOptions = (items: LocationOption[]) =>
    [...items].sort((a, b) =>
      a.name.localeCompare(b.name, 'tr-TR', {
        sensitivity: 'base',
        numeric: true,
      }),
    );

  const loadProvinceOptions = async () => {
    if (!supabase) {
      setLocationOptionsMessage('Konum listesi için Supabase bağlantısı hazır değil.');
      return;
    }

    setLocationOptionsLoading(true);
    setLocationOptionsMessage('');

    try {
      const { data, error } = await supabase
        .from('tr_provinces')
        .select('id, name');

      if (error) throw error;

      const options: LocationOption[] = (data ?? []).map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? '').trim(),
      }));

      setProvinceOptions(
        sortTurkishLocationOptions(options.filter((item) => item.name)),
      );
    } catch (error) {
      console.error('İl listesi yüklenemedi:', error);
      setLocationOptionsMessage('İl listesi yüklenemedi.');
    } finally {
      setLocationOptionsLoading(false);
    }
  };

  const loadDistrictOptions = async (provinceId: number) => {
    if (!supabase) return;

    setLocationOptionsLoading(true);
    setLocationOptionsMessage('');

    try {
      const { data, error } = await supabase
        .from('tr_districts')
        .select('id, name')
        .eq('province_id', provinceId);

      if (error) throw error;

      const options: LocationOption[] = (data ?? []).map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? '').trim(),
      }));

      setDistrictOptions(
        sortTurkishLocationOptions(options.filter((item) => item.name)),
      );
    } catch (error) {
      console.error('İlçe listesi yüklenemedi:', error);
      setDistrictOptions([]);
      setLocationOptionsMessage('İlçe listesi yüklenemedi.');
    } finally {
      setLocationOptionsLoading(false);
    }
  };

  const loadVillageOptions = async (districtId: number) => {
    if (!supabase) return;

    setLocationOptionsLoading(true);
    setLocationOptionsMessage('');

    try {
      const { data, error } = await supabase
        .from('tr_villages')
        .select('id, name')
        .eq('district_id', districtId);

      if (error) throw error;

      const options: LocationOption[] = (data ?? []).map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? '').trim(),
      }));

      setVillageOptions(
        sortTurkishLocationOptions(options.filter((item) => item.name)),
      );
    } catch (error) {
      console.error('Köy / mahalle listesi yüklenemedi:', error);
      setVillageOptions([]);
      setLocationOptionsMessage('Köy / mahalle listesi yüklenemedi.');
    } finally {
      setLocationOptionsLoading(false);
    }
  };

  const handleProvinceSelection = (value: string) => {
    const provinceId = value ? Number(value) : null;
    const province = provinceOptions.find((item) => item.id === provinceId);

    setSelectedProvinceId(provinceId);
    setFieldCity(province?.name ?? '');

    setSelectedDistrictId(null);
    setFieldDistrict('');
    setFieldVillage('');
    setDistrictOptions([]);
    setVillageOptions([]);

    if (provinceId !== null) {
      void loadDistrictOptions(provinceId);
    }
  };

  const normalizeLocationName = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '');

  const getSelectedProvinceName = () =>
    provinceOptions.find((province) => Number(province.id) === Number(selectedProvinceId))?.name ??
    fieldCity;

  const isCentralDistrictName = (districtName: string) => {
    const province = normalizeLocationName(getSelectedProvinceName());
    const district = normalizeLocationName(districtName);

    if (!province || !district) return false;

    return (
      district === province ||
      district === `${province}merkez` ||
      district === `merkez${province}`
    );
  };

  const getDistrictDisplayName = (districtName: string) =>
    isCentralDistrictName(districtName) ? 'Merkez' : districtName;

  const getDistrictLookupName = (districtName: string) =>
    isCentralDistrictName(districtName) ? 'Merkez' : districtName;

  const handleDistrictSelection = (value: string) => {
    const districtId = value ? Number(value) : null;
    const district = districtOptions.find((item) => item.id === districtId);

    setSelectedDistrictId(districtId);
    setFieldDistrict(district?.name ?? '');

    setFieldVillage('');
    setVillageOptions([]);

    if (districtId !== null) {
      void loadVillageOptions(districtId);
    }
  };

  const handleVillageSelection = (value: string) => {
    const villageId = value ? Number(value) : null;
    const village = villageOptions.find((item) => item.id === villageId);
    setFieldVillage(village?.name ?? '');
  };

  useEffect(() => {
    if (screen === 'addField' && provinceOptions.length === 0) {
      void loadProvinceOptions();
    }
  }, [screen]);

  const handleParcelLookup = async () => {
    setParcelLookupMessage('');

    if (
      !fieldCity.trim() ||
      !fieldDistrict.trim() ||
      !fieldVillage.trim() ||
      !fieldAda.trim() ||
      !fieldParcel.trim()
    ) {
      setParcelLookupMessage(
        'Önce il, ilçe, köy / mahalle, ada ve parsel bilgilerini doldur.',
      );
      return;
    }

    setParcelLookupLoading(true);

    try {
      const result = await lookupParcel({
        province: fieldCity,
        district: getDistrictLookupName(fieldDistrict),
        village: fieldVillage,
        ada: fieldAda,
        parcel: fieldParcel,
      });

      if (!result.found || !result.geometry) {
        setParcelGeometry(null);
        setParcelLookupSource('');
        setShowSatellitePreview(false);
        setParcelLookupMessage(
          result.message ?? 'Bu bilgilerle eşleşen parsel bulunamadı.',
        );
        return;
      }

      setParcelGeometry(result.geometry);
      setParcelLookupSource(result.source ?? '');

      if (result.centroid) {
        setFieldLatitude(result.centroid.latitude);
        setFieldLongitude(result.centroid.longitude);
      }

      if (
        result.areaDecare !== null &&
        result.areaDecare !== undefined &&
        Number.isFinite(result.areaDecare)
      ) {
        setFieldArea(
          result.areaDecare.toLocaleString('tr-TR', {
            maximumFractionDigits: 3,
          }),
        );
      }

      setShowSatellitePreview(true);
      setParcelLookupMessage(
        `Parsel bulundu${result.areaDecare ? ` • ${result.areaDecare.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} da` : ''}.`,
      );
    } catch (error) {
      console.error('Parsel sorgulanamadı:', error);
      setParcelGeometry(null);
      setParcelLookupSource('');
      setShowSatellitePreview(false);
      setParcelLookupMessage(
        error instanceof Error
          ? error.message
          : 'Parsel sorgulanamadı.',
      );
    } finally {
      setParcelLookupLoading(false);
    }
  };

  const captureParcelLocation = () => {
    setParcelLocationMessage('');

    if (!navigator.geolocation) {
      setParcelLocationMessage('Bu cihaz konum bilgisini desteklemiyor.');
      return;
    }

    setParcelLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFieldLatitude(position.coords.latitude);
        setFieldLongitude(position.coords.longitude);
        setShowSatellitePreview(true);
        setParcelLocationMessage(
          `Konum eklendi • yaklaşık ±${Math.round(position.coords.accuracy)} m doğruluk`,
        );
        setParcelLocationLoading(false);
      },
      (error) => {
        console.error('Parsel konumu alınamadı:', error);
        setParcelLocationMessage(
          error.code === 1
            ? 'Konum izni verilmedi. Tarayıcıdan konum iznine izin verip tekrar dene.'
            : 'Konum alınamadı. Açık alanda veya konum servisi açıkken tekrar dene.',
        );
        setParcelLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const openOfficialParcelQuery = () => {
    window.open('https://parselsorgu.tkgm.gov.tr/', '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (screen === 'home') {
      void loadFields();
    }
  }, [screen]);

  const openAddField = () => {
    setFieldFormMessage('');
    setScreen('addField');
  };

  const resetFieldForm = () => {
    setFieldName('');
    setFieldCity('');
    setFieldDistrict('');
    setFieldVillage('');
    setSelectedProvinceId(null);
    setSelectedDistrictId(null);
    setDistrictOptions([]);
    setVillageOptions([]);
    setLocationOptionsMessage('');
    setFieldAda('');
    setFieldParcel('');
    setFieldLatitude(null);
    setFieldLongitude(null);
    setParcelLocationLoading(false);
    setParcelLocationMessage('');
    setShowSatellitePreview(false);
    setParcelLookupLoading(false);
    setParcelLookupMessage('');
    setParcelGeometry(null);
    setParcelLookupSource('');
    setFieldArea('');
    setFieldCrop('');
    setFieldSeason(String(new Date().getFullYear()));
    setFieldCropCycle('annual');
    setFieldPlantingYear('');
    setFieldBearing(true);
    setFieldFormMessage('');
  };

  const handleAddField = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setFieldFormMessage('Supabase bağlantısı hazır değil.');
      return;
    }

    if (
      !fieldName.trim() ||
      !fieldCity.trim() ||
      !fieldDistrict.trim() ||
      !fieldVillage.trim() ||
      !fieldAda.trim() ||
      !fieldParcel.trim() ||
      !fieldArea.trim() ||
      !fieldCrop.trim()
    ) {
      setFieldFormMessage(
        'İl, ilçe, köy / mahalle, tarla adı, ada, parsel, alan ve ürün bilgilerini doldur.',
      );
      return;
    }

    const areaValue = Number(fieldArea.replace(',', '.'));
    const seasonValue = Number(fieldSeason);
    const plantingYearValue = fieldPlantingYear.trim()
      ? Number(fieldPlantingYear)
      : null;

    if (!Number.isFinite(areaValue) || areaValue <= 0) {
      setFieldFormMessage('Alan bilgisini geçerli bir dekar değeri olarak gir.');
      return;
    }

    if (!Number.isInteger(seasonValue) || seasonValue < 2000 || seasonValue > 2100) {
      setFieldFormMessage('Üretim yılı geçerli değil.');
      return;
    }

    if (
      fieldCropCycle === 'perennial' &&
      plantingYearValue !== null &&
      (!Number.isInteger(plantingYearValue) ||
        plantingYearValue < 1900 ||
        plantingYearValue > new Date().getFullYear())
    ) {
      setFieldFormMessage('Dikim yılı geçerli değil.');
      return;
    }

    setFieldFormLoading(true);
    setFieldFormMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Tarla kaydetmek için giriş yapmalısın.');

      const { error } = await supabase.from('fields').insert({
        user_id: user.id,
        name: fieldName.trim(),
        city: fieldCity.trim() || null,
        district: fieldDistrict.trim() || null,
        village: fieldVillage.trim() || null,
        ada: fieldAda.trim(),
        parcel: fieldParcel.trim(),
        latitude: fieldLatitude,
        longitude: fieldLongitude,
        parcel_geometry: parcelGeometry,
        parcel_centroid_lat: fieldLatitude,
        parcel_centroid_lng: fieldLongitude,
        parcel_lookup_status: parcelGeometry ? 'found' : 'pending',
        parcel_lookup_source: parcelLookupSource || null,
        area_decare: areaValue,
        crop: fieldCrop.trim(),
        season: seasonValue,
        crop_cycle: fieldCropCycle,
        planting_year: fieldCropCycle === 'perennial' ? plantingYearValue : null,
        bearing: fieldCropCycle === 'perennial' ? fieldBearing : null,
        status: 'good',
      });

      if (error) throw error;

      resetFieldForm();
      setDemoVisible(false);
      setScreen('home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tarla kaydedilemedi.';
      console.error('Tarla kayıt hatası:', error);
      setFieldFormMessage(message);
    } finally {
      setFieldFormLoading(false);
    }
  };

  const openFieldDetail = (field: Field) => {
    setFieldFabOpen(false);
    setSelectedField(field);
    setSectionFormOpen(false);
    setSectionFormMessage('');
    setAnnualFormOpen(false);
    setYieldFormOpen(false);
    setHistoryMessage('');
    setProductionProfileOpen(false);
    setProductionProfileMessage('');
    setActivityFormOpen(false);
    setActivityMessage('');
    setDetailCropCycle(field.cropCycle ?? 'annual');
    setDetailPlantingYear(
      field.plantingYear === null || field.plantingYear === undefined
        ? ''
        : String(field.plantingYear),
    );
    setDetailBearing(field.bearing ?? true);
    setScreen('fieldDetail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetSectionForm = () => {
    setSectionName('');
    setSectionCrop('');
    setSectionArea('');
    setSectionFormMessage('');
  };

  const clearActivityPhoto = () => {
    if (activityPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(activityPhotoPreview);
    }

    setActivityPhoto(null);
    setActivityPhotoPreview('');
    setAiAnalysis(null);
    setAiAnalysisError('');
  };

  const handleActivityPhotoChange = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setActivityMessage('Lütfen bir fotoğraf dosyası seç.');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setActivityMessage('Fotoğraf 12 MB’dan küçük olmalı.');
      return;
    }

    clearActivityPhoto();
    setActivityPhoto(file);
    setActivityPhotoPreview(URL.createObjectURL(file));
    setAiAnalysis(null);
    setAiAnalysisError('');
    setActivityMessage('');
  };

  const compressActivityPhoto = async (file: File): Promise<Blob> => {
    const image = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      throw new Error('Fotoğraf hazırlanamadı.');
    }

    context.drawImage(image, 0, 0, width, height);
    image.close();

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Fotoğraf sıkıştırılamadı.'));
        },
        'image/jpeg',
        0.82,
      );
    });
  };

  const blobToBase64 = async (blob: Blob): Promise<string> =>
    await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const value = String(reader.result ?? '');
        const commaIndex = value.indexOf(',');
        resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
      };

      reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
      reader.readAsDataURL(blob);
    });

  const applyAiAccessPayload = (value: any) => {
    if (!value) return;

    setAiAccessStatus({
      plan: String(value.plan ?? 'free'),
      dailyFreeUsed: Boolean(
        value.dailyFreeUsed ?? value.daily_free_used ?? false,
      ),
      freeRemaining: Number(
        value.freeRemaining ?? value.free_remaining ?? 0,
      ),
      rewardCredits: Number(
        value.rewardCredits ?? value.reward_credits ?? 0,
      ),
      unlimited: Boolean(value.unlimited ?? false),
    });
  };

  const loadAiAccessStatus = async () => {
    if (!supabase) return;

    setAiAccessLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_ai_access_status');

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      applyAiAccessPayload(row);
    } catch (error) {
      console.error('AI kullanım hakkı yüklenemedi:', error);
    } finally {
      setAiAccessLoading(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);

    return Uint8Array.from(
      [...rawData].map((char) => char.charCodeAt(0)),
    );
  };

  const savePushSubscription = async (subscription: PushSubscription) => {
    if (!supabase) throw new Error('Supabase bağlantısı hazır değil.');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error('Bildirimleri açmak için giriş yapmalısın.');

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          user_agent: navigator.userAgent,
          enabled: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );

    if (error) throw error;
  };

  const checkPushNotificationStatus = async () => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setPushSupported(supported);

    if (!supported) {
      setPushEnabled(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setPushEnabled(Notification.permission === 'granted');
        await savePushSubscription(subscription);
      } else {
        setPushEnabled(false);
      }
    } catch (error) {
      console.warn('Push bildirim durumu kontrol edilemedi:', error);
    }
  };

  const enablePushNotifications = async () => {
    setPushLoading(true);
    setPushMessage('');

    try {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();

      if (!vapidPublicKey) {
        throw new Error(
          'VITE_VAPID_PUBLIC_KEY .env dosyasında bulunamadı.',
        );
      }

      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setPushSupported(false);
        throw new Error('Bu tarayıcı push bildirimlerini desteklemiyor.');
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error(
          permission === 'denied'
            ? 'Bildirim izni reddedildi. Tarayıcı ayarlarından TarlaPusula bildirimlerine izin ver.'
            : 'Bildirim izni verilmedi.',
        );
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await savePushSubscription(subscription);

      setPushEnabled(true);
      setPushMessage(
        'Telefon bildirimleri açık. Hatırlatma zamanı geldiğinde TarlaPusula bildirim gönderebilir.',
      );

      await registration.showNotification('TarlaPusula bildirimleri açık', {
        body: 'Tarla hatırlatmalarını artık telefonunda görebilirsin.',
        tag: 'tarlapusula-push-enabled',
        data: { url: window.location.origin },
      });
    } catch (error) {
      console.error('Push bildirim açılamadı:', error);
      setPushEnabled(false);
      setPushMessage(
        error instanceof Error
          ? error.message
          : 'Telefon bildirimi açılamadı.',
      );
    } finally {
      setPushLoading(false);
    }
  };

  const disablePushNotifications = async () => {
    if (!supabase) return;

    setPushLoading(true);
    setPushMessage('');

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({
            enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('endpoint', subscription.endpoint);

        if (error) throw error;

        await subscription.unsubscribe();
      }

      setPushEnabled(false);
      setPushMessage('Telefon bildirimleri kapatıldı.');
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : 'Bildirimler kapatılamadı.',
      );
    } finally {
      setPushLoading(false);
    }
  };

  const sendTestPushNotification = async () => {
    if (!supabase || !pushEnabled) return;

    setPushLoading(true);
    setPushMessage('');

    try {
      const { data, error } = await supabase.functions.invoke(
        'send-due-reminders',
        {
          body: { test: true },
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPushMessage(
        'Test bildirimi gönderildi. Birkaç saniye içinde görünmeli.',
      );
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : 'Test bildirimi gönderilemedi.',
      );
    } finally {
      setPushLoading(false);
    }
  };

  const resetReminderForm = (field?: Field | null) => {
    setReminderFieldId(field ? String(field.id) : '');
    setReminderType('Saha Kontrolü');
    setReminderTitle('');
    setReminderDate(new Date().toISOString().slice(0, 10));
    setReminderTime('');
    setReminderNotes('');
    setReminderMessage('');
  };

  const loadCalendarReminders = async () => {
    if (!supabase) return;
    setCalendarLoading(true);
    setReminderMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { setCalendarReminders([]); return; }
      const { data, error } = await supabase
        .from('calendar_reminders')
        .select('id, field_id, reminder_type, title, reminder_date, reminder_time, notes, completed, fields(name)')
        .eq('user_id', user.id)
        .order('reminder_date', { ascending: true })
        .order('reminder_time', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setCalendarReminders((data ?? []).map((item:any)=>({
        id:String(item.id), fieldId:String(item.field_id), fieldName:item.fields?.name ?? 'Tarla',
        reminderType:item.reminder_type ?? 'Diğer', title:item.title ?? item.reminder_type ?? 'Hatırlatma',
        reminderDate:item.reminder_date, reminderTime:item.reminder_time ?? null, notes:item.notes ?? null,
        completed:Boolean(item.completed),
      })));
    } catch(error) {
      console.error('Takvim yüklenemedi:', error);
      setReminderMessage(error instanceof Error ? error.message : 'Takvim yüklenemedi.');
    } finally { setCalendarLoading(false); }
  };

  const openCalendarScreen = () => {
    setScreen('calendar');
    void loadCalendarReminders();
    void checkPushNotificationStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReminderModal = (field?: Field | null) => {
    const targetField = field ?? selectedField ?? realFields[0] ?? null;
    resetReminderForm(targetField);
    setReminderFormOpen(true);
  };

  const handleAddReminder = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!reminderFieldId) { setReminderMessage('Hatırlatmanın ait olduğu tarlayı seç.'); return; }
    if (!reminderDate) { setReminderMessage('Hatırlatma tarihini seç.'); return; }
    setReminderFormLoading(true); setReminderMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('calendar_reminders').insert({
        user_id:user.id, field_id:reminderFieldId, reminder_type:reminderType,
        title:reminderTitle.trim() || `${reminderType} hatırlatması`, reminder_date:reminderDate,
        reminder_time: reminderTime || null,
        notes: reminderNotes.trim() || null,
        completed: false,
        notification_enabled: true,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'Europe/Istanbul',
      });
      if (error) throw error;
      setReminderFormOpen(false); resetReminderForm(); await loadCalendarReminders();
    } catch(error) {
      setReminderMessage(error instanceof Error ? error.message : 'Hatırlatma kaydedilemedi.');
    } finally { setReminderFormLoading(false); }
  };

  const handleToggleReminder = async (reminder: CalendarReminder) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('calendar_reminders').update({
      completed:!reminder.completed,
      completed_at:!reminder.completed ? new Date().toISOString() : null,
      updated_at:new Date().toISOString(),
    }).eq('id', reminder.id).eq('user_id', user.id);
    if (error) setReminderMessage(error.message); else await loadCalendarReminders();
  };

  const handleDeleteReminder = async (id:string) => {
    if (!supabase || !window.confirm('Bu hatırlatmayı silmek istiyor musun?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('calendar_reminders').delete().eq('id',id).eq('user_id',user.id);
    if (error) setReminderMessage(error.message); else await loadCalendarReminders();
  };

  const openAiAnalysisScreen = () => {
    setActivityType('Saha Kontrolü');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityNotes('');
    setActivityMessage('');
    clearActivityPhoto();
    setAiAnalysis(null);
    setAiAnalysisError('');

    if (!selectedField && realFields.length > 0) {
      setSelectedField(realFields[0]);
    }

    setScreen('aiAnalysis');
    void loadAiAccessStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAiAnalyzeActivityPhoto = async () => {
    if (!supabase || !selectedField || !activityPhoto) {
      setAiAnalysisError('Önce analiz edilecek bir fotoğraf seç.');
      return;
    }

    setAiAnalyzing(true);
    setAiAnalysisError('');
    setAiAnalysis(null);

    try {
      const compressedPhoto = await compressActivityPhoto(activityPhoto);
      const imageBase64 = await blobToBase64(compressedPhoto);

      const { data, error } = await supabase.functions.invoke(
        'analyze-field-image',
        {
          body: {
            imageBase64,
            mimeType: 'image/jpeg',
            crop: selectedField.crop,
            fieldName: selectedField.name,
            notes: activityNotes.trim() || null,
          },
        },
      );

      if (error) throw error;

      if (data?.access) {
        applyAiAccessPayload(data.access);
      }

      if (data?.limitReached) {
        throw new Error(
          data?.message ??
            'Bugünkü ücretsiz AI analiz hakkını kullandın.',
        );
      }

      if (!data?.analysis) {
        throw new Error('AI analiz sonucu alınamadı.');
      }

      const result = data.analysis as AiFieldAnalysis;

      setAiAnalysis({
        status: result.status ?? 'uncertain',
        headline: result.headline ?? 'Analiz tamamlandı',
        possibleIssue: result.possibleIssue ?? 'Belirsiz',
        confidence: Math.max(
          0,
          Math.min(100, Number(result.confidence ?? 0)),
        ),
        observations: Array.isArray(result.observations)
          ? result.observations
          : [],
        recommendations: Array.isArray(result.recommendations)
          ? result.recommendations
          : [],
        disclaimer:
          result.disclaimer ??
          'Bu sonuç yalnızca fotoğrafa dayalı ön değerlendirmedir.',
      });

      void loadAiAccessStatus();
    } catch (error) {
      console.error('AI saha analizi hatası:', error);
      setAiAnalysisError(
        error instanceof Error
          ? error.message
          : 'Fotoğraf AI ile analiz edilemedi.',
      );
    } finally {
      setAiAnalyzing(false);
    }
  };

  const resetActivityForm = (type = 'Saha Kontrolü') => {
    setActivityType(type);
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityProductName('');
    setActivityQuantity('');
    setActivityUnit('');
    setActivityDoseMode(
      type === 'Gübreleme' || type === 'İlaçlama' ? 'per_decare' : 'total',
    );
    setActivityWaterM3('');
    setActivityDurationHours('');
    setActivityCost('');
    setActivityNotes('');
    clearActivityPhoto();
    setAiAnalysis(null);
    setAiAnalysisError('');
    setActivityMessage('');
  };

  const loadFieldActivities = async (field: Field) => {
    const supabaseClient = supabase;

    if (!supabaseClient || field.demo) {
      setActivities([]);
      return;
    }

    setActivitiesLoading(true);
    setActivityMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setActivities([]);
        return;
      }

      const { data, error } = await supabaseClient
        .from('activities')
        .select(
          'id, activity_type, title, activity_date, product_name, quantity, unit, cost, notes, photo_path, ai_analysis',
        )
        .eq('field_id', String(field.id))
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedActivities = await Promise.all(
        (data ?? []).map(async (item) => {
          let photoUrl: string | null = null;

          if (item.photo_path) {
            const { data: signedData } = await supabaseClient.storage
              .from('field-activity-photos')
              .createSignedUrl(item.photo_path, 60 * 60);

            photoUrl = signedData?.signedUrl ?? null;
          }

          return {
            id: String(item.id),
            type: item.activity_type ?? 'Diğer',
            title: item.title ?? item.activity_type ?? 'Tarla işlemi',
            activityDate: item.activity_date,
            productName: item.product_name ?? null,
            quantity:
              item.quantity === null || item.quantity === undefined
                ? null
                : Number(item.quantity),
            unit: item.unit ?? null,
            cost:
              item.cost === null || item.cost === undefined
                ? null
                : Number(item.cost),
            notes: item.notes ?? null,
            photoPath: item.photo_path ?? null,
            photoUrl,
            aiAnalysis: item.ai_analysis
              ? (item.ai_analysis as AiFieldAnalysis)
              : null,
          } satisfies FieldActivity;
        }),
      );

      setActivities(mappedActivities);
    } catch (error) {
      console.error('Tarla işlemleri yüklenemedi:', error);
      setActivityMessage(
        error instanceof Error ? error.message : 'Tarla işlemleri yüklenemedi.',
      );
    } finally {
      setActivitiesLoading(false);
    }
  };

  const openActivityForm = (type: string) => {
    if (!selectedField || selectedField.demo) {
      alert('Örnek tarlaya gerçek işlem kaydı eklenmez.');
      return;
    }

    resetActivityForm(type);
    setActivityFormOpen(true);
    setTimeout(() => {
      document
        .querySelector('.tp-activity-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleAddActivity = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!supabase || !selectedField || selectedField.demo) return;

    const quantityValue = activityQuantity.trim()
      ? Number(activityQuantity.replace(',', '.'))
      : null;
    const costValue = activityCost.trim()
      ? Number(activityCost.replace(',', '.'))
      : null;
    const waterM3Value = activityWaterM3.trim()
      ? Number(activityWaterM3.replace(',', '.'))
      : null;
    const durationHoursValue = activityDurationHours.trim()
      ? Number(activityDurationHours.replace(',', '.'))
      : null;

    const isDoseActivity =
      activityType === 'Gübreleme' || activityType === 'İlaçlama';

    const calculatedTotalQuantity =
      isDoseActivity &&
      quantityValue !== null &&
      activityDoseMode === 'per_decare' &&
      selectedField.area > 0
        ? quantityValue * selectedField.area
        : quantityValue;

    const calculatedPerDecare =
      isDoseActivity &&
      quantityValue !== null &&
      activityDoseMode === 'total' &&
      selectedField.area > 0
        ? quantityValue / selectedField.area
        : quantityValue;

    if (
      quantityValue !== null &&
      (!Number.isFinite(quantityValue) || quantityValue < 0)
    ) {
      setActivityMessage('Miktar geçerli bir sayı olmalı.');
      return;
    }

    if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) {
      setActivityMessage('Maliyet geçerli bir sayı olmalı.');
      return;
    }

    if (waterM3Value !== null && (!Number.isFinite(waterM3Value) || waterM3Value < 0)) {
      setActivityMessage('Sulama suyu miktarı geçerli bir sayı olmalı.');
      return;
    }

    if (
      durationHoursValue !== null &&
      (!Number.isFinite(durationHoursValue) || durationHoursValue < 0)
    ) {
      setActivityMessage('Sulama süresi geçerli bir sayı olmalı.');
      return;
    }

    setActivityFormLoading(true);
    setActivityMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      let uploadedPhotoPath: string | null = null;

      if (activityPhoto) {
        setActivityMessage('Fotoğraf hazırlanıyor...');

        const compressedPhoto = await compressActivityPhoto(activityPhoto);
        uploadedPhotoPath = `${user.id}/${selectedField.id}/${Date.now()}-${crypto.randomUUID()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('field-activity-photos')
          .upload(uploadedPhotoPath, compressedPhoto, {
            contentType: 'image/jpeg',
            upsert: false,
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;
        setActivityMessage('');
      }

      const automaticDetails: string[] = [];

      if (isDoseActivity && quantityValue !== null) {
        if (activityDoseMode === 'per_decare') {
          automaticDetails.push(
            `Dekara uygulama: ${quantityValue} ${activityUnit || ''}/da`,
          );
          automaticDetails.push(
            `Toplam kullanılan: ${calculatedTotalQuantity} ${activityUnit || ''}`,
          );
        } else {
          automaticDetails.push(
            `Toplam kullanılan: ${quantityValue} ${activityUnit || ''}`,
          );
          automaticDetails.push(
            `Dekara uygulama: ${calculatedPerDecare !== null ? calculatedPerDecare.toFixed(2) : '0.00'} ${activityUnit || ''}/da`,
          );
        }
      }

      if (activityType === 'Sulama') {
        if (waterM3Value !== null) {
          automaticDetails.push(`Toplam sulama suyu: ${waterM3Value} m³`);
          if (selectedField.area > 0) {
            automaticDetails.push(
              `Dekara sulama suyu: ${(waterM3Value / selectedField.area).toFixed(2)} m³/da`,
            );
          }
        }
        if (durationHoursValue !== null) {
          automaticDetails.push(`Sulama süresi: ${durationHoursValue} saat`);
        }
      }

      const combinedNotes = [
        ...automaticDetails,
        activityNotes.trim(),
      ]
        .filter(Boolean)
        .join(' • ');

      const { error } = await supabase.from('activities').insert({
        user_id: user.id,
        field_id: String(selectedField.id),
        field_section_id: null,
        activity_type: activityType,
        title: activityType,
        activity_date: activityDate,
        product_name: activityProductName.trim() || null,
        quantity: isDoseActivity ? calculatedTotalQuantity : quantityValue,
        unit:
          activityType === 'Sulama' && waterM3Value !== null
            ? 'm³'
            : activityUnit.trim() || null,
        cost: costValue,
        notes: combinedNotes || null,
        photo_path: uploadedPhotoPath,
        ai_analysis: aiAnalysis,
        ai_analyzed_at: aiAnalysis ? new Date().toISOString() : null,
      });

      if (error) {
        if (uploadedPhotoPath) {
          await supabase.storage
            .from('field-activity-photos')
            .remove([uploadedPhotoPath]);
        }
        throw error;
      }

      resetActivityForm();
      setActivityFormOpen(false);
      await loadFieldActivities(selectedField);
    } catch (error) {
      console.error('Tarla işlemi kaydedilemedi:', error);
      setActivityMessage(
        error instanceof Error ? error.message : 'Tarla işlemi kaydedilemedi.',
      );
    } finally {
      setActivityFormLoading(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!supabase || !selectedField || selectedField.demo) return;
    if (!window.confirm('Bu işlem kaydını silmek istiyor musun?')) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const activityToDelete = activities.find((item) => item.id === id);

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      if (activityToDelete?.photoPath) {
        await supabase.storage
          .from('field-activity-photos')
          .remove([activityToDelete.photoPath]);
      }

      await loadFieldActivities(selectedField);
    } catch (error) {
      setActivityMessage(
        error instanceof Error ? error.message : 'İşlem kaydı silinemedi.',
      );
    }
  };

  const resetAnnualForm = () => {
    setAnnualYear(String(new Date().getFullYear()));
    setAnnualCrop(selectedField?.crop ?? '');
    setAnnualPlantingDate('');
    setAnnualHarvestDate('');
    setAnnualNotes('');
    setHistoryMessage('');
  };

  const resetYieldForm = () => {
    setYieldYear(String(new Date().getFullYear()));
    setYieldKg('');
    setYieldHarvestDate('');
    setYieldNotes('');
    setHistoryMessage('');
  };

  const loadProductionHistory = async (field: Field) => {
    if (!supabase || field.demo) {
      setAnnualSeasons([]);
      setPerennialYields([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setAnnualSeasons([]);
        setPerennialYields([]);
        return;
      }

      const [seasonResult, yieldResult] = await Promise.all([
        supabase
          .from('field_seasons')
          .select('id, year, crop, planting_date, harvest_date, notes')
          .eq('field_id', String(field.id))
          .eq('user_id', user.id)
          .order('year', { ascending: false }),
        supabase
          .from('perennial_yields')
          .select('id, year, yield_kg, harvest_date, notes')
          .eq('field_id', String(field.id))
          .eq('user_id', user.id)
          .is('field_section_id', null)
          .order('year', { ascending: false }),
      ]);

      if (seasonResult.error) throw seasonResult.error;
      if (yieldResult.error) throw yieldResult.error;

      setAnnualSeasons(
        (seasonResult.data ?? []).map((item) => ({
          id: String(item.id),
          year: Number(item.year),
          crop: item.crop ?? 'Ürün belirtilmedi',
          plantingDate: item.planting_date ?? null,
          harvestDate: item.harvest_date ?? null,
          notes: item.notes ?? null,
        })),
      );

      setPerennialYields(
        (yieldResult.data ?? []).map((item) => ({
          id: String(item.id),
          year: Number(item.year),
          yieldKg:
            item.yield_kg === null || item.yield_kg === undefined
              ? null
              : Number(item.yield_kg),
          harvestDate: item.harvest_date ?? null,
          notes: item.notes ?? null,
        })),
      );
    } catch (error) {
      console.error('Üretim geçmişi yüklenemedi:', error);
      setHistoryMessage(
        error instanceof Error ? error.message : 'Üretim geçmişi yüklenemedi.',
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveProductionProfile = async () => {
    if (!supabase || !selectedField || selectedField.demo) return;

    const parsedPlantingYear = detailPlantingYear.trim()
      ? Number(detailPlantingYear)
      : null;

    if (
      detailCropCycle === 'perennial' &&
      parsedPlantingYear !== null &&
      (!Number.isInteger(parsedPlantingYear) ||
        parsedPlantingYear < 1900 ||
        parsedPlantingYear > new Date().getFullYear())
    ) {
      setProductionProfileMessage('Dikim yılı geçerli değil.');
      return;
    }

    setProductionProfileLoading(true);
    setProductionProfileMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('fields')
        .update({
          crop_cycle: detailCropCycle,
          planting_year:
            detailCropCycle === 'perennial' ? parsedPlantingYear : null,
          bearing: detailCropCycle === 'perennial' ? detailBearing : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(selectedField.id))
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedField: Field = {
        ...selectedField,
        cropCycle: detailCropCycle,
        plantingYear:
          detailCropCycle === 'perennial' ? parsedPlantingYear : null,
        bearing: detailCropCycle === 'perennial' ? detailBearing : null,
      };

      setSelectedField(updatedField);
      setRealFields((current) =>
        current.map((field) =>
          String(field.id) === String(updatedField.id) ? updatedField : field,
        ),
      );
      setProductionProfileOpen(false);
      setProductionProfileMessage('Ürün tipi güncellendi.');
      await loadProductionHistory(updatedField);
    } catch (error) {
      console.error('Ürün tipi güncellenemedi:', error);
      setProductionProfileMessage(
        error instanceof Error ? error.message : 'Ürün tipi güncellenemedi.',
      );
    } finally {
      setProductionProfileLoading(false);
    }
  };

  const handleAddAnnualSeason = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase || !selectedField || selectedField.demo) return;

    const year = Number(annualYear);
    const crop = annualCrop.trim();

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setHistoryMessage('Sezon yılı geçerli değil.');
      return;
    }

    if (!crop) {
      setHistoryMessage('Sezonda yetiştirilen ürünü yaz.');
      return;
    }

    setAnnualFormLoading(true);
    setHistoryMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase.from('field_seasons').insert({
        field_id: String(selectedField.id),
        user_id: user.id,
        year,
        crop,
        planting_date: annualPlantingDate || null,
        harvest_date: annualHarvestDate || null,
        notes: annualNotes.trim() || null,
      });

      if (error) throw error;

      resetAnnualForm();
      setAnnualFormOpen(false);
      await loadProductionHistory(selectedField);
    } catch (error) {
      console.error('Sezon kaydedilemedi:', error);
      setHistoryMessage(
        error instanceof Error ? error.message : 'Sezon kaydedilemedi.',
      );
    } finally {
      setAnnualFormLoading(false);
    }
  };

  const handleDeleteAnnualSeason = async (id: string) => {
    if (!supabase || !selectedField || selectedField.demo) return;
    if (!window.confirm('Bu sezon kaydını silmek istiyor musun?')) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('field_seasons')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      await loadProductionHistory(selectedField);
    } catch (error) {
      setHistoryMessage(
        error instanceof Error ? error.message : 'Sezon silinemedi.',
      );
    }
  };

  const handleAddPerennialYield = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase || !selectedField || selectedField.demo) return;

    const year = Number(yieldYear);
    const yieldValue = yieldKg.trim()
      ? Number(yieldKg.replace(',', '.'))
      : null;

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setHistoryMessage('Verim yılı geçerli değil.');
      return;
    }

    if (
      yieldValue !== null &&
      (!Number.isFinite(yieldValue) || yieldValue < 0)
    ) {
      setHistoryMessage('Ürün miktarı geçerli değil.');
      return;
    }

    setYieldFormLoading(true);
    setHistoryMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { data: existing, error: existingError } = await supabase
        .from('perennial_yields')
        .select('id')
        .eq('field_id', String(selectedField.id))
        .eq('user_id', user.id)
        .eq('year', year)
        .is('field_section_id', null)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await supabase
          .from('perennial_yields')
          .update({
            yield_kg: yieldValue,
            harvest_date: yieldHarvestDate || null,
            notes: yieldNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('perennial_yields').insert({
          field_id: String(selectedField.id),
          user_id: user.id,
          field_section_id: null,
          year,
          yield_kg: yieldValue,
          harvest_date: yieldHarvestDate || null,
          notes: yieldNotes.trim() || null,
        });

        if (error) throw error;
      }

      resetYieldForm();
      setYieldFormOpen(false);
      await loadProductionHistory(selectedField);
    } catch (error) {
      console.error('Yıllık verim kaydedilemedi:', error);
      setHistoryMessage(
        error instanceof Error ? error.message : 'Yıllık verim kaydedilemedi.',
      );
    } finally {
      setYieldFormLoading(false);
    }
  };

  const handleDeletePerennialYield = async (id: string) => {
    if (!supabase || !selectedField || selectedField.demo) return;
    if (!window.confirm('Bu yıllık verim kaydını silmek istiyor musun?')) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('perennial_yields')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      await loadProductionHistory(selectedField);
    } catch (error) {
      setHistoryMessage(
        error instanceof Error ? error.message : 'Verim kaydı silinemedi.',
      );
    }
  };

  const loadFieldSections = async (field: Field) => {
    if (!supabase || field.demo) {
      setFieldSections([]);
      return;
    }

    setSectionsLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setFieldSections([]);
        return;
      }

      const { data, error } = await supabase
        .from('field_sections')
        .select('id, field_id, name, crop, area_decare')
        .eq('field_id', String(field.id))
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setFieldSections(
        (data ?? []).map((item) => ({
          id: String(item.id),
          fieldId: String(item.field_id),
          name: item.name?.trim() || 'İsimsiz bölüm',
          crop: item.crop?.trim() || 'Ürün belirtilmedi',
          area:
            item.area_decare === null || item.area_decare === undefined
              ? null
              : Number(item.area_decare),
        })),
      );
    } catch (error) {
      console.error('Tarla bölümleri yüklenemedi:', error);
      setSectionFormMessage(
        error instanceof Error ? error.message : 'Tarla bölümleri yüklenemedi.',
      );
    } finally {
      setSectionsLoading(false);
    }
  };

  const handleAddFieldSection = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase || !selectedField || selectedField.demo) {
      setSectionFormMessage('Bu işlem gerçek bir tarla kaydı gerektirir.');
      return;
    }

    const cleanName = sectionName.trim();
    const cleanCrop = sectionCrop.trim();
    const parsedArea = sectionArea.trim()
      ? Number(sectionArea.replace(',', '.'))
      : null;

    if (!cleanName || !cleanCrop) {
      setSectionFormMessage('Bölüm adı ve ürün bilgisini doldur.');
      return;
    }

    if (parsedArea !== null && (!Number.isFinite(parsedArea) || parsedArea <= 0)) {
      setSectionFormMessage('Bölüm alanı geçerli bir sayı olmalı.');
      return;
    }

    const otherSectionsArea = fieldSections.reduce(
      (total, item) => total + (item.area ?? 0),
      0,
    );

    if (
      parsedArea !== null &&
      otherSectionsArea + parsedArea > selectedField.area + 0.0001
    ) {
      setSectionFormMessage(
        `Bölümlerin toplam alanı tarla alanını (${selectedField.area.toLocaleString(
          'tr-TR',
        )} da) geçemez.`,
      );
      return;
    }

    setSectionFormLoading(true);
    setSectionFormMessage('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase.from('field_sections').insert({
        field_id: String(selectedField.id),
        user_id: user.id,
        name: cleanName,
        crop: cleanCrop,
        area_decare: parsedArea,
      });

      if (error) throw error;

      resetSectionForm();
      setSectionFormOpen(false);
      await loadFieldSections(selectedField);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tarla bölümü kaydedilemedi.';
      console.error('Tarla bölümü kayıt hatası:', error);
      setSectionFormMessage(message);
    } finally {
      setSectionFormLoading(false);
    }
  };

  const handleDeleteFieldSection = async (sectionId: string) => {
    if (!supabase || !selectedField || selectedField.demo) return;

    const confirmed = window.confirm('Bu tarla bölümünü silmek istiyor musun?');
    if (!confirmed) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('field_sections')
        .delete()
        .eq('id', sectionId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadFieldSections(selectedField);
    } catch (error) {
      console.error('Tarla bölümü silinemedi:', error);
      setSectionFormMessage(
        error instanceof Error ? error.message : 'Tarla bölümü silinemedi.',
      );
    }
  };

  useEffect(() => {
    if (screen === 'fieldDetail' && selectedField) {
      void loadFieldSections(selectedField);
      void loadProductionHistory(selectedField);
      void loadFieldActivities(selectedField);
      setDetailCropCycle(selectedField.cropCycle ?? 'annual');
      setDetailPlantingYear(
        selectedField.plantingYear === null ||
          selectedField.plantingYear === undefined
          ? ''
          : String(selectedField.plantingYear),
      );
      setDetailBearing(selectedField.bearing ?? true);
    }
  }, [screen, selectedField?.id]);

  const cmsPageFor = (pageKey: string) =>
  cmsPages.find((item) => item.page_key === pageKey && item.is_visible);

const cmsBlockFor = (pageKey: string, blockKey: string) =>
  cmsBlocks.find(
    (item) =>
      item.page_key === pageKey &&
      item.block_key === blockKey &&
      item.is_visible
  );

const cmsMenuFor = (menuKey: string) =>
  cmsMenus.find(
    (item) => item.menu_key === menuKey && item.is_visible
  );

const cmsText = (
  block: CmsBlockRow | undefined,
  fallback: string
) => block?.title || fallback;

const cmsSub = (
  block: CmsBlockRow | undefined,
  fallback: string
) => block?.subtitle || block?.description || fallback;

  const goodFieldCount = realFields.filter((field) => field.status === 'good').length;
  const checkFieldCount = realFields.filter((field) => field.status === 'check').length;
  const urgentFieldCount = realFields.filter((field) => field.status === 'urgent').length;

  if (screen === 'calendar') {
    const calendarPage = cmsPageFor('calendar');
    const calendarHeaderBlock = cmsBlockFor('calendar','page-header');
    const calendarHeroBlock = cmsBlockFor('calendar','hero');
    const calendarPushBlock = cmsBlockFor('calendar','push-card');
    const calendarToolbarBlock = cmsBlockFor('calendar','toolbar');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = calendarReminders.filter((i) => !i.completed && i.reminderDate >= today);
    const overdue = calendarReminders.filter((i) => !i.completed && i.reminderDate < today);
    const completed = calendarReminders.filter((i) => i.completed);
    const icon = (t:string) => t==='Gübreleme'?'🧪':t==='İlaçlama'?'🧴':t==='Sulama'?'💧':t==='Hasat'?'🧺':t==='Ekim / Dikim'?'🌱':t==='Saha Kontrolü'?'📷':'🗓️';
    const card = (i:CalendarReminder) => (
      <article key={i.id} className={`tp-calendar-item ${i.completed?'completed':''}`}>
        <button className="tp-calendar-check" onClick={()=>void handleToggleReminder(i)}>{i.completed?'✓':''}</button>
        <div className="tp-calendar-icon">{icon(i.reminderType)}</div>
        <div className="tp-calendar-copy">
          <div className="tp-calendar-title-row"><strong>{i.title}</strong><span>{i.reminderType}</span></div>
          <p>{i.fieldName}</p>
          <div className="tp-calendar-meta"><span>📅 {i.reminderDate}</span>{i.reminderTime&&<span>⏰ {i.reminderTime.slice(0,5)}</span>}</div>
          {i.notes&&<small>{i.notes}</small>}
        </div>
        <button className="tp-calendar-delete" onClick={()=>void handleDeleteReminder(i.id)}>Sil</button>
      </article>
    );
    return (<>
      <style>{cmsRuntimeCss + onboardingStyles}</style>
      <div className="tp-calendar-page">
        <header className="tp-calendar-header"><button onClick={()=>setScreen('home')}>←</button><div><span>TarlaPusula</span><strong>{cmsText(calendarHeaderBlock, calendarPage?.title || 'Takvim & Hatırlatmalar')}</strong></div><button className="tp-calendar-header-add" onClick={()=>openReminderModal()}>+</button></header>
        <main className="tp-calendar-content">
          <section className="tp-calendar-hero"><div><span>{calendarHeroBlock?.icon || 'BUGÜNÜ PLANLA'}</span><h1>{cmsText(calendarHeroBlock,'Tarladaki işleri zamanı gelmeden hatırla.')}</h1><p>{cmsSub(calendarHeroBlock,'Gübreleme, sulama, ilaçlama, hasat ve saha kontrollerini tarlaya bağlı olarak planlayabilirsin.')}</p></div><div className="tp-calendar-summary"><div><strong>{upcoming.length}</strong><span>Yaklaşan</span></div><div><strong>{overdue.length}</strong><span>Geciken</span></div><div><strong>{completed.length}</strong><span>Tamamlanan</span></div></div></section>

          <section className={`tp-push-card ${pushEnabled ? 'enabled' : ''}`}>
            <div className="tp-push-icon">{pushEnabled ? '🔔' : '🔕'}</div>

            <div className="tp-push-copy">
              <span>{cmsText(calendarPushBlock,'TELEFON BİLDİRİMLERİ')}</span>
              <strong>
                {pushEnabled
                  ? 'Hatırlatmalar telefonuna gelecek'
                  : 'Tarla işlerini telefonunda hatırla'}
              </strong>
              <p>
                {pushSupported
                  ? 'Uygulama kapalıyken bile planladığın tarla işlemleri için bildirim alabilirsin.'
                  : 'Bu tarayıcı web push bildirimlerini desteklemiyor.'}
              </p>
              {pushMessage && <small>{pushMessage}</small>}
            </div>

            <div className="tp-push-actions">
              {pushEnabled ? (
                <>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void sendTestPushNotification()}
                    disabled={pushLoading}
                  >
                    Test Gönder
                  </button>

                  <button
                    type="button"
                    onClick={() => void disablePushNotifications()}
                    disabled={pushLoading}
                  >
                    Kapat
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void enablePushNotifications()}
                  disabled={pushLoading || !pushSupported}
                >
                  {pushLoading ? 'Açılıyor...' : 'Bildirimleri Aç'}
                </button>
              )}
            </div>
          </section>

          <div className="tp-calendar-toolbar" style={{...cmsBlockStyle(calendarToolbarBlock)}}><div><span>{calendarToolbarBlock?.icon || 'PLANLARIM'}</span><strong>{cmsText(calendarToolbarBlock,'Tarla görevleri')}</strong></div><button onClick={()=>openReminderModal()}>{calendarToolbarBlock?.button_text || '+ Hatırlatma Ekle'}</button></div>
          {calendarLoading?<div className="tp-section-loading">Takvim yükleniyor...</div>:<div className="tp-calendar-groups">
            {overdue.length>0&&<section><div className="tp-calendar-group-title overdue"><span>GECİKENLER</span><strong>{overdue.length} işlem</strong></div><div className="tp-calendar-list">{overdue.map(card)}</div></section>}
            <section><div className="tp-calendar-group-title"><span>YAKLAŞAN</span><strong>{upcoming.length} işlem</strong></div>{upcoming.length?<div className="tp-calendar-list">{upcoming.map(card)}</div>:<div className="tp-calendar-empty"><div>🗓️</div><strong>Yaklaşan bir işlem yok</strong><p>Yeni bir hatırlatma ekleyerek tarla planını oluştur.</p><button onClick={()=>openReminderModal()}>+ İlk Hatırlatmayı Ekle</button></div>}</section>
            {completed.length>0&&<section><div className="tp-calendar-group-title completed"><span>TAMAMLANAN</span><strong>{completed.length} işlem</strong></div><div className="tp-calendar-list">{completed.slice(0,10).map(card)}</div></section>}
          </div>}
          {reminderMessage&&!reminderFormOpen&&<div className="tp-field-section-message">{reminderMessage}</div>}
        </main>
        {reminderFormOpen&&<div className="tp-modal-backdrop" onMouseDown={()=>{setReminderFormOpen(false);setReminderMessage('')}}><div className="tp-modal-card tp-modal-card-medium" onMouseDown={e=>e.stopPropagation()}><form className="tp-reminder-form tp-modal-form" onSubmit={handleAddReminder}>
          <div className="tp-production-profile-title"><div><span>YENİ HATIRLATMA</span><strong>Tarla işini planla</strong></div><button type="button" onClick={()=>setReminderFormOpen(false)}>×</button></div>
          <label>Tarla<MobileWheelPicker title="Tarla seç" value={reminderFieldId} onChange={setReminderFieldId} placeholder="Tarla seç" searchable options={realFields.map(f=>({value:String(f.id),label:f.name}))} /></label>
          <label>İşlem türü<MobileWheelPicker title="İşlem türü" value={reminderType} onChange={setReminderType} options={['Saha Kontrolü','Gübreleme','İlaçlama','Sulama','Ekim / Dikim','Hasat','Budama','Diğer'].map(item=>({value:item,label:item}))} /></label>
          <label className="tp-reminder-full">Başlık<input value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} placeholder="Örn: 2. azot uygulaması" /></label>
          <label>Tarih<input type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)} /></label><label>Saat (isteğe bağlı)<input type="time" value={reminderTime} onChange={e=>setReminderTime(e.target.value)} /></label>
          <label className="tp-reminder-full">Not<textarea value={reminderNotes} onChange={e=>setReminderNotes(e.target.value)} placeholder="İşlemle ilgili kısa not..." /></label>
          {reminderMessage&&<div className="tp-field-section-message tp-reminder-full">{reminderMessage}</div>}
          <div className="tp-modal-actions tp-reminder-full"><button type="button" className="tp-modal-cancel" onClick={()=>setReminderFormOpen(false)}>İptal</button><button type="submit" className="tp-production-profile-save tp-modal-primary" disabled={reminderFormLoading}>{reminderFormLoading?'Kaydediliyor...':'Hatırlatmayı Kaydet'}</button></div>
        </form></div></div>}
        <nav className="bottomNav"><button onClick={()=>setScreen('home')}><span>{cmsMenuFor('home-main')?.icon || '⌂'}</span>{cmsMenuFor('home-main')?.label || 'Ana Sayfa'}</button><button onClick={()=>{setScreen('home');setTimeout(()=>document.querySelector('.fieldsSection')?.scrollIntoView({behavior:'smooth'}),60)}}><span>{cmsMenuFor('fields-main')?.icon || '🌾'}</span>{cmsMenuFor('fields-main')?.label || 'Tarlalarım'}</button><button className="addButton" onClick={openAiAnalysisScreen}><span>{cmsMenuFor('ai-main')?.icon || '✦'}</span>{cmsMenuFor('ai-main')?.label || 'AI Analiz'}</button><button className="active"><span>{cmsMenuFor('calendar-main')?.icon || '▣'}</span>{cmsMenuFor('calendar-main')?.label || 'Takvim'}</button><button><span>{cmsMenuFor('more-main')?.icon || '•••'}</span>{cmsMenuFor('more-main')?.label || 'Daha Fazla'}</button></nav>
      </div></>);
  }

  if (screen === 'aiAnalysis') {
  const aiPage = cmsPageFor('aiAnalysis');
  const aiHeaderBlock = cmsBlockFor('aiAnalysis','page-header');
  const aiHeroBlock = cmsBlockFor('aiAnalysis','hero');
  const aiAccessBlock = cmsBlockFor('aiAnalysis','access');
  const aiFieldStepBlock = cmsBlockFor('aiAnalysis','field-step');
  const aiPhotoStepBlock = cmsBlockFor('aiAnalysis','photo-step');
  const aiPickerBlock = cmsBlockFor('aiAnalysis','photo-picker');
  const aiNoteBlock = cmsBlockFor('aiAnalysis','note');
  const aiAnalyzeBlock = cmsBlockFor('aiAnalysis','analyze-button');
  const canAnalyze =
    aiAccessStatus?.unlimited ||
    (aiAccessStatus?.freeRemaining ?? 0) > 0 ||
    (aiAccessStatus?.rewardCredits ?? 0) > 0;

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      <div className="tp-ai-page">
        <header className="tp-ai-page-header">
          <button onClick={() => setScreen('home')}>←</button>

          <div>
            <span>TarlaPusula AI</span>
            <strong>{cmsText(aiHeaderBlock, aiPage?.title || 'Fotoğraftan Ön Analiz')}</strong>
          </div>

          <div className="tp-ai-page-spark" style={{fontSize:aiHeaderBlock?.icon_size || undefined}}>{aiHeaderBlock?.icon || aiPage?.icon || '✦'}</div>
        </header>

        <main className="tp-ai-page-content">
          <section className="tp-ai-hero">
            <div className="tp-ai-hero-icon">✦</div>

            <div>
              <span>{aiHeroBlock?.icon || 'AI TARLA ASİSTANI'}</span>
              <h1>{cmsText(aiHeroBlock,'Fotoğrafı çek, tarladaki belirtiyi birlikte inceleyelim.')}</h1>
              <p>{cmsSub(aiHeroBlock,'Yaprak, meyve veya sorunlu bölgenin net bir fotoğrafını yükle. Sonuç kesin teşhis değil, hızlı bir saha ön değerlendirmesidir.')}</p>
            </div>
          </section>

          <section className="tp-ai-access-card">
            <div className="tp-ai-access-copy">
              <span>{cmsText(aiAccessBlock,'KULLANIM HAKKI')}</span>

              {aiAccessLoading ? (
                <strong>Kontrol ediliyor...</strong>
              ) : aiAccessStatus?.unlimited ? (
                <>
                  <strong>Pro • Sınırsız AI Analiz</strong>
                  <small>Ücretli aboneliğinde günlük sınır yok.</small>
                </>
              ) : (
                <>
                  <strong>
                    Bugün {aiAccessStatus?.freeRemaining ?? 0} ücretsiz analiz hakkın var
                  </strong>
                  <small>
                    Ücretsiz planda her gün 1 analiz. Ek haklar ileride ödüllü
                    reklam izleyerek kazanılabilecek.
                  </small>
                </>
              )}
            </div>

            {!aiAccessStatus?.unlimited && (
              <div className="tp-ai-access-badges">
                <span>
                  Günlük: {aiAccessStatus?.freeRemaining ?? 0}/1
                </span>
                <span>
                  Ek hak: {aiAccessStatus?.rewardCredits ?? 0}
                </span>
              </div>
            )}
          </section>

          <section className="tp-ai-workspace">
            <div className="tp-ai-workspace-head">
              <div>
                <span>{aiFieldStepBlock?.icon || '1. TARLAYI SEÇ'}</span>
                <strong>{cmsText(aiFieldStepBlock,'Analizin hangi tarlaya ait?')}</strong>
              </div>
            </div>

            {realFields.length > 0 ? (
              <MobileWheelPicker
                className="tp-ai-field-select"
                title="Analiz edilecek tarla"
                value={selectedField ? String(selectedField.id) : ''}
                placeholder="Tarla seç"
                searchable
                options={realFields.map((field) => ({
                  value: String(field.id),
                  label: field.name,
                  subtitle: `${field.crop} • ${field.area.toLocaleString('tr-TR')} da`,
                }))}
                onChange={(value) => {
                  const field = realFields.find(
                    (item) => String(item.id) === value,
                  );
                  setSelectedField(field ?? null);
                  clearActivityPhoto();
                }}
              />
            ) : (
              <div className="tp-ai-empty-field">
                <strong>Önce bir tarla eklemelisin.</strong>
                <button onClick={openAddField}>+ Tarla Ekle</button>
              </div>
            )}

            <div className="tp-ai-workspace-head tp-ai-step-two">
              <div>
                <span>{aiPhotoStepBlock?.icon || '2. FOTOĞRAF'}</span>
                <strong>{cmsText(aiPhotoStepBlock,'Belirtiyi net gösteren bir görüntü ekle')}</strong>
              </div>
            </div>

            {activityPhotoPreview ? (
              <div className="tp-ai-main-photo">
                <img src={activityPhotoPreview} alt="AI analiz fotoğrafı" />

                <div>
                  <strong>Fotoğraf hazır</strong>
                  <small>
                    Yakın çekim ve iyi ışık analiz kalitesini artırır.
                  </small>

                  <label>
                    Fotoğrafı Değiştir
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        handleActivityPhotoChange(e.target.files?.[0])
                      }
                    />
                  </label>

                  <button type="button" onClick={clearActivityPhoto}>
                    Fotoğrafı Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <label className="tp-ai-main-picker">
                <div>📷</div>
                <strong>{cmsText(aiPickerBlock,'Fotoğraf Çek / Galeriden Seç')}</strong>
                <span>{cmsSub(aiPickerBlock,'Yaprak, meyve, gövde veya sorunlu bölgeyi mümkün olduğunca net göster.')}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    handleActivityPhotoChange(e.target.files?.[0])
                  }
                />
              </label>
            )}

            <label className="tp-ai-note-field">
              {cmsText(aiNoteBlock,'Gözlemin (isteğe bağlı)')}
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Örn: Yapraklardaki lekeler 3 gündür artıyor..."
              />
            </label>

            {!aiAccessStatus?.unlimited && !canAnalyze && (
              <div className="tp-ai-limit-box">
                <div>
                  <span>🔒</span>
                  <div>
                    <strong>Bugünkü ücretsiz hakkını kullandın</strong>
                    <p>
                      Yarın tekrar 1 ücretsiz analiz hakkın olacak.
                    </p>
                  </div>
                </div>

                <button type="button" disabled>
                  ▶ Reklam İzle • +1 Hak
                  <small>Yakında</small>
                </button>
              </div>
            )}

            <button
              className="tp-ai-main-analyze"
              type="button"
              onClick={() => void handleAiAnalyzeActivityPhoto()}
              disabled={
                aiAnalyzing ||
                !selectedField ||
                !activityPhoto ||
                (!canAnalyze && aiAccessStatus !== null)
              }
            >
              <span>{aiAnalyzing ? '◌' : '✦'}</span>
              {aiAnalyzing ? 'Gemini fotoğrafı inceliyor...' : cmsText(aiAnalyzeBlock,'AI ile Analiz Et')}
            </button>

            {aiAnalysisError && (
              <div className="tp-ai-error tp-ai-page-error">
                {aiAnalysisError}
              </div>
            )}

            {aiAnalysis && (
              <div className={`tp-ai-result tp-ai-page-result tp-ai-${aiAnalysis.status}`}>
                <div className="tp-ai-result-head">
                  <div>
                    <span>AI ÖN DEĞERLENDİRME</span>
                    <strong>{aiAnalysis.headline}</strong>
                  </div>

                  <div className="tp-ai-confidence">
                    %{aiAnalysis.confidence}
                    <small>güven</small>
                  </div>
                </div>

                <div className="tp-ai-possible">
                  <span>Olası durum</span>
                  <strong>{aiAnalysis.possibleIssue}</strong>
                </div>

                {aiAnalysis.observations.length > 0 && (
                  <div className="tp-ai-list">
                    <span>Fotoğrafta görülenler</span>
                    {aiAnalysis.observations.map((item, index) => (
                      <p key={`main-ai-obs-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                {aiAnalysis.recommendations.length > 0 && (
                  <div className="tp-ai-list">
                    <span>Önerilen sonraki adım</span>
                    {aiAnalysis.recommendations.map((item, index) => (
                      <p key={`main-ai-rec-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                <div className="tp-ai-disclaimer">{aiAnalysis.disclaimer}</div>

                <button
                  type="button"
                  className="tp-ai-save-history"
                  disabled={activityFormLoading}
                  onClick={() => void handleAddActivity()}
                >
                  {activityFormLoading
                    ? 'Kaydediliyor...'
                    : '📒 Tarla Geçmişine Kaydet'}
                </button>
              </div>
            )}
          </section>
        </main>

        <nav className="bottomNav tp-ai-bottom-nav">
          <button onClick={() => setScreen('home')}>
            <span>⌂</span>
            Ana Sayfa
          </button>

          <button
            onClick={() => {
              setScreen('home');
              setTimeout(() => {
                document
                  .querySelector('.fieldsSection')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 60);
            }}
          >
            <span>🌾</span>
            Tarlalarım
          </button>

          <button className="addButton active tp-ai-nav-main">
            <span>✦</span>
            AI Analiz
          </button>

          <button onClick={openCalendarScreen}>
            <span>▣</span>
            Takvim
          </button>

          <button>
            <span>•••</span>
            Daha Fazla
          </button>
        </nav>
      </div>
    </>
  );
  }

  if (screen === 'welcome') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-welcome-shell">
            <div className="tp-logo-mark">🧭</div>

            <h1 className="tp-logo-title">
              TARLA<span>PUSULA</span>
            </h1>

            <p className="tp-welcome-tagline">
              Tarlanı takip eder, zamanı gelince seni yönlendirir.
            </p>

            <div className="tp-landscape">
              <div className="tp-sun">☀️</div>
              <div className="tp-hill tp-hill-one" />
              <div className="tp-hill tp-hill-two" />

              <div className="tp-field-lines">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="tp-welcome-actions">
              <button
                className="tp-main-button"
                onClick={() => setScreen('login')}
              >
                Başlayalım
              </button>

              <button
                className="tp-secondary-button"
                onClick={() => setScreen('home')}
              >
                Hesap oluşturmadan göz at
              </button>
            </div>

            <p className="tp-policy">
              Devam ederek Kullanım Koşulları ve Gizlilik Politikasını kabul
              etmiş olursunuz.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'login') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-form-shell">
            <button
              className="tp-back-button"
              onClick={() => setScreen('welcome')}
            >
              ←
            </button>

            <div className="tp-small-logo">🧭</div>

            <h1>Hoş geldin!</h1>

            <p className="tp-form-subtitle">
              TarlaPusula ile tarlanı akıllıca yönet.
            </p>

            <div className="tp-login-buttons">
              <button
                className="tp-provider-button tp-google"
                onClick={() =>
                  alert('Google ile giriş bir sonraki adımda bağlanacak.')
                }
              >
                <span>G</span>
                Google ile Devam Et
              </button>

              <button
                className="tp-provider-button"
                onClick={() =>
                  alert('Apple ile giriş bir sonraki adımda bağlanacak.')
                }
              >
                <span></span>
                Apple ile Devam Et
              </button>

              <div className="tp-divider">
                <span />
                <small>veya</small>
                <span />
              </div>

              <button
                className="tp-provider-button tp-email-button"
                onClick={() => setScreen('emailRegister')}
              >
                <span>✉</span>
                E-posta ile Hesap Oluştur
              </button>

              <button
                className="tp-text-login"
                onClick={() => {
                  setAuthMessage('');
                  setScreen('emailLogin');
                }}
              >
                Hesabım var, giriş yap
              </button>
            </div>

            <button
              className="tp-guest-link"
              onClick={() => setScreen('home')}
            >
              Hesap oluşturmadan göz at →
            </button>

            <div className="tp-trust-grid">
              <div>
                <strong>🔒 Güvenli</strong>
                <span>Verilerin senin kontrolünde.</span>
              </div>

              <div>
                <strong>🌱 Kişisel</strong>
                <span>Ürünlerine özel deneyim.</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'emailRegister') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-form-shell">
            <button
              className="tp-back-button"
              onClick={() => setScreen('login')}
            >
              ←
            </button>

            <div className="tp-register-icon">🌱</div>

            <h1>E-posta ile hesap oluştur</h1>

            <p className="tp-form-subtitle">
              Hesabını birkaç saniye içinde oluşturabilirsin.
            </p>

            <form className="tp-register-form" onSubmit={handleEmailRegister}>
              <label>
                E-posta adresin
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  required
                />
              </label>

              <label>
                Kullanıcı adı
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kullaniciadi"
                  required
                />
                <small>
                  Bu ad daha sonra Üretici Pazarı gibi alanlarda görünebilir.
                </small>
              </label>

              <label>
                Şifre
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  minLength={8}
                  required
                />
              </label>

              <div className="tp-password-info">✓ En az 8 karakter kullan</div>

              {authMessage && (
                <div className="tp-auth-message">{authMessage}</div>
              )}

              <button
                className="tp-main-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
              </button>
            </form>

            <p className="tp-center-text">
              Zaten hesabın var mı?{' '}
              <button
                onClick={() => {
                  setAuthMessage('');
                  setScreen('emailLogin');
                }}
              >
                Giriş Yap
              </button>
            </p>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'emailLogin') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-form-shell">
            <button
              className="tp-back-button"
              onClick={() => {
                setAuthMessage('');
                setScreen('login');
              }}
            >
              ←
            </button>

            <div className="tp-small-logo">🧭</div>

            <h1>Hesabına giriş yap</h1>

            <p className="tp-form-subtitle">
              Kaldığın yerden devam etmek için bilgilerini gir.
            </p>

            <form className="tp-register-form" onSubmit={handleEmailLogin}>
              <label>
                E-posta adresin
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  required
                />
              </label>

              <label>
                Şifre
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifren"
                  required
                />
              </label>

              {authMessage && (
                <div className="tp-auth-message">{authMessage}</div>
              )}

              <button
                className="tp-main-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

            <p className="tp-center-text">
              Hesabın yok mu?{' '}
              <button
                onClick={() => {
                  setAuthMessage('');
                  setScreen('emailRegister');
                }}
              >
                Hesap Oluştur
              </button>
            </p>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'emailVerification') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-form-shell tp-verification-shell">
            <div className="tp-verification-icon">✉️</div>

            <h1>E-postanı doğrula</h1>

            <p className="tp-form-subtitle">
              Hesabını etkinleştirmek için gönderdiğimiz doğrulama bağlantısına
              tıkla.
            </p>

            <div className="tp-verification-address">
              {verificationEmail || email}
            </div>

            <div className="tp-auth-message tp-auth-message-info">
              Doğrulama tamamlandıktan sonra TarlaPusula'ya giriş yapabilirsin.
            </div>

            <button
              className="tp-main-button"
              onClick={() => {
                setPassword('');
                setAuthMessage('');
                setScreen('emailLogin');
              }}
            >
              Giriş Ekranına Git
            </button>

            <button
              className="tp-secondary-button tp-verification-back"
              onClick={() => setScreen('emailRegister')}
            >
              E-posta adresini değiştir
            </button>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'onboarding') {
    const selectedAnswers = answers[onboardingStep] || [];
    const showOtherProductInput =
      onboardingStep === 2 && selectedAnswers.includes('Diğer ürün');

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-question-shell">
            <div className="tp-question-top">
              <button
                className="tp-back-button"
                onClick={() => {
                  if (onboardingStep === 0) {
                    setScreen('login');
                  } else {
                    setOnboardingStep(onboardingStep - 1);
                  }
                }}
              >
                ←
              </button>

              <strong>
                {onboardingStep + 1} / {onboardingQuestions.length}
              </strong>
            </div>

            <div className="tp-progress">
              {onboardingQuestions.map((_, index) => (
                <span
                  key={index}
                  className={
                    index <= onboardingStep ? 'tp-progress-active' : ''
                  }
                />
              ))}
            </div>

            <div className="tp-question-copy">
              <p className="tp-question-label">SENİ TANIYALIM</p>

              <h1>{currentQuestion.title}</h1>

              <p>{currentQuestion.subtitle}</p>
            </div>

            <div className="tp-options">
              {currentQuestion.options.map(([icon, label]) => {
                const selected = selectedAnswers.includes(label);

                return (
                  <button
                    key={label}
                    className={`tp-option ${selected ? 'selected' : ''}`}
                    onClick={() => selectAnswer(label)}
                  >
                    <span className="tp-option-icon">{icon}</span>

                    <span>{label}</span>

                    <span className="tp-option-check">
                      {selected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}

              {showOtherProductInput && (
                <div className="tp-other-product-box">
                  <label>
                    Diğer ürünün adı
                    <input
                      type="text"
                      value={otherProduct}
                      onChange={(e) => setOtherProduct(e.target.value)}
                      placeholder="Örn: Şeker pancarı, Pamuk, Çay, Kivi..."
                    />
                  </label>

                  <small>
                    Buraya listede olmayan ürünü yazabilirsin.
                  </small>
                </div>
              )}
            </div>

            {authMessage && (
              <div className="tp-auth-message">{authMessage}</div>
            )}

            <div className="tp-question-actions">
              <button
                className="tp-skip-button"
                onClick={skipOnboardingStep}
                disabled={authLoading}
              >
                Şimdilik geç
              </button>

              <button
                className="tp-main-button tp-next-button"
                onClick={nextOnboardingStep}
                disabled={authLoading}
              >
                {authLoading
                  ? 'Kaydediliyor...'
                  : onboardingStep === onboardingQuestions.length - 1
                    ? 'Tamamla'
                    : 'Devam'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }


  if (screen === 'addField') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-field-form-shell">
            <div className="tp-question-top">
              <button className="tp-back-button" onClick={() => setScreen('home')}>
                ←
              </button>
              <strong>YENİ TARLA</strong>
            </div>

            <div className="tp-field-form-heading tp-field-form-heading-cover">
              <div className="tp-new-field-cover">
                <img
                  src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=86"
                  alt=""
                />
                <div className="tp-new-field-cover-overlay" />
                <div className="tp-new-field-cover-copy">
                  <span>YENİ TARLA</span>
                  <h1>Tarlanı ekle</h1>
                  <p>Ada, parsel ve üretim bilgilerini kaydet.</p>
                </div>
              </div>
              <p className="tp-new-field-intro">İstersen parsel konumunu ekleyip uydu görünümünde de kontrol edebilirsin.</p>
            </div>

            <form className="tp-field-form" onSubmit={handleAddField}>
              <label className="tp-field-full">
                Tarla adı
                <input
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Örn: Kuzey Buğday Tarlası"
                  required
                />
              </label>

              <div className="tp-field-form-grid">
                <label>
                  İl
                  <MobileWheelPicker
                    title="İl seç"
                    value={selectedProvinceId === null ? '' : String(selectedProvinceId)}
                    onChange={handleProvinceSelection}
                    disabled={locationOptionsLoading && provinceOptions.length === 0}
                    placeholder={
                      provinceOptions.length === 0 && locationOptionsLoading
                        ? 'İller yükleniyor...'
                        : 'İl seç'
                    }
                    searchable
                    searchPlaceholder="İl ara..."
                    options={provinceOptions.map((province) => ({
                      value: String(province.id),
                      label: province.name,
                    }))}
                  />
                </label>

                <label>
                  İlçe
                  <MobileWheelPicker
                    title="İlçe seç"
                    value={selectedDistrictId === null ? '' : String(selectedDistrictId)}
                    onChange={handleDistrictSelection}
                    disabled={!selectedProvinceId || districtOptions.length === 0}
                    placeholder={
                      !selectedProvinceId
                        ? 'Önce il seç'
                        : districtOptions.length === 0 && locationOptionsLoading
                          ? 'İlçeler yükleniyor...'
                          : 'İlçe seç'
                    }
                    searchable
                    searchPlaceholder="İlçe ara..."
                    options={districtOptions.map((district) => ({
                      value: String(district.id),
                      label: getDistrictDisplayName(district.name),
                    }))}
                  />
                </label>
              </div>

              <label className="tp-field-full">
                Köy / Mahalle
                <MobileWheelPicker
                  title="Köy / Mahalle seç"
                  value={String(
                    villageOptions.find((item) => item.name === fieldVillage)?.id ?? '',
                  )}
                  onChange={handleVillageSelection}
                  disabled={!selectedDistrictId || villageOptions.length === 0}
                  placeholder={
                    !selectedDistrictId
                      ? 'Önce ilçe seç'
                      : villageOptions.length === 0 && locationOptionsLoading
                        ? 'Köy / mahalle yükleniyor...'
                        : 'Köy / mahalle seç'
                  }
                  searchable
                  searchPlaceholder="Köy veya mahalle ara..."
                  options={villageOptions.map((village) => ({
                    value: String(village.id),
                    label: village.name,
                  }))}
                />
              </label>

              {locationOptionsMessage && (
                <div className="tp-field-form-message">{locationOptionsMessage}</div>
              )}

              <div className="tp-field-form-grid">
                <label>
                  Ada
                  <input value={fieldAda} onChange={(e) => setFieldAda(e.target.value)} inputMode="numeric" placeholder="87" required />
                </label>
                <label>
                  Parsel
                  <input value={fieldParcel} onChange={(e) => setFieldParcel(e.target.value)} inputMode="numeric" placeholder="6" required />
                </label>
              </div>

              <div className="tp-parcel-lookup-panel">
                <div className="tp-parcel-lookup-actions">
                  <button
                    type="button"
                    className="tp-parcel-search-button"
                    onClick={handleParcelLookup}
                    disabled={parcelLookupLoading}
                  >
                    {parcelLookupLoading ? (
                      <span className="tp-parcel-spinner" aria-hidden="true" />
                    ) : (
                      <span className="tp-parcel-button-icon">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="10.7" cy="10.7" r="6.1" stroke="currentColor" strokeWidth="1.8" />
                          <path d="m15.3 15.3 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    <span>{parcelLookupLoading ? 'Parsel aranıyor...' : 'Parseli Sorgula'}</span>
                  </button>

                  <button
                    type="button"
                    className="tp-parcel-tkgm-button"
                    onClick={openOfficialParcelQuery}
                  >
                    <span className="tp-parcel-button-icon neutral">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M14 5h5v5M19 5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M11 6H6.8A1.8 1.8 0 0 0 5 7.8v9.4A1.8 1.8 0 0 0 6.8 19h9.4a1.8 1.8 0 0 0 1.8-1.8V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span>TKGM'de Kontrol Et</span>
                  </button>
                </div>

                {parcelLookupMessage && !parcelGeometry && (
                  <div className="tp-parcel-result-card error">
                    <div className="tp-parcel-result-status">
                      <span className="tp-parcel-result-icon">!</span>
                      <div>
                        <strong>Parsel bulunamadı</strong>
                        <small>{parcelLookupMessage}</small>
                      </div>
                    </div>
                  </div>
                )}

                {parcelGeometry &&
                  fieldLatitude !== null &&
                  fieldLongitude !== null && (
                    <>
                      <div className="tp-parcel-result-divider">
                        <span>SORGULAMA SONUCU</span>
                      </div>

                      <div className="tp-parcel-result-card success">
                        <div className="tp-parcel-result-status">
                          <span className="tp-parcel-result-icon">✓</span>
                          <div>
                            <strong>Parsel bulundu</strong>
                            <small>
                              {parcelLookupSource
                                ? `Kaynak: ${parcelLookupSource}`
                                : `${fieldAda} Ada • ${fieldParcel} Parsel`}
                            </small>
                          </div>
                        </div>

                        <div className="tp-parcel-result-metric">
                          <small>Alan</small>
                          <strong>{fieldArea ? `${fieldArea} da` : '—'}</strong>
                        </div>

                        <div className="tp-parcel-result-metric">
                          <small>Merkez koordinat</small>
                          <strong>{fieldLatitude.toFixed(6)}</strong>
                          <span>{fieldLongitude.toFixed(6)}</span>
                        </div>
                      </div>

                      <div className="tp-parcel-map-info">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
                          <path d="M12 10.7V16M12 8h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                        </svg>
                        <span>
                          Gerçek parsel bulundu. Uydu görünümü otomatik açıldı ve parsel
                          sınırı haritaya yüklendi.
                        </span>
                      </div>

                      <div className="tp-parcel-fieldmap-preview">
                        <FieldMap
                          initialCenter={[fieldLongitude, fieldLatitude]}
                          initialZoom={17}
                          height={360}
                          parcelGeometry={parcelGeometry}
                          sections={[]}
                          drawEnabled={Boolean(parcelGeometry)}
                        />
                      </div>
                    </>
                  )}

                {parcelLocationMessage && (
                  <div className="tp-parcel-map-info">
                    <span>{parcelLocationMessage}</span>
                  </div>
                )}
              </div>

              <div className="tp-field-form-grid">
                <label>
                  Alan (da)
                  <input value={fieldArea} onChange={(e) => setFieldArea(e.target.value)} inputMode="decimal" placeholder="68,2" required />
                </label>
                <label>
                  Üretim yılı
                  <input value={fieldSeason} onChange={(e) => setFieldSeason(e.target.value)} inputMode="numeric" placeholder="2026" required />
                </label>
              </div>

              <label className="tp-field-full">
                Ürün
                <MobileWheelPicker
                  title="Ürün seç"
                  value={fieldCrop}
                  onChange={handleFieldCropSelection}
                  placeholder="Ürün seç"
                  searchable
                  searchPlaceholder="Ürün ara..."
                  options={TURKEY_CROP_PICKER_OPTIONS}
                />
              </label>

              {fieldCrop && (
                <div className={`tp-crop-cycle-status ${fieldCropCycle}`}>
                  <span>{fieldCropCycle === 'perennial' ? '🌳' : '🌾'}</span>
                  <div>
                    <strong>
                      {fieldCropCycle === 'perennial' ? 'Çok yıllık ürün' : 'Tek yıllık ürün'}
                    </strong>
                    <small>
                      {fieldCropCycle === 'perennial'
                        ? 'Dikim ve verim bilgileri aşağıda açıldı.'
                        : 'Sezon bazlı üretim kaydı olarak takip edilecek.'}
                    </small>
                  </div>
                </div>
              )}

              {fieldCropCycle === 'perennial' && (
                <>
                  <div className="tp-field-form-grid">
                    <label>
                      Dikim yılı
                      <input
                        value={fieldPlantingYear}
                        onChange={(e) => setFieldPlantingYear(e.target.value)}
                        inputMode="numeric"
                        placeholder="Örn: 2018"
                      />
                    </label>

                    <label>
                      Ürün veriyor mu?
                      <MobileWheelPicker
                        title="Ürün veriyor mu?"
                        value={fieldBearing ? 'yes' : 'no'}
                        onChange={(value) => setFieldBearing(value === 'yes')}
                        options={[
                          { value: 'yes', label: 'Evet, ürün alıyorum' },
                          { value: 'no', label: 'Hayır, henüz verime yatmadı' },
                        ]}
                      />
                    </label>
                  </div>

                  <div className="tp-field-note tp-field-note-soft">
                    🌳 Çok yıllık ürünlerde dikim yılı, bahçe yaşı ve yıllara göre kg verim geçmişi tutulur.
                  </div>
                </>
              )}

              <div className="tp-field-note">
                🗺️ Harita sınırı ve aynı parselde birden fazla ürün bölümü sonraki adımda eklenecek.
              </div>

              {fieldFormMessage && <div className="tp-auth-message">{fieldFormMessage}</div>}

              <button className="tp-main-button" type="submit" disabled={fieldFormLoading}>
                {fieldFormLoading ? 'Kaydediliyor...' : 'Tarlayı Kaydet'}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'ready') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-onboarding-page">
          <div className="tp-ready-shell">
            <div className="tp-ready-circle">
              <span>✓</span>
            </div>

            <h1>Hazırsın!</h1>

            <p>TarlaPusula başlangıç profilini oluşturdu.</p>

            <div className="tp-profile-progress-card">
              <div>
                <strong>Profilin %30 tamamlandı</strong>
                <span>Seni kullandıkça daha iyi tanıyacağız.</span>
              </div>

              <div className="tp-profile-bar">
                <span />
              </div>
            </div>

            <div className="tp-ready-benefits">
              <div>
                <span>🌦️</span>
                <p>Hava ve risk uyarıları kişiselleşecek.</p>
              </div>

              <div>
                <span>🌱</span>
                <p>Ürünlerine uygun içerikler gösterilecek.</p>
              </div>

              <div>
                <span>🔔</span>
                <p>Gereksiz bildirimler azaltılacak.</p>
              </div>
            </div>

            <button
              className="tp-main-button"
              onClick={() => setScreen('home')}
            >
              Ana Sayfaya Geç
            </button>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'fieldDetail' && selectedField) {
    const detailInfo = statusInfo[selectedField.status];

    const scrollFieldDetailTo = (id: string) => {
      setFieldFabOpen(false);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 40);
    };

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-field-detail-page">
          <header className="tp-field-detail-header">
            <button
              className="tp-field-detail-back"
              onClick={() => setScreen('home')}
            >
              ←
            </button>

            <div>
              <span>Tarla Detayları</span>
              <strong>{selectedField.name}</strong>
            </div>

            <button className="tp-field-detail-more">•••</button>
          </header>

          <main className="tp-field-detail-content">
            <section id="field-info" className="tp-field-hero-card">
              <div className="tp-field-hero-top">
                <div className="tp-field-hero-icon">🌾</div>

                <div className="tp-field-hero-copy">
                  <div className="tp-field-hero-name-row">
                    <h1>{selectedField.name}</h1>
                    {selectedField.demo && <span className="demoBadge">ÖRNEK</span>}
                  </div>

                  <p>
                    {selectedField.ada} Ada • {selectedField.parsel} Parsel
                  </p>

                  <span>
                    {[selectedField.village, selectedField.district, selectedField.city]
                      .filter(Boolean)
                      .join(' / ') || 'Konum bilgisi henüz eklenmedi'}
                  </span>
                </div>

                <span
                  className="statusPill"
                  style={{
                    color: detailInfo.color,
                    backgroundColor: detailInfo.bg,
                  }}
                >
                  {detailInfo.label}
                </span>
              </div>

              <div className="tp-field-hero-stats">
                <div>
                  <span>Alan</span>
                  <strong>{selectedField.area.toLocaleString('tr-TR')} da</strong>
                </div>

                <div>
                  <span>Ürün</span>
                  <strong>{selectedField.crop}</strong>
                </div>

                <div>
                  <span>Sezon</span>
                  <strong>{selectedField.season}</strong>
                </div>
              </div>
            </section>

            <section className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">TARLA ÖZETİ</span>
                  <h2>Bugünkü durum</h2>
                </div>
                <span className="tp-field-detail-fresh">Yeni</span>
              </div>

              <div className="tp-field-detail-status-grid">
                <article>
                  <div className="tp-detail-icon">🛰️</div>
                  <div>
                    <strong>Uydu analizi</strong>
                    <p>
                      {selectedField.demo
                        ? 'Güney bölümünde gelişim farklılığı örneği gösteriliyor.'
                        : 'Uydu verisi bağlandığında bitki gelişimi ve farklılıklar burada gösterilecek.'}
                    </p>
                  </div>
                </article>

                <article>
                  <div className="tp-detail-icon">🌦️</div>
                  <div>
                    <strong>Hava ve risk</strong>
                    <p>
                      Tarla konumuna özel yağış, sıcaklık ve risk uyarıları bu alanda gösterilecek.
                    </p>
                  </div>
                </article>

                <article>
                  <div className="tp-detail-icon">📷</div>
                  <div>
                    <strong>Saha kontrolü</strong>
                    <p>
                      Fotoğraflı saha kontrolleri ve geçmiş notlar burada toplanacak.
                    </p>
                  </div>
                </article>

                <button
                  type="button"
                  className="tp-detail-soil-shortcut"
                  onClick={() => openSoilAnalysisForField(selectedField)}
                >
                  <div className="tp-detail-icon">🧪</div>
                  <div>
                    <strong>Toprak analizi sonucu ekle</strong>
                    <p>Bu tarlaya ait PDF veya fotoğraf raporunu yükle ve AI ile yorumla.</p>
                  </div>
                  <span>→</span>
                </button>
              </div>
            </section>

            <section className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">HARİTA</span>
                  <h2>Tarla sınırı ve bölümler</h2>
                </div>
              </div>

              <div className="tp-field-detail-map-card">
                <div className="tp-field-detail-map-shape">
                  <div />
                </div>

                <div className="tp-field-detail-map-copy">
                  <strong>Tarla haritası hazırlanıyor</strong>
                  <p>
                    Parsel sınırı veya üreticinin çizdiği alan burada gösterilecek.
                    Aynı tarlada farklı ürünler varsa bölümleri ayrıca işaretleyebileceğiz.
                  </p>
                </div>

                <button
                  onClick={() =>
                    alert('Harita çizim ve parsel sınırı ekranını sonraki aşamada bağlayacağız.')
                  }
                >
                  🗺️ Haritayı Aç
                </button>
              </div>
            </section>

            <section id="field-production" className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">ÜRETİM</span>
                  <h2>Ürün ve sezon</h2>
                </div>
              </div>

              <div className="tp-field-production-card">
                <div className="tp-field-production-main">
                  <div className="tp-detail-icon">
                    {(selectedField.cropCycle ?? 'annual') === 'perennial' ? '🌳' : '🌱'}
                  </div>
                  <div>
                    <span>Mevcut ürün</span>
                    <strong>{selectedField.crop}</strong>
                    <p>
                      {(selectedField.cropCycle ?? 'annual') === 'perennial'
                        ? 'Çok yıllık ürün'
                        : `${selectedField.season} üretim sezonu • Tek yıllık ürün`}
                    </p>
                  </div>
                </div>

                <div className="tp-production-profile-summary">
                  <div>
                    <span>Ürün tipi</span>
                    <strong>
                      {(selectedField.cropCycle ?? 'annual') === 'perennial'
                        ? 'Çok yıllık'
                        : 'Tek yıllık'}
                    </strong>
                  </div>

                  {(selectedField.cropCycle ?? 'annual') === 'perennial' && (
                    <>
                      <div>
                        <span>Dikim yılı</span>
                        <strong>{selectedField.plantingYear ?? '—'}</strong>
                      </div>

                      <div>
                        <span>Bahçe yaşı</span>
                        <strong>
                          {selectedField.plantingYear
                            ? `${Math.max(
                                0,
                                new Date().getFullYear() - selectedField.plantingYear,
                              )} yaş`
                            : '—'}
                        </strong>
                      </div>

                      <div>
                        <span>Ürün veriyor</span>
                        <strong>
                          {selectedField.bearing === null ||
                          selectedField.bearing === undefined
                            ? '—'
                            : selectedField.bearing
                              ? 'Evet'
                              : 'Henüz değil'}
                        </strong>
                      </div>
                    </>
                  )}

                  {!selectedField.demo && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductionProfileOpen(true);
                        setProductionProfileMessage('');
                      }}
                    >
                      ✎ Düzenle
                    </button>
                  )}
                </div>

                {productionProfileOpen && !selectedField.demo && (
                  <div
                    className="tp-modal-backdrop"
                    role="presentation"
                    onMouseDown={() => setProductionProfileOpen(false)}
                  >
                    <div
                      className="tp-modal-card tp-modal-card-medium"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Ürün tipini düzenle"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="tp-production-profile-form tp-modal-form">
                    <div className="tp-production-profile-title">
                      <div>
                        <span>ÜRÜN TİPİNİ DÜZENLE</span>
                        <strong>Tek yıllık / çok yıllık ayrımını belirle</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductionProfileOpen(false)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="tp-cycle-choice">
                      <button
                        type="button"
                        className={detailCropCycle === 'annual' ? 'active' : ''}
                        onClick={() => setDetailCropCycle('annual')}
                      >
                        🌾 Tek yıllık
                        <small>Her sezon ayrı ürün/sezon kaydı</small>
                      </button>

                      <button
                        type="button"
                        className={detailCropCycle === 'perennial' ? 'active' : ''}
                        onClick={() => setDetailCropCycle('perennial')}
                      >
                        🌳 Çok yıllık
                        <small>Dikim yılı ve yıllık verim geçmişi</small>
                      </button>
                    </div>

                    {detailCropCycle === 'perennial' && (
                      <div className="tp-production-profile-fields">
                        <label>
                          Dikim yılı
                          <input
                            value={detailPlantingYear}
                            onChange={(e) => setDetailPlantingYear(e.target.value)}
                            inputMode="numeric"
                            placeholder="2018"
                          />
                        </label>

                        <label>
                          Ürün veriyor mu?
                          <MobileWheelPicker
                            title="Ürün veriyor mu?"
                            value={detailBearing ? 'yes' : 'no'}
                            onChange={(value) => setDetailBearing(value === 'yes')}
                            options={[
                              { value: 'yes', label: 'Evet' },
                              { value: 'no', label: 'Henüz değil' },
                            ]}
                          />
                        </label>
                      </div>
                    )}

                    {productionProfileMessage && (
                      <div className="tp-field-section-message">
                        {productionProfileMessage}
                      </div>
                    )}

                    <div className="tp-modal-actions">
                      <button
                        type="button"
                        className="tp-modal-cancel"
                        onClick={() => setProductionProfileOpen(false)}
                      >
                        İptal
                      </button>

                      <button
                        type="button"
                        className="tp-production-profile-save tp-modal-primary"
                        onClick={() => void handleSaveProductionProfile()}
                        disabled={productionProfileLoading}
                      >
                        {productionProfileLoading ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="tp-field-production-actions">
                  <button
                    onClick={() => {
                      if (selectedField.demo) {
                        alert('Örnek tarlaya bölüm eklenmez. Gerçek bir tarla seç.');
                        return;
                      }

                      resetSectionForm();
                      setSectionFormOpen(true);
                      setSectionFormMessage('');
                    }}
                  >
                    + Tarla Bölümü Ekle
                  </button>

                  <button
                    onClick={() => {
                      if (selectedField.demo) {
                        alert('Örnek tarlada geçmiş kaydı oluşturulmaz.');
                        return;
                      }

                      if ((selectedField.cropCycle ?? 'annual') === 'perennial') {
                        resetYieldForm();
                        setYieldFormOpen(true);
                        setAnnualFormOpen(false);
                      } else {
                        resetAnnualForm();
                        setAnnualFormOpen(true);
                        setYieldFormOpen(false);
                      }
                    }}
                  >
                    {(selectedField.cropCycle ?? 'annual') === 'perennial'
                      ? '📊 Yıllık Verim Ekle'
                      : '🕘 Yeni Sezon Ekle'}
                  </button>
                </div>

                {!selectedField.demo && (
                  <div className="tp-production-history-block">
                    <div className="tp-production-history-head">
                      <div>
                        <span>
                          {(selectedField.cropCycle ?? 'annual') === 'perennial'
                            ? 'VERİM GEÇMİŞİ'
                            : 'SEZON GEÇMİŞİ'}
                        </span>
                        <strong>
                          {(selectedField.cropCycle ?? 'annual') === 'perennial'
                            ? 'Yıllara göre alınan ürün'
                            : 'Yıllara göre ürün ve sezon kayıtları'}
                        </strong>
                      </div>

                      {(selectedField.cropCycle ?? 'annual') === 'perennial' &&
                        selectedField.area > 0 && (
                          <small>kg/da otomatik hesaplanır</small>
                        )}
                    </div>

                    {historyLoading ? (
                      <div className="tp-section-loading">Üretim geçmişi yükleniyor...</div>
                    ) : (selectedField.cropCycle ?? 'annual') === 'perennial' ? (
                      perennialYields.length > 0 ? (
                        <div className="tp-yield-history-list">
                          {perennialYields.map((item) => (
                            <article key={item.id} className="tp-yield-history-card">
                              <div className="tp-yield-year">{item.year}</div>

                              <div className="tp-yield-main">
                                <strong>
                                  {item.yieldKg === null
                                    ? 'Ürün miktarı girilmedi'
                                    : `${item.yieldKg.toLocaleString('tr-TR')} kg`}
                                </strong>

                                <span>
                                  {item.yieldKg !== null && selectedField.area > 0
                                    ? `${(item.yieldKg / selectedField.area).toLocaleString(
                                        'tr-TR',
                                        { maximumFractionDigits: 1 },
                                      )} kg/da`
                                    : 'Dekar verimi hesaplanmadı'}
                                </span>

                                {item.harvestDate && (
                                  <small>Hasat: {item.harvestDate}</small>
                                )}

                                {item.notes && <p>{item.notes}</p>}
                              </div>

                              <button
                                onClick={() => void handleDeletePerennialYield(item.id)}
                              >
                                Sil
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="tp-field-sections-empty">
                          <div>📊</div>
                          <strong>Henüz yıllık verim kaydı yok</strong>
                          <p>
                            2024, 2025, 2026 gibi her yıl kaç kg ürün aldığını
                            kaydedebilirsin.
                          </p>
                        </div>
                      )
                    ) : annualSeasons.length > 0 ? (
                      <div className="tp-season-history-list">
                        {annualSeasons.map((item) => (
                          <article key={item.id} className="tp-season-history-card">
                            <div className="tp-yield-year">{item.year}</div>

                            <div className="tp-yield-main">
                              <strong>{item.crop}</strong>
                              <span>
                                Ekim: {item.plantingDate ?? '—'} • Hasat:{' '}
                                {item.harvestDate ?? '—'}
                              </span>
                              {item.notes && <p>{item.notes}</p>}
                            </div>

                            <button
                              onClick={() => void handleDeleteAnnualSeason(item.id)}
                            >
                              Sil
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="tp-field-sections-empty">
                        <div>🕘</div>
                        <strong>Henüz sezon geçmişi yok</strong>
                        <p>
                          Tek yıllık ürünlerde her üretim sezonunu ayrı bir kayıt
                          olarak tutabilirsin.
                        </p>
                      </div>
                    )}

                    {annualFormOpen &&
                      (selectedField.cropCycle ?? 'annual') === 'annual' && (
                        <div
                          className="tp-modal-backdrop"
                          role="presentation"
                          onMouseDown={() => setAnnualFormOpen(false)}
                        >
                          <div
                            className="tp-modal-card tp-modal-card-medium"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Yeni sezon ekle"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <form
                              className="tp-history-form tp-modal-form"
                              onSubmit={handleAddAnnualSeason}
                            >
                          <div className="tp-production-profile-title">
                            <div>
                              <span>YENİ SEZON</span>
                              <strong>Tek yıllık üretim sezonu ekle</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAnnualFormOpen(false)}
                            >
                              ×
                            </button>
                          </div>

                          <label>
                            Sezon yılı
                            <input
                              value={annualYear}
                              onChange={(e) => setAnnualYear(e.target.value)}
                              inputMode="numeric"
                              placeholder="2026"
                            />
                          </label>

                          <label>
                            Ürün
                            <input
                              value={annualCrop}
                              onChange={(e) => setAnnualCrop(e.target.value)}
                              placeholder="Buğday"
                            />
                          </label>

                          <label>
                            Ekim tarihi
                            <input
                              type="date"
                              value={annualPlantingDate}
                              onChange={(e) => setAnnualPlantingDate(e.target.value)}
                            />
                          </label>

                          <label>
                            Hasat tarihi
                            <input
                              type="date"
                              value={annualHarvestDate}
                              onChange={(e) => setAnnualHarvestDate(e.target.value)}
                            />
                          </label>

                          <label className="tp-history-form-full">
                            Not
                            <textarea
                              value={annualNotes}
                              onChange={(e) => setAnnualNotes(e.target.value)}
                              placeholder="Sezonla ilgili kısa not..."
                            />
                          </label>

                          <div className="tp-modal-actions tp-history-form-full">
                            <button
                              type="button"
                              className="tp-modal-cancel"
                              onClick={() => setAnnualFormOpen(false)}
                            >
                              İptal
                            </button>

                            <button
                              className="tp-production-profile-save tp-modal-primary"
                              type="submit"
                              disabled={annualFormLoading}
                            >
                              {annualFormLoading ? 'Kaydediliyor...' : 'Sezonu Kaydet'}
                            </button>
                          </div>
                            </form>
                          </div>
                        </div>
                      )}

                    {yieldFormOpen &&
                      (selectedField.cropCycle ?? 'annual') === 'perennial' && (
                        <div
                          className="tp-modal-backdrop"
                          role="presentation"
                          onMouseDown={() => setYieldFormOpen(false)}
                        >
                          <div
                            className="tp-modal-card tp-modal-card-medium"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Yıllık verim ekle"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <form
                              className="tp-history-form tp-modal-form"
                              onSubmit={handleAddPerennialYield}
                            >
                          <div className="tp-production-profile-title">
                            <div>
                              <span>YILLIK VERİM</span>
                              <strong>Bu yıl alınan ürün miktarını kaydet</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setYieldFormOpen(false)}
                            >
                              ×
                            </button>
                          </div>

                          <label>
                            Yıl
                            <input
                              value={yieldYear}
                              onChange={(e) => setYieldYear(e.target.value)}
                              inputMode="numeric"
                              placeholder="2025"
                            />
                          </label>

                          <label>
                            Toplam ürün (kg)
                            <input
                              value={yieldKg}
                              onChange={(e) => setYieldKg(e.target.value)}
                              inputMode="decimal"
                              placeholder="4100"
                            />
                          </label>

                          <label>
                            Hasat tarihi
                            <input
                              type="date"
                              value={yieldHarvestDate}
                              onChange={(e) => setYieldHarvestDate(e.target.value)}
                            />
                          </label>

                          <label className="tp-history-form-full">
                            Not
                            <textarea
                              value={yieldNotes}
                              onChange={(e) => setYieldNotes(e.target.value)}
                              placeholder="Kalite, rekolte, hasat koşulları..."
                            />
                          </label>

                          <div className="tp-modal-actions tp-history-form-full">
                            <button
                              type="button"
                              className="tp-modal-cancel"
                              onClick={() => setYieldFormOpen(false)}
                            >
                              İptal
                            </button>

                            <button
                              className="tp-production-profile-save tp-modal-primary"
                              type="submit"
                              disabled={yieldFormLoading}
                            >
                              {yieldFormLoading
                                ? 'Kaydediliyor...'
                                : 'Yıllık Verimi Kaydet'}
                            </button>
                          </div>
                            </form>
                          </div>
                        </div>
                      )}

                    {historyMessage && (
                      <div className="tp-field-section-message">
                        {historyMessage}
                      </div>
                    )}
                  </div>
                )}

                {!selectedField.demo && (
                  <div id="field-sections" className="tp-field-sections-block">
                    <div className="tp-field-sections-head">
                      <div>
                        <span>Tarla bölümleri</span>
                        <strong>
                          {fieldSections.length > 0
                            ? `${fieldSections.length} bölüm kayıtlı`
                            : 'Henüz bölüm eklenmedi'}
                        </strong>
                      </div>

                      <small>
                        {fieldSections
                          .reduce((total, item) => total + (item.area ?? 0), 0)
                          .toLocaleString('tr-TR')}{' '}
                        / {selectedField.area.toLocaleString('tr-TR')} da
                      </small>
                    </div>

                    {sectionsLoading ? (
                      <div className="tp-section-loading">Bölümler yükleniyor...</div>
                    ) : fieldSections.length > 0 ? (
                      <div className="tp-field-sections-list">
                        {fieldSections.map((section, index) => (
                          <article key={section.id} className="tp-field-section-card">
                            <div className="tp-field-section-number">{index + 1}</div>

                            <div className="tp-field-section-copy">
                              <strong>{section.name}</strong>
                              <span>{section.crop}</span>
                            </div>

                            <div className="tp-field-section-area">
                              <strong>
                                {section.area !== null
                                  ? `${section.area.toLocaleString('tr-TR')} da`
                                  : 'Alan yok'}
                              </strong>
                              <button
                                onClick={() => void handleDeleteFieldSection(section.id)}
                                aria-label={`${section.name} bölümünü sil`}
                              >
                                Sil
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="tp-field-sections-empty">
                        <div>🌱</div>
                        <strong>Bu tarla tek parça görünüyor</strong>
                        <p>
                          Aynı tarlada farklı ürün veya yönetim alanları varsa
                          “Tarla Bölümü Ekle” ile ayrı ayrı kaydedebilirsin.
                        </p>
                      </div>
                    )}

                    {sectionFormOpen && (
                      <div
                        className="tp-modal-backdrop"
                        role="presentation"
                        onMouseDown={() => {
                          resetSectionForm();
                          setSectionFormOpen(false);
                        }}
                      >
                        <div
                          className="tp-modal-card tp-modal-card-medium"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Tarla bölümü ekle"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <form
                            className="tp-field-section-form tp-modal-form"
                            onSubmit={handleAddFieldSection}
                          >
                        <div className="tp-field-section-form-title">
                          <div>
                            <span>YENİ BÖLÜM</span>
                            <strong>Tarla içinde ayrı bir alan oluştur</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              resetSectionForm();
                              setSectionFormOpen(false);
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <label>
                          Bölüm adı
                          <input
                            type="text"
                            value={sectionName}
                            onChange={(e) => setSectionName(e.target.value)}
                            placeholder="Örn: Kuzey Bölümü"
                          />
                        </label>

                        <label>
                          Bu bölümdeki ürün
                          <input
                            type="text"
                            value={sectionCrop}
                            onChange={(e) => setSectionCrop(e.target.value)}
                            placeholder="Örn: Kiraz"
                          />
                        </label>

                        <label>
                          Bölüm alanı (dekar)
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sectionArea}
                            onChange={(e) => setSectionArea(e.target.value)}
                            placeholder="Örn: 25"
                          />
                        </label>

                        <div className="tp-field-section-area-note">
                          Kayıtlı bölümlerin toplamı tarla alanını aşamaz.
                        </div>

                        {sectionFormMessage && (
                          <div className="tp-field-section-message">
                            {sectionFormMessage}
                          </div>
                        )}

                        <div className="tp-modal-actions">
                          <button
                            type="button"
                            className="tp-modal-cancel"
                            onClick={() => {
                              resetSectionForm();
                              setSectionFormOpen(false);
                            }}
                          >
                            İptal
                          </button>

                          <button
                            className="tp-field-section-save tp-modal-primary"
                            type="submit"
                            disabled={sectionFormLoading}
                          >
                            {sectionFormLoading ? 'Kaydediliyor...' : 'Bölümü Kaydet'}
                          </button>
                        </div>
                          </form>
                        </div>
                      </div>
                    )}

                    {!sectionFormOpen && sectionFormMessage && (
                      <div className="tp-field-section-message">
                        {sectionFormMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">TARLA GEÇMİŞİ</span>
                  <h2>Yapılan işlemler</h2>
                </div>

                {!selectedField.demo && (
                  <button
                    className="tp-activity-add-top"
                    onClick={() => openActivityForm('Diğer')}
                  >
                    + İşlem Ekle
                  </button>
                )}
              </div>

              {activitiesLoading ? (
                <div className="tp-section-loading">İşlemler yükleniyor...</div>
              ) : activities.length > 0 ? (
                <div className="tp-activity-list">
                  {activities.map((activity) => {
                    const icon =
                      activity.type === 'Gübreleme'
                        ? '🧪'
                        : activity.type === 'İlaçlama'
                          ? '🧴'
                          : activity.type === 'Sulama'
                            ? '💧'
                            : activity.type === 'Hasat'
                              ? '🧺'
                              : activity.type === 'Ekim / Dikim'
                                ? '🌱'
                                : activity.type === 'Budama'
                                  ? '✂️'
                                  : activity.type === 'Saha Kontrolü'
                                    ? '📷'
                                    : '📝';

                    return (
                      <article key={activity.id} className="tp-activity-card">
                        <div className="tp-activity-icon">{icon}</div>

                        <div className="tp-activity-copy">
                          <div className="tp-activity-title-row">
                            <strong>{activity.title}</strong>
                            <span>{activity.activityDate}</span>
                          </div>

                          <div className="tp-activity-meta">
                            {activity.productName && (
                              <span>Ürün: {activity.productName}</span>
                            )}

                            {activity.quantity !== null && (
                              <span>
                                Miktar: {activity.quantity.toLocaleString('tr-TR')}
                                {activity.unit ? ` ${activity.unit}` : ''}
                              </span>
                            )}

                            {activity.cost !== null && (
                              <span>
                                Maliyet: {activity.cost.toLocaleString('tr-TR')} TL
                              </span>
                            )}
                          </div>

                          {activity.notes && <p>{activity.notes}</p>}

                          {activity.photoUrl && (
                            <button
                              type="button"
                              className="tp-activity-photo-thumb"
                              onClick={() => window.open(activity.photoUrl ?? '', '_blank')}
                            >
                              <img
                                src={activity.photoUrl}
                                alt={`${activity.title} fotoğrafı`}
                              />
                              <span>Fotoğrafı büyüt</span>
                            </button>
                          )}

                          {activity.aiAnalysis && (
                            <div
                              className={`tp-ai-history-card tp-ai-${activity.aiAnalysis.status}`}
                            >
                              <div>
                                <span>AI ÖN DEĞERLENDİRME</span>
                                <strong>{activity.aiAnalysis.headline}</strong>
                              </div>
                              <small>
                                Güven: %{activity.aiAnalysis.confidence}
                              </small>
                            </div>
                          )}
                        </div>

                        <button
                          className="tp-activity-delete"
                          onClick={() => void handleDeleteActivity(activity.id)}
                        >
                          Sil
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="tp-field-sections-empty">
                  <div>📒</div>
                  <strong>Henüz tarla işlemi kaydedilmedi</strong>
                  <p>
                    Gübreleme, ilaçlama, sulama, hasat ve saha kontrollerini
                    buraya kaydedebilirsin.
                  </p>
                </div>
              )}

              {activityFormOpen && !selectedField.demo && (
                <div
                  className="tp-modal-backdrop"
                  role="presentation"
                  onMouseDown={() => {
                    setActivityFormOpen(false);
                    setActivityMessage('');
                  }}
                >
                  <div
                    className="tp-modal-card tp-modal-card-large"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Yeni tarla işlemi"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <form
                      className="tp-activity-form tp-modal-form"
                      onSubmit={handleAddActivity}
                    >
                  <div className="tp-production-profile-title">
                    <div>
                      <span>YENİ TARLA İŞLEMİ</span>
                      <strong>Yaptığın işlemi kaydet</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActivityFormOpen(false);
                        setActivityMessage('');
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <label>
                    İşlem türü
                    <MobileWheelPicker
                      title="İşlem türü"
                      value={activityType}
                      onChange={setActivityType}
                      options={[
                        'Saha Kontrolü',
                        'Gübreleme',
                        'İlaçlama',
                        'Sulama',
                        'Ekim / Dikim',
                        'Hasat',
                        'Budama',
                        'Toprak İşleme',
                        'Diğer',
                      ].map((item) => ({ value: item, label: item }))}
                    />
                  </label>

                  <label>
                    Tarih
                    <input
                      type="date"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Kullanılan ürün / malzeme
                    <input
                      value={activityProductName}
                      onChange={(e) => setActivityProductName(e.target.value)}
                      placeholder="Örn: Üre, bordo bulamacı..."
                    />
                  </label>

                  {(activityType === 'Gübreleme' ||
                    activityType === 'İlaçlama') && (
                    <>
                      <div className="tp-activity-full">
                        <span className="tp-field-choice-label">Miktarı nasıl gireceksin?</span>
                        <div className="tp-dose-choice">
                          <button
                            type="button"
                            className={activityDoseMode === 'per_decare' ? 'active' : ''}
                            onClick={() => setActivityDoseMode('per_decare')}
                          >
                            Dekara miktar
                            <small>Örn: 20 kg/da</small>
                          </button>
                          <button
                            type="button"
                            className={activityDoseMode === 'total' ? 'active' : ''}
                            onClick={() => setActivityDoseMode('total')}
                          >
                            Toplam miktar
                            <small>Örn: tüm tarlada 1000 kg</small>
                          </button>
                        </div>
                      </div>

                      <label>
                        {activityDoseMode === 'per_decare'
                          ? 'Dekara kullanılan miktar'
                          : 'Tarlada toplam kullanılan miktar'}
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder={activityDoseMode === 'per_decare' ? 'Örn: 20' : 'Örn: 1000'}
                        />
                      </label>

                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          placeholder="Seç"
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'g', label: 'g' },
                            { value: 'L', label: 'L' },
                            { value: 'mL', label: 'mL' },
                          ]}
                        />
                      </label>

                      {activityQuantity.trim() &&
                        Number.isFinite(Number(activityQuantity.replace(',', '.'))) &&
                        selectedField.area > 0 && (
                          <div className="tp-smart-calc tp-activity-full">
                            <span>Otomatik hesap</span>
                            <strong>
                              {activityDoseMode === 'per_decare'
                                ? `Toplam: ${(
                                    Number(activityQuantity.replace(',', '.')) *
                                    selectedField.area
                                  ).toLocaleString('tr-TR', {
                                    maximumFractionDigits: 2,
                                  })} ${activityUnit || 'birim'}`
                                : `Dekara: ${(
                                    Number(activityQuantity.replace(',', '.')) /
                                    selectedField.area
                                  ).toLocaleString('tr-TR', {
                                    maximumFractionDigits: 2,
                                  })} ${activityUnit || 'birim'}/da`}
                            </strong>
                            <small>{selectedField.area.toLocaleString('tr-TR')} da tarla alanına göre</small>
                          </div>
                        )}
                    </>
                  )}

                  {activityType === 'Sulama' && (
                    <>
                      <label>
                        Toplam kullanılan su (m³)
                        <input
                          inputMode="decimal"
                          value={activityWaterM3}
                          onChange={(e) => setActivityWaterM3(e.target.value)}
                          placeholder="Örn: 120"
                        />
                      </label>

                      <label>
                        Sulama süresi (saat)
                        <input
                          inputMode="decimal"
                          value={activityDurationHours}
                          onChange={(e) => setActivityDurationHours(e.target.value)}
                          placeholder="Örn: 4"
                        />
                      </label>

                      {activityWaterM3.trim() &&
                        Number.isFinite(Number(activityWaterM3.replace(',', '.'))) &&
                        selectedField.area > 0 && (
                          <div className="tp-smart-calc tp-activity-full">
                            <span>Otomatik hesap</span>
                            <strong>
                              {(
                                Number(activityWaterM3.replace(',', '.')) /
                                selectedField.area
                              ).toLocaleString('tr-TR', {
                                maximumFractionDigits: 2,
                              })} m³/da
                            </strong>
                            <small>Dekara kullanılan sulama suyu</small>
                          </div>
                        )}
                    </>
                  )}

                  {activityType === 'Hasat' && (
                    <>
                      <label>
                        Toplam hasat miktarı
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder="Örn: 4200"
                        />
                      </label>
                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'ton', label: 'ton' },
                            { value: 'adet', label: 'adet' },
                          ]}
                        />
                      </label>
                    </>
                  )}

                  {!['Gübreleme', 'İlaçlama', 'Sulama', 'Hasat'].includes(activityType) && (
                    <>
                      <label>
                        Miktar (isteğe bağlı)
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder="Varsa miktar"
                        />
                      </label>
                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          placeholder="Seç"
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'L', label: 'L' },
                            { value: 'da', label: 'da' },
                            { value: 'saat', label: 'saat' },
                            { value: 'adet', label: 'adet' },
                          ]}
                        />
                      </label>
                    </>
                  )}

                  <label>
                    Maliyet (TL)
                    <input
                      inputMode="decimal"
                      value={activityCost}
                      onChange={(e) => setActivityCost(e.target.value)}
                      placeholder="İsteğe bağlı"
                    />
                  </label>

                  <label className="tp-activity-full">
                    Not
                    <textarea
                      value={activityNotes}
                      onChange={(e) => setActivityNotes(e.target.value)}
                      placeholder="Tarlada gördüklerin, uygulama detayı, hava koşulları..."
                    />
                  </label>

                  <div className="tp-activity-photo-field tp-activity-full">
                    <div className="tp-activity-photo-head">
                      <div>
                        <span>FOTOĞRAF</span>
                        <strong>
                          {activityType === 'Saha Kontrolü'
                            ? 'Tarladan bir görüntü ekle'
                            : 'İstersen bu işleme fotoğraf ekle'}
                        </strong>
                      </div>

                      {activityPhoto && (
                        <button
                          type="button"
                          onClick={clearActivityPhoto}
                        >
                          Kaldır
                        </button>
                      )}
                    </div>

                    {activityPhotoPreview ? (
                      <div className="tp-activity-photo-preview">
                        <img src={activityPhotoPreview} alt="Seçilen saha fotoğrafı" />

                        <label>
                          Fotoğrafı Değiştir
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) =>
                              handleActivityPhotoChange(e.target.files?.[0])
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="tp-activity-photo-picker">
                        <span>📷</span>
                        <strong>Fotoğraf Seç / Kamera Aç</strong>
                        <small>
                          JPG, PNG veya telefon kamerasından fotoğraf • en fazla 12 MB
                        </small>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) =>
                            handleActivityPhotoChange(e.target.files?.[0])
                          }
                        />
                      </label>
                    )}

                    {activityType === 'Saha Kontrolü' && activityPhoto && (
                      <div className="tp-ai-analyze-area">
                        <button
                          type="button"
                          className="tp-ai-analyze-button"
                          onClick={() => void handleAiAnalyzeActivityPhoto()}
                          disabled={aiAnalyzing}
                        >
                          <span>{aiAnalyzing ? '◌' : '✦'}</span>
                          {aiAnalyzing
                            ? 'AI fotoğrafı inceliyor...'
                            : 'AI ile Analiz Et'}
                        </button>

                        <small>
                          Yaprak, meyve veya sorunlu bölge net görünürse sonuç daha iyi olur.
                        </small>
                      </div>
                    )}

                    {aiAnalysisError && (
                      <div className="tp-ai-error">{aiAnalysisError}</div>
                    )}

                    {aiAnalysis && (
                      <div className={`tp-ai-result tp-ai-${aiAnalysis.status}`}>
                        <div className="tp-ai-result-head">
                          <div>
                            <span>AI ÖN DEĞERLENDİRME</span>
                            <strong>{aiAnalysis.headline}</strong>
                          </div>

                          <div className="tp-ai-confidence">
                            %{aiAnalysis.confidence}
                            <small>güven</small>
                          </div>
                        </div>

                        <div className="tp-ai-possible">
                          <span>Olası durum</span>
                          <strong>{aiAnalysis.possibleIssue}</strong>
                        </div>

                        {aiAnalysis.observations.length > 0 && (
                          <div className="tp-ai-list">
                            <span>Fotoğrafta görülenler</span>
                            {aiAnalysis.observations.map((item, index) => (
                              <p key={`obs-${index}`}>• {item}</p>
                            ))}
                          </div>
                        )}

                        {aiAnalysis.recommendations.length > 0 && (
                          <div className="tp-ai-list">
                            <span>Önerilen sonraki adım</span>
                            {aiAnalysis.recommendations.map((item, index) => (
                              <p key={`rec-${index}`}>• {item}</p>
                            ))}
                          </div>
                        )}

                        <div className="tp-ai-disclaimer">
                          {aiAnalysis.disclaimer}
                        </div>
                      </div>
                    )}
                  </div>

                  {activityMessage && (
                    <div className="tp-field-section-message tp-activity-full">
                      {activityMessage}
                    </div>
                  )}

                  <div className="tp-modal-actions tp-activity-full">
                    <button
                      type="button"
                      className="tp-modal-cancel"
                      onClick={() => {
                        setActivityFormOpen(false);
                        setActivityMessage('');
                      }}
                    >
                      İptal
                    </button>

                    <button
                      className="tp-production-profile-save tp-modal-primary"
                      type="submit"
                      disabled={activityFormLoading}
                    >
                      {activityFormLoading ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
                    </button>
                  </div>
                    </form>
                  </div>
                </div>
              )}

              {!activityFormOpen && activityMessage && (
                <div className="tp-field-section-message">{activityMessage}</div>
              )}
            </section>

            <section className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">HIZLI İŞLEMLER</span>
                  <h2>Tarlada ne yapmak istiyorsun?</h2>
                </div>
              </div>

              <div className="tp-field-quick-actions">
                <button onClick={() => openActivityForm('Saha Kontrolü')}>
                  <span>📷</span>
                  <strong>Kontrol Yap</strong>
                  <small>Saha notu ve fotoğraf ekle</small>
                </button>

                <button onClick={() => openActivityForm('Gübreleme')}>
                  <span>🧪</span>
                  <strong>Gübre Kaydı</strong>
                  <small>Uygulama ve miktar kaydet</small>
                </button>
                <button onClick={() => openActivityForm('İlaçlama')}>
                  <span>🧴</span>
                  <strong>İlaçlama</strong>
                  <small>Doz ve toplam kullanımı kaydet</small>
                </button>

                <button onClick={() => openActivityForm('Sulama')}>
                  <span>💧</span>
                  <strong>Sulama</strong>
                  <small>Sulama işlemi ekle</small>
                </button>

                <button onClick={() => openReminderModal(selectedField)}>
                  <span>🗓️</span>
                  <strong>Takvime Ekle</strong>
                  <small>Hatırlatma oluştur</small>
                </button>
              </div>
            </section>
          </main>

          {fieldFabOpen && (
            <button
              type="button"
              className="tp-field-fab-backdrop"
              aria-label="Menüyü kapat"
              onClick={() => setFieldFabOpen(false)}
            />
          )}

          <div className={`tp-field-fab-wrap ${fieldFabOpen ? 'open' : ''}`}>
            <div className="tp-field-fab-menu" aria-hidden={!fieldFabOpen}>
              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openActivityForm('Saha Kontrolü');
                }}
              >
                <span className="green">▣</span>
                <strong>İşlem Ekle</strong>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openReminderModal(selectedField);
                }}
              >
                <span className="amber">♧</span>
                <strong>Hatırlatma Ekle</strong>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openAiAnalysisScreen();
                }}
              >
                <span className="blue">✦</span>
                <strong>AI Saha Analizi</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-production')}>
                <span className="purple">▥</span>
                <strong>Üretim Geçmişi</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-sections')}>
                <span className="cyan">▦</span>
                <strong>Tarla Bölümleri</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-info')}>
                <span className="gray">⚙</span>
                <strong>Tarla Bilgileri</strong>
              </button>
            </div>

            <button
              type="button"
              className="tp-field-fab"
              aria-label={fieldFabOpen ? 'Menüyü kapat' : 'Tarla işlemlerini aç'}
              aria-expanded={fieldFabOpen}
              onClick={() => setFieldFabOpen((value) => !value)}
            >
              {fieldFabOpen ? '×' : '+'}
            </button>
          </div>

          <nav className="tp-field-detail-bottom">
            <button onClick={() => setScreen('home')}>
              <span>⌂</span>
              Ana Sayfa
            </button>

            <button className="active">
              <span>🌾</span>
              Tarla Detayı
            </button>

            <button
              className="tp-field-detail-main-action"
              onClick={openAiAnalysisScreen}
            >
              <span>✦</span>
              AI Analiz
            </button>

            <button>
              <span>▣</span>
              Takvim
            </button>

            <button>
              <span>•••</span>
              Daha Fazla
            </button>
          </nav>
        </div>
      </>
    );
  }


  const toggleFavoriteField = (fieldId: string | number) => {
    const next = favoriteFieldId === String(fieldId) ? '' : String(fieldId);

    setFavoriteFieldId(next);

    try {
      if (next) {
        window.localStorage.setItem('tp_favorite_field_id', next);
      } else {
        window.localStorage.removeItem('tp_favorite_field_id');
      }
    } catch {
      // localStorage kapalıysa sadece mevcut oturumda favori çalışır.
    }
  };

  const openSoilAnalysisForField = (field?: Field | null) => {
    if (field) {
      setSoilFieldId(String(field.id));
    }
    setSoilAiMessage('');
    setScreen('soilAnalysisHub');
  };

  const requestSoilDeviceLocation = () => {
    if (!navigator.geolocation) {
      setSoilLocationMessage('Bu cihaz konum paylaşımını desteklemiyor.');
      return;
    }

    setSoilLocationLoading(true);
    setSoilLocationMessage('Konum alınıyor...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSoilDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setSoilLocationLoading(false);
        setSoilLocationMessage('Konum alındı. Yakındaki analiz yerleri bu konuma göre sıralanabilir.');
      },
      () => {
        setSoilLocationLoading(false);
        setSoilLocationMessage('Konuma izin verilmedi. Tarla konumu veya il / ilçe bilgisini kullanabiliriz.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const weatherIcon = (condition?: string) => {
    const value = (condition ?? '').toLocaleLowerCase('tr-TR');

    if (value.includes('yağ') || value.includes('sağanak')) return '🌧️';
    if (value.includes('kar')) return '🌨️';
    if (value.includes('fırt') || value.includes('gök')) return '⛈️';
    if (value.includes('bulut') || value.includes('kapalı')) return '☁️';
    if (value.includes('sis')) return '🌫️';

    return '☀️';
  };

  const weatherDayLabel = (index: number) => {
    if (index === 0) return 'Bugün';
    if (index === 1) return 'Yarın';
    return `${index}. Gün Sonra`;
  };

  const fallbackDesktopMenuItems: Array<{ screen: Screen; icon: string; label: string; badge?: string }> = [
    { screen:'home',icon:'⌂',label:'Ana Sayfa' }, { screen:'home',icon:'▦',label:'Tarlalarım' }, { screen:'weatherHub',icon:'☀',label:'Hava Durumu' }, { screen:'fieldControlHub',icon:'⌖',label:'Tarla Kontrolü' }, { screen:'soilAnalysisHub',icon:'♧',label:'Toprak Analizi' }, { screen:'inventoryHub',icon:'▣',label:'İlaç & Gübre Depom' }, { screen:'marketHub',icon:'▥',label:'Piyasa Fiyatları' }, { screen:'supportHub',icon:'▤',label:'Tarımsal Destek' }, { screen:'agendaHub',icon:'♧',label:'Tarım Gündemi',badge:'YENİ' }, { screen:'nutritionHub',icon:'◉',label:'Bitki Besin Maddeleri',badge:'YENİ' }, { screen:'pestGuideHub',icon:'✥',label:'Hastalık & Zararlı Rehberi' }, { screen:'producerMarketHub',icon:'▱',label:'Üretici Pazarı',badge:'YENİ' }, { screen:'fieldNotebookHub',icon:'▧',label:'Tarla Defteri' }, { screen:'notificationsHub',icon:'♢',label:'Bildirimler' }, { screen:'settingsHub',icon:'⚙',label:'Ayarlar' },
  ];
  const cmsDesktopMenuItems = cmsMenus.filter(item=>item.is_visible && item.show_desktop && (!item.admin_only || isAdmin)).sort((a,b)=>a.position-b.position).map(item=>({screen:((item.page_key || 'home') as Screen),icon:item.icon || '•',label:item.label,badge:item.badge_text || undefined}));
  const desktopMenuItems: Array<{ screen: Screen; icon: string; label: string; badge?: string }> = [
    ...(cmsDesktopMenuItems.length ? cmsDesktopMenuItems : fallbackDesktopMenuItems),
    ...(isAdmin && !(cmsDesktopMenuItems.length && cmsDesktopMenuItems.some(item=>item.screen==='adminHub')) ? [{screen:'adminHub' as Screen,icon:'◆',label:'Yönetim',badge:'ADMIN'}] : []),
  ];

  const basePlaceholderMeta: Partial<Record<Screen, { title: string; subtitle: string; icon: string; cards: string[] }>> = {
    weatherHub: { title: 'Hava Durumu', subtitle: 'Tarlalarına özel tahminleri ve üretici özetini tek ekranda takip et.', icon: '☀️', cards: ['5 Günlük Tahmin', 'Yağış & Nem', 'Üretici Özeti'] },
    fieldControlHub: { title: 'Tarla Kontrolü', subtitle: 'Uydu görünümü, saha kayıtları ve gelişim durumunu birlikte değerlendir.', icon: '🛰️', cards: ['Uydu Görünümü', 'Saha Kontrolü', 'Risk Bölgeleri'] },
    inventoryHub: { title: 'İlaç & Gübre Depom', subtitle: 'Stoklarını, son kullanma tarihlerini ve tarla kullanımını takip et.', icon: '📦', cards: ['Gübre Stoğu', 'İlaç Stoğu', 'Akıllı Hatırlatma'] },
    marketHub: { title: 'Piyasa Fiyatları', subtitle: 'Ürün, mazot ve gübre fiyatlarını tek ekranda karşılaştır.', icon: '📈', cards: ['Ürün Fiyatları', 'Mazot Fiyatları', 'Gübre Fiyatları'] },
    supportHub: { title: 'Tarımsal Destek', subtitle: 'Tarlan ve ürününe göre destekleri görüntüle ve tahmini tutarı hesapla.', icon: '🧮', cards: ['Destek Hesapla', '2026 Destekleri', 'Başvuru Koşulları'] },
    agendaHub: { title: 'Tarım Gündemi', subtitle: 'Yeni çeşitler, destekler, hastalık uyarıları ve tarımsal gelişmeler.', icon: '📰', cards: ['Yeni Çeşitler', 'Destek & Mevzuat', 'Tarımsal Gelişmeler'] },
    nutritionHub: { title: 'Bitki Besin Maddeleri Rehberi', subtitle: 'Besin elementlerini, eksiklik belirtilerini ve gübre kaynaklarını öğren.', icon: '🌿', cards: ['Besin Yönetimi', 'Eksiklik Belirtileri', 'Temel Gübreler'] },
    pestGuideHub: { title: 'Hastalık & Zararlı Rehberi', subtitle: 'Ürününe göre hastalıkları, zararlıları ve yabancı otları keşfet.', icon: '🐞', cards: ['Hastalıklar', 'Zararlılar', 'Yabancı Otlar'] },
    producerMarketHub: { title: 'Üretici Pazarı', subtitle: 'Ürün ilanlarını keşfet, kendi ilanını oluştur ve üreticilerle iletişim kur.', icon: '🛒', cards: ['Keşfet', 'İlan Ver', 'İlanlarım'] },
    fieldNotebookHub: { title: 'Tarla Defteri', subtitle: 'Ekimden hasada tüm faaliyetleri ve sezon geçmişini kayıt altında tut.', icon: '📒', cards: ['Faaliyet Ekle', 'Sezon Geçmişi', 'Gider Kayıtları'] },
    notificationsHub: { title: 'Bildirimler', subtitle: 'Tarlaların, hava durumu ve önemli tarımsal gelişmeler için uyarılarını yönet.', icon: '🔔', cards: ['Tarla Uyarıları', 'Hava Uyarıları', 'Fiyat Alarmları'] },
    settingsHub: { title: 'Ayarlar', subtitle: 'Hesap, bildirim, konum ve uygulama tercihlerini yönet.', icon: '⚙️', cards: ['Hesap', 'Bildirim Tercihleri', 'Uygulama Ayarları'] },
    adminHub: { title: 'İçerik Yönetimi', subtitle: 'TarlaPusula uygulamasındaki görselleri ve içerikleri yönet.', icon: '🛡️', cards: ['Görsel Yönetimi', 'İçerik Yönetimi', 'Duyurular'] },
  };
  const placeholderMeta = { ...basePlaceholderMeta };
  (Object.keys(basePlaceholderMeta) as Screen[]).forEach((pageScreen)=>{
    const page=cmsPages.find(item=>item.page_key===pageScreen && item.is_visible);
    const base=basePlaceholderMeta[pageScreen]; if(!page || !base) return;
    const cmsCards=cmsBlocks.filter(item=>item.page_key===pageScreen && item.is_visible).sort((a,b)=>a.position-b.position).map(item=>item.title || item.block_key);
    placeholderMeta[pageScreen]={title:page.title || base.title,subtitle:page.subtitle || base.subtitle,icon:page.icon || base.icon,cards:cmsCards.length?cmsCards:base.cards};
  });
    if (screen === 'soilAnalysisHub') {
    return (
      <SoilAnalysisPage
        fields={realFields.length > 0 ? realFields : [demoField]}
        selectedFieldId={
          soilFieldId ||
          String(
            realFields.find(
              (field) => String(field.id) === favoriteFieldId
            )?.id ??
            realFields[0]?.id ??
            demoField.id
          )
        }
        onFieldChange={(id) => setSoilFieldId(id)}
        onBack={() => setScreen('home')}
      />
    );
  }
  if (false && screen === 'soilAnalysisHub') {
    const soilField =
      realFields.find((field) => String(field.id) === soilFieldId) ??
      realFields.find((field) => String(field.id) === favoriteFieldId) ??
      realFields[0] ??
      demoField;

    const fieldHasLocation = Boolean(
      soilField &&
        ((soilField.parcelCentroidLat && soilField.parcelCentroidLng) ||
          (soilField.latitude && soilField.longitude)),
    );

    const fieldLocationLabel = soilField
      ? [soilField.village, soilField.district, soilField.city].filter(Boolean).join(' / ')
      : '';

    const effectiveLocationLabel = soilDeviceLocation
      ? 'Cihaz konumu kullanılıyor'
      : fieldHasLocation
        ? `${soilField.name} konumu kullanılıyor`
        : fieldLocationLabel
          ? fieldLocationLabel
          : soilManualCity || soilManualDistrict
            ? [soilManualDistrict, soilManualCity].filter(Boolean).join(' / ')
            : 'Konum seçilmedi';

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>
        <div className="tp-soil-page">
          <header className="tp-soil-topbar">
            <button type="button" onClick={() => setScreen('home')}>←</button>
            <div>
              <strong>Toprak Analizi</strong>
              <small>Raporunu tarlanla ilişkilendir, sonuçları düzenli takip et</small>
            </div>
          </header>

          <main className="tp-soil-main">
            <section className="tp-soil-hero">
              <div className="tp-soil-hero-copy">
                <span className="tp-soil-hero-kicker">TOPRAĞINI TANI · DOĞRU KARAR VER</span>
                <h1>Toprak analizini tarlanla birlikte değerlendir.</h1>
                <p>
                  Analiz raporunu yükle, hangi tarlaya ait olduğunu doğrula ve sonuçlarını
                  ürün bilgisiyle birlikte AI destekli yorumlamaya hazırla.
                </p>
                <div className="tp-soil-hero-pills">
                  <span>🧪 Analiz Geçmişi</span>
                  <span>📍 Yakın Laboratuvar</span>
                  <span>✨ AI Yorumlama</span>
                </div>
              </div>
              <div className="tp-soil-hero-visual" aria-hidden="true">
                <span>🌱</span>
                <i />
              </div>
            </section>

            <section className="tp-soil-actions-grid">
              <article className="tp-soil-card tp-soil-upload-card">
                <div className="tp-soil-card-title">
                  <span className="tp-soil-card-icon blue">▤</span>
                  <div>
                    <strong>Analiz Sonucu Yükle</strong>
                    <small>PDF, JPG veya PNG</small>
                  </div>
                </div>

                <label className={`tp-soil-dropzone ${soilReportFileName ? 'has-file' : ''}`}>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSoilReportFileName(file?.name ?? '');
                      setSoilReportFileType(file?.type ?? '');
                      setSoilAiMessage('');
                    }}
                  />
                  <span>{soilReportFileName ? '✓' : '↑'}</span>
                  <strong>{soilReportFileName || 'Raporu seç veya buraya yükle'}</strong>
                  <small>
                    {soilReportFileName
                      ? soilReportFileType || 'Dosya seçildi'
                      : 'Laboratuvar analiz raporunu ekle'}
                  </small>
                </label>

                <div className="tp-soil-field-link">
                  <span>BU ANALİZ HANGİ TARLAYA AİT?</span>
                  <MobileWheelPicker
                    title="Analizin ait olduğu tarla"
                    value={String(soilField?.id ?? '')}
                    onChange={(value) => setSoilFieldId(value)}
                    options={(realFields.length > 0 ? realFields : [demoField]).map((field) => ({
                      value: String(field.id),
                      label: `${field.name} · ${field.crop}`,
                      description: `${field.area.toLocaleString('tr-TR')} da · ${field.ada} Ada / ${field.parsel} Parsel`,
                    }))}
                  />
                  <p>
                    Seçilen rapor <strong>{soilField.name}</strong> kaydına bağlanacak.
                  </p>
                </div>
              </article>

              <article className="tp-soil-card tp-soil-location-card">
                <div className="tp-soil-card-title">
                  <span className="tp-soil-card-icon green">⌖</span>
                  <div>
                    <strong>Yakınımdaki Analiz Yerleri</strong>
                    <small>En uygun konumu otomatik seç</small>
                  </div>
                </div>

                <div className="tp-soil-location-status">
                  <span>📍</span>
                  <div>
                    <small>Kullanılacak konum</small>
                    <strong>{effectiveLocationLabel}</strong>
                  </div>
                </div>

                <div className="tp-soil-location-options">
                  <button type="button" onClick={requestSoilDeviceLocation} disabled={soilLocationLoading}>
                    <span>◎</span>
                    <div>
                      <strong>{soilLocationLoading ? 'Konum alınıyor...' : 'Cihaz Konumumu Kullan'}</strong>
                      <small>İzin açıksa en yakın sonuçlar</small>
                    </div>
                  </button>

                  <button type="button" className={fieldHasLocation ? 'available' : ''}>
                    <span>▱</span>
                    <div>
                      <strong>Tarla Konumunu Kullan</strong>
                      <small>{fieldHasLocation ? `${soilField.name} hazır` : 'Bu tarlada koordinat yok'}</small>
                    </div>
                  </button>
                </div>

                {!soilDeviceLocation && !fieldHasLocation && (
                  <div className="tp-soil-manual-location">
                    <small>Konum yoksa il / ilçe gir</small>
                    <div>
                      <input
                        value={soilManualCity}
                        onChange={(e) => setSoilManualCity(e.target.value)}
                        placeholder="İl"
                      />
                      <input
                        value={soilManualDistrict}
                        onChange={(e) => setSoilManualDistrict(e.target.value)}
                        placeholder="İlçe"
                      />
                    </div>
                  </div>
                )}

                {soilLocationMessage && <p className="tp-soil-location-message">{soilLocationMessage}</p>}

                <button type="button" className="tp-soil-primary-outline">
                  Yakındaki Laboratuvarları Göster →
                </button>
              </article>

              <article className="tp-soil-card tp-soil-guide-card">
                <div className="tp-soil-card-title">
                  <span className="tp-soil-card-icon amber">✓</span>
                  <div>
                    <strong>Numune Nasıl Alınır?</strong>
                    <small>Doğru sonuç için 4 temel adım</small>
                  </div>
                </div>

                <div className="tp-soil-steps">
                  {[
                    ['1', 'Tarlayı dolaş', 'Farklı noktalardan örnek al'],
                    ['2', 'Örneği al', 'Uygun derinlikten toprak çıkar'],
                    ['3', 'Karıştır', 'Temiz kovada homojenleştir'],
                    ['4', 'Gönder', 'Temsili numuneyi laboratuvara ver'],
                  ].map(([no, title, copy]) => (
                    <div key={no}>
                      <span>{no}</span>
                      <strong>{title}</strong>
                      <small>{copy}</small>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="tp-soil-ai-card">
              <div className="tp-soil-ai-head">
                <div className="tp-soil-ai-symbol">✦</div>
                <div>
                  <span>TOPRAK ANALİZİ AI</span>
                  <h2>Raporunu tarlana ve ürününe göre yorumla</h2>
                  <p>
                    AI yalnızca toprak analiz sonuçlarını açıklamak için kullanılacak. Seçili
                    ürün: <strong>{soilField.crop}</strong>.
                  </p>
                </div>
                <span className="tp-soil-ai-badge">Gemini</span>
              </div>

              <div className="tp-soil-ai-preview">
                <div>
                  <small>Hazırlanacak özet</small>
                  <strong>pH · EC · Organik Madde · N-P-K · Mikro Elementler</strong>
                </div>
                <div>
                  <small>Yorum bağlamı</small>
                  <strong>{soilField.name} · {soilField.crop}</strong>
                </div>
                <div>
                  <small>Çıktı</small>
                  <strong>Riskler · Öneriler · Dikkat noktaları</strong>
                </div>
              </div>

              <button
                type="button"
                className="tp-soil-ai-button"
                disabled={!soilReportFileName}
                onClick={() =>
                  setSoilAiMessage(
                    soilReportFileName
                      ? 'Rapor hazır. Bir sonraki adımda Gemini Edge Function bu butona bağlanacak.'
                      : 'Önce analiz raporunu yükle.',
                  )
                }
              >
                ✨ AI ile Toprak Analizini Yorumla
              </button>

              {soilAiMessage && <div className="tp-soil-ai-message">{soilAiMessage}</div>}
            </section>

            <section className="tp-soil-history-card">
              <div className="tp-soil-section-head">
                <div>
                  <span>ANALİZ GEÇMİŞİ</span>
                  <h2>{soilField.name}</h2>
                </div>
                <button type="button">Tümünü Gör</button>
              </div>

              <div className="tp-soil-empty-history">
                <span>🧾</span>
                <strong>Henüz kayıtlı toprak analizi yok</strong>
                <p>İlk raporu yüklediğinde bu tarlanın analiz geçmişi burada tutulacak.</p>
              </div>
            </section>
          </main>
        </div>
      </>
    );
  }

  if (screen === 'fieldControlHub') {
    const fieldControlPage = cmsPageFor('fieldControlHub');
    const fieldControlHeaderBlock = cmsBlockFor('fieldControlHub','page-header');
    const fieldControlHeroBlock = cmsBlockFor('fieldControlHub','hero');
    const fieldControlStartBlock = cmsBlockFor('fieldControlHub','start-analysis');
    const fieldControlRecommendationsBlock = cmsBlockFor('fieldControlHub','recommendations');
    const fieldControlRefreshBlock = cmsBlockFor('fieldControlHub','refresh');
    const fallbackField =
      realFields.find((field) => String(field.id) === favoriteFieldId) ??
      realFields[0] ??
      demoField;

    const controlField =
      realFields.find((field) => String(field.id) === fieldControlFieldId) ??
      fallbackField;

    const satelliteState = satelliteByField[String(controlField.id)] ?? {
      status: 'idle' as const,
    };

    const satellite = satelliteState.data;
    const statusTone = satellite?.status ?? 'unknown';

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>
        <div className="tp-control-page">
          <header className="tp-control-topbar">
            <button type="button" onClick={() => setScreen('home')}>←</button>
            <div>
              <strong>{cmsText(fieldControlHeaderBlock, fieldControlPage?.title || 'Tarla Kontrolü')}</strong>
              <small>{cmsSub(fieldControlHeaderBlock, fieldControlPage?.subtitle || 'Sentinel-2 uydu görüntüsü ile bitki gelişimini kontrol et')}</small>
            </div>
          </header>

          <main className="tp-control-main">
            <section
              className="tp-control-hero"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,rgba(8,44,26,.88) 0%,rgba(8,44,26,.62) 48%,rgba(8,44,26,.18) 100%), url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1600&q=82')",
              }}
            >
              <div className="tp-control-hero-copy">
                <span className="tp-control-hero-kicker">{fieldControlHeroBlock?.icon || 'UYDU DESTEKLİ TARLA TAKİBİ'}</span>
                <h1>{cmsText(fieldControlHeroBlock,'Tarlanı yukarıdan, daha net gör.')}</h1>
                <p>{cmsSub(fieldControlHeroBlock,'Sentinel-2 verileriyle gelişim farklarını, zayıf bölgeleri ve kontrol edilmesi gereken alanları tek ekranda incele.')}</p>
                <div className="tp-control-hero-pills">
                  <span>🛰️ Sentinel-2</span>
                  <span>🌿 NDVI Sağlık Katmanı</span>
                  <span>📍 Parsel Bazlı</span>
                </div>
              </div>
            </section>

            <section className="tp-control-field-select">
              <div>
                <small>SEÇİLİ TARLA</small>
                <strong>{controlField.name}</strong>
                <span>{controlField.crop} • {controlField.area.toLocaleString('tr-TR')} da</span>
              </div>

              {realFields.length > 1 && (
                <MobileWheelPicker
                  title="Kontrol edilecek tarla"
                  value={String(controlField.id)}
                  onChange={(value) => {
                    setFieldControlFieldId(value);
                    const selected = realFields.find((field) => String(field.id) === value);
                    if (selected && selected.parcelGeometry) {
                      void loadFieldSatellite(selected);
                    }
                  }}
                  searchable
                  options={realFields.map((field) => ({
                    value: String(field.id),
                    label: field.name,
                    subtitle: `${field.crop} • ${field.area.toLocaleString('tr-TR')} da`,
                  }))}
                />
              )}
            </section>

            {satelliteState.status === 'idle' && (
              <section className="tp-control-empty">
                <span>🛰️</span>
                <strong>{cmsText(fieldControlStartBlock,'Uydu analizi hazır')}</strong>
                <p>{cmsSub(fieldControlStartBlock,'Gerçek parsel sınırını Sentinel-2 ile analiz et.')}</p>
                <button type="button" onClick={() => void loadFieldSatellite(controlField)}>{fieldControlStartBlock?.button_text || 'Uydu Analizini Başlat'}</button>
              </section>
            )}

            {satelliteState.status === 'loading' && (
              <section className="tp-control-empty">
                <span>🛰️</span>
                <strong>Uydu görüntüsü analiz ediliyor</strong>
                <p>Bulutsuz Sentinel-2 görüntüsü ve NDVI hazırlanıyor.</p>
              </section>
            )}

            {satelliteState.status === 'error' && !satellite && (
              <section className="tp-control-empty error">
                <span>!</span>
                <strong>Uydu analizi yapılamadı</strong>
                <p>{satelliteState.message}</p>
                {controlField.parcelGeometry && (
                  <button type="button" onClick={() => void loadFieldSatellite(controlField, true)}>
                    Tekrar Dene
                  </button>
                )}
              </section>
            )}

            {satellite && (
              <section className="tp-control-grid">
                <article className="tp-control-map-card">
                  <SatelliteHealthMap
                    data={satellite}
                    parcelGeometry={controlField.parcelGeometry ?? null}
                    height={370}
                  />
                </article>

                <aside className="tp-control-side">
                  <article className={`tp-control-status-card ${statusTone}`}>
                    <small>TARLA GENEL DURUMU</small>
                    <div className="tp-control-status-title">
                      <strong>{satellite.statusLabel ?? 'Analiz'}</strong>
                      <span>{statusTone === 'good' ? '☺' : statusTone === 'check' ? '!' : '⚠'}</span>
                    </div>
                    <p>{satellite.summary}</p>

                    <div className="tp-control-ndvi-grid">
                      <div><small>Ort. NDVI</small><strong>{satellite.ndviAverage ?? '—'}</strong></div>
                      <div><small>Min.</small><strong>{satellite.ndviMin ?? '—'}</strong></div>
                      <div><small>Max.</small><strong>{satellite.ndviMax ?? '—'}</strong></div>
                    </div>

                    <button type="button" onClick={() => {
                      setWeatherHubFieldId(String(controlField.id));
                      setScreen('weatherHub');
                    }}>
                      Hava ile Değerlendir
                    </button>
                  </article>

                  <article className="tp-control-recommendations">
                    <strong>{cmsText(fieldControlRecommendationsBlock,'Önerilen İşlemler')}</strong>
                    {(satellite.recommendations ?? []).map((item, index) => (
                      <div key={`${item}-${index}`}><span>✓</span>{item}</div>
                    ))}
                  </article>

                  <article className="tp-control-date-card">
                    <small>SON UYDU GÖRÜNTÜSÜ</small>
                    <strong>{satellite.latestImageDate ?? 'Tarih bulunamadı'}</strong>
                    <span>{satellite.source}</span>
                    <button type="button" onClick={() => void loadFieldSatellite(controlField, true)}>
                      {fieldControlRefreshBlock?.button_text || cmsText(fieldControlRefreshBlock,'Yenile')}
                    </button>
                  </article>
                </aside>
              </section>
            )}
          </main>

          <style>{`
            .tp-control-page{min-height:100vh;background:#f7f9f7;color:#1c2b21}
            .tp-control-topbar{height:66px;display:flex;align-items:center;gap:10px;padding:0 18px;border-bottom:1px solid #e1e7e1;background:#fff}
            .tp-control-topbar>button{width:36px;height:36px;border:1px solid #dfe6df;border-radius:9px;background:#fff;color:#214f32;font-size:17px;cursor:pointer}
            .tp-control-topbar strong{display:block;font-size:14px}.tp-control-topbar small{display:block;margin-top:2px;color:#7d887f;font-size:8.5px}
            .tp-control-main{width:min(1020px,calc(100% - 24px));margin:0 auto;padding:18px 0 36px}
            .tp-control-field-select{display:grid;grid-template-columns:1fr minmax(190px,280px);align-items:center;gap:12px;margin-bottom:12px;padding:10px 12px;border:1px solid #e0e6e0;border-radius:12px;background:#fff}
            .tp-control-field-select>div{display:flex;flex-direction:column;gap:2px}.tp-control-field-select small{color:#7a877d;font-size:7.5px;font-weight:900}.tp-control-field-select strong{font-size:11px}.tp-control-field-select span{color:#7c887f;font-size:8.5px}
            .tp-control-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(250px,.7fr);gap:12px}
            .tp-control-map-card,.tp-control-status-card,.tp-control-recommendations,.tp-control-date-card{border:1px solid #e0e6df;border-radius:13px;background:#fff;box-shadow:0 6px 22px rgba(24,55,35,.035)}
            .tp-control-map-card{padding:10px}.tp-control-side{display:flex;flex-direction:column;gap:10px}
            .tp-control-status-card{padding:14px}.tp-control-status-card>small,.tp-control-date-card>small{color:#7e897f;font-size:7.5px;font-weight:900;letter-spacing:.06em}
            .tp-control-status-title{display:flex;align-items:center;gap:8px;margin-top:7px}.tp-control-status-title strong{font-size:20px}.tp-control-status-title span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#edf6ed;color:#2b7b44;font-weight:900}
            .tp-control-status-card.check .tp-control-status-title span{background:#fff7d9;color:#c38a00}.tp-control-status-card.alert .tp-control-status-title span{background:#fdeaea;color:#c83c34}
            .tp-control-status-card p{margin:8px 0;color:#5d6a61;font-size:9px;line-height:1.55}
            .tp-control-ndvi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0}.tp-control-ndvi-grid div{padding:7px;border:1px solid #e8ece8;border-radius:8px;background:#fafcfa}.tp-control-ndvi-grid small{display:block;color:#8a938c;font-size:7px}.tp-control-ndvi-grid strong{display:block;margin-top:2px;font-size:10px}
            .tp-control-status-card>button,.tp-control-date-card button,.tp-control-empty button{min-height:35px;border:0;border-radius:8px;padding:0 11px;background:#246f40;color:#fff;font:inherit;font-size:8.5px;font-weight:850;cursor:pointer}
            .tp-control-recommendations{padding:14px}.tp-control-recommendations>strong{display:block;margin-bottom:8px;font-size:10px}.tp-control-recommendations>div{display:flex;gap:6px;margin-top:6px;color:#536057;font-size:8.5px}.tp-control-recommendations>div span{color:#2e8a4b;font-weight:900}
            .tp-control-date-card{display:flex;flex-direction:column;gap:3px;padding:13px}.tp-control-date-card strong{font-size:10px}.tp-control-date-card span{color:#78847b;font-size:8px}.tp-control-date-card button{align-self:flex-start;margin-top:6px;background:#fff;color:#246f40;border:1px solid #2d7041}
            .tp-control-empty{min-height:340px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e0e6df;border-radius:14px;background:#fff;text-align:center}.tp-control-empty>span{font-size:42px}.tp-control-empty strong{margin-top:9px;font-size:13px}.tp-control-empty p{margin:5px 0 12px;color:#7b867e;font-size:9px}
            .tp-control-hero{position:relative;min-height:190px;display:flex;align-items:flex-end;margin-bottom:14px;padding:24px 26px;border-radius:17px;background-position:center;background-size:cover;overflow:hidden;box-shadow:0 14px 34px rgba(18,55,34,.13)}
            .tp-control-hero::after{content:'';position:absolute;inset:0;border:1px solid rgba(255,255,255,.15);border-radius:inherit;pointer-events:none}
            .tp-control-hero-copy{position:relative;z-index:1;max-width:610px;color:#fff}
            .tp-control-hero-kicker{display:inline-flex;margin-bottom:8px;padding:5px 8px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.10);font-size:7px;font-weight:950;letter-spacing:.09em;backdrop-filter:blur(5px)}
            .tp-control-hero h1{margin:0;font-size:24px;line-height:1.06;letter-spacing:-.025em}
            .tp-control-hero p{max-width:560px;margin:8px 0 12px;color:rgba(255,255,255,.82);font-size:9px;line-height:1.55}
            .tp-control-hero-pills{display:flex;gap:6px;flex-wrap:wrap}.tp-control-hero-pills span{padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.12);font-size:7.5px;font-weight:800;backdrop-filter:blur(6px)}
            @media(max-width:760px){.tp-control-grid{grid-template-columns:1fr}.tp-control-field-select{grid-template-columns:1fr}.tp-control-main{width:min(100% - 16px,1020px)}.tp-control-hero{min-height:170px;padding:20px}.tp-control-hero h1{font-size:20px}}
          `}</style>
        </div>
      </>
    );
  }


  if (screen === 'weatherHub') {
    const weatherPage = cmsPageFor('weatherHub');
    const weatherHeaderBlock = cmsBlockFor('weatherHub','page-header');
    const weatherHeroBlock = cmsBlockFor('weatherHub','hero');
    const weatherForecastBlock = cmsBlockFor('weatherHub','forecast-title') || cmsBlockFor('weatherHub','forecast');
    const weatherProducerBlock = cmsBlockFor('weatherHub','producer-summary-title') || cmsBlockFor('weatherHub','producer-summary');
    const fallbackField = realFields[0] ?? demoField;
    const weatherField =
      realFields.find((field) => String(field.id) === weatherHubFieldId) ??
      fallbackField;

    const weatherKey = String(weatherField.id);
    const weatherState =
      fieldWeather[weatherKey] ?? {
        status: 'idle' as const,
        forecast: [],
        providers: [],
      };

    const providerRows =
      weatherState.providers && weatherState.providers.length > 0
        ? weatherState.providers
        : weatherState.forecast.length > 0
          ? [
              {
                name: 'Karşılaştırılmış Tahmin',
                forecast: weatherState.forecast,
              },
            ]
          : [];

    const consensus = weatherState.forecast;
    const firstDay = consensus[0];

    const rainyDays = consensus.filter(
      (day) =>
        (day.precipitationProbability ?? 0) >= 40 ||
        (day.precipitation ?? 0) > 0,
    ).length;

    const summaryText =
      consensus.length === 0
        ? 'Hava tahminini görmek için seçili tarlanın verilerini yükle.'
        : rainyDays >= 3
          ? 'Kaynaklar önümüzdeki günlerde yağış ihtimalinin belirgin olduğunu gösteriyor. İlaçlama ve saha çalışmalarını yağış aralıklarına göre planlamak daha uygun olabilir.'
          : rainyDays > 0
            ? 'Tahminlerde bazı günlerde yağış ihtimali görülüyor. Sulama ve ilaçlama planını günlük tahmine göre kontrol et.'
            : 'Kaynaklar genel olarak yağışsız bir dönem gösteriyor. Sulama ihtiyacını tarla ve toprak durumuyla birlikte değerlendir.';

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-weather-page-shell">
          {sideMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Menüyü kapat"
                onClick={() => setSideMenuOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9997,
                  border: 0,
                  background: 'rgba(7,31,20,.38)',
                }}
              />

              <aside
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  zIndex: 9998,
                  width: 225,
                  height: '100vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  padding: '16px 10px 14px',
                  background:
                    'linear-gradient(180deg,#064b2f 0%,#075638 58%,#043f29 100%)',
                  color: '#fff',
                  boxShadow: '12px 0 34px rgba(5,57,35,.22)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0,1fr) 26px',
                    alignItems: 'center',
                    gap: 8,
                    padding: '2px 4px 14px',
                    borderBottom: '1px solid rgba(255,255,255,.10)',
                  }}
                >
                  <div style={{ fontSize: 22, color: '#7be683' }}>🌱</div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 17 }}>TarlaPusula</strong>
                    <small style={{ color: 'rgba(255,255,255,.67)', fontSize: 8.5 }}>
                      Tarla için akıllı rehber
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSideMenuOpen(false)}
                    style={{
                      width: 26,
                      height: 26,
                      border: 0,
                      borderRadius: 7,
                      background: 'rgba(255,255,255,.07)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>

                <nav
                  style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 2,
                    overflowY: 'auto',
                    padding: '12px 0 8px',
                  }}
                >
                  {desktopMenuItems.map((item, index) => {
                    const active = item.screen === 'weatherHub';

                    return (
                      <button
                        key={`${item.label}-${index}`}
                        type="button"
                        onClick={() => {
                          if (item.label === 'Tarlalarım') {
                            setScreen('home');
                            requestAnimationFrame(() =>
                              document
                                .querySelector('.fieldsSection')
                                ?.scrollIntoView({ behavior: 'smooth' }),
                            );
                          } else {
                            setScreen(item.screen);
                          }
                          setSideMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          minHeight: 38,
                          display: 'grid',
                          gridTemplateColumns: '27px minmax(0,1fr) auto',
                          alignItems: 'center',
                          gap: 8,
                          border: 0,
                          borderRadius: 9,
                          padding: '6px 9px',
                          background: active
                            ? 'linear-gradient(90deg,#21834b,#258d50)'
                            : 'transparent',
                          color: '#fff',
                          fontFamily: 'inherit',
                          fontSize: 11.5,
                          fontWeight: 720,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ textAlign: 'center' }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge && (
                          <b
                            style={{
                              borderRadius: 999,
                              background: '#7bdd6e',
                              color: '#083e27',
                              padding: '3px 6px',
                              fontSize: 7.5,
                            }}
                          >
                            {item.badge}
                          </b>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </aside>
            </>
          )}

          <header className="tp-weather-page-top">
            <button
              type="button"
              className="tp-weather-menu-button"
              onClick={() => setSideMenuOpen(true)}
              aria-label="Menüyü aç"
            >
              ☰
            </button>

            <div className="tp-weather-top-brand">
              <span>🌱</span>
              <strong>TARLAPUSULA</strong>
            </div>

            <button
              type="button"
              className="tp-weather-back-button"
              onClick={() => setScreen('home')}
            >
              Ana Sayfa
            </button>
          </header>

          <main className="tp-weather-page-main">
            <section
              className="tp-weather-hero"
              style={{
                backgroundImage:
                  "linear-gradient(90deg,rgba(17,48,64,.88) 0%,rgba(17,48,64,.58) 52%,rgba(17,48,64,.16) 100%), url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=82')",
              }}
            >
              <div className="tp-weather-hero-copy">
                <span className="tp-weather-hero-kicker">{weatherHeroBlock?.icon || 'TARLAN İÇİN HAVA TAKİBİ'}</span>
                <h1>{cmsText(weatherHeroBlock, weatherPage?.title || 'Hava Durumu')}</h1>
                <p>3 farklı kaynağın tahminini karşılaştır, saha kararını daha güvenli ver.</p>
                <div className="tp-weather-hero-pills">
                  <span>{weatherForecastBlock?.icon || '🌦️'} {cmsText(weatherForecastBlock,'5 Günlük Tahmin')}</span>
                  <span>🌧️ Yağış Riski</span>
                  <span>💨 Rüzgâr</span>
                </div>
              </div>

              <div className="tp-weather-location-card tp-weather-location-card-hero">
                <span>Konum</span>
                <strong>
                  {weatherState.locationLabel ||
                    [weatherField.village, weatherField.district, weatherField.city]
                      .filter(Boolean)
                      .join(' / ') ||
                    weatherField.name}
                </strong>
              </div>
            </section>

            <section className="tp-weather-field-bar">
              <div>
                <small>TARLA</small>
                <strong>{weatherField.name}</strong>
                <span>
                  {weatherField.crop} • {weatherField.area.toLocaleString('tr-TR')} da
                </span>
              </div>

              {realFields.length > 1 && (
                <MobileWheelPicker
                  title="Hava durumu için tarla seç"
                  value={String(weatherField.id)}
                  onChange={(value) => {
                    setWeatherHubFieldId(value);
                    const selected = realFields.find(
                      (field) => String(field.id) === value,
                    );
                    if (selected) void loadFieldWeather(selected);
                  }}
                  searchable
                  options={realFields.map((field) => ({
                    value: String(field.id),
                    label: field.name,
                    subtitle: `${field.crop} • ${field.area.toLocaleString('tr-TR')} da`,
                  }))}
                />
              )}

              <button
                type="button"
                className="tp-weather-refresh"
                disabled={weatherState.status === 'loading'}
                onClick={() => void loadFieldWeather(weatherField)}
              >
                {weatherState.status === 'loading' ? 'Güncelleniyor...' : 'Tahmini Güncelle'}
              </button>
            </section>

            {weatherState.status === 'idle' && (
              <section className="tp-weather-empty-state">
                <span>🌦️</span>
                <strong>Hava tahmini henüz yüklenmedi</strong>
                <p>3 hava kaynağını karşılaştırmak için tahmini yükle.</p>
                <button type="button" onClick={() => void loadFieldWeather(weatherField)}>
                  Tahmini Yükle
                </button>
              </section>
            )}

            {weatherState.status === 'loading' && providerRows.length === 0 && (
              <section className="tp-weather-empty-state">
                <span>⏳</span>
                <strong>3 kaynak karşılaştırılıyor</strong>
                <p>Güncel 5 günlük tahmin hazırlanıyor.</p>
              </section>
            )}

            {weatherState.status === 'error' && providerRows.length === 0 && (
              <section className="tp-weather-empty-state error">
                <span>!</span>
                <strong>Hava verileri alınamadı</strong>
                <p>{weatherState.message ?? 'Tekrar deneyebilirsin.'}</p>
                <button type="button" onClick={() => void loadFieldWeather(weatherField)}>
                  Tekrar Dene
                </button>
              </section>
            )}

            {providerRows.length > 0 && (
              <>
                <section className="tp-weather-table-card">
                  <div className="tp-weather-table-scroll">
                    <table className="tp-weather-compare-table">
                      <thead>
                        <tr>
                          <th>Kaynak</th>
                          {[0, 1, 2, 3, 4].map((index) => (
                            <th key={index}>{weatherDayLabel(index)}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {providerRows.map((provider, providerIndex) => (
                          <tr key={`${provider.name}-${providerIndex}`}>
                            <td>
                              <strong>{provider.name}</strong>
                            </td>

                            {[0, 1, 2, 3, 4].map((dayIndex) => {
                              const day = provider.forecast[dayIndex];

                              return (
                                <td key={dayIndex}>
                                  {day ? (
                                    <div className="tp-weather-day-cell">
                                      <span>{weatherIcon(day.condition)}</span>
                                      <strong>
                                        {day.tempMax !== null
                                          ? `${Math.round(day.tempMax)}°C`
                                          : '—'}
                                      </strong>
                                      {(day.precipitationProbability ?? 0) > 0 && (
                                        <small>
                                          %{Math.round(day.precipitationProbability ?? 0)}
                                        </small>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="tp-weather-no-data">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="tp-weather-producer-summary">
                  <div>
                    <span className="tp-weather-summary-label">{cmsText(weatherProducerBlock,'Üretici Özeti')}</span>
                    <p>{summaryText}</p>

                    {firstDay && (
                      <div className="tp-weather-summary-tags">
                        <span>
                          Bugün {firstDay.tempMin ?? '—'}° / {firstDay.tempMax ?? '—'}°
                        </span>
                        <span>Nem %{firstDay.humidity ?? '—'}</span>
                        <span>Rüzgâr {firstDay.windSpeed ?? '—'} km/sa</span>
                      </div>
                    )}
                  </div>

                  <div className="tp-weather-summary-visual">
                    {rainyDays > 0 ? '🌧️' : '☀️'}
                  </div>
                </section>
              </>
            )}
          </main>

          <style>{`
            .tp-weather-page-shell{
              min-height:100vh;
              background:#f6f8f6;
              color:#17251c;
            }

            .tp-weather-page-top{
              height:62px;
              display:grid;
              grid-template-columns:44px 1fr auto;
              align-items:center;
              gap:12px;
              padding:0 20px;
              border-bottom:1px solid #e2e8e2;
              background:#fff;
            }

            .tp-weather-menu-button,
            .tp-weather-back-button{
              border:1px solid #dfe6df;
              border-radius:10px;
              background:#fff;
              color:#174f31;
              font:inherit;
              font-weight:800;
              cursor:pointer;
            }

            .tp-weather-menu-button{
              width:38px;
              height:38px;
            }

            .tp-weather-back-button{
              min-height:36px;
              padding:0 12px;
              font-size:10px;
            }

            .tp-weather-top-brand{
              display:flex;
              align-items:center;
              justify-content:center;
              gap:8px;
              color:#17653c;
              font-size:12px;
              letter-spacing:.08em;
            }

            .tp-weather-page-main{
              width:min(1040px,calc(100% - 30px));
              margin:0 auto;
              padding:28px 0 40px;
            }

            .tp-weather-page-heading{
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:18px;
              margin-bottom:16px;
            }

            .tp-weather-page-heading h1{
              margin:0;
              font-size:26px;
              letter-spacing:-.5px;
            }

            .tp-weather-page-heading p{
              margin:5px 0 0;
              color:#6e7b72;
              font-size:11px;
            }

            .tp-weather-location-card{
              min-width:165px;
              display:flex;
              flex-direction:column;
              gap:2px;
              border:1px solid #e0e6df;
              border-radius:11px;
              padding:10px 12px;
              background:#fff;
              box-shadow:0 5px 16px rgba(30,60,40,.03);
            }

            .tp-weather-location-card span{
              color:#8a938d;
              font-size:8px;
              text-transform:uppercase;
              letter-spacing:.08em;
            }

            .tp-weather-location-card strong{
              overflow:hidden;
              max-width:220px;
              font-size:10px;
              text-overflow:ellipsis;
              white-space:nowrap;
            }

            .tp-weather-field-bar{
              display:grid;
              grid-template-columns:minmax(160px,1fr) minmax(180px,260px) auto;
              align-items:center;
              gap:10px;
              margin-bottom:12px;
              border:1px solid #e1e6e1;
              border-radius:12px;
              padding:10px 12px;
              background:#fff;
            }

            .tp-weather-field-bar>div:first-child{
              display:flex;
              flex-direction:column;
              gap:1px;
            }

            .tp-weather-field-bar small{
              color:#7c897f;
              font-size:7.5px;
              font-weight:900;
              letter-spacing:.08em;
            }

            .tp-weather-field-bar strong{
              font-size:11px;
            }

            .tp-weather-field-bar span{
              color:#7c887f;
              font-size:8.5px;
            }

            .tp-weather-refresh{
              min-height:38px;
              border:1px solid #2e7042;
              border-radius:9px;
              padding:0 12px;
              background:#2e7042;
              color:#fff;
              font:inherit;
              font-size:9px;
              font-weight:850;
              cursor:pointer;
            }

            .tp-weather-table-card{
              overflow:hidden;
              border:1px solid #dfe5df;
              border-radius:13px;
              background:#fff;
              box-shadow:0 7px 22px rgba(28,56,36,.04);
            }

            .tp-weather-table-scroll{
              overflow-x:auto;
            }

            .tp-weather-compare-table{
              width:100%;
              min-width:720px;
              border-collapse:collapse;
            }

            .tp-weather-compare-table th{
              padding:11px 12px;
              border-bottom:1px solid #e9ede9;
              color:#536259;
              font-size:9px;
              font-weight:850;
              text-align:center;
            }

            .tp-weather-compare-table th:first-child{
              min-width:145px;
              text-align:left;
            }

            .tp-weather-compare-table td{
              padding:12px;
              border-bottom:1px solid #edf0ed;
              text-align:center;
            }

            .tp-weather-compare-table tr:last-child td{
              border-bottom:0;
            }

            .tp-weather-compare-table td:first-child{
              color:#28362c;
              font-size:9px;
              text-align:left;
            }

            .tp-weather-day-cell{
              display:flex;
              align-items:center;
              justify-content:center;
              gap:7px;
            }

            .tp-weather-day-cell>span{
              font-size:19px;
            }

            .tp-weather-day-cell strong{
              font-size:10px;
              white-space:nowrap;
            }

            .tp-weather-day-cell small{
              border-radius:999px;
              padding:2px 4px;
              background:#eef5fa;
              color:#47718c;
              font-size:7px;
            }

            .tp-weather-producer-summary{
              display:grid;
              grid-template-columns:1fr 150px;
              align-items:center;
              gap:20px;
              margin-top:16px;
              border:1px solid #dce6dc;
              border-radius:13px;
              padding:18px;
              background:linear-gradient(90deg,#fbfdfb,#f1f7f1);
            }

            .tp-weather-summary-label{
              display:block;
              margin-bottom:7px;
              color:#297043;
              font-size:10px;
              font-weight:900;
            }

            .tp-weather-producer-summary p{
              max-width:720px;
              margin:0;
              color:#526158;
              font-size:10px;
              line-height:1.6;
            }

            .tp-weather-summary-tags{
              display:flex;
              flex-wrap:wrap;
              gap:7px;
              margin-top:11px;
            }

            .tp-weather-summary-tags span{
              border:1px solid #dfe7df;
              border-radius:999px;
              padding:5px 8px;
              background:#fff;
              color:#637067;
              font-size:8px;
              font-weight:750;
            }

            .tp-weather-summary-visual{
              display:grid;
              place-items:center;
              min-height:100px;
              border-radius:16px;
              background:#eaf3ea;
              font-size:54px;
            }

            .tp-weather-empty-state{
              display:flex;
              min-height:260px;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              border:1px solid #dfe6df;
              border-radius:14px;
              background:#fff;
              text-align:center;
            }

            .tp-weather-empty-state>span{
              font-size:42px;
            }

            .tp-weather-empty-state strong{
              margin-top:10px;
              font-size:13px;
            }

            .tp-weather-empty-state p{
              margin:5px 0 12px;
              color:#7b867e;
              font-size:9px;
            }

            .tp-weather-empty-state button{
              min-height:36px;
              border:0;
              border-radius:9px;
              padding:0 12px;
              background:#2e7042;
              color:#fff;
              font:inherit;
              font-size:9px;
              font-weight:850;
              cursor:pointer;
            }

            @media(max-width:700px){
              .tp-weather-page-main{
                width:min(100% - 20px,1040px);
                padding-top:18px;
              }

              .tp-weather-page-heading{
                align-items:stretch;
                flex-direction:column;
              }

              .tp-weather-location-card{
                min-width:0;
              }

              .tp-weather-field-bar{
                grid-template-columns:1fr;
              }

              .tp-weather-producer-summary{
                grid-template-columns:1fr;
              }

              .tp-weather-summary-visual{
                min-height:80px;
              }
            }
          `}</style>
        </div>
      </>
    );
  }

  if (screen === 'adminHub') {
    return <AdminPageBuilder onBack={() => setScreen('home')} />;
  }

  const placeholder = placeholderMeta[screen];
  if (placeholder) {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>
        <div className="tp-desktop-shell">
          {sideMenuOpen && (
            <>
              <button
                type="button"
                className="tp-side-backdrop"
                aria-label="Menüyü kapat"
                onClick={() => setSideMenuOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9997,
                  border: 0,
                  background: 'rgba(7,31,20,.38)',
                }}
              />

              <aside
                className="tp-desktop-sidebar tp-drawer-sidebar open"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  zIndex: 9998,
                  width: 225,
                  height: '100vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  padding: '16px 10px 14px',
                  background: 'linear-gradient(180deg,#064b2f 0%,#075638 58%,#043f29 100%)',
                  color: '#fff',
                  boxShadow: '12px 0 34px rgba(5,57,35,.22)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="tp-side-brand"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0,1fr) 26px',
                    alignItems: 'center',
                    gap: 8,
                    padding: '2px 4px 14px',
                    borderBottom: '1px solid rgba(255,255,255,.10)',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#7be683',
                      fontSize: 22,
                    }}
                  >
                    🌱
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: '#fff',
                        fontSize: 17,
                        fontWeight: 900,
                        letterSpacing: '-.35px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      TarlaPusula
                    </strong>
                    <small
                      style={{
                        display: 'block',
                        marginTop: 1,
                        color: 'rgba(255,255,255,.67)',
                        fontSize: 8.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Tarla için akıllı rehber
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSideMenuOpen(false)}
                    aria-label="Menüyü kapat"
                    style={{
                      width: 26,
                      height: 26,
                      display: 'grid',
                      placeItems: 'center',
                      border: 0,
                      borderRadius: 7,
                      background: 'rgba(255,255,255,.07)',
                      color: '#fff',
                      fontSize: 17,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>

                <nav
                  className="tp-side-nav"
                  style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    gap: 2,
                    overflowY: 'auto',
                    padding: '12px 0 8px',
                  }}
                >
                  {desktopMenuItems.map((item, index) => {
                    const active = screen === item.screen;

                    return (
                      <button
                        key={`${item.label}-${index}`}
                        onClick={() => {
                          setScreen(item.screen);
                          setSideMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          minHeight: 38,
                          display: 'grid',
                          gridTemplateColumns: '27px minmax(0,1fr) auto',
                          alignItems: 'center',
                          gap: 8,
                          border: 0,
                          borderRadius: 9,
                          padding: '6px 9px',
                          background: active
                            ? 'linear-gradient(90deg,#21834b,#258d50)'
                            : 'transparent',
                          color: '#fff',
                          boxShadow: active ? '0 7px 18px rgba(0,0,0,.14)' : 'none',
                          fontFamily: 'inherit',
                          fontSize: 11.5,
                          fontWeight: 720,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: 27,
                            height: 27,
                            display: 'grid',
                            placeItems: 'center',
                            color: '#fff',
                            fontSize: 15,
                          }}
                        >
                          {item.icon}
                        </span>

                        <span
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label}
                        </span>

                        {item.badge && (
                          <b
                            style={{
                              borderRadius: 999,
                              background: item.badge === 'YENİ' ? '#7bdd6e' : '#ed5147',
                              color: item.badge === 'YENİ' ? '#083e27' : '#fff',
                              padding: '3px 6px',
                              fontSize: 7.5,
                              fontWeight: 900,
                            }}
                          >
                            {item.badge}
                          </b>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 5px',
                    borderTop: '1px solid rgba(255,255,255,.10)',
                    color: '#fff',
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      background: '#fff',
                      color: '#17653c',
                      fontWeight: 900,
                    }}
                  >
                    Ü
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 10.5 }}>Üretici</strong>
                    <small style={{ display: 'block', marginTop: 2, color: 'rgba(255,255,255,.62)', fontSize: 8.5 }}>
                      Ücretsiz Plan
                    </small>
                  </div>
                  <span>›</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 6,
                    padding: 11,
                    border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 13,
                    background: 'rgba(255,255,255,.055)',
                    color: '#fff',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,.74)', fontSize: 8.5 }}>Tarla Kullanımınız</span>
                  <strong style={{ color: '#72e37b', fontSize: 19, lineHeight: 1 }}>2 / 3</strong>
                  <small style={{ color: 'rgba(255,255,255,.62)', fontSize: 8.3 }}>
                    Ücretsiz tarla hakkınız kaldı
                  </small>

                  <div
                    style={{
                      height: 7,
                      overflow: 'hidden',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.14)',
                    }}
                  >
                    <i
                      style={{
                        display: 'block',
                        width: '66%',
                        height: '100%',
                        borderRadius: 999,
                        background: '#66d970',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    style={{
                      minHeight: 36,
                      marginTop: 3,
                      border: '1px solid rgba(255,255,255,.78)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: '#fff',
                      fontFamily: 'inherit',
                      fontSize: 9.5,
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    ＋ Tarla Ekle
                  </button>
                </div>
              </aside>
            </>
          )}

          <section className="tp-placeholder-page">
            <header className="tp-placeholder-top">
              <div className="tp-placeholder-top-left">
                <button type="button" className="tp-menu-trigger" onClick={() => setSideMenuOpen(true)}>☰</button>
                <button onClick={() => setScreen('home')}>← Ana Sayfa</button>
              </div>
              <div><span>Konum</span><strong>Samsun / Bafra</strong></div>
            </header>
            <main className="tp-placeholder-main">
              <div className="tp-placeholder-heading"><div className="tp-placeholder-icon">{placeholder.icon}</div><div><h1>{placeholder.title}</h1><p>{placeholder.subtitle}</p></div><span className="tp-coming-badge">HAZIRLANIYOR</span></div>
              <div className="tp-placeholder-cards">{placeholder.cards.map((card, i) => <article key={card}><span>{['01','02','03'][i]}</span><h3>{card}</h3><p>Bu bölüm tasarıma eklendi. İşlevleri sonraki adımda bağlanabilir.</p><button>Yakında →</button></article>)}</div>
              <section className="tp-placeholder-preview"><div><small>TARLAPUSULA</small><h2>Bu sayfanın iskeleti hazır.</h2><p>Sol menü ve sayfa düzeni referans tasarımlardaki sade, profesyonel tarım paneli diline göre oluşturuldu.</p></div><div className="tp-placeholder-visual">{placeholder.icon}</div></section>
            </main>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>
      <style>{`
        .tp-home-dashboard{
          display:grid;
          grid-template-columns:minmax(0,1.18fr) minmax(280px,.82fr);
          gap:16px;
          margin-top:14px;
        }

        .tp-home-panel{
          border:1px solid #dfe8e0;
          border-radius:16px;
          background:#fff;
          box-shadow:0 9px 28px rgba(25,57,36,.055);
        }

        /* ===== ANA SAYFA / ASİL TARIMSAL RENK DİLİ ===== */
        .tp-home-welcome{
          position:relative;
          overflow:hidden;
          border:1px solid #dce7dd;
          border-radius:18px;
          padding:18px 20px !important;
          background:
            radial-gradient(circle at 88% 22%, rgba(213,181,88,.14), transparent 28%),
            linear-gradient(135deg,#f8fbf7 0%,#eef6ef 58%,#f8f4e9 100%);
          box-shadow:0 10px 30px rgba(27,65,40,.055);
        }

        .tp-home-welcome::after{
          content:'';
          position:absolute;
          right:-34px;
          bottom:-42px;
          width:150px;
          height:150px;
          border-radius:50%;
          border:28px solid rgba(45,108,62,.045);
          pointer-events:none;
        }

        .tp-home-welcome-copy{
          position:relative;
          z-index:1;
        }

        .tp-home-greeting{
          width:max-content;
          margin-bottom:7px !important;
          border:1px solid rgba(43,112,61,.13);
          border-radius:999px;
          padding:5px 9px;
          background:rgba(255,255,255,.72);
          color:#27703e !important;
          font-size:8px !important;
          font-weight:950 !important;
          letter-spacing:.085em;
        }

        .tp-home-welcome h1{
          color:#183c28 !important;
          letter-spacing:-.025em;
        }

        .tp-home-panel-head strong,
        .tp-home-quick h3{
          color:#1f6038 !important;
        }

        .tp-home-plan{
          background:
            linear-gradient(180deg,rgba(245,250,245,.72),#fff 36%);
        }

        .tp-home-plan-icon{
          border:1px solid rgba(46,111,63,.07);
          background:#eef6ed;
        }

        .tp-home-plan-row:nth-child(2) .tp-home-plan-icon{
          background:#f6f1df;
        }

        .tp-home-plan-row:nth-child(3) .tp-home-plan-icon{
          background:#edf3f7;
        }

        .tp-home-plan-row:nth-child(4) .tp-home-plan-icon{
          background:#f4eeee;
        }

        .tp-home-selected-head{
          background:
            linear-gradient(100deg,#f4faf4 0%,#ffffff 68%,#faf6e9 100%);
          border-bottom:1px solid #edf1ed;
        }

        .tp-home-selected-head span{
          color:#2f7a49 !important;
        }

        .tp-home-selected-head strong{
          color:#183d28 !important;
        }

        .tp-home-field-summary{
          background:#fbfcfa;
        }

        .tp-home-field-summary strong{
          color:#294f36;
        }

        .tp-home-quick{
          background:
            linear-gradient(180deg,#ffffff 0%,#fbfdfb 100%);
        }

        .tp-home-quick-grid button{
          border-color:#e0e9e1 !important;
          background:#fff !important;
          transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;
        }

        .tp-home-quick-grid button:hover{
          transform:translateY(-1px);
          border-color:#b9d1bd !important;
          box-shadow:0 8px 22px rgba(31,91,50,.07);
        }

        .tp-home-plan{
          padding:16px;
        }

        .tp-home-panel-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          margin-bottom:12px;
        }

        .tp-home-panel-head strong{
          display:block;
          color:#1e2d23;
          font-size:14px;
          font-weight:900;
        }

        .tp-home-panel-head small{
          display:block;
          margin-top:3px;
          color:#7a867e;
          font-size:9px;
        }

        .tp-home-plan-list{
          display:flex;
          flex-direction:column;
          overflow:hidden;
          border:1px solid #e7ebe7;
          border-radius:12px;
          background:#fbfcfb;
        }

        .tp-home-plan-row{
          min-height:52px;
          display:grid;
          grid-template-columns:36px minmax(0,1fr) auto;
          align-items:center;
          gap:10px;
          border:0;
          border-bottom:1px solid #edf0ed;
          padding:8px 11px;
          background:transparent;
          color:#29352d;
          font:inherit;
          text-align:left;
          cursor:pointer;
        }

        .tp-home-plan-row:last-child{
          border-bottom:0;
        }

        .tp-home-plan-row:hover{
          background:#f6faf6;
        }

        .tp-home-plan-icon{
          width:32px;
          height:32px;
          display:grid;
          place-items:center;
          border-radius:10px;
          background:#eef6ed;
          font-size:16px;
        }

        .tp-home-plan-copy strong{
          display:block;
          font-size:10px;
          font-weight:850;
        }

        .tp-home-plan-copy small{
          display:block;
          margin-top:2px;
          color:#7b877f;
          font-size:8.5px;
          line-height:1.35;
        }

        .tp-home-plan-status{
          width:8px;
          height:8px;
          border-radius:50%;
          background:#53a962;
        }

        .tp-home-plan-status.warn{
          background:#e4a10c;
        }

        .tp-home-selected{
          overflow:hidden;
        }

        .tp-home-selected-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
          padding:15px 15px 10px;
        }

        .tp-home-selected-head span{
          display:block;
          color:#6e7a72;
          font-size:8px;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .tp-home-selected-head strong{
          display:block;
          margin-top:3px;
          color:#1e2e23;
          font-size:15px;
          font-weight:900;
        }

        .tp-home-selected-head small{
          display:block;
          margin-top:2px;
          color:#7b867e;
          font-size:8.5px;
        }

        .tp-home-favorite{
          width:34px;
          height:34px;
          display:grid;
          place-items:center;
          border:1px solid #dfe6df;
          border-radius:10px;
          background:#fff;
          color:#8a948c;
          font-size:17px;
          cursor:pointer;
        }

        .tp-home-favorite.active{
          border-color:#e3c75b;
          background:#fff9dc;
          color:#d59c00;
        }

        .tp-home-map-wrap{
          padding:0 13px;
        }

        .tp-home-map-frame{
          overflow:hidden;
          border:1px solid #e0e7e0;
          border-radius:12px;
          background:#eef4ed;
        }

        .tp-home-field-summary{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:1px;
          margin:10px 13px 0;
          overflow:hidden;
          border:1px solid #e5eae5;
          border-radius:10px;
          background:#e5eae5;
        }

        .tp-home-field-summary div{
          min-width:0;
          padding:9px;
          background:#fff;
        }

        .tp-home-field-summary small{
          display:block;
          color:#879087;
          font-size:7.5px;
        }

        .tp-home-field-summary strong{
          display:block;
          margin-top:2px;
          overflow:hidden;
          color:#2a392f;
          font-size:9px;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .tp-home-selected-actions{
          display:flex;
          gap:8px;
          padding:11px 13px 14px;
        }

        .tp-home-selected-actions button{
          flex:1;
          min-height:38px;
          border:1px solid #2b7040;
          border-radius:9px;
          background:#2d7342;
          color:#fff;
          font:inherit;
          font-size:9px;
          font-weight:850;
          cursor:pointer;
        }

        .tp-home-selected-actions button.secondary{
          background:#fff;
          color:#2d7041;
        }

        .tp-home-quick{
          margin-top:14px;
          padding:14px;
        }

        .tp-home-quick h3{
          margin:0 0 10px;
          color:#26342b;
          font-size:12px;
        }

        .tp-home-quick-grid{
          display:grid;
          grid-template-columns:repeat(5,1fr);
          overflow:hidden;
          border:1px solid #e4e9e4;
          border-radius:12px;
          background:#e4e9e4;
          gap:1px;
        }

        .tp-home-quick-grid button{
          min-height:78px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:7px;
          border:0;
          background:#fff;
          color:#314037;
          font:inherit;
          font-size:8.5px;
          font-weight:750;
          cursor:pointer;
        }

        .tp-home-quick-grid button:hover{
          background:#f7faf7;
        }

        .tp-home-quick-grid span{
          width:31px;
          height:31px;
          display:grid;
          place-items:center;
          border-radius:10px;
          background:#eef6ed;
          font-size:16px;
        }

        .tp-home-tarlalarim-shortcut{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-top:14px;
          padding:13px 15px;
          border:1px solid #dfe7df;
          border-radius:13px;
          background:linear-gradient(90deg,#f4faf3,#fff);
        }

        .tp-home-tarlalarim-shortcut div{
          display:flex;
          align-items:center;
          gap:10px;
        }

        .tp-home-tarlalarim-shortcut .icon{
          width:38px;
          height:38px;
          display:grid;
          place-items:center;
          border-radius:11px;
          background:#e4f2e1;
          font-size:18px;
        }

        .tp-home-tarlalarim-shortcut strong{
          display:block;
          font-size:11px;
        }

        .tp-home-tarlalarim-shortcut small{
          display:block;
          margin-top:2px;
          color:#78847b;
          font-size:8.5px;
        }

        .tp-home-tarlalarim-shortcut button{
          min-height:36px;
          border:1px solid #2d7041;
          border-radius:9px;
          padding:0 12px;
          background:#fff;
          color:#2d7041;
          font:inherit;
          font-size:9px;
          font-weight:850;
          cursor:pointer;
        }

        .tp-home-with-sidebar .statusCard{
          margin-top:14px;
        }

        @media(max-width:800px){
          .tp-home-dashboard{
            grid-template-columns:1fr;
          }

          .tp-home-quick-grid{
            grid-template-columns:repeat(3,1fr);
          }
        }

        @media(max-width:520px){
          .tp-home-quick-grid{
            grid-template-columns:repeat(2,1fr);
          }

          .tp-home-field-summary{
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <div className="app tp-home-with-sidebar">
        {sideMenuOpen && (
          <>
            <button
              type="button"
              className="tp-side-backdrop"
              aria-label="Menüyü kapat"
              onClick={() => setSideMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9997,
                border: 0,
                background: 'rgba(7,31,20,.38)',
              }}
            />

            <aside
              className="tp-desktop-sidebar tp-drawer-sidebar open"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9998,
                width: 225,
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                padding: '16px 10px 14px',
                background: 'linear-gradient(180deg,#064b2f 0%,#075638 58%,#043f29 100%)',
                color: '#fff',
                boxShadow: '12px 0 34px rgba(5,57,35,.22)',
                overflow: 'hidden',
              }}
            >
              <div
                  className="tp-side-brand"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px minmax(0,1fr) 26px',
                    alignItems: 'center',
                    gap: 8,
                    padding: '2px 4px 14px',
                    borderBottom: '1px solid rgba(255,255,255,.10)',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#7be683',
                      fontSize: 22,
                    }}
                  >
                    🌱
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: 'block',
                        color: '#fff',
                        fontSize: 17,
                        fontWeight: 900,
                        letterSpacing: '-.35px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      TarlaPusula
                    </strong>
                    <small
                      style={{
                        display: 'block',
                        marginTop: 1,
                        color: 'rgba(255,255,255,.67)',
                        fontSize: 8.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Tarla için akıllı rehber
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSideMenuOpen(false)}
                    aria-label="Menüyü kapat"
                    style={{
                      width: 26,
                      height: 26,
                      display: 'grid',
                      placeItems: 'center',
                      border: 0,
                      borderRadius: 7,
                      background: 'rgba(255,255,255,.07)',
                      color: '#fff',
                      fontSize: 17,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>

              <nav
                className="tp-side-nav"
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 2,
                  overflowY: 'auto',
                  padding: '12px 0 8px',
                }}
              >
                {desktopMenuItems.map((item, index) => {
                  const active = item.label === 'Ana Sayfa';

                  return (
                    <button
                      key={`${item.label}-${index}`}
                      onClick={() => {
                        if (item.label === 'Tarlalarım') {
                          document.querySelector('.fieldsSection')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          setScreen(item.screen);
                        }
                        setSideMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        minHeight: 38,
                        display: 'grid',
                        gridTemplateColumns: '27px minmax(0,1fr) auto',
                        alignItems: 'center',
                        gap: 8,
                        border: 0,
                        borderRadius: 9,
                        padding: '6px 9px',
                        background: active
                          ? 'linear-gradient(90deg,#21834b,#258d50)'
                          : 'transparent',
                        color: '#fff',
                        boxShadow: active ? '0 7px 18px rgba(0,0,0,.14)' : 'none',
                        fontFamily: 'inherit',
                        fontSize: 11.5,
                        fontWeight: 720,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 27,
                          height: 27,
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: 15,
                        }}
                      >
                        {item.icon}
                      </span>

                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>

                      {item.badge && (
                        <b
                          style={{
                            borderRadius: 999,
                            background: item.badge === 'YENİ' ? '#7bdd6e' : '#ed5147',
                            color: item.badge === 'YENİ' ? '#083e27' : '#fff',
                            padding: '3px 6px',
                            fontSize: 7.5,
                            fontWeight: 900,
                          }}
                        >
                          {item.badge}
                        </b>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 5px',
                    borderTop: '1px solid rgba(255,255,255,.10)',
                    color: '#fff',
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      background: '#fff',
                      color: '#17653c',
                      fontWeight: 900,
                    }}
                  >
                    Ü
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 10.5 }}>Üretici</strong>
                    <small style={{ display: 'block', marginTop: 2, color: 'rgba(255,255,255,.62)', fontSize: 8.5 }}>
                      Ücretsiz Plan
                    </small>
                  </div>
                  <span>›</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 6,
                    padding: 11,
                    border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 13,
                    background: 'rgba(255,255,255,.055)',
                    color: '#fff',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,.74)', fontSize: 8.5 }}>Tarla Kullanımınız</span>
                  <strong style={{ color: '#72e37b', fontSize: 19, lineHeight: 1 }}>2 / 3</strong>
                  <small style={{ color: 'rgba(255,255,255,.62)', fontSize: 8.3 }}>
                    Ücretsiz tarla hakkınız kaldı
                  </small>

                  <div
                    style={{
                      height: 7,
                      overflow: 'hidden',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.14)',
                    }}
                  >
                    <i
                      style={{
                        display: 'block',
                        width: '66%',
                        height: '100%',
                        borderRadius: 999,
                        background: '#66d970',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    style={{
                      minHeight: 36,
                      marginTop: 3,
                      border: '1px solid rgba(255,255,255,.78)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: '#fff',
                      fontFamily: 'inherit',
                      fontSize: 9.5,
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    ＋ Tarla Ekle
                  </button>
                </div>
            </aside>
          </>
        )}

        <header className="topbar">
          <button
            type="button"
            className="iconButton tp-menu-trigger"
            aria-label="Menüyü aç"
            onClick={() => setSideMenuOpen(true)}
          >
            ☰
          </button>

          <div className="brand">
            <div className="brandIcon">{cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'topbar-brand')?.icon || '🧭'}</div>
            <span>{cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'topbar-brand')?.title || 'TARLAPUSULA'}</span>
          </div>

          <button className="iconButton notification" style={{ display: cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'topbar-brand')?.content_data?.hideNotification ? 'none' : undefined }}>
            {cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'topbar-brand')?.content_data?.notificationIcon || '🔔'}
            <span className="notificationDot" />
          </button>
        </header>

        <main className="content" style={{ display: 'flex', flexDirection: 'column' }}>
          {(() => {
            const homePage = cmsPages.find((item) => item.page_key === 'home' && item.is_visible);
            const homeBlock = (key: string) =>
              cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === key);
            const topbarBrandBlock = homeBlock('topbar-brand');
            const heroBlock = homeBlock('hero');
            const dailyPlanBlock = homeBlock('daily-plan');
            const planWeatherBlock = homeBlock('plan-weather');
            const planFieldControlBlock = homeBlock('plan-field-control');
            const planSoilBlock = homeBlock('plan-soil');
            const planInventoryBlock = homeBlock('plan-inventory');
            const planNotebookBlock = homeBlock('plan-notebook');
            const selectedFieldBlock = homeBlock('selected-field');
            const quickActionsBlock = homeBlock('quick-actions');
            const quickFieldsBlock = homeBlock('quick-fields');
            const quickAiBlock = homeBlock('quick-ai');
            const quickInventoryBlock = homeBlock('quick-inventory');
            const quickNotebookBlock = homeBlock('quick-notebook');
            const quickSoilBlock = homeBlock('quick-soil');
            const fieldsShortcutBlock = homeBlock('fields-shortcut');
            const statusSummaryBlock = homeBlock('status-summary');
            const statusGoodBlock = homeBlock('status-good');
            const statusCheckBlock = homeBlock('status-check');
            const statusUrgentBlock = homeBlock('status-urgent');
            const fieldsBlock = homeBlock('fields');

            const homeField =
              realFields.find((field) => String(field.id) === favoriteFieldId) ??
              realFields[0] ??
              demoField;

            const homeWeather =
              fieldWeather.__home__ ??
              fieldWeather[String(homeField.id)] ?? {
                status: 'idle' as const,
                forecast: [],
              };

            const homeSatellite = satelliteByField[String(homeField.id)] ?? {
              status: 'idle' as const,
            };
            const homeSatelliteData = homeSatellite.data;

            const todayWeather = homeWeather.forecast[0];

            const turkeyHour = Number(
              new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                hour12: false,
                timeZone: 'Europe/Istanbul',
              }).format(new Date()),
            );

            const homeGreeting =
              turkeyHour >= 0 && turkeyHour < 6
                ? 'İYİ GECELER 🌙'
                : turkeyHour < 12
                  ? 'GÜNAYDIN 👋'
                  : turkeyHour < 20
                    ? 'İYİ GÜNLER ☀️'
                    : 'İYİ AKŞAMLAR 🌙';

            return (
              <>
                <section className="welcome tp-home-welcome" style={{ ...cmsBlockStyle(heroBlock), order: heroBlock?.position ?? 1, display: heroBlock?.is_visible === false ? 'none' : undefined }}>
                  <div className="tp-home-welcome-copy">
                    {(heroBlock?.icon || homePage?.icon) && (
                      <span style={{ display: 'inline-flex', marginBottom: 6, fontSize: heroBlock?.icon_size || homePage?.icon_size || 22 }}>
                        {heroBlock?.icon || homePage?.icon}
                      </span>
                    )}
                    <p className="eyebrow tp-home-greeting">{homeGreeting}</p>
                    <h1>{heroBlock?.title || homePage?.title || 'Bugünün tarla planı hazır.'}</h1>
                    {(heroBlock?.subtitle || homePage?.subtitle) && (
                      <p style={{ margin: '5px 0 0', color: '#68776d', fontSize: 11 }}>
                        {heroBlock?.subtitle || homePage?.subtitle}
                      </p>
                    )}
                    <small style={{ color: '#7b867e', fontSize: 9 }}>
                      {new Intl.DateTimeFormat('tr-TR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date())}
                    </small>
                  </div>

                  <div className="weatherMini">
                    <span className="weatherIcon">
                      {weatherIcon(todayWeather?.condition)}
                    </span>

                    <div>
                      <strong>
                        {todayWeather?.tempMax !== null &&
                        todayWeather?.tempMax !== undefined
                          ? `${Math.round(todayWeather.tempMax)}°C`
                          : '—'}
                      </strong>
                      <span>
                        {todayWeather?.condition ??
                          (homeWeather.status === 'loading'
                            ? 'Hava durumu alınıyor…'
                            : homeWeather.status === 'error'
                              ? 'Hava verisi alınamadı'
                              : 'Hava durumu hazırlanıyor…')}
                      </span>
                      <small>
                        {homeWeather.locationLabel ||
                          (realFields.length > 0
                            ? [homeField.village, homeField.district, homeField.city]
                                .filter(Boolean)
                                .join(' / ') || homeField.name
                            : 'Elazığ')}
                      </small>
                    </div>
                  </div>
                </section>

                <section className="tp-home-dashboard" style={{ ...cmsBlockStyle(dailyPlanBlock), order: dailyPlanBlock?.position ?? 2, display: dailyPlanBlock?.is_visible === false ? 'none' : undefined }}>
                  <article className="tp-home-panel tp-home-plan">
                    <div className="tp-home-panel-head">
                      <div>
                        <strong>{dailyPlanBlock?.title || 'Bugünkü Tarla Planın'}</strong>
                        <small>{dailyPlanBlock?.subtitle || 'Öncelikli kontroller ve hızlı işlemler'}</small>
                      </div>
                    </div>

                    <div className="tp-home-plan-list">
                      <button
                        type="button"
                        className="tp-home-plan-row"
                        style={{ ...cmsBlockStyle(planWeatherBlock), display: planWeatherBlock?.is_visible === false ? 'none' : undefined }}
                        onClick={() => {
                          setWeatherHubFieldId(String(homeField.id));
                          setScreen('weatherHub');
                          if (homeWeather.status === 'idle') {
                            void loadFieldWeather(homeField);
                          }
                        }}
                      >
                        <span className="tp-home-plan-icon" style={{fontSize:planWeatherBlock?.icon_size || undefined}}>{planWeatherBlock?.icon || '🌦️'}</span>
                        <span className="tp-home-plan-copy">
                          <strong>{planWeatherBlock?.title || 'Hava Durumu'}</strong>
                          <small>
                            {todayWeather
                              ? `${todayWeather.condition} • Yağış ihtimali %${
                                  todayWeather.precipitationProbability ?? 0
                                }`
                              : planWeatherBlock?.subtitle || planWeatherBlock?.description || '3 kaynaktan güncel tahmini kontrol et.'}
                          </small>
                        </span>
                        <i
                          className={`tp-home-plan-status ${
                            (todayWeather?.precipitationProbability ?? 0) >= 40
                              ? 'warn'
                              : ''
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        className="tp-home-plan-row"
                        style={{ ...cmsBlockStyle(planFieldControlBlock), display: planFieldControlBlock?.is_visible === false ? 'none' : undefined }}
                        onClick={() => {
                          setFieldControlFieldId(String(homeField.id));
                          setScreen('fieldControlHub');
                          if (homeSatellite.status === 'idle' && homeField.parcelGeometry) {
                            void loadFieldSatellite(homeField);
                          }
                        }}
                      >
                        <span className="tp-home-plan-icon" style={{fontSize:planFieldControlBlock?.icon_size || undefined}}>{planFieldControlBlock?.icon || '🛰️'}</span>
                        <span className="tp-home-plan-copy">
                          <strong>{planFieldControlBlock?.title || 'Tarla Kontrolü'}</strong>
                          <small>
                            {homeSatelliteData?.summary ??
                              planFieldControlBlock?.subtitle ?? planFieldControlBlock?.description ??
                              'Sentinel-2 ile bitki gelişimini ve zayıf bölgeleri kontrol et.'}
                          </small>
                        </span>
                        <i
                          className={`tp-home-plan-status ${
                            homeSatelliteData?.status === 'check' ||
                            homeSatelliteData?.status === 'alert'
                              ? 'warn'
                              : ''
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        className="tp-home-plan-row"
                        style={{ ...cmsBlockStyle(planSoilBlock), display: planSoilBlock?.is_visible === false ? 'none' : undefined }}
                        onClick={() => setScreen('soilAnalysisHub')}
                      >
                        <span className="tp-home-plan-icon" style={{fontSize:planSoilBlock?.icon_size || undefined}}>{planSoilBlock?.icon || '🧪'}</span>
                        <span className="tp-home-plan-copy">
                          <strong>{planSoilBlock?.title || 'Toprak Analizi'}</strong>
                          <small>{planSoilBlock?.subtitle || planSoilBlock?.description || 'Numune ve analiz kayıtlarını gözden geçir.'}</small>
                        </span>
                        <i className="tp-home-plan-status" />
                      </button>

                      <button
                        type="button"
                        className="tp-home-plan-row"
                        style={{ ...cmsBlockStyle(planInventoryBlock), display: planInventoryBlock?.is_visible === false ? 'none' : undefined }}
                        onClick={() => setScreen('inventoryHub')}
                      >
                        <span className="tp-home-plan-icon" style={{fontSize:planInventoryBlock?.icon_size || undefined}}>{planInventoryBlock?.icon || '📦'}</span>
                        <span className="tp-home-plan-copy">
                          <strong>{planInventoryBlock?.title || 'İlaç & Gübre'}</strong>
                          <small>{planInventoryBlock?.subtitle || planInventoryBlock?.description || 'Depo stoklarını ve uygulama planını kontrol et.'}</small>
                        </span>
                        <i className="tp-home-plan-status" />
                      </button>

                      <button
                        type="button"
                        className="tp-home-plan-row"
                        style={{ ...cmsBlockStyle(planNotebookBlock), display: planNotebookBlock?.is_visible === false ? 'none' : undefined }}
                        onClick={() => setScreen('fieldNotebookHub')}
                      >
                        <span className="tp-home-plan-icon" style={{fontSize:planNotebookBlock?.icon_size || undefined}}>{planNotebookBlock?.icon || '📝'}</span>
                        <span className="tp-home-plan-copy">
                          <strong>{planNotebookBlock?.title || 'Tarla Günlüğü'}</strong>
                          <small>{planNotebookBlock?.subtitle || planNotebookBlock?.description || 'Bugünkü işlemleri kaydet ve geçmişi takip et.'}</small>
                        </span>
                        <i className="tp-home-plan-status" />
                      </button>
                    </div>
                  </article>

                  <article className="tp-home-panel tp-home-selected" style={{ ...cmsBlockStyle(selectedFieldBlock), display: selectedFieldBlock?.is_visible === false ? 'none' : undefined }}>
                    <div className="tp-home-selected-head">
                      <div>
                        <span>{selectedFieldBlock?.title || 'Seçili Tarlan'}</span>
                        <strong>{homeField.name}</strong>
                        <small>
                          {homeField.area.toLocaleString('tr-TR')} da • {homeField.crop} •{' '}
                          {homeField.season}
                        </small>
                      </div>

                      <button
                        type="button"
                        className={`tp-home-favorite ${
                          favoriteFieldId === String(homeField.id) ? 'active' : ''
                        }`}
                        title={
                          favoriteFieldId === String(homeField.id)
                            ? 'Favoriden çıkar'
                            : 'Ana sayfada favori yap'
                        }
                        onClick={() => toggleFavoriteField(homeField.id)}
                      >
                        ★
                      </button>
                    </div>

                    <div className="tp-home-map-wrap">
                      <div className="tp-home-map-frame">
                        {homeSatelliteData?.ndviImage ? (
                          <div style={{ position: 'relative', height: 175 }}>
                            <img
                              src={homeSatelliteData.ndviImage}
                              alt="Uydu bitki sağlığı"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: 8,
                                bottom: 8,
                                padding: '5px 7px',
                                borderRadius: 7,
                                background: 'rgba(255,255,255,.92)',
                                fontSize: 7.5,
                                fontWeight: 850,
                                color: '#2d5d3c',
                              }}
                            >
                              🛰️ Sentinel-2 • {homeSatelliteData.statusLabel}
                            </div>
                          </div>
                        ) : (
                          <FieldMap
                            initialCenter={[
                              homeField.parcelCentroidLng ??
                                homeField.longitude ??
                                35.2433,
                              homeField.parcelCentroidLat ??
                                homeField.latitude ??
                                38.9637,
                            ]}
                            initialZoom={homeField.parcelGeometry ? 17 : 10}
                            height={175}
                            parcelGeometry={homeField.parcelGeometry ?? null}
                            sections={[]}
                            drawEnabled={false}
                          />
                        )}
                      </div>
                    </div>

                    <div className="tp-home-field-summary">
                      <div>
                        <small>Durum</small>
                        <strong>{homeSatelliteData?.statusLabel ?? statusInfo[homeField.status].label}</strong>
                      </div>
                      <div>
                        <small>Ada / Parsel</small>
                        <strong>
                          {homeField.ada || '—'} / {homeField.parsel || '—'}
                        </strong>
                      </div>
                      <div>
                        <small>Konum</small>
                        <strong>
                          {[homeField.village, homeField.district]
                            .filter(Boolean)
                            .join(' / ') || '—'}
                        </strong>
                      </div>
                    </div>

                    <div className="tp-home-selected-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenField(homeField.id);
                          setTimeout(
                            () =>
                              document
                                .querySelector('.fieldsSection')
                                ?.scrollIntoView({ behavior: 'smooth' }),
                            50,
                          );
                        }}
                      >
                        {selectedFieldBlock?.button_text || 'Detayları Gör'}
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setFieldControlFieldId(String(homeField.id));
                          setScreen('fieldControlHub');
                          if (homeSatellite.status === 'idle' && homeField.parcelGeometry) {
                            void loadFieldSatellite(homeField);
                          }
                        }}
                      >
                        Tarla Kontrolü
                      </button>
                    </div>
                  </article>
                </section>

                <section className="tp-home-panel tp-home-quick" style={{ ...cmsBlockStyle(quickActionsBlock), order: quickActionsBlock?.position ?? 3, display: quickActionsBlock?.is_visible === false ? 'none' : undefined }}>
                  <h3>{quickActionsBlock?.title || 'Hızlı İşlemler'}</h3>
                  {quickActionsBlock?.subtitle && <small style={{display:'block',margin:'-2px 0 10px',color:'#758177'}}>{quickActionsBlock.subtitle}</small>}

                  <div className="tp-home-quick-grid">
                    <button
                      type="button"
                      style={{ ...cmsBlockStyle(quickFieldsBlock), display: quickFieldsBlock?.is_visible === false ? 'none' : undefined }}
                      onClick={() =>
                        document
                          .querySelector('.fieldsSection')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <span style={{fontSize:quickFieldsBlock?.icon_size || undefined}}>{quickFieldsBlock?.icon || '🌾'}</span>
                      {quickFieldsBlock?.title || 'Tarlalarım'}
                    </button>

                    <button type="button" style={{ ...cmsBlockStyle(quickAiBlock), display: quickAiBlock?.is_visible === false ? 'none' : undefined }} onClick={openAiAnalysisScreen}>
                      <span style={{fontSize:quickAiBlock?.icon_size || undefined}}>{quickAiBlock?.icon || '📷'}</span>
                      {quickAiBlock?.title || 'Fotoğraf Analizi'}
                    </button>

                    <button type="button" style={{ ...cmsBlockStyle(quickInventoryBlock), display: quickInventoryBlock?.is_visible === false ? 'none' : undefined }} onClick={() => setScreen('inventoryHub')}>
                      <span style={{fontSize:quickInventoryBlock?.icon_size || undefined}}>{quickInventoryBlock?.icon || '📦'}</span>
                      {quickInventoryBlock?.title || 'Depoma Ürün Ekle'}
                    </button>

                    <button type="button" style={{ ...cmsBlockStyle(quickNotebookBlock), display: quickNotebookBlock?.is_visible === false ? 'none' : undefined }} onClick={() => setScreen('fieldNotebookHub')}>
                      <span style={{fontSize:quickNotebookBlock?.icon_size || undefined}}>{quickNotebookBlock?.icon || '📝'}</span>
                      {quickNotebookBlock?.title || 'Gider / Kayıt Ekle'}
                    </button>

                    <button type="button" style={{ ...cmsBlockStyle(quickSoilBlock), display: quickSoilBlock?.is_visible === false ? 'none' : undefined }} onClick={() => setScreen('soilAnalysisHub')}>
                      <span style={{fontSize:quickSoilBlock?.icon_size || undefined}}>{quickSoilBlock?.icon || '🧪'}</span>
                      {quickSoilBlock?.title || 'Toprak Analizi'}
                    </button>
                  </div>
                </section>

                <section className="tp-home-tarlalarim-shortcut" style={{ ...cmsBlockStyle(fieldsShortcutBlock), order: fieldsShortcutBlock?.position ?? 36, display: fieldsShortcutBlock?.is_visible === false ? 'none' : undefined }}>
                  <div>
                    <span className="icon" style={{fontSize:fieldsShortcutBlock?.icon_size || undefined}}>{fieldsShortcutBlock?.icon || '🌾'}</span>
                    <span>
                      <strong>{fieldsShortcutBlock?.title || 'Tarlalarım'}</strong>
                      <small>
                        {realFields.length} kayıtlı tarlanın tamamını görüntüle.
                      </small>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .querySelector('.fieldsSection')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    {fieldsShortcutBlock?.button_text || 'Tümünü Gör →'}
                  </button>
                </section>

                <section className="statusCard" style={{ ...cmsBlockStyle(statusSummaryBlock), order: statusSummaryBlock?.position ?? 37, display: statusSummaryBlock?.is_visible === false ? 'none' : undefined }}>
                  <div className="legend">
                    <div>
                      <span className="dot green" />
                      <strong>{statusGoodBlock?.title || 'İyi'}</strong>
                      <small>{statusGoodBlock?.subtitle || statusGoodBlock?.description || 'Her şey yolunda'}</small>
                    </div>

                    <div>
                      <span className="dot yellow" />
                      <strong>{statusCheckBlock?.title || 'Kontrol Et'}</strong>
                      <small>{statusCheckBlock?.subtitle || statusCheckBlock?.description || 'Kontrol öneriliyor'}</small>
                    </div>

                    <div>
                      <span className="dot red" />
                      <strong>{statusUrgentBlock?.title || 'İlgilen'}</strong>
                      <small>{statusUrgentBlock?.subtitle || statusUrgentBlock?.description || 'Öncelikli durum'}</small>
                    </div>
                  </div>

                  <div className="statusNumbers">
                    <div>
                      <strong className="greenText">{goodFieldCount}</strong>
                      <span>İyi durumda</span>
                    </div>

                    <div>
                      <strong className="yellowText">{checkFieldCount}</strong>
                      <span>Kontrol öneriliyor</span>
                    </div>

                    <div>
                      <strong className="redText">{urgentFieldCount}</strong>
                      <span>Acil durum</span>
                    </div>
                  </div>
                </section>
              </>
            );
          })()}

          <section className="fieldsSection" style={{ ...cmsBlockStyle(cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')), order: cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')?.position ?? 4, display: cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')?.is_visible === false ? 'none' : undefined }}>
            <div className="sectionHeader">
              <div>
                <h2>{cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')?.title || 'Tarlalarım'}</h2>
                <p>
                  {cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')?.subtitle || `${realFields.length} kayıtlı tarlan bulunuyor.`}
                </p>
              </div>

              <button className="textButton" onClick={openAddField}>{cmsBlocks.find((item) => item.page_key === 'home' && item.block_key === 'fields')?.button_text || '+ Tarla Ekle'}</button>
            </div>

            {fieldsLoading && <div className="tp-fields-loading">Tarlaların yükleniyor...</div>}

            {(realFields.length === 0 && demoVisible ? [demoField] : realFields).map((field) => {
                const info = statusInfo[field.status];
                const isOpen = openField === field.id;
                const quickView = getFieldQuickView(field.id);
                const weatherState = fieldWeather[String(field.id)] ?? {
                  status: 'idle',
                  forecast: [],
                };
                const todayWeather = weatherState.forecast[0];
                const statusTone =
                  field.status === 'good'
                    ? 'good'
                    : field.status === 'check'
                      ? 'check'
                      : 'urgent';

                const recommendation =
                  field.status === 'good'
                    ? 'Mevcut görünüm iyi. Planlı kontrolleri sürdür; değişim gördüğünde saha kaydı ekle.'
                    : field.status === 'check'
                      ? 'Bu tarlayı yakından takip et. Sulama, besleme ve saha kontrol zamanını gözden geçir.'
                      : 'Tarlada gözlem yap. Sulama, besleme ve olası hastalık belirtilerini öncelikli değerlendir.';

                return (
                  <div
                    className={`fieldCard tp-premium-field-card tp-field-tone-${statusTone}`}
                    key={field.id}
                  >
                    <div className="tp-premium-field-head">
                      <button
                        type="button"
                        className="tp-premium-field-identity"
                        onClick={() => setOpenField(isOpen ? null : field.id)}
                      >
                        <div className="tp-premium-crop-icon">
                          {getCropEmoji(field.crop)}
                        </div>

                        <div className="tp-premium-field-copy">
                          <div className="fieldTitleRow">
                            {field.demo && (
                              <span className="demoBadge">ÖRNEK</span>
                            )}
                            <h3>{field.name}</h3>
                          </div>

                          <p className="tp-premium-parcel">
                            <strong>{field.ada} Ada</strong>
                            <span>•</span>
                            <strong>{field.parsel} Parsel</strong>
                          </p>

                          <p className="tp-premium-meta">
                            {field.area.toLocaleString('tr-TR')} da
                            <span>•</span>
                            {field.crop}
                            <span>•</span>
                            {field.season}
                          </p>
                        </div>
                      </button>

                      <div className="tp-field-shortcuts" aria-label="Tarla kısayolları">
                        <button
                          type="button"
                          className={quickView === 'satellite' ? 'active' : ''}
                          onClick={() => {
                            setFieldQuickView(field.id, 'satellite');
                            setOpenField(field.id);
                          }}
                        >
                          <SatelliteIcon className="tp-shortcut-svg tp-satellite-svg" />
                          <small>Uydu</small>
                        </button>

                        <button
                          type="button"
                          className={quickView === 'weather' ? 'active' : ''}
                          onClick={() => {
                            setFieldQuickView(field.id, 'weather');
                            setOpenField(field.id);
                            void loadFieldWeather(field);
                          }}
                        >
                          <WeatherIcon className="tp-shortcut-svg tp-weather-svg" />
                          <small>Hava Durumu</small>
                        </button>

                        <button
                          type="button"
                          className={quickView === 'check' ? 'active' : ''}
                          onClick={() => {
                            setFieldQuickView(field.id, 'check');
                            setOpenField(field.id);
                          }}
                        >
                          <CameraCheckIcon className="tp-shortcut-svg tp-camera-svg" />
                          <small>Saha Kontrol</small>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="tp-premium-status-button"
                        onClick={() => setOpenField(isOpen ? null : field.id)}
                        aria-label={isOpen ? 'Tarla kartını kapat' : 'Tarla kartını aç'}
                      >
                        <span
                          className="tp-premium-status"
                          style={{ color: info.color }}
                        >
                          <i style={{ backgroundColor: info.color }} />
                          {info.label}
                        </span>
                        <span className="chevron">{isOpen ? '⌃' : '⌄'}</span>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="tp-premium-field-body">
                        <div className="tp-premium-visual">
                          {quickView === 'satellite' && (
                            <div className="tp-premium-fieldmap-shell">
                              <FieldMap
                                initialCenter={[
                                  field.parcelCentroidLng ??
                                    field.longitude ??
                                    (field.demo ? 32.8597 : 35.2433),
                                  field.parcelCentroidLat ??
                                    field.latitude ??
                                    (field.demo ? 39.9334 : 38.9637),
                                ]}
                                initialZoom={field.parcelGeometry ? 18 : 12}
                                height={300}
                                parcelGeometry={field.parcelGeometry ?? null}
                                sections={[]}
                                drawEnabled={Boolean(field.parcelGeometry)}
                              />

                              <div className="tp-premium-fieldmap-badge">
                                <SatelliteIcon className="tp-premium-fieldmap-badge-icon" />
                                <span>
                                  {field.parcelGeometry
                                    ? `${field.ada} Ada • ${field.parsel} Parsel`
                                    : field.latitude !== null &&
                                        field.latitude !== undefined &&
                                        field.longitude !== null &&
                                        field.longitude !== undefined
                                      ? 'Tarla konumu'
                                      : field.demo
                                        ? 'Örnek konum'
                                        : 'Parsel geometrisi bekleniyor'}
                                </span>
                              </div>
                            </div>
                          )}

                          {quickView === 'weather' && (
                            <div className="tp-premium-weather tp-live-weather">
                              {weatherState.status === 'loading' && (
                                <div className="tp-weather-state-card">
                                  <span>🌦️</span>
                                  <strong>Hava tahmini hazırlanıyor</strong>
                                  <small>3 farklı kaynaktan güncel veriler karşılaştırılıyor.</small>
                                </div>
                              )}

                              {weatherState.status === 'error' &&
                                weatherState.forecast.length === 0 && (
                                  <div className="tp-weather-state-card">
                                    <span>🌤️</span>
                                    <strong>{weatherState.message ?? 'Hava tahmini güncelleniyor.'}</strong>
                                    <small>
                                      {weatherState.locationLabel ??
                                        'Tarla konumunu kontrol edip tekrar deneyebilirsin.'}
                                    </small>
                                    <button
                                      type="button"
                                      onClick={() => void loadFieldWeather(field)}
                                    >
                                      Tekrar Dene
                                    </button>
                                  </div>
                                )}

                              {todayWeather && (
                                <>
                                  <div className="tp-weather-location">
                                    <span>📍</span>
                                    <small>
                                      {weatherState.locationLabel ??
                                        ([field.district, field.city]
                                          .filter(Boolean)
                                          .join(' / ') ||
                                          'Tarla konumu')}
                                    </small>
                                  </div>

                                  <div className="tp-weather-current">
                                    <span className="tp-weather-big-icon">
                                      {getWeatherIcon(todayWeather.condition)}
                                    </span>
                                    <div>
                                      <strong>
                                        {todayWeather.tempMax !== null
                                          ? `${Math.round(todayWeather.tempMax)}°C`
                                          : '—'}
                                      </strong>
                                      <span>{todayWeather.condition}</span>
                                      <small>
                                        {todayWeather.tempMin !== null
                                          ? `En düşük ${Math.round(todayWeather.tempMin)}°C`
                                          : ''}
                                      </small>
                                    </div>
                                  </div>

                                  <div className="tp-weather-metrics">
                                    <div>
                                      <small>Nem</small>
                                      <strong>
                                        {todayWeather.humidity !== null
                                          ? `%${Math.round(todayWeather.humidity)}`
                                          : '—'}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Rüzgâr</small>
                                      <strong>
                                        {todayWeather.windSpeed !== null
                                          ? `${Math.round(todayWeather.windSpeed)} km/sa`
                                          : '—'}
                                      </strong>
                                    </div>
                                    <div>
                                      <small>Yağış</small>
                                      <strong>
                                        {todayWeather.precipitationProbability !== null
                                          ? `%${Math.round(
                                              todayWeather.precipitationProbability,
                                            )}`
                                          : todayWeather.precipitation !== null
                                            ? `${todayWeather.precipitation.toFixed(1)} mm`
                                            : '—'}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="tp-weather-days">
                                    {weatherState.forecast.map((day, index) => (
                                      <div key={day.date}>
                                        <small>{formatWeatherDay(day.date, index)}</small>
                                        <span>{getWeatherIcon(day.condition)}</span>
                                        <strong>
                                          {day.tempMax !== null
                                            ? `${Math.round(day.tempMax)}°`
                                            : '—'}
                                        </strong>
                                        <em>
                                          {day.tempMin !== null
                                            ? `${Math.round(day.tempMin)}°`
                                            : ''}
                                        </em>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              {weatherState.status === 'idle' && (
                                <div className="tp-weather-state-card">
                                  <span>🌦️</span>
                                  <strong>Tarla hava durumu</strong>
                                  <small>
                                    Güncel 5 günlük tahmini görmek için Hava Durumu
                                    kısayoluna dokun.
                                  </small>
                                </div>
                              )}
                            </div>
                          )}

                          {quickView === 'check' && (
                            <div className="tp-premium-check-panel">
                              <div className="tp-check-hero">📷</div>
                              <div>
                                <span className="tp-panel-eyebrow">SAHA KONTROLÜ</span>
                                <h4>Tarlayı yerinde kontrol et</h4>
                                <p>
                                  Fotoğraf çekerek saha gözlemini kaydedebilir ve AI
                                  ön değerlendirmesi başlatabilirsin.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedField(field);
                                    openAiAnalysisScreen();
                                  }}
                                >
                                  + Yeni Kontrol Başlat
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="tp-premium-insight">
                          {quickView === 'satellite' && (
                            <>
                              <div className="tp-premium-insight-title">
                                <div>
                                  <span className="tp-panel-eyebrow">UYDU GÖRÜNÜMÜ</span>
                                  <h4>Tarla görünümü</h4>
                                  <small>Son görüntü: güncel saha görünümü</small>
                                </div>
                                <span className={`tp-health-dot ${statusTone}`} />
                              </div>

                              <div className="tp-premium-metrics">
                                <div>
                                  <span>🌿</span>
                                  <p>Bitki Sağlığı<strong>{info.label}</strong></p>
                                </div>
                                <div>
                                  <span>💧</span>
                                  <p>Nem Durumu<strong>{field.status === 'urgent' ? 'Düşük' : 'İyi'}</strong></p>
                                </div>
                                <div>
                                  <span>🌡️</span>
                                  <p>Sıcaklık<strong>22°C</strong></p>
                                </div>
                              </div>
                            </>
                          )}

                          {quickView === 'weather' && (
                            <>
                              <div className="tp-premium-insight-title">
                                <div>
                                  <span className="tp-panel-eyebrow">HAVA & RİSK</span>
                                  <h4>Bugünün tarla koşulları</h4>
                                  <small>
                                    {weatherState.status === 'ready'
                                      ? '3 farklı hava kaynağı arka planda karşılaştırılarak hazırlanır.'
                                      : 'Güncel tahmin hazırlanıyor.'}
                                  </small>
                                </div>
                                <span
                                  className={`tp-health-dot ${
                                    (todayWeather?.precipitationProbability ?? 0) >= 70 ||
                                    (todayWeather?.windSpeed ?? 0) >= 30
                                      ? 'check'
                                      : 'good'
                                  }`}
                                />
                              </div>

                              <div className="tp-premium-weather-note">
                                <span>{getWeatherIcon(todayWeather?.condition)}</span>
                                <p>{getWeatherRecommendation(todayWeather)}</p>
                              </div>

                              {todayWeather && (
                                <div className="tp-weather-detail-grid">
                                  <div>
                                    <small>Yağış miktarı</small>
                                    <strong>
                                      {todayWeather.precipitation !== null
                                        ? `${todayWeather.precipitation.toFixed(1)} mm`
                                        : '—'}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Yağış olasılığı</small>
                                    <strong>
                                      {todayWeather.precipitationProbability !== null
                                        ? `%${Math.round(
                                            todayWeather.precipitationProbability,
                                          )}`
                                        : '—'}
                                    </strong>
                                  </div>
                                  <div>
                                    <small>Günlük aralık</small>
                                    <strong>
                                      {todayWeather.tempMin !== null &&
                                      todayWeather.tempMax !== null
                                        ? `${Math.round(todayWeather.tempMin)}° / ${Math.round(
                                            todayWeather.tempMax,
                                          )}°`
                                        : '—'}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {quickView === 'check' && (
                            <>
                              <div className="tp-premium-insight-title">
                                <div>
                                  <span className="tp-panel-eyebrow">KONTROL KAYDI</span>
                                  <h4>Son saha gözlemleri</h4>
                                  <small>
                                    {field.demo
                                      ? 'Örnek tarlada son kontrol 12 gün önce yapıldı.'
                                      : 'Yeni saha kaydı ekleyerek geçmiş oluşturabilirsin.'}
                                  </small>
                                </div>
                                <span className={`tp-health-dot ${statusTone}`} />
                              </div>

                              <div className="tp-premium-weather-note">
                                <span>📸</span>
                                <p>
                                  Fotoğraf, not ve AI analizi ile tarla durumunu tek
                                  yerde takip et.
                                </p>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            className={`tp-premium-detail-button ${statusTone}`}
                            onClick={() => openFieldDetail(field)}
                          >
                            <ClipboardIcon className="tp-detail-svg" />
                            Tarla Detayları
                            <b>›</b>
                          </button>

                          <div className={`tp-premium-recommendation ${statusTone}`}>
                            <span>🌿</span>
                            <div>
                              <strong>TarlaPusula önerisi</strong>
                              <p>{recommendation}</p>
                            </div>
                          </div>

                          {field.demo && (
                            <button
                              className="removeDemo tp-premium-remove-demo"
                              onClick={() => setDemoVisible(false)}
                            >
                              Örnek tarlayı kaldır
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {!demoVisible && realFields.length === 0 && (
              <div className="emptyState">
                <div className="emptyIcon">🌱</div>

                <h3>Şimdi sıra senin tarlalarında</h3>

                <p>
                  Ada ve parsel bilgilerinle ilk tarlanı ekleyerek
                  başlayabilirsin.
                </p>

                <button className="primaryLarge" onClick={openAddField}>
                  + İlk Tarlamı Ekle
                </button>
              </div>
            )}
          </section>

          {realFields.length === 0 && (
            <section className="firstFieldCard">
              <div>
                <span className="plusCircle">+</span>
              </div>

              <div className="firstFieldText">
                <strong>Şimdi kendi tarlanı ekle</strong>
                <span>
                  Ada ve parsel bilgilerinle birkaç adımda başlayabilirsin.
                </span>
              </div>

              <button onClick={openAddField}>+ İlk Tarlamı Ekle</button>
            </section>
          )}
        </main>

        <nav className="bottomNav">
          <button className="active">
            <span>⌂</span>
            Ana Sayfa
          </button>

          <button
            onClick={() =>
              document
                .querySelector('.fieldsSection')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <span>🌾</span>
            Tarlalarım
          </button>

          <button className="addButton" onClick={openAiAnalysisScreen}>
            <span>✦</span>
            AI Analiz
          </button>

          <button onClick={openCalendarScreen}>
            <span>▣</span>
            Takvim
          </button>

          <button>
            <span>•••</span>
            Daha Fazla
          </button>
        </nav>
      </div>
    </>
  );
}

const onboardingStyles = `
.tp-onboarding-page {
  min-height: 100vh;
  background: #f7f8f6;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #1d2a22;
}

.tp-welcome-shell,
.tp-form-shell,
.tp-question-shell,
.tp-ready-shell {
  width: min(100%, 480px);
  min-height: 680px;
  background: #ffffff;
  border: 1px solid #e4e9e3;
  border-radius: 32px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(26, 56, 35, 0.08);
  position: relative;
  overflow: hidden;
}

.tp-welcome-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.tp-logo-mark {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: #f2f7ee;
  border: 2px solid #d8e6d7;
  display: grid;
  place-items: center;
  font-size: 48px;
  margin-top: 28px;
}

.tp-logo-title {
  margin: 20px 0 6px;
  font-size: 34px;
  letter-spacing: 1px;
  color: #163d28;
}

.tp-logo-title span {
  color: #65a83c;
}

.tp-welcome-tagline {
  max-width: 310px;
  color: #647069;
  line-height: 1.55;
  margin: 0;
}

.tp-landscape {
  width: calc(100% + 64px);
  height: 230px;
  margin-top: 38px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    to bottom,
    #fbfcf8 0%,
    #f0f5e9 100%
  );
}

.tp-sun {
  position: absolute;
  right: 65px;
  top: 20px;
  font-size: 38px;
}

.tp-hill {
  position: absolute;
  width: 130%;
  height: 160px;
  border-radius: 50%;
}

.tp-hill-one {
  left: -50%;
  bottom: -70px;
  background: #dfead3;
}

.tp-hill-two {
  right: -55%;
  bottom: -85px;
  background: #cddfbd;
}

.tp-field-lines {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 105px;
  display: flex;
  justify-content: center;
  gap: 20px;
  overflow: hidden;
}

.tp-field-lines span {
  width: 28px;
  height: 150px;
  border-left: 8px solid #95b96e;
  border-radius: 50%;
  transform: rotate(20deg);
}

.tp-welcome-actions {
  width: 100%;
  margin-top: 25px;
  display: grid;
  gap: 10px;
}

.tp-main-button,
.tp-secondary-button,
.tp-provider-button {
  width: 100%;
  min-height: 52px;
  border-radius: 13px;
  font-weight: 800;
  font-size: 15px;
}

.tp-main-button {
  border: 1px solid #226b39;
  background: #226b39;
  color: white;
}

.tp-main-button:hover {
  background: #19592f;
}

.tp-secondary-button {
  border: 1px solid #d8dfd7;
  background: #ffffff;
  color: #34443a;
}

.tp-policy {
  margin: 20px 20px 0;
  color: #8a948d;
  font-size: 11px;
  line-height: 1.5;
}

.tp-form-shell h1,
.tp-question-shell h1,
.tp-ready-shell h1 {
  color: #18261e;
}

.tp-back-button {
  border: 0;
  background: transparent;
  font-size: 26px;
  color: #24352b;
  padding: 4px;
}

.tp-small-logo,
.tp-register-icon {
  width: 78px;
  height: 78px;
  border-radius: 22px;
  background: #f2f7ee;
  display: grid;
  place-items: center;
  font-size: 40px;
  margin: 36px auto 22px;
}

.tp-form-shell h1 {
  text-align: center;
  margin-bottom: 8px;
}

.tp-form-subtitle {
  text-align: center;
  color: #6f7972;
  margin-top: 0;
  margin-bottom: 30px;
}

.tp-login-buttons {
  display: grid;
  gap: 12px;
}

.tp-provider-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #d9dfd8;
  background: white;
  color: #26352c;
}

.tp-provider-button > span {
  width: 22px;
  font-weight: 900;
  font-size: 20px;
}

.tp-google {
  border-color: #ccd8ca;
}

.tp-email-button {
  color: #226b39;
  border-color: #9fc3a4;
}

.tp-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #98a099;
  padding: 5px 0;
}

.tp-divider span {
  flex: 1;
  height: 1px;
  background: #e5e9e4;
}

.tp-text-login {
  min-height: 48px;
  border-radius: 12px;
  background: #f6f7f5;
  border: 1px solid #e5e8e4;
  font-weight: 700;
  color: #46534b;
}

.tp-guest-link {
  width: 100%;
  border: 0;
  background: transparent;
  color: #246b3a;
  font-weight: 700;
  margin-top: 22px;
}

.tp-trust-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 40px;
}

.tp-trust-grid > div {
  padding: 14px;
  border-radius: 13px;
  background: #f7f9f6;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-trust-grid strong {
  font-size: 13px;
}

.tp-trust-grid span {
  font-size: 11px;
  color: #78827b;
}

.tp-register-form {
  display: grid;
  gap: 18px;
}

.tp-register-form label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-size: 13px;
  font-weight: 700;
}

.tp-register-form input {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: white;
  color: #1d2a22;
  font-size: 16px;
  outline: none;
}

.tp-register-form input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-register-form small {
  color: #8a948d;
  font-weight: 400;
  line-height: 1.4;
}

.tp-password-info {
  font-size: 12px;
  color: #4f7959;
}

.tp-center-text {
  text-align: center;
  color: #7b867f;
  font-size: 12px;
  margin-top: 24px;
}

.tp-center-text button {
  border: 0;
  background: transparent;
  color: #226b39;
  font-weight: 800;
}

.tp-question-shell {
  display: flex;
  flex-direction: column;
  max-height: 900px;
}

.tp-question-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-question-top strong {
  font-size: 13px;
  color: #6f7972;
}

.tp-progress {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
  margin: 22px 0 34px;
}

.tp-progress span {
  height: 5px;
  background: #e4e8e3;
  border-radius: 99px;
}

.tp-progress span.tp-progress-active {
  background: #347846;
}

.tp-question-copy {
  margin-bottom: 22px;
}

.tp-question-label {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 1.2px;
  color: #37804a;
  font-weight: 900;
}

.tp-question-copy h1 {
  font-size: 25px;
  line-height: 1.25;
  margin: 0 0 8px;
}

.tp-question-copy > p:last-child {
  color: #78827b;
  margin: 0;
  font-size: 13px;
}

.tp-options {
  display: grid;
  gap: 9px;
  flex: 1;
  overflow-y: auto;
  padding-right: 3px;
}

.tp-option {
  min-height: 58px;
  display: grid;
  grid-template-columns: 42px 1fr 26px;
  align-items: center;
  text-align: left;
  border: 1px solid #dce2db;
  border-radius: 13px;
  background: white;
  color: #26352c;
  padding: 8px 13px;
  font-weight: 700;
}

.tp-option.selected {
  border: 1.5px solid #4a9658;
  background: #f3f9f2;
  color: #1e6334;
}

.tp-option-icon {
  font-size: 24px;
}

.tp-option-check {
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: #e7f2e5;
  display: grid;
  place-items: center;
  color: #23713a;
  font-weight: 900;
}

.tp-other-product-box {
  padding: 16px;
  border: 1px solid #cddfcd;
  border-radius: 14px;
  background: #f8fbf7;
  display: grid;
  gap: 7px;
}

.tp-other-product-box label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-weight: 800;
  font-size: 13px;
}

.tp-other-product-box input {
  width: 100%;
  min-height: 48px;
  border-radius: 11px;
  border: 1px solid #ccd8cb;
  padding: 0 13px;
  font-size: 16px;
  background: white;
  color: #1d2a22;
  outline: none;
}

.tp-other-product-box input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-other-product-box small {
  color: #77827a;
  font-size: 11px;
}

.tp-question-actions {
  display: grid;
  grid-template-columns: 1fr 130px;
  gap: 12px;
  align-items: center;
  margin-top: 25px;
}

.tp-skip-button {
  border: 0;
  background: transparent;
  text-align: left;
  color: #758078;
  font-weight: 700;
}

.tp-next-button {
  min-height: 48px;
}

.tp-ready-shell {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tp-ready-circle {
  width: 165px;
  height: 165px;
  margin-top: 50px;
  border-radius: 50%;
  background:
    radial-gradient(
      circle at 50% 35%,
      #f9fff5 0%,
      #dfeeda 70%
    );
  display: grid;
  place-items: center;
  position: relative;
}

.tp-ready-circle span {
  width: 65px;
  height: 65px;
  display: grid;
  place-items: center;
  background: #337b46;
  color: white;
  font-size: 35px;
  border-radius: 50%;
}

.tp-ready-shell h1 {
  margin: 25px 0 7px;
  font-size: 30px;
}

.tp-ready-shell > p {
  margin: 0;
  color: #737e76;
}

.tp-profile-progress-card {
  width: 100%;
  margin-top: 30px;
  background: #f7f9f6;
  border-radius: 14px;
  padding: 18px;
  text-align: left;
}

.tp-profile-progress-card > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-profile-progress-card span {
  color: #748078;
  font-size: 12px;
}

.tp-profile-bar {
  width: 100%;
  height: 8px;
  margin-top: 14px;
  border-radius: 99px;
  background: #e4e8e3;
  overflow: hidden;
}

.tp-profile-bar span {
  display: block;
  width: 30%;
  height: 100%;
  background: #3e8c4f;
}

.tp-ready-benefits {
  width: 100%;
  display: grid;
  gap: 9px;
  margin: 25px 0;
  text-align: left;
}

.tp-ready-benefits > div {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e4e8e3;
  border-radius: 12px;
}

.tp-ready-benefits span {
  font-size: 23px;
}

.tp-ready-benefits p {
  margin: 0;
  font-size: 13px;
  color: #56625a;
}


.tp-auth-message {
  width: 100%;
  border: 1px solid #f0d3c7;
  background: #fff7f3;
  color: #8b4637;
  border-radius: 11px;
  padding: 11px 12px;
  font-size: 12px;
  line-height: 1.45;
}

.tp-auth-message-info {
  border-color: #d5e1ef;
  background: #f4f8fd;
  color: #46627a;
  margin-bottom: 18px;
}

.tp-verification-shell {
  text-align: center;
}

.tp-verification-icon {
  width: 96px;
  height: 96px;
  margin: 70px auto 20px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  background: #f2f7ee;
  font-size: 48px;
}

.tp-verification-address {
  margin: 0 auto 22px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #f6f7f5;
  color: #34443a;
  font-weight: 800;
  font-size: 13px;
  word-break: break-all;
}

.tp-verification-back {
  margin-top: 10px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}


.tp-field-form-shell {
  width: min(100%, 560px);
  min-height: 680px;
  background: #ffffff;
  border: 1px solid #e4e9e3;
  border-radius: 32px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(26, 56, 35, 0.08);
}

.tp-field-form-heading {
  text-align: center;
  margin-bottom: 24px;
}

.tp-field-form-heading .tp-register-icon {
  margin: 18px auto 16px;
}

.tp-field-form-heading h1 {
  margin: 0 0 8px;
  color: #18261e;
  font-size: 28px;
}

.tp-field-form-heading p {
  margin: 0 auto;
  max-width: 430px;
  color: #78827b;
  font-size: 13px;
  line-height: 1.55;
}

.tp-field-form {
  display: grid;
  gap: 14px;
}

.tp-field-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tp-field-form label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-size: 13px;
  font-weight: 800;
}

.tp-field-form input {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: #ffffff;
  color: #1d2a22;
  font-size: 15px;
  outline: none;
}

.tp-field-form input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-field-note {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7f9f6;
  color: #69756d;
  font-size: 12px;
  line-height: 1.45;
}

.tp-field-detail-page {
  min-height: 100vh;
  background: #f6f8f5;
  color: #1d2a22;
  padding-bottom: 92px;
}

.tp-field-detail-header {
  min-height: 78px;
  background: #ffffff;
  border-bottom: 1px solid #e7ebe6;
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.tp-field-detail-header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-detail-header span {
  color: #7a857e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-field-detail-header strong {
  color: #173923;
  font-size: 17px;
}

.tp-field-detail-back,
.tp-field-detail-more {
  width: 40px;
  height: 40px;
  border: 1px solid #e1e7e0;
  background: #ffffff;
  border-radius: 12px;
  color: #23352a;
  font-size: 20px;
}

.tp-field-detail-content {
  width: min(100% - 32px, 920px);
  margin: 24px auto 0;
  display: grid;
  gap: 18px;
}

.tp-field-hero-card,
.tp-field-detail-section {
  background: #ffffff;
  border: 1px solid #e2e8e1;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(37, 62, 44, 0.04);
}

.tp-field-hero-card {
  padding: 22px;
}

.tp-field-hero-top {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  gap: 14px;
  align-items: start;
}

.tp-field-hero-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #f0f6ec;
  font-size: 30px;
}

.tp-field-hero-copy {
  min-width: 0;
}

.tp-field-hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tp-field-hero-copy h1 {
  margin: 0;
  font-size: 23px;
  color: #17261d;
}

.tp-field-hero-copy p {
  margin: 7px 0 4px;
  font-weight: 800;
  color: #405046;
}

.tp-field-hero-copy > span {
  color: #7b867e;
  font-size: 13px;
}

.tp-field-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid #e9ede8;
  margin-top: 20px;
  padding-top: 18px;
}

.tp-field-hero-stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
  border-right: 1px solid #e8ece7;
}

.tp-field-hero-stats > div:first-child {
  padding-left: 0;
}

.tp-field-hero-stats > div:last-child {
  border-right: 0;
}

.tp-field-hero-stats span {
  color: #839087;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 800;
}

.tp-field-hero-stats strong {
  font-size: 16px;
  color: #21352a;
}

.tp-field-detail-section {
  padding: 20px;
}

.tp-field-detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.tp-field-detail-section-head h2 {
  margin: 3px 0 0;
  font-size: 19px;
  color: #1d2d23;
}

.tp-field-detail-kicker {
  font-size: 10px;
  letter-spacing: 1px;
  font-weight: 900;
  color: #3a7c4b;
}

.tp-field-detail-fresh {
  font-size: 11px;
  color: #2f7d32;
  background: #edf7ed;
  border-radius: 999px;
  padding: 5px 9px;
  font-weight: 800;
}

.tp-field-detail-status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.tp-field-detail-status-grid article {
  border: 1px solid #e6ebe5;
  border-radius: 15px;
  padding: 14px;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  background: #fbfcfa;
}

.tp-detail-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #eef5eb;
  font-size: 19px;
}

.tp-field-detail-status-grid strong {
  color: #26382d;
}

.tp-field-detail-status-grid p,
.tp-field-detail-map-copy p,
.tp-field-production-main p {
  margin: 5px 0 0;
  color: #748078;
  line-height: 1.45;
  font-size: 12px;
}

.tp-field-detail-map-card {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 18px;
  align-items: center;
  border: 1px solid #e1e8df;
  border-radius: 16px;
  padding: 14px;
  background: #f8faf6;
}

.tp-field-detail-map-shape {
  height: 120px;
  border-radius: 14px;
  background:
    linear-gradient(30deg, transparent 48%, rgba(96, 138, 75, .08) 49%, rgba(96, 138, 75, .08) 51%, transparent 52%),
    #edf4e8;
  display: grid;
  place-items: center;
}

.tp-field-detail-map-shape > div {
  width: 76px;
  height: 88px;
  border: 2px solid #688f67;
  border-radius: 28px 20px 32px 20px;
  background: rgba(134, 177, 116, .28);
  transform: rotate(-6deg);
}

.tp-field-detail-map-copy strong {
  color: #294133;
}

.tp-field-detail-map-card > button,
.tp-field-production-actions button {
  min-height: 42px;
  border-radius: 11px;
  border: 1px solid #cfdccf;
  background: #ffffff;
  color: #2d653b;
  font-weight: 800;
  padding: 0 14px;
}

.tp-field-production-card {
  border: 1px solid #e2e8e1;
  border-radius: 16px;
  padding: 16px;
}

.tp-field-production-main {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
  align-items: center;
}

.tp-field-production-main > div:last-child {
  display: flex;
  flex-direction: column;
}

.tp-field-production-main span {
  color: #7f8b82;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.tp-field-production-main strong {
  color: #22352a;
  font-size: 18px;
  margin-top: 2px;
}

.tp-field-production-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.tp-field-choice-label {
  display: block;
  color: #34443a;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 7px;
}

.tp-cycle-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tp-cycle-choice button {
  min-height: 72px;
  border: 1px solid #d9e1d8;
  border-radius: 13px;
  background: #ffffff;
  color: #34443a;
  text-align: left;
  padding: 12px 14px;
  font-weight: 900;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.tp-cycle-choice button small {
  color: #7c877f;
  font-weight: 500;
  line-height: 1.3;
}

.tp-cycle-choice button.active {
  border-color: #4e925c;
  background: #f2f8f0;
  color: #24643a;
  box-shadow: 0 0 0 2px rgba(78, 146, 92, .08);
}

.tp-field-form select,
.tp-production-profile-form select {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: #ffffff;
  color: #1d2a22;
  font-size: 14px;
  outline: none;
}

.tp-field-note-soft {
  background: #f6faf4;
  border-color: #dbe7d8;
}

.tp-production-profile-summary {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: stretch;
}

.tp-production-profile-summary > div {
  border: 1px solid #e3e8e2;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fbfcfa;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-production-profile-summary span {
  color: #849087;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-production-profile-summary strong {
  color: #2b3f32;
  font-size: 13px;
}

.tp-production-profile-summary > button {
  border: 1px solid #d2ddd1;
  background: #ffffff;
  color: #306b3e;
  border-radius: 12px;
  padding: 0 12px;
  font-weight: 800;
}

.tp-production-profile-form {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
  display: grid;
  gap: 12px;
}

.tp-production-profile-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  grid-column: 1 / -1;
}

.tp-production-profile-title > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-production-profile-title span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-production-profile-title strong {
  color: #25392d;
}

.tp-production-profile-title > button {
  width: 30px;
  height: 30px;
  border: 1px solid #d9e2d8;
  border-radius: 9px;
  background: #ffffff;
  color: #66736a;
  font-size: 20px;
}

.tp-production-profile-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tp-production-profile-fields label,
.tp-history-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-production-profile-fields input,
.tp-history-form input,
.tp-history-form textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-history-form textarea {
  min-height: 82px;
  padding-top: 10px;
  resize: vertical;
}

.tp-production-profile-save {
  min-height: 44px;
  border: 1px solid #27703c;
  border-radius: 11px;
  background: #27703c;
  color: #ffffff;
  font-weight: 900;
}

.tp-production-history-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e8ece7;
}

.tp-production-history-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;
}

.tp-production-history-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-production-history-head span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-production-history-head strong {
  color: #26382d;
  font-size: 15px;
}

.tp-production-history-head small {
  color: #52725a;
  background: #f0f6ee;
  border-radius: 999px;
  padding: 6px 9px;
  font-weight: 800;
}

.tp-yield-history-list,
.tp-season-history-list {
  display: grid;
  gap: 9px;
}

.tp-yield-history-card,
.tp-season-history-card {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 13px;
  border: 1px solid #e2e8e1;
  border-radius: 13px;
  background: #fbfcfa;
}

.tp-yield-year {
  width: 58px;
  height: 58px;
  border-radius: 13px;
  background: #edf5ea;
  display: grid;
  place-items: center;
  color: #2d733e;
  font-weight: 900;
}

.tp-yield-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tp-yield-main strong {
  color: #25392d;
  font-size: 15px;
}

.tp-yield-main span,
.tp-yield-main small {
  color: #748078;
  font-size: 11px;
}

.tp-yield-main p {
  margin: 3px 0 0;
  color: #637067;
  font-size: 12px;
  line-height: 1.4;
}

.tp-yield-history-card > button,
.tp-season-history-card > button {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 800;
}

.tp-history-form {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
}

.tp-history-form-full {
  grid-column: 1 / -1;
}

.tp-field-sections-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e8ece7;
}

.tp-field-sections-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.tp-field-sections-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-sections-head span {
  color: #7a867e;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.tp-field-sections-head strong {
  color: #26382d;
  font-size: 15px;
}

.tp-field-sections-head small {
  color: #4d7258;
  background: #f0f6ee;
  border-radius: 999px;
  padding: 6px 9px;
  font-weight: 800;
  white-space: nowrap;
}

.tp-section-loading {
  padding: 16px;
  border-radius: 12px;
  background: #f8faf7;
  color: #738078;
  font-size: 13px;
}

.tp-field-sections-list {
  display: grid;
  gap: 9px;
}

.tp-field-section-card {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e2e8e1;
  border-radius: 13px;
  background: #fbfcfa;
}

.tp-field-section-number {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #edf5ea;
  color: #2d733e;
  font-weight: 900;
}

.tp-field-section-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-section-copy strong {
  color: #26382d;
}

.tp-field-section-copy span {
  color: #748078;
  font-size: 12px;
}

.tp-field-section-area {
  display: flex;
  align-items: center;
  gap: 9px;
}

.tp-field-section-area strong {
  color: #395543;
  font-size: 13px;
  white-space: nowrap;
}

.tp-field-section-area button {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 800;
}

.tp-field-sections-empty {
  padding: 18px;
  border: 1px dashed #ccd9cb;
  border-radius: 14px;
  background: #f9fbf8;
  text-align: center;
}

.tp-field-sections-empty > div {
  font-size: 28px;
  margin-bottom: 6px;
}

.tp-field-sections-empty strong {
  display: block;
  color: #294133;
}

.tp-field-sections-empty p {
  max-width: 520px;
  margin: 6px auto 0;
  color: #77827a;
  line-height: 1.45;
  font-size: 12px;
}

.tp-field-section-form {
  margin-top: 14px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  border: 1px solid #cfddcf;
  border-radius: 15px;
  background: #f7faf6;
}

.tp-field-section-form-title {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.tp-field-section-form-title > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-field-section-form-title span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-field-section-form-title strong {
  color: #25392d;
  font-size: 16px;
}

.tp-field-section-form-title > button {
  width: 30px;
  height: 30px;
  border: 1px solid #d9e2d8;
  border-radius: 9px;
  background: #ffffff;
  color: #66736a;
  font-size: 20px;
}

.tp-field-section-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-field-section-form input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-field-section-form input:focus {
  border-color: #5d9368;
  box-shadow: 0 0 0 3px rgba(77, 139, 92, .09);
}

.tp-field-section-area-note,
.tp-field-section-message {
  grid-column: 1 / -1;
  font-size: 11px;
  line-height: 1.45;
}

.tp-field-section-area-note {
  color: #748078;
}

.tp-field-section-message {
  color: #a7473f;
  background: #fff4f2;
  border: 1px solid #f0d2cd;
  border-radius: 10px;
  padding: 9px 11px;
}

.tp-field-section-save {
  grid-column: 1 / -1;
  min-height: 46px;
  border: 1px solid #27703c;
  border-radius: 11px;
  background: #27703c;
  color: #ffffff;
  font-weight: 900;
}

.tp-field-section-save:disabled {
  opacity: .65;
}

.tp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(21, 34, 25, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: tpModalFade .18s ease-out;
}

.tp-modal-card {
  width: min(100%, 620px);
  max-height: min(88vh, 820px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #ffffff;
  border: 1px solid rgba(225, 232, 224, .95);
  border-radius: 22px;
  box-shadow:
    0 24px 80px rgba(20, 45, 28, .22),
    0 4px 18px rgba(20, 45, 28, .08);
  padding: 20px;
  animation: tpModalRise .22s cubic-bezier(.2,.8,.2,1);
}

.tp-modal-card-medium {
  width: min(100%, 600px);
}

.tp-modal-card-large {
  width: min(100%, 760px);
}

.tp-modal-form {
  margin: 0 !important;
  border: 0 !important;
  background: #ffffff !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.tp-modal-form .tp-production-profile-title,
.tp-modal-form .tp-field-section-form-title {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #ffffff;
  padding-bottom: 12px;
  border-bottom: 1px solid #edf0ec;
  margin-bottom: 4px;
}

.tp-modal-form .tp-production-profile-title > button,
.tp-modal-form .tp-field-section-form-title > button {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  font-size: 21px;
}

.tp-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid #edf0ec;
}

.tp-modal-cancel,
.tp-modal-primary {
  min-height: 44px;
  border-radius: 11px;
  padding: 0 18px;
  font-weight: 900;
}

.tp-modal-cancel {
  border: 1px solid #d7dfd6;
  background: #ffffff;
  color: #56635a;
}

.tp-modal-primary {
  min-width: 128px;
}

@keyframes tpModalFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tpModalRise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tp-activity-add-top {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #cfdccf;
  border-radius: 10px;
  background: #ffffff;
  color: #2d6b3d;
  font-weight: 900;
}

.tp-activity-list {
  display: grid;
  gap: 9px;
}

.tp-activity-card {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 11px;
  align-items: start;
  border: 1px solid #e2e8e1;
  border-radius: 14px;
  background: #fbfcfa;
  padding: 13px;
}

.tp-activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: #edf5ea;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.tp-activity-copy {
  min-width: 0;
}

.tp-activity-title-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.tp-activity-title-row strong {
  color: #25392d;
}

.tp-activity-title-row span {
  color: #839087;
  font-size: 11px;
  white-space: nowrap;
}

.tp-activity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 5px;
}

.tp-activity-meta span {
  background: #f0f4ee;
  color: #647269;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 700;
}

.tp-activity-copy p {
  margin: 7px 0 0;
  color: #67746b;
  font-size: 12px;
  line-height: 1.45;
}

.tp-activity-delete {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 900;
}

.tp-activity-form {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 11px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
}

.tp-activity-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-activity-form input,
.tp-activity-form select,
.tp-activity-form textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-activity-form textarea {
  min-height: 86px;
  padding-top: 10px;
  resize: vertical;
}

.tp-activity-full {
  grid-column: 1 / -1;
}

.tp-dose-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.tp-dose-choice button {
  min-height: 64px;
  border: 1px solid #d8e0d7;
  border-radius: 12px;
  background: #ffffff;
  color: #34443a;
  padding: 10px 12px;
  text-align: left;
  font-weight: 900;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.tp-dose-choice button small {
  color: #7b877f;
  font-weight: 500;
}

.tp-dose-choice button.active {
  border-color: #4e925c;
  background: #f1f7ef;
  color: #286b3b;
  box-shadow: 0 0 0 2px rgba(78, 146, 92, .08);
}

.tp-smart-calc {
  border: 1px solid #d8e6d5;
  border-radius: 12px;
  background: #f4f9f2;
  padding: 11px 13px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  align-items: center;
}

.tp-smart-calc span {
  grid-row: 1 / 3;
  color: #3f7a4c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-smart-calc strong {
  color: #245f35;
  font-size: 14px;
}

.tp-smart-calc small {
  color: #718078;
  font-size: 10px;
}

.tp-activity-photo-field {
  border: 1px solid #dbe4da;
  border-radius: 13px;
  background: #f8faf7;
  padding: 12px;
}

.tp-activity-photo-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.tp-activity-photo-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-activity-photo-head span {
  color: #3f7a4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .7px;
}

.tp-activity-photo-head strong {
  color: #2a3f31;
  font-size: 13px;
}

.tp-activity-photo-head > button {
  border: 0;
  background: transparent;
  color: #af4d45;
  font-size: 11px;
  font-weight: 900;
}

.tp-activity-photo-picker {
  min-height: 112px;
  border: 1.5px dashed #bfcfbd;
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  display: flex !important;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex-direction: column;
  gap: 4px !important;
  padding: 14px;
}

.tp-activity-photo-picker > span {
  font-size: 26px;
}

.tp-activity-photo-picker > strong {
  color: #2f6b3d;
  font-size: 13px;
}

.tp-activity-photo-picker > small {
  color: #7c8880;
  font-weight: 500;
  line-height: 1.35;
}

.tp-activity-photo-picker input,
.tp-activity-photo-preview input {
  display: none;
}

.tp-activity-photo-preview {
  display: grid;
  grid-template-columns: 116px 1fr;
  gap: 12px;
  align-items: center;
}

.tp-activity-photo-preview img {
  width: 116px;
  height: 90px;
  object-fit: cover;
  border-radius: 11px;
  border: 1px solid #dce5db;
  background: #eef3ec;
}

.tp-activity-photo-preview label {
  min-height: 44px;
  border: 1px solid #cfdccf;
  border-radius: 10px;
  background: #ffffff;
  color: #2d6b3d;
  display: grid !important;
  place-items: center;
  cursor: pointer;
  font-weight: 900 !important;
}

.tp-calendar-page{min-height:100vh;background:#f5f7f4;color:#1f2f24;padding-bottom:90px}.tp-calendar-header{min-height:68px;padding:10px 22px;border-bottom:1px solid #e4e9e3;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);display:grid;grid-template-columns:42px 1fr 42px;gap:10px;align-items:center;position:sticky;top:0;z-index:20}.tp-calendar-header>button{width:38px;height:38px;border:1px solid #dce4db;border-radius:11px;background:#fff;color:#33503b;font-size:18px}.tp-calendar-header>div{display:flex;flex-direction:column;gap:2px}.tp-calendar-header span,.tp-calendar-toolbar span,.tp-calendar-group-title span{color:#447d50;font-size:9px;font-weight:900;letter-spacing:.8px}.tp-calendar-header strong{color:#203126;font-size:15px}.tp-calendar-header .tp-calendar-header-add{background:#2d733e;color:#fff;border-color:#2d733e;font-size:22px}.tp-calendar-content{width:min(100%,900px);margin:0 auto;padding:22px}.tp-calendar-hero{border:1px solid #dfe6de;border-radius:20px;background:#fff;padding:22px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;box-shadow:0 8px 26px rgba(33,57,39,.05)}.tp-calendar-hero>div:first-child>span{color:#407b4d;font-size:9px;font-weight:900;letter-spacing:.9px}.tp-calendar-hero h1{margin:5px 0 6px;color:#1f3225;font-size:24px;line-height:1.15}.tp-calendar-hero p{margin:0;max-width:570px;color:#748078;font-size:11px;line-height:1.5}.tp-calendar-summary{display:grid;grid-template-columns:repeat(3,88px);border:1px solid #e3e9e2;border-radius:15px;overflow:hidden;background:#fafcf9}.tp-calendar-summary>div{min-height:76px;padding:10px;border-right:1px solid #e5ebe4;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px}.tp-calendar-summary>div:last-child{border-right:0}.tp-calendar-summary strong{color:#2e713e;font-size:20px}.tp-calendar-summary span{color:#7c887f;font-size:9px;font-weight:800}.tp-calendar-toolbar{margin:18px 0 10px;display:flex;justify-content:space-between;align-items:end;gap:12px}.tp-calendar-toolbar>div{display:flex;flex-direction:column;gap:2px}.tp-calendar-toolbar strong{color:#283b2f;font-size:15px}.tp-calendar-toolbar>button,.tp-calendar-empty button{min-height:40px;padding:0 13px;border:1px solid #cad9c9;border-radius:10px;background:#fff;color:#2d6f3e;font-weight:900}.tp-calendar-groups{display:grid;gap:18px}.tp-calendar-group-title{margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center}.tp-calendar-group-title strong{color:#647269;font-size:10px}.tp-calendar-group-title.overdue span{color:#b9564d}.tp-calendar-group-title.completed span{color:#78847c}.tp-calendar-list{display:grid;gap:9px}.tp-calendar-item{border:1px solid #e0e7df;border-radius:14px;background:#fff;padding:12px;display:grid;grid-template-columns:30px 40px 1fr auto;gap:10px;align-items:start}.tp-calendar-item.completed{opacity:.65}.tp-calendar-check{width:28px;height:28px;border:1px solid #cbd8ca;border-radius:9px;background:#fff;color:#2f743f;font-weight:900}.tp-calendar-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#eef5eb;font-size:19px}.tp-calendar-copy{min-width:0}.tp-calendar-title-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tp-calendar-title-row strong{color:#25382c;font-size:13px}.tp-calendar-title-row span{border-radius:999px;background:#f1f5ef;color:#627168;padding:3px 6px;font-size:9px;font-weight:800}.tp-calendar-copy p{margin:3px 0 0;color:#6e7a72;font-size:11px}.tp-calendar-meta{margin-top:6px;display:flex;flex-wrap:wrap;gap:7px}.tp-calendar-meta span{color:#567260;font-size:10px;font-weight:700}.tp-calendar-copy>small{display:block;margin-top:6px;color:#7a867e;font-size:10px;line-height:1.4}.tp-calendar-delete{border:0;background:transparent;color:#b05049;font-size:10px;font-weight:900}.tp-calendar-empty{border:1px dashed #cbd8c9;border-radius:15px;background:#fafcf9;padding:24px;text-align:center}.tp-calendar-empty>div{font-size:28px}.tp-calendar-empty strong{display:block;margin-top:6px;color:#2d4133}.tp-calendar-empty p{margin:5px 0 12px;color:#7b877f;font-size:11px}.tp-reminder-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.tp-reminder-form label{display:grid;gap:6px;color:#405046;font-size:12px;font-weight:800}.tp-reminder-form input,.tp-reminder-form select,.tp-reminder-form textarea{width:100%;min-height:44px;border:1px solid #ccd7cc;border-radius:10px;background:#fff;padding:0 11px;color:#213229;outline:none;font-size:14px}.tp-reminder-form textarea{min-height:82px;padding-top:10px;resize:vertical}.tp-reminder-full{grid-column:1/-1}
.tp-ai-page {
  min-height: 100vh;
  background: #f4f7f3;
  color: #1f2e24;
  padding-bottom: 92px;
}

.tp-ai-page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  min-height: 68px;
  padding: 10px 22px;
  background: rgba(255, 255, 255, .94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5eae4;
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  gap: 10px;
  align-items: center;
}

.tp-ai-page-header > button {
  width: 38px;
  height: 38px;
  border: 1px solid #dde5dc;
  border-radius: 11px;
  background: #ffffff;
  color: #33483a;
  font-size: 18px;
}

.tp-ai-page-header > div:nth-child(2) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-ai-page-header span {
  color: #3d7d4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.tp-ai-page-header strong {
  color: #203126;
  font-size: 15px;
}

.tp-ai-page-spark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #edf6ea;
  color: #2d773f;
  font-size: 21px;
  font-weight: 900;
}

.tp-ai-page-content {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 15px;
}

.tp-ai-hero,
.tp-ai-access-card,
.tp-ai-workspace {
  border: 1px solid #e0e7df;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 8px 26px rgba(32, 60, 39, .05);
}

.tp-ai-hero {
  padding: 22px;
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 16px;
  align-items: start;
}

.tp-ai-hero-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 17px;
  background: linear-gradient(145deg, #e7f4e2, #f5faF2);
  color: #24723b;
  font-size: 27px;
  font-weight: 900;
  border: 1px solid #d5e6d1;
}

.tp-ai-hero > div:last-child > span,
.tp-ai-workspace-head span,
.tp-ai-access-copy > span {
  color: #3e7e4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-ai-hero h1 {
  margin: 5px 0 6px;
  color: #1d3023;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.12;
}

.tp-ai-hero p {
  margin: 0;
  color: #6e7a72;
  font-size: 12px;
  line-height: 1.55;
}

.tp-ai-access-card {
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.tp-ai-access-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-access-copy strong {
  color: #263c2c;
  font-size: 14px;
}

.tp-ai-access-copy small {
  color: #7a867e;
  font-size: 10px;
  line-height: 1.4;
}

.tp-ai-access-badges {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tp-ai-access-badges span {
  border: 1px solid #d8e5d5;
  background: #f3f8f1;
  color: #397448;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.tp-ai-workspace {
  padding: 20px;
}

.tp-ai-workspace-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.tp-ai-workspace-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-workspace-head strong {
  color: #2b3f31;
  font-size: 14px;
}

.tp-ai-step-two {
  margin-top: 18px;
}

.tp-ai-field-select {
  width: 100%;
  min-height: 48px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid #ccd8cb;
  border-radius: 12px;
  background: #ffffff;
  color: #25372c;
  font-size: 13px;
  outline: none;
}

.tp-ai-main-picker {
  margin-top: 10px;
  min-height: 190px;
  border: 1.5px dashed #b8ccb5;
  border-radius: 16px;
  background: #f9fbf8;
  cursor: pointer;
  display: flex !important;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  gap: 6px !important;
  padding: 22px;
}

.tp-ai-main-picker > div {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #edf5ea;
  font-size: 27px;
}

.tp-ai-main-picker strong {
  color: #2c6d3c;
  font-size: 15px;
}

.tp-ai-main-picker span {
  max-width: 440px;
  color: #77837b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
}

.tp-ai-main-picker input,
.tp-ai-main-photo input {
  display: none;
}

.tp-ai-main-photo {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #dce5db;
  border-radius: 15px;
  background: #f8faf7;
  display: grid;
  grid-template-columns: minmax(180px, 300px) 1fr;
  gap: 14px;
  align-items: center;
}

.tp-ai-main-photo img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 12px;
  background: #edf2eb;
}

.tp-ai-main-photo > div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.tp-ai-main-photo strong {
  color: #294033;
}

.tp-ai-main-photo small {
  color: #76827a;
  line-height: 1.4;
}

.tp-ai-main-photo label,
.tp-ai-main-photo button,
.tp-ai-empty-field button {
  min-height: 40px;
  border: 1px solid #cedbcd;
  border-radius: 10px;
  background: #ffffff;
  color: #326f41;
  display: grid !important;
  place-items: center;
  padding: 0 11px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.tp-ai-main-photo button {
  color: #aa4d45;
}

.tp-ai-note-field {
  margin-top: 14px;
  display: grid;
  gap: 6px;
  color: #425148;
  font-size: 11px;
  font-weight: 800;
}

.tp-ai-note-field textarea {
  min-height: 74px;
  border: 1px solid #ccd8cb;
  border-radius: 11px;
  padding: 10px 11px;
  resize: vertical;
  color: #26372d;
  outline: none;
  font-family: inherit;
}

.tp-ai-main-analyze {
  width: 100%;
  min-height: 52px;
  margin-top: 14px;
  border: 1px solid #27733d;
  border-radius: 13px;
  background: #27733d;
  color: #ffffff;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  box-shadow: 0 8px 20px rgba(39, 115, 61, .15);
}

.tp-ai-main-analyze span {
  font-size: 19px;
}

.tp-ai-main-analyze:disabled {
  opacity: .5;
  box-shadow: none;
}

.tp-ai-limit-box {
  margin-top: 14px;
  border: 1px solid #eadfc7;
  border-radius: 14px;
  background: #fffbf3;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.tp-ai-limit-box > div {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}

.tp-ai-limit-box strong {
  color: #5d4a24;
  font-size: 12px;
}

.tp-ai-limit-box p {
  margin: 3px 0 0;
  color: #88795a;
  font-size: 10px;
}

.tp-ai-limit-box > button {
  min-height: 42px;
  border: 1px solid #e2d6ba;
  border-radius: 10px;
  background: #ffffff;
  color: #77613a;
  padding: 6px 11px;
  font-weight: 900;
}

.tp-ai-limit-box button small {
  display: block;
  margin-top: 2px;
  font-size: 8px;
}

.tp-ai-page-result {
  margin-top: 14px;
  padding: 16px;
}

.tp-ai-save-history {
  width: 100%;
  min-height: 45px;
  margin-top: 13px;
  border: 1px solid #cbdaca;
  border-radius: 11px;
  background: #ffffff;
  color: #2e6d3d;
  font-weight: 900;
}

.tp-ai-page-error {
  margin-top: 12px;
}

.tp-ai-empty-field {
  margin-top: 10px;
  border: 1px dashed #cad7c8;
  border-radius: 12px;
  padding: 14px;
  background: #f9fbf8;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.tp-ai-nav-main span {
  font-size: 21px !important;
}

.tp-ai-analyze-area {
  margin-top: 10px;
  display: grid;
  gap: 5px;
}

.tp-ai-analyze-button {
  min-height: 46px;
  border: 1px solid #3f8251;
  border-radius: 11px;
  background: #f2f8f0;
  color: #246438;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tp-ai-analyze-button > span {
  font-size: 18px;
}

.tp-ai-analyze-button:disabled {
  opacity: .68;
}

.tp-ai-analyze-area > small {
  color: #78847c;
  font-size: 10px;
  text-align: center;
}

.tp-ai-error {
  margin-top: 10px;
  border: 1px solid #efcfc9;
  background: #fff5f3;
  color: #a34b43;
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 11px;
}

.tp-ai-result {
  margin-top: 12px;
  border: 1px solid #d8e4d6;
  border-radius: 13px;
  background: #fbfdf9;
  padding: 13px;
}

.tp-ai-result.tp-ai-attention,
.tp-ai-history-card.tp-ai-attention {
  border-color: #ead9a4;
  background: #fffaf0;
}

.tp-ai-result.tp-ai-urgent,
.tp-ai-history-card.tp-ai-urgent {
  border-color: #efc7c0;
  background: #fff5f3;
}

.tp-ai-result.tp-ai-uncertain,
.tp-ai-history-card.tp-ai-uncertain {
  border-color: #d9dee0;
  background: #f7f9fa;
}

.tp-ai-result-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.tp-ai-result-head > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-result-head span,
.tp-ai-possible span,
.tp-ai-list > span,
.tp-ai-history-card span {
  color: #467852;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .7px;
}

.tp-ai-result-head strong {
  color: #24372b;
  font-size: 15px;
}

.tp-ai-confidence {
  min-width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #edf5ea;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #2c6e3d;
  font-weight: 900;
}

.tp-ai-confidence small {
  font-size: 8px;
  color: #6e7b72;
  font-weight: 700;
}

.tp-ai-possible {
  margin-top: 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-possible strong {
  color: #2c3f32;
}

.tp-ai-list {
  margin-top: 11px;
}

.tp-ai-list p {
  margin: 4px 0 0;
  color: #66736a;
  line-height: 1.45;
  font-size: 11px;
}

.tp-ai-disclaimer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e5eae4;
  color: #7c8780;
  font-size: 9px;
  line-height: 1.45;
}

.tp-ai-history-card {
  margin-top: 9px;
  border: 1px solid #d8e4d6;
  background: #f7fbf5;
  border-radius: 10px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tp-ai-history-card > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-ai-history-card strong {
  color: #2b4132;
  font-size: 11px;
}

.tp-ai-history-card small {
  color: #64806b;
  white-space: nowrap;
  font-weight: 800;
}

.tp-activity-photo-thumb {
  margin-top: 9px;
  width: min(230px, 100%);
  border: 1px solid #dce5db;
  border-radius: 11px;
  padding: 5px;
  background: #ffffff;
  text-align: left;
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 8px;
  align-items: center;
}

.tp-activity-photo-thumb img {
  width: 68px;
  height: 54px;
  object-fit: cover;
  border-radius: 8px;
  background: #eef3ec;
}

.tp-activity-photo-thumb span {
  color: #3b7148;
  font-size: 11px;
  font-weight: 800;
}

.tp-activity-photo-note {
  color: #66736a;
  font-size: 11px;
  line-height: 1.45;
  padding: 10px 12px;
  border: 1px dashed #cfd9ce;
  border-radius: 10px;
  background: #fbfcfa;
}

.tp-field-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.tp-field-quick-actions button {
  min-height: 118px;
  border: 1px solid #e3e8e2;
  background: #fbfcfa;
  border-radius: 15px;
  padding: 14px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-field-quick-actions button > span {
  font-size: 24px;
}

.tp-field-quick-actions strong {
  color: #26382d;
  margin-top: 3px;
}

.tp-field-quick-actions small {
  color: #7d8881;
  line-height: 1.4;
}

.tp-field-detail-bottom {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(100%, 960px);
  min-height: 72px;
  background: rgba(255, 255, 255, .97);
  border: 1px solid #e3e8e2;
  border-bottom: 0;
  border-radius: 18px 18px 0 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  padding: 7px 10px;
  z-index: 30;
  box-shadow: 0 -8px 30px rgba(34, 60, 41, .06);
}

.tp-field-detail-bottom button {
  min-height: 52px;
  border: 0;
  background: transparent;
  color: #78847c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
}

.tp-field-detail-bottom button > span {
  font-size: 19px;
}

.tp-field-detail-bottom button.active {
  color: #28713c;
}

.tp-field-detail-bottom .tp-field-detail-main-action {
  width: 66px;
  min-height: 66px;
  justify-self: center;
  margin-top: -22px;
  border-radius: 50%;
  background: #28743e;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(40, 116, 62, .22);
}

.tp-field-detail-main-action > span {
  font-size: 26px !important;
}

.tp-real-field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.tp-real-field-grid .analysisItem {
  border: 1px solid #e3e9e2;
  border-radius: 14px;
  padding: 14px;
  background: #fbfcfa;
}

.tp-real-field-note {
  border: 1px solid #dce8dc;
  background: #f6faf5;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.tp-real-field-note strong {
  color: #234f31;
}

.tp-real-field-note p {
  margin: 6px 0 0;
  color: #66736a;
  line-height: 1.5;
  font-size: 13px;
}

.tp-fields-loading {
  padding: 10px 0;
  color: #758078;
  font-size: 12px;
}

@media (max-width: 520px) {
  .tp-onboarding-page {
    padding: 0;
    align-items: stretch;
  }

  .tp-welcome-shell,
  .tp-form-shell,
  .tp-question-shell,
  .tp-ready-shell,
  .tp-field-form-shell {
    width: 100%;
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    padding: 24px;
  }

  .tp-field-form-grid {
    grid-template-columns: 1fr;
  }

  .tp-logo-mark {
    margin-top: 45px;
  }

  .tp-landscape {
    width: calc(100% + 48px);
  }

  .tp-trust-grid {
    margin-top: 28px;
  }

  .tp-field-detail-header {
    padding: 0 14px;
  }

  .tp-field-detail-content {
    width: calc(100% - 20px);
    margin-top: 12px;
  }

  .tp-field-hero-card,
  .tp-field-detail-section {
    border-radius: 16px;
  }

  .tp-field-hero-top {
    grid-template-columns: 50px 1fr;
  }

  .tp-field-hero-top > .statusPill {
    grid-column: 2;
    width: fit-content;
  }

  .tp-field-hero-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .tp-field-hero-stats > div {
    padding: 0 8px;
  }

  .tp-field-detail-status-grid {
    grid-template-columns: 1fr;
  }

  .tp-field-detail-map-card {
    grid-template-columns: 1fr;
  }

  .tp-field-detail-map-shape {
    height: 150px;
  }

  .tp-field-detail-map-card > button {
    width: 100%;
  }

  .tp-cycle-choice {
    grid-template-columns: 1fr;
  }

  .tp-production-profile-summary {
    grid-template-columns: 1fr 1fr;
  }

  .tp-production-profile-summary > button {
    min-height: 42px;
    grid-column: 1 / -1;
  }

  .tp-production-profile-fields,
  .tp-history-form {
    grid-template-columns: 1fr;
  }

  .tp-yield-history-card,
  .tp-season-history-card {
    grid-template-columns: 56px 1fr;
  }

  .tp-yield-history-card > button,
  .tp-season-history-card > button {
    grid-column: 2;
    justify-self: start;
  }

  .tp-production-history-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-field-section-form {
    grid-template-columns: 1fr;
  }

  .tp-field-sections-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-field-section-card {
    grid-template-columns: 34px 1fr;
  }

  .tp-field-section-area {
    grid-column: 2;
    justify-content: space-between;
  }

  .tp-modal-backdrop {
    padding: 0;
    align-items: flex-end;
  }

  .tp-modal-card,
  .tp-modal-card-medium,
  .tp-modal-card-large {
    width: 100%;
    max-height: 92vh;
    border-radius: 22px 22px 0 0;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    box-shadow: 0 -18px 55px rgba(20, 45, 28, .18);
  }

  .tp-modal-actions {
    position: sticky;
    bottom: 0;
    background: #ffffff;
    padding-bottom: 2px;
  }

  .tp-modal-cancel,
  .tp-modal-primary {
    flex: 1;
  }

  .tp-dose-choice {
    grid-template-columns: 1fr 1fr;
  }

  .tp-smart-calc {
    grid-template-columns: 1fr;
  }

  .tp-smart-calc span {
    grid-row: auto;
  }

  .tp-calendar-content { padding: 14px; }
  .tp-calendar-hero { grid-template-columns: 1fr; padding: 16px; }
  .tp-calendar-summary { grid-template-columns: repeat(3, 1fr); }
  .tp-calendar-toolbar { align-items: stretch; flex-direction: column; }
  .tp-calendar-item { grid-template-columns: 30px 38px 1fr; }
  .tp-calendar-delete { grid-column: 3; justify-self: start; }
  .tp-reminder-form { grid-template-columns: 1fr; }

  .tp-ai-page-content {
    padding: 14px;
  }

  .tp-ai-hero {
    grid-template-columns: 46px 1fr;
    padding: 16px;
  }

  .tp-ai-hero-icon {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 22px;
  }

  .tp-ai-access-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-ai-access-badges {
    justify-content: flex-start;
  }

  .tp-ai-workspace {
    padding: 15px;
  }

  .tp-ai-main-photo {
    grid-template-columns: 1fr;
  }

  .tp-ai-main-photo img {
    max-height: 250px;
  }

  .tp-ai-limit-box {
    align-items: stretch;
    flex-direction: column;
  }

  .tp-ai-empty-field {
    align-items: stretch;
    flex-direction: column;
  }

  .tp-activity-photo-preview {
    grid-template-columns: 92px 1fr;
  }

  .tp-activity-photo-preview img {
    width: 92px;
    height: 76px;
  }

  .tp-activity-form {
    grid-template-columns: 1fr;
  }

  .tp-activity-card {
    grid-template-columns: 40px 1fr;
  }

  .tp-activity-delete {
    grid-column: 2;
    justify-self: start;
  }

  .tp-activity-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .tp-field-quick-actions {
    grid-template-columns: 1fr 1fr;
  }

  .tp-real-field-grid {
    grid-template-columns: 1fr;
  }

  .tp-question-shell {
    max-height: none;
  }
}
.tp-push-card{margin-top:14px;border:1px solid #dfe6de;border-radius:17px;background:#fff;padding:15px;display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center}
.tp-push-card.enabled{border-color:#cfe0cd;background:#fbfdf9}
.tp-push-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:#eef5eb;font-size:21px}
.tp-push-copy{min-width:0;display:flex;flex-direction:column;gap:2px}
.tp-push-copy>span{color:#427a4e;font-size:9px;font-weight:900;letter-spacing:.8px}
.tp-push-copy>strong{color:#293c30;font-size:13px}
.tp-push-copy p{margin:2px 0 0;color:#758178;font-size:10px;line-height:1.45}
.tp-push-copy small{margin-top:5px;color:#497455;font-size:10px;line-height:1.4}
.tp-push-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.tp-push-actions button{min-height:38px;border:1px solid #d4ddd3;border-radius:10px;background:#fff;color:#607067;padding:0 11px;font-size:10px;font-weight:900}
.tp-push-actions button.primary{border-color:#2d733e;background:#2d733e;color:#fff}
.tp-push-actions button:disabled{opacity:.55}
@media(max-width:700px){
  .tp-push-card{grid-template-columns:42px 1fr;align-items:start}
  .tp-push-actions{grid-column:1/-1;justify-content:stretch}
  .tp-push-actions button{flex:1}
}


/* ===== ANA SAYFA / ÖRNEK TARLA AÇILIR KART YENİ DÜZEN ===== */
.tp-demo-expanded-card{
  padding-top:12px;
}

.tp-demo-main-grid{
  display:grid;
  grid-template-columns:minmax(0,1.05fr) minmax(250px,.95fr);
  gap:18px;
  align-items:stretch;
}

.tp-demo-map-panel,
.tp-demo-action-panel{
  min-width:0;
}

.tp-demo-map-large{
  height:100%;
  min-height:238px;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

.tp-demo-action-panel{
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:14px;
}

.tp-demo-mini-signals{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
}

.tp-demo-mini-signals span{
  min-height:66px;
  border:1px solid #e2e8df;
  border-radius:16px;
  background:#f7faf6;
  display:grid;
  place-items:center;
  font-size:25px;
  box-shadow:0 6px 18px rgba(45,77,51,.06);
}

.tp-demo-action-stack{
  display:grid;
  gap:10px;
}

.tp-demo-action-stack button{
  min-height:52px;
  width:100%;
  border:1px solid #dfe6dc;
  border-radius:14px;
  background:#fff;
  color:#21492b;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:11px;
  padding:0 16px;
  font-size:14px;
  font-weight:800;
  box-shadow:0 5px 14px rgba(45,77,51,.05);
}

.tp-demo-action-stack button span{
  font-size:20px;
}

.tp-demo-action-stack button:hover{
  background:#f7faf6;
}

.tp-demo-action-stack button.primary{
  background:#26763d;
  color:#fff;
  border-color:#26763d;
  justify-content:center;
}

.tp-demo-recommendation{
  margin-top:16px;
  width:100%;
}

@media (max-width:760px){
  .tp-demo-main-grid{
    grid-template-columns:1fr;
  }

  .tp-demo-map-large{
    min-height:210px;
  }

  .tp-demo-action-panel{
    gap:12px;
  }

  .tp-demo-mini-signals span{
    min-height:58px;
  }
}


/* ===== TARLALARIM / PREMIUM TARLA KARTLARI ===== */
.tp-premium-field-card{
  --tp-accent:#2f7d32;
  --tp-soft:#f3f8f1;
  --tp-border:#d8e7d5;
  overflow:hidden;
  border:1px solid var(--tp-border)!important;
  border-left:5px solid var(--tp-accent)!important;
  border-radius:22px!important;
  background:linear-gradient(135deg,rgba(255,255,255,.97),var(--tp-soft))!important;
  box-shadow:0 12px 34px rgba(29,52,34,.07)!important;
  margin-bottom:16px;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

.tp-field-tone-good{--tp-accent:#2f8b49;--tp-soft:#f1f8ef;--tp-border:#d7e8d3}
.tp-field-tone-check{--tp-accent:#d99200;--tp-soft:#fff8e9;--tp-border:#f0ddb2}
.tp-field-tone-urgent{--tp-accent:#d84a45;--tp-soft:#fff1f0;--tp-border:#efcfcc}

.tp-premium-field-head{
  display:grid;
  grid-template-columns:minmax(260px,1fr) auto auto;
  gap:18px;
  align-items:center;
  padding:18px 20px;
}

.tp-premium-field-identity,.tp-premium-status-button{
  border:0;
  background:transparent;
  padding:0;
  color:inherit;
}

.tp-premium-field-identity{
  min-width:0;
  display:flex;
  align-items:center;
  gap:14px;
  text-align:left;
  cursor:pointer;
}

.tp-premium-crop-icon{
  width:58px;height:58px;flex:0 0 58px;
  display:grid;place-items:center;
  border-radius:17px;
  background:rgba(255,255,255,.74);
  border:1px solid rgba(60,92,61,.09);
  font-size:31px;
}

.tp-premium-field-copy{min-width:0}
.tp-premium-field-copy .fieldTitleRow{
  display:flex;align-items:center;gap:8px;margin-bottom:5px;
}
.tp-premium-field-copy h3{
  margin:0;
  font-size:17px;
  line-height:1.2;
  font-weight:850;
  letter-spacing:-.025em;
  color:#132319;
}
.tp-premium-field-copy p{
  margin:3px 0 0;
  display:flex;align-items:center;flex-wrap:wrap;gap:7px;
  color:#5d685f;
  font-size:13px;
}
.tp-premium-field-copy .tp-premium-parcel{color:#31463a}

.tp-field-shortcuts{display:flex;gap:9px;align-items:center}
.tp-field-shortcuts button{
  width:78px;min-height:72px;padding:8px 6px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:15px;
  background:rgba(255,255,255,.74);
  color:#48554c;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  cursor:pointer;transition:.18s ease;
  box-shadow:0 5px 14px rgba(29,52,34,.035);
}
.tp-field-shortcuts button span{font-size:25px;line-height:1}
.tp-field-shortcuts button small{
  font-size:10px;line-height:1.15;font-weight:750;white-space:nowrap;
}
.tp-field-shortcuts button:hover,.tp-field-shortcuts button.active{
  transform:translateY(-1px);
  border-color:var(--tp-accent);
  color:var(--tp-accent);
  background:rgba(255,255,255,.98);
  box-shadow:0 8px 18px rgba(29,52,34,.06);
}
.tp-field-shortcuts button.active{
  outline:2px solid color-mix(in srgb,var(--tp-accent) 12%,transparent);
}

.tp-premium-status-button{
  min-width:100px;
  display:flex;align-items:center;justify-content:flex-end;gap:12px;
  cursor:pointer;
}
.tp-premium-status{
  display:flex;align-items:center;gap:7px;
  font-size:13px;font-weight:850;white-space:nowrap;
}
.tp-premium-status i{width:9px;height:9px;border-radius:50%}
.tp-premium-status-button .chevron{color:#31443a;font-size:17px}

.tp-premium-field-body{
  display:grid;
  grid-template-columns:minmax(300px,.92fr) minmax(340px,1.08fr);
  gap:0;
  margin:0 12px 12px;
  border:1px solid rgba(46,79,51,.10);
  border-radius:18px;
  overflow:hidden;
  background:rgba(255,255,255,.78);
  box-shadow:0 8px 24px rgba(29,52,34,.04);
}

.tp-premium-visual{
  min-height:270px;
  border-right:1px solid rgba(46,79,51,.09);
  padding:12px;
}

.tp-premium-satellite-map{
  position:relative;
  min-height:246px;height:100%;
  overflow:hidden;border-radius:14px;
  background:
    linear-gradient(18deg,rgba(255,255,255,.12) 0 8%,transparent 8% 15%,rgba(255,255,255,.10) 15% 18%,transparent 18% 100%),
    repeating-linear-gradient(7deg,#70874e 0 18px,#607a43 18px 36px,#789151 36px 54px,#526d3d 54px 72px);
}
.tp-premium-map-grid{
  position:absolute;inset:0;opacity:.25;
  background:
    linear-gradient(90deg,transparent 48%,rgba(255,255,255,.55) 49% 51%,transparent 52%),
    linear-gradient(0deg,transparent 48%,rgba(255,255,255,.35) 49% 51%,transparent 52%);
  background-size:84px 84px;
}
.tp-premium-parcel-shape{
  position:absolute;left:19%;top:18%;width:62%;height:64%;
  border:3px solid rgba(255,255,255,.94);
  clip-path:polygon(12% 7%,86% 0,100% 36%,87% 88%,32% 100%,0 66%);
  display:grid;place-items:center;
  box-shadow:0 0 0 999px rgba(19,43,21,.05);
}
.tp-premium-parcel-shape.good{background:rgba(47,139,73,.42)}
.tp-premium-parcel-shape.check{background:rgba(217,146,0,.45)}
.tp-premium-parcel-shape.urgent{background:rgba(216,74,69,.45)}
.tp-premium-parcel-shape span{
  color:#fff;font-size:17px;font-weight:850;text-shadow:0 2px 8px rgba(0,0,0,.25);
}
.tp-premium-map-zoom{
  position:absolute;right:12px;bottom:12px;
  display:grid;border-radius:9px;overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.13);
}
.tp-premium-map-zoom button{
  width:34px;height:34px;border:0;border-bottom:1px solid #d8ded7;
  background:#fff;color:#1d2d22;font-size:20px;cursor:pointer;
}
.tp-premium-map-zoom button:last-child{border-bottom:0}
.tp-premium-map-update{
  position:absolute;left:12px;bottom:12px;padding:8px 10px;
  border-radius:9px;background:rgba(255,255,255,.92);
  display:flex;flex-direction:column;gap:2px;
  box-shadow:0 4px 12px rgba(0,0,0,.09);
}
.tp-premium-map-update strong{font-size:10px}
.tp-premium-map-update span{color:var(--tp-accent);font-size:10px}

.tp-premium-insight{
  min-width:0;padding:17px;
  display:flex;flex-direction:column;gap:13px;
}
.tp-premium-insight-title{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
}
.tp-panel-eyebrow{
  display:block;margin-bottom:3px;
  color:var(--tp-accent);
  font-size:9px;font-weight:900;letter-spacing:.09em;
}
.tp-premium-insight-title h4,.tp-premium-check-panel h4{
  margin:0;color:#1a281f;font-size:15px;line-height:1.2;font-weight:850;letter-spacing:-.015em;
}
.tp-premium-insight-title small{
  display:block;margin-top:4px;color:#758079;font-size:10px;
}
.tp-health-dot{width:9px;height:9px;border-radius:50%;margin-top:7px}
.tp-health-dot.good{background:#2f8b49}
.tp-health-dot.check{background:#d99200}
.tp-health-dot.urgent{background:#d84a45}

.tp-premium-metrics{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
}
.tp-premium-metrics>div{
  min-width:0;padding:10px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:12px;background:rgba(255,255,255,.80);
  display:flex;align-items:center;gap:8px;
}
.tp-premium-metrics>div>span{font-size:20px}
.tp-premium-metrics p{min-width:0;margin:0;color:#758079;font-size:9px}
.tp-premium-metrics strong{
  display:block;margin-top:2px;color:#1c2c21;font-size:11px;
}

.tp-premium-detail-button{
  margin-left:auto;min-width:220px;min-height:45px;padding:0 15px;
  border:0;border-radius:10px;color:#fff;
  display:flex;align-items:center;justify-content:center;gap:9px;
  font-size:12px;font-weight:850;cursor:pointer;
  box-shadow:0 7px 18px rgba(29,52,34,.10);
}
.tp-premium-detail-button.good{background:#268142}
.tp-premium-detail-button.check{background:#dd9200}
.tp-premium-detail-button.urgent{background:#d92d29}
.tp-premium-detail-button b{margin-left:auto;font-size:18px;font-weight:500}

.tp-premium-recommendation{
  margin-top:auto;padding:12px 14px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:12px;
  display:flex;align-items:flex-start;gap:10px;
  background:rgba(255,255,255,.60);
}
.tp-premium-recommendation.good{background:#f2f8f0}
.tp-premium-recommendation.check{background:#fff7e3}
.tp-premium-recommendation.urgent{background:#fff0ef}
.tp-premium-recommendation>span{font-size:19px}
.tp-premium-recommendation strong{
  display:block;margin-bottom:2px;color:#29372e;font-size:11px;
}
.tp-premium-recommendation p{
  margin:0;color:#566159;font-size:10px;line-height:1.45;
}
.tp-premium-remove-demo{align-self:flex-start;margin:0;font-size:9px;opacity:.72}

.tp-premium-weather{
  height:100%;min-height:246px;padding:14px;border-radius:14px;
  background:linear-gradient(145deg,#fbfdff,#f2f7f8);
  display:flex;flex-direction:column;gap:14px;
}
.tp-weather-current{display:flex;align-items:center;gap:14px}
.tp-weather-big-icon{font-size:48px}
.tp-weather-current strong{
  display:block;color:#16241b;font-size:32px;letter-spacing:-.04em;
}
.tp-weather-current span:not(.tp-weather-big-icon){color:#66736a;font-size:12px}
.tp-weather-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tp-weather-metrics div,.tp-weather-days div{
  text-align:center;border:1px solid #e7ece8;border-radius:10px;background:#fff;
}
.tp-weather-metrics div{padding:9px 6px}
.tp-weather-metrics small,.tp-weather-days small{
  display:block;color:#7b867f;font-size:9px;
}
.tp-weather-metrics strong,.tp-weather-days strong{
  display:block;margin-top:2px;color:#243229;font-size:11px;
}
.tp-weather-days{
  display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:auto;
}
.tp-weather-days div{padding:8px 3px}
.tp-weather-days span{display:block;margin:5px 0;font-size:20px}

.tp-premium-weather-note{
  padding:13px;border:1px solid rgba(45,72,49,.10);
  border-radius:12px;background:#f8fbf7;
  display:flex;gap:10px;align-items:flex-start;
}
.tp-premium-weather-note span{font-size:20px}
.tp-premium-weather-note p{
  margin:0;color:#536057;font-size:11px;line-height:1.5;
}

.tp-premium-check-panel{
  min-height:246px;padding:20px;border-radius:14px;
  background:linear-gradient(145deg,#f8fbf7,#eef5ed);
  display:flex;align-items:center;gap:18px;
}
.tp-check-hero{
  width:84px;height:84px;flex:0 0 84px;
  display:grid;place-items:center;border-radius:24px;
  background:#fff;font-size:38px;
  box-shadow:0 8px 24px rgba(29,52,34,.07);
}
.tp-premium-check-panel p{
  max-width:340px;margin:8px 0 14px;
  color:#647067;font-size:11px;line-height:1.5;
}
.tp-premium-check-panel button{
  min-height:38px;padding:0 14px;border:0;border-radius:9px;
  background:#278044;color:#fff;font-size:11px;font-weight:800;cursor:pointer;
}

@media(max-width:900px){
  .tp-premium-field-head{grid-template-columns:1fr auto}
  .tp-field-shortcuts{
    grid-column:1/-1;justify-content:flex-start;order:3;
  }
  .tp-premium-field-body{grid-template-columns:1fr}
  .tp-premium-visual{
    border-right:0;border-bottom:1px solid rgba(46,79,51,.09);
  }
}

@media(max-width:600px){
  .tp-premium-field-head{padding:14px;gap:12px}
  .tp-premium-crop-icon{
    width:48px;height:48px;flex-basis:48px;font-size:26px;
  }
  .tp-premium-field-copy h3{font-size:14px}
  .tp-premium-status-button{min-width:auto}
  .tp-premium-status{font-size:11px}
  .tp-field-shortcuts{
    display:grid;grid-template-columns:repeat(3,1fr);width:100%;
  }
  .tp-field-shortcuts button{width:100%;min-height:64px}
  .tp-premium-field-body{margin:0 8px 8px}
  .tp-premium-visual{min-height:220px;padding:8px}
  .tp-premium-satellite-map,.tp-premium-weather,.tp-premium-check-panel{
    min-height:210px;
  }
  .tp-premium-insight{padding:13px}
  .tp-premium-metrics{grid-template-columns:1fr}
  .tp-premium-detail-button{width:100%;min-width:0}
  .tp-weather-days{
    grid-template-columns:repeat(5,minmax(48px,1fr));overflow-x:auto;
  }
  .tp-premium-check-panel{
    flex-direction:column;align-items:flex-start;
  }
}


/* ===== A STİLİ / RENKLİ PREMIUM INLINE SVG İKONLAR ===== */
.tp-shortcut-svg{
  width:28px;
  height:28px;
  flex:0 0 28px;
  display:block;
  color:#34433a;
  transition:transform .18s ease,color .18s ease;
}

.tp-satellite-svg{color:#166534}
.tp-weather-svg{color:#475569}
.tp-camera-svg{color:#26342b}

.tp-field-shortcuts button.active .tp-shortcut-svg{
  transform:translateY(-1px);
}

.tp-field-shortcuts button.active{
  position:relative;
  background:#eaf6ee;
  border-color:#2f8b49;
  box-shadow:0 8px 20px rgba(22,101,52,.08);
}

.tp-field-shortcuts button.active::after{
  content:'';
  position:absolute;
  left:50%;
  bottom:-1px;
  width:24px;
  height:3px;
  border-radius:999px 999px 0 0;
  background:#2f8b49;
  transform:translateX(-50%);
}

.tp-field-tone-check .tp-field-shortcuts button.active{
  background:#fff7e6;
  border-color:#d99200;
}

.tp-field-tone-check .tp-field-shortcuts button.active::after{
  background:#d99200;
}

.tp-field-tone-urgent .tp-field-shortcuts button.active{
  background:#fff0ef;
  border-color:#d84a45;
}

.tp-field-tone-urgent .tp-field-shortcuts button.active::after{
  background:#d84a45;
}

.tp-detail-svg{
  width:18px;
  height:18px;
  flex:0 0 18px;
  display:block;

/* ===== GERÇEK HAVA DURUMU / 3 KAYNAK KARŞILAŞTIRMA ===== */
.tp-live-weather{
  position:relative;
}

.tp-weather-location{
  display:flex;
  align-items:center;
  gap:6px;
  color:#607067;
}

.tp-weather-location span{
  font-size:13px;
}

.tp-weather-location small{
  font-size:9px;
  font-weight:800;
}

.tp-weather-current>div small{
  display:block;
  margin-top:3px;
  color:#879188;
  font-size:9px;
}

.tp-weather-days em{
  display:block;
  margin-top:1px;
  color:#8b948d;
  font-size:9px;
  font-style:normal;
}

.tp-weather-state-card{
  min-height:210px;
  padding:22px;
  border:1px dashed #d5ded5;
  border-radius:14px;
  background:rgba(255,255,255,.72);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
}

.tp-weather-state-card>span{
  font-size:38px;
}

.tp-weather-state-card strong{
  margin-top:8px;
  color:#23342a;
  font-size:13px;
}

.tp-weather-state-card small{
  max-width:280px;
  margin-top:5px;
  color:#748078;
  font-size:10px;
  line-height:1.5;
}

.tp-weather-state-card button{
  margin-top:12px;
  min-height:34px;
  padding:0 12px;
  border:1px solid #bfd2c0;
  border-radius:9px;
  background:#fff;
  color:#2c7040;
  font-size:10px;
  font-weight:850;
  cursor:pointer;
}

.tp-weather-detail-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
}

.tp-weather-detail-grid>div{
  padding:10px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:11px;
  background:rgba(255,255,255,.72);
}

.tp-weather-detail-grid small{
  display:block;
  color:#7b877f;
  font-size:9px;
}

.tp-weather-detail-grid strong{
  display:block;
  margin-top:3px;
  color:#26372c;
  font-size:11px;
}

.tp-parcel-lookup-panel{
  grid-column:1 / -1;
  margin-top:2px;
}

.tp-parcel-lookup-actions{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,.78fr);
  gap:10px;
}

.tp-parcel-lookup-actions button{
  min-height:46px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border-radius:11px;
  padding:0 14px;
  font-family:inherit;
  font-size:11px;
  font-weight:850;
  letter-spacing:.01em;
  cursor:pointer;
  transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;
}

.tp-parcel-lookup-actions button:hover:not(:disabled){
  transform:translateY(-1px);
}

.tp-parcel-lookup-actions button svg{
  width:17px;
  height:17px;
  flex:0 0 17px;
}

.tp-parcel-search-button{
  border:1px solid #286b3c;
  background:linear-gradient(180deg,#347d49 0%,#286a3c 100%);
  color:#fff;
  box-shadow:0 7px 16px rgba(39,105,59,.15);
}

.tp-parcel-search-button:hover:not(:disabled){
  box-shadow:0 10px 22px rgba(39,105,59,.20);
}

.tp-parcel-search-button:disabled{
  opacity:.7;
  cursor:wait;
}

.tp-parcel-tkgm-button{
  border:1px solid rgba(42,103,59,.30);
  background:#fff;
  color:#2c6940;
}

.tp-parcel-tkgm-button:hover{
  border-color:#2c6940;
  box-shadow:0 7px 16px rgba(34,80,45,.07);
}

.tp-parcel-spinner{
  width:16px;
  height:16px;
  display:block;
  border:2px solid rgba(255,255,255,.32);
  border-top-color:#fff;
  border-radius:50%;
  animation:tpParcelSpin .8s linear infinite;
}

@keyframes tpParcelSpin{
  to{transform:rotate(360deg)}
}

.tp-parcel-result-divider{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:16px 0 11px;
  color:#7b877f;
  font-size:8.5px;
  font-weight:900;
  letter-spacing:.13em;
}

.tp-parcel-result-divider::before,
.tp-parcel-result-divider::after{
  content:'';
  height:1px;
  flex:1;
  background:#e6ebe6;
}

.tp-parcel-result-divider span{
  padding:0 10px;
}

.tp-parcel-result-card{
  display:grid;
  grid-template-columns:minmax(0,1.4fr) minmax(90px,.7fr) minmax(145px,.85fr);
  gap:0;
  align-items:center;
  overflow:hidden;
  border:1px solid rgba(45,112,65,.11);
  border-radius:13px;
  background:linear-gradient(90deg,#f0f8ef 0%,#f8fbf7 100%);
}

.tp-parcel-result-card.error{
  display:block;
  border-color:rgba(176,71,58,.14);
  background:#fff6f4;
}

.tp-parcel-result-status{
  min-width:0;
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 13px;
}

.tp-parcel-result-icon{
  width:27px;
  height:27px;
  flex:0 0 27px;
  display:grid;
  place-items:center;
  border:1.5px solid #3c9a55;
  border-radius:50%;
  color:#2e8546;
  font-size:13px;
  font-weight:900;
}

.tp-parcel-result-card.error .tp-parcel-result-icon{
  border-color:#c56557;
  color:#b54e42;
}

.tp-parcel-result-status div{
  min-width:0;
}

.tp-parcel-result-status strong{
  display:block;
  color:#245c36;
  font-size:11px;
  font-weight:900;
}

.tp-parcel-result-card.error .tp-parcel-result-status strong{
  color:#94483e;
}

.tp-parcel-result-status small{
  display:block;
  margin-top:2px;
  overflow:hidden;
  color:#7a877e;
  font-size:8.5px;
  line-height:1.35;
  text-overflow:ellipsis;
}

.tp-parcel-result-metric{
  min-height:48px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:8px 12px;
  border-left:1px solid rgba(45,112,65,.10);
}

.tp-parcel-result-metric small{
  color:#7e8981;
  font-size:8px;
  font-weight:700;
}

.tp-parcel-result-metric strong{
  display:block;
  margin-top:2px;
  color:#24372a;
  font-size:10.5px;
  font-weight:900;
  font-variant-numeric:tabular-nums;
}

.tp-parcel-result-metric span{
  margin-top:1px;
  color:#56655b;
  font-size:9px;
  font-weight:750;
  font-variant-numeric:tabular-nums;
}

.tp-parcel-map-info{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:9px;
  padding:9px 11px;
  border:1px solid #dce8f2;
  border-radius:9px;
  background:#f1f6fb;
  color:#48677e;
  font-size:9px;
  font-weight:650;
  line-height:1.4;
}

.tp-parcel-map-info svg{
  width:15px;
  height:15px;
  flex:0 0 15px;
  color:#3975aa;
}

.tp-parcel-fieldmap-preview{
  margin-top:12px;
}

.tp-parcel-map-note{
  display:flex;
  gap:8px;
  align-items:flex-start;
  margin-top:8px;
  padding:10px 12px;
  border:1px solid rgba(39,80,55,.10);
  border-radius:12px;
  background:#f8fbf7;
  color:#68746b;
  font-size:10px;
  line-height:1.45;
}

.tp-parcel-map-note p{
  margin:0;
}

.tp-inline-satellite-link{
  margin-top:6px;
  border:0;
  background:transparent;
  padding:0;
  color:#3c7049;
  font-size:11px;
  font-weight:800;
  cursor:pointer;
}

@media(max-width:600px){
  .tp-parcel-lookup-actions{
    grid-template-columns:1fr;
  }

  .tp-parcel-result-card{
    grid-template-columns:1fr;
  }

  .tp-parcel-result-metric{
    min-height:auto;
    border-top:1px solid rgba(45,112,65,.10);
    border-left:0;
  }
}

@media(max-width:600px){
  .tp-weather-detail-grid{
    grid-template-columns:1fr;
  }

}



/* ===== TARLALARIM / GERÇEK FIELDMAP UYDU GÖRÜNÜMÜ ===== */
.tp-premium-fieldmap-shell{
  position:relative;
  width:100%;
  min-height:300px;
  overflow:hidden;
  border-radius:18px;
  background:#e9efe7;
}

.tp-premium-fieldmap-shell > *:first-child{
  width:100%;
}

.tp-premium-fieldmap-badge{
  position:absolute;
  left:12px;
  bottom:12px;
  z-index:5;
  display:flex;
  align-items:center;
  gap:7px;
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.7);
  border-radius:12px;
  background:rgba(20,43,28,.78);
  color:#fff;
  box-shadow:0 8px 22px rgba(18,43,26,.16);
  backdrop-filter:blur(8px);
  font-size:10px;
  font-weight:800;
}


.tp-crop-cycle-status{
  grid-column:1 / -1;
  display:flex;
  align-items:center;
  gap:9px;
  margin-top:-2px;
  padding:9px 11px;
  border:1px solid #e1e8df;
  border-radius:11px;
  background:#f8faf7;
}

.tp-crop-cycle-status > span{
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  flex:0 0 28px;
  border-radius:9px;
  background:#edf5ea;
  font-size:14px;
}

.tp-crop-cycle-status strong{
  display:block;
  color:#2d4535;
  font-size:10px;
  font-weight:850;
}

.tp-crop-cycle-status small{
  display:block;
  margin-top:1px;
  color:#7d887f;
  font-size:8.5px;
  line-height:1.35;
}

.tp-crop-cycle-status.perennial{
  border-color:#d7e7d4;
  background:#f3f8f1;
}

.tp-premium-fieldmap-badge-icon{
  width:16px;
  height:16px;
  flex:0 0 16px;
}

/* ===== 2026 DESKTOP AGRI DASHBOARD / LEFT MENU ===== */
.tp-desktop-shell{
  min-height:100vh;
  background:#f7f9f7;
  color:#17251c;
}

.tp-placeholder-page{
  min-height:100vh;
}

.tp-side-backdrop{
  position:fixed;
  inset:0;
  z-index:9997;
  border:0;
  background:rgba(7,31,20,.38);
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
  cursor:pointer;
}

.tp-desktop-sidebar{
  position:fixed;
  top:0;
  left:0;
  z-index:9998;
  width:272px;
  height:100vh;
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  padding:18px 14px 16px;
  background:
    radial-gradient(circle at 18% 0%,rgba(51,154,91,.16),transparent 28%),
    linear-gradient(180deg,#073f2b 0%,#064832 46%,#043a28 100%);
  color:#fff;
  box-shadow:16px 0 40px rgba(1,28,18,.22);
  transform:translateX(-106%);
  transition:transform .22s ease;
  overflow:hidden;
}

.tp-desktop-sidebar.open{
  transform:translateX(0);
}

.tp-side-brand{
  display:grid;
  grid-template-columns:44px minmax(0,1fr) 30px;
  align-items:center;
  gap:10px;
  padding:2px 4px 16px;
  border-bottom:1px solid rgba(255,255,255,.12);
}

.tp-side-logo-mark{
  width:44px;
  height:44px;
  display:grid;
  place-items:center;
  border-radius:14px;
  background:linear-gradient(145deg,#0d7046,#0a5b3a);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);
  font-size:22px;
}

.tp-side-logo-copy{
  min-width:0;
}

.tp-side-logo-copy strong{
  display:block;
  overflow:hidden;
  color:#fff;
  font-size:19px;
  font-weight:900;
  letter-spacing:-.45px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.tp-side-logo-copy small{
  display:block;
  margin-top:2px;
  color:rgba(255,255,255,.62);
  font-size:9px;
  font-weight:600;
}

.tp-side-close{
  width:30px;
  height:30px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.12);
  border-radius:9px;
  background:rgba(255,255,255,.06);
  color:#fff;
  font-size:20px;
  line-height:1;
  cursor:pointer;
}

.tp-side-close:hover{
  background:rgba(255,255,255,.12);
}

.tp-side-nav{
  display:flex;
  flex:1;
  flex-direction:column;
  gap:3px;
  overflow:auto;
  padding:14px 0 12px;
  scrollbar-width:none;
}

.tp-side-nav::-webkit-scrollbar{
  display:none;
}

.tp-side-nav button{
  width:100%;
  min-height:40px;
  display:grid;
  grid-template-columns:28px minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
  border:0;
  border-radius:10px;
  padding:7px 10px;
  background:transparent;
  color:rgba(255,255,255,.88);
  text-align:left;
  font:inherit;
  font-size:11.5px;
  font-weight:720;
  cursor:pointer;
  transition:background .15s ease,color .15s ease,transform .15s ease;
}

.tp-side-nav button:hover{
  background:rgba(255,255,255,.075);
  color:#fff;
  transform:translateX(1px);
}

.tp-side-nav button.active{
  background:linear-gradient(90deg,rgba(37,142,77,.95),rgba(30,127,70,.95));
  color:#fff;
  box-shadow:0 8px 20px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.05);
}

.tp-side-icon{
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  color:rgba(255,255,255,.92);
  font-size:15px;
  line-height:1;
}

.tp-side-nav b{
  border-radius:999px;
  background:#78db69;
  color:#073d27;
  padding:3px 7px;
  font-size:8px;
  font-weight:900;
  letter-spacing:.2px;
}

.tp-side-profile{
  display:grid;
  grid-template-columns:40px 1fr auto;
  align-items:center;
  gap:9px;
  margin-top:6px;
  padding:10px 8px;
  border-top:1px solid rgba(255,255,255,.10);
}

.tp-side-avatar{
  width:40px;
  height:40px;
  display:grid;
  place-items:center;
  border:2px solid rgba(255,255,255,.14);
  border-radius:50%;
  background:#fff;
  color:#17653c;
  font-weight:900;
}

.tp-side-profile strong{
  display:block;
  color:#fff;
  font-size:11px;
}

.tp-side-profile small{
  display:block;
  margin-top:2px;
  color:rgba(255,255,255,.60);
  font-size:9px;
}

.tp-side-plan-card{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:8px;
  padding:12px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:14px;
  background:rgba(255,255,255,.055);
}

.tp-side-plan-card>span{
  color:rgba(255,255,255,.72);
  font-size:9px;
}

.tp-side-plan-card>strong{
  color:#7ae37f;
  font-size:20px;
  line-height:1;
}

.tp-side-plan-card>small{
  color:rgba(255,255,255,.58);
  font-size:8.5px;
}

.tp-side-plan-progress{
  height:7px;
  overflow:hidden;
  border-radius:999px;
  background:rgba(255,255,255,.12);
}

.tp-side-plan-progress i{
  display:block;
  width:66%;
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg,#70df72,#55c663);
}

.tp-side-plan-card button{
  min-height:38px;
  margin-top:4px;
  border:1px solid rgba(255,255,255,.68);
  border-radius:9px;
  background:transparent;
  color:#fff;
  font:inherit;
  font-size:10px;
  font-weight:850;
  cursor:pointer;
}

.tp-side-plan-card button:hover{
  background:rgba(255,255,255,.08);
}

.tp-home-with-sidebar{
  padding-left:0!important;
  box-sizing:border-box;
  background:#f7f9f7;
}

.tp-home-with-sidebar .topbar{
  left:0!important;
  width:100%!important;
}

.tp-home-with-sidebar .content{
  max-width:1180px;
  margin:0 auto;
}

.tp-menu-trigger{
  cursor:pointer;
}

.tp-placeholder-top{
  height:72px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 28px;
  border-bottom:1px solid #e4e9e4;
  background:rgba(255,255,255,.96);
}

.tp-placeholder-top-left{
  display:flex;
  align-items:center;
  gap:8px;
}

.tp-placeholder-top>div:last-child{
  display:flex;
  gap:10px;
  align-items:center;
  border:1px solid #dfe6df;
  border-radius:12px;
  padding:8px 14px;
  background:#fff;
}

.tp-placeholder-top button{
  border:0;
  background:transparent;
  color:#176a37;
  font-weight:800;
  font-size:14px;
  cursor:pointer;
}

.tp-placeholder-top .tp-menu-trigger{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border:1px solid #e0e7e0;
  border-radius:10px;
  background:#fff;
  color:#174f31;
  font-size:18px;
}

.tp-placeholder-top div span{
  font-size:10px;
  color:#879087;
  text-transform:uppercase;
}

.tp-placeholder-top div strong{
  font-size:12px;
}

.tp-placeholder-main{
  max-width:1220px;
  margin:0 auto;
  padding:34px;
}

.tp-placeholder-heading{
  display:flex;
  align-items:center;
  gap:18px;
  margin-bottom:28px;
}

.tp-placeholder-icon{
  width:58px;
  height:58px;
  display:grid;
  place-items:center;
  border:1px solid #dce8dc;
  border-radius:18px;
  background:#eef7ed;
  font-size:28px;
}

.tp-placeholder-heading h1{
  margin:0;
  font-size:30px;
  letter-spacing:-.8px;
}

.tp-placeholder-heading p{
  margin:5px 0 0;
  color:#738078;
  font-size:14px;
}

.tp-coming-badge{
  margin-left:auto;
  border:1px solid #cfe4d0;
  background:#edf8ed;
  color:#18743a;
  border-radius:999px;
  padding:7px 11px;
  font-size:10px;
  font-weight:900;
  letter-spacing:.5px;
}

.tp-placeholder-cards{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:16px;
}

.tp-placeholder-cards article{
  min-height:190px;
  border:1px solid #e0e6e0;
  border-radius:18px;
  background:#fff;
  padding:20px;
  box-shadow:0 8px 26px rgba(24,55,35,.04);
}

.tp-placeholder-cards article>span{
  display:inline-grid;
  place-items:center;
  width:34px;
  height:34px;
  border-radius:10px;
  background:#edf6ed;
  color:#18723b;
  font-size:11px;
  font-weight:900;
}

.tp-placeholder-cards h3{
  margin:24px 0 8px;
  font-size:17px;
}

.tp-placeholder-cards p{
  min-height:42px;
  color:#7a857d;
  font-size:12px;
  line-height:1.55;
}

.tp-placeholder-cards button{
  border:0;
  background:transparent;
  color:#147038;
  font-weight:800;
  padding:0;
  cursor:default;
}

.tp-placeholder-preview{
  margin-top:18px;
  min-height:230px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:30px;
  padding:32px;
  border:1px solid #dfe8df;
  border-radius:20px;
  background:linear-gradient(120deg,#f1f8ef,#fff);
}

.tp-placeholder-preview small{
  color:#218143;
  font-weight:900;
  letter-spacing:1.2px;
}

.tp-placeholder-preview h2{
  font-size:25px;
  margin:9px 0;
}

.tp-placeholder-preview p{
  max-width:650px;
  color:#6f7d73;
  line-height:1.6;
}

.tp-placeholder-visual{
  width:170px;
  height:150px;
  display:grid;
  place-items:center;
  border-radius:28px;
  background:#e9f5e8;
  font-size:70px;
}

@media(max-width:899px){.tp-placeholder-cards{grid-template-columns:1fr}.tp-placeholder-main{padding:20px 15px}.tp-placeholder-heading{align-items:flex-start}.tp-coming-badge{display:none}.tp-placeholder-preview{padding:22px}.tp-placeholder-visual{display:none}.tp-placeholder-top{padding:0 14px}.tp-desktop-sidebar{width:min(86vw,285px)}}


/* ===== HAVA DURUMU / FOTOĞRAFLI HERO ===== */
.tp-weather-hero{
  min-height:190px;
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:18px;
  margin-bottom:14px;
  padding:24px 26px;
  border-radius:17px;
  background-position:center;
  background-size:cover;
  overflow:hidden;
  box-shadow:0 14px 34px rgba(25,58,73,.14);
}

.tp-weather-hero-copy{
  max-width:590px;
  color:#fff;
}

.tp-weather-hero-kicker{
  display:inline-flex;
  margin-bottom:8px;
  padding:5px 8px;
  border:1px solid rgba(255,255,255,.22);
  border-radius:999px;
  background:rgba(255,255,255,.11);
  font-size:7px;
  font-weight:950;
  letter-spacing:.09em;
  backdrop-filter:blur(5px);
}

.tp-weather-hero h1{
  margin:0;
  color:#fff !important;
  font-size:26px !important;
  line-height:1.04;
  letter-spacing:-.025em;
}

.tp-weather-hero p{
  max-width:560px;
  margin:8px 0 12px;
  color:rgba(255,255,255,.84) !important;
  font-size:9px !important;
  line-height:1.55;
}

.tp-weather-hero-pills{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}

.tp-weather-hero-pills span{
  padding:5px 8px;
  border-radius:8px;
  background:rgba(255,255,255,.13);
  color:#fff;
  font-size:7.5px;
  font-weight:820;
  backdrop-filter:blur(6px);
}

.tp-weather-location-card-hero{
  min-width:180px;
  align-self:flex-start;
  border:1px solid rgba(255,255,255,.24) !important;
  background:rgba(255,255,255,.91) !important;
  box-shadow:0 8px 24px rgba(10,33,43,.14);
  backdrop-filter:blur(8px);
}

@media(max-width:760px){
  .tp-weather-hero{
    min-height:180px;
    align-items:flex-start;
    flex-direction:column;
    padding:20px;
  }

  .tp-weather-hero h1{
    font-size:22px !important;
  }

  .tp-weather-location-card-hero{
    width:100%;
    min-width:0;
    box-sizing:border-box;
  }
}



/* ===== TARLA DETAYI / SOL ALT HIZLI İŞLEM MENÜSÜ ===== */
.tp-field-fab-backdrop{
  position:fixed;
  inset:0;
  z-index:43;
  border:0;
  background:rgba(245,248,244,.64);
  backdrop-filter:blur(1.5px);
}

.tp-field-fab-wrap{
  position:fixed;
  left:max(20px,calc((100vw - 760px)/2 + 20px));
  bottom:88px;
  z-index:50;
  display:flex;
  flex-direction:column-reverse;
  align-items:flex-start;
  gap:10px;
}

.tp-field-fab{
  width:64px;
  height:64px;
  display:grid;
  place-items:center;
  border:5px solid #fff;
  border-radius:50%;
  background:#2f8e47;
  color:#fff;
  box-shadow:0 10px 25px rgba(31,112,56,.28);
  font:inherit;
  font-size:38px;
  font-weight:300;
  line-height:1;
  cursor:pointer;
  transition:transform .2s ease,background .2s ease;
}

.tp-field-fab-wrap.open .tp-field-fab{
  background:#276f3b;
}

.tp-field-fab-menu{
  display:flex;
  flex-direction:column-reverse;
  gap:8px;
  opacity:0;
  pointer-events:none;
  transform:translateY(14px);
  transition:opacity .18s ease,transform .2s ease;
}

.tp-field-fab-wrap.open .tp-field-fab-menu{
  opacity:1;
  pointer-events:auto;
  transform:translateY(0);
}

.tp-field-fab-menu button{
  min-width:205px;
  min-height:48px;
  display:grid;
  grid-template-columns:40px 1fr;
  align-items:center;
  gap:9px;
  border:1px solid #e5ebe6;
  border-radius:24px;
  padding:4px 15px 4px 4px;
  background:#fff;
  color:#1d2d23;
  box-shadow:0 8px 22px rgba(24,52,33,.13);
  text-align:left;
  font:inherit;
  cursor:pointer;
}

.tp-field-fab-menu button span{
  width:40px;
  height:40px;
  display:grid;
  place-items:center;
  border-radius:50%;
  color:#fff;
  font-size:16px;
  font-weight:900;
}

.tp-field-fab-menu button strong{
  font-size:11px;
  font-weight:850;
}

.tp-field-fab-menu .green{background:#3e9b53}
.tp-field-fab-menu .amber{background:#d9a331}
.tp-field-fab-menu .blue{background:#527fb9}
.tp-field-fab-menu .purple{background:#7865a8}
.tp-field-fab-menu .cyan{background:#4b9697}
.tp-field-fab-menu .gray{background:#7c8580}

#field-info,
#field-production,
#field-sections,
#field-operations{
  scroll-margin-top:92px;
}

@media(max-width:560px){
  .tp-field-fab-wrap{
    left:14px;
    bottom:80px;
  }

  .tp-field-fab{
    width:58px;
    height:58px;
    font-size:34px;
  }

  .tp-field-fab-menu button{
    min-width:190px;
    min-height:46px;
  }
}

/* SVG'ler class CSS'i yüklenmese bile devleşmesin */
svg.tp-shortcut-svg,
svg.tp-premium-fieldmap-badge-icon{
  display:block !important;
  overflow:visible;
}

svg.tp-shortcut-svg{
  width:22px !important;
  height:22px !important;
  min-width:22px !important;
  min-height:22px !important;
  max-width:22px !important;
  max-height:22px !important;
}

svg.tp-premium-fieldmap-badge-icon{
  width:16px !important;
  height:16px !important;
  min-width:16px !important;
  min-height:16px !important;
  max-width:16px !important;
  max-height:16px !important;
}


/* SVG boyut güvenliği: ikonların kartı kaplamasını engeller */
.tp-shortcut-svg{
  width:22px !important;
  height:22px !important;
  max-width:22px !important;
  max-height:22px !important;
  flex:0 0 22px !important;
}

.tp-premium-fieldmap-badge-icon{
  width:16px !important;
  height:16px !important;
  max-width:16px !important;
  max-height:16px !important;
  flex:0 0 16px !important;
}


/* ===== YENİ TARLA: KAPAK FOTOĞRAFI + ŞIK KOMPAKT AKSİYONLAR ===== */
.tp-field-form-heading-cover{display:block!important;text-align:left!important;margin-bottom:18px!important}
.tp-new-field-cover{position:relative;height:190px;overflow:hidden;border-radius:22px;background:#e6eee5;box-shadow:0 12px 30px rgba(30,58,38,.11)}
.tp-new-field-cover img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 55%}
.tp-new-field-cover-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,24,13,.02) 22%,rgba(7,27,14,.72) 100%)}
.tp-new-field-cover-copy{position:absolute;left:22px;right:22px;bottom:19px;color:#fff}
.tp-new-field-cover-copy>span{display:inline-flex;margin-bottom:7px;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.14);backdrop-filter:blur(7px);font-size:8px;font-weight:900;letter-spacing:.1em}
.tp-new-field-cover-copy h1{margin:0!important;color:#fff!important;font-size:27px!important;line-height:1.05!important;text-align:left!important;text-shadow:0 2px 10px rgba(0,0,0,.18)}
.tp-new-field-cover-copy p{margin:7px 0 0!important;max-width:360px;color:rgba(255,255,255,.9)!important;font-size:11px!important;line-height:1.4!important;text-align:left!important}
.tp-new-field-intro{margin:12px 2px 0!important;color:#718077!important;font-size:10px!important;line-height:1.45!important;text-align:left!important}

.tp-parcel-lookup-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
.tp-parcel-search-button,.tp-parcel-tkgm-button{
  min-height:52px!important;height:auto!important;width:100%!important;
  display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;
  border:1px solid #dfe7df!important;border-radius:14px!important;padding:7px 10px!important;
  background:#fff!important;color:#29382f!important;box-shadow:0 5px 16px rgba(28,55,35,.055)!important;
  font-size:10px!important;font-weight:800!important;text-align:left!important;
}
.tp-parcel-search-button:hover:not(:disabled),.tp-parcel-tkgm-button:hover{background:#fbfdfb!important;border-color:#cad9cb!important}
.tp-parcel-button-icon{
  width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important;
  display:grid!important;place-items:center!important;border-radius:10px!important;background:#edf5ed!important;color:#2f7541!important;
}
.tp-parcel-button-icon.neutral{background:#f1f3f1!important;color:#59665e!important}
.tp-parcel-button-icon svg,.tp-parcel-search-button svg,.tp-parcel-tkgm-button svg{
  width:17px!important;height:17px!important;min-width:17px!important;min-height:17px!important;max-width:17px!important;max-height:17px!important;
  flex:0 0 17px!important;display:block!important;
}
.tp-parcel-spinner{width:17px!important;height:17px!important;min-width:17px!important;max-width:17px!important}
@media(max-width:560px){
 .tp-new-field-cover{height:165px;border-radius:18px}
 .tp-new-field-cover-copy{left:17px;right:17px;bottom:15px}
 .tp-new-field-cover-copy h1{font-size:24px!important}
 .tp-parcel-lookup-actions{grid-template-columns:1fr 1fr!important}
 .tp-parcel-search-button,.tp-parcel-tkgm-button{min-height:48px!important;padding:6px 8px!important;font-size:9px!important}
 .tp-parcel-button-icon{width:31px!important;height:31px!important;min-width:31px!important;max-width:31px!important}
}



/* ===== TOPRAK ANALİZİ V1 ===== */
.tp-soil-page{min-height:100vh;background:#f5f7f3;color:#1e2d23}
.tp-soil-topbar{height:64px;display:flex;align-items:center;gap:11px;padding:0 22px;border-bottom:1px solid #e2e8e1;background:rgba(255,255,255,.96);position:sticky;top:0;z-index:20}
.tp-soil-topbar>button{width:36px;height:36px;border:1px solid #dbe4dc;border-radius:10px;background:#fff;color:#245936;font-size:18px;cursor:pointer}
.tp-soil-topbar>div{display:flex;flex-direction:column;gap:2px}.tp-soil-topbar strong{font-size:13px}.tp-soil-topbar small{color:#849087;font-size:8px}
.tp-soil-main{width:min(1080px,calc(100% - 30px));margin:0 auto;padding:18px 0 90px}
.tp-soil-hero{min-height:192px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 30px;border:1px solid #dbe3d8;border-radius:20px;background:linear-gradient(135deg,#233e2c 0%,#395a3f 58%,#897b54 140%);color:#fff;overflow:hidden;box-shadow:0 16px 34px rgba(30,61,40,.12)}
.tp-soil-hero-copy{max-width:650px}.tp-soil-hero-kicker{display:inline-flex;margin-bottom:9px;padding:5px 8px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:7px;font-weight:950;letter-spacing:.09em}
.tp-soil-hero h1{max-width:620px;margin:0;color:#fff;font-size:28px;line-height:1.08;letter-spacing:-.03em}.tp-soil-hero p{max-width:610px;margin:9px 0 14px;color:rgba(255,255,255,.78);font-size:9px;line-height:1.55}
.tp-soil-hero-pills{display:flex;gap:7px;flex-wrap:wrap}.tp-soil-hero-pills span{padding:6px 9px;border-radius:9px;background:rgba(255,255,255,.10);font-size:7.5px;font-weight:800}
.tp-soil-hero-visual{position:relative;width:190px;height:140px;display:grid;place-items:center;flex:0 0 190px}.tp-soil-hero-visual span{position:relative;z-index:2;font-size:62px;filter:drop-shadow(0 8px 14px rgba(0,0,0,.18))}.tp-soil-hero-visual i{position:absolute;width:170px;height:85px;bottom:10px;border-radius:50%;background:linear-gradient(180deg,#6d5539,#402f21);transform:perspective(130px) rotateX(56deg);box-shadow:0 12px 30px rgba(0,0,0,.18)}
.tp-soil-actions-grid{display:grid;grid-template-columns:1.15fr .95fr;gap:14px;margin-top:14px}.tp-soil-card{border:1px solid #e0e6de;border-radius:17px;background:#fff;padding:17px;box-shadow:0 8px 26px rgba(31,58,39,.045)}
.tp-soil-card-title{display:flex;align-items:center;gap:10px;margin-bottom:13px}.tp-soil-card-title>div{display:flex;flex-direction:column;gap:2px}.tp-soil-card-title strong{font-size:12px}.tp-soil-card-title small{color:#8b958f;font-size:8px}.tp-soil-card-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;font-size:15px;font-weight:900}.tp-soil-card-icon.blue{background:#eaf2f7;color:#527a95}.tp-soil-card-icon.green{background:#e9f4ea;color:#3b8250}.tp-soil-card-icon.amber{background:#f6f0e2;color:#a9822d}
.tp-soil-dropzone{min-height:138px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1px dashed #cdd9ce;border-radius:14px;background:#fafcf9;cursor:pointer;text-align:center}.tp-soil-dropzone input{display:none}.tp-soil-dropzone>span{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#edf5ee;color:#347248;font-size:17px;font-weight:900}.tp-soil-dropzone strong{margin-top:3px;font-size:10px}.tp-soil-dropzone small{color:#919b94;font-size:8px}.tp-soil-dropzone.has-file{border-style:solid;border-color:#bcd2c0;background:#f5faf5}
.tp-soil-field-link{margin-top:13px;padding-top:13px;border-top:1px solid #eef1ed}.tp-soil-field-link>span{display:block;margin-bottom:7px;color:#67766c;font-size:7px;font-weight:950;letter-spacing:.08em}.tp-soil-field-link p{margin:7px 0 0;color:#7f8a82;font-size:8px}.tp-soil-field-link p strong{color:#2b5839}
.tp-soil-location-status{display:flex;align-items:center;gap:9px;padding:10px;border-radius:12px;background:#f5f8f4}.tp-soil-location-status>span{font-size:18px}.tp-soil-location-status>div{display:flex;flex-direction:column;gap:2px}.tp-soil-location-status small{color:#8b958d;font-size:7.5px}.tp-soil-location-status strong{font-size:9px}
.tp-soil-location-options{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.tp-soil-location-options button{display:flex;align-items:center;gap:8px;min-height:58px;padding:8px;border:1px solid #e1e8e1;border-radius:12px;background:#fff;text-align:left;font-family:inherit;cursor:pointer}.tp-soil-location-options button>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:#edf5ee;color:#2f7540;font-weight:900}.tp-soil-location-options button>div{display:flex;flex-direction:column;gap:2px}.tp-soil-location-options button strong{font-size:8.5px}.tp-soil-location-options button small{color:#929c95;font-size:7px}.tp-soil-location-options button.available{border-color:#c5dcc8;background:#f7fbf7}
.tp-soil-manual-location{margin-top:10px;padding:10px;border:1px solid #edf0ec;border-radius:12px;background:#fafbf9}.tp-soil-manual-location>small{display:block;margin-bottom:6px;color:#7f8a83;font-size:7.5px;font-weight:800}.tp-soil-manual-location>div{display:grid;grid-template-columns:1fr 1fr;gap:7px}.tp-soil-manual-location input{height:38px;border:1px solid #dfe6df;border-radius:9px;padding:0 10px;background:#fff;font:inherit;font-size:9px;outline:none}.tp-soil-location-message{margin:8px 0 0;color:#6f7d73;font-size:8px;line-height:1.4}.tp-soil-primary-outline{width:100%;min-height:39px;margin-top:10px;border:1px solid #33754a;border-radius:10px;background:#fff;color:#2e6c43;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
.tp-soil-guide-card{grid-column:1/-1}.tp-soil-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.tp-soil-steps>div{display:flex;flex-direction:column;align-items:flex-start;min-height:104px;padding:12px;border:1px solid #e7ebe5;border-radius:12px;background:#fbfcfa}.tp-soil-steps span{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#edf4ea;color:#3c7449;font-size:9px;font-weight:950}.tp-soil-steps strong{margin-top:8px;font-size:9px}.tp-soil-steps small{margin-top:3px;color:#8c968f;font-size:7.5px;line-height:1.35}
.tp-soil-ai-card{margin-top:14px;padding:18px;border:1px solid #d9e4d9;border-radius:17px;background:linear-gradient(135deg,#f7fbf7,#f4f7f0 65%,#faf7ef);box-shadow:0 9px 28px rgba(31,67,40,.055)}.tp-soil-ai-head{display:grid;grid-template-columns:46px 1fr auto;gap:11px;align-items:start}.tp-soil-ai-symbol{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:#2f7746;color:#fff;font-size:20px;box-shadow:0 8px 18px rgba(47,119,70,.18)}.tp-soil-ai-head>div:nth-child(2)>span{color:#4d7759;font-size:7px;font-weight:950;letter-spacing:.09em}.tp-soil-ai-head h2{margin:3px 0 4px;font-size:15px}.tp-soil-ai-head p{margin:0;color:#778379;font-size:8.5px;line-height:1.45}.tp-soil-ai-badge{padding:5px 8px;border-radius:999px;background:#fff;border:1px solid #d9e5da;color:#4a6d54;font-size:7px;font-weight:900}.tp-soil-ai-preview{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}.tp-soil-ai-preview>div{display:flex;flex-direction:column;gap:3px;padding:10px;border:1px solid #e2e8e0;border-radius:11px;background:rgba(255,255,255,.8)}.tp-soil-ai-preview small{color:#8b958f;font-size:7px}.tp-soil-ai-preview strong{font-size:8.5px}.tp-soil-ai-button{width:100%;min-height:42px;margin-top:11px;border:0;border-radius:11px;background:#286f40;color:#fff;font:inherit;font-size:9.5px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(40,111,64,.15)}.tp-soil-ai-button:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}.tp-soil-ai-message{margin-top:8px;padding:8px 10px;border-radius:9px;background:#fff;border:1px solid #e1e7df;color:#657268;font-size:8px}
.tp-soil-history-card{margin-top:14px;padding:17px;border:1px solid #e0e6de;border-radius:17px;background:#fff}.tp-soil-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.tp-soil-section-head>div{display:flex;flex-direction:column;gap:2px}.tp-soil-section-head span{color:#6a7b6e;font-size:7px;font-weight:950;letter-spacing:.08em}.tp-soil-section-head h2{margin:0;font-size:13px}.tp-soil-section-head button{border:0;background:transparent;color:#34764a;font:inherit;font-size:8px;font-weight:850;cursor:pointer}.tp-soil-empty-history{min-height:125px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-top:11px;border:1px dashed #dfe5dd;border-radius:13px;background:#fafbf9;text-align:center}.tp-soil-empty-history>span{font-size:23px}.tp-soil-empty-history strong{margin-top:4px;font-size:9.5px}.tp-soil-empty-history p{max-width:400px;margin:4px 0 0;color:#8a948d;font-size:8px}
.tp-detail-soil-shortcut{display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:10px!important;width:100%!important;border:1px solid #dce7dc!important;border-radius:12px!important;padding:10px!important;background:linear-gradient(135deg,#f7fbf7,#fff)!important;color:inherit!important;text-align:left!important;font:inherit!important;cursor:pointer!important}.tp-detail-soil-shortcut>div:nth-child(2){display:flex;flex-direction:column;gap:3px}.tp-detail-soil-shortcut strong{font-size:9px}.tp-detail-soil-shortcut p{margin:0;color:#849087;font-size:7.5px;line-height:1.4}.tp-detail-soil-shortcut>span{color:#438057;font-size:17px}
@media(max-width:760px){.tp-soil-main{width:min(100% - 16px,1080px);padding-top:10px}.tp-soil-hero{min-height:170px;padding:20px}.tp-soil-hero h1{font-size:21px}.tp-soil-hero-visual{display:none}.tp-soil-actions-grid{grid-template-columns:1fr}.tp-soil-guide-card{grid-column:auto}.tp-soil-steps{grid-template-columns:1fr 1fr}.tp-soil-ai-preview{grid-template-columns:1fr}.tp-soil-location-options{grid-template-columns:1fr}.tp-soil-ai-head{grid-template-columns:42px 1fr}.tp-soil-ai-badge{display:none}}

`;