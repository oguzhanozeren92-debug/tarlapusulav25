# NDVI anomaly service

`fetchFieldNdviTimeSeries()` remains the evidence acquisition step. Pass its returned `points` to `analyzeNdviAnomaly(points)`.

The anomaly service deliberately does not create fallback observations or infer missing dates. `quality: insufficient` must be preserved in UI/intelligence layers instead of being converted into an alert/no-alert scientific conclusion.
