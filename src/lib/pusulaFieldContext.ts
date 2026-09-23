import type { Field } from '../types';
import { fetchSoilGridsProfile } from '../services/soilGridsService';
import { fetchDemTerrainProfile } from '../services/demService';
import {
  fetchFaoAsisPointContext,
  type FaoAsisStressClass,
} from '../services/faoAsisService';
import {
  fetchHydroBasinContext,
  type HydroBasinContext,
} from '../services/hydrologyContextService';
import {
  fetchDssatShadowReadiness,
  type DssatShadowReadiness,
} from '../features/irrigation/services/dssatShadowReadiness.service';
import {
  fetchWorldCerealReferenceContext,
  type WorldCerealReferenceContext,
} from '../services/worldCerealReference.service';
import { fetchFieldNdviTimeSeries } from '../features/satellite/services/ndviTimeSeries.service';
import {
  estimateNasaHarvestCropStage,
  type NasaHarvestCropStageResult,
} from '../features/phenology/services/nasaHarvestCropStage.service';
import {
  fetchHybrisFieldEventsEvidence,
  type HybrisFieldEventsEvidence,
} from '../services/hybrisFieldEvents.service';
import {
  ensureAgStackGeoId,
  type AgStackGeoIdEvidence,
} from '../services/agstackGeoId.service';
import {
  fetchFieldCropSuitability,
  type CropSuitabilityResponse,
} from '../services/fieldCropSuitability.service';

export type PusulaEvidencePriority =
  | 'authoritative'
  | 'observed'
  | 'current_remote'
  | 'forecast'
  | 'reanalysis'
  | 'model_context';

export type PusulaSourceState =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'not_requested';

export type PusulaEvidence = {
  source: string;
  priority: PusulaEvidencePriority;
  state: PusulaSourceState;
  observedAt?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string[];
};

export type PusulaFieldContext = {
  schemaVersion: 1;
  generatedAt: string;

  field: {
    id: string;
    name: string | null;
    crop: string | null;
    plantingDate: string | null;
    areaDa: number | null;
    village: string | null;
    district: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };

  userGroundTruth: {
    soilAnalysisAvailable: boolean;
    note:
      | 'Gerçek laboratuvar/saha verisi varsa model tahminlerinden önceliklidir.'
      | string;
  };

  weather: {
    locationLabel: string | null;
    current: unknown;
    forecast: unknown[];
    evidence: PusulaEvidence;
  };

  satellite: {
    ndviMean: number | null;
    healthScore: number | null;
    sceneDate: string | null;
    summary: string | null;
    evidence: PusulaEvidence;
  } | null;

  climate: {
    raw: unknown;
    evidence: PusulaEvidence;
  } | null;

  soilModel: {
    ph0To30: number | null;
    organicCarbonGKg0To30: number | null;
    clayPercent: number | null;
    sandPercent: number | null;
    siltPercent: number | null;
    warnings: string[];
    evidence: PusulaEvidence;
  } | null;

  terrain: {
    elevationM: number | null;
    minElevationM: number | null;
    maxElevationM: number | null;
    reliefM: number | null;
    averageSlopeDeg: number | null;
    maxSlopeDeg: number | null;
    dominantAspect: string | null;
    evidence: PusulaEvidence;
  } | null;

  agriculturalDrought: {
    source: 'FAO GIEWS ASIS';
    dataset: 'Vegetation Health Index (VHI) - Near Real Time (Dekadal)';
    vhi: number | null;
    stressClass: FaoAsisStressClass;
    label: string;
    yearDekad: string | null;
    resolutionMeters: 1000;
    scope: 'regional-remote-context';
    warnings: string[];
    evidence: PusulaEvidence;
  } | null;

  hydrology: {
    source: 'HydroSHEDS HydroBASINS v1';
    basinLevel: 7 | 8 | null;
    basinId: string | null;
    mainBasinId: string | null;
    nextDownBasinId: string | null;
    pfafstetterId: string | null;
    subBasinAreaKm2: number | null;
    upstreamAreaKm2: number | null;
    distanceToSinkKm: number | null;
    distanceToMainOutletKm: number | null;
    endorheic: boolean | null;
    coastal: boolean | null;
    surfaceWaterHistory: {
      source: 'JRC Global Surface Water Recurrence';
      datasetVersion: 'analysis snapshot 1984-2021';
      latestDatasetAvailable: 'GSW v1.5 · 1984-2024';
      spatialResolutionM: 30;
      method: 'point-neighborhood-sampling';
      sampleRadiusM: 500;
      totalSamples: number;
      validSamples: number;
      centerRecurrencePct: number | null;
      meanRecurrencePct: number | null;
      maxRecurrencePct: number | null;
      nearestSampledHistoricalWaterM: number | null;
      waterSignal:
        | 'none'
        | 'episodic'
        | 'recurring'
        | 'persistent'
        | 'unknown';
      provider: string;
      confidence: 'low' | 'medium';
    } | null;
    nearestRiver: {
      source: 'HydroSHEDS HydroRIVERS v1';
      riverId: string | null;
      mainRiverId: string | null;
      nextDownRiverId: string | null;
      distanceM: number | null;
      reachLengthKm: number | null;
      catchmentAreaKm2: number | null;
      upstreamAreaKm2: number | null;
      averageDischargeM3s: number | null;
      strahlerOrder: number | null;
      riverClass: number | null;
      flowOrder: number | null;
      endorheic: boolean | null;
      provider: string;
      confidence: 'low' | 'medium';
    } | null;
    provider: string;
    scope: 'catchment-context';
    warnings: string[];
    evidence: PusulaEvidence;
  } | null;

  cropReference: (Omit<WorldCerealReferenceContext, 'evidence'> & {
    sourceEvidence: WorldCerealReferenceContext['evidence'];
    evidence: PusulaEvidence;
  }) | null;

  cropSuitability: (Omit<CropSuitabilityResponse, 'evidence'> & {
    sourceEvidence: CropSuitabilityResponse['evidence'];
    evidence: PusulaEvidence;
  }) | null;

  phenology: (NasaHarvestCropStageResult & {
    evidence: PusulaEvidence;
  }) | null;

  fieldEvents: (HybrisFieldEventsEvidence & {
    evidence: PusulaEvidence;
  }) | null;

  fieldIdentity: (AgStackGeoIdEvidence & {
    evidence: PusulaEvidence;
  }) | null;

  modelReadiness: {
    dssat: (DssatShadowReadiness & { evidence: PusulaEvidence }) | null;
  };

  radar: {
    status: 'map_available_metrics_pending';
    note: string;
    evidence: PusulaEvidence;
  };

  gamification: {
    points: number;
  };

  decisionPolicy: {
    sourcePriority: string[];
    neverBlindAverage: true;
    disagreementMeansUncertainty: true;
    farmerFacingRule: string;
  };

  sourceHealth: {
    ready: string[];
    partial: string[];
    unavailable: string[];
  };
};

type BuildArgs = {
  field: Field | Record<string, any>;
  locationLabel?: string | null;
  currentWeather?: unknown;
  forecast?: unknown[];
  satelliteData?: any;
  unifiedClimateContext?: unknown;
  gamificationPoints?: number;
  loadExtended?: boolean;
};

const CACHE_PREFIX = 'tp_pusula_extended_context_v7:';
const EXTENDED_CACHE_MS = 6 * 60 * 60 * 1000;

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function fieldCoordinates(field: any) {
  const latitude = finite(
    field?.parcelCentroidLat ??
      field?.latitude ??
      field?.lat,
  );

  const longitude = finite(
    field?.parcelCentroidLng ??
      field?.longitude ??
      field?.lng ??
      field?.lon,
  );

  if (latitude === null || longitude === null) return null;

  return { latitude, longitude };
}

function hasParcelBoundary(field: any) {
  const boundary =
    field?.parcelGeometry ??
    field?.parcel_geometry ??
    null;

  if (!boundary) return false;

  const geometry =
    boundary?.type === 'Feature'
      ? boundary?.geometry
      : boundary?.geometry ?? boundary;

  return (
    (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') &&
    Array.isArray(geometry?.coordinates) &&
    geometry.coordinates.length > 0
  );
}

function readExtendedCache(fieldId: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(
      `${CACHE_PREFIX}${fieldId}`,
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      soilModel?: PusulaFieldContext['soilModel'];
      terrain?: PusulaFieldContext['terrain'];
      agriculturalDrought?: PusulaFieldContext['agriculturalDrought'];
      hydrology?: PusulaFieldContext['hydrology'];
      worldCereal?: PusulaFieldContext['cropReference'];
      cropSuitability?: PusulaFieldContext['cropSuitability'];
      phenology?: PusulaFieldContext['phenology'];
      hybrisEvents?: PusulaFieldContext['fieldEvents'];
      dssatReadiness?: PusulaFieldContext['modelReadiness']['dssat'];
    };

    if (!parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > EXTENDED_CACHE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeExtendedCache(
  fieldId: string,
  value: {
    soilModel: PusulaFieldContext['soilModel'];
    terrain: PusulaFieldContext['terrain'];
    agriculturalDrought: PusulaFieldContext['agriculturalDrought'];
    hydrology: PusulaFieldContext['hydrology'];
    worldCereal: PusulaFieldContext['cropReference'];
    cropSuitability: PusulaFieldContext['cropSuitability'];
    phenology: PusulaFieldContext['phenology'];
    hybrisEvents: PusulaFieldContext['fieldEvents'];
    dssatReadiness: PusulaFieldContext['modelReadiness']['dssat'];
  },
) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${fieldId}`,
      JSON.stringify({
        savedAt: Date.now(),
        ...value,
      }),
    );
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

async function loadExtendedContext(
  fieldId: string,
  latitude: number,
  longitude: number,
  parcelGeometry: unknown,
) {
  const cached = readExtendedCache(fieldId);

  if (
    cached &&
    (
      'soilModel' in cached ||
      'terrain' in cached ||
      'agriculturalDrought' in cached ||
      'hydrology' in cached ||
      'worldCereal' in cached ||
      'cropSuitability' in cached ||
      'phenology' in cached ||
      'hybrisEvents' in cached ||
      'dssatReadiness' in cached
    )
  ) {
    return {
      soilModel: cached.soilModel ?? null,
      terrain: cached.terrain ?? null,
      agriculturalDrought: cached.agriculturalDrought ?? null,
      hydrology: cached.hydrology ?? null,
      worldCereal: cached.worldCereal ?? null,
      cropSuitability: cached.cropSuitability ?? null,
      phenology: cached.phenology ?? null,
      hybrisEvents: cached.hybrisEvents ?? null,
      dssatReadiness: cached.dssatReadiness ?? null,
    };
  }

  const [
    soilResult,
    terrainResult,
    asisResult,
    hydrologyResult,
    worldCerealResult,
    cropSuitabilityResult,
    phenologyResult,
    hybrisResult,
    dssatResult,
  ] = await Promise.allSettled([
    fetchSoilGridsProfile(latitude, longitude),
    fetchDemTerrainProfile(latitude, longitude, {
      gridSize: 7,
      stepMeters: 90,
    }),
    fetchFaoAsisPointContext(latitude, longitude),
    fetchHydroBasinContext(latitude, longitude),
    fetchWorldCerealReferenceContext(latitude, longitude),
    fetchFieldCropSuitability(fieldId),
    parcelGeometry
      ? fetchFieldNdviTimeSeries(parcelGeometry, { daysBack: 180 })
          .then((series) => estimateNasaHarvestCropStage(series.points))
      : Promise.resolve(null),
    fetchHybrisFieldEventsEvidence(fieldId),
    fetchDssatShadowReadiness(fieldId),
  ]);

  const soilModel: PusulaFieldContext['soilModel'] =
    soilResult.status === 'fulfilled'
      ? {
          ph0To30:
            soilResult.value.properties.ph.topsoil0To30,
          organicCarbonGKg0To30:
            soilResult.value.properties.organicCarbon.topsoil0To30,
          clayPercent:
            soilResult.value.texture.clayPercent,
          sandPercent:
            soilResult.value.texture.sandPercent,
          siltPercent:
            soilResult.value.texture.siltPercent,
          warnings: soilResult.value.warnings ?? [],
          evidence: {
            source: 'ISRIC SoilGrids250m 2.0',
            priority: 'model_context',
            state:
              soilResult.value.warnings?.length
                ? 'partial'
                : 'ready',
            confidence: 'low',
            notes: [
              '250 m model tahminidir.',
              'Laboratuvar sonucu varsa laboratuvar verisi önceliklidir.',
            ],
          },
        }
      : null;

  const terrain: PusulaFieldContext['terrain'] =
    terrainResult.status === 'fulfilled'
      ? {
          elevationM:
            terrainResult.value.stats.centerElevationM,
          minElevationM:
            terrainResult.value.stats.minElevationM,
          maxElevationM:
            terrainResult.value.stats.maxElevationM,
          reliefM:
            terrainResult.value.stats.reliefM,
          averageSlopeDeg:
            terrainResult.value.stats.averageSlopeDeg,
          maxSlopeDeg:
            terrainResult.value.stats.maxSlopeDeg,
          dominantAspect:
            terrainResult.value.stats.dominantAspect,
          evidence: {
            source: 'Copernicus DEM GLO-90',
            priority: 'model_context',
            state: 'ready',
            confidence: 'medium',
            notes: [
              'Yaklaşık 90 m sayısal yükseklik modeli.',
              'RTK/GNSS veya hassas tesviye ölçümü değildir.',
            ],
          },
        }
      : null;

  const agriculturalDrought: PusulaFieldContext['agriculturalDrought'] =
    asisResult.status === 'fulfilled' &&
    asisResult.value.ok &&
    asisResult.value.value !== null
      ? {
          source: 'FAO GIEWS ASIS',
          dataset: 'Vegetation Health Index (VHI) - Near Real Time (Dekadal)',
          vhi: asisResult.value.value,
          stressClass: asisResult.value.stressClass,
          label: asisResult.value.label,
          yearDekad: asisResult.value.yearDekad,
          resolutionMeters: 1000,
          scope: 'regional-remote-context',
          warnings: asisResult.value.warnings,
          evidence: {
            source: 'FAO GIEWS ASIS · VHI',
            priority: 'current_remote',
            state: 'ready',
            observedAt: asisResult.value.observedAt,
            confidence: 'low',
            notes: [
              'Yaklaşık 1 km çözünürlüklü bölgesel kuraklık/vejetasyon sağlığı bağlamıdır.',
              'Sentinel-2 parsel içi NDVI ölçümünün yerine geçmez.',
              ...asisResult.value.warnings.slice(0, 2),
            ],
          },
        }
      : null;

  const hydrology: PusulaFieldContext['hydrology'] =
    hydrologyResult.status === 'fulfilled' &&
    hydrologyResult.value.ok
      ? {
          source: 'HydroSHEDS HydroBASINS v1',
          basinLevel: hydrologyResult.value.basinLevel,
          basinId: hydrologyResult.value.basinId,
          mainBasinId: hydrologyResult.value.mainBasinId,
          nextDownBasinId: hydrologyResult.value.nextDownBasinId,
          pfafstetterId: hydrologyResult.value.pfafstetterId,
          subBasinAreaKm2: hydrologyResult.value.subBasinAreaKm2,
          upstreamAreaKm2: hydrologyResult.value.upstreamAreaKm2,
          distanceToSinkKm: hydrologyResult.value.distanceToSinkKm,
          distanceToMainOutletKm:
            hydrologyResult.value.distanceToMainOutletKm,
          endorheic: hydrologyResult.value.endorheic,
          coastal: hydrologyResult.value.coastal,
          surfaceWaterHistory: hydrologyResult.value.surfaceWaterHistory
            ? {
                source: 'JRC Global Surface Water Recurrence',
                datasetVersion:
                  hydrologyResult.value.surfaceWaterHistory.datasetVersion,
                latestDatasetAvailable:
                  hydrologyResult.value.surfaceWaterHistory.latestDatasetAvailable,
                spatialResolutionM:
                  hydrologyResult.value.surfaceWaterHistory.spatialResolutionM,
                method: hydrologyResult.value.surfaceWaterHistory.method,
                sampleRadiusM:
                  hydrologyResult.value.surfaceWaterHistory.sampleRadiusM,
                totalSamples:
                  hydrologyResult.value.surfaceWaterHistory.totalSamples,
                validSamples:
                  hydrologyResult.value.surfaceWaterHistory.validSamples,
                centerRecurrencePct:
                  hydrologyResult.value.surfaceWaterHistory.centerRecurrencePct,
                meanRecurrencePct:
                  hydrologyResult.value.surfaceWaterHistory.meanRecurrencePct,
                maxRecurrencePct:
                  hydrologyResult.value.surfaceWaterHistory.maxRecurrencePct,
                nearestSampledHistoricalWaterM:
                  hydrologyResult.value.surfaceWaterHistory
                    .nearestSampledHistoricalWaterM,
                waterSignal:
                  hydrologyResult.value.surfaceWaterHistory.waterSignal,
                provider: hydrologyResult.value.surfaceWaterHistory.provider,
                confidence:
                  hydrologyResult.value.surfaceWaterHistory.confidence,
              }
            : null,
          nearestRiver: hydrologyResult.value.nearestRiver
            ? {
                source: 'HydroSHEDS HydroRIVERS v1',
                riverId: hydrologyResult.value.nearestRiver.riverId,
                mainRiverId:
                  hydrologyResult.value.nearestRiver.mainRiverId,
                nextDownRiverId:
                  hydrologyResult.value.nearestRiver.nextDownRiverId,
                distanceM: hydrologyResult.value.nearestRiver.distanceM,
                reachLengthKm:
                  hydrologyResult.value.nearestRiver.reachLengthKm,
                catchmentAreaKm2:
                  hydrologyResult.value.nearestRiver.catchmentAreaKm2,
                upstreamAreaKm2:
                  hydrologyResult.value.nearestRiver.upstreamAreaKm2,
                averageDischargeM3s:
                  hydrologyResult.value.nearestRiver.averageDischargeM3s,
                strahlerOrder:
                  hydrologyResult.value.nearestRiver.strahlerOrder,
                riverClass: hydrologyResult.value.nearestRiver.riverClass,
                flowOrder: hydrologyResult.value.nearestRiver.flowOrder,
                endorheic: hydrologyResult.value.nearestRiver.endorheic,
                provider: hydrologyResult.value.nearestRiver.provider,
                confidence: hydrologyResult.value.nearestRiver.confidence,
              }
            : null,
          provider: hydrologyResult.value.provider,
          scope: 'catchment-context',
          warnings: hydrologyResult.value.warnings,
          evidence: {
            source: 'HydroSHEDS HydroBASINS v1',
            priority: 'model_context',
            state:
              hydrologyResult.value.confidence === 'medium'
                ? 'ready'
                : 'partial',
            confidence: hydrologyResult.value.confidence,
            notes: [
              'Havza/topoloji bağlamıdır; parsel içindeki su birikimini tek başına kanıtlamaz.',
              'Yaklaşık 15 arc-second (~500 m) havza verisi ve HydroRIVERS ana akış ağı birlikte kullanılır.',
              hydrologyResult.value.nearestRiver
                ? `En yakın ana akış kolu yaklaşık ${Math.round(
                    hydrologyResult.value.nearestRiver.distanceM ?? 0,
                  )} m uzaktadır; bu mesafe saha ölçümü değildir.`
                : 'Yakın HydroRIVERS ana akış kolu eşleşmesi yok.',
              hydrologyResult.value.surfaceWaterHistory
                ? `JRC geçmiş su bağlamı: ${hydrologyResult.value.surfaceWaterHistory.waterSignal}; merkez recurrence ${
                    hydrologyResult.value.surfaceWaterHistory.centerRecurrencePct ??
                    'yok'
                  }%. Bu tarihsel bağlamdır, güncel su değildir.`
                : 'JRC geçmiş yüzey suyu bağlamı alınamadı.',
              ...hydrologyResult.value.warnings.slice(0, 2),
            ],
          },
        }
      : null;

  const cropSuitability: PusulaFieldContext['cropSuitability'] =
    cropSuitabilityResult.status === 'fulfilled'
      ? {
          ...cropSuitabilityResult.value,
          sourceEvidence: cropSuitabilityResult.value.evidence,
          evidence: {
            source: 'FAO ECOCROP + NASA POWER + SoilGrids',
            priority: 'model_context',
            state:
              cropSuitabilityResult.value.status === 'ready'
                ? 'ready'
                : cropSuitabilityResult.value.status === 'partial'
                  ? 'partial'
                  : 'unavailable',
            observedAt: cropSuitabilityResult.value.generated_at ?? null,
            confidence:
              cropSuitabilityResult.value.screening?.confidence === 'high'
                ? 'high'
                : cropSuitabilityResult.value.screening?.confidence === 'medium'
                  ? 'medium'
                  : 'low',
            notes: [
              'FAO ECOCROP ürün gereksinimleri, NASA POWER 1991-2020 klimatolojisi ve SoilGrids pH bağlamını birleştiren ön uygunluk taramasıdır.',
              'Verim tahmini veya doğrudan ekim tavsiyesi değildir; saha/laboratuvar verisi daha yüksek önceliklidir.',
              cropSuitabilityResult.value.screening?.limitingFactor
                ? `Sınırlayıcı faktör: ${cropSuitabilityResult.value.screening.limitingFactor.label} · skor ${cropSuitabilityResult.value.screening.limitingFactor.score ?? 'yok'}.`
                : cropSuitabilityResult.value.status === 'unsupported_crop'
                  ? 'Kayıtlı ürün için kaynaklı ECOCROP kural paketi henüz bulunmuyor.'
                  : 'Belirgin sınırlayıcı faktör üretilemedi.',
              ...(cropSuitabilityResult.value.warnings ?? []).slice(0, 2),
            ],
          },
        }
      : null;

  const worldCereal: PusulaFieldContext['cropReference'] =
    worldCerealResult.status === 'fulfilled'
      ? {
          ...worldCerealResult.value,
          sourceEvidence: worldCerealResult.value.evidence ?? [],
          evidence: {
            source: 'ESA WorldCereal RDM',
            priority: 'model_context',
            state: worldCerealResult.value.status === 'ready' ? 'ready' : worldCerealResult.value.status === 'partial' ? 'partial' : 'unavailable',
            observedAt: worldCerealResult.value.latestValidityDate,
            confidence: worldCerealResult.value.sampleCount > 0 ? 'medium' : 'low',
            notes: [
              'WorldCereal RDM yakın saha referans örnekleri tarihsel/model bağlamıdır; güncel ürün kimliği veya sulama kanıtı değildir.',
              `${worldCerealResult.value.collectionsQueried} koleksiyon sorgulandı; ${worldCerealResult.value.sampleCount} yakın referans örneği kullanılabildi.`,
              worldCerealResult.value.productCatalog.note,
              ...worldCerealResult.value.warnings.slice(0, 2),
            ],
          },
        }
      : null;

  const phenology: PusulaFieldContext['phenology'] =
    phenologyResult.status === 'fulfilled' && phenologyResult.value
      ? {
          ...phenologyResult.value,
          evidence: {
            source: 'NASA Harvest crop-stage-detection uyarlaması',
            priority: 'current_remote',
            state:
              phenologyResult.value.status === 'usable'
                ? 'ready'
                : phenologyResult.value.observationCount > 0
                  ? 'partial'
                  : 'unavailable',
            observedAt: phenologyResult.value.latestDate,
            confidence: phenologyResult.value.confidence ?? 'low',
            notes: [
              '180 güne kadar gerçek Sentinel-2 NDVI gözlemlerinden ürün-agnostik A-E gelişim konumu tahminidir.',
              'A-E sınıfı ürün-spesifik BBCH/fizyolojik evre değildir; çiçeklenme, başaklanma veya dane dolumu gibi evreleri tek başına kanıtlamaz.',
              `Genel evre: ${phenologyResult.value.stageLabel} · ${phenologyResult.value.stageDescription}.`,
              ...phenologyResult.value.basis.slice(0, 2),
              ...phenologyResult.value.warnings.slice(0, 2),
            ],
          },
        }
      : null;

  const hybrisEvents: PusulaFieldContext['fieldEvents'] =
    hybrisResult.status === 'fulfilled'
      ? {
          ...hybrisResult.value,
          evidence: {
            source: 'HyBRIS adapted · Sentinel-1 + Sentinel-2 BSI',
            priority: 'current_remote',
            state:
              hybrisResult.value.status === 'ready'
                ? 'ready'
                : hybrisResult.value.status === 'unavailable'
                  ? 'unavailable'
                  : 'partial',
            observedAt:
              hybrisResult.value.latestEvent?.signalDate ??
              hybrisResult.value.dataCoverage.endDate,
            confidence:
              hybrisResult.value.latestEvent?.confidence ?? 'low',
            notes: [
              'Sentinel-2 BSI ile Sentinel-1 VV/VH zaman serisini birleştirerek ekim, hasat ve toprak işleme olay adayları üretir.',
              'Olay tarihi kesin işlem günü değildir; yaklaşık uydu sinyal penceresidir.',
              hybrisResult.value.latestEvent
                ? `En son olay adayı: ${hybrisResult.value.latestEvent.type} · ${hybrisResult.value.latestEvent.signalDate} · güven ${hybrisResult.value.latestEvent.confidence}.`
                : 'Yeterli güvenli olay adayı yok.',
              'Kullanıcının doğrulanmış tarla işlem kaydı uzaktan algılama adayından önceliklidir.',
              ...hybrisResult.value.warnings.slice(0, 2),
            ],
          },
        }
      : null;

  const dssatReadiness: PusulaFieldContext['modelReadiness']['dssat'] =
    dssatResult.status === 'fulfilled'
      ? {
          ...dssatResult.value,
          evidence: {
            source: `DSSAT-CSM ${dssatResult.value.modelVersion ?? '4.8.x'} readiness`,
            priority: 'model_context',
            state:
              dssatResult.value.status === 'ready'
                ? 'ready'
                : dssatResult.value.status === 'unavailable'
                  ? 'unavailable'
                  : 'partial',
            confidence: dssatResult.value.inputReady ? 'medium' : 'low',
            notes: [
              'Bu kayıt DSSAT simülasyon sonucu değil, yalnız gerçek girdilerin hazırlık durumudur.',
              'DSSAT runtime çalışmadan verim, sulama veya gübre önerisi üretilemez.',
              dssatResult.value.crop.mappingVerified
                ? 'Yerel çeşit için doğrulanmış DSSAT cultivar eşlemesi mevcut.'
                : 'Yerel çeşit için doğrulanmış DSSAT cultivar eşlemesi henüz yok.',
            ],
          },
        }
      : null;

  writeExtendedCache(fieldId, {
    soilModel,
    terrain,
    agriculturalDrought,
    hydrology,
    worldCereal,
    cropSuitability,
    phenology,
    hybrisEvents,
    dssatReadiness,
  });

  return {
    soilModel,
    terrain,
    agriculturalDrought,
    hydrology,
    worldCereal,
    cropSuitability,
    phenology,
    hybrisEvents,
    dssatReadiness,
  };
}

export async function buildPusulaFieldContext({
  field,
  locationLabel = null,
  currentWeather = null,
  forecast = [],
  satelliteData = null,
  unifiedClimateContext = null,
  gamificationPoints = 0,
  loadExtended = true,
}: BuildArgs): Promise<PusulaFieldContext> {
  const fieldId = String((field as any)?.id ?? '').trim();

  if (!fieldId) {
    throw new Error('PusulaFieldContext için tarla kimliği gerekli.');
  }

  const coords = fieldCoordinates(field);

  let soilModel: PusulaFieldContext['soilModel'] = null;
  let terrain: PusulaFieldContext['terrain'] = null;
  let agriculturalDrought: PusulaFieldContext['agriculturalDrought'] = null;
  let hydrology: PusulaFieldContext['hydrology'] = null;
  let worldCereal: PusulaFieldContext['cropReference'] = null;
  let cropSuitability: PusulaFieldContext['cropSuitability'] = null;
  let phenology: PusulaFieldContext['phenology'] = null;
  let hybrisEvents: PusulaFieldContext['fieldEvents'] = null;
  let dssatReadiness: PusulaFieldContext['modelReadiness']['dssat'] = null;

  const extendedPromise =
    loadExtended && coords
      ? loadExtendedContext(
          fieldId,
          coords.latitude,
          coords.longitude,
          (field as any)?.parcelGeometry ?? (field as any)?.parcel_geometry ?? null,
        )
      : Promise.resolve(null);

  const identityPromise: Promise<AgStackGeoIdEvidence | null> =
    loadExtended && hasParcelBoundary(field)
      ? ensureAgStackGeoId(fieldId).catch((error) => {
          console.info('AgStack GeoID bağlamı şu anda alınamadı:', error);
          return null;
        })
      : Promise.resolve(null);

  const [extended, geoIdentityResult] = await Promise.all([
    extendedPromise,
    identityPromise,
  ]);

  if (extended) {
    soilModel = extended.soilModel;
    terrain = extended.terrain;
    agriculturalDrought = extended.agriculturalDrought;
    hydrology = extended.hydrology;
    worldCereal = extended.worldCereal;
    cropSuitability = extended.cropSuitability;
    phenology = extended.phenology;
    hybrisEvents = extended.hybrisEvents;
    dssatReadiness = extended.dssatReadiness;
  }

  const fieldIdentity: PusulaFieldContext['fieldIdentity'] =
    geoIdentityResult
      ? {
          ...geoIdentityResult,
          evidence: {
            source: 'AgStack Asset Registry GeoID',
            priority: 'model_context',
            state: 'ready',
            observedAt: geoIdentityResult.generatedAt,
            confidence: 'high',
            notes: [
              'GeoID, kullanıcının kayıtlı TKGM parsel sınırından sunucu tarafında türetilir; istemciden sınır kabul edilmez.',
              'Harici kimlik ve veri eşleştirme anahtarıdır; kadastro, mülkiyet veya üretim otoritesi değildir.',
              geoIdentityResult.s2CellTokens
                ? 'S2 seviye 8/13 hücreleri harici veri eşleştirmelerinde yardımcı indeks olarak saklanır.'
                : 'AgStack bu kayıt için S2 hücre listesi döndürmedi.',
            ],
          },
        }
      : null;

  const satellite = satelliteData
    ? {
        ndviMean:
          finite(
            satelliteData.ndviMean ??
              satelliteData.meanNdvi,
          ),
        healthScore:
          finite(satelliteData.healthScore),
        sceneDate:
          asString(
            satelliteData.sceneDate ??
              satelliteData.date,
          ),
        summary:
          asString(
            satelliteData.summary ??
              satelliteData.analysis,
          ),
        evidence: {
          source: 'Sentinel-2 / NDVI',
          priority: 'current_remote' as const,
          state: 'ready' as const,
          observedAt:
            asString(
              satelliteData.sceneDate ??
                satelliteData.date ??
                satelliteData.generatedAt,
            ),
          confidence: 'medium' as const,
          notes: [
            'Optik uydu verisidir; bulut ve görüntü tarihi yorumda dikkate alınır.',
          ],
        },
      }
    : null;

  const climate = unifiedClimateContext
    ? {
        raw: unifiedClimateContext,
        evidence: {
          source: 'NASA POWER + ERA5-Land/ERA5',
          priority: 'reanalysis' as const,
          state: 'ready' as const,
          confidence: 'medium' as const,
          notes: [
            'Kaynaklar ayrı tutulur; birbirine körlemesine ortalanmaz.',
            'Kaynaklar arası fark belirsizlik olarak yorumlanır.',
          ],
        },
      }
    : null;

  const ready: string[] = [];
  const partial: string[] = [];
  const unavailable: string[] = [];

  const register = (
    name: string,
    state: PusulaSourceState,
  ) => {
    if (state === 'ready') ready.push(name);
    else if (state === 'partial') partial.push(name);
    else if (state === 'unavailable') unavailable.push(name);
  };

  register('weather', forecast.length ? 'ready' : 'unavailable');
  register(
    'sentinel2_ndvi',
    satellite ? 'ready' : 'unavailable',
  );
  register(
    'climate_reference',
    climate ? 'ready' : 'unavailable',
  );
  register(
    'soilgrids',
    soilModel?.evidence.state ?? 'unavailable',
  );
  register(
    'dem',
    terrain?.evidence.state ?? 'unavailable',
  );
  register(
    'fao_asis_vhi',
    agriculturalDrought?.evidence.state ?? 'unavailable',
  );
  register(
    'hydrobasins_hydrorivers',
    hydrology?.evidence.state ?? 'unavailable',
  );
  register(
    'jrc_surface_water_history',
    hydrology?.surfaceWaterHistory
      ? hydrology.surfaceWaterHistory.confidence === 'medium'
        ? 'ready'
        : 'partial'
      : 'unavailable',
  );
  register(
    'worldcereal_2021_reference',
    worldCereal?.evidence.state ?? 'unavailable',
  );
  register(
    'fao_ecocrop_crop_suitability',
    cropSuitability?.evidence.state ?? 'unavailable',
  );
  register(
    'nasa_harvest_crop_stage',
    phenology?.evidence.state ?? 'unavailable',
  );
  register(
    'hybris_field_events',
    hybrisEvents?.evidence.state ?? 'unavailable',
  );
  register(
    'agstack_geoid',
    fieldIdentity?.evidence.state ??
      (hasParcelBoundary(field) ? 'unavailable' : 'not_requested'),
  );
  register(
    'dssat_shadow_readiness',
    dssatReadiness?.evidence.state ?? 'unavailable',
  );
  register('sentinel1_radar_metrics', 'unavailable');

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),

    field: {
      id: fieldId,
      name: asString((field as any).name),
      crop: asString(
        (field as any).crop ??
          (field as any).product ??
          (field as any).cropName,
      ),
      plantingDate: asString(
        (field as any).plantingDate ??
          (field as any).planting_date,
      ),
      areaDa: finite(
        (field as any).areaDa ??
          (field as any).area,
      ),
      village: asString((field as any).village),
      district: asString((field as any).district),
      city: asString((field as any).city),
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    },

    userGroundTruth: {
      soilAnalysisAvailable: Boolean(
        (field as any).soilAnalysis ||
          (field as any).soil_analysis ||
          (field as any).soilAnalysisId ||
          (field as any).soil_analysis_id ||
          (field as any).soilTest ||
          (field as any).soil_test,
      ),
      note:
        'Gerçek laboratuvar/saha verisi varsa model tahminlerinden önceliklidir.',
    },

    weather: {
      locationLabel,
      current: currentWeather,
      forecast: Array.isArray(forecast)
        ? forecast.slice(0, 5)
        : [],
      evidence: {
        source: 'Kısa vadeli hava tahmini',
        priority: 'forecast',
        state: forecast.length ? 'ready' : 'unavailable',
        confidence: 'medium',
      },
    },

    satellite,
    climate,
    soilModel,
    terrain,
    agriculturalDrought,
    hydrology,
    cropReference: worldCereal,
    cropSuitability,
    phenology,
    fieldEvents: hybrisEvents,
    fieldIdentity,

    modelReadiness: {
      dssat: dssatReadiness,
    },

    radar: {
      status: 'map_available_metrics_pending',
      note:
        'Sentinel-1 radar haritası mevcut; Pusula AI için ham görüntü yerine sayısal radar özet metriği ayrıca bağlanacak.',
      evidence: {
        source: 'Copernicus Sentinel-1 GRD',
        priority: 'current_remote',
        state: 'not_requested',
        confidence: 'medium',
        notes: [
          'Radar geri saçılımı doğrudan toprak nem yüzdesi değildir.',
          'Nem, bitki örtüsü, yüzey pürüzlülüğü ve geometri birlikte etkilidir.',
        ],
      },
    },

    gamification: {
      points: Number(gamificationPoints || 0),
    },

    decisionPolicy: {
      sourcePriority: [
        'Kullanıcının gerçek saha/laboratuvar verisi',
        'Güncel parsel uydu/radar gözlemleri',
        'Güncel kısa vadeli hava',
        'FAO ASIS 1 km bölgesel kuraklık/VHI bağlamı',
        'ERA5-Land/ERA5 reanalysis ve NASA POWER iklim bağlamı',
        'FAO ECOCROP + NASA POWER + SoilGrids ürün ön uygunluk bağlamı',
        'HydroSHEDS HydroBASINS/HydroRIVERS + JRC Global Surface Water tarihsel su bağlamı',
        'HyBRIS Sentinel-1 + Sentinel-2 BSI tarla olay adayları (ekim/hasat/toprak işleme)',
        'NASA Harvest/Agmatix NDVI eğrisi genel gelişim evresi bağlamı',
        'ESA WorldCereal 2021 tarihsel ürün/AEZ referans bağlamı',
        'SoilGrids ve DEM model/sabit bağlam',
      ],
      neverBlindAverage: true,
      disagreementMeansUncertainty: true,
      farmerFacingRule:
        'Çiftçiye ham teknik değer yığını değil; kısa gözlem, neden, güven düzeyi ve uygulanabilir saha kontrolü sun.',
    },

    sourceHealth: {
      ready,
      partial,
      unavailable,
    },
  };
}
