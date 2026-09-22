import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as maplibregl from 'maplibre-gl';
import { mapRuntime } from '../../lib/mapRuntime';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Field } from '../../types';
import type { MapSection } from '../../components/MapTopNav';
import { addTarlaCompass } from '../../components/MapCompass';
import GbifObservationMap from '../../components/GbifObservationMap';
import { analyzeFieldSatellite, type SatelliteHealthResult } from '../../lib/satelliteService';
import {
  fetchSentinel1Radar,
  type Sentinel1RadarMode,
  type Sentinel1RadarResponse,
} from '../../services/sentinel1Service';
import {
  fetchSoilGridsProfile,
  getSoilGridsWmsBaseUrl,
  getSoilGridsWmsLayerName,
  type SoilGridsDepth,
  type SoilGridsProfile,
  type SoilGridsPropertyKey,
} from '../../services/soilGridsService';
import {
  fetchFieldBiodiversityContext,
  type FieldBiodiversityContextResponse,
} from '../../services/field-biodiversity-context';
import { interpretSentinel1Image, type Sentinel1AiInterpretation } from '../../services/sentinel1AiService';
import {
  interpretUnifiedMap,
  type UnifiedMapAiResult,
  type UnifiedMapActiveLayer,
} from '../../services/unifiedMapAiService';
import { supabase } from '../../supabaseClient';
import { createSatelliteRasterSource, vividSatellitePaint } from '../../lib/mapStyle';

export type UnifiedMapSection = MapSection;

type Props = {
  fields: Field[];
  selectedFieldId?: string;
  initialSection?: UnifiedMapSection;
  onFieldChange?: (id: string) => void;
  onBack: () => void;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type Era5MapVariable =
  | 'soil_moisture_0_to_7cm'
  | 'soil_moisture_7_to_28cm'
  | 'soil_moisture_28_to_100cm'
  | 'soil_temperature_0_to_7cm'
  | 'soil_temperature_7_to_28cm'
  | 'temperature_2m'
  | 'precipitation';

type Era5MapCell = {
  id: string;
  latitude: number;
  longitude: number;
  value: number | null;
  unit: string;
  model: string;
  resolutionDegrees: number;
};

type Era5MapResponse = {
  success?: boolean;
  variableLabel?: string;
  unit?: string;
  period?: { start?: string; end?: string };
  cells?: Era5MapCell[];
  stats?: {
    min?: number | null;
    max?: number | null;
    average?: number | null;
    validCellCount?: number;
  };
  error?: string;
};

const MAP_CAMERA = {
  pitch: 55,
  bearing: -14,
  padding: { top: 8, right: 8, bottom: 16, left: 8 },
  maxZoom: 19.15,
} as const;

const NDVI_PALETTE = {
  weak: 'rgb(226,71,42)',
  medium: 'rgb(242,183,5)',
  good: 'rgb(76,175,80)',
} as const;

const SOIL_VISUAL_PALETTES: Record<
  SoilGridsPropertyKey,
  [string, string, string]
> = {
  // These are visual contrast palettes. They do NOT change SoilGrids values.
  phh2o: ['#c94c35', '#e5bd45', '#4dac68'],
  soc: ['#ead8b7', '#a96b43', '#3a241b'],
  clay: ['#f0d7a3', '#d27a45', '#71392f'],
  sand: ['#624b34', '#d5a653', '#fff0bd'],
  silt: ['#65584d', '#b4a18a', '#ece2d2'],
} as const;

const SECTION_META: Record<UnifiedMapSection, { title: string; source: string; help: string }> = {
  vegetation: {
    title: 'Bitki Sağlığı',
    source: 'Sentinel-2 · NDVI',
    help: 'Parsel içindeki bitki gelişimi farklarını renkli NDVI görüntüsü üzerinden karşılaştır.',
  },
  radar: {
    title: 'Radar',
    source: 'Sentinel-1 · Copernicus',
    help: 'Buluttan bağımsız radar görüntüsünde parsel içindeki göreli yüzey ve yapı farklarını karşılaştır.',
  },
  soil: {
    title: 'Toprak',
    source: 'SoilGrids · ISRIC',
    help: 'Toprak özelliklerinin model tahminini aynı parsel çevresinde katman olarak incele.',
  },
  climate: {
    title: 'İklim',
    source: 'ERA5-Land · ECMWF',
    help: 'Toprak nemi, sıcaklık ve yağışın yakın çevredeki mekânsal dağılımını karşılaştır.',
  },
  observations: {
    title: 'Zararlı & Tür',
    source: 'GBIF · Açık gözlem kayıtları',
    help: 'Yakındaki konumlu tür ve zararlı aday kayıtlarını tarla çevresinde gör.',
  },
};

const RADAR_OPTIONS: Array<{ value: Sentinel1RadarMode; label: string }> = [
  { value: 'composite', label: 'Genel Görünüm' },
  { value: 'vv', label: 'Nemli Alanlar' },
  { value: 'vh', label: 'Bitki ve Zemin Farkı' },
  { value: 'water', label: 'Su Birikimi Riski' },
];

const SOIL_OPTIONS: Array<{ value: SoilGridsPropertyKey; label: string }> = [
  { value: 'phh2o', label: 'pH' },
  { value: 'soc', label: 'Organik Karbon' },
  { value: 'clay', label: 'Kil' },
  { value: 'sand', label: 'Kum' },
  { value: 'silt', label: 'Silt' },
];

const CLIMATE_OPTIONS: Array<{ value: Era5MapVariable; label: string }> = [
  { value: 'soil_moisture_0_to_7cm', label: 'Yüzey Nemi' },
  { value: 'soil_moisture_7_to_28cm', label: 'Kök Bölgesi Nemi' },
  { value: 'soil_temperature_0_to_7cm', label: 'Toprak Sıcaklığı' },
  { value: 'temperature_2m', label: 'Hava Sıcaklığı' },
  { value: 'precipitation', label: 'Yağış' },
];

type MapGroup = 'vegetation' | 'water' | 'soil' | 'risk';

const MAP_GROUPS: Array<{ key: MapGroup; label: string; icon: string }> = [
  { key: 'vegetation', label: 'Bitki Sağlığı', icon: '⌁' },
  { key: 'water', label: 'Su & Nem', icon: '◒' },
  { key: 'soil', label: 'Toprak', icon: '◇' },
  { key: 'risk', label: 'Risk & Çevre', icon: '△' },
];

const FUTURE_VEGETATION_LAYERS = ['EVI', 'NDMI', 'NDWI', 'SAVI', 'BSI', 'LAI'];

function mapGroupFor(section: UnifiedMapSection, climateVariable: Era5MapVariable): MapGroup {
  if (section === 'vegetation') return 'vegetation';
  if (section === 'soil') return 'soil';
  if (section === 'radar') return 'water';
  if (
    section === 'climate' &&
    (climateVariable === 'soil_moisture_0_to_7cm' ||
      climateVariable === 'soil_moisture_7_to_28cm' ||
      climateVariable === 'soil_moisture_28_to_100cm')
  ) {
    return 'water';
  }
  return 'risk';
}

function layerUiMeta(
  section: UnifiedMapSection,
  ndviView: 'ndvi' | 'trueColor',
  radarMode: Sentinel1RadarMode,
  soilProperty: SoilGridsPropertyKey,
  climateVariable: Era5MapVariable,
) {
  if (section === 'vegetation') {
    if (ndviView === 'trueColor') {
      return {
        title: 'Gerçek Uydu Görüntüsü',
        description: 'Parseli Sentinel-2 gerçek renk görüntüsü üzerinde kontrol et. Bitki rengi, çıplak alan ve parsel sınırı birlikte okunur.',
        source: 'Sentinel-2 · Gerçek renk',
        icon: '◉',
      };
    }
    return {
      title: 'Bitki Sağlığı (NDVI)',
      description: 'Bu katman bitkinin canlılık ve stres düzeyini gösterir. Kırmızı alanlar zayıf, sarı alanlar takip edilmeli, yeşil alanlar daha sağlıklıdır.',
      source: 'Sentinel-2 · NDVI',
      icon: '⌁',
    };
  }

  if (section === 'radar') {
    return {
      title: RADAR_OPTIONS.find((item) => item.value === radarMode)?.label ?? 'Radar',
      description: radarMode === 'water'
        ? 'Sentinel-1 radar geri saçılımından su birikimi adayı bölgeleri karşılaştırır. Kesin su tespiti değildir; saha kontrolü ile doğrulanmalıdır.'
        : 'Buluttan bağımsız Sentinel-1 radar görüntüsüyle yüzey, nem ve bitki-zemin farklarını karşılaştırır.',
      source: 'Sentinel-1 · Copernicus',
      icon: '◒',
    };
  }

  if (section === 'soil') {
    return {
      title: `Toprak · ${SOIL_OPTIONS.find((item) => item.value === soilProperty)?.label ?? 'Katman'}`,
      description: 'SoilGrids model tahminini parsel üzerinde katman olarak gösterir. Laboratuvar sonucu varsa gerçek analiz her zaman önceliklidir.',
      source: 'SoilGrids · ISRIC',
      icon: '◇',
    };
  }

  if (section === 'climate') {
    return {
      title: climateVariableLabel(climateVariable),
      description: climateVariable.startsWith('soil_moisture')
        ? 'ERA5 tabanlı toprak nemi dağılımını tarla çevresinde karşılaştırır. Sensör ölçümü değildir; sulama kararı öncesinde saha nemi ile doğrulanmalıdır.'
        : 'ERA5 tabanlı sıcaklık ve yağış dağılımını tarla çevresinde karşılaştırır. Bölgesel model verisidir.',
      source: 'ERA5-Land · ECMWF',
      icon: climateVariable === 'precipitation' ? '◒' : '△',
    };
  }

  return {
    title: 'Risk & Çevre Gözlemleri',
    description: 'Tarla çevresindeki konumlu tür ve zararlı aday gözlemlerini gösterir. Kayıt görülmesi, tarlada kesin zararlı bulunduğu anlamına gelmez.',
    source: 'GBIF · Açık gözlem kayıtları',
    icon: '△',
  };
}

function unifiedAiActiveLayer(
  section: UnifiedMapSection,
  radarMode: Sentinel1RadarMode,
): UnifiedMapActiveLayer {
  if (section === 'vegetation') return 'vegetation';
  if (section === 'radar') {
    if (radarMode === 'water') return 'radar-water';
    if (radarMode === 'vh') return 'radar-vh';
    return 'radar-vv';
  }
  if (section === 'soil') return 'soil';
  if (section === 'climate') return 'climate';
  return 'biodiversity';
}

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatSatelliteDate(value?: string | null) {
  if (!value) return '';

  const isoMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function parcelGeometryObject(field?: Field | null) {
  const raw: any = (field as any)?.parcelGeometry;
  if (!raw) return null;
  if (raw.type === 'Feature') return raw.geometry ?? null;
  if (raw.type === 'FeatureCollection') {
    const geometries = (raw.features ?? [])
      .map((feature: any) => feature?.geometry)
      .filter(Boolean);
    if (geometries.length === 1) return geometries[0];
    return raw;
  }
  return raw.geometry ?? raw;
}

function geometryCoordinates(geometry: any) {
  const coords: number[][] = [];

  const walk = (value: any) => {
    if (!Array.isArray(value)) return;

    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const longitude = Number(value[0]);
      const latitude = Number(value[1]);

      if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
        coords.push([longitude, latitude]);
      }

      return;
    }

    value.forEach(walk);
  };

  walk(geometry?.coordinates);
  return coords;
}

function fieldCoordinates(field?: Field | null) {
  if (!field) return null;

  // IMPORTANT:
  // Radar / Soil / Climate must follow the actual cadastral parcel first.
  // Saved latitude/longitude can be old or manually entered, so geometry wins.
  const geometry = parcelGeometryObject(field);
  const parcelCoords = geometryCoordinates(geometry);

  if (parcelCoords.length) {
    const longitude =
      parcelCoords.reduce((sum, item) => sum + item[0], 0) /
      parcelCoords.length;
    const latitude =
      parcelCoords.reduce((sum, item) => sum + item[1], 0) /
      parcelCoords.length;

    return { latitude, longitude };
  }

  const lat = finite((field as any).latitude ?? (field as any).lat);
  const lon = finite(
    (field as any).longitude ??
      (field as any).lng ??
      (field as any).lon,
  );

  if (lat !== null && lon !== null) {
    return { latitude: lat, longitude: lon };
  }

  return null;
}

type ParcelBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
  center: { longitude: number; latitude: number };
};

function parcelBoundsFromField(field?: Field | null): ParcelBounds | null {
  const geometry = parcelGeometryObject(field);
  const coords = geometryCoordinates(geometry);

  if (!coords.length) return null;

  const west = Math.min(...coords.map((item) => item[0]));
  const east = Math.max(...coords.map((item) => item[0]));
  const south = Math.min(...coords.map((item) => item[1]));
  const north = Math.max(...coords.map((item) => item[1]));

  return {
    west,
    south,
    east,
    north,
    center: {
      longitude: (west + east) / 2,
      latitude: (south + north) / 2,
    },
  };
}

function fieldGeoJson(field?: Field | null): GeoJSON.FeatureCollection {
  const raw: any = (field as any)?.parcelGeometry;

  if (!raw) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  if (raw.type === 'FeatureCollection') return raw;

  if (raw.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [raw],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: raw.geometry ?? raw,
      },
    ],
  };
}

function radarImageCoordinates(
  bbox: [number, number, number, number],
): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const [west, south, east, north] = bbox;

  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

function expandBounds(
  bounds: ParcelBounds,
  factor = 0.7,
): [number, number, number, number] {
  const width = Math.max(0.0004, bounds.east - bounds.west);
  const height = Math.max(0.0004, bounds.north - bounds.south);
  const padX = width * factor;
  const padY = height * factor;

  return [
    bounds.west - padX,
    bounds.south - padY,
    bounds.east + padX,
    bounds.north + padY,
  ];
}

function soilWmsUrl(
  bbox: [number, number, number, number],
  property: SoilGridsPropertyKey,
  depth: SoilGridsDepth,
) {
  const base = getSoilGridsWmsBaseUrl(property);
  const layer = getSoilGridsWmsLayerName(property, depth, 'mean');

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layer,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: bbox.join(','),
    WIDTH: '1200',
    HEIGHT: '900',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });

  return `${base}?${params.toString()}`;
}

function bboxImageCoordinates(
  bbox: [number, number, number, number],
): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const [west, south, east, north] = bbox;

  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

function colorForRatio(value: number) {
  const ratio = Math.max(0, Math.min(1, value));
  const hue = Math.round(28 + ratio * 105);
  return `hsl(${hue} 34% ${36 + ratio * 8}%)`;
}

type LegendConfig = {
  title: string;
  colors: [string, string, string] | [string, string, string, string];
  labels: [string, string, string];
  note?: string;
};

function MapMeaningLegend({ config }: { config: LegendConfig }) {
  return (
    <div style={styles.healthLegend}>
      <div style={styles.healthLegendTitle}>{config.title}</div>
      <div
        style={{
          ...styles.healthLegendBar,
          background: `linear-gradient(90deg, ${config.colors.join(', ')})`,
        }}
      />
      <div style={styles.healthLegendLabels}>
        <span>{config.labels[0]}</span>
        <span>{config.labels[1]}</span>
        <span>{config.labels[2]}</span>
      </div>
      {config.note ? <div style={styles.healthLegendNote}>{config.note}</div> : null}
    </div>
  );
}

function radarLegend(mode: Sentinel1RadarMode): LegendConfig {
  // IMPORTANT:
  // These colours are derived from the SAME Sentinel-1 evalscripts that render
  // the radar images. The legend must never use a decorative palette.
  switch (mode) {
    case 'vv':
      return {
        title: 'Nemli Alanlar',
        // VV evalscript returns [v, v, v] -> pure grayscale.
        colors: ['#000000', '#808080', '#ffffff'],
        labels: ['Düşük yansıma', 'Orta', 'Yüksek yansıma'],
        note: 'Koyu tonlar düşük, açık tonlar yüksek VV radar yansımasını gösterir. Nem dışında yüzey pürüzlülüğü ve bitki yapısı da tonu etkiler.',
      };

    case 'vh':
      return {
        title: 'Bitki ve Zemin Farkı',
        // VH evalscript:
        // R = .10 + .25v, G = v, B = .22 + .45v
        colors: ['#1a0038', '#3a806f', '#59ffab'],
        labels: ['Düşük VH', 'Orta VH', 'Yüksek VH'],
        note: 'Koyu mor tonlardan parlak yeşil/turkuaza geçiş, VH sinyalinin güçlendiğini gösterir; bitki ve yüzey yapısı farklarını karşılaştırmak içindir.',
      };

    case 'water':
      return {
        title: 'Su Birikimi Riski',
        // Water evalscript: stronger waterScore raises the blue channel,
        // while stronger land return increases red+green -> olive/green.
        colors: ['#1a2eff', '#466b83', '#73a12e'],
        labels: ['Su adayı', 'Geçiş', 'Kara / yüksek saçılım'],
        note: 'Mavi tonlar daha güçlü su adayıdır; yeşil-zeytin tonları daha yüksek kara geri saçılımını gösterir. Tek başına kesin su tespiti değildir.',
      };

    default:
      return {
        title: 'Genel Radar Görünümü',
        // Composite evalscript maps VV->R, VH->G and polarization ratio->B.
        colors: ['#c76b5b', '#5db077', '#6c72d8'],
        labels: ['VV / kırmızı', 'VH / yeşil', 'Oran / mavi'],
        note: 'Bu mod düşük-orta-yüksek skalası değildir: kırmızı VV, yeşil VH, mavi ise polarizasyon oranı bileşenini temsil eder.',
      };
  }
}

function soilLegend(property: SoilGridsPropertyKey): LegendConfig {
  const colors = SOIL_VISUAL_PALETTES[property];

  switch (property) {
    case 'phh2o':
      return {
        title: 'Toprak pH',
        colors,
        labels: ['Göreli düşük', 'Orta', 'Göreli yüksek'],
        note: 'Renkler seçili alan içindeki pH farklarını belirginleştirir; sayısal karttaki pH değeri esas ölçektir.',
      };

    case 'soc':
      return {
        title: 'Organik Karbon',
        colors,
        labels: ['Düşük', 'Orta', 'Yüksek'],
        note: 'Açık bejden koyu kahverengiye geçiş, organik karbonun göreli olarak arttığını gösterir.',
      };

    case 'clay':
      return {
        title: 'Kil Oranı',
        colors,
        labels: ['Az kil', 'Orta', 'Çok kil'],
        note: 'Kremden koyu kiremit tonuna geçiş, kil oranının göreli olarak arttığını gösterir.',
      };

    case 'sand':
      return {
        title: 'Kum Oranı',
        colors,
        labels: ['Az kum', 'Orta', 'Çok kum'],
        note: 'Koyu toprak tonundan açık kum tonuna geçiş, kum oranının göreli olarak arttığını gösterir.',
      };

    default:
      return {
        title: 'Silt Oranı',
        colors,
        labels: ['Düşük', 'Orta', 'Yüksek'],
        note: 'Koyu gri-kahveden açık beje geçiş, silt oranının göreli olarak arttığını gösterir.',
      };
  }
}

const CLIMATE_PALETTES: Record<
  'moisture' | 'temperature' | 'precipitation',
  [string, string, string]
> = {
  moisture: ['#8b5a2b', '#55b6a8', '#1e5fd1'],
  temperature: ['#3b69d1', '#f2c84b', '#d94832'],
  precipitation: ['#d8c9a3', '#4bb6d8', '#2456c7'],
} as const;

function climatePaletteKey(
  variable: Era5MapVariable,
): 'moisture' | 'temperature' | 'precipitation' {
  if (
    variable === 'temperature_2m' ||
    variable === 'soil_temperature_0_to_7cm' ||
    variable === 'soil_temperature_7_to_28cm'
  ) {
    return 'temperature';
  }

  if (variable === 'precipitation') {
    return 'precipitation';
  }

  return 'moisture';
}

function climateLegend(variable: Era5MapVariable): LegendConfig {
  const key = climatePaletteKey(variable);
  const colors = CLIMATE_PALETTES[key];

  if (key === 'temperature') {
    return {
      title: 'Sıcaklık',
      colors,
      labels: ['Daha serin', 'Orta', 'Daha sıcak'],
      note: 'Maviden kırmızıya geçiş bölgesel ERA5 sıcaklık farkını gösterir; tarla içi mikro ölçüm değildir.',
    };
  }

  if (key === 'precipitation') {
    return {
      title: 'Yağış',
      colors,
      labels: ['Az yağış', 'Orta', 'Çok yağış'],
      note: 'Açık tondan koyu maviye geçiş seçili dönemdeki göreli yağış miktarını gösterir.',
    };
  }

  return {
    title: 'Toprak Nemi',
    colors,
    labels: ['Daha kuru', 'Orta', 'Daha nemli'],
    note: 'Kahverengiden maviye geçiş bölgesel model neminin arttığını gösterir; sensör ölçümü değildir.',
  };
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((item) => item + item)
          .join('')
      : value;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
) {
  const k = Math.max(0, Math.min(1, t));

  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
  };
}

function soilPaletteColor(
  property: SoilGridsPropertyKey,
  value: number,
) {
  const palette = SOIL_VISUAL_PALETTES[property];
  const low = hexToRgb(palette[0]);
  const mid = hexToRgb(palette[1]);
  const high = hexToRgb(palette[2]);

  const v = Math.max(0, Math.min(1, value));

  return v <= 0.5
    ? mixRgb(low, mid, v / 0.5)
    : mixRgb(mid, high, (v - 0.5) / 0.5);
}

async function recolorSoilWmsImage(
  url: string,
  property: SoilGridsPropertyKey,
): Promise<string> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-store',
    });

    if (!response.ok) return url;

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const source = document.createElement('canvas');
    source.width = bitmap.width;
    source.height = bitmap.height;

    const context = source.getContext('2d', {
      willReadFrequently: true,
    });

    if (!context) return url;

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imageData = context.getImageData(
      0,
      0,
      source.width,
      source.height,
    );

    const data = imageData.data;

    // Sample valid SoilGrids pixels. White/transparent pixels are no-data.
    const samples: Array<[number, number, number]> = [];
    const stride = Math.max(
      1,
      Math.floor(Math.sqrt((source.width * source.height) / 30000)),
    );

    for (let y = 0; y < source.height; y += stride) {
      for (let x = 0; x < source.width; x += stride) {
        const i = (y * source.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const nearWhite = r > 244 && g > 244 && b > 244;
        if (a < 20 || nearWhite) continue;

        samples.push([r, g, b]);
      }
    }

    if (samples.length < 10) return url;

    // Principal-component projection:
    // SoilGrids default WMS palettes differ by property, so raw luminance is not
    // reliable. PC1 finds the dominant RGB direction that actually varies in
    // THIS requested map, then we stretch that local variation.
    let meanR = 0;
    let meanG = 0;
    let meanB = 0;

    for (const [r, g, b] of samples) {
      meanR += r;
      meanG += g;
      meanB += b;
    }

    meanR /= samples.length;
    meanG /= samples.length;
    meanB /= samples.length;

    let c00 = 0, c01 = 0, c02 = 0;
    let c11 = 0, c12 = 0, c22 = 0;

    for (const [r, g, b] of samples) {
      const dr = r - meanR;
      const dg = g - meanG;
      const db = b - meanB;

      c00 += dr * dr;
      c01 += dr * dg;
      c02 += dr * db;
      c11 += dg * dg;
      c12 += dg * db;
      c22 += db * db;
    }

    let vx = 1;
    let vy = 1;
    let vz = 1;

    for (let iteration = 0; iteration < 12; iteration += 1) {
      const nx = c00 * vx + c01 * vy + c02 * vz;
      const ny = c01 * vx + c11 * vy + c12 * vz;
      const nz = c02 * vx + c12 * vy + c22 * vz;
      const length = Math.hypot(nx, ny, nz) || 1;

      vx = nx / length;
      vy = ny / length;
      vz = nz / length;
    }

    const projections = samples
      .map(
        ([r, g, b]) =>
          (r - meanR) * vx +
          (g - meanG) * vy +
          (b - meanB) * vz,
      )
      .sort((a, b) => a - b);

    const percentile = (p: number) =>
      projections[
        Math.max(
          0,
          Math.min(
            projections.length - 1,
            Math.round((projections.length - 1) * p),
          ),
        )
      ];

    const p05 = percentile(0.05);
    const p50 = percentile(0.50);
    const p95 = percentile(0.95);

    // Make the semantic direction stable for the requested SoilGrids style:
    // compare the palette endpoint brightness. If PC1 runs backwards, flip it.
    const firstSample = samples[0];
    const firstProjection =
      (firstSample[0] - meanR) * vx +
      (firstSample[1] - meanG) * vy +
      (firstSample[2] - meanB) * vz;

    // Use the image-wide median as our center; direction itself is only used for
    // spatial contrast, while the legend explicitly says "relative".
    const low = Math.min(p05, p95);
    const high = Math.max(p05, p95);
    const spread = Math.max(1, high - low);

    const output = context.createImageData(
      source.width,
      source.height,
    );

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const nearWhite = r > 244 && g > 244 && b > 244;
      if (a < 20 || nearWhite) {
        output.data[i + 3] = 0;
        continue;
      }

      const projection =
        (r - meanR) * vx +
        (g - meanG) * vy +
        (b - meanB) * vz;

      let normalized = (projection - low) / spread;
      normalized = Math.max(0, Math.min(1, normalized));

      // Strong smoothstep contrast makes subtle SoilGrids differences readable.
      normalized =
        normalized * normalized * (3 - 2 * normalized);

      const color = soilPaletteColor(property, normalized);

      output.data[i] = color.r;
      output.data[i + 1] = color.g;
      output.data[i + 2] = color.b;
      output.data[i + 3] = 225;
    }

    context.putImageData(output, 0, 0);

    // Soften the 250 m grid edges without erasing actual regional differences.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = source.width;
    finalCanvas.height = source.height;

    const finalContext = finalCanvas.getContext('2d');

    if (!finalContext) {
      return source.toDataURL('image/png');
    }

    finalContext.filter = 'blur(1.4px)';
    finalContext.drawImage(source, 0, 0);
    finalContext.filter = 'none';

    finalContext.globalAlpha = 0.32;
    finalContext.drawImage(source, 0, 0);
    finalContext.globalAlpha = 1;

    return finalCanvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Toprak katmanı renklendirilemedi:', error);
    return url;
  }
}

function SoilGeoMap({
  field,
  property,
  depth,
}: {
  field: Field | null;
  property: SoilGridsPropertyKey;
  depth: SoilGridsDepth;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [processedSoilUrl, setProcessedSoilUrl] = useState<string | null>(null);

  const parcelBounds = useMemo(
    () => parcelBoundsFromField(field),
    [field],
  );

  const soilBbox = useMemo(
    () => (parcelBounds ? expandBounds(parcelBounds, 0.85) : null),
    [
      parcelBounds?.west,
      parcelBounds?.south,
      parcelBounds?.east,
      parcelBounds?.north,
    ],
  );

  const soilUrl = useMemo(
    () =>
      soilBbox
        ? soilWmsUrl(soilBbox, property, depth)
        : null,
    [soilBbox?.join(','), property, depth],
  );

  useEffect(() => {
    let cancelled = false;

    if (!soilUrl) {
      setProcessedSoilUrl(null);
      return () => {
        cancelled = true;
      };
    }

    setProcessedSoilUrl(null);

    void recolorSoilWmsImage(soilUrl, property).then((result) => {
      if (!cancelled) {
        setProcessedSoilUrl(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [soilUrl, property]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fallback = fieldCoordinates(field) ?? {
      latitude: 38.9637,
      longitude: 35.2433,
    };

    const map = new mapRuntime.Map({
      container,
      center: [fallback.longitude, fallback.latitude],
      zoom: parcelBounds ? 16 : 8,
      pitch: MAP_CAMERA.pitch,
      bearing: MAP_CAMERA.bearing,
      minZoom: 3,
      maxZoom: 22,
      maxPitch: 68,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      style: {
        version: 8,
        sources: {
          satellite: createSatelliteRasterSource(),
        },
        layers: [
          {
            id: 'soil-satellite-base',
            type: 'raster',
            source: 'satellite',
            paint: vividSatellitePaint,
          },
        ],
      },
    });

    mapRef.current = map;

    addTarlaCompass(map, 'top-right');
    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('soil-parcel', {
        type: 'geojson',
        data: fieldGeoJson(field),
      });

      map.addLayer({
        id: 'soil-parcel-shadow',
        type: 'line',
        source: 'soil-parcel',
        paint: {
          'line-color': '#07100b',
          'line-width': 6,
          'line-opacity': 0.88,
        },
      });

      map.addLayer({
        id: 'soil-parcel-line',
        type: 'line',
        source: 'soil-parcel',
        paint: {
          'line-color': '#70e39a',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 0,
          },
        );
      }

      map.resize();
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateParcel = () => {
      const source = map.getSource('soil-parcel') as
        | GeoJSONSource
        | undefined;

      source?.setData(fieldGeoJson(field));

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 500,
          },
        );
      }
    };

    if (map.isStyleLoaded()) updateParcel();
    else map.once('load', updateParcel);
  }, [
    field,
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !processedSoilUrl || !soilBbox) return;

    const updateSoil = () => {
      if (map.getLayer('soil-wms-layer')) {
        map.removeLayer('soil-wms-layer');
      }

      if (map.getSource('soil-wms-image')) {
        map.removeSource('soil-wms-image');
      }

      map.addSource('soil-wms-image', {
        type: 'image',
        url: processedSoilUrl,
        coordinates: bboxImageCoordinates(soilBbox),
      });

      map.addLayer(
        {
          id: 'soil-wms-layer',
          type: 'raster',
          source: 'soil-wms-image',
          paint: {
            'raster-opacity': 0.72,
            'raster-resampling': 'linear',
            'raster-fade-duration': 0,
          },
        },
        map.getLayer('soil-parcel-shadow')
          ? 'soil-parcel-shadow'
          : undefined,
      );
    };

    if (map.isStyleLoaded()) updateSoil();
    else map.once('load', updateSoil);
  }, [
    processedSoilUrl,
    soilBbox?.[0],
    soilBbox?.[1],
    soilBbox?.[2],
    soilBbox?.[3],
  ]);

  return (
    <div style={styles.radarMapShell}>
      <div ref={containerRef} style={styles.radarMapCanvas} />

      <div style={styles.radarMapBadge}>
        <span>TOPRAK</span>
        <strong>{field?.name ?? 'Seçili tarla'}</strong>
      </div>
    </div>
  );
}

function VegetationGeoMap({
  field,
  ndvi,
  view,
}: {
  field: Field | null;
  ndvi: SatelliteHealthResult | null;
  view: 'ndvi' | 'trueColor';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const parcelBounds = useMemo(() => parcelBoundsFromField(field), [field]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fallback = fieldCoordinates(field) ?? {
      latitude: 38.9637,
      longitude: 35.2433,
    };

    const map = new mapRuntime.Map({
      container,
      center: [fallback.longitude, fallback.latitude],
      zoom: parcelBounds ? 16 : 8,
      pitch: MAP_CAMERA.pitch,
      bearing: MAP_CAMERA.bearing,
      minZoom: 3,
      maxZoom: 22,
      maxPitch: 68,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      style: {
        version: 8,
        sources: {
          satellite: createSatelliteRasterSource(),
        },
        layers: [
          {
            id: 'veg-satellite-base',
            type: 'raster',
            source: 'satellite',
            paint: vividSatellitePaint,
          },
        ],
      },
    });

    mapRef.current = map;

    addTarlaCompass(map, 'top-right');
    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('veg-parcel', {
        type: 'geojson',
        data: fieldGeoJson(field),
      });

      map.addLayer({
        id: 'veg-parcel-shadow',
        type: 'line',
        source: 'veg-parcel',
        paint: {
          'line-color': '#07100b',
          'line-width': 6,
          'line-opacity': 0.88,
        },
      });

      map.addLayer({
        id: 'veg-parcel-line',
        type: 'line',
        source: 'veg-parcel',
        paint: {
          'line-color': '#70e39a',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 0,
          },
        );
      }

      map.resize();
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !parcelBounds) return;

    const update = () => {
      const source = map.getSource('veg-parcel') as GeoJSONSource | undefined;
      source?.setData(fieldGeoJson(field));

      map.fitBounds(
        [
          [parcelBounds.west, parcelBounds.south],
          [parcelBounds.east, parcelBounds.north],
        ],
        {
          padding: MAP_CAMERA.padding,
          maxZoom: MAP_CAMERA.maxZoom,
          pitch: MAP_CAMERA.pitch,
          bearing: MAP_CAMERA.bearing,
          duration: 500,
        },
      );
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [
    field,
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !parcelBounds) return;

    const imageUrl =
      view === 'ndvi' ? ndvi?.ndviImage : ndvi?.trueColorImage;

    if (!imageUrl) return;

    const update = () => {
      if (map.getLayer('veg-image-layer')) {
        map.removeLayer('veg-image-layer');
      }
      if (map.getSource('veg-image')) {
        map.removeSource('veg-image');
      }

      const coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ] = [
        [parcelBounds.west, parcelBounds.north],
        [parcelBounds.east, parcelBounds.north],
        [parcelBounds.east, parcelBounds.south],
        [parcelBounds.west, parcelBounds.south],
      ];

      map.addSource('veg-image', {
        type: 'image',
        url: imageUrl,
        coordinates,
      });

      map.addLayer(
        {
          id: 'veg-image-layer',
          type: 'raster',
          source: 'veg-image',
          paint: {
            'raster-opacity': view === 'ndvi' ? 0.80 : 0.74,
            'raster-resampling': 'linear',
            'raster-fade-duration': 0,
            'raster-saturation': view === 'ndvi' ? 0.10 : -0.04,
            'raster-contrast': view === 'ndvi' ? -0.04 : 0.02,
          },
        },
        map.getLayer('veg-parcel-shadow')
          ? 'veg-parcel-shadow'
          : undefined,
      );
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [
    ndvi?.ndviImage,
    ndvi?.trueColorImage,
    view,
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  const satelliteDate = formatSatelliteDate(ndvi?.latestImageDate);

  return (
    <div style={styles.radarMapShell}>
      <div ref={containerRef} style={styles.radarMapCanvas} />

      {satelliteDate ? (
        <div style={styles.satelliteDateBadge}>{satelliteDate}</div>
      ) : null}
    </div>
  );
}

function RadarGeoMap({
  field,
  radar,
  mode,
}: {
  field: Field | null;
  radar: Sentinel1RadarResponse | null;
  mode: Sentinel1RadarMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const parcelBounds = useMemo(() => parcelBoundsFromField(field), [field]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fallback = fieldCoordinates(field) ?? {
      latitude: 38.9637,
      longitude: 35.2433,
    };

    const map = new mapRuntime.Map({
      container,
      center: [fallback.longitude, fallback.latitude],
      zoom: parcelBounds ? 15.5 : 8,
      pitch: MAP_CAMERA.pitch,
      bearing: MAP_CAMERA.bearing,
      minZoom: 3,
      maxZoom: 22,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      style: {
        version: 8,
        sources: {
          satellite: createSatelliteRasterSource(),
        },
        layers: [
          {
            id: 'radar-satellite-base',
            type: 'raster',
            source: 'satellite',
            paint: vividSatellitePaint,
          },
        ],
      },
    });

    mapRef.current = map;

    addTarlaCompass(map, 'top-right');
    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('radar-parcel', {
        type: 'geojson',
        data: fieldGeoJson(field),
      });

      map.addLayer({
        id: 'radar-parcel-fill',
        type: 'fill',
        source: 'radar-parcel',
        paint: {
          'fill-color': '#6fe49a',
          'fill-opacity': 0.035,
        },
      });

      map.addLayer({
        id: 'radar-parcel-shadow',
        type: 'line',
        source: 'radar-parcel',
        paint: {
          'line-color': '#07100b',
          'line-width': 6,
          'line-opacity': 0.88,
        },
      });

      map.addLayer({
        id: 'radar-parcel-line',
        type: 'line',
        source: 'radar-parcel',
        paint: {
          'line-color': '#70e39a',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 0,
          },
        );
      }

      map.resize();
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateParcel = () => {
      const source = map.getSource('radar-parcel') as
        | GeoJSONSource
        | undefined;

      source?.setData(fieldGeoJson(field));

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 550,
          },
        );
      }
    };

    if (map.isStyleLoaded()) updateParcel();
    else map.once('load', updateParcel);
  }, [
    field,
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !radar?.imageDataUrl || !Array.isArray(radar?.bbox)) return;

    const updateRadar = () => {
      if (map.getLayer('radar-image-layer')) {
        map.removeLayer('radar-image-layer');
      }

      if (map.getSource('radar-image')) {
        map.removeSource('radar-image');
      }

      map.addSource('radar-image', {
        type: 'image',
        url: radar.imageDataUrl,
        coordinates: radarImageCoordinates(
          radar.bbox as [number, number, number, number],
        ),
      });

      map.addLayer(
        {
          id: 'radar-image-layer',
          type: 'raster',
          source: 'radar-image',
          paint: {
            'raster-opacity': 0.80,
            'raster-resampling': 'linear',
            'raster-fade-duration': 0,
          },
        },
        map.getLayer('radar-parcel-fill')
          ? 'radar-parcel-fill'
          : undefined,
      );

      // NEVER focus on radar bbox here.
      // The radar bbox is a processing window around the coordinate, not the farm.
      // The screen must remain centered on the selected parcel.
      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 500,
          },
        );
      }
    };

    if (map.isStyleLoaded()) updateRadar();
    else map.once('load', updateRadar);
  }, [
    radar?.imageDataUrl,
    radar?.bbox?.[0],
    radar?.bbox?.[1],
    radar?.bbox?.[2],
    radar?.bbox?.[3],
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  return (
    <div style={styles.radarMapShell}>
      <div ref={containerRef} style={styles.radarMapCanvas} />

      <div style={styles.radarMapBadge}>
        <span>RADAR</span>
        <strong>{field?.name ?? 'Seçili tarla'}</strong>
      </div>

      <div style={styles.radarMapHintRight}>
        Radar görüntüsü seçili parselin gerçek koordinatına oturtuldu.
      </div>
    </div>
  );
}

function climateColor(
  variable: Era5MapVariable,
  ratio: number,
) {
  const palette = CLIMATE_PALETTES[climatePaletteKey(variable)];
  const low = hexToRgb(palette[0]);
  const mid = hexToRgb(palette[1]);
  const high = hexToRgb(palette[2]);
  const value = Math.max(0, Math.min(1, ratio));

  return value <= 0.5
    ? mixRgb(low, mid, value / 0.5)
    : mixRgb(mid, high, (value - 0.5) / 0.5);
}

function climateGridBounds(
  result: Era5MapResponse | null,
): [number, number, number, number] | null {
  const cells = Array.isArray(result?.cells)
    ? result!.cells!.filter(
        (cell) =>
          cell.value !== null &&
          Number.isFinite(cell.latitude) &&
          Number.isFinite(cell.longitude),
      )
    : [];

  if (!cells.length) return null;

  const resolution =
    cells.find((cell) => Number.isFinite(cell.resolutionDegrees))
      ?.resolutionDegrees ?? 0.1;

  const half = Math.max(0.01, resolution / 2);

  return [
    Math.min(...cells.map((cell) => cell.longitude)) - half,
    Math.min(...cells.map((cell) => cell.latitude)) - half,
    Math.max(...cells.map((cell) => cell.longitude)) + half,
    Math.max(...cells.map((cell) => cell.latitude)) + half,
  ];
}

async function createClimateOverlay(
  result: Era5MapResponse,
  variable: Era5MapVariable,
): Promise<string | null> {
  const cells = Array.isArray(result.cells)
    ? result.cells.filter(
        (cell) =>
          cell.value !== null &&
          Number.isFinite(Number(cell.value)) &&
          Number.isFinite(cell.latitude) &&
          Number.isFinite(cell.longitude),
      )
    : [];

  const bounds = climateGridBounds(result);
  if (!cells.length || !bounds) return null;

  const [west, south, east, north] = bounds;
  const width = 640;
  const height = 640;

  const min =
    finite(result.stats?.min) ??
    Math.min(...cells.map((cell) => Number(cell.value)));

  const max =
    finite(result.stats?.max) ??
    Math.max(...cells.map((cell) => Number(cell.value)));

  const spread = Math.max(0.000001, max - min);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(width, height);

  for (let py = 0; py < height; py += 1) {
    const latitude =
      north - (py / Math.max(1, height - 1)) * (north - south);

    for (let px = 0; px < width; px += 1) {
      const longitude =
        west + (px / Math.max(1, width - 1)) * (east - west);

      let weighted = 0;
      let totalWeight = 0;

      for (const cell of cells) {
        const dx = longitude - cell.longitude;
        const dy = latitude - cell.latitude;
        const distanceSquared = dx * dx + dy * dy;

        // Very close to a cell center: use the real model value directly.
        if (distanceSquared < 1e-10) {
          weighted = Number(cell.value);
          totalWeight = 1;
          break;
        }

        // IDW interpolation only smooths the coarse ERA5 grid;
        // it does NOT invent new higher-resolution measurements.
        const weight = 1 / Math.pow(distanceSquared, 1.25);
        weighted += Number(cell.value) * weight;
        totalWeight += weight;
      }

      const value =
        totalWeight > 0
          ? weighted / totalWeight
          : finite(result.stats?.average) ?? min;

      let ratio = (value - min) / spread;
      ratio = Math.max(0, Math.min(1, ratio));
      ratio = ratio * ratio * (3 - 2 * ratio);

      const color = climateColor(variable, ratio);
      const index = (py * width + px) * 4;

      image.data[index] = color.r;
      image.data[index + 1] = color.g;
      image.data[index + 2] = color.b;
      image.data[index + 3] = 218;
    }
  }

  context.putImageData(image, 0, 0);

  const softened = document.createElement('canvas');
  softened.width = width;
  softened.height = height;

  const softenedContext = softened.getContext('2d');
  if (!softenedContext) return canvas.toDataURL('image/png');

  softenedContext.filter = 'blur(5px)';
  softenedContext.drawImage(canvas, 0, 0);
  softenedContext.filter = 'none';

  softenedContext.globalAlpha = 0.28;
  softenedContext.drawImage(canvas, 0, 0);
  softenedContext.globalAlpha = 1;

  return softened.toDataURL('image/png');
}

function ClimateGeoMap({
  field,
  result,
  variable,
}: {
  field: Field | null;
  result: Era5MapResponse | null;
  variable: Era5MapVariable;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  const parcelBounds = useMemo(
    () => parcelBoundsFromField(field),
    [field],
  );

  const climateBounds = useMemo(
    () => climateGridBounds(result),
    [
      result?.cells,
      result?.stats?.min,
      result?.stats?.max,
      variable,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    if (!result?.cells?.length) {
      setOverlayUrl(null);
      return () => {
        cancelled = true;
      };
    }

    setOverlayUrl(null);

    void createClimateOverlay(result, variable).then((url) => {
      if (!cancelled) setOverlayUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [result, variable]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fallback = fieldCoordinates(field) ?? {
      latitude: 38.9637,
      longitude: 35.2433,
    };

    const map = new mapRuntime.Map({
      container,
      center: [fallback.longitude, fallback.latitude],
      zoom: parcelBounds ? 16 : 8,
      pitch: MAP_CAMERA.pitch,
      bearing: MAP_CAMERA.bearing,
      minZoom: 3,
      maxZoom: 22,
      maxPitch: 68,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      style: {
        version: 8,
        sources: {
          satellite: createSatelliteRasterSource(),
        },
        layers: [
          {
            id: 'climate-satellite-base',
            type: 'raster',
            source: 'satellite',
            paint: vividSatellitePaint,
          },
        ],
      },
    });

    mapRef.current = map;

    addTarlaCompass(map, 'top-right');
    map.addControl(
      new mapRuntime.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      'top-right',
    );

    map.on('load', () => {
      map.addSource('climate-parcel', {
        type: 'geojson',
        data: fieldGeoJson(field),
      });

      map.addLayer({
        id: 'climate-parcel-shadow',
        type: 'line',
        source: 'climate-parcel',
        paint: {
          'line-color': '#07100b',
          'line-width': 6,
          'line-opacity': 0.88,
        },
      });

      map.addLayer({
        id: 'climate-parcel-line',
        type: 'line',
        source: 'climate-parcel',
        paint: {
          'line-color': '#70e39a',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 0,
          },
        );
      }

      map.resize();
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateParcel = () => {
      const source = map.getSource('climate-parcel') as
        | GeoJSONSource
        | undefined;

      source?.setData(fieldGeoJson(field));

      if (parcelBounds) {
        map.fitBounds(
          [
            [parcelBounds.west, parcelBounds.south],
            [parcelBounds.east, parcelBounds.north],
          ],
          {
            padding: MAP_CAMERA.padding,
            maxZoom: MAP_CAMERA.maxZoom,
            pitch: MAP_CAMERA.pitch,
            bearing: MAP_CAMERA.bearing,
            duration: 500,
          },
        );
      }
    };

    if (map.isStyleLoaded()) updateParcel();
    else map.once('load', updateParcel);
  }, [
    field,
    parcelBounds?.west,
    parcelBounds?.south,
    parcelBounds?.east,
    parcelBounds?.north,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !overlayUrl || !climateBounds) return;

    const updateClimate = () => {
      if (map.getLayer('climate-overlay-layer')) {
        map.removeLayer('climate-overlay-layer');
      }

      if (map.getSource('climate-overlay-image')) {
        map.removeSource('climate-overlay-image');
      }

      map.addSource('climate-overlay-image', {
        type: 'image',
        url: overlayUrl,
        coordinates: bboxImageCoordinates(climateBounds),
      });

      map.addLayer(
        {
          id: 'climate-overlay-layer',
          type: 'raster',
          source: 'climate-overlay-image',
          paint: {
            'raster-opacity': 0.68,
            'raster-resampling': 'linear',
            'raster-fade-duration': 0,
          },
        },
        map.getLayer('climate-parcel-shadow')
          ? 'climate-parcel-shadow'
          : undefined,
      );
    };

    if (map.isStyleLoaded()) updateClimate();
    else map.once('load', updateClimate);
  }, [
    overlayUrl,
    climateBounds?.[0],
    climateBounds?.[1],
    climateBounds?.[2],
    climateBounds?.[3],
  ]);

  return (
    <div style={styles.radarMapShell}>
      <div ref={containerRef} style={styles.radarMapCanvas} />

      <div style={styles.radarMapBadge}>
        <span>ERA5</span>
        <strong>{field?.name ?? 'Seçili tarla'}</strong>
      </div>

      <div style={styles.radarMapHintRight}>
        Bölgesel ERA5 verisi seçili parsel koordinatına oturtuldu.
      </div>
    </div>
  );
}

function ClimateGrid({ result, variable }: { result: Era5MapResponse | null; variable: Era5MapVariable }) {
  const cells = Array.isArray(result?.cells) ? result!.cells!.filter((cell) => cell.value !== null) : [];
  if (!cells.length) return <div style={styles.emptyStage}>İklim katmanı hazırlanıyor…</div>;
  const minLat = Math.min(...cells.map((c) => c.latitude));
  const maxLat = Math.max(...cells.map((c) => c.latitude));
  const minLon = Math.min(...cells.map((c) => c.longitude));
  const maxLon = Math.max(...cells.map((c) => c.longitude));
  const min = finite(result?.stats?.min) ?? Math.min(...cells.map((c) => Number(c.value)));
  const max = finite(result?.stats?.max) ?? Math.max(...cells.map((c) => Number(c.value)));
  const spread = Math.max(0.000001, max - min);

  return (
    <div style={styles.climateCanvas}>
      <div style={styles.climateBackdrop} />
      {cells.map((cell) => {
        const x = ((cell.longitude - minLon) / Math.max(0.000001, maxLon - minLon)) * 88 + 4;
        const y = (1 - (cell.latitude - minLat) / Math.max(0.000001, maxLat - minLat)) * 80 + 8;
        const ratio = (Number(cell.value) - min) / spread;
        return (
          <div
            key={cell.id}
            title={`${cell.value} ${cell.unit}`}
            style={{
              ...styles.climateCell,
              left: `${x}%`,
              top: `${y}%`,
              background: colorForRatio(ratio),
            }}
          >
            <strong>{Number(cell.value).toFixed(1)}</strong>
          </div>
        );
      })}
      <div style={styles.parcelFocus}>SEÇİLİ TARLA</div>
    </div>
  );
}


const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

function climateHourlyVariable(variable: Era5MapVariable) {
  switch (variable) {
    case 'soil_moisture_0_to_7cm':
      return 'soil_moisture_0_to_7cm';
    case 'soil_moisture_7_to_28cm':
      return 'soil_moisture_7_to_28cm';
    case 'soil_moisture_28_to_100cm':
      return 'soil_moisture_28_to_100cm';
    case 'soil_temperature_0_to_7cm':
      return 'soil_temperature_0cm';
    case 'soil_temperature_7_to_28cm':
      return 'soil_temperature_6cm';
    case 'temperature_2m':
      return 'temperature_2m';
    case 'precipitation':
      return 'precipitation';
    default:
      return 'soil_moisture_0_to_7cm';
  }
}

function climateUnit(variable: Era5MapVariable) {
  if (variable.startsWith('soil_moisture')) return 'm³/m³';
  if (variable.includes('temperature')) return '°C';
  if (variable === 'precipitation') return 'mm';
  return '';
}

function climateVariableLabel(variable: Era5MapVariable) {
  switch (variable) {
    case 'soil_moisture_0_to_7cm':
      return 'Yüzey Nemi';
    case 'soil_moisture_7_to_28cm':
      return 'Kök Bölgesi Nemi';
    case 'soil_moisture_28_to_100cm':
      return 'Derin Toprak Nemi';
    case 'soil_temperature_0_to_7cm':
      return 'Yüzey Toprak Sıcaklığı';
    case 'soil_temperature_7_to_28cm':
      return 'Kök Bölgesi Sıcaklığı';
    case 'temperature_2m':
      return 'Hava Sıcaklığı';
    case 'precipitation':
      return 'Yağış';
    default:
      return 'İklim';
  }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function averageFinite(values: unknown[]) {
  const finiteValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!finiteValues.length) return null;

  return (
    finiteValues.reduce((sum, value) => sum + value, 0) /
    finiteValues.length
  );
}

function sumFinite(values: unknown[]) {
  const finiteValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!finiteValues.length) return null;

  return finiteValues.reduce((sum, value) => sum + value, 0);
}

async function fetchClimateOpenMeteoGrid(
  latitude: number,
  longitude: number,
  variable: Era5MapVariable,
  days: number,
  gridRadius = 2,
): Promise<Era5MapResponse> {
  // ERA5-Land native grid is ~0.1°. We sample a small regional grid around the
  // selected parcel. This is regional climate context, not intra-field sensing.
  const step = 0.08;
  const points: Array<{ latitude: number; longitude: number }> = [];

  for (let y = -gridRadius; y <= gridRadius; y += 1) {
    for (let x = -gridRadius; x <= gridRadius; x += 1) {
      points.push({
        latitude: latitude + y * step,
        longitude: longitude + x * step,
      });
    }
  }

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);

  const hourlyVariable = climateHourlyVariable(variable);

  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(5)).join(','),
    longitude: points.map((point) => point.longitude.toFixed(5)).join(','),
    start_date: isoDate(start),
    end_date: isoDate(end),
    hourly: hourlyVariable,
    timezone: 'UTC',
    models: 'best_match',
    cell_selection: 'land',
  });

  const response = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Open-Meteo iklim servisi ${response.status} hatası verdi.`);
  }

  const payload = await response.json();
  const entries = Array.isArray(payload) ? payload : [payload];

  const cells: Era5MapCell[] = entries
    .map((entry: any, index: number) => {
      const values = Array.isArray(entry?.hourly?.[hourlyVariable])
        ? entry.hourly[hourlyVariable]
        : [];

      const value =
        variable === 'precipitation'
          ? sumFinite(values)
          : averageFinite(values);

      if (value === null) return null;

      const point = points[index] ?? {
        latitude: Number(entry?.latitude),
        longitude: Number(entry?.longitude),
      };

      const cellLatitude = Number(entry?.latitude ?? point.latitude);
      const cellLongitude = Number(entry?.longitude ?? point.longitude);

      return {
        id: `${cellLatitude.toFixed(5)}:${cellLongitude.toFixed(5)}`,
        latitude: cellLatitude,
        longitude: cellLongitude,
        value,
        unit: climateUnit(variable),
        model: 'Open-Meteo Historical Weather · best_match',
        resolutionDegrees: step,
      } satisfies Era5MapCell;
    })
    .filter(Boolean) as Era5MapCell[];

  if (!cells.length) {
    throw new Error('Open-Meteo seçili koordinat için iklim hücresi döndürmedi.');
  }

  const values = cells.map((cell) => Number(cell.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    success: true,
    variableLabel: climateVariableLabel(variable),
    unit: climateUnit(variable),
    period: {
      start: isoDate(start),
      end: isoDate(end),
    },
    cells,
    stats: {
      min,
      max,
      average,
      validCellCount: cells.length,
    },
  };
}

function readRequestedUnifiedSection(): UnifiedMapSection | null {
  try {
    const value = window.sessionStorage.getItem(
      'tarlapusula:unified-map-section',
    );

    window.sessionStorage.removeItem(
      'tarlapusula:unified-map-section',
    );

    if (
      value === 'vegetation' ||
      value === 'radar' ||
      value === 'soil' ||
      value === 'climate' ||
      value === 'observations'
    ) {
      return value;
    }
  } catch {
    // sessionStorage kullanılamazsa initialSection devam eder.
  }

  return null;
}

export default function UnifiedMapScreen({
  fields,
  selectedFieldId = '',
  initialSection = 'vegetation',
  onFieldChange = () => undefined,
  onBack,
}: Props) {
  const safeFields = Array.isArray(fields) ? fields : [];
  const [fieldId, setFieldId] = useState(selectedFieldId || String(safeFields[0]?.id ?? ''));
  const requestedSectionRef = useRef<UnifiedMapSection | null>(
    readRequestedUnifiedSection(),
  );

  const [section, setSection] = useState<UnifiedMapSection>(() => {
    return requestedSectionRef.current ?? initialSection;
  });
  const [periodDays, setPeriodDays] = useState(30);
  const [ndviView, setNdviView] = useState<'ndvi' | 'trueColor'>('ndvi');
  const [radarMode, setRadarMode] = useState<Sentinel1RadarMode>('composite');
  const [soilProperty, setSoilProperty] = useState<SoilGridsPropertyKey>('phh2o');
  const [soilDepth, setSoilDepth] = useState<SoilGridsDepth>('0-5cm');
  const [climateVariable, setClimateVariable] = useState<Era5MapVariable>('soil_moisture_0_to_7cm');

  const [ndvi, setNdvi] = useState<SatelliteHealthResult | null>(null);
  const [ndviState, setNdviState] = useState<LoadState>('idle');
  const [radar, setRadar] = useState<Sentinel1RadarResponse | null>(null);
  const [radarState, setRadarState] = useState<LoadState>('idle');
  const [soil, setSoil] = useState<SoilGridsProfile | null>(null);
  const [soilState, setSoilState] = useState<LoadState>('idle');
  const [climate, setClimate] = useState<Era5MapResponse | null>(null);
  const [climateState, setClimateState] = useState<LoadState>('idle');
  const [biodiversity, setBiodiversity] = useState<FieldBiodiversityContextResponse | null>(null);
  const [bioState, setBioState] = useState<LoadState>('idle');
  const [layerError, setLayerError] = useState('');

  const [aiState, setAiState] = useState<LoadState>('idle');
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<UnifiedMapAiResult | null>(null);
  const aiRequestRef = useRef(0);

  const selectedField = useMemo(
    () => safeFields.find((field) => String(field.id) === String(fieldId)) ?? safeFields[0] ?? null,
    [safeFields, fieldId],
  );
  const coords = useMemo(() => fieldCoordinates(selectedField), [selectedField]);
  const parcelBounds = useMemo(() => parcelBoundsFromField(selectedField), [selectedField]);
  const meta = SECTION_META[section];

  useEffect(() => {
    if (selectedFieldId) setFieldId(String(selectedFieldId));
  }, [selectedFieldId]);

  useEffect(() => {
    // If HomeScreen opened a specific layer, keep it.
    // Do not immediately overwrite it with initialSection='vegetation'.
    if (requestedSectionRef.current) {
      setSection(requestedSectionRef.current);
      requestedSectionRef.current = null;
      return;
    }

    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setAiResult(null);
    setAiState('idle');
    setAiError('');
    setRadar(null);
    setRadarState('idle');
  }, [fieldId]);

  useEffect(() => {
    setRadar(null);
    setRadarState('idle');
  }, [radarMode, periodDays]);

  useEffect(() => {
    setClimate(null);
    setClimateState('idle');
  }, [climateVariable, periodDays, fieldId]);

  const loadNdvi = async (force = false) => {
    if (!selectedField?.parcelGeometry) throw new Error('NDVI için gerçek parsel sınırı bulunamadı.');
    if (!force && ndvi) return ndvi;
    setNdviState('loading');
    try {
      const result = await analyzeFieldSatellite(selectedField.parcelGeometry);
      setNdvi(result);
      setNdviState('ready');
      return result;
    } catch (error) {
      setNdviState('error');
      throw error;
    }
  };

  const loadRadar = async (force = false) => {
    if (!coords) throw new Error('Radar için tarla koordinatı bulunamadı.');
    if (!force && radar && radar.mode === radarMode && radar.timeRange.days === periodDays) return radar;
    setRadarState('loading');
    try {
      const result = await fetchSentinel1Radar(coords.latitude, coords.longitude, {
        mode: radarMode,
        days: periodDays,
        radiusKm: 1,
      });
      setRadar(result);
      setRadarState('ready');
      return result;
    } catch (error) {
      setRadarState('error');
      throw error;
    }
  };

  const loadSoil = async (force = false) => {
    if (!coords) throw new Error('Toprak katmanı için tarla koordinatı bulunamadı.');
    if (!force && soil) return soil;
    setSoilState('loading');
    try {
      const result = await fetchSoilGridsProfile(coords.latitude, coords.longitude, { forceRefresh: force });
      setSoil(result);
      setSoilState('ready');
      return result;
    } catch (error) {
      setSoilState('error');
      throw error;
    }
  };

  const loadClimate = async (force = false) => {
    if (!coords) {
      throw new Error('İklim katmanı için tarla koordinatı bulunamadı.');
    }

    if (!force && climate) return climate;

    setClimateState('loading');

    let edgeError: unknown = null;

    // 1) Prefer the deployed Supabase function when available.
    if (supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('era5-map', {
          body: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            variable: climateVariable,
            days: periodDays,
            gridRadius: 2,
          },
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || 'ERA5 haritası alınamadı.');
        }

        const result = data as Era5MapResponse;
        setClimate(result);
        setClimateState('ready');
        return result;
      } catch (error) {
        edgeError = error;
        console.warn(
          'era5-map Edge Function kullanılamadı; Open-Meteo fallback deneniyor:',
          error,
        );
      }
    }

    // 2) Fallback: Open-Meteo historical/reanalysis data directly from browser.
    // This keeps the climate layer functional even if era5-map is missing,
    // undeployed, sleeping or has a temporary CORS/network problem.
    try {
      const result = await fetchClimateOpenMeteoGrid(
        coords.latitude,
        coords.longitude,
        climateVariable,
        periodDays,
        2,
      );

      setClimate(result);
      setClimateState('ready');
      return result;
    } catch (fallbackError) {
      setClimateState('error');

      const edgeMessage =
        edgeError instanceof Error ? edgeError.message : '';

      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : 'İklim verisi alınamadı.';

      throw new Error(
        edgeMessage
          ? `${fallbackMessage} (Edge Function da kullanılamadı: ${edgeMessage})`
          : fallbackMessage,
      );
    }
  };

  const loadBiodiversity = async (force = false) => {
    if (!coords) throw new Error('Gözlemler için tarla koordinatı bulunamadı.');
    if (!force && biodiversity) return biodiversity;
    setBioState('loading');
    try {
      const result = await fetchFieldBiodiversityContext(coords.latitude, coords.longitude, {
        radiusKm: 25,
        lookbackYears: 5,
        cropName: selectedField?.crop,
      });
      setBiodiversity(result);
      setBioState('ready');
      return result;
    } catch (error) {
      setBioState('error');
      throw error;
    }
  };

  const loadActive = async (force = false) => {
    setLayerError('');
    try {
      if (section === 'vegetation') await loadNdvi(force);
      if (section === 'radar') await loadRadar(force);
      if (section === 'soil') await loadSoil(force);
      if (section === 'climate') await loadClimate(force);
      if (section === 'observations') await loadBiodiversity(force);
    } catch (error) {
      setLayerError(error instanceof Error ? error.message : 'Harita katmanı alınamadı.');
    }
  };

  useEffect(() => {
    void loadActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, fieldId, radarMode, soilProperty, soilDepth, climateVariable, periodDays]);

  const runPusula = async () => {
    const requestId = ++aiRequestRef.current;
    setAiState('loading');
    setAiError('');

    try {
      const [ndviResult, radarResult, soilResult, climateResult, bioResult] = await Promise.allSettled([
        loadNdvi(false),
        loadRadar(false),
        loadSoil(false),
        loadClimate(false),
        loadBiodiversity(false),
      ]);

      const ndviData = ndviResult.status === 'fulfilled' ? ndviResult.value : null;
      const radarData = radarResult.status === 'fulfilled' ? radarResult.value : null;
      const soilData = soilResult.status === 'fulfilled' ? soilResult.value : null;
      const climateData = climateResult.status === 'fulfilled' ? climateResult.value : null;
      const bioData = bioResult.status === 'fulfilled' ? bioResult.value : null;

      let radarVision: Sentinel1AiInterpretation | null = null;
      if (radarData?.imageDataUrl) {
        try {
          radarVision = await interpretSentinel1Image({
            imageDataUrl: radarData.imageDataUrl,
            fieldId: String(selectedField?.id ?? ''),
            fieldName: selectedField?.name,
            crop: selectedField?.crop,
            modeKey: radarMode,
            modeLabel: RADAR_OPTIONS.find((item) => item.value === radarMode)?.label ?? 'Radar',
            days: periodDays,
            bbox: radarData.bbox,
            timeRange: radarData.timeRange,
            sourceGeneratedAt: radarData.generatedAt,
          });
        } catch {
          radarVision = null;
        }
      }

      const activeLayer = unifiedAiActiveLayer(section, radarMode);
      const activeLayerLabel = layerUiMeta(
        section,
        ndviView,
        radarMode,
        soilProperty,
        climateVariable,
      ).title;

      const result = await interpretUnifiedMap({
        fieldId: String(selectedField?.id ?? ''),
        fieldName: selectedField?.name,
        crop: selectedField?.crop,
        periodDays,
        activeLayer,
        activeLayerLabel,
        context: {
          ndvi: ndviData
            ? {
                date: ndviData.latestImageDate,
                average: ndviData.ndviAverage,
                min: ndviData.ndviMin,
                max: ndviData.ndviMax,
                healthyPercent: ndviData.healthyPercent,
                warningPercent: ndviData.warningPercent,
                stressedPercent: ndviData.stressedPercent,
                status: ndviData.status,
                summary: ndviData.summary,
              }
            : null,
          radar: radarData
            ? {
                mode: radarMode,
                period: radarData.timeRange,
                visualInterpretation: radarVision
                  ? {
                      status: radarVision.status,
                      summary: radarVision.summary,
                      observedAreas: radarVision.observedAreas,
                      confidence: radarVision.confidence,
                    }
                  : null,
              }
            : null,
          soil: soilData
            ? {
                ph: soilData.properties.ph.topsoil0To30,
                organicCarbon: soilData.properties.organicCarbon.topsoil0To30,
                clay: soilData.texture.clayPercent,
                sand: soilData.texture.sandPercent,
                silt: soilData.texture.siltPercent,
                resolutionMeters: soilData.spatialResolutionMeters,
              }
            : null,
          climate: climateData
            ? {
                variable: climateVariable,
                variableLabel: climateData.variableLabel,
                average: climateData.stats?.average,
                min: climateData.stats?.min,
                max: climateData.stats?.max,
                unit: climateData.unit,
                period: climateData.period,
              }
            : null,
          biodiversity: bioData
            ? {
                radiusKm: bioData.radiusKm,
                lookbackYears: bioData.lookbackYears,
                totalObservations: bioData.summary.totalObservations,
                distinctPestCandidates: bioData.summary.distinctPestCandidates,
                nearestDistanceKm: bioData.summary.nearestDistanceKm,
                newestObservationAt: bioData.summary.newestObservationAt,
                observations: bioData.observations.slice(0, 8).map((item) => ({
                  label: item.commonLabelTr,
                  scientificName: item.scientificName,
                  distanceKm: item.distanceKm,
                  observedAt: item.observedAt,
                })),
              }
            : null,
        },
      });

      if (requestId !== aiRequestRef.current) return;
      setAiResult(result);
      setAiState('ready');
    } catch (error) {
      if (requestId !== aiRequestRef.current) return;
      setAiResult(null);
      setAiState('error');
      setAiError(error instanceof Error ? error.message : 'Pusula birleşik yorum oluşturamadı.');
    }
  };

  const currentState =
    section === 'vegetation'
      ? ndviState
      : section === 'radar'
        ? radarState
        : section === 'soil'
          ? soilState
          : section === 'climate'
            ? climateState
            : bioState;

  const renderVisual = () => {
    if (currentState === 'loading') return <div style={styles.emptyStage}>Harita katmanı hazırlanıyor…</div>;
    if (layerError) return <div style={{ ...styles.emptyStage, color: '#e7a89c' }}>{layerError}</div>;

    if (section === 'vegetation') {
      return ndvi ? (
        <VegetationGeoMap
          field={selectedField}
          ndvi={ndvi}
          view={ndviView}
        />
      ) : (
        <div style={styles.emptyStage}>Uydu görüntüsü bulunamadı.</div>
      );
    }

    if (section === 'radar') {
      return radar?.imageDataUrl ? (
        <RadarGeoMap field={selectedField} radar={radar} mode={radarMode} />
      ) : (
        <div style={styles.emptyStage}>Radar görüntüsü bulunamadı.</div>
      );
    }

    if (section === 'soil') {
      if (!selectedField) {
        return <div style={styles.emptyStage}>Tarla bulunamadı.</div>;
      }

      return (
        <SoilGeoMap
          field={selectedField}
          property={soilProperty}
          depth={soilDepth}
        />
      );
    }

    if (section === 'climate') {
      if (!selectedField) {
        return <div style={styles.emptyStage}>Tarla bulunamadı.</div>;
      }

      return (
        <ClimateGeoMap
          field={selectedField}
          result={climate}
          variable={climateVariable}
        />
      );
    }

    if (coords && biodiversity) {
      return (
        <GbifObservationMap
          centerLatitude={coords.latitude}
          centerLongitude={coords.longitude}
          radiusKm={biodiversity.radiusKm}
          observations={biodiversity.observations}
          height={520}
        />
      );
    }

    return <div style={styles.emptyStage}>Yakın çevre gözlemleri hazırlanıyor…</div>;
  };

  const renderStageLegend = () => {
    if (section === 'vegetation' && ndviView === 'ndvi') {
      return (
        <MapMeaningLegend
          config={{
            title: 'Bitki Sağlığı',
            colors: [NDVI_PALETTE.weak, NDVI_PALETTE.medium, NDVI_PALETTE.good],
            labels: ['Zayıf', 'Orta', 'İyi'],
            note: 'Kırmızıdan yeşile geçiş, bitki sağlığının göreli olarak iyileştiğini gösterir.',
          }}
        />
      );
    }

    if (section === 'radar') {
      return <MapMeaningLegend config={radarLegend(radarMode)} />;
    }

    if (section === 'soil') {
      return <MapMeaningLegend config={soilLegend(soilProperty)} />;
    }

    if (section === 'climate') {
      return <MapMeaningLegend config={climateLegend(climateVariable)} />;
    }

    return null;
  };

  const sourceCount = [ndvi, radar, soil, climate, biodiversity].filter(Boolean).length;
  const activeGroup = mapGroupFor(section, climateVariable);
  const layerUi = layerUiMeta(section, ndviView, radarMode, soilProperty, climateVariable);
  const ndviAverageForScore = finite(ndvi?.ndviAverage);
  const fieldHealthScore =
    ndviAverageForScore === null
      ? null
      : Math.round(Math.max(0, Math.min(1, ndviAverageForScore)) * 100);
  const fieldHealthLabel =
    fieldHealthScore === null
      ? 'Veri bekleniyor'
      : fieldHealthScore >= 65
        ? 'İyi'
        : fieldHealthScore >= 40
          ? 'Takip edilmeli'
          : 'Kontrol gerekli';

  const openGroup = (group: MapGroup) => {
    if (group === 'vegetation') {
      setSection('vegetation');
      setNdviView('ndvi');
      return;
    }

    if (group === 'water') {
      setClimateVariable('soil_moisture_0_to_7cm');
      setSection('climate');
      return;
    }

    if (group === 'soil') {
      setSection('soil');
      return;
    }

    setSection('observations');
  };

  return (
    <div className="tp-unified-map-page" style={styles.page}>
      <style>{`
        .tp-unified-map-page .maplibregl-ctrl-top-right{
          top:112px;
          right:10px;
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:8px;
        }
        .tp-unified-map-page .maplibregl-ctrl-top-right .maplibregl-ctrl{
          margin:0!important;
        }
        .tp-unified-map-page .maplibregl-ctrl-group:not(.tp-map-compass){
          overflow:hidden;
          border:1px solid rgba(34,197,94,.32)!important;
          border-radius:12px!important;
          background:rgba(4,13,6,.88)!important;
          box-shadow:0 10px 24px rgba(0,0,0,.28),0 0 16px rgba(34,197,94,.08)!important;
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
        }
        .tp-unified-map-page .maplibregl-ctrl-group:not(.tp-map-compass) button{
          width:38px!important;
          height:38px!important;
          background:transparent!important;
          color:#d9fbe4!important;
        }
        .tp-unified-map-page .maplibregl-ctrl-group:not(.tp-map-compass) button + button{
          border-top:1px solid rgba(34,197,94,.16)!important;
        }
        .tp-unified-map-page .maplibregl-ctrl-icon{
          filter:invert(92%) sepia(14%) saturate(410%) hue-rotate(84deg) brightness(105%);
          opacity:.88;
        }
        .tp-unified-map-page .maplibregl-canvas{outline:none;}
        @media (max-width:760px){
          .tp-unified-map-page .maplibregl-ctrl-top-right{top:124px;right:8px;}
        }
      `}</style>

      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.back}>←</button>
        <div style={styles.headerCopy}>
          <div style={styles.eyebrow}>UYDULARIM / TARLA KONTROLÜ</div>
          <h1 style={styles.pageTitle}>
            {selectedField?.crop ? `${selectedField.crop} • Uydu Analizi` : 'Uydu Analizi'}
          </h1>
          <div style={styles.headerSub}>{selectedField?.name ?? 'Seçili tarla'}</div>
        </div>

        <div style={styles.healthScoreCard}>
          <span style={styles.healthScoreLabel}>TARLA SAĞLIĞI</span>
          <div style={styles.healthScoreRow}>
            <strong style={styles.healthScoreValue}>
              {fieldHealthScore === null ? '—' : `${fieldHealthScore}/100`}
            </strong>
            <span style={styles.healthScoreDot} />
          </div>
          <small style={styles.healthScoreHint}>{fieldHealthLabel} · NDVI tabanlı</small>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.contextBar}>
          <label style={styles.contextControl}>
            <span style={styles.controlLabel}>Tarla</span>
            <select
              style={styles.contextSelect}
              value={String(selectedField?.id ?? '')}
              onChange={(event) => {
                setFieldId(event.target.value);
                onFieldChange(event.target.value);
              }}
            >
              {safeFields.map((field) => (
                <option key={String(field.id)} value={String(field.id)}>
                  {field.name} — {field.crop}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.contextControl}>
            <span style={styles.controlLabel}>Dönem</span>
            <select
              style={styles.contextSelectSmall}
              value={periodDays}
              onChange={(event) => setPeriodDays(Number(event.target.value))}
            >
              <option value={7}>Son 7 gün</option>
              <option value={14}>Son 14 gün</option>
              <option value={30}>Son 30 gün</option>
              <option value={45}>Son 45 gün</option>
            </select>
          </label>

          <button type="button" style={styles.refresh} onClick={() => void loadActive(true)}>
            ↻ Yenile
          </button>
        </section>

        <section style={styles.layerPanel}>
          <div style={styles.groupTabs}>
            {MAP_GROUPS.map((group) => {
              const isActive = group.key === activeGroup;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => openGroup(group.key)}
                  style={{
                    ...styles.groupTab,
                    ...(isActive ? styles.groupTabActive : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.groupIcon,
                      ...(isActive ? styles.groupIconActive : {}),
                    }}
                  >
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                </button>
              );
            })}
          </div>

          <div style={styles.layerChipRow}>
            {activeGroup === 'vegetation' && (
              <>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'vegetation' && ndviView === 'ndvi' ? styles.layerChipActive : {}) }}
                  onClick={() => {
                    setSection('vegetation');
                    setNdviView('ndvi');
                  }}
                >
                  NDVI
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'vegetation' && ndviView === 'trueColor' ? styles.layerChipActive : {}) }}
                  onClick={() => {
                    setSection('vegetation');
                    setNdviView('trueColor');
                  }}
                >
                  Gerçek Görüntü
                </button>
                {FUTURE_VEGETATION_LAYERS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    title={`${label} veri servisi bağlandığında aktif olacak.`}
                    style={{ ...styles.layerChip, ...styles.layerChipDisabled }}
                  >
                    {label}
                  </button>
                ))}
              </>
            )}

            {activeGroup === 'water' && (
              <>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'climate' && climateVariable === 'soil_moisture_0_to_7cm' ? styles.layerChipActiveCyan : {}) }}
                  onClick={() => {
                    setClimateVariable('soil_moisture_0_to_7cm');
                    setSection('climate');
                  }}
                >
                  Yüzey Nemi
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'climate' && climateVariable === 'soil_moisture_7_to_28cm' ? styles.layerChipActiveCyan : {}) }}
                  onClick={() => {
                    setClimateVariable('soil_moisture_7_to_28cm');
                    setSection('climate');
                  }}
                >
                  Kök Bölgesi Nemi
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'radar' && radarMode === 'composite' ? styles.layerChipActiveCyan : {}) }}
                  onClick={() => {
                    setRadarMode('composite');
                    setSection('radar');
                  }}
                >
                  Radar Genel
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'radar' && radarMode === 'vv' ? styles.layerChipActiveCyan : {}) }}
                  onClick={() => {
                    setRadarMode('vv');
                    setSection('radar');
                  }}
                >
                  Nemli Alanlar
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'radar' && radarMode === 'water' ? styles.layerChipActiveCyan : {}) }}
                  onClick={() => {
                    setRadarMode('water');
                    setSection('radar');
                  }}
                >
                  Su Birikimi
                </button>
              </>
            )}

            {activeGroup === 'soil' && (
              <>
                {SOIL_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    style={{ ...styles.layerChip, ...(section === 'soil' && soilProperty === item.value ? styles.layerChipActiveAmber : {}) }}
                    onClick={() => {
                      setSoilProperty(item.value);
                      setSection('soil');
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                <select
                  style={styles.depthSelect}
                  value={soilDepth}
                  onChange={(event) => setSoilDepth(event.target.value as SoilGridsDepth)}
                >
                  <option value="0-5cm">0–5 cm</option>
                  <option value="5-15cm">5–15 cm</option>
                  <option value="15-30cm">15–30 cm</option>
                  <option value="30-60cm">30–60 cm</option>
                </select>
              </>
            )}

            {activeGroup === 'risk' && (
              <>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'observations' ? styles.layerChipActiveCrimson : {}) }}
                  onClick={() => setSection('observations')}
                >
                  Zararlı & Tür
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'climate' && climateVariable === 'temperature_2m' ? styles.layerChipActiveCrimson : {}) }}
                  onClick={() => {
                    setClimateVariable('temperature_2m');
                    setSection('climate');
                  }}
                >
                  Hava Sıcaklığı
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'climate' && climateVariable === 'soil_temperature_0_to_7cm' ? styles.layerChipActiveCrimson : {}) }}
                  onClick={() => {
                    setClimateVariable('soil_temperature_0_to_7cm');
                    setSection('climate');
                  }}
                >
                  Toprak Sıcaklığı
                </button>
                <button
                  type="button"
                  style={{ ...styles.layerChip, ...(section === 'climate' && climateVariable === 'precipitation' ? styles.layerChipActiveCrimson : {}) }}
                  onClick={() => {
                    setClimateVariable('precipitation');
                    setSection('climate');
                  }}
                >
                  Yağış
                </button>
              </>
            )}
          </div>
        </section>

        <section style={styles.stageCard}>
          <div style={styles.stageHeader}>
            <div>
              <div style={styles.eyebrow}>{layerUi.source.toUpperCase()}</div>
              <strong style={styles.stageTitle}>
                {selectedField?.name ?? 'Tarla'} · {selectedField?.crop ?? ''}
              </strong>
            </div>
            <span style={styles.sourceCount}>{sourceCount}/5 veri kaynağı hazır</span>
          </div>

          <div style={styles.stage}>
            {renderVisual()}

            <div style={styles.mapInfoPanel}>
              <div style={styles.mapInfoIcon}>{layerUi.icon}</div>
              <div style={styles.mapInfoCopy}>
                <strong style={styles.mapInfoTitle}>{layerUi.title}</strong>
                <p style={styles.mapInfoText}>{layerUi.description}</p>
                <span style={styles.mapInfoSource}>{layerUi.source}</span>
              </div>
            </div>

            <div style={styles.legendDock}>
              {renderStageLegend()}

              {section === 'vegetation' && ndviView === 'ndvi' && ndvi && (
                <div style={styles.parcelStatusLegend}>
                  <div style={styles.parcelStatusTitle}>PARSEL DURUMU</div>
                  <div style={styles.parcelStatusRow}>
                    <i style={{ ...styles.parcelStatusDot, background: '#22c55e' }} />
                    <span>İyi</span>
                    <strong>{ndvi.healthyPercent != null ? `%${Math.round(Number(ndvi.healthyPercent))}` : '—'}</strong>
                  </div>
                  <div style={styles.parcelStatusRow}>
                    <i style={{ ...styles.parcelStatusDot, background: '#f59e0b' }} />
                    <span>Takip</span>
                    <strong>{ndvi.warningPercent != null ? `%${Math.round(Number(ndvi.warningPercent))}` : '—'}</strong>
                  </div>
                  <div style={styles.parcelStatusRow}>
                    <i style={{ ...styles.parcelStatusDot, background: '#ef4444' }} />
                    <span>Zayıf</span>
                    <strong>{ndvi.stressedPercent != null ? `%${Math.round(Number(ndvi.stressedPercent))}` : '—'}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section style={styles.metrics}>
          {section === 'vegetation' && (
            <>
              <Metric label="ORT. NDVI" value={ndvi?.ndviAverage} />
              <Metric label="EN DÜŞÜK" value={ndvi?.ndviMin} />
              <Metric label="EN YÜKSEK" value={ndvi?.ndviMax} />
              <Metric label="GÖRÜNTÜ TARİHİ" value={ndvi?.latestImageDate ?? '—'} />
            </>
          )}
          {section === 'radar' && (
            <>
              <Metric label="MOD" value={RADAR_OPTIONS.find((x) => x.value === radarMode)?.label ?? 'Radar'} />
              <Metric label="DÖNEM" value={`${periodDays} gün`} />
              <Metric label="KAYNAK" value="Sentinel-1" />
              <Metric label="ÜRETİLDİ" value={radar?.generatedAt ? new Date(radar.generatedAt).toLocaleDateString('tr-TR') : '—'} />
            </>
          )}
          {section === 'soil' && (
            <>
              <Metric label="pH 0–30 CM" value={soil?.properties.ph.topsoil0To30} />
              <Metric label="ORGANİK KARBON" value={soil?.properties.organicCarbon.topsoil0To30} />
              <Metric label="KİL" value={soil?.texture.clayPercent != null ? `${soil.texture.clayPercent}%` : '—'} />
              <Metric label="ÇÖZÜNÜRLÜK" value={soil ? `${soil.spatialResolutionMeters} m` : '—'} />
            </>
          )}
          {section === 'climate' && (
            <>
              <Metric label="ORTALAMA" value={climate?.stats?.average != null ? `${Number(climate.stats.average).toFixed(2)} ${climate.unit ?? ''}` : '—'} />
              <Metric label="EN DÜŞÜK" value={climate?.stats?.min != null ? `${Number(climate.stats.min).toFixed(2)} ${climate.unit ?? ''}` : '—'} />
              <Metric label="EN YÜKSEK" value={climate?.stats?.max != null ? `${Number(climate.stats.max).toFixed(2)} ${climate.unit ?? ''}` : '—'} />
              <Metric label="MODEL HÜCRESİ" value={climate?.stats?.validCellCount ?? '—'} />
            </>
          )}
          {section === 'observations' && (
            <>
              <Metric label="GÖZLEM" value={biodiversity?.summary.totalObservations ?? 0} />
              <Metric label="ADAY TÜR" value={biodiversity?.summary.distinctPestCandidates ?? 0} />
              <Metric label="EN YAKIN" value={biodiversity?.summary.nearestDistanceKm != null ? `${biodiversity.summary.nearestDistanceKm.toFixed(1)} km` : '—'} />
              <Metric label="ARAMA ÇAPI" value={biodiversity ? `${biodiversity.radiusKm} km` : '—'} />
            </>
          )}
        </section>

        <section style={styles.aiCard}>
          <div style={styles.aiHeader}>
            <div>
              <div style={styles.eyebrow}>PUSULA AI YORUMU</div>
              <h2 style={styles.aiTitle}>Tüm veriler birlikte ne söylüyor?</h2>
            </div>
            <button type="button" style={styles.aiButton} onClick={() => void runPusula()} disabled={aiState === 'loading'}>
              ✦ {aiState === 'loading' ? 'Pusula birleştiriyor…' : aiResult ? 'Tekrar Yorumla' : 'Pusula ile Yorumla'}
            </button>
          </div>

          {aiState === 'idle' && (
            <div style={styles.aiIdle}>Pusula; NDVI, radar, toprak, iklim ve yakın çevre gözlemlerini tek yorumda birleştirir. AI yalnızca bu düğmeye bastığında çalışır.</div>
          )}
          {aiState === 'loading' && <div style={styles.aiIdle}>5 veri kaynağı hazırlanıyor; radar görüntüsü ayrıca görsel modelle kontrol ediliyor…</div>}
          {aiState === 'error' && <div style={styles.aiError}>{aiError}</div>}
          {aiResult && (
            <div style={styles.aiResult}>
              <div style={styles.resultTop}>
                <div>
                  <strong style={styles.resultHeadline}>{aiResult.headline}</strong>
                  <p style={styles.resultSummary}>{aiResult.summary}</p>
                </div>
                <span style={styles.statusPill}>{aiResult.status === 'normal' ? 'Normal' : aiResult.status === 'dikkat' ? 'Dikkat' : 'Kontrol et'}</span>
              </div>
              <div style={styles.reasons}>
                {(aiResult.reasons ?? []).slice(0, 4).map((reason, index) => <div key={`${reason}-${index}`} style={styles.reason}>• {reason}</div>)}
              </div>
              <div style={styles.actionRow}>
                <div><span style={styles.actionLabel}>NE YAPMALISIN?</span><strong>{aiResult.action}</strong></div>
                <div style={styles.confidence}>YORUM GÜVENİ<br /><strong>{aiResult.confidence}</strong></div>
              </div>
              <div style={styles.caution}>{aiResult.caution}</div>
              {aiResult.memorySaved && <div style={styles.memory}>✓ Birleşik Pusula yorumu tarihli olarak hafızaya kaydedildi.</div>}
            </div>
          )}
        </section>

        <section style={styles.readCard}>
          <div>
            <div style={styles.eyebrow}>HARİTAYI NASIL OKUMALI?</div>
            <h3 style={styles.readTitle}>{layerUi.title}</h3>
            <p style={styles.readText}>{layerUi.description}</p>
          </div>
          <div style={styles.ruleBox}>
            <span style={styles.ruleLabel}>ANA KURAL</span>
            <strong>Tek katmana bakıp karar verme. Pusula, katmanları birlikte değerlendirir.</strong>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{String(value ?? '—')}</strong>
    </div>
  );
}

const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DISPLAY = 'Georgia, "Times New Roman", serif';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 50% -10%,rgba(34,197,94,.07),transparent 28%),#020804',
    color: '#eaf7ee',
    fontFamily: FONT,
    paddingBottom: 34,
  },
  header: {
    minHeight: 92,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 22px',
    borderBottom: '1px solid #1e3a24',
    background: 'rgba(4,13,6,.94)',
    boxShadow: '0 10px 30px rgba(0,0,0,.24)',
    backdropFilter: 'blur(18px)',
  },
  back: {
    width: 44,
    height: 44,
    flex: '0 0 auto',
    borderRadius: 14,
    border: '1px solid rgba(34,197,94,.28)',
    background: '#061308',
    color: '#d9fbe4',
    fontSize: 19,
    cursor: 'pointer',
    boxShadow: '0 0 16px rgba(34,197,94,.08),inset 0 1px rgba(255,255,255,.025)',
  },
  headerCopy: { minWidth: 0 },
  eyebrow: {
    fontSize: 9,
    fontWeight: 850,
    letterSpacing: '.16em',
    color: '#a7f3d0',
    textTransform: 'uppercase',
  },
  pageTitle: {
    margin: '3px 0 0',
    fontFamily: DISPLAY,
    fontSize: 27,
    lineHeight: 1.08,
    fontWeight: 650,
    color: '#f1f5f9',
    letterSpacing: '-.02em',
  },
  headerSub: {
    marginTop: 4,
    overflow: 'hidden',
    color: 'rgba(167,243,208,.48)',
    fontSize: 10,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  healthScoreCard: {
    marginLeft: 'auto',
    minWidth: 132,
    padding: '9px 12px',
    border: '1px solid rgba(34,197,94,.34)',
    borderRadius: 14,
    background: 'rgba(6,19,8,.84)',
    boxShadow: '0 0 18px rgba(34,197,94,.10),inset 0 1px rgba(255,255,255,.025)',
  },
  healthScoreLabel: {
    display: 'block',
    color: 'rgba(167,243,208,.55)',
    fontSize: 7.5,
    fontWeight: 850,
    letterSpacing: '.13em',
  },
  healthScoreRow: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 },
  healthScoreValue: { color: '#f1f5f9', fontSize: 18, lineHeight: 1, fontWeight: 850 },
  healthScoreDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 9px rgba(34,197,94,.8)',
  },
  healthScoreHint: {
    display: 'block',
    marginTop: 4,
    color: 'rgba(167,243,208,.46)',
    fontSize: 7.5,
  },
  main: { display: 'grid', gap: 12, paddingTop: 12 },

  contextBar: {
    margin: '0 22px',
    display: 'flex',
    alignItems: 'end',
    gap: 8,
    flexWrap: 'wrap',
  },
  contextControl: { display: 'grid', gap: 5 },
  controlLabel: {
    fontSize: 8,
    fontWeight: 850,
    letterSpacing: '.13em',
    color: 'rgba(167,243,208,.42)',
    textTransform: 'uppercase',
  },
  contextSelect: {
    minWidth: 210,
    height: 38,
    border: '1px solid #1e3a24',
    borderRadius: 11,
    padding: '0 11px',
    background: 'rgba(6,19,8,.88)',
    color: '#eaf7ee',
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 680,
    outline: 'none',
  },
  contextSelectSmall: {
    minWidth: 120,
    height: 38,
    border: '1px solid #1e3a24',
    borderRadius: 11,
    padding: '0 10px',
    background: 'rgba(6,19,8,.88)',
    color: '#eaf7ee',
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 680,
    outline: 'none',
  },
  refresh: {
    minHeight: 38,
    border: '1px solid rgba(34,197,94,.34)',
    borderRadius: 11,
    padding: '0 13px',
    background: 'linear-gradient(180deg,rgba(8,54,25,.88),rgba(5,31,14,.9))',
    color: '#c9f9d7',
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 850,
    cursor: 'pointer',
    boxShadow: '0 0 14px rgba(34,197,94,.10)',
  },

  layerPanel: {
    margin: '0 22px',
    overflow: 'hidden',
    border: '1px solid #1e3a24',
    borderRadius: 16,
    background: 'rgba(6,19,8,.82)',
    boxShadow: '0 0 18px rgba(34,197,94,.07)',
    backdropFilter: 'blur(16px)',
  },
  groupTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
    gap: 4,
    padding: 5,
    borderBottom: '1px solid rgba(30,58,36,.75)',
  },
  groupTab: {
    minHeight: 48,
    border: '1px solid transparent',
    borderRadius: 11,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    color: 'rgba(203,219,208,.48)',
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },
  groupTabActive: {
    borderColor: 'rgba(34,197,94,.42)',
    background: 'linear-gradient(180deg,rgba(16,75,35,.88),rgba(7,43,20,.92))',
    color: '#f0fff4',
    boxShadow: '0 0 18px rgba(34,197,94,.17),inset 0 1px rgba(255,255,255,.035)',
  },
  groupIcon: {
    width: 25,
    height: 25,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(30,58,36,.92)',
    borderRadius: 8,
    background: '#020804',
    color: 'rgba(167,243,208,.45)',
    fontSize: 13,
  },
  groupIconActive: {
    borderColor: 'rgba(34,197,94,.46)',
    color: '#86efac',
    boxShadow: '0 0 10px rgba(34,197,94,.20)',
  },
  layerChipRow: {
    minHeight: 47,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 8px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  layerChip: {
    minHeight: 31,
    flex: '0 0 auto',
    border: '1px solid rgba(30,58,36,.92)',
    borderRadius: 9,
    padding: '0 11px',
    background: 'rgba(2,8,4,.62)',
    color: 'rgba(203,219,208,.55)',
    fontFamily: FONT,
    fontSize: 8.7,
    fontWeight: 780,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  layerChipActive: {
    borderColor: 'rgba(34,197,94,.55)',
    background: 'linear-gradient(180deg,rgba(25,93,44,.92),rgba(9,54,25,.95))',
    color: '#f0fff4',
    boxShadow: '0 0 14px rgba(34,197,94,.22)',
  },
  layerChipActiveCyan: {
    borderColor: 'rgba(6,182,212,.58)',
    background: 'linear-gradient(180deg,rgba(8,75,88,.88),rgba(4,46,55,.94))',
    color: '#cffafe',
    boxShadow: '0 0 14px rgba(6,182,212,.18)',
  },
  layerChipActiveAmber: {
    borderColor: 'rgba(245,158,11,.56)',
    background: 'linear-gradient(180deg,rgba(100,61,8,.88),rgba(58,35,4,.94))',
    color: '#fef3c7',
    boxShadow: '0 0 14px rgba(245,158,11,.16)',
  },
  layerChipActiveCrimson: {
    borderColor: 'rgba(239,68,68,.52)',
    background: 'linear-gradient(180deg,rgba(92,31,31,.88),rgba(50,17,17,.94))',
    color: '#fee2e2',
    boxShadow: '0 0 14px rgba(239,68,68,.14)',
  },
  layerChipDisabled: {
    opacity: .28,
    cursor: 'not-allowed',
    borderStyle: 'dashed',
  },
  depthSelect: {
    minHeight: 31,
    border: '1px solid rgba(245,158,11,.30)',
    borderRadius: 9,
    padding: '0 9px',
    background: 'rgba(2,8,4,.74)',
    color: '#fde68a',
    fontFamily: FONT,
    fontSize: 8.7,
    fontWeight: 780,
  },

  stageCard: {
    margin: '0 22px',
    overflow: 'hidden',
    border: '1px solid rgba(34,197,94,.36)',
    borderRadius: 18,
    background: '#040d06',
    boxShadow: '0 0 26px rgba(34,197,94,.10),0 18px 40px rgba(0,0,0,.24)',
  },
  stageHeader: {
    minHeight: 54,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid #1e3a24',
    background: 'rgba(6,19,8,.92)',
  },
  stageTitle: { display: 'block', marginTop: 3, color: '#edf7ef', fontSize: 12, fontWeight: 780 },
  sourceCount: {
    flex: '0 0 auto',
    border: '1px solid rgba(34,197,94,.24)',
    borderRadius: 999,
    padding: '5px 8px',
    background: 'rgba(2,8,4,.56)',
    color: 'rgba(167,243,208,.50)',
    fontSize: 8,
    fontWeight: 760,
  },
  stage: { minHeight: 620, position: 'relative', background: '#020804', overflow: 'hidden' },
  stageImage: { display: 'block', width: '100%', height: 620, objectFit: 'contain', background: '#020804' },
  radarMapShell: { height: 620, position: 'relative', overflow: 'hidden', background: '#020804' },
  radarMapCanvas: { position: 'absolute', inset: 0 },
  satelliteDateBadge: {
    position: 'absolute',
    top: 15,
    right: 82,
    zIndex: 12,
    border: '1px solid rgba(34,197,94,.32)',
    borderRadius: 10,
    padding: '6px 9px',
    background: 'rgba(4,13,6,.86)',
    backdropFilter: 'blur(10px)',
    color: '#d9fbe4',
    fontSize: 8.5,
    fontWeight: 850,
    boxShadow: '0 8px 20px rgba(0,0,0,.24)',
    pointerEvents: 'none',
  },
  radarMapBadge: {
    position: 'absolute',
    top: 15,
    right: 82,
    zIndex: 12,
    display: 'grid',
    gap: 2,
    border: '1px solid rgba(34,197,94,.28)',
    borderRadius: 10,
    padding: '7px 9px',
    background: 'rgba(4,13,6,.88)',
    backdropFilter: 'blur(10px)',
    color: '#dcefe2',
    fontSize: 8.5,
  },
  radarMapHintRight: {
    position: 'absolute',
    right: 82,
    top: 61,
    zIndex: 12,
    border: '1px solid rgba(34,197,94,.18)',
    borderRadius: 9,
    padding: '6px 8px',
    background: 'rgba(4,13,6,.78)',
    backdropFilter: 'blur(8px)',
    color: 'rgba(167,243,208,.48)',
    fontSize: 8,
    maxWidth: 190,
    textAlign: 'right',
  },

  mapInfoPanel: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 75,
    width: 'min(330px,calc(100% - 112px))',
    display: 'grid',
    gridTemplateColumns: '42px minmax(0,1fr)',
    gap: 10,
    padding: '11px 12px',
    border: '1px solid rgba(34,197,94,.34)',
    borderRadius: 14,
    background: 'rgba(4,13,6,.86)',
    backdropFilter: 'blur(14px)',
    boxShadow: '0 12px 28px rgba(0,0,0,.30),0 0 18px rgba(34,197,94,.07)',
    pointerEvents: 'none',
  },
  mapInfoIcon: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(34,197,94,.40)',
    borderRadius: 12,
    background: '#020804',
    color: '#86efac',
    fontSize: 17,
    boxShadow: 'inset 0 0 12px rgba(34,197,94,.06),0 0 12px rgba(34,197,94,.10)',
  },
  mapInfoCopy: { minWidth: 0 },
  mapInfoTitle: { display: 'block', color: '#f0fff4', fontSize: 11, fontWeight: 850 },
  mapInfoText: { margin: '4px 0 0', color: 'rgba(216,235,221,.66)', fontSize: 8.5, lineHeight: 1.45 },
  mapInfoSource: { display: 'block', marginTop: 5, color: 'rgba(167,243,208,.42)', fontSize: 7.5, fontWeight: 760 },

  legendDock: {
    position: 'absolute',
    left: 15,
    bottom: 15,
    zIndex: 80,
    maxWidth: 'calc(100% - 30px)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    pointerEvents: 'none',
  },
  healthLegend: {
    position: 'relative',
    width: 220,
    border: '1px solid rgba(34,197,94,.32)',
    borderRadius: 13,
    padding: '10px 11px',
    background: 'rgba(4,13,6,.90)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 10px 28px rgba(0,0,0,.28)',
    pointerEvents: 'none',
  },
  healthLegendTitle: { fontSize: 9.5, fontWeight: 850, color: '#e8f8ed', marginBottom: 7 },
  healthLegendBar: {
    height: 8,
    borderRadius: 999,
    marginBottom: 5,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
  },
  healthLegendLabels: { display: 'flex', justifyContent: 'space-between', color: 'rgba(216,235,221,.56)', fontSize: 7.5, gap: 7, fontWeight: 720 },
  healthLegendNote: { marginTop: 6, color: 'rgba(167,243,208,.40)', fontSize: 7.2, lineHeight: 1.4 },
  parcelStatusLegend: {
    width: 126,
    border: '1px solid rgba(34,197,94,.24)',
    borderRadius: 13,
    padding: '9px 10px',
    background: 'rgba(4,13,6,.90)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 10px 28px rgba(0,0,0,.28)',
  },
  parcelStatusTitle: { marginBottom: 6, color: 'rgba(167,243,208,.48)', fontSize: 7, fontWeight: 850, letterSpacing: '.11em' },
  parcelStatusRow: {
    display: 'grid',
    gridTemplateColumns: '7px minmax(0,1fr) auto',
    alignItems: 'center',
    gap: 5,
    minHeight: 18,
    color: 'rgba(226,240,230,.66)',
    fontSize: 7.5,
  },
  parcelStatusDot: { width: 6, height: 6, borderRadius: '50%' },

  emptyStage: { height: 620, display: 'grid', placeItems: 'center', color: 'rgba(167,243,208,.46)', fontSize: 11 },
  climateCanvas: { height: 620, position: 'relative', overflow: 'hidden', background: '#071009' },
  climateBackdrop: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at center,rgba(34,197,94,.11),transparent 58%)' },
  climateCell: {
    position: 'absolute',
    transform: 'translate(-50%,-50%)',
    width: 72,
    height: 56,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(240,255,244,.24)',
    borderRadius: 8,
    color: '#f0fff4',
    fontSize: 10,
    boxShadow: '0 4px 18px rgba(0,0,0,.22)',
  },
  parcelFocus: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    border: '2px solid #86efac',
    borderRadius: 10,
    padding: '50px 70px',
    color: '#bbf7d0',
    fontSize: 9,
    fontWeight: 850,
    letterSpacing: '.12em',
    pointerEvents: 'none',
    boxShadow: '0 0 18px rgba(34,197,94,.15)',
  },

  metrics: { margin: '0 22px', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 },
  metric: {
    minHeight: 72,
    display: 'grid',
    alignContent: 'center',
    gap: 5,
    border: '1px solid #1e3a24',
    borderRadius: 13,
    padding: '10px 12px',
    background: 'rgba(6,19,8,.78)',
    boxShadow: '0 0 14px rgba(34,197,94,.04)',
  },
  metricLabel: { color: 'rgba(167,243,208,.38)', fontSize: 7.5, fontWeight: 850, letterSpacing: '.11em' },
  metricValue: { color: '#eaf7ee', fontSize: 12 },

  aiCard: {
    margin: '0 22px',
    border: '1px solid rgba(34,197,94,.28)',
    borderRadius: 18,
    padding: 16,
    background: 'linear-gradient(145deg,rgba(6,25,11,.92),rgba(3,14,6,.94))',
    boxShadow: '0 0 18px rgba(34,197,94,.06)',
  },
  aiHeader: { display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'flex-start', flexWrap: 'wrap' },
  aiTitle: { margin: '4px 0 0', fontFamily: DISPLAY, fontSize: 21, fontWeight: 650, color: '#f1f5f9' },
  aiButton: {
    minHeight: 39,
    border: '1px solid rgba(34,197,94,.44)',
    borderRadius: 12,
    padding: '0 14px',
    background: 'linear-gradient(180deg,rgba(16,91,40,.92),rgba(7,51,22,.94))',
    color: '#ecfdf5',
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 850,
    cursor: 'pointer',
    boxShadow: '0 0 16px rgba(34,197,94,.14)',
  },
  aiIdle: { marginTop: 15, border: '1px solid #1e3a24', borderRadius: 12, padding: 12, color: 'rgba(216,235,221,.62)', fontSize: 11, lineHeight: 1.55 },
  aiError: { marginTop: 15, border: '1px solid rgba(239,68,68,.35)', borderRadius: 12, padding: 12, background: 'rgba(66,17,17,.45)', color: '#fecaca', fontSize: 11 },
  aiResult: { display: 'grid', gap: 11, marginTop: 15 },
  resultTop: { display: 'flex', justifyContent: 'space-between', gap: 14 },
  resultHeadline: { fontSize: 15, color: '#f0fff4' },
  resultSummary: { margin: '6px 0 0', color: 'rgba(216,235,221,.72)', fontSize: 12, lineHeight: 1.55 },
  statusPill: { height: 'fit-content', border: '1px solid rgba(34,197,94,.34)', borderRadius: 999, padding: '6px 10px', color: '#bbf7d0', fontSize: 9, fontWeight: 850 },
  reasons: { display: 'grid', gap: 6 },
  reason: { border: '1px solid #1e3a24', borderRadius: 10, padding: '8px 10px', background: 'rgba(2,8,4,.52)', color: 'rgba(216,235,221,.64)', fontSize: 10 },
  actionRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', border: '1px solid rgba(34,197,94,.28)', borderRadius: 13, background: 'rgba(7,38,17,.58)', padding: '11px 13px', color: '#f0fff4', fontSize: 12 },
  actionLabel: { marginRight: 5, color: 'rgba(167,243,208,.48)', fontSize: 8, fontWeight: 850, letterSpacing: '.08em' },
  confidence: { minWidth: 112, paddingLeft: 14, borderLeft: '1px solid rgba(34,197,94,.24)', textAlign: 'center', fontSize: 8, color: 'rgba(167,243,208,.48)' },
  caution: { color: 'rgba(167,243,208,.42)', fontSize: 9, lineHeight: 1.5 },
  memory: { border: '1px solid rgba(34,197,94,.24)', borderRadius: 10, padding: '8px 10px', color: '#bbf7d0', fontSize: 9 },

  readCard: {
    margin: '0 22px',
    display: 'grid',
    gridTemplateColumns: '1fr minmax(220px,280px)',
    gap: 16,
    border: '1px solid #1e3a24',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(6,19,8,.72)',
  },
  readTitle: { margin: '5px 0 0', fontFamily: DISPLAY, fontSize: 18, color: '#f1f5f9' },
  readText: { margin: '6px 0 0', color: 'rgba(216,235,221,.62)', fontSize: 11, lineHeight: 1.6 },
  ruleBox: { display: 'grid', alignContent: 'center', gap: 7, border: '1px solid rgba(34,197,94,.26)', borderRadius: 13, padding: 13, background: 'rgba(7,38,17,.44)', color: '#eaf7ee', fontSize: 12, lineHeight: 1.4 },
  ruleLabel: { color: '#a7f3d0', fontSize: 8, fontWeight: 850, letterSpacing: '.12em' },
};
