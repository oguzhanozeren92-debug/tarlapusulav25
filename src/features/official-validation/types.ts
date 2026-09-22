export type OfficialValidationDomain =
  | 'plant_protection'
  | 'fertilizer'
  | 'disaster'
  | 'crop'
  | 'local_research';

export type OfficialVerificationStatus =
  | 'verified'
  | 'needs_check'
  | 'not_found'
  | 'conflict'
  | 'stale';

export type OfficialProgrammaticAccess = 'verified' | 'pending' | 'unavailable';
export type OfficialVerificationMode = 'manual_official_web' | 'api' | 'file_import';

export type OfficialSourceRegistryEntry = {
  provider_key: string;
  domain: OfficialValidationDomain;
  name: string;
  authority: string;
  base_url: string;
  verification_mode: OfficialVerificationMode;
  programmatic_access: OfficialProgrammaticAccess;
  terms_url: string | null;
  notes: string | null;
  enabled: boolean;
  updated_at: string;
};

export type OfficialValidationRecord = {
  id: string;
  provider_key: string;
  provider_record_id: string | null;
  subject_type: string;
  subject_name: string;
  crop: string | null;
  pest_or_disease: string | null;
  active_ingredient: string | null;
  product_name: string | null;
  verification_status: OfficialVerificationStatus;
  source_url: string;
  source_observed_at: string;
  valid_until: string | null;
  source_snapshot: Record<string, unknown>;
};

export type PlantProtectionVerificationQuery = {
  crop?: string | null;
  pestOrDisease?: string | null;
  activeIngredient?: string | null;
  productName?: string | null;
};

export type PlantProtectionOfficialGateState =
  | 'not_required'
  | 'verified'
  | 'needs_official_check'
  | 'conflict'
  | 'stale'
  | 'provider_unavailable';

export type PlantProtectionOfficialGate = {
  state: PlantProtectionOfficialGateState;
  canUseSpecificClaim: boolean;
  providerKey: string | null;
  providerName: string | null;
  officialUrl: string | null;
  checkedAt: string | null;
  reason: string;
  record: OfficialValidationRecord | null;
};
