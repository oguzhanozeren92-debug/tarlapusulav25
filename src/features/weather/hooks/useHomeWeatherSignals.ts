import { useMemo } from 'react';

type QuickDecision = {
  tone: 'neutral' | 'blue' | 'amber' | 'green' | 'red';
  title: string;
  detail: string;
};

type HomeWeatherSignalsInput = {
  weather?: any;
  field?: any;
};

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function useHomeWeatherSignals({
  weather,
  field,
}: HomeWeatherSignalsInput) {
  return useMemo(() => {
    const todayWeather = weather?.forecast?.[0];

    const headerTemperature = [
      todayWeather?.temperature,
      todayWeather?.temperatureCurrent,
      todayWeather?.temperatureMax,
      todayWeather?.maxTemperature,
    ].find((value) => Number.isFinite(Number(value)));

    const headerTemperatureLabel =
      weather?.status === 'loading'
        ? '…'
        : headerTemperature === undefined
          ? '—°'
          : `${Math.round(Number(headerTemperature))}°`;

    const headerCondition =
      String(
        todayWeather?.condition ??
          todayWeather?.description ??
          (weather?.status === 'loading'
            ? 'Hazırlanıyor'
            : weather?.status === 'error'
              ? 'Hava alınamadı'
              : 'Bugün'),
      ).trim() || 'Bugün';

    const headerLocation =
      String(
        weather?.locationLabel ?? field?.city ?? field?.district ?? 'Aktif tarla',
      ).trim() || 'Aktif tarla';

    const rainChance = firstFiniteNumber(
      todayWeather?.precipitationProbability,
      todayWeather?.precipitation_probability,
      todayWeather?.rainProbability,
      todayWeather?.rain_probability,
      todayWeather?.precipitationChance,
    );

    const rainMm = firstFiniteNumber(
      todayWeather?.precipitation,
      todayWeather?.precipitationMm,
      todayWeather?.rain,
      todayWeather?.rainMm,
      todayWeather?.precipitation_sum,
    );

    const windKmh = firstFiniteNumber(
      todayWeather?.windSpeed,
      todayWeather?.windSpeedMax,
      todayWeather?.windspeed,
      todayWeather?.wind_speed_10m_max,
      todayWeather?.wind,
    );

    const temperature = firstFiniteNumber(
      todayWeather?.temperature,
      todayWeather?.temperatureCurrent,
      todayWeather?.temperatureMax,
      todayWeather?.maxTemperature,
    );

    const temperatureMin = firstFiniteNumber(
      todayWeather?.temperatureMin,
      todayWeather?.minTemperature,
      todayWeather?.temperature_min,
      todayWeather?.temperature_2m_min,
    );

    const hasUsableTodayWeather = [
      rainChance,
      rainMm,
      windKmh,
      temperature,
      temperatureMin,
    ].some((value) => value != null);

    let irrigationQuick: QuickDecision;

    if (weather?.status === 'loading') {
      irrigationQuick = {
        tone: 'neutral',
        title: 'Hazırlanıyor',
        detail: 'Hava verisi kontrol ediliyor',
      };
    } else if (weather?.status === 'error' || !hasUsableTodayWeather) {
      irrigationQuick = {
        tone: 'neutral',
        title: 'Veriyi Bekle',
        detail: 'Hava verisi olmadan sulama kararı verme',
      };
    } else if (
      (rainChance != null && rainChance >= 60) ||
      (rainMm != null && rainMm >= 3)
    ) {
      irrigationQuick = {
        tone: 'blue',
        title: 'Yağışı Bekle',
        detail:
          rainChance != null
            ? `Yağış ihtimali %${Math.round(rainChance)}`
            : `${rainMm?.toFixed(1)} mm yağış`,
      };
    } else if (temperature != null && temperature >= 29) {
      irrigationQuick = {
        tone: 'amber',
        title: 'Akşam Daha Uygun',
        detail: '18:00 sonrası kontrol et',
      };
    } else {
      irrigationQuick = {
        tone: 'green',
        title: 'Serin Saatleri Seç',
        detail: 'Sabah erken veya akşam',
      };
    }

    let sprayingQuick: QuickDecision;

    if (weather?.status === 'loading') {
      sprayingQuick = {
        tone: 'neutral',
        title: 'Hazırlanıyor',
        detail: 'Uygun pencere aranıyor',
      };
    } else if (weather?.status === 'error' || !hasUsableTodayWeather) {
      sprayingQuick = {
        tone: 'neutral',
        title: 'Veriyi Bekle',
        detail: 'Rüzgâr ve yağış verisi olmadan karar verme',
      };
    } else if ((windKmh != null && windKmh >= 20) ||
      (rainChance != null && rainChance >= 45) || (rainMm != null && rainMm >= 1)) {
      sprayingQuick = {
        tone: 'red',
        title: 'Bugün Bekle',
        detail:
          windKmh != null && windKmh >= 20
            ? `Rüzgâr ${Math.round(windKmh)} km/sa`
            : rainChance != null && rainChance >= 45
              ? `Yağış ihtimali %${Math.round(rainChance)}`
              : `${rainMm?.toFixed(1)} mm yağış tahmini`,
      };
    } else if (windKmh == null || rainChance == null || rainMm == null) {
      sprayingQuick = {
        tone: 'neutral',
        title: 'Veriyi Bekle',
        detail: 'Yağış ve rüzgâr verisi tamamlanmadı',
      };
    } else {
      sprayingQuick = {
        tone: 'amber',
        title: 'Yağış ve Rüzgâr Sakin',
        detail: 'İlaçlamadan önce sıcaklığı, tarla koşullarını ve ürün etiketini kontrol et',
      };
    }

    return {
      todayWeather,
      headerTemperatureLabel,
      headerCondition,
      headerLocation,
      rainChance,
      rainMm,
      windKmh,
      temperature,
      temperatureMin,
      hasUsableTodayWeather,
      irrigationQuick,
      sprayingQuick,
    };
  }, [weather, field]);
}
