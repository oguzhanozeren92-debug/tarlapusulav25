import { supabase } from '../supabaseClient';

export type SatelliteHealthResult = {
  success: boolean;
  source?: string;
  status?: 'good' | 'check' | 'alert' | 'unknown';
  statusLabel?: string;
  summary?: string;
  recommendations?: string[];
  latestImageDate?: string | null;
  ndviAverage?: number | null;
  ndviMin?: number | null;
  ndviMax?: number | null;
  ndmiAverage?: number | null;
  ndreAverage?: number | null;
  saviAverage?: number | null;
  gndviAverage?: number | null;
  ndviImage?: string | null;
  trueColorImage?: string | null;
  bbox?: [number, number, number, number] | number[];
  healthyPercent?: number | null;
  warningPercent?: number | null;
  stressedPercent?: number | null;
  generatedAt?: string;
  message?: string;
};

const SATELLITE_TIMEOUT_MS = 30000;

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          'Uydu sağlık analizi zaman aşımına uğradı. Lütfen yeniden deneyin.',
        ),
      );
    }, ms);
  });
}

export async function analyzeFieldSatellite(
  geometry: any,
): Promise<SatelliteHealthResult> {
  if (!supabase) {
    throw new Error('Uydu servisine bağlanılamadı.');
  }

  if (!geometry?.geometry) {
    throw new Error('Bu tarla için gerçek parsel geometrisi bulunamadı.');
  }

  const invokePromise = supabase.functions.invoke('satellite-field-analysis', {
    body: {
      geometry,
      daysBack: 45,
      maxCloudCoverage: 30,
    },
  });

  const result = await Promise.race([
    invokePromise,
    timeoutPromise(SATELLITE_TIMEOUT_MS),
  ]);

  const { data, error } = result as Awaited<typeof invokePromise>;

  if (error) throw error;

  if (!data?.success) {
    throw new Error(data?.message ?? 'Uydu analizi tamamlanamadı.');
  }

  return data as SatelliteHealthResult;
}
