from pathlib import Path


def test_agrifm_geotiff_decoder_contract_is_fail_closed():
    root = Path(__file__).resolve().parents[2]
    source = (root / "services/model-gateway/agrifm_geotiff.py").read_text(encoding="utf-8")
    for token in [
        "agrifm_geotiff_asset_size_invalid",
        "agrifm_geotiff_single_band_required",
        "agrifm_geotiff_georeference_required",
        "agrifm_geotiff_grid_mismatch",
        "agrifm_geotiff_asset_set_mismatch",
        "Resampling.nearest if categorical else Resampling.bilinear",
        "float(raw) / 10000.0",
        "SCL_REJECTED = frozenset({0, 1, 3, 8, 9, 10, 11})",
    ]:
        assert token in source


def test_agrifm_geotiff_runtime_dependency_is_declared():
    root = Path(__file__).resolve().parents[2]
    requirements = (root / "services/model-gateway/requirements.txt").read_text(encoding="utf-8")
    assert "rasterio>=1.4,<2" in requirements
