import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const STORAGE_KEY = 'tp_system_notifications_v1';

type DbNotification = {
  id: string;
  kind: string | null;
  source: string | null;
  severity: string | null;
  title: string;
  message: string | null;
  target: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

function readLocal() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function priorityFor(severity: string | null) {
  if (severity === 'critical') return 100;
  if (severity === 'warning') return 75;
  return 45;
}

function mergeNotifications(rows: DbNotification[]) {
  const current = readLocal();
  const currentById = new Map(current.map((item: any) => [String(item?.id ?? ''), item]));

  const serverRows = rows.map((row) => {
    const id = `db:${row.id}`;
    const existing: any = currentById.get(id);
    return {
      id,
      fieldId: '',
      fieldName: 'TarlaPusula',
      source: row.source || 'system',
      severity: row.severity || 'info',
      title: row.title,
      message: row.message || '',
      detail: row.message || '',
      iconKey: row.source === 'admin_broadcast' ? 'broadcast' : 'bell',
      target: row.target || 'notificationsHub',
      priority: priorityFor(row.severity),
      kind: row.kind || 'notification',
      task: null,
      data: row.data || {},
      isRead: Boolean(existing?.isRead) || Boolean(row.is_read),
      createdAt: row.created_at,
      updatedAt: row.created_at,
    };
  });

  const serverIds = new Set(serverRows.map((item) => item.id));
  const localOnly = current.filter((item: any) => !String(item?.id ?? '').startsWith('db:') || !serverIds.has(String(item.id)));
  const merged = [...serverRows, ...localOnly]
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 160);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('tp:notifications-updated'));
  } catch {
    // localStorage kapalıysa uygulama çalışmaya devam eder.
  }
}

export default function AppNotificationBridge() {
  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const sync = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!alive || !user) return;

      const { data, error } = await supabase
        .from('app_notifications')
        .select('id,kind,source,severity,title,message,target,data,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);

      if (!alive) return;
      if (error) {
        console.warn('[TarlaPusula] Sunucu bildirimleri okunamadı:', error.message);
        return;
      }
      mergeNotifications((data ?? []) as DbNotification[]);
    };

    const connect = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!alive || !auth.user) return;
      const userId = auth.user.id;
      channel?.unsubscribe();
      channel = supabase
        .channel(`tp-app-notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${userId}` },
          () => void sync(),
        )
        .subscribe();
      void sync();
    };

    void connect();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void connect();
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      channel?.unsubscribe();
    };
  }, []);

  return null;
}
