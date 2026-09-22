import type {
  OfficialSourceRegistryEntry,
  OfficialValidationRecord,
  PlantProtectionOfficialGate,
  PlantProtectionVerificationQuery,
} from '../types';
import {
  findOfficialPlantProtectionVerification,
  getOfficialSource,
} from './officialValidation.service';

const BKU_PROVIDER_KEY = 'tr_bku';

function hasSpecificClaim(input: PlantProtectionVerificationQuery) {
  return Boolean(
    String(input.productName ?? '').trim()
    || String(input.activeIngredient ?? '').trim()
    || String(input.pestOrDisease ?? '').trim(),
  );
}

function unavailableGate(
  provider: OfficialSourceRegistryEntry | null,
  reason: string,
): PlantProtectionOfficialGate {
  return {
    state: 'provider_unavailable',
    canUseSpecificClaim: false,
    providerKey: provider?.provider_key ?? BKU_PROVIDER_KEY,
    providerName: provider?.name ?? 'Bitki Koruma Ürünleri Veri Tabanı',
    officialUrl: provider?.base_url ?? 'https://bku.tarimorman.gov.tr/',
    checkedAt: null,
    reason,
    record: null,
  };
}

function verifiedGate(
  provider: OfficialSourceRegistryEntry,
  record: OfficialValidationRecord,
): PlantProtectionOfficialGate {
  return {
    state: 'verified',
    canUseSpecificClaim: true,
    providerKey: provider.provider_key,
    providerName: provider.name,
    officialUrl: record.source_url,
    checkedAt: record.source_observed_at,
    reason: 'Spesifik bitki koruma iddiası güncel resmi doğrulama kaydıyla eşleşti.',
    record,
  };
}

/**
 * Spesifik ürün / aktif madde / zararlı iddialarında fail-closed çalışır.
 * BKU için doğrulanmış kayıt yoksa iddia “resmi olarak doğrulandı” kabul edilmez.
 * Programatik BKU erişimi resmi olarak netleşene kadar web scraping yapılmaz.
 */
export async function resolvePlantProtectionOfficialGate(
  input: PlantProtectionVerificationQuery,
): Promise<PlantProtectionOfficialGate> {
  if (!hasSpecificClaim(input)) {
    return {
      state: 'not_required',
      canUseSpecificClaim: true,
      providerKey: null,
      providerName: null,
      officialUrl: null,
      checkedAt: null,
      reason: 'Spesifik bitki koruma ürünü, aktif madde veya zararlı iddiası yok.',
      record: null,
    };
  }

  const provider = await getOfficialSource(BKU_PROVIDER_KEY);
  if (!provider || !provider.enabled) {
    return unavailableGate(provider, 'Türkiye resmi BKU doğrulama sağlayıcısı şu anda etkin değil.');
  }

  const records = await findOfficialPlantProtectionVerification(input, 5);
  const record = records[0] ?? null;
  if (record) return verifiedGate(provider, record);

  if (provider.programmatic_access !== 'verified') {
    return {
      state: 'needs_official_check',
      canUseSpecificClaim: false,
      providerKey: provider.provider_key,
      providerName: provider.name,
      officialUrl: provider.base_url,
      checkedAt: null,
      reason: 'BKU resmi kaynak olarak tanımlı; ancak programatik erişim ve kullanım şartları henüz doğrulanmadığı için bu spesifik iddia otomatik olarak onaylanamaz.',
      record: null,
    };
  }

  return {
    state: 'needs_official_check',
    canUseSpecificClaim: false,
    providerKey: provider.provider_key,
    providerName: provider.name,
    officialUrl: provider.base_url,
    checkedAt: null,
    reason: 'Bu spesifik iddia için güncel resmi BKU doğrulama kaydı bulunamadı.',
    record: null,
  };
}
