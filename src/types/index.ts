import type { SatelliteHealthResult } from '../lib/satelliteService';

export type Screen =
  | 'welcome'
  | 'login'
  | 'emailRegister'
  | 'emailLogin'
  | 'emailVerification'
  | 'onboarding'
  | 'ready'
  | 'addField'
  | 'fieldDetail'
  | 'aiAnalysis'
  | 'calendar'
  | 'weatherHub'
  | 'fieldControlHub'
  | 'soilAnalysisHub'
  | 'inventoryHub'
  | 'marketHub'
  | 'supportHub'
  | 'agendaHub'
  | 'nutritionHub'
  | 'pestGuideHub'
  | 'producerMarketHub'
  | 'fieldNotebookHub'
  | 'notificationsHub'
  | 'settingsHub'
  | 'adminHub'
  | 'home';

export type FieldStatus = 'good' | 'check' | 'urgent';

export type CropCycle = 'annual' | 'perennial';

export type FieldIrrigationStatus =
  | 'irrigated'
  | 'rainfed'
  | 'partial';

export type FieldIrrigationMethod =
  | 'sprinkler'
  | 'basin'
  | 'border'
  | 'furrow_every_narrow'
  | 'furrow_every_wide'
  | 'furrow_alternating'
  | 'trickle'
  | 'unknown';

export type LocationOption = {
  id: number;
  name: string;
};

export type Field = {
  id: number | string;
  name: string;
  ada: number;
  parsel: number;
  area: number;
  crop: string;
  season: number;
  status: FieldStatus;
  demo?: boolean;
  city?: string;
  district?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  parcelGeometry?: any | null;
  parcelCentroidLat?: number | null;
  parcelCentroidLng?: number | null;
  parcelLookupStatus?: string | null;
  parcelLookupSource?: string | null;
  cropCycle?: CropCycle;
  plantingYear?: number | null;
  bearing?: boolean | null;
  irrigationStatus?: FieldIrrigationStatus | null;
  irrigationMethod?: FieldIrrigationMethod | null;
};

export type FieldSection = {
  id: string;
  fieldId: string;
  name: string;
  crop: string;
  area: number | null;
};

export type FieldSeason = {
  id: string;
  fieldId: string;
  year: number;
  crop: string;
  varietyName: string | null;
  plantingDate: string | null;
  harvestDate: string | null;
  notes: string | null;
};

export type PerennialYield = {
  id: string;
  year: number;
  yieldKg: number | null;
  harvestDate: string | null;
  notes: string | null;
};

export type OfficialVerificationSource =
  | 'BKU'
  | 'GTS'
  | 'DATS'
  | 'TAKIS'
  | 'TAGEM';

export type OfficialVerificationStatus =
  | 'verified'
  | 'requires_verification'
  | 'unavailable'
  | 'not_applicable';

export type OfficialVerification = {
  domain: 'plant_protection' | 'fertilizer' | 'disaster' | 'research' | string;
  source: OfficialVerificationSource;
  sourceName: string;
  status: OfficialVerificationStatus;
  sourceUrl: string | null;
  crop: string | null;
  issue: string | null;
  officialRecordId: string | null;
  verifiedAt: string | null;
  sourceObservedAt?: string | null;
  matchedRecordCount?: number;
  verificationBasis?:
    | 'admin_reviewed_official_snapshot'
    | 'official_source_reachability_only'
    | 'not_applicable'
    | string;
  guardEvaluatedAt: string;
  sourceMode: 'official_web_check' | 'official_api' | 'admin_snapshot' | string;
  sourceAvailability?: 'reachable' | 'unreachable' | 'unchecked';
  blockedRecommendationCount?: number;
  guardVersion?: string;
  note: string;
};

export type AiFieldAnalysis = {
  status: 'normal' | 'attention' | 'urgent' | 'uncertain';
  issueType?: 'disease' | 'pest' | 'nutrition' | 'environmental' | 'physical' | 'uncertain';
  severity?: 'low' | 'medium' | 'high' | 'unknown';
  headline: string;
  possibleIssue: string;
  confidence: number;
  observations: string[];
  recommendations: string[];
  needsMoreEvidence?: boolean;
  followUpPhoto?: string | null;
  comparison?: string | null;
  trend?: 'improving' | 'stable' | 'worsening' | 'unknown';
  disclaimer: string;
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  analyzedAt?: string | null;
  officialVerification?: OfficialVerification | null;
};

export type AiAccessStatus = {
  plan: string;
  dailyFreeUsed: boolean;
  freeRemaining: number;
  rewardCredits: number;
  unlimited: boolean;
};

export type CalendarReminder = {
  id: string;
  fieldId: string;
  fieldName: string;
  reminderType: string;
  title: string;
  reminderDate: string;
  reminderTime: string | null;
  notes: string | null;
  completed: boolean;
};

export type FieldActivity = {
  id: string;
  type: string;
  title: string;
  activityDate: string;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  notes: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  aiAnalysis: AiFieldAnalysis | null;
};

export type WeatherForecastDay = {
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  humidity: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
  condition: string;
};

export type WeatherProviderResult = {
  name: string;
  forecast: WeatherForecastDay[];
};

export type FieldWeatherState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  locationLabel?: string;
  forecast: WeatherForecastDay[];
  providers?: WeatherProviderResult[];
  message?: string;
};

export type FieldSatelliteState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: SatelliteHealthResult;
  message?: string;
};

export type CropCatalogueItem = {
  name: string;
  cycle: CropCycle;
};

export type CmsPageRow = {
  id: string;
  page_key: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  icon_size: number;
  icon_position: string;
  menu_order: number;
  is_visible: boolean;
  layout: string;
  columns_desktop: number;
  columns_tablet: number;
  columns_mobile: number;
  padding_top: number;
  padding_bottom: number;
  background_type: string;
  background_value: string | null;
};

export type CmsBlockRow = {
  id: string;
  page_key: string;
  block_key: string;
  block_type: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  icon: string | null;
  icon_size: number;
  icon_position: string;
  image_path: string | null;
  image_url: string | null;
  button_text: string | null;
  button_action: string | null;
  button_target: string | null;
  position: number;
  width_desktop: number;
  width_tablet: number;
  width_mobile: number;
  align_horizontal: string;
  align_vertical: string;
  is_visible: boolean;
  style_config: Record<string, any>;
  content_data: Record<string, any>;
};

export type CmsMenuRow = {
  id: string;
  menu_key: string;
  page_key: string | null;
  label: string;
  icon: string | null;
  position: number;
  is_visible: boolean;
  badge_text: string | null;
  badge_type: string | null;
  parent_menu_key: string | null;
  show_desktop: boolean;
  show_mobile: boolean;
  show_bottom_nav: boolean;
  admin_only: boolean;
};

export type CmsMediaRow = {
  id: string;
  title: string | null;
  alt_text: string | null;
  file_path: string;
  public_url: string;
  mime_type: string | null;
  category: string;
  created_at: string;
};