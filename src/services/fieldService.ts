import { supabase } from '../supabaseClient';
import type {
  CropCycle,
  Field,
  FieldIrrigationMethod,
  FieldIrrigationStatus,
  FieldStatus,
} from '../types';

const FIELD_SELECT =
  'id, name, city, district, village, ada, parcel, area_decare, crop, season, status, crop_cycle, planting_year, bearing, irrigation_status, irrigation_method, latitude, longitude, parcel_geometry, parcel_centroid_lat, parcel_centroid_lng, parcel_lookup_status, parcel_lookup_source, sort_order';

function normalizeIrrigationStatus(value: unknown): FieldIrrigationStatus | null {
  const normalized = String(value ?? '').trim();
  return normalized === 'irrigated' || normalized === 'rainfed' || normalized === 'partial'
    ? normalized
    : null;
}

function normalizeIrrigationMethod(value: unknown): FieldIrrigationMethod | null {
  const normalized = String(value ?? '').trim();
  return [
    'sprinkler',
    'basin',
    'border',
    'furrow_every_narrow',
    'furrow_every_wide',
    'furrow_alternating',
    'trickle',
    'unknown',
  ].includes(normalized)
    ? (normalized as FieldIrrigationMethod)
    : null;
}

export async function fetchUserFields(): Promise<Field[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from('fields')
    .select(FIELD_SELECT)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    ada: Number(item.ada ?? 0),
    parsel: Number(item.parcel ?? 0),
    area: Number(item.area_decare ?? 0),
    crop: item.crop ?? 'Ürün belirtilmedi',
    season: Number(item.season ?? new Date().getFullYear()),
    status: (item.status ?? 'good') as FieldStatus,
    city: item.city ?? undefined,
    district: item.district ?? undefined,
    village: item.village ?? undefined,
    latitude:
      item.latitude === null || item.latitude === undefined
        ? null
        : Number(item.latitude),
    longitude:
      item.longitude === null || item.longitude === undefined
        ? null
        : Number(item.longitude),
    parcelGeometry: item.parcel_geometry ?? null,
    parcelCentroidLat:
      item.parcel_centroid_lat === null || item.parcel_centroid_lat === undefined
        ? null
        : Number(item.parcel_centroid_lat),
    parcelCentroidLng:
      item.parcel_centroid_lng === null || item.parcel_centroid_lng === undefined
        ? null
        : Number(item.parcel_centroid_lng),
    parcelLookupStatus: item.parcel_lookup_status ?? null,
    parcelLookupSource: item.parcel_lookup_source ?? null,
    cropCycle: (item.crop_cycle ?? 'annual') as CropCycle,
    plantingYear:
      item.planting_year === null || item.planting_year === undefined
        ? null
        : Number(item.planting_year),
    bearing:
      item.bearing === null || item.bearing === undefined
        ? null
        : Boolean(item.bearing),
    irrigationStatus: normalizeIrrigationStatus(item.irrigation_status),
    irrigationMethod: normalizeIrrigationMethod(item.irrigation_method),
  }));
}

export type CreateFieldInput = {
  name: string;
  city: string;
  district: string;
  village: string;
  ada: string;
  parcel: string;
  latitude: number | null;
  longitude: number | null;
  parcelGeometry: unknown;
  parcelLookupSource: string;
  areaDecare: number;
  crop: string;
  season: number;
  cropCycle: CropCycle;
  plantingYear: number | null;
  bearing: boolean;
};

export async function createUserField(input: CreateFieldInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Tarla kaydetmek için giriş yapmalısın.');

  const { error } = await supabase.from('fields').insert({
    user_id: user.id,
    name: input.name.trim(),
    city: input.city.trim() || null,
    district: input.district.trim() || null,
    village: input.village.trim() || null,
    ada: input.ada.trim(),
    parcel: input.parcel.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    parcel_geometry: input.parcelGeometry,
    parcel_centroid_lat: input.latitude,
    parcel_centroid_lng: input.longitude,
    parcel_lookup_status: input.parcelGeometry ? 'found' : 'pending',
    parcel_lookup_source: input.parcelLookupSource || null,
    area_decare: input.areaDecare,
    crop: input.crop.trim(),
    season: input.season,
    crop_cycle: input.cropCycle,
    planting_year: input.cropCycle === 'perennial' ? input.plantingYear : null,
    bearing: input.cropCycle === 'perennial' ? input.bearing : null,
    status: 'good',
  });

  if (error) throw error;
}

export async function deleteUserField(fieldId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Tarlayı silmek için giriş yapmalısın.');

  const { data, error } = await supabase
    .from('fields')
    .delete()
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id');

  if (error) throw error;
  if (!data?.length) throw new Error('Tarla bulunamadı veya silme yetkin yok.');
}
