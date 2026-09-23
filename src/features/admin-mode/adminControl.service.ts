import { supabase } from '../../supabaseClient';

export type AdminMetrics = {
  users: number;
  active_7d: number;
  active_30d: number;
  fields: number;
  total_decare: number;
  active_push_users: number;
  pending_content: number;
  published_content: number;
  active_sources: number;
  notifications: number;
};

export type AdminUserSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string | null;
  username: string | null;
  onboarding_completed: boolean;
  subscription_plan: string;
  role: string;
  field_count: number;
  total_decare: number;
  crops: string[];
  points: number;
  lifetime_points: number;
  active_push_count: number;
  latest_push_seen_at: string | null;
};

export type AdminOverviewResponse = {
  ok: boolean;
  metrics: AdminMetrics;
  users: AdminUserSummary[];
  error?: string;
};

export type AdminUserDetailResponse = {
  ok: boolean;
  user: Record<string, any> | null;
  profile: Record<string, any> | null;
  fields: Array<Record<string, any>>;
  activities: Array<Record<string, any>>;
  todos: Array<Record<string, any>>;
  notes: Array<Record<string, any>>;
  expenses: Array<Record<string, any>>;
  analyses: Array<Record<string, any>>;
  reminders: Array<Record<string, any>>;
  notifications: Array<Record<string, any>>;
  gamification: Record<string, any> | null;
  error?: string;
};

export type AdminAuditRow = {
  id: number;
  admin_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, any> | null;
  created_at: string;
};

export type UiOverrideInput = {
  selector: string;
  label?: string | null;
  text_value?: string | null;
  image_src?: string | null;
  hidden?: boolean;
  style?: Record<string, string>;
  parent_selector?: string | null;
  position_index?: number | null;
  enabled?: boolean;
};

type InvokePayload = Record<string, unknown>;

async function invokeAdmin<T>(body: InvokePayload): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-control-center', { body });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || 'Admin işlemi tamamlanamadı.');
  return data as T;
}

export const fetchAdminOverview = () =>
  invokeAdmin<AdminOverviewResponse>({ action: 'overview' });

export const fetchAdminUserDetail = (userId: string) =>
  invokeAdmin<AdminUserDetailResponse>({ action: 'user_detail', user_id: userId });

export async function sendAdminBroadcast(input: {
  title: string;
  message: string;
  target?: string;
  severity?: 'info' | 'warning' | 'critical';
  audience?: 'all' | 'plan' | 'crop' | 'selected';
  plan?: string;
  crop?: string;
  user_ids?: string[];
}) {
  return invokeAdmin<{
    ok: boolean;
    recipients: number;
    push_sent: number;
    push_failed: number;
    push_available: boolean;
  }>({ action: 'broadcast', ...input });
}

export const fetchAdminAudit = (limit = 80) =>
  invokeAdmin<{ ok: boolean; rows: AdminAuditRow[] }>({ action: 'audit_list', limit });

export const saveAdminUiOverride = (input: UiOverrideInput) =>
  invokeAdmin<{ ok: boolean; row: Record<string, any> }>({ action: 'save_ui_override', ...input });

export const deleteAdminUiOverride = (selector: string) =>
  invokeAdmin<{ ok: boolean }>({ action: 'delete_ui_override', selector });

export const listAdminUiOverrides = () =>
  invokeAdmin<{ ok: boolean; rows: Array<Record<string, any>> }>({ action: 'list_ui_overrides' });
