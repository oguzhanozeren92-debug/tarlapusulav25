import { useEffect, useState } from 'react';
import type { Field, FieldWeatherState, Screen } from '../../types';
import SprayWeatherGuide from '../../features/weather/components/SprayWeatherGuide';
import type { HourlySprayState } from '../../features/weather/services/hourlySprayForecast';
import {
  fetchWaterClimatePoint,
  type WaterClimatePointResult,
} from '../../services/waterClimateService';

type Setter<T> = (value: T) => void;

type DesktopMenuItem = {
  screen: Screen;
  icon?: string;
  label: string;
  badge?: string;
};

type FieldConditionCardsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rain30d: WaterClimatePointResult | null;
  et0SevenDay: WaterClimatePointResult | null;
  surfaceTemperature: WaterClimatePointResult | null;
  message: string;
};

type WeatherHubScreenProps = {
  cmsRuntimeCss?: string;
  cmsPageFor?: (pageKey: string) => any;
  cmsBlockFor?: (pageKey: string, blockKey: string) => any;
  cmsText?: (block: any, fallback: string) => string;

  realFields?: Field[];
  fieldWeather?: Record<string, FieldWeatherState>;
  fieldHourlyWeather?: Record<string, HourlySprayState>;
  loadFieldHourlyWeather?: (field: Field, force?: boolean) => void | Promise<void>;
  onPlanSprayWindow?: (field: Field, date: string, time: string, until: string) => void;
  weatherHubFieldId?: string;
  nasaPowerState?: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    fieldId?: string;
    fieldName?: string;
    data?: {
      summary?: {
        averageTemperature?: number | null;
        totalPrecipitation?: number | null;
        averageHumidity?: number | null;
        averageWindSpeed?: number | null;
        averageSolarRadiation?: number | null;
      };
      startDate?: string;
      endDate?: string;
      fetchedAt?: string;
    };
    message?: string;
  };

  era5ClimateState?: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    fieldId?: string;
    fieldName?: string;
    data?: {
      source?: string;
      provider?: string;
      period?: { start?: string; end?: string };
      era5LandGrid?: { resolutionDegrees?: number | null };
      era5PrecipGrid?: { resolutionDegrees?: number | null };
      summary?: {
        averageTemperatureC?: number | null;
        totalPrecipitationMm?: number | null;
        averageSoilTemperature0To7CmC?: number | null;
        averageSoilTemperature7To28CmC?: number | null;
        averageSoilMoisture0To7Cm?: number | null;
        averageSoilMoisture7To28Cm?: number | null;
        averageSoilMoisture28To100Cm?: number | null;
        averageSoilMoisture100To255Cm?: number | null;
      };
      fetchedAt?: string;
    };
    message?: string;
  };

  unifiedClimateContext?: {
    fieldId?: string;
    fieldName?: string;
    confidence?: 'high' | 'medium' | 'limited';
    normalized?: {
      averageTemperatureC?: number | null;
      totalPrecipitationMm?: number | null;
      averageHumidityPercent?: number | null;
      averageWindSpeed?: number | null;
      averageSolarRadiation?: number | null;
      soilTemperature0To7CmC?: number | null;
      soilTemperature7To28CmC?: number | null;
      soilMoisture0To7Cm?: number | null;
      soilMoisture7To28Cm?: number | null;
      soilMoisture28To100Cm?: number | null;
      soilMoisture100To255Cm?: number | null;
    };
    notes?: string[];
  } | null;

  sideMenuOpen?: boolean;
  screen?: Screen;
  desktopMenuItems?: DesktopMenuItem[];

  setScreen?: Setter<Screen>;
  setSideMenuOpen?: Setter<boolean>;
  setWeatherHubFieldId?: Setter<string>;

  loadFieldWeather?: (field: Field) => void | Promise<void>;
  weatherDayLabel?: (index: number) => string;
  weatherIcon?: (condition?: string) => string;
  openEra5Map?: () => void;
};

type IconName =
  | 'brand'
  | 'home'
  | 'field'
  | 'weather'
  | 'tractor'
  | 'soil'
  | 'bug'
  | 'package'
  | 'calendar'
  | 'bell'
  | 'settings'
  | 'menu'
  | 'sparkles'
  | 'wind'
  | 'drop'
  | 'thermo'
  | 'refresh'
  | 'chevron'
  | 'cloud'
  | 'sun'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'briefcase'
  | 'book'
  | 'more'
  | 'globe';


function WeatherArt({
  kind,
  size = 48,
}: {
  kind: IconName;
  size?: number;
}) {
  const cloud = (
    <>
      <ellipse cx="33" cy="38" rx="19" ry="10" fill="#d8d9d6" />
      <circle cx="25" cy="34" r="9" fill="#eef0ec" />
      <circle cx="35" cy="30" r="12" fill="#f3f1e9" />
      <circle cx="45" cy="35" r="8" fill="#c3c8c6" />
      <ellipse cx="34" cy="41" rx="18" ry="6" fill="#aeb5b2" opacity=".72" />
    </>
  );

  const darkCloud = (
    <>
      <ellipse cx="33" cy="37" rx="20" ry="10" fill="#69757b" />
      <circle cx="24" cy="34" r="9" fill="#89949a" />
      <circle cx="35" cy="29" r="12" fill="#7d898f" />
      <circle cx="46" cy="35" r="8" fill="#59666d" />
      <ellipse cx="34" cy="41" rx="18" ry="6" fill="#414d54" opacity=".9" />
    </>
  );

  const sun = (
    <>
      <g stroke="#f3bd42" strokeWidth="2.4" strokeLinecap="round" opacity=".96">
        <path d="M32 5v8" />
        <path d="M32 51v8" />
        <path d="M5 32h8" />
        <path d="M51 32h8" />
        <path d="m12.8 12.8 5.6 5.6" />
        <path d="m45.6 45.6 5.6 5.6" />
        <path d="m12.8 51.2 5.6-5.6" />
        <path d="m45.6 18.4 5.6-5.6" />
      </g>
      <circle cx="32" cy="32" r="14" fill="#f7c247" />
      <circle cx="28" cy="27" r="9" fill="#ffd96a" opacity=".78" />
      <circle cx="32" cy="32" r="20" fill="#efb62e" opacity=".10" />
    </>
  );

  let art;

  if (kind === 'sun') {
    art = sun;
  } else if (kind === 'rain') {
    art = (
      <>
        {darkCloud}
        <g stroke="#64d6ee" strokeWidth="3" strokeLinecap="round">
          <path d="m22 49-3 7" />
          <path d="m33 49-3 7" />
          <path d="m44 49-3 7" />
        </g>
      </>
    );
  } else if (kind === 'storm') {
    art = (
      <>
        {darkCloud}
        <path
          d="M35 45 27 57h7l-2 7 11-14h-7l3-5Z"
          fill="#f2c24e"
          stroke="#ffe08c"
          strokeWidth=".8"
        />
      </>
    );
  } else if (kind === 'snow') {
    art = (
      <>
        {cloud}
        <g fill="#d9f4ff" stroke="#91dff5" strokeWidth=".7">
          <path d="M21 50v8M17 54h8M18.5 51.5l5 5M23.5 51.5l-5 5" />
          <path d="M33 50v8M29 54h8M30.5 51.5l5 5M35.5 51.5l-5 5" />
          <path d="M45 50v8M41 54h8M42.5 51.5l5 5M47.5 51.5l-5 5" />
        </g>
      </>
    );
  } else if (kind === 'fog') {
    art = (
      <>
        {cloud}
        <g stroke="#b9d4d0" strokeWidth="2.2" strokeLinecap="round" opacity=".78">
          <path d="M15 49h35" />
          <path d="M20 55h29" />
          <path d="M17 61h34" />
        </g>
      </>
    );
  } else if (kind === 'cloud' || kind === 'weather') {
    art = (
      <>
        <g transform="translate(-8 -9) scale(.82)">
          {sun}
        </g>
        <g transform="translate(4 5)">
          {cloud}
        </g>
      </>
    );
  } else {
    art = cloud;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`tp-weather-art tp-weather-art-${kind}`}
      style={{
        overflow: 'visible',
        filter:
          kind === 'sun'
            ? 'drop-shadow(0 0 8px rgba(243,189,66,.45))'
            : kind === 'rain' || kind === 'storm'
              ? 'drop-shadow(0 0 8px rgba(81,169,190,.22))'
              : 'drop-shadow(0 4px 7px rgba(0,0,0,.28))',
      }}
    >
      {art}
    </svg>
  );
}

function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'brand':
      return (
        <svg {...common}>
          <path d="M12 21c4.2-2.8 7-6.7 7-11.2C19 6 16 3 12 3S5 6 5 9.8C5 14.3 7.8 18.2 12 21Z" />
          <path d="M12 17V8" />
          <path d="M12 12c-2.5-.1-4.2-1.2-5.2-3" />
          <path d="M12 9.8c2.4-.1 4.1-1.1 5.1-2.8" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      );
    case 'field':
      return (
        <svg {...common}>
          <path d="M4 19c4-5 8-8 16-10" />
          <path d="M4 15c4-3 8-5 16-7" />
          <path d="M4 11c4-2 8-3.2 16-4" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'weather':
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M7 18h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.5 9.5 4.25 4.25 0 0 0 7 18Z" />
          <path d="M8.5 6.3a4 4 0 0 1 6.2-1.5" />
        </svg>
      );
    case 'tractor':
      return (
        <svg {...common}>
          <circle cx="7" cy="17" r="2.7" />
          <circle cx="18" cy="17" r="2" />
          <path d="M9.7 17h6.3l-1.5-6H9V7H6.5" />
          <path d="M12 7h3l2 4h-7" />
        </svg>
      );
    case 'soil':
      return (
        <svg {...common}>
          <path d="M4 8h16M4 12h16M4 16h16" />
          <path d="M7 6v4M12 10v4M17 14v4" />
        </svg>
      );
    case 'bug':
      return (
        <svg {...common}>
          <path d="M8 9h8v6a4 4 0 0 1-8 0V9Z" />
          <path d="M9 7.5a3 3 0 0 1 6 0V9" />
          <path d="M5 10h3M16 10h3M5 14h3M16 14h3M7 18l-2 2M17 18l2 2" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4" y="5.5" width="16" height="14" rx="2" />
          <path d="M8 3v5M16 3v5M4 10h16" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6.5 16.5h11l-1.5-2V10a4 4 0 0 0-8 0v4l-1.5 2.5Z" />
          <path d="M10 19a2.2 2.2 0 0 0 4 0" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2.3-1.7.7-1.9-.9L1.1 6.2 2 8.1l-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2.3 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" transform="translate(2 0) scale(.83)" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
          <path d="m18.2 13 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
          <path d="m5.5 13 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
        </svg>
      );
    case 'wind':
      return (
        <svg {...common}>
          <path d="M4 8h9a2.5 2.5 0 1 0-2.2-3.7" />
          <path d="M4 12h14a2.5 2.5 0 1 1-2.2 3.7" />
          <path d="M4 16h7" />
        </svg>
      );
    case 'drop':
      return (
        <svg {...common}>
          <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />
        </svg>
      );
    case 'thermo':
      return (
        <svg {...common}>
          <path d="M10 14.2V5a2 2 0 1 1 4 0v9.2a4 4 0 1 1-4 0Z" />
          <path d="M12 8v8" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 7v5h-5" />
          <path d="M19 12a7 7 0 1 0-1.4 4.2" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'rain':
      return (
        <svg {...common}>
          <path d="M7 15h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.5 6.5 4.25 4.25 0 0 0 7 15Z" />
          <path d="m8 18-1 2M12 18l-1 2M16 18l-1 2" />
        </svg>
      );
    case 'storm':
      return (
        <svg {...common}>
          <path d="M7 14h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.5 5.5 4.25 4.25 0 0 0 7 14Z" />
          <path d="m13 15-3 4h3l-2 3" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common}>
          <path d="M7 13h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.5 4.5 4.25 4.25 0 0 0 7 13Z" />
          <path d="M8 17h.01M12 18h.01M16 17h.01M10 21h.01M14 21h.01" />
        </svg>
      );
    case 'fog':
      return (
        <svg {...common}>
          <path d="M5 8h14M3 12h18M6 16h12" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21M12 3C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...common}>
          <rect x="3.5" y="7" width="17" height="12" rx="2" />
          <path d="M9 7V5h6v2M3.5 12h17" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5v-16Z" />
          <path d="M20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5v-16Z" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

function navIcon(screen?: string, label?: string): IconName {
  const normalized = String(label ?? '').toLocaleLowerCase('tr-TR');

  if (screen === 'home' && normalized.includes('tarla')) return 'field';
  if (screen === 'home') return 'home';
  if (screen === 'weatherHub') return 'weather';
  if (screen === 'fieldControlHub') return 'tractor';
  if (screen === 'soilAnalysisHub') return 'soil';
  if (screen === 'pestGuideHub') return 'bug';
  if (screen === 'inventoryHub') return 'package';
  if (screen === 'agendaHub' || screen === 'calendar') return 'calendar';
  if (screen === 'notificationsHub') return 'bell';
  if (screen === 'settingsHub') return 'settings';
  if (screen === 'marketHub') return 'briefcase';
  if (screen === 'fieldNotebookHub') return 'book';

  return 'field';
}

function weatherGlyph(condition?: string): IconName {
  const value = String(condition ?? '').toLocaleLowerCase('tr-TR');

  if (
    value.includes('fırt') ||
    value.includes('thunder') ||
    value.includes('şimş')
  ) {
    return 'storm';
  }

  if (value.includes('kar') || value.includes('snow')) return 'snow';
  if (value.includes('yağ') || value.includes('rain')) return 'rain';
  if (value.includes('sis') || value.includes('fog')) return 'fog';
  if (value.includes('bulut') || value.includes('cloud')) return 'cloud';

  return 'sun';
}

const WEATHER_3D_BASE =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/weather';

type Weather3DKey =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'light-rain'
  | 'heavy-rain'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'wind'
  | 'night';

function weather3DKey(condition?: string): Weather3DKey {
  const value = String(condition ?? '').toLocaleLowerCase('tr-TR');

  if (value.includes('fırt') || value.includes('thunder') || value.includes('şimş') || value.includes('storm')) return 'storm';
  if (value.includes('kar') || value.includes('snow')) return 'snow';
  if (value.includes('sis') || value.includes('fog') || value.includes('mist')) return 'fog';
  if (value.includes('sağanak') || value.includes('kuvvetli yağ') || value.includes('heavy rain') || value.includes('shower')) return 'heavy-rain';
  if (value.includes('yağ') || value.includes('rain') || value.includes('drizzle') || value.includes('çise')) return 'light-rain';
  if (value.includes('rüzg') || value.includes('wind')) return 'wind';
  if (value.includes('gece') || value.includes('night')) return 'night';
  if (value.includes('parçalı') || value.includes('az bulut') || value.includes('partly') || value.includes('mostly sunny')) return 'partly-cloudy';
  if (value.includes('bulut') || value.includes('cloud') || value.includes('kapalı') || value.includes('overcast')) return 'cloudy';
  return 'sunny';
}

function weather3DIcon(condition?: string) {
  return `${WEATHER_3D_BASE}/${weather3DKey(condition)}.webp`;
}

type WeatherPusulaInsight = {
  id: string;
  gozlem: string;
  yonlendirme?: string;
  guven_skoru?: 'Yüksek' | 'Orta' | 'Düşük';
};

const WEATHER_AUTO_REFRESH_MS = 8 * 60 * 60 * 1000;
const WEATHER_AUTO_CHECK_MS = 15 * 60 * 1000;

// Aynı uygulama çalışma süresinde aynı tarla için gereksiz tekrar çağrıyı engeller.
// Sayfa tamamen yenilenirse Set sıfırlanır; böylece ekranda veri yoksa bir kez tekrar alınabilir.
const WEATHER_FETCHED_THIS_RUNTIME = new Set<string>();

function weatherFetchStorageKey(fieldId: string) {
  return `tp_weather_last_fetch_v1:${fieldId}`;
}

function readWeatherFetchTimestamp(fieldId: string) {
  try {
    const value = Number(window.localStorage.getItem(weatherFetchStorageKey(fieldId)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function markWeatherFetchTimestamp(fieldId: string) {
  try {
    window.localStorage.setItem(weatherFetchStorageKey(fieldId), String(Date.now()));
  } catch {
    // localStorage kapalıysa uygulama normal şekilde çalışmaya devam eder.
  }
}

function isRainSignal(day: any) {
  if (!day) return false;

  const probability = Number(day?.precipitationProbability ?? 0);
  const precipitation = Number(day?.precipitation ?? 0);
  const condition = String(day?.condition ?? day?.description ?? '')
    .toLocaleLowerCase('tr-TR');

  return (
    (Number.isFinite(probability) && probability >= 50) ||
    (Number.isFinite(precipitation) && precipitation > 0) ||
    condition.includes('yağ') ||
    condition.includes('sağanak') ||
    condition.includes('rain') ||
    condition.includes('shower') ||
    condition.includes('fırt') ||
    condition.includes('storm') ||
    condition.includes('thunder')
  );
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function weatherConditionCenter(field: any) {
  const directLat = safeNumber(field?.parcelCentroidLat ?? field?.parcel_centroid_lat ?? field?.latitude);
  const directLng = safeNumber(field?.parcelCentroidLng ?? field?.parcel_centroid_lng ?? field?.longitude);

  if (directLat !== null && directLng !== null) {
    return { latitude: directLat, longitude: directLng };
  }

  const geometry = field?.parcelGeometry?.geometry ?? field?.parcelGeometry ?? field?.parcel_geometry?.geometry ?? field?.parcel_geometry;
  const points: Array<[number, number]> = [];

  const collect = (value: any) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      points.push([Number(value[0]), Number(value[1])]);
      return;
    }
    value.forEach(collect);
  };

  collect(geometry?.coordinates);
  if (!points.length) return null;

  const longitude = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const latitude = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function formatTemp(value: unknown) {
  const number = safeNumber(value);
  return number === null ? '—' : `${Math.round(number)}°`;
}

function providerDisplayName(name: string | undefined, index: number) {
  const expected = ['ECMWF', 'GFS', 'DWD ICON'];
  const clean = String(name ?? '').trim();

  if (!clean || /^kaynak\s*\d+$/i.test(clean)) {
    return expected[index] ?? `Kaynak ${index + 1}`;
  }

  return clean;
}

export default function WeatherHubScreen(props: WeatherHubScreenProps) {
  const {
    cmsRuntimeCss = '',
    cmsPageFor = () => null,
    cmsBlockFor = () => null,
    cmsText = (_block, fallback) => fallback,
    realFields = [],
    fieldWeather = {},
    fieldHourlyWeather = {},
    loadFieldHourlyWeather = () => undefined,
    weatherHubFieldId = '',
    nasaPowerState = { status: 'idle' },
    era5ClimateState = { status: 'idle' },
    unifiedClimateContext = null,
    sideMenuOpen = false,
    desktopMenuItems = [],
    setScreen = () => undefined,
    setSideMenuOpen = () => undefined,
    setWeatherHubFieldId = () => undefined,
    loadFieldWeather = () => undefined,
    weatherDayLabel = (index) =>
      ['Bugün', 'Yarın', '3. Gün', '4. Gün', '5. Gün'][index] ?? `${index + 1}. Gün`,
    openEra5Map = () => undefined,
  } = props;

  const weatherPage = cmsPageFor('weatherHub');
  const weatherHeroBlock = cmsBlockFor('weatherHub', 'hero');
  const [sprayGuideOpen, setSprayGuideOpen] = useState(false);
  const [fieldConditionCards, setFieldConditionCards] = useState<FieldConditionCardsState>({
    status: 'idle',
    rain30d: null,
    et0SevenDay: null,
    surfaceTemperature: null,
    message: '',
  });

  useEffect(() => {
    if (!sprayGuideOpen || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSprayGuideOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sprayGuideOpen]);

  const safeFields = Array.isArray(realFields) ? realFields : [];
  const fallbackField = safeFields[0] ?? null;
  const weatherField =
    safeFields.find((field) => String(field.id) === String(weatherHubFieldId)) ??
    fallbackField;

  const weatherKey = weatherField ? String(weatherField.id) : '';
  const conditionCenter = weatherConditionCenter(weatherField);

  useEffect(() => {
    if (!weatherKey || !conditionCenter) {
      setFieldConditionCards({
        status: weatherKey ? 'error' : 'idle',
        rain30d: null,
        et0SevenDay: null,
        surfaceTemperature: null,
        message: weatherKey ? 'Tarla koşulları için tarla koordinatı bulunamadı.' : '',
      });
      return;
    }

    let active = true;
    setFieldConditionCards((current) => ({ ...current, status: 'loading', message: '' }));

    void Promise.allSettled([
      fetchWaterClimatePoint(
        conditionCenter.latitude,
        conditionCenter.longitude,
        'rain_history',
        30,
      ),
      fetchWaterClimatePoint(
        conditionCenter.latitude,
        conditionCenter.longitude,
        'et0_fao_evapotranspiration',
        7,
      ),
      fetchWaterClimatePoint(
        conditionCenter.latitude,
        conditionCenter.longitude,
        'surface_temperature',
        7,
      ),
    ]).then((results) => {
      if (!active) return;

      const value = (index: number) =>
        results[index]?.status === 'fulfilled'
          ? (results[index] as PromiseFulfilledResult<WaterClimatePointResult>).value
          : null;

      const rain30d = value(0);
      const et0SevenDay = value(1);
      const surfaceTemperature = value(2);
      const usable = Boolean(rain30d || et0SevenDay || surfaceTemperature);

      setFieldConditionCards({
        status: usable ? 'ready' : 'error',
        rain30d,
        et0SevenDay,
        surfaceTemperature,
        message: usable
          ? ''
          : 'Tarla koşulları şu anda alınamadı. Kayıtlı veri varsa sonraki açılışta kullanılacaktır.',
      });
    });

    return () => {
      active = false;
    };
  }, [
    weatherKey,
    conditionCenter?.latitude,
    conditionCenter?.longitude,
  ]);
  useEffect(() => {
    if (!weatherField) return;
    const update = () => { if (document.visibilityState === 'visible') void loadFieldHourlyWeather(weatherField); };
    update();
    const timer = window.setInterval(update, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [weatherKey, weatherField, loadFieldHourlyWeather]);
  const weatherState =
    (weatherKey ? fieldWeather?.[weatherKey] : null) ??
    ({
      status: 'idle',
      forecast: [],
      providers: [],
    } as FieldWeatherState);

  const consensus = Array.isArray(weatherState?.forecast)
    ? weatherState.forecast.slice(0, 5)
    : [];

  const providers = Array.isArray(weatherState?.providers)
    ? weatherState.providers.slice(0, 3)
    : [];

  const tableSources = [0, 1, 2].map((index) => {
    const provider = providers[index];

    return {
      name: providerDisplayName(provider?.name, index),
      forecast: Array.isArray(provider?.forecast)
        ? provider.forecast.slice(0, 5)
        : [],
      available: Boolean(provider?.forecast?.length),
    };
  });

  const hasWeatherData =
    consensus.length > 0 || providers.some((provider) => Boolean(provider?.forecast?.length));

  // Kullanıcının bastığı Yenile / Tekrar Dene çağrıları 8 saatlik sayacı yeniden başlatır.
  // Manuel yenileme her zaman serbesttir; 8 saat sınırı otomatik çağrılar içindir.
  const refreshWeatherNow = (field: Field) => {
    const fieldId = String(field.id);
    WEATHER_FETCHED_THIS_RUNTIME.add(fieldId);
    markWeatherFetchTimestamp(fieldId);
    return loadFieldWeather(field);
  };

  const firstDay = consensus[0] ?? providers[0]?.forecast?.[0];
  const windSpeed = safeNumber(firstDay?.windSpeed);
  const rainChance = safeNumber(firstDay?.precipitationProbability) ?? 0;
  const tempMax = safeNumber(firstDay?.tempMax);
  const tempMin = safeNumber(firstDay?.tempMin);
  const humidity = safeNumber(firstDay?.humidity);

  const nasaMatchesField =
    !nasaPowerState.fieldId ||
    String(nasaPowerState.fieldId) === String(weatherField?.id ?? '');
  const nasaSummary = nasaMatchesField ? nasaPowerState.data?.summary : undefined;
  const nasaTemperature = safeNumber(nasaSummary?.averageTemperature);
  const nasaRainfall = safeNumber(nasaSummary?.totalPrecipitation);
  const nasaHumidity = safeNumber(nasaSummary?.averageHumidity);
  const nasaSolar = safeNumber(nasaSummary?.averageSolarRadiation);

  const climateTone =
    nasaPowerState.status === 'error'
      ? 'error'
      : nasaPowerState.status === 'ready' && nasaMatchesField
        ? 'ready'
        : nasaPowerState.status === 'loading'
          ? 'loading'
          : 'idle';

  const era5MatchesField =
    !era5ClimateState.fieldId ||
    String(era5ClimateState.fieldId) === String(weatherField?.id ?? '');

  const era5Summary = era5MatchesField ? era5ClimateState.data?.summary : undefined;
  const era5Temperature = safeNumber(era5Summary?.averageTemperatureC);
  const era5Rainfall = safeNumber(era5Summary?.totalPrecipitationMm);
  const soilTempSurface = safeNumber(era5Summary?.averageSoilTemperature0To7CmC);
  const soilTempRoot = safeNumber(era5Summary?.averageSoilTemperature7To28CmC);
  const soilMoistureSurface = safeNumber(era5Summary?.averageSoilMoisture0To7Cm);
  const soilMoistureRoot = safeNumber(era5Summary?.averageSoilMoisture7To28Cm);
  const soilMoistureDeep = safeNumber(era5Summary?.averageSoilMoisture28To100Cm);
  const soilMoistureVeryDeep = safeNumber(era5Summary?.averageSoilMoisture100To255Cm);

  const era5Tone =
    era5ClimateState.status === 'error'
      ? 'error'
      : era5ClimateState.status === 'ready' && era5MatchesField
        ? 'ready'
        : era5ClimateState.status === 'loading'
          ? 'loading'
          : 'idle';

  const combinedClimateReady = climateTone === 'ready' || era5Tone === 'ready';
  const combinedClimateLoading =
    !combinedClimateReady && (climateTone === 'loading' || era5Tone === 'loading');
  const combinedClimateError =
    !combinedClimateReady &&
    !combinedClimateLoading &&
    (climateTone === 'error' || era5Tone === 'error');

  const combinedClimateTone = combinedClimateReady
    ? 'ready'
    : combinedClimateLoading
      ? 'loading'
      : combinedClimateError
        ? 'error'
        : 'idle';

  const rain30dValue = safeNumber(fieldConditionCards.rain30d?.stats?.average);
  const et0SevenDayValue = safeNumber(fieldConditionCards.et0SevenDay?.stats?.average);
  const surfaceTemperatureValue =
    soilTempSurface ?? safeNumber(fieldConditionCards.surfaceTemperature?.stats?.average);
  const conditionSoilMoistureSurface =
    soilMoistureSurface ?? safeNumber(unifiedClimateContext?.normalized?.soilMoisture0To7Cm);
  const conditionSoilMoistureRoot =
    soilMoistureRoot ?? safeNumber(unifiedClimateContext?.normalized?.soilMoisture7To28Cm);

  const rain30dFarmerText =
    rain30dValue === null
      ? 'Son 30 günlük kayıt bekleniyor.'
      : rain30dValue < 5
        ? 'Son 30 günde yağış çok sınırlı kalmış.'
        : rain30dValue < 20
          ? 'Son 30 günlük yağış düşük tarafta.'
          : rain30dValue < 50
            ? 'Son 30 günde orta düzeyde yağış birikmiş.'
            : 'Son 30 günde belirgin yağış birikimi var.';

  const surfaceTemperatureFarmerText =
    surfaceTemperatureValue === null
      ? 'Yüzeye yakın toprak sıcaklığı bekleniyor.'
      : surfaceTemperatureValue >= 30
        ? 'Yüzeye yakın toprak son model döneminde sıcak seyretmiş.'
        : surfaceTemperatureValue <= 8
          ? 'Yüzeye yakın toprak son model döneminde serin seyretmiş.'
          : 'Yüzeye yakın toprak sıcaklığı ılımlı aralıkta seyretmiş.';

  const et0DayCount =
    safeNumber(fieldConditionCards.et0SevenDay?.stats?.validCellCount) ?? 7;
  const et0DailyAverage =
    et0SevenDayValue === null || et0DayCount <= 0
      ? null
      : et0SevenDayValue / et0DayCount;
  const et0FarmerLabel =
    et0DailyAverage === null
      ? 'Veri bekleniyor'
      : et0DailyAverage >= 5
        ? 'Havanın su talebi yüksek'
        : et0DailyAverage >= 3.5
          ? 'Havanın su talebi orta-yüksek'
          : et0DailyAverage >= 2
            ? 'Havanın su talebi orta'
            : 'Havanın su talebi düşük';

  const climatePrimaryValue =
    conditionSoilMoistureSurface !== null
      ? conditionSoilMoistureSurface.toFixed(3)
      : era5Temperature !== null
        ? `${era5Temperature.toFixed(1)}°C`
        : '—';
  const climatePrimaryUnit =
    conditionSoilMoistureSurface !== null ? 'm³/m³ · üst toprak' : 'model sıcaklığı';

  const climateConfidenceLabel =
    unifiedClimateContext?.confidence === 'high'
      ? 'YÜKSEK GÜVEN'
      : unifiedClimateContext?.confidence === 'medium'
        ? 'ORTA GÜVEN'
        : 'MODEL REFERANSI';

  const rainyDays = consensus.filter((day: any) => {
    const probability = safeNumber(day?.precipitationProbability) ?? 0;
    const precipitation = safeNumber(day?.precipitation) ?? 0;
    return probability >= 40 || precipitation > 0;
  }).length;

  const windStatus =
    windSpeed === null
      ? { label: 'Veri bekleniyor', tone: 'neutral' }
      : windSpeed >= 35
        ? { label: 'Saha işi için riskli', tone: 'warning' }
        : windSpeed >= 20
          ? { label: 'Dikkatli çalış', tone: 'attention' }
          : { label: 'Uygun', tone: 'good' };

  const irrigationStatus =
    rainChance >= 60
      ? { label: 'Sulamayı ertele', tone: 'good' }
      : rainChance >= 30
        ? { label: 'Yağışı kontrol et', tone: 'attention' }
        : { label: 'Toprak nemini kontrol et', tone: 'neutral' };

  const heatStatus =
    tempMax === null
      ? { label: 'Veri bekleniyor', tone: 'neutral' }
      : tempMax >= 36
        ? { label: 'Sıcaklık stresi', tone: 'warning' }
        : tempMax >= 30
          ? { label: 'Öğle saatlerine dikkat', tone: 'attention' }
          : { label: 'Uygun', tone: 'good' };

  const summaryText =
    consensus.length === 0
      ? 'Seçili tarla için tahmin verileri yüklendiğinde saha planı özeti burada oluşturulacak.'
      : rainyDays >= 3
        ? 'Önümüzdeki beş günde yağışlı gün sayısı yüksek. İlaçlama, gübreleme ve hasat gibi işlemleri yağış aralıklarına göre planlamak daha güvenli olur.'
        : rainyDays > 0
          ? 'Tahminlerde bazı günlerde yağış ihtimali var. Sulama ve ilaçlama kararından önce günlük yağış ve rüzgâr değerlerini kontrol et.'
          : windSpeed !== null && windSpeed >= 30
            ? 'Yağış riski düşük görünse de rüzgâr kuvvetli. Özellikle ilaçlama ve yaprak uygulamalarını daha sakin saatlere bırakmak uygun olur.'
            : 'Önümüzdeki günler genel olarak saha çalışmasına uygun görünüyor. Sulama kararını toprak nemi ve ürün ihtiyacıyla birlikte değerlendir.';

  const todayModelDays = tableSources
    .map((source) => source.forecast?.[0])
    .filter(Boolean);
  const modelCount = todayModelDays.length;
  const rainVotes = todayModelDays.filter(isRainSignal).length;
  const dryVotes = Math.max(0, modelCount - rainVotes);
  const majorityRain = modelCount >= 2 && rainVotes > dryVotes;
  const modelsDisagree = modelCount >= 2 && rainVotes > 0 && dryVotes > 0;

  /* =========================================================
     PUSULA · ÜRÜN + TARİH + HAVA + TOPRAK KARAR MOTORU
     ---------------------------------------------------------
     Amaç hava durumunu tekrar etmek değil; seçili tarlada
     bugün ne yapılmasının daha mantıklı olduğunu söylemek.

     Not: ERA5-Land toprak nemi model tabanlıdır; parsel sensörü
     veya laboratuvar ölçümü değildir. Bu yüzden sulama kararı
     özellikle sınır değerlerde ihtiyatlı dille verilir.
     ========================================================= */

  const pusulaNow = new Date();
  const pusulaMonth = pusulaNow.getMonth() + 1;
  const pusulaMonthLabel = pusulaNow.toLocaleDateString('tr-TR', {
    month: 'long',
  });
  const pusulaDateLabel = pusulaNow.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
  });

  const fieldNameForPusula = String(
    (weatherField as any)?.name ?? 'Seçili tarla',
  ).trim();
  const cropNameForPusula = String(
    (weatherField as any)?.crop ?? (weatherField as any)?.product ?? '',
  ).trim();
  const cropLabelForPusula = cropNameForPusula || 'kayıtlı ürün';

  const normalizedCrop = cropNameForPusula
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');

  const orchardCrop = /(kiraz|elma|armut|seftali|kayisi|erik|uzum|zeytin|findik|ceviz|nar|narenciye|portakal|mandalina|limon)/.test(
    normalizedCrop,
  );
  const warmSeasonCrop = /(misir|aycicegi|pamuk|seker pancari|patates|domates|biber|kavun|karpuz|salatalik|soya|fasulye)/.test(
    normalizedCrop,
  );
  const coolSeasonCereal = /(bugday|arpa|cavdar|yulaf|tritikale)/.test(
    normalizedCrop,
  );

  const warmSeason = pusulaMonth >= 5 && pusulaMonth <= 9;
  const peakSummer = pusulaMonth >= 6 && pusulaMonth <= 8;
  const coldSeason = pusulaMonth === 12 || pusulaMonth <= 2;

  const decisionForecast =
    consensus.length > 0
      ? consensus
      : tableSources.find((source) => source.forecast.length > 0)?.forecast ?? [];

  const next48Hours = decisionForecast.slice(0, 2);
  const next72Hours = decisionForecast.slice(0, 3);
  const rainLikelyNext48h = next48Hours.some(isRainSignal);
  const rainLikelyNext72h = next72Hours.some(isRainSignal);
  const dryWindowNext48h =
    next48Hours.length >= 2 && next48Hours.every((day: any) => !isRainSignal(day));
  const dryWindowNext72h =
    next72Hours.length >= 2 && next72Hours.every((day: any) => !isRainSignal(day));

  const maxTempNext72h = next72Hours.reduce<number | null>((max, day: any) => {
    const value = safeNumber(day?.tempMax);
    if (value === null) return max;
    return max === null ? value : Math.max(max, value);
  }, null);

  const minTempNext72h = next72Hours.reduce<number | null>((min, day: any) => {
    const value = safeNumber(day?.tempMin);
    if (value === null) return min;
    return min === null ? value : Math.min(min, value);
  }, null);

  // ERA5 hazır değilse birleşik iklim bağlamındaki aynı değişkenleri kullan.
  const surfaceMoistureForPusula =
    soilMoistureSurface ??
    safeNumber(unifiedClimateContext?.normalized?.soilMoisture0To7Cm);
  const rootMoistureForPusula =
    soilMoistureRoot ??
    safeNumber(unifiedClimateContext?.normalized?.soilMoisture7To28Cm);

  const surfaceMoistureLow =
    surfaceMoistureForPusula !== null && surfaceMoistureForPusula < 0.18;
  const rootMoistureLow =
    rootMoistureForPusula !== null && rootMoistureForPusula < 0.20;
  const surfaceMoistureComfortable =
    surfaceMoistureForPusula !== null && surfaceMoistureForPusula >= 0.24;
  const rootMoistureComfortable =
    rootMoistureForPusula !== null && rootMoistureForPusula >= 0.24;
  const hasSoilMoisture =
    surfaceMoistureForPusula !== null || rootMoistureForPusula !== null;

  const currentConditionForPusula = String(
    (firstDay as any)?.condition ?? (firstDay as any)?.description ?? '',
  ).toLocaleLowerCase('tr-TR');

  const stormSignal =
    currentConditionForPusula.includes('fırt') ||
    currentConditionForPusula.includes('storm') ||
    currentConditionForPusula.includes('thunder') ||
    currentConditionForPusula.includes('şimş');

  const heatSignal =
    (maxTempNext72h ?? tempMax ?? -Infinity) >= 34;
  const severeHeatSignal =
    (maxTempNext72h ?? tempMax ?? -Infinity) >= 37;
  const frostSignal =
    (minTempNext72h ?? tempMin ?? Infinity) <= 2;
  const sprayWindRisk = windSpeed !== null && windSpeed >= 20;
  const strongWindRisk = windSpeed !== null && windSpeed >= 30;

  // Ürünün takvimsel bağlamını kaba ama güvenli şekilde kullan.
  // Ekim/çeşit/gelişim evresi bilinmediği için kesin fenoloji uydurulmaz.
  let cropSeasonContext = `${pusulaMonthLabel} dönemi`;
  if (orchardCrop && warmSeason) {
    cropSeasonContext = `${pusulaMonthLabel} ayında bahçe ürünü için aktif sezon`;
  } else if (warmSeasonCrop && warmSeason) {
    cropSeasonContext = `${pusulaMonthLabel} ayında sıcak dönem ürünü için aktif sezon`;
  } else if (coolSeasonCereal && pusulaMonth >= 10) {
    cropSeasonContext = `${pusulaMonthLabel} ayında serin dönem tahılı için sezon başlangıcı`;
  } else if (coolSeasonCereal && pusulaMonth >= 6 && pusulaMonth <= 8) {
    cropSeasonContext = `${pusulaMonthLabel} ayında serin dönem tahılı için hasat/hasat sonrası döneme denk gelebilen zaman`;
  } else if (coldSeason) {
    cropSeasonContext = `${pusulaMonthLabel} ayında soğuk dönem koşulları`;
  }

  const evidence: string[] = [];
  if (cropNameForPusula) evidence.push(`ürün: ${cropNameForPusula}`);
  evidence.push(`tarih: ${pusulaDateLabel}`);

  if (rainChance > 0) {
    evidence.push(`bugün yağış olasılığı %${Math.round(rainChance)}`);
  }
  if (modelCount >= 2) {
    evidence.push(`${modelCount} modelden ${rainVotes} tanesi yağış sinyali veriyor`);
  }
  if (windSpeed !== null) {
    evidence.push(`rüzgâr ${Math.round(windSpeed)} km/sa`);
  }
  if (maxTempNext72h !== null) {
    evidence.push(`önümüzdeki 3 gün en yüksek ${Math.round(maxTempNext72h)}°C`);
  } else if (tempMax !== null) {
    evidence.push(`bugün en yüksek ${Math.round(tempMax)}°C`);
  }
  if (surfaceMoistureForPusula !== null) {
    evidence.push(
      `yüzey toprak nemi ${surfaceMoistureForPusula.toFixed(3)} m³/m³`,
    );
  }
  if (rootMoistureForPusula !== null) {
    evidence.push(
      `kök bölgesi nemi ${rootMoistureForPusula.toFixed(3)} m³/m³`,
    );
  }

  let weatherPusulaObservation = '';
  let weatherPusulaGuidance = '';

  const cropPrefix = cropNameForPusula
    ? `${cropNameForPusula} için`
    : 'Bu tarla için';

  if (!weatherField || (!firstDay && modelCount === 0)) {
    weatherPusulaObservation = `${fieldNameForPusula} için hava verileri henüz hazır değil.`;
    weatherPusulaGuidance =
      'Tahmin verileri geldiğinde ürün, tarih, yağış, rüzgâr, sıcaklık ve toprak nemini birlikte değerlendirip saha kararını söyleyeceğim.';
  } else if (!cropNameForPusula) {
    weatherPusulaObservation =
      `${fieldNameForPusula} için hava verisi hazır, fakat ürün bilgisi kayıtlı değil.`;
    weatherPusulaGuidance =
      'Ürün bilgisi eklenirse sulama, ilaçlama ve mevsimsel saha önerisini ürün özelinde daraltabilirim.';
  } else if (frostSignal) {
    weatherPusulaObservation =
      `${cropPrefix} don riski öne çıkıyor. Hassas dokular ve yeni gelişen kısımlar için bugün koruma planını kontrol et.`;
    weatherPusulaGuidance =
      `Neden: ${[...evidence, cropSeasonContext].slice(0, 4).join('; ')}.`;
  } else if (stormSignal || rainChance >= 60 || majorityRain) {
    weatherPusulaObservation =
      `${cropPrefix} bugün ilaçlama veya yapraktan gübreleme uygun görünmüyor. Yağış uygulamanın etkisini azaltabilir.`;
    weatherPusulaGuidance =
      `Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (sprayWindRisk && (rainLikelyNext48h || strongWindRisk)) {
    weatherPusulaObservation =
      `${cropPrefix} ilaçlama ve yaprak uygulamasını daha sakin bir pencereye bırak.`;
    weatherPusulaGuidance =
      `Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (
    warmSeason &&
    !rainLikelyNext72h &&
    (surfaceMoistureLow || rootMoistureLow) &&
    (heatSignal || warmSeasonCrop || orchardCrop)
  ) {
    // Yaz/sıcak sezon + kuru tahmin + düşük model nemi: sulama kontrolü öncelikli.
    // Serin dönem tahıllarında yaz aylarında doğrudan "sula" demeyiz; ürün evresi bilinmeyebilir.
    if (coolSeasonCereal && pusulaMonth >= 6 && pusulaMonth <= 8) {
      weatherPusulaObservation =
        `${cropPrefix} toprak nemi düşük sinyal veriyor; ancak takvim hasat/hasat sonrası döneme denk gelebilir.`;
      weatherPusulaGuidance =
        `Sulamayı doğrudan başlatmak yerine ürünün hâlâ aktif gelişimde olup olmadığını kontrol et. Neden: ${evidence.slice(0, 4).join('; ')}.`;
    } else {
      weatherPusulaObservation =
        `${cropPrefix} sulama kontrolü bugün öncelikli görünüyor. Sıcak/kuru hava ile düşük toprak nemi aynı yönde sinyal veriyor.`;
      weatherPusulaGuidance =
        `Özellikle sabah erken veya akşam saatlerinde saha nemini doğrula; gerekiyorsa sulamayı planla. Neden: ${evidence.slice(0, 4).join('; ')}.`;
    }
  } else if (
    warmSeason &&
    !rainLikelyNext72h &&
    severeHeatSignal &&
    !hasSoilMoisture
  ) {
    weatherPusulaObservation =
      `${cropPrefix} sıcak ve kuru bir dönem var, fakat toprak nemi verisi yok.`;
    weatherPusulaGuidance =
      `Kesin sulama kararı vermeden önce kök bölgesi nemini kontrol et. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (
    rainLikelyNext48h &&
    (surfaceMoistureComfortable || rootMoistureComfortable)
  ) {
    weatherPusulaObservation =
      `${cropPrefix} şu an ek sulama için güçlü bir gerekçe görünmüyor. Toprak nemi yeterli sinyal verirken yağış da yaklaşıyor.`;
    weatherPusulaGuidance =
      `Sulamayı erteleyip yağış sonrasında nemi yeniden kontrol et. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (rainLikelyNext48h) {
    weatherPusulaObservation =
      `${cropPrefix} sulamayı kesinleştirmeden önce yaklaşan yağışı beklemek daha mantıklı görünüyor.`;
    weatherPusulaGuidance =
      `İlaçlama yapacaksan yağış penceresini de hesaba kat. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (
    warmSeason &&
    heatSignal &&
    (surfaceMoistureComfortable || rootMoistureComfortable)
  ) {
    weatherPusulaObservation =
      `${cropPrefix} hava sıcak olsa da toprak nemi şu an yeterli sinyal veriyor; acil sulama öne çıkmıyor.`;
    weatherPusulaGuidance =
      `Nemi izlemeye devam et ve öğle sıcağında yaprak uygulamasından kaçın. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (modelsDisagree) {
    weatherPusulaObservation =
      `${cropPrefix} yağış konusunda modeller ayrışıyor. Bugün kritik uygulamayı kesinleştirmek için tahmini yeniden kontrol etmek daha güvenli.`;
    weatherPusulaGuidance =
      `Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (dryWindowNext72h && !sprayWindRisk) {
    weatherPusulaObservation =
      `${cropPrefix} önümüzdeki birkaç gün yağış ve rüzgâr açısından uygun bir saha penceresi var.`;
    weatherPusulaGuidance =
      `İlaçlama veya yaprak uygulaması planlıysa ürün etiketi ve mevcut gelişim dönemini de kontrol ederek bu pencereyi değerlendirebilirsin. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else if (surfaceMoistureLow || rootMoistureLow) {
    weatherPusulaObservation =
      `${cropPrefix} toprak nemi düşük sinyal veriyor, fakat hava koşulları tek başına hemen sulama kararı vermek için yeterli değil.`;
    weatherPusulaGuidance =
      `Kök bölgesi nemini sahada doğrula ve ${cropSeasonContext.toLocaleLowerCase('tr-TR')} olduğunu hesaba kat. Neden: ${evidence.slice(0, 4).join('; ')}.`;
  } else {
    weatherPusulaObservation =
      `${fieldNameForPusula} · ${cropLabelForPusula}: bugün belirgin bir hava riski öne çıkmıyor.`;
    weatherPusulaGuidance =
      `Saha işlerini sürdürebilirsin; sulama kararında toprak nemini, ilaçlamada yağış ve rüzgârı esas almaya devam et. ${cropSeasonContext}.`;
  }

  const weatherPusulaConfidence: 'Yüksek' | 'Orta' | 'Düşük' =
    modelCount >= 3 && !modelsDisagree && cropNameForPusula
      ? 'Yüksek'
      : (modelCount >= 2 || combinedClimateReady) && cropNameForPusula
        ? 'Orta'
        : 'Düşük';

  const weatherPusulaInsight: WeatherPusulaInsight = {
    id: [
      'weather-v2',
      weatherKey || 'no-field',
      normalizedCrop || 'no-crop',
      pusulaNow.toISOString().slice(0, 10),
      weatherState.status,
      Math.round(rainChance),
      windSpeed === null ? 'nw' : Math.round(windSpeed),
      tempMax === null ? 'ntx' : Math.round(tempMax),
      tempMin === null ? 'ntn' : Math.round(tempMin),
      `${rainVotes}of${modelCount}`,
      surfaceMoistureForPusula === null
        ? 'nsm'
        : surfaceMoistureForPusula.toFixed(3),
      rootMoistureForPusula === null ? 'nrm' : rootMoistureForPusula.toFixed(3),
    ].join('-'),
    gozlem: weatherPusulaObservation,
    yonlendirme: weatherPusulaGuidance,
    guven_skoru: weatherPusulaConfidence,
  };

  // Global üst başlıktaki Pusula'ya yalnızca gerçek hava verisinden üretilen
  // güncel öneriyi gönderir. Görsel yerleşime hiçbir şey eklemez/değiştirmez.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Global header yeniden mount olsa bile Pusula'nın son gerçek tarla yorumunu
    // kaybetmemesi için küçük bir yerel kopya tutuyoruz. Bu yeni veri çekmez.
    try {
      window.localStorage.setItem(
        'tp_pusula_weather_latest_v2',
        JSON.stringify({
          fieldName: fieldNameForPusula,
          fieldId: weatherKey,
          crop: cropNameForPusula,
          savedAt: Date.now(),
          insight: weatherPusulaInsight,
        }),
      );
    } catch {
      // localStorage kapalıysa custom event yine çalışır.
    }

    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('tp-pusula-insight', {
          detail: {
            screen: 'weatherHub',
            fieldName: fieldNameForPusula,
            fieldId: weatherKey,
            crop: cropNameForPusula,
            insight: weatherPusulaInsight,
            // İlk otomatik konuşma yalnızca gerçek tahmin verisi geldikten sonra yapılır.
            autoEligible: hasWeatherData,
          },
        }),
      );
    }, 220);

    return () => window.clearTimeout(timer);
  }, [weatherPusulaInsight.id, hasWeatherData, fieldNameForPusula, weatherKey, cropNameForPusula]);

  // Hava API'lerini sayfaya her girişte çağırma.
  // Otomatik yenileme tarla bazında en fazla 8 saatte bir yapılır.
  // Ekran 8 saatten uzun açık kalırsa 15 dakikada bir yalnızca sürenin dolup dolmadığı kontrol edilir;
  // bu kontrol API çağrısı değildir.
  useEffect(() => {
    if (!weatherField || !weatherKey || typeof window === 'undefined') return;

    let disposed = false;

    const maybeRefreshWeather = () => {
      if (disposed || weatherState.status === 'loading') return;

      const now = Date.now();
      const lastFetchAt = readWeatherFetchTimestamp(weatherKey);
      const isFresh =
        lastFetchAt > 0 && now - lastFetchAt < WEATHER_AUTO_REFRESH_MS;
      const alreadyTriedThisRuntime = WEATHER_FETCHED_THIS_RUNTIME.has(weatherKey);

      // Ana ekran seçili tarlanın tahminini yeni aldıysa tekrar API çağırma.
      if (hasWeatherData && !alreadyTriedThisRuntime) {
        WEATHER_FETCHED_THIS_RUNTIME.add(weatherKey);
        markWeatherFetchTimestamp(weatherKey);
        return;
      }

      // Veri zaten bellekteyse ve 8 saat dolmadıysa hiçbir ağ çağrısı yapma.
      if (hasWeatherData && isFresh) return;

      // Bu çalışma süresinde veri istenmiş ama sonuç henüz yoksa / hata olduysa
      // sayfaya dönüldükçe tekrar tekrar çağrı yapma.
      if (!hasWeatherData && isFresh && alreadyTriedThisRuntime) return;

      // Tam sayfa yenilemesinde bellek boş olabilir. Bu durumda, 8 saat damgası taze olsa bile
      // ekranda veri gösterebilmek için bu çalışma süresinde yalnızca bir kez çağrıya izin ver.
      if (!hasWeatherData && isFresh && !alreadyTriedThisRuntime) {
        WEATHER_FETCHED_THIS_RUNTIME.add(weatherKey);
        void Promise.resolve(loadFieldWeather(weatherField));
        return;
      }

      // İlk yükleme veya 8 saat dolmuşsa otomatik yenile.
      WEATHER_FETCHED_THIS_RUNTIME.add(weatherKey);
      markWeatherFetchTimestamp(weatherKey);
      void Promise.resolve(loadFieldWeather(weatherField));
    };

    maybeRefreshWeather();
    const interval = window.setInterval(maybeRefreshWeather, WEATHER_AUTO_CHECK_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [
    weatherKey,
    weatherState.status,
    hasWeatherData,
    weatherField,
    loadFieldWeather,
  ]);

  const goFields = () => {
    setScreen('home' as Screen);

    window.setTimeout(() => {
      document
        .querySelector('.tp-homev3-fields-section, .fieldsSection')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const visibleMenuItems = desktopMenuItems.filter(
    (item) => item?.screen && item.screen !== 'adminHub',
  );

  if (!weatherField) {
    return (
      <div className="tp-wxv2-page">
        <style>{cmsRuntimeCss + WEATHER_STYLES}</style>
        <main className="tp-wxv2-empty-page">
          <div className="tp-wxv2-empty-card">
            <Icon name="weather" size={34} />
            <h1>Hava Durumu</h1>
            <p>Hava tahmini göstermek için önce bir tarla eklemelisin.</p>
            <button type="button" onClick={() => setScreen('home' as Screen)}>
              Ana Sayfaya Dön
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentTemp =
    safeNumber((firstDay as any)?.temperature) ??
    safeNumber((firstDay as any)?.temp) ??
    (tempMax !== null && tempMin !== null ? (tempMax + tempMin) / 2 : tempMax) ??
    nasaTemperature;

  const currentCondition =
    String((firstDay as any)?.condition ?? (firstDay as any)?.description ?? 'Güncel hava');

  const totalRain =
    safeNumber((firstDay as any)?.precipitation) ??
    nasaRainfall ??
    era5Rainfall;

  const uvIndex =
    safeNumber((firstDay as any)?.uvIndex) ??
    safeNumber((firstDay as any)?.uv) ??
    safeNumber((firstDay as any)?.uv_index);

  const measurableRainToday = totalRain !== null && totalRain >= 0.2;
  const sprayBlockedByRain =
    measurableRainToday || majorityRain || rainChance >= 40;
  const sprayNeedsRainCheck = !sprayBlockedByRain && rainChance >= 30;

  const agriculturalMessage = sprayBlockedByRain
    ? `Bugün ${measurableRainToday ? 'yağış bekleniyor' : `yağış ihtimali %${Math.round(rainChance)}`}; ilaçlama yapma. Yağış geçtikten sonra rüzgârın sakin olduğu pencereyi kontrol et.`
    : sprayNeedsRainCheck
      ? `Yağış ihtimali %${Math.round(rainChance)}. İlaçlama öncesi saatlik tahminde yağışsız pencereyi kontrol et.`
      : windSpeed !== null && windSpeed >= 20
        ? `Rüzgâr ${Math.round(windSpeed)} km/sa. İlaçlama ve yaprak uygulaması için daha sakin saatleri bekle.`
        : tempMax !== null && tempMax >= 34
          ? 'Sıcaklık yüksek. İlaçlama ve yaprak uygulamasını öğle sıcağı yerine daha serin saatlere bırak.'
          : 'Bugün belirgin bir hava engeli görünmüyor. İlaçlama yapacaksan saatlik yağış-rüzgârı ve ürün etiketini yine kontrol et.';

  const rainRisk = rainChance >= 60 ? 'Yüksek' : rainChance >= 30 ? 'Orta' : 'Düşük';
  const frostRisk = tempMin !== null && tempMin <= 2 ? 'Var' : 'Yok';

  const alertTitle =
    rainyDays >= 2
      ? 'Önümüzdeki günlerde kuvvetli yağış ihtimali var.'
      : windSpeed !== null && windSpeed >= 30
        ? 'Kuvvetli rüzgâr riski bulunuyor.'
        : tempMax !== null && tempMax >= 36
          ? 'Yüksek sıcaklık riski bulunuyor.'
          : 'Kritik hava uyarısı görünmüyor.';

  const alertText =
    rainyDays >= 2
      ? 'Toprak işlemleri, ilaçlama ve hasat planını tahminlere göre kontrol et.'
      : windSpeed !== null && windSpeed >= 30
        ? 'İlaçlama ve yaprak uygulamalarını daha sakin saatlere planla.'
        : tempMax !== null && tempMax >= 36
          ? 'Öğle saatlerinde bitki ve çalışan ısı stresini dikkate al.'
          : 'Tahminleri günlük olarak takip etmeye devam et.';

  const goToComparison = () => {
    document.querySelector('.tp-wxr-forecast')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const openSprayGuide = () => {
    setSprayGuideOpen(true);
  };

  return (
    <div className="tp-wxr-page">
      <style>{cmsRuntimeCss + WEATHER_STYLES}</style>

      <main className="tp-wxr-main">
        <section className="tp-wxr-top">
          <div className="tp-wxr-field">
            <span className="tp-wxr-pin" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
                <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>

            <label>
              <select
                value={weatherKey}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setWeatherHubFieldId(nextId);
                  // Yeni tarla seçilince otomatik 8 saat kontrolü devreye girer.
                  // Burada doğrudan API çağrısı yapmıyoruz.
                }}
              >
                {safeFields.map((field) => (
                  <option key={String(field.id)} value={String(field.id)}>
                    {field.name || 'Tarla'}
                  </option>
                ))}
              </select>

              <span className="tp-wxr-crop-badge">
                <span>ÜRÜN</span>
                <b>{String((weatherField as any)?.crop ?? (weatherField as any)?.cropName ?? 'Belirtilmedi')}</b>
              </span>
            </label>
          </div>

          <button
            type="button"
            className="tp-wxr-compare"
            onClick={goToComparison}
          >
            <span>▥</span>
            Kaynakları Karşılaştır
          </button>
        </section>

        <section className="tp-wxr-hero">
          <article className="tp-wxr-current">
            <div className="tp-wxr-current-top">
              <div className="tp-wxr-big-weather">
                <span className="tp-wxr-weather-halo" />
                <img
                  src={weather3DIcon(currentCondition)}
                  crossOrigin="anonymous"
                  alt={currentCondition || 'Hava durumu'}
                  draggable={false}
                  style={{ width: 154, height: 154, objectFit: 'contain', display: 'block' }}
                />
              </div>

              <div className="tp-wxr-current-copy">
                <strong className="tp-wxr-temp">
                  {currentTemp === null ? '—' : `${Math.round(currentTemp)}°C`}
                </strong>
                <h2>{currentCondition}</h2>

                <div className="tp-wxr-minmax">
                  <span>
                    <Icon name="thermo" size={17} />
                    <b>{tempMax === null ? '—' : `${Math.round(tempMax)}°C`}</b>
                    <small>En Yüksek</small>
                  </span>
                  <span>
                    <Icon name="thermo" size={17} />
                    <b>{tempMin === null ? '—' : `${Math.round(tempMin)}°C`}</b>
                    <small>En Düşük</small>
                  </span>
                </div>
              </div>
            </div>

            <div className="tp-wxr-weather-stats">
              <span>
                <Icon name="drop" size={18} />
                <b>{humidity === null ? '—' : `%${Math.round(humidity)}`}</b>
                <small>Nem</small>
              </span>
              <span>
                <Icon name="wind" size={18} />
                <b>{windSpeed === null ? '—' : `${Math.round(windSpeed)} km/sa`}</b>
                <small>Rüzgâr</small>
              </span>
              <span>
                <Icon name="globe" size={18} />
                <b>{nasaTemperature === null ? '—' : `${Math.round(nasaTemperature)}°`}</b>
                <small>İklim ref.</small>
              </span>
            </div>

            <div className="tp-wxr-inline-risks" aria-label="Bugünün hava riskleri">
              <div className={rainChance >= 60 ? 'warn' : ''}>
                <span>Yağış Riski</span>
                <strong>%{Math.round(rainChance)}</strong>
                <small>{rainRisk}</small>
              </div>
              <div className={frostRisk === 'Var' ? 'warn' : ''}>
                <span>Don Riski</span>
                <strong>{frostRisk}</strong>
                <small>{tempMin === null ? 'Sıcaklık verisi yok' : `${Math.round(tempMin)}°C en düşük`}</small>
              </div>
            </div>

            <div className="tp-wxr-inline-field-data" aria-label="Tarla koşulları">
              <div>
                <span><Icon name="rain" size={14} /> Yağış Geçmişi</span>
                <strong>{rain30dValue === null ? '—' : `${rain30dValue.toFixed(1)} mm`}</strong>
                <small>Son 30 gün · {rain30dFarmerText}</small>
              </div>

              <div>
                <span><Icon name="thermo" size={14} /> Yüzey Sıcaklığı</span>
                <strong>{surfaceTemperatureValue === null ? '—' : `${surfaceTemperatureValue.toFixed(1)}°C`}</strong>
                <small>{surfaceTemperatureFarmerText}</small>
              </div>

              <div>
                <span><Icon name="soil" size={14} /> Tarla İklimi</span>
                <strong>{climatePrimaryValue}</strong>
                <small>
                  {conditionSoilMoistureSurface !== null
                    ? `Üst toprak nemi${
                        conditionSoilMoistureRoot !== null
                          ? ` · kök ${conditionSoilMoistureRoot.toFixed(3)} m³/m³`
                          : ''
                      }`
                    : combinedClimateTone === 'loading'
                      ? 'Model verisi hazırlanıyor'
                      : 'Model kaydı bekleniyor'}
                </small>
              </div>

              <div className="tp-wxr-inline-field-data-et0">
                <span><Icon name="drop" size={14} /> ET₀ · Su Talebi</span>
                <strong>{et0SevenDayValue === null ? '—' : `${et0SevenDayValue.toFixed(1)} mm / 7 gün`}</strong>
                <small>
                  {et0DailyAverage === null
                    ? 'Referans su talebi verisi bekleniyor'
                    : `≈ ${et0DailyAverage.toFixed(1)} mm/gün · ${et0FarmerLabel}`}
                </small>
              </div>
            </div>

            {fieldConditionCards.status === 'loading' ? (
              <div className="tp-wxr-inline-field-state">Tarla verileri güncelleniyor…</div>
            ) : fieldConditionCards.status === 'error' && fieldConditionCards.message ? (
              <div className="tp-wxr-inline-field-state error">{fieldConditionCards.message}</div>
            ) : null}

            <div className="tp-wxr-field-status">
              <span aria-hidden="true">♧</span>
              <p>{agriculturalMessage}</p>
            </div>

            <div className="tp-wxr-current-actions">
              <button
                type="button"
                className="tp-wxr-refresh"
                onClick={() => void refreshWeatherNow(weatherField)}
                disabled={weatherState.status === 'loading'}
              >
                <Icon name="refresh" size={15} />
                {weatherState.status === 'loading' ? 'Güncelleniyor…' : 'Tahmini Yenile'}
              </button>

              <button
                type="button"
                className="tp-wxr-spray-open"
                onClick={openSprayGuide}
              >
                İlaçlama Hava Kontrolü
                <Icon name="chevron" size={15} />
              </button>
            </div>
          </article>
        </section>

        <section className="tp-wxr-forecast">
          <div className="tp-wxr-section-title">
            <h2>5 Günlük Tahmin</h2>
            <span>ⓘ</span>
          </div>

          {weatherState.status === 'loading' &&
            providers.length === 0 &&
            consensus.length === 0 && (
              <div className="tp-wxr-state">
                <span className="tp-wxr-spinner" />
                <strong>Hava modelleri karşılaştırılıyor</strong>
              </div>
            )}

          {weatherState.status === 'error' &&
            providers.length === 0 &&
            consensus.length === 0 && (
              <div className="tp-wxr-state">
                <strong>{weatherState.message || 'Hava verileri alınamadı.'}</strong>
                <button type="button" onClick={() => void refreshWeatherNow(weatherField)}>
                  Tekrar Dene
                </button>
              </div>
            )}

          {(providers.length > 0 || consensus.length > 0) && (
            <div className="tp-wxr-table-card">
              <div className="tp-wxr-table-scroll">
                <table className="tp-wxr-table">
                  <thead>
                    <tr>
                      <th>Kaynak</th>
                      {[0, 1, 2, 3, 4].map((index) => (
                        <th key={index}>{weatherDayLabel(index)}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {tableSources.map((source, sourceIndex) => (
                      <tr key={`${source.name}-${sourceIndex}`}>
                        <td>
                          <div className="tp-wxr-provider">
                            <i className={`source-${sourceIndex}`} />
                            <strong>{source.name}</strong>
                            {!source.available && <small>bekleniyor</small>}
                          </div>
                        </td>

                        {[0, 1, 2, 3, 4].map((dayIndex) => {
                          const day = source.forecast[dayIndex];
                          const probability =
                            safeNumber(day?.precipitationProbability) ?? 0;

                          return (
                            <td key={dayIndex}>
                              {day ? (
                                <div className="tp-wxr-day">
                                  <span>
                                    <img
                                      src={weather3DIcon(day?.condition)}
                                      crossOrigin="anonymous"
                                      alt={day?.condition || 'Hava durumu'}
                                      draggable={false}
                                      style={{ width: 58, height: 58, objectFit: 'contain', display: 'block' }}
                                    />
                                  </span>
                                  <strong>
                                    {formatTemp(day?.tempMax)} / {formatTemp(day?.tempMin)}
                                  </strong>
                                  <small>💧 {Math.round(probability)}%</small>
                                </div>
                              ) : (
                                <span className="tp-wxr-none">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="tp-wxr-table-footer">
                <span>Kaynaklar mevcut sistemdeki haliyle korunur.</span>
                <button type="button" onClick={() => void refreshWeatherNow(weatherField)}>
                  Güncelle <Icon name="refresh" size={14} />
                </button>
              </footer>
            </div>
          )}
        </section>

        <section className="tp-wxr-alert">
          <div>
            <div className="tp-wxr-card-title gold">
              <span>♢</span>
              <strong>Hava Durumu Uyarıları</strong>
            </div>
            <h3>{alertTitle}</h3>
            <p>{alertText}</p>
          </div>

          <span className="tp-wxr-alert-icon">
            <img
              src={weather3DIcon(
                rainyDays >= 2
                  ? 'Kuvvetli Yağmur'
                  : tempMax !== null && tempMax >= 36
                    ? 'Güneşli'
                    : 'Bulutlu',
              )}
              crossOrigin="anonymous"
              alt="Hava durumu uyarısı"
              draggable={false}
              style={{
                width: 98,
                height: 98,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </span>
        </section>

        <section className="tp-wxr-details">
          <div className="tp-wxr-section-title">
            <h2>Detaylı Hava Verileri</h2>
          </div>

          <div className="tp-wxr-detail-grid">
            <article>
              <span><Icon name="rain" size={23}/> Yağış</span>
              <strong>{totalRain === null ? '—' : `${totalRain.toFixed(1)} mm`}</strong>
              <small>Son 24 saat / mevcut veri</small>
              <div className="tp-wxr-bars">
                <i style={{height:'25%'}}/><i style={{height:'52%'}}/><i style={{height:'34%'}}/>
                <i style={{height:'74%'}}/><i style={{height:'45%'}}/><i style={{height:'63%'}}/>
              </div>
            </article>

            <article>
              <span><Icon name="drop" size={23}/> Nem</span>
              <strong>{humidity === null ? '—' : `%${Math.round(humidity)}`}</strong>
              <small>Ortalama</small>
              <div className="tp-wxr-line"><i/></div>
            </article>

            <article>
              <span><Icon name="wind" size={23}/> Rüzgâr</span>
              <strong>{windSpeed === null ? '—' : `${Math.round(windSpeed)} km/sa`}</strong>
              <small>Güncel</small>
              <div className="tp-wxr-compass">↗</div>
            </article>

            <article>
              <span><Icon name="sun" size={23}/> UV İndeksi</span>
              <strong>{uvIndex === null ? '—' : Math.round(uvIndex)}</strong>
              <small>{uvIndex === null ? 'Veri yok' : uvIndex >= 8 ? 'Yüksek' : uvIndex >= 5 ? 'Orta' : 'Düşük'}</small>
              <div className="tp-wxr-uvbar"><i style={{left: uvIndex === null ? '8%' : `${Math.min(92, Math.max(8, uvIndex * 9))}%`}}/></div>
            </article>

            <article>
              <span><Icon name="sun" size={23}/> Güneşlenme</span>
              <strong>{nasaSolar === null ? '—' : nasaSolar.toFixed(1)}</strong>
              <small>NASA POWER</small>
              <div className="tp-wxr-sun-arc"><i/></div>
            </article>
          </div>
        </section>

        <section className="tp-wxr-pusula">
          <span className="tp-wxr-pusula-icon">✦</span>
          <div>
            <strong>Pusula’dan Öneri</strong>
            <p>{summaryText}</p>
          </div>
          <small>
            {combinedClimateReady
              ? `${climateConfidenceLabel} · NASA POWER + ERA5-Land`
              : 'İklim verisi hazırlanıyor'}
          </small>
        </section>
      </main>

      {sprayGuideOpen && (
        <div className="tp-wxr-spray-modal-layer" role="presentation">
          <button
            type="button"
            className="tp-wxr-spray-modal-backdrop"
            aria-label="İlaçlama hava kontrolünü kapat"
            onClick={() => setSprayGuideOpen(false)}
          />

          <section
            className="tp-wxr-spray-modal"
            role="dialog"
            aria-modal="true"
            aria-label="İlaçlama Hava Kontrolü"
          >
            <header className="tp-wxr-spray-modal-head">
              <div>
                <small>HAVA DURUMU</small>
                <strong>İlaçlama Hava Kontrolü</strong>
              </div>
              <button
                type="button"
                onClick={() => setSprayGuideOpen(false)}
                aria-label="Kapat"
              >
                ×
              </button>
            </header>

            <div className="tp-wxr-spray-modal-scroll">
              <SprayWeatherGuide
                fieldName={weatherField?.name || 'Seçili tarla'}
                forecast={consensus.length ? consensus : providers[0]?.forecast ?? []}
                hourly={fieldHourlyWeather[weatherKey]}
                onRefreshHourly={weatherField ? () => void loadFieldHourlyWeather(weatherField, true) : undefined}
                onPlanWindow={weatherField && props.onPlanSprayWindow
                  ? (date, time, until) => props.onPlanSprayWindow?.(weatherField, date, time, until)
                  : undefined}
              />
            </div>
          </section>
        </div>
      )}

      {sideMenuOpen && (
        <div className="tp-wxr-drawer-layer">
          <button
            type="button"
            className="tp-wxr-backdrop"
            onClick={() => setSideMenuOpen(false)}
            aria-label="Menüyü kapat"
          />
          <aside className="tp-wxr-drawer">
            <div className="tp-wxr-drawer-brand">
              <span>♧</span>
              <strong>TarlaPusula</strong>
            </div>

            <nav>
              {visibleMenuItems.map((item) => (
                <button
                  key={`${String(item.screen)}-${item.label}`}
                  type="button"
                  className={item.screen === 'weatherHub' ? 'active' : ''}
                  onClick={() => {
                    const label = String(item.label || '').toLocaleLowerCase('tr-TR');
                    if (label.includes('tarlalarım')) goFields();
                    else setScreen(item.screen);
                    setSideMenuOpen(false);
                  }}
                >
                  <span><Icon name={navIcon(item.screen, item.label)} size={18}/></span>
                  <strong>{item.label}</strong>
                  <Icon name="chevron" size={14}/>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

const WEATHER_STYLES = `
  :root{
    --wxr-bg:#020503;
    --wxr-card:#07100b;
    --wxr-card2:#0a140e;
    --wxr-line:rgba(202,171,104,.26);
    --wxr-line2:rgba(153,199,145,.18);
    --wxr-cream:#eee4d0;
    --wxr-soft:#bbb4a6;
    --wxr-muted:#7f887f;
    --wxr-green:#a6d6a1;
    --wxr-green2:#70cf89;
    --wxr-gold:#d2b16f;
    --wxr-blue:#6edbf0;
    --wxr-red:#e07c6b;
  }

  .tp-wxr-page,.tp-wxr-page *{box-sizing:border-box}
  .tp-wxr-page{
    min-height:100vh;
    color:var(--wxr-cream);
    background:
      radial-gradient(circle at 48% -8%,rgba(193,151,72,.08),transparent 26%),
      radial-gradient(circle at 93% 18%,rgba(90,162,102,.035),transparent 26%),
      linear-gradient(180deg,#020503 0%,#030704 50%,#010302 100%);
    font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }

  .tp-wxr-header{
    position:sticky;top:0;z-index:30;
    min-height:82px;
    display:grid;grid-template-columns:54px 1fr 92px;align-items:center;gap:10px;
    padding:10px 18px;
    background:rgba(2,5,3,.95);
    backdrop-filter:blur(18px);
    border-bottom:1px solid rgba(202,171,104,.10);
  }

  .tp-wxr-menu,.tp-wxr-score{
    border:1px solid var(--wxr-line);
    background:linear-gradient(180deg,rgba(12,18,14,.98),rgba(4,8,5,.99));
    color:var(--wxr-gold);
    box-shadow:inset 0 1px rgba(255,255,255,.02),0 0 18px rgba(142,198,132,.05);
  }
  .tp-wxr-menu{width:46px;height:46px;border-radius:14px;display:grid;place-items:center}
  .tp-wxr-score{height:42px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px}
  .tp-wxr-score b{font-weight:700}

  .tp-wxr-brand{text-align:center;line-height:1}
  .tp-wxr-brand>span{display:block;height:12px;color:var(--wxr-gold);font-size:16px}
  .tp-wxr-brand strong,.tp-wxr-section-title h2,.tp-wxr-alert h3{
    font-family:Georgia,"Times New Roman",serif;font-weight:500
  }
  .tp-wxr-brand strong{display:block;font-size:25px;color:#f0e5d1}
  .tp-wxr-brand small{display:block;margin-top:5px;color:#b9a88d;font-family:Georgia,serif;font-size:11px}

  .tp-wxr-main{width:min(100% - 28px,760px);margin:0 auto;padding:80px 0 34px}

  .tp-wxr-top{
    min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:12px;
    border:1px solid var(--wxr-line);border-radius:22px 22px 0 0;padding:10px 13px;
    background:
      radial-gradient(circle at 82% 0,rgba(87,163,99,.055),transparent 28%),
      linear-gradient(180deg,rgba(9,16,11,.99),rgba(5,10,7,.99));
  }
  .tp-wxr-field{display:flex;align-items:center;min-width:0;gap:9px}
  .tp-wxr-pin{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(105,207,129,.25);border-radius:11px;color:#9de3aa;background:#07110a}
  .tp-wxr-field label{min-width:0;display:block}
  .tp-wxr-field select{max-width:230px;border:0;outline:0;background:transparent;color:var(--wxr-cream);font-family:Georgia,serif;font-size:16px}
  .tp-wxr-field option{background:#07100b}
  .tp-wxr-field small{display:block;margin-top:3px;color:#89c693;font-size:9px}
  .tp-wxr-compare{
    flex:0 0 auto;height:37px;border:1px solid rgba(104,206,129,.28);border-radius:999px;padding:0 13px;
    display:flex;align-items:center;gap:7px;background:#08120b;color:#dcd1bd;font-family:Georgia,serif;font-size:11px;
  }
  .tp-wxr-compare span{color:#69d888}

  .tp-wxr-hero{
    display:grid;grid-template-columns:1.05fr .95fr;gap:10px;
    padding:10px;border:1px solid var(--wxr-line);border-top:0;border-radius:0 0 23px 23px;
    background:linear-gradient(180deg,rgba(5,10,7,.99),rgba(3,7,4,.99));
  }
  .tp-wxr-current,.tp-wxr-impact,.tp-wxr-table-card,.tp-wxr-alert,.tp-wxr-details article,.tp-wxr-pusula{
    border:1px solid var(--wxr-line);
    background:
      radial-gradient(circle at 12% 0,rgba(116,205,136,.045),transparent 32%),
      linear-gradient(180deg,rgba(8,15,10,.995),rgba(3,8,5,.995));
    box-shadow:inset 0 1px rgba(255,255,255,.018),0 18px 38px rgba(0,0,0,.22),0 0 18px rgba(110,190,124,.04);
  }
  .tp-wxr-current,.tp-wxr-impact{min-height:286px;border-radius:18px;padding:14px}

  .tp-wxr-current-top{display:grid;grid-template-columns:105px 1fr;gap:11px;align-items:center}
  .tp-wxr-big-weather{height:120px;position:relative;display:grid;place-items:center;color:#f3c05a}
  .tp-wxr-weather-halo{position:absolute;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(238,186,69,.20),transparent 68%);filter:blur(5px)}
  .tp-wxr-current-copy{min-width:0}
  .tp-wxr-temp{display:block;font-family:Georgia,serif;font-size:45px;font-weight:500;line-height:1;color:#f2eadb}
  .tp-wxr-current-copy h2{margin:5px 0 10px;font-family:Georgia,serif;font-size:15px;font-weight:500;color:#e5dbc9}
  .tp-wxr-minmax{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tp-wxr-minmax span{display:grid;grid-template-columns:17px 1fr;column-gap:4px;align-items:center}
  .tp-wxr-minmax svg{color:#78d98b}
  .tp-wxr-minmax b{font-size:11px;color:#e8ded0}
  .tp-wxr-minmax small{grid-column:1/3;color:#827e74;font-size:7px;text-align:center}

  .tp-wxr-weather-stats{margin-top:11px;padding:10px 0;border-top:1px solid rgba(202,171,104,.14);border-bottom:1px solid rgba(202,171,104,.14);display:grid;grid-template-columns:repeat(3,1fr)}
  .tp-wxr-weather-stats span{display:grid;grid-template-columns:18px 1fr;gap:2px 5px;align-items:center;padding:0 7px;border-right:1px solid rgba(202,171,104,.12)}
  .tp-wxr-weather-stats span:last-child{border-right:0}
  .tp-wxr-weather-stats svg{grid-row:1/3;color:#d5ddcf}
  .tp-wxr-weather-stats b{font-family:Georgia,serif;font-size:12px;color:#eee5d6}
  .tp-wxr-weather-stats small{font-size:7px;color:#777d76}
  .tp-wxr-refresh{margin-top:8px;border:0;background:transparent;color:#7bca87;display:flex;align-items:center;gap:6px;font-size:8px}

  .tp-wxr-card-title{display:flex;align-items:center;gap:7px;color:#d8d0bf;font-family:Georgia,serif;font-size:12px}
  .tp-wxr-card-title span{color:#72d38a}
  .tp-wxr-card-title.gold{color:var(--wxr-gold)}
  .tp-wxr-impact-message{
    min-height:73px;margin-top:12px;border:1px solid rgba(120,202,132,.20);border-radius:14px;padding:10px;
    display:grid;grid-template-columns:43px 1fr;gap:10px;align-items:center;background:rgba(7,16,10,.72)
  }
  .tp-wxr-impact-message>span{width:43px;height:43px;display:grid;place-items:center;border:1px solid rgba(98,219,126,.35);border-radius:50%;color:#6ddf89;box-shadow:0 0 16px rgba(91,221,124,.14)}
  .tp-wxr-impact-message p{margin:0;color:#e2d9c8;font-family:Georgia,serif;font-size:13px;line-height:1.35}
  .tp-wxr-risks{margin-top:8px}
  .tp-wxr-risks div{display:grid;grid-template-columns:1fr 58px 64px;gap:7px;align-items:center;padding:8px 1px;border-bottom:1px solid rgba(202,171,104,.11);font-family:Georgia,serif;font-size:10px}
  .tp-wxr-risks span{color:#c8beac}.tp-wxr-risks b{color:#65d485;font-weight:500}.tp-wxr-risks b.warn{color:#e4b85f}.tp-wxr-risks strong{text-align:right;color:#e8dfd0;font-weight:500}
  .tp-wxr-detail-btn{width:100%;margin-top:8px;border:0;border-top:1px solid rgba(202,171,104,.15);padding:10px 0 0;display:flex;justify-content:space-between;background:transparent;color:#d9b979;font-family:Georgia,serif;font-size:10px}

  .tp-wxr-forecast{margin-top:18px;scroll-margin-top:90px}
  .tp-wxr-section-title{display:flex;align-items:center;gap:8px;margin:0 2px 9px}
  .tp-wxr-section-title h2{margin:0;color:#e9ddc7;font-size:19px}.tp-wxr-section-title>span{color:#8f9a8e;font-size:12px}
  .tp-wxr-table-card{overflow:hidden;border-radius:20px}
  .tp-wxr-table-scroll{overflow-x:auto}
  .tp-wxr-table{width:100%;min-width:700px;border-collapse:collapse;table-layout:fixed}
  .tp-wxr-table th,.tp-wxr-table td{border-right:1px solid rgba(202,171,104,.12);border-bottom:1px solid rgba(202,171,104,.12)}
  .tp-wxr-table th{height:48px;padding:7px;color:#d5cbb9;background:rgba(7,14,9,.86);font-family:Georgia,serif;font-size:11px;font-weight:500}
  .tp-wxr-table th:first-child,.tp-wxr-table td:first-child{width:122px;text-align:left}
  .tp-wxr-table td{height:86px;padding:8px;text-align:center}
  .tp-wxr-provider{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
  .tp-wxr-provider i{width:20px;height:4px;border-radius:99px;background:#65ce84}
  .tp-wxr-provider i.source-1{background:#69c6df}.tp-wxr-provider i.source-2{background:#c4a45c}
  .tp-wxr-provider strong{max-width:104px;color:#ded4c2;font-family:Georgia,serif;font-size:10px;line-height:1.15}
  .tp-wxr-provider small{color:#65736a;font-size:7px}
  .tp-wxr-day{display:grid;justify-items:center;gap:4px}
  .tp-wxr-day>span{height:32px;color:#efc256}
  .tp-wxr-day strong{white-space:nowrap;color:#eee4d3;font-family:Georgia,serif;font-size:11px;font-weight:500}
  .tp-wxr-day small{color:#68cfe3;font-size:8px}
  .tp-wxr-none{color:#47534b}
  .tp-wxr-table-footer{min-height:37px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#817d73;font-size:8px}
  .tp-wxr-table-footer button{border:0;background:transparent;color:#b7ad9c;display:flex;align-items:center;gap:5px;font-size:8px}

  .tp-wxr-state{min-height:140px;border:1px solid var(--wxr-line);border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:var(--wxr-card);color:#a99f8f}
  .tp-wxr-state button{border:1px solid rgba(113,202,130,.25);border-radius:999px;background:#09140c;color:#a8d9af;padding:7px 11px}
  .tp-wxr-spinner{width:24px;height:24px;border:2px solid #27352b;border-top-color:#76d08a;border-radius:50%;animation:wxrspin .8s linear infinite}
  @keyframes wxrspin{to{transform:rotate(360deg)}}

  .tp-wxr-alert{min-height:112px;margin-top:12px;border-radius:20px;padding:16px 18px;display:grid;grid-template-columns:1fr 105px;gap:12px;align-items:center}
  .tp-wxr-alert h3{margin:10px 0 4px;font-size:13px;color:#e5dccb}.tp-wxr-alert p{margin:0;color:#8d887d;font-size:9px;line-height:1.45}
  .tp-wxr-alert-icon{height:78px;display:grid;place-items:center;color:#78c9dc;background:radial-gradient(circle,rgba(85,160,177,.12),transparent 65%)}

  .tp-wxr-details{margin-top:14px}
  .tp-wxr-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .tp-wxr-details article{min-height:126px;border-radius:16px;padding:12px}
  .tp-wxr-details article>span{display:flex;align-items:center;gap:5px;color:#d5cbb9;font-family:Georgia,serif;font-size:10px}
  .tp-wxr-details article>span svg{color:#74d794}
  .tp-wxr-details article>strong{display:block;margin-top:11px;color:#ece2d1;font-family:Georgia,serif;font-size:17px;font-weight:500}
  .tp-wxr-details article>small{display:block;margin-top:3px;color:#797c74;font-size:7px}
  .tp-wxr-bars{height:35px;margin-top:11px;display:flex;align-items:flex-end;gap:4px}.tp-wxr-bars i{width:5px;background:#67d889;border-radius:2px}
  .tp-wxr-line{height:35px;margin-top:11px;position:relative}.tp-wxr-line:before{content:"";position:absolute;left:0;right:0;top:18px;height:1px;background:#39774a;transform:rotate(3deg)}.tp-wxr-line i{position:absolute;width:5px;height:5px;border-radius:50%;background:#78e496;right:18%;top:14px}
  .tp-wxr-compass{width:43px;height:43px;margin:7px auto 0;border:1px solid rgba(99,208,129,.28);border-radius:50%;display:grid;place-items:center;color:#78e096;font-size:18px}
  .tp-wxr-sunline{margin-top:9px;color:#f2c44f;text-align:center;font-size:25px}

  .tp-wxr-pusula{margin-top:12px;min-height:83px;border-radius:18px;padding:12px 15px;display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center}
  .tp-wxr-pusula-icon{width:45px;height:45px;border:1px solid rgba(111,208,130,.30);border-radius:50%;display:grid;place-items:center;color:#a7d991;box-shadow:0 0 17px rgba(92,201,116,.08)}
  .tp-wxr-pusula strong{color:#d6b778;font-family:Georgia,serif;font-weight:500}.tp-wxr-pusula p{margin:4px 0 0;color:#958f82;font-family:Georgia,serif;font-size:9px;line-height:1.45}.tp-wxr-pusula small{max-width:140px;color:#70c986;font-size:7px;text-align:right}

  .tp-wxr-drawer-layer{position:fixed;inset:0;z-index:100}
  .tp-wxr-backdrop{position:absolute;inset:0;border:0;background:rgba(0,0,0,.67);backdrop-filter:blur(5px)}
  .tp-wxr-drawer{position:absolute;inset:0 auto 0 0;width:min(82vw,340px);padding:22px 16px;background:radial-gradient(circle at 20% 0,rgba(196,157,78,.07),transparent 30%),linear-gradient(180deg,#08100b,#020503);border-right:1px solid var(--wxr-line);box-shadow:22px 0 55px rgba(0,0,0,.5)}
  .tp-wxr-drawer-brand{display:flex;align-items:center;gap:9px;padding:5px 7px 18px;border-bottom:1px solid rgba(202,171,104,.14);color:#d5b470}.tp-wxr-drawer-brand strong{font-family:Georgia,serif;font-size:18px}
  .tp-wxr-drawer nav{display:grid;gap:5px;margin-top:15px}.tp-wxr-drawer nav button{min-height:45px;border:1px solid transparent;border-bottom-color:rgba(202,171,104,.11);background:transparent;color:#c8c0b2;display:grid;grid-template-columns:35px 1fr 18px;align-items:center;text-align:left}.tp-wxr-drawer nav button.active{border-color:rgba(111,207,129,.22);border-radius:12px;background:rgba(18,37,24,.55);color:#9ed8a5}.tp-wxr-drawer nav button>span{color:#83cd90}.tp-wxr-drawer nav strong{font-size:10px}

  .tp-wxv2-empty-page{min-height:100vh;display:grid;place-items:center;padding:20px;background:#020503}
  .tp-wxv2-empty-card{width:min(100%,420px);border:1px solid var(--wxr-line);border-radius:20px;padding:28px;background:var(--wxr-card);color:#978f82;text-align:center}
  .tp-wxv2-empty-card h1{font-family:Georgia,serif;color:var(--wxr-cream)}.tp-wxv2-empty-card button{border:1px solid rgba(111,207,129,.25);border-radius:999px;background:#0b170e;color:#b7dbbd;padding:9px 13px}

  @media(max-width:620px){
    .tp-wxr-main{width:min(100% - 18px,760px)}
    .tp-wxr-header{padding-inline:10px}
    .tp-wxr-brand strong{font-size:21px}
    .tp-wxr-score{width:78px}
    .tp-wxr-compare{font-size:9px;padding-inline:10px}
    .tp-wxr-field select{max-width:170px;font-size:14px}
    .tp-wxr-hero{gap:7px;padding:7px}
    .tp-wxr-current,.tp-wxr-impact{min-height:270px;padding:11px}
    .tp-wxr-current-top{grid-template-columns:82px 1fr}
    .tp-wxr-big-weather{height:100px}.tp-wxr-temp{font-size:36px}
    .tp-wxr-impact-message{grid-template-columns:37px 1fr}.tp-wxr-impact-message>span{width:37px;height:37px}.tp-wxr-impact-message p{font-size:11px}
    .tp-wxr-risks div{grid-template-columns:1fr 45px 57px;font-size:8px}
    .tp-wxr-table{min-width:620px}.tp-wxr-table th:first-child,.tp-wxr-table td:first-child{width:104px}
    .tp-wxr-detail-grid{grid-template-columns:repeat(2,1fr)}
    .tp-wxr-pusula{grid-template-columns:42px 1fr}.tp-wxr-pusula small{grid-column:2;text-align:left;max-width:none}
  }

  @media(max-width:460px){
    .tp-wxr-hero{grid-template-columns:1fr}
    .tp-wxr-current,.tp-wxr-impact{min-height:auto}
    .tp-wxr-compare span{display:none}
    .tp-wxr-compare{max-width:120px;white-space:normal;line-height:1.1}
  }

  /* =========================================================
     REFERANS SHAPE LANGUAGE — yalnızca görünüm
     Veri akışı / provider / loadFieldWeather değişmez.
     ========================================================= */

  .tp-wxr-top,
  .tp-wxr-current,
  .tp-wxr-impact,
  .tp-wxr-table-card,
  .tp-wxr-alert,
  .tp-wxr-details article,
  .tp-wxr-pusula{
    position:relative;
    isolation:isolate;
  }

  /* Üst alan: referanstaki organik sağ köşe */
  .tp-wxr-top{
    overflow:hidden;
  }
  .tp-wxr-top::after{
    content:"";
    position:absolute;
    right:-30px;
    top:-48px;
    width:170px;
    height:125px;
    border:1px solid rgba(105,207,129,.12);
    border-left-color:transparent;
    border-bottom-color:transparent;
    border-radius:52% 0 58% 48%;
    transform:rotate(-10deg);
    background:
      radial-gradient(circle at 44% 62%,rgba(73,174,91,.08),transparent 42%),
      radial-gradient(circle at 52% 50%,rgba(206,177,108,.035),transparent 58%);
    pointer-events:none;
  }

  /* Ana hava kartı: daha güçlü iç çerçeve ve üst ışık */
  .tp-wxr-current{
    overflow:hidden;
    border-radius:20px 20px 18px 18px;
  }
  .tp-wxr-current::before{
    content:"";
    position:absolute;
    inset:5px;
    border-radius:16px;
    border:1px solid rgba(205,176,109,.07);
    pointer-events:none;
    z-index:-1;
  }
  .tp-wxr-current::after{
    content:"";
    position:absolute;
    top:-75px;
    left:-45px;
    width:190px;
    height:150px;
    border-radius:50%;
    background:radial-gradient(circle,rgba(230,187,79,.12),transparent 68%);
    filter:blur(2px);
    pointer-events:none;
    z-index:-1;
  }

  /* Büyük hava ikonu ayrı bir görsel yuvası gibi */
  .tp-wxr-big-weather{
    border-radius:18px 46% 18px 42%;
    background:
      radial-gradient(circle at 46% 43%,rgba(240,192,69,.11),transparent 47%),
      linear-gradient(145deg,rgba(9,18,11,.54),rgba(3,8,5,.08));
  }

  /* Tarımsal etki: referanstaki iç içe premium panel */
  .tp-wxr-impact{
    border-radius:20px;
    overflow:hidden;
  }
  .tp-wxr-impact::before{
    content:"";
    position:absolute;
    right:-50px;
    top:-58px;
    width:170px;
    height:135px;
    border-radius:50%;
    border:1px solid rgba(105,207,129,.10);
    background:radial-gradient(circle at 35% 65%,rgba(86,185,103,.075),transparent 58%);
    pointer-events:none;
    z-index:-1;
  }
  .tp-wxr-impact-message{
    position:relative;
    border-radius:17px;
    background:
      radial-gradient(circle at 15% 50%,rgba(84,207,111,.075),transparent 35%),
      linear-gradient(180deg,rgba(9,19,12,.92),rgba(5,12,7,.96));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.018),
      0 0 0 1px rgba(117,205,133,.04);
  }
  .tp-wxr-impact-message::after{
    content:"";
    position:absolute;
    left:10px;right:10px;top:0;
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(114,216,137,.26),transparent);
  }

  /* Karşılaştır butonu referanstaki ince kapsül */
  .tp-wxr-compare{
    position:relative;
    overflow:hidden;
    border-radius:999px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.02),
      0 0 14px rgba(91,194,111,.045);
  }
  .tp-wxr-compare::before{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(110deg,transparent 10%,rgba(158,211,153,.045) 50%,transparent 90%);
    pointer-events:none;
  }

  /* Forecast: tek büyük blok ama hücreler yumuşak kart hissinde */
  .tp-wxr-table-card{
    border-radius:22px;
    overflow:hidden;
    background:
      radial-gradient(circle at 3% 0%,rgba(108,197,126,.045),transparent 25%),
      linear-gradient(180deg,rgba(7,14,9,.995),rgba(3,7,4,.998));
  }
  .tp-wxr-table-card::before{
    content:"";
    position:absolute;
    inset:5px;
    border:1px solid rgba(205,176,109,.06);
    border-radius:17px;
    pointer-events:none;
  }
  .tp-wxr-table th{
    background:
      linear-gradient(180deg,rgba(10,18,12,.98),rgba(6,12,8,.98));
  }
  .tp-wxr-table tbody tr{
    transition:background .18s ease;
  }
  .tp-wxr-table tbody tr:hover{
    background:rgba(104,188,119,.025);
  }
  .tp-wxr-day{
    min-height:67px;
    border-radius:12px;
    padding:5px 3px;
    transition:background .18s ease,box-shadow .18s ease;
  }
  .tp-wxr-day:hover{
    background:rgba(103,196,121,.035);
    box-shadow:inset 0 0 0 1px rgba(107,205,127,.07);
  }
  .tp-wxr-provider{
    min-height:58px;
    justify-content:center;
    padding-left:3px;
  }
  .tp-wxr-provider i{
    width:23px;
    height:3px;
    box-shadow:0 0 8px currentColor;
  }

  /* Uyarı kartında referanstaki sağ görsel bölmesi */
  .tp-wxr-alert{
    overflow:hidden;
    border-radius:21px;
    grid-template-columns:1fr 122px;
  }
  .tp-wxr-alert::before{
    content:"";
    position:absolute;
    right:-17px;
    top:-38px;
    width:180px;
    height:155px;
    border-radius:58% 0 0 58%;
    border-left:1px solid rgba(96,196,116,.14);
    background:
      radial-gradient(circle at 40% 60%,rgba(82,158,174,.10),transparent 49%),
      linear-gradient(135deg,rgba(20,42,27,.13),transparent 66%);
    pointer-events:none;
    z-index:-1;
  }
  .tp-wxr-alert-icon{
    position:relative;
    border-radius:55% 0 0 55%;
  }

  /* Detay kartları referanstaki dikey modül formu */
  .tp-wxr-detail-grid{
    align-items:stretch;
  }
  .tp-wxr-details article{
    overflow:hidden;
    border-radius:18px 18px 16px 16px;
    background:
      radial-gradient(circle at 18% 0%,rgba(89,205,116,.05),transparent 28%),
      linear-gradient(180deg,rgba(8,16,10,.995),rgba(3,8,5,.998));
  }
  .tp-wxr-details article::before{
    content:"";
    position:absolute;
    left:0;top:0;bottom:0;
    width:2px;
    background:linear-gradient(180deg,rgba(104,219,132,.42),rgba(104,219,132,.04),transparent);
    opacity:.52;
  }
  .tp-wxr-details article::after{
    content:"";
    position:absolute;
    top:0;left:16%;right:16%;
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(211,178,107,.23),transparent);
  }

  /* Pusula önerisi geniş, yatay premium panel */
  .tp-wxr-pusula{
    overflow:hidden;
    border-radius:20px;
  }
  .tp-wxr-pusula::before{
    content:"";
    position:absolute;
    left:-42px;
    top:-52px;
    width:150px;
    height:150px;
    border-radius:50%;
    border:1px solid rgba(99,205,121,.10);
    background:
      radial-gradient(circle,rgba(99,205,121,.075),transparent 56%);
    pointer-events:none;
    z-index:-1;
  }
  .tp-wxr-pusula-icon{
    position:relative;
    background:
      radial-gradient(circle,rgba(105,209,126,.09),transparent 64%),
      rgba(5,13,8,.72);
  }
  .tp-wxr-pusula-icon::after{
    content:"";
    position:absolute;
    inset:-6px;
    border-radius:50%;
    border:1px solid rgba(205,176,109,.08);
  }

  /* Header score ve menu: daha 'metal frame' */
  .tp-wxr-menu,
  .tp-wxr-score{
    position:relative;
    overflow:hidden;
  }
  .tp-wxr-menu::after,
  .tp-wxr-score::after{
    content:"";
    position:absolute;
    left:18%;right:18%;top:0;
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(219,184,111,.30),transparent);
  }

  /* Çekmece de aynı shape language */
  .tp-wxr-drawer{
    border-radius:0 24px 24px 0;
    overflow:hidden;
  }
  .tp-wxr-drawer::before{
    content:"";
    position:absolute;
    right:-100px;
    top:-80px;
    width:240px;
    height:240px;
    border:1px solid rgba(103,206,124,.09);
    border-radius:50%;
    background:radial-gradient(circle,rgba(95,202,118,.05),transparent 62%);
    pointer-events:none;
  }
  .tp-wxr-drawer nav button{
    position:relative;
    border-radius:11px;
    padding-inline:8px;
  }
  .tp-wxr-drawer nav button.active{
    box-shadow:
      inset 0 0 0 1px rgba(112,209,131,.05),
      0 0 14px rgba(87,190,107,.04);
  }

  @media(max-width:460px){
    .tp-wxr-alert{
      grid-template-columns:1fr 88px;
    }
    .tp-wxr-alert::before{
      width:125px;
    }
  }


  /* WEATHER ART — referanstaki dolu/hacimli hava şekilleri */
  .tp-weather-art{
    display:block;
    flex:0 0 auto;
  }

  .tp-wxr-big-weather{
    overflow:visible!important;
  }

  .tp-wxr-big-weather .tp-weather-art{
    transform:translateY(2px);
  }

  .tp-wxr-day>span{
    display:grid!important;
    place-items:center!important;
    overflow:visible!important;
  }

  .tp-wxr-day .tp-weather-art{
    transform:translateY(-1px);
  }

  .tp-wxr-alert-icon .tp-weather-art{
    transform:scale(1.04);
  }


  /* =========================================================
     WEATHER REFERENCE MATCH V5
     Referanstaki büyük kartlar, serif tipografi, yoğun glow ve
     gerçek mobil dashboard oranları. Yalnız görünüm.
     ========================================================= */

  .tp-wxr-page{
    --wxr-card:#061009;
    --wxr-card2:#0a140d;
    --wxr-line:rgba(189,166,99,.34);
    --wxr-line2:rgba(102,192,117,.20);
    --wxr-cream:#eee4cf;
    --wxr-soft:#b9b0a0;
    --wxr-green:#79d58b;
    --wxr-gold:#d0af68;
    background:
      radial-gradient(circle at 50% -2%,rgba(129,175,112,.035),transparent 27%),
      linear-gradient(180deg,#020503 0%,#020603 100%)!important;
  }

  .tp-wxr-header{
    min-height:106px!important;
    grid-template-columns:62px 1fr 112px!important;
    padding:17px 22px!important;
  }
  .tp-wxr-menu{width:53px!important;height:53px!important;border-radius:15px!important}
  .tp-wxr-score{height:46px!important;font-size:13px!important}
  .tp-wxr-brand strong{font-size:34px!important;letter-spacing:-.02em!important}
  .tp-wxr-brand small{font-size:15px!important;margin-top:6px!important}
  .tp-wxr-brand>span{font-size:20px!important;height:17px!important}

  .tp-wxr-main{
    width:min(calc(100% - 28px),720px)!important;
    /* Global üst menü 66px sabit. İçerik artık menünün arkasına girmesin. */
    padding-top:78px!important;
  }

  .tp-wxr-top{
    min-height:88px!important;
    padding:13px 18px!important;
    border-radius:25px 25px 0 0!important;
  }
  .tp-wxr-pin{width:45px!important;height:45px!important;border-radius:13px!important}
  .tp-wxr-field select{
    max-width:280px!important;
    font-size:22px!important;
    line-height:1.1!important;
  }
  .tp-wxr-field small{font-size:13px!important;margin-top:5px!important}
  .tp-wxr-compare{
    height:47px!important;
    min-width:166px!important;
    padding:0 17px!important;
    font-size:14px!important;
  }

  .tp-wxr-hero{
    grid-template-columns:1.02fr .98fr!important;
    gap:13px!important;
    padding:13px!important;
    border-radius:0 0 25px 25px!important;
  }
  .tp-wxr-current,.tp-wxr-impact{
    min-height:355px!important;
    padding:18px!important;
    border-radius:21px!important;
  }
  .tp-wxr-current-top{
    grid-template-columns:158px 1fr!important;
    gap:15px!important;
    min-height:188px!important;
  }
  .tp-wxr-big-weather{
    height:180px!important;
    border-radius:19px!important;
    display:grid!important;
    place-items:center!important;
  }
  .tp-wxr-weather-halo{
    width:135px!important;height:135px!important;
    background:radial-gradient(circle,rgba(239,190,69,.20),rgba(239,190,69,.055) 45%,transparent 72%)!important;
  }
  .tp-wxr-temp{
    font-size:60px!important;
    letter-spacing:-.045em!important;
  }
  .tp-wxr-current-copy h2{
    margin:7px 0 18px!important;
    font-size:22px!important;
  }
  .tp-wxr-minmax{gap:14px!important}
  .tp-wxr-minmax span{
    grid-template-columns:22px 1fr!important;
    column-gap:6px!important;
  }
  .tp-wxr-minmax b{font-size:16px!important}
  .tp-wxr-minmax small{font-size:10px!important;margin-top:3px!important}

  .tp-wxr-weather-stats{
    min-height:72px!important;
    margin-top:14px!important;
    padding:13px 0!important;
  }
  .tp-wxr-weather-stats span{
    grid-template-columns:24px 1fr!important;
    padding:0 10px!important;
  }
  .tp-wxr-weather-stats b{font-size:16px!important}
  .tp-wxr-weather-stats small{font-size:10px!important}
  .tp-wxr-refresh{font-size:11px!important;margin-top:12px!important}

  .tp-wxr-card-title{
    gap:9px!important;
    font-size:17px!important;
  }
  .tp-wxr-impact-message{
    min-height:100px!important;
    margin-top:15px!important;
    grid-template-columns:58px 1fr!important;
    gap:12px!important;
    padding:13px!important;
    border-radius:17px!important;
  }
  .tp-wxr-impact-message>span{
    width:56px!important;height:56px!important;
    font-size:24px!important;
  }
  .tp-wxr-impact-message p{
    font-size:18px!important;
    line-height:1.32!important;
  }
  .tp-wxr-risks{margin-top:11px!important}
  .tp-wxr-risks div{
    grid-template-columns:1fr 75px 84px!important;
    gap:9px!important;
    padding:11px 2px!important;
    font-size:14px!important;
  }
  .tp-wxr-detail-btn{
    font-size:14px!important;
    padding-top:13px!important;
    margin-top:9px!important;
  }

  .tp-wxr-forecast{margin-top:26px!important}
  .tp-wxr-section-title{margin-bottom:12px!important}
  .tp-wxr-section-title h2{font-size:28px!important}
  .tp-wxr-section-title>span{font-size:17px!important}

  .tp-wxr-table-card{border-radius:22px!important}
  .tp-wxr-table{
    min-width:700px!important;
  }
  .tp-wxr-table th{
    height:65px!important;
    padding:9px!important;
    font-size:15px!important;
  }
  .tp-wxr-table th:first-child,.tp-wxr-table td:first-child{
    width:145px!important;
  }
  .tp-wxr-table td{
    height:122px!important;
    padding:10px!important;
  }
  .tp-wxr-provider{
    min-height:86px!important;
    gap:6px!important;
  }
  .tp-wxr-provider i{width:31px!important;height:4px!important}
  .tp-wxr-provider strong{
    max-width:126px!important;
    font-size:14px!important;
    line-height:1.2!important;
  }
  .tp-wxr-provider small{font-size:10px!important}
  .tp-wxr-day{
    min-height:98px!important;
    gap:7px!important;
  }
  .tp-wxr-day>span{height:55px!important}
  .tp-wxr-day strong{font-size:15px!important}
  .tp-wxr-day small{font-size:12px!important}
  .tp-wxr-table-footer{
    min-height:50px!important;
    padding:10px 16px!important;
    font-size:11px!important;
  }
  .tp-wxr-table-footer button{font-size:11px!important}

  .tp-wxr-alert{
    min-height:154px!important;
    margin-top:16px!important;
    padding:20px 24px!important;
    grid-template-columns:1fr 150px!important;
    border-radius:22px!important;
  }
  .tp-wxr-alert h3{font-size:19px!important;margin:13px 0 6px!important}
  .tp-wxr-alert p{font-size:13px!important;line-height:1.5!important}
  .tp-wxr-alert-icon{height:110px!important}

  .tp-wxr-details{margin-top:19px!important}
  .tp-wxr-detail-grid{
    grid-template-columns:repeat(5,1fr)!important;
    gap:10px!important;
  }
  .tp-wxr-details article{
    min-height:176px!important;
    padding:15px!important;
    border-radius:18px!important;
  }
  .tp-wxr-details article>span{font-size:13px!important}
  .tp-wxr-details article>strong{
    margin-top:15px!important;
    font-size:24px!important;
  }
  .tp-wxr-details article>small{
    margin-top:4px!important;
    font-size:10px!important;
  }
  .tp-wxr-bars,.tp-wxr-line{height:47px!important;margin-top:15px!important}
  .tp-wxr-compass{
    width:58px!important;height:58px!important;
    margin-top:12px!important;
    font-size:23px!important;
  }
  .tp-wxr-uvbar{
    position:relative;
    height:8px;
    margin-top:31px;
    border-radius:999px;
    background:linear-gradient(90deg,#54c74b 0 25%,#cbd53c 25% 45%,#f0bc37 45% 65%,#e77636 65% 82%,#cf3d39 82%);
  }
  .tp-wxr-uvbar i{
    position:absolute;
    top:50%;
    width:11px;height:11px;
    border:2px solid #f4e3a7;
    background:#f2bd45;
    border-radius:50%;
    transform:translate(-50%,-50%);
    box-shadow:0 0 8px rgba(241,190,68,.55);
  }
  .tp-wxr-sun-arc{
    position:relative;
    height:48px;
    margin-top:14px;
    overflow:hidden;
  }
  .tp-wxr-sun-arc:before{
    content:"";
    position:absolute;
    left:8%;right:8%;top:27px;
    height:46px;
    border:2px solid #eab63f;
    border-color:#eab63f transparent transparent transparent;
    border-radius:50% 50% 0 0;
  }
  .tp-wxr-sun-arc i{
    position:absolute;
    right:12%;top:18px;
    width:10px;height:10px;
    border-radius:50%;
    background:#f8c746;
    box-shadow:0 0 8px rgba(247,194,54,.55);
  }

  .tp-wxr-pusula{
    min-height:112px!important;
    margin-top:15px!important;
    padding:16px 20px!important;
    grid-template-columns:65px 1fr auto!important;
    gap:15px!important;
    border-radius:21px!important;
  }
  .tp-wxr-pusula-icon{
    width:58px!important;height:58px!important;
    font-size:26px!important;
  }
  .tp-wxr-pusula strong{font-size:18px!important}
  .tp-wxr-pusula p{font-size:13px!important;line-height:1.5!important}
  .tp-wxr-pusula small{font-size:10px!important;max-width:190px!important}

  @media(max-width:720px){
    .tp-wxr-main{width:min(calc(100% - 18px),700px)!important}
  }


  /* =========================================================
     TARLA SEÇİCİ — KOMPAKT / BEYAZ / NÖTR
     Native select menüsü açıkken de beyaz seçenekler kullanır.
     ========================================================= */
  .tp-wxr-top{
    min-height:62px!important;
    padding:8px 10px!important;
  }
  .tp-wxr-field{
    gap:8px!important;
    align-items:flex-start!important;
  }
  .tp-wxr-pin{
    width:36px!important;
    height:36px!important;
    flex:0 0 36px!important;
    margin-top:0!important;
    border:1px solid #d9dee3!important;
    border-radius:10px!important;
    background:#fff!important;
    color:#27313a!important;
    box-shadow:0 1px 2px rgba(15,23,42,.04)!important;
  }
  .tp-wxr-field label{
    display:grid!important;
    gap:5px!important;
    min-width:0!important;
  }
  .tp-wxr-field select{
    width:178px!important;
    max-width:178px!important;
    height:36px!important;
    padding:0 8px!important;
    border:1px solid #d9dee3!important;
    border-radius:10px!important;
    outline:0!important;
    background:#fff!important;
    color:#20252b!important;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;
    font-size:12px!important;
    font-weight:750!important;
    line-height:1!important;
    box-shadow:0 1px 2px rgba(15,23,42,.035)!important;
    cursor:pointer!important;
  }
  .tp-wxr-field select:focus{
    border-color:#aeb7c0!important;
    box-shadow:0 0 0 2px rgba(32,37,43,.06)!important;
  }
  .tp-wxr-field option{
    background:#fff!important;
    color:#20252b!important;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;
    font-size:12px!important;
    font-weight:650!important;
  }
  .tp-wxr-crop-badge{
    width:max-content;
    max-width:100%;
    min-height:22px;
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:0 8px;
    border:1px solid #e1e5e9;
    border-radius:999px;
    background:#f5f7f8;
    color:#20252b;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    line-height:1;
    white-space:nowrap;
  }
  .tp-wxr-crop-badge>span{
    color:#808891;
    font-size:7px;
    font-weight:850;
    letter-spacing:.08em;
  }
  .tp-wxr-crop-badge>b{
    overflow:hidden;
    max-width:118px;
    color:#20252b;
    font-size:9px;
    font-weight:800;
    text-overflow:ellipsis;
    text-transform:capitalize;
  }
  .tp-wxr-compare{
    height:34px!important;
    min-width:0!important;
    padding:0 11px!important;
    gap:6px!important;
    border:1px solid #d9dee3!important;
    background:#fff!important;
    color:#28313a!important;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;
    font-size:9px!important;
    font-weight:750!important;
    box-shadow:0 1px 2px rgba(15,23,42,.035)!important;
  }
  .tp-wxr-compare span{color:#39444d!important;font-size:11px!important}

  /* =========================================================
     TEK HAVA KARTI — TARIMSAL ETKİ BİRLEŞİK
     ========================================================= */
  .tp-wxr-hero{
    display:block!important;
  }
  .tp-wxr-current{
    width:100%!important;
    min-height:0!important;
  }
  .tp-wxr-inline-risks{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    margin-top:10px;
  }
  .tp-wxr-inline-risks>div{
    min-width:0;
    min-height:54px;
    display:grid;
    grid-template-columns:1fr auto;
    align-items:center;
    column-gap:8px;
    row-gap:2px;
    padding:8px 10px;
    border:1px solid #dfe4e8;
    border-radius:12px;
    background:#f7f8fa;
    color:#20252b;
  }
  .tp-wxr-inline-risks span{
    color:#69737d;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:10px;
    font-weight:750;
  }
  .tp-wxr-inline-risks strong{
    grid-row:1/3;
    grid-column:2;
    color:#20252b;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:16px;
    font-weight:850;
    text-align:right;
  }
  .tp-wxr-inline-risks small{
    color:#8a939b;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:8px;
    font-weight:650;
  }
  .tp-wxr-inline-risks>div.warn{
    border-color:#dfe4e8;
    background:#f7f8fa;
  }
  .tp-wxr-inline-risks>div.warn strong{color:#20252b}

  .tp-wxr-inline-field-data{
    margin-top:7px;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:5px;
  }
  .tp-wxr-inline-field-data>div{
    min-width:0;
    min-height:58px;
    display:grid;
    grid-template-columns:1fr auto;
    grid-template-rows:auto auto;
    align-items:center;
    column-gap:7px;
    row-gap:2px;
    padding:7px 8px;
    border:1px solid #e0e4e8;
    border-radius:10px;
    background:#f7f8fa;
  }
  .tp-wxr-inline-field-data span{
    min-width:0;
    display:flex;
    align-items:center;
    gap:5px;
    color:#5f6871;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:8.5px;
    font-weight:800;
  }
  .tp-wxr-inline-field-data span svg{flex:0 0 auto;color:#38434d}
  .tp-wxr-inline-field-data strong{
    color:#20252b;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:12.5px;
    font-weight:900;
    text-align:right;
    white-space:nowrap;
  }
  .tp-wxr-inline-field-data small{
    grid-column:1/3;
    overflow:hidden;
    color:#899199;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:7px;
    font-weight:650;
    line-height:1.25;
  }
  .tp-wxr-inline-field-data-et0{background:#f7f8fa!important}
  .tp-wxr-inline-field-state{
    margin-top:5px;
    color:#737d86;
    font-size:6px;
    font-weight:700;
  }
  .tp-wxr-inline-field-state.error{color:#8c4b40}

  .tp-wxr-field-status{
    min-height:42px;
    margin-top:8px;
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px 10px;
    border:1px solid #dfe4e8;
    border-radius:12px;
    background:#f7f8fa;
  }
  .tp-wxr-field-status>span{
    flex:0 0 25px;
    width:25px;
    height:25px;
    display:grid;
    place-items:center;
    border:1px solid #d5dce2;
    border-radius:999px;
    color:#39444d;
    background:#fff;
    font-size:11px;
  }
  .tp-wxr-field-status p{
    margin:0;
    color:#39444d;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:9px;
    font-weight:650;
    line-height:1.35;
  }

  .tp-wxr-current-actions{
    display:grid;
    grid-template-columns:auto 1fr;
    align-items:center;
    gap:8px;
    margin-top:8px;
    padding-top:8px;
    border-top:1px solid #e4e7ea;
  }
  .tp-wxr-current-actions .tp-wxr-refresh,
  .tp-wxr-spray-open{
    min-height:32px!important;
    margin:0!important;
    padding:0 9px!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:6px!important;
    border:1px solid #d9dee3!important;
    border-radius:9px!important;
    background:#fff!important;
    color:#20252b!important;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif!important;
    font-size:8px!important;
    font-weight:800!important;
    cursor:pointer;
  }
  .tp-wxr-current-actions .tp-wxr-refresh{justify-self:start}
  .tp-wxr-spray-open{justify-self:end}
  .tp-wxr-current-actions .tp-wxr-refresh:disabled{opacity:.55;cursor:default}

  .tp-wxr-spray-modal-layer{
    position:fixed;
    inset:0;
    z-index:1200;
    display:grid;
    place-items:center;
    padding:18px;
  }
  .tp-wxr-spray-modal-backdrop{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    border:0;
    background:rgba(8,12,16,.48);
    backdrop-filter:blur(5px);
    -webkit-backdrop-filter:blur(5px);
  }
  .tp-wxr-spray-modal{
    position:relative;
    z-index:1;
    width:min(620px,100%);
    max-height:min(82dvh,760px);
    display:grid;
    grid-template-rows:auto minmax(0,1fr);
    overflow:hidden;
    border:1px solid #d9dee3;
    border-radius:22px;
    background:#fff;
    box-shadow:0 28px 80px rgba(15,23,42,.24);
  }
  .tp-wxr-spray-modal-head{
    min-height:58px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:10px 12px 10px 16px;
    border-bottom:1px solid #e5e8eb;
    background:#fff;
  }
  .tp-wxr-spray-modal-head>div{display:grid;gap:2px}
  .tp-wxr-spray-modal-head small{color:#7a848e;font-size:7px;font-weight:850;letter-spacing:.08em}
  .tp-wxr-spray-modal-head strong{color:#20252b;font-size:14px;font-weight:900}
  .tp-wxr-spray-modal-head>button{
    width:34px;
    height:34px;
    display:grid;
    place-items:center;
    border:1px solid #d9dee3;
    border-radius:10px;
    background:#f7f8fa;
    color:#20252b;
    font-size:20px;
    line-height:1;
    cursor:pointer;
  }
  .tp-wxr-spray-modal-scroll{overflow-y:auto;padding:0 12px 14px}
  .tp-wxr-spray-modal .tp-spray-guide{
    margin-top:12px;
    border-radius:16px;
  }

  @media(max-width:560px){
    .tp-wxr-header{
      min-height:78px!important;
      grid-template-columns:48px 1fr 83px!important;
      padding:10px!important;
    }
    .tp-wxr-menu{width:43px!important;height:43px!important}
    .tp-wxr-score{height:38px!important;font-size:10px!important}
    .tp-wxr-brand strong{font-size:24px!important}
    .tp-wxr-brand small{font-size:11px!important}
    .tp-wxr-main{
      width:calc(100% - 14px)!important;
      /* Mobil global header 64px: tarla seçici her zaman tamamen altında başlar. */
      padding-top:72px!important;
    }
    .tp-wxr-top{min-height:58px!important;padding:7px 8px!important}
    .tp-wxr-field{gap:6px!important;align-items:flex-start!important}
    .tp-wxr-field select{width:142px!important;max-width:142px!important;height:34px!important;font-size:11px!important;padding:0 7px!important}
    .tp-wxr-field option{font-size:11px!important}
    .tp-wxr-pin{width:34px!important;height:34px!important;flex-basis:34px!important;border-radius:9px!important}
    .tp-wxr-crop-badge{min-height:20px!important;padding:0 7px!important;gap:5px!important}
    .tp-wxr-crop-badge>span{font-size:6.3px!important}
    .tp-wxr-crop-badge>b{max-width:88px!important;font-size:8px!important}
    .tp-wxr-compare{height:32px!important;min-width:0!important;width:118px!important;font-size:8px!important;padding:0 8px!important}

    .tp-wxr-hero{gap:7px!important;padding:7px!important}
    .tp-wxr-current,.tp-wxr-impact{min-height:278px!important;padding:11px!important}
    .tp-wxr-current-top{grid-template-columns:92px 1fr!important;gap:7px!important;min-height:120px!important}
    .tp-wxr-big-weather{height:115px!important}
    .tp-wxr-temp{font-size:39px!important}
    .tp-wxr-current-copy h2{font-size:13px!important;margin:4px 0 8px!important}
    .tp-wxr-minmax b{font-size:9px!important}
    .tp-wxr-minmax small{font-size:6px!important}
    .tp-wxr-weather-stats{min-height:55px!important;padding:8px 0!important;margin-top:6px!important}
    .tp-wxr-weather-stats span{grid-template-columns:16px 1fr!important;padding:0 5px!important}
    .tp-wxr-weather-stats b{font-size:9px!important}
    .tp-wxr-weather-stats small{font-size:6px!important}
    .tp-wxr-refresh{font-size:7px!important}

    .tp-wxr-card-title{font-size:10px!important}
    .tp-wxr-impact-message{min-height:67px!important;grid-template-columns:34px 1fr!important;padding:8px!important;margin-top:8px!important}
    .tp-wxr-impact-message>span{width:34px!important;height:34px!important;font-size:15px!important}
    .tp-wxr-impact-message p{font-size:9px!important}
    .tp-wxr-risks div{grid-template-columns:1fr 38px 52px!important;font-size:7px!important;padding:7px 0!important}
    .tp-wxr-detail-btn{font-size:7px!important;padding-top:8px!important}

    .tp-wxr-section-title h2{font-size:18px!important}
    .tp-wxr-table{min-width:610px!important}
    .tp-wxr-table th{height:42px!important;font-size:8px!important}
    .tp-wxr-table td{height:84px!important;padding:5px!important}
    .tp-wxr-table th:first-child,.tp-wxr-table td:first-child{width:90px!important}
    .tp-wxr-provider{min-height:60px!important}.tp-wxr-provider strong{font-size:8px!important}.tp-wxr-provider small{font-size:5px!important}
    .tp-wxr-day{min-height:66px!important;gap:2px!important}.tp-wxr-day>span{height:34px!important}.tp-wxr-day strong{font-size:8px!important}.tp-wxr-day small{font-size:6px!important}
    .tp-wxr-table-footer{font-size:6px!important;min-height:31px!important;padding:6px!important}.tp-wxr-table-footer button{font-size:6px!important}

    .tp-wxr-alert{min-height:92px!important;padding:10px 12px!important;grid-template-columns:1fr 76px!important}.tp-wxr-alert h3{font-size:9px!important;margin:6px 0 3px!important}.tp-wxr-alert p{font-size:6px!important}.tp-wxr-alert-icon{height:66px!important}

    .tp-wxr-detail-grid{grid-template-columns:repeat(5,1fr)!important;gap:4px!important}
    .tp-wxr-details article{min-height:92px!important;padding:6px!important;border-radius:10px!important}
    .tp-wxr-details article>span{font-size:6px!important}.tp-wxr-details article>strong{margin-top:6px!important;font-size:10px!important}.tp-wxr-details article>small{font-size:5px!important}
    .tp-wxr-bars,.tp-wxr-line{height:22px!important;margin-top:5px!important}.tp-wxr-compass{width:25px!important;height:25px!important;margin-top:5px!important;font-size:10px!important}
    .tp-wxr-uvbar{height:4px;margin-top:16px!important}.tp-wxr-uvbar i{width:6px;height:6px;border-width:1px}.tp-wxr-sun-arc{height:25px;margin-top:5px!important}
    .tp-wxr-pusula{min-height:66px!important;padding:7px 9px!important;grid-template-columns:32px 1fr auto!important;gap:6px!important}.tp-wxr-pusula-icon{width:30px!important;height:30px!important;font-size:13px!important}.tp-wxr-pusula strong{font-size:8px!important}.tp-wxr-pusula p{font-size:6px!important}.tp-wxr-pusula small{font-size:5px!important;max-width:92px!important}

    .tp-wxr-inline-risks{gap:6px!important;margin-top:8px!important}
    .tp-wxr-inline-risks>div{min-height:52px!important;padding:8px 9px!important;border-radius:10px!important;column-gap:6px!important;background:#f7f8fa!important;border-color:#dfe4e8!important}
    .tp-wxr-inline-risks span{font-size:8.5px!important}
    .tp-wxr-inline-risks strong{font-size:14px!important;color:#20252b!important}
    .tp-wxr-inline-risks small{font-size:7px!important}
    .tp-wxr-inline-field-data{gap:6px!important;margin-top:6px!important}
    .tp-wxr-inline-field-data>div{min-height:58px!important;padding:7px 8px!important;border-radius:10px!important;column-gap:5px!important;background:#f7f8fa!important;border-color:#dfe4e8!important}
    .tp-wxr-inline-field-data span{font-size:7.8px!important;gap:4px!important}
    .tp-wxr-inline-field-data span svg{width:12px!important;height:12px!important}
    .tp-wxr-inline-field-data strong{font-size:10.8px!important}
    .tp-wxr-inline-field-data small{font-size:6.6px!important;line-height:1.3!important}
    .tp-wxr-inline-field-state{font-size:6.5px!important;margin-top:5px!important}
    .tp-wxr-field-status{min-height:40px!important;margin-top:7px!important;padding:7px 8px!important;gap:7px!important;border-radius:10px!important}
    .tp-wxr-field-status>span{width:24px!important;height:24px!important;flex-basis:24px!important;font-size:10px!important}
    .tp-wxr-field-status p{font-size:8px!important;line-height:1.4!important}
    .tp-wxr-current-actions{gap:5px!important;margin-top:6px!important;padding-top:6px!important}
    .tp-wxr-current-actions .tp-wxr-refresh,.tp-wxr-spray-open{min-height:28px!important;padding:0 7px!important;font-size:6.5px!important;border-radius:8px!important}
    .tp-wxr-spray-modal-layer{padding:9px!important;align-items:end!important}
    .tp-wxr-spray-modal{width:100%!important;max-height:88dvh!important;border-radius:20px 20px 14px 14px!important}
    .tp-wxr-spray-modal-head{min-height:52px!important;padding:8px 9px 8px 13px!important}
    .tp-wxr-spray-modal-head strong{font-size:12px!important}
    .tp-wxr-spray-modal-head>button{width:32px!important;height:32px!important}
    .tp-wxr-spray-modal-scroll{padding:0 8px 10px!important}
  }



`;
