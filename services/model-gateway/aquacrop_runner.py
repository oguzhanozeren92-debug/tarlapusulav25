from __future__ import annotations

from datetime import date
import math
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, model_validator


class PilotModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AquaCropWeatherDay(PilotModel):
    date: date
    tmin_c: float = Field(ge=-80, le=70)
    tmax_c: float = Field(ge=-80, le=70)
    precipitation_mm: float = Field(ge=0, le=1000)
    reference_et_mm: float = Field(ge=0, le=50)

    @model_validator(mode="after")
    def validate_temperatures(self):
        if self.tmax_c < self.tmin_c:
            raise ValueError("tmax_c must be greater than or equal to tmin_c")
        return self


class AquaCropSoilLayer(PilotModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    th_wp: float = Field(gt=0, lt=1)
    th_fc: float = Field(gt=0, lt=1)
    th_s: float = Field(gt=0, lt=1)
    ksat_mm_day: float = Field(gt=0, le=100000)
    penetrability_percent: float = Field(default=100, ge=0, le=100)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("soil layer to_cm must be greater than from_cm")
        if not self.th_wp < self.th_fc < self.th_s:
            raise ValueError("soil hydraulic values must satisfy th_wp < th_fc < th_s")
        return self


class AquaCropInitialWaterLayer(PilotModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    volumetric_water_content: float = Field(gt=0, lt=1)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("water layer to_cm must be greater than from_cm")
        return self


class AquaCropManagement(PilotModel):
    mode: Literal["rainfed", "soil_moisture_target", "recorded_schedule", "manual_schedule"]
    settings: dict[str, Any] = Field(default_factory=dict)


class AquaCropPilotRequest(PilotModel):
    field_id: str = Field(min_length=1, max_length=128)
    simulation_start: date
    simulation_end: date
    planting_date: date
    crop_model_key: Literal["Wheat", "Barley", "Maize", "Cotton", "Potato"]
    weather: list[AquaCropWeatherDay] = Field(min_length=2, max_length=400)
    soil_layers: list[AquaCropSoilLayer] = Field(min_length=1, max_length=20)
    initial_water_layers: list[AquaCropInitialWaterLayer] = Field(min_length=1, max_length=20)
    irrigation_management: AquaCropManagement

    @model_validator(mode="after")
    def validate_contract(self):
        if self.simulation_end < self.simulation_start:
            raise ValueError("simulation_end must not precede simulation_start")
        if not (self.simulation_start <= self.planting_date <= self.simulation_end):
            raise ValueError("planting_date must fall inside simulation range")

        if self.simulation_start != self.planting_date:
            raise ValueError("AquaCrop pilot simulation_start must equal planting_date")

        weather_dates = [item.date for item in self.weather]
        if len(weather_dates) != len(set(weather_dates)):
            raise ValueError("duplicate weather dates are not allowed")
        ordered_dates = sorted(weather_dates)
        expected_days = (self.simulation_end - self.simulation_start).days + 1
        if (
            ordered_dates[0] != self.simulation_start
            or ordered_dates[-1] != self.simulation_end
            or len(ordered_dates) != expected_days
            or any((current - previous).days != 1 for previous, current in zip(ordered_dates, ordered_dates[1:]))
        ):
            raise ValueError("weather must cover every calendar day in the simulation range without gaps")

        _validate_contiguous_depth(self.soil_layers, required_depth_cm=200, label="soil")
        _validate_contiguous_depth(self.initial_water_layers, required_depth_cm=200, label="initial water")
        allowed_settings = {
            "rainfed": set(),
            "soil_moisture_target": {"smt"},
            "recorded_schedule": {"schedule"},
            "manual_schedule": {"schedule"},
        }[self.irrigation_management.mode]
        unexpected_settings = set(self.irrigation_management.settings) - allowed_settings
        if unexpected_settings:
            raise ValueError(f"unexpected irrigation settings: {sorted(unexpected_settings)}")

        if self.irrigation_management.mode == "soil_moisture_target":
            smt = self.irrigation_management.settings.get("smt")
            if not isinstance(smt, list) or len(smt) != 4:
                raise ValueError("soil_moisture_target requires settings.smt with four stage percentages")
            parsed_smt = [float(value) for value in smt]
            if any(not math.isfinite(value) or value < 0 or value > 100 for value in parsed_smt):
                raise ValueError("settings.smt values must be between 0 and 100")

        if self.irrigation_management.mode == "manual_schedule":
            raise ValueError("manual_schedule is not allowed in the server-derived AquaCrop pilot")

        if self.irrigation_management.mode in {"recorded_schedule", "manual_schedule"}:
            schedule = self.irrigation_management.settings.get("schedule")
            if not isinstance(schedule, list) or not schedule:
                raise ValueError("schedule irrigation mode requires settings.schedule")
            for item in schedule:
                if not isinstance(item, dict):
                    raise ValueError("each irrigation schedule item must be an object")
                if set(item) != {"date", "depth_mm"}:
                    raise ValueError("irrigation schedule items must contain only date and depth_mm")
                try:
                    schedule_date = date.fromisoformat(str(item.get("date", ""))[:10])
                except ValueError as exc:
                    raise ValueError("irrigation schedule date must be ISO YYYY-MM-DD") from exc
                if schedule_date < self.simulation_start or schedule_date > self.simulation_end:
                    raise ValueError("irrigation schedule date must fall inside simulation range")
                try:
                    depth = float(item.get("depth_mm"))
                except (TypeError, ValueError) as exc:
                    raise ValueError("irrigation schedule depth_mm must be numeric") from exc
                if not math.isfinite(depth) or depth <= 0 or depth > 500:
                    raise ValueError("irrigation schedule depth_mm must be within (0, 500]")
        return self


def _validate_contiguous_depth(layers: list[Any], required_depth_cm: float, label: str) -> None:
    ordered = sorted(layers, key=lambda item: (item.from_cm, item.to_cm))
    cursor = 0.0
    for item in ordered:
        if abs(item.from_cm - cursor) > 1e-6:
            raise ValueError(f"{label} profile has a depth gap or overlap at {cursor:g} cm")
        cursor = item.to_cm
    if abs(cursor - required_depth_cm) > 1e-6:
        raise ValueError(f"{label} profile must cover exactly {required_depth_cm:g} cm")


def _split_compartments(layers: list[AquaCropSoilLayer], max_dz_m: float = 0.1) -> list[float]:
    compartments: list[float] = []
    for layer in sorted(layers, key=lambda item: item.from_cm):
        remaining = (layer.to_cm - layer.from_cm) / 100.0
        while remaining > 1e-9:
            piece = min(max_dz_m, remaining)
            compartments.append(round(piece, 6))
            remaining -= piece
    return compartments


def _build_soil(payload: AquaCropPilotRequest):
    from aquacrop import Soil

    ordered = sorted(payload.soil_layers, key=lambda item: item.from_cm)
    soil = Soil(soil_type="custom", dz=_split_compartments(ordered))
    for layer in ordered:
        thickness_m = (layer.to_cm - layer.from_cm) / 100.0
        soil.add_layer(
            thickness_m,
            float(layer.th_wp),
            float(layer.th_fc),
            float(layer.th_s),
            float(layer.ksat_mm_day),
            float(layer.penetrability_percent),
        )
    soil.fill_nan()
    return soil


def _build_initial_water(payload: AquaCropPilotRequest):
    from aquacrop import InitialWaterContent

    ordered = sorted(payload.initial_water_layers, key=lambda item: item.from_cm)
    # Field observations describe intervals. Use each interval midpoint as the
    # physical depth representative; this avoids fabricating boundary samples.
    depths_m = [
        (float(item.from_cm) + float(item.to_cm)) / 200.0
        for item in ordered
    ]
    values = [float(item.volumetric_water_content) for item in ordered]

    return InitialWaterContent(
        wc_type="Num",
        method="Depth",
        depth_layer=depths_m,
        value=values,
    )


def _build_management(payload: AquaCropPilotRequest):
    from aquacrop import IrrigationManagement

    management = payload.irrigation_management
    if management.mode == "rainfed":
        return IrrigationManagement(irrigation_method=0)

    if management.mode == "soil_moisture_target":
        smt = management.settings.get("smt")
        if not isinstance(smt, list) or len(smt) != 4:
            raise ValueError("soil_moisture_target requires settings.smt with four stage percentages")
        parsed = [float(value) for value in smt]
        if any(not math.isfinite(value) or value < 0 or value > 100 for value in parsed):
            raise ValueError("settings.smt values must be between 0 and 100")
        return IrrigationManagement(irrigation_method=1, SMT=parsed)

    schedule = management.settings.get("schedule")
    if not isinstance(schedule, list) or not schedule:
        raise ValueError("schedule irrigation mode requires settings.schedule")

    rows: list[dict[str, Any]] = []
    for item in schedule:
        if not isinstance(item, dict):
            raise ValueError("each irrigation schedule item must be an object")
        raw_date = item.get("date")
        raw_depth = item.get("depth_mm")
        parsed_date = pd.to_datetime(raw_date, errors="coerce")
        try:
            depth = float(raw_depth)
        except (TypeError, ValueError) as exc:
            raise ValueError("irrigation schedule depth_mm must be numeric") from exc
        if pd.isna(parsed_date) or not math.isfinite(depth) or depth <= 0 or depth > 500:
            raise ValueError("irrigation schedule item is invalid")
        rows.append({"Date": parsed_date, "Depth": depth})

    normalized_dates = [row["Date"].date() for row in rows]
    if len(normalized_dates) != len(set(normalized_dates)):
        raise ValueError("duplicate irrigation schedule dates are not allowed")

    schedule_df = pd.DataFrame(rows).sort_values("Date")
    return IrrigationManagement(irrigation_method=3, Schedule=schedule_df)


def _validate_daily_output_horizon(frame: Any, expected_days: int, label: str) -> None:
    if frame is None or getattr(frame, "empty", True):
        raise RuntimeError(f"AquaCrop returned no {label} evidence")
    if len(frame) != expected_days:
        raise RuntimeError(f"AquaCrop {label} daily horizon does not exactly match the requested simulation range")
    if "time_step_counter" not in frame.columns:
        raise RuntimeError(f"AquaCrop {label} output is missing time_step_counter")
    raw_counters = frame["time_step_counter"].tolist()
    if any(pd.isna(value) or not math.isfinite(float(value)) or float(value) != int(float(value)) for value in raw_counters):
        raise RuntimeError(f"AquaCrop {label} time_step_counter contains invalid values")
    counters = [int(float(value)) for value in raw_counters]
    if counters[0] != 0 or counters != list(range(expected_days)):
        raise RuntimeError(f"AquaCrop {label} time_step_counter is not contiguous")


def _records_last_row(frame: Any, allowed_keys: set[str]) -> dict[str, Any] | None:
    if frame is None or getattr(frame, "empty", True):
        return None
    row = frame.iloc[-1]
    output: dict[str, Any] = {}
    for key, value in row.items():
        if str(key) not in allowed_keys:
            continue
        if hasattr(value, "isoformat"):
            output[str(key)] = value.isoformat()
        elif isinstance(value, (int, float)) and math.isfinite(float(value)):
            output[str(key)] = round(float(value), 6)
        elif pd.isna(value):
            output[str(key)] = None
        else:
            output[str(key)] = str(value)
    return output


def run_aquacrop_pilot(payload: AquaCropPilotRequest) -> dict[str, Any]:
    from aquacrop import AquaCropModel, Crop
    import aquacrop

    weather_df = pd.DataFrame(
        [
            {
                "Date": pd.Timestamp(item.date),
                "MinTemp": float(item.tmin_c),
                "MaxTemp": float(item.tmax_c),
                "Precipitation": float(item.precipitation_mm),
                "ReferenceET": float(item.reference_et_mm),
            }
            for item in sorted(payload.weather, key=lambda item: item.date)
        ]
    )

    soil = _build_soil(payload)
    crop = Crop(payload.crop_model_key, planting_date=payload.planting_date.strftime("%m/%d"))
    initial_water = _build_initial_water(payload)
    irrigation = _build_management(payload)

    model = AquaCropModel(
        sim_start_time=payload.simulation_start.isoformat(),
        sim_end_time=payload.simulation_end.isoformat(),
        weather_df=weather_df,
        soil=soil,
        crop=crop,
        initial_water_content=initial_water,
        irrigation_management=irrigation,
    )
    model.run_model(till_termination=True)

    simulation_results = model.get_simulation_results()
    water_flux = model.get_water_flux()
    water_storage = model.get_water_storage()
 
    runtime_version = str(getattr(aquacrop, "__version__", "") or "")
    if runtime_version != "3.1.0":
        raise RuntimeError(f"Unexpected AquaCrop runtime version: {runtime_version or 'unknown'}")

    expected_days = (payload.simulation_end - payload.simulation_start).days + 1
    if simulation_results is None or getattr(simulation_results, "empty", True):
        raise RuntimeError("AquaCrop returned no simulation results")
    if len(simulation_results) != 1:
        raise RuntimeError("AquaCrop pilot expects exactly one seasonal simulation result")
    _validate_daily_output_horizon(water_flux, expected_days, "water-flux")
    _validate_daily_output_horizon(water_storage, expected_days, "water-storage")

    return {
        "ok": True,
        "mode": "pilot",
        "evidence_scope": "season_scale_validation_only",
        "engine": "aquacrop",
        "engine_version": runtime_version,
        "contract_version": 8,
        "field_id": payload.field_id,
        "production_authority": False,
        "irrigation_prescription_authority": False,
        "yield_authority": False,
        "simulation": {
            "start": payload.simulation_start.isoformat(),
            "end": payload.simulation_end.isoformat(),
            "planting_date": payload.planting_date.isoformat(),
            "crop_model_key": payload.crop_model_key,
            "weather_days": len(payload.weather),
            "soil_layers": len(payload.soil_layers),
            "initial_water_layers": len(payload.initial_water_layers),
            "initial_water_method": "Depth",
            "initial_water_depth_semantics": "measured_interval_midpoints",
            "daily_output_integrity": "exact_zero_based_time_step_counter",
            "output_scope": "water_balance_evidence_only",
            "irrigation_mode": payload.irrigation_management.mode,
        },
        "outputs": {
            "evidence_only": True,
            "simulation_result_rows": int(len(simulation_results)),
            "last_simulation_result": _records_last_row(
                simulation_results,
                {"Season", "crop Type", "Harvest Date (YYYY/MM/DD)", "Seasonal irrigation (mm)"},
            ),
            "last_water_flux": _records_last_row(
                water_flux,
                {"time_step_counter", "dap", "Wr", "z_gw", "surface_storage", "IrrDay", "Infl", "Runoff", "DeepPerc", "CR", "GwIn", "Es", "Tr"},
            ),
            "last_water_storage": _records_last_row(
                water_storage,
                {"time_step_counter", "dap", "th1", "th2", "th3", "th4", "th5", "th6", "th7", "th8", "th9", "th10"},
            ),
        },
        "note": "Pilot output only; TarlaPusula Irrigation Engine remains production authority.",
    }
