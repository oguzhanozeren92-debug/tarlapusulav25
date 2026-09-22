import { useEffect, useState } from 'react';
import { listSoilAnalyses, type SoilAnalysisRecord } from '../../../lib/soilAnalysisService';
import {
  fetchSoilGridsProfile,
  type SoilGridsProfile,
} from '../../../services/soilGridsService';
import {
  buildSoilIntelligence,
  type SoilIntelligenceResult,
} from '../services/soilIntelligence.service';

type SoilGridsState = 'idle' | 'loading' | 'ready' | 'error';

type NutrientContextState = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  latestAnalysis: SoilAnalysisRecord | null;
  soilGridsStatus: SoilGridsState;
  soilGridsProfile: SoilGridsProfile | null;
  soilIntelligence: SoilIntelligenceResult | null;
};

const EMPTY: NutrientContextState = {
  fieldId: '',
  status: 'idle',
  latestAnalysis: null,
  soilGridsStatus: 'idle',
  soilGridsProfile: null,
  soilIntelligence: null,
};

function fieldIdOf(fieldOrId: any) {
  if (fieldOrId == null) return '';
  if (typeof fieldOrId === 'string' || typeof fieldOrId === 'number') {
    return String(fieldOrId).trim();
  }
  return String(fieldOrId?.id ?? '').trim();
}

function fieldCoordinate(field: any, primary: string, fallback: string) {
  if (!field || typeof field !== 'object') return null;
  const value = Number(field?.[primary] ?? field?.[fallback]);
  return Number.isFinite(value) ? value : null;
}

export function useHomeNutrientContext(fieldOrId: any) {
  const fieldId = fieldIdOf(fieldOrId);
  const latitude = fieldCoordinate(fieldOrId, 'parcelCentroidLat', 'latitude');
  const longitude = fieldCoordinate(fieldOrId, 'parcelCentroidLng', 'longitude');
  const [state, setState] = useState<NutrientContextState>(EMPTY);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!fieldId) return;
    const onContextChange = (event: Event) => {
      const detail = (event as CustomEvent<{ fieldId?: string; changedFields?: string[] }>).detail;
      if (String(detail?.fieldId ?? '') === fieldId && detail?.changedFields?.includes('soil_analysis')) {
        setRevision((current) => current + 1);
      }
    };
    window.addEventListener('tp:field-context-updated', onContextChange);
    return () => window.removeEventListener('tp:field-context-updated', onContextChange);
  }, [fieldId]);

  useEffect(() => {
    if (!fieldId || fieldId.startsWith('demo')) return;
    let cancelled = false;
    const controller = new AbortController();
    const hasCoordinates = latitude != null && longitude != null;

    setState({
      fieldId,
      status: 'loading',
      latestAnalysis: null,
      soilGridsStatus: hasCoordinates ? 'loading' : 'idle',
      soilGridsProfile: null,
      soilIntelligence: null,
    });

    void (async () => {
      const [analysisResult, soilResult] = await Promise.allSettled([
        listSoilAnalyses(fieldId),
        hasCoordinates
          ? fetchSoilGridsProfile(latitude, longitude, { signal: controller.signal })
          : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const analyses = analysisResult.status === 'fulfilled' ? analysisResult.value : [];
      const latestAnalysis = analyses[0] ?? null;
      const soilGridsProfile = soilResult.status === 'fulfilled' ? soilResult.value : null;
      const soilGridsStatus: SoilGridsState = !hasCoordinates
        ? 'idle'
        : soilResult.status === 'fulfilled' && soilGridsProfile
          ? 'ready'
          : 'error';

      if (analysisResult.status === 'rejected') {
        console.warn('[TarlaPusula] Besin bağlamı için toprak analizi okunamadı:', analysisResult.reason);
      }
      if (soilResult.status === 'rejected' && !controller.signal.aborted) {
        console.warn('[TarlaPusula] Soil Intelligence için SoilGrids okunamadı:', soilResult.reason);
      }

      const soilIntelligence = buildSoilIntelligence({
        latestAnalysis,
        soilGridsProfile,
        soilGridsStatus,
      });

      setState({
        fieldId,
        status: analysisResult.status === 'fulfilled' ? 'ready' : 'error',
        latestAnalysis,
        soilGridsStatus,
        soilGridsProfile,
        soilIntelligence,
      });
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fieldId, latitude, longitude, revision]);

  return state.fieldId === fieldId && !fieldId.startsWith('demo')
    ? state
    : { ...EMPTY, fieldId };
}
