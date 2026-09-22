import { useMemo } from 'react';
import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';

export type HomeDecisionTarget = 'weather' | 'calendar' | 'ai' | 'home';

export type HomeDecision = {
  id: string;
  group: string;
  priority: number;
  label: string;
  title: string;
  detail: string;
  tone: string;
  visual: 'irrigation' | 'spraying';
  iconSrc: string;
  iconClass: 'water' | 'leaf';
  target: HomeDecisionTarget;
};

type QuickDecision = {
  title: string;
  detail: string;
  tone: string;
};

type Inputs = {
  fieldKey: string;
  weatherStatus?: string | null;
  hasUsableTodayWeather: boolean;
  quickTemperatureMin: number | null;
  quickTemperature: number | null;
  quickWindKmh: number | null;
  quickRainChance: number | null;
  quickRainMm: number | null;
  nextCalendarItem: any | null;
  fieldSynthesis: any;
  homePusulaResult: any;
  irrigationQuick: QuickDecision;
  sprayingQuick: QuickDecision;
};

function compactText(value: unknown, maxLength = 74) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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

export function useTodayDecisions({
  fieldKey,
  weatherStatus,
  hasUsableTodayWeather,
  quickTemperatureMin,
  quickTemperature,
  quickWindKmh,
  quickRainChance,
  quickRainMm,
  nextCalendarItem,
  fieldSynthesis,
  homePusulaResult,
  irrigationQuick,
  sprayingQuick,
}: Inputs) {
  return useMemo<HomeDecision[]>(() => {
    const candidates: HomeDecision[] = [];

    if (weatherStatus === 'loading') {
      candidates.push({
        id: 'weather-loading',
        group: 'weather-status',
        priority: 35,
        label: 'HAVA',
        title: 'Veriler Hazırlanıyor',
        detail: 'Bugünün koşulları kontrol ediliyor',
        tone: 'neutral',
        visual: 'irrigation',
        iconSrc: HOME_REFERENCE_ASSETS.iconRain,
        iconClass: 'water',
        target: 'weather',
      });
    } else if (weatherStatus === 'error' || !hasUsableTodayWeather) {
      candidates.push({
        id: 'weather-unavailable',
        group: 'weather-status',
        priority: 92,
        label: 'HAVA',
        title: 'Veriyi Bekle',
        detail: 'Hava verisi olmadan tarımsal karar verme',
        tone: 'red',
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconRain,
        iconClass: 'leaf',
        target: 'weather',
      });
    }

    if (quickTemperatureMin != null && quickTemperatureMin <= 3) {
      candidates.push({
        id: 'frost-risk',
        group: 'temperature-risk',
        priority: 100,
        label: 'DON RİSKİ',
        title: 'Geceyi Kontrol Et',
        detail: `En düşük ${Math.round(quickTemperatureMin)}°C bekleniyor`,
        tone: 'blue',
        visual: 'irrigation',
        iconSrc: HOME_REFERENCE_ASSETS.iconRain,
        iconClass: 'water',
        target: 'weather',
      });
    }

    if (quickTemperature != null && quickTemperature >= 34) {
      candidates.push({
        id: 'heat-risk',
        group: 'temperature-risk',
        priority: 88,
        label: 'ISI STRESİ',
        title: 'Öğlen İşlem Yapma',
        detail: `Sıcaklık ${Math.round(quickTemperature)}°C civarında`,
        tone: 'amber',
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconLeafGold,
        iconClass: 'leaf',
        target: 'weather',
      });
    }

    if (quickWindKmh != null && quickWindKmh >= 20) {
      candidates.push({
        id: 'spraying-wind-risk',
        group: 'spraying',
        priority: 96,
        label: 'İLAÇLAMA',
        title: 'Bugün Bekle',
        detail: `Rüzgâr ${Math.round(quickWindKmh)} km/sa`,
        tone: 'red',
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconLeafGold,
        iconClass: 'leaf',
        target: 'weather',
      });
    }

    if (
      (quickRainChance != null && quickRainChance >= 60) ||
      (quickRainMm != null && quickRainMm >= 3)
    ) {
      candidates.push({
        id: 'irrigation-rain-window',
        group: 'irrigation',
        priority: 90,
        label: 'SULAMA',
        title: 'Yağışı Bekle',
        detail:
          quickRainChance != null
            ? `Yağış ihtimali %${Math.round(quickRainChance)}`
            : `${Number(quickRainMm).toFixed(1)} mm yağış`,
        tone: 'blue',
        visual: 'irrigation',
        iconSrc: HOME_REFERENCE_ASSETS.iconWater,
        iconClass: 'water',
        target: 'weather',
      });
    }

    if (nextCalendarItem) {
      const calendarHours =
        (Number(nextCalendarItem._tpDateMs) - Date.now()) / (60 * 60 * 1000);
      candidates.push({
        id: `calendar-${String(nextCalendarItem.id ?? nextCalendarItem._tpDateMs)}`,
        group: 'calendar',
        priority: calendarHours <= 24 ? 94 : 74,
        label: 'TAKVİM',
        title: nextCalendarItem._tpTitle || 'Yaklaşan Görev',
        detail: formatCalendarTiming(nextCalendarItem._tpDateMs),
        tone: calendarHours <= 6 ? 'amber' : 'green',
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconDocument,
        iconClass: 'leaf',
        target: 'calendar',
      });
    }

    const pusulaAction = compactText(
      fieldSynthesis?.action ?? homePusulaResult?.analysis?.action,
      58,
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
      candidates.push({
        id: `pusula-${String(
          homePusulaResult?.analysis?.memoryObservationId ??
            homePusulaResult?.snapshotId ??
            fieldKey,
        )}`,
        group: 'pusula',
        priority: 89,
        label: 'PUSULA',
        title: pusulaArea ? `${pusulaArea} Bölümünü Kontrol Et` : 'Yeni Tarla Önerisi',
        detail: pusulaAction,
        tone: 'amber',
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconLeafGreen,
        iconClass: 'leaf',
        target: 'ai',
      });
    }

    if (hasUsableTodayWeather) {
      candidates.push({
        id: 'irrigation-baseline',
        group: 'irrigation',
        priority: 56,
        label: 'SULAMA',
        title: irrigationQuick.title,
        detail: irrigationQuick.detail,
        tone: irrigationQuick.tone,
        visual: 'irrigation',
        iconSrc: HOME_REFERENCE_ASSETS.iconWater,
        iconClass: 'water',
        target: 'weather',
      });

      candidates.push({
        id: 'spraying-baseline',
        group: 'spraying',
        priority: 52,
        label: 'İLAÇLAMA',
        title: sprayingQuick.title,
        detail: sprayingQuick.detail,
        tone: sprayingQuick.tone,
        visual: 'spraying',
        iconSrc: HOME_REFERENCE_ASSETS.iconLeafGold,
        iconClass: 'leaf',
        target: 'weather',
      });
    }

    candidates.sort((a, b) => b.priority - a.priority);

    const seenGroups = new Set<string>();
    const selected = candidates.filter((item) => {
      if (seenGroups.has(item.group)) return false;
      seenGroups.add(item.group);
      return true;
    });

    if (selected.length === 0) {
      selected.push({
        id: 'all-clear',
        group: 'status',
        priority: 1,
        label: 'BUGÜN',
        title: 'Acil İşlem Görünmüyor',
        detail: 'Yeni veri geldikçe burası otomatik güncellenecek',
        tone: 'green',
        visual: 'irrigation',
        iconSrc: HOME_REFERENCE_ASSETS.iconLeafGreen,
        iconClass: 'leaf',
        target: 'home',
      });
    }

    return selected.slice(0, 2);
  }, [
    fieldKey,
    weatherStatus,
    hasUsableTodayWeather,
    quickTemperatureMin,
    quickTemperature,
    quickWindKmh,
    quickRainChance,
    quickRainMm,
    nextCalendarItem,
    fieldSynthesis,
    homePusulaResult,
    irrigationQuick.title,
    irrigationQuick.detail,
    irrigationQuick.tone,
    sprayingQuick.title,
    sprayingQuick.detail,
    sprayingQuick.tone,
  ]);
}
