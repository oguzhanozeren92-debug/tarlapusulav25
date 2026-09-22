import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  BellRing,
  Check,
  ChevronRight,
  CircleDollarSign,
  CloudRain,
  CreditCard,
  KeyRound,
  LogOut,
  MapPinned,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wheat,
} from 'lucide-react';
import { onboardingStyles } from '../../styles/onboardingStyles';
import type { Screen } from '../../types';
import { supabase } from '../../supabaseClient';
import ClassicBottomNav from '../../components/ClassicBottomNav';

type Setter<T> = (value: T) => void;

type PlaceholderInfo = {
  icon: string;
  title: string;
  subtitle: string;
  cards: string[];
};

type DesktopMenuItem = {
  screen: Screen;
  icon: string;
  label: string;
  badge?: string;
};

type PlaceholderScreenProps = {
  cmsRuntimeCss: string;
  placeholder: PlaceholderInfo;
  sideMenuOpen: boolean;
  screen: Screen;
  desktopMenuItems: DesktopMenuItem[];
  realFields?: any[];
  openFieldDetail?: (field: any, entry?: { actionTarget?: string | null }) => void;
  setScreen: Setter<Screen>;
  setSideMenuOpen: Setter<boolean>;
};

type NotificationPreferenceKey = 'field' | 'weather' | 'market' | 'pusula';

type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

type HubNotification = {
  id: string;
  kind: string;
  source: string;
  severity: string;
  title: string;
  message: string;
  target: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

const PREF_KEY = 'tp_notification_preferences_v1';
const DEFAULT_PREFS: NotificationPreferences = {
  field: true,
  weather: true,
  market: true,
  pusula: true,
};

const HUB_CSS = String.raw`
.tp-hub-page,
.tp-hub-page *{box-sizing:border-box}

.tp-hub-page{
  min-height:100vh;
  width:100%;
  max-width:760px;
  margin:0 auto;
  padding:78px 12px 0;
  background:#f7f8f9;
  color:#111827;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

.tp-hub-hero{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  margin:0 0 12px;
  padding:14px;
  border:1px solid #e1e5e9;
  border-radius:20px;
  background:#fff;
  box-shadow:0 10px 28px rgba(17,24,39,.045);
}

.tp-hub-eyebrow{
  display:block;
  margin-bottom:4px;
  color:#a88747;
  font-size:8px;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
}

.tp-hub-hero h1{
  margin:0;
  color:#111827;
  font-size:23px;
  line-height:1.05;
  letter-spacing:-.045em;
}

.tp-hub-hero p{
  max-width:470px;
  margin:7px 0 0;
  color:#69717d;
  font-size:11px;
  line-height:1.45;
}

.tp-hub-hero-icon{
  width:44px;
  min-width:44px;
  height:44px;
  display:grid;
  place-items:center;
  border:1px solid #e2e6ea;
  border-radius:14px;
  background:#f5f6f7;
  color:#111827;
}

.tp-hub-hero-icon svg{width:21px;height:21px}

.tp-hub-summary{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
  margin-bottom:12px;
}

.tp-hub-summary article{
  min-height:74px;
  padding:11px 10px;
  border:1px solid #e2e6ea;
  border-radius:16px;
  background:#fff;
}

.tp-hub-summary span{
  display:block;
  color:#7b8490;
  font-size:8px;
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:.06em;
}

.tp-hub-summary strong{
  display:block;
  margin-top:7px;
  color:#111827;
  font-size:21px;
  line-height:1;
}

.tp-hub-section{
  margin-bottom:12px;
  padding:13px;
  border:1px solid #e1e5e9;
  border-radius:18px;
  background:#fff;
}

.tp-hub-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
}

.tp-hub-section-head div{min-width:0}
.tp-hub-section-head small{
  display:block;
  color:#9a7a3c;
  font-size:7.5px;
  font-weight:900;
  letter-spacing:.12em;
  text-transform:uppercase;
}
.tp-hub-section-head strong{
  display:block;
  margin-top:2px;
  color:#111827;
  font-size:14px;
}
.tp-hub-section-head p{
  margin:3px 0 0;
  color:#7b8490;
  font-size:9px;
  line-height:1.4;
}

.tp-hub-soft-button,
.tp-hub-dark-button,
.tp-hub-danger-button{
  min-height:34px;
  padding:0 11px;
  border-radius:11px;
  font:800 9px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
  cursor:pointer;
}

.tp-hub-soft-button{
  border:1px solid #dde2e7;
  background:#f5f6f7;
  color:#111827;
}

.tp-hub-dark-button{
  border:1px solid #111827;
  background:#111827;
  color:#fff;
}

.tp-hub-danger-button{
  border:1px solid #e7d6d6;
  background:#fff7f7;
  color:#9d3030;
}

.tp-hub-soft-button:disabled,
.tp-hub-dark-button:disabled,
.tp-hub-danger-button:disabled{opacity:.48;cursor:not-allowed}

.tp-hub-filter-row{
  display:flex;
  gap:6px;
  overflow-x:auto;
  padding-bottom:2px;
  scrollbar-width:none;
}
.tp-hub-filter-row::-webkit-scrollbar{display:none}
.tp-hub-filter-row button{
  min-height:31px;
  flex:0 0 auto;
  padding:0 10px;
  border:1px solid #e1e5e9;
  border-radius:999px;
  background:#fff;
  color:#606975;
  font-size:8px;
  font-weight:850;
  cursor:pointer;
}
.tp-hub-filter-row button.active{
  border-color:#111827;
  background:#111827;
  color:#fff;
}

.tp-notification-list{display:grid;gap:7px}

.tp-notification-item{
  width:100%;
  display:grid;
  grid-template-columns:38px minmax(0,1fr) auto;
  gap:9px;
  align-items:start;
  padding:10px;
  border:1px solid #e5e8eb;
  border-radius:15px;
  background:#fff;
  color:#111827;
  text-align:left;
  cursor:pointer;
}

.tp-notification-item.unread{
  border-color:#cfd5db;
  background:#f5f6f7;
}

.tp-notification-icon{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border:1px solid #dfe3e7;
  border-radius:12px;
  background:#fff;
  color:#111827;
}
.tp-notification-icon svg{width:18px;height:18px}
.tp-notification-copy{min-width:0}
.tp-notification-copy strong{
  display:block;
  color:#111827;
  font-size:10.5px;
  line-height:1.25;
}
.tp-notification-copy p{
  margin:3px 0 0;
  color:#646d78;
  font-size:9px;
  line-height:1.42;
}
.tp-notification-meta{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:5px;
  margin-top:6px;
  color:#8a929d;
  font-size:7.5px;
}
.tp-notification-dot{
  width:7px;
  height:7px;
  margin-top:5px;
  border-radius:50%;
  background:#111827;
}
.tp-notification-severity{
  display:inline-flex;
  align-items:center;
  min-height:18px;
  padding:0 6px;
  border:1px solid #e1e5e9;
  border-radius:999px;
  background:#fff;
  color:#69717d;
  font-size:6.8px;
  font-weight:900;
  text-transform:uppercase;
}
.tp-notification-severity.high,
.tp-notification-severity.urgent{border-color:#e8cccc;color:#9c2f2f;background:#fff8f8}
.tp-notification-severity.warning{border-color:#eadfc7;color:#8b6d2b;background:#fffdf7}

.tp-hub-empty{
  padding:24px 14px;
  display:grid;
  place-items:center;
  text-align:center;
  border:1px dashed #d9dee3;
  border-radius:15px;
  background:#fafbfb;
}
.tp-hub-empty svg{width:24px;height:24px;color:#4b5563}
.tp-hub-empty strong{margin-top:8px;font-size:11px;color:#111827}
.tp-hub-empty p{max-width:330px;margin:5px 0 0;color:#7c8590;font-size:9px;line-height:1.45}

.tp-pref-list{display:grid;gap:7px}
.tp-pref-row{
  display:grid;
  grid-template-columns:36px minmax(0,1fr) auto;
  gap:9px;
  align-items:center;
  min-height:57px;
  padding:8px;
  border:1px solid #e5e8eb;
  border-radius:14px;
  background:#fafbfb;
}
.tp-pref-icon{
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border:1px solid #e1e5e9;
  border-radius:11px;
  background:#fff;
  color:#111827;
}
.tp-pref-icon svg{width:17px;height:17px}
.tp-pref-copy strong{display:block;font-size:10px;color:#111827}
.tp-pref-copy small{display:block;margin-top:2px;color:#7b8490;font-size:8px;line-height:1.35}
.tp-toggle{
  width:39px;
  height:23px;
  padding:2px;
  border:0;
  border-radius:999px;
  background:#d7dce1;
  cursor:pointer;
}
.tp-toggle i{
  width:19px;
  height:19px;
  display:block;
  border-radius:50%;
  background:#fff;
  box-shadow:0 1px 5px rgba(17,24,39,.18);
  transition:transform .16s ease;
}
.tp-toggle.on{background:#111827}
.tp-toggle.on i{transform:translateX(16px)}

.tp-settings-profile{
  display:grid;
  grid-template-columns:48px minmax(0,1fr);
  gap:10px;
  align-items:center;
  padding:10px;
  border:1px solid #e2e6ea;
  border-radius:15px;
  background:#fafbfb;
}
.tp-settings-avatar{
  width:48px;height:48px;display:grid;place-items:center;
  border:1px solid #dce1e5;border-radius:15px;background:#fff;color:#111827;
}
.tp-settings-avatar svg{width:22px;height:22px}
.tp-settings-profile strong{display:block;font-size:11px;color:#111827}
.tp-settings-profile span{display:block;margin-top:2px;color:#737c87;font-size:8.5px;word-break:break-word}

.tp-settings-input-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:9px}
.tp-settings-input-row input{
  width:100%;min-height:36px;padding:0 10px;border:1px solid #dfe4e8;border-radius:11px;background:#fff;color:#111827;font:700 9px system-ui;
}

.tp-plan-card{
  position:relative;
  overflow:hidden;
  padding:13px;
  border:1px solid #dfe4e8;
  border-radius:17px;
  background:#111827;
  color:#fff;
}
.tp-plan-card small{display:block;color:#b8c0cb;font-size:7px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.tp-plan-card h3{margin:4px 0 0;font-size:20px;letter-spacing:-.04em}
.tp-plan-card p{margin:5px 0 10px;color:#c7ced7;font-size:8.5px;line-height:1.42}
.tp-plan-card .tp-hub-soft-button{background:#fff;border-color:#fff;color:#111827}
.tp-plan-badge{position:absolute;top:12px;right:12px;padding:5px 8px;border-radius:999px;background:#fff;color:#111827;font-size:7px;font-weight:900}

.tp-settings-action-list{display:grid;gap:7px}
.tp-settings-action{
  width:100%;min-height:54px;display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:9px;align-items:center;padding:8px;border:1px solid #e4e8eb;border-radius:14px;background:#fafbfb;color:#111827;text-align:left;cursor:pointer;
}
.tp-settings-action>span:first-child{width:36px;height:36px;display:grid;place-items:center;border:1px solid #e0e4e8;border-radius:11px;background:#fff}
.tp-settings-action svg{width:17px;height:17px}
.tp-settings-action strong{display:block;font-size:10px}
.tp-settings-action small{display:block;margin-top:2px;color:#7b8490;font-size:8px;line-height:1.3}
.tp-settings-action>svg{width:15px;height:15px;color:#8b949f}

.tp-status-note{
  margin-top:8px;padding:9px 10px;border:1px solid #e2e6ea;border-radius:12px;background:#f7f8f9;color:#606975;font-size:8.5px;line-height:1.45;
}
.tp-status-note.success{border-color:#d8e4da;background:#f8fbf8;color:#375b3d}
.tp-status-note.error{border-color:#ead4d4;background:#fff8f8;color:#8c3737}

.tp-plan-modal-backdrop{position:fixed;z-index:2147483000;inset:0;border:0;background:rgba(17,24,39,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.tp-plan-modal{position:fixed;z-index:2147483001;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,760px);max-height:min(78vh,640px);overflow:auto;padding:14px 12px max(18px,env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:#fff;box-shadow:0 -18px 55px rgba(17,24,39,.18)}
.tp-plan-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.tp-plan-modal-head h3{margin:0;font-size:17px;color:#111827}
.tp-plan-modal-head button{width:34px;height:34px;border:1px solid #e0e5e9;border-radius:10px;background:#f6f7f8;color:#111827;font-size:18px;cursor:pointer}
.tp-plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.tp-plan-option{padding:11px 9px;border:1px solid #e1e5e9;border-radius:15px;background:#fafbfb}
.tp-plan-option.current{border-color:#111827;box-shadow:inset 0 0 0 1px #111827}
.tp-plan-option span{display:block;color:#8a929d;font-size:7px;font-weight:900;text-transform:uppercase}
.tp-plan-option strong{display:block;margin-top:4px;color:#111827;font-size:12px}
.tp-plan-option ul{margin:8px 0 0;padding-left:15px;color:#626b76;font-size:8px;line-height:1.55}

@media(max-width:560px){
  .tp-hub-page{padding:72px 8px 0}
  .tp-hub-hero{padding:12px;border-radius:17px}
  .tp-hub-hero h1{font-size:20px}
  .tp-hub-summary{gap:6px}
  .tp-hub-summary article{min-height:68px;padding:9px 8px;border-radius:14px}
  .tp-hub-summary strong{font-size:18px}
  .tp-hub-section{padding:10px;border-radius:16px}
  .tp-plan-grid{grid-template-columns:1fr}
}
`;

function readPreferences(): NotificationPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePreferences(value: NotificationPreferences) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(value));
  } catch {
    // localStorage kapalıysa sadece mevcut oturumda kullanılır.
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function notificationCategory(item: HubNotification): NotificationPreferenceKey {
  const source = `${item.kind} ${item.source} ${item.target ?? ''}`.toLocaleLowerCase('tr-TR');
  if (/weather|hava|rain|yağ|frost|don|wind|rüz/.test(source)) return 'weather';
  if (/market|price|fiyat|fuel|mazot|gübre/.test(source)) return 'market';
  if (/pusula|ai|assistant|zeka|zekâ/.test(source)) return 'pusula';
  return 'field';
}

function NotificationIcon({ category }: { category: NotificationPreferenceKey }) {
  if (category === 'weather') return <CloudRain />;
  if (category === 'market') return <CircleDollarSign />;
  if (category === 'pusula') return <Sparkles />;
  return <Wheat />;
}

function PreferenceRow({
  icon,
  title,
  detail,
  value,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="tp-pref-row">
      <span className="tp-pref-icon">{icon}</span>
      <div className="tp-pref-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <button
        type="button"
        className={`tp-toggle ${value ? 'on' : ''}`}
        aria-pressed={value}
        aria-label={`${title} ${value ? 'kapat' : 'aç'}`}
        onClick={onChange}
      >
        <i />
      </button>
    </div>
  );
}

function NotificationsHub({
  setScreen,
  realFields = [],
  openFieldDetail,
}: {
  setScreen: Setter<Screen>;
  realFields?: any[];
  openFieldDetail?: (field: any, entry?: { actionTarget?: string | null }) => void;
}) {
  const [items, setItems] = useState<HubNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | NotificationPreferenceKey>('all');
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => readPreferences());

  const loadNotifications = async () => {
    if (!supabase) {
      setLoading(false);
      setMessage('Bildirim verisi için bağlantı hazır değil.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setItems([]);
        setMessage('Bildirimleri görmek için oturum açmalısın.');
        return;
      }

      const { data, error } = await supabase
        .from('app_notifications')
        .select('id,kind,source,severity,title,message,target,data,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setItems(
        (data ?? []).map((item: any) => ({
          id: String(item.id),
          kind: String(item.kind ?? ''),
          source: String(item.source ?? ''),
          severity: String(item.severity ?? 'info'),
          title: String(item.title ?? 'Bildirim'),
          message: String(item.message ?? ''),
          target: item.target ? String(item.target) : null,
          data: item.data && typeof item.data === 'object' && !Array.isArray(item.data)
            ? item.data as Record<string, unknown>
            : {},
          isRead: Boolean(item.is_read),
          createdAt: String(item.created_at ?? ''),
        })),
      );
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
      setMessage(error instanceof Error ? error.message : 'Bildirimler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => notificationCategory(item) === filter);
  }, [items, filter]);

  const unreadCount = items.filter((item) => !item.isRead).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = items.filter((item) => item.createdAt.slice(0, 10) === todayKey).length;
  const importantCount = items.filter((item) => ['high', 'urgent', 'warning'].includes(item.severity.toLowerCase())).length;

  const markOneRead = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.isRead || !supabase) return;

    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, isRead: true } : entry));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Bildirim okundu işaretlenemedi:', error.message);
      void loadNotifications();
    }
  };

  const openNotification = async (item: HubNotification) => {
    await markOneRead(item.id);

    const actionTarget = String(item.data?.action_target ?? '').trim();
    if (item.target === 'field_growth' || actionTarget === 'field-growth') {
      const fieldId = String(item.data?.field_id ?? '').trim();
      const field = realFields.find((entry) => String(entry?.id ?? '') === fieldId);

      if (field && openFieldDetail) {
        openFieldDetail(field, { actionTarget: 'field-growth' });
      } else {
        setScreen('home');
      }
      return;
    }
  };

  const markAllRead = async () => {
    if (!supabase || unreadCount === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const previous = items;
    setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));

    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      setItems(previous);
      setMessage(error.message);
    }
  };

  const togglePreference = (key: NotificationPreferenceKey) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      savePreferences(next);
      return next;
    });
  };

  const filters: Array<{ key: 'all' | NotificationPreferenceKey; label: string }> = [
    { key: 'all', label: 'Tümü' },
    { key: 'field', label: 'Tarla' },
    { key: 'weather', label: 'Hava' },
    { key: 'market', label: 'Fiyat' },
    { key: 'pusula', label: 'Pusula' },
  ];

  return (
    <>
      <style>{HUB_CSS}</style>
      <main className="tp-hub-page">
        <section className="tp-hub-hero">
          <div>
            <span className="tp-hub-eyebrow">BİLDİRİM MERKEZİ</span>
            <h1>Bildirimler</h1>
            <p>Tarla riski, hava, yeni uydu verisi, Pusula ve fiyat gelişmelerini tek yerde takip et.</p>
          </div>
          <span className="tp-hub-hero-icon"><BellRing /></span>
        </section>

        <section className="tp-hub-summary">
          <article><span>Okunmamış</span><strong>{unreadCount}</strong></article>
          <article><span>Bugün</span><strong>{todayCount}</strong></article>
          <article><span>Önemli</span><strong>{importantCount}</strong></article>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>AKIŞ</small>
              <strong>Bildirim geçmişin</strong>
              <p>Gerçek uygulama bildirimleri burada listelenir.</p>
            </div>
            <button type="button" className="tp-hub-soft-button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Tümünü okundu yap
            </button>
          </div>

          <div className="tp-hub-filter-row">
            {filters.map((item) => (
              <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ height: 8 }} />

          {loading ? (
            <div className="tp-hub-empty"><RefreshCw /><strong>Bildirimler yükleniyor</strong><p>Son kayıtlar hazırlanıyor.</p></div>
          ) : filtered.length > 0 ? (
            <div className="tp-notification-list">
              {filtered.map((item) => {
                const category = notificationCategory(item);
                return (
                  <button key={item.id} type="button" className={`tp-notification-item ${item.isRead ? '' : 'unread'}`} onClick={() => void openNotification(item)}>
                    <span className="tp-notification-icon"><NotificationIcon category={category} /></span>
                    <span className="tp-notification-copy">
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <span className="tp-notification-meta">
                        <span>{formatDateTime(item.createdAt)}</span>
                        <span>•</span>
                        <span>{category === 'field' ? 'Tarla' : category === 'weather' ? 'Hava' : category === 'market' ? 'Piyasa' : 'Pusula'}</span>
                      </span>
                    </span>
                    <span>
                      {!item.isRead ? <i className="tp-notification-dot" /> : null}
                      <em className={`tp-notification-severity ${item.severity.toLowerCase()}`}>{item.severity || 'info'}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tp-hub-empty">
              <Bell />
              <strong>Bu filtrede bildirim yok</strong>
              <p>Yeni uydu haritası, tarla riski, hava uyarısı veya fiyat gelişmesi oluştuğunda burada görünecek.</p>
            </div>
          )}

          {message ? <div className="tp-status-note error">{message}</div> : null}
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>TERCİHLER</small>
              <strong>Neleri görmek istiyorsun?</strong>
              <p>Bu seçimler bildirim merkezindeki kullanıcı tercihlerindir.</p>
            </div>
          </div>

          <div className="tp-pref-list">
            <PreferenceRow icon={<Wheat />} title="Tarla ve uydu uyarıları" detail="NDVI, risk, saha kontrolü ve tarla değişimleri." value={preferences.field} onChange={() => togglePreference('field')} />
            <PreferenceRow icon={<CloudRain />} title="Hava uyarıları" detail="Yağış, don, rüzgâr ve ilaçlama açısından kritik hava." value={preferences.weather} onChange={() => togglePreference('weather')} />
            <PreferenceRow icon={<CircleDollarSign />} title="Piyasa ve fiyat" detail="Fiyat alarmı, mazot ve ürün piyasası hareketleri." value={preferences.market} onChange={() => togglePreference('market')} />
            <PreferenceRow icon={<Sparkles />} title="Pusula önerileri" detail="Pusula'nın önemli gördüğü aksiyon ve hatırlatmalar." value={preferences.pusula} onChange={() => togglePreference('pusula')} />
          </div>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>TELEFON</small>
              <strong>Telefon bildirimleri</strong>
              <p>Takvim hatırlatmaları ve uygulama kapalıyken gelen Web Push ayarları Takvim ekranından yönetilir.</p>
            </div>
            <button type="button" className="tp-hub-dark-button" onClick={() => setScreen('calendar')}>Yönet</button>
          </div>
        </section>

        <ClassicBottomNav activeScreen="notificationsHub" setScreen={setScreen} />
      </main>
    </>
  );
}

function SettingsHub({ setScreen }: { setScreen: Setter<Screen> }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('free');
  const [savingName, setSavingName] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountMessageTone, setAccountMessageTone] = useState<'success' | 'error' | ''>('');
  const [planOpen, setPlanOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => readPreferences());

  useEffect(() => {
    let alive = true;

    void (async () => {
      if (!supabase) return;
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user || !alive) return;

        setEmail(user.email ?? '');
        const metadataName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim();

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name,subscription_plan')
          .eq('id', user.id)
          .maybeSingle();

        if (!alive) return;
        setFullName(String(profile?.full_name ?? metadataName ?? '').trim());
        setPlan(String(profile?.subscription_plan ?? 'free').toLowerCase());
      } catch (error) {
        console.warn('Ayarlar hesabı yüklenemedi:', error);
      }
    })();

    return () => { alive = false; };
  }, []);

  const planLabel = plan === 'premium' ? 'Premium' : plan === 'plus' ? 'Plus' : 'Ücretsiz';
  const planText = plan === 'premium'
    ? 'Sınırsız tarla, tüm modüller ve tam Pusula asistanı.'
    : plan === 'plus'
      ? '10 tarla, gelişmiş uydu geçmişi, raporlar ve gelişmiş bildirimler.'
      : '1 aktif tarla ve temel TarlaPusula özellikleri.';

  const togglePreference = (key: NotificationPreferenceKey) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      savePreferences(next);
      return next;
    });
  };

  const saveName = async () => {
    if (!supabase) return;
    setSavingName(true);
    setAccountMessage('');
    setAccountMessageTone('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const name = fullName.trim();
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: name || null, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (authError) throw authError;

      setAccountMessage('Adın güncellendi.');
      setAccountMessageTone('success');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Hesap güncellenemedi.');
      setAccountMessageTone('error');
    } finally {
      setSavingName(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!supabase || !email) return;
    setAccountMessage('');
    setAccountMessageTone('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAccountMessage('Şifre yenileme bağlantısı e-posta adresine gönderildi.');
      setAccountMessageTone('success');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Şifre bağlantısı gönderilemedi.');
      setAccountMessageTone('error');
    }
  };

  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      <style>{HUB_CSS}</style>
      <main className="tp-hub-page">
        <section className="tp-hub-hero">
          <div>
            <span className="tp-hub-eyebrow">HESAP & UYGULAMA</span>
            <h1>Ayarlar</h1>
            <p>Hesabını, üyeliğini, bildirim tercihlerini ve güvenlik işlemlerini tek ekrandan yönet.</p>
          </div>
          <span className="tp-hub-hero-icon"><Settings /></span>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>HESAP</small>
              <strong>Profil bilgileri</strong>
              <p>TarlaPusula hesabında görünen temel bilgiler.</p>
            </div>
          </div>

          <div className="tp-settings-profile">
            <span className="tp-settings-avatar"><UserRound /></span>
            <div>
              <strong>{fullName || 'Üretici'}</strong>
              <span>{email || 'E-posta yükleniyor...'}</span>
            </div>
          </div>

          <div className="tp-settings-input-row">
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ad Soyad" aria-label="Ad Soyad" />
            <button type="button" className="tp-hub-dark-button" onClick={() => void saveName()} disabled={savingName}>
              {savingName ? 'Kaydediliyor' : 'Kaydet'}
            </button>
          </div>

          {accountMessage ? <div className={`tp-status-note ${accountMessageTone}`}>{accountMessage}</div> : null}
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>ÜYELİK</small>
              <strong>Planın ve kullanım hakkın</strong>
              <p>Mevcut planını gör ve TarlaPusula planlarını karşılaştır.</p>
            </div>
          </div>

          <div className="tp-plan-card">
            <span className="tp-plan-badge">{planLabel}</span>
            <small>MEVCUT PLAN</small>
            <h3>{planLabel}</h3>
            <p>{planText}</p>
            <button type="button" className="tp-hub-soft-button" onClick={() => setPlanOpen(true)}>Planları karşılaştır</button>
          </div>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>BİLDİRİMLER</small>
              <strong>Bildirim tercihleri</strong>
              <p>Hangi tür uyarıların senin için önemli olduğunu seç.</p>
            </div>
            <button type="button" className="tp-hub-soft-button" onClick={() => setScreen('notificationsHub')}>Merkezi aç</button>
          </div>

          <div className="tp-pref-list">
            <PreferenceRow icon={<MapPinned />} title="Tarla ve uydu" detail="NDVI, risk ve saha değişimleri." value={preferences.field} onChange={() => togglePreference('field')} />
            <PreferenceRow icon={<CloudRain />} title="Hava" detail="Yağış, don ve kritik rüzgâr." value={preferences.weather} onChange={() => togglePreference('weather')} />
            <PreferenceRow icon={<CircleDollarSign />} title="Piyasa" detail="Fiyat ve piyasa hareketleri." value={preferences.market} onChange={() => togglePreference('market')} />
            <PreferenceRow icon={<Sparkles />} title="Pusula" detail="Pusula'nın öneri ve görevleri." value={preferences.pusula} onChange={() => togglePreference('pusula')} />
          </div>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>GÜVENLİK</small>
              <strong>Hesap güvenliği</strong>
              <p>Şifre yenileme ve oturum işlemleri.</p>
            </div>
          </div>

          <div className="tp-settings-action-list">
            <button type="button" className="tp-settings-action" onClick={() => void sendPasswordReset()}>
              <span><KeyRound /></span>
              <span><strong>Şifremi yenile</strong><small>E-posta adresine güvenli şifre yenileme bağlantısı gönder.</small></span>
              <ChevronRight />
            </button>

            <button type="button" className="tp-settings-action" onClick={() => setScreen('notificationsHub')}>
              <span><Bell /></span>
              <span><strong>Bildirim merkezi</strong><small>Okunmamış uyarıları ve bildirim geçmişini yönet.</small></span>
              <ChevronRight />
            </button>

            <button type="button" className="tp-settings-action" onClick={() => setScreen('calendar')}>
              <span><ShieldCheck /></span>
              <span><strong>Telefon bildirimleri</strong><small>Web Push ve takvim hatırlatmalarını kontrol et.</small></span>
              <ChevronRight />
            </button>
          </div>
        </section>

        <section className="tp-hub-section">
          <div className="tp-hub-section-head">
            <div>
              <small>OTURUM</small>
              <strong>Hesap işlemleri</strong>
              <p>Bu cihazdaki TarlaPusula oturumunu yönet.</p>
            </div>
          </div>
          <button type="button" className="tp-hub-danger-button" onClick={() => void logout()}><LogOut size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Çıkış Yap</button>
        </section>

        <ClassicBottomNav activeScreen="settingsHub" setScreen={setScreen} />
      </main>

      {planOpen ? (
        <>
          <button type="button" className="tp-plan-modal-backdrop" aria-label="Plan karşılaştırmasını kapat" onClick={() => setPlanOpen(false)} />
          <section className="tp-plan-modal" role="dialog" aria-modal="true" aria-label="TarlaPusula planları">
            <div className="tp-plan-modal-head">
              <h3>TarlaPusula planları</h3>
              <button type="button" onClick={() => setPlanOpen(false)}>×</button>
            </div>
            <div className="tp-plan-grid">
              <article className={`tp-plan-option ${plan === 'free' ? 'current' : ''}`}>
                <span>{plan === 'free' ? 'MEVCUT' : 'PLAN'}</span>
                <strong>Ücretsiz</strong>
                <ul><li>1 aktif tarla</li><li>Temel uydu ve hava görünümü</li><li>Temel Pusula önerileri</li></ul>
              </article>
              <article className={`tp-plan-option ${plan === 'plus' ? 'current' : ''}`}>
                <span>{plan === 'plus' ? 'MEVCUT' : 'PLAN'}</span>
                <strong>Plus</strong>
                <ul><li>10 tarla</li><li>Gelişmiş uydu geçmişi</li><li>Raporlar ve gelişmiş bildirimler</li><li>Sulama zamanlama</li></ul>
              </article>
              <article className={`tp-plan-option ${plan === 'premium' ? 'current' : ''}`}>
                <span>{plan === 'premium' ? 'MEVCUT' : 'PLAN'}</span>
                <strong>Premium</strong>
                <ul><li>Sınırsız tarla</li><li>Tüm modüller</li><li>Tam Pusula asistanı</li><li>Gelişmiş analiz ve widget'lar</li></ul>
              </article>
            </div>
            <div className="tp-status-note">Ödeme sistemi bağlanana kadar burada yalnızca plan özellikleri karşılaştırılır; kullanıcıya sahte fiyat veya satın alma işlemi gösterilmez.</div>
          </section>
        </>
      ) : null}
    </>
  );
}

function LegacyPlaceholder({
  cmsRuntimeCss,
  placeholder,
  sideMenuOpen,
  screen,
  desktopMenuItems,
  setScreen,
  setSideMenuOpen,
}: PlaceholderScreenProps) {
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
              style={{ position: 'fixed', inset: 0, zIndex: 9997, border: 0, background: 'rgba(7,31,20,.38)' }}
            />

            <aside
              className="tp-desktop-sidebar tp-drawer-sidebar open"
              style={{
                position: 'fixed', top: 0, left: 0, zIndex: 9998, width: 225, height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '16px 10px 14px', background: 'linear-gradient(180deg,#064b2f 0%,#075638 58%,#043f29 100%)', color: '#fff', boxShadow: '12px 0 34px rgba(5,57,35,.22)', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 26px', alignItems: 'center', gap: 8, padding: '2px 4px 14px', borderBottom: '1px solid rgba(255,255,255,.10)' }}>
                <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: '#7be683', fontSize: 22 }}>🌱</div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-.35px', whiteSpace: 'nowrap' }}>TarlaPusula</strong>
                  <small style={{ display: 'block', marginTop: 1, color: 'rgba(255,255,255,.67)', fontSize: 8.5, whiteSpace: 'nowrap' }}>Tarla için akıllı rehber</small>
                </div>
                <button type="button" onClick={() => setSideMenuOpen(false)} aria-label="Menüyü kapat" style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', border: 0, borderRadius: 7, background: 'rgba(255,255,255,.07)', color: '#fff', fontSize: 17, cursor: 'pointer' }}>×</button>
              </div>

              <nav style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 2, overflowY: 'auto', padding: '12px 0 8px' }}>
                {desktopMenuItems.map((item, index) => {
                  const active = screen === item.screen;
                  return (
                    <button
                      key={`${item.label}-${index}`}
                      onClick={() => { setScreen(item.screen); setSideMenuOpen(false); }}
                      style={{ width: '100%', minHeight: 38, display: 'grid', gridTemplateColumns: '27px minmax(0,1fr) auto', alignItems: 'center', gap: 8, border: 0, borderRadius: 9, padding: '6px 9px', background: active ? 'linear-gradient(90deg,#21834b,#258d50)' : 'transparent', color: '#fff', boxShadow: active ? '0 7px 18px rgba(0,0,0,.14)' : 'none', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 720, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <span style={{ width: 27, height: 27, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 15 }}>{item.icon}</span>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      {item.badge ? <b style={{ borderRadius: 999, background: item.badge === 'YENİ' ? '#7bdd6e' : '#ed5147', color: item.badge === 'YENİ' ? '#083e27' : '#fff', padding: '3px 6px', fontSize: 7.5, fontWeight: 900 }}>{item.badge}</b> : null}
                    </button>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        <section className="tp-placeholder-page">
          <header className="tp-placeholder-top">
            <div className="tp-placeholder-top-left">
              <button type="button" className="tp-menu-trigger" onClick={() => setSideMenuOpen(true)}>☰</button>
              <button onClick={() => setScreen('home')}>← Ana Sayfa</button>
            </div>
            <div><span>Konum</span><strong>Tarla konumu</strong></div>
          </header>

          <main className="tp-placeholder-main">
            <div className="tp-placeholder-heading">
              <div className="tp-placeholder-icon">{placeholder.icon}</div>
              <div><h1>{placeholder.title}</h1><p>{placeholder.subtitle}</p></div>
              <span className="tp-coming-badge">HAZIRLANIYOR</span>
            </div>
            <div className="tp-placeholder-cards">
              {placeholder.cards.map((card, index) => (
                <article key={card}><span>{['01', '02', '03'][index]}</span><h3>{card}</h3><p>Bu modül hazırlanıyor.</p><button>Yakında →</button></article>
              ))}
            </div>
          </main>
        </section>
      </div>
    </>
  );
}

export default function PlaceholderScreen(props: PlaceholderScreenProps) {
  if (props.screen === 'notificationsHub') {
    return (
      <NotificationsHub
        setScreen={props.setScreen}
        realFields={props.realFields}
        openFieldDetail={props.openFieldDetail}
      />
    );
  }

  if (props.screen === 'settingsHub') {
    return <SettingsHub setScreen={props.setScreen} />;
  }

  return <LegacyPlaceholder {...props} />;
}
