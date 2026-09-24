from __future__ import annotations

from contextlib import contextmanager
from datetime import date
import importlib.util
import math
import os
from pathlib import Path
import sys
import threading
from typing import Any, Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator

VENDOR_ROOT = Path(__file__).resolve().parent / "vendor" / "rscm"
RSCM_PY = VENDOR_ROOT / "RSCM_v1.py"
RSCM_SO = VENDOR_ROOT / "CodeC" / "RSCM_v1.so"
UPSTREAM_COMMIT = "7c48c6c93d758c72aceb99e9923181a77b7c51cb"
RUNNER_VERSION = 1
_LOCK = threading.Lock()

CROP_PROFILES: dict[str, dict[str, Any]] = {
    "wheat": {
        "cpara": {"Tbase": 0.0, "k": 0.65, "RUE": 2.01, "SLA": 0.016, "beta1": 0.45, "eGDD": 0.0, "pd": 5},
        "para0": [0.1, 0.00125, 0.00125, 0.02, 550.0],
        "fmLAI": 10.0,
        "source": "RUN_Python_Wheat_v1.ipynb",
    },
    "maize": {
        "cpara": {"Tbase": 10.0, "k": 0.65, "RUE": 3.55, "SLA": 0.016, "beta1": 0.45, "eGDD": 30.0, "pd": 5},
        "para0": [0.1, 0.00125, 0.00125, 0.02, 560.0],
        "fmLAI": 10.0,
        "source": "RUN_Python_Maize_v1.ipynb",
    },
    "rice": {
        "cpara": {"Tbase": 12.0, "k": 0.40, "RUE": 2.49, "SLA": 0.016, "beta1": 0.45, "eGDD": 30.0, "pd": 10},
        "para0": [0.1, 0.00125, 0.00125, 0.02, 750.0],
        "fmLAI": 10.0,
        "source": "RUN_Python_Rice_v1.ipynb",
    },
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RSCMWeatherDay(StrictModel):
    date: date
    radiation_mj_m2: float = Field(ge=0, le=60)
    tmax_c: float = Field(ge=-70, le=70)
    tmin_c: float = Field(ge=-80, le=60)
    rain_mm: float = Field(default=0, ge=0, le=1000)

    @model_validator(mode="after")
    def validate_temperatures(self):
        if self.tmax_c < self.tmin_c:
            raise ValueError("tmax_c must be >= tmin_c")
        return self


class RSCMLAIObservation(StrictModel):
    date: date
    lai: float = Field(gt=0, le=8)
    quality: Literal["high", "medium", "low"] = "medium"


class RSCMAssimilationRequest(StrictModel):
    field_id: str = Field(min_length=1, max_length=128)
    crop_key: Literal["wheat", "maize", "rice"]
    planting_date: date
    weather: list[RSCMWeatherDay] = Field(min_length=14, max_length=370)
    lai_observations: list[RSCMLAIObservation] = Field(min_length=4, max_length=40)
    bayesian: bool = False

    @model_validator(mode="after")
    def validate_series(self):
        weather_dates = [row.date for row in self.weather]
        if len(set(weather_dates)) != len(weather_dates):
            raise ValueError("duplicate weather dates are not allowed")
        if weather_dates != sorted(weather_dates):
            raise ValueError("weather dates must be ascending")
        for prev, current in zip(weather_dates, weather_dates[1:]):
            if (current - prev).days != 1:
                raise ValueError("weather series must be daily and contiguous")
        if weather_dates[0] != self.planting_date:
            raise ValueError("RSCM weather must begin on the planting date")
        obs_dates = [row.date for row in self.lai_observations]
        if len(set(obs_dates)) != len(obs_dates):
            raise ValueError("duplicate LAI observation dates are not allowed")
        if obs_dates != sorted(obs_dates):
            raise ValueError("LAI observations must be ascending")
        if any(day < self.planting_date for day in obs_dates):
            raise ValueError("LAI observations cannot precede planting date")
        if max(obs_dates) > weather_dates[-1]:
            raise ValueError("RSCM weather must cover the latest LAI observation")
        return self



def rscm_runtime_status() -> dict[str, Any]:
    missing = [str(path.relative_to(VENDOR_ROOT)) for path in [RSCM_PY, RSCM_SO] if not path.exists()]
    return {
        "available": not missing,
        "version": UPSTREAM_COMMIT[:12] if not missing else None,
        "missing": missing,
        "supported_crops": sorted(CROP_PROFILES),
    }


@contextmanager
def _vendor_cwd():
    old = Path.cwd()
    os.chdir(VENDOR_ROOT)
    try:
        yield
    finally:
        os.chdir(old)


def _load_module():
    name = "tarlapusula_rscm_upstream"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, RSCM_PY)
    if spec is None or spec.loader is None:
        raise RuntimeError("RSCM module could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.modules[name] = module
    return module


def _season_day(day: date, planting_date: date) -> int:
    return (day - planting_date).days


def _rmse(observed: np.ndarray, fitted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((observed - fitted) ** 2)))


def run_rscm_assimilation(payload: RSCMAssimilationRequest) -> dict[str, Any]:
    runtime = rscm_runtime_status()
    if not runtime["available"]:
        raise RuntimeError("RSCM vendor runtime is not bootstrapped")

    profile = CROP_PROFILES[payload.crop_key]
    weather = np.ascontiguousarray(
        [
            [
                float(_season_day(row.date, payload.planting_date)),
                float(row.radiation_mj_m2),
                float(row.tmax_c),
                float(row.tmin_c),
                float(row.rain_mm),
            ]
            for row in payload.weather
        ],
        dtype=np.float64,
    )
    observations = np.ascontiguousarray(
        [[float(_season_day(row.date, payload.planting_date)), float(row.lai)] for row in payload.lai_observations],
        dtype=np.float64,
    )
    para0 = np.ascontiguousarray(profile["para0"], dtype=np.float64)
    prior_cov = np.ascontiguousarray(np.diag(1.0 / para0), dtype=np.float64)
    prior_mean = np.ascontiguousarray(para0.copy(), dtype=np.float64)
    # Upstream C uses the first weather column only as the observation/time index
    # and accesses wxData[i + start]. TarlaPusula maps real dates to a monotonic
    # planting-relative day axis, preserving weather values while safely supporting
    # seasons that cross a calendar year.
    start = 0
    max_observation_day = max(_season_day(row.date, payload.planting_date) for row in payload.lai_observations)
    # Upstream's fitting loop checks wxData[i] for i < nrecords-2, while
    # its LAI/GDD generator reads through wxData[nrecords-2]. Therefore an
    # observation on relative day d needs nrecords=d+3 and weather through
    # day d+1 (nrecords-1 weather rows). Keep this off-by-one contract
    # explicit so the C engine never reads beyond the provided matrix.
    needed_records = max(3, max_observation_day + 3)
    required_weather_rows = needed_records - 1
    if len(payload.weather) < required_weather_rows:
        raise ValueError("RSCM weather must extend at least one day beyond the latest LAI observation")
    nrecords = needed_records

    with _LOCK:
        with _vendor_cwd():
            module = _load_module()
            paraout, reconstructed = module.Optim_RSCM_LAI(
                profile["cpara"],
                float(profile["fmLAI"]),
                start,
                nrecords,
                weather,
                observations,
                para0,
                1 if payload.bayesian else 0,
                prior_cov,
                prior_mean,
            )

    fitted = np.asarray(reconstructed["OLAI"], dtype=float)
    observed = observations[:, 1]
    finite = np.isfinite(fitted) & np.isfinite(observed)
    if finite.sum() < 3:
        raise ValueError("RSCM returned fewer than three finite reconstructed LAI observations")
    fitted = fitted[finite]
    observed = observed[finite]
    rmse = _rmse(observed, fitted)
    mae = float(np.mean(np.abs(observed - fitted)))
    mean_obs = float(np.mean(observed))
    nrmse = rmse / mean_obs if mean_obs > 1e-9 else None
    corr = float(np.corrcoef(observed, fitted)[0, 1]) if len(observed) >= 3 and np.std(observed) > 1e-9 and np.std(fitted) > 1e-9 else None
    alignment_score = max(0.0, min(100.0, 100.0 * (1.0 - min(nrmse if nrmse is not None else 1.0, 1.0))))

    params = [float(value) for value in np.asarray(paraout, dtype=float).tolist()]
    if len(params) != 5 or not all(math.isfinite(value) for value in params):
        raise ValueError("RSCM returned invalid calibrated parameters")

    return {
        "ok": True,
        "engine": "rscm",
        "mode": "shadow-assimilation",
        "field_id": payload.field_id,
        "crop_key": payload.crop_key,
        "engine_version": UPSTREAM_COMMIT,
        "adapter_version": RUNNER_VERSION,
        "production_authority": False,
        "yield_authority": False,
        "prescription_authority": False,
        "input_authority": "server-derived-only",
        "assimilation": {
            "observation_count": int(len(observed)),
            "rmse_lai": round(rmse, 5),
            "mae_lai": round(mae, 5),
            "normalized_rmse": round(nrmse, 5) if nrmse is not None else None,
            "correlation": round(corr, 5) if corr is not None and math.isfinite(corr) else None,
            "model_reality_alignment_score": round(alignment_score, 1),
            "calibrated_parameters": {
                "a": params[0],
                "b": params[1],
                "c": params[2],
                "L0": params[3],
                "rGDD": params[4],
            },
            "profile_source": profile["source"],
            "time_axis": "planting_relative_day",
            "bayesian": payload.bayesian,
        },
        "observations": [
            {
                "date": row.date.isoformat(),
                "observed_lai": round(float(row.lai), 5),
                "reconstructed_lai": round(float(reconstructed.iloc[index]["OLAI"]), 5),
                "quality": row.quality,
            }
            for index, row in enumerate(payload.lai_observations)
        ],
        "note": "RSCM is used only to calibrate the crop model against real satellite-derived LAI evidence; it does not replace TarlaPusula production decisions or emit a farmer-facing yield prescription.",
    }
