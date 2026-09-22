import {
  CROP_PHENOLOGY_CALENDARS,
} from '../data/cropPhenologyCalendars';

import type {
  CropPhenologyCalendarDefinition,
  CropPhenologyCalendarResult,
  CropPhenologyPhase,
} from '../types/cropPhenologyCalendar';

import type {
  PhenologyStage,
} from '../types/phenology';

const DAY_MS =
  86_400_000;

function normalizeCropName(
  value:
    | string
    | null
    | undefined,
) {
  return String(
    value ?? '',
  )
    .toLocaleLowerCase(
      'tr-TR',
    )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^a-z0-9çğıöşü]+/gi,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function findCalendar(
  cropName:
    | string
    | null
    | undefined,
):
  | CropPhenologyCalendarDefinition
  | null {
  const normalized =
    normalizeCropName(
      cropName,
    );

  if (!normalized) {
    return null;
  }

  for (
    const calendar
    of CROP_PHENOLOGY_CALENDARS
  ) {
    const candidates = [
      calendar.displayName,
      calendar.cropKey,
      ...calendar.aliases,
    ].map(
      normalizeCropName,
    );

    if (
      candidates.includes(
        normalized,
      )
    ) {
      return calendar;
    }
  }

  return null;
}

function parseMonthDay(
  year: number,
  value: string,
) {
  const [
    monthText,
    dayText,
  ] =
    value.split('-');

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  if (
    !Number.isInteger(
      month,
    ) ||
    !Number.isInteger(
      day,
    ) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return date;
}

function shiftDate(
  date: Date,
  days: number,
) {
  return new Date(
    date.getTime() +
      days *
        DAY_MS,
  );
}

function phaseContainsDate(
  phase:
    CropPhenologyPhase,
  today: Date,
  shiftDays: number,
) {
  const year =
    today.getUTCFullYear();

  const rawStart =
    parseMonthDay(
      year,
      phase.start,
    );

  const rawEnd =
    parseMonthDay(
      year,
      phase.end,
    );

  if (
    !rawStart ||
    !rawEnd
  ) {
    return false;
  }

  let start =
    shiftDate(
      rawStart,
      shiftDays,
    );

  let end =
    shiftDate(
      rawEnd,
      shiftDays,
    );

  /*
    Kasım -> Mart gibi yıl aşan pencere.
  */
  if (
    rawEnd.getTime() <
    rawStart.getTime()
  ) {
    const endNextYear =
      parseMonthDay(
        year + 1,
        phase.end,
      );

    if (
      !endNextYear
    ) {
      return false;
    }

    end =
      shiftDate(
        endNextYear,
        shiftDays,
      );

    const todayTime =
      today.getTime();

    if (
      todayTime <
      start.getTime()
    ) {
      const startPreviousYear =
        parseMonthDay(
          year - 1,
          phase.start,
        );

      if (
        !startPreviousYear
      ) {
        return false;
      }

      start =
        shiftDate(
          startPreviousYear,
          shiftDays,
        );

      end =
        shiftDate(
          rawEnd,
          shiftDays,
        );
    }
  }

  const time =
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

  return (
    time >=
      start.getTime() &&
    time <=
      end.getTime()
  );
}

function stageLabel(
  stage:
    PhenologyStage,
  fallback: string,
) {
  switch (stage) {
    case 'dormancy':
      return 'Kış Dinlenmesi';
    case 'bud_swell':
      return 'Tomurcuk Kabarması';
    case 'bud_break':
      return 'Tomurcuk Uyanması / Sürme';
    case 'flowering':
      return 'Çiçeklenme';
    case 'fruit_set':
      return 'Meyve Tutumu';
    case 'fruit_growth':
      return 'Meyve Gelişimi';
    case 'veraison':
      return 'Ben Düşme';
    case 'maturation':
      return 'Olgunlaşma';
    case 'harvest_window':
      return 'Hasat Penceresi';
    case 'leaf_fall':
      return 'Yaprak Yaşlanması / Dökümü';
    default:
      return fallback;
  }
}

export function resolveCropPhenologyCalendar(
  input: {
    cropName?:
      | string
      | null;

    currentDate?:
      | string
      | Date
      | null;

    seasonShiftDays?:
      | number
      | null;
  },
): CropPhenologyCalendarResult {
  const calendar =
    findCalendar(
      input.cropName,
    );

  if (!calendar) {
    return {
      supported:
        false,
      cropKey:
        null,
      cropName:
        input.cropName ??
        null,
      stage:
        'unknown',
      stageLabel:
        'Belirlenemedi',
      phaseId:
        null,
      confidence:
        'low',
      basis: [],
      warnings: [
        'Bu ürün için TarlaPusula fenoloji takvimi henüz tanımlı değil.',
      ],
      seasonShiftDays:
        0,
      sourceLabel:
        null,
      sourceScope:
        null,
    };
  }

  const parsedDate =
    input.currentDate instanceof
    Date
      ? new Date(
          input.currentDate.getTime(),
        )
      : input.currentDate
        ? new Date(
            input.currentDate,
          )
        : new Date();

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return {
      supported:
        true,
      cropKey:
        calendar.cropKey,
      cropName:
        calendar.displayName,
      stage:
        'unknown',
      stageLabel:
        'Belirlenemedi',
      phaseId:
        null,
      confidence:
        'low',
      basis: [
        `Ürün takvimi: ${calendar.displayName}`,
      ],
      warnings: [
        'Fenoloji takvimi için geçerli tarih bulunamadı.',
      ],
      seasonShiftDays:
        0,
      sourceLabel:
        calendar.sourceLabel,
      sourceScope:
        calendar.sourceScope,
    };
  }

  const rawShift =
    Number(
      input.seasonShiftDays ??
      0,
    );

  /*
    Aşırı kaydırma fenoloji takvimini anlamsızlaştırmasın.
  */
  const seasonShiftDays =
    Math.max(
      -45,
      Math.min(
        45,
        Number.isFinite(
          rawShift,
        )
          ? Math.round(
              rawShift,
            )
          : 0,
      ),
    );

  const matched =
    calendar.phases.find(
      (phase) =>
        phaseContainsDate(
          phase,
          parsedDate,
          seasonShiftDays,
        ),
    ) ??
    null;

  if (!matched) {
    return {
      supported:
        true,
      cropKey:
        calendar.cropKey,
      cropName:
        calendar.displayName,
      stage:
        'unknown',
      stageLabel:
        'Belirlenemedi',
      phaseId:
        null,
      confidence:
        'low',
      basis: [
        `Ürün takvimi: ${calendar.displayName}`,
        `Kaynak: ${calendar.sourceLabel}`,
      ],
      warnings: [
        'Bugünün tarihi tanımlı geniş fenoloji pencerelerinden birine güvenli biçimde oturmadı.',
      ],
      seasonShiftDays,
      sourceLabel:
        calendar.sourceLabel,
      sourceScope:
        calendar.sourceScope,
    };
  }

  const warnings: string[] = [
    'Fenoloji takvimi çeşit, rakım ve yıl sıcaklığına göre birkaç hafta kayabilir.',
  ];

  if (
    seasonShiftDays !==
    0
  ) {
    warnings.push(
      `İklim/bölge düzeltmesi olarak takvim ${seasonShiftDays > 0 ? '+' : ''}${seasonShiftDays} gün kaydırıldı.`,
    );
  }

  if (
    matched.note
  ) {
    warnings.push(
      matched.note,
    );
  }

  return {
    supported:
      true,
    cropKey:
      calendar.cropKey,
    cropName:
      calendar.displayName,
    stage:
      matched.stage,
    stageLabel:
      stageLabel(
        matched.stage,
        matched.label,
      ),
    phaseId:
      matched.id,
    confidence:
      calendar.baseConfidence,
    basis: [
      `Ürün takvimi: ${calendar.displayName}`,
      `Takvim evresi: ${matched.label}`,
      `Kaynak: ${calendar.sourceLabel}`,
    ],
    warnings,
    seasonShiftDays,
    sourceLabel:
      calendar.sourceLabel,
    sourceScope:
      calendar.sourceScope,
  };
}
