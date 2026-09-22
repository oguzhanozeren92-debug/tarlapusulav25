import { useMemo } from 'react';
import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';
import { useRecentFieldOperations } from '../../field-operations/hooks/useRecentFieldOperations';
import { buildNdviAnomalyDecision } from '../../satellite/services/buildNdviAnomalyDecision';
import { getCachedNdviAnomaly } from '../../satellite/services/ndviAnomaly.service';
import { buildHomeDecisionEvents } from '../services/homeDecisionEngine';
import { buildPlantHealthSynthesisDecision } from '../services/buildPlantHealthSynthesisDecision';
import { harmonizeDecisionEvents } from '../services/modelGateway';
import type { HarmonizedHomeDecisionEvent } from '../types/modelGateway';
import type {
  HomeDecisionEngineInput,
  HomeDecisionEvent,
  HomeSystemNotification,
  HomeTodayDecision,
  HomeTodayIconKey,
} from '../types/homeDecision';

function todayIconSrc(iconKey: HomeTodayIconKey): string {
  if (iconKey === 'water') return HOME_REFERENCE_ASSETS.iconWater;
  if (iconKey === 'rain') return HOME_REFERENCE_ASSETS.iconRain;
  if (iconKey === 'document') return HOME_REFERENCE_ASSETS.iconDocument;
  if (iconKey === 'leaf-green') return HOME_REFERENCE_ASSETS.iconLeafGreen;
  return HOME_REFERENCE_ASSETS.iconLeafGold;
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStatusDate(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function buildObservationFollowUpEvent(
  input: HomeDecisionEngineInput,
  now: Date,
): HomeDecisionEvent | null {
  const signal = input.observationFollowUp;
  if (!signal?.pointId) return null;

  const status = signal.comparisonStatus;
  const comparedAt = signal.comparedAt ? new Date(signal.comparedAt) : null;
  const comparisonAgeMs =
    comparedAt && Number.isFinite(comparedAt.getTime())
      ? now.getTime() - comparedAt.getTime()
      : Number.POSITIVE_INFINITY;
  const comparisonRecent =
    comparisonAgeMs >= 0 && comparisonAgeMs <= 72 * 60 * 60 * 1000;

  if (!signal.dueForPhoto && (!status || status === 'unknown' || !comparisonRecent)) {
    return null;
  }

  const area = String(signal.direction ?? '').trim() || 'Takip alanı';
  const areaLabel =
    area.charAt(0).toLocaleUpperCase('tr-TR') + area.slice(1);
  const summary = String(signal.comparisonSummary ?? '').trim();
  const trackedIssueLabel = String(signal.trackedIssueLabel ?? '').trim();
  const trackedIssueStatus = String(signal.trackedIssueStatus ?? '').trim();
  const trackedIssueSummary = String(signal.trackedIssueSummary ?? '').trim();
  const decisionStatus =
    trackedIssueLabel && trackedIssueStatus && trackedIssueStatus !== 'uncertain'
      ? trackedIssueStatus
      : status;
  const issueTitle = trackedIssueLabel
    ? trackedIssueStatus === 'improving'
      ? `${trackedIssueLabel} bulgusu geriliyor`
      : trackedIssueStatus === 'worsening'
        ? `${trackedIssueLabel} bulgusu artıyor`
        : trackedIssueStatus === 'stable'
          ? `${trackedIssueLabel} bulgusu benzer seyrediyor`
          : trackedIssueStatus === 'not_visible'
            ? `${trackedIssueLabel} bulgusu yeni fotoğrafta görünmüyor`
            : ''
    : '';
  const statusTitle =
    issueTitle ||
    (status === 'improving'
      ? `${areaLabel} toparlanıyor`
      : status === 'worsening'
        ? `${areaLabel} zayıflamaya devam ediyor`
        : status === 'stable'
          ? `${areaLabel} benzer seyrediyor`
          : `${areaLabel} yeniden kontrol edilmeli`);

  const title = signal.dueForPhoto
    ? `Tekrar Fotoğraf Zamanı · ${areaLabel}`
    : statusTitle;
  const followUpPeriod =
    signal.latestSatelliteDate ??
    signal.nextPhotoDueAt?.slice(0, 10) ??
    localDayKey(now);
  const detail = signal.dueForPhoto
    ? `${trackedIssueSummary || summary ? `${trackedIssueSummary || summary} ` : ''}Planlı takip günü geldi veya son fotoğraftan daha yeni uydu gözlemi var. Aynı noktadan yeni fotoğraf çekerek değişimi doğrula.`
    : trackedIssueSummary || summary || 'Son iki saha fotoğrafı ve uydu sağlık sinyali karşılaştırıldı.';
  const evidence = [
    trackedIssueLabel
      ? `Takip edilen Pusula AI ön değerlendirmesi: ${trackedIssueLabel}.`
      : '',
    trackedIssueSummary,
    summary && summary !== trackedIssueSummary ? summary : '',
    signal.latestSatelliteDate
      ? `Takip noktasının son uydu tarihi: ${formatStatusDate(signal.latestSatelliteDate)}.`
      : '',
  ].filter(Boolean);

  return {
    id: `satellite:${String(input.homeFieldId ?? input.fieldKey)}:ndvi-follow-up:${signal.pointId}:${
      signal.dueForPhoto ? 'photo-due' : decisionStatus
    }`,
    group: 'satellite-follow-up',
    source: 'satellite',
    priority: signal.dueForPhoto
      ? decisionStatus === 'worsening'
        ? 95
        : 89
      : decisionStatus === 'worsening'
        ? 87
        : 76,
    severity: decisionStatus === 'worsening' ? 'warning' : 'info',
    target: 'map_vegetation',
    channels: (signal.dueForPhoto || decisionStatus === 'worsening'
      ? ['today', 'notification', 'pusula']
      : ['today']) as HomeDecisionEvent['channels'],
    kind: 'check',
    label: signal.dueForPhoto ? 'SAHA TAKİBİ' : 'TAKİP SONUCU',
    title,
    detail,
    evidence,
    task: {
      taskKey: `ndvi-follow-up-photo:${signal.pointId}:${followUpPeriod}`,
      actionTarget: 'field-photo',
      rewardPoints: 0,
      rewardRuleKey: null,
      metadata: {
        source: 'ndvi_follow_up',
        pointId: signal.pointId,
        importantArea: {
          area,
          geometry: signal.areaGeometry ?? null,
        },
        satelliteDate: signal.latestSatelliteDate,
        requestPhoto: signal.dueForPhoto,
      },
    },
    today: {
      tone:
        ['improving', 'not_visible'].includes(decisionStatus) && !signal.dueForPhoto
          ? 'green'
          : 'neutral',
      visual: 'spraying',
      iconKey: 'leaf-green',
      iconClass: 'leaf',
    },
    notification:
      signal.dueForPhoto || decisionStatus === 'worsening'
        ? {
            iconKey: 'leaf',
            iconTone: 'green',
            dotTone: decisionStatus === 'worsening' ? 'warning' : 'info',
          }
        : undefined,
  };
}

/**
 * Bugün ekranı yalnız alarm olduğunda dolmamalı.
 * Buradaki satırlar sahte tarımsal öneri üretmez; sadece gerçekten hazır olan
 * veri kaynağının "uyarı yok / takipte" durumunu veya eksik veri durumunu
 * görünür kılar. Gerçek bir karar olayı varsa düşük öncelikli bu durum satırı
 * onun arkasında kalır.
 */
function buildTodayStatusFillers(
  input: HomeDecisionEngineInput,
  existingEvents: HomeDecisionEvent[],
  now: Date,
): HomeDecisionEvent[] {
  const fieldKey = String(input.fieldKey || 'home');
  const dayKey = localDayKey(now);
  const fillers: HomeDecisionEvent[] = [];
  const todayEvents = existingEvents.filter(
    (event) => event.channels.includes('today') && event.today,
  );
  const todayGroups = new Set(todayEvents.map((event) => event.group));

  const hasWeatherOverview = todayEvents.some((event) =>
    ['weather-status', 'temperature-risk', 'weather-rain'].includes(event.group),
  );

  if (!hasWeatherOverview && input.hasUsableTodayWeather) {
    fillers.push({
      id: `weather:${fieldKey}:overview:${dayKey}`,
      group: 'weather-overview',
      source: 'weather',
      priority: 45,
      severity: 'info',
      target: 'weather',
      channels: ['today'],
      label: 'HAVA',
      title: 'Kritik Hava Uyarısı Yok',
      detail: 'Güncel tahmin alındı; bugün için ayrıca kritik hava eşiği oluşmadı.',
      today: {
        tone: 'green',
        visual: 'irrigation',
        iconKey: 'rain',
        iconClass: 'water',
      },
    });
  }

  const hasSatelliteToday = todayEvents.some(
    (event) => event.source === 'satellite',
  );

  if (!hasSatelliteToday) {
    const satelliteDate = formatStatusDate(input.resolvedHomeSatelliteDate);
    const satelliteReady = Boolean(input.resolvedHomeSatelliteDate);
    const satelliteLoading = input.phenologyTimeSeriesStatus === 'loading';

    fillers.push({
      id: `satellite:${fieldKey}:status:${dayKey}`,
      group: 'satellite-status',
      source: 'satellite',
      priority: 44,
      severity: 'info',
      target: 'map_vegetation',
      channels: ['today'],
      label: 'UYDU',
      title: satelliteReady
        ? 'Uydu Takibi Güncel'
        : satelliteLoading
          ? 'Uydu Geçmişi Hazırlanıyor'
          : 'Uydu Kararı İçin Veri Bekleniyor',
      detail: satelliteReady
        ? `Son veri ${satelliteDate}; bugün ayrıca müdahale gerektiren bir uydu olayı üretilmedi.`
        : satelliteLoading
          ? 'Geçmiş gözlemler karşılaştırılıyor; hazır olduğunda değişim kararı burada görünecek.'
          : 'Karşılaştırmalı uydu gözlemi oluştuğunda gelişim değişimi burada değerlendirilecek.',
      today: {
        tone: satelliteReady ? 'green' : 'neutral',
        visual: 'spraying',
        iconKey: 'leaf-green',
        iconClass: 'leaf',
      },
    });
  }

  if (!todayGroups.has('phenology')) {
    const phenologyUsable = Boolean(
      input.phenology?.dataStatus === 'usable' &&
        input.phenology?.stage &&
        input.phenology.stage !== 'unknown',
    );
    const stageLabel = String(input.phenology?.stageLabel ?? '').trim();
    const phenologyEvidence = (input.phenology?.basis ?? [])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 4);
    const evidenceText = phenologyEvidence.join(' ').toLocaleLowerCase('tr-TR');
    const phenologySourceModel = evidenceText.includes('nasa harvest')
      ? evidenceText.includes('wofost') || evidenceText.includes('pcse')
        ? 'phenology-fusion:nasa-harvest+pcse'
        : 'nasa-harvest-crop-stage'
      : evidenceText.includes('wofost') || evidenceText.includes('pcse')
        ? 'pcse-wofost-phenology'
        : 'phenology';
    const phenologyConfidence = input.phenology?.confidence === 'high'
      ? 'strong' as const
      : input.phenology?.confidence === 'medium'
        ? 'medium' as const
        : 'preliminary' as const;

    fillers.push({
      id: `phenology:${fieldKey}:status:${dayKey}`,
      group: 'phenology-status',
      source: 'phenology',
      priority: 43,
      severity: 'info',
      target: 'ai',
      channels: ['today'],
      label: 'GELİŞİM',
      title: phenologyUsable
        ? `${stageLabel || 'Gelişim Evresi'} Takipte`
        : 'Gelişim Evresi İçin Bilgi Eksik',
      detail: phenologyUsable
        ? String(input.phenology?.summary ?? '').trim() ||
          'Gelişim evresi bugünkü sulama, hava ve risk kararlarında bağlam olarak kullanılıyor.'
        : 'Sezon ve gelişim verisi tamamlandıkça fenoloji kararı netleşecek.',
      evidence: phenologyUsable ? phenologyEvidence : undefined,
      confidence: phenologyUsable ? phenologyConfidence : 'preliminary',
      sourceModel: phenologyUsable ? phenologySourceModel : 'phenology',
      today: {
        tone: phenologyUsable ? 'green' : 'neutral',
        visual: 'spraying',
        iconKey: 'leaf-green',
        iconClass: 'leaf',
      },
    });
  }

  if (!todayGroups.has('nutrition')) {
    const nutrientReady = input.nutrient?.status === 'ready';
    const hasAnalysis = Boolean(
      nutrientReady &&
        input.nutrient?.latestAnalysis &&
        String(input.nutrient.latestAnalysis.field_id ?? '') ===
          String(input.homeFieldId ?? ''),
    );

    fillers.push({
      id: `nutrition:${fieldKey}:status:${dayKey}`,
      group: 'nutrition-status',
      source: 'nutrition',
      priority: 42,
      severity: 'info',
      target: 'soil',
      channels: ['today'],
      label: 'TOPRAK',
      title: hasAnalysis
        ? 'Toprak Analizi Takipte'
        : nutrientReady
          ? 'Toprak Analizi İçin Bilgi Eksik'
          : 'Toprak Verisi Henüz Karar Üretmedi',
      detail: hasAnalysis
        ? 'Kayıtlı laboratuvar analizinde bugün için ayrıca bir rapor uyarısı oluşmadı.'
        : nutrientReady
          ? 'Gübreleme kararını güçlendirmek için bu tarlanın laboratuvar analizini ekle.'
          : 'Toprak analizi hazır olduğunda gübreleme kararları gerçek saha verisiyle desteklenecek.',
      today: {
        tone: hasAnalysis ? 'green' : 'neutral',
        visual: 'spraying',
        iconKey: 'document',
        iconClass: 'leaf',
      },
    });
  }

  if (
    input.homeFieldId &&
    !String(input.homeFieldCrop ?? '').trim() &&
    !todayGroups.has('field-profile')
  ) {
    fillers.push({
      id: `field:${fieldKey}:missing-crop:today`,
      group: 'field-profile',
      source: 'field',
      priority: 41,
      severity: 'info',
      target: 'home',
      channels: ['today'],
      label: 'TARLA',
      title: 'Ürün Bilgisi Eksik',
      detail: 'Fenoloji ve ürün odaklı kararlar için tarlanın ürün bilgisini tamamla.',
      today: {
        tone: 'neutral',
        visual: 'spraying',
        iconKey: 'document',
        iconClass: 'leaf',
      },
    });
  }

  const hasPusulaToday = todayEvents.some((event) => event.group === 'pusula');
  const synthesisStatus = String(input.fieldSynthesis?.status ?? '').trim();

  if (!hasPusulaToday && input.fieldSynthesis && synthesisStatus === 'normal') {
    fillers.push({
      id: `pusula:${fieldKey}:normal:${dayKey}`,
      group: 'pusula-status',
      source: 'pusula',
      priority: 40,
      severity: 'info',
      target: 'ai',
      channels: ['today'],
      label: 'PUSULA',
      title: 'Belirgin Alan Uyarısı Yok',
      detail: 'Mevcut tarla sentezinde bugün ayrıca saha kontrolü gerektiren bir alan uyarısı oluşmadı.',
      today: {
        tone: 'green',
        visual: 'spraying',
        iconKey: 'leaf-green',
        iconClass: 'leaf',
      },
    });
  }

  return fillers;
}

function selectTodayEvents(events: HomeDecisionEvent[]): HomeDecisionEvent[] {
  const seenGroups = new Set<string>();

  return events
    .filter((event) => event.channels.includes('today') && event.today)
    .filter((event) => {
      if (seenGroups.has(event.group)) return false;
      seenGroups.add(event.group);
      return true;
    })
    .slice(0, 5);
}

function makeAllClearEvent(fieldKey: string): HomeDecisionEvent {
  return {
    id: `status:${fieldKey || 'home'}:all-clear`,
    group: 'status',
    source: 'field',
    priority: 1,
    severity: 'info',
    target: 'home',
    channels: ['today'],
    label: 'BUGÜN',
    title: 'Acil İşlem Görünmüyor',
    detail: 'Yeni veri geldikçe burası otomatik güncellenecek',
    today: {
      tone: 'green',
      visual: 'irrigation',
      iconKey: 'leaf-green',
      iconClass: 'leaf',
    },
  };
}

function toTodayDecision(
  event: HomeDecisionEvent | HarmonizedHomeDecisionEvent,
  fieldId?: string | null,
): HomeTodayDecision | null {
  if (!event.today) return null;

  return {
    id: event.id,
    group: event.group,
    priority: event.priority,
    label: event.label,
    title: event.title,
    detail: event.detail,
    tone: event.today.tone,
    visual: event.today.visual,
    iconSrc: todayIconSrc(event.today.iconKey),
    iconClass: event.today.iconClass,
    target: event.target,
    fieldId: fieldId ?? null,
    source: event.source,
    evidence: event.evidence,
    confidence: 'gateway' in event ? event.gateway.confidence : event.confidence,
    kind: event.kind,
    missingInfoKind: event.missingInfoKind,
    task: event.task,
  };
}

function toNotification(event: HomeDecisionEvent): HomeSystemNotification | null {
  if (!event.notification || !event.channels.includes('notification')) return null;

  return {
    id: event.id,
    priority: event.priority,
    severity: event.severity,
    source: event.source,
    title: event.title,
    detail: event.detail,
    iconKey: event.notification.iconKey,
    iconTone: event.notification.iconTone,
    dotTone: event.notification.dotTone,
    target: event.target,
    task: event.task,
  };
}

export function useHomeDecisionEngine(input: HomeDecisionEngineInput) {
  const recentOperations = useRecentFieldOperations(input.homeFieldId, 30);

  const resolvedInput = useMemo<HomeDecisionEngineInput>(
    () => ({ ...input, recentFieldOperations: recentOperations.operations }),
    [input, recentOperations.operations],
  );

  const cachedAnomaly = getCachedNdviAnomaly(input.homeFieldId);

  const events = useMemo(() => {
    const baseEvents = buildHomeDecisionEvents(resolvedInput);
    const now = input.now ?? new Date();
    const riskEvent = buildPlantHealthSynthesisDecision({
      fieldId: input.homeFieldId,
      radar: input.fieldSynthesis?.riskRadar ?? null,
      observation: input.observationFollowUp ?? null,
      phenology: input.phenology ?? null,
      now,
    });
    const activeGrowth = Boolean(
      input.phenology?.dataStatus === 'usable' &&
        input.phenology?.stage &&
        input.phenology.stage !== 'unknown' &&
        input.phenology.stage !== 'post_harvest',
    );
    const anomalySignal = cachedAnomaly
      ? {
          ...cachedAnomaly,
          fieldId: String(input.homeFieldId ?? ''),
          status: 'ready' as const,
        }
      : null;
    const anomalySpatialArea =
      input.fieldSynthesis?.prioritySource?.layer === 'vegetation' &&
      String(input.fieldSynthesis?.importantArea?.area ?? '').trim()
        ? input.fieldSynthesis.importantArea
        : null;
    const anomalyEvent = buildNdviAnomalyDecision(
      String(input.homeFieldId ?? ''),
      anomalySignal,
      activeGrowth,
      now,
      anomalySpatialArea,
    );
    const observationFollowUpEvent = buildObservationFollowUpEvent(input, now);

    let merged = baseEvents;

    if (riskEvent) {
      const hasSpatialAlert = Boolean(
        String(input.fieldSynthesis?.importantArea?.area ?? '').trim(),
      );
      merged = hasSpatialAlert
        ? merged
        : merged.filter(
            (event) => !(event.group === 'pusula' && event.source === 'pusula'),
          );
    }

    if (anomalyEvent) {
      merged = merged.filter((event) => event.group !== 'satellite-trend');
    }

    const effectiveAnomalyEvent = input.observationFollowUp?.dueForPhoto
      ? null
      : anomalyEvent;
    const photoEvidenceWasSynthesized = Boolean(
      riskEvent?.sourceModel?.includes('field-photo'),
    );
    const effectiveObservationFollowUpEvent =
      photoEvidenceWasSynthesized && !input.observationFollowUp?.dueForPhoto
        ? null
        : observationFollowUpEvent;
    const realEvents = [
      riskEvent,
      effectiveObservationFollowUpEvent,
      effectiveAnomalyEvent,
      ...merged,
    ].filter((event): event is HomeDecisionEvent => Boolean(event));

    const fillers = buildTodayStatusFillers(resolvedInput, realEvents, now);

    const sortedEvents = [...realEvents, ...fillers].sort(
      (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
    );

    return harmonizeDecisionEvents(
      sortedEvents,
      input.homeFieldId ?? input.fieldKey,
      now.toISOString(),
    );
  }, [
    resolvedInput,
    input.homeFieldId,
    input.fieldSynthesis,
    input.now,
    input.phenology,
    input.observationFollowUp,
    cachedAnomaly,
  ]);

  const todayDecisions = useMemo(() => {
    const selected = selectTodayEvents(events);
    const source = selected.length > 0
      ? selected
      : [makeAllClearEvent(input.fieldKey)];

    const fieldId = String(input.homeFieldId ?? input.fieldKey ?? '').trim() || null;
    return source
      .map((event) => toTodayDecision(event, fieldId))
      .filter((item): item is HomeTodayDecision => Boolean(item));
  }, [events, input.fieldKey]);

  const notifications = useMemo(
    () =>
      events
        .map(toNotification)
        .filter((item): item is HomeSystemNotification => Boolean(item))
        .slice(0, 12),
    [events],
  );

  const primaryDecision = useMemo(
    () => events.find((event) => event.channels.includes('today')) ?? events[0] ?? null,
    [events],
  );

  const pusulaDecision = useMemo(
    () => events.find((event) => event.channels.includes('pusula')) ?? null,
    [events],
  );

  return {
    events,
    todayDecisions,
    notifications,
    primaryDecision,
    pusulaDecision,
    modelSignals: events.map((event) => event.gateway),
    recentFieldOperations: recentOperations.operations,
    recentFieldOperationsReady: !recentOperations.loading && !recentOperations.error,
  };
}
