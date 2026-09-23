import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAdminRole } from '../app-shell/hooks/useAdminRole';
import ContentAdminPanel from '../content-admin/ContentAdminPanel';
import {
  deleteAdminUiOverride,
  fetchAdminAudit,
  fetchAdminOverview,
  fetchAdminUserDetail,
  saveAdminUiOverride,
  sendAdminBroadcast,
  type AdminAuditRow,
  type AdminMetrics,
  type AdminOverviewResponse,
  type AdminUserDetailResponse,
  type AdminUserSummary,
} from './adminControl.service';
import './InAppAdminMode.css';

type Panel = 'overview' | 'edit' | 'content' | 'users' | 'broadcast' | 'audit';
type Preset = 'same' | 'white' | 'black' | 'transparent';
type TextPreset = 'same' | 'black' | 'white';
type SizePreset = 'same' | 'small' | 'normal' | 'large';
type WidthPreset = 'same' | 'auto' | 'full';
type RadiusPreset = 'same' | 'sharp' | 'soft' | 'round';

type SelectedElement = {
  selector: string;
  parentSelector: string | null;
  positionIndex: number | null;
  label: string;
  tag: string;
  text: string;
  image: string;
  hasChildren: boolean;
};

type SiblingRow = {
  selector: string;
  label: string;
  index: number;
};

type Draft = {
  text: string;
  image: string;
  hidden: boolean;
  background: Preset;
  textTone: TextPreset;
  size: SizePreset;
  width: WidthPreset;
  radius: RadiusPreset;
};

const EMPTY_METRICS: AdminMetrics = {
  users: 0,
  active_7d: 0,
  active_30d: 0,
  fields: 0,
  total_decare: 0,
  active_push_users: 0,
  pending_content: 0,
  published_content: 0,
  active_sources: 0,
  notifications: 0,
};

const DEFAULT_DRAFT: Draft = {
  text: '',
  image: '',
  hidden: false,
  background: 'same',
  textTone: 'same',
  size: 'same',
  width: 'same',
  radius: 'same',
};

function escapeCss(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

function uniqueSelector(selector: string, element: Element) {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

function stableClasses(element: Element) {
  return Array.from(element.classList)
    .filter((name) =>
      name &&
      !/^(active|open|selected|hover|focus|disabled|loading|show|hide)$/i.test(name) &&
      !name.startsWith('tp-admin-') &&
      name.length < 80,
    )
    .slice(0, 3);
}

function selectorFor(element: Element | null): string | null {
  if (!element || element === document.documentElement || element === document.body) return null;

  const html = element as HTMLElement;
  if (html.id) {
    const byId = `#${escapeCss(html.id)}`;
    if (uniqueSelector(byId, element)) return byId;
  }

  for (const key of ['data-cms-key', 'data-testid', 'data-block-key', 'data-screen', 'aria-label']) {
    const value = element.getAttribute(key);
    if (!value || value.length > 120) continue;
    const candidate = `${element.tagName.toLowerCase()}[${key}="${value.replace(/"/g, '\\"')}"]`;
    if (uniqueSelector(candidate, element)) return candidate;
  }

  const classes = stableClasses(element);
  if (classes.length) {
    const candidate = `${element.tagName.toLowerCase()}.${classes.map(escapeCss).join('.')}`;
    if (uniqueSelector(candidate, element)) return candidate;
  }

  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && depth < 6 && current !== document.body; depth += 1) {
    const tag = current.tagName.toLowerCase();
    const cls = stableClasses(current).slice(0, 1);
    let part = tag + (cls.length ? `.${escapeCss(cls[0])}` : '');
    const parent: Element | null = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((child: Element) => child.tagName === current?.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    const candidate = parts.join(' > ');
    if (uniqueSelector(candidate, element)) return candidate;
    current = parent;
  }

  return parts.join(' > ') || null;
}

function cleanLabel(element: Element) {
  const aria = element.getAttribute('aria-label') || element.getAttribute('title') || '';
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  const imageAlt = element instanceof HTMLImageElement ? element.alt : '';
  return (aria || imageAlt || text || element.tagName).slice(0, 100);
}

function findEditableElement(target: EventTarget | null) {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== document.body) {
    if (element.closest('[data-tp-admin-ui="1"]')) return null;
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const useful =
      element.hasAttribute('data-admin-editable') ||
      ['button', 'a', 'img', 'input', 'textarea', 'select', 'label', 'h1', 'h2', 'h3', 'h4', 'p', 'li'].includes(tag) ||
      (['span', 'strong', 'small'].includes(tag) && cleanLabel(element).length > 0) ||
      (element.classList.length > 0 && rect.width > 40 && rect.height > 28 && rect.width < window.innerWidth * 0.98);
    if (useful && rect.width > 8 && rect.height > 8) return element;
    element = element.parentElement;
  }
  return null;
}

function selectedFrom(element: HTMLElement): SelectedElement | null {
  const selector = selectorFor(element);
  if (!selector) return null;
  const parentSelector = selectorFor(element.parentElement);
  const positionIndex = element.parentElement
    ? Array.from(element.parentElement.children).indexOf(element)
    : null;
  return {
    selector,
    parentSelector,
    positionIndex,
    label: cleanLabel(element),
    tag: element.tagName.toLowerCase(),
    text: element.childElementCount === 0 ? (element.textContent || '').trim() : '',
    image: element instanceof HTMLImageElement ? element.currentSrc || element.src || '' : '',
    hasChildren: element.childElementCount > 0,
  };
}

function styleFromDraft(draft: Draft) {
  const style: Record<string, string> = {};
  if (draft.background === 'white') style['background-color'] = '#ffffff';
  if (draft.background === 'black') style['background-color'] = '#080808';
  if (draft.background === 'transparent') style['background-color'] = 'transparent';
  if (draft.textTone === 'black') style.color = '#111111';
  if (draft.textTone === 'white') style.color = '#ffffff';
  if (draft.size === 'small') style['font-size'] = '12px';
  if (draft.size === 'normal') style['font-size'] = '15px';
  if (draft.size === 'large') style['font-size'] = '20px';
  if (draft.width === 'auto') style.width = 'auto';
  if (draft.width === 'full') {
    style.width = '100%';
    style['max-width'] = 'none';
  }
  if (draft.radius === 'sharp') style['border-radius'] = '0px';
  if (draft.radius === 'soft') style['border-radius'] = '14px';
  if (draft.radius === 'round') style['border-radius'] = '999px';
  return style;
}

function dateText(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function numberText(value: number | null | undefined, digits = 0) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

export default function InAppAdminMode() {
  const isAdmin = useAdminRole();
  const [modeOpen, setModeOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('overview');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [siblings, setSiblings] = useState<SiblingRow[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'plan' | 'crop' | 'selected'>('all');
  const [broadcastPlan, setBroadcastPlan] = useState('free');
  const [broadcastCrop, setBroadcastCrop] = useState('');
  const [broadcastSelected, setBroadcastSelected] = useState<string[]>([]);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const hoveredRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setModeOpen(false);
      setEditing(false);
      return;
    }
    try {
      if (window.localStorage.getItem('tp_admin_mode_open_v1') === '1') setModeOpen(true);
    } catch {
      // ignored
    }
  }, [isAdmin]);

  const setOpen = (value: boolean) => {
    setModeOpen(value);
    if (!value) {
      setEditing(false);
      setSelected(null);
    }
    try {
      window.localStorage.setItem('tp_admin_mode_open_v1', value ? '1' : '0');
    } catch {
      // ignored
    }
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    setMessage('');
    try {
      setOverview(await fetchAdminOverview());
    } catch (error: any) {
      setMessage(error?.message || 'Yönetim özeti alınamadı.');
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && modeOpen) void loadOverview();
  }, [isAdmin, modeOpen]);

  const loadExistingOverride = async (selection: SelectedElement) => {
    const { data } = await supabase
      .from('admin_ui_overrides')
      .select('text_value,image_src,hidden,style')
      .eq('selector', selection.selector)
      .maybeSingle();
    const style = (data?.style ?? {}) as Record<string, string>;
    setDraft({
      text: data?.text_value ?? selection.text,
      image: data?.image_src ?? selection.image,
      hidden: Boolean(data?.hidden),
      background:
        style['background-color'] === '#ffffff' ? 'white' :
        style['background-color'] === '#080808' ? 'black' :
        style['background-color'] === 'transparent' ? 'transparent' : 'same',
      textTone: style.color === '#111111' ? 'black' : style.color === '#ffffff' ? 'white' : 'same',
      size: style['font-size'] === '12px' ? 'small' : style['font-size'] === '15px' ? 'normal' : style['font-size'] === '20px' ? 'large' : 'same',
      width: style.width === '100%' ? 'full' : style.width === 'auto' ? 'auto' : 'same',
      radius: style['border-radius'] === '0px' ? 'sharp' : style['border-radius'] === '14px' ? 'soft' : style['border-radius'] === '999px' ? 'round' : 'same',
    });
  };

  const buildSiblingRows = (element: HTMLElement) => {
    const parent = element.parentElement;
    if (!parent) return [];
    return Array.from(parent.children)
      .filter((child) => !child.closest('[data-tp-admin-ui="1"]'))
      .slice(0, 30)
      .map((child, index) => ({
        selector: selectorFor(child) || '',
        label: cleanLabel(child).slice(0, 64) || `${child.tagName} ${index + 1}`,
        index,
      }))
      .filter((row) => row.selector);
  };

  const chooseElement = async (element: HTMLElement) => {
    const selection = selectedFrom(element);
    if (!selection) return;
    setSelected(selection);
    setSiblings(buildSiblingRows(element));
    setPanel('edit');
    setMessage('');
    await loadExistingOverride(selection);
  };

  useEffect(() => {
    if (!editing || !isAdmin || !modeOpen) return;

    document.body.classList.add('tp-admin-pick-mode');
    const over = (event: MouseEvent) => {
      const next = findEditableElement(event.target);
      if (hoveredRef.current && hoveredRef.current !== next) hoveredRef.current.classList.remove('tp-admin-edit-hover');
      hoveredRef.current = next;
      next?.classList.add('tp-admin-edit-hover');
    };
    const click = (event: MouseEvent) => {
      const element = findEditableElement(event.target);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void chooseElement(element);
    };
    document.addEventListener('mouseover', over, true);
    document.addEventListener('click', click, true);
    return () => {
      document.body.classList.remove('tp-admin-pick-mode');
      hoveredRef.current?.classList.remove('tp-admin-edit-hover');
      hoveredRef.current = null;
      document.removeEventListener('mouseover', over, true);
      document.removeEventListener('click', click, true);
    };
  }, [editing, isAdmin, modeOpen]);

  const saveSelected = async () => {
    if (!selected) return;
    setMessage('Kaydediliyor…');
    try {
      await saveAdminUiOverride({
        selector: selected.selector,
        label: selected.label,
        text_value: selected.hasChildren ? null : draft.text,
        image_src: selected.tag === 'img' ? draft.image : null,
        hidden: draft.hidden,
        style: styleFromDraft(draft),
        parent_selector: selected.parentSelector,
        position_index: selected.positionIndex,
        enabled: true,
      });
      window.dispatchEvent(new CustomEvent('tp-admin-ui-overrides-updated'));
      setMessage('Değişiklik yayınlandı. Kullanıcı görünümüne anında uygulanıyor.');
    } catch (error: any) {
      setMessage(error?.message || 'Değişiklik kaydedilemedi.');
    }
  };

  const resetSelected = async () => {
    if (!selected) return;
    if (!window.confirm('Bu öğe için admin değişikliğini kaldırayım mı?')) return;
    setMessage('');
    try {
      await deleteAdminUiOverride(selected.selector);
      window.dispatchEvent(new CustomEvent('tp-admin-ui-overrides-updated'));
      setDraft({ ...DEFAULT_DRAFT, text: selected.text, image: selected.image });
      setMessage('Öğe uygulamanın kodundaki varsayılan görünümüne döndürüldü.');
    } catch (error: any) {
      setMessage(error?.message || 'Değişiklik kaldırılamadı.');
    }
  };

  const selectParent = () => {
    if (!selected?.selector) return;
    const element = document.querySelector(selected.selector) as HTMLElement | null;
    if (element?.parentElement && element.parentElement !== document.body) void chooseElement(element.parentElement);
  };

  const persistOrder = async (next: SiblingRow[]) => {
    if (!selected?.parentSelector) return;
    const parent = document.querySelector(selected.parentSelector);
    if (parent) {
      next.forEach((row) => {
        const element = document.querySelector(row.selector);
        if (element && element.parentElement === parent) parent.appendChild(element);
      });
    }
    await Promise.all(next.map((row, index) =>
      supabase.from('admin_ui_overrides').upsert({
        selector: row.selector,
        label: row.label,
        parent_selector: selected.parentSelector,
        position_index: index,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'selector' }),
    ));
    setSiblings(next.map((row, index) => ({ ...row, index })));
    window.dispatchEvent(new CustomEvent('tp-admin-ui-overrides-updated'));
    setMessage('Sıralama kaydedildi.');
  };

  const onDropSibling = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...siblings];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('tr-TR');
    const rows = overview?.users ?? [];
    if (!value) return rows;
    return rows.filter((user) =>
      [user.full_name, user.username, user.email, user.subscription_plan, ...(user.crops || [])]
        .filter(Boolean)
        .some((item) => String(item).toLocaleLowerCase('tr-TR').includes(value)),
    );
  }, [overview, search]);

  const openUser = async (user: AdminUserSummary) => {
    setSelectedUser(user);
    setUserDetail(null);
    setUserLoading(true);
    setMessage('');
    try {
      setUserDetail(await fetchAdminUserDetail(user.id));
    } catch (error: any) {
      setMessage(error?.message || 'Kullanıcı profili alınamadı.');
    } finally {
      setUserLoading(false);
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    setMessage('');
    try {
      const data = await fetchAdminAudit(120);
      setAuditRows(data.rows ?? []);
    } catch (error: any) {
      setMessage(error?.message || 'İşlem geçmişi alınamadı.');
    } finally {
      setAuditLoading(false);
    }
  };

  const changePanel = (next: Panel) => {
    setPanel(next);
    setMessage('');
    if (next === 'audit') void loadAudit();
    if (next === 'users' && !overview) void loadOverview();
  };

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setMessage('Başlık ve mesaj gerekli.');
      return;
    }
    if (broadcastAudience === 'selected' && !broadcastSelected.length) {
      setMessage('En az bir kullanıcı seç.');
      return;
    }
    if (broadcastAudience === 'all' && !window.confirm('Bu bildirimi tüm kullanıcılara göndereyim mi?')) return;

    setBroadcastBusy(true);
    setMessage('Bildirim hazırlanıyor…');
    try {
      const result = await sendAdminBroadcast({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        target: 'notificationsHub',
        severity: 'info',
        audience: broadcastAudience,
        plan: broadcastPlan,
        crop: broadcastCrop.trim(),
        user_ids: broadcastSelected,
      });
      setMessage(`${result.recipients} kullanıcıya uygulama bildirimi oluşturuldu. Push: ${result.push_sent} başarılı, ${result.push_failed} başarısız.`);
      setBroadcastTitle('');
      setBroadcastMessage('');
      await loadOverview();
    } catch (error: any) {
      setMessage(error?.message || 'Bildirim gönderilemedi.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  if (!isAdmin) return null;

  if (!modeOpen) {
    return (
      <button data-tp-admin-ui="1" className="tp-admin-entry" type="button" onClick={() => setOpen(true)}>
        <span>◆</span> Admin Modu
      </button>
    );
  }

  const metrics = overview?.metrics ?? EMPTY_METRICS;

  return (
    <div data-tp-admin-ui="1" className="tp-admin-mode-root">
      <div className="tp-admin-dock">
        <button className={panel === 'overview' ? 'active' : ''} onClick={() => changePanel('overview')}><b>◆</b><span>Özet</span></button>
        <button className={panel === 'edit' ? 'active' : ''} onClick={() => { changePanel('edit'); setEditing((value) => !value); }}><b>{editing ? '●' : '✦'}</b><span>{editing ? 'Seçiliyor' : 'Düzenle'}</span></button>
        <button className={panel === 'content' ? 'active' : ''} onClick={() => changePanel('content')}><b>▤</b><span>Haber</span></button>
        <button className={panel === 'users' ? 'active' : ''} onClick={() => changePanel('users')}><b>◎</b><span>Kullanıcı</span></button>
        <button className={panel === 'broadcast' ? 'active' : ''} onClick={() => changePanel('broadcast')}><b>⌁</b><span>Bildirim</span></button>
        <button className={panel === 'audit' ? 'active' : ''} onClick={() => changePanel('audit')}><b>↺</b><span>Geçmiş</span></button>
        <button className="tp-admin-dock-close" onClick={() => setOpen(false)}><b>×</b><span>Kapat</span></button>
      </div>

      {editing && <div className="tp-admin-pick-banner">DÜZENLEME AÇIK · Değiştirmek istediğin öğeye dokun</div>}

      <section className={`tp-admin-sheet tp-admin-sheet--${panel}`}>
        <header className="tp-admin-sheet-head">
          <div>
            <small>TarlaPusula · ADMIN MODU</small>
            <h2>{panel === 'overview' ? 'Yönetim özeti' : panel === 'edit' ? 'Ekranı düzenle' : panel === 'content' ? 'Haber akışı' : panel === 'users' ? 'Kullanıcılar' : panel === 'broadcast' ? 'Bildirim gönder' : 'Değişiklik geçmişi'}</h2>
          </div>
          <button type="button" onClick={() => setPanel('overview')}>⌄</button>
        </header>

        {message && <div className="tp-admin-message">{message}</div>}

        {panel === 'overview' && (
          <div className="tp-admin-overview">
            <div className="tp-admin-metrics">
              <article><strong>{numberText(metrics.users)}</strong><span>Kullanıcı</span></article>
              <article><strong>{numberText(metrics.active_7d)}</strong><span>7 gün aktif</span></article>
              <article><strong>{numberText(metrics.fields)}</strong><span>Tarla</span></article>
              <article><strong>{numberText(metrics.total_decare, 1)}</strong><span>Toplam dekar</span></article>
              <article><strong>{numberText(metrics.pending_content)}</strong><span>Onay bekleyen</span></article>
              <article><strong>{numberText(metrics.active_push_users)}</strong><span>Push açık</span></article>
            </div>
            <div className="tp-admin-quick-grid">
              <button onClick={() => { setPanel('edit'); setEditing(true); }}><b>✦</b><span>Ekranda gördüğünü düzenle</span><small>Öğeye dokun, görerek değiştir</small></button>
              <button onClick={() => changePanel('content')}><b>▤</b><span>Haber akışını yönet</span><small>Adaylar · yayınlananlar · kaynaklar</small></button>
              <button onClick={() => changePanel('users')}><b>◎</b><span>Kullanıcıları gör</span><small>Tarla · ürün · faaliyet · puan</small></button>
              <button onClick={() => changePanel('broadcast')}><b>⌁</b><span>Bildirim gönder</span><small>Herkese veya seçili gruba</small></button>
            </div>
            <button className="tp-admin-refresh" disabled={overviewLoading} onClick={() => void loadOverview()}>{overviewLoading ? 'Yenileniyor…' : 'Verileri yenile'}</button>
          </div>
        )}

        {panel === 'edit' && (
          <div className="tp-admin-editor">
            {!selected ? (
              <div className="tp-admin-empty">
                <b>✦</b>
                <h3>Uygulamayı normal kullanıcı gibi kullan</h3>
                <p>Düzenlemek istediğin kartı, yazıyı, ikonu veya butonu gördüğünde “Düzenlemeyi aç” de ve öğeye dokun.</p>
                <button className={editing ? 'active' : ''} onClick={() => setEditing((value) => !value)}>{editing ? 'Düzenlemeyi kapat' : 'Düzenlemeyi aç'}</button>
              </div>
            ) : (
              <>
                <div className="tp-admin-selected-card">
                  <div><small>SEÇİLİ ÖĞE · {selected.tag.toUpperCase()}</small><strong>{selected.label || 'İsimsiz öğe'}</strong></div>
                  <div className="tp-admin-selected-actions">
                    <button onClick={selectParent}>Üst bloğu seç</button>
                    <button onClick={() => { setSelected(null); setSiblings([]); setEditing(true); }}>Başka öğe seç</button>
                  </div>
                </div>

                {!selected.hasChildren && selected.tag !== 'img' && (
                  <label className="tp-admin-field">Yazı<input value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /></label>
                )}
                {selected.tag === 'img' && (
                  <label className="tp-admin-field">Görsel / ikon adresi<input value={draft.image} onChange={(event) => setDraft((current) => ({ ...current, image: event.target.value }))} placeholder="https://…" /></label>
                )}

                <div className="tp-admin-choice-block"><span>Arka plan</span><div>{(['same','white','black','transparent'] as Preset[]).map((value) => <button key={value} className={draft.background === value ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, background: value }))}>{value === 'same' ? 'Olduğu gibi' : value === 'white' ? 'Beyaz' : value === 'black' ? 'Siyah' : 'Şeffaf'}</button>)}</div></div>
                <div className="tp-admin-choice-block"><span>Yazı rengi</span><div>{(['same','black','white'] as TextPreset[]).map((value) => <button key={value} className={draft.textTone === value ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, textTone: value }))}>{value === 'same' ? 'Olduğu gibi' : value === 'black' ? 'Siyah' : 'Beyaz'}</button>)}</div></div>
                <div className="tp-admin-choice-block"><span>Boyut</span><div>{(['same','small','normal','large'] as SizePreset[]).map((value) => <button key={value} className={draft.size === value ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, size: value }))}>{value === 'same' ? 'Olduğu gibi' : value === 'small' ? 'Küçük' : value === 'normal' ? 'Normal' : 'Büyük'}</button>)}</div></div>
                <div className="tp-admin-choice-block"><span>Genişlik</span><div>{(['same','auto','full'] as WidthPreset[]).map((value) => <button key={value} className={draft.width === value ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, width: value }))}>{value === 'same' ? 'Olduğu gibi' : value === 'auto' ? 'İçeriğe göre' : 'Tam genişlik'}</button>)}</div></div>
                <div className="tp-admin-choice-block"><span>Köşeler</span><div>{(['same','sharp','soft','round'] as RadiusPreset[]).map((value) => <button key={value} className={draft.radius === value ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, radius: value }))}>{value === 'same' ? 'Olduğu gibi' : value === 'sharp' ? 'Keskin' : value === 'soft' ? 'Yumuşak' : 'Yuvarlak'}</button>)}</div></div>
                <label className="tp-admin-toggle"><input type="checkbox" checked={draft.hidden} onChange={(event) => setDraft((current) => ({ ...current, hidden: event.target.checked }))} /><span>Bu öğeyi kullanıcılardan gizle</span></label>

                {siblings.length > 1 && (
                  <div className="tp-admin-sorter">
                    <div><strong>Sürükle-bırak sıralama</strong><small>Bu bloktaki öğeleri tutup taşı</small></div>
                    <div className="tp-admin-sort-list">
                      {siblings.map((row, index) => (
                        <button
                          type="button"
                          draggable
                          key={row.selector}
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => onDropSibling(index)}
                        >
                          <span>☷</span><em>{row.label}</em><small>{index + 1}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="tp-admin-editor-actions"><button className="primary" onClick={() => void saveSelected()}>Kaydet & yayınla</button><button onClick={() => void resetSelected()}>Değişikliği kaldır</button></div>
              </>
            )}
          </div>
        )}

        {panel === 'content' && <div className="tp-admin-content-wrap"><ContentAdminPanel /></div>}

        {panel === 'users' && (
          <div className="tp-admin-users">
            {selectedUser ? (
              <div className="tp-admin-user-detail">
                <button className="tp-admin-back" onClick={() => { setSelectedUser(null); setUserDetail(null); }}>← Kullanıcılara dön</button>
                <div className="tp-admin-user-hero"><div><small>KULLANICI PROFİLİ</small><h3>{selectedUser.full_name || selectedUser.username || selectedUser.email || 'Kullanıcı'}</h3><p>{selectedUser.email || 'E-posta yok'} · {selectedUser.subscription_plan.toUpperCase()}</p></div><strong>{selectedUser.field_count} tarla</strong></div>
                {userLoading && <div className="tp-admin-loading-line">Profil yükleniyor…</div>}
                {userDetail && (
                  <>
                    <div className="tp-admin-profile-metrics"><article><strong>{numberText(selectedUser.total_decare, 1)}</strong><span>dekar</span></article><article><strong>{numberText(selectedUser.points)}</strong><span>puan</span></article><article><strong>{userDetail.activities.length}</strong><span>son faaliyet</span></article><article><strong>{userDetail.todos.filter((todo:any)=>!todo.completed&&!todo.dismissed).length}</strong><span>açık görev</span></article></div>
                    <section><h4>Tarlaları</h4><div className="tp-admin-detail-list">{userDetail.fields.length ? userDetail.fields.map((field:any)=><article key={field.id}><div><strong>{field.name || 'Tarla'}</strong><span>{field.crop || 'Ürün yok'} · {field.city || '—'} {field.district || ''}</span></div><b>{numberText(field.area_decare,1)} da</b></article>) : <p>Tarla kaydı yok.</p>}</div></section>
                    <section><h4>Son işlemleri</h4><div className="tp-admin-detail-list">{userDetail.activities.length ? userDetail.activities.slice(0,20).map((activity:any)=><article key={activity.id}><div><strong>{activity.title || activity.activity_type || 'İşlem'}</strong><span>{activity.product_name || activity.notes || 'Detay yok'}</span></div><b>{activity.activity_date || dateText(activity.created_at)}</b></article>) : <p>İşlem kaydı yok.</p>}</div></section>
                    <section><h4>Görev ve hatırlatmalar</h4><div className="tp-admin-detail-list">{[...userDetail.todos.slice(0,10),...userDetail.reminders.slice(0,10)].length ? [...userDetail.todos.slice(0,10),...userDetail.reminders.slice(0,10)].map((item:any,index)=><article key={item.id || index}><div><strong>{item.title || item.reminder_type || 'Kayıt'}</strong><span>{item.description || item.notes || (item.completed ? 'Tamamlandı' : 'Açık')}</span></div><b>{item.due_date || item.reminder_date || ''}</b></article>) : <p>Görev/hatırlatma yok.</p>}</div></section>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="tp-admin-user-tools"><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="İsim, e-posta, ürün veya plan ara…" /><button onClick={() => void loadOverview()}>{overviewLoading ? '…' : 'Yenile'}</button></div>
                <div className="tp-admin-user-list">
                  {filteredUsers.map((user) => <button key={user.id} onClick={() => void openUser(user)}><div><strong>{user.full_name || user.username || user.email || 'Kullanıcı'}</strong><span>{user.email || 'E-posta yok'} · {user.subscription_plan.toUpperCase()}</span><small>{user.crops.length ? user.crops.join(', ') : 'Henüz ürün yok'} · Son giriş {dateText(user.last_sign_in_at)}</small></div><aside><b>{user.field_count}</b><span>tarla</span></aside></button>)}
                  {!overviewLoading && !filteredUsers.length && <div className="tp-admin-empty-inline">Kullanıcı bulunamadı.</div>}
                </div>
              </>
            )}
          </div>
        )}

        {panel === 'broadcast' && (
          <div className="tp-admin-broadcast">
            <div className="tp-admin-choice-block"><span>Kime?</span><div>{(['all','plan','crop','selected'] as const).map((value)=><button key={value} className={broadcastAudience===value?'active':''} onClick={()=>setBroadcastAudience(value)}>{value==='all'?'Herkese':value==='plan'?'Plana göre':value==='crop'?'Ürüne göre':'Kullanıcı seç'}</button>)}</div></div>
            {broadcastAudience === 'plan' && <label className="tp-admin-field">Plan<select value={broadcastPlan} onChange={(event)=>setBroadcastPlan(event.target.value)}><option value="free">Free</option><option value="plus">Plus</option><option value="premium">Premium</option></select></label>}
            {broadcastAudience === 'crop' && <label className="tp-admin-field">Ürün<input value={broadcastCrop} onChange={(event)=>setBroadcastCrop(event.target.value)} placeholder="Örn. Buğday" /></label>}
            {broadcastAudience === 'selected' && <div className="tp-admin-broadcast-users">{(overview?.users ?? []).map((user)=><label key={user.id}><input type="checkbox" checked={broadcastSelected.includes(user.id)} onChange={(event)=>setBroadcastSelected((current)=>event.target.checked?[...current,user.id]:current.filter((id)=>id!==user.id))}/><span>{user.full_name || user.username || user.email || 'Kullanıcı'}</span></label>)}</div>}
            <label className="tp-admin-field">Başlık<input value={broadcastTitle} onChange={(event)=>setBroadcastTitle(event.target.value)} placeholder="Bildirim başlığı" /></label>
            <label className="tp-admin-field">Mesaj<textarea value={broadcastMessage} onChange={(event)=>setBroadcastMessage(event.target.value)} rows={5} placeholder="Kullanıcıların göreceği mesaj…" /></label>
            <button className="tp-admin-send" disabled={broadcastBusy} onClick={() => void sendBroadcast()}>{broadcastBusy ? 'Gönderiliyor…' : 'Bildirimi gönder'}</button>
            <p className="tp-admin-help">Bildirim uygulama içindeki Bildirimler ekranına düşer; push izni olan cihazlara ayrıca push gönderilir.</p>
          </div>
        )}

        {panel === 'audit' && (
          <div className="tp-admin-audit">
            <button className="tp-admin-refresh" disabled={auditLoading} onClick={() => void loadAudit()}>{auditLoading ? 'Yükleniyor…' : 'Geçmişi yenile'}</button>
            <div className="tp-admin-audit-list">{auditRows.map((row)=><article key={row.id}><div><strong>{row.action.replaceAll('_',' ')}</strong><span>{row.target_type || 'sistem'} · {row.target_id || '—'}</span></div><time>{dateText(row.created_at)}</time></article>)}{!auditLoading&&!auditRows.length&&<p>Henüz admin işlemi kaydı yok.</p>}</div>
          </div>
        )}
      </section>
    </div>
  );
}
