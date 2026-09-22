import { supabase } from '../../../supabaseClient';
import { addPoints } from '../../../gamification/useGamificationStore';
import { harmonizePhotoDiseaseAssessment } from '../../vision/services/photoDiseaseHarmonizer';
import {
  deletePrivateFile,
  getPrivateFileUrl,
  getPrivateFileUrls,
  uploadPrivateFile,
} from '../../../services/r2Storage';

import type {
  EnsureNdviObservationPointInput,
  FieldObservationComparison,
  FieldObservationComparisonStatus,
  FieldObservationPhoto,
  FieldObservationPoint,
  FieldObservationPointOverview,
  FieldObservationPointStatus,
  ObservationUploadResult,
  UploadObservationPhotosInput,
} from '../types/fieldObservation';

const PHOTO_BUCKET = 'field-observation-photos';
const DEFAULT_FOLLOW_UP_DAYS = 12;

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoDateOrNull(value: unknown) {
  const text = textOrNull(value);
  if (!text) return null;

  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function normalizeDirection(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-');
}

function emitFieldTasksChanged(fieldId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:tasks-changed', { detail: { fieldId } }),
  );
}

function emitFieldObservationChanged(fieldId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:field-observation-changed', { detail: { fieldId } }),
  );
}

async function completeObservationPhotoTasksBestEffort(
  userId: string,
  point: FieldObservationPoint,
  satelliteDate: string | null,
) {
  const areaKey = normalizeDirection(point.direction || 'Tarla geneli');
  if (!areaKey) return;

  try {
    const { data: rows, error: readError } = await supabase
      .from('field_todos')
      .select('id,task_key,metadata')
      .eq('user_id', userId)
      .eq('field_id', point.fieldId)
      .eq('action_target', 'field-photo')
      .eq('completed', false);

    if (readError) throw readError;

    const uploadSatelliteDate = isoDateOrNull(satelliteDate);
    const ids = (rows ?? [])
      .filter((row: any) => {
        const metadata = recordValue(row.metadata);
        const source = String(metadata.source ?? '').trim();
        if (source !== 'ndvi_anomaly' && source !== 'ndvi_follow_up') {
          return false;
        }

        const taskSatelliteDate = isoDateOrNull(metadata.satelliteDate);
        if (
          taskSatelliteDate &&
          (!uploadSatelliteDate || taskSatelliteDate !== uploadSatelliteDate)
        ) {
          return false;
        }

        if (source === 'ndvi_follow_up') {
          const taskPointId = String(metadata.pointId ?? '').trim();
          if (taskPointId) return taskPointId === point.id;
        }

        const importantArea = recordValue(metadata.importantArea);
        const taskAreaKey = normalizeDirection(
          importantArea.area ?? metadata.direction ?? 'Tarla geneli',
        );
        return taskAreaKey === areaKey;
      })
      .map((row: any) => String(row.id))
      .filter(Boolean);

    if (!ids.length) return;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('field_todos')
      .update({ completed: true, completed_at: now, updated_at: now })
      .eq('user_id', userId)
      .in('id', ids);

    if (updateError) throw updateError;
    emitFieldTasksChanged(point.fieldId);
  } catch (error) {
    console.warn('NDVI saha fotoğrafı görevi otomatik tamamlanamadı:', error);
  }
}

async function awardObservationPhotoBestEffort(
  point: FieldObservationPoint,
  satelliteDate: string | null,
  capturedAt: string,
) {
  const rewardKey = satelliteDate || capturedAt.slice(0, 10);

  try {
    const result = await addPoints('FIELD_OBSERVATION_PHOTO', {
      dedupeKey: `field-observation-photo:${point.id}:${rewardKey}`,
      metadata: {
        source: 'field_observation_photo',
        fieldId: point.fieldId,
        pointId: point.id,
        satelliteDate,
        capturedAt,
      },
      toastTitle: 'Sorunlu alan fotoğrafı',
    });

    return {
      awarded: result.awarded,
      awardedPoints: result.awardedPoints,
      reason: result.reason,
    };
  } catch (error) {
    console.warn('Saha fotoğrafı Pusula puanı verilemedi:', error);
    return null;
  }
}

function trackingKey(input: EnsureNdviObservationPointInput) {
  const direction = normalizeDirection(input.direction);
  if (direction) return `vegetation:${direction}`;

  const [lng, lat] = input.centroid;
  return `vegetation:${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) {
    throw new Error('Takip noktası için oturum bulunamadı.');
  }
  return data.user;
}

function mapPoint(row: any): FieldObservationPoint {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fieldId: String(row.field_id),
    sourceLayer: String(row.source_layer ?? 'vegetation'),
    trackingKey: String(row.tracking_key),
    direction: textOrNull(row.direction),
    centroidLat: Number(row.centroid_lat),
    centroidLng: Number(row.centroid_lng),
    areaGeometry: row.area_geometry ?? null,
    firstNdvi: finiteOrNull(row.first_ndvi),
    latestNdvi: finiteOrNull(row.latest_ndvi),
    firstRelativeHealth: finiteOrNull(row.first_relative_health),
    latestRelativeHealth: finiteOrNull(row.latest_relative_health),
    firstSatelliteDate: textOrNull(row.first_satellite_date),
    latestSatelliteDate: textOrNull(row.latest_satellite_date),
    status: row.status ?? 'active',
    firstDetectedAt: String(row.first_detected_at),
    lastDetectedAt: String(row.last_detected_at),
    lastPhotoAt: textOrNull(row.last_photo_at),
    lastPhotoSatelliteDate: textOrNull(row.last_photo_satellite_date),
    lastPromptedAt: textOrNull(row.last_prompted_at),
    nextPhotoDueAt: textOrNull(row.next_photo_due_at),
    dismissedUntil: textOrNull(row.dismissed_until),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPhoto(row: any): FieldObservationPhoto {
  return {
    id: String(row.id),
    pointId: String(row.point_id),
    userId: String(row.user_id),
    fieldId: String(row.field_id),
    storagePath: String(row.storage_path),
    capturedAt: String(row.captured_at),
    source: row.source ?? 'upload',
    mimeType: textOrNull(row.mime_type),
    fileSizeBytes: finiteOrNull(row.file_size_bytes),
    ndviValue: finiteOrNull(row.ndvi_value),
    relativeHealth: finiteOrNull(row.relative_health),
    satelliteDate: textOrNull(row.satellite_date),
    notes: textOrNull(row.notes),
    aiResult: row.ai_result ?? null,
    capturedLat: finiteOrNull(row.captured_lat),
    capturedLng: finiteOrNull(row.captured_lng),
    locationAccuracyM: finiteOrNull(row.location_accuracy_m),
    distanceToPointM: finiteOrNull(row.distance_to_point_m),
    createdAt: String(row.created_at),
  };
}

function mapComparison(row: any): FieldObservationComparison {
  return {
    id: String(row.id),
    pointId: String(row.point_id),
    userId: String(row.user_id),
    fieldId: String(row.field_id),
    previousPhotoId: textOrNull(row.previous_photo_id),
    currentPhotoId: textOrNull(row.current_photo_id),
    previousNdvi: finiteOrNull(row.previous_ndvi),
    currentNdvi: finiteOrNull(row.current_ndvi),
    ndviDelta: finiteOrNull(row.ndvi_delta),
    previousRelativeHealth: finiteOrNull(row.previous_relative_health),
    currentRelativeHealth: finiteOrNull(row.current_relative_health),
    relativeHealthDelta: finiteOrNull(row.relative_health_delta),
    status: row.status ?? 'unknown',
    summary: textOrNull(row.summary),
    details: row.details ?? null,
    comparedAt: String(row.compared_at),
    createdAt: String(row.created_at),
  };
}


function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function stringList(value: unknown, limit = 6) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function buildTrackedDiagnosis(
  analysis: Record<string, unknown>,
  activityId?: string | null,
) {
  const now = new Date().toISOString();
  return {
    type: 'pusula_ai_diagnosis',
    headline: textOrNull(analysis.headline),
    possibleIssue: textOrNull(analysis.possibleIssue),
    issueType: textOrNull(analysis.issueType),
    severity: textOrNull(analysis.severity),
    confidence: finiteOrNull(analysis.confidence),
    status: textOrNull(analysis.status),
    observations: stringList(analysis.observations),
    recommendations: stringList(analysis.recommendations),
    needsMoreEvidence: Boolean(analysis.needsMoreEvidence),
    analyzedAt: textOrNull(analysis.analyzedAt) ?? now,
    source: textOrNull(analysis.source) ?? 'pusula_ai',
    knowledgeContext: harmonizePhotoDiseaseAssessment(analysis),
    activityId: textOrNull(activityId),
    linkedAt: now,
  };
}

export async function linkAiDiagnosisToObservationPoint(input: {
  pointId: string;
  fieldId: string;
  analysis: Record<string, unknown>;
  activityId?: string | null;
}) {
  const user = await requireUser();
  const pointId = String(input.pointId ?? '').trim();
  const fieldId = String(input.fieldId ?? '').trim();

  if (!pointId || !fieldId) {
    throw new Error('AI takip bağlantısı için takip noktası ve tarla gerekli.');
  }

  const { data: latestPhoto, error: photoError } = await supabase
    .from('field_observation_photos')
    .select('id,ai_result,captured_at')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('point_id', pointId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (photoError) throw photoError;
  if (!latestPhoto?.id) {
    throw new Error('AI ön değerlendirmesine bağlanacak saha fotoğrafı bulunamadı.');
  }

  const diagnosis = buildTrackedDiagnosis(input.analysis, input.activityId);
  const previousAiResult = recordValue(latestPhoto.ai_result);
  const nextAiResult = {
    ...previousAiResult,
    diagnosis,
  };

  const { error: updatePhotoError } = await supabase
    .from('field_observation_photos')
    .update({ ai_result: nextAiResult })
    .eq('id', latestPhoto.id)
    .eq('user_id', user.id)
    .eq('point_id', pointId);

  if (updatePhotoError) throw updatePhotoError;

  const { data: latestComparison, error: comparisonError } = await supabase
    .from('field_observation_comparisons')
    .select('id,details')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('point_id', pointId)
    .order('compared_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (comparisonError) throw comparisonError;

  if (latestComparison?.id) {
    const details = {
      ...recordValue(latestComparison.details),
      trackedIssue: diagnosis,
    };

    const { error: updateComparisonError } = await supabase
      .from('field_observation_comparisons')
      .update({ details })
      .eq('id', latestComparison.id)
      .eq('user_id', user.id);

    if (updateComparisonError) throw updateComparisonError;
  }

  emitFieldObservationChanged(fieldId);

  return {
    pointId,
    photoId: String(latestPhoto.id),
    diagnosis,
  };
}

export async function ensureNdviObservationPoint(
  input: EnsureNdviObservationPointInput,
): Promise<FieldObservationPoint> {
  const user = await requireUser();
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Takip noktası için tarla bulunamadı.');

  const [lng, lat] = input.centroid;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('Takip noktası koordinatı geçersiz.');
  }

  const key = trackingKey(input);
  const satelliteDate = isoDateOrNull(input.satelliteDate);
  const ndviValue = finiteOrNull(input.ndviValue);
  const relativeHealth = finiteOrNull(input.relativeHealth);
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await supabase
    .from('field_observation_points')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('source_layer', 'vegetation')
    .eq('tracking_key', key)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) {
    const { data, error } = await supabase
      .from('field_observation_points')
      .update({
        direction: textOrNull(input.direction),
        centroid_lat: lat,
        centroid_lng: lng,
        area_geometry: input.areaGeometry ?? existing.area_geometry ?? null,
        latest_ndvi: ndviValue ?? existing.latest_ndvi ?? null,
        latest_relative_health:
          relativeHealth ?? existing.latest_relative_health ?? null,
        latest_satellite_date:
          satelliteDate ?? existing.latest_satellite_date ?? null,
        last_detected_at: now,
        status: existing.status ?? 'active',
      })
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return mapPoint(data);
  }

  const { data, error } = await supabase
    .from('field_observation_points')
    .insert({
      user_id: user.id,
      field_id: fieldId,
      source_layer: 'vegetation',
      tracking_key: key,
      direction: textOrNull(input.direction),
      centroid_lat: lat,
      centroid_lng: lng,
      area_geometry: input.areaGeometry ?? null,
      first_ndvi: ndviValue,
      latest_ndvi: ndviValue,
      first_relative_health: relativeHealth,
      latest_relative_health: relativeHealth,
      first_satellite_date: satelliteDate,
      latest_satellite_date: satelliteDate,
      status: 'active',
      first_detected_at: now,
      last_detected_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapPoint(data);
}

function extensionFor(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) {
    return fromName;
  }

  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic') return 'heic';
  if (file.type === 'image/heif') return 'heif';
  return 'jpg';
}

function safeFileStem(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
}

function comparisonStatus(
  previous: number | null,
  current: number | null,
): FieldObservationComparisonStatus {
  if (previous === null || current === null) return 'unknown';
  const delta = current - previous;
  if (delta >= 0.08) return 'improving';
  if (delta <= -0.08) return 'worsening';
  return 'stable';
}

function comparisonSummary(
  status: FieldObservationComparisonStatus,
) {
  if (status === 'improving') {
    return 'Uydu sağlık sinyali önceki kayda göre toparlanıyor.';
  }
  if (status === 'worsening') {
    return 'Uydu sağlık sinyali önceki kayda göre zayıflıyor.';
  }
  if (status === 'stable') {
    return 'Uydu sağlık sinyalinde belirgin bir değişim görünmüyor.';
  }
  return 'Karşılaştırma için yeterli ortak uydu sağlık skoru yok.';
}

async function createComparison(
  userId: string,
  point: FieldObservationPoint,
  previous: FieldObservationPhoto | null,
  current: FieldObservationPhoto,
) {
  if (!previous) return null;

  const previousHealth = previous.relativeHealth;
  const currentHealth = current.relativeHealth;
  const healthDelta =
    previousHealth !== null && currentHealth !== null
      ? Number((currentHealth - previousHealth).toFixed(3))
      : null;

  const previousNdvi = previous.ndviValue;
  const currentNdvi = current.ndviValue;
  const ndviDelta =
    previousNdvi !== null && currentNdvi !== null
      ? Number((currentNdvi - previousNdvi).toFixed(3))
      : null;

  const status = comparisonStatus(previousHealth, currentHealth);

  const { data, error } = await supabase
    .from('field_observation_comparisons')
    .insert({
      point_id: point.id,
      user_id: userId,
      field_id: point.fieldId,
      previous_photo_id: previous.id,
      current_photo_id: current.id,
      previous_ndvi: previousNdvi,
      current_ndvi: currentNdvi,
      ndvi_delta: ndviDelta,
      previous_relative_health: previousHealth,
      current_relative_health: currentHealth,
      relative_health_delta: healthDelta,
      status,
      summary: comparisonSummary(status),
      details: {
        comparisonBasis: 'relative_satellite_health',
        previousSatelliteDate: previous.satelliteDate,
        currentSatelliteDate: current.satelliteDate,
      },
    })
    .select('*')
    .single();

  if (error) {
    // Fotoğraf kaydı başarılıysa karşılaştırma hatası upload'ı bozmamalı.
    console.warn('Takip noktası karşılaştırması kaydedilemedi:', error);
    return null;
  }

  return mapComparison(data);
}

async function compareObservationPhotosWithAi(
  previous: FieldObservationPhoto,
  current: FieldObservationPhoto,
  fallbackComparison: FieldObservationComparison | null,
) {
  try {
    const { data, error } = await supabase.functions.invoke(
      'compare-field-observation-images',
      {
        body: {
          previousPhotoId: previous.id,
          currentPhotoId: current.id,
        },
      },
    );

    if (error) {
      console.warn(
        'Takip fotoğrafları AI karşılaştırmasına gönderilemedi:',
        error,
      );
      return fallbackComparison;
    }

    if (data?.error || !data?.comparison) {
      console.warn(
        'Takip fotoğrafları AI karşılaştırması tamamlanamadı:',
        data?.userMessage ?? data?.error ?? 'Bilinmeyen hata',
      );
      return fallbackComparison;
    }

    return mapComparison(data.comparison);
  } catch (error) {
    /*
     * Fotoğraflar ve sayısal uydu karşılaştırması zaten kaydedildi.
     * Görsel AI geçici olarak çalışmazsa kullanıcı verisini kaybetme.
     */
    console.warn('Takip fotoğrafları AI karşılaştırması başarısız:', error);
    return fallbackComparison;
  }
}

export async function getObservationPhotoLocationReference(
  pointIdInput: string,
): Promise<ObservationPhotoLocationReference | null> {
  const user = await requireUser();
  const pointId = String(pointIdInput ?? '').trim();

  if (!pointId) return null;

  const { data, error } = await supabase
    .from('field_observation_photos')
    .select('captured_lat,captured_lng,captured_at')
    .eq('user_id', user.id)
    .eq('point_id', pointId)
    .not('captured_lat', 'is', null)
    .not('captured_lng', 'is', null)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const lat = finiteOrNull(data.captured_lat);
  const lng = finiteOrNull(data.captured_lng);

  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    capturedAt: textOrNull(data.captured_at),
  };
}

export async function uploadObservationPhotos(
  input: UploadObservationPhotosInput,
): Promise<ObservationUploadResult> {
  const user = await requireUser();
  const point = input.point;
  const files = input.files.filter(Boolean).slice(0, 3);

  if (!files.length) {
    throw new Error('Yüklenecek fotoğraf seçilmedi.');
  }

  const { data: previousRow, error: previousError } = await supabase
    .from('field_observation_photos')
    .select('*')
    .eq('user_id', user.id)
    .eq('point_id', point.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) throw previousError;
  const previous = previousRow ? mapPhoto(previousRow) : null;

  const uploaded: FieldObservationPhoto[] = [];
  const satelliteDate = isoDateOrNull(input.satelliteDate);
  const capturedAt = textOrNull(input.capturedAt) ?? new Date().toISOString();

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name} 10 MB sınırını aşıyor.`);
    }

    const stamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const path = [
      user.id,
      point.fieldId,
      point.id,
      `${stamp}-${random}-${safeFileStem(file.name)}.${extensionFor(file)}`,
    ].join('/');

    const storedPath = await uploadPrivateFile(
      'field-observation-photos',
      path,
      file,
      file.type || 'application/octet-stream',
    );

    const { data, error } = await supabase
      .from('field_observation_photos')
      .insert({
        point_id: point.id,
        user_id: user.id,
        field_id: point.fieldId,
        storage_path: storedPath,
        captured_at: capturedAt,
        source: input.source,
        mime_type: textOrNull(file.type),
        file_size_bytes: file.size,
        ndvi_value: finiteOrNull(input.ndviValue),
        relative_health: finiteOrNull(input.relativeHealth),
        satellite_date: satelliteDate,
        notes: textOrNull(input.notes),
        captured_lat: finiteOrNull(input.capturedLat),
        captured_lng: finiteOrNull(input.capturedLng),
        location_accuracy_m: finiteOrNull(input.locationAccuracyM),
        distance_to_point_m: finiteOrNull(input.distanceToPointM),
      })
      .select('*')
      .single();

    if (error) {
      await deletePrivateFile(
        'field-observation-photos',
        storedPath,
        PHOTO_BUCKET,
      ).catch(() => undefined);
      throw error;
    }

    uploaded.push(mapPhoto(data));
  }

  const latestPhoto = uploaded[uploaded.length - 1] ?? null;
  const nextDue = addDaysIso(DEFAULT_FOLLOW_UP_DAYS);

  const { data: updatedPointRow, error: pointError } = await supabase
    .from('field_observation_points')
    .update({
      last_photo_at: latestPhoto?.capturedAt ?? capturedAt,
      last_photo_satellite_date: satelliteDate,
      last_prompted_at: new Date().toISOString(),
      next_photo_due_at: nextDue,
      dismissed_until: null,
      latest_relative_health:
        finiteOrNull(input.relativeHealth) ?? point.latestRelativeHealth,
      latest_ndvi: finiteOrNull(input.ndviValue) ?? point.latestNdvi,
      latest_satellite_date: satelliteDate ?? point.latestSatelliteDate,
      status: 'active',
    })
    .eq('id', point.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (pointError) throw pointError;

  const updatedPoint = mapPoint(updatedPointRow);
  let comparison = latestPhoto
    ? await createComparison(user.id, updatedPoint, previous, latestPhoto)
    : null;

  if (previous && latestPhoto) {
    comparison = await compareObservationPhotosWithAi(
      previous,
      latestPhoto,
      comparison,
    );
  }

  const [reward] = await Promise.all([
    awardObservationPhotoBestEffort(updatedPoint, satelliteDate, capturedAt),
    completeObservationPhotoTasksBestEffort(user.id, updatedPoint, satelliteDate),
  ]);

  emitFieldObservationChanged(updatedPoint.fieldId);

  return {
    photos: uploaded,
    latestPhoto,
    comparison,
    updatedPoint,
    reward,
  };
}

export async function dismissObservationPhotoPrompt(
  pointId: string,
  days = 7,
) {
  const user = await requireUser();
  const dismissedUntil = addDaysIso(days);

  const { error } = await supabase
    .from('field_observation_points')
    .update({
      last_prompted_at: new Date().toISOString(),
      dismissed_until: dismissedUntil,
    })
    .eq('id', pointId)
    .eq('user_id', user.id);

  if (error) throw error;
  return dismissedUntil;
}

export async function loadObservationTimeline(
  pointId: string,
) {
  const user = await requireUser();

  const [{ data: photos, error: photoError }, { data: comparisons, error: comparisonError }] =
    await Promise.all([
      supabase
        .from('field_observation_photos')
        .select('*')
        .eq('user_id', user.id)
        .eq('point_id', pointId)
        .order('captured_at', { ascending: false }),
      supabase
        .from('field_observation_comparisons')
        .select('*')
        .eq('user_id', user.id)
        .eq('point_id', pointId)
        .order('compared_at', { ascending: false }),
    ]);

  if (photoError) throw photoError;
  if (comparisonError) throw comparisonError;

  const mappedPhotos = (photos ?? []).map(mapPhoto);

  for (const photo of mappedPhotos) {
    photo.signedUrl = await getPrivateFileUrl(
      'field-observation-photos',
      photo.storagePath,
      PHOTO_BUCKET,
    );
  }

  return {
    photos: mappedPhotos,
    comparisons: (comparisons ?? []).map(mapComparison),
  };
}



export async function updateObservationPointStatus(
  pointIdInput: string,
  status: FieldObservationPointStatus,
): Promise<FieldObservationPoint> {
  const user = await requireUser();
  const pointId = String(pointIdInput ?? '').trim();

  if (!pointId) {
    throw new Error('Takip noktası bulunamadı.');
  }

  const allowed = new Set<FieldObservationPointStatus>([
    'active',
    'paused',
    'resolved',
  ]);

  if (!allowed.has(status)) {
    throw new Error('Takip durumu geçersiz.');
  }

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'active') {
    // Kullanıcı takibi bilinçli olarak yeniden başlatıyorsa eski erteleme
    // süresi yeni hatırlatmayı engellemesin.
    updates.dismissed_until = null;
  }

  const { data, error } = await supabase
    .from('field_observation_points')
    .update(updates)
    .eq('id', pointId)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) throw error;
  return mapPoint(data);
}

export async function listFieldObservationPoints(
  fieldIdInput: string,
): Promise<FieldObservationPointOverview[]> {
  const user = await requireUser();
  const fieldId = String(fieldIdInput ?? '').trim();

  if (!fieldId) return [];

  const { data: pointRows, error: pointError } = await supabase
    .from('field_observation_points')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('source_layer', 'vegetation')
    .order('last_detected_at', { ascending: false });

  if (pointError) throw pointError;
  if (!pointRows?.length) return [];

  const points = pointRows.map(mapPoint);
  const pointIds = points.map((point) => point.id);

  const [photosResult, comparisonsResult] = await Promise.all([
    supabase
      .from('field_observation_photos')
      .select('*')
      .eq('user_id', user.id)
      .eq('field_id', fieldId)
      .in('point_id', pointIds)
      .order('captured_at', { ascending: false }),
    supabase
      .from('field_observation_comparisons')
      .select('*')
      .eq('user_id', user.id)
      .eq('field_id', fieldId)
      .in('point_id', pointIds)
      .order('compared_at', { ascending: false }),
  ]);

  if (photosResult.error) throw photosResult.error;
  if (comparisonsResult.error) throw comparisonsResult.error;

  const latestPhotoByPoint = new Map<string, FieldObservationPhoto>();
  const photoCountByPoint = new Map<string, number>();

  for (const row of photosResult.data ?? []) {
    const photo = mapPhoto(row);
    photoCountByPoint.set(
      photo.pointId,
      (photoCountByPoint.get(photo.pointId) ?? 0) + 1,
    );

    if (!latestPhotoByPoint.has(photo.pointId)) {
      latestPhotoByPoint.set(photo.pointId, photo);
    }
  }

  const latestComparisonByPoint = new Map<
    string,
    FieldObservationComparison
  >();

  for (const row of comparisonsResult.data ?? []) {
    const comparison = mapComparison(row);
    if (!latestComparisonByPoint.has(comparison.pointId)) {
      latestComparisonByPoint.set(comparison.pointId, comparison);
    }
  }

  const latestPhotos = Array.from(latestPhotoByPoint.values());
  const paths = latestPhotos.map((photo) => photo.storagePath);
  const signedUrlByPath = new Map<string, string>();

  if (paths.length > 0) {
    try {
      const resolved = await getPrivateFileUrls(
        'field-observation-photos',
        paths,
        PHOTO_BUCKET,
      );
      for (const [path, url] of resolved.entries()) {
        signedUrlByPath.set(path, url);
      }
    } catch (error) {
      console.warn('Takip noktası küçük fotoğrafları hazırlanamadı:', error);
    }
  }

  return points.map((point) => {
    const photo = latestPhotoByPoint.get(point.id) ?? null;

    return {
      point,
      latestPhoto: photo
        ? {
            ...photo,
            signedUrl: signedUrlByPath.get(photo.storagePath) ?? null,
          }
        : null,
      latestComparison: latestComparisonByPoint.get(point.id) ?? null,
      photoCount: photoCountByPoint.get(point.id) ?? 0,
    };
  });
}

export async function loadObservationDecisionSignal(
  fieldIdInput: string,
  pointIdInput?: string | null,
) {
  const user = await requireUser();
  const fieldId = String(fieldIdInput ?? '').trim();
  const pointId = String(pointIdInput ?? '').trim();
  if (!fieldId) return null;

  let pointQuery = supabase
    .from('field_observation_points')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('source_layer', 'vegetation')
    .eq('status', 'active')
    .not('last_photo_at', 'is', null);

  if (pointId) {
    pointQuery = pointQuery.eq('id', pointId);
  }

  const { data: pointRows, error: pointError } = await pointQuery
    .order('last_photo_at', { ascending: false })
    .limit(1);

  if (pointError) throw pointError;
  const pointRow = pointRows?.[0];
  if (!pointRow) return null;

  const point = mapPoint(pointRow);
  const { data: comparisonRow, error: comparisonError } = await supabase
    .from('field_observation_comparisons')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('point_id', point.id)
    .order('compared_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (comparisonError) throw comparisonError;

  return {
    point,
    comparison: comparisonRow ? mapComparison(comparisonRow) : null,
  };
}

export async function findDueObservationFollowUps(
  fieldId: string,
  currentSatelliteDate?: string | null,
) {
  const user = await requireUser();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('field_observation_points')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('source_layer', 'vegetation')
    .eq('status', 'active')
    .not('last_photo_at', 'is', null)
    .order('next_photo_due_at', { ascending: true });

  if (error) throw error;

  const currentDate = isoDateOrNull(currentSatelliteDate);

  return (data ?? [])
    .map(mapPoint)
    .filter((point) => {
      if (
        point.dismissedUntil &&
        new Date(point.dismissedUntil).getTime() > Date.now()
      ) {
        return false;
      }

      const dueAt = point.nextPhotoDueAt
        ? new Date(point.nextPhotoDueAt).getTime()
        : Number.NaN;
      const dueByTime = Number.isFinite(dueAt) && dueAt <= Date.now();
      const dueByNewSatellite = Boolean(
        currentDate &&
          point.lastPhotoSatelliteDate &&
          currentDate > point.lastPhotoSatelliteDate,
      );

      // Ya planlı takip günü geldiyse ya da son fotoğraftan daha yeni uydu
      // gözlemi oluştuysa aynı noktadan yeni saha kanıtı iste.
      return dueByTime || dueByNewSatellite;
    });
}

export async function touchExistingNdviObservationSignal(input: {
  fieldId: string;
  direction: string;
  relativeHealth?: number | null;
  satelliteDate?: string | null;
}) {
  const user = await requireUser();
  const key = `vegetation:${normalizeDirection(input.direction)}`;

  const updates: Record<string, any> = {
    last_detected_at: new Date().toISOString(),
  };

  const health = finiteOrNull(input.relativeHealth);
  if (health !== null) updates.latest_relative_health = health;

  const date = isoDateOrNull(input.satelliteDate);
  if (date) updates.latest_satellite_date = date;

  const { data, error } = await supabase
    .from('field_observation_points')
    .update(updates)
    .eq('user_id', user.id)
    .eq('field_id', input.fieldId)
    .eq('source_layer', 'vegetation')
    .eq('tracking_key', key)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data ? mapPoint(data) : null;
}
