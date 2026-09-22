export type CanopyDevelopmentClass =
  | 'very_small'
  | 'small'
  | 'medium'
  | 'large'
  | 'very_large';

export type CanopyHeightClass =
  | 'under_1m'
  | '1_2m'
  | '2_3m'
  | '3_5m'
  | 'over_5m';

export type CanopyDevelopmentOption = {
  value: CanopyDevelopmentClass;
  label: string;
  modeledCoverPercent: number;
};

export type CanopyHeightOption = {
  value: CanopyHeightClass;
  label: string;
  modeledHeightM: number;
};

export const CANOPY_DEVELOPMENT_OPTIONS: CanopyDevelopmentOption[] = [
  {
    value: 'very_small',
    label: 'Çok küçük / seyrek taçlı',
    modeledCoverPercent: 15,
  },
  {
    value: 'small',
    label: 'Küçük taçlı',
    modeledCoverPercent: 30,
  },
  {
    value: 'medium',
    label: 'Orta gelişmiş',
    modeledCoverPercent: 50,
  },
  {
    value: 'large',
    label: 'Geniş taçlı',
    modeledCoverPercent: 70,
  },
  {
    value: 'very_large',
    label: 'Çok geniş / birbirine yaklaşmış',
    modeledCoverPercent: 85,
  },
];

export const CANOPY_HEIGHT_OPTIONS: CanopyHeightOption[] = [
  {
    value: 'under_1m',
    label: '1 m’den kısa',
    modeledHeightM: 0.75,
  },
  {
    value: '1_2m',
    label: '1–2 m',
    modeledHeightM: 1.5,
  },
  {
    value: '2_3m',
    label: '2–3 m',
    modeledHeightM: 2.5,
  },
  {
    value: '3_5m',
    label: '3–5 m',
    modeledHeightM: 4,
  },
  {
    value: 'over_5m',
    label: '5 m üzeri',
    modeledHeightM: 6,
  },
];

type AgeBand = {
  maxAge: number;
  development: CanopyDevelopmentClass;
};

type OrchardAgeProfile = {
  cropKey: string;
  aliases: string[];
  ageBands: AgeBand[];
};

/*
 * Bu profiller tarımsal "ölçüm" değildir.
 * Sadece dikim yılından kullanıcıya başlangıç seçeneği önermek için kullanılan
 * ihtiyatlı ürün-spesifik UI öncelikleridir. Kullanıcı seçimi her zaman üstündür.
 *
 * Hesap motoru bu yaş tahminini doğrudan Kc olarak KULLANMAZ.
 */
const ORCHARD_AGE_PROFILES: OrchardAgeProfile[] = [
  {
    cropKey: 'pistachio',
    aliases: [
      'antep fıstığı',
      'antepfıstığı',
      'antep fistigi',
      'antepfistigi',
      'fıstık',
      'fistik',
      'pistachio',
    ],
    ageBands: [
      { maxAge: 2, development: 'very_small' },
      { maxAge: 5, development: 'small' },
      { maxAge: 9, development: 'medium' },
      { maxAge: 14, development: 'large' },
      { maxAge: Number.POSITIVE_INFINITY, development: 'very_large' },
    ],
  },
  {
    cropKey: 'almond',
    aliases: ['badem', 'almond'],
    ageBands: [
      { maxAge: 1, development: 'very_small' },
      { maxAge: 3, development: 'small' },
      { maxAge: 5, development: 'medium' },
      { maxAge: 8, development: 'large' },
      { maxAge: Number.POSITIVE_INFINITY, development: 'very_large' },
    ],
  },
  {
    cropKey: 'cherry',
    aliases: ['kiraz', 'cherry', 'cherries'],
    ageBands: [
      { maxAge: 1, development: 'very_small' },
      { maxAge: 3, development: 'small' },
      { maxAge: 5, development: 'medium' },
      { maxAge: 8, development: 'large' },
      { maxAge: Number.POSITIVE_INFINITY, development: 'very_large' },
    ],
  },
  {
    cropKey: 'walnut',
    aliases: ['ceviz', 'walnut', 'walnuts'],
    ageBands: [
      { maxAge: 2, development: 'very_small' },
      { maxAge: 5, development: 'small' },
      { maxAge: 8, development: 'medium' },
      { maxAge: 12, development: 'large' },
      { maxAge: Number.POSITIVE_INFINITY, development: 'very_large' },
    ],
  },
];

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export function isTreeOrchardCanopyCrop(cropName: unknown) {
  const normalized = normalizeText(cropName);

  return ORCHARD_AGE_PROFILES.some((profile) =>
    profile.aliases.some((alias) => normalizeText(alias) === normalized),
  );
}

export function getCanopyDevelopmentLabel(
  value: unknown,
): string | null {
  const match = CANOPY_DEVELOPMENT_OPTIONS.find(
    (item) => item.value === value,
  );

  return match?.label ?? null;
}

export function getCanopyHeightLabel(
  value: unknown,
): string | null {
  const match = CANOPY_HEIGHT_OPTIONS.find(
    (item) => item.value === value,
  );

  return match?.label ?? null;
}

export function getModeledCanopyCoverPercent(
  value: unknown,
): number | null {
  const match = CANOPY_DEVELOPMENT_OPTIONS.find(
    (item) => item.value === value,
  );

  return match?.modeledCoverPercent ?? null;
}

export function getModeledCanopyHeightM(
  value: unknown,
): number | null {
  const match = CANOPY_HEIGHT_OPTIONS.find(
    (item) => item.value === value,
  );

  return match?.modeledHeightM ?? null;
}

export function estimateCanopyDevelopmentFromAge(input: {
  cropName: unknown;
  plantingYear: unknown;
  now?: Date;
}) {
  const normalized = normalizeText(input.cropName);
  const plantingYear = Number(input.plantingYear);

  if (
    !Number.isInteger(plantingYear) ||
    plantingYear < 1900 ||
    plantingYear > 2200
  ) {
    return null;
  }

  const profile = ORCHARD_AGE_PROFILES.find((candidate) =>
    candidate.aliases.some(
      (alias) => normalizeText(alias) === normalized,
    ),
  );

  if (!profile) {
    return null;
  }

  const year = (input.now ?? new Date()).getFullYear();
  const age = Math.max(0, year - plantingYear);

  const band =
    profile.ageBands.find((item) => age <= item.maxAge) ??
    profile.ageBands[profile.ageBands.length - 1];

  if (!band) {
    return null;
  }

  return {
    cropKey: profile.cropKey,
    age,
    plantingYear,
    suggestedDevelopment: band.development,
    suggestedLabel:
      getCanopyDevelopmentLabel(band.development) ??
      'Orta gelişmiş',
    caution:
      'Bu yalnızca dikim yılına göre başlangıç tahminidir; bakım, sulama, budama, toprak, çeşit ve dikim aralığı gerçek taç gelişimini değiştirebilir.',
  };
}

export function resolveCanopyModelInput(input: {
  canopyCoverPercent?: unknown;
  canopyHeightM?: unknown;
  canopyDevelopmentClass?: unknown;
  canopyHeightClass?: unknown;
}) {
  const directCover = Number(input.canopyCoverPercent);
  const directHeight = Number(input.canopyHeightM);

  const canopyCoverPercent =
    Number.isFinite(directCover) &&
    directCover >= 0 &&
    directCover <= 100
      ? directCover
      : getModeledCanopyCoverPercent(
          input.canopyDevelopmentClass,
        );

  const canopyHeightM =
    Number.isFinite(directHeight) &&
    directHeight > 0
      ? directHeight
      : getModeledCanopyHeightM(
          input.canopyHeightClass,
        );

  return {
    canopyCoverPercent,
    canopyHeightM,
    coverSource:
      Number.isFinite(directCover) &&
      directCover >= 0 &&
      directCover <= 100
        ? ('measured_or_manual_numeric' as const)
        : canopyCoverPercent !== null
          ? ('user_confirmed_class' as const)
          : null,
    heightSource:
      Number.isFinite(directHeight) &&
      directHeight > 0
        ? ('measured_or_manual_numeric' as const)
        : canopyHeightM !== null
          ? ('user_confirmed_class' as const)
          : null,
  };
}
