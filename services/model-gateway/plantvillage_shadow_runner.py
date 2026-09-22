from __future__ import annotations

import base64
import binascii
import json
import math
import os
from pathlib import Path
import threading
import unicodedata
import urllib.request
from typing import Any

import numpy as np
import onnxruntime as ort
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

MAX_FIELD_ID_LENGTH = 128
MAX_JOB_ID_LENGTH = 128
MAX_IMAGE_BYTES = 8_000_000
MAX_MODEL_BYTES = 64_000_000
MAX_LABEL_BYTES = 256_000
DEFAULT_MODEL_URL = (
    "https://huggingface.co/imaflower/plantvillage-mobilenetv3/resolve/main/model.onnx"
)
DEFAULT_LABELS_URL = (
    "https://huggingface.co/imaflower/plantvillage-mobilenetv3/resolve/main/class_names.json"
)
MODEL_REPOSITORY = "imaflower/plantvillage-mobilenetv3"
MODEL_LICENSE = "MIT"
TRAINING_DATASET = "PlantVillage"
CACHE_DIR = Path(os.getenv("PLANTVILLAGE_MODEL_CACHE", "/tmp/tarlapusula-models/plantvillage-mobilenetv3"))

_SESSION: ort.InferenceSession | None = None
_LABELS: list[str] | None = None
_ASSET_LOCK = threading.Lock()


class ShadowModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantVillageShadowRequest(ShadowModel):
    field_id: str = Field(min_length=1, max_length=MAX_FIELD_ID_LENGTH)
    job_id: str = Field(min_length=1, max_length=MAX_JOB_ID_LENGTH)
    crop: str | None = Field(default=None, max_length=160)
    mime_type: str = Field(default="image/jpeg", min_length=3, max_length=80)
    image_base64: str = Field(min_length=16)


def _blocked(
    payload: PlantVillageShadowRequest,
    reason: str,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "blocked": True,
        "engine": "plantvillage-onnx-shadow",
        "mode": "disease_classification_shadow",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "confidence_authority": False,
        "independent_model": True,
        "reason": reason,
        "top_predictions": [],
        "warnings": warnings or [],
    }


def _download_asset(url: str, target: Path, max_bytes: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "TarlaPusula-PlantVillage-Shadow/1.0"},
    )
    temp = target.with_suffix(target.suffix + ".part")
    total = 0
    try:
        with urllib.request.urlopen(request, timeout=35) as response, temp.open("wb") as handle:
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > max_bytes:
                raise ValueError("PlantVillage model varlığı güvenli boyut sınırını aşıyor.")
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError("PlantVillage model varlığı güvenli boyut sınırını aşıyor.")
                handle.write(chunk)
        if total <= 0:
            raise ValueError("PlantVillage model varlığı boş indirildi.")
        temp.replace(target)
    finally:
        if temp.exists():
            temp.unlink(missing_ok=True)


def _parse_labels(value: Any) -> list[str]:
    if isinstance(value, list):
        labels = [str(item).strip() for item in value]
    elif isinstance(value, dict):
        nested = value.get("class_names") or value.get("labels")
        if isinstance(nested, list):
            labels = [str(item).strip() for item in nested]
        else:
            try:
                labels = [
                    str(label).strip()
                    for _, label in sorted(
                        ((int(key), label) for key, label in value.items()),
                        key=lambda pair: pair[0],
                    )
                ]
            except (TypeError, ValueError):
                labels = []
    else:
        labels = []
    return [label for label in labels if label]


def _ensure_runtime() -> tuple[ort.InferenceSession, list[str]]:
    global _SESSION, _LABELS
    if _SESSION is not None and _LABELS:
        return _SESSION, _LABELS

    with _ASSET_LOCK:
        if _SESSION is not None and _LABELS:
            return _SESSION, _LABELS

        model_path = CACHE_DIR / "model.onnx"
        labels_path = CACHE_DIR / "class_names.json"
        model_url = os.getenv("PLANTVILLAGE_ONNX_URL", DEFAULT_MODEL_URL).strip() or DEFAULT_MODEL_URL
        labels_url = os.getenv("PLANTVILLAGE_LABELS_URL", DEFAULT_LABELS_URL).strip() or DEFAULT_LABELS_URL

        if not labels_path.exists():
            _download_asset(labels_url, labels_path, MAX_LABEL_BYTES)
        if not model_path.exists():
            _download_asset(model_url, model_path, MAX_MODEL_BYTES)

        labels = _parse_labels(json.loads(labels_path.read_text(encoding="utf-8")))
        if not labels:
            raise ValueError("PlantVillage sınıf etiketleri okunamadı.")

        session = ort.InferenceSession(
            str(model_path),
            providers=["CPUExecutionProvider"],
        )
        if not session.get_inputs() or not session.get_outputs():
            raise ValueError("PlantVillage ONNX giriş/çıkış sözleşmesi okunamadı.")

        _SESSION = session
        _LABELS = labels
        return session, labels


def _decode_image(payload: PlantVillageShadowRequest) -> Image.Image:
    estimated_bytes = (len(payload.image_base64) * 3) // 4
    if estimated_bytes > MAX_IMAGE_BYTES + 16:
        raise ValueError("PlantVillage gölge modeli için fotoğraf 8 MB sınırını aşıyor.")
    try:
        raw = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("PlantVillage fotoğraf verisi geçerli base64 değil.") from exc
    if not raw:
        raise ValueError("PlantVillage fotoğraf verisi boş.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("PlantVillage gölge modeli için fotoğraf 8 MB sınırını aşıyor.")

    from io import BytesIO

    try:
        image = Image.open(BytesIO(raw)).convert("RGB")
        image.load()
        return image
    except Exception as exc:
        raise ValueError("PlantVillage fotoğrafı RGB görüntü olarak çözemedi.") from exc


def _target_contract(session: ort.InferenceSession) -> tuple[int, int, str]:
    shape = session.get_inputs()[0].shape
    layout = "nchw"
    height = 224
    width = 224
    if len(shape) == 4:
        if shape[1] == 3:
            layout = "nchw"
            if isinstance(shape[2], int) and shape[2] > 0:
                height = shape[2]
            if isinstance(shape[3], int) and shape[3] > 0:
                width = shape[3]
        elif shape[-1] == 3:
            layout = "nhwc"
            if isinstance(shape[1], int) and shape[1] > 0:
                height = shape[1]
            if isinstance(shape[2], int) and shape[2] > 0:
                width = shape[2]
    if height > 512 or width > 512:
        raise ValueError("PlantVillage ONNX beklenmeyen görüntü boyutu istiyor.")
    return height, width, layout


def _resize_center_crop(image: Image.Image, target_h: int, target_w: int) -> Image.Image:
    resize_short = max(256, target_h, target_w)
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ValueError("PlantVillage fotoğraf boyutu geçersiz.")
    scale = resize_short / float(min(width, height))
    resized = image.resize(
        (max(target_w, round(width * scale)), max(target_h, round(height * scale))),
        Image.Resampling.BILINEAR,
    )
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def _preprocess(image: Image.Image, session: ort.InferenceSession) -> np.ndarray:
    target_h, target_w, layout = _target_contract(session)
    crop = _resize_center_crop(image, target_h, target_w)
    array = np.asarray(crop, dtype=np.float32) / 255.0
    mean = np.asarray([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
    array = (array - mean) / std
    if layout == "nchw":
        array = np.transpose(array, (2, 0, 1))
    return np.expand_dims(array, axis=0).astype(np.float32, copy=False)


def _probabilities(raw_output: np.ndarray) -> np.ndarray:
    logits = np.asarray(raw_output, dtype=np.float64).reshape(-1)
    if logits.size == 0 or not np.all(np.isfinite(logits)):
        raise ValueError("PlantVillage ONNX geçerli skor üretmedi.")
    total = float(np.sum(logits))
    if np.min(logits) >= 0 and np.max(logits) <= 1 and abs(total - 1.0) <= 0.02:
        return logits
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    denominator = float(np.sum(exp))
    if denominator <= 0 or not math.isfinite(denominator):
        raise ValueError("PlantVillage ONNX skorları normalize edilemedi.")
    return exp / denominator


def _ascii_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in folded if not unicodedata.combining(ch)).lower().strip()


CROP_ALIASES = {
    "elma": {"apple"},
    "kiraz": {"cherry"},
    "misir": {"corn", "maize"},
    "uzum": {"grape"},
    "bag": {"grape"},
    "portakal": {"orange", "citrus"},
    "turuncgil": {"orange", "citrus"},
    "seftali": {"peach"},
    "biber": {"pepper", "bell pepper"},
    "patates": {"potato"},
    "ahududu": {"raspberry"},
    "soya": {"soybean"},
    "kabak": {"squash"},
    "cilek": {"strawberry"},
    "domates": {"tomato"},
    "yaban mersini": {"blueberry"},
}


def _canonical_crop_tokens(value: str | None) -> set[str]:
    text = _ascii_text(value or "")
    if not text:
        return set()
    result = {text}
    result.update(CROP_ALIASES.get(text, set()))
    for source, aliases in CROP_ALIASES.items():
        if text in aliases:
            result.add(source)
            result.update(aliases)
    return result


def _split_label(label: str) -> tuple[str | None, str]:
    clean = label.strip()
    if "___" in clean:
        crop, issue = clean.split("___", 1)
    elif " - " in clean:
        crop, issue = clean.split(" - ", 1)
    else:
        pieces = clean.split("_", 1)
        crop, issue = (pieces[0], pieces[1]) if len(pieces) == 2 else ("", clean)
    crop = crop.replace("_", " ").replace("(including sour)", "").strip(" ,")
    issue = issue.replace("_", " ").strip()
    return (crop or None), issue


def _crop_matches(requested_crop: str | None, predicted_crop: str | None) -> bool | None:
    requested = _canonical_crop_tokens(requested_crop)
    if not requested:
        return None
    predicted = _canonical_crop_tokens(predicted_crop)
    if not predicted:
        return False
    return bool(requested & predicted)


def run_plantvillage_shadow(payload: PlantVillageShadowRequest) -> dict[str, Any]:
    image = _decode_image(payload)
    try:
        session, labels = _ensure_runtime()
    except Exception as exc:
        return _blocked(
            payload,
            "shadow_model_assets_unavailable",
            [f"PlantVillage gölge modeli yüklenemedi: {exc}"],
        )

    tensor = _preprocess(image, session)
    input_info = session.get_inputs()[0]
    try:
        output = session.run(None, {input_info.name: tensor})[0]
    except Exception as exc:
        return _blocked(
            payload,
            "shadow_inference_failed",
            [f"PlantVillage ONNX gölge çıkarımı tamamlanamadı: {exc}"],
        )

    probabilities = _probabilities(output)
    if probabilities.size != len(labels):
        return _blocked(
            payload,
            "shadow_label_count_mismatch",
            [
                f"ONNX {probabilities.size} skor üretti fakat etiket dosyasında {len(labels)} sınıf var; sonuç kullanılmadı."
            ],
        )

    top_indexes = np.argsort(probabilities)[::-1][: min(5, probabilities.size)]
    top_predictions: list[dict[str, Any]] = []
    for index in top_indexes:
        label = labels[int(index)]
        predicted_crop, issue = _split_label(label)
        top_predictions.append(
            {
                "rank": len(top_predictions) + 1,
                "label": label,
                "crop": predicted_crop,
                "issue": issue,
                "score": round(float(probabilities[int(index)]), 6),
                "crop_match": _crop_matches(payload.crop, predicted_crop),
            }
        )

    crop_known = bool(_canonical_crop_tokens(payload.crop))
    crop_matched = any(item["crop_match"] is True for item in top_predictions)
    top_score = float(top_predictions[0]["score"]) if top_predictions else 0.0
    usable_for_harmonization = bool(top_predictions) and (not crop_known or crop_matched)

    warnings = [
        "Bu bağımsız PlantVillage modeli gölge kanıttır; Pusula AI teşhisini veya güven puanını tek başına yükseltmez.",
        "Model kontrollü/laboratuvar benzeri PlantVillage yaprak görüntülerinde eğitildi; gerçek saha fotoğraflarında alan kayması beklenir.",
        "score değeri kapalı sınıf model olasılığıdır; tarla teşhis güveni değildir.",
        "Kimyasal ürün, aktif madde veya doz kararı bu model çıktısından üretilemez.",
    ]
    if crop_known and not crop_matched:
        warnings.append(
            "Modelin ilk beş sınıfında kayıtlı tarla ürünüyle uyumlu sınıf bulunmadı; sınıflandırma harmonizasyonda kullanılmamalıdır."
        )
    if top_score < 0.55:
        warnings.append(
            "En yüksek kapalı-sınıf skor düşük; sonuç yalnız zayıf yardımcı kanıt olarak tutulmalıdır."
        )

    return {
        "ok": True,
        "blocked": False,
        "engine": "plantvillage-onnx-shadow",
        "mode": "disease_classification_shadow",
        "field_id": payload.field_id,
        "job_id": payload.job_id,
        "production_authority": False,
        "diagnostic_authority": False,
        "confidence_authority": False,
        "independent_model": True,
        "usable_for_harmonization": usable_for_harmonization,
        "crop_guard": {
            "requested_crop": payload.crop,
            "known_crop": crop_known,
            "matched_in_top_k": crop_matched if crop_known else None,
        },
        "model": {
            "repository": MODEL_REPOSITORY,
            "license": MODEL_LICENSE,
            "training_dataset": TRAINING_DATASET,
            "runtime": "onnxruntime-cpu",
            "input_name": input_info.name,
            "input_shape": [str(item) for item in input_info.shape],
            "class_count": len(labels),
            "source_revision": "main",
        },
        "score_semantics": "closed_set_model_probability_not_field_diagnostic_confidence",
        "top_predictions": top_predictions,
        "warnings": warnings,
    }
