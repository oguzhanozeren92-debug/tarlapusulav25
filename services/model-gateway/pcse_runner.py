from __future__ import annotations

from datetime import date
import math
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PilotModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PCSEPhenologyPilotRequest(PilotModel):
    field_id: str = Field(min_length=1, max_length=128)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    crop_key: str = Field(min_length=1, max_length=128)
    variety_key: str = Field(min_length=1, max_length=160)
    planting_date: date
    as_of_date: date
    harvest_date: date | None = None
    max_duration_days: int = Field(default=365, ge=30, le=730)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.as_of_date < self.planting_date:
            raise ValueError("as_of_date must not precede planting_date")
        if (self.as_of_date - self.planting_date).days + 1 > self.max_duration_days:
            raise ValueError("simulation window exceeds max_duration_days")
        if self.harvest_date is not None and self.harvest_date < self.planting_date:
            raise ValueError("harvest_date must not precede planting_date")
        return self


def _finite_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _date_or_none(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    text = str(value).strip()
    return text or None


def _last_output_row(output: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not output:
        return None
    row = output[-1]
    # Phenology-only contract: expose only calendar/development state. Biomass,\n    # transpiration, root depth and soil-moisture fields are intentionally omitted.\n    keep = ["day", "DVS"]
    result: dict[str, Any] = {}
    for key in keep:
        if key not in row:
            continue
        value = row.get(key)
        if key == "day":
            result[key] = _date_or_none(value)
            continue
        numeric = _finite_or_none(value)
        result[key] = round(numeric, 6) if numeric is not None else None
    return result


def _development_stage(dvs: float | None) -> str | None:
    if dvs is None:
        return None
    if dvs < 0:
        return "pre_emergence"
    if dvs < 1:
        return "vegetative"
    if dvs < 2:
        return "reproductive"
    return "mature"


def _summary_dates(summary: dict[str, Any] | None) -> dict[str, str | None]:
    summary = summary or {}
    return {
        "emergence_date": _date_or_none(summary.get("DOE")),
        "anthesis_date": _date_or_none(summary.get("DOA")),
        "maturity_date": _date_or_none(summary.get("DOM")),
        "harvest_date": _date_or_none(summary.get("DOH")),
    }


def _build_agromanagement(payload: PCSEPhenologyPilotRequest) -> list[dict[date, dict[str, Any]]]:
    actual_harvest = payload.harvest_date
    crop_end_date = actual_harvest if actual_harvest is not None else None
    crop_end_type = "harvest" if actual_harvest is not None else "maturity"

    return [
        {
            payload.planting_date: {
                "CropCalendar": {
                    "crop_name": payload.crop_key,
                    "variety_name": payload.variety_key,
                    "crop_start_date": payload.planting_date,
                    "crop_start_type": "sowing",
                    "crop_end_date": crop_end_date,
                    "crop_end_type": crop_end_type,
                    "max_duration": payload.max_duration_days,
                },
                "TimedEvents": None,
                "StateEvents": None,
            }
        }
    ]


def run_pcse_phenology_pilot(payload: PCSEPhenologyPilotRequest) -> dict[str, Any]:
    import pcse
    from pcse.base import ParameterProvider
    from pcse.input import DummySoilDataProvider, OpenMeteoWeatherDataProvider, YAMLCropDataProvider
    from pcse.models import Wofost72_Phenology

    cropdata = YAMLCropDataProvider(model=Wofost72_Phenology)
    cropdata.set_active_crop(payload.crop_key, payload.variety_key)

    # WOFOST72_Phenology is the dedicated PCSE phenology-only engine.
    # Dummy soil data is retained only because the PCSE parameter contract expects
    # a soil provider; this runner does not expose soil-water or irrigation outputs.
    soildata = DummySoilDataProvider()
    parameters = ParameterProvider(cropdata=cropdata, soildata=soildata)

    weather = OpenMeteoWeatherDataProvider(
        latitude=payload.latitude,
        longitude=payload.longitude,
        timezone="UTC",
        openmeteo_model="era5_land",
        start_date=payload.planting_date,
        ETmodel="PM",
        forecast=False,
        force_update=True,
    )

    agromanagement = _build_agromanagement(payload)
    model = Wofost72_Phenology(parameters, weather, agromanagement)
    model.run_till(payload.as_of_date)

    output = model.get_output() or []
    summary_rows = model.get_summary_output() or []
    summary = summary_rows[-1] if summary_rows else None
    latest = _last_output_row(output)
    dvs = _finite_or_none((latest or {}).get("DVS"))

    return {
        "ok": True,
        "mode": "phenology_pilot",
        "engine": "pcse",
        "engine_version": getattr(pcse, "__version__", None),
        "model": "Wofost72_Phenology",
        "field_id": payload.field_id,
        "production_authority": False,
        "water_stress_authority": False,
        "simulation": {
            "planting_date": payload.planting_date.isoformat(),
            "requested_as_of_date": payload.as_of_date.isoformat(),
            "actual_output_date": (latest or {}).get("day"),
            "harvest_date": payload.harvest_date.isoformat() if payload.harvest_date else None,
            "crop_key": payload.crop_key,
            "variety_key": payload.variety_key,
            "max_duration_days": payload.max_duration_days,
            "weather_provider": "PCSE OpenMeteoWeatherDataProvider",
            "weather_model": "era5_land",
            "soil_provider": "PCSE DummySoilDataProvider",
            "production_level": "phenology_only",
        },
        "phenology": {
            "dvs": round(dvs, 6) if dvs is not None else None,
            "stage": _development_stage(dvs),
            **_summary_dates(summary),
        },
        "outputs": {
            "daily_rows": len(output),
            "latest": latest,
            "summary": {
                key: _date_or_none(value)
                for key, value in (summary or {}).items()
                if key in {"DOE", "DOA", "DOM", "DOH", "DOS", "DOV"}
            } if summary else None,
        },
        "note": (
            "PCSE dedicated WOFOST 7.2 phenology baseline only; real irrigation and water-stress decisions "
            "remain under TarlaPusula pyfao56/AquaCrop decision authority."
        ),
    }
