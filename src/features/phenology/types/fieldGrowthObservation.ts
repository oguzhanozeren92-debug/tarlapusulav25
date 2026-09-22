import type {
  PhenologyStage,
} from './phenology';

export type FieldGrowthObservation = {
  id: string;
  fieldId: string;
  seasonId: string | null;
  observedOn: string;
  stage: Exclude<PhenologyStage, 'unknown'>;
  notes: string | null;
  createdAt: string;
};

export type CreateFieldGrowthObservationInput = {
  fieldId: string;
  seasonId?: string | null;
  observedOn: string;
  stage: Exclude<PhenologyStage, 'unknown'>;
  notes?: string | null;
};
