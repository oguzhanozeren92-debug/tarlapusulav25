# satellite-ndvi-anomaly

Evidence-only anomaly detector for Sentinel-2 NDVI time-series observations.

- Input is the real dated NDVI observations already returned by `satellite-ndvi-timeseries`.
- No synthetic NDVI, missing-date interpolation, crop expectation, seasonal baseline, or default scientific value is generated.
- At least 5 valid observations spanning at least 20 days are required.
- The latest observation is compared with the preceding observations using median/MAD robust z-score.
- An anomaly is emitted only when `abs(robustScore) >= 3.5`.
- If MAD is zero, quality remains `insufficient`; the function does not invent variance or force a classification.

This detector answers only: “Does the latest observed NDVI strongly depart from this field's own recent observed distribution?” It must not be interpreted as a disease, irrigation, nutrient, or yield diagnosis by itself.
