"""Compare pyfao56 reference ET with the app's ET0 and Kc on identical days.

Input is an explicit, locally held JSON export. No Supabase credentials, field
records or weather observations are checked into this repository.
"""

import argparse
from datetime import date, timedelta
import json
import math
from pathlib import Path
import sys

import pyfao56 as fao


def number(value, name, minimum=None, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name}: sonlu bir sayı gerekli")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError(f"{name}: izin verilen aralığın dışında")
    return float(value)


def compare(payload):
    if payload.get("data_type") not in ("observed", "historical_model", "forecast", "synthetic"):
        raise ValueError("data_type: observed, historical_model, forecast veya synthetic olmalı")
    if not isinstance(payload.get("source"), str) or not payload["source"].strip():
        raise ValueError("source: hava ve uygulama verilerinin kaynağı gerekli")
    site = payload.get("station") or {}
    lat = number(site.get("latitude"), "station.latitude", -90, 90)
    elevation = number(site.get("elevation_m"), "station.elevation_m", -500, 9000)
    wind_height = number(site.get("wind_height_m"), "station.wind_height_m", 0.1, 100)
    days = payload.get("days")
    if not isinstance(days, list) or not 2 <= len(days) <= 366:
        raise ValueError("days: ardışık en az iki ve en fazla 366 günlük veri gerekli")

    weather = fao.Weather(comment="Offline comparison")
    weather.rfcrp = "S"
    weather.lat = lat
    weather.z = elevation
    weather.wndht = wind_height
    results = []
    previous = None
    for index, row in enumerate(days):
        prefix = f"days[{index}]"
        if not isinstance(row, dict):
            raise ValueError(f"{prefix}: günlük veri nesnesi gerekli")
        try:
            day = date.fromisoformat(row["date"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"{prefix}.date: YYYY-MM-DD gerekli") from exc
        if previous is not None and day != previous + timedelta(days=1):
            raise ValueError(f"{prefix}.date: günler tekrar etmeden ardışık olmalı")
        previous = day
        tmax = number(row.get("tmax_c"), f"{prefix}.tmax_c", -70, 70)
        tmin = number(row.get("tmin_c"), f"{prefix}.tmin_c", -70, 70)
        if tmin > tmax:
            raise ValueError(f"{prefix}: minimum sıcaklık maksimumdan büyük")
        rhmax = number(row.get("rhmax_pct"), f"{prefix}.rhmax_pct", 0, 100)
        rhmin = number(row.get("rhmin_pct"), f"{prefix}.rhmin_pct", 0, 100)
        if rhmin > rhmax:
            raise ValueError(f"{prefix}: minimum nem maksimumdan büyük")
        srad = number(row.get("solar_radiation_mj_m2"), f"{prefix}.solar_radiation_mj_m2", 0, 50)
        wind = number(row.get("wind_m_s"), f"{prefix}.wind_m_s", 0, 60)
        rain = number(row.get("rain_mm"), f"{prefix}.rain_mm", 0, 1000)
        app_eto = number(row.get("app_et0_mm"), f"{prefix}.app_et0_mm", 0, 40)
        kc = (number(row["app_kc"], f"{prefix}.app_kc", 0, 3)
              if row.get("app_kc") is not None else None)
        key = f"{day.year}-{day.timetuple().tm_yday:03d}"
        weather.wdata.loc[key] = [srad, tmax, tmin, math.nan, math.nan,
                                   rhmax, rhmin, wind, rain, math.nan,
                                   "M" if payload["data_type"] == "observed" else "P"]
        py_et = float(weather.compute_etref(key))
        if not math.isfinite(py_et) or py_et < 0:
            raise ValueError(f"{prefix}: pyfao56 geçerli ET hesaplayamadı")
        results.append({
            "date": day.isoformat(),
            "app_fao_et0_mm": round(app_eto, 3),
            "pyfao56_asce_short_et_mm": round(py_et, 3),
            "reference_difference_mm": round(py_et - app_eto, 3),
            "app_kc": round(kc, 3) if kc is not None else None,
            "app_kc_x_fao_et0_mm": round(kc * app_eto, 3) if kc is not None else None,
            "app_kc_x_asce_et_mm": round(kc * py_et, 3) if kc is not None else None,
        })
    return {
        "data_type": payload["data_type"],
        "source": payload["source"],
        "scope": ("reference ET and ET0 × same app Kc"
                  if all(row["app_kc"] is not None for row in results)
                  else "reference ET only; app Kc missing on some days"),
        "irrigation_amount_comparable": False,
        "reason": "Toprak başlangıç nemi, kök profili, gerçek sulama kayıtları ve model kalibrasyonu eşleştirilmedi.",
        "days": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Yerel karşılaştırma JSON dosyası")
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        print(json.dumps(compare(payload), ensure_ascii=False, indent=2))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"Karşılaştırma yapılamadı: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
