import type {
  CropPhenologyCalendarDefinition,
} from '../types/cropPhenologyCalendar';

/*
  TARLAPUSULA CROP PHENOLOGY BASELINE v1

  Bunlar çeşit-spesifik kesin tarihler DEĞİL;
  resmi/araştırma kaynaklarındaki geniş fenolojik pencerelerden
  türetilmiş operasyonel başlangıç takvimleridir.

  Bölge, rakım, çeşit ve yıl sıcaklığına göre seasonShiftDays
  ile ileri/geri kaydırılmak üzere tasarlanmıştır.
*/

export const CROP_PHENOLOGY_CALENDARS:
  CropPhenologyCalendarDefinition[] = [
  {
    cropKey: 'pistachio',
    displayName: 'Antep Fıstığı',
    aliases: [
      'antep fıstığı',
      'antepfıstığı',
      'antep fistigi',
      'antepfistigi',
      'fıstık',
      'fistik',
      'pistachio',
    ],
    cropCycle: 'perennial',
    sourceLabel:
      'Tarım ve Orman Bakanlığı / Antepfıstığı Araştırma Enstitüsü — Antepfıstığı Yetiştiriciliği; Uzun çeşidi fenolojik araştırmaları',
    sourceScope:
      'regional_study',
    baseConfidence:
      'medium',
    phases: [
      {
        id: 'dormancy',
        label:
          'Kış Dinlenmesi',
        stage:
          'dormancy',
        start:
          '11-15',
        end:
          '03-10',
        note:
          'Soğuklama ve kış dinlenmesi dönemi.',
      },
      {
        id: 'bud_break',
        label:
          'Tomurcuk Uyanması',
        stage:
          'bud_break',
        start:
          '03-11',
        end:
          '03-28',
      },
      {
        id: 'flowering',
        label:
          'Çiçeklenme',
        stage:
          'flowering',
        start:
          '03-29',
        end:
          '04-20',
        note:
          'Çiçeklenme tarihi çeşide ve ekolojiye göre kayabilir.',
      },
      {
        id: 'fruit_set',
        label:
          'Meyve Tutumu',
        stage:
          'fruit_set',
        start:
          '04-21',
        end:
          '05-20',
      },
      {
        id: 'fruit_growth',
        label:
          'Meyve Gelişimi',
        stage:
          'fruit_growth',
        start:
          '05-21',
        end:
          '07-31',
      },
      {
        id: 'maturation',
        label:
          'Olgunlaşma',
        stage:
          'maturation',
        start:
          '08-01',
        end:
          '08-20',
      },
      {
        id: 'harvest',
        label:
          'Hasat Penceresi',
        stage:
          'harvest_window',
        start:
          '08-21',
        end:
          '09-30',
        note:
          'Türkiye’de hasat genel olarak ağustos ayında başlayıp eylül sonuna kadar sürebilir.',
      },
      {
        id: 'leaf_fall',
        label:
          'Hasat Sonrası / Yaprak Yaşlanması',
        stage:
          'leaf_fall',
        start:
          '10-01',
        end:
          '11-14',
      },
    ],
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
    cropCycle:
      'perennial',
    sourceLabel:
      'Tarım ve Orman Bakanlığı TAGEM — Badem Entegre Mücadele Teknik Talimatı; GAP badem fenoloji çalışmaları',
    sourceScope:
      'regional_study',
    baseConfidence:
      'medium',
    phases: [
      {
        id: 'dormancy',
        label:
          'Kış Dinlenmesi',
        stage:
          'dormancy',
        start:
          '11-15',
        end:
          '01-14',
      },
      {
        id: 'bud_swell',
        label:
          'Tomurcuk Kabarması',
        stage:
          'bud_swell',
        start:
          '01-15',
        end:
          '02-10',
      },
      {
        id: 'flowering',
        label:
          'Çiçeklenme',
        stage:
          'flowering',
        start:
          '02-11',
        end:
          '03-31',
        note:
          'Geç çiçeklenen çeşitlerde ve serin bölgelerde daha ileri tarihe kayabilir.',
      },
      {
        id: 'fruit_set',
        label:
          'Meyve Tutumu / Küçük Meyve',
        stage:
          'fruit_set',
        start:
          '04-01',
        end:
          '05-15',
      },
      {
        id: 'fruit_growth',
        label:
          'Meyve Gelişimi',
        stage:
          'fruit_growth',
        start:
          '05-16',
        end:
          '07-14',
      },
      {
        id: 'maturation',
        label:
          'Olgunlaşma',
        stage:
          'maturation',
        start:
          '07-15',
        end:
          '08-20',
      },
      {
        id: 'harvest',
        label:
          'Hasat Penceresi',
        stage:
          'harvest_window',
        start:
          '08-21',
        end:
          '09-30',
        note:
          'Çeşit ve bölgeye göre hasat ağustos sonundan eylüle uzayabilir.',
      },
      {
        id: 'leaf_fall',
        label:
          'Hasat Sonrası / Yaprak Dönemi',
        stage:
          'leaf_fall',
        start:
          '10-01',
        end:
          '11-14',
      },
    ],
  },

  {
    cropKey:
      'cherry',
    displayName:
      'Kiraz',
    aliases: [
      'kiraz',
      'cherry',
    ],
    cropCycle:
      'perennial',
    sourceLabel:
      'Tarım ve Orman Bakanlığı — Türkiye kiraz çiçeklenme, meyve teşekkülü ve olgunlaşma/hasat haritaları',
    sourceScope:
      'turkiye_general',
    baseConfidence:
      'medium',
    phases: [
      {
        id: 'dormancy',
        label:
          'Kış Dinlenmesi',
        stage:
          'dormancy',
        start:
          '11-15',
        end:
          '03-09',
      },
      {
        id: 'bud_break',
        label:
          'Tomurcuk Uyanması',
        stage:
          'bud_break',
        start:
          '03-10',
        end:
          '04-05',
      },
      {
        id: 'flowering',
        label:
          'Çiçeklenme',
        stage:
          'flowering',
        start:
          '04-06',
        end:
          '05-15',
        note:
          'Türkiye genelinde rakım ve bölgeye göre marttan mayısa kadar değişebilir.',
      },
      {
        id: 'fruit_set',
        label:
          'Meyve Teşekkülü',
        stage:
          'fruit_set',
        start:
          '04-20',
        end:
          '06-15',
      },
      {
        id: 'maturation',
        label:
          'Olgunlaşma',
        stage:
          'maturation',
        start:
          '05-15',
        end:
          '06-15',
      },
      {
        id: 'harvest',
        label:
          'Hasat Penceresi',
        stage:
          'harvest_window',
        start:
          '06-01',
        end:
          '07-31',
        note:
          'Türkiye hasat penceresi bölgeye göre mayıs-temmuz aralığına yayılabilir.',
      },
      {
        id: 'post_harvest',
        label:
          'Hasat Sonrası Vejetatif Dönem',
        stage:
          'vegetative',
        start:
          '08-01',
        end:
          '10-15',
      },
      {
        id: 'leaf_fall',
        label:
          'Yaprak Sararması / Dökümü',
        stage:
          'leaf_fall',
        start:
          '10-16',
        end:
          '11-14',
      },
    ],
  },

  {
    cropKey:
      'walnut',
    displayName:
      'Ceviz',
    aliases: [
      'ceviz',
      'walnut',
    ],
    cropCycle:
      'perennial',
    sourceLabel:
      'Tarım ve Orman Bakanlığı Biyolojik Mücadele Araştırma Enstitüsü — Ceviz Bitkisi Fenolojik Dönemleri',
    sourceScope:
      'turkiye_general',
    baseConfidence:
      'medium',
    phases: [
      {
        id: 'dormancy',
        label:
          'Dormant Dönem',
        stage:
          'dormancy',
        start:
          '12-01',
        end:
          '02-15',
      },
      {
        id: 'bud_break',
        label:
          'Odun Gözlerinin Sürmesi',
        stage:
          'bud_break',
        start:
          '02-16',
        end:
          '03-31',
      },
      {
        id: 'flowering',
        label:
          'Erkek / Dişi Çiçek Oluşumu',
        stage:
          'flowering',
        start:
          '03-15',
        end:
          '04-30',
      },
      {
        id: 'fruit_set',
        label:
          'Meyve Oluşumu',
        stage:
          'fruit_set',
        start:
          '04-15',
        end:
          '05-31',
      },
      {
        id: 'fruit_growth',
        label:
          'Meyve Büyümesi',
        stage:
          'fruit_growth',
        start:
          '06-01',
        end:
          '07-31',
      },
      {
        id: 'maturation',
        label:
          'Tam Gelişmiş Meyve / Olgunlaşma',
        stage:
          'maturation',
        start:
          '08-01',
        end:
          '08-31',
      },
      {
        id: 'harvest',
        label:
          'Hasat Penceresi',
        stage:
          'harvest_window',
        start:
          '09-01',
        end:
          '10-31',
        note:
          'Kaynaklarda ağustos-ekim genel fenolojik hasat dönemi; Türkiye’de ticari hasat çoğunlukla eylül-ekim.',
      },
      {
        id: 'leaf_fall',
        label:
          'Yaprak Dökümü',
        stage:
          'leaf_fall',
        start:
          '11-01',
        end:
          '11-30',
      },
    ],
  },

  {
    cropKey:
      'grape',
    displayName:
      'Üzüm',
    aliases: [
      'üzüm',
      'uzum',
      'bağ',
      'bag',
      'grape',
    ],
    cropCycle:
      'perennial',
    sourceLabel:
      'Tarım ve Orman Bakanlığı Bağcılık Araştırma Enstitüsü — üzüm çeşitleri fenolojik gözlem çalışmaları',
    sourceScope:
      'regional_study',
    baseConfidence:
      'medium',
    phases: [
      {
        id: 'dormancy',
        label:
          'Kış Dinlenmesi',
        stage:
          'dormancy',
        start:
          '11-15',
        end:
          '03-10',
      },
      {
        id: 'bud_break',
        label:
          'Uyanma / Sürme',
        stage:
          'bud_break',
        start:
          '03-11',
        end:
          '04-30',
      },
      {
        id: 'flowering',
        label:
          'Çiçeklenme',
        stage:
          'flowering',
        start:
          '05-01',
        end:
          '06-05',
      },
      {
        id: 'fruit_set',
        label:
          'Tane Tutumu',
        stage:
          'fruit_set',
        start:
          '05-20',
        end:
          '06-20',
      },
      {
        id: 'fruit_growth',
        label:
          'Tane Gelişimi',
        stage:
          'fruit_growth',
        start:
          '06-21',
        end:
          '07-15',
      },
      {
        id: 'veraison',
        label:
          'Ben Düşme',
        stage:
          'veraison',
        start:
          '07-16',
        end:
          '08-15',
      },
      {
        id: 'harvest',
        label:
          'Olgunlaşma / Hasat Penceresi',
        stage:
          'harvest_window',
        start:
          '08-01',
        end:
          '09-30',
        note:
          'Çeşide göre ağustos başından eylül ortası/sonuna kadar değişebilir.',
      },
      {
        id: 'leaf_fall',
        label:
          'Hasat Sonrası / Yaprak Dönemi',
        stage:
          'leaf_fall',
        start:
          '10-01',
        end:
          '11-14',
      },
    ],
  },
];

export const SUPPORTED_CROP_KEYS =
  CROP_PHENOLOGY_CALENDARS.map(
    (calendar) =>
      calendar.cropKey,
  );
