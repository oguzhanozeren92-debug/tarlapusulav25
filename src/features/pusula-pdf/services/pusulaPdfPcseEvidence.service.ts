import { supabase } from '../../../supabaseClient';
import {
  loadLatestPcsePilotAudit,
  toPcsePilotEvidence,
} from '../../phenology/services/pcsePilotEvidence.service';

const NAMESPACE = 'pdf-layer-archive-v1';
const RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;

function dateOnly(value: unknown) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export async function mirrorLatestPcseEvidenceForPdf(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return false;
  const audit = await loadLatestPcsePilotAudit(fieldId);
  if (!audit) return false;
  const evidence = toPcsePilotEvidence(audit);
  const observedAt = dateOnly(evidence.outputDate ?? audit.completedAt);
  if (!observedAt) return false;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return false;
  const now = new Date();
  const layer = 'phenology-pcse-wofost';
  const sourceKey = [layer, observedAt, audit.engineVersion ?? 'unknown'].join(':');
  const payload = {
    schemaVersion: 1,
    fieldId,
    layer,
    source: 'PCSE WOFOST72_PP',
    observedAt,
    processingVersion: `pcse-${audit.engineVersion ?? 'unknown'}`,
    metrics: { dvs: evidence.dvs },
    details: {
      status: audit.status,
      stage: evidence.stage,
      cropKey: evidence.cropKey,
      varietyKey: evidence.varietyKey,
      plantingDate: evidence.plantingDate,
      outputDate: evidence.outputDate,
      missingInputs: evidence.missingInputs,
      productionAuthority: false,
      waterStressAuthority: false,
      note: evidence.note,
    },
    archivedAt: now.toISOString(),
  };

  const { error } = await supabase.from('field_map_layer_cache').upsert({
    user_id:userId,field_id:fieldId,namespace:NAMESPACE,cache_key:`${fieldId}:${sourceKey}`,
    payload,data_date:observedAt,source_key:sourceKey,saved_at:now.toISOString(),
    expires_at:new Date(now.getTime()+RETENTION_MS).toISOString(),updated_at:now.toISOString(),
  }, { onConflict:'user_id,field_id,namespace,cache_key' });
  if (error) {
    console.warn('[PUSULAPDF] PCSE kanıtı arşive yazılamadı:', error.message);
    return false;
  }
  return true;
}
