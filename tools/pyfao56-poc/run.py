"""Run an isolated pyfao56 soil-water-balance example with synthetic inputs.

This script is not connected to TarlaPusula's production irrigation advice.
"""

from datetime import date, timedelta
import json
import math

import pyfao56 as fao


def main() -> None:
    weather = fao.Weather(comment="Synthetic demonstration; not real field data")
    weather.rfcrp = "S"
    weather.z = 100.0  # Synthetic station elevation, metres.
    weather.lat = 39.9  # Example latitude, degrees north.
    weather.wndht = 2.0  # Wind measurement height, metres.

    days = []
    for offset in range(7):
        day = date(2026, 6, 1) + timedelta(days=offset)
        key = f"{day.year}-{day.timetuple().tm_yday:03d}"
        # Srad MJ/m²/day; temperatures °C; RH %; wind m/s; rain mm.
        # Dew point and vapour pressure are absent; RH supplies humidity.
        weather.wdata.loc[key] = [
            22.0, 29.0, 15.0, math.nan, math.nan, 80.0, 40.0,
            2.0, 5.0 if offset == 3 else 0.0, math.nan, "P",
        ]
        weather.wdata.loc[key, "ETref"] = weather.compute_etref(key)
        days.append(key)

    # The example starts at field capacity; pyfao56's default theta0=0.1
    # would begin at the wilting point for its default soil parameters.
    model = fao.Model(days[0], days[-1], fao.Parameters(theta0=0.25), weather)
    model.run()

    output = []
    for key in days:
        row = model.odata.loc[key]
        output.append({
            "date": (date(int(key[:4]), 1, 1) + timedelta(days=int(key[-3:]) - 1)).isoformat(),
            "reference_et_mm": round(float(row["ETref"]), 3),
            "crop_et_mm": round(float(row["ETc"]), 3),
            "actual_et_mm": round(float(row["ETa"]), 3),
            "rain_mm": round(float(row["Rain"]), 3),
            "root_zone_depletion_mm": round(float(row["Dr"]), 3),
            "readily_available_water_mm": round(float(row["RAW"]), 3),
        })

    assert len(output) == 7 and all(
        math.isfinite(value)
        for row in output
        for key, value in row.items()
        if key != "date"
    )
    print(json.dumps({"data_type": "synthetic", "days": output}, indent=2))


if __name__ == "__main__":
    main()
