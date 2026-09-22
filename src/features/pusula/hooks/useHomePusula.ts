import { useEffect, useMemo, useRef, useState } from 'react';
import type { PusulaInsight } from '../../../assets/pusula/PusulaGuide';
import {
  refreshFieldContextAndInterpret,
  type ActiveLayerContext,
} from '../../../services/fieldContextSnapshotService';
import { synthesizeFieldObservations } from '../../../services/unifiedMapAiService';
import {
  HOME_CLIMATE_DEPTH_LABELS,
  HOME_CLIMATE_LAYER_LABELS,
  HOME_LAYER_AI_LABELS,
  HOME_SOIL_DEPTH_LABELS,
  HOME_SOIL_PROPERTY_LABELS,
  getHomeLayerFarmerGuide,
  homeClimateVariable,
  type HomeClimateDepth,
  type HomeClimateLayer,
  type HomeLayer,
  type HomeLayerSpatialSummary,
  type HomeSoilDepth,
  type HomeSoilProperty,
} from '../../home-map/HomeMapEngine';
import { titleCaseEachWordTr } from '../../home/homeFormatters';
import type { EarthSearchNdviStats } from '../../home-map/services/earthSearchNdvi.service';
import {
  attachKnowledgeEvidenceToObservation,
  loadMapKnowledgeEvidence,
} from '../../knowledge/services/mapKnowledgeEvidence';

type Inputs = {
  field: any | null;
  fieldKey: string;
  layer: HomeLayer;
  soilProperty: HomeSoilProperty;
  soilDepth: HomeSoilDepth;
  climateLayer: HomeClimateLayer;
  climateDepth: HomeClimateDepth;
  weather: any;
  satellite: any;
  ndviStats?: EarthSearchNdviStats | null;
};

export function useHomePusula({
  field,
  fieldKey,
  layer,
  soilProperty,
  soilDepth,
  climateLayer,
  climateDepth,
  weather,
  satellite,
  ndviStats = null,
}: Inputs) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [spatialSummary, setSpatialSummary] =
    useState<HomeLayerSpatialSummary | null>(null);
  const [fieldSynthesis, setFieldSynthesis] = useState<any>(null);
  const [arrivalVisible, setArrivalVisible] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');
  const synthesisSeenRef = useRef(new Set<string>());
  const requestRef = useRef(0);
  const ndviRelativeKey =
    ndviStats?.relativeZones
      ?.map((zone) =>
        `${zone.area}:${zone.status}:${Number(zone.mean).toFixed(3)}:${Number(zone.deltaFromFieldMean).toFixed(3)}`,
      )
      .join('|') ?? '';

  const ndviStatsKey =
    layer === 'vegetation' && ndviStats
      ? `${ndviStats.sceneId}:${ndviStats.datetime}:${Number(ndviStats.mean).toFixed(4)}:${Math.round(ndviStats.healthyPercent)}:${Math.round(ndviStats.stressedPercent)}:${ndviRelativeKey}`
      : 'no-geoblaze';
  const scope = `${fieldKey}:${layer}:${soilProperty}:${soilDepth}:${climateLayer}:${climateDepth}:${ndviStatsKey}`;
  const [resultScope, setResultScope] = useState('');
  const [synthesisScope, setSynthesisScope] = useState('');
  const visibleResult = resultScope === scope ? result : null;
  const visibleSynthesis = synthesisScope === scope ? fieldSynthesis : null;

  useEffect(() => {
    ++requestRef.current;
    synthesisSeenRef.current.clear();
    setResult(null);
    setResultScope('');
    setFieldSynthesis(null);
    setSynthesisScope('');
    setError(null);
    setLoading(false);
    setArrivalVisible(false);
  }, [scope]);

  const getLayerLabel = (requestedLayer: HomeLayer) => {
    if (requestedLayer === 'soil') {
      return `Toprak · ${HOME_SOIL_PROPERTY_LABELS[soilProperty]} · ${HOME_SOIL_DEPTH_LABELS[soilDepth]}`;
    }

    if (requestedLayer === 'climate') {
      const depthLabel =
        climateLayer === 'soil-moisture' || climateLayer === 'soil-temperature'
          ? ` · ${HOME_CLIMATE_DEPTH_LABELS[climateDepth]}`
          : '';

      return `İklim · ${HOME_CLIMATE_LAYER_LABELS[climateLayer]}${depthLabel}`;
    }

    return HOME_LAYER_AI_LABELS[requestedLayer];
  };

  const getLayerContext = (requestedLayer: HomeLayer): ActiveLayerContext => {
    const guide = getHomeLayerFarmerGuide(
      requestedLayer,
      soilProperty,
      climateLayer,
    );

    const farmerContext = {
      farmerMeaning: guide.what,
      agriculturalUse: guide.agriculturalUse,
      interpretationGuide: guide.interpretation,
      compareWith: guide.compareWith,
      interpretationCaution: guide.caution,
      sourceLabel: guide.source,
      spatialMode:
        spatialSummary?.layer === requestedLayer ? spatialSummary.mode : null,
      spatialVariability:
        spatialSummary?.layer === requestedLayer
          ? spatialSummary.variability
          : null,
      spatialResolutionMessage:
        spatialSummary?.layer === requestedLayer ? spatialSummary.message : null,
      spatialInterpretationRule:
        spatialSummary?.layer === requestedLayer ? spatialSummary.detail : null,
    };

    if (requestedLayer === 'soil') {
      return {
        ...farmerContext,
        property: soilProperty,
        propertyLabel: HOME_SOIL_PROPERTY_LABELS[soilProperty],
        depth: soilDepth,
        depthLabel: HOME_SOIL_DEPTH_LABELS[soilDepth],
      };
    }

    if (requestedLayer === 'climate') {
      return {
        ...farmerContext,
        climateLayer,
        climateLayerLabel: HOME_CLIMATE_LAYER_LABELS[climateLayer],
        climateDepth:
          climateLayer === 'soil-moisture' || climateLayer === 'soil-temperature'
            ? climateDepth
            : null,
        climateDepthLabel:
          climateLayer === 'soil-moisture' || climateLayer === 'soil-temperature'
            ? HOME_CLIMATE_DEPTH_LABELS[climateDepth]
            : null,
        variable: homeClimateVariable(climateLayer, climateDepth),
      };
    }

    if (requestedLayer === 'surface-temperature') {
      return {
        ...farmerContext,
        climateLayer: 'surface-temperature',
        climateLayerLabel: 'Yüzeye Yakın Toprak Sıcaklığı',
        climateDepth: '0-7cm',
        climateDepthLabel: '0–7 cm',
        variable: 'surface_temperature',
      };
    }

    if (requestedLayer === 'evapotranspiration') {
      return {
        ...farmerContext,
        climateLayer: 'evapotranspiration',
        climateLayerLabel: 'Buharlaşma & Su Talebi (ET₀)',
        climateDepth: null,
        climateDepthLabel: null,
        variable: 'et0_fao_evapotranspiration',
      };
    }

    if (requestedLayer === 'rainfall-history') {
      return {
        ...farmerContext,
        climateLayer: 'rainfall-history',
        climateLayerLabel: 'Yağış Geçmişi',
        climateDepth: null,
        climateDepthLabel: null,
        variable: 'precipitation_sum_30d',
      };
    }

    return {
      ...farmerContext,
      layer: requestedLayer,
      ndviZonalStats:
        requestedLayer === 'vegetation' && ndviStats
          ? {
              source: 'GeoBlaze',
              engine: ndviStats.engine,
              sceneId: ndviStats.sceneId,
              datetime: ndviStats.datetime,
              cloudCover: ndviStats.cloudCover,
              sampleCount: ndviStats.sampleCount,
              mean: ndviStats.mean,
              median: ndviStats.median,
              stdDev: ndviStats.stdDev,
              min: ndviStats.min,
              max: ndviStats.max,
              healthyPercent: ndviStats.healthyPercent,
              moderatePercent: ndviStats.moderatePercent,
              stressedPercent: ndviStats.stressedPercent,
              relativeThreshold: ndviStats.relativeThreshold,
              relativeZones: ndviStats.relativeZones,
            }
          : null,
    };
  };

  const getActiveLayer = (requestedLayer: HomeLayer) => {
    if (
      requestedLayer === 'surface-temperature' ||
      requestedLayer === 'evapotranspiration' ||
      requestedLayer === 'rainfall-history'
    ) {
      return 'climate' as const;
    }

    return requestedLayer;
  };

  useEffect(() => {
    if (!loading) {
      setLoadingDots('.');
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingDots((prev) => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [loading]);

  const runFieldSynthesis = async (input: {
    memoryKey?: string | null;
    sourceAnalysis?: any;
    sourceLayer: HomeLayer;
    sourceLayerLabel: string;
    originRequestId: number;
  }) => {
    if (!field?.id) return;

    const sourceArea = input.sourceAnalysis?.importantArea ?? null;
    const sourceAreaName = String(sourceArea?.area ?? '').trim();
    const areaKey = sourceAreaName || 'no-area';
    const key = `${fieldKey}:${input.sourceLayer}:${
      input.memoryKey ?? 'no-memory'
    }:${areaKey}`;

    if (synthesisSeenRef.current.has(key)) return;
    synthesisSeenRef.current.add(key);

    try {
      const synthesis = await synthesizeFieldObservations({
        fieldId: String(field.id),
        fieldName: field.name ?? undefined,
        crop: field.crop ?? undefined,
        weatherContext: weather ?? null,
        lifecycleContext: {
          cropCycle: field.cropCycle ?? field.crop_cycle ?? null,
          season: Number(field.season) || null,
          plantingYear: Number(field.plantingYear ?? field.planting_year) || null,
          plantingDate: field.plantingDate ?? field.planting_date ?? null,
          harvestDate: field.harvestDate ?? field.harvest_date ?? null,
        },
      });

      if (input.originRequestId !== requestRef.current) {
        synthesisSeenRef.current.delete(key);
        return;
      }

      const alignedSynthesis = sourceAreaName
        ? {
            ...synthesis,
            importantArea: sourceArea,
            headline: `${sourceAreaName} bölümünü öncelikli kontrol et`,
            summary: `Katmanlar birlikte değerlendirildiğinde saha kontrolünde öncelik ${sourceAreaName.toLocaleLowerCase(
              'tr-TR',
            )} bölümünde tutulmalı. ${String(
              sourceArea?.summary || input.sourceAnalysis?.summary || '',
            ).trim()}`.trim(),
            prioritySource: {
              layer: input.sourceLayer,
              label: input.sourceLayerLabel,
            },
          }
        : {
            ...synthesis,
            importantArea: null,
            headline: 'Katmanların genel değerlendirmesi',
          };

      setFieldSynthesis(alignedSynthesis);
      setSynthesisScope(scope);

      if (
        Number(alignedSynthesis?.layerCount ?? 0) >= 2 &&
        (alignedSynthesis?.status !== 'normal' || sourceAreaName)
      ) {
        setArrivalVisible(false);
        window.setTimeout(() => {
          if (input.originRequestId === requestRef.current) {
            setArrivalVisible(true);
          }
        }, 40);
      }
    } catch (synthesisError) {
      synthesisSeenRef.current.delete(key);
      console.warn(
        'Pusula birleşik tarla değerlendirmesi hazırlanamadı:',
        synthesisError,
      );
    }
  };

  const run = async (layerOverride?: HomeLayer, forceRefresh = false) => {
    if (!field?.id) return;

    const requestedLayer = layerOverride ?? layer;
    const requestId = ++requestRef.current;

    setLoading(true);
    setError(null);
    setArrivalVisible(false);

    try {
      const requestedPeriodDays =
        requestedLayer === 'rainfall-history'
          ? 30
          : requestedLayer === 'surface-temperature' ||
              requestedLayer === 'evapotranspiration'
            ? 7
            : 30;

      const [nextResult, knowledgeSources] = await Promise.all([
        refreshFieldContextAndInterpret(field, {
          periodDays: requestedPeriodDays,
          activeLayer: getActiveLayer(requestedLayer),
          activeLayerLabel: getLayerLabel(requestedLayer),
          activeLayerContext: getLayerContext(requestedLayer),
          forceRefresh,
        }),
        loadMapKnowledgeEvidence({
          activeLayer: requestedLayer,
          crop: field.crop ?? null,
          soilProperty,
          climateLayer,
        }),
      ]);

      if (requestId !== requestRef.current) return;

      const enrichedAnalysis = {
        ...nextResult.analysis,
        knowledgeSources,
      };

      setResult({
        ...nextResult,
        analysis: enrichedAnalysis,
        interpretedLayer: requestedLayer,
        interpretedLayerLabel: getLayerLabel(requestedLayer),
      });
      setResultScope(scope);

      void attachKnowledgeEvidenceToObservation(
        nextResult.analysis?.memoryObservationId ?? null,
        knowledgeSources,
      );

      void runFieldSynthesis({
        memoryKey:
          nextResult.analysis?.memoryObservationId ?? nextResult.snapshotId ?? null,
        sourceAnalysis: enrichedAnalysis,
        sourceLayer: requestedLayer,
        sourceLayerLabel: getLayerLabel(requestedLayer),
        originRequestId: requestId,
      });
    } catch (runError) {
      if (requestId !== requestRef.current) return;

      // A failed manual refresh must not erase the last useful field reading.
      // Switching fields/layers still clears it via the scope effect above.
      if (!forceRefresh || resultScope !== scope) {
        setResult(null);
      }
      setError(
        runError instanceof Error
          ? runError.message
          : 'Pusula haritayı yorumlayamadı.',
      );
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!field?.id) return;

    const timer = window.setTimeout(() => {
      void run(layer, false);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [fieldKey, layer, soilProperty, soilDepth, climateLayer, climateDepth, ndviStatsKey]);

  const insight = useMemo<PusulaInsight>(() => {
    const dateKey = String(
      satellite?.latestImageDate || satellite?.generatedAt || fieldKey || 'home',
    ).trim();

    return {
      id: `home:${fieldKey}:${layer}:${dateKey}`,
      gozlem: String(
        visibleResult?.analysis?.importantArea
          ? `${titleCaseEachWordTr(visibleResult.analysis.importantArea.area)} bölümünde: ${visibleResult.analysis.importantArea.summary}`
          : visibleResult?.analysis?.summary ||
              satellite?.summary ||
              `${field?.name ?? 'Tarlan'} için güncel tarla verilerini kontrol ettim.`,
      ),
      yonlendirme: String(
        visibleResult?.analysis?.action ||
          satellite?.recommendations?.[0] ||
          'Uydu, radar, toprak, iklim ve tür gözlemlerini birlikte takip etmeye devam etmeni öneririm.',
      ),
      guven_skoru:
        satellite?.status === 'good' || satellite?.status === 'healthy'
          ? 'Yüksek'
          : 'Orta',
    };
  }, [
    fieldKey,
    layer,
    field?.name,
    satellite?.latestImageDate,
    satellite?.generatedAt,
    satellite?.summary,
    satellite?.recommendations,
    satellite?.status,
    visibleResult,
  ]);

  const activeLayerGuide = getHomeLayerFarmerGuide(
    layer,
    soilProperty,
    climateLayer,
  );

  const layerLabel = getLayerLabel(layer);
  const headline =
    visibleResult?.analysis?.headline ||
    `${layerLabel} haritası için Pusula yorumu hazırlanıyor.`;

  const summary = (() => {
    const raw =
      visibleResult?.analysis?.summary ||
      `${activeLayerGuide.title} katmanı açıldığında Pusula tarlana ait veriyi okuyup önemli gördüğü alanı burada açıklayacak.`;

    const farmerFriendlyRaw = String(raw)
      .replace(/Yüzey & Bitki Farkı/gi, 'Yüzey & Bitki Farkı')
      .replace(/\bDüşük VH\b/gi, 'Daha Benzer Alan')
      .replace(/\bYüksek VH\b/gi, 'Belirgin Fark')
      .replace(/\bVH\b/g, 'Radar Farkı')
      .replace(/\bVV\b/g, 'Radar Yansıması');

    if (layer === 'rainfall-history') {
      return farmerFriendlyRaw
        .replace(
          'Yağış Geçmişi için seçili dönemin ortalaması',
          'Yağış Geçmişi için parsel çevresindeki ortalama toplam yağış',
        )
        .replace(
          'Yağış Geçmişi için seçili dönemde kullanılabilir iklim değeri alınamadı.',
          'Yağış Geçmişi için son 30 güne ait kullanılabilir toplam yağış verisi alınamadı.',
        );
    }

    if (layer === 'evapotranspiration') {
      return farmerFriendlyRaw
        .replace(
          'Evapotranspirasyon / Su İhtiyacı için seçili dönemin ortalaması',
          'Evapotranspirasyon / Su İhtiyacı için parsel çevresindeki ortalama toplam ET₀',
        )
        .replace(
          'Evapotranspirasyon / Su İhtiyacı için seçili dönemde kullanılabilir iklim değeri alınamadı.',
          'Evapotranspirasyon / Su İhtiyacı için son 7 güne ait kullanılabilir ET₀ verisi alınamadı.',
        );
    }

    return farmerFriendlyRaw;
  })();

  return {
    loading,
    result: visibleResult,
    error,
    fieldSynthesis: visibleSynthesis,
    arrivalVisible: arrivalVisible && synthesisScope === scope,
    loadingDots,
    setSpatialSummary,
    run,
    insight,
    activeLayerGuide,
    layerLabel,
    headline,
    summary,
  };
}
