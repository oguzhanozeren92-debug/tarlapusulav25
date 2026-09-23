import { supabase } from '../../../supabaseClient';
import type { IrrigationDecisionSynthesis } from '../../irrigation/types/irrigationDecision';

const TASK_NOTIFICATION_STORAGE_KEY = 'tp_system_notifications_v1';

export type FieldTask = {
  id: string;
  fieldId: string;
  title: string;
  description: string | null;
  source: string;
  actionTarget: string | null;
  priority: number;
  rewardPoints: number;
  dueDate: string | null;
  taskKey: string | null;
  metadata: Record<string, unknown>;
  completed: boolean;
  createdAt: string | null;
};

type RawFieldTask = {
  id?: unknown;
  field_id?: unknown;
  title?: unknown;
  description?: unknown;
  source?: unknown;
  action_target?: unknown;
  priority?: unknown;
  reward_rule_key?: unknown;
  metadata?: unknown;
  due_date?: unknown;
  task_key?: unknown;
  completed?: unknown;
  created_at?: unknown;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

export function resolveTaskRewardPoints(input: {
  taskKey?: unknown;
  source?: unknown;
  actionTarget?: unknown;
  title?: unknown;
  metadata?: unknown;
}) {
  const metadata = metadataObject(input.metadata);
  const explicit = Number(metadata.rewardPoints ?? metadata.reward_points ?? 0);

  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1, Math.round(explicit));
  }

  const taskKey = text(input.taskKey).toLocaleLowerCase('tr-TR');
  const source = text(input.source).toLocaleLowerCase('tr-TR');
  const actionTarget = text(input.actionTarget).toLocaleLowerCase('tr-TR');
  const title = text(input.title).toLocaleLowerCase('tr-TR');

  if (taskKey === 'irrigation-status') return 20;
  if (taskKey === 'canopy-development') return 15;
  if (taskKey === 'canopy-height') return 15;
  if (taskKey === 'model-planting-date') return 10;
  if (taskKey === 'model-crop-variety') return 5;
  if (taskKey === 'model-last-irrigation') return 10;

  if (taskKey === 'irrigation-method') return 15;
  if (taskKey === 'model-surface-water-measurement') return 30;
  if (taskKey.startsWith('model-growth-stage-observation:')) return 20;
  if (taskKey === 'model-last-irrigation-amount') return 15;
  if (taskKey === 'irrigation-synthesis-field-check') return 25;

  if (taskKey === 'notification:soil-analysis') return 150;
  if (taskKey.startsWith('pusula-field-check:')) return 30;
  if (actionTarget === 'field-photo') return 30;

  if (title.includes('toprak analizi')) return 150;
  if (title.includes('fotoğraf')) return 30;
  if (title.includes('nem')) return 25;
  if (title.includes('sulama')) return 15;
  if (title.includes('gelişim evresi')) return 20;

  if (source === 'irrigation_synthesis') return 25;
  if (source === 'model-readiness') return 15;
  if (source === 'field-readiness') return 15;
  if (source === 'pusula' || source === 'notification-task') return 20;

  // Görevlerim ekranına düşen gerçek bir görev asla puansız kalmaz.
  return 10;
}

export function taskNotificationTitle(task: Pick<FieldTask, 'title'>) {
  return text(task.title) || 'Yeni görev';
}

export function taskNotificationMessage(
  task: Pick<FieldTask, 'description' | 'rewardPoints'>,
) {
  const summary = text(task.description)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)[0]
    ?.trim();

  const shortSummary =
    summary && summary.length > 86
      ? `${summary.slice(0, 83).trimEnd()}…`
      : summary;

  return `Yeni görev tanımlandı · +${task.rewardPoints} Pusula Puanı${
    shortSummary ? ` · ${shortSummary}` : ''
  }`;
}

function normalizeTask(row: RawFieldTask): FieldTask {
  const metadata = metadataObject(row.metadata);
  const taskKey = text(row.task_key) || null;
  const source = text(row.source) || 'user';
  const actionTarget = text(row.action_target) || null;
  const title = text(row.title) || 'Görev';
  const points = resolveTaskRewardPoints({
    taskKey,
    source,
    actionTarget,
    title,
    metadata,
  });

  return {
    id: text(row.id),
    fieldId: text(row.field_id),
    title,
    description: text(row.description) || null,
    source,
    actionTarget,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    rewardPoints: points,
    dueDate: text(row.due_date) || null,
    taskKey,
    metadata: {
      ...metadata,
      rewardPoints: points,
    },
    completed: Boolean(row.completed),
    createdAt: text(row.created_at) || null,
  };
}

function emitTasksChanged(fieldId: string) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('tp:tasks-changed', {
      detail: { fieldId },
    }),
  );
}

function linkedTaskId(item: any) {
  const direct = text(item?.task?.id);
  if (direct) return direct;

  const id = text(item?.id);
  if (id.startsWith('task-defined:')) return id.slice('task-defined:'.length);
  if (id.startsWith('task-notice:')) return id.slice('task-notice:'.length);

  return '';
}

function removeTaskNotification(taskIdInput: string) {
  if (typeof window === 'undefined') return;

  const taskId = text(taskIdInput);
  if (!taskId) return;

  try {
    const raw = window.localStorage.getItem(TASK_NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const previous = Array.isArray(parsed) ? parsed : [];

    const next = previous.filter((item: any) => {
      if (!item || typeof item !== 'object') return false;
      return linkedTaskId(item) !== taskId;
    });

    window.localStorage.setItem(
      TASK_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent('tp:notifications-updated', {
        detail: { notifications: next },
      }),
    );
  } catch {
    // Bildirim temizliği başarısız olsa bile görev akışı devam eder.
  }
}

function publishTaskNotifications(tasks: FieldTask[]) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(TASK_NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const previous = Array.isArray(parsed) ? parsed : [];
    const byId = new Map<string, any>();

    /*
     * Görev bildirimleri field_todos'taki aktif görevlerden yeniden kurulur.
     * Böylece bitmiş/gizlenmiş/eski görevin bildirimi listede asılı kalmaz.
     */
    previous.forEach((item: any) => {
      if (!item?.id || item.kind === 'task') return;

      const taskId = linkedTaskId(item);
      const isTaskNotification =
        Boolean(taskId) ||
        item.source === 'task-system' ||
        String(item.id).startsWith('task-defined:') ||
        String(item.id).startsWith('task-notice:');

      if (isTaskNotification) return;
      byId.set(String(item.id), item);
    });

    const nowIso = new Date().toISOString();

    tasks.forEach((task) => {
      if (!task.id) return;

      const notificationId = `task-defined:${task.id}`;
      const existing = previous.find(
        (item: any) => String(item?.id ?? '') === notificationId,
      );
      const createdAt = task.createdAt || existing?.createdAt || nowIso;

      byId.set(notificationId, {
        id: notificationId,
        fieldId: task.fieldId,
        fieldName: existing?.fieldName ?? null,
        source: 'task-system',
        severity: task.priority >= 90 ? 'warning' : 'info',
        title: taskNotificationTitle(task),
        message: taskNotificationMessage(task),
        iconKey: 'task',
        target: 'tasks',
        priority: task.priority,
        kind: 'notification',
        task: {
          id: task.id,
          task_key: task.taskKey,
          action_target: task.actionTarget,
          title: task.title,
          status: 'open',
          reward_points: task.rewardPoints,
        },
        isRead: existing?.isRead ?? false,
        createdAt: existing?.createdAt ?? createdAt,
        updatedAt: nowIso,
      });
    });

    const next = Array.from(byId.values())
      .sort((a: any, b: any) => {
        const at = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const bt = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return bt - at;
      })
      .slice(0, 160);

    window.localStorage.setItem(
      TASK_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent('tp:notifications-updated', {
        detail: { notifications: next },
      }),
    );
  } catch (error) {
    console.warn('[tasks] Yeni görev bildirimi kaydedilemedi:', error);
  }
}

export function syncIrrigationSynthesisVerificationTaskBestEffort(
  fieldIdInput: string,
  synthesis: IrrigationDecisionSynthesis | null | undefined,
) {
  const fieldId = text(fieldIdInput);
  if (!fieldId || !supabase) return;

  void (async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return;

    const taskKey = 'irrigation-synthesis-field-check';
    const { data: existing, error: existingError } = await supabase
      .from('field_todos')
      .select('id,completed,dismissed,metadata')
      .eq('user_id', userData.user.id)
      .eq('field_id', fieldId)
      .eq('task_key', taskKey)
      .maybeSingle();

    if (existingError) throw existingError;

    const existingMetadata = metadataObject(existing?.metadata);
    const isMixed = synthesis?.agreement === 'mixed';

    if (!isMixed) {
      if (existing && !existing.completed && !existing.dismissed) {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('field_todos')
          .update({
            completed: true,
            completed_at: now,
            metadata: {
              ...existingMetadata,
              autoResolved: true,
              autoResolvedAt: now,
              resolution: 'irrigation_models_reconciled',
            },
            updated_at: now,
          })
          .eq('id', existing.id)
          .eq('user_id', userData.user.id);
        if (error) throw error;
        emitTasksChanged(fieldId);
      }
      return;
    }

    if (existing?.dismissed && existingMetadata.suppressSimilarTask === true) return;

    const generatedAt = text(synthesis?.generatedAt) || new Date().toISOString();
    if (
      existing?.completed &&
      text(existingMetadata.synthesisGeneratedAt) === generatedAt
    ) {
      return;
    }

    const now = new Date().toISOString();
    const row = {
      title: 'Sulama Kararını Sahada Doğrula',
      description:
        'Ana sulama önerisi korunuyor; pyfao56 kısa dönem su dengesi ayrıştığı için son sulama kaydını ve tarladaki gerçek koşulları kontrol et.',
      source: 'irrigation_synthesis',
      action_target: 'irrigation_detail',
      priority: 92,
      reward_rule_key: null,
      due_date: null,
      completed: false,
      completed_at: null,
      dismissed: false,
      metadata: {
        synthesisGeneratedAt: generatedAt,
        synthesisAgreement: synthesis?.agreement ?? null,
        synthesisConfidence: synthesis?.confidence ?? null,
        stageLabel: synthesis?.stageLabel ?? null,
        evidence: (synthesis?.evidence ?? []).slice(0, 5),
        warnings: (synthesis?.warnings ?? []).slice(0, 3),
        productionAuthority: false,
        verificationReason: 'model_divergence',
        rewardPoints: 25,
      },
      updated_at: now,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('field_todos')
        .update(row)
        .eq('id', existing.id)
        .eq('user_id', userData.user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('field_todos').insert({
        ...row,
        user_id: userData.user.id,
        field_id: fieldId,
        task_key: taskKey,
      });
      if (error) throw error;
    }

    emitTasksChanged(fieldId);
  })().catch((error: unknown) => {
    console.warn('[tasks] Sulama sentezi saha doğrulama görevi senkronize edilemedi:', error);
  });
}

export function syncIrrigationEvidenceTasksBestEffort(fieldIdInput: string) {
  const fieldId = text(fieldIdInput);
  if (!fieldId || !supabase) return;

  void supabase
    .rpc('tp_sync_irrigation_evidence_tasks', { p_field_id: fieldId })
    .then(({ error }) => {
      if (error) {
        console.warn(
          '[tasks] Sulama kanıtı görevleri senkronize edilemedi:',
          error.message,
        );
        return;
      }

      emitTasksChanged(fieldId);
    })
    .catch((error: unknown) => {
      console.warn(
        '[tasks] Sulama kanıtı görevleri senkronize edilemedi:',
        error,
      );
    });
}

async function synchronizeGeneratedTasks(fieldId: string) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const results = await Promise.allSettled([
    supabase.rpc('tp_sync_field_tasks', { p_field_id: fieldId }),
    supabase.rpc('tp_sync_model_readiness_tasks', { p_field_id: fieldId }),
    supabase.rpc('tp_sync_irrigation_evidence_tasks', {
      p_field_id: fieldId,
    }),
    supabase.rpc('tp_sync_growth_stage_observation_task', {
      p_field_id: fieldId,
    }),
    supabase.rpc('tp_sync_irrigation_amount_task', {
      p_field_id: fieldId,
    }),
    supabase.rpc('tp_refresh_action_tasks', {
      p_field_id: fieldId,
    }),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.error) {
      console.warn(
        '[tasks] Görev senkronizasyonu:',
        result.value.error.message,
      );
    }
  }
}

export async function getFieldTasks(
  fieldId: string,
): Promise<FieldTask[]> {
  const id = text(fieldId);

  if (!id) return [];

  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  await synchronizeGeneratedTasks(id);

  const { data, error } = await supabase
    .from('field_todos')
    .select(
      'id,field_id,title,description,source,action_target,priority,reward_rule_key,metadata,due_date,task_key,completed,created_at',
    )
    .eq('field_id', id)
    .eq('completed', false)
    .eq('dismissed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const now = Date.now();

  const tasks = (data ?? [])
    .map((row) => normalizeTask(row as RawFieldTask))
    .filter((task) => {
      const snoozedUntil = text(task.metadata.snoozedUntil);

      if (snoozedUntil) {
        const until = new Date(snoozedUntil).getTime();
        if (Number.isFinite(until) && until > now) return false;
      }

      return true;
    });

  publishTaskNotifications(tasks);
  return tasks;
}

/**
 * "Şimdi değil"
 *
 * Görev tamamlanmış veya uygunsuz sayılmaz.
 * Sadece belirli bir süre kullanıcının aktif listesinden gizlenir.
 */
export async function snoozeFieldTask(
  task: FieldTask,
  hours = 24,
) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const taskId = text(task.id);

  if (!taskId) {
    throw new Error('Görev kimliği bulunamadı.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error('Görevi ertelemek için oturum gerekli.');
  }

  const safeHours = Math.max(1, hours);

  const snoozedUntil = new Date(
    Date.now() + safeHours * 60 * 60 * 1000,
  ).toISOString();

  const metadata = {
    ...task.metadata,
    snoozedUntil,
    userFeedback: 'snoozed',
    userFeedbackAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('field_todos')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id)
    .select('id,field_id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Görev bulunamadı veya güncellenemedi.');
  }

  removeTaskNotification(taskId);
  emitTasksChanged(text(data.field_id) || task.fieldId);

  return {
    snoozed: true,
    snoozedUntil,
    message: 'Görevi 24 saatliğine gizledim.',
  };
}

/**
 * "Bana uygun değil"
 *
 * Kullanıcının bu görevi yapamayacağını/uygun bulmadığını
 * kalıcı geri bildirim olarak kaydeder.
 *
 * Görev tamamlanmış sayılmaz ve Pusula puanı verilmez.
 */
export async function markFieldTaskUnsuitable(task: FieldTask) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const taskId = text(task.id);

  if (!taskId) {
    throw new Error('Görev kimliği bulunamadı.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error('Görev geri bildirimi için oturum gerekli.');
  }

  const metadata = {
    ...task.metadata,
    userFeedback: 'not_applicable',
    userFeedbackAt: new Date().toISOString(),
    suppressSimilarTask: true,
  };

  const { data, error } = await supabase
    .from('field_todos')
    .update({
      dismissed: true,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id)
    .select('id,field_id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Görev bulunamadı veya güncellenemedi.');
  }

  removeTaskNotification(taskId);
  emitTasksChanged(text(data.field_id) || task.fieldId);

  return {
    dismissed: true,
    message:
      'Bu görevi kaldırdım ve uygun değil geri bildirimini kaydettim.',
  };
}

export async function dismissFieldTask(task: FieldTask) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  const taskId = text(task.id);

  if (!taskId) {
    throw new Error('Görev kimliği bulunamadı.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error('Görevi ertelemek için oturum gerekli.');
  }

  const { data, error } = await supabase
    .from('field_todos')
    .update({
      dismissed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id)
    .select('id,field_id')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Görev bulunamadı veya güncellenemedi.');
  }

  removeTaskNotification(taskId);
  emitTasksChanged(text(data.field_id) || task.fieldId);

  return {
    dismissed: true,
    message:
      'Şimdilik gizledim. İlgili veriyi daha sonra yine ekleyebilirsin.',
  };
}

export async function completeFieldTask(task: FieldTask) {
  if (!supabase) {
    throw new Error('Supabase bağlantısı hazır değil.');
  }

  if (task.taskKey) {
    const actionTask =
      task.taskKey === 'notification:soil-analysis' ||
      task.taskKey.startsWith('pusula-field-check:');

    const { data, error } = await supabase.rpc(
      actionTask
        ? 'tp_complete_action_task'
        : 'tp_complete_field_task',
      {
        p_task_id: task.id,
      },
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    const completed = Boolean(
      (result as any)?.completed,
    );

    if (!completed) {
      return {
        completed: false,
        message:
          (result as any)?.reason === 'completion_not_verified'
            ? 'Bu görev, ilgili bilgiyi gerçekten tamamladığında otomatik kapanacak.'
            : 'Görev henüz tamamlanmış görünmüyor.',
      };
    }

    removeTaskNotification(task.id);
    emitTasksChanged(task.fieldId);

    const awardedPoints = Number(
      (result as any)?.awarded_points ?? 0,
    );

    return {
      completed: true,
      awardedPoints,
      message:
        awardedPoints > 0
          ? `+${awardedPoints} Pusula kazandın.`
          : 'Görev tamamlandı.',
    };
  }

  const { error } = await supabase
    .from('field_todos')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id);

  if (error) throw error;

  removeTaskNotification(task.id);
  emitTasksChanged(task.fieldId);

  return {
    completed: true,
    awardedPoints: 0,
    message: 'Görev tamamlandı.',
  };
}