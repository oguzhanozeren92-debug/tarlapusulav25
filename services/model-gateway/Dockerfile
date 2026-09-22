FROM python:3.12-slim AS dssat-builder

ARG DSSAT_REF=v4.8.6.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        cmake \
        gfortran \
        git \
        make \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${DSSAT_REF}" \
        https://github.com/DSSAT/dssat-csm-os.git /tmp/dssat-csm-os \
    && cmake -S /tmp/dssat-csm-os -B /tmp/dssat-build \
        -DCMAKE_BUILD_TYPE=RELEASE \
        -DCMAKE_INSTALL_PREFIX=/opt/dssat48 \
    && cmake --build /tmp/dssat-build --parallel 2 \
    && cmake --install /tmp/dssat-build \
    && test -x /opt/dssat48/dscsm048 \
    && test -f /opt/dssat48/DSSATPRO.L48 \
    && cp /tmp/dssat-csm-os/license.txt /opt/dssat48/LICENSE-DSSAT.txt \
    && cp /tmp/dssat-csm-os/NOTICE.md /opt/dssat48/NOTICE-DSSAT.md


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_GATEWAY_ENV=production \
    DSSAT_HOME=/opt/dssat48 \
    DSSAT_EXECUTABLE=/opt/dssat48/dscsm048 \
    DSSAT_RUNTIME_VERSION=4.8.6.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgfortran5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dssat-builder /opt/dssat48 /opt/dssat48

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY app.py ./app.py
COPY dual_app.py ./dual_app.py
COPY engine_registry.py ./engine_registry.py
COPY pcse_runner.py ./pcse_runner.py
COPY aquacrop_runner.py ./aquacrop_runner.py
COPY pyfao56_dual_runner.py ./pyfao56_dual_runner.py
COPY dssat_runner.py ./dssat_runner.py
COPY dssat_adapter.py ./dssat_adapter.py
COPY plantcv_runner.py ./plantcv_runner.py
COPY plantvillage_shadow_runner.py ./plantvillage_shadow_runner.py

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)); raise SystemExit(0 if payload.get('ready') else 1)"

CMD ["uvicorn", "dual_app:app", "--host", "0.0.0.0", "--port", "8000"]
