import type { FieldWeatherState } from '../../../types';
import './HomeFiveDayForecast.css';

type Props = {
  weather?: FieldWeatherState | null;
  onOpen: () => void;
};

function dayLabel(date: string): string {
  const day = new Date(`${date}T12:00:00`);
  return Number.isNaN(day.getTime())
    ? date
    : new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(day);
}

export default function HomeFiveDayForecast({ weather, onOpen }: Props) {
  const days = weather?.status === 'ready' ? weather.forecast.slice(0, 5) : [];

  return (
    <button type="button" className="tp-home-forecast" onClick={onOpen} aria-label="5 günlük hava tahmininin ayrıntılarını aç">
      <span className="tp-home-forecast-heading">
        <strong>5 Günlük Hava</strong>
        <span>Ayrıntılar ›</span>
      </span>
      {days.length > 0 ? (
        <span className="tp-home-forecast-days">
          {days.map((day, index) => (
            <span className="tp-home-forecast-day" key={`${day.date}-${index}`}>
              <span>{index === 0 ? 'Bugün' : dayLabel(day.date)}</span>
              <strong>{day.tempMax != null ? `${Math.round(day.tempMax)}°` : '—'}</strong>
              <small>{day.precipitation != null ? `${day.precipitation.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mm` : 'Yağış —'}</small>
            </span>
          ))}
        </span>
      ) : (
        <span className="tp-home-forecast-empty">
          {weather?.status === 'loading' ? 'Hava tahmini yükleniyor…' : 'Bu tarla için 5 günlük hava tahmini henüz yok.'}
        </span>
      )}
    </button>
  );
}
