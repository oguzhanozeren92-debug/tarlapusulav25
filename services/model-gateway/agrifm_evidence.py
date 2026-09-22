from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import hmac
import json
from typing import Mapping, Sequence

from agrifm_cube import SceneTensor, cube_metadata, fingerprint_cube, validate_cube
from agrifm_geotiff import GeoTiffSceneSource, decode_scene

CONTRACT = "sentinel2_l2a_temporal_cube_v1"
REQUIRED_ASSETS = frozenset({"B02", "B03", "B04", "B08", "SCL"})


@dataclass(frozen=True)
class SceneEvidence:
    stac_item_id: str
    acquired_at: str
    asset_sha256: Mapping[str, str]


@dataclass(frozen=True)
class ValidatedCubeEvidence:
    scenes: tuple[SceneTensor, ...]
    cube_fingerprint_sha256: str
    source_manifest_sha256: str
    metadata: dict


def _sha256(payload: bytes) -> str:
    return sha256(payload).hexdigest()


def _canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _validate_asset_hashes(source: GeoTiffSceneSource, evidence: SceneEvidence) -> None:
    if source.stac_item_id != evidence.stac_item_id or source.acquired_at != evidence.acquired_at:
        raise ValueError("agrifm_source_evidence_identity_mismatch")
    if set(source.assets) != REQUIRED_ASSETS or set(evidence.asset_sha256) != REQUIRED_ASSETS:
        raise ValueError("agrifm_source_evidence_asset_set_mismatch")
    for asset in sorted(REQUIRED_ASSETS):
        expected = evidence.asset_sha256[asset].strip().lower()
        if len(expected) != 64 or any(ch not in "0123456789abcdef" for ch in expected):
            raise ValueError("agrifm_source_evidence_hash_invalid")
        actual = _sha256(source.assets[asset])
        if not hmac.compare_digest(actual, expected):
            raise ValueError("agrifm_source_evidence_hash_mismatch")


def build_validated_cube(
    sources: Sequence[GeoTiffSceneSource],
    evidence: Sequence[SceneEvidence],
    *,
    field_geometry_sha256: str,
) -> ValidatedCubeEvidence:
    if len(sources) != len(evidence):
        raise ValueError("agrifm_source_evidence_count_mismatch")
    geometry_hash = field_geometry_sha256.strip().lower()
    if len(geometry_hash) != 64 or any(ch not in "0123456789abcdef" for ch in geometry_hash):
        raise ValueError("agrifm_field_geometry_hash_invalid")

    decoded: list[SceneTensor] = []
    manifest_scenes: list[dict] = []
    for source, scene_evidence in zip(sources, evidence, strict=True):
        _validate_asset_hashes(source, scene_evidence)
        decoded.append(decode_scene(source))
        manifest_scenes.append({
            "stac_item_id": scene_evidence.stac_item_id,
            "acquired_at": scene_evidence.acquired_at,
            "asset_sha256": {key: scene_evidence.asset_sha256[key].lower() for key in sorted(REQUIRED_ASSETS)},
        })

    validate_cube(decoded)
    manifest = {
        "contract": CONTRACT,
        "field_geometry_sha256": geometry_hash,
        "scenes": manifest_scenes,
    }
    return ValidatedCubeEvidence(
        scenes=tuple(decoded),
        cube_fingerprint_sha256=fingerprint_cube(decoded),
        source_manifest_sha256=_sha256(_canonical_json(manifest)),
        metadata={**cube_metadata(decoded), "field_geometry_sha256": geometry_hash},
    )
