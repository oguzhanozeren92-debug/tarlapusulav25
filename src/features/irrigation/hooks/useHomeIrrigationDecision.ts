import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  IrrigationDecisionResult,
  IrrigationDecisionSynthesis,
} from '../types/irrigationDecision';
import {
  isDualKcShadowAuditFresh,
  loadLatestDualKcShadowAudit,
  runDualKcShadowEvidenceBestEffort,
  type DualKcShadowAudit,
} from '../services/dualKcShadow.service';
import {
  publishHomeDualKcEvidenceSnapshot,
} from '../services/homeDualKcEvidenceSnapshot';
import { attachDualKcEvidence } from '../services/irrigationModelEvidence.service';
import { loadDualKcRuntimeValidation } from '../services/dualKcRuntimeValidation.service';
import type { DualKcValidationHistory } from '../services/dualKcValidationHistory.service';
import { persistDualKcProductionComparison } from '../services/dualKcProductionComparison.service';
import {
  isAquaCropPilotAuditFresh,
  loadLatestAquaCropPilotAudit,
  runAquaCropPilotEvidenceBestEffort,
  type AquaCropPilotAudit,
} from '../services/aquaCropPilotEvidence.service';
import { attachAquaCropPilotEvidence } from '../services/irrigationAquaCropEvidenceAttach.service';
import {
  attachIrrigationSynthesis,
  resolveIrrigationSynthesis,
} from '../services/irrigationSynthesis.service';
import { syncIrrigationSynthesisVerificationTaskBestEffort } from '../../tasks/services/fieldTasks.service';
import {
  buildIrrigationWhatIf,
  type IrrigationWhatIfResult,
} from '../services/irrigationWhatIf.service';

type HomeIrrigationDecisionState = {
  fieldKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: IrrigationDecisionResult | null;
  error: string | null;
};

export type HomeDualKcEvidenceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'waiting'
  | 'not_applicable'
  | 'error';

type HomeDualKcEvidenceState = {
  fieldKey: string;
  status: HomeDualKcEvidenceStatus;
  missingInputs: string[];
  audit: DualKcShadowAudit | null;
};

type HomeIrrigationSynthesisState = {
  fieldKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: IrrigationDecisionSynthesis | null;
};

const INITIAL_STATE: HomeIrrigationDecisionState = {
  fieldKey: '',
  status: 'idle',
  data: null,
  error: null,
};

const INITIAL_EVIDENCE_STATE: HomeDualKcEvidenceState = {
  fieldKey: '',
  status: 'idle',
  missingInputs: [],
  audit: null,
};

const INITIAL_SYNTHESIS_STATE: HomeIrrigationSynthesisState = {
  fieldKey: '',
  status: 'idle',
  data: null,
};

/**
 * Ana ekran için hata-izole Irrigation Engine köprüsü.
 *
 * Irrigation service zinciri dinamik import edilir. Böylece kök bölgesi/Kc/
 * fenoloji gibi alt bağımlılıklardan biri yüklenemezse HomeScreen beyaz ekrana
 * düşmez; hook error durumuna geçer ve ortak karar motoru hava-tabanlı güvenli
 * fallback ile çalışmaya devam eder.
 *
 * pyfao56 ve AquaCrop üretim kararının yerine geçmez. Production sulama
 * motoru korunur; bu hook güncel fenoloji/Kc + pyfao56 + AquaCrop kanıtlarını
 * tek açıklanabilir sentezde birleştirir.
 */
export function useHomeIrrigationDecision(field: any | null | undefined) {
  const fieldKey = field?.id != null ? String(field.id) : '';
  const isDemo = Boolean(field?.demo);
  const irrigationStatus = String(field?.irrigationStatus ?? '').trim().toLowerCase();
  const isRainfed = irrigationStatus === 'rainfed';
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<HomeIrrigationDecisionState>(INITIAL_STATE);
  const [evidenceState, setEvidenceState] = useState<HomeDualKcEvidenceState>(INITIAL_EVIDENCE_STATE);
  const [aquaCropAudit, setAquaCropAudit] = useState<AquaCropPilotAudit | null>(null);
  const [dualKcValidationHistory, setDualKcValidationHistory] = useState<DualKcValidationHistory | null>(null);
  const [synthesisState, setSynthesisState] = useState<HomeIrrigationSynthesisState>(INITIAL_SYNTHESIS_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey || isDemo) {
      setState(INITIAL_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState({
      fieldKey,
      status: 'loading',
      data: null,
      error: null,
    });

    void (async () => {
      try {
        const irrigationModule = await import(
          '../services/irrigationDecision.service'
        );

        if (typeof irrigationModule.calculateIrrigationDecision !== 'function') {
          throw new Error('Sulama Motoru servisi yüklenemedi.');
        }

        const result = await irrigationModule.calculateIrrigationDecision({
          id: fieldKey,
        });

        if (cancelled) return;

        console.info('[TarlaPusula] Sulama Motoru sonucu:', {
          fieldKey,
          decision: result?.decision ?? null,
          irrigationStatus: result?.irrigationStatus ?? null,
          confidence: result?.confidence ?? null,
        });

        setState({
          fieldKey,
          status: 'ready',
          data: result,
          error: null,
        });
      } catch (error: unknown) {
        if (cancelled) return;

        const message =
          error instanceof Error
            ? error.message
            : 'Sulama kararı hazırlanamadı.';

        console.warn('[TarlaPusula] Sulama Motoru sonucu alınamadı:', error);
        setState({
          fieldKey,
          status: 'error',
          data: null,
          error: message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fieldKey, isDemo, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey || isDemo) {
      setEvidenceState(INITIAL_EVIDENCE_STATE);
      return () => {
        cancelled = true;
      };
    }

    if (isRainfed) {
      setEvidenceState({
        fieldKey,
        status: 'not_applicable',
        missingInputs: [],
        audit: null,
      });
      return () => {
        cancelled = true;
      };
    }

    const loadEvidence = async () => {
      setEvidenceState((current) => ({
        fieldKey,
        status: current.fieldKey === fieldKey && current.status !== 'idle'
          ? current.status
          : 'loading',
        missingInputs: current.fieldKey === fieldKey ? current.missingInputs : [],
        audit: current.fieldKey === fieldKey ? current.audit : null,
      }));

      try {
        const audit = await loadLatestDualKcShadowAudit(fieldKey);
        if (cancelled) return;

        if (!audit) {
          setEvidenceState({ fieldKey, status: 'waiting', missingInputs: [], audit: null });
          // İlk ziyaretlerde audit henüz yoksa arka planda gerçek girdilerle üretmeyi dene.
          runDualKcShadowEvidenceBestEffort(fieldKey);
          runAquaCropPilotEvidenceBestEffort(fieldKey, { force: true });
          return;
        }

        const staleCompletedAudit =
          audit.status === 'completed' && !isDualKcShadowAuditFresh(audit);

        setEvidenceState({
          fieldKey,
          status:
            audit.notApplicable
              ? 'not_applicable'
              : staleCompletedAudit
                ? 'loading'
                : audit.status === 'completed'
                  ? 'ready'
                  : audit.status === 'failed'
                    ? 'error'
                    : audit.status === 'running' || audit.status === 'queued'
                      ? 'loading'
                      : 'waiting',
          missingInputs: audit.missingInputs,
          audit,
        });

        // Güncelliğini yitirmiş model çıktısı Bugün kararına kanıt olarak sokulmaz.
        // Yeni hava/saha girdileriyle arka planda tekrar çalıştırılır.
        if (staleCompletedAudit) {
          runDualKcShadowEvidenceBestEffort(fieldKey);
        }
      } catch {
        if (cancelled) return;
        setEvidenceState({ fieldKey, status: 'error', missingInputs: [], audit: null });
      }
    };

    void loadEvidence();

    const handleEvidenceUpdated = (event: Event) => {
      const changedFieldId = String((event as CustomEvent)?.detail?.fieldId ?? '');
      if (changedFieldId !== fieldKey) return;
      void loadEvidence();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(
        'tp:dual-kc-shadow-updated',
        handleEvidenceUpdated as EventListener,
      );
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'tp:dual-kc-shadow-updated',
          handleEvidenceUpdated as EventListener,
        );
      }
    };
  }, [fieldKey, isDemo, isRainfed, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    if (!fieldKey || isDemo) {
      setAquaCropAudit(null);
      return () => { cancelled = true; };
    }

    const loadAquaCrop = async () => {
      try {
        const audit = await loadLatestAquaCropPilotAudit(fieldKey);
        if (!cancelled) {
          setAquaCropAudit(audit);
          const staleCompletedAudit =
            audit?.status === 'completed' && !isAquaCropPilotAuditFresh(audit);
          if (!audit || staleCompletedAudit) {
            // Best-effort guard aynı eski cached sonucu olay döngüsünde tekrar tekrar çalıştırmaz.
            runAquaCropPilotEvidenceBestEffort(fieldKey);
          }
        }
      } catch {
        if (!cancelled) setAquaCropAudit(null);
      }
    };
    void loadAquaCrop();

    const handleUpdated = (event: Event) => {
      const changedFieldId = String((event as CustomEvent)?.detail?.fieldId ?? '');
      if (changedFieldId === fieldKey) void loadAquaCrop();
    };
    window.addEventListener('tp:aquacrop-pilot-updated', handleUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('tp:aquacrop-pilot-updated', handleUpdated as EventListener);
    };
  }, [fieldKey, isDemo, refreshKey]);

  useEffect(() => {
    if (!fieldKey || isDemo || typeof window === 'undefined') return;

    const handleFieldContextUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      const changedFieldId = String(detail?.fieldId ?? '');
      const changedFields = Array.isArray(detail?.changedFields)
        ? detail.changedFields.map((item: unknown) => String(item))
        : [];

      if (changedFieldId !== fieldKey) return;

      const irrigationRelevant = [
        'irrigation_status',
        'irrigation_method',
        'canopy_development_class',
        'canopy_height_class',
        'canopy_cover_percent',
        'canopy_height_m',
        'bearing',
        'crop',
        'crop_cycle',
        'season',
        'planting_year',
        'sowing_date',
        'planting_date',
        'parcel_geometry',
        'activities',
        'irrigation_history',
      ];

      if (
        changedFields.length > 0 &&
        !changedFields.some((name) => irrigationRelevant.includes(name))
      ) {
        return;
      }

      setRefreshKey((value) => value + 1);
      runDualKcShadowEvidenceBestEffort(fieldKey);
      runAquaCropPilotEvidenceBestEffort(fieldKey, { force: true });
    };

    window.addEventListener(
      'tp:field-context-updated',
      handleFieldContextUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-context-updated',
        handleFieldContextUpdated as EventListener,
      );
    };
  }, [fieldKey, isDemo]);

  const refresh = useCallback(() => {
    if (!fieldKey || isDemo) return;
    setRefreshKey((value) => value + 1);
    runDualKcShadowEvidenceBestEffort(fieldKey);
    runAquaCropPilotEvidenceBestEffort(fieldKey, { force: true });
  }, [fieldKey, isDemo]);

  const stateBelongsToField = state.fieldKey === fieldKey;
  const evidenceBelongsToField = evidenceState.fieldKey === fieldKey;
  const rawResult = stateBelongsToField ? state.data : null;
  const currentAudit = evidenceBelongsToField ? evidenceState.audit : null;

  useEffect(() => {
    if (!fieldKey || isDemo || isRainfed || !rawResult || !currentAudit) return;
    if (currentAudit.status !== 'completed' || currentAudit.comparison) return;

    void persistDualKcProductionComparison({
      decision: rawResult,
      audit: currentAudit,
    }).then((saved) => {
      if (saved) setRefreshKey((value) => value + 1);
    }).catch((error) => {
      console.warn('[TarlaPusula] Dual-Kc production snapshot kaydedilemedi:', error);
    });
  }, [fieldKey, isDemo, isRainfed, rawResult, currentAudit]);

  useEffect(() => {
    let cancelled = false;
    if (!fieldKey || isDemo || !rawResult || isRainfed) {
      setDualKcValidationHistory(null);
      return () => { cancelled = true; };
    }

    void loadDualKcRuntimeValidation({ fieldId: fieldKey, decision: rawResult })
      .then((history) => {
        if (!cancelled) setDualKcValidationHistory(history);
      })
      .catch((error) => {
        console.warn('[TarlaPusula] Dual-Kc validation history alınamadı:', error);
        if (!cancelled) setDualKcValidationHistory(null);
      });

    return () => { cancelled = true; };
  }, [fieldKey, isDemo, isRainfed, rawResult, currentAudit, refreshKey]);

  const evidenceResult = useMemo(() => {
    const dualKc = attachDualKcEvidence(rawResult, currentAudit, dualKcValidationHistory);
    return attachAquaCropPilotEvidence(dualKc, aquaCropAudit);
  }, [rawResult, currentAudit, aquaCropAudit, dualKcValidationHistory]);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey || isDemo || !evidenceResult) {
      setSynthesisState(INITIAL_SYNTHESIS_STATE);
      return () => {
        cancelled = true;
      };
    }

    setSynthesisState((current) => ({
      fieldKey,
      status: current.fieldKey === fieldKey && current.data ? 'ready' : 'loading',
      data: current.fieldKey === fieldKey ? current.data : null,
    }));

    void resolveIrrigationSynthesis(evidenceResult)
      .then((data) => {
        if (cancelled) return;
        setSynthesisState({ fieldKey, status: 'ready', data });
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[TarlaPusula] Sulama sentezi hazırlanamadı:', error);
        setSynthesisState({ fieldKey, status: 'error', data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldKey, isDemo, evidenceResult, refreshKey]);

  const synthesisBelongsToField = synthesisState.fieldKey === fieldKey;
  const result = useMemo(
    () => attachIrrigationSynthesis(
      evidenceResult,
      synthesisBelongsToField ? synthesisState.data : null,
    ),
    [evidenceResult, synthesisBelongsToField, synthesisState.data],
  );

  useEffect(() => {
    if (!fieldKey || isDemo) return;
    syncIrrigationSynthesisVerificationTaskBestEffort(
      fieldKey,
      result?.synthesis ?? null,
    );
  }, [fieldKey, isDemo, result?.synthesis?.agreement, result?.synthesis?.generatedAt]);

  const whatIf: IrrigationWhatIfResult | null = useMemo(
    () => (result ? buildIrrigationWhatIf(result) : null),
    [result],
  );

  const modelEvidence: HomeDualKcEvidenceState = evidenceBelongsToField
    ? evidenceState
    : fieldKey
      ? {
          fieldKey,
          status: isRainfed ? 'not_applicable' : 'loading',
          missingInputs: [],
          audit: null,
        }
      : INITIAL_EVIDENCE_STATE;

  publishHomeDualKcEvidenceSnapshot(modelEvidence);

  return {
    result,
    decision: result,
    status: stateBelongsToField ? state.status : fieldKey ? 'loading' : 'idle',
    loading: stateBelongsToField ? state.status === 'loading' : Boolean(fieldKey),
    error: stateBelongsToField ? state.error : null,
    modelEvidence,
    synthesis: result?.synthesis ?? null,
    synthesisStatus: synthesisBelongsToField ? synthesisState.status : 'idle',
    whatIf,
    refresh,
  };
}