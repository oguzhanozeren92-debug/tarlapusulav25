import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './MapDataDate.css';

function measurementDate(value: unknown): string | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!match) return null;

  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);

  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function elementIsVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || '1') > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

type Props = {
  layer?: string;
  latestDate?: unknown;
  radarRange?: { from?: string; to?: string };
  hasData: boolean;
  isHistorical?: boolean;
};

export default function MapDataDate({
  layer = 'vegetation',
  latestDate,
  radarRange,
  hasData,
  isHistorical = false,
}: Props) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [bottomOffset, setBottomOffset] = useState(14);

  const date = measurementDate(latestDate);
  const from = measurementDate(radarRange?.from);
  const to = measurementDate(radarRange?.to);

  let label = 'VERİ TARİHİ';
  let value = 'Tarih bilinmiyor';

  if (!hasData) {
    value = 'Veri bulunamadı';
  } else if (layer === 'vegetation') {
    label = isHistorical ? 'GEÇMİŞ UYDU VERİSİ' : 'UYDU VERİ TARİHİ';
    value = date ?? 'Tarih bilinmiyor';
  } else if (layer.startsWith('radar-')) {
    label = 'RADAR VERİ DÖNEMİ';
    value = from && to ? `${from} – ${to}` : 'Dönem bilinmiyor';
  } else if (layer === 'soil') {
    label = 'TOPRAK VERİSİ';
    value = date ?? 'Tarih bilinmiyor';
  } else if (layer === 'climate') {
    label = 'İKLİM VERİSİ';
    value = date ?? 'Tarih bilinmiyor';
  } else if (layer === 'surface-temperature') {
    label = 'SICAKLIK VERİSİ';
    value = date ?? 'Tarih bilinmiyor';
  } else if (layer === 'evapotranspiration') {
    label = 'ET VERİSİ';
    value = date ?? 'Tarih bilinmiyor';
  } else if (layer === 'rainfall-history') {
    label = 'YAĞIŞ VERİSİ';
    value = date ?? 'Tarih bilinmiyor';
  }

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;

    const map = badge.closest('.tp-real-home-map');
    const shell = badge.closest('.tp-home-map-pusula-shell');

    if (!(map instanceof HTMLElement)) return;

    let frame = 0;

    const updatePosition = () => {
      cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const mapRect = map.getBoundingClientRect();
        const badgeRect = badge.getBoundingClientRect();

        if (!mapRect.width || !mapRect.height || !badgeRect.width) return;

        const gap = 10;
        const baseBottom = 14;

        const badgeLeft = mapRect.left + (mapRect.width - badgeRect.width) / 2;
        const badgeRight = badgeLeft + badgeRect.width;

        const obstacles = [
          shell?.querySelector('.tp-home-map-pusula-strip') ?? null,
          map.querySelector('.tp-real-home-legend'),
          map.querySelector('.tp-home-general-metric'),
          map.querySelector('.tp-map-data-badge'),
        ].filter(elementIsVisible);

        let nextBottom = baseBottom;

        for (const obstacle of obstacles) {
          const obstacleRect = obstacle.getBoundingClientRect();

          const overlapsHorizontally =
            obstacleRect.right > badgeLeft &&
            obstacleRect.left < badgeRight;

          const overlapsMapVertically =
            obstacleRect.bottom > mapRect.top &&
            obstacleRect.top < mapRect.bottom;

          if (!overlapsHorizontally || !overlapsMapVertically) continue;

          const obstacleTopInsideMap = Math.max(
            0,
            Math.min(mapRect.height, obstacleRect.top - mapRect.top),
          );

          const requiredBottom =
            mapRect.height - obstacleTopInsideMap + gap;

          nextBottom = Math.max(nextBottom, requiredBottom);
        }

        const maxBottom = Math.max(
          baseBottom,
          mapRect.height - badgeRect.height - 12,
        );

        setBottomOffset(
          Math.round(Math.min(nextBottom, maxBottom)),
        );
      });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(map);
    resizeObserver.observe(badge);

    if (shell instanceof HTMLElement) {
      resizeObserver.observe(shell);
    }

    const mutationTarget =
      shell instanceof HTMLElement ? shell : map;

    const mutationObserver = new MutationObserver(updatePosition);
    mutationObserver.observe(mutationTarget, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('resize', updatePosition);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [layer, hasData, value]);

  const style = {
    '--tp-measurement-bottom': `${bottomOffset}px`,
  } as CSSProperties;

  return (
    <div
      ref={badgeRef}
      className={`tp-measurement-date ${isHistorical ? 'is-history' : ''}`}
      role="status"
      aria-label={`${label}: ${value}`}
      style={style}
    >
      <i aria-hidden="true" />

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
