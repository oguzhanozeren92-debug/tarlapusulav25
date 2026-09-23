from __future__ import annotations

from datetime import date
import hmac
import importlib
import math
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from aquacrop_runner import AquaCropPilotRequest, run_aquacrop_pilot
from cropforge_runner import CropForgeShadowRequest, run_cropforge_shadow
from dssat_adapter import DssatStructuredShadowRequest, run_dssat_structured_shadow
from dssat_runner import (
    DssatPreparedShadowRequest,
    dssat_runtime_status,
    run_dssat_prepared_shadow,
)
from engine_registry import ENGINE_REGISTRY
from pcse_runner import PCSEPhenologyPilotRequest, run_pcse_phenology_pilot
from pyfao56_dual_runner import (
    PyFao56DualKcShadowRequest,
    run_pyfao56_dual_kc_shadow as run_dual_shadow,
)

MAX_FIELD_ID_LENGTH = 128
MAX_SHADOW_DAYS = 14
MAX_READINESS_INPUTS = 32
IS_DEVELOPMENT = os.getenv("MODEL_GATEWAY_ENV", "production").strip().lower() == "development"

app = FastAPI(
    title="TarlaPusula Model Gateway",
    version="0.8.0",
    docs_url="/docs" if IS_DEVELOPMENT else None,
    redoc_url="/redoc" if IS_DEVELOPMENT else None,
    openapi_url="/openapi.json" if IS_DEVELOPMENT else None,
)


class GatewayModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WeatherDay(GatewayModel):
    date: date
    solar_radiation_mj_m2: float = Field(ge=0, le=60)
    tmax_c: float = Field(ge=-80, le=70)
    tmin_c: float = Field(ge=-80, le=70)
    dew_point_c: float = Field(ge=-100, le=70)
    wind_m_s: float = Field(ge=0, le=100)
    rain_mm: float = Field(default=0.0, ge=0, le=1000)
    kc: float = Field(gt=0, le=3)


class StationInput(GatewayModel):
    latitude: float = Field(ge=-90, le=90)
    elevation_m: float = Field(ge=-500, le=9000)
    wind_height_m: float = Field(default=2.0, gt=0, le=100)


class PyFao56Request(GatewayModel):
    field_id: str = Field(min_length=1, max_length=MAX_FIELD_ID_LENGTH)
    station: StationInput
    days: list[WeatherDay] = Field(min_length=1, max_length=MAX_SHADOW_DAYS)


class EngineReadinessRequest(GatewayModel):
    field_id: str = Field(min_length=1, max_length=MAX_FIELD_ID_LENGTH)
    available_inputs: list[str] = Field(default_factory=list, max_length=MAX_READINESS_INPUTS)


REQUIRED_PCSE_INPUTS = {
    "field_location",
    "daily_weather",
    "crop_parameters",
    "planting_date",
}

REQUIRED_AQUACROP_INPUTS = {
    "daily_weather",
    "crop_parameters",
    "soil_profile",
    "planting_date",
    "initial_water_content",
    "irrigation_management",
}

REQUIRED_DSSAT_INPUTS = {
    "field_location",
    "daily_weather",
    "crop_parameters",
    "soil_profile",
    "planting_date",
    "initial_water_content",
    "irrigation_management",
    "planting_management",
}

REQUIRED_CROPFORGE_INPUTS = {
    "field_location",
    "daily_weather",
    "crop_parameters",
    "soil_profile",
    "planting_date",
}


def _environment() -> str:
    return os.getenv("MODEL_GATEWAY_ENV", "production").strip().lower() or "production"


def _configured_shared_key() -> str:
    return os.getenv("MODEL_GATEWAY_SHARED_KEY", "").strip()


def _auth_required() -> bool:
    return not (_environment() == "development" and not _configured_shared_key())


def _auth_configured() -> bool:
    if not _auth_required():
        return True
    return bool(_configured_shared_key())


def _authorize(shared_key: str | None) -> None:
    expected = _configured_shared_key()

    if not _auth_required():
        return

    supplied = (shared_key or "").strip()
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Model gateway authorization failed")


def _module_status(module_name: str) -> dict[str, Any]:
    try:
        module = importlib.import_module(module_name)
        return {
            "available": True,
            "version": getattr(module, "__version__", None),
        }
    except Exception:
        return {"available": False, "version": None}


def _saturation_vapour_pressure(temp_c: float) -> float:
    return 0.6108 * math.exp((17.27 * temp_c) / (temp_c + 237.3))


def _wind_at_two_meters(speed: float, height_m: float) -> float:
    if abs(height_m - 2.0) < 1e-9:
        return speed
    denominator = math.log(67.8 * height_m - 5.42)
    if denominator <= 0:
        raise ValueError("Wind measurement height is outside FAO-56 logarithmic range")
    return speed * 4.87 / denominator


def _fao56_control_et0(item: WeatherDay, station: StationInput) -> float:
    """Independent FAO-56 daily Penman-Monteith control using the exact same input weather.

    This is diagnostic-only. It is deliberately kept separate from TarlaPusula's
    production irrigation authority so we can distinguish provider/input effects
    from pyfao56 implementation effects.
    """
    tmean = (item.tmax_c + item.tmin_c) / 2.0
    es = (
        _saturation_vapour_pressure(item.tmax_c)
        + _saturation_vapour_pressure(item.tmin_c)
    ) / 2.0
    ea = _saturation_vapour_pressure(item.dew_point_c)

    delta = (
        4098.0
        * _saturation_vapour_pressure(tmean)
        / ((tmean + 237.3) ** 2)
    )
    pressure = 101.3 * (((293.0 - 0.0065 * station.elevation_m) / 293.0) ** 5.26)
    gamma = 0.000665 * pressure

    doy = item.date.timetuple().tm_yday
    phi = math.radians(station.latitude)
    dr = 1.0 + 0.033 * math.cos((2.0 * math.pi / 365.0) * doy)
    solar_declination = 0.409 * math.sin((2.0 * math.pi / 365.0) * doy - 1.39)
    sunset_arg = -math.tan(phi) * math.tan(solar_declination)
    sunset_arg = max(-1.0, min(1.0, sunset_arg))
    sunset_hour_angle = math.acos(sunset_arg)
    extraterrestrial_radiation = (
        (24.0 * 60.0 / math.pi)
        * 0.0820
        * dr
        * (
            sunset_hour_angle * math.sin(phi) * math.sin(solar_declination)
            + math.cos(phi)
            * math.cos(solar_declination)
            * math.sin(sunset_hour_angle)
        )
    )

    clear_sky_radiation = (
        0.75 + 2e-5 * station.elevation_m
    ) * extraterrestrial_radiation
    rs_rso = (
        item.solar_radiation_mj_m2 / clear_sky_radiation
        if clear_sky_radiation > 0
        else 0.0
    )
    rs_rso = max(0.0, min(1.0, rs_rso))

    net_shortwave = (1.0 - 0.23) * item.solar_radiation_mj_m2
    sigma = 4.903e-9
    tmax_k = item.tmax_c + 273.16
    tmin_k = item.tmin_c + 273.16
    net_longwave = (
        sigma
        * ((tmax_k**4 + tmin_k**4) / 2.0)
        * (0.34 - 0.14 * math.sqrt(max(ea, 0.0)))
        * (1.35 * rs_rso - 0.35)
    )
    net_radiation = net_shortwave - net_longwave

    u2 = _wind_at_two_meters(item.wind_m_s, station.wind_height_m)
    numerator = (
        0.408 * delta * net_radiation
        + gamma
        * (900.0 / (tmean + 273.0))
        * u2
        * max(0.0, es - ea)
    )
    denominator = delta + gamma * (1.0 + 0.34 * u2)
    if denominator <= 0:
        raise ValueError("FAO-56 control denominator is not positive")

    return max(0.0, numerator / denominator)


def _delta_pct(reference: float, candidate: float) -> float | None:
    if not math.isfinite(reference) or abs(reference) < 1e-9:
        return None
    return ((candidate - reference) / reference) * 100.0


@app.get("/health")
def health() -> dict[str, Any]:
    engine_statuses = {
        "pyfao56": _module_status("pyfao56"),
        "pcse": _module_status("pcse"),
        "aquacrop": _module_status("aquacrop"),
        "cropforge": _module_status("cropforge"),
        "dssat": dssat_runtime_status(),
    }
    enabled_engines = [
        name
        for name in engine_statuses
        if ENGINE_REGISTRY.get(name, {}).get("rollout") in {"shadow", "pilot", "production"}
    ]
    auth_configured = _auth_configured()
    ready = auth_configured and all(engine_statuses[name]["available"] for name in enabled_engines)
    return {
        "ok": ready,
        "ready": ready,
        "service": "tarlapusula-model-gateway",
        "version": app.version,
        "environment": _environment(),
        "auth_required": _auth_required(),
        "auth_configured": auth_configured,
        "production_authority": False,
        "enabled_engines": enabled_engines,
        "engines": engine_statuses,
    }


@app.get("/v1/registry")
def registry(x_model_gateway_key: str | None = Header(default=None)) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return {"engines": ENGINE_REGISTRY}


@app.post("/v1/irrigation/pyfao56/shadow")
def run_pyfao56_shadow(
    payload: PyFao56Request,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Compare pyfao56 reference ET with TarlaPusula's validated daily Kc."""
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY["pyfao56"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="pyfao56 rollout is disabled")

    duplicate_dates = sorted(
        date_value.isoformat()
        for date_value in {item.date for item in payload.days}
        if sum(1 for item in payload.days if item.date == date_value) > 1
    )
    if duplicate_dates:
        raise HTTPException(
            status_code=422,
            detail=f"Duplicate weather dates are not allowed: {', '.join(duplicate_dates)}",
        )

    try:
        import pyfao56 as fao

        ordered_days = sorted(payload.days, key=lambda item: item.date)
        weather = fao.Weather(comment="TarlaPusula ET0 shadow input")
        weather.rfcrp = "S"
        weather.z = payload.station.elevation_m
        weather.lat = payload.station.latitude
        weather.wndht = payload.station.wind_height_m

        results: list[dict[str, Any]] = []
        for item in ordered_days:
            if item.tmax_c < item.tmin_c:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid temperature range for {item.date.isoformat()}",
                )
            if item.dew_point_c > item.tmax_c:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid dew point for {item.date.isoformat()}",
                )

            key = f"{item.date.year}-{item.date.timetuple().tm_yday:03d}"
            weather.wdata.loc[key] = [
                item.solar_radiation_mj_m2,
                item.tmax_c,
                item.tmin_c,
                math.nan,
                item.dew_point_c,
                math.nan,
                math.nan,
                item.wind_m_s,
                item.rain_mm,
                math.nan,
                "M",
            ]

            et0 = float(weather.compute_etref(key))
            if not math.isfinite(et0):
                raise HTTPException(
                    status_code=422,
                    detail=f"pyfao56 could not compute ET0 for {item.date.isoformat()}",
                )

            control_et0 = _fao56_control_et0(item, payload.station)
            algorithm_delta = et0 - control_et0
            algorithm_delta_pct = _delta_pct(control_et0, et0)

            results.append(
                {
                    "date": item.date.isoformat(),
                    "reference_et_mm": round(et0, 3),
                    "kc": round(float(item.kc), 4),
                    "crop_et_mm": round(et0 * float(item.kc), 3),
                    "rain_mm": round(float(item.rain_mm), 3),
                    "same_weather_fao56_control_et_mm": round(control_et0, 3),
                    "same_weather_algorithm_delta_mm": round(algorithm_delta, 3),
                    "same_weather_algorithm_delta_pct": (
                        round(algorithm_delta_pct, 2)
                        if algorithm_delta_pct is not None
                        else None
                    ),
                }
            )

        return {
            "ok": True,
            "mode": "shadow",
            "shadow_scope": "reference_et_and_single_kc",
            "engine": "pyfao56",
            "engine_version": getattr(fao, "__version__", None),
            "field_id": payload.field_id,
            "production_authority": False,
            "algorithm_isolation": {
                "enabled": True,
                "control": "independent_fao56_daily_penman_monteith",
                "weather_basis": "identical_gateway_weather_input",
                "note": (
                    "This diagnostic isolates implementation/formula delta from weather-provider delta; "
                    "it does not change production irrigation decisions."
                ),
            },
            "full_water_balance_ready": False,
            "blocked_full_water_balance_inputs": [
                "validated_basal_kcb",
                "surface_evaporation_layer",
                "current_soil_water_state",
            ],
            "days": results,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"pyfao56 ET0 shadow failed: {exc}") from exc


@app.post("/v1/irrigation/pyfao56/dual-kc-shadow")
def run_pyfao56_dual_kc_shadow(
    payload: PyFao56DualKcShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Run bounded-REW dual-Kc validation scenarios without production authority."""
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY["pyfao56"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="pyfao56 rollout is disabled")

    try:
        return run_dual_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"pyfao56 dual-Kc shadow failed: {exc}") from exc


def _readiness(
    engine: str,
    payload: EngineReadinessRequest,
    required: set[str],
) -> dict[str, Any]:
    supplied = {item.strip() for item in payload.available_inputs if item.strip()}
    missing = sorted(required - supplied)
    return {
        "ok": True,
        "engine": engine,
        "field_id": payload.field_id,
        "ready": not missing,
        "missing_inputs": missing,
        "rollout": ENGINE_REGISTRY[engine]["rollout"],
        "production_authority": False,
        "note": (
            "Input contract is complete; the field-specific runner can be enabled for pilot validation."
            if not missing
            else "No synthetic values are filled. Complete the missing real field inputs before model execution."
        ),
    }


@app.post("/v1/phenology/pcse/readiness")
def pcse_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return _readiness("pcse", payload, REQUIRED_PCSE_INPUTS)


@app.post("/v1/phenology/pcse/pilot")
def pcse_phenology_pilot(
    payload: PCSEPhenologyPilotRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["pcse"]["rollout"] not in {"pilot", "production"}:
        raise HTTPException(status_code=409, detail="PCSE pilot rollout is disabled")
    try:
        return run_pcse_phenology_pilot(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PCSE phenology pilot failed: {exc}") from exc


@app.post("/v1/scenario/aquacrop/readiness")
def aquacrop_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    return _readiness("aquacrop", payload, REQUIRED_AQUACROP_INPUTS)


@app.post("/v1/scenario/cropforge/readiness")
def cropforge_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Validate CropForge core shadow inputs without granting decision authority."""
    _authorize(x_model_gateway_key)
    result = _readiness("cropforge", payload, REQUIRED_CROPFORGE_INPUTS)
    execution_enabled = ENGINE_REGISTRY["cropforge"]["rollout"] in {
        "shadow",
        "pilot",
        "production",
    }
    return {
        **result,
        "input_ready": result["ready"],
        "execution_enabled": execution_enabled,
        "ready": bool(result["ready"] and execution_enabled),
        "production_authority": False,
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "terrain_physics_ready": False,
        "note": (
            "Core CropForge inputs are complete and the crop/weather shadow runner is enabled. Terrain and decision physics remain gated."
            if result["ready"] and execution_enabled
            else result["note"]
        ),
    }


@app.post("/v1/scenario/cropforge/shadow")
def cropforge_shadow(
    payload: CropForgeShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["cropforge"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="CropForge shadow rollout is disabled")
    try:
        return run_cropforge_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"CropForge shadow failed: {exc}") from exc


@app.get("/v1/scenario/dssat/health")
def dssat_health(
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    status = dssat_runtime_status()
    rollout = ENGINE_REGISTRY["dssat"]["rollout"]
    ready = bool(
        status["available"]
        and rollout in {"shadow", "pilot", "production"}
    )
    return {
        "ok": ready,
        "ready": ready,
        "engine": "dssat-csm",
        "rollout": rollout,
        "production_authority": False,
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "runtime": status,
    }


@app.post("/v1/scenario/dssat/prepared-shadow")
def dssat_prepared_shadow(
    payload: DssatPreparedShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["dssat"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="DSSAT rollout is disabled")
    try:
        return run_dssat_prepared_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"DSSAT prepared shadow failed: {exc}") from exc


@app.post("/v1/scenario/dssat/shadow-run")
def dssat_structured_shadow(
    payload: DssatStructuredShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["dssat"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="DSSAT rollout is disabled")
    try:
        return run_dssat_structured_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"DSSAT structured shadow failed: {exc}") from exc


@app.post("/v1/scenario/dssat/readiness")
def dssat_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Validate DSSAT shadow inputs without running DSSAT or inventing defaults."""
    _authorize(x_model_gateway_key)
    result = _readiness("dssat", payload, REQUIRED_DSSAT_INPUTS)
    execution_enabled = ENGINE_REGISTRY["dssat"]["rollout"] in {
        "shadow",
        "pilot",
        "production",
    }
    return {
        **result,
        "input_ready": result["ready"],
        "execution_enabled": execution_enabled,
        "ready": bool(result["ready"] and execution_enabled),
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "note": (
            "DSSAT field inputs are complete, but execution stays disabled until the official runtime is enabled."
            if result["ready"] and not execution_enabled
            else (
                "DSSAT runtime and verified Wheat/Maize structured FileX writer are enabled for shadow execution."
                if result["ready"] and execution_enabled
                else result["note"]
            )
        ),
    }


@app.post("/v1/scenario/aquacrop/pilot")
def aquacrop_pilot(
    payload: AquaCropPilotRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["aquacrop"]["rollout"] not in {"pilot", "production"}:
        raise HTTPException(status_code=409, detail="AquaCrop pilot rollout is disabled")
    try:
        return run_aquacrop_pilot(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"AquaCrop pilot failed: {exc}") from exc
