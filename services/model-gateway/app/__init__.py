from __future__ import annotations

"""TarlaPusula model gateway package entrypoint.

Render starts the service with ``uvicorn app:app``.  The repository historically
kept the gateway in ``app.py``; this package loads that stable core and layers the
new scientific routes on top without duplicating the existing gateway logic.
"""

import importlib.util
from pathlib import Path
import sys
from typing import Any

from fastapi import Header, HTTPException

_ROOT = Path(__file__).resolve().parent.parent
_CORE_PATH = _ROOT / "app.py"
_CORE_NAME = "tarlapusula_gateway_core"

_spec = importlib.util.spec_from_file_location(_CORE_NAME, _CORE_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError("TarlaPusula gateway core could not be loaded")
_core = importlib.util.module_from_spec(_spec)
sys.modules[_CORE_NAME] = _core
_spec.loader.exec_module(_core)

app = _core.app
app.version = "0.9.0"

from engine_registry import ENGINE_REGISTRY  # noqa: E402
from rscm_runner import (  # noqa: E402
    RSCMAssimilationRequest,
    rscm_runtime_status,
    run_rscm_assimilation,
)
from sl2p_runner import SL2PBatchRequest, run_sl2p_batch, sl2p_runtime_status  # noqa: E402
from unicrop_runner import UniCropHarmonizeRequest, run_unicrop_harmonizer  # noqa: E402
from vendor_bootstrap import bootstrap as bootstrap_scientific_vendor  # noqa: E402


def _authorize(shared_key: str | None) -> None:
    _core._authorize(shared_key)


@app.on_event("startup")
def _prepare_scientific_vendor_runtime() -> None:
    """Prepare pinned SL2P/RSCM assets once per Render instance."""
    sl2p_ready = bool(sl2p_runtime_status().get("available"))
    rscm_ready = bool(rscm_runtime_status().get("available"))
    if sl2p_ready and rscm_ready:
        return
    try:
        result = bootstrap_scientific_vendor()
        print(f"[scientific-vendor] bootstrap ready: {result}")
    except Exception as exc:
        # Keep the existing gateway online; scientific health endpoints expose
        # the concrete missing runtime state while the rest of TarlaPusula works.
        print(f"[scientific-vendor] bootstrap failed: {exc}")


@app.get("/v1/biophysics/sl2p/health")
def sl2p_health(
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    status = sl2p_runtime_status()
    rollout = ENGINE_REGISTRY["sl2p"]["rollout"]
    ready = bool(status["available"] and rollout in {"shadow", "pilot", "production"})
    return {
        "ok": ready,
        "ready": ready,
        "engine": "sl2p",
        "rollout": rollout,
        "production_authority": False,
        "runtime": status,
    }


@app.post("/v1/biophysics/sl2p/pilot")
def sl2p_pilot(
    payload: SL2PBatchRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["sl2p"]["rollout"] not in {"pilot", "production"}:
        raise HTTPException(status_code=409, detail="SL2P pilot rollout is disabled")
    try:
        return run_sl2p_batch(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"SL2P pilot failed: {exc}") from exc


@app.get("/v1/assimilation/rscm/health")
def rscm_health(
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    status = rscm_runtime_status()
    rollout = ENGINE_REGISTRY["rscm"]["rollout"]
    ready = bool(status["available"] and rollout in {"shadow", "pilot", "production"})
    return {
        "ok": ready,
        "ready": ready,
        "engine": "rscm",
        "rollout": rollout,
        "production_authority": False,
        "yield_authority": False,
        "runtime": status,
    }


@app.post("/v1/assimilation/rscm/shadow")
def rscm_shadow(
    payload: RSCMAssimilationRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["rscm"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="RSCM rollout is disabled")
    try:
        return run_rscm_assimilation(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"RSCM assimilation failed: {exc}") from exc


@app.post("/v1/data/unicrop/harmonize")
def unicrop_harmonize(
    payload: UniCropHarmonizeRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["unicrop"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="UniCrop harmonization rollout is disabled")
    try:
        return run_unicrop_harmonizer(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"UniCrop harmonization failed: {exc}") from exc
