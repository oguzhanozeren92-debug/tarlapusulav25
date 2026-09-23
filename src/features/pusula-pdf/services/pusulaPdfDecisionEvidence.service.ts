import { supabase } from '../../../supabaseClient';
import { listSoilAnalyses } from '../../../lib/soilAnalysisService';
import { fetchSoilGridsProfile, type SoilGridsProfile } from '../../../services/soilGridsService';
import {
  compactRiskRadarForPusula,
  fetchFieldRiskRadar,
} from '../../../services/riskRadarService';
import { buildPlantHealthSynthesisDecision } from '../../decision/services/buildPlantHealthSynthesisDecision';
import type { HomeObservationFollowUpSignal } from '../../decision/types/homeDecision';
import { loadObservationDecisionSignal } from '../../field-observations/services/fieldObservation.service';
import { getFieldPhenologySnapshot } from '../../phenology/services/fieldPhenologySnapshot.service';
import {
  buildSoilIntelligence,
  type SoilIntelligenceResult,
} from '../../nutrition/services/soilIntelligence.service';

const PDF_LAYER_ARCHIVE_NAMESPACE = 'pdf-layer-archive-v1';
const RETENTION_MS = 20 * 365 * 24 * 60 * 60 * 1000;

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function normalizeTrackedIssueStatus(value: unknown): HomeObservationFollowUpSignal['trackedIssueStatus'] {
  const status = text(value);
  return ['improving', 'stable', 'worsening', 'not_visible', 'uncertain'].includes(status)
    ? status as HomeObservationFollowUpSignal['trackedIssueStatus']
    : null;
}

async function requirePdfUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error('PUSULAPDF kanıt arşivi için oturum bulunamadı.');
  return userId;
}

async function loadFieldRecord(fieldId: string, userId: string) {
  const { data, error } = await supabase
    .from('fields')
    .select([
      'id',
      'name',
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
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('PUSULAPDF kanıt arşivi için tarla bulunamadı.');

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

async function archiveLayer(
  userId: string,
  fieldId: string,
  payload: Record<string, any>,
  sourceKey: string,
) {
  const now = new Date();
  const observedAt = dateOnly(payload.observedAt) ?? now.toISOString().slice(0, 10);
  const cacheKey = [fieldId, sourceKey].join(':');

  const { error } = await supabase.from('field_map_layer_cache').upsert(
    {
      user_id: userId,
      field_id: fieldId,
      namespace: PDF_LAYER_ARCHIVE_NAMESPACE,
      cache_key: cacheKey,
      payload: {
        ...payload,
        fieldId,
        observedAt,
        archivedAt: now.toISOString(),
      },
      data_date: observedAt,
      source_key: sourceKey,
      saved_at: now.toISOString(),
      expires_at: new Date(now.getTime() + RETENTION_MS).toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,field_id,namespace,cache_key' },
  );

  if (error) throw error;
}

export type PdfSoilIntelligenceBundle = {
  field: Record<string, any>;
  latestAnalysis: Awaited<ReturnType<typeof listSoilAnalyses>>[number] | null;
  soilGridsProfile: SoilGridsProfile | null;
  intelligence: SoilIntelligenceResult;
};

/**
 * PDF ve sulama sentezi aynı gerçek toprak bağlamını kullanır. Laboratuvar
 * sorgusu başarısızsa bunu "analiz yok" diye yorumlamaz; hata yukarı taşınır.
 * SoilGrids ise yalnız best-effort model bağlamıdır.
 */
export async function loadFieldSoilIntelligenceForPdf(
  fieldIdInput: string,
): Promise<PdfSoilIntelligenceBundle> {
  const fieldId = text(fieldIdInput);
  if (!fieldId) throw new Error('Toprak bağlamı için tarla seçilmedi.');

  const userId = await requirePdfUser();
  const field = await loadFieldRecord(fieldId, userId);
  const analyses = await listSoilAnalyses(fieldId);
  const latestAnalysis = analyses[0] ?? null;
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);

  let soilGridsProfile: SoilGridsProfile | null = null;
  let soilGridsStatus: 'idle' | 'ready' | 'error' = 'idle';

  if (latitude !== null && longitude !== null) {
    try {
      soilGridsProfile = await fetchSoilGridsProfile(latitude, longitude);
      soilGridsStatus = 'ready';
    } catch (error) {
      soilGridsStatus = 'error';
      console.warn('[PUSULAPDF] SoilGrids arka planı alınamadı:', error);
    }
  }

  const intelligence = buildSoilIntelligence({
    latestAnalysis,
    soilGridsProfile,
    soilGridsStatus,
  });

  return { field, latestAnalysis, soilGridsProfile, intelligence };
}

function observationSignalFromLatest(
  latest: Awaited<ReturnType<typeof loadObservationDecisionSignal>>,
  now = new Date(),
): HomeObservationFollowUpSignal | null {
  if (!latest?.point) return null;

  const point = latest.point;
  const comparison = latest.comparison;
  const details = objectValue(comparison?.details);
  const trackedIssue = objectValue(details.trackedIssue);
  const aiComparison = objectValue(details.aiComparison);
  const dueByTime = Boolean(
    point.nextPhotoDueAt &&
      Date.parse(point.nextPhotoDueAt) <= now.getTime(),
  );
  const dueByNewSatellite = Boolean(
    point.latestSatelliteDate &&
      point.lastPhotoSatelliteDate &&
      point.latestSatelliteDate > point.lastPhotoSatelliteDate,
  );
  const dismissed = Boolean(
    point.dismissedUntil &&
      Date.parse(point.dismissedUntil) > now.getTime(),
  );

  return {
    pointId: point.id,
    direction: point.direction,
    areaGeometry: point.areaGeometry,
    latestSatelliteDate: point.latestSatelliteDate,
    nextPhotoDueAt: point.nextPhotoDueAt,
    comparisonStatus: comparison?.status ?? null,
    comparisonSummary: comparison?.summary ?? null,
    comparedAt: comparison?.comparedAt ?? null,
    trackedIssueLabel: text(trackedIssue.possibleIssue) || null,
    trackedIssueStatus: normalizeTrackedIssueStatus(aiComparison.trackedIssueStatus),
    trackedIssueSummary: text(aiComparison.trackedIssueSummary) || null,
    dueForPhoto: !dismissed && (dueByTime || dueByNewSatellite),
  };
}

export async function mirrorLatestDecisionEvidenceForPdf(fieldIdInput: string) {
  const fieldId = text(fieldIdInput);
  if (!fieldId) return false;

  const userId = await requirePdfUser();
  const field = await loadFieldRecord(fieldId, userId);
  const archived: string[] = [];

  const soilBundle = await loadFieldSoilIntelligenceForPdf(fieldId).catch((error) => {
    console.warn('[PUSULAPDF] Soil Intelligence hazırlanamadı:', error);
    return null;
  });

  if (soilBundle) {
    const soil = soilBundle.intelligence;
    const profile = soilBundle.soilGridsProfile;
    const observedAt =
      dateOnly(soilBundle.latestAnalysis?.created_at) ??
      dateOnly(profile?.generatedAt) ??
      new Date().toISOString().slice(0, 10);
    const layer = 'soil-intelligence';
    const payload = {
      schemaVersion: 1,
      layer,
      source: 'TarlaPusula Soil Intelligence',
      observedAt,
      processingVersion: 'soil-intelligence-pdf-v1',
      metrics: {
        status: soil.status,
        laboratoryAuthority: soil.laboratoryAuthority,
        soilGridsContextAvailable: soil.soilGridsContextAvailable,
        estimatedHydraulicLimits: false,
        phTopsoil0To30: profile?.properties.ph.topsoil0To30 ?? null,
        organicCarbonTopsoil0To30: profile?.properties.organicCarbon.topsoil0To30 ?? null,
        clayPercent: profile?.texture.clayPercent ?? null,
        sandPercent: profile?.texture.sandPercent ?? null,
        siltPercent: profile?.texture.siltPercent ?? null,
      },
      details: {
        sourceModel: soil.sourceModel,
        labAnalysisId: soil.labAnalysisId,
        soilGridsGeneratedAt: soil.soilGridsGeneratedAt,
        evidence: soil.evidence,
        warnings: soil.warnings,
        note: 'Laboratuvar varsa ölçüm otoritesidir. SoilGrids yalnız 250 m model tahmini arka planıdır; tarla kapasitesi veya solma noktası uydurulmaz.',
      },
    };
    const sourceKey = [layer, observedAt, soil.status, soil.labAnalysisId ?? 'no-lab'].join(':');
    await archiveLayer(userId, fieldId, payload, sourceKey);
    archived.push(layer);
  }

  const [latestObservation, riskResult, phenologySnapshot] = await Promise.all([
    loadObservationDecisionSignal(fieldId).catch(() => null),
    fetchFieldRiskRadar(fieldId).catch((error) => {
      console.warn('[PUSULAPDF] Risk Radar hazırlanamadı:', error);
      return null;
    }),
    getFieldPhenologySnapshot(field, { forceRefresh: false }).catch(() => null),
  ]);

  const observation = observationSignalFromLatest(latestObservation);

  if (observation) {
    const layer = 'satellite-field-observation-follow-up';
    const observedAt =
      dateOnly(observation.comparedAt) ??
      dateOnly(observation.latestSatelliteDate) ??
      new Date().toISOString().slice(0, 10);
    const payload = {
      schemaVersion: 1,
      layer,
      source: 'TarlaPusula field observation follow-up',
      observedAt,
      processingVersion: 'field-observation-follow-up-pdf-v1',
      metrics: {
        comparisonStatus: observation.comparisonStatus,
        trackedIssueStatus: observation.trackedIssueStatus ?? null,
        dueForPhoto: observation.dueForPhoto,
      },
      details: {
        pointId: observation.pointId,
        direction: observation.direction,
        latestSatelliteDate: observation.latestSatelliteDate,
        nextPhotoDueAt: observation.nextPhotoDueAt,
        comparedAt: observation.comparedAt,
        comparisonSummary: observation.comparisonSummary,
        trackedIssueLabel: observation.trackedIssueLabel ?? null,
        trackedIssueSummary: observation.trackedIssueSummary ?? null,
        photoAuthority: 'Pusula AI ön değerlendirmesi; kesin teşhis değildir.',
      },
    };
    const sourceKey = [layer, observation.pointId, observation.comparedAt ?? observedAt].join(':');
    await archiveLayer(userId, fieldId, payload, sourceKey);
    archived.push(layer);
  }

  if (riskResult) {
    const compactRadar = compactRiskRadarForPusula(riskResult);
    const plantHealth = buildPlantHealthSynthesisDecision({
      fieldId,
      radar: compactRadar,
      observation,
      phenology: phenologySnapshot?.phenology ?? null,
      now: new Date(),
    });

    if (plantHealth) {
      const layer = 'plant-health-synthesis';
      const observedAt =
        dateOnly(riskResult.generatedAt) ??
        new Date().toISOString().slice(0, 10);
      const topThreat = riskResult.threats?.[0] ?? null;
      const photoMatched = text(plantHealth.sourceModel).includes('field-photo');
      const payload = {
        schemaVersion: 1,
        layer,
        source: 'TarlaPusula plant health synthesis',
        observedAt,
        processingVersion: 'plant-health-synthesis-pdf-v1',
        metrics: {
          riskScore: riskResult.overall?.score ?? topThreat?.score ?? null,
          riskLevel: riskResult.overall?.level ?? topThreat?.level ?? null,
          peakRiskScore7d: topThreat?.peakScore7d ?? null,
          photoEvidenceMatched: photoMatched,
          scoreRecomputedFromPhoto: false,
        },
        details: {
          title: plantHealth.title,
          detail: plantHealth.detail,
          evidence: plantHealth.evidence ?? [],
          sourceModel: plantHealth.sourceModel ?? 'risk-radar',
          confidence: plantHealth.confidence ?? 'preliminary',
          radarGeneratedAt: riskResult.generatedAt,
          weatherSource: riskResult.weather?.source ?? null,
          riskModelProvenance: riskResult.provenance ?? null,
          threatName: topThreat?.displayName ?? null,
          photoTrackedIssue: photoMatched ? observation?.trackedIssueLabel ?? null : null,
          photoComparedAt: photoMatched ? observation?.comparedAt ?? null : null,
          photoAuthority: photoMatched
            ? 'AI görsel ön değerlendirmesi; Risk Radar skorunu değiştirmez ve kesin teşhis değildir.'
            : 'Fotoğraf kanıtı bu risk etiketiyle eşleşmedi veya mevcut değildi.',
        },
      };
      const sourceKey = [layer, plantHealth.id].join(':');
      await archiveLayer(userId, fieldId, payload, sourceKey);
      archived.push(layer);
    }
  }

  return archived.length > 0;
}
