import { supabase } from '../../../supabaseClient';

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Tarla bilgisini kaydetmek için oturum gerekli.');
  return data.user;
}

function emitUpdated(fieldId: string, changedFields: string[], extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:field-context-updated', {
    detail: { fieldId, changedFields, source: 'today-missing-info', ...extra },
  }));
}

export async function saveFieldCrop(input: { fieldId: string; crop: string }) {
  const fieldId = String(input.fieldId ?? '').trim();
  const crop = String(input.crop ?? '').replace(/\s+/g, ' ').trim();
  if (!fieldId) throw new Error('Tarla seçilemedi.');
  if (crop.length < 2) throw new Error('Ürün adını yaz.');
  if (crop.length > 80) throw new Error('Ürün adı çok uzun.');

  const user = await requireUser();
  const { data, error } = await supabase
    .from('fields')
    .update({ crop, updated_at: new Date().toISOString() })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id,crop')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Ürün bilgisi kaydedilemedi.');
  emitUpdated(fieldId, ['crop'], { crop: String(data.crop ?? crop) });
  return { fieldId: String(data.id), crop: String(data.crop ?? crop) };
}

export async function saveFieldPlantingYear(input: { fieldId: string; plantingYear: number }) {
  const fieldId = String(input.fieldId ?? '').trim();
  const plantingYear = Math.round(Number(input.plantingYear));
  const maxYear = new Date().getFullYear() + 1;
  if (!fieldId) throw new Error('Tarla seçilemedi.');
  if (!Number.isFinite(plantingYear) || plantingYear < 1950 || plantingYear > maxYear) {
    throw new Error(`Ekim / dikim yılı 1950 ile ${maxYear} arasında olmalı.`);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from('fields')
    .update({ planting_year: plantingYear, updated_at: new Date().toISOString() })
    .eq('id', fieldId)
    .eq('user_id', user.id)
    .select('id,planting_year')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Ekim / dikim yılı kaydedilemedi.');
  const savedYear = Number(data.planting_year ?? plantingYear);
  emitUpdated(fieldId, ['planting_year'], { plantingYear: savedYear });
  return { fieldId: String(data.id), plantingYear: savedYear };
}
