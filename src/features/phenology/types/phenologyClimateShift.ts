export type PhenologyClimateShiftStatus =
  | 'ready'
  | 'not_applicable'
  | 'insufficient_data';

export type PhenologyClimateShiftConfidence =
  | 'low'
  | 'medium';

export type PhenologyClimateShiftResult = {
  success: boolean;

  status:
    PhenologyClimateShiftStatus;

  shiftDays: number;

  /*
    Pozitif = mevsim termal olarak normalden ileride.
    Takvimde uygulanacak shiftDays bunun ters işaretidir:
    mevsim ilerideyse takvim daha erkene kayar.
  */
  seasonAdvanceDays:
    number | null;

  confidence:
    PhenologyClimateShiftConfidence;

  anomalyC:
    number | null;

  currentThermalUnits:
    number | null;

  baselineThermalUnits:
    number | null;

  baselineYearsUsed:
    number;

  currentCoverage:
    number | null;

  source:
    string;

  method:
    string | null;

  period:
    | {
        from: string;
        to: string;
      }
    | null;

  caution:
    string | null;

  message:
    string | null;
};
