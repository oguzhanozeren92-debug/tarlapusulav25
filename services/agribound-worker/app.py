from __future__ import annotations

import hmac
import importlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(
    title="TarlaPusula Agribound Worker",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Anchor(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class StudyArea(StrictModel):
    bbox: tuple[float, float, float, float]
    radius_m: float = Field(gt=0, le=5000)


class Pipeline(StrictModel):
    strategy: str = "published-ftw-first"
    source: str = "fields-of-the-world"
    engine: str = "query-ftw"
    year: int = Field(default=2025, ge=2015, le=2100)
    output_format: str = "geojson"


class Policy(StrictModel):
    candidate_only: bool = True
    never_overwrite_registered_boundary: bool = True
    official_boundary_priority: bool = True
    max_candidates: int = Field(default=80, ge=1, le=100)


class UserContext(StrictModel):
    user_id: str = Field(min_length=1, max_length=160)


class BoundaryRequest(StrictModel):
    request_version: int = Field(default=2, ge=1, le=10)
    request_id: str = Field(min_length=1, max_length=160)
    field_id: str | None = Field(default=None, max_length=160)
    user_context: UserContext
    anchor: Anchor
    study_area: StudyArea
    declared_area_m2: float | None = Field(default=None, gt=0)
    preferred_pipeline: Pipeline = Field(default_factory=Pipeline)
    policy: Policy = Field(default_factory=Policy)


def _expected_token() -> str:
    return os.getenv("AGRIBOUND_WORKER_TOKEN", "").strip()


def _authorize(authorization: str | None) -> None:
    expected = _expected_token()
    if not expected:
        raise HTTPException(status_code=503, detail="Worker shared token is not configured")

    supplied = (authorization or "").strip()
    prefix = "Bearer "
    if supplied.startswith(prefix):
        supplied = supplied[len(prefix):].strip()

    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Agribound worker authorization failed")


def _runtime_status() -> dict[str, Any]:
    try:
        module = importlib.import_module("agribound")
        return {
            "available": True,
            "version": getattr(module, "__version__", None),
        }
    except Exception as exc:
        return {
            "available": False,
            "version": None,
            "error": str(exc),
        }


def _bbox_feature(bbox: tuple[float, float, float, float]) -> dict[str, Any]:
    min_lng, min_lat, max_lng, max_lat = bbox
    if not (-180 <= min_lng < max_lng <= 180 and -90 <= min_lat < max_lat <= 90):
        raise HTTPException(status_code=422, detail="Invalid study-area bbox")

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"source": "TarlaPusula server-derived AOI"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [min_lng, min_lat],
                        [max_lng, min_lat],
                        [max_lng, max_lat],
                        [min_lng, max_lat],
                        [min_lng, min_lat],
                    ]],
                },
            }
        ],
    }


def _feature_payload(gdf: Any, max_candidates: int) -> list[dict[str, Any]]:
    if gdf is None or getattr(gdf, "empty", True):
        return []

    payload = json.loads(gdf.head(max_candidates).to_json())
    features = payload.get("features") or []

    normalized: list[dict[str, Any]] = []
    for index, feature in enumerate(features):
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            continue

        properties = feature.get("properties") or {}
        properties["agribound:engine"] = "query-ftw"
        properties["agribound:dataset"] = "Fields of The World published predictions"
        properties.setdefault("id", feature.get("id", index))

        normalized.append(
            {
                "type": "Feature",
                "id": feature.get("id", index),
                "properties": properties,
                "geometry": geometry,
            }
        )

    return normalized


@app.get("/health")
def health() -> dict[str, Any]:
    status = _runtime_status()
    return {
        "ok": status["available"],
        "service": "agribound-worker",
        "engine": "query-ftw",
        "agribound": status,
        "token_configured": bool(_expected_token()),
    }


@app.post("/boundary-candidates")
def boundary_candidates(
    request: BoundaryRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)

    if not request.policy.candidate_only:
        raise HTTPException(status_code=422, detail="Only candidate-only mode is supported")

    try:
        import agribound as ab
        import geopandas as gpd
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Agribound runtime unavailable: {exc}") from exc

    ftw_year = int(os.getenv("AGRIBOUND_FTW_YEAR", str(request.preferred_pipeline.year)))
    ftw_year = max(2015, min(ftw_year, 2025))

    try:
        with TemporaryDirectory(prefix="tp-agribound-") as temp_dir:
            temp = Path(temp_dir)
            study_path = temp / "study_area.geojson"
            output_path = temp / "ftw_candidates.parquet"
            study_path.write_text(
                json.dumps(_bbox_feature(request.study_area.bbox), ensure_ascii=False),
                encoding="utf-8",
            )

            result = ab.query_ftw(
                study_area=str(study_path),
                year=ftw_year,
                label="field",
                clip=True,
                output_path=str(output_path),
            )

            if result is None and output_path.exists():
                result = gpd.read_parquet(output_path)

            features = _feature_payload(result, request.policy.max_candidates)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Published FTW boundary query failed: {exc}",
        ) from exc

    runtime = _runtime_status()
    return {
        "ok": True,
        "engine": "agribound-query-ftw",
        "version": runtime.get("version"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_year": ftw_year,
        "source": "Fields of The World published predictions",
        "features": features,
        "candidate_count": len(features),
        "policy": {
            "candidate_only": True,
            "auto_apply": False,
        },
    }
