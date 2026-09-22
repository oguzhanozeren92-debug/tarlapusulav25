import { supabase } from '../../../supabaseClient';
import {
  isDualKcShadowAuditFresh,
  loadLatestDualKcShadowAudit,
  summarizeDualKcShadowRange,
} from '../../irrigation/services/dualKcShadow.service';

const PDF_LAYER_ARCHIVE_NAMESPACE = 'pdf-layer-archive-v1';
const RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;

function dateOnly(value: unknown) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function horizonDays(audit: Awaited<ReturnType<typeof loadLatestDualKcShadowAudit>>) {
  const counts = (audit?.scenarios ?? [])
    .map((scenario) => Number((scenario as any)?.dayCount))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!counts.length) return null;
  return counts.every((value) => value === counts[0]) ? counts[0] : null;
}

/**
 * PUSULAPDF worker already consumes pdf-layer-archive-v1. Before creating the
 * report job we mirror the latest independent pyfao56 audit into that same
 * evidence archive. The snapshot is scientific/model evidence only and keeps
 * productionAuthority=false end-to-end.
 */
export async function mirrorLatestIrrigationModelEvidenceForPdf(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return false;

  const audit = await loadLatestDualKcShadowAudit(fieldId);
  if (!audit || !isDualKcShadowAuditFresh(audit)) return false;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return false;

  const observedAt = dateOnly(audit.completedAt);
  if (!observedAt) return false;

  const summary = summarizeDualKcShadowRange(audit);
  if (!summary) return false;

  const layer = 'irrigation-pyfao56-dual-kc';
  const engineVersion = audit.engineVersion ?? 'unknown';
  const sourceKey = [layer, observedAt, engineVersion].join(':');
  const cacheKey = [fieldId, sourceKey].join(':');
  const now = new Date();

  const payload = {
    schemaVersion: 2,
    fieldId,
    layer,
    source: 'pyfao56 Dual-Kc shadow',
    observedAt,
    processingVersion: `pyfao56-${engineVersion}`,
    metrics: {
      rootDepletionMinMm: summary.rootDepletionMm?.min ?? null,
      rootDepletionMaxMm: summary.rootDepletionMm?.max ?? null,
      surfaceDepletionMinMm: summary.surfaceDepletionMm?.min ?? null,
      surfaceDepletionMaxMm: summary.surfaceDepletionMm?.max ?? null,
      stressCoefficientMin: summary.stressCoefficient?.min ?? null,
      stressCoefficientMax: summary.stressCoefficient?.max ?? null,
      actualEtMinMm: summary.actualEtMm?.min ?? null,
      actualEtMaxMm: summary.actualEtMm?.max ?? null,
      scenarioCount: summary.scenarioCount,
      horizonDays: horizonDays(audit),
    },
    details: {
      status: audit.status,
      missingInputs: [...audit.missingInputs],
      engineVersion: audit.engineVersion,
      completedAt: audit.completedAt,
      productionAuthority: false,
      notApplicable: audit.notApplicable,
      error: audit.error,
      note:
        'Bağımsız pyfao56 model kanıtıdır; production sulama reçetesi veya sensör ölçümü değildir.',
    },
    archivedAt: now.toISOString(),
  };

  const { error } = await supabase.from('field_map_layer_cache').upsert(
    {
      user_id: userId,
      field_id: fieldId,
      namespace: PDF_LAYER_ARCHIVE_NAMESPACE,
      cache_key: cacheKey,
      payload,
      data_date: observedAt,
      source_key: sourceKey,
      saved_at: now.toISOString(),
      expires_at: new Date(now.getTime() + RETENTION_MS).toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,field_id,namespace,cache_key' },
  );

  if (error) {
    console.warn('[PUSULAPDF] pyfao56 kanıtı arşive yazılamadı:', error.message);
    return false;
  }

  return true;
}
