import type {
  HomeDecisionConfidence,
  HomeDecisionEvent,
  HomeDecisionSource,
  HomeDecisionTarget,
} from './homeDecision';

export type ModelSignalStatus =
  | 'ready'
  | 'partial'
  | 'needs-data'
  | 'error';

export type ModelSignalFreshness = {
  observedAt: string | null;
  evaluatedAt: string;
  ageHours: number | null;
};

export type ModelSignalRecommendation = {
  title: string;
  detail: string;
  target: HomeDecisionTarget;
};

/**
 * Pusula'nın bütün karar/model çıktılarının ortak taşıma sözleşmesi.
 *
 * Bu şema tarımsal değeri yeniden hesaplamaz. Mevcut gerçek model/servis
 * sonucunu; kaynak, veri durumu, kanıt, güven ve veri tarihi ile birlikte
 * tek biçimde taşır. Bilinmeyen değerler tahmin edilmez.
 */
export type ModelGatewayEnvelope = {
  schemaVersion: '1.0';
  signalId: string;
  fieldId: string;
  source: HomeDecisionSource;
  sourceModel: string;
  status: ModelSignalStatus;
  confidence: HomeDecisionConfidence;
  evidence: string[];
  freshness: ModelSignalFreshness;
  recommendation: ModelSignalRecommendation;
  severity: HomeDecisionEvent['severity'];
  priority: number;
};

export type HarmonizedHomeDecisionEvent = HomeDecisionEvent & {
  gateway: ModelGatewayEnvelope;
};
