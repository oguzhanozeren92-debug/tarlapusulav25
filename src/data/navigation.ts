import type { Screen } from '../types';

export type DesktopMenuItem = {
  screen: Screen;
  icon: string;
  label: string;
  badge?: string;
};

export type PlaceholderMeta = {
  title: string;
  subtitle: string;
  icon: string;
  cards: string[];
};

export const FALLBACK_DESKTOP_MENU_ITEMS: DesktopMenuItem[] = [
  { screen: 'home', icon: '⌂', label: 'Ana Sayfa' },
  { screen: 'home', icon: '▦', label: 'Tarlalarım' },
  { screen: 'weatherHub', icon: '☀', label: 'Hava Durumu' },
  { screen: 'fieldControlHub', icon: '⌖', label: 'Tarla Kontrolü' },
  { screen: 'soilAnalysisHub', icon: '♧', label: 'Toprak Analizi' },
  { screen: 'inventoryHub', icon: '▣', label: 'İlaç & Gübre Depom' },
  { screen: 'marketHub', icon: '▥', label: 'Piyasa Fiyatları' },
  { screen: 'supportHub', icon: '▤', label: 'Tarımsal Destek' },
  { screen: 'agendaHub', icon: '♧', label: 'Tarım Gündemi', badge: 'YENİ' },
  { screen: 'nutritionHub', icon: '◉', label: 'Bitki Besin Maddeleri', badge: 'YENİ' },
  { screen: 'pestGuideHub', icon: '✥', label: 'Hastalık & Zararlı Rehberi' },
  { screen: 'producerMarketHub', icon: '▱', label: 'Üretici Pazarı', badge: 'YENİ' },
  { screen: 'fieldNotebookHub', icon: '▧', label: 'Tarla Defteri' },
  { screen: 'notificationsHub', icon: '♢', label: 'Bildirimler' },
  { screen: 'settingsHub', icon: '⚙', label: 'Ayarlar' },
];

export const BASE_PLACEHOLDER_META: Partial<Record<Screen, PlaceholderMeta>> = {
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

export const weatherIcon = (condition?: string) => {
  const value = (condition ?? '').toLocaleLowerCase('tr-TR');

  if (value.includes('yağ') || value.includes('sağanak')) return '🌧️';
  if (value.includes('kar')) return '🌨️';
  if (value.includes('fırt') || value.includes('gök')) return '⛈️';
  if (value.includes('bulut') || value.includes('kapalı')) return '☁️';
  if (value.includes('sis')) return '🌫️';

  return '☀️';
};

export const weatherDayLabel = (index: number) => {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';
  return `${index}. Gün Sonra`;
};
