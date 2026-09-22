from __future__ import annotations

import base64
import binascii
from typing import Any

import cv2
import numpy as np
from plantcv import plantcv as pcv
from pydantic import BaseModel, ConfigDict, Field


MAX_FIELD_ID_LENGTH = 128
MAX_JOB_ID_LENGTH = 128
MAX_IMAGE_BYTES = 8_000_000
MAX_IMAGE_SIDE = 1600
MIN_COMPONENT_FRACTION = 0.01
MAX_COMPONENT_FRACTION = 0.85


class PlantCVModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantCVPhotoEvidenceRequest(PlantCVModel):
    field_id: str = Field(min_length=1, max_length=MAX_FIELD_ID_LENGTH)
    job_id: str = Field(min_length=1, max_length=MAX_JOB_ID_LENGTH)
    mime_type: str = Field(default="image/jpeg", min_length=3, max_length=80)
    image_base64: str = Field(min_length=16)


def _blocked(payload: PlantCVPhotoEvidenceRequest, reason: str, warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "blocked": True,
        "engine": "plantcv",
        "mode": "photo_evidence",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "reason": reason,
        "warnings": warnings or [],
        "evidence": [],
    }


def _decode_image(payload: PlantCVPhotoEvidenceRequest) -> np.ndarray:
    estimated_bytes = (len(payload.image_base64) * 3) // 4
    if estimated_bytes > MAX_IMAGE_BYTES + 16:
        raise ValueError("PlantCV için fotoğraf 8 MB sınırını aşıyor.")

    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("PlantCV fotoğraf verisi geçerli base64 değil.") from exc

    if not raw:
        raise ValueError("PlantCV fotoğraf verisi boş.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("PlantCV için fotoğraf 8 MB sınırını aşıyor.")

    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("PlantCV fotoğrafı JPEG/PNG/WebP RGB görüntü olarak çözemedi.")

    height, width = image.shape[:2]
    longest = max(height, width)
    if longest > MAX_IMAGE_SIDE:
        scale = MAX_IMAGE_SIDE / float(longest)
        image = cv2.resize(
            image,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        )

    return image


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    if contours:
        cv2.drawContours(filled, contours, -1, 255, thickness=cv2.FILLED)
    return filled


def _segment_plant_like_object(bgr: np.ndarray) -> tuple[np.ndarray | None, dict[str, Any]]:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    h, s, v = cv2.split(hsv)
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    exg = 2 * g - r - b

    green = (h >= 25) & (h <= 100) & (s >= 35) & (v >= 25)
    yellow = (h >= 15) & (h < 35) & (s >= 45) & (v >= 35)
    vegetation_signal = exg >= 18
    saturated_foreground = (s >= 45) & (v >= 25) & (v <= 250)

    raw = (green | yellow | vegetation_signal) & (saturated_foreground | vegetation_signal)
    mask = (raw.astype(np.uint8) * 255)

    short_side = min(mask.shape[:2])
    close_size = max(5, int(round(short_side * 0.012)))
    if close_size % 2 == 0:
        close_size += 1
    close_size = min(close_size, 21)

    open_size = max(3, int(round(short_side * 0.004)))
    if open_size % 2 == 0:
        open_size += 1
    open_size = min(open_size, 9)

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size)),
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_size, open_size)),
    )
    mask = _fill_holes(mask)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 1:
        return None, {
            "quality": "blocked",
            "reason": "plant_like_component_not_found",
        }

    component_ids = range(1, count)
    selected_id = max(component_ids, key=lambda idx: int(stats[idx, cv2.CC_STAT_AREA]))
    selected_area = int(stats[selected_id, cv2.CC_STAT_AREA])
    total_pixels = int(mask.shape[0] * mask.shape[1])
    coverage = selected_area / float(total_pixels)

    selected = np.where(labels == selected_id, 255, 0).astype(np.uint8)

    ys, xs = np.where(selected > 0)
    touches_border = bool(
        xs.size
        and (
            xs.min() <= 1
            or ys.min() <= 1
            or xs.max() >= selected.shape[1] - 2
            or ys.max() >= selected.shape[0] - 2
        )
    )

    component_fraction_of_candidate = selected_area / max(1, int(np.count_nonzero(mask)))

    if coverage < MIN_COMPONENT_FRACTION:
        return None, {
            "quality": "blocked",
            "reason": "plant_like_component_too_small",
            "mask_fraction": round(coverage, 4),
        }

    if coverage > MAX_COMPONENT_FRACTION:
        return None, {
            "quality": "blocked",
            "reason": "scene_too_full_for_reliable_object_phenotyping",
            "mask_fraction": round(coverage, 4),
        }

    quality = "high"
    if touches_border or component_fraction_of_candidate < 0.55:
        quality = "medium"
    if touches_border and component_fraction_of_candidate < 0.45:
        quality = "low"

    return selected, {
        "quality": quality,
        "mask_fraction": round(coverage, 4),
        "candidate_dominance": round(component_fraction_of_candidate, 4),
        "touches_frame": touches_border,
        "segmentation_method": "hsv_excess_green_largest_component_v1",
    }


def _observation_value(sample: dict[str, Any], name: str) -> Any:
    entry = sample.get(name)
    if not isinstance(entry, dict):
        return None
    value = entry.get("value")
    if isinstance(value, np.generic):
        return value.item()
    return value


def _finite_number(value: Any, digits: int = 4) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(number):
        return None
    return round(number, digits)


def _color_proxies(rgb: np.ndarray, mask: np.ndarray) -> dict[str, float | None]:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, s, v = cv2.split(hsv)
    selected = mask > 0
    count = int(np.count_nonzero(selected))
    if count <= 0:
        return {
            "green_like_fraction": None,
            "yellow_like_fraction": None,
            "brown_dark_like_fraction": None,
        }

    green = selected & (h >= 25) & (h <= 100) & (s >= 35) & (v >= 25)
    yellow = selected & (h >= 15) & (h < 35) & (s >= 45) & (v >= 45)
    brown_dark = selected & (h >= 4) & (h < 24) & (s >= 45) & (v >= 20) & (v <= 175)

    return {
        "green_like_fraction": round(float(np.count_nonzero(green)) / count, 4),
        "yellow_like_fraction": round(float(np.count_nonzero(yellow)) / count, 4),
        "brown_dark_like_fraction": round(float(np.count_nonzero(brown_dark)) / count, 4),
    }


def run_plantcv_photo_evidence(payload: PlantCVPhotoEvidenceRequest) -> dict[str, Any]:
    bgr = _decode_image(payload)
    mask, segmentation = _segment_plant_like_object(bgr)

    if mask is None:
        return _blocked(
            payload,
            str(segmentation.get("reason") or "plant_segmentation_unreliable"),
            [
                "PlantCV sayısal fenotipleme için güvenilir tek bitki/yaprak bölgesi ayıramadı.",
                "Bu sonuç fotoğrafta sorun olmadığı anlamına gelmez; yalnız ölçüm üretmek için maske kalitesi yetersizdir.",
            ],
        ) | {"segmentation": segmentation}

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    labels = np.zeros(mask.shape, dtype=np.int32)
    labels[mask > 0] = 1

    pcv.outputs.clear()
    pcv.params.debug = None
    pcv.params.sample_label = "plantcv"

    try:
        pcv.analyze.size(img=rgb, labeled_mask=labels, n_labels=1, label="plantcv")
        pcv.analyze.color(
            rgb_img=rgb,
            labeled_mask=labels,
            n_labels=1,
            colorspaces="hsv",
            label="plantcv",
        )
    except Exception as exc:
        return _blocked(
            payload,
            "plantcv_analysis_failed",
            [f"PlantCV sayısal analiz adımı tamamlanamadı: {exc}"],
        ) | {"segmentation": segmentation}

    observations = pcv.outputs.observations
    sample_key = next(
        (key for key in observations if key.startswith("plantcv")),
        next(iter(observations), None),
    )
    sample = observations.get(sample_key, {}) if sample_key else {}

    shape = {
        "area_px": _finite_number(_observation_value(sample, "area"), 1),
        "convex_hull_area_px": _finite_number(_observation_value(sample, "convex_hull_area"), 1),
        "solidity": _finite_number(_observation_value(sample, "solidity"), 4),
        "perimeter_px": _finite_number(_observation_value(sample, "perimeter"), 2),
        "width_px": _finite_number(_observation_value(sample, "width"), 2),
        "height_px": _finite_number(_observation_value(sample, "height"), 2),
        "longest_path_px": _finite_number(_observation_value(sample, "longest_path"), 2),
        "object_in_frame": _observation_value(sample, "object_in_frame"),
    }

    color = {
        "hue_circular_mean": _finite_number(_observation_value(sample, "hue_circular_mean"), 3),
        "hue_circular_std": _finite_number(_observation_value(sample, "hue_circular_std"), 3),
        "hue_median": _finite_number(_observation_value(sample, "hue_median"), 3),
        "saturation_mean": _finite_number(_observation_value(sample, "saturation_mean"), 3),
        "saturation_median": _finite_number(_observation_value(sample, "saturation_median"), 3),
        "value_mean": _finite_number(_observation_value(sample, "value_mean"), 3),
        "value_median": _finite_number(_observation_value(sample, "value_median"), 3),
    }

    warnings = [
        "PlantCV ölçümleri görüntü pikseli ve renk dağılımıdır; hastalık veya zararlı teşhisi değildir.",
        "Saha fotoğrafında arka plan, ışık, gölge ve kamera beyaz dengesi renk oranlarını etkileyebilir.",
        "Gerçek mm/mm² ölçümü için fotoğrafta kalibre edilmiş ölçek işareti gerekir; bu nedenle boyutlar piksel birimindedir.",
    ]
    if segmentation.get("quality") in {"medium", "low"}:
        warnings.append("Bitki/yaprak maskesi tam güvenilir görünmediği için fenotip metrikleri yardımcı kanıt olarak kullanılmalıdır.")

    return {
        "ok": True,
        "blocked": False,
        "engine": "plantcv",
        "mode": "photo_evidence",
        "engine_version": getattr(pcv, "__version__", None),
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "mime_type": payload.mime_type,
        "production_authority": False,
        "diagnostic_authority": False,
        "segmentation": segmentation,
        "shape": shape,
        "color": color,
        "heuristic_color_proxies": _color_proxies(rgb, mask),
        "evidence": [
            "PlantCV analyze.size ile nesne boyut/şekil özellikleri çıkarıldı.",
            "PlantCV analyze.color ile HSV renk dağılımı özetlendi.",
            "TarlaPusula renk oranları yalnız görsel değişim kanıtıdır; lezyon veya hastalık sınıfı değildir.",
        ],
        "warnings": warnings,
    }
