from __future__ import annotations

from datetime import date, timedelta
import math
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


MAX_DUAL_KC_DAYS = 7
MAX_IRRIGATION_EVENTS = 14


class GatewayModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DualKcStation(GatewayModel):
    latitude: float = Field(ge=-90, le=90)
    elevation_m: float = Field(ge=-500, le=9000)
    wind_height_m: float = Field(default=10.0, gt=0, le=100)


class DualKcBasalProfile(GatewayModel):
    initial: float = Field(gt=0, le=3)
    mid: float = Field(gt=0, le=3)
    end: float = Field(gt=0, le=3)


class DualKcWeatherDay(GatewayModel):
    date: date
    solar_radiation_mj_m2: float = Field(ge=0, le=60)
    tmax_c: float = Field(ge=-80, le=70)
    tmin_c: float = Field(ge=-80, le=70)
    dew_point_c: float = Field(ge=-100, le=70)
    wind_m_s: float = Field(ge=0, le=100)
    rain_mm: float = Field(default=0.0, ge=0, le=1000)
    kcb: float = Field(gt=0, le=3)


class DualKcInitialState(GatewayModel):
    theta_fc: float = Field(gt=0, lt=1)
    theta_wp: float = Field(gt=0, lt=1)
    root_depth_m: float = Field(gt=0, le=10)
    depletion_fraction_p: float = Field(gt=0, lt=1)
    ze_m: float = Field(gt=0, le=0.30)
    initial_de_mm: float = Field(ge=0, le=500)
    initial_dr_mm: float = Field(ge=0, le=5000)
    canopy_height_m: float = Field(gt=0, le=30)
    canopy_cover_fraction: float = Field(ge=0, le=1)


class DualKcIrrigationEvent(GatewayModel):
    date: date
    depth_mm: float = Field(gt=0, le=1000)
    fw: float = Field(gt=0, le=1)
    efficiency_pct: float = Field(gt=0, le=100)


class PyFao56DualKcShadowRequest(GatewayModel):
    field_id: str = Field(min_length=1, max_length=128)
    station: DualKcStation
    basal_profile: DualKcBasalProfile
    state: DualKcInitialState
    rew_values_mm: list[float] = Field(min_length=1, max_length=2)
    irrigation_wetting_fraction_range: list[float] = Field(min_length=2, max_length=2)
    days: list[DualKcWeatherDay] = Field(min_length=1, max_length=MAX_DUAL_KC_DAYS)
    irrigation_events: list[DualKcIrrigationEvent] = Field(default_factory=list, max_length=MAX_IRRIGATION_EVENTS)


def _key(day: date) -> str:
    return f"{day.year}-{day.timetuple().tm_yday:03d}"


def _finite_row_value(row: Any, column: str) -> float | None:
    try:
        value = float(row[column])
    except Exception:
        return None
    return value if math.isfinite(value) else None


def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def _validate_contract(payload: PyFao56DualKcShadowRequest) -> tuple[list[DualKcWeatherDay], float, float]:
    days = sorted(payload.days, key=lambda item: item.date)
    duplicate_dates = [
        item.date.isoformat()
        for index, item in enumerate(days[1:], start=1)
        if item.date == days[index - 1].date
    ]
    if duplicate_dates:
        raise ValueError(f"Duplicate weather dates are not allowed: {', '.join(sorted(set(duplicate_dates)))}")

    for previous, current in zip(days, days[1:]):
        if current.date - previous.date != timedelta(days=1):
            raise ValueError("Dual-Kc shadow weather days must be daily and contiguous")

    for item in days:
        if item.tmax_c < item.tmin_c:
            raise ValueError(f"Invalid temperature range for {item.date.isoformat()}")
        if item.dew_point_c > item.tmax_c:
            raise ValueError(f"Invalid dew point for {item.date.isoformat()}")

    if abs(payload.basal_profile.mid - payload.basal_profile.initial) < 1e-9:
        raise ValueError("FAO basal Kcb profile requires mid to differ from initial for pyfao56 interpolation")

    state = payload.state
    if state.theta_fc <= state.theta_wp:
        raise ValueError("theta_fc must be greater than theta_wp")

    taw_mm = 1000.0 * (state.theta_fc - state.theta_wp) * state.root_depth_m
    tew_mm = 1000.0 * (state.theta_fc - 0.5 * state.theta_wp) * state.ze_m
    if state.initial_dr_mm > taw_mm + 1e-6:
        raise ValueError("initial_dr_mm exceeds FAO-56 TAW")
    if state.initial_de_mm > tew_mm + 1e-6:
        raise ValueError("initial_de_mm exceeds FAO-56 TEW")

    rew_values = sorted(set(float(value) for value in payload.rew_values_mm))
    if not rew_values:
        raise ValueError("At least one REW value is required")
    for value in rew_values:
        if not math.isfinite(value) or value <= 0 or value > tew_mm:
            raise ValueError("Each REW value must be positive and no greater than TEW")

    fw_values = sorted(set(float(value) for value in payload.irrigation_wetting_fraction_range))
    if len(fw_values) not in (1, 2) or any((not math.isfinite(value) or value <= 0 or value > 1) for value in fw_values):
        raise ValueError("Irrigation wetting fraction range must contain valid FAO-56 fw bounds")
    if len(fw_values) == 2 and fw_values[1] < fw_values[0]:
        raise ValueError("Invalid irrigation wetting fraction range")

    valid_dates = {item.date for item in days}
    for event in payload.irrigation_events:
        if event.date not in valid_dates:
            raise ValueError("Irrigation event date must exist in the weather window")

    return days, taw_mm, tew_mm


def _build_weather(fao: Any, payload: PyFao56DualKcShadowRequest, days: list[DualKcWeatherDay]):
    weather = fao.Weather(comment="TarlaPusula bounded dual-Kc shadow weather")
    weather.rfcrp = "S"
    weather.z = payload.station.elevation_m
    weather.lat = payload.station.latitude
    weather.wndht = payload.station.wind_height_m

    for item in days:
        weather.wdata.loc[_key(item.date)] = [
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
    return weather


def _build_updates(fao: Any, payload: PyFao56DualKcShadowRequest, days: list[DualKcWeatherDay]):
    updates = fao.Update(comment="TarlaPusula validated Kcb/canopy shadow updates")
    for item in days:
        updates.udata.loc[_key(item.date)] = [
            item.kcb,
            payload.state.canopy_height_m,
            payload.state.canopy_cover_fraction,
        ]
    return updates


def _build_irrigation(fao: Any, payload: PyFao56DualKcShadowRequest):
    if not payload.irrigation_events:
        return None
    irrigation = fao.Irrigation(comment="TarlaPusula recorded/model-scenario irrigation events")
    for event in payload.irrigation_events:
        irrigation.addevent(
            event.date.year,
            event.date.timetuple().tm_yday,
            event.depth_mm,
            event.fw,
            event.efficiency_pct,
        )
    return irrigation


def _run_rew_scenario(
    fao: Any,
    payload: PyFao56DualKcShadowRequest,
    days: list[DualKcWeatherDay],
    rew_mm: float,
    taw_mm: float,
    tew_mm: float,
) -> dict[str, Any]:
    state = payload.state
    profile = payload.basal_profile
    theta0 = state.theta_fc - state.initial_dr_mm / (1000.0 * state.root_depth_m)
    theta0 = min(state.theta_fc, max(state.theta_wp, theta0))

    parameters = fao.Parameters(
        Kcbini=profile.initial,
        Kcbmid=profile.mid,
        Kcbend=profile.end,
        Lini=1,
        Ldev=1,
        Lmid=max(1, len(days)),
        Lend=1,
        hini=state.canopy_height_m,
        hmax=state.canopy_height_m,
        thetaFC=state.theta_fc,
        thetaWP=state.theta_wp,
        theta0=theta0,
        Zrini=state.root_depth_m,
        Zrmax=state.root_depth_m,
        pbase=state.depletion_fraction_p,
        Ze=state.ze_m,
        REW=rew_mm,
        comment="TarlaPusula bounded dual-Kc shadow parameters",
    )
    weather = _build_weather(fao, payload, days)
    updates = _build_updates(fao, payload, days)
    irrigation = _build_irrigation(fao, payload)

    model = fao.Model(
        _key(days[0].date),
        _key(days[-1].date),
        parameters,
        weather,
        irr=irrigation,
        upd=updates,
        cons_p=True,
        K_adj=False,
        comment="TarlaPusula bounded dual-Kc shadow with explicit initial De/Dr",
    )

    original_advance = model._advance
    state_injected = False

    def _advance_with_verified_initial_state(io: Any):
        nonlocal state_injected
        if not state_injected:
            io.De = float(state.initial_de_mm)
            io.Dr = float(state.initial_dr_mm)
            io.Drmax = float(state.initial_dr_mm)
            state_injected = True
        return original_advance(io)

    model._advance = _advance_with_verified_initial_state
    model.run()

    output_days: list[dict[str, Any]] = []
    for item in days:
        key = _key(item.date)
        row = model.odata.loc[key]
        output_days.append(
            {
                "date": item.date.isoformat(),
                "kcb": _round(_finite_row_value(row, "Kcb"), 4),
                "reference_et_mm": _round(_finite_row_value(row, "ETref")),
                "soil_evaporation_mm": _round(_finite_row_value(row, "E")),
                "transpiration_mm": _round(_finite_row_value(row, "T")),
                "actual_et_mm": _round(_finite_row_value(row, "ETa")),
                "dual_kc": _round(_finite_row_value(row, "Kc"), 4),
                "stress_coefficient": _round(_finite_row_value(row, "Ks"), 4),
                "surface_depletion_mm": _round(_finite_row_value(row, "De")),
                "root_depletion_mm": _round(_finite_row_value(row, "Dr")),
                "readily_available_water_mm": _round(_finite_row_value(row, "RAW")),
                "total_available_water_mm": _round(_finite_row_value(row, "TAW")),
                "rain_mm": _round(_finite_row_value(row, "Rain")),
                "irrigation_mm": _round(_finite_row_value(row, "Irrig")),
            }
        )

    final = output_days[-1]
    return {
        "rew_mm": _round(rew_mm, 3),
        "basal_profile": {
            "initial": _round(profile.initial, 4),
            "mid": _round(profile.mid, 4),
            "end": _round(profile.end, 4),
        },
        "initial_state": {
            "surface_depletion_mm": _round(state.initial_de_mm),
            "root_depletion_mm": _round(state.initial_dr_mm),
            "theta0": _round(theta0, 4),
            "tew_mm": _round(tew_mm),
            "taw_mm": _round(taw_mm),
        },
        "days": output_days,
        "final_state": {
            "surface_depletion_mm": final.get("surface_depletion_mm"),
            "root_depletion_mm": final.get("root_depletion_mm"),
            "stress_coefficient": final.get("stress_coefficient"),
            "actual_et_mm": final.get("actual_et_mm"),
        },
    }


def run_pyfao56_dual_kc_shadow(payload: PyFao56DualKcShadowRequest) -> dict[str, Any]:
    days, taw_mm, tew_mm = _validate_contract(payload)

    import pyfao56 as fao

    scenarios = [
        _run_rew_scenario(fao, payload, days, rew_mm, taw_mm, tew_mm)
        for rew_mm in sorted(set(float(value) for value in payload.rew_values_mm))
    ]

    return {
        "ok": True,
        "engine": "pyfao56",
        "engine_version": getattr(fao, "__version__", None),
        "mode": "shadow",
        "shadow_scope": "dual_kc_water_balance_bounded_rew",
        "field_id": payload.field_id,
        "production_authority": False,
        "initial_state_injection": {
            "enabled": True,
            "mechanism": "instance-level first-_advance De/Dr injection; all daily balance calculations remain pyfao56 Model._advance",
            "surface_depletion_mm": _round(payload.state.initial_de_mm),
            "root_depletion_mm": _round(payload.state.initial_dr_mm),
        },
        "uncertainty": {
            "rew_values_mm": [_round(value, 3) for value in sorted(set(payload.rew_values_mm))],
            "irrigation_wetting_fraction_range": [
                _round(value, 4)
                for value in sorted(set(payload.irrigation_wetting_fraction_range))
            ],
            "scenario_count": len(scenarios),
            "note": "REW and irrigation wetting references remain bounded ranges; neither is collapsed to a fabricated midpoint.",
        },
        "scenarios": scenarios,
        "caution": "Shadow-only scientific validation output. It is not production irrigation authority and must not be shown as a definitive irrigation prescription.",
    }
