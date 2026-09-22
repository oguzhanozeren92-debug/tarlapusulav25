import type {
  CropCoefficientProfile,
} from '../types/cropCoefficient';

/*
  TARLAPUSULA — FAO-56 SINGLE Kc BASELINES v1

  Kaynak:
  FAO Irrigation and Drainage Paper 56
  Chapter 6, Table 12.

  Bu değerler:
  - stresssiz,
  - iyi yönetilen,
  - standart/sub-humid koşullardaki
    tipik Kc başlangıç/mid/end değerleridir.

  TarlaPusula bunları doğrudan "kesin tarla değeri"
  olarak kabul etmez.

  Genç/seyrek bahçe, aktif yer örtüsü, sıra arası çim,
  farklı rüzgâr/nem koşulları vb. için ileride
  ayrıca düzeltme gerekir.
*/

const FAO56_URL =
  'https://www.fao.org/4/X0490E/x0490e0b.htm';

export const CROP_COEFFICIENT_PROFILES:
  CropCoefficientProfile[] = [
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
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    /*
      FAO-56 Table 12:
      Pistachios, no ground cover
    */
    kcInitial:
      0.40,

    kcMid:
      1.10,

    kcEnd:
      0.45,

    baselineAssumption:
      'FAO-56: Pistachios, no ground cover.',

    sourceLabel:
      'FAO-56 Table 12 — Pistachios, no ground cover',

    sourceUrl:
      FAO56_URL,
  },

  {
    cropKey:
      'almond',

    displayName:
      'Badem',

    aliases: [
      'badem',
      'almond',
    ],

    cropSubtype:
      null,

    cropSubtypeLabel:
      null,

    /*
      FAO-56 Table 12:
      Almonds, no ground cover
    */
    kcInitial:
      0.40,

    kcMid:
      0.90,

    kcEnd:
      0.65,

    baselineAssumption:
      'FAO-56: Almonds, no ground cover.',

    sourceLabel:
      'FAO-56 Table 12 — Almonds, no ground cover',

    sourceUrl:
      FAO56_URL,
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

    /*
      FAO-56 Table 12:
      Apples, Cherries, Pears
      - no ground cover
      - killing frost

      TarlaPusula v1 için ihtiyatlı baz çizgi.
      Yer örtüsü/frost rejimi kullanıcı bağlamına
      eklendiğinde bu profil seçimi dinamikleşecek.
    */
    kcInitial:
      0.45,

    kcMid:
      0.95,

    kcEnd:
      0.70,

    baselineAssumption:
      'FAO-56: Apples/Cherries/Pears; no ground cover, killing frost baseline.',

    sourceLabel:
      'FAO-56 Table 12 — Apples, Cherries, Pears',

    sourceUrl:
      FAO56_URL,
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

    /*
      FAO-56 Table 12:
      Walnut Orchard
    */
    kcInitial:
      0.50,

    kcMid:
      1.10,

    kcEnd:
      0.65,

    baselineAssumption:
      'FAO-56: Walnut Orchard baseline.',

    sourceLabel:
      'FAO-56 Table 12 — Walnut Orchard',

    sourceUrl:
      FAO56_URL,
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

    /*
      FAO-56 Table 12:
      Grapes — Table or Raisin
    */
    kcInitial:
      0.30,

    kcMid:
      0.85,

    kcEnd:
      0.45,

    baselineAssumption:
      'FAO-56: Grapes — Table or Raisin.',

    sourceLabel:
      'FAO-56 Table 12 — Grapes, Table or Raisin',

    sourceUrl:
      FAO56_URL,
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

    /*
      FAO-56 Table 12:
      Grapes — Wine
    */
    kcInitial:
      0.30,

    kcMid:
      0.70,

    kcEnd:
      0.45,

    baselineAssumption:
      'FAO-56: Grapes — Wine.',

    sourceLabel:
      'FAO-56 Table 12 — Grapes, Wine',

    sourceUrl:
      FAO56_URL,
  },
];
