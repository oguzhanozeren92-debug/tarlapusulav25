import { supabase } from '../../../supabaseClient';
import type { PusulaPdfJob } from '../types.async';
import { syncFieldLocalLayerArchiveToCloud } from '../../map-data/services/mapLayerCloudArchive';
import { mirrorLatestIrrigationModelEvidenceForPdf } from './pusulaPdfModelEvidence.service';
import { mirrorLatestAquaCropEvidenceForPdf } from './pusulaPdfAquaCropEvidence.service';
import { mirrorLatestPcseEvidenceForPdf } from './pusulaPdfPcseEvidence.service';
import { mirrorLatestIrrigationSynthesisForPdf } from './pusulaPdfIrrigationSynthesis.service';
import { mirrorLatestDecisionEvidenceForPdf } from './pusulaPdfDecisionEvidence.service';
import { runAquaCropPilotEvidence } from '../../irrigation/services/aquaCropPilotEvidence.service';
import { runDualKcShadowEvidence } from '../../irrigation/services/dualKcShadow.service';

export async function requestPusulaPdf(fieldId: string) {
  // PDF worker sunucuda çalıştığı için cihazdaki gerçek geçmiş kayıtları ve
  // bağımsız model kanıtlarını önce ortak bulut arşivine aynala. Bu adımlar
  // best-effort'tür; başarısız olmaları rapor işini engellemez.
  try {
    // Rapor talebi yalnız daha önce açılmış ekran cache'ine dayanmaz.
    // pyfao56 ve AquaCrop aynı anda güncel sunucu girdileriyle çalıştırılır;
    // ardından tek sulama sentezi ve ayrı kanıt katmanları arşivlenir.
    await Promise.allSettled([
      runDualKcShadowEvidence(fieldId),
      runAquaCropPilotEvidence(fieldId),
    ]);
  } catch (error) {
    console.warn('[PUSULAPDF] sulama modelleri ön hesaplaması tamamlanamadı:', error);
  }

  try {
    await Promise.all([
      syncFieldLocalLayerArchiveToCloud(fieldId),
      mirrorLatestIrrigationModelEvidenceForPdf(fieldId),
      mirrorLatestAquaCropEvidenceForPdf(fieldId),
      mirrorLatestPcseEvidenceForPdf(fieldId),
      mirrorLatestIrrigationSynthesisForPdf(fieldId),
      mirrorLatestDecisionEvidenceForPdf(fieldId),
    ]);
  } catch (error) {
    console.warn('[PUSULAPDF] Rapor öncesi kanıt arşivi tamamlanamadı:', error);
  }

  const { data, error } = await supabase.rpc('request_pusulapdf', {
    p_field_id: fieldId,
  });
  if (error) throw error;

  const result = data as { job_id: string; report_id: string | null; reused: boolean };

  // Job oluştu; şimdi worker'ı tetikle. Hata gizlenmez ki kart "sırada" diye sonsuza kadar kalmasın.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('PUSULAPDF için oturum bulunamadı.');

  const { error: workerError } = await supabase.functions.invoke('pusulapdf-worker', {
    body: { jobId: result.job_id },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (workerError) {
    throw new Error(`PUSULAPDF worker tetiklenemedi: ${workerError.message}`);
  }

  return result;
}

export async function getPusulaPdfJob(jobId: string) {
  const { data, error } = await supabase
    .from('pusulapdf_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (error) throw error;
  return data as PusulaPdfJob;
}

export function subscribePusulaPdfJob(
  jobId: string,
  onChange: (job: PusulaPdfJob) => void,
) {
  return supabase
    .channel(`pusulapdf-job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pusulapdf_jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => onChange(payload.new as PusulaPdfJob),
    )
    .subscribe();
}
