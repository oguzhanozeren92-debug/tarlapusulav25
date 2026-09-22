import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldNdviTimeSeries } from '../../satellite/hooks/useFieldNdviTimeSeries';
import { isRecentSatelliteObservation } from '../../satellite/services/buildHomeSatelliteDecision';
import {
  analyzeNdviAnomaly,
  cacheNdviAnomaly,
  clearCachedNdviAnomaly,
} from '../../satellite/services/ndviAnomaly.service';
import type { NdviAnomalyResult } from '../../satellite/types/ndviAnomaly';
import { useFieldPhenology } from './useFieldPhenology';
import {
  loadFieldPhenologyContext,
  type FieldPhenologyContext,
} from '../services/fieldPhenologyContext.service';
import { fetchPhenologyClimateShift } from '../services/phenologyClimateShift.service';
import {
  estimateNasaHarvestCropStage,
  fusePhenologyWithNasaHarvest,
} from '../services/nasaHarvestCropStage.service';
import {
  fetchCopernicusHrvppEvidence,
  fusePhenologyWithCopernicusHrvpp,
  type CopernicusHrvppEvidence,
} from '../services/copernicusHrvpp.service';
import type { PhenologyClimateShiftResult } from '../types/phenologyClimateShift';

type ContextState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: FieldPhenologyContext | null;
  message: string | null;
};

type ClimateShiftState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: PhenologyClimateShiftResult | null;
  message: string | null;
};

type HrvppState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: CopernicusHrvppEvidence | null;
  message: string | null;
};

type AnomalyState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: NdviAnomalyResult | null;
  message: string | null;
};

function normalizedCropCycle(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

export function useHomePhenologyInsight(field: any | null | undefined) {
  const { stateByField, load } = useFieldNdviTimeSeries();
  const requestedNdviFieldRef = useRef<string>('');
  const requestedContextRef = useRef<string>('');
  const requestedClimateRef = useRef<string>('');
  const requestedHrvppRef = useRef<string>('');
  const anomalySignatureRef = useRef<string>('');

  const [contextState, setContextState] = useState<ContextState>({
    status: 'idle',
    data: null,
    message: null,
  });
  const [climateShiftState, setClimateShiftState] = useState<ClimateShiftState>({
    status: 'idle',
    data: null,
    message: null,
  });
  const [hrvppState, setHrvppState] = useState<HrvppState>({
    status: 'idle',
    data: null,
    message: null,
  });
  const [anomalyState, setAnomalyState] = useState<AnomalyState>({
    status: 'idle',
    data: null,
    message: null,
  });

  const fieldKey = field?.id != null ? String(field.id) : '';
  const seriesState = fieldKey ? stateByField[fieldKey] : undefined;
  const rawTrend = seriesState?.data?.trend ?? null;
  const timeSeriesPoints =
    seriesState?.status === 'ready' ? seriesState.data?.points ?? [] : [];
  const latestObservationDate = timeSeriesPoints.at(-1)?.date ?? null;
  const observationFresh = isRecentSatelliteObservation(latestObservationDate);

  const ndviTrend = useMemo(
    () =>
      !rawTrend || !observationFresh
        ? null
        : {
            direction:
              rawTrend.quality === 'usable' ? rawTrend.direction : 'unknown',
            quality: rawTrend.quality,
            latestAverage: rawTrend.latestAverage ?? null,
            changeFromPrevious: rawTrend.changeFromPrevious ?? null,
            changeFromFirst: rawTrend.changeFromFirst ?? null,
          },
    [rawTrend, observationFresh],
  );

  const climateShiftDays =
    climateShiftState.data?.status === 'ready'
      ? climateShiftState.data.shiftDays
      : 0;

  const phenologyField = useMemo(() => {
    if (!field) return null;
    const context = contextState.data;
    return {
      ...field,
      cropName: context?.cropName ?? field.cropName ?? field.crop ?? null,
      cropCycle:
        context?.cropCycle ?? field.cropCycle ?? field.crop_cycle ?? null,
      actualHarvestDate:
        context?.actualHarvestDate ??
        field.actualHarvestDate ??
        field.actual_harvest_date ??
        null,
      sowingDate:
        context?.actualPlantingDate ??
        field.sowingDate ??
        field.sowing_date ??
        field.plantingDate ??
        field.planting_date ??
        null,
      phenologySeasonShiftDays: climateShiftDays,
    };
  }, [field, contextState.data, climateShiftDays]);

  const basePhenology = useFieldPhenology(phenologyField, ndviTrend);
  const cropCycle = normalizedCropCycle(
    phenologyField?.cropCycle ?? phenologyField?.crop_cycle,
  );

  const nasaHarvestStage = useMemo(() => {
    // NASA Harvest crop-stage-detection is intended for seasonal row crops /
    // vegetables. Perennial phenology remains on the dedicated perennial path.
    if (
      cropCycle === 'perennial' ||
      seriesState?.status !== 'ready' ||
      !timeSeriesPoints.length
    ) {
      return null;
    }

    return estimateNasaHarvestCropStage(timeSeriesPoints);
  }, [cropCycle, seriesState?.status, timeSeriesPoints]);

  const nasaFusedPhenology = useMemo(
    () => fusePhenologyWithNasaHarvest(basePhenology, nasaHarvestStage),
    [basePhenology, nasaHarvestStage],
  );

  const phenology = useMemo(
    () => fusePhenologyWithCopernicusHrvpp(nasaFusedPhenology, hrvppState.data),
    [nasaFusedPhenology, hrvppState.data],
  );

  useEffect(() => {
    if (!fieldKey) {
      requestedContextRef.current = '';
      setContextState({ status: 'idle', data: null, message: null });
      return;
    }
    if (requestedContextRef.current === fieldKey) return;

    requestedContextRef.current = fieldKey;
    setContextState({ status: 'loading', data: null, message: null });
    let cancelled = false;

    void loadFieldPhenologyContext(field)
      .then((data) => {
        if (!cancelled) {
          setContextState({
            status: 'ready',
            data,
            message: data.needsCropCalendar
              ? 'Ürün evresi kaynak tabanlı ürün takvimiyle hesaplanacak.'
              : null,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (requestedContextRef.current === fieldKey) {
          requestedContextRef.current = '';
        }
        setContextState({
          status: 'error',
          data: null,
          message:
            error instanceof Error
              ? error.message
              : 'Fenoloji bağlamı alınamadı.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, field]);

  useEffect(() => {
    if (!fieldKey) {
      requestedClimateRef.current = '';
      setClimateShiftState({ status: 'idle', data: null, message: null });
      return;
    }
    if (requestedClimateRef.current === fieldKey) return;

    requestedClimateRef.current = fieldKey;
    setClimateShiftState({ status: 'loading', data: null, message: null });
    let cancelled = false;

    void fetchPhenologyClimateShift(field)
      .then((data) => {
        if (!cancelled) {
          setClimateShiftState({
            status: 'ready',
            data,
            message: data.message ?? data.caution,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (requestedClimateRef.current === fieldKey) {
          requestedClimateRef.current = '';
        }
        setClimateShiftState({
          status: 'error',
          data: null,
          message:
            error instanceof Error
              ? error.message
              : 'Fenoloji iklim düzeltmesi alınamadı.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, field]);

  useEffect(() => {
    if (!fieldKey) {
      requestedHrvppRef.current = '';
      setHrvppState({ status: 'idle', data: null, message: null });
      return;
    }
    if (requestedHrvppRef.current === fieldKey) return;

    requestedHrvppRef.current = fieldKey;
    setHrvppState({ status: 'loading', data: null, message: null });
    let cancelled = false;

    void fetchCopernicusHrvppEvidence(fieldKey)
      .then((data) => {
        if (cancelled) return;
        setHrvppState({
          status: 'ready',
          data,
          message:
            data.status === 'ready'
              ? `Copernicus HR-VPP ${data.latest?.year ?? ''} geçmiş fenoloji kanıtı hazır.`.trim()
              : data.warnings[0] ?? 'Copernicus HR-VPP kanıtı bu tarla için kullanılamadı.',
        });
      })
      .catch((error) => {
        if (cancelled) return;
        if (requestedHrvppRef.current === fieldKey) {
          requestedHrvppRef.current = '';
        }
        setHrvppState({
          status: 'error',
          data: null,
          message:
            error instanceof Error
              ? error.message
              : 'Copernicus HR-VPP kanıtı alınamadı.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey]);

  useEffect(() => {
    if (!field?.id || !field?.parcelGeometry) {
      requestedNdviFieldRef.current = '';
      return;
    }

    const key = String(field.id);
    if (requestedNdviFieldRef.current === key) return;
    requestedNdviFieldRef.current = key;

    // NASA Harvest A-E detection needs enough seasonal curve history to confirm
    // whether a peak has already occurred. The former 90-day window was too
    // short for many annual crops, so the same real Sentinel series is now
    // requested over 180 days. No synthetic NDVI value is introduced here.
    void load(field, { daysBack: 180 }).catch((error) => {
      if (requestedNdviFieldRef.current === key) {
        requestedNdviFieldRef.current = '';
      }
      console.warn('[TarlaPusula] NDVI zaman serisi hazırlanamadı:', error);
    });
  }, [fieldKey, field?.parcelGeometry, load, field]);

  useEffect(() => {
    if (!fieldKey || seriesState?.status !== 'ready') {
      anomalySignatureRef.current = '';
      if (fieldKey) clearCachedNdviAnomaly(fieldKey);
      setAnomalyState({ status: 'idle', data: null, message: null });
      return;
    }

    const signature = `${fieldKey}:${timeSeriesPoints
      .map((point) => `${point.date}:${point.average}`)
      .join('|')}`;
    if (anomalySignatureRef.current === signature) return;

    anomalySignatureRef.current = signature;
    setAnomalyState({ status: 'loading', data: null, message: null });
    let cancelled = false;

    void analyzeNdviAnomaly(timeSeriesPoints)
      .then((data) => {
        if (!cancelled) {
          cacheNdviAnomaly(fieldKey, data);
          setAnomalyState({ status: 'ready', data, message: data.reason });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        clearCachedNdviAnomaly(fieldKey);
        if (anomalySignatureRef.current === signature) {
          anomalySignatureRef.current = '';
        }
        setAnomalyState({
          status: 'error',
          data: null,
          message:
            error instanceof Error
              ? error.message
              : 'NDVI anomali analizi alınamadı.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, seriesState?.status, timeSeriesPoints]);

  const trendUsable =
    ndviTrend?.quality === 'usable' && ndviTrend?.direction !== 'unknown';

  return {
    phenology,
    basePhenology,
    nasaHarvestStage,
    nasaHarvestStatus: nasaHarvestStage?.status ?? 'idle',
    copernicusHrvpp: hrvppState.data,
    copernicusHrvppStatus: hrvppState.status,
    copernicusHrvppMessage: hrvppState.message,
    phenologyContext: contextState.data,
    phenologyContextStatus: contextState.status,
    phenologyContextMessage: contextState.message,
    climateShift: climateShiftState.data,
    climateShiftStatus: climateShiftState.status,
    climateShiftMessage: climateShiftState.message,
    climateShiftDays,
    ndviTrend,
    ndviAnomaly: anomalyState.data,
    ndviAnomalyStatus: anomalyState.status,
    ndviAnomalyMessage: anomalyState.message,
    timeSeriesPoints,
    trendUsable,
    timeSeriesStatus: seriesState?.status ?? 'idle',
    timeSeriesMessage:
      latestObservationDate && !observationFresh
        ? 'Son uydu görüntüsü eski; güncel bitki gelişimi yorumunda kullanılmadı.'
        : seriesState?.message ?? seriesState?.data?.message ?? null,
    timeSeriesObservationCount: rawTrend?.observationCount ?? 0,
    timeSeriesSpanDays: rawTrend?.spanDays ?? null,
    timeSeriesLatestDate:
      timeSeriesPoints.map((point) => point.date).sort().at(-1) ?? null,
    phenologyDataStatus: phenology?.dataStatus ?? 'insufficient_data',
    hasUsablePhenology: Boolean(
      phenology &&
        phenology.stage !== 'unknown' &&
        phenology.dataStatus === 'usable',
    ),
    needsCropCalendar: contextState.data?.needsCropCalendar ?? true,
  };
}
