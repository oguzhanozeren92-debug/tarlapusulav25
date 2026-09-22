import { supabase } from '../../../supabaseClient';

export type PcsePilotAudit = {
  fieldId: string;
  status: 'queued' | 'running' | 'completed' | 'blocked' | 'failed';
  missingInputs: string[];
  engineVersion: string | null;
  completedAt: string | null;
  inputSummary: Record<string, unknown>;
  output: Record<string, any> | null;
  error: string | null;
};

export type PcsePilotEvidence = {
  status: 'ready' | 'waiting' | 'blocked' | 'error';
  sourceModel: 'pcse-wofost72-pp';
  productionAuthority: false;
  waterStressAuthority: false;
  stage: string | null;
  dvs: number | null;
  cropKey: string | null;
  varietyKey: string | null;
  plantingDate: string | null;
  outputDate: string | null;
  missingInputs: string[];
  engineVersion: string | null;
  completedAt: string | null;
  evidence: string[];
  note: string;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}
function text(value: unknown) {
  const result = String(value ?? '').trim();
  return result || null;
}
function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function normalizeStatus(value: unknown): PcsePilotAudit['status'] {
  const status = String(value ?? 'blocked');
  if (['queued', 'running', 'completed', 'failed'].includes(status)) return status as PcsePilotAudit['status'];
  return 'blocked';
}

export async function loadLatestPcsePilotAudit(fieldIdInput: string) {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return null;
  const { data, error } = await supabase
    .from('model_engine_runs')
    .select('field_id,status,missing_inputs,engine_version,completed_at,input_summary,output,error_message,created_at')
    .eq('field_id', fieldId)
    .eq('engine', 'pcse')
    .eq('mode', 'pilot')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    fieldId: String(data.field_id ?? fieldId),
    status: normalizeStatus(data.status),
    missingInputs: stringArray(data.missing_inputs),
    engineVersion: data.engine_version == null ? null : String(data.engine_version),
    completedAt: data.completed_at == null ? null : String(data.completed_at),
    inputSummary: data.input_summary && typeof data.input_summary === 'object' ? data.input_summary : {},
    output: data.output && typeof data.output === 'object' ? data.output : null,
    error: data.error_message == null ? null : String(data.error_message),
  } satisfies PcsePilotAudit;
}

export function toPcsePilotEvidence(audit: PcsePilotAudit | null | undefined): PcsePilotEvidence {
  if (!audit) {
    return { status:'waiting', sourceModel:'pcse-wofost72-pp', productionAuthority:false, waterStressAuthority:false, stage:null, dvs:null, cropKey:null, varietyKey:null, plantingDate:null, outputDate:null, missingInputs:[], engineVersion:null, completedAt:null, evidence:[], note:'PCSE/WOFOST fenoloji pilotu henüz kayıt üretmedi.' };
  }
  const result = audit.output ?? {};
  const simulation = result.simulation ?? {};
  const phenology = result.phenology ?? {};
  const stage = text(phenology.stage);
  const dvs = finite(phenology.dvs);
  const cropKey = text(simulation.crop_key ?? audit.inputSummary.crop_key);
  const varietyKey = text(simulation.variety_key ?? audit.inputSummary.variety_key);
  const plantingDate = text(simulation.planting_date ?? audit.inputSummary.planting_date);
  const outputDate = text(simulation.actual_output_date ?? audit.inputSummary.as_of_date);

  if (audit.status !== 'completed') {
    return {
      status: audit.status === 'failed' ? 'error' : audit.status === 'blocked' ? 'blocked' : 'waiting',
      sourceModel:'pcse-wofost72-pp', productionAuthority:false, waterStressAuthority:false,
      stage,dvs,cropKey,varietyKey,plantingDate,outputDate,missingInputs:[...audit.missingInputs],engineVersion:audit.engineVersion,completedAt:audit.completedAt,evidence:[],
      note: audit.status === 'failed' ? audit.error || 'PCSE/WOFOST pilotu tamamlanamadı.' : audit.missingInputs.length ? `PCSE/WOFOST ${audit.missingInputs.length} gerçek fenoloji girdisi eksik olduğu için sentetik değer üretmeden bekliyor.` : 'PCSE/WOFOST fenoloji pilotu hazırlanıyor.',
    };
  }

  const evidence = [
    stage ? `WOFOST evresi: ${stage}${dvs == null ? '' : ` · DVS ${dvs.toFixed(2)}`}` : '',
    cropKey ? `WOFOST ürün: ${cropKey}` : '',
    varietyKey ? `Doğrulanmış çeşit anahtarı: ${varietyKey}` : '',
    plantingDate ? `Ekim tarihi: ${plantingDate}` : '',
    outputDate ? `Model veri tarihi: ${outputDate}` : '',
    'ERA5-Land günlük hava · yalnız fenoloji simülasyonu',
  ].filter(Boolean);
  return {
    status:'ready', sourceModel:'pcse-wofost72-pp', productionAuthority:false, waterStressAuthority:false,
    stage,dvs,cropKey,varietyKey,plantingDate,outputDate,missingInputs:[],engineVersion:audit.engineVersion,completedAt:audit.completedAt,evidence:evidence.slice(0,6),
    note:'PCSE Wofost72_Phenology gelişim baseline’ıdır; su stresi, verim veya sulama kararı üretmez.',
  };
}

export function emitPcsePilotUpdated(fieldId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:pcse-pilot-updated', { detail: { fieldId } }));
}
