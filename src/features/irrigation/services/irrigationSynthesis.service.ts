import { supabase } from '../../../supabaseClient';
import { getFieldPhenologySnapshot } from '../../phenology/services/fieldPhenologySnapshot.service';
import type {
  IrrigationDecisionConfidence,
  IrrigationDecisionResult,
  IrrigationDecisionSynthesis,
} from '../types/irrigationDecision';
import {
  getWaporWaterEvidence,
} from './waporWaterEvidence.service';

function compactUnique(values: Array<string | null | undefined>, limit = 10) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
    .slice(0, limit);
}

function lowerConfidence(
  value: IrrigationDecisionConfidence,
): IrrigationDecisionConfidence {
  if (value === 'high') return 'medium';
  return value;
}

async function loadFieldForPhenology(fieldId: string) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) throw new Error('Sulama sentezi için oturum bulunamadı.');

  const { data, error } = await supabase
    .from('fields')
    .select([
      'id',
      'crop',
      'crop_subtype',
      'crop_cycle',
      'season',
      'planting_year',
      'bearing',
      'parcel_geometry',
      'parcel_centroid_lat',
      'parcel_centroid_lng',
      'latitude',
      'longitude',
    ].join(','))
    .eq('id', fieldId)
    .eq('user_id', userResult.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Sulama sentezi için tarla bulunamadı.');

  const row = data as Record<string, any>;
  return {
    ...row,
    cropName: row.crop ?? null,
    cropCycle: row.crop_cycle ?? null,
    plantingYear: row.planting_year ?? null,
    parcelGeometry: row.parcel_geometry ?? null,
    parcelCentroidLat: row.parcel_centroid_lat ?? null,
    parcelCentroidLng: row.parcel_centroid_lng ?? null,
  };
}

export async function resolveIrrigationSynthesis(
  decision: IrrigationDecisionResult,
): Promise<IrrigationDecisionSynthesis> {
  const fieldId = String(decision.fieldId ?? '').trim();
  const pyfao = decision.modelEvidence;
  const aquaCrop = decision.seasonModelEvidence;

  let phenologySnapshot: Awaited<ReturnType<typeof getFieldPhenologySnapshot>> | null = null;
  let phenologyError: string | null = null;
  let fieldForEvidence: Awaited<ReturnType<typeof loadFieldForPhenology>> | null = null;

  try {
    fieldForEvidence = await loadFieldForPhenology(fieldId);
    phenologySnapshot = await getFieldPhenologySnapshot(fieldForEvidence, {
      forceRefresh: false,
    });
  } catch (error) {
    phenologyError = error instanceof Error
      ? error.message
      : 'Fenoloji bağlamı hazırlanamadı.';
  }

  const wapor = await getWaporWaterEvidence({
    fieldId,
    latitude:
      fieldForEvidence?.parcelCentroidLat ??
      fieldForEvidence?.latitude ??
      null,
    longitude:
      fieldForEvidence?.parcelCentroidLng ??
      fieldForEvidence?.longitude ??
      null,
  });

  const phenology = phenologySnapshot?.phenology ?? null;
  const phenologyUsable = Boolean(
    phenology &&
      phenology.dataStatus === 'usable' &&
      phenology.stage &&
      phenology.stage !== 'unknown',
  );

  const pyfaoStatus = pyfao?.status ?? 'waiting';
  const aquaCropStatus = aquaCrop?.status ?? 'waiting';
  const pyfaoApplicable = decision.irrigationStatus !== 'rainfed';
  const pyfaoSupportive = pyfaoStatus === 'ready' && pyfao?.agreement === 'supportive';
  const pyfaoDivergent = pyfaoStatus === 'ready' && pyfao?.agreement === 'divergent';
  const aquaCropReady = aquaCropStatus === 'ready';
  const productionReady = decision.decision !== 'needs_data';

  const missingSources = compactUnique([
    !phenologyUsable ? 'fenoloji' : null,
    pyfaoApplicable && pyfaoStatus !== 'ready' ? 'pyfao56' : null,
    !aquaCropReady ? 'AquaCrop' : null,
  ]);

  const agreement = !productionReady
    ? 'insufficient' as const
    : pyfaoDivergent
      ? 'mixed' as const
      : phenologyUsable && aquaCropReady && pyfaoSupportive
        ? 'aligned' as const
        : 'partial' as const;

  const status: IrrigationDecisionSynthesis['status'] =
    agreement === 'insufficient'
      ? 'blocked'
      : agreement === 'aligned' || agreement === 'mixed'
        ? 'ready'
        : 'partial';

  const synthesisConfidence: IrrigationDecisionConfidence =
    agreement === 'mixed' || agreement === 'insufficient'
      ? 'low'
      : agreement === 'partial'
        ? lowerConfidence(decision.confidence)
        : decision.confidence;

  const headline =
    agreement === 'aligned'
      ? 'Sulama Sentezi Güçlü'
      : agreement === 'mixed'
        ? 'Sulama Modelleri Ayrışıyor'
        : agreement === 'insufficient'
          ? 'Sulama Sentezi İçin Veri Eksik'
          : 'Sulama Sentezi Kısmi';

  const summary =
    agreement === 'aligned'
      ? 'Güncel fenoloji/Kc aktif, pyfao56 beş günlük su açığı yönünü destekliyor ve AquaCrop sezon bağlamı hazır.'
      : agreement === 'mixed'
        ? 'Fenoloji ve sezon bağlamı mevcut; pyfao56 kısa dönem su açığı projeksiyonunda production sulama motorundan ayrışıyor.'
        : agreement === 'insufficient'
          ? 'Production sulama kararı için temel saha verileri tamamlanmadan modeller tek bir güvenilir senteze dönüştürülmüyor.'
          : missingSources.length
            ? `Production karar korunuyor; sentezi güçlendirmek için ${missingSources.join(', ')} kaynağı bekleniyor veya güncelleniyor.`
            : 'Production karar hazır; bağımsız model ufukları birebir karşılaştırılabilir olmadığı için sentez kısmi tutuluyor.';

  const evidence = compactUnique([
    phenologyUsable && phenology?.stageLabel
      ? `Fenoloji: ${phenology.stageLabel} · güven ${phenology.confidence}`
      : null,
    decision.currentKc != null
      ? `Fenoloji/Kc su tüketimi katsayısı: ${decision.currentKc.toFixed(2)}`
      : null,
    ...(phenologySnapshot?.evidence ?? []).slice(0, 2),
    ...(pyfaoStatus === 'ready' ? pyfao?.evidence ?? [] : []).slice(0, 3),
    ...(aquaCropReady ? aquaCrop?.evidence ?? [] : []).slice(0, 2),
    ...(wapor.status === 'ready' || wapor.status === 'partial'
      ? wapor.evidence
      : []
    ).slice(0, 3),
  ], 12);

  const warnings = compactUnique([
    phenologyError,
    pyfaoDivergent
      ? 'pyfao56 kısa dönem su dengesi production projeksiyonundan ayrışıyor; sulama öncesi saha doğrulaması gerekli.'
      : null,
    pyfaoApplicable && pyfaoStatus !== 'ready'
      ? pyfao?.note ?? 'pyfao56 kısa dönem doğrulaması henüz hazır değil.'
      : null,
    !aquaCropReady
      ? aquaCrop?.note ?? 'AquaCrop sezon bağlamı henüz hazır değil.'
      : null,
    !phenologyUsable && !phenologyError
      ? 'Güncel gelişim evresi doğrulanamadığı için fenoloji katkısı sentezde sınırlı.'
      : null,
    wapor.status === 'ready' || wapor.status === 'partial'
      ? wapor.warnings[0] ?? null
      : null,
  ], 9);

  return {
    status,
    agreement,
    confidence: synthesisConfidence,
    productionAuthority: false,
    stage: phenologyUsable ? phenology?.stage ?? null : null,
    stageLabel: phenologyUsable ? phenology?.stageLabel ?? null : null,
    phenologyConfidence: phenologyUsable ? phenology?.confidence ?? null : null,
    phenologyGeneratedAt: phenologySnapshot?.generatedAt ?? null,
    currentKc: decision.currentKc,
    sources: {
      production: true,
      phenology: phenologyError ? 'error' : phenologyUsable ? 'ready' : 'missing',
      pyfao56: pyfaoApplicable
        ? pyfaoStatus
        : 'not_applicable',
      aquacrop: aquaCropStatus,
      wapor: wapor.status,
    },
    missingSources,
    headline,
    summary,
    evidence,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

export function attachIrrigationSynthesis(
  decision: IrrigationDecisionResult | null | undefined,
  synthesis: IrrigationDecisionSynthesis | null | undefined,
): IrrigationDecisionResult | null {
  if (!decision) return null;
  if (!synthesis) return decision;

  const confidence = synthesis.agreement === 'mixed'
    ? 'low' as const
    : decision.confidence;

  return {
    ...decision,
    confidence,
    reasons: compactUnique([
      ...(decision.reasons ?? []),
      `Sulama sentezi: ${synthesis.summary}`,
      ...synthesis.evidence,
    ], 14),
    warnings: compactUnique([
      ...(decision.warnings ?? []),
      ...synthesis.warnings,
    ], 12),
    synthesis,
  };
}
