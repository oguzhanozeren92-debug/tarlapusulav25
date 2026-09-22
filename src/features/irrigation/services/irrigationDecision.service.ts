import {
  supabase,
} from '../../../supabaseClient';

import {
  loadIrrigationContext,
} from './irrigationContext.service';

import {
  calculateCropWaterUse,
} from './cropWaterUse.service';

import {
  calculateRootZoneWaterCapacity,
} from './rootZoneWater.service';

import {
  loadIrrigationClimateContext,
} from './irrigationClimate.service';

import type {
  IrrigationDecisionCode,
  IrrigationDecisionConfidence,
  IrrigationDecisionDay,
  IrrigationDecisionResult,
  RainfedStressAssessment,
} from '../types/irrigationDecision';

const OPEN_METEO_FORECAST =
  'https://api.open-meteo.com/v1/forecast';

const MAX_BALANCE_LOOKBACK_DAYS =
  92;

/*
  v1 etkili yağış planlama katsayısı.

  Yağışın tamamını kök bölgesine girmiş kabul etmek
  fazla iyimser olabileceği için %80 kullanılır.
  Toprak nem sensörü / yerel runoff modeli geldiğinde
  bu yaklaşım değiştirilebilir.
*/
const EFFECTIVE_RAIN_FACTOR =
  0.80;

function finiteNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function round2(
  value:
    | number
    | null,
) {
  return value === null
    ? null
    : Number(
        value.toFixed(2),
      );
}

function round3(
  value:
    | number
    | null,
) {
  return value === null
    ? null
    : Number(
        value.toFixed(3),
      );
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function isoToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function daysBetween(
  startIso: string,
  endIso: string,
) {
  const start =
    Date.parse(
      `${startIso}T00:00:00Z`,
    );

  const end =
    Date.parse(
      `${endIso}T00:00:00Z`,
    );

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (end - start) /
      86400000,
    ),
  );
}

function effectiveRainMm(
  precipitationMm: number,
) {
  return Math.max(
    0,
    precipitationMm *
      EFFECTIVE_RAIN_FACTOR,
  );
}

function buildDisplay(
  decision:
    IrrigationDecisionCode,
  fieldName:
    string | null,
  currentDeficitMm:
    number | null,
  stressThresholdMm:
    number | null,
  daysToStressThreshold:
    number | null,
  netWaterMm:
    number | null,
  totalNetWaterM3:
    number | null,
) {
  const field =
    fieldName ||
    'Seçili tarla';

  if (
    decision ===
    'needs_data'
  ) {
    return {
      headline:
        'Sulama Kararı İçin Veri Gerekli',

      summary:
        `${field} için bitki su tüketimi ve toprak kapasitesi değerlendirildi; ancak güvenilir bir su dengesi başlangıcı eksik.`,

      action:
        'Sulama durumunu ve son sulama kaydını tamamla.',

      waterLabel:
        null,
    };
  }

  if (
    decision ===
    'rainfed_monitoring'
  ) {
    return {
      headline:
        'Susuz Tarla · Su Stresi Takibi',

      summary:
        `${field} susuz olarak kayıtlı. Sistem sulama miktarı önermek yerine yağış ve su stresi riskini takip eder.`,

      action:
        'Yağış ve bitki stresini takip et.',

      waterLabel:
        null,
    };
  }

  if (
    decision ===
    'irrigate_now'
  ) {
    return {
      headline:
        'Sulama Gerekli',

      summary:
        `Tahmini kök bölgesi su açığı ${currentDeficitMm?.toFixed(1) ?? '—'} mm ile stres eşiğine ulaştı veya geçti.`,

      action:
        netWaterMm !== null
          ? `Kök bölgesine yaklaşık ${netWaterMm.toFixed(1)} mm net su ulaştırmayı planla.`
          : 'Sulamayı planla.',

      waterLabel:
        netWaterMm !== null
          ? `${netWaterMm.toFixed(1)} mm net${totalNetWaterM3 !== null ? ` · yaklaşık ${totalNetWaterM3.toFixed(0)} m³ toplam` : ''}`
          : null,
    };
  }

  if (
    decision ===
    'irrigation_approaching'
  ) {
    return {
      headline:
        'Sulama Zamanı Yaklaşıyor',

      summary:
        daysToStressThreshold !==
          null
          ? `Mevcut hava tahminine göre stres eşiğine yaklaşık ${daysToStressThreshold} gün içinde ulaşılabilir.`
          : 'Kök bölgesi su açığı stres eşiğine yaklaşıyor.',

      action:
        'Sulama hazırlığını yap; hava ve yağış tahminini tekrar kontrol et.',

      waterLabel:
        stressThresholdMm !==
          null
          ? `Stres eşiği: ${stressThresholdMm.toFixed(1)} mm açık`
          : null,
    };
  }

  return {
    headline:
      'Şimdilik Sulama Bekleyebilir',

    summary:
      `Kök bölgesi su açığı henüz stres eşiğinin altında.`,

    action:
      'Yağış ve bitki su tüketimini izlemeye devam et.',

    waterLabel:
      currentDeficitMm !==
        null &&
      stressThresholdMm !==
        null
        ? `Mevcut açık: ${currentDeficitMm.toFixed(1)} / ${stressThresholdMm.toFixed(1)} mm`
        : null,
  };
}

async function fetchBalanceWeather(
  latitude: number,
  longitude: number,
  pastDays: number,
) {
  const params =
    new URLSearchParams({
      latitude:
        latitude.toFixed(5),

      longitude:
        longitude.toFixed(5),

      daily:
        [
          'et0_fao_evapotranspiration',
          'precipitation_sum',
        ].join(','),

      timezone:
        'UTC',

      past_days:
        String(
          Math.max(
            1,
            Math.min(
              MAX_BALANCE_LOOKBACK_DAYS,
              pastDays,
            ),
          ),
        ),

      forecast_days:
        '5',
    });

  const response =
    await fetch(
      `${OPEN_METEO_FORECAST}?${params.toString()}`,
    );

  if (!response.ok) {
    throw new Error(
      `Sulama su dengesi hava verisi alınamadı. Open-Meteo ${response.status}.`,
    );
  }

  const payload =
    await response.json();

  const dates =
    Array.isArray(
      payload?.daily?.time,
    )
      ? payload.daily.time
      : [];

  const eto =
    Array.isArray(
      payload
        ?.daily
        ?.et0_fao_evapotranspiration,
    )
      ? payload.daily
          .et0_fao_evapotranspiration
      : [];

  const rain =
    Array.isArray(
      payload
        ?.daily
        ?.precipitation_sum,
    )
      ? payload.daily
          .precipitation_sum
      : [];

  return dates.map(
    (
      date: string,
      index: number,
    ) => ({
      date:
        String(date),

      etoMm:
        finiteNumber(
          eto[index],
        ),

      precipitationMm:
        finiteNumber(
          rain[index],
        ),
    }),
  );
}

function findDaysToThreshold(
  forecast:
    IrrigationDecisionDay[],
) {
  const index =
    forecast.findIndex(
      (day) =>
        day.thresholdReached,
    );

  return index >= 0
    ? index
    : null;
}

function resolveDecision(
  currentDeficitMm: number,
  stressThresholdMm: number,
  forecast:
    IrrigationDecisionDay[],
) :
  IrrigationDecisionCode {
  if (
    currentDeficitMm >=
    stressThresholdMm
  ) {
    return 'irrigate_now';
  }

  const ratio =
    stressThresholdMm > 0
      ? currentDeficitMm /
        stressThresholdMm
      : 0;

  const daysToThreshold =
    findDaysToThreshold(
      forecast,
    );

  if (
    ratio >= 0.80 ||
    (
      daysToThreshold !==
        null &&
      daysToThreshold <= 2
    )
  ) {
    return 'irrigation_approaching';
  }

  return 'wait';
}


function calculateRainfedStressAssessment(
  climate: any,
  kc: number | null,
  stressThresholdMm: number | null,
): RainfedStressAssessment {
  const pastDays =
    Array.isArray(
      climate?.past7Days?.days,
    )
      ? climate.past7Days.days
      : [];

  const forecastDays =
    Array.isArray(
      climate?.forecast5Days?.days,
    )
      ? climate.forecast5Days.days
      : [];

  const past7DayPrecipitationMm =
    finiteNumber(
      climate?.past7Days
        ?.precipitationMm,
    );

  const forecast5DayPrecipitationMm =
    finiteNumber(
      climate?.forecast5Days
        ?.precipitationMm,
    );

  const summarize =
    (days: any[]) => {
      let cropWaterUseMm =
        0;
      let effectiveRainTotalMm =
        0;
      let validDayCount =
        0;

      for (
        const day
        of days
      ) {
        const eto =
          finiteNumber(
            day?.etoMm,
          );

        const rain =
          finiteNumber(
            day?.precipitationMm,
          );

        if (
          eto === null ||
          rain === null ||
          kc === null
        ) {
          continue;
        }

        cropWaterUseMm +=
          Math.max(
            0,
            eto * kc,
          );

        effectiveRainTotalMm +=
          effectiveRainMm(
            Math.max(
              0,
              rain,
            ),
          );

        validDayCount +=
          1;
      }

      const climateDeficitMm =
        validDayCount > 0
          ? Math.max(
              0,
              cropWaterUseMm -
                effectiveRainTotalMm,
            )
          : null;

      return {
        cropWaterUseMm:
          validDayCount > 0
            ? round2(
                cropWaterUseMm,
              )
            : null,

        effectiveRainMm:
          validDayCount > 0
            ? round2(
                effectiveRainTotalMm,
              )
            : null,

        climateDeficitMm:
          climateDeficitMm ===
            null
            ? null
            : round2(
                climateDeficitMm,
              ),

        validDayCount,
      };
    };

  const past =
    summarize(
      pastDays,
    );

  const future =
    summarize(
      forecastDays,
    );

  /*
    Rainfed tarlada başlangıç toprak suyu bilinmediği için "mevcut toprak
    su açığı" üretmiyoruz. Bunun yerine son 7 gün + önümüzdeki 5 gün boyunca
    ETc ile etkili yağış arasındaki net iklim baskısını RAW stres eşiğine
    oranlıyoruz. Bu yalnızca erken uyarı/risk göstergesidir.
  */
  const enoughData =
    kc !== null &&
    stressThresholdMm !==
      null &&
    stressThresholdMm > 0 &&
    past.validDayCount >=
      4 &&
    future.validDayCount >=
      3;

  const combinedClimatePressureMm =
    enoughData &&
    past.cropWaterUseMm !==
      null &&
    past.effectiveRainMm !==
      null &&
    future.cropWaterUseMm !==
      null &&
    future.effectiveRainMm !==
      null
      ? round2(
          Math.max(
            0,
            past.cropWaterUseMm +
              future.cropWaterUseMm -
              past.effectiveRainMm -
              future.effectiveRainMm,
          ),
        )
      : null;

  const pressureRatio =
    combinedClimatePressureMm !==
      null &&
    stressThresholdMm !==
      null &&
    stressThresholdMm > 0
      ? round3(
          combinedClimatePressureMm /
            stressThresholdMm,
        )
      : null;

  const riskLevel:
    RainfedStressAssessment['riskLevel'] =
    pressureRatio ===
      null
      ? 'unknown'
      : pressureRatio >=
          1
        ? 'high'
        : pressureRatio >=
            0.80
          ? 'elevated'
          : 'normal';

  const nextMeaningfulRain =
    climate
      ?.forecast5Days
      ?.nextMeaningfulRain;

  return {
    riskLevel,
    pressureRatio,

    past7DayPrecipitationMm,

    past7DayCropWaterUseMm:
      past.cropWaterUseMm,

    past7DayEffectiveRainMm:
      past.effectiveRainMm,

    past7DayClimateDeficitMm:
      past.climateDeficitMm,

    forecast5DayPrecipitationMm,

    forecast5DayCropWaterUseMm:
      future.cropWaterUseMm,

    forecast5DayEffectiveRainMm:
      future.effectiveRainMm,

    forecast5DayClimateDeficitMm:
      future.climateDeficitMm,

    combinedClimatePressureMm,

    validPastDayCount:
      past.validDayCount,

    validForecastDayCount:
      future.validDayCount,

    nextMeaningfulRain:
      nextMeaningfulRain &&
      finiteNumber(
        nextMeaningfulRain
          ?.precipitationMm,
      ) !== null
        ? {
            date:
              String(
                nextMeaningfulRain
                  .date,
              ),

            precipitationMm:
              finiteNumber(
                nextMeaningfulRain
                  .precipitationMm,
              )!,
          }
        : null,

    basis:
      'climate_water_balance_not_soil_moisture',
  };
}

export async function calculateIrrigationDecision(
  field:
    | {
        id?: unknown;
      }
    | null
    | undefined,
): Promise<IrrigationDecisionResult> {
  if (
    field?.id ===
      null ||
    field?.id ===
      undefined ||
    String(
      field.id,
    ).trim() ===
      ''
  ) {
    throw new Error(
      'Sulama kararı için tarla kimliği bulunamadı.',
    );
  }

  const fieldId =
    String(
      field.id,
    );

  const [
    irrigation,
    cropWaterUse,
    rootZone,
    climate,
  ] =
    await Promise.all([
      loadIrrigationContext({
        id: fieldId,
      }),

      calculateCropWaterUse({
        id: fieldId,
      }),

      calculateRootZoneWaterCapacity({
        id: fieldId,
      }),

      loadIrrigationClimateContext({
        id: fieldId,
      }),
    ]);

  const warnings:
    string[] = [];

  const missing:
    string[] = [];

  const reasons:
    string[] = [];

  const irrigationStatus =
    irrigation
      .irrigationStatus;

  if (
    irrigationStatus ===
    'unknown'
  ) {
    missing.push(
      'irrigation_status',
    );
  }

  const rootZoneStorageMm =
    rootZone
      .totalAvailableWaterMm;

  const stressThresholdMm =
    rootZone
      .depletion
      .readilyAvailableWaterMm;

  if (
    rootZoneStorageMm ===
      null ||
    stressThresholdMm ===
      null
  ) {
    missing.push(
      'root_zone_capacity',
    );
  }

  const kc =
    cropWaterUse
      .coefficient
      .kc;

  if (
    cropWaterUse.status !==
      'usable' ||
    kc ===
      null
  ) {
    missing.push(
      'crop_water_use',
    );
  }

  const lastIrrigationDate =
    irrigation
      .lastIrrigation
      ?.date ??
    null;

  const lastIrrigationAppliedMm =
    irrigation
      .lastIrrigation
      ?.appliedWaterMm ??
    null;

  if (
    irrigationStatus !==
      'rainfed'
  ) {
    if (!lastIrrigationDate) {
      missing.push(
        'last_irrigation',
      );
    }

    if (
      lastIrrigationDate &&
      lastIrrigationAppliedMm ===
        null
    ) {
      missing.push(
        'last_irrigation_amount',
      );
    }
  }

  if (
    irrigationStatus ===
    'rainfed'
  ) {
    const rainfedStress =
      calculateRainfedStressAssessment(
        climate,
        kc,
        stressThresholdMm,
      );

    const riskLevel =
      rainfedStress
        .riskLevel;

    const riskIsElevated =
      riskLevel ===
        'elevated' ||
      riskLevel ===
        'high';

    const fieldLabel =
      irrigation.fieldName ||
      'Seçili tarla';

    const pastDeficitMm =
      rainfedStress
        .past7DayClimateDeficitMm;

    const forecastDeficitMm =
      rainfedStress
        .forecast5DayClimateDeficitMm;

    const pastUseMm =
      rainfedStress
        .past7DayCropWaterUseMm;

    const pastRainMm =
      rainfedStress
        .past7DayEffectiveRainMm;

    const forecastUseMm =
      rainfedStress
        .forecast5DayCropWaterUseMm;

    const forecastRainMm =
      rainfedStress
        .forecast5DayEffectiveRainMm;

    const pastSurplusMm =
      pastUseMm !== null &&
      pastRainMm !== null
        ? round2(
            Math.max(
              0,
              pastRainMm -
                pastUseMm,
            ),
          )
        : null;

    const forecastSurplusMm =
      forecastUseMm !== null &&
      forecastRainMm !== null
        ? round2(
            Math.max(
              0,
              forecastRainMm -
                forecastUseMm,
            ),
          )
        : null;

    const pastInterpretation =
      pastDeficitMm !== null
        ? pastDeficitMm >=
            0.5
          ? `Son 7 günde yağış, bitkinin tahmini su ihtiyacını yaklaşık ${pastDeficitMm.toFixed(1)} mm karşılayamadı`
          : pastSurplusMm !==
                null &&
              pastSurplusMm >=
                0.5
            ? `Son 7 günde yağış, bitkinin tahmini su ihtiyacının yaklaşık ${pastSurplusMm.toFixed(1)} mm üzerinde kaldı`
            : 'Son 7 günde yağış ile bitkinin tahmini su ihtiyacı birbirine yakın seyretti'
        : '';

    const forecastInterpretation =
      forecastDeficitMm !==
        null
        ? forecastDeficitMm >=
            0.5
          ? `Önümüzdeki 5 günde yağışın bitkinin tahmini su ihtiyacını yaklaşık ${forecastDeficitMm.toFixed(1)} mm karşılayamaması bekleniyor`
          : forecastSurplusMm !==
                null &&
              forecastSurplusMm >=
                0.5
            ? `Önümüzdeki 5 günde yağışın bitkinin tahmini su ihtiyacının yaklaşık ${forecastSurplusMm.toFixed(1)} mm üzerinde kalması bekleniyor`
            : 'Önümüzdeki 5 günde yağış ile bitkinin tahmini su ihtiyacının birbirine yakın olması bekleniyor'
        : '';

    const nextRainInterpretation =
      rainfedStress
        .nextMeaningfulRain
        ? `${rainfedStress.nextMeaningfulRain.date} için ${rainfedStress.nextMeaningfulRain.precipitationMm.toFixed(1)} mm anlamlı yağış tahmini var`
        : forecastRainMm !==
              null &&
            forecastRainMm <
              0.5
          ? 'Önümüzdeki 5 günde anlamlı yağış görünmüyor'
          : '';

    const climateInterpretation =
      [
        pastInterpretation,
        forecastInterpretation,
        nextRainInterpretation,
      ]
        .filter(Boolean)
        .join('. ');

    /*
      Risk seviyesi hesaplanamasa bile ham yağış bilgisini kullanıcıdan saklama.
      Bu değerler doğrudan Open-Meteo toplam yağışıdır; "etkili yağış" veya
      "toprakta kalan su" gibi sunulmaz.
    */
    const past7DayRawRainMm =
      rainfedStress
        .past7DayPrecipitationMm;

    const forecast5DayRawRainMm =
      rainfedStress
        .forecast5DayPrecipitationMm;

    const rawRainInterpretation =
      [
        past7DayRawRainMm !==
          null
          ? `Son 7 günde ${past7DayRawRainMm.toFixed(1)} mm yağış kaydedildi`
          : '',
        forecast5DayRawRainMm !==
          null
          ? `önümüzdeki 5 günde ${forecast5DayRawRainMm.toFixed(1)} mm yağış bekleniyor`
          : '',
        rainfedStress
          .nextMeaningfulRain
          ? `${rainfedStress.nextMeaningfulRain.date} için ${rainfedStress.nextMeaningfulRain.precipitationMm.toFixed(1)} mm anlamlı yağış tahmini var`
          : '',
      ]
        .filter(Boolean)
        .join('. ');

    const unknownRiskMissing:
      string[] = [];

    if (kc === null) {
      unknownRiskMissing.push(
        'bitkinin türü ve gelişim durumu',
      );
    }

    if (
      stressThresholdMm ===
      null
    ) {
      unknownRiskMissing.push(
        'kök bölgesi stres eşiği',
      );
    }

    if (
      rainfedStress
        .validPastDayCount <
      4
    ) {
      unknownRiskMissing.push(
        'geçmiş ET₀ + yağış',
      );
    }

    if (
      rainfedStress
        .validForecastDayCount <
      3
    ) {
      unknownRiskMissing.push(
        '5 günlük ET₀ + yağış tahmini',
      );
    }

    const unknownRiskSuffix =
      unknownRiskMissing.length >
      0
        ? ` Ürün bazlı su stresi puanı için eksik: ${unknownRiskMissing.join(', ')}.`
        : '';

    const riskHeadline =
      riskLevel ===
        'high'
        ? 'Su Stresi Riski Yüksek'
        : riskLevel ===
            'elevated'
          ? 'Su Stresi Riski Yükseliyor'
          : riskLevel ===
              'normal'
            ? 'Susuz Tarla · Şimdilik Risk Düşük'
            : 'Susuz Tarla · Yağış Dengesi';

    const riskStatusSentence =
      riskLevel ===
        'high'
        ? 'Su stresi riski yüksek.'
        : riskLevel ===
            'elevated'
          ? 'Su stresi riski yükseliyor.'
          : riskLevel ===
              'normal'
            ? 'Şu an stres riski düşük.'
            : '';

    const riskSummary =
      riskLevel ===
        'unknown'
        ? rawRainInterpretation
          ? `${fieldLabel}: ${rawRainInterpretation}.${unknownRiskSuffix}`
          : `${fieldLabel} susuz olarak kayıtlı.${unknownRiskSuffix || ' Yağış verisi henüz yeterli değil.'}`
        : climateInterpretation
          ? `${fieldLabel}: ${climateInterpretation}. ${riskStatusSentence}`.trim()
          : riskIsElevated
            ? `${fieldLabel}: Yağış, bitkinin tahmini su ihtiyacını karşılamakta zorlanıyor. ${riskStatusSentence}`.trim()
            : `${fieldLabel}: Yağış ve tahmini su ihtiyacı şu an kritik bir stres işareti göstermiyor. ${riskStatusSentence}`.trim();

    const riskAction =
      riskLevel ===
        'high'
        ? 'Tarlayı kontrol et; yapraklarda solma, kıvrılma veya belirgin stres varsa mümkünse toprak nemini de doğrula.'
        : riskLevel ===
            'elevated'
          ? 'Yağışı yakından izle; tarlada bitkinin görünümünü ve mümkünse toprak nemini kontrol et.'
          : riskLevel ===
              'normal'
            ? forecastDeficitMm !==
                  null &&
                forecastDeficitMm >=
                  0.5
              ? 'Şimdilik alarm yok. Yağışın gerçekleşip gerçekleşmediğini ve bitkide stres belirtisi olup olmadığını izle.'
              : 'Şimdilik alarm yok. Yağışı ve bitkinin durumunu izlemeye devam et.'
            : forecast5DayRawRainMm !==
                  null &&
                forecast5DayRawRainMm <
                  0.5
              ? 'Önümüzdeki 5 günde anlamlı yağış görünmüyor. Bitkide stres belirtisi olup olmadığını kontrol et.'
              : 'Tahmin edilen yağışın gerçekleşip gerçekleşmediğini ve bitkinin durumunu izle.';

    const reasonsForRainfed:
      string[] = [
        'Tarla susuz/rainfed olarak kayıtlı.',
      ];

    if (
      past7DayRawRainMm !==
      null
    ) {
      reasonsForRainfed.push(
        `Son 7 gün toplam yağış ${past7DayRawRainMm.toFixed(1)} mm.`,
      );
    }

    if (
      forecast5DayRawRainMm !==
      null
    ) {
      reasonsForRainfed.push(
        `Önümüzdeki 5 gün toplam yağış tahmini ${forecast5DayRawRainMm.toFixed(1)} mm.`,
      );
    }

    if (
      rainfedStress
        .past7DayCropWaterUseMm !==
        null &&
      rainfedStress
        .past7DayEffectiveRainMm !==
        null
    ) {
      reasonsForRainfed.push(
        `Son 7 gün tahmini ürün su tüketimi ${rainfedStress.past7DayCropWaterUseMm.toFixed(1)} mm, etkili yağış ${rainfedStress.past7DayEffectiveRainMm.toFixed(1)} mm.`,
      );
    }

    if (
      rainfedStress
        .forecast5DayCropWaterUseMm !==
        null &&
      rainfedStress
        .forecast5DayEffectiveRainMm !==
        null
    ) {
      reasonsForRainfed.push(
        `Önümüzdeki 5 gün tahmini ürün su tüketimi ${rainfedStress.forecast5DayCropWaterUseMm.toFixed(1)} mm, etkili yağış ${rainfedStress.forecast5DayEffectiveRainMm.toFixed(1)} mm.`,
      );
    }

    if (
      rainfedStress
        .combinedClimatePressureMm !==
        null &&
      stressThresholdMm !==
        null
    ) {
      reasonsForRainfed.push(
        `12 günlük iklim-temelli su baskısı ${rainfedStress.combinedClimatePressureMm.toFixed(1)} mm; kök bölgesi stres eşiği ${stressThresholdMm.toFixed(1)} mm.`,
      );
    }

    if (
      rainfedStress
        .nextMeaningfulRain
    ) {
      reasonsForRainfed.push(
        `Tahminde anlamlı yağış: ${rainfedStress.nextMeaningfulRain.date}, ${rainfedStress.nextMeaningfulRain.precipitationMm.toFixed(1)} mm.`,
      );
    }

    return {
      fieldId,
      fieldName:
        irrigation.fieldName,
      cropName:
        irrigation.cropName,
      decision:
        'rainfed_monitoring',
      confidence:
        riskLevel ===
          'unknown'
          ? 'low'
          : 'medium',
      irrigationStatus,
      irrigationMethod: irrigation.irrigationMethod,
      currentKc: cropWaterUse.coefficient.status === 'usable' ? kc : null,
      waterBalance: {
        currentDeficitMm:
          null,
        stressThresholdMm:
          stressThresholdMm,
        rootZoneStorageMm:
          rootZoneStorageMm,
        currentDeficitRatio:
          null,
        projected5DayDeficitMm:
          null,
        daysToStressThreshold:
          null,
        lastIrrigationDate:
          null,
        lastIrrigationAppliedMm:
          null,
        baselineAssumption:
          null,
      },
      rainfedStress,
      recommendation: {
        netWaterMm:
          null,
        totalNetWaterM3:
          null,
        irrigationEfficiencyApplied:
          false,
        grossWaterMm:
          null,
        totalGrossWaterM3:
          null,
      },
      forecast: [],
      display: {
        headline:
          riskHeadline,
        summary:
          riskSummary,
        action:
          riskAction,
        waterLabel:
          rainfedStress
            .pressureRatio !==
            null
            ? `İklim baskısı: %${Math.round(rainfedStress.pressureRatio * 100)}`
            : null,
      },
      reasons:
        reasonsForRainfed,
      missing:
        riskLevel ===
          'unknown'
          ? [
              ...(
                kc === null
                  ? ['crop_water_use']
                  : []
              ),
              ...(
                stressThresholdMm ===
                  null
                  ? ['root_zone_capacity']
                  : []
              ),
              ...(
                rainfedStress
                  .validPastDayCount <
                  4 ||
                rainfedStress
                  .validForecastDayCount <
                  3
                  ? ['rainfed_climate_window']
                  : []
              ),
            ]
          : [],
      warnings: [
        'Susuz tarlada bu motor otomatik sulama miktarı önermez.',
        'Rainfed su stresi uyarısı gerçek toprak nemi ölçümü değildir; ETc ve etkili yağıştan üretilen iklim-temelli erken uyarıdır.',
        ...climate.warnings,
      ],
      generatedAt:
        new Date()
          .toISOString(),
    };
  }

  if (
    missing.length > 0
  ) {
    const display =
      buildDisplay(
        'needs_data',
        irrigation.fieldName,
        null,
        stressThresholdMm,
        null,
        null,
        null,
      );

    return {
      fieldId,
      fieldName:
        irrigation.fieldName,
      cropName:
        irrigation.cropName,
      decision:
        'needs_data',
      confidence:
        'low',
      irrigationStatus,
      irrigationMethod: irrigation.irrigationMethod,
      currentKc: cropWaterUse.coefficient.status === 'usable' ? kc : null,
      waterBalance: {
        currentDeficitMm:
          null,
        stressThresholdMm,
        rootZoneStorageMm,
        currentDeficitRatio:
          null,
        projected5DayDeficitMm:
          null,
        daysToStressThreshold:
          null,
        lastIrrigationDate,
        lastIrrigationAppliedMm,
        baselineAssumption:
          null,
      },
      rainfedStress:
        null,
      recommendation: {
        netWaterMm:
          null,
        totalNetWaterM3:
          null,
        irrigationEfficiencyApplied:
          false,
        grossWaterMm:
          null,
        totalGrossWaterM3:
          null,
      },
      forecast: [],
      display,
      reasons,
      missing,
      warnings: [
        ...irrigation.warnings,
        ...cropWaterUse.warnings,
        ...rootZone.warnings,
      ],
      generatedAt:
        new Date()
          .toISOString(),
    };
  }

  const today =
    isoToday();

  const lookbackDays =
    daysBetween(
      lastIrrigationDate!,
      today,
    );

  if (
    lookbackDays ===
      null
  ) {
    throw new Error(
      'Son sulama tarihi okunamadı.',
    );
  }

  if (
    lookbackDays >
    MAX_BALANCE_LOOKBACK_DAYS
  ) {
    missing.push(
      'recent_water_baseline',
    );

    const display =
      buildDisplay(
        'needs_data',
        irrigation.fieldName,
        null,
        stressThresholdMm,
        null,
        null,
        null,
      );

    return {
      fieldId,
      fieldName:
        irrigation.fieldName,
      cropName:
        irrigation.cropName,
      decision:
        'needs_data',
      confidence:
        'low',
      irrigationStatus,
      irrigationMethod: irrigation.irrigationMethod,
      currentKc: cropWaterUse.coefficient.status === 'usable' ? kc : null,
      waterBalance: {
        currentDeficitMm:
          null,
        stressThresholdMm,
        rootZoneStorageMm,
        currentDeficitRatio:
          null,
        projected5DayDeficitMm:
          null,
        daysToStressThreshold:
          null,
        lastIrrigationDate,
        lastIrrigationAppliedMm,
        baselineAssumption:
          null,
      },
      rainfedStress:
        null,
      recommendation: {
        netWaterMm:
          null,
        totalNetWaterM3:
          null,
        irrigationEfficiencyApplied:
          false,
        grossWaterMm:
          null,
        totalGrossWaterM3:
          null,
      },
      forecast: [],
      display,
      reasons,
      missing,
      warnings: [
        `Son sulama kaydı ${MAX_BALANCE_LOOKBACK_DAYS} günden eski. Yeni bir su dengesi başlangıcı gerekli.`,
      ],
      generatedAt:
        new Date()
          .toISOString(),
    };
  }

  const latitude =
    climate.location.latitude;

  const longitude =
    climate.location.longitude;

  const weather =
    await fetchBalanceWeather(
      latitude,
      longitude,
      Math.max(
        1,
        lookbackDays + 1,
      ),
    );

  /*
    Baseline varsayımı:
    Son kayıtlı sulama sonrası kök bölgesi
    tarla kapasitesine yakın kabul edilir.

    Bu gerçek sensör ölçümü değildir.
    Son sulama miktarı düşükse confidence azaltılır.
  */
  let currentDeficitMm =
    0;

  const historical =
    weather.filter(
      (day) =>
        day.date >
          lastIrrigationDate! &&
        day.date <
          today,
    );

  for (
    const day
    of historical
  ) {
    if (
      day.etoMm ===
        null ||
      day.precipitationMm ===
        null
    ) {
      continue;
    }

    const cropUse =
      day.etoMm *
      kc!;

    const effectiveRain =
      effectiveRainMm(
        day.precipitationMm,
      );

    currentDeficitMm =
      clamp(
        currentDeficitMm +
          cropUse -
          effectiveRain,
        0,
        rootZoneStorageMm!,
      );
  }

  currentDeficitMm =
    round2(
      currentDeficitMm,
    )!;

  const forecastRaw =
    weather.filter(
      (day) =>
        day.date >=
          today,
    )
      .slice(
        0,
        5,
      );

  const forecastHasMissingClimate =
    forecastRaw.some(
      (day) =>
        day.etoMm === null ||
        day.precipitationMm === null,
    );

  let runningDeficit =
    currentDeficitMm;

  const forecast:
    IrrigationDecisionDay[] =
    forecastHasMissingClimate
      ? []
      : forecastRaw.map(
          (day) => {
            // Eksik ET0/yağış sıfıra çevrilmez; aksi halde sahte su dengesi oluşur.
            const eto =
              day.etoMm!;

            const rain =
              day.precipitationMm!;

            const cropUse =
              eto *
              kc!;

            const effectiveRain =
              effectiveRainMm(
                rain,
              );

            runningDeficit =
              clamp(
                runningDeficit +
                  cropUse -
                  effectiveRain,
                0,
                rootZoneStorageMm!,
              );

            return {
              date:
                day.date,

              estimatedCropWaterUseMm:
                round2(
                  cropUse,
                )!,

              precipitationMm:
                round2(
                  rain,
                )!,

              effectiveRainMm:
                round2(
                  effectiveRain,
                )!,

              estimatedDeficitMm:
                round2(
                  runningDeficit,
                )!,

              thresholdReached:
                runningDeficit >=
                stressThresholdMm!,
            };
          },
        );

  if (forecastHasMissingClimate) {
    warnings.push(
      '5 günlük sulama projeksiyonu oluşturulmadı: en az bir günde ET0 veya yağış verisi eksik.',
    );
  }

  const projected5DayDeficitMm =
    forecast.length
      ? forecast[
          forecast.length - 1
        ].estimatedDeficitMm
      : currentDeficitMm;

  const daysToStressThreshold =
    findDaysToThreshold(
      forecast,
    );

  const decision =
    resolveDecision(
      currentDeficitMm,
      stressThresholdMm!,
      forecast,
    );

  const currentDeficitRatio =
    stressThresholdMm! > 0
      ? round3(
          currentDeficitMm /
          stressThresholdMm!,
        )
      : null;

  /*
    Net sulama:
    "irrigate_now" durumunda kök bölgesini
    tekrar tarla kapasitesine yaklaştırmak için
    mevcut tahmini açığı kapatma hedefidir.

    Sulama randımanı bilinmediği için gross miktar
    özellikle üretilmez.
  */
  const netWaterMm =
    decision ===
    'irrigate_now'
      ? round2(
          currentDeficitMm,
        )
      : null;

  const areaDecare =
    irrigation.areaDecare;

  const totalNetWaterM3 =
    netWaterMm !==
      null &&
    areaDecare !==
      null
      ? round2(
          netWaterMm *
          areaDecare,
        )
      : null;

  let confidence:
    IrrigationDecisionConfidence =
    'medium';

  if (
    lastIrrigationAppliedMm !==
      null &&
    stressThresholdMm !==
      null &&
    lastIrrigationAppliedMm <
      stressThresholdMm *
        0.50
  ) {
    confidence =
      'low';

    warnings.push(
      'Son sulamada verilen su, stres eşiğinin yarısından düşük görünüyor. “Sulama sonrası tarla kapasitesine yakın” baseline varsayımının güveni düşürüldü.',
    );
  }

  reasons.push(
    `Kök bölgesi yaklaşık su deposu: ${rootZoneStorageMm!.toFixed(1)} mm.`,
  );

  reasons.push(
    `Stres eşiği: ${stressThresholdMm!.toFixed(1)} mm açık.`,
  );

  reasons.push(
    `Son sulama: ${lastIrrigationDate}.`,
  );

  reasons.push(
    `Tahmini mevcut açık: ${currentDeficitMm.toFixed(1)} mm.`,
  );

  reasons.push(
    `Önümüzdeki 5 gün sonunda tahmini açık: ${projected5DayDeficitMm.toFixed(1)} mm.`,
  );

  const display =
    buildDisplay(
      decision,
      irrigation.fieldName,
      currentDeficitMm,
      stressThresholdMm,
      daysToStressThreshold,
      netWaterMm,
      totalNetWaterM3,
    );

  warnings.push(
    'Mevcut su açığı hesabı, son sulama sonrası kök bölgesinin tarla kapasitesine yakın olduğu varsayımıyla başlar.',
  );

  warnings.push(
    'Etkili yağış v1 planlama tahmini olarak toplam yağışın %80’i kabul edilmiştir.',
  );

  warnings.push(
    'Sulama sistemi randımanı bilinmediği için önerilen miktar NET sudur; pompalanacak/brüt su miktarı değildir.',
  );

  return {
    fieldId,

    fieldName:
      irrigation.fieldName,

    cropName:
      irrigation.cropName,

    decision,
    confidence,
    irrigationStatus,
    irrigationMethod: irrigation.irrigationMethod,

    currentKc: cropWaterUse.coefficient.status === 'usable' ? kc : null,

    waterBalance: {
      currentDeficitMm,

      stressThresholdMm,

      rootZoneStorageMm,

      currentDeficitRatio,

      projected5DayDeficitMm,

      daysToStressThreshold,

      lastIrrigationDate,

      lastIrrigationAppliedMm,

      baselineAssumption:
        'last_irrigation_refilled_root_zone',
    },

    rainfedStress:
      null,
    recommendation: {
      netWaterMm,

      totalNetWaterM3,

      irrigationEfficiencyApplied:
        false,

      grossWaterMm:
        null,

      totalGrossWaterM3:
        null,
    },

    forecast,

    display,
    reasons,
    missing,
    warnings,

    generatedAt:
      new Date()
        .toISOString(),
  };
}
