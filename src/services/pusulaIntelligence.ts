import { supabase } from '../supabaseClient';

import type {
  CollectedPusulaContext,
} from './pusulaContextRegistry';

export type PusulaConfidence =
  | 'dusuk'
  | 'orta'
  | 'yuksek';

export type PusulaInsight = {
  id: string;

  headline: string;
  summary: string;

  reasons: string[];

  relatedModules: string[];

  confidence: PusulaConfidence;

  dataWarning?: string | null;

  createdAt: string;

  feedback?: {
    liked: boolean;
    reason?: string | null;
  } | null;
};

export type PusulaFeedbackReason =
  | 'irrelevant'
  | 'already_known'
  | 'wrong_or_incomplete'
  | 'too_general'
  | 'other';

function normalizeInsight(
  raw: any,
): PusulaInsight {
  return {
    id: String(raw?.id ?? ''),

    headline:
      String(
        raw?.headline ??
          'Pusula’dan Sana',
      ).trim(),

    summary:
      String(
        raw?.summary ?? '',
      ).trim(),

    reasons: Array.isArray(raw?.reasons)
      ? raw.reasons
          .map((item: unknown) =>
            String(item).trim(),
          )
          .filter(Boolean)
          .slice(0, 3)
      : [],

    relatedModules:
      Array.isArray(
        raw?.relatedModules ??
          raw?.related_modules,
      )
        ? (
            raw.relatedModules ??
            raw.related_modules
          )
            .map((item: unknown) =>
              String(item).trim(),
            )
            .filter(Boolean)
        : [],

    confidence:
      raw?.confidence === 'yuksek'
        ? 'yuksek'
        : raw?.confidence === 'dusuk'
          ? 'dusuk'
          : 'orta',

    dataWarning:
      raw?.dataWarning ??
      raw?.data_warning ??
      null,

    createdAt:
      raw?.createdAt ??
      raw?.created_at ??
      new Date().toISOString(),

    feedback:
      raw?.feedback ?? null,
  };
}

export async function generatePusulaInsight(
  context: CollectedPusulaContext,
): Promise<PusulaInsight> {
  if (!supabase) {
    throw new Error(
      'Supabase bağlantısı bulunamadı.',
    );
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'pusula-intelligence',
      {
        body: {
          context,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(
      String(data.error),
    );
  }

  if (!data?.insight) {
    throw new Error(
      'Pusula önerisi oluşturulamadı.',
    );
  }

  return normalizeInsight(
    data.insight,
  );
}

export async function savePusulaFeedback({
  insightId,
  liked,
  reason = null,
}: {
  insightId: string;
  liked: boolean;
  reason?: PusulaFeedbackReason | null;
}) {
  if (!supabase) {
    throw new Error(
      'Supabase bağlantısı bulunamadı.',
    );
  }

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(
      'Oturum bulunamadı.',
    );
  }

  const {
    error,
  } =
    await supabase
      .from('pusula_feedback')
      .upsert(
        {
          insight_id: insightId,
          user_id: user.id,
          liked,
          reason,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'insight_id,user_id',
        },
      );

  if (error) {
    throw error;
  }

  return {
    liked,
    reason,
  };
}

export async function fetchLatestPusulaInsight({
  screen,
  fieldId,
}: {
  screen?: string;
  fieldId?: string | null;
} = {}): Promise<PusulaInsight | null> {
  if (!supabase) return null;

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) return null;

  let query =
    supabase
      .from('pusula_insights')
      .select(
        `
        id,
        headline,
        summary,
        reasons,
        related_modules,
        confidence,
        data_warning,
        created_at
      `,
      )
      .eq('user_id', user.id)
      .order(
        'created_at',
        {
          ascending: false,
        },
      )
      .limit(1);

  if (screen) {
    query =
      query.eq(
        'screen',
        screen,
      );
  }

  if (fieldId) {
    query =
      query.eq(
        'field_id',
        fieldId,
      );
  }

  const {
    data,
    error,
  } =
    await query.maybeSingle();

  if (error) {
    console.warn(
      'Pusula geçmiş önerisi alınamadı:',
      error,
    );

    return null;
  }

  if (!data) return null;

  return normalizeInsight(data);
}