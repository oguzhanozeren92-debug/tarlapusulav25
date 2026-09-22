import type {
  HomeDecisionEngineInput,
  HomeDecisionEvent,
  HomeIrrigationDecisionSignal,
  HomePhenologySignal,
  HomeFieldOperationSignal,
  HomeQuickDecision,
} from '../types/homeDecision';
import { buildNutrientDecision } from '../../nutrition/services/buildNutrientDecision';
import { buildSoilWaterContext } from '../../irrigation/services/soilWaterContext.service';
import { buildHomeSatelliteDecision } from '../../satellite/services/buildHomeSatelliteDecision';
import { sprayWindowStartsSoon } from '../../weather/services/hourlySprayForecast';

const HOUR_MS = 60 * 60 * 1000;

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactText(value: unknown, maxLength: number): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function fullText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarTiming(dateMs: unknown, nowMs: number): string {
  const value = finiteNumber(dateMs);
  if (value == null) return 'Yaklaşıyor';

  const diffHours = (value - nowMs) / HOUR_MS;

  if (diffHours <= 2 && diffHours >= -2) return 'Bugün · yaklaşıyor';
  if (diffHours < 24 && diffHours >= -2) {
    return `Bugün · ${new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))}`;
  }
  if (diffHours < 48 && diffHours >= 0) return 'Yarın';

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function formatSatelliteDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function quickCopy(
  quick: HomeQuickDecision | null | undefined,
  fallbackTitle: string,
  fallbackDetail: string,
) {
  return {
    title: fullText(quick?.title) || fallbackTitle,
    detail: fullText(quick?.detail) || fallbackDetail,
    tone: compactText(quick?.tone, 20) || 'neutral',
  };
}

function normalizeOperationType(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function normalizeTaskAreaKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-');
}

function operationAgeDays(
  operation: HomeFieldOperationSignal | null | undefined,
  now: Date,
): number | null {
  if (!operation?.date) return null;

  const parsed = Date.parse(`${operation.date}T12:00:00`);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.floor((now.getTime() - parsed) / 86400000));
}

function latestOperation(
  operations: HomeFieldOperationSignal[] | null | undefined,
  type: string,
) {
  const wanted = normalizeOperationType(type);

  return (
    (operations ?? [])
      .filter((item) => normalizeOperationType(item.type) === wanted)
      .sort((a, b) => {
        const dateCompare = String(b.date ?? '').localeCompare(String(a.date ?? ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
      })[0] ?? null
  );
}

function decisionIncludesIrrigation(
  decision: HomeIrrigationDecisionSignal | null | undefined,
  operation: HomeFieldOperationSignal | null,
) {
  if (!decision || !operation?.date) return false;
  const decisionDate = String(decision.waterBalance?.lastIrrigationDate ?? '').trim();
  return Boolean(decisionDate && decisionDate >= operation.date);
}

function pushEvent(items: HomeDecisionEvent[], event: HomeDecisionEvent) {
  items.push(event);
}

function phenologyState(phenology: HomePhenologySignal | null | undefined) {
  const stage = String(phenology?.stage ?? '').trim();
  const dataStatus = String(phenology?.dataStatus ?? '').trim();
  const usable = Boolean(stage && stage !== 'unknown' && dataStatus === 'usable');
  const evidence = (phenology?.basis ?? [])
    .map((item) => fullText(item))
    .filter(Boolean)
    .slice(0, 4);
  const evidenceText = evidence.join(' ').toLocaleLowerCase('tr-TR');
  const sourceModel = evidenceText.includes('nasa harvest')
    ? evidenceText.includes('wofost') || evidenceText.includes('pcse')
      ? 'phenology-fusion:nasa-harvest+pcse'
      : 'nasa-harvest-crop-stage'
    : evidenceText.includes('wofost') || evidenceText.includes('pcse')
      ? 'pcse-wofost-phenology'
      : 'phenology';
  const confidence = phenology?.confidence === 'high'
    ? 'strong' as const
    : phenology?.confidence === 'medium'
      ? 'medium' as const
      : 'preliminary' as const;

  return {
    stage,
    stageLabel: compactText(phenology?.stageLabel, 38),
    usable,
    evidence,
    sourceModel,
    confidence,
    postHarvest: usable && stage === 'post_harvest',
    activeGrowth:
      usable &&
      [
        'establishment',
        'vegetative',
        'reproductive',
        'flowering',
        'fruit_set',
        'fruit_growth',
        'veraison',
      ].includes(stage),
  };
}

function irrigationEvent(
  fieldKey: string,
  dayKey: string,
  decision: HomeIrrigationDecisionSignal,
  nutrient: HomeDecisionEngineInput['nutrient'],
): HomeDecisionEvent | null {
  const code = String(decision.decision ?? '').trim();
  const headline = fullText(decision.display?.headline);
  const action = fullText(decision.display?.action);
  const summary = fullText(decision.display?.summary);
  const waterLabel = fullText(decision.display?.waterLabel);
  const netWaterMm = finiteNumber(decision.recommendation?.netWaterMm);
  const daysToThreshold = finiteNumber(decision.waterBalance?.daysToStressThreshold);
  let evidence = (decision.reasons ?? []).map((reason) => String(reason).trim()).filter(Boolean).slice(0, 5);
  const eventConfidence = decision.confidence === 'high'
    ? 'strong' as const
    : decision.confidence === 'medium'
      ? 'medium' as const
      : 'preliminary' as const;
  const hasPyFao = decision.modelEvidence?.status === 'ready';
  const hasAquaCrop = decision.seasonModelEvidence?.status === 'ready';
  let sourceModel = [
    'irrigation-engine',
    hasPyFao ? 'pyfao56-shadow' : '',
    hasAquaCrop ? 'aquacrop-pilot' : '',
  ].filter(Boolean).join('+');
  const soilWaterContext = buildSoilWaterContext(
    decision,
    nutrient?.soilIntelligence ?? null,
  );
  if (soilWaterContext?.evidence.length) {
    evidence = [...new Set([...evidence, ...soilWaterContext.evidence])].slice(0, 8);
  }
  if (soilWaterContext && soilWaterContext.status !== 'unavailable') {
    sourceModel = `${sourceModel}+${soilWaterContext.sourceModel}`;
  }

  if (code === 'irrigate_now') {
    return {
      id: `irrigation:${fieldKey}:irrigate-now:${dayKey}`,
      group: 'irrigation',
      source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
      priority: 112,
      severity: 'danger',
      target: 'irrigation_detail',
      channels: ['today', 'notification', 'pusula'],
      kind: 'do',
      label: 'SULAMA',
      title: headline || 'Sulama Gerekli',
      detail:
        waterLabel ||
        (netWaterMm != null ? `Yaklaşık ${netWaterMm.toFixed(1)} mm net su planla` : '') ||
        action ||
        summary ||
        'Kök bölgesi su açığı stres eşiğine ulaştı.',
      evidence,
      today: {
        tone: 'red',
        visual: 'irrigation',
        iconKey: 'water',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'danger',
      },
    };
  }

  if (code === 'irrigation_approaching') {
    return {
      id: `irrigation:${fieldKey}:approaching:${dayKey}`,
      group: 'irrigation',
      source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
      priority: 98,
      severity: 'warning',
      target: 'irrigation_detail',
      channels: ['today', 'notification', 'pusula'],
      kind: 'upcoming',
      label: 'SULAMA',
      title: headline || 'Sulama Zamanı Yaklaşıyor',
      detail:
        (daysToThreshold != null
          ? `Stres eşiğine yaklaşık ${Math.max(0, Math.round(daysToThreshold))} gün`
          : '') ||
        action ||
        summary ||
        'Kök bölgesi su açığı stres eşiğine yaklaşıyor.',
      evidence,
      today: {
        tone: 'amber',
        visual: 'irrigation',
        iconKey: 'water',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'warning',
      },
    };
  }

  if (code === 'needs_data') {
    const missing = Array.isArray(decision.missing) ? decision.missing : [];
    const missingInfoKind = missing.includes('irrigation_status')
      ? 'irrigation-status' as const
      : missing.includes('irrigation_method')
        ? 'irrigation-method' as const
        : missing.includes('last_irrigation')
          ? 'last-irrigation' as const
          : missing.some((item) => ['crop', 'season', 'planting_date', 'sowing_date'].includes(String(item)))
            ? 'season-profile' as const
            : undefined;
    const detail = missing.includes('irrigation_status')
      ? 'Sulu / Susuz durumunu tamamla'
      : missing.includes('last_irrigation')
        ? 'Son sulama kaydını ekle'
        : action || 'Eksik sulama verisini tamamla';

    return {
      id: `irrigation:${fieldKey}:needs-data`,
      group: 'irrigation',
      source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
      priority: 86,
      severity: 'info',
      target: 'home',
      channels: ['today', 'notification'],
      kind: 'data',
      missingInfoKind,
      label: 'SULAMA',
      title: 'Sulama Verisini Tamamla',
      detail,
      today: {
        tone: 'neutral',
        visual: 'irrigation',
        iconKey: 'water',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'info',
      },
    };
  }

  if (code === 'rainfed_monitoring') {
    const riskLevel = String(
      decision.rainfedStress?.riskLevel ?? 'unknown',
    ).trim();

    const pressureRatio = finiteNumber(
      decision.rainfedStress?.pressureRatio,
    );

    const combinedPressureMm = finiteNumber(
      decision.rainfedStress?.combinedClimatePressureMm,
    );

    const stressThresholdMm = finiteNumber(
      decision.waterBalance?.stressThresholdMm,
    );

    const riskIsHigh =
      riskLevel === 'high';

    const riskIsElevated =
      riskLevel === 'elevated' ||
      riskIsHigh;

    const riskEvidence =
      (
        combinedPressureMm != null &&
        stressThresholdMm != null
          ? `İklim baskısı ${combinedPressureMm.toFixed(1)} / ${stressThresholdMm.toFixed(1)} mm`
          : ''
      ) ||
      (
        pressureRatio != null
          ? `İklim-temelli su baskısı %${Math.round(pressureRatio * 100)}`
          : ''
      );

    const detail =
      riskIsElevated
        ? fullText(
            [
              summary,
              action,
            ]
              .filter(Boolean)
              .join(' '),
          ) ||
          riskEvidence ||
          'Su stresi riski yükseliyor; tarlayı sahada kontrol et.'
        : fullText(
            summary,
          ) ||
          riskEvidence ||
          action ||
          'Tarla susuz olarak kayıtlı; geçmiş ve gelecek yağış dengesini izle.';

    if (riskIsElevated) {
      return {
        id: `irrigation:${fieldKey}:rainfed-stress:${riskLevel}:${dayKey}`,
        group: 'irrigation',
        source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
        priority: riskIsHigh ? 106 : 94,
        severity: riskIsHigh ? 'danger' : 'warning',
        target: 'irrigation_detail',
        channels: ['today', 'notification', 'pusula'],
        kind: 'check',
        label: 'SU STRESİ',
        title:
          headline ||
          (
            riskIsHigh
              ? 'Su Stresi Riski Yüksek'
              : 'Su Stresi Riski Yükseliyor'
          ),
        detail,
        evidence,
        today: {
          tone: riskIsHigh ? 'red' : 'amber',
          visual: 'irrigation',
          iconKey: 'water',
          iconClass: 'water',
        },
        notification: {
          iconKey: 'rain',
          iconTone: 'cyan',
          dotTone: riskIsHigh ? 'danger' : 'warning',
        },
      };
    }

    return {
      id: `irrigation:${fieldKey}:rainfed:${dayKey}`,
      group: 'irrigation',
      source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
      priority: 70,
      severity: 'info',
      target: 'irrigation_detail',
      channels: ['today'],
      kind: 'check',
      label: 'SU TAKİBİ',
      title: headline || 'Su Stresini Takip Et',
      detail,
      today: {
        tone: 'blue',
        visual: 'irrigation',
        iconKey: 'water',
        iconClass: 'water',
      },
    };
  }

  if (code === 'wait') {
    return {
      id: `irrigation:${fieldKey}:wait:${dayKey}`,
      group: 'irrigation',
      source: 'irrigation',
      confidence: eventConfidence,
      sourceModel,
      priority: 64,
      severity: 'info',
      target: 'weather',
      channels: ['today'],
      kind: 'avoid',
      label: 'SULAMA',
      title: headline || 'Şimdilik Sulama Bekleyebilir',
      detail: waterLabel || action || summary || 'Su açığı henüz stres eşiğinin altında.',
      today: {
        tone: 'green',
        visual: 'irrigation',
        iconKey: 'water',
        iconClass: 'water',
      },
    };
  }

  return null;
}

/**
 * TarlaPusula Home Decision Engine
 *
 * Ham servisler burada çağrılmaz. Motor yalnızca normalize edilmiş gerçek
 * sinyalleri alır ve TEK bir kanonik olay akışı üretir. Bugün ve Bildirimler
 * bu akışın farklı görünümleridir; tarımsal kuralları yeniden hesaplamazlar.
 */
export function buildHomeDecisionEvents(
  input: HomeDecisionEngineInput,
): HomeDecisionEvent[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const dayKey = localDayKey(now);
  const fieldKey = String(input.fieldKey || 'home');
  const items: HomeDecisionEvent[] = [];

  const temperatureMin = finiteNumber(input.quickTemperatureMin);
  const temperature = finiteNumber(input.quickTemperature);
  const windKmh = finiteNumber(input.quickWindKmh);
  const rainChance = finiteNumber(input.quickRainChance);
  const rainMm = finiteNumber(input.quickRainMm);
  const phenology = phenologyState(input.phenology);
  const satelliteTrendEvent = buildHomeSatelliteDecision(
    String(input.homeFieldId ?? ''),
    input.satelliteTrend,
    phenology.activeGrowth,
    now,
  );
  if (satelliteTrendEvent) pushEvent(items, satelliteTrendEvent);
  const hasIrrigationDecision = Boolean(input.irrigationDecision?.decision);
  const latestIrrigationOperation = latestOperation(
    input.recentFieldOperations,
    'Sulama',
  );
  const latestFertilization = latestOperation(input.recentFieldOperations, 'Gübreleme');
  const nutrientEvent = buildNutrientDecision(
    String(input.homeFieldId ?? ''),
    input.homeFieldCrop,
    input.nutrient,
    latestFertilization != null,
  );
  if (nutrientEvent) pushEvent(items, nutrientEvent);
  const latestSprayingOperation = latestOperation(
    input.recentFieldOperations,
    'İlaçlama',
  );
  const irrigationOperationAge = operationAgeDays(
    latestIrrigationOperation,
    now,
  );
  const sprayingOperationAge = operationAgeDays(
    latestSprayingOperation,
    now,
  );
  const irrigationRecordedVeryRecently =
    irrigationOperationAge != null && irrigationOperationAge <= 1;
  const sprayingRecordedVeryRecently =
    sprayingOperationAge != null && sprayingOperationAge <= 2;
  const irrigationDecisionIsFresh = decisionIncludesIrrigation(
    input.irrigationDecision,
    latestIrrigationOperation,
  );

  if (input.weatherStatus === 'loading') {
    pushEvent(items, {
      id: `weather:${fieldKey}:loading:${dayKey}`,
      group: 'weather-status',
      source: 'weather',
      priority: 35,
      severity: 'info',
      target: 'weather',
      channels: ['today'],
      label: 'HAVA',
      title: 'Veriler Hazırlanıyor',
      detail: 'Bugünün koşulları kontrol ediliyor',
      today: {
        tone: 'neutral',
        visual: 'irrigation',
        iconKey: 'rain',
        iconClass: 'water',
      },
    });
  } else if (input.weatherStatus === 'error' || !input.hasUsableTodayWeather) {
    pushEvent(items, {
      id: `weather:${fieldKey}:error:${dayKey}`,
      group: 'weather-status',
      source: 'weather',
      priority: 100,
      severity: 'danger',
      target: 'weather',
      channels: ['today', 'notification'],
      label: 'HAVA',
      title: 'Hava Verisini Kontrol Et',
      detail: 'Hava verisi olmadan tarımsal karar verme',
      today: {
        tone: 'red',
        visual: 'spraying',
        iconKey: 'rain',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'danger',
      },
    });
  }

  if (temperatureMin != null && temperatureMin <= 3) {
    pushEvent(items, {
      id: `weather:${fieldKey}:frost:${dayKey}`,
      group: 'temperature-risk',
      source: 'weather',
      priority: 99,
      severity: 'danger',
      target: 'weather',
      channels: ['today', 'notification'],
      label: 'DON RİSKİ',
      title: 'Don Riskini Kontrol Et',
      detail: `Gece sıcaklığı ${Math.round(temperatureMin)}°C seviyesine inebilir`,
      today: {
        tone: 'blue',
        visual: 'irrigation',
        iconKey: 'rain',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'danger',
      },
    });
  }

  if (windKmh != null && windKmh >= 20 && !phenology.postHarvest && !input.hourlySprayWindow) {
    pushEvent(items, {
      id: `weather:${fieldKey}:wind:${dayKey}`,
      group: 'spraying',
      source: 'weather',
      priority: 96,
      severity: 'danger',
      target: 'spray_weather',
      channels: ['today', 'notification'],
      kind: 'avoid',
      label: 'İLAÇLAMA',
      title: 'İlaçlamayı Ertele',
      detail: `Rüzgâr ${Math.round(windKmh)} km/sa; uygulama için yüksek`,
      today: {
        tone: 'red',
        visual: 'spraying',
        iconKey: 'leaf-gold',
        iconClass: 'leaf',
      },
      notification: {
        iconKey: 'leaf',
        iconTone: 'gold',
        dotTone: 'danger',
      },
    });
  }

  const hourlyRisk = input.hourlySprayRisk;
  const upcomingSprayWindow = input.hourlySprayNextWindow;
  if (sprayWindowStartsSoon(upcomingSprayWindow, nowMs) && !phenology.postHarvest && !sprayingRecordedVeryRecently) {
    pushEvent(items, {
      id: `weather:${fieldKey}:spray-window:${upcomingSprayWindow!.from}`,
      group: 'spraying-window',
      source: 'weather',
      priority: 83,
      severity: 'info',
      target: 'spray_weather',
      channels: ['notification'],
      label: 'İLAÇLAMA HAVASI',
      title: 'İlaçlama için hava aralığı yaklaşıyor',
      detail: `${upcomingSprayWindow!.label} aralığı hava açısından değerlendirilebilir. İşlem öncesi tarlayı ve ürün etiketini kontrol et.`,
      notification: { iconKey: 'leaf', iconTone: 'green', dotTone: 'info' },
    });
  }
  if (hourlyRisk && (!upcomingSprayWindow || hourlyRisk.at >= upcomingSprayWindow.to) &&
      !phenology.postHarvest && hourlyRisk.at >= nowMs &&
      hourlyRisk.at - nowMs <= 3 * HOUR_MS) {
    pushEvent(items, {
      id: `weather:${fieldKey}:spray-hourly-risk:${hourlyRisk.at}`,
      group: 'spraying',
      source: 'weather',
      priority: 95,
      severity: 'warning',
      target: 'spray_weather',
      channels: input.hourlySprayWindow ? ['notification'] : ['today', 'notification'],
      label: 'İLAÇLAMA',
      title: 'Hava Değişiyor',
      detail: `${hourlyRisk.detail}; ilaçlama planını yeniden kontrol et.`,
      today: {
        tone: 'amber',
        visual: 'spraying',
        iconKey: 'leaf-gold',
        iconClass: 'leaf',
      },
      notification: { iconKey: 'leaf', iconTone: 'gold', dotTone: 'warning' },
    });
  }

  if (temperature != null && temperature >= 34 && !phenology.postHarvest) {
    pushEvent(items, {
      id: `weather:${fieldKey}:heat:${dayKey}`,
      group: 'temperature-risk',
      source: 'weather',
      priority: 88,
      severity: 'warning',
      target: 'weather',
      channels: ['today', 'notification'],
      kind: 'avoid',
      label: 'ISI STRESİ',
      title: 'Öğle Saatlerinde İşlem Yapma',
      detail: `Sıcaklık ${Math.round(temperature)}°C civarında`,
      today: {
        tone: 'amber',
        visual: 'spraying',
        iconKey: 'leaf-gold',
        iconClass: 'leaf',
      },
      notification: {
        iconKey: 'leaf',
        iconTone: 'gold',
        dotTone: 'warning',
      },
    });
  }

  if ((rainChance != null && rainChance >= 60) || (rainMm != null && rainMm >= 3)) {
    const rainDetail =
      rainChance != null
        ? `Bugün yağış ihtimali %${Math.round(rainChance)}`
        : `Bugün yaklaşık ${Number(rainMm).toFixed(1)} mm yağış görünüyor`;

    pushEvent(items, {
      id: `weather:${fieldKey}:rain:${dayKey}`,
      group: 'weather-rain',
      source: 'weather',
      priority: 84,
      severity: 'warning',
      target: 'weather',
      channels: hasIrrigationDecision ? ['notification'] : ['today', 'notification'],
      label: 'YAĞIŞ',
      title: 'Yağış İhtimali Yükseldi',
      detail: rainDetail,
      today: {
        tone: 'blue',
        visual: 'irrigation',
        iconKey: 'rain',
        iconClass: 'water',
      },
      notification: {
        iconKey: 'rain',
        iconTone: 'cyan',
        dotTone: 'warning',
      },
    });
  }

  if (input.nextCalendarItem) {
    const calendarDateMs = finiteNumber(input.nextCalendarItem?._tpDateMs);
    if (calendarDateMs != null) {
      const calendarHours = (calendarDateMs - nowMs) / HOUR_MS;
      const title =
        fullText(input.nextCalendarItem?._tpTitle) || 'Yaklaşan Takvim Görevi';

      pushEvent(items, {
        id: `calendar:${String(input.nextCalendarItem?.id ?? calendarDateMs)}`,
        group: 'calendar',
        source: 'calendar',
        priority: calendarHours <= 24 ? 94 : 74,
        severity: calendarHours <= 6 ? 'warning' : 'info',
        target: 'calendar',
        channels: ['today', 'notification'],
        label: 'TAKVİM',
        title,
        detail: formatCalendarTiming(calendarDateMs, nowMs),
        today: {
          tone: calendarHours <= 6 ? 'amber' : 'green',
          visual: 'spraying',
          iconKey: 'document',
          iconClass: 'leaf',
        },
        notification: {
          iconKey: 'document',
          iconTone: 'gold',
          dotTone: calendarHours <= 6 ? 'warning' : 'info',
        },
      });
    }
  }

  if (phenology.postHarvest) {
    pushEvent(items, {
      id: `phenology:${fieldKey}:post-harvest:${dayKey}`,
      group: 'phenology',
      source: 'phenology',
      priority: 91,
      severity: 'info',
      target: 'home',
      channels: ['today', 'notification'],
      label: 'SEZON',
      title: 'Hasat Sonrası Dönem',
      detail: 'Aktif ürün gelişimine ait sulama ve ilaçlama önerileri kapatıldı',
      evidence: phenology.evidence,
      confidence: phenology.confidence,
      sourceModel: phenology.sourceModel,
      today: {
        tone: 'green',
        visual: 'spraying',
        iconKey: 'leaf-green',
        iconClass: 'leaf',
      },
      notification: {
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'info',
      },
    });
  } else if (phenology.activeGrowth && Array.isArray(input.phenology?.warnings)) {
    const warning = fullText(input.phenology?.warnings?.[0]);
    if (warning) {
      pushEvent(items, {
        id: `phenology:${fieldKey}:${phenology.stage}:warning:${dayKey}`,
        group: 'phenology',
        source: 'phenology',
        priority: 93,
        severity: 'warning',
        target: 'ai',
        channels: ['today', 'notification'],
        label: 'GELİŞİM',
        title: phenology.stageLabel
          ? `${phenology.stageLabel} · Saha Kontrolü`
          : 'Gelişim Evresini Kontrol Et',
        detail: warning,
        evidence: phenology.evidence,
        confidence: phenology.confidence,
        sourceModel: phenology.sourceModel,
        today: {
          tone: 'amber',
          visual: 'spraying',
          iconKey: 'leaf-green',
          iconClass: 'leaf',
        },
        notification: {
          iconKey: 'leaf',
          iconTone: 'green',
          dotTone: 'warning',
        },
      });
    }
  }

  const pusulaAction = fullText(
    input.fieldSynthesis?.action ?? input.homePusulaResult?.analysis?.action,
  );
  const pusulaArea = fullText(
    input.fieldSynthesis?.importantArea?.area ??
      input.homePusulaResult?.analysis?.importantArea?.area,
  );
  const pusulaAreaKey = normalizeTaskAreaKey(pusulaArea);
  const pusulaAreaTitle = pusulaArea
    ? `Tarlanın ${pusulaArea.toLocaleLowerCase('tr-TR')} bölümünü kontrol et`
    : 'Pusula önerisini kontrol et';
  const synthesisStatus = String(input.fieldSynthesis?.status ?? '').trim();
  const synthesisNeedsAttention =
    Boolean(pusulaArea) || Boolean(synthesisStatus && synthesisStatus !== 'normal');

  if (pusulaAction && synthesisNeedsAttention && !phenology.postHarvest) {
    const observationId = String(
      input.homePusulaResult?.analysis?.memoryObservationId ??
        input.homePusulaResult?.snapshotId ??
        `${fieldKey}:${input.activeHomeLayer ?? 'home'}:${dayKey}`,
    );

    const pusulaEventId = pusulaAreaKey
      ? `pusula:${fieldKey}:area:${pusulaAreaKey}`
      : `pusula:${fieldKey}:general`;

    pushEvent(items, {
      id: pusulaEventId,
      group: 'pusula',
      source: 'pusula',
      priority: 89,
      severity: 'warning',
      target: 'ai',
      channels: ['today', 'notification'],
      kind: 'check',
      label: 'PUSULA',
      title: pusulaAreaTitle,
      detail: pusulaAction,
      /*
       * Yalnız gerçek bir saha bölgesi varsa görev oluştur.
       * Katman değiştikçe yeni UUID ile aynı görevin çoğalmasını engelle.
       */
      task: pusulaAreaKey
        ? {
            taskKey: `pusula-field-check:area:${pusulaAreaKey}`,
            actionTarget: 'field-photo',
            rewardPoints: 30,
            /*
             * Ödül görevin düğmesine basınca değil, gerçek saha fotoğrafı
             * başarıyla kaydedildiğinde FIELD_OBSERVATION_PHOTO ile verilir.
             */
            rewardRuleKey: null,
            metadata: {
              notificationId: pusulaEventId,
              observationId,
              openPhoto: true,
              sourceLayer: input.activeHomeLayer ?? 'vegetation',
              importantArea:
                input.fieldSynthesis?.importantArea ??
                input.homePusulaResult?.analysis?.importantArea ??
                null,
            },
          }
        : undefined,
      today: {
        tone: 'amber',
        visual: 'spraying',
        iconKey: 'leaf-green',
        iconClass: 'leaf',
      },
      notification: {
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'warning',
      },
    });
  }

  if (!phenology.postHarvest) {
    const realIrrigationEvent =
      input.irrigationDecision &&
      (!irrigationRecordedVeryRecently || irrigationDecisionIsFresh)
        ? irrigationEvent(
            fieldKey,
            dayKey,
            input.irrigationDecision,
            input.nutrient,
          )
        : null;

    if (realIrrigationEvent) {
      pushEvent(items, realIrrigationEvent);

      const irrigationSynthesis = input.irrigationDecision?.synthesis;
      if (irrigationSynthesis?.agreement === 'mixed') {
        const synthesisEvidence = [
          ...(irrigationSynthesis.evidence ?? []),
          ...(irrigationSynthesis.warnings ?? []),
        ]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
          .slice(0, 5);

        pushEvent(items, {
          id: `irrigation:${fieldKey}:model-verification:${dayKey}`,
          group: 'irrigation-verification',
          source: 'irrigation',
          priority: 105,
          severity: 'warning',
          target: 'irrigation_detail',
          channels: ['today', 'notification', 'pusula'],
          kind: 'check',
          label: 'SULAMA KONTROLÜ',
          title: irrigationSynthesis.headline || 'Sulama Modellerini Sahada Doğrula',
          detail:
            'Ana sulama önerisi korunuyor; bağımsız kısa dönem model ayrıştığı için uygulama öncesi son sulama kaydını ve saha koşullarını kontrol et.',
          evidence: synthesisEvidence,
          confidence: 'preliminary',
          sourceModel: 'irrigation-synthesis:production+pyfao56+aquacrop+phenology',
          today: {
            tone: 'amber',
            visual: 'irrigation',
            iconKey: 'water',
            iconClass: 'water',
          },
          notification: {
            iconKey: 'rain',
            iconTone: 'cyan',
            dotTone: 'warning',
          },
        });
      }
    } else if (
      irrigationRecordedVeryRecently &&
      !irrigationDecisionIsFresh &&
      !input.irrigationLoading
    ) {
      pushEvent(items, {
        id: `operation:${fieldKey}:irrigation-refresh:${latestIrrigationOperation?.id ?? dayKey}`,
        group: 'irrigation',
        source: 'operation',
        priority: 61,
        severity: 'info',
        target: 'home',
        channels: ['today'],
        label: 'SULAMA',
        title: 'Sulama Kaydı Güncellendi',
        detail: 'Su dengesi son sulama kaydına göre yeniden değerlendiriliyor',
        today: {
          tone: 'green',
          visual: 'irrigation',
          iconKey: 'water',
          iconClass: 'water',
        },
      });
    } else if (input.irrigationLoading) {
      pushEvent(items, {
        id: `irrigation:${fieldKey}:loading:${dayKey}`,
        group: 'irrigation',
        source: 'irrigation',
        priority: 58,
        severity: 'info',
        target: 'weather',
        channels: ['today'],
        label: 'SULAMA',
        title: 'Sulama Hesaplanıyor',
        detail: 'Bitki, toprak, kök bölgesi ve yağış birlikte değerlendiriliyor',
        today: {
          tone: 'neutral',
          visual: 'irrigation',
          iconKey: 'water',
          iconClass: 'water',
        },
      });
    } else if (
      input.hasUsableTodayWeather &&
      !irrigationRecordedVeryRecently
    ) {
      const irrigation = quickCopy(
        input.irrigationQuick,
        'Serin Saatleri Seç',
        'Sulama zamanını günün koşullarına göre seç',
      );
      pushEvent(items, {
        id: `weather:${fieldKey}:irrigation-baseline:${dayKey}`,
        group: 'irrigation',
        source: 'weather',
        priority: 56,
        severity: 'info',
        target: 'weather',
        channels: ['today'],
        label: 'SULAMA',
        title: irrigation.title,
        detail: irrigation.detail,
        today: {
          tone: irrigation.tone,
          visual: 'irrigation',
          iconKey: 'water',
          iconClass: 'water',
        },
      });
    }

    if (
      (input.hasUsableTodayWeather || input.hourlySprayForecastReady) &&
      !sprayingRecordedVeryRecently
    ) {
      const spraying = quickCopy(
        input.sprayingQuick,
        'Koşulları Kontrol Et',
        'Rüzgâr ve yağışı kontrol ederek uygulama zamanını seç',
      );
      pushEvent(items, {
        id: `weather:${fieldKey}:spraying-baseline:${dayKey}`,
        group: 'spraying',
        source: 'weather',
        priority: spraying.title.startsWith('İlaçlama havası:') ? 82 : spraying.title === 'Yağış ve Rüzgâr Sakin' ? 77 : 52,
        severity: 'info',
        target: 'spray_weather',
        channels: ['today'],
        label: 'İLAÇLAMA',
        title: spraying.title,
        detail: spraying.detail,
        today: {
          tone: spraying.tone,
          visual: 'spraying',
          iconKey: 'leaf-gold',
          iconClass: 'leaf',
        },
      });
    }
  }

  if (input.resolvedHomeSatelliteDate) {
    pushEvent(items, {
      id: `satellite:${fieldKey}:${input.resolvedHomeSatelliteDate}`,
      group: 'satellite',
      source: 'satellite',
      priority: 46,
      severity: 'info',
      target: 'home',
      channels: ['notification'],
      label: 'UYDU',
      title: 'Uydu Görüntüsü Hazır',
      detail: `Son görüntü ${formatSatelliteDate(input.resolvedHomeSatelliteDate)}`,
      notification: {
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'info',
      },
    });
  }

  if (input.homeFieldId && !String(input.homeFieldCrop ?? '').trim()) {
    pushEvent(items, {
      id: `field:${fieldKey}:missing-crop`,
      group: 'field-profile',
      source: 'field',
      priority: 42,
      severity: 'info',
      target: 'home',
      channels: ['notification'],
      label: 'TARLA',
      title: 'Ürün Bilgisini Tamamla',
      detail: 'Daha isabetli öneriler için tarlanın ürün bilgisini tamamla',
      notification: {
        iconKey: 'leaf',
        iconTone: 'green',
        dotTone: 'info',
      },
    });
  }

  const byId = new Map<string, HomeDecisionEvent>();
  items.forEach((item) => {
    const previous = byId.get(item.id);
    if (!previous || item.priority > previous.priority) byId.set(item.id, item);
  });

  return Array.from(byId.values()).sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );
}
