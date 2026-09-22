import { supabase } from '../../../supabaseClient';

const FIELD_TIME_ZONE = 'Europe/Istanbul';

type DailyKcInput = {
  fieldId: string;
  calculatedAt: string;
  kc: number;
  cropName: string;
  stage: string;
  stageLabel: string | null;
  confidence: 'low' | 'medium' | 'high';
  sourceLabel: string;
};

function fieldDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FIELD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/** Save a real calculation on its Turkey field date; never backfill previous days. */
export async function saveDailyKcSnapshot(input: DailyKcInput): Promise<void> {
  if (!supabase) throw new Error('Supabase bağlantısı yok.');

  const calculatedAt = new Date(input.calculatedAt);
  const kc = Number(input.kc);
  if (
    !Number.isFinite(calculatedAt.getTime()) ||
    !Number.isFinite(kc) || kc < 0 || kc > 3 ||
    !input.fieldId || !input.cropName.trim() ||
    !input.stage.trim() || !input.sourceLabel.trim()
  ) {
    throw new Error('Günlük Kc için doğrulanmış hesap girdileri gerekli.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Kc kaydı için oturum gerekli.');

  const { error } = await supabase
    .from('field_irrigation_kc_snapshots')
    .upsert({
      user_id: authData.user.id,
      field_id: input.fieldId,
      snapshot_date: fieldDate(calculatedAt),
      kc,
      crop_name: input.cropName.trim(),
      phenology_stage: input.stage.trim(),
      stage_label: input.stageLabel?.trim() || null,
      coefficient_confidence: input.confidence,
      source_label: input.sourceLabel.trim(),
      calculated_at: calculatedAt.toISOString(),
    }, { onConflict: 'user_id,field_id,snapshot_date' });

  if (error) throw error;
}
