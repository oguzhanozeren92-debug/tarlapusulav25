import { supabase } from '../../../supabaseClient';
import { emitPcsePilotUpdated } from './pcsePilotEvidence.service';
import type {
  NdviTrendDirection,
  NdviTrendQuality,
  PhenologyResult,
  PhenologyStage,
} from '../types/phenology';

export type PcsePhenologyPilotResponse = {
  ok: boolean;
  blocked: boolean;
  cached?: boolean;
  engine: 'pcse';
  mode: 'pilot';
  fieldId: string;
  productionAuthority: false;
  waterStressAuthority: false;
  missingInputs: string[];
  result: PcsePhenologyGatewayResult | null;
};

type PcsePhenologyGatewayResult = {
  ok: true;
  engine: 'pcse';
  mode: 'phenology_pilot';
  model: 'Wofost72_Phenology';
  production_authority: false;
  water_stress_authority: false;
  simulation: {
    planting_date: string;
    requested_as_of_date: string;
    actual_output_date: string | null;
    harvest_date: string | null;
    crop_key: string;
    variety_key: string;
    production_level: 'phenology_only';
  };
  phenology: {
    dvs: number | null;
    stage: 'pre_emergence' | 'vegetative' | 'reproductive' | 'mature' | null;
    emergence_date: string | null;
    anthesis_date: string | null;
    maturity_date: string | null;
    harvest_date: string | null;
  };
  outputs: {
    daily_rows: number;
    latest: { day?: string | null; DVS?: number | null } | null;
    summary: Record<string, string | null> | null;
  };
};

type NdviEvidence = {
  direction?: NdviTrendDirection | null;
  quality?: NdviTrendQuality | null;
  latestAverage?: number | null;
  changeFromPrevious?: number | null;
  changeFromFirst?: number | null;
} | null;

function stringOrNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const endMs = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 86400000);
}

function mapPcseStage(value: unknown, dvs: number | null): PhenologyStage {
  const stage = String(value ?? '').trim().toLowerCase();
  if (stage === 'pre_emergence') return 'establishment';
  if (stage === 'vegetative') return 'vegetative';
  if (stage === 'reproductive') return 'reproductive';
  if (stage === 'mature') return 'maturation';

  if (dvs !== null) {
    if (dvs < 0) return 'establishment';
    if (dvs < 1) return 'vegetative';
    if (dvs < 2) return 'reproductive';
    return 'maturation';
  }

  return 'unknown';
}

function stageLabel(stage: PhenologyStage) {
  switch (stage) {
    case 'establishment':
      return 'Çıkış / kuruluş';
    case 'vegetative':
      return 'Vejetatif gelişim';
    case 'reproductive':
      return 'Üreme / generatif dönem';
    case 'maturation':
      return 'Olgunlaşma';
    default:
      return 'Belirlenemedi';
  }
}

export async function runPcsePhenologyPilot(fieldId: string): Promise<PcsePhenologyPilotResponse> {
  const id = String(fieldId ?? '').trim();
  if (!id) throw new Error('PCSE fenoloji pilotu için tarla kimliği gerekli.');

  const { data, error } = await supabase.functions.invoke('pcse-pilot-run', {
    body: { field_id: id },
  });

  if (error) throw error;
  if (!data || data.ok === false) {
    throw new Error(String(data?.error ?? 'PCSE fenoloji pilotu çalıştırılamadı.'));
  }

  emitPcsePilotUpdated(String(data.field_id ?? id));

  return {
    ok: true,
    blocked: Boolean(data.blocked),
    cached: Boolean(data.cached),
    engine: 'pcse',
    mode: 'pilot',
    fieldId: String(data.field_id ?? id),
    productionAuthority: false,
    waterStressAuthority: false,
    missingInputs: Array.isArray(data.missing_inputs)
      ? data.missing_inputs.map(String)
      : [],
    result: data.result ?? null,
  };
}

export function buildPcsePhenologyResult(
  run: PcsePhenologyPilotResponse | null | undefined,
  ndviTrend?: NdviEvidence,
): PhenologyResult | null {
  if (!run || run.blocked || !run.result) return null;
  if (
    run.result.engine !== 'pcse' ||
    run.result.mode !== 'phenology_pilot' ||
    run.result.model !== 'Wofost72_Phenology' ||
    run.result?.simulation?.production_level !== 'phenology_only' ||
    run.result.production_authority !== false ||
    run.result.water_stress_authority !== false
  ) {
    return null;
  }

  const dvs = finiteOrNull(run.result?.phenology?.dvs);
  const stage = mapPcseStage(run.result?.phenology?.stage, dvs);
  if (stage === 'unknown') return null;

  const plantingDate = stringOrNull(run.result?.simulation?.planting_date)?.slice(0, 10) ?? null;
  const outputDate = stringOrNull(run.result?.simulation?.actual_output_date)?.slice(0, 10) ?? null;
  const maturityDate = stringOrNull(run.result?.phenology?.maturity_date)?.slice(0, 10) ?? null;

  const progressPercent = dvs === null
    ? null
    : Math.round(clamp((Math.max(0, dvs) / 2) * 100, 0, 100));

  const basis = [
    'WOFOST 7.2 fenoloji-only gelişim modeli',
    'TarlaPusula sunucu tarafında doğrulanmış ürün ve çeşit eşlemesi',
    'Open-Meteo ERA5-Land günlük hava serisi',
  ];

  const warnings: string[] = [
    'Bu gelişim evresi su stresini modellemez; sulama kararı ayrı su dengesi motorlarından gelir.',
  ];

  if (
    ndviTrend?.quality === 'usable' &&
    ndviTrend.direction &&
    ndviTrend.direction !== 'unknown'
  ) {
    basis.push(`NDVI trendi ek kanıt olarak ${ndviTrend.direction} yönünde.`);

    if (
      (stage === 'vegetative' || stage === 'reproductive') &&
      ndviTrend.direction === 'falling'
    ) {
      warnings.push('Model aktif gelişim gösterirken NDVI düşüyor; saha kontrolü gerekebilir.');
    }
  }

  const label = stageLabel(stage);

  return {
    stage,
    stageLabel: label,
    confidence: 'medium',
    dataStatus: 'usable',
    progressPercent,
    daysSinceSowing: daysBetween(plantingDate, outputDate),
    daysUntilExpectedHarvest: maturityDate && outputDate
      ? daysBetween(outputDate, maturityDate)
      : null,
    basis,
    warnings,
    summary: `Ürün gelişim modeli bu tarlayı “${label}” evresinde gösteriyor.`,
  };
}
