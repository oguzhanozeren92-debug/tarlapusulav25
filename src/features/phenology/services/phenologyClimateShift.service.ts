import {
  supabase,
} from '../../../supabaseClient';

import type {
  PhenologyClimateShiftResult,
} from '../types/phenologyClimateShift';

function finiteNumber(
  value: unknown,
): number | null {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function normalizeResult(
  data: any,
): PhenologyClimateShiftResult {
  const status =
    data?.status ===
      'ready' ||
    data?.status ===
      'not_applicable' ||
    data?.status ===
      'insufficient_data'
      ? data.status
      : 'insufficient_data';

  const rawShift =
    finiteNumber(
      data?.shiftDays,
    );

  const shiftDays =
    Math.max(
      -14,
      Math.min(
        14,
        rawShift === null
          ? 0
          : Math.round(
              rawShift,
            ),
      ),
    );

  return {
    success:
      Boolean(
        data?.success,
      ),

    status,

    shiftDays,

    seasonAdvanceDays:
      finiteNumber(
        data?.seasonAdvanceDays,
      ),

    confidence:
      data?.confidence ===
        'medium'
        ? 'medium'
        : 'low',

    anomalyC:
      finiteNumber(
        data?.anomalyC,
      ),

    currentThermalUnits:
      finiteNumber(
        data?.currentThermalUnits,
      ),

    baselineThermalUnits:
      finiteNumber(
        data?.baselineThermalUnits,
      ),

    baselineYearsUsed:
      Math.max(
        0,
        Math.round(
          finiteNumber(
            data?.baselineYearsUsed,
          ) ??
          0,
        ),
      ),

    currentCoverage:
      finiteNumber(
        data?.currentCoverage,
      ),

    source:
      String(
        data?.source ??
        'ERA5-Land',
      ),

    method:
      data?.method
        ? String(
            data.method,
          )
        : null,

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
        : null,

    caution:
      data?.caution
        ? String(
            data.caution,
          )
        : null,

    message:
      data?.reason
        ? String(
            data.reason,
          )
        : data?.message
          ? String(
              data.message,
            )
          : null,
  };
}

async function readFunctionError(
  error: any,
) {
  try {
    const context =
      error?.context;

    if (
      context instanceof
      Response
    ) {
      const text =
        await context
          .clone()
          .text();

      if (text) {
        try {
          const parsed =
            JSON.parse(
              text,
            );

          if (
            typeof parsed?.error ===
              'string' &&
            parsed.error.trim()
          ) {
            return parsed.error.trim();
          }
        } catch {
          return text.slice(
            0,
            500,
          );
        }
      }
    }
  } catch {
    // no-op
  }

  return (
    error?.message ||
    'Fenoloji iklim düzeltmesi alınamadı.'
  );
}

function fieldId(
  field: any,
) {
  const id =
    String(
      field?.id ??
      '',
    ).trim();

  if (!id) {
    throw new Error(
      'Fenoloji iklim düzeltmesi için tarla kimliği bulunamadı.',
    );
  }

  return id;
}

function normalizeCurrentDate(
  value:
    | string
    | Date
    | null
    | undefined,
) {
  if (!value) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return undefined;
  }

  return date
    .toISOString()
    .slice(0, 10);
}

/**
 * Fenoloji iklim sinyalinde koordinat, ürün ve sezon bilgisi artık
 * tarayıcıdan gönderilmez. Edge Function yalnızca field_id kabul eder,
 * kullanıcı sahipliğini doğrular ve konum/ürün/sezon kaydını sunucuda çözer.
 *
 * Böylece Pusula sentezi aynı tarla için client state'e göre değişen ikinci
 * bir gerçeklik üretmez. Termal çıktı yine yalnız iklim kaydırma sinyalidir;
 * BBCH/gelişim evresi bu servis tarafından uydurulmaz.
 */
export async function fetchPhenologyClimateShift(
  field: any,
  options?: {
    currentDate?:
      | string
      | Date
      | null;
  },
): Promise<PhenologyClimateShiftResult> {
  if (!supabase) {
    throw new Error(
      'Fenoloji iklim bağlantısı hazır değil.',
    );
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'field-phenology-context',
      {
        body: {
          field_id:
            fieldId(field),

          current_date:
            normalizeCurrentDate(
              options?.currentDate,
            ),
        },
      },
    );

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
      ),
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ??
      'Fenoloji bağlamı alınamadı.',
    );
  }

  const climate =
    data?.thermal_calendar;

  if (
    !climate ||
    climate?.success === false
  ) {
    throw new Error(
      climate?.message ??
      'Fenoloji iklim düzeltmesi alınamadı.',
    );
  }

  return normalizeResult(
    climate,
  );
}
