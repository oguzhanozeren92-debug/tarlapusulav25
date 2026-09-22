import { supabase } from '../supabaseClient';

export type PusulaModuleKey =
  | 'general'
  | 'market'
  | 'weather'
  | 'soil'
  | 'inventory'
  | 'calendar'
  | 'satellite';

export type PusulaDailyModuleInsight = {
  headline: string;
  summary: string;
  reasons: string[];
  confidence: 'yuksek' | 'orta' | 'dusuk';
  dataWarning: string | null;
};

export type PusulaDailyBrief = {
  id: string;
  fieldId: string;
  analysisDate: string;
  status: 'generating' | 'ready' | 'fallback' | 'error';
  triggerReason: string;
  generatedAt: string | null;
  updatedAt: string | null;
  model: string | null;
  provider: string | null;
  aiLatencyMs: number | null;
  sections: Record<PusulaModuleKey, PusulaDailyModuleInsight>;
};

export type PusulaDailyRequest = {
  field: {
    id: string | number;
    name?: string | null;
    crop?: string | null;
    city?: string | null;
    district?: string | null;
  };
  snapshot: {
    market?: unknown;
    weather?: unknown;
    soil?: unknown;
    inventory?: unknown;
    calendar?: unknown;
    satellite?: unknown;
    appDate?: string;
    [key: string]: unknown;
  };
  forceRefresh?: boolean;
  triggerReason?: string;
};

type EdgeResponse = {
  ok?: boolean;
  cached?: boolean;
  pending?: boolean;
  usedFallback?: boolean;
  warning?: string | null;
  error?: string;
  brief?: PusulaDailyBrief | null;
};

const pendingByKey = new Map<string, Promise<EdgeResponse>>();

function requestKey(input: PusulaDailyRequest) {
  const fieldId = String(input.field.id).trim();
  const day = String(
    input.snapshot?.appDate ?? new Date().toISOString().slice(0, 10),
  );
  return `${fieldId}:${day}:${input.forceRefresh ? 'force' : 'normal'}`;
}

function normalizeInsight(value: any): PusulaDailyModuleInsight {
  return {
    headline: String(value?.headline ?? '').trim(),
    summary: String(value?.summary ?? '').trim(),
    reasons: Array.isArray(value?.reasons)
      ? value.reasons.map((item: unknown) => String(item ?? '').trim()).filter(Boolean).slice(0, 3)
      : [],
    confidence:
      value?.confidence === 'yuksek'
        ? 'yuksek'
        : value?.confidence === 'dusuk'
          ? 'dusuk'
          : 'orta',
    dataWarning: String(value?.dataWarning ?? '').trim() || null,
  };
}

function normalizeBrief(value: any): PusulaDailyBrief | null {
  if (!value || typeof value !== 'object') return null;

  const empty = normalizeInsight(null);
  const sections = value.sections ?? {};

  return {
    id: String(value.id ?? ''),
    fieldId: String(value.fieldId ?? '__global__'),
    analysisDate: String(value.analysisDate ?? ''),
    status:
      value.status === 'generating' ||
      value.status === 'fallback' ||
      value.status === 'error'
        ? value.status
        : 'ready',
    triggerReason: String(value.triggerReason ?? 'daily'),
    generatedAt: value.generatedAt ? String(value.generatedAt) : null,
    updatedAt: value.updatedAt ? String(value.updatedAt) : null,
    model: value.model ? String(value.model) : null,
    provider: value.provider ? String(value.provider) : null,
    aiLatencyMs: Number.isFinite(Number(value.aiLatencyMs)) ? Number(value.aiLatencyMs) : null,
    sections: {
      general: sections.general ? normalizeInsight(sections.general) : empty,
      market: sections.market ? normalizeInsight(sections.market) : empty,
      weather: sections.weather ? normalizeInsight(sections.weather) : empty,
      soil: sections.soil ? normalizeInsight(sections.soil) : empty,
      inventory: sections.inventory ? normalizeInsight(sections.inventory) : empty,
      calendar: sections.calendar ? normalizeInsight(sections.calendar) : empty,
      satellite: sections.satellite ? normalizeInsight(sections.satellite) : empty,
    },
  };
}

export async function getOrCreatePusulaDailyBrief(
  input: PusulaDailyRequest,
): Promise<EdgeResponse> {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const fieldId = String(input.field?.id ?? '').trim();

  if (!fieldId || fieldId === '__global__') {
    throw new Error(
      'Pusula günlük değerlendirmesi için aktif tarla seçili olmalı.',
    );
  }

  const key = requestKey(input);
  const existing = pendingByKey.get(key);
  if (existing) return existing;

  const task = (async () => {
    const { data, error } = await supabase.functions.invoke('pusula-intelligence', {
      body: input,
    });

    if (error) {
      throw new Error(error.message || 'Pusula günlük değerlendirmesi alınamadı.');
    }

    const response = (data ?? {}) as EdgeResponse;

    if (response.ok === false) {
      throw new Error(response.error || 'Pusula günlük değerlendirmesi oluşturulamadı.');
    }

    return {
      ...response,
      brief: normalizeBrief(response.brief),
    };
  })();

  pendingByKey.set(key, task);

  try {
    return await task;
  } finally {
    pendingByKey.delete(key);
  }
}

export function getPusulaDailySection(
  brief: PusulaDailyBrief | null | undefined,
  module: PusulaModuleKey,
) {
  return brief?.sections?.[module] ?? null;
}
