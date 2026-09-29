from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(
    title="TarlaPusula FTW Boundary Worker",
    version="1.4.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

S3_BUCKET = "us-west-2.opendata.source.coop"
S3_REGION = "us-west-2"
FTW_TR_PREFIX = (
    "tge-labs/ftw-global-data/predictions/vectors/alpha/"
    "results-by-admin-conf/admin:country_code=TR/"
)
SOURCE_COOP_ROOT = "https://data.source.coop/ftw/global-data/"
LIST_CACHE_TTL_SECONDS = 6 * 60 * 60
MAX_REMOTE_FILES = 2

_cached_parquet_urls: tuple[float, list[str]] | None = None


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


def _validated_bbox(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    min_lng, min_lat, max_lng, max_lat = [float(value) for value in bbox]
    if not (-180 <= min_lng < max_lng <= 180 and -90 <= min_lat < max_lat <= 90):
        raise HTTPException(status_code=422, detail="Invalid study-area bbox")
    return min_lng, min_lat, max_lng, max_lat


def _s3_list_urls() -> list[str]:
    global _cached_parquet_urls
    now = time.time()
    if _cached_parquet_urls and now - _cached_parquet_urls[0] < LIST_CACHE_TTL_SECONDS:
        return list(_cached_parquet_urls[1])

    query = urllib.parse.urlencode({"list-type": "2", "prefix": FTW_TR_PREFIX})
    endpoints = [
        f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/?{query}",
        f"https://s3.{S3_REGION}.amazonaws.com/{S3_BUCKET}/?{query}",
    ]
    last_error: Exception | None = None
    keys: list[str] = []

    for endpoint in endpoints:
        try:
            req = urllib.request.Request(
                endpoint,
                headers={"Accept": "application/xml", "User-Agent": "TarlaPusula/1.0"},
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                raw = response.read()
            root = ET.fromstring(raw)
            namespace = ""
            if root.tag.startswith("{"):
                namespace = root.tag.split("}", 1)[0] + "}"
            keys = [
                (node.text or "").strip()
                for node in root.findall(f".//{namespace}Contents/{namespace}Key")
                if (node.text or "").strip().lower().endswith(".parquet")
            ]
            if keys:
                break
        except Exception as exc:
            last_error = exc

    if not keys:
        # Turkey is a single-country partition in the published FTW collection.
        # Keep a few name fallbacks, but fail quickly instead of scanning a country-wide glob.
        fallback_names = ["Turkey.parquet", "Türkiye.parquet", "Turkiye.parquet"]
        urls = [
            SOURCE_COOP_ROOT
            + urllib.parse.quote(
                FTW_TR_PREFIX.removeprefix("tge-labs/ftw-global-data/") + name,
                safe="/:=._-",
            )
            for name in fallback_names
        ]
        if last_error:
            print(f"[ftw-worker] S3 listing failed; using Turkey filename fallbacks: {last_error}")
        _cached_parquet_urls = (now, urls)
        return urls

    urls = [
        SOURCE_COOP_ROOT
        + urllib.parse.quote(
            key.removeprefix("tge-labs/ftw-global-data/"),
            safe="/:=._-",
        )
        for key in keys[:MAX_REMOTE_FILES]
    ]
    _cached_parquet_urls = (now, urls)
    print(f"[ftw-worker] discovered {len(urls)} Turkey GeoParquet file(s)")
    return urls


def _wkb_to_geojson(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None

    try:
        from shapely import from_wkb, from_wkt
        from shapely.geometry import mapping

        if isinstance(value, memoryview):
            value = value.tobytes()
        if isinstance(value, bytearray):
            value = bytes(value)

        if isinstance(value, bytes):
            geometry = from_wkb(value)
        elif isinstance(value, str):
            text = value.strip()
            try:
                geometry = from_wkb(bytes.fromhex(text))
            except Exception:
                geometry = from_wkt(text)
        else:
            return None

        if geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            return None
        return mapping(geometry)
    except Exception as exc:
        print(f"[ftw-worker] geometry decode skipped: {exc}")
        return None


def _observed_year(value: Any) -> int | None:
    if value is None:
        return None
    if hasattr(value, "year"):
        try:
            return int(value.year)
        except Exception:
            pass
    text = str(value).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _query_one_file(
    url: str,
    anchor_lng: float,
    anchor_lat: float,
    bbox: tuple[float, float, float, float],
    limit: int,
    *,
    anchor_only: bool,
) -> list[tuple[Any, ...]]:
    import duckdb

    escaped_url = url.replace("'", "''")
    min_lng, min_lat, max_lng, max_lat = bbox

    # IMPORTANT: keep this remote query pushdown-friendly. Do not ORDER BY and do not
    # cast/extract determination:datetime here: either operation can force a scan of the
    # whole country file before LIMIT. BBox columns are GeoParquet covering columns and
    # can be used for row-group pruning.
    if anchor_only:
        where = """
            bbox.xmax >= ? AND bbox.xmin <= ?
            AND bbox.ymax >= ? AND bbox.ymin <= ?
        """
        params: list[Any] = [anchor_lng, anchor_lng, anchor_lat, anchor_lat, limit]
    else:
        where = """
            bbox.xmax >= ? AND bbox.xmin <= ?
            AND bbox.ymax >= ? AND bbox.ymin <= ?
        """
        params = [min_lng, max_lng, min_lat, max_lat, limit]

    sql = f'''
        SELECT
            id,
            confidence,
            "metrics:area" AS area_m2,
            "determination:datetime" AS observed_at,
            geometry
        FROM read_parquet('{escaped_url}')
        WHERE {where}
        LIMIT ?
    '''

    con = duckdb.connect(database=":memory:")
    try:
        return con.execute(sql, params).fetchall()
    finally:
        con.close()


def _rows_to_features(
    rows: list[tuple[Any, ...]],
    requested_year: int,
    max_candidates: int,
) -> list[dict[str, Any]]:
    preferred: list[dict[str, Any]] = []
    fallback: list[dict[str, Any]] = []

    for field_id, confidence, area_m2, observed_at, geometry_raw in rows:
        geometry = _wkb_to_geojson(geometry_raw)
        if not geometry:
            continue

        observed_year = _observed_year(observed_at)
        feature = {
            "type": "Feature",
            "id": str(field_id),
            "properties": {
                "id": str(field_id),
                "confidence": float(confidence) if confidence is not None else None,
                "metrics:area": float(area_m2) if area_m2 is not None else None,
                "determination:datetime": (
                    observed_at.isoformat()
                    if hasattr(observed_at, "isoformat")
                    else str(observed_at or "")
                ),
                "determination:year": observed_year,
                "admin:country_code": "TR",
                "agribound:engine": "ftw-duckdb-point-query",
                "agribound:dataset": "Fields of The World global predictions",
            },
            "geometry": geometry,
        }
        if observed_year == requested_year:
            preferred.append(feature)
        else:
            fallback.append(feature)

    def confidence_key(feature: dict[str, Any]) -> float:
        value = (feature.get("properties") or {}).get("confidence")
        try:
            return float(value) if value is not None else -1.0
        except Exception:
            return -1.0

    preferred.sort(key=confidence_key, reverse=True)
    fallback.sort(key=confidence_key, reverse=True)

    # Prefer the configured year, but do not return an empty answer simply because the
    # nearby published polygon is from the other FTW prediction year. The year remains
    # explicit on every candidate so the caller never mistakes it for current cadastral data.
    ordered = preferred + fallback
    return ordered[:max_candidates]


def _query_turkey(
    anchor_lng: float,
    anchor_lat: float,
    bbox: tuple[float, float, float, float],
    year: int,
    max_candidates: int,
) -> list[dict[str, Any]]:
    started = time.perf_counter()
    urls = _s3_list_urls()
    errors: list[str] = []
    rows: list[tuple[Any, ...]] = []
    fetch_limit = max(32, min(160, max_candidates * 10))

    # First pass: the user explicitly taps inside the field. Query only polygons whose
    # stored bbox contains that point. This is much cheaper than sorting/scanning every
    # field near the point and is exactly aligned with this UX.
    for url in urls[:MAX_REMOTE_FILES]:
        try:
            rows.extend(
                _query_one_file(
                    url,
                    anchor_lng,
                    anchor_lat,
                    bbox,
                    fetch_limit,
                    anchor_only=True,
                )
            )
            if rows:
                break
        except Exception as exc:
            errors.append(f"{url.rsplit('/', 1)[-1]}: {exc}")
            print(f"[ftw-worker] point query failed for {url}: {exc}")

    # Only if the exact point has no bbox hit, use the small server-generated search box.
    if not rows:
        for url in urls[:MAX_REMOTE_FILES]:
            try:
                rows.extend(
                    _query_one_file(
                        url,
                        anchor_lng,
                        anchor_lat,
                        bbox,
                        fetch_limit,
                        anchor_only=False,
                    )
                )
                if rows:
                    break
            except Exception as exc:
                errors.append(f"{url.rsplit('/', 1)[-1]}: {exc}")
                print(f"[ftw-worker] bbox fallback failed for {url}: {exc}")

    if not rows and errors:
        detail = errors[0][:700]
        raise RuntimeError(f"FTW Turkey GeoParquet query failed: {detail}")

    features = _rows_to_features(rows, year, max_candidates)
    deduped: dict[str, dict[str, Any]] = {}
    for feature in features:
        feature_id = str(feature.get("id") or "")
        if feature_id and feature_id not in deduped:
            deduped[feature_id] = feature

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    print(
        f"[ftw-worker] point lookup completed in {elapsed_ms} ms; "
        f"rows={len(rows)} candidates={len(deduped)}"
    )
    return list(deduped.values())[:max_candidates]


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        import duckdb
        import shapely

        runtime_ok = True
        runtime_error = None
        duckdb_version = getattr(duckdb, "__version__", None)
        shapely_version = getattr(shapely, "__version__", None)
    except Exception as exc:
        runtime_ok = False
        runtime_error = str(exc)
        duckdb_version = None
        shapely_version = None

    return {
        "ok": runtime_ok and bool(_supabase_url()) and bool(_supabase_anon_key()),
        "service": "agribound-worker",
        "engine": "ftw-duckdb-point-query",
        "version": "1.4.0",
        "duckdb_version": duckdb_version,
        "shapely_version": shapely_version,
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
        features = _query_turkey(
            request.anchor.longitude,
            request.anchor.latitude,
            bbox,
            year,
            request.policy.max_candidates,
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ftw-worker] boundary query error: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)[:900]) from exc

    return {
        "ok": True,
        "engine": "ftw-duckdb-point-query",
        "version": "1.4.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_year": year,
        "source": "Fields of The World global predictions · Source Cooperative",
        "country_code": "TR",
        "features": features,
        "candidate_count": len(features),
        "policy": {"candidate_only": True, "auto_apply": False},
    }
