import { supabase } from '../../../supabaseClient';
import {
  loadLatestAquaCropPilotAudit,
  toAquaCropPilotEvidence,
} from '../../irrigation/services/aquaCropPilotEvidence.service';

const NAMESPACE = 'pdf-layer-archive-v1';
const RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;

function dateOnly(value: unknown) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export async function mirrorLatestAquaCropEvidenceForPdf(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return false;
  const audit = await loadLatestAquaCropPilotAudit(fieldId);
  if (!audit) return false;
  const evidence = toAquaCropPilotEvidence(audit);
  // Archive only a fresh, trust-validated completed pilot. Blocked, failed,
  // stale or legacy/untrusted rows must never become durable PDF evidence.
  if (evidence.status !== 'ready' || evidence.productionAuthority !== false) return false;
  if (audit.inputSummary?.server_derived !== true) return false;
  const observedAt = dateOnly(audit.completedAt);
  if (!observedAt || !audit.completedAt || !Number.isFinite(Date.parse(audit.completedAt))) return false;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return false;

  const now = new Date();
  const completedMs = Date.parse(audit.completedAt!);
  if (now.getTime() - completedMs > 36 * 60 * 60 * 1000 || completedMs > now.getTime() + 60_000) return false;
  const layer = 'irrigation-aquacrop-pilot';
  const fingerprints = audit.sourceVersions?.fingerprints as Record<string, unknown> | undefined;
  const fingerprintParts = ['weather', 'soil', 'initial_water', 'irrigation_management']
    .map((key) => String(fingerprints?.[key] ?? ''));
  if (fingerprintParts.some((value) => !/^[a-f0-9]{64}$/.test(value))) return false;
  const provenanceHash = fingerprintParts.map((value) => value.slice(0, 16)).join('-');
  const sourceKey = [layer, observedAt, audit.engineVersion ?? 'unknown', provenanceHash].join(':');
  const payload = {
    schemaVersion: 2,
    fieldId,
    layer,
    source: 'AquaCrop pilot',
    observedAt,
    processingVersion: `aquacrop-${audit.engineVersion ?? 'unknown'}`,
    metrics: {
      weatherDays: evidence.weatherDays,
      soilLayerCount: evidence.soilLayerCount,
      initialWaterLayerCount: evidence.initialWaterLayerCount,
      initialWaterMethod: 'Depth',
      initialWaterDepthSemantics: 'measured_interval_midpoints',
      dailyOutputIntegrity: 'exact_zero_based_time_step_counter',
      outputScope: 'water_balance_evidence_only',
      initialWaterCoherenceHours: Number(audit.inputSummary?.initial_water_coherence_hours ?? 0) || null,
      serverDerivedInputs: audit.inputSummary?.server_derived === true,
    },
    details: {
      status: audit.status,
      missingInputs: evidence.missingInputs,
      cropModelKey: evidence.cropModelKey,
      simulationStart: evidence.simulationStart,
      simulationEnd: evidence.simulationEnd,
      plantingDate: String(audit.inputSummary?.simulation_start ?? '') || null,
      weatherDays: evidence.weatherDays,
      soilLayerCount: evidence.soilLayerCount,
      initialWaterLayerCount: evidence.initialWaterLayerCount,
      irrigationMode: evidence.irrigationMode,
      modelPayloadBytes: Number(audit.inputSummary?.model_payload_bytes ?? 0) || null,
      inputFingerprintVerified: true,
      productionAuthority: false,
      irrigationPrescriptionAuthority: false,
      yieldAuthority: false,
      evidenceScope: 'season_scale_validation_only',
      contractVersion: 8,
      sourceVersions: audit.sourceVersions,
      provenanceFingerprint: provenanceHash,
      inputFingerprints: {
        weather: fingerprintParts[0],
        soil: fingerprintParts[1],
        initialWater: fingerprintParts[2],
        irrigationManagement: fingerprintParts[3],
      },
      engineVersion: audit.engineVersion,
      inputAdapterVersion: Number(audit.sourceVersions?.input_adapter_version ?? 0) || null,
      runAdapterVersion: Number(audit.sourceVersions?.run_adapter_version ?? 0) || null,
      cropParameterSourceCommit: String(audit.sourceVersions?.crop_parameter_source_commit ?? '') || null,
      runtimePackage: String(audit.sourceVersions?.aquacrop_runtime_package ?? '') || null,
      weatherSource: String(audit.sourceVersions?.weather ?? '') || null,
      weatherTimezone: String(audit.sourceVersions?.weather_timezone ?? '') || null,
      weatherAdapterContractVersion: Number(audit.sourceVersions?.weather_adapter_contract_version ?? 0) || null,
      weatherVariables: Array.isArray(audit.sourceVersions?.weather_variables) ? audit.sourceVersions.weather_variables : [],
      soilAssumptions: Array.isArray(audit.sourceVersions?.soil_assumptions) ? audit.sourceVersions.soil_assumptions : [],
      soilWarnings: Array.isArray(audit.sourceVersions?.soil_warnings) ? audit.sourceVersions.soil_warnings : [],
      soilAdapterContractVersion: Number(audit.sourceVersions?.soil_adapter_contract_version ?? 0) || null,
      soilPedotransferMethod: String(audit.sourceVersions?.soil_pedotransfer_method ?? '') || null,
      note: evidence.note,
    },
    archivedAt: now.toISOString(),
    immutableEvidence: true,
  };

  const { error } = await supabase.from('field_map_layer_cache').upsert({
    user_id: userId,
    field_id: fieldId,
    namespace: NAMESPACE,
    cache_key: `${fieldId}:${sourceKey}`,
    payload,
    data_date: observedAt,
    source_key: sourceKey,
    saved_at: now.toISOString(),
    expires_at: new Date(now.getTime() + RETENTION_MS).toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id,field_id,namespace,cache_key' });

  if (error) {
    console.warn('[PUSULAPDF] AquaCrop kanıtı arşive yazılamadı:', error.message);
    return false;
  }
  return true;
}
