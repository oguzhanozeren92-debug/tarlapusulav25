import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { fetchNasaPowerData } from '../../../services/nasaPowerService';
import {
  fetchOpenMeteoForecast,
  geocodeFieldLocation,
  resolveHomeWeatherLocation,
} from '../../../services/weatherService';
import type {
  Field,
  FieldWeatherState,
  WeatherForecastDay,
  WeatherProviderResult,
} from '../../../types';
import { fetchHourlySprayForecast, type HourlySprayState } from '../services/hourlySprayForecast';

export type NasaPowerCardState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  fieldId?: string;
  fieldName?: string;
  data?: Awaited<ReturnType<typeof fetchNasaPowerData>>;
  message?: string;
};

export type Era5ClimateResponse = {
  success?: boolean;
  source?: string;
  provider?: string;
  underlyingDatasets?: {
    land?: string;
    precipitation?: string;
  };
  dataType?: string;
  latitude?: number;
  longitude?: number;
  era5LandGrid?: {
    latitude?: number | null;
    longitude?: number | null;
    elevation?: number | null;
    resolutionDegrees?: number | null;
  };
  era5PrecipGrid?: {
    latitude?: number | null;
    longitude?: number | null;
    elevation?: number | null;
    resolutionDegrees?: number | null;
  };
  requestedDays?: number;
  period?: {
    start?: string;
    end?: string;
  };
  hourlyCount?: number;
  precipitationValidCount?: number;
  summary?: {
    averageTemperatureC?: number | null;
    totalPrecipitationMm?: number | null;
    averageSoilTemperature0To7CmC?: number | null;
    averageSoilTemperature7To28CmC?: number | null;
    averageSoilMoisture0To7Cm?: number | null;
    averageSoilMoisture7To28Cm?: number | null;
    averageSoilMoisture28To100Cm?: number | null;
    averageSoilMoisture100To255Cm?: number | null;
  };
  units?: {
    temperature?: string;
    precipitation?: string;
    soilMoisture?: string;
  };
  rows?: Array<Record<string, unknown>>;
  fetchedAt?: string;
  error?: string;
};

export type Era5ClimateState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  fieldId?: string;
  fieldName?: string;
  data?: Era5ClimateResponse;
  message?: string;
};

export type UnifiedClimateContext = {
  version: 1;
  fieldId: string;
  fieldName: string;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
  generatedAt: string;
  confidence: 'high' | 'medium' | 'limited';
  sourcePriority: string[];
  nasaPower: {
    status: NasaPowerCardState['status'];
    data: NasaPowerCardState['data'] | null;
  };
  era5: {
    status: Era5ClimateState['status'];
    data: Era5ClimateResponse | null;
  };
  normalized: {
    averageTemperatureC: number | null;
    totalPrecipitationMm: number | null;
    averageHumidityPercent: number | null;
    averageWindSpeed: number | null;
    averageSolarRadiation: number | null;
    soilTemperature0To7CmC: number | null;
    soilTemperature7To28CmC: number | null;
    soilMoisture0To7Cm: number | null;
    soilMoisture7To28Cm: number | null;
    soilMoisture28To100Cm: number | null;
    soilMoisture100To255Cm: number | null;
  };
  notes: string[];
};

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildUnifiedClimateContext(
  field: Field | null,
  nasaPowerState: NasaPowerCardState,
  era5ClimateState: Era5ClimateState,
): UnifiedClimateContext | null {
  if (!field) return null;

  const fieldId = String(field.id);
  const nasaMatches =
    nasaPowerState.status === 'ready' &&
    String(nasaPowerState.fieldId ?? '') === fieldId &&
    Boolean(nasaPowerState.data);
  const era5Matches =
    era5ClimateState.status === 'ready' &&
    String(era5ClimateState.fieldId ?? '') === fieldId &&
    Boolean(era5ClimateState.data);

  if (!nasaMatches && !era5Matches) return null;

  const nasaSummary = nasaMatches ? nasaPowerState.data?.summary : null;
  const eraSummary = era5Matches ? era5ClimateState.data?.summary : null;

  const nasaTemp = finiteNumber(nasaSummary?.averageTemperature);
  const eraTemp = finiteNumber(eraSummary?.averageTemperatureC);
  const nasaRain = finiteNumber(nasaSummary?.totalPrecipitation);
  const eraRain = finiteNumber(eraSummary?.totalPrecipitationMm);

  const averageTemperatureC =
    nasaTemp !== null && eraTemp !== null
      ? Number(((nasaTemp + eraTemp) / 2).toFixed(2))
      : (eraTemp ?? nasaTemp);
  const totalPrecipitationMm =
    nasaRain !== null && eraRain !== null
      ? Number(((nasaRain + eraRain) / 2).toFixed(2))
      : (eraRain ?? nasaRain);

  const tempDifference =
    nasaTemp !== null && eraTemp !== null ? Math.abs(nasaTemp - eraTemp) : null;
  const rainDifference =
    nasaRain !== null && eraRain !== null ? Math.abs(nasaRain - eraRain) : null;

  const notes: string[] = [
    'NASA POWER iklim referansı; ERA5-Land/ERA5 bölgesel reanalysis verisi olarak değerlendirilir.',
    'Bu veriler tarla içi sensör ölçümü değildir; Pusula AI kararlarında kullanıcı kaydı, gerçek laboratuvar analizi ve saha gözlemleri daha yüksek öncelik taşır.',
  ];

  if (tempDifference !== null && tempDifference >= 3) {
    notes.push(
      `NASA POWER ile ERA5 ortalama sıcaklıkları arasında ${tempDifference.toFixed(1)} °C fark var; sıcaklık yorumu belirsizlik içerebilir.`,
    );
  }

  if (rainDifference !== null && rainDifference >= 10) {
    notes.push(
      `NASA POWER ile ERA5 toplam yağış değerleri arasında ${rainDifference.toFixed(1)} mm fark var; yağış yorumu kaynaklar arası belirsizlik içerir.`,
    );
  }

  const confidence: UnifiedClimateContext['confidence'] =
    nasaMatches && era5Matches
      ? tempDifference !== null && tempDifference >= 3
        ? 'medium'
        : 'high'
      : 'limited';

  return {
    version: 1,
    fieldId,
    fieldName: field.name,
    coordinates: {
      latitude: finiteNumber(field.parcelCentroidLat ?? field.latitude),
      longitude: finiteNumber(field.parcelCentroidLng ?? field.longitude),
    },
    generatedAt: new Date().toISOString(),
    confidence,
    sourcePriority: [
      'Kullanıcı saha kaydı / sensör / laboratuvar',
      'Kısa vadeli hava tahmin sağlayıcıları',
      'ERA5-Land + ERA5 bölgesel reanalysis',
      'NASA POWER iklim referansı',
    ],
    nasaPower: {
      status: nasaPowerState.status,
      data: nasaMatches ? nasaPowerState.data ?? null : null,
    },
    era5: {
      status: era5ClimateState.status,
      data: era5Matches ? era5ClimateState.data ?? null : null,
    },
    normalized: {
      averageTemperatureC,
      totalPrecipitationMm,
      averageHumidityPercent: finiteNumber(nasaSummary?.averageHumidity),
      averageWindSpeed: finiteNumber(nasaSummary?.averageWindSpeed),
      averageSolarRadiation: finiteNumber(nasaSummary?.averageSolarRadiation),
      soilTemperature0To7CmC: finiteNumber(eraSummary?.averageSoilTemperature0To7CmC),
      soilTemperature7To28CmC: finiteNumber(eraSummary?.averageSoilTemperature7To28CmC),
      soilMoisture0To7Cm: finiteNumber(eraSummary?.averageSoilMoisture0To7Cm),
      soilMoisture7To28Cm: finiteNumber(eraSummary?.averageSoilMoisture7To28Cm),
      soilMoisture28To100Cm: finiteNumber(eraSummary?.averageSoilMoisture28To100Cm),
      soilMoisture100To255Cm: finiteNumber(eraSummary?.averageSoilMoisture100To255Cm),
    },
    notes,
  };
}

type UseAppWeatherDataOptions = {
  realFields: Field[];
  favoriteFieldId: string;
};

export function useAppWeatherData({ realFields, favoriteFieldId }: UseAppWeatherDataOptions) {
  const [fieldWeather, setFieldWeather] = useState<Record<string, FieldWeatherState>>({});
  const [fieldHourlyWeather, setFieldHourlyWeather] = useState<Record<string, HourlySprayState>>({});
  const hourlyInFlight = useRef(new Set<string>());
  const hourlyFetchedAt = useRef(new Map<string, number>());
  const [weatherHubFieldId, setWeatherHubFieldId] = useState('');
  const [nasaPowerState, setNasaPowerState] = useState<NasaPowerCardState>({ status: 'idle' });
  const [era5ClimateState, setEra5ClimateState] = useState<Era5ClimateState>({ status: 'idle' });

  const loadHomeWeather = async (field?: Field | null) => {
    const key = '__home__';

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      const location = await resolveHomeWeatherLocation(field);
      const forecast = await fetchOpenMeteoForecast(location.latitude, location.longitude);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast,
          providers: [{ name: 'Open-Meteo', forecast }],
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Ana sayfa hava durumu yüklenemedi:', error);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel,
          message: error instanceof Error ? error.message : 'Hava tahmini alınamadı.',
        },
      }));
    }
  };

  const loadFieldWeather = async (field: Field) => {
    const key = String(field.id);
    if (fieldWeather[key]?.status === 'loading') return;

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      const location = await geocodeFieldLocation(field);
      if (!location) {
        throw new Error('Bu tarla için hava tahmini göstermek üzere il veya ilçe bilgisi gerekli.');
      }

      const { data, error } = await supabase.functions.invoke('weather-compare', {
        body: { latitude: location.latitude, longitude: location.longitude },
      });
      if (error) throw error;

      const forecast = Array.isArray(data?.forecast)
        ? (data.forecast as WeatherForecastDay[]).slice(0, 5)
        : [];
      const rawProviders = Array.isArray(data?.providers)
        ? data.providers
        : Array.isArray(data?.sources)
          ? data.sources
          : Array.isArray(data?.results)
            ? data.results
            : [];

      const providers: WeatherProviderResult[] = rawProviders
        .map((provider: any, index: number) => {
          const providerForecast = Array.isArray(provider?.forecast)
            ? provider.forecast.slice(0, 5)
            : Array.isArray(provider?.days)
              ? provider.days.slice(0, 5)
              : [];

          return {
            name:
              String(provider?.name ?? provider?.provider ?? provider?.source ?? `Kaynak ${index + 1}`).trim() ||
              `Kaynak ${index + 1}`,
            forecast: providerForecast,
          };
        })
        .filter((provider: WeatherProviderResult) => provider.forecast.length > 0)
        .slice(0, 3);

      if (!forecast.length && providers.length === 0) {
        setFieldWeather((current) => ({
          ...current,
          [key]: {
            status: 'error',
            forecast: [],
            providers: [],
            locationLabel: location.label,
            message: data?.message ?? 'Hava tahmini güncelleniyor.',
          },
        }));
        return;
      }

      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast: forecast.length ? forecast : providers[0]?.forecast ?? [],
          providers,
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Tarla hava durumu yüklenemedi:', error);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel,
          message: error instanceof Error ? error.message : 'Hava tahmini güncelleniyor.',
        },
      }));
    }
  };

  const loadFieldHourlyWeather = useCallback(async (field: Field, force = false) => {
    const key = String(field.id);
    if (hourlyInFlight.current.has(key)) return;
    if (!force && Date.now() - (hourlyFetchedAt.current.get(key) ?? 0) < 30 * 60 * 1000) return;
    hourlyInFlight.current.add(key);
    setFieldHourlyWeather((current) => ({
      ...current,
      [key]: { status: 'loading', data: current[key]?.data },
    }));
    try {
      const location = await geocodeFieldLocation(field);
      if (!location) throw new Error('Tarla konumu bulunamadı.');
      const data = await fetchHourlySprayForecast(location.latitude, location.longitude);
      hourlyFetchedAt.current.set(key, Date.now());
      setFieldHourlyWeather((current) => ({ ...current, [key]: { status: 'ready', data } }));
    } catch (error) {
      setFieldHourlyWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Saatlik tahmin alınamadı.',
        },
      }));
      // Başarısız isteği hemen tekrar tekrar deneme; yeniden dene düğmesi zorlayabilir.
      hourlyFetchedAt.current.set(key, Date.now());
    } finally {
      hourlyInFlight.current.delete(key);
    }
  }, []);

  const climateTargetField = useMemo(
    () =>
      realFields.find((field) => String(field.id) === String(weatherHubFieldId)) ??
      realFields.find((field) => String(field.id) === String(favoriteFieldId)) ??
      realFields[0] ??
      null,
    [realFields, weatherHubFieldId, favoriteFieldId],
  );

  useEffect(() => {
    if (!climateTargetField) {
      setNasaPowerState({ status: 'idle' });
      return;
    }

    const latitude = Number(climateTargetField.parcelCentroidLat ?? climateTargetField.latitude ?? NaN);
    const longitude = Number(climateTargetField.parcelCentroidLng ?? climateTargetField.longitude ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNasaPowerState({
        status: 'error',
        fieldId: String(climateTargetField.id),
        fieldName: climateTargetField.name,
        message: 'Bu tarla için iklim referansı oluşturacak koordinat bulunamadı.',
      });
      return;
    }

    let active = true;
    setNasaPowerState({
      status: 'loading',
      fieldId: String(climateTargetField.id),
      fieldName: climateTargetField.name,
    });

    void fetchNasaPowerData(latitude, longitude, 7)
      .then((data) => {
        if (!active) return;
        setNasaPowerState({
          status: 'ready',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          data,
        });
      })
      .catch((error) => {
        if (!active) return;
        setNasaPowerState({
          status: 'error',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          message: error instanceof Error ? error.message : 'NASA POWER iklim verisi alınamadı.',
        });
      });

    return () => {
      active = false;
    };
  }, [climateTargetField?.id, climateTargetField?.parcelCentroidLat, climateTargetField?.parcelCentroidLng, climateTargetField?.latitude, climateTargetField?.longitude]);

  useEffect(() => {
    if (!climateTargetField) {
      setEra5ClimateState({ status: 'idle' });
      return;
    }

    const latitude = Number(climateTargetField.parcelCentroidLat ?? climateTargetField.latitude ?? NaN);
    const longitude = Number(climateTargetField.parcelCentroidLng ?? climateTargetField.longitude ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setEra5ClimateState({
        status: 'error',
        fieldId: String(climateTargetField.id),
        fieldName: climateTargetField.name,
        message: 'Bu tarla için ERA5 iklim bağlamı oluşturacak koordinat bulunamadı.',
      });
      return;
    }

    let active = true;
    setEra5ClimateState({
      status: 'loading',
      fieldId: String(climateTargetField.id),
      fieldName: climateTargetField.name,
    });

    void supabase.functions
      .invoke('era5-land', { body: { latitude, longitude, days: 7 } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;

        const result = (data ?? {}) as Era5ClimateResponse;
        if (result.success === false) {
          throw new Error(result.error || 'ERA5-Land verisi alınamadı.');
        }

        setEra5ClimateState({
          status: 'ready',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          data: result,
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error(`❌ ERA5-Land + ERA5 HATASI → ${climateTargetField.name}`, error);
        setEra5ClimateState({
          status: 'error',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          message: error instanceof Error ? error.message : 'ERA5-Land iklim verisi alınamadı.',
        });
      });

    return () => {
      active = false;
    };
  }, [climateTargetField?.id, climateTargetField?.parcelCentroidLat, climateTargetField?.parcelCentroidLng, climateTargetField?.latitude, climateTargetField?.longitude]);

  const unifiedClimateContext = useMemo(
    () => buildUnifiedClimateContext(climateTargetField, nasaPowerState, era5ClimateState),
    [climateTargetField, nasaPowerState, era5ClimateState],
  );

  return {
    fieldWeather,
    fieldHourlyWeather,
    loadFieldHourlyWeather,
    weatherHubFieldId,
    setWeatherHubFieldId,
    loadHomeWeather,
    loadFieldWeather,
    nasaPowerState,
    era5ClimateState,
    unifiedClimateContext,
  };
}
