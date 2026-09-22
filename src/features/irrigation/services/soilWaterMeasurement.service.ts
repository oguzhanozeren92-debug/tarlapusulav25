import {
  supabase,
} from '../../../supabaseClient';

import {
  refreshModelReadinessBestEffort,
} from '../../../services/modelReadiness.service';

import {
  syncIrrigationEvidenceTasksBestEffort,
} from '../../tasks/services/fieldTasks.service';

import {
  runDualKcShadowEvidenceBestEffort,
} from './dualKcShadow.service';

import type {
  CreateSoilWaterMeasurementInput,
  SoilWaterMeasurement,
  SoilWaterMeasurementSource,
} from '../types/soilWaterMeasurement';

const SOURCES = new Set<SoilWaterMeasurementSource>([
  'sensor',
  'laboratory',
  'manual_verified',
]);

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRow(row: any): SoilWaterMeasurement {
  return {
    id: String(row.id),
    fieldId: String(row.field_id),
    measuredAt: String(row.measured_at),
    volumetricWaterContent: Number(row.volumetric_water_content),
    depthFromCm: Number(row.depth_from_cm),
    depthToCm: Number(row.depth_to_cm),
    source: row.source,
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
  };
}

function validateInput(input: CreateSoilWaterMeasurementInput) {
  const fieldId = String(input.fieldId ?? '').trim();
  const water = finiteNumber(input.volumetricWaterContent);
  const depthFromCm = finiteNumber(input.depthFromCm);
  const depthToCm = finiteNumber(input.depthToCm);
  const source = String(input.source ?? '').trim() as SoilWaterMeasurementSource;
  const notes = String(input.notes ?? '').trim();
  const measuredAt = input.measuredAt == null || String(input.measuredAt).trim() === ''
    ? null
    : String(input.measuredAt).trim();

  if (!fieldId) throw new Error('Toprak nem ölçümü için tarla kimliği gerekli.');
  if (water === null || water <= 0 || water >= 1) {
    throw new Error('Hacimsel toprak su içeriği 0 ile 1 arasında olmalı.');
  }
  if (depthFromCm === null || depthFromCm < 0) {
    throw new Error('Ölçüm başlangıç derinliği 0 cm veya daha büyük olmalı.');
  }
  if (depthToCm === null || depthToCm <= depthFromCm || depthToCm > 300) {
    throw new Error('Ölçüm bitiş derinliği başlangıçtan büyük ve en fazla 300 cm olmalı.');
  }
  if (!SOURCES.has(source)) {
    throw new Error('Toprak nem ölçümü kaynağı sensor, laboratory veya manual_verified olmalı.');
  }
  if (notes.length > 500) {
    throw new Error('Toprak nem ölçümü notu 500 karakteri geçemez.');
  }
  if (measuredAt !== null && !Number.isFinite(Date.parse(measuredAt))) {
    throw new Error('Toprak nem ölçüm zamanı geçerli bir tarih/saat olmalı.');
  }

  return {
    fieldId,
    water,
    depthFromCm,
    depthToCm,
    source,
    notes: notes || null,
    measuredAt,
  };
}

function refreshWaterModels(fieldId: string) {
  refreshModelReadinessBestEffort(fieldId, 'pyfao56');
  refreshModelReadinessBestEffort(fieldId, 'aquacrop');
  syncIrrigationEvidenceTasksBestEffort(fieldId);
  runDualKcShadowEvidenceBestEffort(fieldId);
}

export async function recordSoilWaterMeasurement(
  input: CreateSoilWaterMeasurementInput,
): Promise<SoilWaterMeasurement> {
  const validated = validateInput(input);

  const {
    data: userResult,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  const user = userResult.user;
  if (!user) throw new Error('Toprak nem ölçümü kaydı için oturum gerekli.');

  const {
    data: field,
    error: fieldError,
  } = await supabase
    .from('fields')
    .select('id')
    .eq('id', validated.fieldId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fieldError) throw fieldError;
  if (!field) throw new Error('Toprak nem ölçümü için tarla bulunamadı veya erişim yok.');

  const payload: Record<string, unknown> = {
    user_id: user.id,
    field_id: validated.fieldId,
    volumetric_water_content: validated.water,
    depth_from_cm: validated.depthFromCm,
    depth_to_cm: validated.depthToCm,
    source: validated.source,
    notes: validated.notes,
  };

  if (validated.measuredAt !== null) {
    payload.measured_at = validated.measuredAt;
  }

  const {
    data,
    error,
  } = await supabase
    .from('field_water_measurements')
    .insert(payload)
    .select('id,field_id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source,notes,created_at')
    .single();

  if (error) throw error;

  refreshWaterModels(validated.fieldId);
  return mapRow(data);
}

export async function listSoilWaterMeasurements(
  fieldId: string,
  limit = 50,
): Promise<SoilWaterMeasurement[]> {
  const normalizedFieldId = String(fieldId ?? '').trim();
  if (!normalizedFieldId) throw new Error('Toprak nem ölçümleri için tarla kimliği gerekli.');

  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const {
    data,
    error,
  } = await supabase
    .from('field_water_measurements')
    .select('id,field_id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source,notes,created_at')
    .eq('field_id', normalizedFieldId)
    .order('measured_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(mapRow);
}

export async function deleteSoilWaterMeasurement(
  measurementId: string,
) {
  const id = String(measurementId ?? '').trim();
  if (!id) throw new Error('Silinecek toprak nem ölçümü kimliği gerekli.');

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from('field_water_measurements')
    .select('field_id')
    .eq('id', id)
    .maybeSingle();

  if (existingError) throw existingError;

  const { error } = await supabase
    .from('field_water_measurements')
    .delete()
    .eq('id', id);

  if (error) throw error;

  if (existing?.field_id) {
    refreshWaterModels(String(existing.field_id));
  }
}
