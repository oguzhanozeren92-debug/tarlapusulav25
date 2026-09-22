import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  cmsBlockFor as findCmsBlock,
  cmsMenuFor as findCmsMenu,
  cmsPageFor as findCmsPage,
} from '../../../utils/cmsUtils';
import type { CmsBlockRow, CmsMenuRow, CmsPageRow, Screen } from '../../../types';

export function useAppCms(screen: Screen) {
  const [cmsPages, setCmsPages] = useState<CmsPageRow[]>([]);
  const [cmsBlocks, setCmsBlocks] = useState<CmsBlockRow[]>([]);
  const [cmsMenus, setCmsMenus] = useState<CmsMenuRow[]>([]);
  const [cmsTheme, setCmsTheme] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let active = true;

    const loadCmsConfig = async () => {
      try {
        const [pageRes, blockRes, menuRes, themeRes] = await Promise.all([
          supabase.from('app_pages').select('*').order('menu_order'),
          supabase.from('app_blocks').select('*').order('position'),
          supabase.from('app_menu_items').select('*').order('position'),
          supabase
            .from('app_theme_settings')
            .select('setting_value')
            .eq('setting_key', 'global')
            .maybeSingle(),
        ]);

        if (!active) return;
        if (pageRes.error) console.error('CMS pages okunamadı:', pageRes.error);
        else setCmsPages((pageRes.data ?? []) as CmsPageRow[]);

        if (blockRes.error) console.error('CMS blocks okunamadı:', blockRes.error);
        else setCmsBlocks((blockRes.data ?? []) as CmsBlockRow[]);

        if (menuRes.error) console.error('CMS menu okunamadı:', menuRes.error);
        else setCmsMenus((menuRes.data ?? []) as CmsMenuRow[]);

        if (themeRes.error) console.error('CMS theme okunamadı:', themeRes.error);
        else setCmsTheme((themeRes.data?.setting_value ?? {}) as Record<string, unknown>);
      } catch (error) {
        console.error('CMS ayarları yüklenemedi:', error);
      }
    };

    const handleCmsUpdated = () => void loadCmsConfig();
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

  return {
    cmsPages,
    cmsBlocks,
    cmsMenus,
    cmsRuntimeCss,
    cmsPageFor: (pageKey: string) => findCmsPage(cmsPages, pageKey),
    cmsBlockFor: (pageKey: string, blockKey: string) => findCmsBlock(cmsBlocks, pageKey, blockKey),
    cmsMenuFor: (menuKey: string) => findCmsMenu(cmsMenus, menuKey),
  };
}
