import type { WeatherForecastDay } from '../types';

export const getCropEmoji = (crop: string) => {
  const value = crop.toLocaleLowerCase('tr-TR');

  if (value.includes('mısır')) return '🌽';
  if (value.includes('arpa') || value.includes('buğday')) return '🌾';
  if (value.includes('ayçiçe')) return '🌻';
  if (value.includes('pamuk')) return '🌱';
  if (value.includes('üzüm') || value.includes('bağ')) return '🍇';
  if (value.includes('zeytin')) return '🫒';
  if (value.includes('ceviz') || value.includes('fındık')) return '🌳';
  if (value.includes('kiraz') || value.includes('elma')) return '🍎';

  return '🌿';
};

export const getWeatherIcon = (condition?: string) => {
  const value = (condition ?? '').toLocaleLowerCase('tr-TR');

  if (value.includes('gök') || value.includes('thunder')) return '⛈️';
  if (value.includes('kar') || value.includes('snow')) return '🌨️';
  if (value.includes('sağanak') || value.includes('rain') || value.includes('yağmur')) return '🌧️';
  if (value.includes('sis') || value.includes('fog')) return '🌫️';
  if (value.includes('kapalı') || value.includes('cloudy')) return '☁️';
  if (value.includes('parçalı') || value.includes('partly')) return '🌤️';
  if (value.includes('açık') || value.includes('clear')) return '☀️';

  return '🌦️';
};

export const formatWeatherDay = (dateValue: string, index: number) => {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';

  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short',
  }).format(new Date(`${dateValue}T12:00:00`));
};

export const getWeatherRecommendation = (day?: WeatherForecastDay) => {
  if (!day) return 'Hava tahmini hazırlanıyor.';

  const rainChance = day.precipitationProbability ?? 0;
  const rainAmount = day.precipitation ?? 0;
  const wind = day.windSpeed ?? 0;
  const maxTemp = day.tempMax ?? 0;

  if (rainChance >= 70 || rainAmount >= 8) {
    return 'Yağış ihtimali yüksek. İlaçlama ve gübreleme planını yağış saatlerine göre düzenle.';
  }

  if (wind >= 30) {
    return 'Rüzgâr kuvvetli görünüyor. İlaçlama gibi sürüklenmeden etkilenen uygulamaları ertelemen daha güvenli olabilir.';
  }

  if (maxTemp >= 34) {
    return 'Sıcaklık yüksek. Sulama ve saha çalışmalarını günün daha serin saatlerine planlamak faydalı olabilir.';
  }

  if (rainChance >= 35) {
    return 'Yağış ihtimali var. Saha işlerinden önce güncel tahmini tekrar kontrol et.';
  }

  return 'Hava koşulları saha çalışmaları için genel olarak uygun görünüyor.';
};
