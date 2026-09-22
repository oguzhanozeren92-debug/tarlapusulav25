from __future__ import annotations

import csv
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

DSSAT_HOME = Path(os.getenv("DSSAT_HOME", "/opt/dssat48")).resolve()
DSSAT_EXECUTABLE = Path(
    os.getenv("DSSAT_EXECUTABLE", str(DSSAT_HOME / "dscsm048"))
).resolve()
DSSAT_RUNTIME_VERSION = os.getenv("DSSAT_RUNTIME_VERSION", "4.8.6.0").strip() or "4.8.6.0"

MAX_FILES = 64
MAX_FILE_BYTES = 1_000_000
MAX_BUNDLE_BYTES = 8_000_000
MAX_CAPTURE_CHARS = 12_000
DEFAULT_TIMEOUT_SECONDS = 90
SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
SAFE_MODEL_CODE_RE = re.compile(r"^[A-Z0-9]{8}$")
ALLOWED_MODEL_CODES = {"CSCER048", "MZCER048"}

SUMMARY_KEYS = {
    "HWAM": "yield_at_maturity_kg_ha",
    "HWAH": "harvested_yield_kg_ha",
    "MDAT": "maturity_date_code",
    "HDAT": "harvest_date_code",
    "IRCM": "season_irrigation_mm",
    "PRCM": "season_precipitation_mm",
    "PREC": "season_precipitation_mm",
    "ETCP": "season_crop_et_mm",
    "ETCM": "season_crop_et_mm",
    "CWAM": "canopy_biomass_kg_ha",
    "LAIX": "maximum_lai",
    "HIAM": "harvest_index",
    "NUCM": "season_n_uptake_kg_ha",
    "EYLDH": "economic_yield",
}


class GatewayModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DssatPreparedFile(GatewayModel):
    name: str = Field(min_length=1, max_length=64)
    content: str = Field(max_length=MAX_FILE_BYTES)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not SAFE_NAME_RE.fullmatch(name):
            raise ValueError(
                "DSSAT prepared bundle filenames must be flat ASCII names without directories"
            )
        return name


class DssatPreparedShadowRequest(GatewayModel):
    field_id: str = Field(min_length=1, max_length=128)
    model_code: str = Field(min_length=8, max_length=8)
    batch_file: str = Field(min_length=1, max_length=64)
    files: list[DssatPreparedFile] = Field(min_length=1, max_length=MAX_FILES)
    input_contract_version: int = Field(default=2, ge=1, le=2)
    timeout_seconds: int = Field(default=DEFAULT_TIMEOUT_SECONDS, ge=10, le=180)


    @field_validator("model_code")
    @classmethod
    def validate_model_code(cls, value: str) -> str:
        code = value.strip().upper()
        if not SAFE_MODEL_CODE_RE.fullmatch(code) or code not in ALLOWED_MODEL_CODES:
            raise ValueError("DSSAT Phase 3 model_code must be a verified CSCER048 or MZCER048 template")
        return code

    @field_validator("batch_file")
    @classmethod
    def validate_batch_file(cls, value: str) -> str:
        name = value.strip()
        if not SAFE_NAME_RE.fullmatch(name):
            raise ValueError("DSSAT batch filename is unsafe")
        if not name.lower().endswith(".v48"):
            raise ValueError("DSSAT 4.8 batch file must use the .v48 extension")
        return name


class DssatRuntimeStatus(GatewayModel):
    available: bool
    version: str
    executable: str
    home: str
    executable_exists: bool
    executable_is_file: bool
    executable_is_executable: bool
    data_profile_exists: bool


def dssat_runtime_status() -> dict[str, Any]:
    executable_exists = DSSAT_EXECUTABLE.exists()
    executable_is_file = DSSAT_EXECUTABLE.is_file()
    executable_is_executable = executable_exists and os.access(DSSAT_EXECUTABLE, os.X_OK)
    data_profile_exists = (DSSAT_HOME / "DSSATPRO.L48").is_file()
    available = bool(
        executable_exists
        and executable_is_file
        and executable_is_executable
        and data_profile_exists
    )
    return DssatRuntimeStatus(
        available=available,
        version=DSSAT_RUNTIME_VERSION,
        executable=str(DSSAT_EXECUTABLE),
        home=str(DSSAT_HOME),
        executable_exists=executable_exists,
        executable_is_file=executable_is_file,
        executable_is_executable=executable_is_executable,
        data_profile_exists=data_profile_exists,
    ).model_dump()


def _validate_bundle(payload: DssatPreparedShadowRequest) -> dict[str, str]:
    files: dict[str, str] = {}
    total = 0
    for item in payload.files:
        key = item.name.upper()
        if key == "DSSATPRO.L48":
            raise ValueError("DSSATPRO.L48 is runtime-owned and cannot be supplied by a prepared bundle")
        if key in files:
            raise ValueError(f"Duplicate DSSAT prepared file: {item.name}")
        raw = item.content.encode("utf-8")
        total += len(raw)
        if len(raw) > MAX_FILE_BYTES:
            raise ValueError(f"DSSAT input file exceeds {MAX_FILE_BYTES} bytes: {item.name}")
        if total > MAX_BUNDLE_BYTES:
            raise ValueError(f"DSSAT prepared bundle exceeds {MAX_BUNDLE_BYTES} bytes")
        if "\x00" in item.content:
            raise ValueError(f"DSSAT input contains a NUL byte: {item.name}")
        if "../" in item.content or "..\\" in item.content:
            raise ValueError(f"DSSAT input contains parent-directory traversal: {item.name}")
        files[key] = item.content

    if payload.batch_file.upper() not in files:
        raise ValueError("Prepared DSSAT bundle does not contain the declared batch file")

    # Prevent the batch file from escaping the isolated workspace. Absolute references
    # are unnecessary because TarlaPusula bundles every field-specific input explicitly.
    batch_text = files[payload.batch_file.upper()]
    for raw_line in batch_text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("!") or line.startswith("*") or line.startswith("$"):
            continue
        if re.search(r"(^|\s)(/|[A-Za-z]:[\\/])", line):
            raise ValueError("DSSAT batch file contains an absolute path")

    return files


def _coerce_number(value: str | None) -> float | int | str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-99", "-99.0", "-99.00", "-9999"}:
        return None
    try:
        number = float(text)
    except ValueError:
        return text
    if number.is_integer():
        return int(number)
    return number


def _extract_summary_row_from_csv(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    rows = list(csv.reader(path.read_text(encoding="utf-8", errors="replace").splitlines()))
    header_index = None
    for index, row in enumerate(rows):
        upper = [cell.strip().upper() for cell in row]
        if "HWAM" in upper or "HWAH" in upper:
            header_index = index
            break
    if header_index is None:
        return None
    header = [cell.strip().upper() for cell in rows[header_index]]
    for row in rows[header_index + 1 :]:
        if not any(cell.strip() for cell in row):
            continue
        padded = row + [""] * max(0, len(header) - len(row))
        return {header[i]: _coerce_number(padded[i]) for i in range(len(header))}
    return None


def _extract_summary_row_from_out(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped.startswith("@"):
            continue
        header = stripped[1:].split()
        upper = [item.upper() for item in header]
        if "HWAM" not in upper and "HWAH" not in upper:
            continue
        for candidate in lines[index + 1 :]:
            value_line = candidate.strip()
            if not value_line or value_line.startswith(("*", "@", "!")):
                continue
            values = value_line.split()
            if len(values) < min(6, len(header)):
                continue
            padded = values + [""] * max(0, len(header) - len(values))
            return {upper[i]: _coerce_number(padded[i]) for i in range(len(upper))}
    return None


def _normalized_summary(workdir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    raw = _extract_summary_row_from_csv(workdir / "summary.csv")
    source = "summary.csv"
    if raw is None:
        raw = _extract_summary_row_from_out(workdir / "Summary.OUT")
        source = "Summary.OUT"
    if raw is None:
        return {}, {"source": None, "raw": {}}

    normalized: dict[str, Any] = {}
    for dssat_key, output_key in SUMMARY_KEYS.items():
        if dssat_key in raw:
            normalized[output_key] = raw[dssat_key]

    crop = raw.get("CROP")
    model = raw.get("MODEL")
    if crop is not None:
        normalized["crop_code"] = crop
    if model is not None:
        normalized["model"] = model

    return normalized, {"source": source, "raw": raw}


def _tail(path: Path, limit_lines: int = 30) -> list[str]:
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return lines[-limit_lines:]


def _write_bundle(workdir: Path, files: dict[str, str]) -> None:
    for upper_name, content in files.items():
        # DSSAT v4.8 input naming is conventionally upper-case and Linux is case-sensitive.
        target = workdir / upper_name
        target.write_text(content.replace("\r\n", "\n"), encoding="utf-8", newline="\n")


def _write_isolated_profile(workdir: Path) -> None:
    source = DSSAT_HOME / "DSSATPRO.L48"
    if not source.is_file():
        raise ValueError("Official DSSAT runtime profile DSSATPRO.L48 is missing")
    lines = source.read_text(encoding="utf-8", errors="strict").splitlines()
    rewritten: list[str] = []
    seen = {"WED": False, "SLD": False}
    for line in lines:
        code = line[:3] if len(line) >= 3 else ""
        if code in seen:
            rewritten.append(f"{code} // {workdir}")
            seen[code] = True
        else:
            rewritten.append(line)
    if not all(seen.values()):
        raise ValueError("Official DSSAT profile does not expose both WED and SLD paths")
    (workdir / "DSSATPRO.L48").write_text("\n".join(rewritten) + "\n", encoding="utf-8", newline="\n")


def run_dssat_prepared_shadow(payload: DssatPreparedShadowRequest) -> dict[str, Any]:
    status = dssat_runtime_status()
    if not status["available"]:
        raise ValueError(
            "Official DSSAT runtime is not available in the model-gateway image; redeploy the Docker image with DSSAT v4.8.6.0 enabled"
        )

    files = _validate_bundle(payload)
    batch_name = payload.batch_file.upper()

    with tempfile.TemporaryDirectory(prefix="tp-dssat-") as temp_dir:
        workdir = Path(temp_dir)
        _write_bundle(workdir, files)
        _write_isolated_profile(workdir)

        command = [str(DSSAT_EXECUTABLE), payload.model_code, "B", batch_name]
        try:
            completed = subprocess.run(
                command,
                cwd=workdir,
                env={
                    **os.environ,
                    "DSSAT_HOME": str(DSSAT_HOME),
                },
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=payload.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise ValueError(
                f"DSSAT shadow exceeded the {payload.timeout_seconds}s execution limit"
            ) from exc

        stdout = completed.stdout[-MAX_CAPTURE_CHARS:]
        stderr = completed.stderr[-MAX_CAPTURE_CHARS:]
        error_tail = _tail(workdir / "ERROR.OUT")
        warning_tail = _tail(workdir / "WARNING.OUT")
        summary, provenance = _normalized_summary(workdir)

        if completed.returncode != 0:
            detail = error_tail[-1] if error_tail else (stderr.strip() or stdout.strip())
            raise ValueError(
                f"DSSAT shadow exited with code {completed.returncode}: {detail[:500]}"
            )
        if not summary:
            detail = error_tail[-1] if error_tail else "Summary.OUT/summary.csv was not produced"
            raise ValueError(f"DSSAT shadow completed without a parseable seasonal summary: {detail[:500]}")

        return {
            "ok": True,
            "engine": "dssat-csm",
            "mode": "prepared-shadow",
            "field_id": payload.field_id,
            "runtime_version": DSSAT_RUNTIME_VERSION,
            "input_contract_version": payload.input_contract_version,
            "production_authority": False,
            "yield_authority": False,
            "irrigation_prescription_authority": False,
            "nutrient_prescription_authority": False,
            "input_authority": "server-prepared-bundle",
            "command_mode": "B",
            "model_code": payload.model_code,
            "summary": summary,
            "provenance": {
                "upstream": "DSSAT/dssat-csm-os",
                "release": "v4.8.6.0",
                "license": "BSD-3-Clause",
                "summary_source": provenance["source"],
                "executable": str(DSSAT_EXECUTABLE),
                "batch_file": batch_name,
                "bundle_file_count": len(files),
                "local_profile_overrides": ["WED", "SLD"],
            },
            "diagnostics": {
                "warning_tail": warning_tail,
                "error_tail": error_tail,
                "stdout_tail": stdout,
                "stderr_tail": stderr,
            },
            "note": (
                "Shadow evidence only. TarlaPusula must compare DSSAT with pyfao56/AquaCrop and field evidence; "
                "this response cannot directly prescribe irrigation, fertilizer, or expected farmer yield."
            ),
        }
