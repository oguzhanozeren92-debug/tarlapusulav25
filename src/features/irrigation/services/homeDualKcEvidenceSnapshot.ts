import type { HomeDualKcEvidenceStatus } from '../hooks/useHomeIrrigationDecision';

export type HomeDualKcEvidenceSnapshot = {
  fieldKey: string;
  status: HomeDualKcEvidenceStatus;
  missingInputs: string[];
};

let currentSnapshot: HomeDualKcEvidenceSnapshot = {
  fieldKey: '',
  status: 'idle',
  missingInputs: [],
};

/**
 * Yalnız Home veri-durumu metni için hafif bir projection cache.
 * Sulama karar motoru bu snapshot'ı okumaz; production kararına geri beslenmez.
 */
export function publishHomeDualKcEvidenceSnapshot(
  snapshot: HomeDualKcEvidenceSnapshot,
) {
  currentSnapshot = {
    fieldKey: String(snapshot.fieldKey ?? ''),
    status: snapshot.status,
    missingInputs: [...snapshot.missingInputs],
  };
}

export function readHomeDualKcEvidenceSnapshot() {
  return currentSnapshot;
}
