export type FieldObservationPointStatus =
  | 'active'
  | 'resolved'
  | 'paused';

export type FieldObservationPhotoSource =
  | 'camera'
  | 'gallery'
  | 'upload';

export type FieldObservationComparisonStatus =
  | 'improving'
  | 'stable'
  | 'worsening'
  | 'unknown';

export type FieldObservationPoint = {
  id: string;
  userId: string;
  fieldId: string;
  sourceLayer: string;
  trackingKey: string;
  direction: string | null;
  centroidLat: number;
  centroidLng: number;
  areaGeometry: any | null;
  firstNdvi: number | null;
  latestNdvi: number | null;
  firstRelativeHealth: number | null;
  latestRelativeHealth: number | null;
  firstSatelliteDate: string | null;
  latestSatelliteDate: string | null;
  status: FieldObservationPointStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  lastPhotoAt: string | null;
  lastPhotoSatelliteDate: string | null;
  lastPromptedAt: string | null;
  nextPhotoDueAt: string | null;
  dismissedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldObservationPhoto = {
  id: string;
  pointId: string;
  userId: string;
  fieldId: string;
  storagePath: string;
  capturedAt: string;
  source: FieldObservationPhotoSource;
  mimeType: string | null;
  fileSizeBytes: number | null;
  ndviValue: number | null;
  relativeHealth: number | null;
  satelliteDate: string | null;
  notes: string | null;
  aiResult: any | null;
  capturedLat: number | null;
  capturedLng: number | null;
  locationAccuracyM: number | null;
  distanceToPointM: number | null;
  createdAt: string;
  signedUrl?: string | null;
};

export type FieldObservationComparison = {
  id: string;
  pointId: string;
  userId: string;
  fieldId: string;
  previousPhotoId: string | null;
  currentPhotoId: string | null;
  previousNdvi: number | null;
  currentNdvi: number | null;
  ndviDelta: number | null;
  previousRelativeHealth: number | null;
  currentRelativeHealth: number | null;
  relativeHealthDelta: number | null;
  status: FieldObservationComparisonStatus;
  summary: string | null;
  details: any | null;
  comparedAt: string;
  createdAt: string;
};

export type EnsureNdviObservationPointInput = {
  fieldId: string;
  direction?: string | null;
  centroid: [number, number]; // [lng, lat]
  areaGeometry?: any | null;
  ndviValue?: number | null;
  relativeHealth?: number | null;
  satelliteDate?: string | null;
};

export type UploadObservationPhotosInput = {
  point: FieldObservationPoint;
  files: File[];
  source: FieldObservationPhotoSource;
  ndviValue?: number | null;
  relativeHealth?: number | null;
  satelliteDate?: string | null;
  capturedAt?: string | null;
  notes?: string | null;
  capturedLat?: number | null;
  capturedLng?: number | null;
  locationAccuracyM?: number | null;
  distanceToPointM?: number | null;
};

export type ObservationUploadReward = {
  awarded: boolean;
  awardedPoints: number;
  reason: string;
};

export type ObservationUploadResult = {
  photos: FieldObservationPhoto[];
  latestPhoto: FieldObservationPhoto | null;
  comparison: FieldObservationComparison | null;
  updatedPoint: FieldObservationPoint;
  reward: ObservationUploadReward | null;
};



export type FieldObservationPointOverview = {
  point: FieldObservationPoint;
  latestPhoto: FieldObservationPhoto | null;
  latestComparison: FieldObservationComparison | null;
  photoCount: number;
};

export type NdviObservationTarget = {
  point: FieldObservationPoint;
  fieldName: string;
  direction: string | null;
  centroid: [number, number];
  relativeHealth: number | null;
  ndviValue: number | null;
  satelliteDate: string | null;
};


export type ObservationPhotoLocationReference = {
  lat: number;
  lng: number;
  capturedAt: string | null;
};
