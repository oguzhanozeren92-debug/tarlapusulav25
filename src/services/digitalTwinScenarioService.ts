export type DigitalTwinScenarioKind =
  | 'irrigation'
  | 'crop'
  | 'nutrition';

export type DigitalTwinMetricStatus =
  | 'available'
  | 'missing'
  | 'blocked'
  | 'invalid';

export type DigitalTwinMetric = {
  key: string;
  label?: string;
  value: number | null;
  unit: string;
  status?: DigitalTwinMetricStatus;
  source?: string;
  observedAt?: string;
  blockedReason?: string | null;
};

export type DigitalTwinScenarioContext = {
  fieldId?: string | null;
  generatedAt?: string | null;
  source?: string | null;
};

export type DigitalTwinScenario = {
  id: string;
  name: string;
  kind: DigitalTwinScenarioKind;
  context?: DigitalTwinScenarioContext;
  metrics: DigitalTwinMetric[];
};

export type DigitalTwinComparisonReason =
  | 'missing_metric'
  | 'unit_mismatch'
  | 'source_blocked'
  | 'missing_provenance'
  | 'invalid_value'
  | 'zero_baseline';

export type DigitalTwinMetricComparison = {
  key: string;
  label: string;
  unit: string | null;
  baselineValue: number | null;
  candidateValue: number | null;
  absoluteDelta: number | null;
  relativeDeltaPercent: number | null;
  comparable: boolean;
  reason: DigitalTwinComparisonReason | null;
  detail: string | null;
};

export type DigitalTwinComparisonStatus =
  | 'ready'
  | 'partial'
  | 'blocked';

export type DigitalTwinScenarioComparison = {
  baselineScenarioId: string;
  candidateScenarioId: string;
  kind: DigitalTwinScenarioKind;
  status: DigitalTwinComparisonStatus;
  comparableMetricCount: number;
  blockedMetricCount: number;
  metrics: DigitalTwinMetricComparison[];
};

function normalizeKey(value: string) {
  return String(value ?? '').trim();
}

function normalizeUnit(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');
}

function normalizeContextId(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function parseTrustedTimestamp(value: string | null | undefined) {
  const normalized = normalizeContextId(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function requireScenarioProvenance(scenario: DigitalTwinScenario) {
  const fieldId = normalizeContextId(scenario.context?.fieldId);
  const source = normalizeContextId(scenario.context?.source);
  const generatedAt = normalizeContextId(scenario.context?.generatedAt);
  const generatedAtMs = parseTrustedTimestamp(generatedAt);

  if (!fieldId) {
    throw new Error(
      'Digital Twin karşılaştırması için iki senaryoda da tarla kimliği bulunmalıdır.',
    );
  }

  if (!source) {
    throw new Error(
      'Digital Twin karşılaştırması için senaryo veri kaynağı bulunmalıdır.',
    );
  }

  if (!generatedAt || generatedAtMs === null) {
    throw new Error(
      'Digital Twin karşılaştırması için geçerli senaryo üretim zamanı bulunmalıdır.',
    );
  }

  if (generatedAtMs > Date.now()) {
    throw new Error(
      'Digital Twin karşılaştırması gelecekte üretilmiş görünen senaryo verisiyle yapılamaz.',
    );
  }

  return { fieldId, source, generatedAt, generatedAtMs };
}

function metricStatus(metric: DigitalTwinMetric | undefined) {
  if (!metric) return 'missing' as const;
  if (metric.status && metric.status !== 'available') {
    return metric.status;
  }
  if (!Number.isFinite(metric.value)) return 'invalid' as const;
  return 'available' as const;
}

function metricMap(metrics: DigitalTwinMetric[]) {
  const result = new Map<string, DigitalTwinMetric>();

  for (const metric of metrics) {
    const key = normalizeKey(metric.key);
    if (!key || result.has(key)) continue;
    result.set(key, metric);
  }

  return result;
}

function unavailableComparison(
  key: string,
  baseline: DigitalTwinMetric | undefined,
  candidate: DigitalTwinMetric | undefined,
  reason: DigitalTwinComparisonReason,
  detail: string,
): DigitalTwinMetricComparison {
  return {
    key,
    label: String(candidate?.label ?? baseline?.label ?? key),
    unit: baseline?.unit || candidate?.unit || null,
    baselineValue: Number.isFinite(baseline?.value)
      ? (baseline?.value as number)
      : null,
    candidateValue: Number.isFinite(candidate?.value)
      ? (candidate?.value as number)
      : null,
    absoluteDelta: null,
    relativeDeltaPercent: null,
    comparable: false,
    reason,
    detail,
  };
}

function hasMetricProvenance(
  metric: DigitalTwinMetric,
  scenarioGeneratedAtMs: number,
) {
  const source = normalizeContextId(metric.source);
  const observedAtMs = parseTrustedTimestamp(metric.observedAt);
  return Boolean(
    source &&
      observedAtMs !== null &&
      observedAtMs <= scenarioGeneratedAtMs &&
      observedAtMs <= Date.now(),
  );
}

export function compareDigitalTwinScenarios(
  baseline: DigitalTwinScenario,
  candidate: DigitalTwinScenario,
): DigitalTwinScenarioComparison {
  if (baseline.kind !== candidate.kind) {
    throw new Error(
      'Digital Twin karşılaştırması aynı senaryo türleri arasında yapılabilir.',
    );
  }

  const baselineContext = requireScenarioProvenance(baseline);
  const candidateContext = requireScenarioProvenance(candidate);

  // What-if sonuçlarını yanlış tarlaya bağlamamak için iki senaryonun da
  // açık ve doğrulanabilir provenansı olmalı. Eksik bağlamı fallback ile doldurmayız.
  if (baselineContext.fieldId !== candidateContext.fieldId) {
    throw new Error(
      'Digital Twin karşılaştırması farklı tarlalar arasında yapılamaz.',
    );
  }

  const baselineMetrics = metricMap(baseline.metrics);
  const candidateMetrics = metricMap(candidate.metrics);
  const keys = Array.from(
    new Set([
      ...baselineMetrics.keys(),
      ...candidateMetrics.keys(),
    ]),
  ).sort((a, b) => a.localeCompare(b, 'tr-TR'));

  const metrics = keys.map((key): DigitalTwinMetricComparison => {
    const base = baselineMetrics.get(key);
    const next = candidateMetrics.get(key);

    if (!base || !next) {
      return unavailableComparison(
        key,
        base,
        next,
        'missing_metric',
        'Metrik iki senaryoda da bulunmadığı için karşılaştırma yapılmadı.',
      );
    }

    const baseStatus = metricStatus(base);
    const nextStatus = metricStatus(next);

    if (baseStatus === 'blocked' || nextStatus === 'blocked') {
      return unavailableComparison(
        key,
        base,
        next,
        'source_blocked',
        String(
          next.blockedReason ??
            base.blockedReason ??
            'Metrik kaynağı kullanıma kapalı olduğu için karşılaştırma yapılmadı.',
        ),
      );
    }

    if (baseStatus === 'missing' || nextStatus === 'missing') {
      return unavailableComparison(
        key,
        base,
        next,
        'missing_metric',
        'Metrik değeri eksik olduğu için karşılaştırma yapılmadı.',
      );
    }

    if (baseStatus === 'invalid' || nextStatus === 'invalid') {
      return unavailableComparison(
        key,
        base,
        next,
        'invalid_value',
        'Geçersiz veya sonlu olmayan değer bulunduğu için karşılaştırma yapılmadı.',
      );
    }

    if (
      !hasMetricProvenance(base, baselineContext.generatedAtMs) ||
      !hasMetricProvenance(next, candidateContext.generatedAtMs)
    ) {
      return unavailableComparison(
        key,
        base,
        next,
        'missing_provenance',
        'Metrik kaynağı veya gözlem zamanı senaryo üretim zamanıyla doğrulanamadığı için karşılaştırma yapılmadı.',
      );
    }

    const baseUnit = normalizeUnit(base.unit);
    const nextUnit = normalizeUnit(next.unit);

    if (!baseUnit || !nextUnit || baseUnit !== nextUnit) {
      return unavailableComparison(
        key,
        base,
        next,
        'unit_mismatch',
        `Birimler uyumlu değil: "${base.unit || 'yok'}" / "${next.unit || 'yok'}".`,
      );
    }

    const baselineValue = base.value as number;
    const candidateValue = next.value as number;
    const absoluteDelta = candidateValue - baselineValue;

    if (baselineValue === 0) {
      return {
        key,
        label: String(next.label ?? base.label ?? key),
        unit: base.unit,
        baselineValue,
        candidateValue,
        absoluteDelta,
        relativeDeltaPercent: null,
        comparable: true,
        reason: 'zero_baseline',
        detail:
          'Başlangıç değeri 0 olduğu için yüzdesel fark hesaplanmadı; mutlak fark geçerlidir.',
      };
    }

    return {
      key,
      label: String(next.label ?? base.label ?? key),
      unit: base.unit,
      baselineValue,
      candidateValue,
      absoluteDelta,
      relativeDeltaPercent:
        (absoluteDelta / Math.abs(baselineValue)) * 100,
      comparable: true,
      reason: null,
      detail: null,
    };
  });

  const comparableMetricCount = metrics.filter(
    (metric) => metric.comparable,
  ).length;
  const blockedMetricCount = metrics.length - comparableMetricCount;

  let status: DigitalTwinComparisonStatus = 'blocked';
  if (comparableMetricCount === metrics.length && metrics.length > 0) {
    status = 'ready';
  } else if (comparableMetricCount > 0) {
    status = 'partial';
  }

  return {
    baselineScenarioId: baseline.id,
    candidateScenarioId: candidate.id,
    kind: baseline.kind,
    status,
    comparableMetricCount,
    blockedMetricCount,
    metrics,
  };
}
