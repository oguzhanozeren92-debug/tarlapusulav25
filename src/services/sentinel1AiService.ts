import { supabase } from '../supabaseClient';

export type Sentinel1AiConfidence = 'dusuk' | 'orta' | 'yuksek';
export type Sentinel1AiStatus = 'normal' | 'dikkat' | 'kontrol';

export type Sentinel1AiInterpretation = {
  status: Sentinel1AiStatus;
  headline: string;
  summary: string;
  observedAreas: string[];
  action: string;
  confidence: Sentinel1AiConfidence;
  caution: string;
  model?: string;
  memorySaved?: boolean;
  memoryObservationId?: string | null;
  historyUsed?: number;
};

export type Sentinel1AiInput = {
  imageDataUrl: string;
  fieldId?: string;
  fieldName?: string;
  crop?: string;
  modeKey?: string;
  modeLabel: string;
  days: number;
  bbox?: [number, number, number, number];
  timeRange?: {
    from: string;
    to: string;
    days: number;
  };
  sourceGeneratedAt?: string;
};

export async function interpretSentinel1Image(
  input: Sentinel1AiInput,
): Promise<Sentinel1AiInterpretation> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  if (!input.imageDataUrl?.startsWith('data:image/')) {
    throw new Error('AI yorumu için geçerli radar görüntüsü bulunamadı.');
  }

  const { data, error } = await supabase.functions.invoke(
    'sentinel1-ai-interpret',
    {
      body: input,
    },
  );

  if (error) {
    throw new Error(error.message || 'Pusula AI görüntüyü yorumlayamadı.');
  }

  if (!data || data.ok === false) {
    throw new Error(data?.error || 'Pusula AI yanıtı alınamadı.');
  }

  return {
    ...(data.analysis as Sentinel1AiInterpretation),
    memorySaved: Boolean(data.memorySaved),
    memoryObservationId: data.memoryObservationId ?? null,
    historyUsed: Number(data.historyUsed ?? 0),
  };
}
