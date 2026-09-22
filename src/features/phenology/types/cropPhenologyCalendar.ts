import type {
  PhenologyConfidence,
  PhenologyStage,
} from './phenology';

export type CropPhenologyPhase = {
  id: string;
  label: string;
  stage: PhenologyStage;

  /*
    "MM-DD" formatında geniş operasyonel pencere.
    Çeşit/bölge/yıl farkını seasonShiftDays ile kaydırabiliriz.
  */
  start: string;
  end: string;

  note?: string;
};

export type CropPhenologyCalendarDefinition = {
  cropKey: string;
  displayName: string;
  aliases: string[];

  cropCycle: 'perennial';

  sourceLabel: string;
  sourceScope:
    | 'turkiye_general'
    | 'regional_study';

  /*
    Takvim tarihleri çeşit ve rakıma göre kayabileceği için
    başlangıç güveni hiçbir zaman "high" değildir.
  */
  baseConfidence:
    | 'low'
    | 'medium';

  phases: CropPhenologyPhase[];
};

export type CropPhenologyCalendarResult = {
  supported: boolean;

  cropKey: string | null;
  cropName: string | null;

  stage: PhenologyStage;
  stageLabel: string;
  phaseId: string | null;

  confidence: PhenologyConfidence;

  basis: string[];
  warnings: string[];

  seasonShiftDays: number;

  sourceLabel: string | null;
  sourceScope:
    | 'turkiye_general'
    | 'regional_study'
    | null;
};
