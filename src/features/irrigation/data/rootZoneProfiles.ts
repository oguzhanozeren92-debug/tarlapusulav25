import type {
  RootZoneCropProfile,
} from '../types/rootZoneWater';

const FAO56_ROOT_URL =
  'https://www.fao.org/4/x0490e/x0490e0e.htm';

/*
  FAO-56 Table 22

  Not:
  Table 22 alt notuna göre sulama planlamasında
  kök derinliği aralığının küçük değeri
  kullanılabilir.

  Bu nedenle TarlaPusula v1:
  schedulingDepthM = rootDepthMinM

  şeklinde ihtiyatlı planlama yapar.
*/
export const ROOT_ZONE_CROP_PROFILES:
  RootZoneCropProfile[] = [
  {
    cropKey:
      'almond',

    displayName:
      'Badem',

    aliases: [
      'badem',
      'almond',
      'almonds',
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    rootDepthMinM:
      1.0,

    rootDepthMaxM:
      2.0,

    depletionFractionP:
      0.40,

    sourceLabel:
      'FAO-56 Table 22 — Almonds',

    sourceUrl:
      FAO56_ROOT_URL,
  },

  {
    cropKey:
      'pistachio',

    displayName:
      'Antep Fıstığı',

    aliases: [
      'antep fıstığı',
      'antepfıstığı',
      'antep fistigi',
      'antepfistigi',
      'fıstık',
      'fistik',
      'pistachio',
      'pistachios',
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    rootDepthMinM:
      1.0,

    rootDepthMaxM:
      1.5,

    depletionFractionP:
      0.40,

    sourceLabel:
      'FAO-56 Table 22 — Pistachios',

    sourceUrl:
      FAO56_ROOT_URL,
  },

  {
    cropKey:
      'cherry',

    displayName:
      'Kiraz',

    aliases: [
      'kiraz',
      'cherry',
      'cherries',
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    rootDepthMinM:
      1.0,

    rootDepthMaxM:
      2.0,

    depletionFractionP:
      0.50,

    sourceLabel:
      'FAO-56 Table 22 — Apples, Cherries, Pears',

    sourceUrl:
      FAO56_ROOT_URL,
  },

  {
    cropKey:
      'walnut',

    displayName:
      'Ceviz',

    aliases: [
      'ceviz',
      'walnut',
      'walnuts',
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    rootDepthMinM:
      1.7,

    rootDepthMaxM:
      2.4,

    depletionFractionP:
      0.50,

    sourceLabel:
      'FAO-56 Table 22 — Walnut Orchard',

    sourceUrl:
      FAO56_ROOT_URL,
  },

  {
    cropKey:
      'grape_table',

    displayName:
      'Üzüm',

    aliases: [
      'üzüm',
      'uzum',
      'grape',
      'grapes',
    ],

    cropSubtype:
      'table',

    cropSubtypeLabel:
      'Sofralık',

    rootDepthMinM:
      1.0,

    rootDepthMaxM:
      2.0,

    depletionFractionP:
      0.35,

    sourceLabel:
      'FAO-56 Table 22 — Grapes, Table or Raisin',

    sourceUrl:
      FAO56_ROOT_URL,
  },

  {
    cropKey:
      'grape_wine',

    displayName:
      'Üzüm',

    aliases: [
      'üzüm',
      'uzum',
      'grape',
      'grapes',
    ],

    cropSubtype:
      'wine',

    cropSubtypeLabel:
      'Şaraplık',

    rootDepthMinM:
      1.0,

    rootDepthMaxM:
      2.0,

    depletionFractionP:
      0.45,

    sourceLabel:
      'FAO-56 Table 22 — Grapes, Wine',

    sourceUrl:
      FAO56_ROOT_URL,
  },
];
