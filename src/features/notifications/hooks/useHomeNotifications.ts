import { useMemo } from 'react';
import type { HomeLayer } from '../../home-map/HomeMapEngine';
import { formatHomeSatelliteDate } from '../../home/homeFormatters';

export type HomeNotificationTarget = 'weather' | 'calendar' | 'ai' | 'home' | 'soil' | 'irrigation_detail' | 'map_vegetation';
export type HomeNotificationIconKey = 'leaf' | 'rain' | 'document';

export type HomeSystemNotification = {
  id: string;
  priority: number;
  severity: 'info' | 'warning' | 'danger';
  source: 'weather' | 'field' | 'calendar' | 'satellite' | 'pusula' | 'irrigation' | 'phenology' | 'operation' | 'nutrition';
  title: string;
  detail: string;
  iconKey: HomeNotificationIconKey;
  iconTone: 'green' | 'cyan' | 'gold';
  dotTone: 'info' | 'warning' | 'danger';
  target: HomeNotificationTarget;
};

type Inputs = {
  fieldKey: string;
  activeHomeLayer: HomeLayer;
  weatherStatus?: string | null;
  quickTemperatureMin: number | null;
  quickWindKmh: number | null;
  quickTemperature: number | null;
  quickRainChance: number | null;
  quickRainMm: number | null;
  nextCalendarItem: any | null;
  fieldSynthesis: any;
  homePusulaResult: any;
  resolvedHomeSatelliteDate: string;
  homeFieldId?: string | number | null;
  homeFieldCrop?: string | null;
};

function compactText(value: unknown, maxLength = 76) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length <= maxLength ? raw : `${raw.slice(0, maxLength - 1).trim()}…`;
}

function formatCalendarTiming(dateMs: number | null | undefined) {
  if (!Number.isFinite(Number(dateMs))) return 'Yaklaşan görev';

  const diffMs = Number(dateMs) - Date.now();
  const diffHours = diffMs / (60 * 60 * 1000);

  if (diffHours <= 2 && diffHours >= -2) return 'Bugün · yaklaşıyor';
  if (diffHours < 24) {
    return `Bugün · ${new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(Number(dateMs)))}`;
  }
  if (diffHours < 48) return 'Yarın';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(Number(dateMs)));
}


export function useHomeNotifications({
  fieldKey,
  activeHomeLayer,
  weatherStatus,
  quickTemperatureMin,
  quickWindKmh,
  quickTemperature,
  quickRainChance,
  quickRainMm,
  nextCalendarItem,
  fieldSynthesis,
  homePusulaResult,
  resolvedHomeSatelliteDate,
  homeFieldId,
  homeFieldCrop,
}: Inputs) {
  return useMemo<HomeSystemNotification[]>(() => {
    if (!fieldKey) return [];

    const items: HomeSystemNotification[] = [];
    const localDayKey = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    if (weatherStatus === 'error') {
      items.push({
        id: `weather:${fieldKey}:error:${localDayKey}`,
        priority: 100,
        severity: 'danger',
        source: 'weather',
        title: 'Hava verisi alınamadı',
        detail: 'Tarımsal karar vermeden önce hava verisini yeniden kontrol et',
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'danger',
        target: 'weather',
      });
    }

    if (quickTemperatureMin != null && quickTemperatureMin <= 3) {
      items.push({
        id: `weather:${fieldKey}:frost:${localDayKey}`,
        priority: 98,
        severity: 'danger',
        source: 'weather',
        title: 'Don riski',
        detail: `Gece sıcaklığı ${Math.round(quickTemperatureMin)}°C seviyesine inebilir`,
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'danger',
        target: 'weather',
      });
    }

    if (quickWindKmh != null && quickWindKmh >= 20) {
      items.push({
        id: `weather:${fieldKey}:wind:${localDayKey}`,
        priority: 95,
        severity: 'danger',
        source: 'weather',
        title: 'İlaçlama için rüzgâr yüksek',
        detail: `${Math.round(quickWindKmh)} km/sa rüzgâr nedeniyle uygulamayı ertele`,
        iconKey: 'leaf',
        iconTone: 'gold',
        dotTone: 'danger',
        target: 'weather',
      });
    }

    if (quickTemperature != null && quickTemperature >= 34) {
      items.push({
        id: `weather:${fieldKey}:heat:${localDayKey}`,
        priority: 87,
        severity: 'warning',
        source: 'weather',
        title: 'Isı stresi riski yükseldi',
        detail: `Sıcaklık ${Math.round(quickTemperature)}°C; öğle saatlerinde işlemleri azalt`,
        iconKey: 'leaf',
        iconTone: 'gold',
        dotTone: 'warning',
        target: 'weather',
      });
    }

    if (
      (quickRainChance != null && quickRainChance >= 60) ||
      (quickRainMm != null && quickRainMm >= 3)
    ) {
      items.push({
        id: `weather:${fieldKey}:rain:${localDayKey}`,
        priority: 84,
        severity: 'warning',
        source: 'weather',
        title: 'Yağış ihtimali yükseldi',
        detail:
          quickRainChance != null
            ? `Bugün yağış ihtimali %${Math.round(quickRainChance)}`
            : `Bugün yaklaşık ${Number(quickRainMm).toFixed(1)} mm yağış görünüyor`,
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'warning',
        target: 'weather',
      });
    }

    if (nextCalendarItem) {
      const calendarHours =
        (Number(nextCalendarItem._tpDateMs) - Date.now()) / (60 * 60 * 1000);

      items.push({
        id: `calendar:${String(nextCalendarItem.id ?? nextCalendarItem._tpDateMs)}`,
        priority: calendarHours <= 24 ? 92 : 72,
        severity: calendarHours <= 6 ? 'warning' : 'info',
        source: 'calendar',
        title: nextCalendarItem._tpTitle || 'Yaklaşan takvim görevi',
        detail: formatCalendarTiming(nextCalendarItem._tpDateMs),
        iconKey: 'document',
        iconTone: 'gold',
        dotTone: calendarHours <= 6 ? 'warning' : 'info',
        target: 'calendar',
      });
    }

    const pusulaAction = compactText(
      fieldSynthesis?.action ?? homePusulaResult?.analysis?.action,
    );
    const pusulaArea = compactText(
      fieldSynthesis?.importantArea?.area ??
        homePusulaResult?.analysis?.importantArea?.area,
      28,
    );
    const synthesisNeedsAttention =
      Boolean(pusulaArea) ||
      (fieldSynthesis?.status && String(fieldSynthesis.status) !== 'normal');

    if (pusulaAction && synthesisNeedsAttention) {
      items.push({
        id: `pusula:${String(
          homePusulaResult?.analysis?.memoryObservationId ??
            homePusulaResult?.snapshotId ??
            `${fieldKey}:${activeHomeLayer}:${localDayKey}`,
        )}`,
        priority: 89,
        severity: 'warning',
        source: 'pusula',
        title: pusulaArea
          ? `${pusulaArea} bölümünü kontrol et`
          : 'Pusula yeni bir öneri üretti',
        detail: pusulaAction,
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'warning',
        target: 'ai',
      });
    }

    if (resolvedHomeSatelliteDate) {
      items.push({
        id: `satellite:${fieldKey}:${resolvedHomeSatelliteDate}`,
        priority: 46,
        severity: 'info',
        source: 'satellite',
        title: 'Uydu görüntüsü hazır',
        detail: `Son görüntü ${formatHomeSatelliteDate(resolvedHomeSatelliteDate)}`,
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'info',
        target: 'home',
      });
    }

    if (homeFieldId && !String(homeFieldCrop ?? '').trim()) {
      items.push({
        id: `field:${fieldKey}:missing-crop`,
        priority: 42,
        severity: 'info',
        source: 'field',
        title: 'Ürün bilgisi eksik',
        detail: 'Daha isabetli öneriler için tarlanın ürün bilgisini tamamla',
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'info',
        target: 'home',
      });
    }

    const seen = new Set<string>();
    return items
      .sort((a, b) => b.priority - a.priority)
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 12);
  }, [
    fieldKey,
    activeHomeLayer,
    weatherStatus,
    quickTemperatureMin,
    quickWindKmh,
    quickTemperature,
    quickRainChance,
    quickRainMm,
    nextCalendarItem,
    fieldSynthesis,
    homePusulaResult,
    resolvedHomeSatelliteDate,
    homeFieldId,
    homeFieldCrop,
  ]);
}
