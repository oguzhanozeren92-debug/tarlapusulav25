export type NdviDisplayPercentages = {
  healthy: number;
  moderate: number;
  stressed: number;
  total: 100;
};

function finitePercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
}

/**
 * GeoBlaze yüzdeleri ham halde ondalıklıdır. Üçünü ayrı ayrı Math.round etmek
 * ekranda %99 veya %101 toplam gösterebilir. Kullanıcıya gösterilen değerlerde
 * iyi ve zayıf sınıfları yuvarlanır; orta sınıf kalan yüzde olarak hesaplanır.
 * Böylece üç sınıf her zaman tam %100 eder. Ham analiz değerleri değişmez.
 */
export function getNdviDisplayPercentages(input: {
  healthyPercent?: number | null;
  moderatePercent?: number | null;
  stressedPercent?: number | null;
}): NdviDisplayPercentages {
  const healthyRaw = finitePercent(input.healthyPercent) ?? 0;
  const stressedRaw = finitePercent(input.stressedPercent) ?? 0;
  const moderateRaw =
    finitePercent(input.moderatePercent) ??
    Math.max(0, 100 - healthyRaw - stressedRaw);

  const rawTotal = healthyRaw + moderateRaw + stressedRaw;

  if (rawTotal <= 0) {
    return { healthy: 0, moderate: 0, stressed: 0, total: 100 };
  }

  // Küçük kayan nokta sapmalarını önce tam %100'e ölçekle.
  const healthyNormalized = (healthyRaw / rawTotal) * 100;
  const stressedNormalized = (stressedRaw / rawTotal) * 100;

  const healthy = Math.round(healthyNormalized);
  const stressed = Math.min(100 - healthy, Math.round(stressedNormalized));
  const moderate = 100 - healthy - stressed;

  return {
    healthy,
    moderate,
    stressed,
    total: 100,
  };
}
