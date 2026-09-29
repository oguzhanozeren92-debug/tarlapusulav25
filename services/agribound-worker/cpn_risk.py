from __future__ import annotations

import json
import math
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

CPN_COMMIT = "0dd48738bbfa4b5d8e4f5bc3eb02ee2529f87630"
RISK_LABEL = {"low": "Düşük", "moderate": "Orta", "high": "Yüksek", "critical": "Kritik"}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CpnRiskRequest(StrictModel):
    field_id: str = Field(min_length=1, max_length=160)
    app_date: str | None = None


def _url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def _anon() -> str:
    return os.getenv("SUPABASE_ANON_KEY", "").strip()


def _request_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, body: Any = None, timeout: int = 25) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _verify(authorization: str | None) -> dict[str, Any]:
    auth = (authorization or "").strip()
    if not _url() or not _anon():
        raise HTTPException(status_code=503, detail="Supabase auth verifier is not configured")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Valid Supabase user session required")
    try:
        user = _request_json(
            f"{_url()}/auth/v1/user",
            headers={"Authorization": auth, "apikey": _anon(), "Accept": "application/json"},
            timeout=12,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Supabase user session rejected") from exc
    if not str(user.get("id") or "").strip():
        raise HTTPException(status_code=401, detail="Supabase user session has no user id")
    return user


def _rest(path: str, auth: str) -> Any:
    return _request_json(
        f"{_url()}/rest/v1/{path}",
        headers={"Authorization": auth, "apikey": _anon(), "Accept": "application/json"},
        timeout=15,
    )


def _field_and_season(field_id: str, uid: str, auth: str, app_date: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    field_select = urllib.parse.quote(
        "id,user_id,name,crop,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng,city,district,village",
        safe=",",
    )
    fields = _rest(
        f"fields?id=eq.{urllib.parse.quote(field_id)}&user_id=eq.{urllib.parse.quote(uid)}&select={field_select}&limit=1",
        auth,
    )
    if not fields:
        raise HTTPException(status_code=404, detail="Tarla bulunamadı veya kullanıcıya ait değil")

    season_select = urllib.parse.quote(
        "id,year,crop,variety_name,planting_date,harvest_date,created_at",
        safe=",",
    )
    seasons = _rest(
        f"field_seasons?field_id=eq.{urllib.parse.quote(field_id)}&user_id=eq.{urllib.parse.quote(uid)}&select={season_select}&order=year.desc,created_at.desc&limit=5",
        auth,
    )
    year = int(app_date[:4])
    season = (
        next((row for row in seasons if int(row.get("year") or 0) == year), None)
        or next((row for row in seasons if not row.get("harvest_date")), None)
        or (seasons[0] if seasons else None)
    )
    return fields[0], season


def _coords(field: dict[str, Any]) -> tuple[float, float] | None:
    try:
        lat = float(field.get("parcel_centroid_lat") if field.get("parcel_centroid_lat") is not None else field.get("latitude"))
        lon = float(field.get("parcel_centroid_lng") if field.get("parcel_centroid_lng") is not None else field.get("longitude"))
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
    except Exception:
        pass
    return None


def _crop(value: Any) -> str | None:
    text = (
        str(value or "").strip().lower()
        .replace("ı", "i").replace("ğ", "g").replace("ü", "u")
        .replace("ş", "s").replace("ö", "o").replace("ç", "c")
    )
    if "bugday" in text or text == "wheat":
        return "wheat"
    if "misir" in text or "corn" in text or "maize" in text:
        return "corn"
    if any(token in text for token in ("patates", "potato", "domates", "tomato", "biber", "pepper", "patlican", "eggplant")):
        return "solanaceae"
    return None


def _phenology(field_id: str, auth: str, app_date: str) -> dict[str, Any] | None:
    try:
        return _request_json(
            f"{_url()}/functions/v1/field-phenology-context",
            method="POST",
            headers={"Authorization": auth, "apikey": _anon(), "Content-Type": "application/json"},
            body={"field_id": field_id, "current_date": app_date},
            timeout=30,
        )
    except Exception:
        return None


def _gate(crop: str, phenology: dict[str, Any] | None) -> dict[str, Any]:
    stage = str(((phenology or {}).get("phenology_stage") or {}).get("stage") or "").lower()
    if not stage:
        return {"active": False, "status": "needs_confirmation", "stage": None, "note": "Doğrulanmış fenoloji evresi yok."}
    if stage == "post_harvest":
        return {"active": False, "status": "out_of_window", "stage": stage, "note": "Sezon hasat sonrası durumda."}
    if crop == "wheat":
        return {
            "active": stage == "reproductive",
            "status": "active" if stage == "reproductive" else "out_of_window",
            "stage": stage,
            "note": "Buğday FHB modeli çiçeklenme/generatif dönemde anlamlıdır.",
        }
    if crop == "corn":
        if stage == "reproductive":
            return {"active": True, "status": "active", "stage": stage, "note": "Mısır için hassas V10–R3 penceresiyle uyumlu geç dönem sinyali var."}
        return {"active": False, "status": "needs_confirmation", "stage": stage, "note": "CPN mısır modelleri V10–R3 penceresi ister; mevcut kaba fenoloji V10'u doğrulamıyor."}
    active = stage in {"vegetative", "reproductive", "maturation"}
    return {
        "active": active,
        "status": "active" if active else "needs_confirmation",
        "stage": stage,
        "note": "Solanaceae modeli çıkış sonrası aktif gelişim döneminde kullanılır.",
    }


def _weather_url(base: str, lat: float, lon: float, **params: str) -> str:
    query = {
        "latitude": str(lat),
        "longitude": str(lon),
        "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation",
        "timezone": "auto",
        **params,
    }
    return base + "?" + urllib.parse.urlencode(query)


def _parse_hourly(payload: dict[str, Any]) -> list[dict[str, Any]]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    output: list[dict[str, Any]] = []
    for index, timestamp in enumerate(times):
        try:
            output.append({
                "time": str(timestamp),
                "t": float(hourly["temperature_2m"][index]),
                "rh": float(hourly["relative_humidity_2m"][index]),
                "dp": float(hourly["dew_point_2m"][index]),
                "rain": float(hourly["precipitation"][index]),
            })
        except Exception:
            continue
    return output


def _fetch_weather(lat: float, lon: float, planting: str | None, crop: str) -> tuple[list[dict[str, Any]], bool]:
    recent = _parse_hourly(
        _request_json(
            _weather_url(
                "https://api.open-meteo.com/v1/forecast",
                lat,
                lon,
                past_days="35",
                forecast_days="7",
            ),
            timeout=30,
        )
    )
    complete = True
    if crop == "solanaceae":
        if not planting:
            complete = False
        else:
            recent_first = recent[0]["time"][:10] if recent else date.today().isoformat()
            end = (datetime.fromisoformat(recent_first) - timedelta(days=1)).date().isoformat()
            if planting < recent_first:
                span = (date.fromisoformat(end) - date.fromisoformat(planting)).days
                if span > 240:
                    complete = False
                else:
                    try:
                        older = _parse_hourly(
                            _request_json(
                                _weather_url(
                                    "https://archive-api.open-meteo.com/v1/archive",
                                    lat,
                                    lon,
                                    start_date=planting,
                                    end_date=end,
                                ),
                                timeout=35,
                            )
                        )
                        by_time = {row["time"]: row for row in older + recent}
                        recent = [by_time[key] for key in sorted(by_time)]
                    except Exception:
                        complete = False
    return recent, complete


def _daily(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        groups.setdefault(row["time"][:10], []).append(row)
    output = []
    for day in sorted(groups):
        rows_day = groups[day]
        temps = [row["t"] for row in rows_day]
        humidity = [row["rh"] for row in rows_day]
        dew_points = [row["dp"] for row in rows_day]
        rh90 = [row for row in rows_day if row["rh"] >= 90]
        rh90_night = [
            row for row in rh90
            if int(row["time"][11:13]) >= 20 or int(row["time"][11:13]) <= 6
        ]
        output.append({
            "date": day,
            "tmean": sum(temps) / len(temps),
            "tmin": min(temps),
            "tmax": max(temps),
            "rhmean": sum(humidity) / len(humidity),
            "rhmax": max(humidity),
            "dpmin": min(dew_points),
            "rh90": len(rh90),
            "rh90night": len(rh90_night),
            "trh90": sum(row["t"] for row in rh90) / len(rh90) if rh90 else None,
        })
    return output


def _roll(days: list[dict[str, Any]], index: int, width: int, key: str) -> float:
    values = [
        float(row[key])
        for row in days[max(0, index - width + 1): index + 1]
        if row.get(key) is not None
    ]
    return sum(values) / len(values) if values else 0.0


def _level_probability(probability: float, low: float, medium: float, high: float) -> str:
    percent = probability * 100
    if percent >= high:
        return "critical"
    if percent >= medium:
        return "high"
    if percent >= low:
        return "moderate"
    return "low"


def _severity_level(severity: int) -> str:
    return "critical" if severity >= 4 else "high" if severity >= 3 else "moderate" if severity >= 2 else "low"


def _threat(
    name: str,
    common: str,
    scientific: str,
    model: str,
    timeline: list[dict[str, Any]],
    today: int,
    gate: dict[str, Any],
    *,
    action: str,
    missing: list[str] | None = None,
    blocking: bool = True,
) -> dict[str, Any]:
    missing = missing or []
    eligible = bool(gate["active"] and (not missing or not blocking))
    current = timeline[today] if timeline else {"score": 0, "level": "low", "date": None, "metrics": {}}
    future = timeline[today:today + 7] or [current]
    peak = max(future, key=lambda row: row["score"])
    current_level = current["level"] if eligible else "low"
    peak_level = peak["level"] if eligible else "low"
    return {
        "scientificName": scientific,
        "commonName": common,
        "displayName": name,
        "threatType": "fungus",
        "model": model,
        "score": round(current["score"], 1) if eligible else 0,
        "level": current_level,
        "levelLabel": RISK_LABEL[current_level],
        "peakScore7d": round(peak["score"], 1) if eligible else 0,
        "peakLevel7d": peak_level,
        "peakLevelLabel7d": RISK_LABEL[peak_level],
        "peakDate": peak.get("date"),
        "trend": "stable",
        "reasons": [gate["note"]],
        "metrics": current.get("metrics"),
        "timeline7d": [
            {"date": row["date"], "score": round(row["score"], 1), "level": row["level"], "levelLabel": RISK_LABEL[row["level"]]}
            for row in future
        ] if eligible else [],
        "action": action if eligible else "Fenoloji/eksik girdi doğrulanmadan bu modelden saha müdahalesi çıkarılmaz.",
        "productionEligible": eligible,
        "phenologyStatus": gate["status"],
        "missingInputs": missing,
        "provenance": {
            "upstream": "bzbradford/cpn-crop-risk-tool",
            "license": "MIT",
            "commit": CPN_COMMIT,
            "riskIsNotDiagnosis": True,
            "noAutomaticPesticidePrescription": True,
        },
    }


def _wheat(days: list[dict[str, Any]], today: int, gate: dict[str, Any]) -> dict[str, Any]:
    resistance = [("vs", 0.0), ("s", -0.82795556), ("ms", -1.4812696), ("mr", -1.8484537)]
    timeline = []
    for index, day in enumerate(days):
        rh14 = _roll(days, index, 14, "rhmean")
        probabilities = [1 / (1 + math.exp(-(-3.6432643 + constant + 0.051459669 * rh14))) for _, constant in resistance]
        probability = max(probabilities)
        timeline.append({
            "date": day["date"],
            "score": probability * 100,
            "level": _level_probability(probability, 1, 24, 32),
            "metrics": {
                "relativeHumidityMean14dPercent": round(rh14, 1),
                "probabilityRangePercent": [round(min(probabilities) * 100, 1), round(max(probabilities) * 100, 1)],
                "resistanceScenarios": [
                    {"id": item[0], "probabilityPercent": round(probability_value * 100, 1)}
                    for item, probability_value in zip(resistance, probabilities)
                ],
            },
        })
    return _threat(
        "Buğday başak yanıklığı (FHB)",
        "Fusarium head blight",
        "Fusarium graminearum",
        "CPN Wheat Scab FHB probability model",
        timeline,
        today,
        gate,
        action="Çiçeklenmede başakları hedefli kontrol et ve fotoğrafla doğrula; bu skor ilaçlama talimatı değildir.",
        missing=["cultivar_resistance_class"],
        blocking=False,
    )


def _tarspot(days: list[dict[str, Any]], today: int, gate: dict[str, Any]) -> dict[str, Any]:
    timeline = []
    for index, day in enumerate(days):
        t30 = _roll(days, index, 30, "tmean")
        rh30 = _roll(days, index, 30, "rhmax")
        night14 = _roll(days, index, 14, "rh90night")
        tmin21 = _roll(days, index, 21, "tmin")
        mu1 = 32.06987 - 0.89471 * t30 - 0.14373 * rh30
        mu2 = 20.35950 - 0.91093 * t30 - 0.29240 * night14
        probability = (1 / (1 + math.exp(-mu1)) + 1 / (1 + math.exp(-mu2))) / 2
        probability = probability if tmin21 > 10 else probability * tmin21 / 10 if tmin21 > 0 else 0
        timeline.append({
            "date": day["date"],
            "score": probability * 100,
            "level": _level_probability(probability, 1, 20, 35),
            "metrics": {
                "probabilityPercent": round(probability * 100, 1),
                "temperatureMean30dC": round(t30, 1),
                "relativeHumidityMax30dPercent": round(rh30, 1),
                "rh90NightHours14d": round(night14, 1),
            },
        })
    return _threat(
        "Mısır katran lekesi",
        "Tar spot",
        "Phyllachora maydis",
        "CPN Tar Spot probability model",
        timeline,
        today,
        gate,
        action="Yapraklarda siyah kabarık lekeleri kontrol et ve fotoğrafla doğrula.",
    )


def _gls(days: list[dict[str, Any]], today: int, gate: dict[str, Any]) -> dict[str, Any]:
    timeline = []
    for index, day in enumerate(days):
        tmin21 = _roll(days, index, 21, "tmin")
        dew30 = _roll(days, index, 30, "dpmin")
        probability = 1 / (1 + math.exp(-(-2.9467 - 0.03729 * tmin21 + 0.6534 * dew30)))
        timeline.append({
            "date": day["date"],
            "score": probability * 100,
            "level": _level_probability(probability, 1, 40, 60),
            "metrics": {
                "probabilityPercent": round(probability * 100, 1),
                "temperatureMin21dC": round(tmin21, 1),
                "dewPointMin30dC": round(dew30, 1),
            },
        })
    return _threat(
        "Mısır gri yaprak lekesi",
        "Gray leaf spot",
        "Cercospora zeae-maydis",
        "CPN Gray Leaf Spot probability model",
        timeline,
        today,
        gate,
        action="Damarlarla sınırlı gri-kahverengi lezyonları kontrol et ve fotoğrafla doğrula.",
    )


def _pday(temperature: float) -> float:
    if temperature < 7 or temperature > 30:
        return 0
    if temperature <= 21:
        return 10 * (1 - ((temperature - 21) ** 2 / 196))
    return 10 * (1 - ((temperature - 21) ** 2 / 81))


def _early(days: list[dict[str, Any]], today: int, gate: dict[str, Any], complete: bool) -> dict[str, Any]:
    total = 0.0
    values: list[float] = []
    timeline = []
    for day in days:
        value = (
            5 * _pday(day["tmin"])
            + 8 * _pday((2 * day["tmin"] + day["tmax"]) / 3)
            + 8 * _pday((2 * day["tmax"] + day["tmin"]) / 3)
            + 3 * _pday(day["tmin"])
        ) / 24
        values.append(value)
        total += value
        avg7 = sum(values[-7:]) / len(values[-7:])
        severity = (
            int(avg7 >= 1) + int(avg7 >= 3) + int(avg7 >= 5) + int(avg7 >= 9)
            if total >= 400
            else int(total >= 200) + int(total >= 250) + int(total >= 300) + int(total >= 350)
        )
        timeline.append({
            "date": day["date"],
            "score": severity * 25,
            "level": _severity_level(severity),
            "metrics": {
                "severity": severity,
                "physiologicalDaysTotal": round(total, 1),
                "physiologicalDays7dMean": round(avg7, 2),
            },
        })
    return _threat(
        "Erken yanıklık",
        "Early blight",
        "Alternaria solani",
        "CPN Early Blight physiological-day model",
        timeline,
        today,
        gate,
        action="Alt yapraklarda hedef tahtası görünümlü lekeleri kontrol et ve fotoğrafla doğrula.",
        missing=[] if complete else ["planting_date_or_complete_season_history"],
    )


def _dsv(temperature: float | None, hours: int) -> int:
    if temperature is None or temperature < 7.2:
        return 0
    if temperature <= 11.6:
        return int(hours > 21) + int(hours > 18) + int(hours > 15)
    if temperature <= 15:
        return int(hours > 21) + int(hours > 18) + int(hours > 15) + int(hours > 12)
    if temperature <= 26.6:
        return int(hours > 18) + int(hours > 15) + int(hours > 12) + int(hours > 9)
    return 0


def _late(days: list[dict[str, Any]], today: int, gate: dict[str, Any], complete: bool) -> dict[str, Any]:
    total = 0
    values: list[int] = []
    timeline = []
    for day in days:
        value = _dsv(day["trh90"], day["rh90"])
        values.append(value)
        total += value
        total14 = sum(values[-14:])
        severity = 4 if total14 >= 21 and total >= 30 else 3 if total14 >= 14 and total >= 18 else 2 if total >= 18 else 1 if total14 >= 1 else 0
        timeline.append({
            "date": day["date"],
            "score": severity * 25,
            "level": _severity_level(severity),
            "metrics": {
                "severity": severity,
                "dsvDaily": value,
                "dsv14d": total14,
                "dsvSeasonTotal": total,
                "hoursRh90": day["rh90"],
                "temperatureMeanRh90C": None if day["trh90"] is None else round(day["trh90"], 1),
            },
        })
    return _threat(
        "Geç yanıklık / mildiyö",
        "Late blight",
        "Phytophthora infestans",
        "CPN Late Blight DSV model",
        timeline,
        today,
        gate,
        action="Su emmiş/koyu lezyonları saha kontrolüyle doğrula; DSV tek başına pestisit reçetesi değildir.",
        missing=[] if complete else ["planting_date_or_complete_season_history"],
    )


def register_cpn_routes(app: Any) -> None:
    @app.post("/cpn-risk")
    def cpn_risk(payload: CpnRiskRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = _verify(authorization)
        auth = (authorization or "").strip()
        app_date = payload.app_date if payload.app_date and len(payload.app_date) == 10 else date.today().isoformat()
        field, season = _field_and_season(payload.field_id, str(user["id"]), auth, app_date)
        crop = _crop((season or {}).get("crop") or field.get("crop"))
        if not crop:
            return {
                "ok": True,
                "supported": False,
                "reason": "Bu ürün için CPN yıllık ürün modeli yok.",
                "threats": [],
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }

        coordinates = _coords(field)
        if not coordinates:
            raise HTTPException(status_code=422, detail="Tarla koordinatı gerekli")

        planting = str((season or {}).get("planting_date") or "") or None
        rows, history_complete = _fetch_weather(coordinates[0], coordinates[1], planting, crop)
        days = _daily(rows)
        if not days:
            raise HTTPException(status_code=502, detail="Saatlik hava verisi bulunamadı")

        today_index = next((index for index, row in enumerate(days) if row["date"] >= app_date), len(days) - 1)
        gate = _gate(crop, _phenology(payload.field_id, auth, app_date))

        if crop == "wheat":
            threats = [_wheat(days, today_index, gate)]
        elif crop == "corn":
            threats = [_tarspot(days, today_index, gate), _gls(days, today_index, gate)]
        else:
            threats = [_late(days, today_index, gate, history_complete), _early(days, today_index, gate, history_complete)]

        threats.sort(
            key=lambda item: (bool(item["productionEligible"]), item["score"], item["peakScore7d"]),
            reverse=True,
        )
        eligible = [item for item in threats if item["productionEligible"]]
        top = eligible[0] if eligible else None
        score = float(top["score"]) if top else 0.0
        level = str(top["level"]) if top else "low"

        return {
            "ok": True,
            "supported": True,
            "field": {
                "id": field["id"],
                "name": field.get("name") or "Seçili tarla",
                "crop": (season or {}).get("crop") or field.get("crop"),
                "normalizedCrop": crop,
            },
            "location": {
                "latitude": round(coordinates[0], 6),
                "longitude": round(coordinates[1], 6),
                "source": "parcel_centroid_or_field_coordinate",
                "precision": "field",
            },
            "seasonStartDate": planting,
            "weather": {
                "source": "Open-Meteo Forecast + Historical API",
                "pastDays": 35,
                "forecastDays": 7,
                "seasonHistoryComplete": history_complete,
            },
            "overall": {
                "score": score,
                "level": level,
                "levelLabel": RISK_LABEL[level],
                "headline": (
                    f"{top['displayName']} için çevresel risk {RISK_LABEL[level].lower()}"
                    if top
                    else "Modelin hassas fenoloji penceresi aktif değil"
                    if gate["status"] == "out_of_window"
                    else "Risk için fenoloji/sezon girdisi doğrulanmalı"
                ),
                "recommendation": (
                    "Hedefli saha kontrolü ve fotoğrafla doğrulama önerilir. Bu skor tek başına teşhis veya ilaçlama talimatı değildir."
                    if top and score >= 24
                    else "Rutin saha gözlemine devam et."
                    if top
                    else "Eksik fenoloji/sezon bilgisini tamamla; doğrulanmamış risk skoru üretilmez."
                ),
            },
            "threats": threats,
            "provenance": {
                "engine": "tarlapusula-cpn-risk-worker-v1",
                "upstream": "bzbradford/cpn-crop-risk-tool",
                "upstreamLicense": "MIT",
                "upstreamCommit": CPN_COMMIT,
                "weatherProvider": "Open-Meteo",
                "riskIsNotDiagnosis": True,
                "noAutomaticPesticidePrescription": True,
            },
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }
