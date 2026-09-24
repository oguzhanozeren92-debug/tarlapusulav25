from __future__ import annotations

import base64
from contextlib import contextmanager
from datetime import datetime
from io import BytesIO
import math
import os
from pathlib import Path
import sys
import threading
from typing import Any, Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, field_validator
import rasterio
from rasterio.io import MemoryFile

VENDOR_ROOT = Path(__file__).resolve().parent / "vendor" / "sl2p"
TOOLS_DIR = VENDOR_ROOT / "tools"
RUNNER_VERSION = 1
UPSTREAM_COMMIT = "71ac9e0453a58610d73283fb6a1ad15e19dbae89"
COLLECTION = "S2_L2A"
BAND_ORDER = [
    "cosVZA",
    "cosSZA",
    "cosRAA",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B8A",
    "B11",
    "B12",
    "validMask",
]
INPUT_BANDS = BAND_ORDER[:-1]
VARIABLES = ["LAI", "fCOVER", "fAPAR", "CCC", "CWC", "Albedo"]
MAX_TIFF_BYTES = 4 * 1024 * 1024
MAX_VALID_PIXELS = 4096
_UPSTREAM_LOCK = threading.Lock()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SL2PScene(StrictModel):
    scene_id: str = Field(min_length=1, max_length=256)
    acquired_at: datetime
    tiff_base64: str = Field(min_length=16)
    cloud_cover_percent: float | None = Field(default=None, ge=0, le=100)

    @field_validator("tiff_base64")
    @classmethod
    def validate_payload_size(cls, value: str) -> str:
        estimated = (len(value) * 3) // 4
        if estimated > MAX_TIFF_BYTES:
            raise ValueError("SL2P GeoTIFF payload exceeds the bounded scene size")
        return value


class SL2PBatchRequest(StrictModel):
    field_id: str = Field(min_length=1, max_length=128)
    scenes: list[SL2PScene] = Field(min_length=1, max_length=8)
    algorithm: Literal["sl2p"] = "sl2p"


def sl2p_runtime_status() -> dict[str, Any]:
    required = [
        TOOLS_DIR / "SL2P.py",
        VENDOR_ROOT / "nets" / "s2_20m_sl2p.pkl",
        VENDOR_ROOT / "nets" / "s2_20m_sl2p_error.pkl",
        VENDOR_ROOT / "nets" / "s2_20m_sl2p_domain.pkl",
        VENDOR_ROOT / "nets" / "s2_20m_sl2p_legend.pkl",
        VENDOR_ROOT / "nets" / "s2_20m_sl2p_parameter_file.pkl",
    ]
    missing = [str(path.relative_to(VENDOR_ROOT)) for path in required if not path.exists()]
    return {
        "available": not missing,
        "version": UPSTREAM_COMMIT[:12] if not missing else None,
        "missing": missing,
        "collection": COLLECTION,
        "resolution_m": 20,
    }


@contextmanager
def _upstream_context():
    old_cwd = Path.cwd()
    inserted = False
    tools = str(TOOLS_DIR)
    if tools not in sys.path:
        sys.path.insert(0, tools)
        inserted = True
    try:
        os.chdir(VENDOR_ROOT)
        yield
    finally:
        os.chdir(old_cwd)
        if inserted:
            try:
                sys.path.remove(tools)
            except ValueError:
                pass


def _decode_scene(scene: SL2PScene) -> tuple[pd.DataFrame, dict[str, Any]]:
    try:
        raw = base64.b64decode(scene.tiff_base64, validate=True)
    except Exception as exc:
        raise ValueError(f"{scene.scene_id}: invalid base64 GeoTIFF") from exc
    if not raw or len(raw) > MAX_TIFF_BYTES:
        raise ValueError(f"{scene.scene_id}: invalid GeoTIFF byte size")

    with MemoryFile(raw) as memfile:
        with memfile.open() as dataset:
            if dataset.count != len(BAND_ORDER):
                raise ValueError(
                    f"{scene.scene_id}: expected {len(BAND_ORDER)} bands, got {dataset.count}"
                )
            array = dataset.read(out_dtype="float64")

    matrix = array.reshape(array.shape[0], -1).T
    finite = np.isfinite(matrix).all(axis=1)
    valid_mask = matrix[:, -1] >= 0.5
    reflectance = matrix[:, 3:11]
    reflectance_range = ((reflectance >= -0.05) & (reflectance <= 1.5)).all(axis=1)
    cosine_range = ((matrix[:, 0:3] >= -1.0001) & (matrix[:, 0:3] <= 1.0001)).all(axis=1)
    keep = finite & valid_mask & reflectance_range & cosine_range
    valid = matrix[keep, :-1]

    if valid.shape[0] < 4:
        raise ValueError(f"{scene.scene_id}: fewer than 4 valid cloud-masked pixels")
    if valid.shape[0] > MAX_VALID_PIXELS:
        # Fixed deterministic thinning prevents field area from changing model load.
        indexes = np.linspace(0, valid.shape[0] - 1, MAX_VALID_PIXELS, dtype=int)
        valid = valid[indexes]

    frame = pd.DataFrame(valid, columns=INPUT_BANDS)
    return frame, {
        "pixel_count": int(matrix.shape[0]),
        "valid_pixel_count": int(valid.shape[0]),
        "valid_pixel_fraction": round(float(keep.mean()), 4),
    }


def _finite_values(series: pd.Series, qc_input: pd.Series, qc_output: pd.Series) -> np.ndarray:
    values = pd.to_numeric(series, errors="coerce").to_numpy(dtype=float)
    good = np.isfinite(values) & (qc_input.to_numpy(dtype=int) == 0) & (qc_output.to_numpy(dtype=int) == 0)
    return values[good]


def _summarize(output: pd.DataFrame, variable: str) -> dict[str, Any]:
    estimate_col = f"estimate{variable}"
    error_col = f"error{variable}"
    values = _finite_values(output[estimate_col], output["QC_input"], output["QC_output"])
    all_count = len(output)
    valid_count = int(values.size)
    errors = pd.to_numeric(output.loc[(output["QC_input"] == 0) & (output["QC_output"] == 0), error_col], errors="coerce")
    errors = errors[np.isfinite(errors)]

    if valid_count == 0:
        return {
            "value": None,
            "mean": None,
            "p10": None,
            "p90": None,
            "model_error_mean": None,
            "valid_fraction": 0.0,
            "valid_count": 0,
        }

    return {
        "value": round(float(np.median(values)), 5),
        "mean": round(float(np.mean(values)), 5),
        "p10": round(float(np.quantile(values, 0.10)), 5),
        "p90": round(float(np.quantile(values, 0.90)), 5),
        "model_error_mean": round(float(errors.mean()), 5) if len(errors) else None,
        "valid_fraction": round(valid_count / max(all_count, 1), 4),
        "valid_count": valid_count,
    }


def _quality_label(metrics: dict[str, dict[str, Any]], valid_pixel_fraction: float) -> str:
    model_valid = [float(v.get("valid_fraction") or 0) for v in metrics.values()]
    floor = min(model_valid) if model_valid else 0.0
    score = min(valid_pixel_fraction, floor)
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def run_sl2p_batch(payload: SL2PBatchRequest) -> dict[str, Any]:
    runtime = sl2p_runtime_status()
    if not runtime["available"]:
        raise RuntimeError("SL2P vendor runtime is not bootstrapped")

    scene_results: list[dict[str, Any]] = []
    with _UPSTREAM_LOCK:
        with _upstream_context():
            import importlib

            sl2p_module = importlib.import_module("SL2P")
            for scene in sorted(payload.scenes, key=lambda item: item.acquired_at):
                frame, raster_qc = _decode_scene(scene)
                metrics: dict[str, dict[str, Any]] = {}
                network_ids: set[int] = set()
                for variable in VARIABLES:
                    output = sl2p_module.SL2P(frame.copy(), variable, COLLECTION, INPUT_BANDS)
                    metrics[variable] = _summarize(output, variable)
                    for value in pd.to_numeric(output["networkID"], errors="coerce").dropna().tolist():
                        if math.isfinite(float(value)):
                            network_ids.add(int(value))

                quality = _quality_label(metrics, raster_qc["valid_pixel_fraction"])
                scene_results.append(
                    {
                        "scene_id": scene.scene_id,
                        "acquired_at": scene.acquired_at.isoformat(),
                        "cloud_cover_percent": scene.cloud_cover_percent,
                        "metrics": metrics,
                        "qc": {
                            **raster_qc,
                            "quality": quality,
                            "network_ids": sorted(network_ids),
                            "all_variables_valid": all(m["value"] is not None for m in metrics.values()),
                        },
                    }
                )

    return {
        "ok": True,
        "engine": "sl2p",
        "mode": "pilot",
        "field_id": payload.field_id,
        "algorithm": payload.algorithm,
        "collection": COLLECTION,
        "spatial_resolution_m": 20,
        "engine_version": UPSTREAM_COMMIT,
        "adapter_version": RUNNER_VERSION,
        "production_authority": False,
        "diagnostic_authority": False,
        "input_authority": "server-derived-only",
        "variables": VARIABLES,
        "scenes": scene_results,
    }
