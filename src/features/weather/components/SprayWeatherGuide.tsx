import { useState } from 'react';
import type { WeatherForecastDay } from '../../../types';
import { screenSprayWeather } from '../services/sprayWeatherScreening';
import { buildHourlySprayPlan, formatForecastHour, localForecastDay, type HourlySprayState } from '../services/hourlySprayForecast';
import './SprayWeatherGuide.css';

type Props = {
  fieldName: string;
  forecast: WeatherForecastDay[];
  hourly?: HourlySprayState;
  onRefreshHourly?: () => void;
  onPlanWindow?: (date: string, time: string, until: string) => void;
};

function dayLabel(date: string, index: number): string {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? `${index + 1}. gün`
    : new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }).format(parsed);
}

export default function SprayWeatherGuide({ fieldName, forecast, hourly, onRefreshHourly, onPlanWindow }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = forecast.slice(0, 5);
  const index = Math.max(0, days.findIndex((day) => day.date === selectedDate));
  const selected = days[index];
  const assessment = selected ? screenSprayWeather(selected) : null;
  const hourlyData = hourly?.status === 'ready' ? hourly.data : null;
  const hourlyPlan = buildHourlySprayPlan(hourlyData);

  return (
    <section className="tp-spray-guide" id="tp-spray-guide" aria-labelledby="tp-spray-guide-title">
      <div className="tp-spray-guide-heading">
        <div>
          <span className="tp-spray-guide-kicker">{fieldName} · Hava kontrolü</span>
          <h2 id="tp-spray-guide-title">İlaçlama planı</h2>
        </div>
        <span aria-hidden="true">↗</span>
      </div>
      <p>Önce bugünün saatlerine bak; aşağıda diğer günleri de karşılaştırabilirsin.</p>

      <div className="tp-spray-hourly" aria-live="polite">
        <div className="tp-spray-hourly-heading">
          <strong>Bugün hangi saatler?</strong>
          {onRefreshHourly && <button type="button" onClick={onRefreshHourly} disabled={hourly?.status === 'loading'}>↻ Yenile</button>}
        </div>
        {hourly?.status === 'loading' ? <p>Saatlik tahmin güncelleniyor…</p>
          : hourly?.status === 'error' ? <p>{hourly.message || 'Saatlik tahmin alınamadı.'}</p>
          : hourlyData ? (
            <>
              <p>{hourlyPlan.message}</p>
              {hourlyPlan.windows.length > 0 && (
                <div className="tp-spray-hourly-windows">
                  {hourlyPlan.windows.map((window) => (
                    <div key={window.from} className="tp-spray-hourly-window">
                      <strong>{formatForecastHour(window.from, hourlyData.timezone)}–{formatForecastHour(window.to, hourlyData.timezone)}</strong>
                      <small>Rüzgâr en çok {Math.round(window.maxWindKmh)} km/sa · yağış olasılığı en çok %{Math.round(window.maxRainChance)}</small>
                      {onPlanWindow && (
                        <button type="button" className="tp-spray-hourly-plan" onClick={() => onPlanWindow(
                          localForecastDay(window.from, hourlyData.timezone),
                          formatForecastHour(window.from, hourlyData.timezone),
                          formatForecastHour(window.to, hourlyData.timezone),
                        )}>Bu saati takvime ekle →</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {hourlyPlan.nextRisk && <p className="tp-spray-hourly-risk">Dikkat: {hourlyPlan.nextRisk}.</p>}
              <small>Open-Meteo saatlik tahmini · {formatForecastHour(hourlyData.updatedAt, hourlyData.timezone)} güncellendi</small>
            </>
          ) : <p>Saatlik tahmin yüklenince olası aralıklar burada görünecek.</p>}
      </div>

      {selected ? (
        <>
          <div className="tp-spray-guide-days" aria-label="İlaçlama hava kontrolü için gün seç">
            {days.map((day, dayIndex) => {
              const result = screenSprayWeather(day);
              const active = dayIndex === index;
              return (
                <button
                  type="button"
                  key={`${day.date}-${dayIndex}`}
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <strong>{dayLabel(day.date, dayIndex)}</strong>
                  <small>{result.title}</small>
                </button>
              );
            })}
          </div>
          <div className="tp-spray-guide-result" role="status" aria-live="polite">
            <strong>{dayLabel(selected.date, index)}: {assessment?.title}</strong>
            <ul>{assessment?.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </div>
          <p className="tp-spray-guide-note">
            Saatlik aralıklar da yalnızca hava ön kontrolüdür; ilaçlama onayı değildir. İşleme başlamadan önce tarladaki
            rüzgârı, sıcaklığı, yaklaşan yağışı ve kullanacağın ürünün etiketini kontrol et.
          </p>
        </>
      ) : (
        <p className="tp-spray-guide-note">Bu tarla için hava tahmini gelince günlük kontrol burada görünecek.</p>
      )}
    </section>
  );
}
