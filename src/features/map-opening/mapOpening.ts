import type { Map } from 'maplibre-gl';

/**
 * Harita her ekrana girişte ve tarla değişiminde yeniden oluşturulur.
 * Katman değişiminde aynı Map örneği korunduğu için bu fonksiyon tekrar
 * çağrılmaz. Böylece uydu -> tarla inişi doğru anda oynar.
 */
export function shouldPlayMapOpening(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function openMapAtField(
  map: Map,
  center: [number, number],
  bbox: number[] | null | undefined,
  animate: boolean,
  zoom = 16,
): void {
  const camera = bbox
    ? map.cameraForBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: { top: 18, right: 18, bottom: 30, left: 18 },
          maxZoom: 18.35,
        },
      )
    : { center, zoom };

  if (!camera) return;

  const target = {
    ...camera,
    pitch: 0,
    bearing: 0,
  };

  if (
    animate &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    map.flyTo({
      ...target,
      duration: 2400,
      curve: 1.15,
      essential: false,
    });
    return;
  }

  map.jumpTo(target);
}
