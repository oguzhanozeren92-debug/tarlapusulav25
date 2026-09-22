import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../supabaseClient';
import KnowledgeAdminPanel from '../../features/knowledge/components/KnowledgeAdminPanel';
import OfficialVerificationAdminPanel from '../../features/official-verification/components/OfficialVerificationAdminPanel';
import type { CmsPageRow, CmsBlockRow, CmsMenuRow, CmsMediaRow } from '../../types';

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

export default function AdminPageBuilder({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'pages' | 'menu' | 'media' | 'theme' | 'knowledge' | 'official'>('pages');
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
          {([['pages','▦ Sayfa Tasarımcısı'],['menu','☰ Menü Yönetimi'],['media','🖼 Görseller'],['theme','⚙ Tema & Ölçüler'],['knowledge','◫ Bilgi Motoru'],['official','✓ Resmî Doğrulama']] as const).map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{...buttonStyle,background:tab===key?'#1f5a38':'#fff',color:tab===key?'#fff':'#294436',borderColor:tab===key?'#1f5a38':'#d8e2d9'}}>{label}</button>)}
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

        {!loading && tab==='knowledge' && <KnowledgeAdminPanel />}

        {!loading && tab==='official' && <OfficialVerificationAdminPanel />}

        {!loading && tab==='theme' && <section style={{...cardStyle,maxWidth:700}}><div><strong>Tema & Yerleşim Ölçüleri</strong><small style={{display:'block',color:'#829087',marginTop:2}}>Genel radius, boşluk, genişlik ve mobil alt menü yüksekliği</small></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:11,marginTop:14}}>{[['borderRadius','Köşe Yuvarlaklığı'],['cardGap','Kart Aralığı'],['contentMaxWidth','İçerik Maks. Genişliği'],['sidebarWidth','Sol Menü Genişliği'],['mobileBottomNavHeight','Mobil Alt Menü Yüksekliği'],['fontScale','Yazı Ölçeği']].map(([key,label])=><label key={key} style={labelStyle}>{label}<input type="number" step={key==='fontScale'?'0.05':'1'} style={inputStyle} value={theme[key] ?? ''} onChange={e=>setTheme(x=>({...x,[key]:Number(e.target.value)}))}/></label>)}</div><button disabled={saving} onClick={saveTheme} style={{...buttonStyle,marginTop:14,background:'#1f5a38',color:'#fff',borderColor:'#1f5a38'}}>Tema Ayarlarını Kaydet</button></section>}
      </main>

      {pageModal && editingPage && <Modal title={editingPage.id?'Sayfayı Düzenle':'Yeni Sayfa'} onClose={()=>setPageModal(false)}><form onSubmit={savePage} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Sayfa anahtarı<input disabled={!!editingPage.id} style={inputStyle} value={editingPage.page_key||''} onChange={e=>setEditingPage(x=>({...x!,page_key:e.target.value}))}/></label><label style={labelStyle}>Başlık<input style={inputStyle} value={editingPage.title||''} onChange={e=>setEditingPage(x=>({...x!,title:e.target.value}))}/></label></div><label style={labelStyle}>Alt başlık<input style={inputStyle} value={editingPage.subtitle||''} onChange={e=>setEditingPage(x=>({...x!,subtitle:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingPage.icon||''} onChange={e=>setEditingPage(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>İkon boyutu<input type="number" style={inputStyle} value={editingPage.icon_size??22} onChange={e=>setEditingPage(x=>({...x!,icon_size:Number(e.target.value)}))}/></label><label style={labelStyle}>İkon konumu<select style={inputStyle} value={editingPage.icon_position||'left'} onChange={e=>setEditingPage(x=>({...x!,icon_position:e.target.value}))}><option value="left">Sol</option><option value="right">Sağ</option><option value="top">Üst</option><option value="center">Orta</option></select></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Masaüstü kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_desktop??3} onChange={e=>setEditingPage(x=>({...x!,columns_desktop:Number(e.target.value)}))}/></label><label style={labelStyle}>Tablet kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_tablet??2} onChange={e=>setEditingPage(x=>({...x!,columns_tablet:Number(e.target.value)}))}/></label><label style={labelStyle}>Mobil kolon<input type="number" min="1" max="12" style={inputStyle} value={editingPage.columns_mobile??1} onChange={e=>setEditingPage(x=>({...x!,columns_mobile:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingPage.menu_order??0} onChange={e=>setEditingPage(x=>({...x!,menu_order:Number(e.target.value)}))}/></label><label style={labelStyle}>Üst boşluk<input type="number" style={inputStyle} value={editingPage.padding_top??24} onChange={e=>setEditingPage(x=>({...x!,padding_top:Number(e.target.value)}))}/></label><label style={labelStyle}>Alt boşluk<input type="number" style={inputStyle} value={editingPage.padding_bottom??24} onChange={e=>setEditingPage(x=>({...x!,padding_bottom:Number(e.target.value)}))}/></label></div><label style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={editingPage.is_visible??true} onChange={e=>setEditingPage(x=>({...x!,is_visible:e.target.checked}))}/> Uygulamada göster</label><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setPageModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}

      {blockModal && editingBlock && <Modal title={editingBlock.id?'Bloğu Düzenle':'Yeni Blok'} onClose={()=>setBlockModal(false)}><form onSubmit={saveBlock} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Sayfa<select style={inputStyle} value={editingBlock.page_key||selectedPageKey} onChange={e=>setEditingBlock(x=>({...x!,page_key:e.target.value}))}>{pages.map(p=><option key={p.id} value={p.page_key}>{p.title}</option>)}</select></label><label style={labelStyle}>Blok anahtarı<input disabled={!!editingBlock.id} style={inputStyle} value={editingBlock.block_key||''} onChange={e=>setEditingBlock(x=>({...x!,block_key:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}><label style={labelStyle}>Başlık<input style={inputStyle} value={editingBlock.title||''} onChange={e=>setEditingBlock(x=>({...x!,title:e.target.value}))}/></label><label style={labelStyle}>Tür<select style={inputStyle} value={editingBlock.block_type||'card'} onChange={e=>setEditingBlock(x=>({...x!,block_type:e.target.value}))}>{['card','hero','button','text','image','banner','list','weather','field','ai','custom'].map(x=><option key={x}>{x}</option>)}</select></label></div><label style={labelStyle}>Alt başlık<input style={inputStyle} value={editingBlock.subtitle||''} onChange={e=>setEditingBlock(x=>({...x!,subtitle:e.target.value}))}/></label><label style={labelStyle}>Açıklama<textarea rows={3} style={{...inputStyle,height:'auto',padding:10}} value={editingBlock.description||''} onChange={e=>setEditingBlock(x=>({...x!,description:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingBlock.icon||''} onChange={e=>setEditingBlock(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>İkon px<input type="number" style={inputStyle} value={editingBlock.icon_size??22} onChange={e=>setEditingBlock(x=>({...x!,icon_size:Number(e.target.value)}))}/></label><label style={labelStyle}>İkon yeri<select style={inputStyle} value={editingBlock.icon_position||'left'} onChange={e=>setEditingBlock(x=>({...x!,icon_position:e.target.value}))}><option value="left">Sol</option><option value="right">Sağ</option><option value="top">Üst</option><option value="center">Orta</option></select></label><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingBlock.position??0} onChange={e=>setEditingBlock(x=>({...x!,position:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Genişlik masaüstü<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_desktop??1} onChange={e=>setEditingBlock(x=>({...x!,width_desktop:Number(e.target.value)}))}/></label><label style={labelStyle}>Tablet<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_tablet??1} onChange={e=>setEditingBlock(x=>({...x!,width_tablet:Number(e.target.value)}))}/></label><label style={labelStyle}>Mobil<input type="number" min="1" max="12" style={inputStyle} value={editingBlock.width_mobile??1} onChange={e=>setEditingBlock(x=>({...x!,width_mobile:Number(e.target.value)}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Yatay hizalama<select style={inputStyle} value={editingBlock.align_horizontal||'left'} onChange={e=>setEditingBlock(x=>({...x!,align_horizontal:e.target.value}))}><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select></label><label style={labelStyle}>Dikey hizalama<select style={inputStyle} value={editingBlock.align_vertical||'center'} onChange={e=>setEditingBlock(x=>({...x!,align_vertical:e.target.value}))}><option value="top">Üst</option><option value="center">Orta</option><option value="bottom">Alt</option></select></label></div><label style={labelStyle}>Görsel URL<input style={inputStyle} value={editingBlock.image_url||''} onChange={e=>setEditingBlock(x=>({...x!,image_url:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Buton yazısı<input style={inputStyle} value={editingBlock.button_text||''} onChange={e=>setEditingBlock(x=>({...x!,button_text:e.target.value}))}/></label><label style={labelStyle}>Buton hedefi<input style={inputStyle} value={editingBlock.button_target||''} onChange={e=>setEditingBlock(x=>({...x!,button_target:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>Arka plan<input style={inputStyle} value={editingBlock.style_config?.backgroundColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),backgroundColor:e.target.value}}))}/></label><label style={labelStyle}>Yazı rengi<input style={inputStyle} value={editingBlock.style_config?.textColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),textColor:e.target.value}}))}/></label><label style={labelStyle}>Kenar rengi<input style={inputStyle} value={editingBlock.style_config?.borderColor||''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),borderColor:e.target.value}}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><label style={labelStyle}>Köşe px<input type="number" style={inputStyle} value={editingBlock.style_config?.borderRadius??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),borderRadius:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>İç boşluk px<input type="number" style={inputStyle} value={editingBlock.style_config?.padding??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),padding:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>Min yükseklik<input type="number" style={inputStyle} value={editingBlock.style_config?.minHeight??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),minHeight:e.target.value===''?undefined:Number(e.target.value)}}))}/></label><label style={labelStyle}>Yazı px<input type="number" style={inputStyle} value={editingBlock.style_config?.fontSize??''} onChange={e=>setEditingBlock(x=>({...x!,style_config:{...(x?.style_config||{}),fontSize:e.target.value===''?undefined:Number(e.target.value)}}))}/></label></div><label style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={editingBlock.is_visible??true} onChange={e=>setEditingBlock(x=>({...x!,is_visible:e.target.checked}))}/> Bloğu göster</label><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setBlockModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}

      {menuModal && editingMenu && <Modal title={editingMenu.id?'Menüyü Düzenle':'Yeni Menü'} onClose={()=>setMenuModal(false)}><form onSubmit={saveMenu} style={{padding:18,display:'grid',gap:11}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={labelStyle}>Menü anahtarı<input disabled={!!editingMenu.id} style={inputStyle} value={editingMenu.menu_key||''} onChange={e=>setEditingMenu(x=>({...x!,menu_key:e.target.value}))}/></label><label style={labelStyle}>Menü adı<input style={inputStyle} value={editingMenu.label||''} onChange={e=>setEditingMenu(x=>({...x!,label:e.target.value}))}/></label></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}><label style={labelStyle}>İkon<input style={inputStyle} value={editingMenu.icon||''} onChange={e=>setEditingMenu(x=>({...x!,icon:e.target.value}))}/></label><label style={labelStyle}>Sıra<input type="number" style={inputStyle} value={editingMenu.position??0} onChange={e=>setEditingMenu(x=>({...x!,position:Number(e.target.value)}))}/></label><label style={labelStyle}>Sayfa<select style={inputStyle} value={editingMenu.page_key||''} onChange={e=>setEditingMenu(x=>({...x!,page_key:e.target.value||null}))}><option value="">—</option>{pages.map(p=><option key={p.id} value={p.page_key}>{p.title}</option>)}</select></label></div><label style={labelStyle}>Rozet yazısı<input style={inputStyle} value={editingMenu.badge_text||''} onChange={e=>setEditingMenu(x=>({...x!,badge_text:e.target.value}))}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>{([['is_visible','Göster'],['show_desktop','Masaüstünde göster'],['show_mobile','Mobilde göster'],['show_bottom_nav','Alt menüde göster'],['admin_only','Sadece admin']] as const).map(([key,label])=><label key={key} style={{...labelStyle,display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={Boolean(editingMenu[key])} onChange={e=>setEditingMenu(x=>({...x!,[key]:e.target.checked}))}/>{label}</label>)}</div><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" style={buttonStyle} onClick={()=>setMenuModal(false)}>Vazgeç</button><button disabled={saving} style={{...buttonStyle,background:'#1f5a38',color:'#fff'}} type="submit">Kaydet</button></div></form></Modal>}
    </div>
  );
}

