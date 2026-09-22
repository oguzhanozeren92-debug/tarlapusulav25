import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  buildFieldPhenology,
} from '../services/buildFieldPhenology';

import type {
  FieldForPhenology,
  NdviTrendForPhenology,
} from '../services/buildFieldPhenology';

import {
  buildPcsePhenologyResult,
  runPcsePhenologyPilot,
  type PcsePhenologyPilotResponse,
} from '../services/pcsePhenology.service';

import type {
  PhenologyResult,
} from '../types/phenology';

const KNOWN_PERENNIAL_CROPS = new Set([
  'antep fıstığı', 'antepfıstığı', 'antep fistigi', 'antepfistigi', 'fıstık', 'fistik', 'pistachio',
  'badem', 'almond',
  'kiraz', 'cherry', 'cherries',
  'ceviz', 'walnut', 'walnuts',
  'üzüm', 'uzum', 'grape', 'grapes',
  'elma', 'apple',
  'armut', 'pear',
  'zeytin', 'olive',
  'fındık', 'findik', 'hazelnut',
  'kayısı', 'kayisi', 'apricot',
  'şeftali', 'seftali', 'peach',
  'erik', 'plum',
  'nar', 'pomegranate',
]);

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export function useFieldPhenology(
  field:
    | FieldForPhenology
    | null
    | undefined,
  ndviTrend?:
    NdviTrendForPhenology,
): PhenologyResult | null {
  const effectiveField = useMemo(() => {
    if (!field) return null;

    const record = field as FieldForPhenology & Record<string, unknown>;
    const cropName = normalizeText(record.cropName ?? record.crop);
    if (!KNOWN_PERENNIAL_CROPS.has(cropName)) return field;

    return {
      ...field,
      cropCycle: 'perennial',
      crop_cycle: 'perennial',
    };
  }, [field]);

  const localPhenology = useMemo(
    () => {
      if (!effectiveField) {
        return null;
      }

      return buildFieldPhenology(
        effectiveField,
        ndviTrend ??
          null,
      );
    },
    [
      effectiveField,
      ndviTrend?.direction,
      ndviTrend?.quality,
      ndviTrend?.latestAverage,
      ndviTrend?.changeFromPrevious,
      ndviTrend?.changeFromFirst,
    ],
  );

  const fieldRecord = effectiveField as (FieldForPhenology & Record<string, unknown>) | null | undefined;
  const fieldId = textOrNull(fieldRecord?.id);
  const cropCycle = textOrNull(fieldRecord?.cropCycle ?? fieldRecord?.crop_cycle)?.toLowerCase() ?? 'unknown';
  const sowingDate = textOrNull(
    fieldRecord?.sowingDate ??
    fieldRecord?.sowing_date ??
    fieldRecord?.plantingDate ??
    fieldRecord?.planting_date,
  );
  const actualHarvestDate = textOrNull(
    fieldRecord?.actualHarvestDate ??
    fieldRecord?.actual_harvest_date ??
    fieldRecord?.harvestedAt ??
    fieldRecord?.harvested_at,
  );
  const varietyHint = textOrNull(
    fieldRecord?.varietyName ??
    fieldRecord?.variety_name,
  );

  const [pcseRun, setPcseRun] = useState<PcsePhenologyPilotResponse | null>(null);

  useEffect(() => {
    if (
      !fieldId ||
      !sowingDate ||
      actualHarvestDate ||
      cropCycle === 'perennial'
    ) {
      setPcseRun(null);
      return;
    }

    let cancelled = false;
    setPcseRun(null);

    void runPcsePhenologyPilot(fieldId)
      .then((run) => {
        if (!cancelled) setPcseRun(run);
      })
      .catch((error) => {
        if (!cancelled) {
          setPcseRun(null);
          console.warn(
            '[TarlaPusula] PCSE fenoloji pilotu kullanılamadı; güvenli yerel fenoloji sonucu korunuyor:',
            error,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    fieldId,
    sowingDate,
    actualHarvestDate,
    cropCycle,
    varietyHint,
  ]);

  const pcsePhenology = useMemo(
    () => buildPcsePhenologyResult(
      pcseRun,
      ndviTrend ?? null,
    ),
    [
      pcseRun,
      ndviTrend?.direction,
      ndviTrend?.quality,
      ndviTrend?.latestAverage,
      ndviTrend?.changeFromPrevious,
      ndviTrend?.changeFromFirst,
    ],
  );

  return pcsePhenology ?? localPhenology;
}
