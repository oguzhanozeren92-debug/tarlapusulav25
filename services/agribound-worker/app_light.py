from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from importlib.metadata import distribution, version
from importlib.util import module_from_spec, spec_from_file_location
from typing import Any, Callable

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(
    title="TarlaPusula FTW Boundary Worker",
    version="1.2.1",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

FTW_TURKEY_SOURCE = (
    "s3://us-west-2.opendata.source.coop/tge-labs/ftw-global-data/"
    "predictions/vectors/alpha/results-by-admin-conf/"
    "admin:country_code=TR/*.parquet"
)

_query_ftw_arrow: Callable[..., Any] | None = None


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


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def _supabase_anon_key() -> str:
    return os.getenv("SUPABASE_ANON_KEY", "").strip()


def _verify_supabase_user(authorization: str | None) -> dict[str, Any]:
    supabase_url = _supabase_url()
    anon_key = _supabase_anon_key()
    auth_header = (authorization or "").strip()

    if not supabase_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase auth verifier is not configured")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Valid Supabase user session required")

    request = urllib.request.Request(
        f"{supabase_url}/auth/v1/user",
        method="GET",
        headers={
            "Authorization": auth_header,
            "apikey": anon_key,
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            user = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=401, detail="Supabase user session rejected") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase auth verification failed: {exc}") from exc

    if not str(user.get("id") or "").strip():
        raise HTTPException(status_code=401, detail="Supabase user session has no user id")
    return user


def _load_query_ftw_arrow() -> Callable[..., Any]:
    global _query_ftw_arrow
    if _query_ftw_arrow is not None:
        return _query_ftw_arrow

    try:
        module_path = distribution("agribound").locate_file("agribound/ftw_arrow.py")
        spec = spec_from_file_location("_tarlapusula_ftw_arrow", module_path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Agribound FTW query module could not be loaded")
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        _query_ftw_arrow = module.query_ftw_arrow
        return _query_ftw_arrow
    except Exception as exc:
        raise RuntimeError(f"Lightweight FTW query loader failed: {exc}") from exc


def _validated_bbox(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    min_lng, min_lat, max_lng, max_lat = [float(value) for value in bbox]
    if not (-180 <= min_lng < max_lng <= 180 and -90 <= min_lat < max_lat <= 90):
        raise HTTPException(status_code=422, detail="Invalid study-area bbox")
    return min_lng, min_lat, max_lng, max_lat


def _features(gdf: Any, limit: int) -> list[dict[str, Any]]:
    if gdf is None or getattr(gdf, "empty", True):
        return []

    payload = json.loads(gdf.head(limit).to_json())
    output: list[dict[str, Any]] = []
    for index, feature in enumerate(payload.get("features") or []):
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            continue
        if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            continue

        props = feature.get("properties") or {}
        props["agribound:engine"] = "published-ftw-country-query"
        props["agribound:dataset"] = "Fields of The World global predictions"
        props["admin:country_code"] = "TR"

        output.append(
            {
                "type": "Feature",
                "id": feature.get("id", index),
                "properties": props,
                "geometry": geometry,
            }
        )
    return output


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        package_version = version("agribound")
        runtime_ok = True
        runtime_error = None
    except Exception as exc:
        package_version = None
        runtime_ok = False
        runtime_error = str(exc)

    return {
        "ok": runtime_ok and bool(_supabase_url()) and bool(_supabase_anon_key()),
        "service": "agribound-worker",
        "engine": "published-ftw-country-query",
        "agribound_version": package_version,
        "supabase_auth_configured": bool(_supabase_url()) and bool(_supabase_anon_key()),
        "error": runtime_error,
    }


@app.post("/boundary-candidates")
def boundary_candidates(
    request: BoundaryRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = _verify_supabase_user(authorization)
    if str(user.get("id") or "").strip() != request.user_context.user_id:
        raise HTTPException(status_code=403, detail="User context does not match authenticated user")
    if not request.policy.candidate_only:
        raise HTTPException(status_code=422, detail="Only candidate-only mode is supported")

    bbox = _validated_bbox(request.study_area.bbox)
    year = int(os.getenv("AGRIBOUND_FTW_YEAR", str(request.preferred_pipeline.year)))
    year = max(2024, min(year, 2025))

    try:
        query_ftw_arrow = _load_query_ftw_arrow()
        gdf = query_ftw_arrow(
            study_area_bounds=bbox,
            source_url=FTW_TURKEY_SOURCE,
            year=year,
            label="field",
            columns=["id", "confidence", "metrics:area", "determination:datetime"],
            max_features=max(64, min(800, request.policy.max_candidates * 8)),
        )
        features = _features(gdf, request.policy.max_candidates)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Published FTW Turkey query failed: {exc}",
        ) from exc

    return {
        "ok": True,
        "engine": "published-ftw-country-query",
        "version": "1.2.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_year": year,
        "source": "Fields of The World global predictions · Source Cooperative",
        "country_code": "TR",
        "features": features,
        "candidate_count": len(features),
        "policy": {"candidate_only": True, "auto_apply": False},
    }
