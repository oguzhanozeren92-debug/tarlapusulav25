import type { HomeSystemNotification } from '../../decision/types/homeDecision';

const STORAGE_KEY = 'tp_system_notifications_v1';

export function persistHomeNotifications(input: {
  fieldId: string;
  fieldName: string;
  notifications: HomeSystemNotification[];
}) {
  if (typeof window === 'undefined') return;
  if (!input.fieldId) return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const previous = raw ? JSON.parse(raw) : [];
    const previousItems = Array.isArray(previous) ? previous : [];
    const byId = new Map<string, any>();
    const activeIds = new Set(input.notifications.map((item) => item.id));

    previousItems.forEach((item: any) => {
      if (!item?.id) return;
      if (
        String(item.fieldId ?? '') === input.fieldId &&
        !activeIds.has(String(item.id)) &&
        (
          item.source === 'satellite' ||
          item.source === 'nutrition' ||
          item.source === 'risk-radar' ||
          item.source === 'pusula' ||
          (item.source === 'weather' && /:spray-(?:window|hourly-risk):/.test(String(item.id)))
        )
      ) return;
      byId.set(String(item.id), item);
    });

    const nowIso = new Date().toISOString();

    input.notifications.forEach((item) => {
      const existing = byId.get(item.id);
      byId.set(item.id, {
        id: item.id,
        fieldId: input.fieldId,
        fieldName: input.fieldName,
        source: item.source,
        severity: item.severity,
        title: item.title,
        message: item.detail,
        iconKey: item.iconKey,
        target: item.target,
        priority: item.priority,
        kind: item.task ? 'task' : 'notification',
        task: item.task ?? null,
        isRead: existing?.isRead ?? false,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
    });

    const next = Array.from(byId.values())
      .sort((a: any, b: any) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 80);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent('tp:notifications-updated', {
        detail: { notifications: next },
      }),
    );
  } catch (error) {
    console.warn('[notifications] Sistem bildirim kuyruğu güncellenemedi:', error);
  }
}
