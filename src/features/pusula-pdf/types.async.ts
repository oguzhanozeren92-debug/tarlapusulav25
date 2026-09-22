export type PusulaPdfJobStage =
  | 'queued'
  | 'collecting'
  | 'satellite'
  | 'weather'
  | 'field_memory'
  | 'interpreting'
  | 'rendering'
  | 'ready'
  | 'failed';

export type PusulaPdfJob = {
  id: string;
  user_id: string;
  field_id: string;
  report_id: string | null;
  stage: PusulaPdfJobStage;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  progress_meta: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export const PUSULAPDF_STAGE_LABEL: Record<PusulaPdfJobStage, string> = {
  queued: 'Sıraya alındı',
  collecting: 'Veriler toplanıyor',
  satellite: 'Uydu görüntüleri hazırlanıyor',
  weather: 'Hava ve yağış kontrol ediliyor',
  field_memory: 'Tarla geçmişi birleştiriliyor',
  interpreting: 'Pusula değerlendiriyor',
  rendering: 'PDF hazırlanıyor',
  ready: 'PUSULAPDF hazır',
  failed: 'Hazırlama tamamlanamadı',
};
