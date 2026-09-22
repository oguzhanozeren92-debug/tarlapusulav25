from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from dssat_runner import DssatPreparedFile, DssatPreparedShadowRequest, run_dssat_prepared_shadow

MAX_WEATHER_DAYS = 370
MAX_SOIL_LAYERS = 20
MAX_IRRIGATION_EVENTS = 500
SAFE_CULTIVAR_RE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{1,14}$")


class GatewayModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DssatWeatherDay(GatewayModel):
    date: date
    solar_radiation_mj_m2: float = Field(ge=0, le=60)
    tmax_c: float = Field(ge=-80, le=70)
    tmin_c: float = Field(ge=-80, le=70)
    rain_mm: float = Field(ge=0, le=1000)

    @model_validator(mode="after")
    def validate_temperature_order(self):
        if self.tmax_c < self.tmin_c:
            raise ValueError("DSSAT weather tmax_c cannot be below tmin_c")
        return self


class DssatSoilLayer(GatewayModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    th_wp: float = Field(gt=0, lt=1)
    th_fc: float = Field(gt=0, lt=1)
    th_s: float = Field(gt=0, lt=1)
    ksat_mm_day: float = Field(gt=0, le=100000)
    sand_percent: float = Field(ge=0, le=100)
    clay_percent: float = Field(ge=0, le=100)
    silt_percent: float = Field(ge=0, le=100)
    soc_g_kg: float = Field(ge=0, le=500)
    bulk_density_g_cm3: float = Field(gt=0.5, le=2.5)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("DSSAT soil layer bottom must exceed top")
        if not self.th_wp < self.th_fc < self.th_s:
            raise ValueError("DSSAT soil layer must satisfy th_wp < th_fc < th_s")
        total = self.sand_percent + self.clay_percent + self.silt_percent
        if abs(total - 100.0) > 2.0:
            raise ValueError("DSSAT soil texture percentages must sum to approximately 100")
        return self


class DssatInitialWaterLayer(GatewayModel):
    from_cm: float = Field(ge=0, le=300)
    to_cm: float = Field(gt=0, le=300)
    volumetric_water_content: float = Field(gt=0, lt=1)

    @model_validator(mode="after")
    def validate_layer(self):
        if self.to_cm <= self.from_cm:
            raise ValueError("DSSAT initial-water layer bottom must exceed top")
        return self


class DssatIrrigationEvent(GatewayModel):
    date: date
    depth_mm: float = Field(gt=0, le=500)


class DssatPlantingManagement(GatewayModel):
    plant_population_m2: float = Field(gt=0, le=2000)
    row_spacing_cm: float = Field(gt=0, le=500)
    planting_depth_cm: float = Field(gt=0, le=50)


class DssatStructuredShadowRequest(GatewayModel):
    field_id: str = Field(min_length=1, max_length=128)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation_m: float = Field(ge=-500, le=9000)
    tav_c: float = Field(ge=-50, le=50)
    amp_c: float = Field(ge=0, le=40)
    crop_folder: str = Field(min_length=1, max_length=32)
    cultivar_code: str = Field(min_length=2, max_length=15)
    cultivar_name: str = Field(min_length=1, max_length=80)
    planting_date: date
    harvest_date: date
    weather: list[DssatWeatherDay] = Field(min_length=2, max_length=MAX_WEATHER_DAYS)
    soil: list[DssatSoilLayer] = Field(min_length=1, max_length=MAX_SOIL_LAYERS)
    initial_water: list[DssatInitialWaterLayer] = Field(min_length=1, max_length=MAX_SOIL_LAYERS)
    irrigation_mode: str = Field(pattern=r"^(rainfed|recorded_schedule)$")
    irrigation: list[DssatIrrigationEvent] = Field(default_factory=list, max_length=MAX_IRRIGATION_EVENTS)
    planting_management: DssatPlantingManagement
    input_contract_version: int = Field(default=2, ge=2, le=2)
    timeout_seconds: int = Field(default=90, ge=10, le=180)

    @field_validator("cultivar_code")
    @classmethod
    def validate_cultivar_code(cls, value: str) -> str:
        code = value.strip().upper()
        if not SAFE_CULTIVAR_RE.fullmatch(code):
            raise ValueError("Verified DSSAT cultivar code contains unsupported characters")
        return code

    @model_validator(mode="after")
    def validate_cross_fields(self):
        ordered_weather = sorted(self.weather, key=lambda row: row.date)
        if ordered_weather[0].date > self.planting_date:
            raise ValueError("DSSAT weather must start on or before planting")
        for previous, current in zip(ordered_weather, ordered_weather[1:]):
            if (current.date - previous.date).days != 1:
                raise ValueError("DSSAT weather must be continuous without daily gaps")
        if self.harvest_date < self.planting_date:
            raise ValueError("DSSAT harvest date cannot be before planting")
        if ordered_weather[-1].date < self.harvest_date:
            raise ValueError("DSSAT weather does not include the verified harvest date")
        if self.irrigation_mode == "rainfed" and self.irrigation:
            raise ValueError("Rainfed DSSAT request cannot contain irrigation events")
        if self.irrigation_mode == "recorded_schedule" and not self.irrigation:
            raise ValueError("Recorded-schedule DSSAT request requires at least one irrigation event")
        _validate_contiguous_profile(self.soil, 200.0, "soil")
        _validate_contiguous_profile(self.initial_water, 200.0, "initial water")
        for event in self.irrigation:
            if event.date < self.planting_date or event.date > ordered_weather[-1].date:
                raise ValueError("DSSAT irrigation event falls outside the prepared weather window")
        return self


@dataclass(frozen=True)
class CropTemplate:
    folder: str
    crop_code: str
    extension: str
    model_code: str
    photo_method: str


CROP_TEMPLATES = {
    "wheat": CropTemplate("Wheat", "WH", "WHX", "CSCER048", "C"),
    "maize": CropTemplate("Maize", "MZ", "MZX", "MZCER048", "R"),
}


def _validate_contiguous_profile(layers: list[Any], required_depth_cm: float, label: str) -> None:
    ordered = sorted(layers, key=lambda row: row.from_cm)
    cursor = 0.0
    for layer in ordered:
        if abs(layer.from_cm - cursor) > 0.01:
            raise ValueError(f"DSSAT {label} profile has a depth gap near {cursor:.1f} cm")
        cursor = layer.to_cm
    if abs(cursor - required_depth_cm) > 0.01:
        raise ValueError(f"DSSAT {label} profile must continuously cover 0-{required_depth_cm:.0f} cm")


def _template(folder: str) -> CropTemplate:
    template = CROP_TEMPLATES.get(folder.strip().lower())
    if template is None:
        raise ValueError(
            f"DSSAT FileX template is not yet verified for crop folder '{folder}'. "
            "Phase 3 intentionally supports only verified Wheat and Maize writers."
        )
    return template


def _dssat_date(value: date) -> str:
    return f"{value.year % 100:02d}{value.timetuple().tm_yday:03d}"


def _station_year_filename(station: str, year: int) -> str:
    return f"{station}{year % 100:02d}01.WTH".upper()


def _weighted_water_for_soil_layer(
    soil_layer: DssatSoilLayer,
    water_layers: list[DssatInitialWaterLayer],
) -> float:
    weighted = 0.0
    depth = 0.0
    for water in water_layers:
        overlap = max(0.0, min(soil_layer.to_cm, water.to_cm) - max(soil_layer.from_cm, water.from_cm))
        if overlap <= 0:
            continue
        weighted += overlap * water.volumetric_water_content
        depth += overlap
    required = soil_layer.to_cm - soil_layer.from_cm
    if depth <= 0 or abs(depth - required) > 0.02:
        raise ValueError("Initial-water profile does not fully overlap a DSSAT soil layer")
    return weighted / depth


def _build_weather_files(payload: DssatStructuredShadowRequest, station: str) -> list[DssatPreparedFile]:
    grouped: dict[int, list[DssatWeatherDay]] = {}
    for row in sorted(payload.weather, key=lambda item: item.date):
        grouped.setdefault(row.date.year, []).append(row)

    files: list[DssatPreparedFile] = []
    for year, rows in grouped.items():
        lines = [
            "*WEATHER DATA : TarlaPusula server-derived ERA5-Land shadow input",
            "",
            "@ INSI      LAT     LONG  ELEV   TAV   AMP REFHT WNDHT",
            f"  {station:<4} {payload.latitude:8.3f} {payload.longitude:9.3f} {payload.elevation_m:5.0f} {payload.tav_c:5.1f} {payload.amp_c:5.1f}   -99   -99",
            "@DATE  SRAD  TMAX  TMIN  RAIN",
        ]
        for row in rows:
            lines.append(
                f"{_dssat_date(row.date)} {row.solar_radiation_mj_m2:5.1f} {row.tmax_c:5.1f} {row.tmin_c:5.1f} {row.rain_mm:5.1f}"
            )
        files.append(DssatPreparedFile(name=_station_year_filename(station, year), content="\n".join(lines) + "\n"))
    return files


def _build_soil_file(payload: DssatStructuredShadowRequest, soil_id: str) -> DssatPreparedFile:
    lines = [
        "*SOILS: TarlaPusula SoilGrids server-derived DSSAT shadow profile",
        "",
        f"*{soil_id:<10} ISRIC       -99     200 SoilGrids250m shadow profile",
        "@SITE        COUNTRY          LAT     LONG SCS FAMILY",
        f" TPUS        TURKEY        {payload.latitude:6.3f} {payload.longitude:8.3f} SOILGRIDS250M",
        "@ SCOM  SALB  SLU1  SLDR  SLRO  SLNF  SLPF  SMHB  SMPX  SMKE",
        "   -99   -99   -99   -99   -99   1.00   1.00   -99   -99   -99",
        "@  SLB  SLMH  SLLL  SDUL  SSAT  SRGF  SSKS  SBDM  SLOC  SLCL  SLSI  SLCF  SLNI  SLHW  SLHB  SCEC  SADC",
    ]
    for layer in sorted(payload.soil, key=lambda item: item.from_cm):
        # DSSAT SOIL.CDE defines SSKS as cm h-1. AquaCrop/SoilGrids adapter stores mm day-1.
        ksat_cm_hour = layer.ksat_mm_day / 240.0
        organic_carbon_percent = layer.soc_g_kg / 10.0
        lines.append(
            f"{layer.to_cm:6.0f}   -99 {layer.th_wp:5.3f} {layer.th_fc:5.3f} {layer.th_s:5.3f}   -99 "
            f"{ksat_cm_hour:5.2f} {layer.bulk_density_g_cm3:5.2f} {organic_carbon_percent:5.2f} "
            f"{layer.clay_percent:5.1f} {layer.silt_percent:5.1f}   0.0   -99   -99   -99   -99   -99"
        )
    return DssatPreparedFile(name="TP.SOL", content="\n".join(lines) + "\n")


def _build_filex(
    payload: DssatStructuredShadowRequest,
    template: CropTemplate,
    station: str,
    soil_id: str,
) -> DssatPreparedFile:
    filex = f"TP000001.{template.extension}"
    pdate = _dssat_date(payload.planting_date)
    hdate = _dssat_date(payload.harvest_date)
    first_weather = min(row.date for row in payload.weather)
    start_code = _dssat_date(first_weather)
    irrigation_factor = 0 if payload.irrigation_mode == "rainfed" else 1
    irrigation_management = "N" if payload.irrigation_mode == "rainfed" else "R"

    lines = [
        f"*EXP.DETAILS: TP000001{template.crop_code} TARLAPUSULA DSSAT SHADOW",
        "",
        "*GENERAL",
        "@PEOPLE",
        " TarlaPusula server-derived shadow adapter",
        "@ADDRESS",
        " Türkiye",
        "@SITE",
        " User field centroid; source values retained in TarlaPusula evidence chain",
        "",
        "*TREATMENTS                        -------------FACTOR LEVELS------------",
        "@N R O C TNAME.................... CU FL SA IC MP MI MF MR MC MT ME MH SM",
        f" 1 1 0 0 TARLAPUSULA SHADOW          1  1  0  1  1  {irrigation_factor}  0  0  0  0  0  0  1",
        "",
        "*CULTIVARS",
        "@C CR INGENO CNAME",
        f" 1 {template.crop_code:>2} {payload.cultivar_code:<15} {payload.cultivar_name[:48]}",
        "",
        "*FIELDS",
        "@L ID_FIELD WSTA....  FLSA  FLOB  FLDT  FLDD  FLDS  FLST SLTX  SLDP  ID_SOIL    FLNAME",
        f" 1 TP000001 {station:<4}       -99     0 DR000     0     0 00000 -99    200  {soil_id:<10} TarlaPusula",
        "@L ...........XCRD ...........YCRD .....ELEV .............AREA .SLEN .FLWR .SLAS FLHST FHDUR",
        f" 1 {payload.latitude:15.6f} {payload.longitude:15.6f} {payload.elevation_m:9.1f}                 0     0     0     0   -99   -99",
        "",
        "*INITIAL CONDITIONS",
        "@C   PCR ICDAT  ICRT  ICND  ICRN  ICRE  ICWD ICRES ICREN ICREP ICRIP ICRID ICNAME",
        f" 1    {template.crop_code} {pdate}   -99   -99     1     1   -99   -99   -99   -99   -99   -99 TarlaPusula",
        "@C  ICBL  SH2O  SNH4  SNO3",
    ]
    for layer in sorted(payload.soil, key=lambda item: item.from_cm):
        water = _weighted_water_for_soil_layer(layer, payload.initial_water)
        lines.append(f" 1 {layer.to_cm:5.0f} {water:6.3f}   -99   -99")

    management = payload.planting_management
    lines.extend([
        "",
        "*PLANTING DETAILS",
        "@P PDATE EDATE  PPOP  PPOE  PLME  PLDS  PLRS  PLRD  PLDP  PLWT  PAGE  PENV  PLPH  SPRL                        PLNAME",
        f" 1 {pdate}   -99 {management.plant_population_m2:5.1f}   -99     S     R {management.row_spacing_cm:5.1f}   -99 {management.planting_depth_cm:5.1f}   -99   -99   -99   -99   -99                        -99",
    ])

    if payload.irrigation_mode == "recorded_schedule":
        lines.extend([
            "",
            "*IRRIGATION AND WATER MANAGEMENT",
            "@I  EFIR  IDEP  ITHR  IEPT  IOFF  IAME  IAMT IRNAME",
            " 1     1   -99   -99   -99   -99   -99   -99 Recorded",
            "@I IDATE  IROP IRVAL",
        ])
        for event in sorted(payload.irrigation, key=lambda item: item.date):
            lines.append(f" 1 {_dssat_date(event.date)} IR001 {event.depth_mm:6.1f}")

    lines.extend([
        "",
        "*HARVEST DETAILS",
        "@H HDATE  HSTG  HCOM HSIZE   HPC  HBPC HNAME",
        f" 1 {hdate} GS000   -99   -99   -99   -99 Verified field harvest date",
        "",
        "*SIMULATION CONTROLS",
        "@N GENERAL     NYERS NREPS START SDATE RSEED SNAME.................... SMODEL",
        f" 1 GE              1     1     S {start_code}  2150 TARLAPUSULA SHADOW        {template.model_code}",
        "@N OPTIONS     WATER NITRO SYMBI PHOSP POTAS DISES  CHEM  TILL   CO2",
        " 1 OP              Y     N     N     N     N     N     N     N     M",
        "@N METHODS     WTHER INCON LIGHT EVAPO INFIL PHOTO HYDRO NSWIT MESOM MESEV MESOL",
        f" 1 ME              M     M     E     R     S     {template.photo_method}     R     1     G     R     2",
        "@N MANAGEMENT  PLANT IRRIG FERTI RESID HARVS",
        f" 1 MA              R     {irrigation_management}     N     N     R",
        "@N OUTPUTS     FNAME OVVEW SUMRY FROPT GROUT CAOUT WAOUT NIOUT MIOUT DIOUT VBOSE CHOUT OPOUT FMOPT",
        " 1 OU              N     Y     Y     1     Y     N     Y     N     N     N     Y     N     N     A",
        "",
    ])
    return DssatPreparedFile(name=filex, content="\n".join(lines) + "\n")


def _build_batch(filex: str, template: CropTemplate) -> DssatPreparedFile:
    content = "\n".join([
        f"$BATCH({template.folder.upper()})",
        "! TarlaPusula server-derived DSSAT shadow batch",
        "@FILEX                                                                                        TRTNO     RP     SQ     OP     CO",
        f"{filex:<94}      1      1      0      0      0",
        "",
    ])
    return DssatPreparedFile(name="DSSBATCH.V48", content=content)


def build_dssat_prepared_request(payload: DssatStructuredShadowRequest) -> DssatPreparedShadowRequest:
    template = _template(payload.crop_folder)
    station = "TP01"
    soil_id = "TPUS000001"
    weather_files = _build_weather_files(payload, station)
    soil_file = _build_soil_file(payload, soil_id)
    experiment_file = _build_filex(payload, template, station, soil_id)
    batch_file = _build_batch(experiment_file.name.upper(), template)
    return DssatPreparedShadowRequest(
        field_id=payload.field_id,
        model_code=template.model_code,
        batch_file=batch_file.name,
        files=[*weather_files, soil_file, experiment_file, batch_file],
        input_contract_version=2,
        timeout_seconds=payload.timeout_seconds,
    )


def run_dssat_structured_shadow(payload: DssatStructuredShadowRequest) -> dict[str, Any]:
    prepared = build_dssat_prepared_request(payload)
    result = run_dssat_prepared_shadow(prepared)
    return {
        **result,
        "mode": "structured-shadow",
        "input_authority": "server-derived-structured-input",
        "adapter": {
            "name": "tarlapusula-dssat-filex-writer",
            "contract_version": payload.input_contract_version,
            "supported_template": payload.crop_folder,
            "model_code": prepared.model_code,
            "weather_source_expected": "ERA5-Land daily archive",
            "soil_source_expected": "ISRIC SoilGrids + Saxton-Rawls hydraulics",
            "nitrogen_simulation": False,
            "synthetic_agronomic_defaults": False,
        },
        "note": (
            "DSSAT structured shadow evidence only. Planting geometry, cultivar, weather, soil, initial water "
            "and irrigation are server-derived/verified; unsupported crop templates are blocked rather than guessed."
        ),
    }
