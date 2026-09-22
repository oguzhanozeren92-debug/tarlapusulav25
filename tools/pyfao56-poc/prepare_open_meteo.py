"""Convert a saved Open-Meteo daily + hourly JSON response to compare.py input.

Offline only. Does not query a weather API or retrieve private field locations.
"""

import argparse
from collections import defaultdict
from datetime import date
import json
import math
from pathlib import Path
import statistics
import sys


def require_numeric(value, key):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{key}: geçerli günlük/saatlik değer eksik")
    return float(value)


def prepare(payload, source, kind):
    if payload.get("timezone") not in ("UTC", "GMT") or payload.get("utc_offset_seconds") != 0:
        raise ValueError("Open-Meteo isteği timezone=UTC olmalı")
    units = payload.get("daily_units") or {}
    hourly_units = payload.get("hourly_units") or {}
    expected_daily = {
        "shortwave_radiation_sum": "MJ/m²", "et0_fao_evapotranspiration": "mm",
        "precipitation_sum": "mm", "temperature_2m_max": "°C",
        "temperature_2m_min": "°C",
    }
    for key, unit in expected_daily.items():
        if units.get(key) != unit:
            raise ValueError(f"daily_units.{key}: {unit} bekleniyor")
    if hourly_units.get("wind_speed_10m") != "m/s" or hourly_units.get("relative_humidity_2m") != "%":
        raise ValueError("Saatlik rüzgâr m/s ve bağıl nem % biriminde olmalı")
    daily, hourly = payload.get("daily") or {}, payload.get("hourly") or {}
    dates = daily.get("time")
    if not isinstance(dates, list) or len(dates) < 2:
        raise ValueError("daily.time: en az iki gün gerekli")
    winds, humidities = defaultdict(list), defaultdict(list)
    hours = hourly.get("time")
    rh = hourly.get("relative_humidity_2m")
    wind = hourly.get("wind_speed_10m")
    if not isinstance(hours, list) or not isinstance(rh, list) or not isinstance(wind, list) or len(hours) != len(rh) or len(hours) != len(wind):
        raise ValueError("Saatlik zaman/nem/rüzgâr dizileri aynı uzunlukta olmalı")
    for index, timestamp in enumerate(hours):
        if not isinstance(timestamp, str) or len(timestamp) != 16 or timestamp[10] != "T":
            raise ValueError("Saatlik zaman damgası beklenmeyen biçimde")
        day = timestamp[:10]
        winds[day].append(require_numeric(wind[index], f"hourly.wind_speed_10m[{index}]"))
        humidities[day].append(require_numeric(rh[index], f"hourly.relative_humidity_2m[{index}]"))
    rows = []
    for index, day in enumerate(dates):
        date.fromisoformat(day)
        if len(winds[day]) != 24 or len(humidities[day]) != 24:
            raise ValueError(f"{day}: 24 saatlik nem/rüzgâr verisi gerekli")
        def daily_value(key):
            values = daily.get(key)
            if not isinstance(values, list) or len(values) != len(dates):
                raise ValueError(f"daily.{key}: gün sayısı uyuşmuyor")
            return require_numeric(values[index], f"daily.{key}[{index}]")
        rows.append({
            "date": day,
            "solar_radiation_mj_m2": daily_value("shortwave_radiation_sum"),
            "tmax_c": daily_value("temperature_2m_max"),
            "tmin_c": daily_value("temperature_2m_min"),
            "rhmax_pct": max(humidities[day]),
            "rhmin_pct": min(humidities[day]),
            "wind_m_s": statistics.mean(winds[day]),
            "rain_mm": daily_value("precipitation_sum"),
            "app_et0_mm": daily_value("et0_fao_evapotranspiration"),
        })
    return {
        "data_type": kind,
        "source": source,
        "station": {
            "latitude": require_numeric(payload.get("latitude"), "latitude"),
            "elevation_m": require_numeric(payload.get("elevation"), "elevation"),
            "wind_height_m": 10,
        },
        "days": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Daha önce kaydedilmiş Open-Meteo JSON yanıtı")
    parser.add_argument("--kind", choices=("historical_model", "forecast"), required=True,
                        help="Yanıtın geriye dönük model mi tahmin mi olduğunu belirt")
    parser.add_argument("--source", required=True, help="Kaynağın uç noktasını/modelini tanımla")
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        print(json.dumps(prepare(payload, args.source, args.kind), ensure_ascii=False, indent=2))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"Günlük veri oluşturulamadı: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
