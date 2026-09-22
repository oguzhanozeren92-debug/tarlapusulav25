import { supabase } from '../supabaseClient';

export type ParcelLookupInput = {
  province: string;
  district: string;
  village: string;
  ada: string;
  parcel: string;
};

export type ParcelLookupResult = {
  found: boolean;
  message?: string;
  source?: string;
  geometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  centroid?: {
    latitude: number;
    longitude: number;
  } | null;
  areaDecare?: number | null;
};

export async function lookupParcel(
  input: ParcelLookupInput,
): Promise<ParcelLookupResult> {
  if (!supabase) {
    throw new Error('Parsel servisine bağlanılamadı.');
  }

  const { data, error } = await supabase.functions.invoke('parcel-lookup', {
    body: {
      province: input.province,
      district: input.district,
      village: input.village,
      ada: input.ada,
      parcel: input.parcel,
    },
  });

  if (error) {
    console.error('parcel-lookup invoke error:', error);
    throw new Error(
      error.message || 'Parsel sorgusu sırasında bağlantı hatası oluştu.',
    );
  }

  if (!data) {
    return {
      found: false,
      message: 'Parsel servisinden yanıt alınamadı.',
    };
  }

  const rawGeometry =
    data.geometry ??
    data.parcelGeometry ??
    data.feature ??
    null;

  let geometry: ParcelLookupResult['geometry'] = null;

  if (rawGeometry?.type === 'Feature' && rawGeometry?.geometry) {
    geometry = rawGeometry;
  } else if (
    rawGeometry &&
    (rawGeometry.type === 'Polygon' || rawGeometry.type === 'MultiPolygon')
  ) {
    geometry = {
      type: 'Feature',
      properties: {},
      geometry: rawGeometry,
    };
  }

  const rawCentroid =
    data.centroid ??
    data.center ??
    null;

  const latitude = Number(
    rawCentroid?.latitude ??
    rawCentroid?.lat ??
    data.latitude ??
    data.lat,
  );

  const longitude = Number(
    rawCentroid?.longitude ??
    rawCentroid?.lng ??
    rawCentroid?.lon ??
    data.longitude ??
    data.lng ??
    data.lon,
  );

  const centroid =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
          latitude,
          longitude,
        }
      : null;

  const rawArea =
    data.areaDecare ??
    data.area_decare ??
    data.areaDa ??
    data.area_da ??
    data.area ??
    null;

  const parsedArea = Number(rawArea);

  const areaDecare =
    rawArea !== null &&
    rawArea !== undefined &&
    rawArea !== '' &&
    Number.isFinite(parsedArea)
      ? parsedArea
      : null;

  const found =
    Boolean(data.found) ||
    Boolean(geometry);

  return {
    found,
    message: data.message,
    source: data.source,
    geometry,
    centroid,
    areaDecare,
  };
}
