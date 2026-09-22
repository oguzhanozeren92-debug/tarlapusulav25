import type { FieldOperation } from '../../field-operations/types/fieldOperation';
import type { NdviTimeSeriesPoint } from '../../satellite/types/ndviTimeSeries';
import { isRecentSatelliteObservation } from '../../satellite/services/buildHomeSatelliteDecision.ts';

const dayMs = 86_400_000;
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(new Date(value));

export function buildOperationSatelliteFollowUp(input: {
  fieldId: string; operations: FieldOperation[]; points: NdviTimeSeriesPoint[];
  quality: string | undefined; phenology: { stage: string; dataStatus: string } | null | undefined;
}, now = new Date()) {
  const activeGrowth = input.phenology?.dataStatus === 'usable' &&
    ['establishment', 'vegetative', 'reproductive', 'flowering', 'fruit_set', 'fruit_growth', 'veraison'].includes(input.phenology.stage);
  if (!input.fieldId || !activeGrowth || input.quality !== 'usable') return null;
  const points = [...new Map(input.points.filter((point) =>
    /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Date.parse(point.date)) &&
    Number.isFinite(point.average) && point.average >= -1 && point.average <= 1 &&
    point.sampleCount !== 0 && Date.parse(point.date) <= now.getTime()
  ).map((point) => [point.date, point])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const latest = points.at(-1);
  if (points.length < 3 || !latest || !isRecentSatelliteObservation(latest.date, now) ||
    Date.parse(latest.date) - Date.parse(points[0].date) < 12 * dayMs) return null;
  const operations = input.operations.filter((op) => op.fieldId === input.fieldId &&
    ['Sulama', 'Gübreleme', 'İlaçlama'].includes(op.type) && /^\d{4}-\d{2}-\d{2}$/.test(op.date) &&
    Number.isFinite(Date.parse(op.date)) && Date.parse(op.date) <= now.getTime() &&
    now.getTime() - Date.parse(op.date) <= 30 * dayMs
  ).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const operation = operations[0];
  if (!operation) return null;
  const before = points.filter((point) => point.date < operation.date).at(-1);
  if (!before || Date.parse(operation.date) - Date.parse(before.date) > 30 * dayMs) return null;
  if (latest.date <= operation.date) return {
    key: JSON.stringify([input.fieldId, operation.id, operation.date, 'waiting']),
    summary: `${formatDate(operation.date)} tarihli ${operation.type.toLocaleLowerCase('tr-TR')} kaydını takip ediyorum. İşlem sonrası uydu görüntüsü henüz gelmedi.`,
    evidence: [`İşlem: ${operation.type} · ${formatDate(operation.date)}.`, `Son kullanılabilir görüntü: ${formatDate(latest.date)}.`],
    detail: 'Yeni kullanılabilir görüntü geldiğinde işlem öncesiyle karşılaştıracağız. Şimdilik işlemin sonucu hakkında yorum yapmıyorum.',
  };
  const delta = Math.round((latest.average - before.average) * 1000) / 1000;
  const direction = delta > 0 ? 'arttı' : delta < 0 ? 'azaldı' : 'belirgin değişmedi';
  const otherOperations = input.operations.filter((op) => op.fieldId === input.fieldId && op.id !== operation.id &&
    op.date >= before.date && op.date <= latest.date);
  return {
    key: JSON.stringify([input.fieldId, operation.id, operation.date, before.date, latest.date]),
    summary: `${formatDate(operation.date)} tarihli ${operation.type.toLocaleLowerCase('tr-TR')} kaydından sonra yeni uydu görüntüsü geldi. Öncesiyle karşılaştıralım mı?`,
    detail: 'Uydu görüntüsü işlemin işe yaradığını tek başına kanıtlamaz. Yağış, mevsim ve bitkinin gelişimi de bu sinyali değiştirebilir. Sonucu tarladaki gözleminle birlikte değerlendir.',
    evidence: [
      `İşlem: ${operation.type} · ${formatDate(operation.date)}.`,
      `Önceki görüntü: ${formatDate(before.date)}. Sonraki görüntü: ${formatDate(latest.date)}.`,
      `Bu iki görüntü arasında bitki örtüsü sinyali ${direction}.`,
      ...(otherOperations.length ? [`Aynı dönemde ${otherOperations.length} başka işlem kaydı da var; değişimi tek bir işleme bağlayamayız.`] : []),
    ],
  };
}
