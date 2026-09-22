import { supabase } from '../../../supabaseClient';
import type { HomeSystemNotification } from '../../decision/types/homeDecision';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeAreaKey(value: unknown) {
  return text(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '-');
}

function stableTaskKey(
  notification: HomeSystemNotification,
): string | null {
  const task = notification.task;
  if (!task) return null;

  const target = text(task.actionTarget);

  if (target === 'field-photo') {
    const metadata = objectValue(task.metadata);
    const semanticSource = text(metadata.source);
    const semanticTaskKey = text(task.taskKey);

    if (
      (semanticSource === 'ndvi_anomaly' || semanticSource === 'ndvi_follow_up') &&
      semanticTaskKey
    ) {
      return semanticTaskKey;
    }

    const importantArea = objectValue(metadata.importantArea);
    const areaKey = normalizeAreaKey(
      importantArea.area ?? metadata.direction,
    );

    /*
     * Konumu olmayan genel Pusula uyarısı bildirimdir, görev değildir.
     */
    if (!areaKey) return null;

    return `pusula-field-check:area:${areaKey}`;
  }

  return text(task.taskKey) || null;
}

export async function syncNotificationTasks(
  fieldId: string,
  notifications: HomeSystemNotification[],
) {
  const id = text(fieldId);
  if (!id || !supabase) return;

  const taskNotifications = notifications
    .map((notification) => ({
      notification,
      taskKey: stableTaskKey(notification),
    }))
    .filter(
      (item): item is {
        notification: HomeSystemNotification;
        taskKey: string;
      } => Boolean(item.taskKey),
    );

  if (!taskNotifications.length) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return;

  const taskKeys = taskNotifications.map((item) => item.taskKey);

  const { data: existingRows, error: existingError } = await supabase
    .from('field_todos')
    .select('id,task_key,completed,dismissed,metadata')
    .eq('user_id', user.id)
    .eq('field_id', id)
    .in('task_key', taskKeys);

  if (existingError) throw existingError;

  const existingByKey = new Map(
    (existingRows ?? []).map((row: any) => [String(row.task_key), row]),
  );

  for (const item of taskNotifications) {
    const notification = item.notification;
    const task = notification.task!;
    const taskKey = item.taskKey;

    const existing = existingByKey.get(taskKey);
    const metadata = {
      ...objectValue(existing?.metadata),
      ...objectValue(task.metadata),
      rewardPoints: Number(task.rewardPoints ?? 0),
      originalTaskKey: text(task.taskKey) || null,
      notificationId: notification.id,
      notificationSource: notification.source,
      notificationTarget: notification.target,
      notificationSeverity: notification.severity,
    };

    const values = {
      title: notification.title,
      description: notification.detail,
      source: 'notification-task',
      action_target: task.actionTarget,
      priority: notification.priority,
      reward_rule_key: task.rewardRuleKey ?? null,
      metadata,
      dismissed: false,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      if (existing.completed) continue;

      const { error } = await supabase
        .from('field_todos')
        .update(values)
        .eq('id', existing.id)
        .eq('user_id', user.id);

      if (error) throw error;
      continue;
    }

    const { error } = await supabase.from('field_todos').insert({
      user_id: user.id,
      field_id: id,
      task_key: taskKey,
      completed: false,
      ...values,
    });

    if (error && error.code !== '23505') throw error;
  }
}
