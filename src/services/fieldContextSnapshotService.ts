import { supabase } from '../supabaseClient';
import { analyzeFieldSatellite } from '../lib/satelliteService';
import { fetchFieldNdviTimeSeries } from '../features/satellite/services/ndviTimeSeries.service';
import { fetchSentinel1Radar } from './sentinel1Service';
import { fetchSoilGridsProfile } from './soilGridsService';
import {
  interpretUnifiedMap,
  type UnifiedMapAiResult,
  type UnifiedMapActiveLayer,
} from './unifiedMapAiService';
import { analyzeSpatialFieldImages } from './spatialFieldReader';
import { getFieldPhenologySnapshot } from '../features/phenology/services/fieldPhenologySnapshot.service';
import { applyPhenologyToMapAnalysis } from '../features/phenology/services/phenologyPusulaGuard.service';


const HOME_PUSULA_RESULT_CACHE_PREFIX = 'tp_home_pusula_result_v2';
const HOME_PUSULA_RESULT_MEMORY = new Map<string, FieldContextRefreshResult>();

function homePusulaContextKey(
  fieldId: string,
  activeLayer: UnifiedMapActiveLayer,
  activeLayerContext: ActiveLayerContext,
) {
  const contextKey = JSON.stringify({
    property: activeLayerContext?.property ?? null,
    depth: activeLayerContext?.depth ?? null,
    climateLayer: activeLayerContext?.climateLayer ?? null,
    climateDepth: activeLayerContext?.climateDepth ?? null,
    variable: activeLayerContext?.variable ?? null,
    ndviSceneId: activeLayerContext?.ndviZonalStats?.sceneId ?? null,
    ndviDatetime: activeLayerContext?.ndviZonalStats?.datetime ?? null,
    ndviEngine: activeLayerContext?.ndviZonalStats?.engine ?? null,
    ndviMean:
      activeLayerContext?.ndviZonalStats?.mean != null
        ? Number(activeLayerContext.ndviZonalStats.mean).toFixed(4)
        : null,
    ndviHealthy:
      activeLayerContext?.ndviZonalStats?.healthyPercent != null
        ? Math.round(Number(activeLayerContext.ndviZonalStats.healthyPercent))
        : null,
    ndviStressed:
      activeLayerContext?.ndviZonalStats?.stressedPercent != null
        ? Math.round(Number(activeLayerContext.ndviZonalStats.stressedPercent))
        : null,
    ndviRelative:
      activeLayerContext?.ndviZonalStats?.relativeZones
        ?.map((zone) =>
          `${zone.area}:${zone.status}:${Number(zone.mean).toFixed(3)}:${Number(zone.deltaFromFieldMean).toFixed(3)}`,
        )
        .join('|') ?? null,
  });

  return `${HOME_PUSULA_RESULT_CACHE_PREFIX}:${fieldId}:${activeLayer}:${contextKey}`;
}

function readHomePusulaCachedResult(
  key: string,
): FieldContextRefreshResult | null {
  const memory = HOME_PUSULA_RESULT_MEMORY.get(key);
  if (memory) return memory;

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as FieldContextRefreshResult;

    if (!parsed?.activeLayer || !parsed?.analysis) {
      return null;
    }

    HOME_PUSULA_RESULT_MEMORY.set(key, parsed);
    return parsed;
  } catch (error) {
    console.warn('Pusula önbelleği okunamadı:', error);
    return null;
  }
}

function saveHomePusulaCachedResult(
  key: string,
  result: FieldContextRefreshResult,
) {
  HOME_PUSULA_RESULT_MEMORY.set(key, result);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(result));
  } catch (error) {
    console.warn('Pusula önbelleği kaydedilemedi:', error);
  }
}

type FieldLike = {
  id: string | number;
  name?: string | null;
  crop?: string | null;
  parcelGeometry?: any;
  parcelCentroidLat?: number | string | null;
  parcelCentroidLng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type SourceStatus = 'ready' | 'error';

export type ClimateVariable =
  | 'soil_moisture_0_to_7cm'
  | 'soil_moisture_7_to_28cm'
  | 'soil_moisture_28_to_100cm'
  | 'soil_temperature_0_to_7cm'
  | 'soil_temperature_7_to_28cm'
  | 'temperature_2m'
  | 'precipitation'
  | 'surface_temperature'
  | 'et0_fao_evapotranspiration'
  | 'precipitation_sum_30d';

type SoilProperty =
  | 'phh2o'
  | 'soc'
  | 'clay'
  | 'sand'
  | 'silt';

type SoilDepth =
  | '0-5cm'
  | '5-15cm'
  | '15-30cm';

export type ActiveLayerContext = {
  property?: SoilProperty;
  propertyLabel?: string;

  depth?: SoilDepth;
  depthLabel?: string;

  climateLayer?: string;
  climateLayerLabel?: string;

  climateDepth?: string | null;
  climateDepthLabel?: string | null;

  variable?: ClimateVariable;

  layer?: string;

  farmerMeaning?: string;
  agriculturalUse?: string;
  interpretationGuide?: string;
  compareWith?: string;
  interpretationCaution?: string;
  sourceLabel?: string;
  spatialMode?: string | null;
  spatialVariability?: string | null;
  spatialResolutionMessage?: string | null;
  spatialInterpretationRule?: string | null;

  ndviZonalStats?: {
    source?: string | null;
    engine?: 'geoblaze' | 'native-fallback' | string | null;
    sceneId?: string | null;
    datetime?: string | null;
    cloudCover?: number | null;
    sampleCount?: number | null;
    mean?: number | null;
    median?: number | null;
    stdDev?: number | null;
    min?: number | null;
    max?: number | null;
    healthyPercent?: number | null;
    moderatePercent?: number | null;
    stressedPercent?: number | null;
    relativeThreshold?: number | null;
    relativeZones?: Array<{
      area: string;
      sampleCount: number;
      mean: number;
      deltaFromFieldMean: number;
      relativeHealth: number;
      status: 'weaker' | 'similar' | 'stronger';
    }> | null;
  } | null;
};

export type FieldContextRefreshResult = {
  snapshotId: string | null;

  sourceCount: number;

  sourceStatus: Record<
    string,
    SourceStatus
  >;

  biodiversityReady: boolean;

  activeLayer: UnifiedMapActiveLayer;

  activeLayerLabel: string;

  context: {
    ndvi: any;
    radar: any;
    soil: any;
    climate: any;
    biodiversity: null;
    phenology: any;
  };

  analysis: UnifiedMapAiResult;
};

function fieldCenter(
  field: FieldLike,
) {
  const geometry =
    field?.parcelGeometry?.geometry ??
    field?.parcelGeometry;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (
    value: any,
  ) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      Number.isFinite(
        Number(value[0]),
      ) &&
      Number.isFinite(
        Number(value[1]),
      )
    ) {
      const lng =
        Number(value[0]);

      const lat =
        Number(value[1]);

      west = Math.min(
        west,
        lng,
      );

      south = Math.min(
        south,
        lat,
      );

      east = Math.max(
        east,
        lng,
      );

      north = Math.max(
        north,
        lat,
      );

      return;
    }

    if (
      Array.isArray(value)
    ) {
      value.forEach(
        visit,
      );
    }
  };

  visit(
    geometry?.coordinates,
  );

  if (
    [
      west,
      south,
      east,
      north,
    ].every(
      Number.isFinite,
    )
  ) {
    return {
      latitude:
        (south + north) /
        2,

      longitude:
        (west + east) /
        2,
    };
  }

  const latitude =
    Number(
      field?.parcelCentroidLat ??
        field?.latitude,
    );

  const longitude =
    Number(
      field?.parcelCentroidLng ??
        field?.longitude,
    );

  if (
    !Number.isFinite(
      latitude,
    ) ||
    !Number.isFinite(
      longitude,
    )
  ) {
    throw new Error(
      'Tarla koordinatı bulunamadı.',
    );
  }

  return {
    latitude,
    longitude,
  };
}

function compactNdvi(
  data: any,
) {
  if (!data) {
    return null;
  }

  return {
    layer:
      'vegetation',

    layerLabel:
      'NDVI',

    source:
      data.source ??
      'Sentinel-2',

    date:
      data.latestImageDate ??
      null,

    generatedAt:
      data.generatedAt ??
      null,

    average:
      data.ndviAverage ??
      null,

    min:
      data.ndviMin ??
      null,

    max:
      data.ndviMax ??
      null,

    healthyPercent:
      data.healthyPercent ??
      null,

    warningPercent:
      data.warningPercent ??
      null,

    stressedPercent:
      data.stressedPercent ??
      null,

    status:
      data.status ??
      null,

    summary:
      data.summary ??
      null,

    recommendations:
      Array.isArray(
        data.recommendations,
      )
        ? data.recommendations.slice(
            0,
            5,
          )
        : [],
  };
}


function buildNdviRelativeSpatial(
  zonal: ActiveLayerContext['ndviZonalStats'],
) {
  const zones = Array.isArray(zonal?.relativeZones)
    ? zonal.relativeZones
    : [];

  if (!zones.length) return null;

  const threshold =
    Number.isFinite(Number(zonal?.relativeThreshold))
      ? Math.max(0.001, Number(zonal?.relativeThreshold))
      : 0.04;

  const findings = zones
    .filter(
      (zone) =>
        zone &&
        typeof zone.area === 'string' &&
        Number.isFinite(Number(zone.mean)) &&
        Number.isFinite(Number(zone.deltaFromFieldMean)),
    )
    .map((zone) => {
      const mean = Number(zone.mean);
      const delta = Number(zone.deltaFromFieldMean);
      const relativeHealth = Number.isFinite(Number(zone.relativeHealth))
        ? Math.max(0, Math.min(1, Number(zone.relativeHealth)))
        : Math.max(
            0,
            Math.min(1, 0.5 + delta / Math.max(threshold * 4, 0.000001)),
          );
      const status =
        zone.status === 'weaker' ||
        zone.status === 'stronger' ||
        zone.status === 'similar'
          ? zone.status
          : delta <= -threshold
            ? 'weaker'
            : delta >= threshold
              ? 'stronger'
              : 'similar';

      const note =
        status === 'weaker'
          ? `Bölge NDVI ortalaması parsel ortalamasından ${Math.abs(delta).toFixed(2)} daha düşük.`
          : status === 'stronger'
            ? `Bölge NDVI ortalaması parsel ortalamasından ${Math.abs(delta).toFixed(2)} daha yüksek.`
            : `Bölge NDVI ortalaması parsel ortalamasına yakın.`;

      const relativeStrength = Math.min(
        1,
        Math.abs(delta) / Math.max(threshold, 0.000001),
      );

      return {
        area: zone.area,
        direction: zone.area,
        score: status === 'weaker' ? Number(relativeStrength.toFixed(3)) : 0,
        evidence:
          status === 'weaker'
            ? ['Gerçek Sentinel-2 NDVI bölge ortalaması parsel ortalamasından düşük']
            : [],
        ndvi: {
          mean: Number(mean.toFixed(4)),
          fieldMean:
            Number.isFinite(Number(zonal?.mean))
              ? Number(Number(zonal?.mean).toFixed(4))
              : null,
          deltaFromFieldMean: Number(delta.toFixed(4)),
          relativeHealth: Number(relativeHealth.toFixed(3)),
          relativeStatus: status,
          comparisonThreshold: Number(threshold.toFixed(4)),
          sampleCount: Number(zone.sampleCount ?? 0),
          note,
        },
      };
    });

  if (!findings.length) return null;

  const weak = findings
    .filter((finding: any) => finding?.ndvi?.relativeStatus === 'weaker')
    .sort(
      (a: any, b: any) =>
        Number(a?.ndvi?.deltaFromFieldMean ?? 0) -
        Number(b?.ndvi?.deltaFromFieldMean ?? 0),
    );

  const importantArea = weak[0] ?? null;

  return {
    method: 'sentinel2-geoblaze-relative-grid-v1',
    comparison: 'parcel-mean',
    fieldMean:
      Number.isFinite(Number(zonal?.mean)) ? Number(zonal?.mean) : null,
    threshold,
    findings,
    importantArea,
    importantAreaByLayer: {
      vegetation: importantArea,
      'radar-vv': null,
      'radar-vh': null,
      'radar-water': null,
    },
  };
}

function compactRadarMeta(
  data: any,
) {
  if (!data) {
    return null;
  }

  return {
    generatedAt:
      data.generatedAt ??
      null,

    dataDate:
      data.dataDate ??
      data.scene?.date ??
      null,

    timeRange:
      data.timeRange ??
      null,

    bbox:
      data.bbox ??
      null,

    scene:
      data.scene ??
      null,

    processing:
      data.processing ??
      null,

    stats:
      data.stats ??
      null,

    comparisonBasis:
      data.comparisonBasis ??
      null,

    previousComparison:
      data.previousComparison ??
      null,
  };
}

function selectSoilLayer(
  data: any,

  activeLayerContext:
    ActiveLayerContext,
) {
  if (!data) {
    return null;
  }

  const property =
    activeLayerContext.property ??
    'phh2o';

  const depth =
    activeLayerContext.depth ??
    '0-5cm';

  const propertyMap:
    Record<string, any> = {
      phh2o:
        data.properties?.ph,

      soc:
        data.properties
          ?.organicCarbon,

      clay:
        data.properties?.clay,

      sand:
        data.properties?.sand,

      silt:
        data.properties?.silt,
    };

  const selected =
    propertyMap[property];

  const selectedLayer =
    Array.isArray(
      selected?.layers,
    )
      ? selected.layers.find(
          (
            item: any,
          ) =>
            item?.depth ===
            depth,
        )
      : null;

  return {
    layer:
      'soil',

    layerLabel:
      activeLayerContext
        .propertyLabel ??
      property,

    source:
      data.source ??
      'SoilGrids',

    provider:
      data.provider ??
      null,

    product:
      data.product ??
      null,

    spatialResolutionMeters:
      data.spatialResolutionMeters ??
      null,

    property,

    propertyLabel:
      activeLayerContext
        .propertyLabel ??
      property,

    depth,

    depthLabel:
      activeLayerContext
        .depthLabel ??
      depth,

    value:
      selectedLayer?.value ??
      null,

    unit:
      selectedLayer?.unit ??
      selected?.unit ??
      null,

    topsoil0To30:
      selected?.topsoil0To30 ??
      null,

    texture:
      data.texture ??
      null,

    generatedAt:
      data.generatedAt ??
      null,

    warnings:
      data.warnings ??
      [],
  };
}


async function fetchClimateVariable(
  latitude: number,
  longitude: number,
  variable: ClimateVariable,
  periodDays: number,
) {
  /*
    YENİ KATMANLAR
    ---------------
    Eski ERA5/era5-map hattına dokunmadan üç yeni iklim-türevi katmanı
    Open-Meteo arşivinden aynı context biçiminde üretiyoruz.

    - surface_temperature: ERA5-Land 0-7 cm yüzeye yakın sıcaklık
    - et0_fao_evapotranspiration: FAO-56 referans ET0 / su ihtiyacı
    - precipitation_sum_30d: geçmiş dönem toplam yağış
  */
  if (
    variable === 'surface_temperature' ||
    variable === 'et0_fao_evapotranspiration' ||
    variable === 'precipitation_sum_30d'
  ) {
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 6);

    const requestedDays =
      variable === 'precipitation_sum_30d'
        ? 30
        : Math.max(
            7,
            Math.min(
              90,
              Number(periodDays || 30),
            ),
          );

    const startDate = new Date(endDate);
    startDate.setUTCDate(
      startDate.getUTCDate() - (requestedDays - 1),
    );

    const isoDate = (date: Date) =>
      date.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      latitude: latitude.toFixed(5),
      longitude: longitude.toFixed(5),
      start_date: isoDate(startDate),
      end_date: isoDate(endDate),
      timezone: 'UTC',
    });

    let responseVariable = '';
    let responseBucket: 'hourly' | 'daily' = 'daily';
    let unit = '';
    let variableLabel = '';
    let source = 'ERA5 / Open-Meteo';

    if (variable === 'surface_temperature') {
      responseVariable = 'soil_temperature_0_to_7cm';
      responseBucket = 'hourly';
      unit = '°C';
      variableLabel = 'Yüzey Sıcaklığı';
      source = 'ERA5-Land / Open-Meteo';
      params.set('hourly', responseVariable);
    } else if (variable === 'et0_fao_evapotranspiration') {
      responseVariable = 'et0_fao_evapotranspiration';
      unit = 'mm';
      variableLabel = 'Evapotranspirasyon / Su İhtiyacı';
      source = 'FAO-56 ET₀ / Open-Meteo';
      params.set('daily', responseVariable);
    } else {
      responseVariable = 'precipitation_sum';
      unit = 'mm';
      variableLabel = 'Yağış Geçmişi';
      source = 'ERA5 / Open-Meteo';
      params.set('daily', responseVariable);
    }

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        `${variableLabel} verisi alınamadı. Open-Meteo ${response.status} hatası verdi.`,
      );
    }

    const payload = await response.json();

    const rawValues = Array.isArray(
      payload?.[responseBucket]?.[responseVariable],
    )
      ? payload[responseBucket][responseVariable]
      : [];

    const values = rawValues
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value));

    if (!values.length) {
      throw new Error(
        `${variableLabel} için kullanılabilir değer bulunamadı.`,
      );
    }

    const sum = values.reduce(
      (total: number, value: number) => total + value,
      0,
    );

    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      layer: 'climate',
      source,
      variable,
      variableLabel,
      unit,
      period: {
        start: isoDate(startDate),
        end: isoDate(endDate),
      },
      stats: {
        average: Number(average.toFixed(4)),
        min: Number(min.toFixed(4)),
        max: Number(max.toFixed(4)),
        total:
          variable === 'et0_fao_evapotranspiration' ||
          variable === 'precipitation_sum_30d'
            ? Number(sum.toFixed(4))
            : null,
        validCellCount: values.length,
      },
      generatedAt: new Date().toISOString(),
      provider:
        variable === 'surface_temperature'
          ? 'open-meteo-era5-land-surface-near'
          : variable === 'et0_fao_evapotranspiration'
          ? 'open-meteo-fao56-et0'
          : 'open-meteo-precipitation-history',
    };
  }

  /*
    Önce mevcut era5-map Edge Function'ı deniyoruz.
    Çalışmıyorsa Pusula yorumunu bozmadan Open-Meteo
    ERA5 arşivine doğrudan fallback yapıyoruz.
  */

  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'era5-map',
        {
          body: {
            latitude,
            longitude,
            variable,
            days:
              periodDays,
            gridRadius: 2,
          },
        },
      );

    if (error) {
      throw error;
    }

    if (data) {
      const average =
        Number(
          data?.stats?.average ??
          data?.average,
        );

      if (
        Number.isFinite(
          average,
        )
      ) {
        return {
          layer:
            'climate',

          source:
            'ERA5 / ERA5-Land',

          variable,

          variableLabel:
            data.variableLabel ??
            variable,

          unit:
            data.unit ??
            null,

          period:
            data.period ??
            null,

          stats: {
            average,

            min:
              data.stats?.min ??
              data.min ??
              null,

            max:
              data.stats?.max ??
              data.max ??
              null,

            validCellCount:
              data.stats
                ?.validCellCount ??
              data.validCellCount ??
              null,
          },

          generatedAt:
            data.generatedAt ??
            new Date()
              .toISOString(),

          provider:
            'era5-map',
        };
      }
    }

    throw new Error(
      `${variable} için era5-map kullanılabilir veri döndürmedi.`,
    );
  } catch (
    edgeError
  ) {
    console.warn(
      '[Pusula] era5-map kullanılamadı; Open-Meteo ERA5 fallback deneniyor:',
      edgeError,
    );
  }

  const endDate =
    new Date();

  /*
    ERA5/ERA5-Land arşivi birkaç gün gecikmeli gelebilir.
    En güvenli son günü bugünden 6 gün geride tutuyoruz.
  */

  endDate.setUTCDate(
    endDate.getUTCDate() -
      6,
  );

  const safeDays =
    Math.max(
      7,
      Math.min(
        90,
        Number(
          periodDays ||
            30,
        ),
      ),
    );

  const startDate =
    new Date(
      endDate,
    );

  startDate.setUTCDate(
    startDate.getUTCDate() -
      (safeDays - 1),
  );

  const isoDate =
    (
      date: Date,
    ) =>
      date
        .toISOString()
        .slice(
          0,
          10,
        );

  const params =
    new URLSearchParams({
      latitude:
        latitude.toFixed(
          5,
        ),

      longitude:
        longitude.toFixed(
          5,
        ),

      start_date:
        isoDate(
          startDate,
        ),

      end_date:
        isoDate(
          endDate,
        ),

      hourly:
        variable,

      timezone:
        'UTC',
    });

  const response =
    await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `İklim verisi alınamadı. Open-Meteo ${response.status} hatası verdi.`,
    );
  }

  const payload =
    await response.json();

  const values =
    Array.isArray(
      payload
        ?.hourly
        ?.[variable],
    )
      ? payload.hourly[
          variable
        ]
          .map(
            (
              value: unknown,
            ) =>
              Number(
                value,
              ),
          )
          .filter(
            (
              value: number,
            ) =>
              Number.isFinite(
                value,
              ),
          )
      : [];

  if (
    !values.length
  ) {
    throw new Error(
      `${variable} için kullanılabilir ERA5 iklim değeri bulunamadı.`,
    );
  }

  const average =
    values.reduce(
      (
        sum: number,
        value: number,
      ) =>
        sum +
        value,
      0,
    ) /
    values.length;

  const min =
    Math.min(
      ...values,
    );

  const max =
    Math.max(
      ...values,
    );

  const unit =
    variable.startsWith(
      'soil_moisture',
    )
      ? 'm³/m³'
      : variable.includes(
            'temperature',
          )
        ? '°C'
        : 'mm';

  return {
    layer:
      'climate',

    source:
      'ERA5 / Open-Meteo',

    variable,

    variableLabel:
      variable,

    unit,

    period: {
      start:
        isoDate(
          startDate,
        ),

      end:
        isoDate(
          endDate,
        ),
    },

    stats: {
      average:
        Number(
          average.toFixed(
            4,
          ),
        ),

      min:
        Number(
          min.toFixed(
            4,
          ),
        ),

      max:
        Number(
          max.toFixed(
            4,
          ),
        ),

      validCellCount:
        values.length,
    },

    generatedAt:
      new Date()
        .toISOString(),

    provider:
      'open-meteo-era5-fallback',
  };
}

async function saveSingleLayerSnapshot(
  input: {
    field: FieldLike;

    activeLayer:
      UnifiedMapActiveLayer;

    activeLayerLabel:
      string;

    ndvi: any;

    radar: any;

    soil: any;

    climate: any;
  },
) {
  const {
    data: userResult,
  } =
    await supabase.auth.getUser();

  const user =
    userResult.user;

  if (!user) {
    throw new Error(
      'Tarla veri hafızası için oturum bulunamadı.',
    );
  }

  const sourceStatus = {
    [input.activeLayer]:
      'ready' as SourceStatus,
  };

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'field_data_snapshots',
      )
      .insert({
        user_id:
          user.id,

        field_id:
          String(
            input.field.id,
          ),

        field_name:
          input.field.name ??
          null,

        crop:
          input.field.crop ??
          null,

        /*
          SADECE açık olan
          katmanın verisi
          dolu olur.

          Diğer kolonlar null.
        */

        ndvi:
          input.ndvi,

        radar:
          input.radar,

        soil:
          input.soil,

        climate:
          input.climate,

        biodiversity:
          null,

        source_status:
          sourceStatus,

        source_count: 1,

        captured_at:
          new Date()
            .toISOString(),

        schema_version: 2,
      })
      .select(
        'id, created_at',
      )
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function refreshFieldContextAndInterpret(
  field: FieldLike,

  options: {
    periodDays?: number;

    activeLayer:
      UnifiedMapActiveLayer;

    activeLayerLabel:
      string;

    activeLayerContext?:
      ActiveLayerContext;

    forceRefresh?: boolean;
  },
): Promise<FieldContextRefreshResult> {
  if (!field?.id) {
    throw new Error(
      'Tarla seçilmedi.',
    );
  }

  if (
    !options?.activeLayer
  ) {
    throw new Error(
      'Okunacak harita katmanı seçilmedi.',
    );
  }

  if (!supabase) {
    throw new Error(
      'Supabase bağlantısı hazır değil.',
    );
  }

  const periodDays =
    Math.max(
      7,

      Math.min(
        90,

        Number(
          options.periodDays ??
            30,
        ),
      ),
    );

  const activeLayer =
    options.activeLayer;

  const activeLayerLabel =
    options.activeLayerLabel;

  const activeLayerContext =
    options.activeLayerContext ??
    {};

  const cacheKey =
    homePusulaContextKey(
      String(field.id),
      activeLayer,
      activeLayerContext,
    );

  /*
    CACHE-FIRST:
    Ana sayfaya her dönüşte uydu/radar/toprak/iklim API'lerini
    ve unified-map-ai yorumunu tekrar çalıştırmıyoruz.

    Aynı tarla + aynı katman + aynı alt seçim için son başarılı
    sonucu doğrudan gösteriyoruz. Yeni veri yalnızca forceRefresh
    true olduğunda veya bu anahtar için hiç kayıt yoksa üretilir.
  */
  if (!options.forceRefresh) {
    const cached =
      readHomePusulaCachedResult(
        cacheKey,
      );

    if (cached) {
      return cached;
    }
  }

  const {
    latitude,
    longitude,
  } =
    fieldCenter(field);

  /*
    FENOLOJİ BAĞLAMI:
    Harita katmanından bağımsız çalışır ve kendi 6 saatlik cache'ine sahiptir.
    Hata verirse harita/Pusula yorumu çalışmaya devam eder.
  */
  const phenologyPromise =
    getFieldPhenologySnapshot(
      field,
      {
        forceRefresh:
          Boolean(
            options.forceRefresh,
          ),
      },
    ).catch(
      (
        error,
      ) => {
        console.warn(
          'Fenoloji özeti hazırlanamadı:',
          error,
        );

        return null;
      },
    );

  /*
    KRİTİK:

    Burada Promise.all ile
    6 katmanı toplamıyoruz.

    SADECE activeLayer
    hangisiyse onun API'si
    çağrılıyor.
  */

  let ndvi: any = null;

  let radar: any = null;

  let soil: any = null;

  let climate: any = null;

  /*
    1 — SAĞLIK
    Sentinel-2 / NDVI
  */

  if (
    activeLayer ===
    'vegetation'
  ) {
    /*
      Sentinel-2'nin iki ayrı işi var:

      1) son kullanılabilir görüntü + güncel NDVI rasterı
      2) 90 günlük NDVI zaman serisi

      İkisini paralel çağırıyoruz. Zaman serisi başarısız olursa
      güncel sağlık haritasını düşürmüyoruz; sadece trend bilgisini
      eksik işaretliyoruz.
    */
    const [raw, timeSeriesResult] =
      await Promise.all([
        analyzeFieldSatellite(
          field.parcelGeometry,
        ),
        fetchFieldNdviTimeSeries(
          field.parcelGeometry,
          {
            daysBack: Math.max(
              30,
              periodDays,
            ),
          },
        ).catch((error) => {
          console.warn(
            'NDVI zaman serisi alınamadı:',
            error,
          );
          return null;
        }),
      ]);

    ndvi =
      compactNdvi(raw);

    /*
      GeoBlaze parsel-içi zonal istatistiği varsa mevcut Sentinel özetindeki
      sayısal NDVI alanlarını bununla değiştiriyoruz. Böylece Pusula'nın
      kullandığı ortalama / iyi / orta / zayıf oranları, bütün rasterın veya
      tahmini bir özetin değil doğrudan kullanıcının parsel geometrisinin
      içindeki gerçek Sentinel-2 piksellerinin sonucudur.
    */
    const zonal =
      activeLayerContext.ndviZonalStats ?? null;

    if (
      zonal &&
      Number.isFinite(Number(zonal.mean)) &&
      Number.isFinite(Number(zonal.min)) &&
      Number.isFinite(Number(zonal.max))
    ) {
      ndvi = {
        ...ndvi,
        source:
          zonal.engine === 'geoblaze'
            ? 'Sentinel-2 · GeoBlaze'
            : 'Sentinel-2 · Parsel piksel hesabı',
        date:
          zonal.datetime ?? ndvi?.date ?? null,
        average: Number(zonal.mean),
        min: Number(zonal.min),
        max: Number(zonal.max),
        healthyPercent:
          Number.isFinite(Number(zonal.healthyPercent))
            ? Number(zonal.healthyPercent)
            : ndvi?.healthyPercent ?? null,
        warningPercent:
          Number.isFinite(Number(zonal.moderatePercent))
            ? Number(zonal.moderatePercent)
            : ndvi?.warningPercent ?? null,
        stressedPercent:
          Number.isFinite(Number(zonal.stressedPercent))
            ? Number(zonal.stressedPercent)
            : ndvi?.stressedPercent ?? null,
        classificationType: 'absolute_ndvi',
        absoluteDistribution: {
          highThreshold: 0.6,
          mediumThreshold: 0.3,
          highPercent:
            Number.isFinite(Number(zonal.healthyPercent))
              ? Number(zonal.healthyPercent)
              : null,
          mediumPercent:
            Number.isFinite(Number(zonal.moderatePercent))
              ? Number(zonal.moderatePercent)
              : null,
          lowPercent:
            Number.isFinite(Number(zonal.stressedPercent))
              ? Number(zonal.stressedPercent)
              : null,
        },
        interpretationCaution:
          'Mutlak NDVI dağılımı bitki örtüsü/aktif yeşil biyokütle sinyalidir; tek başına hastalık, verim veya tarla sağlığı teşhisi değildir. Parsel içi zayıf bölge yorumu yalnızca gerçek NDVI bölge ortalamalarının parsel ortalamasıyla karşılaştırılmasına dayanır.',
        zonalStats: {
          source: zonal.source ?? 'GeoBlaze',
          engine: zonal.engine ?? null,
          sceneId: zonal.sceneId ?? null,
          datetime: zonal.datetime ?? null,
          cloudCover:
            zonal.cloudCover ?? null,
          sampleCount:
            zonal.sampleCount ?? null,
          median:
            Number.isFinite(Number(zonal.median))
              ? Number(zonal.median)
              : null,
          stdDev:
            Number.isFinite(Number(zonal.stdDev))
              ? Number(zonal.stdDev)
              : null,
          relativeThreshold:
            Number.isFinite(Number(zonal.relativeThreshold))
              ? Number(zonal.relativeThreshold)
              : null,
          relativeZones:
            Array.isArray(zonal.relativeZones)
              ? zonal.relativeZones
              : [],
        },
      };
    }

    /*
      Ayrı vision AI yok.

      NDVI rasterını kendi
      spatialFieldReader
      kodumuz 9 bölgeye
      ayırıyor.
    */

    let spatial:
      any = buildNdviRelativeSpatial(zonal);

    /*
      GeoBlaze gerçek piksel bölgeleri yoksa eski görüntü tabanlı spatial
      okuyucu yalnızca geriye dönük uyumluluk için fallback olarak kalır.
      Yeni akışta göreli zayıf bölge kararı renkli PNG'den değil gerçek
      Sentinel-2 NDVI piksellerinden gelir.
    */
    if (!spatial) {
      try {
        spatial =
          await analyzeSpatialFieldImages(
            {
              ndviImage:
                raw?.ndviImage ??
                null,
            },
          );
      } catch (
        error
      ) {
        console.warn(
          'NDVI mekânsal karşılaştırması oluşturulamadı:',
          error,
        );
      }
    }

    ndvi = {
      ...ndvi,
      spatial,
      trend: timeSeriesResult?.trend ?? null,
      timeSeries: timeSeriesResult
        ? {
            source: timeSeriesResult.source ?? null,
            period: timeSeriesResult.period ?? null,
            generatedAt: timeSeriesResult.generatedAt ?? null,
            observationCount: timeSeriesResult.points.length,
            points: timeSeriesResult.points.slice(-12),
          }
        : null,
    };
  }

  /*
    2 — NEMLİ ALANLAR
    3 — ZEMİN FARKI
    4 — SU BİRİKİMİ RİSKİ

    Sadece seçilen
    Sentinel-1 modu çağrılır.
  */

  if (
    activeLayer ===
      'radar-vv' ||
    activeLayer ===
      'radar-vh' ||
    activeLayer ===
      'radar-water'
  ) {
    const mode =
      activeLayer ===
      'radar-vv'
        ? 'vv'
        : activeLayer ===
            'radar-vh'
          ? 'vh'
          : 'water';

    const raw =
      await fetchSentinel1Radar(
        latitude,
        longitude,
        {
          days:
            Math.max(
              90,
              periodDays,
            ),

          mode,

          geometry:
            field.parcelGeometry ??
            null,

          includePreviousComparison:
            true,
        },
      );

    /*
      Vision model YOK.

      Radar görüntüsünü kendi
      spatial reader'ımız
      sayısal olarak okur.
    */

    let spatial:
      any = null;

    try {
      spatial =
        await analyzeSpatialFieldImages(
          {
            radarVvImage:
              mode === 'vv'
                ? raw
                    ?.imageDataUrl ??
                  null
                : null,

            radarVhImage:
              mode === 'vh'
                ? raw
                    ?.imageDataUrl ??
                  null
                : null,

            radarWaterImage:
              mode === 'water'
                ? raw
                    ?.imageDataUrl ??
                  null
                : null,
          },
        );
    } catch (
      error
    ) {
      console.warn(
        `${activeLayerLabel} mekânsal okuması oluşturulamadı:`,
        error,
      );
    }

    radar = {
      layer:
        activeLayer,

      layerLabel:
        activeLayerLabel,

      source:
        'Sentinel-1',

      mode,

      periodDays,

      meta:
        compactRadarMeta(
          raw,
        ),

      currentStats:
        raw?.stats ??
        null,

      historyComparison:
        raw?.previousComparison ??
        null,

      comparisonBasis:
        raw?.comparisonBasis ??
        null,

      spatial,
    };
  }

  /*
    5 — TOPRAK

    SoilGrids profilinden
    sadece kullanıcının
    seçtiği property + depth
    AI context'e girer.
  */

  if (
    activeLayer ===
    'soil'
  ) {
    const raw =
      await fetchSoilGridsProfile(
        latitude,
        longitude,
      );

    soil =
      selectSoilLayer(
        raw,
        activeLayerContext,
      );
  }

  /*
    6 — İKLİM

    ERA5'ten yalnızca
    seçili variable çağrılır.
  */

  if (
    activeLayer ===
    'climate'
  ) {
    const variable =
      activeLayerContext
        .variable ??
      'soil_moisture_0_to_7cm';

    climate =
      await fetchClimateVariable(
        latitude,
        longitude,
        variable,
        periodDays,
      );

    climate = {
      ...climate,

      layerLabel:
        activeLayerLabel,

      selected:
        activeLayerContext,
    };
  }

  /*
    Fenoloji sonucu açık katmandan bağımsız bir bağlamdır.
    Harita katmanlarını toplamaz; sadece ürün evresi + NDVI trendi +
    ERA5 termal kaydırmayı tek özet halinde verir.
  */
  const phenology =
    await phenologyPromise;

  /*
    AI'ya yalnızca açık harita katmanının verisi gider.
    Fenoloji ise ayrı bir bağlam olarak taşınır.
  */

  const normalizedContext = {
    ndvi,
    radar,
    soil,
    climate,
    biodiversity: null,
    phenology,
  };

  /*
    DB snapshot ve AI çağrısını
    birbirini gereksiz yere
    bekletmeden başlatıyoruz.

    Snapshot hatası AI kartını
    bozmasın.
  */

  const snapshotPromise =
    saveSingleLayerSnapshot({
      field,

      activeLayer,

      activeLayerLabel,

      ndvi,

      radar,

      soil,

      climate,
    }).catch(
      (
        error,
      ) => {
        console.warn(
          `${activeLayerLabel} snapshot kaydı yapılamadı:`,
          error,
        );

        return null;
      },
    );

  const rawAnalysis =
    await interpretUnifiedMap(
      {
        fieldId:
          String(
            field.id,
          ),

        fieldName:
          field.name ??
          undefined,

        crop:
          field.crop ??
          undefined,

        periodDays,

        activeLayer,

        activeLayerLabel,

        activeLayerContext,

        context:
          normalizedContext,
      },
    );

  /*
    Edge Function mevcut katman yorumunu üretir.
    Son aşamada fenoloji guard'ı yanlış dönem önerilerini engeller.
  */
  const analysis =
    applyPhenologyToMapAnalysis(
      rawAnalysis,
      phenology,
      activeLayer,
    );

  /*
    AI cevabı çıktıktan sonra
    snapshot sonucu çok kısa
    beklenir; DB yazısı başarısız
    olsa bile kullanıcı yorumu
    kaybolmaz.
  */

  const saved =
    await snapshotPromise;

  const snapshotId =
    saved?.id ??
    null;

  const result: FieldContextRefreshResult = {
    snapshotId,

    sourceCount: 1,

    sourceStatus: {
      [activeLayer]:
        'ready',
    },

    biodiversityReady:
      false,

    activeLayer,

    activeLayerLabel,

    context:
      normalizedContext,

    analysis,
  };

  saveHomePusulaCachedResult(
    cacheKey,
    result,
  );

  return result;
}