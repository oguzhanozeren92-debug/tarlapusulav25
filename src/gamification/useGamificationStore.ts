import { useSyncExternalStore } from 'react';
import { supabase } from '../supabaseClient';
import {
  getEntitlementSnapshot,
  refreshEntitlements,
} from '../entitlements/useEntitlementStore';

/* =========================================================
   TARLAPUSULA GAMIFICATION CORE
   Tek dosya sürümü — StackBlitz import sorunu yaşamaz.
   ========================================================= */

export const POINT_RULES = {
  DAILY_LOGIN: {
    points: 10,
    label: 'Günlük Giriş Ödülü',
    dailyLimit: 1,
  },
  ADD_SOIL_ANALYSIS: {
    points: 150,
    label: 'Toprak Analizi Ekle',
  },
  ADD_INVENTORY: {
    points: 50,
    label: 'Depoya Ürün Ekle',
  },
  ADD_CROP: {
    points: 100,
    label: 'Tarlaya Ürün Ekle',
  },
  PEST_ANALYSIS: {
    points: 30,
    label: 'Fotoğraf Analizi Yap',
  },
  FIELD_OBSERVATION_PHOTO: {
    points: 30,
    label: 'Sorunlu alan fotoğrafı ekle',
  },
  INVITE_FRIEND: {
    points: 300,
    label: 'Arkadaş Daveti',
  },
  WATCH_AD: {
    points: 50,
    label: 'Reklam İzle',
    dailyLimit: 3,
  },
} as const;

export type PointRuleKey = keyof typeof POINT_RULES;

export const FIELD_UNLOCK_THRESHOLDS = {
  FIELD_1: 0,
  FIELD_2: 1000,
  FIELD_3: 2500,
} as const;

export type GamificationServerState = {
  points: number;
  lifetimePoints: number;
  unlockedFields: number;
  nextFieldNumber: number | null;
  nextThreshold: number | null;
  remainingToNext: number;
  progressPercent: number;
};

export type AwardPointsResult = GamificationServerState & {
  awarded: boolean;
  awardedPoints: number;
  ruleKey: PointRuleKey;
  reason: string;
};

export type GamificationToast = {
  id: number;
  title: string;
  points: number;
  ruleKey: PointRuleKey;
} | null;

export type GamificationState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  points: number;
  lifetimePoints: number;
  unlockedFields: number;
  nextFieldNumber: number | null;
  nextThreshold: number | null;
  remainingToNext: number;
  progressPercent: number;
  lastAward: GamificationToast;
  error: string | null;
};

const initialState: GamificationState = {
  status: 'idle',
  points: 0,
  lifetimePoints: 0,
  unlockedFields: 1,
  nextFieldNumber: 2,
  nextThreshold: 1000,
  remainingToNext: 1000,
  progressPercent: 0,
  lastAward: null,
  error: null,
};

let state: GamificationState = initialState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<GamificationState>) {
  state = {
    ...state,
    ...next,
  };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useGamificationStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getGamificationState() {
  return state;
}

/* =========================================================
   TARLA KİLİT HESAPLARI
   Puan HARCANMAZ — toplam puan eşik olarak kullanılır.
   ========================================================= */

export function getUnlockedFieldCount(points: number) {
  const entitlement = getEntitlementSnapshot();

  if (entitlement.isPremium) {
    return 99;
  }

  const safePoints = Math.max(0, Number(points) || 0);

  if (safePoints >= FIELD_UNLOCK_THRESHOLDS.FIELD_3) return 3;
  if (safePoints >= FIELD_UNLOCK_THRESHOLDS.FIELD_2) return 2;
  return 1;
}

export function getNextFieldUnlock(points: number) {
  const entitlement = getEntitlementSnapshot();

  if (entitlement.isPremium) {
    return {
      fieldNumber: null,
      requiredPoints: null,
      remainingPoints: 0,
      progressPercent: 100,
    };
  }

  const safePoints = Math.max(0, Number(points) || 0);

  if (safePoints < FIELD_UNLOCK_THRESHOLDS.FIELD_2) {
    const required = FIELD_UNLOCK_THRESHOLDS.FIELD_2;

    return {
      fieldNumber: 2,
      requiredPoints: required,
      remainingPoints: Math.max(0, required - safePoints),
      progressPercent: Math.min(
        100,
        Math.round((safePoints / required) * 100),
      ),
    };
  }

  if (safePoints < FIELD_UNLOCK_THRESHOLDS.FIELD_3) {
    const required = FIELD_UNLOCK_THRESHOLDS.FIELD_3;

    return {
      fieldNumber: 3,
      requiredPoints: required,
      remainingPoints: Math.max(0, required - safePoints),
      progressPercent: Math.min(
        100,
        Math.round((safePoints / required) * 100),
      ),
    };
  }

  return {
    fieldNumber: null,
    requiredPoints: null,
    remainingPoints: 0,
    progressPercent: 100,
  };
}

export function canCreateField(
  existingRealFieldCount: number,
  points: number,
) {
  const nextFieldNumber = existingRealFieldCount + 1;
  const entitlement = getEntitlementSnapshot();

  if (entitlement.status === 'idle') {
    void refreshEntitlements();
  }

  if (entitlement.isPremium) {
    return {
      allowed: true,
      nextFieldNumber,
      requiredPoints: 0,
      remainingPoints: 0,
      reason: 'premium' as const,
    };
  }

  const requiredPoints =
    nextFieldNumber === 1
      ? FIELD_UNLOCK_THRESHOLDS.FIELD_1
      : nextFieldNumber === 2
        ? FIELD_UNLOCK_THRESHOLDS.FIELD_2
        : nextFieldNumber === 3
          ? FIELD_UNLOCK_THRESHOLDS.FIELD_3
          : null;

  if (requiredPoints === null) {
    return {
      allowed: false,
      nextFieldNumber,
      requiredPoints: null,
      remainingPoints: null,
      reason: 'configured_limit' as const,
    };
  }

  const safePoints = Math.max(0, Number(points) || 0);

  return {
    allowed: safePoints >= requiredPoints,
    nextFieldNumber,
    requiredPoints,
    remainingPoints: Math.max(0, requiredPoints - safePoints),
    reason:
      safePoints >= requiredPoints
        ? ('unlocked' as const)
        : ('insufficient_points' as const),
  };
}

export function getNextFieldGate(existingRealFieldCount: number) {
  return canCreateField(existingRealFieldCount, state.points);
}

/* =========================================================
   SUPABASE YARDIMCILARI
   ========================================================= */

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  if (value && typeof value === 'object') {
    return value as T;
  }

  return null;
}

function normalizeState(raw: any): GamificationServerState {
  const points = Math.max(
    0,
    Number(raw?.points ?? raw?.total_points ?? 0) || 0,
  );

  const next = getNextFieldUnlock(points);
  const entitlement = getEntitlementSnapshot();

  return {
    points,
    lifetimePoints: Math.max(
      0,
      Number(
        raw?.lifetime_points ??
          raw?.lifetimePoints ??
          raw?.points ??
          points,
      ) || 0,
    ),
    unlockedFields: entitlement.isPremium
      ? 99
      : Math.max(
          1,
          Number(
            raw?.unlocked_fields ??
              raw?.unlockedFields ??
              getUnlockedFieldCount(points),
          ) || 1,
        ),
    nextFieldNumber:
      raw?.next_field_number !== undefined
        ? raw.next_field_number
        : raw?.nextFieldNumber !== undefined
          ? raw.nextFieldNumber
          : next.fieldNumber,
    nextThreshold:
      raw?.next_threshold !== undefined
        ? raw.next_threshold
        : raw?.nextThreshold !== undefined
          ? raw.nextThreshold
          : next.requiredPoints,
    remainingToNext: Math.max(
      0,
      Number(
        raw?.remaining_to_next ??
          raw?.remainingToNext ??
          next.remainingPoints,
      ) || 0,
    ),
    progressPercent: Math.min(
      100,
      Math.max(
        0,
        Number(
          raw?.progress_percent ??
            raw?.progressPercent ??
            next.progressPercent,
        ) || 0,
      ),
    ),
  };
}

function applyServerState(next: GamificationServerState) {
  patch({
    ...next,
    status: 'ready',
    error: null,
  });
}

export async function fetchGamificationState() {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error('Puan durumunu görmek için giriş yapmalısın.');
  }

  const { data, error } = await supabase.rpc(
    'tp_get_gamification_state',
  );

  if (error) throw error;

  return normalizeState(firstRow<any>(data) ?? data);
}

export async function awardGamificationPoints(
  ruleKey: PointRuleKey,
  options: {
    dedupeKey?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<AwardPointsResult> {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.rpc('tp_award_points', {
    p_rule_key: ruleKey,
    p_dedupe_key: options.dedupeKey ?? null,
    p_metadata: options.metadata ?? {},
  });

  if (error) throw error;

  const row = firstRow<any>(data) ?? data ?? {};
  const normalized = normalizeState(row);

  return {
    ...normalized,
    awarded: Boolean(row?.awarded),
    awardedPoints: Math.max(
      0,
      Number(
        row?.awarded_points ??
          row?.awardedPoints ??
          0,
      ) || 0,
    ),
    ruleKey,
    reason: String(row?.reason ?? 'unknown'),
  };
}

export async function addPoints(
  ruleKey: PointRuleKey,
  options: {
    dedupeKey?: string | null;
    metadata?: Record<string, unknown>;
    toastTitle?: string;
  } = {},
) {
  try {
    const result = await awardGamificationPoints(
      ruleKey,
      options,
    );

    applyServerState(result);

    if (result.awarded && result.awardedPoints > 0) {
      patch({
        lastAward: {
          id: Date.now(),
          title:
            options.toastTitle ??
            POINT_RULES[ruleKey].label,
          points: result.awardedPoints,
          ruleKey,
        },
      });
    }

    return result;
  } catch (error) {
    patch({
      error:
        error instanceof Error
          ? error.message
          : 'Puan işlemi tamamlanamadı.',
    });

    throw error;
  }
}

export function clearLastAward() {
  patch({ lastAward: null });
}

export async function refreshGamification() {
  patch({
    status: 'loading',
    error: null,
  });

  try {
    const next = await fetchGamificationState();
    applyServerState(next);
    return next;
  } catch (error) {
    patch({
      status: 'error',
      error:
        error instanceof Error
          ? error.message
          : 'Puan durumu yüklenemedi.',
    });

    throw error;
  }
}

/* =========================================================
   GÜNLÜK GİRİŞ ÖDÜLÜ
   Server tarafındaki dedupe + daily limit asıl korumadır.
   ========================================================= */

function getTurkeyDayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function claimDailyLoginReward() {
  const dayKey = getTurkeyDayKey();

  return awardGamificationPoints('DAILY_LOGIN', {
    dedupeKey: `daily-login:${dayKey}`,
    metadata: {
      source: 'app_boot',
      localDate: dayKey,
    },
  });
}

/* =========================================================
   SESSION BAŞLATMA
   ========================================================= */

let started = false;
let authUnsubscribe: (() => void) | null = null;

async function syncForCurrentUser() {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    state = initialState;
    emit();
    return;
  }

  try {
    const current = await fetchGamificationState();
    applyServerState(current);

    const daily = await claimDailyLoginReward();
    applyServerState(daily);

    if (daily.awarded && daily.awardedPoints > 0) {
      patch({
        lastAward: {
          id: Date.now(),
          title: 'Bugünün giriş ödülü',
          points: daily.awardedPoints,
          ruleKey: 'DAILY_LOGIN',
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Puan sistemi başlatılamadı.';

    console.warn(
      '[TarlaPusula Gamification]',
      message,
    );

    patch({
      status: 'error',
      error: message,
    });
  }
}

export function startGamificationSession() {
  if (started) {
    return () => undefined;
  }

  started = true;
  void syncForCurrentUser();

  if (supabase) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncForCurrentUser();
    });

    authUnsubscribe = () =>
      subscription.unsubscribe();
  }

  return () => {
    authUnsubscribe?.();
    authUnsubscribe = null;
    started = false;
  };
}
