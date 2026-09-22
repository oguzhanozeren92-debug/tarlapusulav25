import type { Field, WeatherForecastDay } from '../types';

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export const geocodeFieldLocation = async (
  field: Field,
): Promise<WeatherLocation | null> => {
  if (field.demo) {
    return {
      latitude: 39.9334,
      longitude: 32.8597,
      label: 'Örnek konum',
    };
  }

  const rawLatitude = field.parcelCentroidLat ?? field.latitude;
  const rawLongitude = field.parcelCentroidLng ?? field.longitude;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (rawLatitude != null && rawLongitude != null &&
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
    return {
      latitude,
      longitude,
      label: [field.village, field.district, field.city].filter(Boolean).join(' / ') || field.name || 'Tarla konumu',
    };
  }

  const searchCandidates = [
    [field.village, field.district, field.city].filter(Boolean).join(', '),
    [field.district, field.city].filter(Boolean).join(', '),
    field.city ?? '',
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  for (const query of searchCandidates) {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', query);
      url.searchParams.set('count', '1');
      url.searchParams.set('language', 'tr');
      url.searchParams.set('format', 'json');
      url.searchParams.set('countryCode', 'TR');

      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = await response.json();
      const result = payload?.results?.[0];

      if (
        result &&
        Number.isFinite(Number(result.latitude)) &&
        Number.isFinite(Number(result.longitude))
      ) {
        return {
          latitude: Number(result.latitude),
          longitude: Number(result.longitude),
          label:
            [field.village, field.district, field.city]
              .filter(Boolean)
              .join(' / ') || result.name || 'Tarla konumu',
        };
      }
    } catch (error) {
      console.warn('Tarla konumu çözümlenemedi:', error);
    }
  }

  return null;
};

const weatherCodeToCondition = (code: number) => {
  if (code === 0) return 'Açık';
  if ([1, 2].includes(code)) return 'Parçalı bulutlu';
  if (code === 3) return 'Kapalı';
  if ([45, 48].includes(code)) return 'Sisli';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Çisenti';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Yağmurlu';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Karlı';
  if ([95, 96, 99].includes(code)) return 'Gök gürültülü';
  return 'Değişken';
};

const forecastNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ||
  !Number.isFinite(Number(value)) ? null : Number(value);

export const fetchOpenMeteoForecast = async (
  latitude: number,
  longitude: number,
): Promise<WeatherForecastDay[]> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '5');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Hava servisi yanıt vermedi (${response.status}).`);
  }

  const data = await response.json();
  const daily = data?.daily;
  if (!Array.isArray(daily?.time) || daily.time.length === 0) {
    throw new Error('Hava tahmini alınamadı.');
  }

  return daily.time.slice(0, 5).map((date: string, index: number) => ({
    date,
    tempMin: forecastNumber(daily.temperature_2m_min?.[index]),
    tempMax: forecastNumber(daily.temperature_2m_max?.[index]),
    humidity: null,
    precipitation: forecastNumber(daily.precipitation_sum?.[index]),
    precipitationProbability: forecastNumber(daily.precipitation_probability_max?.[index]),
    windSpeed: forecastNumber(daily.wind_speed_10m_max?.[index]),
    condition: weatherCodeToCondition(Number(daily.weather_code?.[index] ?? -1)),
  }));
};

const getDeviceWeatherLocation = () =>
  new Promise<WeatherLocation | null>((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Mevcut konum',
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 10 * 60 * 1000,
      },
    );
  });

export const resolveHomeWeatherLocation = async (
  field?: Field | null,
): Promise<WeatherLocation> => {
  const deviceLocation = await getDeviceWeatherLocation();
  if (deviceLocation) return deviceLocation;

  if (field && !field.demo) {
    const latitude = field.parcelCentroidLat ?? field.latitude;
    const longitude = field.parcelCentroidLng ?? field.longitude;

    if (
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined &&
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude))
    ) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        label:
          [field.village, field.district, field.city].filter(Boolean).join(' / ') ||
          field.name ||
          'Tarla konumu',
      };
    }

    const geocoded = await geocodeFieldLocation(field);
    if (geocoded) return geocoded;
  }

  return {
    latitude: 38.6743,
    longitude: 39.2232,
    label: 'Elazığ',
  };
};
