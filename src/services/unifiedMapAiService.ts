import { supabase } from '../supabaseClient';
import { getFieldPhenologySnapshot } from '../features/phenology/services/fieldPhenologySnapshot.service';
import {
  compactRiskRadarForPusula,
  fetchFieldRiskRadar,
  type RiskRadarResult,
} from './riskRadarService';

export type UnifiedMapActiveLayer =
  | 'vegetation'
  | 'radar-vv'
  | 'radar-vh'
  | 'radar-water'
  | 'soil'
  | 'climate'
  | 'surface-temperature'
  | 'water-demand'
  | 'rain-history'
  | 'frost-risk'
  | 'biodiversity';

export type UnifiedMapAiResult = {
  status: 'normal' | 'dikkat' | 'kontrol';
  headline: string;
  summary: string;
  reasons: string[];
  action: string;
  confidence: 'dusuk' | 'orta' | 'yuksek';
  caution: string;
  importantArea?: {
    area: string;
    summary: string;
    evidence?: string[];
  } | null;
  model?: string;
  memorySaved?: boolean;
  memoryObservationId?: string | null;
  historyUsed?: number;
  memoryError?: string | null;
};

export type UnifiedMapAiInput = {
  fieldId: string;
  fieldName?: string;
  crop?: string;
  periodDays: number;
  activeLayer: UnifiedMapActiveLayer;
  activeLayerLabel: string;
  activeLayerContext?: unknown;
  context: {
    ndvi?: unknown;
    radar?: unknown;
    soil?: unknown;
    climate?: unknown;
    biodiversity?: unknown;
  };
};

export type FieldSynthesisLikelyCause = {
  title: string;
  probability: 'dusuk' | 'orta' | 'yuksek';
  reason: string;
};

export type FieldSynthesisEvidence = {
  layer:
    | UnifiedMapActiveLayer
    | 'phenology'
    | 'risk-radar'
    | 'visual-diagnosis';
  layerLabel: string;
  finding: string;
  status: 'normal' | 'dikkat' | 'kontrol';
};

export type FieldSynthesisLifecycle = {
  stage: string | null;
  stageLabel: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
  dataStatus: string | null;
  cropCycle: string | null;
  bearing: boolean | null;
  plantingYear: number | null;
  ndviTrend: string | null;
  ndviQuality: string | null;
  climateShiftDays: number;
  climateAnomalyC: number | null;
};

export type FieldSynthesisResult = {
  status: 'normal' | 'dikkat' | 'kontrol';
  headline: string;
  summary: string;
  likelyCauses: FieldSynthesisLikelyCause[];
  evidence: FieldSynthesisEvidence[];
  importantArea: {
    area: string;
    summary: string;
    evidence?: string[];
  } | null;
  action: string;
  caution: string;
  confidence: 'dusuk' | 'orta' | 'yuksek';
  layersUsed: UnifiedMapActiveLayer[];
  missingLayers: UnifiedMapActiveLayer[];
  layerCount: number;
  generatedAt: string;
  model?: string;
  lifecycle?: FieldSynthesisLifecycle | null;
  riskRadar?: ReturnType<typeof compactRiskRadarForPusula> | null;
  visualDiagnosis?: {
    latest: {
      activityId: string;
      source: string;
      provider: string | null;
      model: string | null;
      issueType: string;
      possibleIssue: string;
      confidence: number;
      severity: string;
      status: string;
      headline: string;
      observations: string[];
      recommendations: string[];
      needsMoreEvidence: boolean;
      followUpPhoto: string | null;
      comparison: string | null;
      trend: string | null;
      observedAt: string | null;
      evidenceLevel: 'ai_visual_pre_diagnosis';
    };
    historyCount: number;
  } | null;
  memorySaved?: boolean;
  memoryObservationId?: string | null;
  memoryError?: string | null;
};

export type FieldSynthesisInput = {
  fieldId: string;
  fieldName?: string;
  crop?: string;
  weatherContext?: unknown;
  climateContext?: unknown;
  lifecycleContext?: {
    cropCycle?: string | null;
    season?: number | null;
    plantingYear?: number | null;
    plantingDate?: string | null;
    harvestDate?: string | null;
    bearing?: boolean | null;
  };
};

function normalizeErrorMessage(value: unknown) {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return 'Pusula harita yorumunu oluşturamadı.';
}

async function readFunctionError(error: any) {
  try {
    const context = error?.context;
    if (context instanceof Response) {
      const text = await context.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            return parsed.error.trim();
          }
        } catch {
          return text.slice(0, 500);
        }
      }
    }
  } catch {
    // no-op
  }

  return error?.message || 'Pusula Edge Function çağrısı başarısız oldu.';
}

function uniqueText(items: string[], value: string) {
  if (value && !items.includes(value)) items.push(value);
}

function applyPhenologyToFieldSynthesis(
  synthesis: FieldSynthesisResult,
  snapshot: any,
): FieldSynthesisResult {
  if (!snapshot?.phenology) return synthesis;

  const phenology = snapshot.phenology;
  const context = snapshot.context ?? {};
  const ndvi = snapshot.ndvi ?? {};
  const climateShift = snapshot.climateShift ?? {};

  const lifecycle: FieldSynthesisLifecycle = {
    stage: phenology.stage ?? null,
    stageLabel: phenology.stageLabel ?? null,
    confidence: phenology.confidence ?? null,
    dataStatus: phenology.dataStatus ?? null,
    cropCycle: context.cropCycle ?? null,
    bearing: typeof context.bearing === 'boolean' ? context.bearing : null,
    plantingYear: Number.isFinite(Number(context.plantingYear))
      ? Number(context.plantingYear)
      : null,
    ndviTrend: ndvi.direction ?? null,
    ndviQuality: ndvi.quality ?? null,
    climateShiftDays: Number(climateShift.shiftDays ?? 0),
    climateAnomalyC: Number.isFinite(Number(climateShift.anomalyC))
      ? Number(climateShift.anomalyC)
      : null,
  };

  if (
    phenology.dataStatus !== 'usable' ||
    !phenology.stage ||
    phenology.stage === 'unknown'
  ) {
    return {
      ...synthesis,
      lifecycle,
    };
  }

  const evidence = Array.isArray(synthesis.evidence)
    ? [...synthesis.evidence]
    : [];

  evidence.unshift({
    layer: 'phenology',
    layerLabel: 'Fenoloji',
    finding: `${phenology.stageLabel}${
      climateShift.status === 'ready' && climateShift.shiftDays
        ? ` · ERA5 takvim düzeltmesi ${climateShift.shiftDays > 0 ? '+' : ''}${climateShift.shiftDays} gün`
        : ''
    }.`,
    status: 'normal',
  });

  let result: FieldSynthesisResult = {
    ...synthesis,
    evidence: evidence.slice(0, 8),
    lifecycle,
  };

  const crop = context.cropName ?? 'Ürün';
  const stage = String(phenology.stage);
  const stageLabel = String(phenology.stageLabel ?? 'Fenolojik dönem');

  if (
    context.cropCycle === 'perennial' &&
    context.bearing === false &&
    ['flowering', 'fruit_set', 'fruit_growth', 'maturation', 'harvest_window'].includes(stage)
  ) {
    const reasons = [
      `Üretim durumu: ${crop} henüz ürün vermiyor olarak kayıtlı.`,
      `Takvim evresi: ${stageLabel}.`,
    ];

    result = {
      ...result,
      headline: 'Ürün Vermeyen Ağaç · Genel Tarla Değerlendirmesi',
      summary:
        `${crop} henüz ürün vermiyor olarak kayıtlı. Takvimde “${stageLabel}” görünse de genel değerlendirmede meyve, olgunluk veya hasat önerileri bastırıldı. ` +
        result.summary,
      action: result.importantArea
        ? `${result.importantArea.area} bölümünde ağaç/taç gelişimi, sürgün durumu, su ve beslenme koşullarını komşu alanla karşılaştır; hasat veya olgunluk müdahalesi önerme.`
        : 'Ağaç/taç gelişimini, sürgün durumunu, su ve beslenme koşullarını takip et; hasat veya olgunluk müdahalesi önerme.',
      caution:
        `${result.caution} ${reasons.join(' ')}`,
    };
  } else if (stage === 'harvest_window') {
    result = {
      ...result,
      headline:
        result.status === 'normal'
          ? `Hasat Penceresi · ${result.headline}`
          : result.headline,
      summary:
        `${crop} için mevcut fenolojik dönem “${stageLabel}”. NDVI ve diğer katmanlardaki değişimler aktif büyüme dönemindeki eşiklerle tek başına yorumlanmamalı. ${result.summary}`,
      action:
        result.importantArea
          ? `${result.importantArea.area} bölümünde olgunluk, hasat durumu ve bitki görünümünü diğer alanlarla karşılaştır. ${result.action}`
          : `Olgunluk ve hasat durumunu sahada doğrula. ${result.action}`,
    };
  } else if (
    ['bud_break', 'flowering', 'fruit_set', 'fruit_growth'].includes(stage) &&
    ndvi.quality === 'usable' &&
    ndvi.direction === 'falling'
  ) {
    const causes = Array.isArray(result.likelyCauses)
      ? [...result.likelyCauses]
      : [];

    causes.unshift({
      title: `${stageLabel} döneminde NDVI düşüşü`,
      probability: 'orta',
      reason:
        `Aktif/hassas fenolojik dönemde 90 günlük NDVI trendi düşüyor. Bu durum tek başına teşhis değildir; su, beslenme ve bitki sağlığı sahada birlikte kontrol edilmelidir.`,
    });

    result = {
      ...result,
      status: result.status === 'normal' ? 'dikkat' : result.status,
      likelyCauses: causes.slice(0, 4),
      action:
        result.importantArea
          ? `${result.importantArea.area} bölümünü ${stageLabel.toLocaleLowerCase('tr-TR')} döneminde öncelikli saha kontrolüne al; su, beslenme ve bitki sağlığını birlikte değerlendir.`
          : `${stageLabel} dönemindeki NDVI düşüşünü sahada doğrula; su, beslenme ve bitki sağlığını birlikte kontrol et.`,
    };
  }

  const cautionParts = [result.caution];
  if (lifecycle.climateShiftDays !== 0) {
    uniqueText(
      cautionParts,
      `Fenoloji takvimi ERA5-Land termal sapmasına göre ${lifecycle.climateShiftDays > 0 ? '+' : ''}${lifecycle.climateShiftDays} gün kaydırıldı.`,
    );
  }

  return {
    ...result,
    caution: cautionParts.filter(Boolean).join(' '),
  };
}

async function getSynthesisPhenologySnapshot(input: FieldSynthesisInput) {
  try {
    return await getFieldPhenologySnapshot(
      {
        id: input.fieldId,
        name: input.fieldName ?? null,
        crop: input.crop ?? null,
        cropCycle: input.lifecycleContext?.cropCycle ?? null,
        plantingYear: input.lifecycleContext?.plantingYear ?? null,
        bearing:
          typeof input.lifecycleContext?.bearing === 'boolean'
            ? input.lifecycleContext.bearing
            : null,
      },
      {
        forceRefresh: false,
      },
    );
  } catch (error) {
    console.warn(
      '[Pusula] genel sentez fenoloji bağlamı alınamadı:',
      error,
    );
    return null;
  }
}

function riskRadarStatus(
  result: RiskRadarResult,
): 'normal' | 'dikkat' | 'kontrol' {
  if (
    result.overall?.level === 'critical' ||
    result.overall?.level === 'high'
  ) {
    return 'kontrol';
  }

  if (result.overall?.level === 'moderate') {
    return 'dikkat';
  }

  return 'normal';
}

function riskRadarProbability(
  score: number,
): 'dusuk' | 'orta' | 'yuksek' {
  if (score >= 65) return 'yuksek';
  if (score >= 30) return 'orta';
  return 'dusuk';
}

function applyRiskRadarToFieldSynthesis(
  synthesis: FieldSynthesisResult,
  risk: RiskRadarResult | null,
): FieldSynthesisResult {
  const compact = compactRiskRadarForPusula(risk);

  if (
    !risk?.supported ||
    !risk.overall ||
    !risk.threats?.length
  ) {
    return {
      ...synthesis,
      riskRadar: compact,
    };
  }

  const top = risk.threats[0];
  const radarStatus = riskRadarStatus(risk);

  const mergedStatus: FieldSynthesisResult['status'] =
    radarStatus === 'kontrol'
      ? 'kontrol'
      : radarStatus === 'dikkat' && synthesis.status === 'normal'
        ? 'dikkat'
        : synthesis.status;

  const evidence: FieldSynthesisEvidence[] = [
    {
      layer: 'risk-radar',
      layerLabel: 'Pusula Risk Radarı',
      finding: [
        `${top.displayName} riski %${Math.round(top.score)} (${top.levelLabel}).`,
        top.peakScore7d > top.score
          ? `7 günlük tepe risk %${Math.round(top.peakScore7d)}${
              top.peakDate ? ` (${top.peakDate})` : ''
            }.`
          : '',
        top.reasons?.[0] ?? '',
      ]
        .filter(Boolean)
        .join(' '),
      status: radarStatus,
    },
    ...(Array.isArray(synthesis.evidence) ? synthesis.evidence : []),
  ].slice(0, 9);

  const likelyCauses: FieldSynthesisLikelyCause[] = [
    ...(top.score >= 30
      ? [
          {
            title: `${top.displayName} için iklimsel risk`,
            probability: riskRadarProbability(top.score),
            reason:
              top.reasons?.join(' ') ||
              `Risk skoru %${Math.round(top.score)}.`,
          } as FieldSynthesisLikelyCause,
        ]
      : []),
    ...(Array.isArray(synthesis.likelyCauses)
      ? synthesis.likelyCauses
      : []),
  ].slice(0, 4);

  let headline = synthesis.headline;
  let summary = synthesis.summary;
  let action = synthesis.action;

  if (
    top.level === 'critical' ||
    top.level === 'high'
  ) {
    headline = `${top.displayName} riski yüksek · saha kontrolü`;
    summary = `${risk.overall.headline}. ${synthesis.summary}`;
    action = `${top.action} ${synthesis.action}`;
  } else if (top.level === 'moderate') {
    headline = `${top.displayName} riski takip edilmeli`;
    summary = `${risk.overall.headline}. ${synthesis.summary}`;
    action = `${top.action} ${synthesis.action}`;
  }

  const caution = [
    synthesis.caution,
    risk.provenance?.note ??
      'Risk skoru erken uyarıdır; kesin teşhis veya ilaçlama talimatı değildir.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...synthesis,
    status: mergedStatus,
    headline,
    summary,
    likelyCauses,
    evidence,
    action,
    caution,
    riskRadar: compact,
  };
}

export async function interpretUnifiedMap(
  input: UnifiedMapAiInput,
): Promise<UnifiedMapAiResult> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  if (!input.fieldId) {
    throw new Error('Pusula AI için tarla seçilmedi.');
  }

  if (!input.activeLayer) {
    throw new Error('Pusula AI için harita katmanı seçilmedi.');
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      'unified-map-ai',
      {
        body: {
          mode: 'single-layer',
          fieldId: input.fieldId,
          fieldName: input.fieldName,
          crop: input.crop,
          periodDays: input.periodDays,
          activeLayer: input.activeLayer,
          activeLayerLabel: input.activeLayerLabel,
          activeLayerContext: input.activeLayerContext,
          context: input.context,
        },
      },
    );

    if (error) {
      const message = await readFunctionError(error);
      console.error('[Pusula] unified-map-ai invoke hatası:', error);
      throw new Error(message);
    }

    if (!data) {
      throw new Error('Pusula boş yanıt döndürdü.');
    }

    if (data.ok === false) {
      throw new Error(
        data.error || 'Pusula harita yorumunu oluşturamadı.',
      );
    }

    if (!data.analysis) {
      throw new Error('Pusula yanıtında analiz bulunamadı.');
    }

    const analysis = data.analysis as UnifiedMapAiResult;

    return {
      ...analysis,
      importantArea: analysis.importantArea ?? null,
      model: analysis.model ?? 'pusula-spatial-engine-v2',
      memorySaved: Boolean(data.memorySaved),
      memoryObservationId: data.memoryObservationId ?? null,
      historyUsed: Number(data.historyUsed ?? 0),
      memoryError:
        typeof data.memoryError === 'string' ? data.memoryError : null,
    };
  } catch (error) {
    const message = normalizeErrorMessage(error);
    console.error('[Pusula] harita yorumu:', message);
    throw new Error(message);
  }
}

export async function synthesizeFieldObservations(
  input: FieldSynthesisInput,
): Promise<FieldSynthesisResult> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  if (!input.fieldId) {
    throw new Error('Genel değerlendirme için tarla seçilmedi.');
  }

  try {
    const [phenologySnapshot, riskRadarResult] = await Promise.all([
      getSynthesisPhenologySnapshot(input),
      fetchFieldRiskRadar(
        input.fieldId,
        {
          seasonStartDate:
            input.lifecycleContext?.plantingDate ?? null,
        },
      ).catch((error) => {
        console.warn(
          '[Pusula] Risk Radarı genel senteze eklenemedi:',
          error,
        );
        return null;
      }),
    ]);

    const lifecycleContext = {
      ...(input.lifecycleContext ?? {}),
      bearing:
        phenologySnapshot?.context?.bearing ??
        input.lifecycleContext?.bearing ??
        null,
      phenologyStage:
        phenologySnapshot?.phenology?.stage ?? null,
      phenologyStageLabel:
        phenologySnapshot?.phenology?.stageLabel ?? null,
      phenologyConfidence:
        phenologySnapshot?.phenology?.confidence ?? null,
      phenologyDataStatus:
        phenologySnapshot?.phenology?.dataStatus ?? null,
      ndviTrend:
        phenologySnapshot?.ndvi?.direction ?? null,
      ndviQuality:
        phenologySnapshot?.ndvi?.quality ?? null,
      climateShiftDays:
        phenologySnapshot?.climateShift?.shiftDays ?? 0,
      climateAnomalyC:
        phenologySnapshot?.climateShift?.anomalyC ?? null,
      riskRadar:
        compactRiskRadarForPusula(riskRadarResult),
    };

    const { data, error } = await supabase.functions.invoke(
      'unified-map-ai',
      {
        body: {
          mode: 'field-synthesis',
          fieldId: input.fieldId,
          fieldName: input.fieldName,
          crop: input.crop,

          /*
            Backend v13 field-synthesis kontrolünden önce activeLayer
            doğruladığı için geriye dönük uyumluluk alanları.
          */
          activeLayer: 'vegetation',
          activeLayerLabel: 'Sağlık',

          weatherContext: input.weatherContext ?? null,
          climateContext: input.climateContext ?? null,
          lifecycleContext,
          riskRadarContext:
            compactRiskRadarForPusula(riskRadarResult),
        },
      },
    );

    if (error) {
      const message = await readFunctionError(error);
      console.error('[Pusula] harmanlama invoke hatası:', error);
      throw new Error(message);
    }

    if (!data) {
      throw new Error('Pusula genel değerlendirme yanıtı boş geldi.');
    }

    if (data.ok === false) {
      throw new Error(
        data.error || 'Pusula genel değerlendirmeyi oluşturamadı.',
      );
    }

    if (!data.synthesis) {
      throw new Error(
        'Pusula yanıtında genel değerlendirme bulunamadı.',
      );
    }

    const rawSynthesis = data.synthesis as FieldSynthesisResult;

    const normalized: FieldSynthesisResult = {
      ...rawSynthesis,
      likelyCauses: Array.isArray(rawSynthesis.likelyCauses)
        ? rawSynthesis.likelyCauses
        : [],
      evidence: Array.isArray(rawSynthesis.evidence)
        ? rawSynthesis.evidence
        : [],
      layersUsed: Array.isArray(rawSynthesis.layersUsed)
        ? rawSynthesis.layersUsed
        : [],
      missingLayers: Array.isArray(rawSynthesis.missingLayers)
        ? rawSynthesis.missingLayers
        : [],
      importantArea: rawSynthesis.importantArea ?? null,
      layerCount: Number(
        rawSynthesis.layerCount ?? rawSynthesis.layersUsed?.length ?? 0,
      ),
      generatedAt:
        rawSynthesis.generatedAt || new Date().toISOString(),
      model: rawSynthesis.model || 'pusula-field-synthesis-v1',
      memorySaved: Boolean(data.memorySaved),
      memoryObservationId: data.memoryObservationId ?? null,
      memoryError:
        typeof data.memoryError === 'string' ? data.memoryError : null,
    };

    const withPhenology = applyPhenologyToFieldSynthesis(
      normalized,
      phenologySnapshot,
    );

    return applyRiskRadarToFieldSynthesis(
      withPhenology,
      riskRadarResult,
    );
  } catch (error) {
    const message = normalizeErrorMessage(error);
    console.error('[Pusula] genel değerlendirme:', message);
    throw new Error(message);
  }
}
