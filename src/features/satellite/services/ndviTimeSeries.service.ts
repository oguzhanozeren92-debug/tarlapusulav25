import { supabase } from '../../../supabaseClient';

import type {
  NdviTimeSeriesPoint,
  NdviTimeSeriesResult,
  NdviTimeSeriesTrend,
  NdviTrendQuality,
} from '../types/ndviTimeSeries';

const DEFAULT_DAYS_BACK = 90;
const DEFAULT_MAX_CLOUD_COVERAGE = 35;

function numberOrNull(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeParcelGeometry(value: any) {
  if (
    value?.type === 'Feature' &&
    value?.geometry &&
    (
      value.geometry.type === 'Polygon' ||
      value.geometry.type === 'MultiPolygon'
    ) &&
    Array.isArray(value.geometry.coordinates)
  ) {
    return value;
  }

  if (
    (
      value?.type === 'Polygon' ||
      value?.type === 'MultiPolygon'
    ) &&
    Array.isArray(value.coordinates)
  ) {
    return {
      type: 'Feature',
      properties: {},
      geometry: value,
    };
  }

  return null;
}

function normalizePoint(
  value: any,
): NdviTimeSeriesPoint | null {
  const date =
    String(value?.date ?? '').trim();

  const average =
    numberOrNull(value?.average);

  if (
    !date ||
    average === null ||
    average < -1 ||
    average > 1
  ) {
    return null;
  }

  const min = numberOrNull(value?.min);
  const max = numberOrNull(value?.max);

  return {
    date,
    average,
    min:
      min !== null &&
      min >= -1 &&
      min <= 1
        ? min
        : null,
    max:
      max !== null &&
      max >= -1 &&
      max <= 1
        ? max
        : null,
    sampleCount:
      numberOrNull(value?.sampleCount),
    noDataCount:
      numberOrNull(value?.noDataCount),
  };
}

function normalizeTrend(
  value: any,
  points: NdviTimeSeriesPoint[],
): NdviTimeSeriesTrend {
  const observationCount =
    Number.isFinite(
      Number(value?.observationCount),
    )
      ? Number(value.observationCount)
      : points.length;

  const spanDays =
    numberOrNull(value?.spanDays);

  const backendQuality:
    | NdviTrendQuality
    | null =
    value?.quality === 'usable' ||
    value?.quality === 'insufficient'
      ? value.quality
      : null;

  /*
    İstemci tarafında da koruma var:
    3'ten az gerçek gözlem veya
    12 günden kısa seriyle yön üretmiyoruz.
  */
  const quality: NdviTrendQuality =
    backendQuality === 'usable' &&
    observationCount >= 3 &&
    spanDays !== null &&
    spanDays >= 12
      ? 'usable'
      : 'insufficient';

  const rawDirection =
    value?.direction === 'rising' ||
    value?.direction === 'stable' ||
    value?.direction === 'falling'
      ? value.direction
      : 'unknown';

  return {
    direction:
      quality === 'usable'
        ? rawDirection
        : 'unknown',
    quality,
    slopePerDay:
      quality === 'usable'
        ? numberOrNull(
            value?.slopePerDay,
          )
        : null,
    changeFromPrevious:
      numberOrNull(
        value?.changeFromPrevious,
      ),
    changeFromFirst:
      numberOrNull(
        value?.changeFromFirst,
      ),
    latestAverage:
      numberOrNull(
        value?.latestAverage,
      ),
    previousAverage:
      numberOrNull(
        value?.previousAverage,
      ),
    firstAverage:
      numberOrNull(
        value?.firstAverage,
      ),
    observationCount,
    spanDays,
  };
}

export async function fetchFieldNdviTimeSeries(
  geometry: any,
  options?: {
    daysBack?: number;
    maxCloudCoverage?: number;
  },
): Promise<NdviTimeSeriesResult> {
  const parcelGeometry =
    normalizeParcelGeometry(geometry);

  if (!parcelGeometry) {
    throw new Error(
      'NDVI zaman serisi için gerçek Polygon/MultiPolygon parsel geometrisi bulunamadı.',
    );
  }

  const rawDaysBack =
    Number(
      options?.daysBack ??
      DEFAULT_DAYS_BACK,
    );

  const daysBack =
    Math.max(
      14,
      Math.min(
        180,
        Number.isFinite(rawDaysBack)
          ? rawDaysBack
          : DEFAULT_DAYS_BACK,
      ),
    );

  const rawCloud =
    Number(
      options?.maxCloudCoverage ??
      DEFAULT_MAX_CLOUD_COVERAGE,
    );

  const maxCloudCoverage =
    Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(rawCloud)
          ? rawCloud
          : DEFAULT_MAX_CLOUD_COVERAGE,
      ),
    );

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'satellite-ndvi-timeseries',
      {
        body: {
          geometry:
            parcelGeometry,
          daysBack,
          maxCloudCoverage,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(
      data?.message ??
      'NDVI zaman serisi alınamadı.',
    );
  }

  const points:
    NdviTimeSeriesPoint[] =
    Array.isArray(data?.points)
      ? data.points
          .map(normalizePoint)
          .filter(
            (
              point:
                | NdviTimeSeriesPoint
                | null,
            ): point is NdviTimeSeriesPoint =>
              Boolean(point),
          )
      : [];

  const trend =
    normalizeTrend(
      data?.trend,
      points,
    );

  const message =
    data?.message
      ? String(data.message)
      : trend.quality ===
          'insufficient'
        ? 'NDVI gözlemi var ancak güvenilir trend yönü için veri yetersiz.'
        : undefined;

  return {
    success: true,
    source:
      String(
        data?.source ??
        'Copernicus Data Space · Sentinel-2 L2A',
      ),
    period:
      data?.period
        ? {
            from:
              String(
                data.period.from ??
                '',
              ),
            to:
              String(
                data.period.to ??
                '',
              ),
          }
        : undefined,
    points,
    trend,
    generatedAt:
      data?.generatedAt
        ? String(
            data.generatedAt,
          )
        : undefined,
    message,
  };
}
