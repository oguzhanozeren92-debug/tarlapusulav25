from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
import math
import struct

WIDTH = 64
HEIGHT = 64
BANDS = ("B02", "B03", "B04", "B08")
MIN_VALID_PIXEL_FRACTION = 0.10
MAX_TENSOR_BYTES = 12 * len(BANDS) * HEIGHT * WIDTH * 4
PIXELS_PER_SCENE = WIDTH * HEIGHT
FLOATS_PER_SCENE = PIXELS_PER_SCENE * len(BANDS)

@dataclass(frozen=True)
class SceneTensor:
    acquired_at: str
    stac_item_id: str
    reflectance: tuple[float, ...]
    valid_mask: bytes

def validate_scene(scene: SceneTensor) -> None:
    if len(scene.reflectance) != FLOATS_PER_SCENE:
        raise ValueError("agrifm_reflectance_shape_mismatch")
    if len(scene.valid_mask) != PIXELS_PER_SCENE:
        raise ValueError("agrifm_mask_shape_mismatch")
    for flag in scene.valid_mask:
        if flag not in (0, 1):
            raise ValueError("agrifm_mask_not_binary")
    for index, value in enumerate(scene.reflectance):
        pixel = index // len(BANDS)
        valid = scene.valid_mask[pixel] == 1
        if valid:
            if not math.isfinite(value):
                raise ValueError("agrifm_reflectance_non_finite")
            if not 0.0 <= value <= 1.0:
                raise ValueError("agrifm_reflectance_out_of_range")
        elif not (math.isfinite(value) or math.isnan(value)):
            raise ValueError("agrifm_masked_reflectance_invalid")

def valid_fraction(scene: SceneTensor) -> float:
    validate_scene(scene)
    return sum(scene.valid_mask) / PIXELS_PER_SCENE

def pack_scene(scene: SceneTensor) -> bytes:
    validate_scene(scene)
    if valid_fraction(scene) < MIN_VALID_PIXEL_FRACTION:
        raise ValueError("agrifm_scene_valid_fraction_too_low")
    values = [value if scene.valid_mask[i // len(BANDS)] else math.nan for i, value in enumerate(scene.reflectance)]
    return struct.pack(f"<{len(values)}f", *values)

def cube_bytes(scenes: list[SceneTensor]) -> bytes:
    validate_cube(scenes)
    payload = b"".join(pack_scene(scene) for scene in scenes)
    if len(payload) > MAX_TENSOR_BYTES:
        raise ValueError("agrifm_tensor_payload_too_large")
    return payload

def cube_byte_length(scenes: list[SceneTensor]) -> int:
    return len(cube_bytes(scenes))

def cube_shape(scenes: list[SceneTensor]) -> tuple[int, int, int, int]:
    return (len(scenes), len(BANDS), HEIGHT, WIDTH)

def validate_cube(scenes: list[SceneTensor]) -> None:
    if not 4 <= len(scenes) <= 12:
        raise ValueError("agrifm_observation_count_out_of_range")
    identities = [(s.acquired_at, s.stac_item_id) for s in scenes]
    if identities != sorted(identities) or len(set(identities)) != len(identities):
        raise ValueError("agrifm_scene_order_or_duplicate_invalid")
    for scene in scenes:
        pack_scene(scene)

def cube_metadata(scenes: list[SceneTensor]) -> dict:
    validate_cube(scenes)
    return {
        "contract": "sentinel2_l2a_temporal_cube_v1",
        "shape": list(cube_shape(scenes)),
        "dtype": "float32",
        "band_order": list(BANDS),
        "masked_value": "NaN",
        "valid_pixel_fractions": [round(valid_fraction(scene), 6) for scene in scenes],
    }

def fingerprint_cube(scenes: list[SceneTensor]) -> str:
    validate_cube(scenes)
    digest = sha256()
    digest.update(b"sentinel2_l2a_temporal_cube_v1\0")
    for scene in scenes:
        digest.update(scene.acquired_at.encode())
        digest.update(b"\0")
        digest.update(scene.stac_item_id.encode())
        digest.update(b"\0")
        digest.update(scene.valid_mask)
        digest.update(pack_scene(scene))
    return digest.hexdigest()
