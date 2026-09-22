import { supabase } from '../../../supabaseClient';

export type DssatShadowSummary = {
  yield_at_maturity_kg_ha?: number | null;
  harvested_yield_kg_ha?: number | null;
  maturity_date_code?: number | string | null;
  harvest_date_code?: number | string | null;
  season_irrigation_mm?: number | null;
  season_precipitation_mm?: number | null;
  season_crop_et_mm?: number | null;
  canopy_biomass_kg_ha?: number | null;
  maximum_lai?: number | null;
  harvest_index?: number | null;
  season_n_uptake_kg_ha?: number | null;
  crop_code?: string | null;
  model?: string | null;
};

export type DssatShadowRunResult = {
  ok: boolean;
  blocked: boolean;
  fieldId: string;
  summary: DssatShadowSummary | null;
  missingInputs: string[];
  note: string | null;
  error: string | null;
};

export async function runDssatShadow(fieldId: string): Promise<DssatShadowRunResult> {
  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) {
    return { ok: false, blocked: true, fieldId: '', summary: null, missingInputs: ['field_id'], note: null, error: 'Tarla kimliği eksik.' };
  }

  const { data, error } = await supabase.functions.invoke('dssat-shadow-run', {
    body: { field_id: normalizedFieldId },
  });

  if (error) {
    return { ok: false, blocked: false, fieldId: normalizedFieldId, summary: null, missingInputs: [], note: null, error: error.message };
  }

  const missingInputs = Array.isArray(data?.missing_inputs) ? data.missing_inputs.map(String) : [];
  return {
    ok: data?.ok === true,
    blocked: data?.blocked === true,
    fieldId: String(data?.field_id ?? normalizedFieldId),
    summary: data?.summary && typeof data.summary === 'object' ? data.summary as DssatShadowSummary : null,
    missingInputs,
    note: data?.note == null ? null : String(data.note),
    error: data?.error == null ? null : String(data.error),
  };
}
