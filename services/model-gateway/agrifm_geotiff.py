from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Mapping

from agrifm_cube import BANDS, HEIGHT, WIDTH, SceneTensor

SCL_REJECTED = frozenset({0, 1, 3, 8, 9, 10, 11})
MAX_SOURCE_BYTES_PER_ASSET = 8 * 1024 * 1024


@dataclass(frozen=True)
class GeoTiffSceneSource:
    acquired_at: str
    stac_item_id: str
    assets: Mapping[str, bytes]


def _load_rasterio():
    try:
        import rasterio
        from rasterio.io import MemoryFile
        from rasterio.enums import Resampling
    except ImportError as exc:
        raise RuntimeError("agrifm_rasterio_unavailable") from exc
    return rasterio, MemoryFile, Resampling


def _read_single_band(payload: bytes, *, categorical: bool) -> tuple[list[float], object]:
    if not payload or len(payload) > MAX_SOURCE_BYTES_PER_ASSET:
        raise ValueError("agrifm_geotiff_asset_size_invalid")
    _, MemoryFile, Resampling = _load_rasterio()
    with MemoryFile(payload) as mem:
        with mem.open() as dataset:
            if dataset.count != 1:
                raise ValueError("agrifm_geotiff_single_band_required")
            if dataset.crs is None or dataset.transform is None:
                raise ValueError("agrifm_geotiff_georeference_required")
            method = Resampling.nearest if categorical else Resampling.bilinear
            values = dataset.read(1, out_shape=(HEIGHT, WIDTH), resampling=method, masked=True)
            if values.shape != (HEIGHT, WIDTH):
                raise ValueError("agrifm_geotiff_decode_shape_mismatch")
            return values, (dataset.crs.to_string(), tuple(dataset.bounds))


def decode_scene(source: GeoTiffSceneSource) -> SceneTensor:
    required = set(BANDS) | {"SCL"}
    if set(source.assets) != required:
        raise ValueError("agrifm_geotiff_asset_set_mismatch")

    scl, grid = _read_single_band(source.assets["SCL"], categorical=True)
    band_arrays = []
    for band in BANDS:
        values, band_grid = _read_single_band(source.assets[band], categorical=False)
        if band_grid != grid:
            raise ValueError("agrifm_geotiff_grid_mismatch")
        band_arrays.append(values)

    valid_mask = bytearray(WIDTH * HEIGHT)
    reflectance: list[float] = []
    for y in range(HEIGHT):
        for x in range(WIDTH):
            scl_value = scl[y, x]
            valid = not bool(getattr(scl_value, "mask", False)) and int(scl_value) not in SCL_REJECTED
            pixel_values: list[float] = []
            for values in band_arrays:
                raw = values[y, x]
                if bool(getattr(raw, "mask", False)):
                    valid = False
                    pixel_values.append(0.0)
                else:
                    # Sentinel-2 L2A surface reflectance assets are integer-scaled by 10000.
                    pixel_values.append(float(raw) / 10000.0)
            valid_mask[y * WIDTH + x] = 1 if valid else 0
            reflectance.extend(pixel_values)

    return SceneTensor(
        acquired_at=source.acquired_at,
        stac_item_id=source.stac_item_id,
        reflectance=tuple(reflectance),
        valid_mask=bytes(valid_mask),
    )
