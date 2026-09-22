import type { CmsBlockRow, CmsPageRow, CmsMenuRow } from '../types';

export const cmsBlockStyle = (block?: CmsBlockRow) => {
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


export const cmsPageFor = (pages: CmsPageRow[], pageKey: string) =>
  pages.find((item) => item.page_key === pageKey && item.is_visible);

export const cmsBlockFor = (
  blocks: CmsBlockRow[],
  pageKey: string,
  blockKey: string,
) =>
  blocks.find(
    (item) =>
      item.page_key === pageKey &&
      item.block_key === blockKey &&
      item.is_visible,
  );

export const cmsMenuFor = (menus: CmsMenuRow[], menuKey: string) =>
  menus.find((item) => item.menu_key === menuKey && item.is_visible);

export const cmsText = (
  block: CmsBlockRow | undefined,
  fallback: string,
) => block?.title || fallback;

export const cmsSub = (
  block: CmsBlockRow | undefined,
  fallback: string,
) => block?.subtitle || block?.description || fallback;
