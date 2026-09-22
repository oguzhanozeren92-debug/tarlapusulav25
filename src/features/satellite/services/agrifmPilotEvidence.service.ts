import { supabase } from '../../../lib/supabase';

export type AgriFmPilotStatus = {
  status: 'blocked' | 'ready';
  fieldId: string;
  productionAuthority: false;
  evidenceScope: 'research_only';
  cubeContract: 'sentinel2_l2a_temporal_cube_v1';
  inputContractVersion: 2;
  missing: string[];
};

export async function getAgriFmPilotStatus(fieldId: string): Promise<AgriFmPilotStatus> {
  const normalized = fieldId.trim();
  if (!normalized) throw new Error('fieldId is required');
  const { data, error } = await supabase.functions.invoke('agrifm-pilot-inputs', { body: { field_id: normalized } });
  const payload = (data ?? {}) as Record<string, unknown>;
  if (!error && payload.ok === true) {
    throw new Error('AgriFM input adapter must remain fail-closed until the temporal cube gate is implemented.');
  }
  return {
    status: 'blocked',
    fieldId: normalized,
    productionAuthority: false,
    evidenceScope: 'research_only',
    cubeContract: 'sentinel2_l2a_temporal_cube_v1',
    inputContractVersion: 2,
    missing: Array.isArray(payload.missing) ? payload.missing.map(String) : ['server_side_multiband_temporal_cube_adapter'],
  };
}
