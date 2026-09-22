"""Check whether a local, explicitly sourced season dataset is ready for model pilots.

No network calls, database access, model execution, or inferred field values.
Only missing input names and readiness flags are printed; field values are not echoed.
"""

import argparse
from datetime import date, timedelta
import json
import math
from pathlib import Path


def value_at(data, path):
    current = data
    for key in path.split("."):
        current = current.get(key) if isinstance(current, dict) else None
    return current


def has_value(data, path):
    value = value_at(data, path)
    return value is not None and value != "" and value != []


def valid_date(value):
    try:
        return date.fromisoformat(value) if isinstance(value, str) else None
    except ValueError:
        return None


def weather_gaps(data, start, end, fields):
    rows = value_at(data, "daily_weather")
    if not isinstance(rows, list):
        return ["daily_weather: günlük liste gerekli"]
    by_day = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        day = valid_date(row.get("date"))
        if day is not None and day not in by_day:
            by_day[day] = row

    missing_days = 0
    missing_fields = set()
    invalid_fields = set()
    day = start
    while day <= end:
        row = by_day.get(day)
        if row is None:
            missing_days += 1
        else:
            for field in fields:
                if not has_value(row, field):
                    missing_fields.add(field)
                else:
                    try:
                        number = float(row[field])
                        if not math.isfinite(number) or (field not in ("tmin_c", "tmax_c") and number < 0):
                            invalid_fields.add(field)
                    except (TypeError, ValueError):
                        invalid_fields.add(field)
        day += timedelta(days=1)

    gaps = []
    if missing_days:
        gaps.append(f"daily_weather: {missing_days} gün eksik")
    gaps.extend(f"daily_weather.{field}: bazı günlerde eksik" for field in sorted(missing_fields))
    gaps.extend(f"daily_weather.{field}: geçersiz sayı" for field in sorted(invalid_fields))
    return gaps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Yerel JSON; tarla verisini repoya eklemeyin")
    args = parser.parse_args()
    data = json.loads(args.dataset.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        parser.error("JSON nesnesi gerekli")
    data_type_valid = value_at(data, "data_type") in ("observed", "historical_model", "synthetic")

    common = [
        "field.crop", "field.crop_cycle", "field.planting_date", "field.end_date",
        "site.latitude", "site.longitude", "site.elevation_m",
    ]
    missing = [path for path in common if not has_value(data, path)]
    if not data_type_valid:
        missing.append("data_type: observed, historical_model veya synthetic gerekli")
    start = valid_date(value_at(data, "field.planting_date"))
    end = valid_date(value_at(data, "field.end_date"))
    if has_value(data, "field.planting_date") and start is None:
        missing.append("field.planting_date: YYYY-MM-DD gerekli")
    if has_value(data, "field.end_date") and end is None:
        missing.append("field.end_date: YYYY-MM-DD gerekli")
    if start and end and end < start:
        missing.append("field.end_date: ekim tarihinden önce olamaz")
    if start and end and (end - start).days > 730:
        missing.append("field.end_date: pilot dönemi 730 günü geçemez")
    if value_at(data, "field.crop_cycle") not in (None, "", "annual"):
        missing.append("field.crop_cycle: bu iki pilot yalnızca yıllık bitki için")
    for path, low, high in (("site.latitude", -90, 90), ("site.longitude", -180, 180), ("site.elevation_m", -500, 9000)):
        value = value_at(data, path)
        if value is not None:
            try:
                if not math.isfinite(float(value)) or not low <= float(value) <= high:
                    missing.append(f"{path}: geçerli koordinat gerekli")
            except (TypeError, ValueError):
                missing.append(f"{path}: geçerli koordinat gerekli")

    pcse = list(missing)
    aquacrop = list(missing)
    for path in ("pcse.crop_parameters_source", "pcse.soil_parameters_source", "pcse.agromanagement_source"):
        if not has_value(data, path):
            pcse.append(path)
    for path in ("aquacrop.crop_parameters_source", "aquacrop.soil_profile_source", "aquacrop.initial_water_content_source"):
        if not has_value(data, path):
            aquacrop.append(path)
    scenarios = value_at(data, "aquacrop.irrigation_scenarios")
    if not isinstance(scenarios, list) or len(scenarios) < 2:
        aquacrop.append("aquacrop.irrigation_scenarios: karşılaştırılacak en az 2 plan")
    elif any(not isinstance(item, dict) or not has_value(item, "name") or not has_value(item, "plan_source") for item in scenarios):
        aquacrop.append("aquacrop.irrigation_scenarios: her planda name ve plan_source gerekli")

    if start and end and 0 <= (end - start).days <= 730:
        pcse.extend(weather_gaps(data, start, end, ("tmin_c", "tmax_c", "rain_mm", "solar_radiation_mj_m2", "vapour_pressure_kpa", "wind_m_s")))
        aquacrop.extend(weather_gaps(data, start, end, ("tmin_c", "tmax_c", "rain_mm", "et0_mm")))

    observed = value_at(data, "data_type") == "observed"
    stage_dates = value_at(data, "observations.stage_dates")
    valid_stages = {
        valid_date(item.get("date"))
        for item in stage_dates if isinstance(item, dict) and has_value(item, "stage") and valid_date(item.get("date"))
    } if isinstance(stage_dates, list) else set()
    pcse_validation = [] if observed and len(valid_stages) >= 2 else ["observations.stage_dates: tarih ve evresi kayıtlı en az 2 yerinde gözlem ve data_type=observed"]
    aquacrop_validation = []
    yield_value = value_at(data, "observations.harvested_yield_t_ha")
    try:
        valid_yield = yield_value is not None and math.isfinite(float(yield_value)) and float(yield_value) >= 0
    except (TypeError, ValueError):
        valid_yield = False
    if not observed or not valid_yield:
        aquacrop_validation.append("observations.harvested_yield_t_ha: gerçek hasat verimi ve data_type=observed")
    if not has_value(data, "observations.actual_irrigation_log_source"):
        aquacrop_validation.append("observations.actual_irrigation_log_source: gerçek sulama geçmişi")
    if not has_value(data, "observations.initial_soil_water_measurement_source"):
        aquacrop_validation.append("observations.initial_soil_water_measurement_source: ölçülmüş başlangıç suyu")

    result = {
        "data_type": value_at(data, "data_type") or "unspecified",
        "pcse": {"pilot_inputs_ready": not pcse, "field_validation_inputs_ready": not pcse and not pcse_validation, "missing_for_pilot": pcse, "missing_for_validation": pcse_validation},
        "aquacrop": {"pilot_inputs_ready": not aquacrop, "field_validation_inputs_ready": not aquacrop and not aquacrop_validation, "missing_for_pilot": aquacrop, "missing_for_validation": aquacrop_validation},
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
