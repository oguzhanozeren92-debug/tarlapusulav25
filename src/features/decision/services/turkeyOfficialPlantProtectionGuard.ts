export type OfficialPlantProtectionStatus =
  | 'verified'
  | 'not_verified'
  | 'unavailable';

export type OfficialPlantProtectionEvidence = {
  status: OfficialPlantProtectionStatus;
  checkedAt: string;
  sourceName: 'T.C. Tarım ve Orman Bakanlığı BKÜ Veri Tabanı';
  sourceUrl: 'https://bku.tarimorman.gov.tr/';
  crop: string | null;
  harmfulOrganism: string | null;
  activeIngredient: string | null;
  productName: string | null;
  note: string;
};

export type PlantProtectionRecommendation = {
  crop?: string | null;
  harmfulOrganism?: string | null;
  activeIngredient?: string | null;
  productName?: string | null;
};

export type PlantProtectionGuardResult = {
  canRecommendChemicalUse: boolean;
  evidence: OfficialPlantProtectionEvidence;
};

const BKU_URL = 'https://bku.tarimorman.gov.tr/' as const;
const BKU_SOURCE = 'T.C. Tarım ve Orman Bakanlığı BKÜ Veri Tabanı' as const;

function clean(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Fail-closed guard for chemical plant-protection recommendations in Türkiye.
 *
 * IMPORTANT: This function intentionally does not infer registration from model
 * knowledge, cached prose, or third-party datasets. A recommendation may only be
 * marked verified after a live/dated official BKÜ lookup supplies matching
 * crop + harmful organism + active ingredient/product evidence.
 *
 * Until the BKÜ integration supplies that evidence, chemical-use advice must be
 * withheld and the user should be directed to the official database / authorised
 * local agronomy channel. Diagnostic and non-chemical agronomic guidance can
 * still be shown independently.
 */
export function guardTurkeyPlantProtectionRecommendation(
  recommendation: PlantProtectionRecommendation,
  verifiedOfficialMatch?: boolean,
  checkedAt = new Date().toISOString(),
): PlantProtectionGuardResult {
  const crop = clean(recommendation.crop);
  const harmfulOrganism = clean(recommendation.harmfulOrganism);
  const activeIngredient = clean(recommendation.activeIngredient);
  const productName = clean(recommendation.productName);

  const hasTarget = Boolean(crop && harmfulOrganism);
  const hasTreatment = Boolean(activeIngredient || productName);
  const verified = verifiedOfficialMatch === true && hasTarget && hasTreatment;

  return {
    canRecommendChemicalUse: verified,
    evidence: {
      status: verified ? 'verified' : 'not_verified',
      checkedAt,
      sourceName: BKU_SOURCE,
      sourceUrl: BKU_URL,
      crop,
      harmfulOrganism,
      activeIngredient,
      productName,
      note: verified
        ? 'Bitki + zararlı organizma + aktif madde/ürün eşleşmesi resmi BKÜ kaynağıyla doğrulandı.'
        : 'Resmi BKÜ eşleşmesi doğrulanmadan kimyasal ürün, aktif madde veya doz önerisi üretilemez.',
    },
  };
}

export function buildOfficialVerificationRequiredMessage(): string {
  return 'Kimyasal mücadele önerisi için güncel ruhsat/tavsiye kaydı T.C. Tarım ve Orman Bakanlığı BKÜ Veri Tabanı üzerinden doğrulanmalıdır.';
}
