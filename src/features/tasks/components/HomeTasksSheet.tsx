import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ListTodo,
  RefreshCw,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFieldTasks } from '../hooks/useFieldTasks';
import type { FieldTask } from '../services/fieldTasks.service';
import './HomeTasksSheet.css';

type Props = {
  open: boolean;
  fieldId: string;
  fieldName: string;
  onClose: () => void;
  onAction: (task: FieldTask) => void;
};

const WATER_MEASUREMENT_FOCUS_KEY = 'tp_focus_field_water_measurement';

function sourceLabel(source: string) {
  if (source === 'pusula-experiment') return 'PUSULA DENEYİ';

  if (
    source === 'field-readiness' ||
    source === 'model-readiness' ||
    source === 'irrigation_synthesis' ||
    source === 'notification-task'
  ) {
    return 'PUSULA GÖREVİ';
  }

  if (source === 'pusula') return 'PUSULA';
  return 'GÖREV';
}

function priorityLabel(priority: number) {
  if (priority >= 90) return 'ÖNCELİKLİ';
  if (priority >= 70) return 'ÖNEMLİ';
  return null;
}

function isGrowthStageObservationTask(task: FieldTask) {
  return (
    task.actionTarget === 'field-growth' ||
    String(task.taskKey ?? '').startsWith('pusula-experiment-growth-stage:')
  );
}

function isPhotoCheckTask(task: FieldTask) {
  if (isGrowthStageObservationTask(task)) return false;

  const haystack = `${task.title} ${task.description ?? ''} ${task.actionTarget ?? ''}`
    .toLocaleLowerCase('tr-TR');

  return (
    haystack.includes('kontrol et') &&
    (
      haystack.includes('bölüm') ||
      haystack.includes('pusula önerisini') ||
      haystack.includes('gelişim') ||
      haystack.includes('nem') ||
      haystack.includes('drenaj') ||
      haystack.includes('drain') ||
      haystack.includes('observation') ||
      haystack.includes('photo')
    )
  );
}

function isIrrigationMethodTask(task: FieldTask) {
  return (
    task.taskKey === 'irrigation-method' ||
    task.actionTarget === 'field-irrigation-method'
  );
}

function isSurfaceWaterMeasurementTask(task: FieldTask) {
  return (
    task.taskKey === 'model-surface-water-measurement' ||
    task.actionTarget === 'field-water-measurement'
  );
}

function taskTitle(task: FieldTask) {
  if (!isPhotoCheckTask(task)) return task.title;
  if (task.title.toLocaleLowerCase('tr-TR').includes('fotoğraf yükle')) {
    return task.title;
  }

  return task.title.replace(/kontrol et/i, 'kontrol et ve fotoğraf yükle');
}

function actionLabel(task: FieldTask) {
  if (isIrrigationMethodTask(task)) return "Pusula'ya cevap ver";
  if (isSurfaceWaterMeasurementTask(task)) return 'Ölçümü ekle';
  if (isGrowthStageObservationTask(task)) return 'Gözlemi kaydet';
  return isPhotoCheckTask(task) ? 'Kontrol et ve fotoğraf yükle' : 'Göreve git';
}

function compactDescription(task: FieldTask) {
  const value = String(task.description ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return null;

  const firstSentence = value.split(/(?<=[.!?])\s+/)[0]?.trim() || value;
  return firstSentence.length > 86
    ? `${firstSentence.slice(0, 83).trimEnd()}…`
    : firstSentence;
}

function scrollToPusulaQuestion(attempt = 0) {
  const node = document.querySelector('.tp-pusula-question') as HTMLElement | null;
  if (node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (attempt < 5) {
    window.setTimeout(() => scrollToPusulaQuestion(attempt + 1), 140);
  }
}

function openProductionTab(attempt = 0) {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.tp-field-detail-tabs button'),
  );
  const production = buttons.find(
    (button) => button.textContent?.trim().toLocaleLowerCase('tr-TR') === 'üretim',
  );

  if (production) {
    production.click();
    return;
  }

  if (attempt < 7) {
    window.setTimeout(() => openProductionTab(attempt + 1), 120);
  }
}

function markWaterMeasurementFocus(fieldId: string) {
  try {
    window.sessionStorage.setItem(
      WATER_MEASUREMENT_FOCUS_KEY,
      JSON.stringify({ fieldId, createdAt: Date.now() }),
    );
  } catch {
    // sessionStorage kapalıysa normal tarla detayı yönlendirmesi yine çalışır.
  }
}

export default function HomeTasksSheet({
  open,
  fieldId,
  fieldName,
  onClose,
  onAction,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const { tasks, loading, error, message, refresh, complete, dismiss } =
    useFieldTasks(fieldId, open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) setExpandedTaskId(null);
  }, [open]);

  useEffect(() => {
    if (
      expandedTaskId &&
      !tasks.some((task) => task.id === expandedTaskId)
    ) {
      setExpandedTaskId(null);
    }
  }, [expandedTaskId, tasks]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const openTask = (task: FieldTask) => {
    if (isIrrigationMethodTask(task)) {
      close();
      window.setTimeout(() => scrollToPusulaQuestion(), 80);
      return;
    }

    if (isSurfaceWaterMeasurementTask(task)) {
      markWaterMeasurementFocus(task.fieldId || fieldId);
      close();
      onAction(task);
      window.setTimeout(() => openProductionTab(), 100);
      return;
    }

    close();
    onAction(task);
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="tp-home-tasks-sheet"
      aria-label="Görevlerim"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="tp-home-tasks-handle" aria-hidden="true" />

      <header className="tp-home-tasks-head">
        <span className="tp-home-tasks-head-icon" aria-hidden="true">
          <ListTodo size={20} />
        </span>

        <div>
          <small>{fieldName || 'Tarlan'}</small>
          <h2>Görevlerim</h2>
        </div>

        <span className="tp-home-tasks-count">{tasks.length}</span>

        <button
          type="button"
          className="tp-home-tasks-close"
          onClick={close}
          aria-label="Kapat"
        >
          <X size={20} />
        </button>
      </header>

      <div className="tp-home-tasks-intro">
        <p>
          {tasks.length
            ? `${tasks.length} açık görev var. Detay için göreve dokun.`
            : 'Yeni görev oluştuğunda burada görünecek.'}
        </p>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'is-spinning' : ''} />
          Yenile
        </button>
      </div>

      {message ? <p className="tp-home-tasks-message">{message}</p> : null}
      {error ? <p className="tp-home-tasks-error">{error}</p> : null}

      <div className="tp-home-tasks-list">
        {loading && !tasks.length ? (
          <div className="tp-home-tasks-empty">Görevlerin hazırlanıyor…</div>
        ) : tasks.length ? (
          tasks.map((task) => {
            const priority = priorityLabel(task.priority);
            const expanded = expandedTaskId === task.id;
            const preview = compactDescription(task);

            return (
              <article
                className={`tp-home-task-card${expanded ? ' is-expanded' : ''}`}
                key={task.id}
              >
                <button
                  type="button"
                  className="tp-home-task-summary"
                  aria-expanded={expanded}
                  aria-controls={`task-detail-${task.id}`}
                  onClick={() =>
                    setExpandedTaskId((current) =>
                      current === task.id ? null : task.id,
                    )
                  }
                >
                  <span className="tp-home-task-main">
                    <span className="tp-home-task-eyebrow">
                      {sourceLabel(task.source)}
                      {priority ? <b>{priority}</b> : null}
                    </span>
                    <strong>{taskTitle(task)}</strong>
                    {!expanded && preview ? <small>{preview}</small> : null}
                  </span>

                  <span className="tp-home-task-side">
                    <em>+{task.rewardPoints} P</em>
                    <ChevronDown
                      className="tp-home-task-chevron"
                      size={17}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {expanded ? (
                  <div
                    id={`task-detail-${task.id}`}
                    className="tp-home-task-detail"
                  >
                    {isPhotoCheckTask(task) ? (
                      <div className="tp-home-task-photo-hint" aria-hidden="true">
                        Fotoğraf yükle
                      </div>
                    ) : null}

                    {task.description ? <p>{task.description}</p> : null}

                    <div className="tp-home-task-actions">
                      <button
                        type="button"
                        className="tp-home-task-later"
                        onClick={() => void dismiss(task)}
                      >
                        <Clock3 size={14} />
                        Şimdi değil
                      </button>

                      {task.actionTarget ? (
                        <button
                          type="button"
                          className={`tp-home-task-open ${
                            isPhotoCheckTask(task) ? 'is-photo-action' : ''
                          }`}
                          onClick={() => openTask(task)}
                        >
                          {actionLabel(task)}
                          <ChevronRight size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tp-home-task-complete"
                          onClick={() => void complete(task)}
                        >
                          <Check size={15} />
                          Tamamlandı
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="tp-home-tasks-empty">
            <Check size={24} />
            <strong>Şimdilik görev yok</strong>
            <span>Pusula yeni bir ihtiyaç tespit ettiğinde görev burada görünecek.</span>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
