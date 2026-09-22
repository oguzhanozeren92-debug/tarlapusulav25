import { supabase } from '../../../supabaseClient';
import type {
  OfficialSourceRegistryEntry,
  OfficialValidationRecord,
  PlantProtectionVerificationQuery,
} from '../types';

function clean(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export async function listOfficialSources(domain?: string) {
  let query = supabase
    .from('official_source_registry')
    .select('*')
    .order('name', { ascending: true });
  if (domain) query = query.eq('domain', domain);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OfficialSourceRegistryEntry[];
}

export async function getOfficialSource(providerKey: string) {
  const { data, error } = await supabase
    .from('official_source_registry')
    .select('*')
    .eq('provider_key', providerKey)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as OfficialSourceRegistryEntry | null;
}

export async function findOfficialPlantProtectionVerification(
  input: PlantProtectionVerificationQuery,
  limit = 10,
) {
  const { data, error } = await supabase.rpc('find_official_plant_protection_verification', {
    p_crop: clean(input.crop),
    p_pest_or_disease: clean(input.pestOrDisease),
    p_active_ingredient: clean(input.activeIngredient),
    p_product_name: clean(input.productName),
    p_limit: Math.max(1, Math.min(limit, 25)),
  });
  if (error) throw error;
  return (data ?? []) as OfficialValidationRecord[];
}
