"""Run PCSE's bundled WOFOST demonstration and print its modeled crop stages.

The bundled case is winter wheat in southern Spain (2000), never a user field.
No Supabase access, field geometry, or external weather API is used.
"""

import argparse
from datetime import date
import json
import math

import pcse


def finite_number(value):
    if isinstance(value, (int, float)) and math.isfinite(value):
        return round(float(value), 4)
    return None


def as_date(value):
    return value.isoformat() if isinstance(value, date) else None


def run_demo(include_daily=False):
    model = pcse.start_wofost()
    model.run_till_terminate()
    output = model.get_output()
    summaries = model.get_summary_output()
    if not output or not summaries:
        raise RuntimeError("PCSE demo verisi bir model çıktısı üretmedi")

    summary = summaries[0]
    result = {
        "data_type": "pcse_bundled_demo_model",
        "model": "PCSE WOFOST 7.2 water-limited",
        "pcse_version": pcse.__version__,
        "input_provenance": "PCSE bundled demo database; winter wheat, southern Spain, year 2000",
        "user_field_result": False,
        "simulation_days": len(output),
        "modeled_emergence_date": as_date(summary.get("DOE")),
        "modeled_anthesis_date": as_date(summary.get("DOA")),
        "modeled_maturity_date": as_date(summary.get("DOM")),
        "modeled_max_leaf_area_index": finite_number(summary.get("LAIMAX")),
        "modeled_storage_organ_mass_kg_ha": finite_number(summary.get("TWSO")),
    }

    if include_daily:
        result["daily"] = [
            {
                "date": as_date(row.get("day")),
                "development_stage_dvs": finite_number(row.get("DVS")),
                "leaf_area_index_lai": finite_number(row.get("LAI")),
            }
            for row in output
        ]
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--daily", action="store_true", help="Günlük DVS/LAI model serisini de çıkar")
    args = parser.parse_args()
    print(json.dumps(run_demo(args.daily), ensure_ascii=False, indent=2))
