import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export type AdminUiOverride = {
  id: string;
  selector: string;
  label?: string | null;
  text_value?: string | null;
  image_src?: string | null;
  hidden?: boolean | null;
  style?: Record<string, string | number | null> | null;
  parent_selector?: string | null;
  position_index?: number | null;
  enabled?: boolean | null;
};

const ORIGINAL_DISPLAY = 'data-tp-admin-original-display';

function setDirectText(element: HTMLElement, value: string) {
  const textNode = Array.from(element.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent ?? '').trim(),
  );

  if (textNode) {
    textNode.textContent = value;
    return;
  }

  if (element.children.length === 0) {
    element.textContent = value;
  }
}

function applyOne(row: AdminUiOverride) {
  if (!row.enabled || !row.selector) return;

  let element: HTMLElement | null = null;
  try {
    element = document.querySelector(row.selector) as HTMLElement | null;
  } catch {
    return;
  }
  if (!element) return;

  if (typeof row.hidden === 'boolean') {
    if (!element.hasAttribute(ORIGINAL_DISPLAY)) {
      element.setAttribute(ORIGINAL_DISPLAY, element.style.display || '');
    }
    element.style.display = row.hidden
      ? 'none'
      : element.getAttribute(ORIGINAL_DISPLAY) || '';
  }

  if (row.text_value !== null && row.text_value !== undefined) {
    setDirectText(element, String(row.text_value));
  }

  if (row.image_src && element instanceof HTMLImageElement) {
    element.src = row.image_src;
  }

  if (row.style && typeof row.style === 'object') {
    for (const [key, raw] of Object.entries(row.style)) {
      const value = raw === null || raw === undefined ? '' : String(raw);
      try {
        element.style.setProperty(key, value);
      } catch {
        // Geçersiz CSS anahtarı diğer kuralları engellemesin.
      }
    }
  }

  if (
    row.parent_selector &&
    Number.isInteger(row.position_index) &&
    row.position_index !== null
  ) {
    let parent: HTMLElement | null = null;
    try {
      parent = document.querySelector(row.parent_selector) as HTMLElement | null;
    } catch {
      parent = null;
    }
    if (parent && element.parentElement === parent) {
      const children = Array.from(parent.children);
      const current = children.indexOf(element);
      const target = Math.max(0, Math.min(Number(row.position_index), children.length - 1));
      if (current !== target) {
        const reference = children[target];
        if (reference && reference !== element) {
          if (current < target) reference.after(element);
          else reference.before(element);
        }
      }
    }
  }
}

export async function loadAndApplyUiOverrides() {
  const { data, error } = await supabase
    .from('admin_ui_overrides')
    .select('id,selector,label,text_value,image_src,hidden,style,parent_selector,position_index,enabled')
    .eq('enabled', true);

  if (error) {
    console.warn('[Admin UI] Görsel override kayıtları okunamadı:', error.message);
    return [] as AdminUiOverride[];
  }

  const rows = (data ?? []) as AdminUiOverride[];
  rows.forEach(applyOne);
  return rows;
}

export default function UiOverrideRuntime() {
  useEffect(() => {
    let disposed = false;
    let applying = false;
    let timer = 0;
    let rows: AdminUiOverride[] = [];

    const apply = () => {
      if (disposed || applying) return;
      applying = true;
      try {
        rows.forEach(applyOne);
      } finally {
        window.setTimeout(() => {
          applying = false;
        }, 0);
      }
    };

    void loadAndApplyUiOverrides().then((next) => {
      if (disposed) return;
      rows = next;
      apply();
    });

    const observer = new MutationObserver(() => {
      if (disposed || applying) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const refresh = () => {
      void loadAndApplyUiOverrides().then((next) => {
        rows = next;
        apply();
      });
    };
    window.addEventListener('tp-admin-ui-updated', refresh);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('tp-admin-ui-updated', refresh);
    };
  }, []);

  return null;
}
