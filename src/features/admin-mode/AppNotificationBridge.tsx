import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { resolveTaskRewardPoints } from '../tasks/services/fieldTasks.service';

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

function mergeNotifications(
  rows: DbNotification[],
  activeTaskIds: Set<string>,
  activeTaskKeys: Set<string>,
) {
  const current = readLocal();
  const currentById = new Map(current.map((item: any) => [String(item?.id ?? ''), item]));

  const serverRows = rows
    .filter((row) => {
      if (row.kind !== 'task') return true;

      const data = row.data || {};
      const taskId = String(data.taskId ?? data.task_id ?? '').trim();
      const taskKey = String(data.taskKey ?? data.task_key ?? '').trim();

      // Sunucuda eski task bildirimi dursa bile aktif field_todos kaydı yoksa gösterme.
      if (taskId && activeTaskIds.has(taskId)) return true;
      if (taskKey && activeTaskKeys.has(taskKey)) return true;

      return false;
    })
    .map((row) => {
    const id = `db:${row.id}`;
    const existing: any = currentById.get(id);
    const isTaskEvent = row.kind === 'task';
    const data = row.data || {};
    const rawRewardPoints = Number(
      data.rewardPoints ?? data.reward_points ?? 0,
    );
    const taskKey = String(data.taskKey ?? data.task_key ?? '').trim();
    const actionTarget = String(
      data.actionTarget ?? data.action_target ?? row.target ?? '',
    ).trim();

    const safeRewardPoints = isTaskEvent
      ? resolveTaskRewardPoints({
          taskKey,
          source: row.source ?? 'task-system',
          actionTarget,
          title: row.title,
          metadata: {
            ...data,
            rewardPoints: Number.isFinite(rawRewardPoints)
              ? rawRewardPoints
              : 0,
          },
        })
      : 0;

    return {
      id,
      fieldId: String(data.fieldId ?? data.field_id ?? ''),
      fieldName: String(data.fieldName ?? data.field_name ?? 'TarlaPusula'),
      source: isTaskEvent ? 'task-system' : row.source || 'system',
      severity: row.severity || 'info',
      title: row.title,
      message: isTaskEvent
        ? `Yeni görev tanımlandı · +${safeRewardPoints} Pusula Puanı${
            row.message ? ` · ${row.message}` : ''
          }`
        : row.message || '',
      detail: row.message || '',
      iconKey: isTaskEvent
        ? 'task'
        : row.source === 'admin_broadcast'
          ? 'broadcast'
          : 'bell',
      target: isTaskEvent ? 'tasks' : row.target || 'notificationsHub',
      priority: priorityFor(row.severity),
      kind: 'notification',
      task: isTaskEvent
        ? {
            id: String(data.taskId ?? data.task_id ?? row.id),
            task_key: String(data.taskKey ?? data.task_key ?? '') || null,
            action_target: String(data.actionTarget ?? data.action_target ?? '') || null,
            title: row.title,
            status: 'open',
            reward_points: safeRewardPoints,
          }
        : null,
      data,
      isRead: Boolean(existing?.isRead) || Boolean(row.is_read),
      createdAt: row.created_at,
      updatedAt: row.created_at,
    };
  });

  const canonicalTaskIds = new Set(
    current
      .filter((item: any) => String(item?.id ?? '').startsWith('task-defined:'))
      .map((item: any) => String(item?.task?.id ?? '').trim())
      .filter(Boolean),
  );

  const dedupedServerRows = serverRows.filter((item: any) => {
    const taskId = String(item?.task?.id ?? '').trim();
    return !taskId || !canonicalTaskIds.has(taskId);
  });

  const serverIds = new Set(dedupedServerRows.map((item) => item.id));
  const localOnly = current.filter(
    (item: any) =>
      !String(item?.id ?? '').startsWith('db:') ||
      !serverIds.has(String(item.id)),
  );
  const merged = [...dedupedServerRows, ...localOnly]
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
      const rows = (data ?? []) as DbNotification[];
      const taskRows = rows.filter((row) => row.kind === 'task');
      const taskIds = Array.from(
        new Set(
          taskRows
            .map((row) => String(row.data?.taskId ?? row.data?.task_id ?? '').trim())
            .filter(Boolean),
        ),
      );
      const taskKeys = Array.from(
        new Set(
          taskRows
            .map((row) => String(row.data?.taskKey ?? row.data?.task_key ?? '').trim())
            .filter(Boolean),
        ),
      );

      const activeTaskIds = new Set<string>();
      const activeTaskKeys = new Set<string>();

      if (taskIds.length) {
        const { data: activeById, error: activeByIdError } = await supabase
          .from('field_todos')
          .select('id,task_key')
          .eq('user_id', user.id)
          .eq('completed', false)
          .eq('dismissed', false)
          .in('id', taskIds);

        if (!activeByIdError) {
          (activeById ?? []).forEach((task: any) => {
            if (task?.id) activeTaskIds.add(String(task.id));
            if (task?.task_key) activeTaskKeys.add(String(task.task_key));
          });
        }
      }

      if (taskKeys.length) {
        const { data: activeByKey, error: activeByKeyError } = await supabase
          .from('field_todos')
          .select('id,task_key')
          .eq('user_id', user.id)
          .eq('completed', false)
          .eq('dismissed', false)
          .in('task_key', taskKeys);

        if (!activeByKeyError) {
          (activeByKey ?? []).forEach((task: any) => {
            if (task?.id) activeTaskIds.add(String(task.id));
            if (task?.task_key) activeTaskKeys.add(String(task.task_key));
          });
        }
      }

      mergeNotifications(rows, activeTaskIds, activeTaskKeys);
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
