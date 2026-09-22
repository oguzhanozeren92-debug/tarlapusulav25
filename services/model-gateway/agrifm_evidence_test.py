from __future__ import annotations

from hashlib import sha256
from pathlib import Path

import pytest

from agrifm_cube import BANDS, FLOATS_PER_SCENE, PIXELS_PER_SCENE, SceneTensor, pack_scene, validate_scene


def test_agrifm_evidence_binding_is_fail_closed():
    root = Path(__file__).resolve().parent
    source = (root / "agrifm_evidence.py").read_text(encoding="utf-8")
    for token in (
        "agrifm_source_evidence_identity_mismatch",
        "agrifm_source_evidence_asset_set_mismatch",
        "agrifm_source_evidence_hash_invalid",
        "agrifm_source_evidence_hash_mismatch",
        "agrifm_source_evidence_count_mismatch",
        "agrifm_field_geometry_hash_invalid",
    ):
        assert token in source


def test_agrifm_evidence_manifest_binds_geometry_and_assets():
    root = Path(__file__).resolve().parent
    source = (root / "agrifm_evidence.py").read_text(encoding="utf-8")
    assert '"field_geometry_sha256": geometry_hash' in source
    assert '"asset_sha256"' in source
    assert "hmac.compare_digest" in source
    assert "decode_scene(source)" in source
    assert "validate_cube(decoded)" in source
    assert "fingerprint_cube(decoded)" in source


def _scene(*, masked_value: float, valid_value: float = 0.25) -> SceneTensor:
    mask = bytearray([1] * PIXELS_PER_SCENE)
    mask[0] = 0
    values = [valid_value] * FLOATS_PER_SCENE
    for band_index in range(len(BANDS)):
        values[band_index] = masked_value
    return SceneTensor(
        acquired_at="2026-09-21T00:00:00Z",
        stac_item_id="scene-1",
        reflectance=tuple(values),
        valid_mask=bytes(mask),
    )


def test_masked_nan_is_allowed_and_preserved_by_packing():
    scene = _scene(masked_value=float("nan"))
    validate_scene(scene)
    assert len(pack_scene(scene)) == FLOATS_PER_SCENE * 4


def test_unmasked_nan_is_rejected():
    values = [0.25] * FLOATS_PER_SCENE
    values[len(BANDS)] = float("nan")
    scene = SceneTensor(
        acquired_at="2026-09-21T00:00:00Z",
        stac_item_id="scene-1",
        reflectance=tuple(values),
        valid_mask=bytes([1] * PIXELS_PER_SCENE),
    )
    with pytest.raises(ValueError, match="agrifm_reflectance_non_finite"):
        validate_scene(scene)


def test_masked_infinity_is_rejected():
    with pytest.raises(ValueError, match="agrifm_masked_reflectance_invalid"):
        validate_scene(_scene(masked_value=float("inf")))


def test_sha256_reference_length():
    assert len(sha256(b"tarlapusula-agrifm").hexdigest()) == 64
