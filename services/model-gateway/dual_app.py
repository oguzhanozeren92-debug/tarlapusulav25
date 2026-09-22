from __future__ import annotations

import importlib.metadata

from fastapi import Header, HTTPException

# Backward-compatible import target for older Docker/Render commands.
# app.py remains the core model gateway; this module layers optional/heavier
# evidence engines on top without expanding the production irrigation codepath.
from app import app, _authorize, run_pyfao56_dual_kc_shadow
from engine_registry import ENGINE_REGISTRY
from plantcv_runner import PlantCVPhotoEvidenceRequest, run_plantcv_photo_evidence
from plantvillage_shadow_runner import PlantVillageShadowRequest, run_plantvillage_shadow


@app.get("/v1/vision/plantcv/health")
def plantcv_health(
    x_model_gateway_key: str | None = Header(default=None),
):
    _authorize(x_model_gateway_key)

    try:
        version = importlib.metadata.version("plantcv")
        available = True
    except Exception:
        version = None
        available = False

    registry = ENGINE_REGISTRY.get("plantcv", {})
    ready = available and registry.get("rollout") in {"shadow", "pilot", "production"}

    return {
        "ok": ready,
        "ready": ready,
        "engine": "plantcv",
        "engine_version": version,
        "rollout": registry.get("rollout", "off"),
        "production_authority": False,
        "diagnostic_authority": False,
    }


@app.post("/v1/vision/plantcv/evidence")
def plantcv_photo_evidence(
    payload: PlantCVPhotoEvidenceRequest,
    x_model_gateway_key: str | None = Header(default=None),
):
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY.get("plantcv", {}).get("rollout") not in {
        "shadow",
        "pilot",
        "production",
    }:
        raise HTTPException(status_code=409, detail="PlantCV rollout is disabled")

    try:
        return run_plantcv_photo_evidence(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PlantCV photo evidence failed: {exc}") from exc


@app.get("/v1/vision/plantvillage/health")
def plantvillage_shadow_health(
    x_model_gateway_key: str | None = Header(default=None),
):
    _authorize(x_model_gateway_key)

    try:
        version = importlib.metadata.version("onnxruntime")
        available = True
    except Exception:
        version = None
        available = False

    registry = ENGINE_REGISTRY.get("plantvillage-shadow", {})
    ready = available and registry.get("rollout") in {"shadow", "pilot", "production"}

    return {
        "ok": ready,
        "ready": ready,
        "engine": "plantvillage-onnx-shadow",
        "runtime_version": version,
        "rollout": registry.get("rollout", "off"),
        "production_authority": False,
        "diagnostic_authority": False,
        "confidence_authority": False,
        "note": "Model asset is lazy-loaded on first shadow request; health does not download remote weights.",
    }


@app.post("/v1/vision/plantvillage/shadow")
def plantvillage_shadow(
    payload: PlantVillageShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
):
    _authorize(x_model_gateway_key)

    if ENGINE_REGISTRY.get("plantvillage-shadow", {}).get("rollout") not in {
        "shadow",
        "pilot",
        "production",
    }:
        raise HTTPException(status_code=409, detail="PlantVillage shadow rollout is disabled")

    try:
        return run_plantvillage_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PlantVillage shadow failed: {exc}") from exc


__all__ = [
    "app",
    "run_pyfao56_dual_kc_shadow",
    "plantcv_health",
    "plantcv_photo_evidence",
    "plantvillage_shadow_health",
    "plantvillage_shadow",
]
