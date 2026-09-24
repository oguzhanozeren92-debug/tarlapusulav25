from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor"

SL2P_REPO = "djamainajib/SL2P-SL2PCCRS_PYTHON"
SL2P_COMMIT = "71ac9e0453a58610d73283fb6a1ad15e19dbae89"
RSCM_REPO = "RS-iCM/RSCM"
RSCM_COMMIT = "7c48c6c93d758c72aceb99e9923181a77b7c51cb"

SL2P_FILES = [
    "License",
    "tools/SL2P.py",
    "tools/SL2PV0.py",
    "tools/SL2PV1.py",
    "tools/dictionariesSL2P.py",
    "tools/toolsNets.py",
    "nets/s2_20m_sl2p.pkl",
    "nets/s2_20m_sl2p_error.pkl",
    "nets/s2_20m_sl2p_domain.pkl",
    "nets/s2_20m_sl2p_legend.pkl",
    "nets/s2_20m_sl2p_parameter_file.pkl",
    "nets/s2_20m_sl2pccrs.pkl",
    "nets/s2_20m_sl2pccrs_error.pkl",
    "nets/s2_20m_sl2pccrs_domain.pkl",
    "nets/s2_20m_sl2pccrs_legend.pkl",
    "nets/s2_20m_sl2pccrs_parameter_file.pkl",
]

RSCM_FILES = [
    "LICENSE",
    "RSCM_v1.py",
    "CodeC/RSCM_v1.c",
    "CodeC/powell_min.c",
]


def _raw_url(repo: str, commit: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{repo}/{commit}/{path}"


def _download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": "TarlaPusula-Model-Gateway/1.0"})
    with urlopen(request, timeout=60) as response:
        data = response.read()
    if not data:
        raise RuntimeError(f"empty download: {url}")
    target.write_bytes(data)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sync_repo_subset(name: str, repo: str, commit: str, files: list[str]) -> dict[str, str]:
    root = VENDOR / name
    marker = root / ".tarlapusula_vendor.json"
    if marker.exists():
        try:
            existing = json.loads(marker.read_text("utf-8"))
            if existing.get("commit") == commit and all((root / path).exists() for path in files):
                return {path: _sha256(root / path) for path in files}
        except Exception:
            pass

    for rel in files:
        _download(_raw_url(repo, commit, rel), root / rel)

    hashes = {path: _sha256(root / path) for path in files}
    marker.write_text(
        json.dumps(
            {
                "repo": repo,
                "commit": commit,
                "files": hashes,
            },
            indent=2,
            sort_keys=True,
        ),
        "utf-8",
    )
    return hashes


def _compile_rscm() -> Path:
    root = VENDOR / "rscm"
    code_dir = root / "CodeC"
    source = code_dir / "RSCM_v1.c"
    output = code_dir / "RSCM_v1.so"
    if output.exists() and output.stat().st_mtime >= source.stat().st_mtime:
        return output

    compiler = shutil.which("gcc") or shutil.which("cc")
    if not compiler:
        raise RuntimeError("RSCM requires gcc/cc at build time")

    command = [
        compiler,
        "-shared",
        "-fPIC",
        "-O2",
        "-o",
        str(output),
        str(source),
        "-lm",
    ]
    subprocess.run(command, cwd=code_dir, check=True)
    if not output.exists():
        raise RuntimeError("RSCM shared library was not created")
    return output


def bootstrap() -> dict[str, object]:
    VENDOR.mkdir(parents=True, exist_ok=True)
    sl2p_hashes = _sync_repo_subset("sl2p", SL2P_REPO, SL2P_COMMIT, SL2P_FILES)
    rscm_hashes = _sync_repo_subset("rscm", RSCM_REPO, RSCM_COMMIT, RSCM_FILES)
    rscm_so = _compile_rscm()
    return {
        "ok": True,
        "sl2p": {"commit": SL2P_COMMIT, "files": len(sl2p_hashes)},
        "rscm": {"commit": RSCM_COMMIT, "files": len(rscm_hashes), "shared_object": str(rscm_so)},
    }


if __name__ == "__main__":
    try:
        print(json.dumps(bootstrap(), indent=2))
    except Exception as exc:
        print(f"vendor bootstrap failed: {exc}", file=sys.stderr)
        raise
