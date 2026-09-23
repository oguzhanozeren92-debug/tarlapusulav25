import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  MousePointer2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import App from '../../App';
import { supabase } from '../../supabaseClient';
import PinnedCropSuitabilityNotification from '../notifications/components/PinnedCropSuitabilityNotification';
import ContentAdminPanel from '../content-admin/ContentAdminPanel';
import UiOverrideRuntime, { loadAndApplyUiOverrides } from './UiOverrideRuntime';
import './AdminModeShell.css';

type AdminPanel = 'none' | 'content' | 'users' | 'broadcast' | 'system';

type AdminMetrics = {
  users: number;
  fields: number;
  total_decare: number;
  active_push_users: number;
  pending_content: number;
  published_content: number;
  active_sources: number;
  notifications: number;
};

type AdminUserSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  full_name: string | null;
  username: string | null;
  onboarding_completed: boolean;
  subscription_plan: string;
  role: string;
  field_count: number;
  total_decare: number;
  crops: string[];
  active_push_count: number;
};

type UserDetail = {
  user: Record<string, any> | null;
  profile: Record<string, any> | null;
  fields: Record<string, any>[];
  todos: Record<string, any>[];
  notes: Record<string, any>[];
  expenses: Record<string, any>[];
  analyses: Record<string, any>[];
  notifications: Record<string, any>[];
};

type SelectedElement = {
  element: HTMLElement;
  selector: string;
  parentSelector: string | null;
  label: string;
  text: string;
  imageSrc: string;
  hidden: boolean;
  backgroundColor: string;
  color: string;
  fontSize: string;
  borderRadius: string;
  padding: string;
  index: number;
};

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function stableSelector(element: HTMLElement): string {
  const explicit = element.getAttribute('data-tp-admin-key');
  if (explicit) return `[data-tp-admin-key="${cssEscape(explicit)}"]`;
  if (element.id) return `#${cssEscape(element.id)}`;

  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && current !== document.body && depth < 7) {
    const tag = current.tagName.toLowerCase();
    const usableClasses = Array.from(current.classList)
      .filter((name) => name && !name.startsWith('is-') && !name.startsWith('active'))
      .slice(0, 2);
    let part = tag + usableClasses.map((name) => `.${cssEscape(name)}`).join('');

    const parent = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName,
      );
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    const selector = parts.join(' > ');
    try {
      if (document.querySelectorAll(selector).length === 1) return selector;
    } catch {
      // Bir üst seviyeyi dene.
    }

    current = parent;
    depth += 1;
  }

  return parts.join(' > ');
}

function directText(element: HTMLElement) {
  const textNode = Array.from(element.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent ?? '').trim(),
  );
  if (textNode) return String(textNode.textContent ?? '').trim();
  return element.children.length === 0 ? String(element.textContent ?? '').trim() : '';
}

function elementLabel(element: HTMLElement) {
  const text = directText(element);
  const cls = Array.from(element.classList).slice(0, 2).join('.');
  return text.slice(0, 48) || element.getAttribute('aria-label') || `${element.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
}

function snapshotElement(element: HTMLElement): SelectedElement {
  const computed = getComputedStyle(element);
  const parent = element.parentElement;
  return {
    element,
    selector: stableSelector(element),
    parentSelector: parent && parent !== document.body ? stableSelector(parent) : null,
    label: elementLabel(element),
    text: directText(element),
    imageSrc: element instanceof HTMLImageElement ? element.src : '',
    hidden: computed.display === 'none',
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    fontSize: computed.fontSize,
    borderRadius: computed.borderRadius,
    padding: computed.padding,
    index: parent ? Array.from(parent.children).indexOf(element) : 0,
  };
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function invokeAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-control-center', { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Admin işlemi başarısız.');
  return data;
}

function Metrics({ metrics }: { metrics: AdminMetrics | null }) {
  const items = [
    ['Kullanıcı', metrics?.users ?? 0],
    ['Tarla', metrics?.fields ?? 0],
    ['Toplam dekar', Math.round(metrics?.total_decare ?? 0)],
    ['Push açık', metrics?.active_push_users ?? 0],
    ['Onay bekleyen', metrics?.pending_content ?? 0],
    ['Yayında', metrics?.published_content ?? 0],
  ];
  return (
    <div className="tp-admin-metrics">
      {items.map(([label, value]) => (
        <article key={String(label)}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </div>
  );
}

export default function AdminModeShell() {
  const [panel, setPanel] = useState<AdminPanel>('none');
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState('info');
  const [broadcastTarget, setBroadcastTarget] = useState('notificationsHub');
  const [broadcastScope, setBroadcastScope] = useState<'all' | 'selected'>('all');
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');
  const dragRef = useRef<HTMLElement | null>(null);

  const loadOverview = async () => {
    setUsersLoading(true);
    try {
      const data = await invokeAdmin({ action: 'overview' });
      setMetrics(data.metrics as AdminMetrics);
      setUsers((data.users ?? []) as AdminUserSummary[]);
    } catch (error) {
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!editMode) {
      setSelected(null);
      document.documentElement.classList.remove('tp-admin-editing');
      return;
    }

    document.documentElement.classList.add('tp-admin-editing');

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[data-admin-ui="true"]')) return;
      if (target === document.body || target === document.documentElement) return;
      event.preventDefault();
      event.stopPropagation();
      setSelected(snapshotElement(target));
    };

    const onDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('[data-admin-ui="true"]')) return;
      dragRef.current = target;
      event.dataTransfer?.setData('text/plain', stableSelector(target));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      const dragged = dragRef.current;
      if (!target || !dragged || target === dragged) return;
      if (target.parentElement !== dragged.parentElement) return;
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      const dragged = dragRef.current;
      dragRef.current = null;
      if (!target || !dragged || target === dragged) return;
      if (!dragged.parentElement || target.parentElement !== dragged.parentElement) return;
      event.preventDefault();
      const parent = dragged.parentElement;
      const siblings = Array.from(parent.children);
      const targetIndex = siblings.indexOf(target);
      target.before(dragged);
      setSelected({ ...snapshotElement(dragged), index: targetIndex });
      void savePosition(dragged, targetIndex);
    };

    const candidates = Array.from(document.querySelectorAll<HTMLElement>('button,article,section,div,a,img,strong,h1,h2,h3,p,span'));
    candidates.forEach((element) => {
      if (!element.closest('[data-admin-ui="true"]')) element.draggable = true;
    });

    document.addEventListener('click', onClick, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);

    return () => {
      document.documentElement.classList.remove('tp-admin-editing');
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
      candidates.forEach((element) => element.removeAttribute('draggable'));
    };
  }, [editMode]);

  const savePosition = async (element: HTMLElement, index: number) => {
    const selector = stableSelector(element);
    const parent = element.parentElement;
    if (!parent) return;
    await saveOverride({
      ...snapshotElement(element),
      selector,
      parentSelector: stableSelector(parent),
      index,
    }, { positionOnly: true });
  };

  const saveOverride = async (
    value: SelectedElement,
    options: { positionOnly?: boolean } = {},
  ) => {
    setSaving(true);
    setEditMessage('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        selector: value.selector,
        label: value.label,
        parent_selector: value.parentSelector,
        position_index: value.index,
        enabled: true,
        updated_by: auth.user?.id ?? null,
      };

      if (!options.positionOnly) {
        payload.text_value = value.text || null;
        payload.image_src = value.imageSrc || null;
        payload.hidden = value.hidden;
        payload.style = {
          'background-color': value.backgroundColor,
          color: value.color,
          'font-size': value.fontSize,
          'border-radius': value.borderRadius,
          padding: value.padding,
        };
      }

      const { data: existing, error: findError } = await supabase
        .from('admin_ui_overrides')
        .select('id')
        .eq('selector', value.selector)
        .maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        const { error } = await supabase
          .from('admin_ui_overrides')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('admin_ui_overrides').insert({
          ...payload,
          created_by: auth.user?.id ?? null,
        });
        if (error) throw error;
      }

      await supabase.from('admin_audit_log').insert({
        admin_user_id: auth.user?.id ?? null,
        action: options.positionOnly ? 'ui_reorder' : 'ui_override_save',
        target_type: 'ui_element',
        target_id: value.selector,
        payload: { label: value.label },
      });

      window.dispatchEvent(new Event('tp-admin-ui-updated'));
      await loadAndApplyUiOverrides();
      setEditMessage(options.positionOnly ? 'Sıra kaydedildi.' : 'Değişiklik canlıya kaydedildi.');
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : 'Kaydetme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const moveSelected = (direction: -1 | 1) => {
    if (!selected?.element.parentElement) return;
    const parent = selected.element.parentElement;
    const siblings = Array.from(parent.children);
    const current = siblings.indexOf(selected.element);
    const target = current + direction;
    if (target < 0 || target >= siblings.length) return;
    const reference = siblings[target];
    if (direction < 0) reference.before(selected.element);
    else reference.after(selected.element);
    const next = { ...snapshotElement(selected.element), index: target };
    setSelected(next);
    void saveOverride(next, { positionOnly: true });
  };

  const loadUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setUserDetailLoading(true);
    try {
      const data = await invokeAdmin({ action: 'user_detail', user_id: userId });
      setUserDetail({
        user: data.user,
        profile: data.profile,
        fields: data.fields ?? [],
        todos: data.todos ?? [],
        notes: data.notes ?? [],
        expenses: data.expenses ?? [],
        analyses: data.analyses ?? [],
        notifications: data.notifications ?? [],
      });
    } catch (error) {
      console.error(error);
      setUserDetail(null);
    } finally {
      setUserDetailLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLocaleLowerCase('tr-TR');
    if (!q) return users;
    return users.filter((user) =>
      [user.email, user.full_name, user.username, ...(user.crops ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(q),
    );
  }, [users, userSearch]);

  const submitBroadcast = async (event: FormEvent) => {
    event.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    if (broadcastScope === 'all') {
      const ok = window.confirm(`Bu bildirim ${metrics?.users ?? users.length} kullanıcıya gönderilecek. Devam edilsin mi?`);
      if (!ok) return;
    }
    if (broadcastScope === 'selected' && !selectedUserId) {
      setBroadcastResult('Önce bir kullanıcı seç.');
      return;
    }

    setBroadcastBusy(true);
    setBroadcastResult('');
    try {
      const data = await invokeAdmin({
        action: 'broadcast',
        title: broadcastTitle,
        message: broadcastMessage,
        target: broadcastTarget,
        severity: broadcastSeverity,
        user_ids: broadcastScope === 'selected' ? [selectedUserId] : undefined,
      });
      setBroadcastResult(
        `${data.recipients} kullanıcıya uygulama bildirimi oluşturuldu. Push: ${data.push_sent} başarılı, ${data.push_failed} başarısız.`,
      );
      setBroadcastTitle('');
      setBroadcastMessage('');
      void loadOverview();
    } catch (error) {
      setBroadcastResult(error instanceof Error ? error.message : 'Bildirim gönderilemedi.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const closePanel = () => setPanel('none');

  return (
    <div className="tp-admin-mode-shell">
      <App />
      <PinnedCropSuitabilityNotification />
      <UiOverrideRuntime />

      <div className="tp-admin-mode-toolbar" data-admin-ui="true">
        <div className="tp-admin-mode-brand">
          <span>TP</span>
          <div><strong>ADMIN MODU</strong><small>Canlı uygulamayı düzenliyorsun</small></div>
        </div>
        <div className="tp-admin-mode-actions">
          <button className={editMode ? 'active' : ''} onClick={() => setEditMode((v) => !v)}>
            <MousePointer2 size={16} /> {editMode ? 'Düzenleme açık' : 'Düzenle'}
          </button>
          <button onClick={() => setPanel('content')}><FileText size={16} /> Haber Akışı</button>
          <button onClick={() => { setPanel('users'); void loadOverview(); }}><Users size={16} /> Kullanıcılar</button>
          <button onClick={() => setPanel('broadcast')}><Megaphone size={16} /> Bildirim</button>
          <button onClick={() => { setPanel('system'); void loadOverview(); }}><LayoutDashboard size={16} /> Sistem</button>
          <a href="/" title="Normal kullanıcı görünümü"><Eye size={16} /> Kullanıcı görünümü</a>
        </div>
      </div>

      {editMode && (
        <div className="tp-admin-edit-hint" data-admin-ui="true">
          <Pencil size={15} /> Düzenlemek istediğin yazı, ikon, kart veya pencereye dokun. Kartları aynı alan içinde sürükleyebilirsin.
        </div>
      )}

      {editMode && selected && (
        <aside className="tp-admin-inspector" data-admin-ui="true">
          <header>
            <div><span>SEÇİLİ ÖĞE</span><strong>{selected.label}</strong><small>{selected.selector}</small></div>
            <button onClick={() => setSelected(null)}><X size={18} /></button>
          </header>

          <div className="tp-admin-inspector-body">
            {selected.text !== '' && (
              <label>Görünen yazı
                <textarea value={selected.text} onChange={(e) => setSelected({ ...selected, text: e.target.value })} rows={3} />
              </label>
            )}
            {selected.element instanceof HTMLImageElement && (
              <label>Görsel / ikon adresi
                <input value={selected.imageSrc} onChange={(e) => setSelected({ ...selected, imageSrc: e.target.value })} />
              </label>
            )}

            <div className="tp-admin-two-col">
              <label>Arka plan<input type="color" value={toColor(selected.backgroundColor, '#ffffff')} onChange={(e) => setSelected({ ...selected, backgroundColor: e.target.value })} /></label>
              <label>Yazı rengi<input type="color" value={toColor(selected.color, '#111111')} onChange={(e) => setSelected({ ...selected, color: e.target.value })} /></label>
            </div>
            <div className="tp-admin-two-col">
              <label>Yazı boyutu<input value={selected.fontSize} onChange={(e) => setSelected({ ...selected, fontSize: e.target.value })} placeholder="14px" /></label>
              <label>Köşe<input value={selected.borderRadius} onChange={(e) => setSelected({ ...selected, borderRadius: e.target.value })} placeholder="12px" /></label>
            </div>
            <label>İç boşluk<input value={selected.padding} onChange={(e) => setSelected({ ...selected, padding: e.target.value })} placeholder="12px" /></label>

            <div className="tp-admin-inspector-actions">
              <button onClick={() => setSelected({ ...selected, hidden: !selected.hidden })}>
                {selected.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {selected.hidden ? 'Göster' : 'Gizle'}
              </button>
              <button onClick={() => moveSelected(-1)}><ChevronUp size={15} /> Yukarı</button>
              <button onClick={() => moveSelected(1)}><ChevronDown size={15} /> Aşağı</button>
            </div>

            <button className="tp-admin-save-live" disabled={saving} onClick={() => void saveOverride(selected)}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Canlıya Kaydet
            </button>
            {editMessage && <div className="tp-admin-inline-message"><Check size={14} /> {editMessage}</div>}
          </div>
        </aside>
      )}

      {panel !== 'none' && (
        <div className="tp-admin-drawer-backdrop" data-admin-ui="true" onMouseDown={(e) => { if (e.target === e.currentTarget) closePanel(); }}>
          <aside className="tp-admin-drawer">
            <header className="tp-admin-drawer-head">
              <div>
                <span>ADMIN ARACI</span>
                <strong>{panelTitle(panel)}</strong>
              </div>
              <button onClick={closePanel}><X size={19} /></button>
            </header>

            <div className="tp-admin-drawer-body">
              {panel === 'content' && <ContentAdminPanel />}

              {panel === 'users' && (
                <>
                  <Metrics metrics={metrics} />
                  <div className="tp-admin-user-search"><Search size={16} /><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="İsim, email veya ürün ara" /><button onClick={() => void loadOverview()}><RefreshCw size={15} /></button></div>
                  <div className="tp-admin-users-layout">
                    <div className="tp-admin-user-list">
                      {usersLoading && <div className="tp-admin-empty"><LoaderCircle className="spin" /> Kullanıcılar yükleniyor…</div>}
                      {!usersLoading && filteredUsers.map((user) => (
                        <button key={user.id} className={selectedUserId === user.id ? 'active' : ''} onClick={() => void loadUserDetail(user.id)}>
                          <span className="avatar"><CircleUserRound size={18} /></span>
                          <span><strong>{user.full_name || user.username || user.email || 'Kullanıcı'}</strong><small>{user.email || 'Email yok'} · {user.subscription_plan}</small><em>{user.field_count} tarla · {Math.round(user.total_decare)} da · {(user.crops || []).join(', ') || 'Ürün yok'}</em></span>
                        </button>
                      ))}
                    </div>
                    <div className="tp-admin-user-detail">
                      {!selectedUserId && <div className="tp-admin-empty">Profilini görmek için bir kullanıcı seç.</div>}
                      {userDetailLoading && <div className="tp-admin-empty"><LoaderCircle className="spin" /> Profil hazırlanıyor…</div>}
                      {!userDetailLoading && userDetail && <UserProfile detail={userDetail} />}
                    </div>
                  </div>
                </>
              )}

              {panel === 'broadcast' && (
                <form className="tp-admin-broadcast" onSubmit={submitBroadcast}>
                  <div className="tp-admin-broadcast-scope">
                    <button type="button" className={broadcastScope === 'all' ? 'active' : ''} onClick={() => setBroadcastScope('all')}>Herkese</button>
                    <button type="button" className={broadcastScope === 'selected' ? 'active' : ''} onClick={() => setBroadcastScope('selected')}>Seçili kullanıcıya</button>
                  </div>
                  {broadcastScope === 'selected' && (
                    <label>Kullanıcı<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">Kullanıcı seç</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>)}</select></label>
                  )}
                  <label>Başlık<input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Örn. Yeni uydu analizi hazır" /></label>
                  <label>Mesaj<textarea rows={5} value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Kullanıcının göreceği mesaj" /></label>
                  <div className="tp-admin-two-col">
                    <label>Önem<select value={broadcastSeverity} onChange={(e) => setBroadcastSeverity(e.target.value)}><option value="info">Bilgi</option><option value="warning">Uyarı</option><option value="critical">Kritik</option></select></label>
                    <label>Açılacak ekran<select value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)}><option value="notificationsHub">Bildirimler</option><option value="home">Ana Sayfa</option><option value="agendaHub">Tarım Gündemi</option><option value="weatherHub">Hava Durumu</option><option value="fieldControlHub">Tarla Kontrolü</option></select></label>
                  </div>
                  <button className="tp-admin-send" disabled={broadcastBusy} type="submit">{broadcastBusy ? <LoaderCircle className="spin" size={16} /> : <Bell size={16} />} Bildirimi Gönder</button>
                  {broadcastResult && <div className="tp-admin-result">{broadcastResult}</div>}
                </form>
              )}

              {panel === 'system' && (
                <div className="tp-admin-system">
                  <Metrics metrics={metrics} />
                  <section><Settings2 size={20} /><div><strong>Admin API</strong><span>admin-control-center · JWT + admin_users kontrolü</span></div><b className="ok">AKTİF</b></section>
                  <section><FileText size={20} /><div><strong>İçerik motoru</strong><span>{metrics?.active_sources ?? 0} aktif kaynak · {metrics?.pending_content ?? 0} onay bekleyen · {metrics?.published_content ?? 0} yayında</span></div></section>
                  <section><Bell size={20} /><div><strong>Push kullanıcıları</strong><span>{metrics?.active_push_users ?? 0} kullanıcıda aktif cihaz aboneliği var</span></div></section>
                  <button onClick={() => void loadOverview()}><RefreshCw size={16} /> Verileri yenile</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function UserProfile({ detail }: { detail: UserDetail }) {
  const name = detail.profile?.full_name || detail.profile?.username || detail.user?.email || 'Kullanıcı';
  return (
    <div className="tp-admin-profile">
      <header><CircleUserRound size={28} /><div><strong>{name}</strong><span>{detail.user?.email || 'Email yok'}</span><small>Son giriş: {fmtDate(detail.user?.last_sign_in_at)}</small></div></header>
      <div className="tp-admin-profile-stats"><article><strong>{detail.fields.length}</strong><span>Tarla</span></article><article><strong>{detail.todos.length}</strong><span>Görev kaydı</span></article><article><strong>{detail.analyses.length}</strong><span>AI analiz</span></article><article><strong>{detail.notifications.length}</strong><span>Bildirim</span></article></div>
      <h4>Tarlalar</h4>
      <div className="tp-admin-profile-fields">{detail.fields.length ? detail.fields.map((field) => <article key={field.id}><strong>{field.name || 'Tarla'}</strong><span>{field.crop || 'Ürün belirtilmemiş'} · {Number(field.area_decare || 0).toLocaleString('tr-TR')} da</span><small>{[field.city, field.district, field.village].filter(Boolean).join(' / ') || 'Konum yok'}</small></article>) : <p>Tarla yok.</p>}</div>
      <h4>Son görev / işlemler</h4>
      <div className="tp-admin-profile-timeline">{detail.todos.slice(0, 8).map((todo) => <article key={todo.id}><span className={todo.completed ? 'done' : ''} /><div><strong>{todo.title || todo.task_key || 'Görev'}</strong><small>{todo.completed ? 'Tamamlandı' : 'Açık'} · {fmtDate(todo.created_at)}</small></div></article>)}{detail.notes.slice(0, 4).map((note) => <article key={note.id}><span /><div><strong>Tarla notu</strong><small>{String(note.note_text || '').slice(0, 100)} · {fmtDate(note.created_at)}</small></div></article>)}</div>
    </div>
  );
}

function panelTitle(panel: AdminPanel) {
  if (panel === 'content') return 'Haber & İçerik Akışı';
  if (panel === 'users') return 'Kullanıcılar';
  if (panel === 'broadcast') return 'Toplu Bildirim';
  if (panel === 'system') return 'Sistem Özeti';
  return '';
}

function toColor(value: string, fallback: string) {
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return fallback;
  return `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}
