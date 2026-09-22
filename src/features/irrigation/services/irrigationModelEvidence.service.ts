import type {
  IrrigationDecisionResult,
  IrrigationShadowModelEvidence,
} from '../types/irrigationDecision';
import type { DualKcValidationHistory } from './dualKcValidationHistory.service';
import {
  dualKcAuditAgeHours,
  isDualKcShadowAuditFresh,
  summarizeDualKcShadowRange,
  type DualKcShadowAudit,
} from './dualKcShadow.service';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fmtRange(
  range: { min: number; max: number } | null | undefined,
  unit = 'mm',
) {
  if (!range) return null;
  const min = range.min.toFixed(1);
  const max = range.max.toFixed(1);
  return Math.abs(range.max - range.min) < 0.05
    ? `${min} ${unit}`
    : `${min}–${max} ${unit}`;
}

function auditHorizonDays(audit: DualKcShadowAudit | null | undefined) {
  const counts = (audit?.scenarios ?? [])
    .map((scenario) => Number((scenario as any)?.dayCount))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!counts.length) return null;
  return counts.every((value) => value === counts[0]) ? counts[0] : null;
}

function strictUtcDateMs(value: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return ms;
}

export function productionForecastWindow(decision: IrrigationDecisionResult | null | undefined) {
  const forecast = Array.isArray(decision?.forecast) ? decision.forecast : [];
  if (forecast.length !== 5) return null;
  const dates = forecast.map((day) => String(day?.date ?? '').slice(0, 10));
  const dayMs = dates.map(strictUtcDateMs);
  if (dayMs.some((value) => value == null)) return null;
  for (let index = 1; index < dayMs.length; index += 1) {
    if ((dayMs[index] as number) - (dayMs[index - 1] as number) !== 86_400_000) return null;
  }
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

export function shadowWindowAligned(
  audit: DualKcShadowAudit | null | undefined,
  productionWindow: { startDate: string; endDate: string } | null,
) {
  if (!productionWindow) return false;
  const scenarios = audit?.scenarios ?? [];
  if (!scenarios.length) return false;
  return scenarios.every((scenario) =>
    scenario.dayCount === 5 &&
    scenario.startDate === productionWindow.startDate &&
    scenario.endDate === productionWindow.endDate
  );
}

function baseEvidence(
  status: IrrigationShadowModelEvidence['status'],
  audit: DualKcShadowAudit | null | undefined,
  note: string,
): IrrigationShadowModelEvidence {
  return {
    status,
    sourceModel: 'pyfao56-dual-kc-shadow',
    productionAuthority: false,
    agreement: 'unavailable',
    confidence: 'low',
    engineVersion: audit?.engineVersion ?? null,
    completedAt: audit?.completedAt ?? null,
    horizonDays: auditHorizonDays(audit),
    scenarioCount: audit?.scenarios?.length ?? 0,
    missingInputs: [...(audit?.missingInputs ?? [])],
    rootDepletionRangeMm: null,
    surfaceDepletionRangeMm: null,
    stressCoefficientRange: null,
    evidence: [],
    note,
    promotionGate: {
      eligible: false,
      reason: note,
      requiredAgreement: 'supportive',
      requiredProductionHorizonDays: 5,
      requiredShadowHorizonDays: 5,
      productionAuthority: false,
    },
  };
}

export function assessDualKcModelEvidence(
  decision: IrrigationDecisionResult | null | undefined,
  audit: DualKcShadowAudit | null | undefined,
): IrrigationShadowModelEvidence {
  if (!audit) {
    return baseEvidence('waiting', null, 'pyfao56 Dual-Kc doğrulama kaydı henüz oluşmadı.');
  }
  if (audit.notApplicable) {
    return baseEvidence('not_applicable', audit, 'Tarla susuz/rainfed olduğu için Dual-Kc sulama shadow modeli uygulanmıyor.');
  }
  if (audit.status === 'failed') {
    return baseEvidence('error', audit, audit.error || 'pyfao56 Dual-Kc doğrulaması tamamlanamadı.');
  }
  if (audit.status !== 'completed') {
    const missing = audit.missingInputs.length
      ? ` Eksik gerçek girdiler: ${audit.missingInputs.join(', ')}.`
      : '';
    return baseEvidence(
      audit.status === 'blocked' ? 'blocked' : 'waiting',
      audit,
      `Dual-Kc shadow henüz karşılaştırılabilir çıktı üretmedi.${missing}`,
    );
  }

  if (!isDualKcShadowAuditFresh(audit)) {
    const ageHours = dualKcAuditAgeHours(audit);
    const ageText = ageHours == null ? '' : ` Son çalışma yaklaşık ${Math.round(ageHours)} saat önce.`;
    return baseEvidence(
      'waiting',
      audit,
      `pyfao56 Dual-Kc kanıtı güncelliğini yitirdi; yeni hava ve saha girdileriyle yeniden hesaplanıyor.${ageText}`,
    );
  }

  const range = summarizeDualKcShadowRange(audit);
  if (!range) {
    return baseEvidence('blocked', audit, 'Dual-Kc çalışması tamamlandı ancak karşılaştırılabilir senaryo özeti yok.');
  }

  const horizonDays = auditHorizonDays(audit);
  const rootRange = range.rootDepletionMm;
  const surfaceRange = range.surfaceDepletionMm;
  const stressRange = range.stressCoefficient;
  const actualEtRange = range.actualEtMm;
  const evidence: string[] = [];
  const rootText = fmtRange(rootRange);
  const surfaceText = fmtRange(surfaceRange);
  const actualEtText = fmtRange(actualEtRange);
  if (rootText) evidence.push(`pyfao56 kök bölgesi açığı: ${rootText}`);
  if (surfaceText) evidence.push(`pyfao56 yüzey açığı: ${surfaceText}`);
  if (stressRange) evidence.push(`pyfao56 stres katsayısı: ${stressRange.min.toFixed(2)}–${stressRange.max.toFixed(2)}`);
  if (actualEtText) evidence.push(`pyfao56 gerçek ET: ${actualEtText}`);
  if (horizonDays) evidence.push(`Dual-Kc model ufku: ${horizonDays} gün`);

  const production5Day = decision?.waterBalance?.projected5DayDeficitMm;
  const productionForecastComplete =
    Array.isArray(decision?.forecast) &&
    decision.forecast.length === 5;
  const productionWindow = productionForecastWindow(decision);
  const comparisonWindowAligned = shadowWindowAligned(audit, productionWindow);
  let agreement: IrrigationShadowModelEvidence['agreement'] = 'not_comparable';
  let confidence: IrrigationShadowModelEvidence['confidence'] = 'medium';
  let note = 'pyfao56 bağımsız shadow kanıtı hazır; production sulama kararını tek başına değiştirmez.';

  if (
    horizonDays === 5 &&
    productionForecastComplete &&
    comparisonWindowAligned &&
    finite(production5Day) &&
    rootRange
  ) {
    const toleranceMm = Math.max(5, Math.abs(production5Day) * 0.2);
    const within = production5Day >= rootRange.min - toleranceMm && production5Day <= rootRange.max + toleranceMm;
    evidence.push(`TarlaPusula 5 günlük açık: ${production5Day.toFixed(1)} mm`);
    agreement = within ? 'supportive' : 'divergent';
    confidence = within ? 'high' : 'low';
    note = within
      ? 'Bağımsız pyfao56 Dual-Kc shadow sonucu aynı beş günlük su açığı yönünü destekliyor.'
      : 'Bağımsız pyfao56 Dual-Kc shadow sonucu beş günlük production su açığı projeksiyonundan belirgin ayrışıyor; saha doğrulaması gerekli.';
  } else {
    if (!productionForecastComplete) {
      evidence.push('TarlaPusula 5 günlük production projeksiyonu eksik; pyfao56 ile sayısal uyum karşılaştırması yapılmadı.');
    } else if (!comparisonWindowAligned) {
      evidence.push('TarlaPusula ve pyfao56 aynı 5 takvim gününü kapsamıyor; farklı tarih pencereleri sayısal olarak karşılaştırılmadı.');
    }
    note = !comparisonWindowAligned && productionForecastComplete
      ? 'pyfao56 Dual-Kc shadow kanıtı hazır; production ile model tarih pencereleri birebir eşleşmediği için sayısal uyum skoru üretilmedi.'
      : 'pyfao56 Dual-Kc shadow kanıtı hazır; karşılaştırılabilir tam beş günlük production ufku olmadığı için sayısal uyum skoru üretilmedi.';
  }

  const promotionEligible =
    agreement === 'supportive' &&
    confidence === 'high' &&
    horizonDays === 5 &&
    productionForecastComplete &&
    comparisonWindowAligned &&
    isDualKcShadowAuditFresh(audit);

  const promotionReason = promotionEligible
    ? 'Shadow model güncel, tam 5 günlük production ufkuyla sayısal olarak uyumlu. Bu yalnızca promotion adayıdır; production otoritesi verilmez.'
    : agreement === 'divergent'
      ? 'Model production projeksiyonundan ayrışıyor; promotion kapalı.'
      : !productionForecastComplete
        ? 'Tam 5 günlük production ufku yok; promotion kapalı.'
        : horizonDays !== 5
          ? 'Shadow model ufku 5 gün değil; promotion kapalı.'
          : !comparisonWindowAligned
            ? 'Production ve shadow model aynı takvim günlerini kapsamıyor; promotion kapalı.'
            : 'Gerekli yüksek güvenli supportive uyum oluşmadı; promotion kapalı.';

  return {
    status: 'ready',
    sourceModel: 'pyfao56-dual-kc-shadow',
    productionAuthority: false,
    agreement,
    confidence,
    engineVersion: audit.engineVersion,
    completedAt: audit.completedAt,
    horizonDays,
    scenarioCount: range.scenarioCount,
    missingInputs: [],
    rootDepletionRangeMm: rootRange,
    surfaceDepletionRangeMm: surfaceRange,
    stressCoefficientRange: stressRange,
    evidence: evidence.slice(0, 6),
    note,
    promotionGate: {
      eligible: promotionEligible,
      reason: promotionReason,
      requiredAgreement: 'supportive',
      requiredProductionHorizonDays: 5,
      requiredShadowHorizonDays: 5,
      productionAuthority: false,
    },
  };
}

export function attachDualKcEvidence(
  decision: IrrigationDecisionResult | null | undefined,
  audit: DualKcShadowAudit | null | undefined,
  validationHistory?: DualKcValidationHistory | null,
): IrrigationDecisionResult | null {
  if (!decision) return null;
  const assessedEvidence = assessDualKcModelEvidence(decision, audit);
  const historyEligible = validationHistory?.eligible === true;
  const modelEvidence = {
    ...assessedEvidence,
    promotionGate: {
      ...assessedEvidence.promotionGate,
      eligible: assessedEvidence.promotionGate.eligible && historyEligible,
      reason:
        assessedEvidence.promotionGate.eligible && !historyEligible
          ? validationHistory?.reason ?? 'Tek çalışma promotion için yeterli değil; doğrulama geçmişi henüz yüklenmedi.'
          : assessedEvidence.promotionGate.reason,
      ...(validationHistory ? { validationHistory } : {}),
      productionAuthority: false as const,
    },
  };
  const isDivergent = modelEvidence.agreement === 'divergent';
  const isSupportive = modelEvidence.agreement === 'supportive';

  const modelReasons = modelEvidence.status === 'ready'
    ? modelEvidence.evidence
    : [];
  const modelWarnings = isDivergent ? [modelEvidence.note] : [];
  const confidence = isDivergent
    ? 'low' as const
    : isSupportive && decision.confidence !== 'low'
      ? 'high' as const
      : decision.confidence;

  return {
    ...decision,
    confidence,
    reasons: [...new Set([...(decision.reasons ?? []), ...modelReasons])].slice(0, 8),
    warnings: [...new Set([...(decision.warnings ?? []), ...modelWarnings])],
    display: isDivergent
      ? {
          ...decision.display,
          summary: `${decision.display.summary} Bağımsız pyfao56 modeli aynı 5 günlük açıkta ayrışıyor.`,
          action: `${decision.display.action} Sulama öncesi sahada kontrol et.`,
        }
      : decision.display,
    modelEvidence,
  };
}
