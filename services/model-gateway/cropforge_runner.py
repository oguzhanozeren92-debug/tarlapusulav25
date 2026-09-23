from __future__ import annotations

from datetime import date
from statistics import fmean
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_CROPFORGE_SHADOW_DAYS = 400


class CropForgeGatewayModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CropForgeWeatherDay(CropForgeGatewayModel):
    date: date
    tmin_c: float = Field(ge=-80, le=70)
    tmax_c: float = Field(ge=-80, le=70)
    radiation_mj_m2: float = Field(ge=0, le=60)
    rain_mm: float = Field(ge=0, le=1000)
    et0_mm: float = Field(ge=0, le=50)
    wind_m_s: float = Field(ge=0, le=80)
    humidity_pct: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_temperature_order(self):
        if self.tmax_c < self.tmin_c:
            raise ValueError("tmax_c must be greater than or equal to tmin_c")
        return self


class CropForgeShadowRequest(CropForgeGatewayModel):
    field_id: str = Field(min_length=1, max_length=128)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    crop_key: Literal["wheat", "maize"]
    planting_date: date
    area_ha: float = Field(gt=0, le=100000)
    soil_profile_verified: bool
    weather: list[CropForgeWeatherDay] = Field(min_length=2, max_length=MAX_CROPFORGE_SHADOW_DAYS)

    @model_validator(mode="after")
    def validate_weather_window(self):
        ordered = sorted(self.weather, key=lambda item: item.date)
        if ordered != self.weather:
            raise ValueError("weather must be ordered by date")
        if ordered[0].date < self.planting_date:
            raise ValueError("weather cannot start before planting_date")
        if ordered[0].date != self.planting_date:
            raise ValueError("weather must begin on planting_date; partial-season thermal time is not accepted")
        for previous, current in zip(ordered, ordered[1:]):
            if (current.date - previous.date).days != 1:
                raise ValueError("weather must be a gapless daily series")
        if not self.soil_profile_verified:
            raise ValueError("verified soil profile readiness is required before CropForge shadow execution")
        return self


class _ObservedWeather:
    def __init__(self, days: list[CropForgeWeatherDay]):
        self._days = days

    def get_day(self, day: int):
        from cropforge.state import EnvironmentState

        if day < 1 or day > len(self._days):
            raise IndexError(f"CropForge weather day {day} is outside prepared series")
        item = self._days[day - 1]
        return EnvironmentState(
            day=day,
            doy=item.date.timetuple().tm_yday,
            temp_max_c=float(item.tmax_c),
            temp_min_c=float(item.tmin_c),
            temp_mean_c=(float(item.tmax_c) + float(item.tmin_c)) / 2.0,
            radiation_mj_m2=float(item.radiation_mj_m2),
            rainfall_mm=float(item.rain_mm),
            et0_mm=float(item.et0_mm),
            wind_speed_ms=float(item.wind_m_s),
            humidity_pct=float(item.humidity_pct),
        )


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def run_cropforge_shadow(payload: CropForgeShadowRequest) -> dict:
    """Execute CropForge's real first-party crop plugin as non-authoritative shadow evidence.

    Phase 2 intentionally enables only the crop/weather core. Verified soil is a
    readiness gate, but CropForge soil-water, nutrient, terrain, erosion, disease,
    management and yield authority remain disabled until separately benchmarked.
    """
    import cropforge
    from cropforge import Crop, Farm, Field
    from cropforge.plugins import StandardMaize, StandardWheat

    plugin_cls = StandardWheat if payload.crop_key == "wheat" else StandardMaize
    species = "Triticum aestivum" if payload.crop_key == "wheat" else "Zea mays"

    farm = Farm(
        name=f"TarlaPusula_CropForge_Shadow_{payload.field_id[:40]}",
        location=(float(payload.latitude), float(payload.longitude)),
    )
    field = Field(
        name="TarlaPusula_Field",
        rows=1,
        cols=1,
        area_ha=float(payload.area_ha),
    )
    field.set_crop(Crop(species=species))
    field.set_weather(_ObservedWeather(payload.weather))
    farm.add_field(field)
    field.use_plugin(plugin_cls)

    # No synthetic soil/management state is injected. The verified soil profile is
    # only a rollout gate in Phase 2; physics that would consume it remains off.
    farm.run(days=len(payload.weather))

    state = field._field_state
    if state is None or not state.plants:
        raise RuntimeError("CropForge completed without a final plant state")

    plants = state.plants
    stage_counts: dict[str, int] = {}
    for plant in plants:
        stage = str(plant.phenological_stage or "unknown")
        stage_counts[stage] = stage_counts.get(stage, 0) + 1
    final_stage = max(stage_counts.items(), key=lambda item: item[1])[0]

    stage_progress = fmean(float(plant.stage_progress) for plant in plants)
    lai = fmean(float(plant.lai) for plant in plants)
    biomass_g = fmean(float(plant.biomass_g) for plant in plants)
    height_cm = fmean(float(plant.height_cm) for plant in plants)
    thermal_time = fmean(float(plant.custom.get("thermal_time", 0.0)) for plant in plants)
    grain_biomass_g = fmean(float(plant.custom.get("grain_biomass_g", 0.0)) for plant in plants)

    plugin_calibration = (
        "CropForge StandardWheat defaults are documented for HD-2967 / Indian-subcontinent research use."
        if payload.crop_key == "wheat"
        else "CropForge StandardMaize is a generic CERES-Maize-inspired first-party research plugin."
    )

    return {
        "ok": True,
        "engine": "cropforge",
        "engine_version": getattr(cropforge, "__version__", None),
        "mode": "shadow",
        "shadow_scope": "observed_weather_crop_growth_core_v1",
        "field_id": payload.field_id,
        "crop_key": payload.crop_key,
        "planting_date": payload.planting_date.isoformat(),
        "simulation_start": payload.weather[0].date.isoformat(),
        "simulation_end": payload.weather[-1].date.isoformat(),
        "simulation_days": len(payload.weather),
        "production_authority": False,
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "diagnostic_authority": False,
        "terrain_physics_enabled": False,
        "soil_physics_enabled": False,
        "water_balance_enabled": False,
        "nutrient_physics_enabled": False,
        "management_events_enabled": False,
        "verified_soil_readiness_gate": True,
        "result": {
            "phenological_stage": final_stage,
            "stage_progress": _round(stage_progress),
            "mean_lai": _round(lai),
            "mean_biomass_g_per_representative_plant": _round(biomass_g, 3),
            "mean_height_cm": _round(height_cm, 3),
            "thermal_time_degree_days": _round(thermal_time, 2),
            "mean_grain_biomass_g_per_representative_plant": _round(grain_biomass_g, 3),
        },
        "warnings": [
            plugin_calibration,
            "CropForge output is independent shadow evidence only; TarlaPusula does not expose it as a farmer-facing yield or prescription.",
            "Terrain, erosion, soil-water, nutrient and management physics are intentionally disabled in this phase.",
        ],
    }
