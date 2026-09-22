import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../supabaseClient';

export type TarlaPusulaPlan = 'free' | 'premium';
export type DeveloperPlanMode = 'real' | 'free' | 'premium' | 'new_user';

type EntitlementStatus = 'idle' | 'loading' | 'ready' | 'error';

export type EntitlementSnapshot = {
  status: EntitlementStatus;
  userEmail: string;
  realPlan: TarlaPusulaPlan;
  developerMode: DeveloperPlanMode;
  effectivePlan: TarlaPusulaPlan;
  canOverride: boolean;
  isPremium: boolean;
  isNewUserPreview: boolean;
  switching: boolean;
  backendSynced: boolean;
  error: string | null;
};

const DEV_EMAIL = 'best.flow@hotmail.com';
const DEV_MODE_STORAGE_KEY = 'tp_dev_plan_mode_v2';
const SWITCH_ID = 'tp-dev-plan-switch';
const STYLE_ID = 'tp-dev-plan-switch-style';

const listeners = new Set<() => void>();

let state: EntitlementSnapshot = {
  status: 'idle',
  userEmail: '',
  realPlan: 'free',
  developerMode: 'real',
  effectivePlan: 'free',
  canOverride: false,
  isPremium: false,
  isNewUserPreview: false,
  switching: false,
  backendSynced: false,
  error: null,
};

let authListenerStarted = false;
let refreshPromise: Promise<EntitlementSnapshot> | null = null;

function normalizePlan(value: unknown): TarlaPusulaPlan {
  return String(value ?? 'free').trim().toLowerCase() === 'free'
    ? 'free'
    : 'premium';
}

function normalizeMode(value: unknown): DeveloperPlanMode {
  const mode = String(value ?? '').trim().toLowerCase();

  if (
    mode === 'premium' ||
    mode === 'free' ||
    mode === 'real' ||
    mode === 'new_user'
  ) {
    return mode;
  }

  return 'premium';
}

function isDeveloperEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === DEV_EMAIL;
}

function readLocalMode(): DeveloperPlanMode {
  if (typeof window === 'undefined') return 'premium';

  try {
    return normalizeMode(window.localStorage.getItem(DEV_MODE_STORAGE_KEY));
  } catch {
    return 'premium';
  }
}

function writeLocalMode(mode: DeveloperPlanMode) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(DEV_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage kapalıysa yalnızca mevcut oturumda çalışır.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function patch(next: Partial<EntitlementSnapshot>) {
  state = {
    ...state,
    ...next,
  };

  emit();
  renderDeveloperSwitch();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function getEntitlementSnapshot() {
  return state;
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }

  if (value && typeof value === 'object') {
    return value as T;
  }

  return null;
}

function getEffectivePlan(
  realPlan: TarlaPusulaPlan,
  mode: DeveloperPlanMode,
): TarlaPusulaPlan {
  if (mode === 'real') return realPlan;
  if (mode === 'premium') return 'premium';

  // Ücretsiz ve Yeni Kullanıcı önizlemeleri plan yetkileri bakımından Free çalışır.
  return 'free';
}

function ensureSwitchStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${SWITCH_ID}{
      position:fixed;
      right:14px;
      bottom:82px;
      z-index:2147483000;
      min-width:118px;
      min-height:42px;
      padding:7px 11px;
      border:1px solid rgba(140,186,150,.30);
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      background:rgba(5,13,8,.94);
      color:#e8eee7;
      box-shadow:0 12px 32px rgba(0,0,0,.38),inset 0 1px rgba(255,255,255,.03);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      cursor:pointer;
      font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      transition:transform .16s ease,border-color .16s ease,opacity .16s ease;
    }
    #${SWITCH_ID}:hover{
      transform:translateY(-1px);
      border-color:rgba(151,207,163,.48);
    }
    #${SWITCH_ID}:active{transform:translateY(0) scale(.98)}
    #${SWITCH_ID}[disabled]{opacity:.58;cursor:wait}
    #${SWITCH_ID} .tp-dev-label{
      color:#829086;
      font-size:8px;
      line-height:1;
      font-weight:900;
      letter-spacing:.12em;
    }
    #${SWITCH_ID} .tp-dev-value{
      font-size:10px;
      line-height:1;
      font-weight:900;
      white-space:nowrap;
    }
    #${SWITCH_ID}[data-mode="premium"] .tp-dev-value{color:#9dd5a7}
    #${SWITCH_ID}[data-mode="free"] .tp-dev-value{color:#d8ddcf}
    #${SWITCH_ID}[data-mode="new_user"] .tp-dev-value{color:#c9d7ff}
    #${SWITCH_ID}[data-mode="real"] .tp-dev-value{color:#a8b5aa}
    #${SWITCH_ID} .tp-dev-dot{
      width:6px;
      height:6px;
      border-radius:50%;
      background:#65bf78;
      box-shadow:0 0 8px rgba(101,191,120,.45);
      flex:0 0 auto;
    }
    #${SWITCH_ID}[data-synced="false"] .tp-dev-dot{
      background:#8b968d;
      box-shadow:none;
    }
    @media(max-width:520px){
      #${SWITCH_ID}{
        right:10px;
        bottom:74px;
        min-width:106px;
        min-height:38px;
        padding:6px 9px;
      }
      #${SWITCH_ID} .tp-dev-label{font-size:7px}
      #${SWITCH_ID} .tp-dev-value{font-size:9px}
    }
  `;

  document.head.appendChild(style);
}

function switchText() {
  if (state.switching) return 'DEĞİŞİYOR…';

  if (state.developerMode === 'premium') return 'PREMIUM';
  if (state.developerMode === 'free') return 'ÜCRETSİZ';
  if (state.developerMode === 'new_user') return 'YENİ KULLANICI';

  return `GERÇEK · ${state.realPlan === 'premium' ? 'PREMIUM' : 'FREE'}`;
}

function renderDeveloperSwitch() {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById(SWITCH_ID) as HTMLButtonElement | null;

  if (!state.canOverride) {
    existing?.remove();
    return;
  }

  ensureSwitchStyle();

  const button = existing ?? document.createElement('button');

  if (!existing) {
    button.id = SWITCH_ID;
    button.type = 'button';
    button.innerHTML = `
      <span class="tp-dev-dot" aria-hidden="true"></span>
      <span class="tp-dev-label">TEST</span>
      <strong class="tp-dev-value"></strong>
    `;

    button.addEventListener('click', () => {
      void cycleDeveloperPlanMode();
    });

    document.body.appendChild(button);
  }

  button.dataset.mode = state.developerMode;
  button.dataset.synced = String(state.backendSynced);
  button.disabled = state.switching;
  button.title =
    state.developerMode === 'new_user'
      ? 'Yeni kullanıcı önizlemesi: Premium → Ücretsiz → Yeni Kullanıcı → Gerçek Plan'
      : state.backendSynced
        ? 'Test planı: Premium → Ücretsiz → Yeni Kullanıcı → Gerçek Plan'
        : 'Test planı yalnızca bu cihazdaki frontend önizlemesidir.';
  button.setAttribute(
    'aria-label',
    `TarlaPusula test planı: ${switchText()}`,
  );

  const value = button.querySelector('.tp-dev-value');
  if (value) value.textContent = switchText();
}

function applyFallback(
  email: string,
  realPlan: TarlaPusulaPlan,
  error: unknown = null,
) {
  const canOverride = isDeveloperEmail(email);
  const developerMode = canOverride ? readLocalMode() : 'real';
  const effectivePlan = getEffectivePlan(realPlan, developerMode);

  patch({
    status: 'ready',
    userEmail: email,
    realPlan,
    developerMode,
    effectivePlan,
    canOverride,
    isPremium: effectivePlan === 'premium',
    isNewUserPreview: developerMode === 'new_user',
    switching: false,
    backendSynced: false,
    error:
      error instanceof Error
        ? error.message
        : error
          ? String(error)
          : null,
  });
}

function applyBackendContext(row: any, email: string) {
  const realPlan = normalizePlan(row?.real_plan ?? row?.realPlan ?? 'free');
  const canOverride = Boolean(
    row?.can_override ?? row?.canOverride ?? isDeveloperEmail(email),
  );
  const localMode = canOverride ? readLocalMode() : 'real';
  const backendMode = canOverride
    ? normalizeMode(row?.developer_mode ?? row?.developerMode ?? localMode)
    : 'real';

  // "Yeni Kullanıcı" gerçek bir abonelik planı değildir.
  // Backend'den gelen plan modu local önizlemeyi ezmesin.
  const developerMode: DeveloperPlanMode =
    canOverride && localMode === 'new_user' ? 'new_user' : backendMode;

  const effectivePlan =
    developerMode === 'new_user'
      ? 'free'
      : normalizePlan(
          row?.effective_plan ??
            row?.effectivePlan ??
            getEffectivePlan(realPlan, developerMode),
        );

  if (canOverride) writeLocalMode(developerMode);

  patch({
    status: 'ready',
    userEmail: email,
    realPlan,
    developerMode,
    effectivePlan,
    canOverride,
    isPremium: effectivePlan === 'premium',
    isNewUserPreview: developerMode === 'new_user',
    switching: false,
    backendSynced: true,
    error: null,
  });
}

async function readFallbackRealPlan(): Promise<TarlaPusulaPlan> {
  if (!supabase) return 'free';

  try {
    const { data, error } = await supabase.rpc('get_ai_access_status');
    if (error) throw error;

    const row = firstRow<any>(data) ?? data;
    return normalizePlan(row?.plan);
  } catch {
    return 'free';
  }
}

export async function refreshEntitlements() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    if (!supabase) {
      applyFallback('', 'free', 'Supabase bağlantısı hazır değil.');
      return state;
    }

    patch({
      status: state.status === 'idle' ? 'loading' : state.status,
      error: null,
    });

    let email = '';

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        applyFallback('', 'free');
        return state;
      }

      email = String(user.email ?? '').trim().toLowerCase();

      // Geliştirici butonunu SQL sonucu gelmeden de göster.
      if (isDeveloperEmail(email)) {
        const localMode = readLocalMode();
        const effectivePlan = getEffectivePlan(state.realPlan, localMode);

        patch({
          userEmail: email,
          canOverride: true,
          developerMode: localMode,
          effectivePlan,
          isPremium: effectivePlan === 'premium',
          isNewUserPreview: localMode === 'new_user',
        });
      }

      const realPlan = await readFallbackRealPlan();
      applyFallback(email, realPlan);
      return state;
    } catch (error) {
      const realPlan = await readFallbackRealPlan();
      applyFallback(email, realPlan, error);
      return state;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function setDeveloperPlanMode(mode: DeveloperPlanMode) {
  if (!state.canOverride || !isDeveloperEmail(state.userEmail)) {
    return state;
  }

  const safeMode = normalizeMode(mode);
  const effectivePlan = getEffectivePlan(state.realPlan, safeMode);
  const isNewUserPreview = safeMode === 'new_user';

  writeLocalMode(safeMode);

  patch({
    developerMode: safeMode,
    effectivePlan,
    isPremium: effectivePlan === 'premium',
    isNewUserPreview,
    // Yeni Kullanıcı frontend-only önizlemedir; backend RPC beklemeyiz.
    switching: !isNewUserPreview,
    error: null,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tp-plan-mode-changed', {
        detail: {
          mode: safeMode,
          effectivePlan,
          isNewUserPreview,
        },
      }),
    );

    window.dispatchEvent(
      new CustomEvent('tp-new-user-preview-changed', {
        detail: {
          active: isNewUserPreview,
        },
      }),
    );
  }

  // Supabase tarafında "new_user" diye bir plan modu yok.
  // Gerçek kullanıcı/veri durumuna dokunmadan yalnızca UI önizlemesi yapılır.
  if (isNewUserPreview) {
    patch({
      switching: false,
      backendSynced: false,
      error: null,
    });

    return state;
  }

  /*
    Geliştirici plan anahtarı yalnızca frontend önizlemesidir.
    Supabase'te tp_set_dev_plan_mode RPC'si bulunmadığı için backend'e
    olmayan bir fonksiyon çağrısı yapmıyoruz.
  */
  patch({
    developerMode: safeMode,
    effectivePlan,
    isPremium: effectivePlan === 'premium',
    isNewUserPreview,
    switching: false,
    backendSynced: false,
    error: null,
  });

  return state;
}

export async function cycleDeveloperPlanMode() {
  const next: DeveloperPlanMode =
    state.developerMode === 'premium'
      ? 'free'
      : state.developerMode === 'free'
        ? 'new_user'
        : state.developerMode === 'new_user'
          ? 'real'
          : 'premium';

  return setDeveloperPlanMode(next);
}

function ensureAuthListener() {
  if (authListenerStarted || !supabase) return;

  authListenerStarted = true;

  supabase.auth.onAuthStateChange(() => {
    void refreshEntitlements();
  });
}

function bootstrap() {
  if (typeof window === 'undefined') return;

  ensureAuthListener();

  window.setTimeout(() => {
    void refreshEntitlements();
  }, 0);
}

bootstrap();

export function useEntitlementStore() {
  useEffect(() => {
    ensureAuthListener();

    if (state.status === 'idle') {
      void refreshEntitlements();
    }
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
