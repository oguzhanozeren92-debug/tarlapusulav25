import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';

type UiOverride = {
  selector: string;
  text_value: string | null;
  image_src: string | null;
  hidden: boolean;
  style: Record<string, string> | null;
  parent_selector: string | null;
  position_index: number | null;
};

function applyOverrides(rows: UiOverride[]) {
  for (const row of rows) {
    if (!row?.selector) continue;
    let element: HTMLElement | null = null;
    try {
      element = document.querySelector(row.selector) as HTMLElement | null;
    } catch {
      continue;
    }
    if (!element) continue;

    if (row.hidden) {
      element.style.setProperty('display', 'none', 'important');
    } else if (element.style.display === 'none') {
      element.style.removeProperty('display');
    }

    if (row.text_value !== null && element.childElementCount === 0) {
      element.textContent = row.text_value;
    }

    if (row.image_src && element instanceof HTMLImageElement) {
      element.src = row.image_src;
    }

    if (row.style && typeof row.style === 'object') {
      Object.entries(row.style).forEach(([key, value]) => {
        if (!value) element?.style.removeProperty(key);
        else element?.style.setProperty(key, String(value), 'important');
      });
    }

    if (row.parent_selector && Number.isInteger(row.position_index)) {
      try {
        const parent = document.querySelector(row.parent_selector);
        if (parent && element.parentElement === parent) {
          const children = Array.from(parent.children).filter((child) => child !== element);
          const index = Math.max(0, Math.min(Number(row.position_index), children.length));
          const before = children[index] ?? null;
          if (before) parent.insertBefore(element, before);
          else parent.appendChild(element);
        }
      } catch {
        // Selector değişmiş olabilir; uygulamayı etkilemeden geç.
      }
    }
  }
}

export default function AdminUiRuntime() {
  useEffect(() => {
    let alive = true;
    let rows: UiOverride[] = [];
    let timer = 0;

    const load = async () => {
      const { data, error } = await supabase
        .from('admin_ui_overrides')
        .select('selector,text_value,image_src,hidden,style,parent_selector,position_index')
        .eq('enabled', true);

      if (!alive) return;
      if (error) {
        console.warn('[TarlaPusula] UI override yüklenemedi:', error.message);
        return;
      }
      rows = (data ?? []) as UiOverride[];
      applyOverrides(rows);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => applyOverrides(rows), 60);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('tp-admin-ui-overrides-updated', load);
    void load();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('tp-admin-ui-overrides-updated', load);
    };
  }, []);

  return null;
}
