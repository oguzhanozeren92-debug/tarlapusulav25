from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

RUNNER_VERSION = 1
UPSTREAM = "CoDIS-Lab/UniCrop"
ROLE = "data_harmonization_quality_reference"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvidenceSource(StrictModel):
    key: str = Field(min_length=1, max_length=80)
    category: Literal["satellite", "weather", "soil", "management", "terrain", "model"]
    provider: str = Field(min_length=1, max_length=120)
    observed_at: datetime | None = None
    item_count: int = Field(default=0, ge=0, le=100000)
    expected_item_count: int = Field(default=1, ge=1, le=100000)
    spatial_coverage: float | None = Field(default=None, ge=0, le=1)
    quality: float | None = Field(default=None, ge=0, le=1)
    provenance_complete: bool = False
    required: bool = True
    details: dict[str, Any] = Field(default_factory=dict)


class UniCropHarmonizeRequest(StrictModel):
    field_id: str = Field(min_length=1, max_length=128)
    as_of: datetime
    sources: list[EvidenceSource] = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def validate_unique_keys(self):
        keys = [source.key for source in self.sources]
        if len(keys) != len(set(keys)):
            raise ValueError("evidence source keys must be unique")
        return self


FRESHNESS_WINDOWS_DAYS = {
    "satellite": 20.0,
    "weather": 3.0,
    "soil": 730.0,
    "management": 365.0,
    "terrain": 3650.0,
    "model": 30.0,
}

CATEGORY_WEIGHTS = {
    "satellite": 0.28,
    "weather": 0.22,
    "soil": 0.18,
    "management": 0.18,
    "terrain": 0.06,
    "model": 0.08,
}


def _now_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _freshness(source: EvidenceSource, as_of: datetime) -> tuple[float, float | None]:
    if source.observed_at is None:
        return 0.0, None
    age_days = max(0.0, (_now_aware(as_of) - _now_aware(source.observed_at)).total_seconds() / 86400.0)
    window = FRESHNESS_WINDOWS_DAYS[source.category]
    # 1.0 through half-window, then degrades smoothly to zero at 2x window.
    if age_days <= window * 0.5:
        score = 1.0
    else:
        score = max(0.0, 1.0 - (age_days - window * 0.5) / (window * 1.5))
    return score, age_days


def _source_score(source: EvidenceSource, as_of: datetime) -> dict[str, Any]:
    completeness = min(1.0, source.item_count / max(source.expected_item_count, 1))
    freshness, age_days = _freshness(source, as_of)
    spatial = source.spatial_coverage if source.spatial_coverage is not None else (1.0 if source.category in {"weather", "management", "model"} else 0.65)
    quality = source.quality if source.quality is not None else 0.7
    provenance = 1.0 if source.provenance_complete else 0.45
    score = 0.30 * completeness + 0.25 * freshness + 0.18 * spatial + 0.17 * quality + 0.10 * provenance
    return {
        "key": source.key,
        "category": source.category,
        "provider": source.provider,
        "required": source.required,
        "score": round(score * 100.0, 1),
        "components": {
            "completeness": round(completeness, 4),
            "freshness": round(freshness, 4),
            "spatial_coverage": round(spatial, 4),
            "quality": round(quality, 4),
            "provenance": round(provenance, 4),
        },
        "age_days": round(age_days, 2) if age_days is not None else None,
        "details": source.details,
    }


def run_unicrop_harmonizer(payload: UniCropHarmonizeRequest) -> dict[str, Any]:
    scored = [_source_score(source, payload.as_of) for source in payload.sources]
    by_category: dict[str, list[dict[str, Any]]] = {}
    for item in scored:
        by_category.setdefault(item["category"], []).append(item)

    category_scores: dict[str, float] = {}
    for category, items in by_category.items():
        category_scores[category] = sum(float(item["score"]) for item in items) / len(items)

    present_weights = sum(CATEGORY_WEIGHTS.get(category, 0.0) for category in category_scores)
    weighted = sum(category_scores[category] * CATEGORY_WEIGHTS.get(category, 0.0) for category in category_scores)
    overall = weighted / present_weights if present_weights > 0 else 0.0

    missing_required = [item["key"] for item in scored if item["required"] and item["components"]["completeness"] <= 0]
    weak_sources = [item["key"] for item in scored if float(item["score"]) < 55.0]
    stale_sources = [item["key"] for item in scored if item["components"]["freshness"] < 0.35]
    provenance_gaps = [item["key"] for item in scored if item["components"]["provenance"] < 1]

    if missing_required:
        confidence_class = "insufficient"
    elif overall >= 82:
        confidence_class = "high"
    elif overall >= 65:
        confidence_class = "medium"
    else:
        confidence_class = "low"

    return {
        "ok": True,
        "engine": "unicrop",
        "mode": "data-confidence",
        "field_id": payload.field_id,
        "engine_version": "reference-adapter-v1",
        "adapter_version": RUNNER_VERSION,
        "upstream_reference": UPSTREAM,
        "role": ROLE,
        "production_authority": False,
        "yield_authority": False,
        "input_authority": "server-derived-only",
        "data_confidence": {
            "score": round(overall, 1),
            "class": confidence_class,
            "category_scores": {key: round(value, 1) for key, value in sorted(category_scores.items())},
            "missing_required": missing_required,
            "weak_sources": weak_sources,
            "stale_sources": stale_sources,
            "provenance_gaps": provenance_gaps,
        },
        "sources": scored,
        "note": "UniCrop is used as a harmonization/provenance design reference. TarlaPusula computes this quality score from its own server-derived evidence and does not import UniCrop yield predictions as decision authority.",
    }
