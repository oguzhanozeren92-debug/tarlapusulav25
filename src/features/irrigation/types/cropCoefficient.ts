import type {
  PhenologyStage,
} from '../../phenology/types/phenology';

export type CropCoefficientConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type CropCoefficientStatus =
  | 'usable'
  | 'needs_canopy_data'
  | 'needs_crop_subtype'
  | 'unsupported_crop'
  | 'unknown_stage';

export type CropCoefficientAnchor =
  | 'initial'
  | 'development'
  | 'mid'
  | 'late'
  | 'end';

export type CropCoefficientProfile = {
  cropKey: string;
  displayName: string;
  aliases: string[];

  cropSubtype:
    | 'table'
    | 'wine'
    | null;

  cropSubtypeLabel:
    | string
    | null;

  kcInitial: number;
  kcMid: number;
  kcEnd: number;

  /*
    FAO-56 Table 12 varsayımı.
    Örn. "no ground cover".
  */
  baselineAssumption: string;

  sourceLabel: string;
  sourceUrl: string;
};

export type CropCoefficientResult = {
  status: CropCoefficientStatus;

  cropKey: string | null;
  cropName: string | null;

  cropSubtype:
    | 'table'
    | 'wine'
    | null;

  stage: PhenologyStage;
  stageLabel: string | null;

  anchor:
    CropCoefficientAnchor | null;

  kc:
    number | null;

  kcInitial:
    number | null;

  kcMid:
    number | null;

  kcEnd:
    number | null;

  confidence:
    CropCoefficientConfidence;

  bearing:
    boolean | null;

  basis:
    string[];

  warnings:
    string[];

  caution:
    string;

  source:
    | {
        label: string;
        url: string;
      }
    | null;
};
