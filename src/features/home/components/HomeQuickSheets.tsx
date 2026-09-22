import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  CalendarDays,
  ChevronDown,
  Clock3,
  CloudSun,
  Compass,
  Droplets,
  FlaskConical,
  Leaf,
  MapPin,
  MoreHorizontal,
  OctagonX,
  Radar,
  Satellite,
  Sprout,
  Wind,
  X,
} from 'lucide-react';

import type {
  HomeDecisionConfidence,
  HomeDecisionSource,
  HomeSystemNotification,
  HomeTodayDecision,
} from '../../decision/types/homeDecision';
import {
  markFieldTaskUnsuitable,
  snoozeFieldTask,
  type FieldTask,
} from '../../tasks/services/fieldTasks.service';
import type { IrrigationDecisionResult } from '../../irrigation/types/irrigationDecision';
import type { IrrigationWhatIfResult } from '../../irrigation/services/irrigationWhatIf.service';
import { buildRainfedTodaySummary } from '../../irrigation/services/rainfedTodaySummary';
import { saveFieldIrrigationStatus } from '../../fields/services/fieldCompletion.service';
import {
  saveFieldIrrigationMethod,
  type FieldIrrigationMethod,
} from '../../fields/services/irrigationMethod.service';
import {
  saveFieldCrop,
  saveFieldPlantingYear,
} from '../../fields/services/fieldProfileCompletion.service';
import { createFieldOperation } from '../../field-operations/services/fieldOperation.service';

import './HomeQuickSheets.css';
import './HomeTodayDecisionSystem.css';

type Props = {
  active: 'today' | 'notifications' | null;
  onClose: () => void;
  decisions: HomeTodayDecision[];
  sprayWeather?: { title: string; detail: string } | null;
  notifications: HomeSystemNotification[];
  tasks?: FieldTask[];
  fieldName?: string;
  irrigationDecision?: IrrigationDecisionResult | null;
  irrigationWhatIf?: IrrigationWhatIfResult | null;
  onOpenDecision: (
    target: HomeTodayDecision['target'],
    context?: { observationPointId?: string | null; source?: string | null },
  ) => void;
  onOpenNotifications: () => void;
  onOpenTask?: (task: FieldTask) => void;
};

type TodayDecisionKind = 'do' | 'avoid' | 'check' | 'upcoming' | 'data';
type MissingInfoKind =
  | 'irrigation-status'
  | 'irrigation-method'
  | 'last-irrigation'
  | 'season-profile'
  | 'soil-analysis';

type TodayDecisionKindMeta = {
  label: string;
  helper: string;
};

const TODAY_KIND_META: Record<TodayDecisionKind, TodayDecisionKindMeta> = {
  do: { label: 'YAP', helper: 'Bugün uygulanabilir karar' },
  avoid: {
    label: 'YAPMA',
    helper: 'Bugün kaçınılması veya ertelenmesi gereken işlem',
  },
  check: {
    label: 'KONTROL ET',
    helper: 'Sahadan veya ilgili detay ekranından doğrula',
  },
  upcoming: {
    label: 'YAKLAŞIYOR',
    helper: 'Yaklaşan görev veya zaman penceresi',
  },
  data: {
    label: 'BİLGİ EKSİK',
    helper: 'Kararı güçlendirmek için bir kayıt gerekiyor',
  },
};


function TodayDecisionIcon({ decision }: { decision: HomeTodayDecision }) {
  const common = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const;

  if (decision.id === 'spray-weather:today') {
    return <Wind {...common} />;
  }

  switch (decision.source) {
    case 'risk-radar':
      return <Radar {...common} />;
    case 'pusula':
      return <Compass {...common} />;
    case 'irrigation':
      return <Droplets {...common} />;
    case 'weather':
      return <CloudSun {...common} />;
    case 'calendar':
      return <CalendarDays {...common} />;
    case 'satellite':
      return <Satellite {...common} />;
    case 'phenology':
      return <Sprout {...common} />;
    case 'nutrition':
      return <FlaskConical {...common} />;
    case 'field':
      return <MapPin {...common} />;
    case 'operation':
      return <ClipboardList {...common} />;
    default:
      return decision.iconClass === 'water'
        ? <Droplets {...common} />
        : <Leaf {...common} />;
  }
}

const SOURCE_META: Record<
  HomeDecisionSource,
  { label: string; basis: string }
> = {
  field: {
    label: 'Tarla profili',
    basis: 'Tarlaya kayıtlı ürün, sezon veya profil bilgisi kullanılıyor.',
  },
  weather: {
    label: 'Hava tahmini',
    basis: 'Tarlaya ait güncel hava ve saatlik tahmin koşulları kullanılıyor.',
  },
  calendar: {
    label: 'Takvim kaydı',
    basis: 'Kullanıcının kayıtlı tarla takvimi ve yaklaşan görev zamanı kullanılıyor.',
  },
  satellite: {
    label: 'Uydu gözlemi',
    basis: 'Uydu gözlemleri, veri tarihi ve varsa geçmiş değişim bilgisi kullanılıyor.',
  },
  pusula: {
    label: 'Pusula sentezi',
    basis: 'Tarla bağlamı ve mevcut analizlerin birleşik Pusula değerlendirmesi kullanılıyor.',
  },
  'risk-radar': {
    label: 'Risk radarı',
    basis: 'Mevcut risk sinyalleri birlikte değerlendirilerek ön kontrol üretiliyor.',
  },
  irrigation: {
    label: 'Sulama modeli',
    basis: 'Su dengesi, yağış ve kayıtlı sulama bağlamı birlikte değerlendiriliyor.',
  },
  phenology: {
    label: 'Gelişim evresi',
    basis: 'Ürünün mevcut gelişim evresi karar bağlamı olarak kullanılıyor.',
  },
  operation: {
    label: 'Tarla işlem kaydı',
    basis: 'Kullanıcının kaydettiği son tarla işlemi kararın güncelliğinde kullanılıyor.',
  },
  nutrition: {
    label: 'Toprak analizi',
    basis: 'Bu tarlaya ait laboratuvar/toprak analizinin varlığı ve rapor durumu kullanılıyor.',
  },
};

const CONFIDENCE_META: Record<
  HomeDecisionConfidence,
  { label: string; explanation: string }
> = {
  strong: {
    label: 'Güçlü veri',
    explanation: 'Birden fazla somut veri veya hesap aynı kararı destekliyor.',
  },
  medium: {
    label: 'Orta',
    explanation: 'Güncel bir veri kaynağı var; saha bağlamı kararı daha da güçlendirebilir.',
  },
  preliminary: {
    label: 'Ön kontrol',
    explanation: 'Veri eksik, hazırlanıyor veya sahadan doğrulama gerekiyor.',
  },
};

const IRRIGATION_METHOD_OPTIONS: Array<{
  value: FieldIrrigationMethod;
  label: string;
}> = [
  { value: 'trickle', label: 'Damlama' },
  { value: 'sprinkler', label: 'Yağmurlama' },
  { value: 'basin', label: 'Tava / göllendirme' },
  { value: 'border', label: 'Şerit / salma' },
  { value: 'furrow_every_narrow', label: 'Karık · dar yatak' },
  { value: 'furrow_every_wide', label: 'Karık · geniş yatak' },
  { value: 'furrow_alternating', label: 'Dönüşümlü karık' },
  { value: 'unknown', label: 'Bilmiyorum' },
];

function decisionSearchText(decision: HomeTodayDecision) {
  const evidence = (decision.evidence ?? []).join(' ');
  return `${decision.id} ${decision.label} ${decision.title} ${decision.detail} ${evidence}`
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDecisionKind(decision: HomeTodayDecision): TodayDecisionKind {
  if (decision.kind) return decision.kind;
  const text = decisionSearchText(decision);

  if (
    text.includes('needs-data') ||
    /(bilgi eksik|veri.+tamamla|veriyi tamamla|kaydını ekle|kayıt gerekiyor|eksik veri)/i.test(text)
  ) {
    return 'data';
  }

  if (
    text.includes('calendar') ||
    text.includes('takvim') ||
    /(yaklaşıyor|yaklaşan görev|yarın)/i.test(text)
  ) {
    return 'upcoming';
  }

  if (
    /(bugün bekle|yağışı bekle|işlem yapma|sulama bekleyebilir|uygun değil|kaçın|ertele|hasat tamamlandı)/i.test(text)
  ) {
    return 'avoid';
  }

  if (
    /(kontrol et|risk|anomali|zayıf|uydu|ndvi|pusula|stres|takip et|gözlem)/i.test(text)
  ) {
    return 'check';
  }

  return 'do';
}

function inferDecisionSource(
  decision: HomeTodayDecision,
): HomeDecisionSource | undefined {
  if (decision.source) return decision.source;

  const id = decision.id.toLocaleLowerCase('tr-TR');
  const text = decisionSearchText(decision);

  if (id.startsWith('irrigation:')) return 'irrigation';
  if (id.startsWith('satellite:')) return 'satellite';
  if (id.startsWith('phenology:')) return 'phenology';
  if (id.startsWith('nutrition:')) return 'nutrition';
  if (id.startsWith('calendar:')) return 'calendar';
  if (id.startsWith('pusula:')) return 'pusula';
  if (id.startsWith('risk:') || id.includes('risk-radar')) return 'risk-radar';
  if (id.startsWith('operation:')) return 'operation';
  if (id.startsWith('field:')) return 'field';
  if (id.startsWith('weather:')) return 'weather';
  if (id === 'spray-weather:today') {
    return text.includes('hasat') ? 'phenology' : 'weather';
  }

  return undefined;
}

function resolveDecisionConfidence(
  decision: HomeTodayDecision,
  kind: TodayDecisionKind,
): HomeDecisionConfidence {
  if (decision.confidence) return decision.confidence;

  const source = inferDecisionSource(decision);
  const evidenceCount = decision.evidence?.filter(Boolean).length ?? 0;
  const text = decisionSearchText(decision);

  if (
    kind === 'data' ||
    /(veri bekleniyor|hazırlanıyor|henüz|sahada kontrol|doğrula)/i.test(text)
  ) {
    return 'preliminary';
  }

  if (evidenceCount >= 2) return 'strong';

  if (
    source === 'irrigation' &&
    !/(loading|needs-data|status)/i.test(decision.id)
  ) {
    return 'strong';
  }

  if (evidenceCount >= 1 || source) return 'medium';
  return 'preliminary';
}

function resolveMissingInfoKind(
  decision: HomeTodayDecision,
  kind: TodayDecisionKind,
): MissingInfoKind | null {
  if (kind !== 'data') return null;
  if (decision.missingInfoKind) return decision.missingInfoKind;
  const text = decisionSearchText(decision);

  if (/(son sulama|last_irrigation)/i.test(text)) return 'last-irrigation';
  if (/(sulama yöntemi|irrigation-method)/i.test(text)) return 'irrigation-method';
  if (/(sulu\s*\/\s*susuz|sulama durumu|irrigation-status)/i.test(text)) {
    return 'irrigation-status';
  }
  if (/(toprak analizi|laboratuvar analizi)/i.test(text)) return 'soil-analysis';
  if (/(ürün bilgisi|gelişim evresi|sezon|ekim|dikim)/i.test(text)) {
    return 'season-profile';
  }

  return null;
}

function decisionFieldId(decision: HomeTodayDecision): string | null {
  const semanticFieldId = String(decision.fieldId ?? '').trim();
  if (semanticFieldId) return semanticFieldId;
  const candidate = String(decision.id.split(':')[1] ?? '').trim();
  if (!candidate || candidate === 'home' || candidate === 'today') return null;
  return candidate;
}

function isNdviAnomalyDecision(decision: HomeTodayDecision | null) {
  return Boolean(
    decision &&
      decision.target === 'map_vegetation' &&
      (decision.id.includes(':ndvi-negative-anomaly:') ||
        decision.id.includes(':ndvi-follow-up:')),

  );
}

function isWorseningNdviFollowUpDecision(decision: HomeTodayDecision | null) {
  return Boolean(
    decision &&
      decision.id.includes(':ndvi-follow-up:') &&
      decision.id.endsWith(':worsening'),
  );
}

function ndviFollowUpPointId(decision: HomeTodayDecision | null) {
  if (!decision) return null;
  const marker = ':ndvi-follow-up:';
  const markerIndex = decision.id.indexOf(marker);
  if (markerIndex < 0) return null;
  return String(decision.id.slice(markerIndex + marker.length).split(':')[0] ?? '').trim() || null;
}

function localIsoDate() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function decisionActionLabel(
  decision: HomeTodayDecision,
  kind: TodayDecisionKind,
  missingKind: MissingInfoKind | null,
) {
  if (missingKind === 'soil-analysis') return 'Analiz ekle';
  if (missingKind === 'last-irrigation') return 'Son sulamayı ekle';
  if (missingKind) return 'Şimdi tamamla';
  if (decision.target === 'map_vegetation') return 'Haritada kontrol et';
  if (decision.target === 'calendar') return 'Takvimi aç';
  if (decision.target === 'spray_weather') return 'Saatleri gör';
  if (decision.target === 'irrigation_detail') return 'Sulama detayını aç';
  if (decision.target === 'soil') return 'Toprak detayını aç';
  if (decision.target === 'ai') return 'Pusula detayını aç';
  if (kind === 'data') return 'Bilgiyi tamamla';
  if (kind === 'check') return 'Kontrol ekranını aç';
  return 'Detayına git';
}

export default function HomeQuickSheets({
  active,
  onClose,
  decisions,
  sprayWeather,
  notifications,
  tasks = [],
  fieldName,
  irrigationDecision,
  irrigationWhatIf,
  onOpenDecision,
  onOpenNotifications,
  onOpenTask,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastActiveRef = useRef<'today' | 'notifications'>('today');
  const [selectedDecision, setSelectedDecision] = useState<HomeTodayDecision | null>(null);
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [taskActionId, setTaskActionId] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [completedDecisionIds, setCompletedDecisionIds] = useState<Set<string>>(() => new Set());
  const [missingFormOpen, setMissingFormOpen] = useState(false);
  const [missingSaving, setMissingSaving] = useState(false);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [missingSuccess, setMissingSuccess] = useState<string | null>(null);
  const [missingDate, setMissingDate] = useState(localIsoDate);
  const [missingCrop, setMissingCrop] = useState('');
  const [missingYear, setMissingYear] = useState('');
  const [missingMethod, setMissingMethod] = useState<FieldIrrigationMethod>('trickle');

  const sprayDecision: HomeTodayDecision | null = sprayWeather
    ? {
        id: 'spray-weather:today',
        group: 'spraying',
        priority: 1000,
        visual: 'spraying',
        tone: 'neutral',
        target: 'spray_weather',
        iconClass: 'leaf',
        iconSrc: '',
        label: 'İLAÇLAMA HAVASI',
        title: sprayWeather.title,
        detail: sprayWeather.detail,
      }
    : null;

  const todayDecisions = useMemo(() => {
    const source = sprayDecision
      ? [
          sprayDecision,
          ...decisions.filter((decision) => decision.target !== 'spray_weather'),
        ]
      : decisions;

    return source
      .filter((decision) => !completedDecisionIds.has(decision.id))
      .slice(0, 5);
  }, [sprayDecision, decisions, completedDecisionIds]);

  const currentDecision =
    selectedDecision?.id === sprayDecision?.id ? sprayDecision : selectedDecision;
  const currentKind = currentDecision ? resolveDecisionKind(currentDecision) : null;
  const currentSource = currentDecision ? inferDecisionSource(currentDecision) : undefined;
  const currentConfidence = currentDecision && currentKind
    ? resolveDecisionConfidence(currentDecision, currentKind)
    : null;
  const currentMissingKind = currentDecision && currentKind
    ? resolveMissingInfoKind(currentDecision, currentKind)
    : null;
  const currentFieldId = currentDecision ? decisionFieldId(currentDecision) : null;
  const currentIsNdviAnomaly = isNdviAnomalyDecision(currentDecision);
  const currentIsWorseningNdviFollowUp =
    isWorseningNdviFollowUpDecision(currentDecision);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active) lastActiveRef.current = active;
    if (active && !dialog?.open) dialog?.showModal();
    if (!active && dialog?.open) dialog.close();

    if (!active) {
      setSelectedDecision(null);
      setTaskMenuId(null);
      setExpandedNotificationId(null);
      setTaskMessage(null);
      setMissingFormOpen(false);
      setMissingError(null);
      setMissingSuccess(null);
    }
  }, [active]);

  useEffect(() => {
    setMissingFormOpen(false);
    setMissingSaving(false);
    setMissingError(null);
    setMissingSuccess(null);
    setMissingDate(localIsoDate());
    setMissingCrop('');
    setMissingYear('');
    setMissingMethod('trickle');
  }, [currentDecision?.id]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const openNdviAnomalyPhoto = () => {
    if (!currentDecision || !currentFieldId || typeof window === 'undefined') return;

    const fieldId = currentFieldId;
    const decisionId = currentDecision.id;

    close();
    onOpenDecision('map_vegetation');

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('tp:home-map-show-pusula-area', {
          detail: {
            fieldId,
            layer: 'vegetation',
            openPhoto: true,
            source: currentDecision.id.includes(':ndvi-follow-up:')
              ? 'ndvi_follow_up'
              : 'ndvi_anomaly',
            decisionId,
            importantArea:
              (currentDecision.task?.metadata?.importantArea as
                | { area?: unknown; geometry?: unknown }
                | undefined) ?? { area: 'Tarla geneli' },
          },
        }),
      );

      document
        .querySelector('.tp-map-stage')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 220);
  };

  const rainfed =
    currentDecision?.id.startsWith('irrigation:') && irrigationDecision
      ? buildRainfedTodaySummary(irrigationDecision)
      : null;

  const informationNotifications = notifications.filter((item) => !item.task);
  const visibleTasks = tasks.slice(0, 4);

  const finishMissingSave = (reload = false) => {
    if (!currentDecision) return;
    setMissingSuccess('Kaydedildi. Bugünkü kararlar yenileniyor.');
    setCompletedDecisionIds((current) => {
      const next = new Set(current);
      next.add(currentDecision.id);
      return next;
    });

    if (reload && typeof window !== 'undefined') {
      window.setTimeout(() => window.location.reload(), 450);
    } else {
      window.setTimeout(() => setSelectedDecision(null), 450);
    }
  };

  const saveIrrigationStatus = async (value: 'sulu' | 'susuz' | 'kısmi') => {
    if (!currentFieldId || missingSaving) return;
    setMissingSaving(true);
    setMissingError(null);
    try {
      await saveFieldIrrigationStatus({ fieldId: currentFieldId, irrigationStatus: value });
      finishMissingSave();
    } catch (error) {
      setMissingError(error instanceof Error ? error.message : 'Sulama durumu kaydedilemedi.');
    } finally {
      setMissingSaving(false);
    }
  };

  const saveIrrigationMethod = async () => {
    if (!currentFieldId || missingSaving) return;
    setMissingSaving(true);
    setMissingError(null);
    try {
      await saveFieldIrrigationMethod({ fieldId: currentFieldId, irrigationMethod: missingMethod });
      finishMissingSave();
    } catch (error) {
      setMissingError(error instanceof Error ? error.message : 'Sulama yöntemi kaydedilemedi.');
    } finally {
      setMissingSaving(false);
    }
  };

  const saveLastIrrigation = async () => {
    if (!currentFieldId || missingSaving) return;
    if (!missingDate) {
      setMissingError('Son sulama tarihini seç.');
      return;
    }
    setMissingSaving(true);
    setMissingError(null);
    try {
      await createFieldOperation({
        fieldId: currentFieldId,
        type: 'Sulama',
        date: missingDate,
        notes: 'Bugün ekranındaki eksik bilgi akışından kaydedildi.',
      });
      finishMissingSave();
    } catch (error) {
      setMissingError(error instanceof Error ? error.message : 'Son sulama kaydedilemedi.');
    } finally {
      setMissingSaving(false);
    }
  };

  const saveSeasonProfile = async () => {
    if (!currentFieldId || missingSaving) return;
    const crop = missingCrop.trim();
    const yearText = missingYear.trim();
    if (!crop && !yearText) {
      setMissingError('Ürün adını veya ekim / dikim yılını gir.');
      return;
    }

    setMissingSaving(true);
    setMissingError(null);
    try {
      if (crop) await saveFieldCrop({ fieldId: currentFieldId, crop });
      if (yearText) {
        await saveFieldPlantingYear({
          fieldId: currentFieldId,
          plantingYear: Number(yearText),
        });
      }
      finishMissingSave(true);
    } catch (error) {
      setMissingError(error instanceof Error ? error.message : 'Tarla bilgisi kaydedilemedi.');
    } finally {
      setMissingSaving(false);
    }
  };

  const snoozeTask = async (task: FieldTask) => {
    setTaskActionId(task.id);
    setTaskMessage(null);
    try {
      const result = await snoozeFieldTask(task, 24);
      setTaskMessage(result.message);
      setTaskMenuId(null);
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Görev ertelenemedi.');
    } finally {
      setTaskActionId(null);
    }
  };

  const markUnsuitable = async (task: FieldTask) => {
    setTaskActionId(task.id);
    setTaskMessage(null);
    try {
      const result = await markFieldTaskUnsuitable(task);
      setTaskMessage(result.message);
      setTaskMenuId(null);
    } catch (error) {
      setTaskMessage(error instanceof Error ? error.message : 'Görev kaldırılamadı.');
    } finally {
      setTaskActionId(null);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="tp-home-quick-sheet"
      aria-label={active === 'notifications' ? 'Bildirimler' : 'Bugün ne yapmalısın?'}
      onClose={() => {
        onClose();
        document
          .querySelector<HTMLButtonElement>(
            lastActiveRef.current === 'notifications'
              ? '.tp-mf-quick-notifications'
              : '.tp-mf-quick-today',
          )
          ?.focus();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="tp-home-quick-sheet-head">
        {selectedDecision && active === 'today' ? (
          <button
            type="button"
            className="tp-home-quick-back"
            onClick={() => setSelectedDecision(null)}
            aria-label="Bugünün listesine dön"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        ) : (
          <span className="tp-home-quick-sheet-icon" aria-hidden="true">
            {active === 'notifications' ? <Bell size={21} /> : <ClipboardList size={21} />}
          </span>
        )}

        <div>
          <small>
            {active === 'today'
              ? currentKind
                ? `${fieldName || 'Tarlan'} · ${TODAY_KIND_META[currentKind].label}`
                : `${fieldName || 'Tarlan'} · ${todayDecisions.length} karar`
              : fieldName || 'Tarlan'}
          </small>
          <h2>
            {active === 'notifications'
              ? 'Bildirimler'
              : currentDecision
                ? currentDecision.title
                : 'Bugün Ne Yapmalısın?'}
          </h2>
        </div>

        <button
          type="button"
          className="tp-home-quick-close"
          aria-label="Pencereyi kapat"
          onClick={close}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>

      {active === 'today' && !selectedDecision && (
        <div className="tp-home-quick-list tp-home-today-decision-list">
          {todayDecisions.length ? (
            todayDecisions.map((decision) => {
              const kind = resolveDecisionKind(decision);
              const kindMeta = TODAY_KIND_META[kind];
              return (
                <button
                  key={decision.id}
                  type="button"
                  className={`tp-home-quick-item tp-home-today-decision kind-${kind}`}
                  onClick={() => setSelectedDecision(decision)}
                >
                  <span className="tp-home-quick-decision-icon" aria-hidden="true">
                    <TodayDecisionIcon decision={decision} />
                  </span>
                  <span>
                    <span className="tp-home-today-decision-meta">
                      <b className={`tp-home-today-kind kind-${kind}`}>{kindMeta.label}</b>
                      <small>{decision.label}</small>
                    </span>
                    <strong>{decision.title}</strong>
                    <span className="tp-home-quick-description">{decision.detail}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              );
            })
          ) : (
            <p className="tp-home-quick-empty">
              Bugün için yeni bir öneri yok. Tarlandaki gelişmeleri burada göreceksin.
            </p>
          )}
        </div>
      )}

      {active === 'today' && currentDecision && currentKind && (
        <div className="tp-home-quick-detail tp-home-today-decision-detail">
          <div className="tp-home-today-detail-status">
            <b className={`tp-home-today-kind kind-${currentKind}`}>
              {TODAY_KIND_META[currentKind].label}
            </b>
            <span>{currentDecision.label}</span>
          </div>

          <p className="tp-home-today-kind-helper">{TODAY_KIND_META[currentKind].helper}</p>

          {rainfed ? (
            <>
              <p><strong>Genel durum:</strong>{' '}{rainfed.generalStatus}</p>
              <dl>
                {rainfed.rows.map(({ label, text }) => (
                  <div key={label}><dt>{label}</dt><dd>{text}</dd></div>
                ))}
              </dl>
              <p><strong>Özet:</strong> {rainfed.conclusion}</p>
              <small>
                Bu yağış ve tahmini su ihtiyacı farkıdır; ölçülmüş toprak nemi ya da sulama miktarı değildir.
              </small>
            </>
          ) : (
            <p>{currentDecision.detail}</p>
          )}

          {currentDecision.target === 'irrigation_detail' && irrigationWhatIf ? (
            <section className="tp-home-today-evidence" aria-label="Sulama senaryosu">
              <div className="tp-home-today-evidence-head">
                <small>SULAMA SENARYOSU</small>
                <b className={irrigationWhatIf.status === 'ready' ? 'confidence-strong' : 'confidence-preliminary'}>
                  {irrigationWhatIf.status === 'ready' ? '2 günlük karşılaştırma' : 'Veri bekleniyor'}
                </b>
              </div>
              {irrigationWhatIf.status === 'ready' ? (
                <>
                  <strong>Bugün sularsam ↔ 2 gün beklersem</strong>
                  <p>
                    Bugün sularsam 2 gün sonraki tahmini su açığı {Number(irrigationWhatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.irrigateToday ?? 0).toFixed(1)} mm;
                    2 gün beklersem {Number(irrigationWhatIf.metrics.find((item) => item.key === 'deficit_after_2d')?.waitTwoDays ?? 0).toFixed(1)} mm.
                  </p>
                  <small className="tp-home-today-evidence-note">
                    Senaryo, production sulama motorunun gerçek NET önerisini kullanır; yeni hava değeri uydurmaz.
                  </small>
                </>
              ) : (
                <>
                  <strong>Senaryo için gerçek veri tamamlanıyor</strong>
                  <p>{irrigationWhatIf.missing.length ? irrigationWhatIf.missing.join(', ') : 'Sulama motoru sonucu bekleniyor.'}</p>
                </>
              )}
            </section>
          ) : null}

          {currentConfidence && (
            <section className="tp-home-today-evidence" aria-label="Kararın dayanağı">
              <div className="tp-home-today-evidence-head">
                <small>NEYE DAYANIYOR?</small>
                <b className={`confidence-${currentConfidence}`}>
                  {CONFIDENCE_META[currentConfidence].label}
                </b>
              </div>
              <strong>{currentSource ? SOURCE_META[currentSource].label : 'Karar bağlamı'}</strong>
              <p>
                {currentSource
                  ? SOURCE_META[currentSource].basis
                  : CONFIDENCE_META[currentConfidence].explanation}
              </p>
              {currentDecision.evidence?.length ? (
                <ul>
                  {currentDecision.evidence.slice(0, 3).map((evidence, index) => (
                    <li key={`${currentDecision.id}:evidence:${index}`}>{evidence}</li>
                  ))}
                </ul>
              ) : (
                <small className="tp-home-today-evidence-note">
                  {CONFIDENCE_META[currentConfidence].explanation}
                </small>
              )}
            </section>
          )}

          {missingFormOpen && currentMissingKind && currentMissingKind !== 'soil-analysis' && (
            <section className="tp-home-today-missing-form" aria-label="Eksik bilgiyi tamamla">
              <div className="tp-home-today-missing-form-head">
                <small>BİLGİYİ TAMAMLA</small>
                <strong>{fieldName || 'Bu tarla'}</strong>
              </div>

              {currentMissingKind === 'irrigation-status' && (
                <div className="tp-home-today-choice-grid">
                  <button disabled={missingSaving} onClick={() => void saveIrrigationStatus('sulu')}>Sulu</button>
                  <button disabled={missingSaving} onClick={() => void saveIrrigationStatus('susuz')}>Susuz</button>
                  <button disabled={missingSaving} onClick={() => void saveIrrigationStatus('kısmi')}>Kısmi / ihtiyaca göre</button>
                </div>
              )}

              {currentMissingKind === 'irrigation-method' && (
                <div className="tp-home-today-field-row">
                  <label htmlFor="tp-today-irrigation-method">Sulama yöntemi</label>
                  <select
                    id="tp-today-irrigation-method"
                    value={missingMethod}
                    disabled={missingSaving}
                    onChange={(event) => setMissingMethod(event.target.value as FieldIrrigationMethod)}
                  >
                    {IRRIGATION_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="button" disabled={missingSaving} onClick={() => void saveIrrigationMethod()}>
                    {missingSaving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
              )}

              {currentMissingKind === 'last-irrigation' && (
                <div className="tp-home-today-field-row">
                  <label htmlFor="tp-today-last-irrigation">Son sulama tarihi</label>
                  <input
                    id="tp-today-last-irrigation"
                    type="date"
                    max={localIsoDate()}
                    value={missingDate}
                    disabled={missingSaving}
                    onChange={(event) => setMissingDate(event.target.value)}
                  />
                  <button type="button" disabled={missingSaving || !missingDate} onClick={() => void saveLastIrrigation()}>
                    {missingSaving ? 'Kaydediliyor…' : 'Sulamayı kaydet'}
                  </button>
                </div>
              )}

              {currentMissingKind === 'season-profile' && (
                <div className="tp-home-today-season-fields">
                  <label>
                    <span>Ürün</span>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Örn. Buğday"
                      value={missingCrop}
                      disabled={missingSaving}
                      onChange={(event) => setMissingCrop(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Ekim / dikim yılı</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1950"
                      max={String(new Date().getFullYear() + 1)}
                      placeholder={String(new Date().getFullYear())}
                      value={missingYear}
                      disabled={missingSaving}
                      onChange={(event) => setMissingYear(event.target.value)}
                    />
                  </label>
                  <small>Bildiklerini gir; ikisini birden doldurmak zorunda değilsin.</small>
                  <button type="button" disabled={missingSaving} onClick={() => void saveSeasonProfile()}>
                    {missingSaving ? 'Kaydediliyor…' : 'Kaydet ve kararı yenile'}
                  </button>
                </div>
              )}

              {missingError && <p className="tp-home-today-missing-error" role="alert">{missingError}</p>}
              {missingSuccess && <p className="tp-home-today-missing-success" role="status">{missingSuccess}</p>}
            </section>
          )}

          {currentIsNdviAnomaly ? (
            <div className="tp-home-today-satellite-actions" aria-label="Uydu anomalisi aksiyonları">
              <button
                type="button"
                className="tp-home-quick-link tp-home-today-satellite-action is-primary"
                onClick={() => {
                  close();
                  onOpenDecision('map_vegetation');
                }}
              >
                Haritada göster <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                className="tp-home-quick-link tp-home-today-satellite-action is-secondary"
                onClick={openNdviAnomalyPhoto}
              >
                Fotoğraf çek <span aria-hidden="true">＋</span>
              </button>
              {currentIsWorseningNdviFollowUp && (
                <button
                  type="button"
                  className="tp-home-quick-link tp-home-today-satellite-action is-analysis"
                  onClick={() => {
                    const observationPointId = ndviFollowUpPointId(currentDecision);
                    close();
                    onOpenDecision('ai', {
                      observationPointId,
                      source: 'ndvi-follow-up',
                    });
                  }}
                >
                  Sorunu analiz et <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="tp-home-quick-link tp-home-today-decision-link"
              onClick={() => {
                if (currentMissingKind === 'soil-analysis') {
                  close();
                  onOpenDecision('soil');
                  return;
                }
                if (currentMissingKind) {
                  setMissingFormOpen((value) => !value);
                  setMissingError(null);
                  return;
                }
                const target = currentDecision.target;
                close();
                onOpenDecision(target);
              }}
            >
              {missingFormOpen && currentMissingKind && currentMissingKind !== 'soil-analysis'
                ? 'Tamamlama alanını kapat'
                : decisionActionLabel(currentDecision, currentKind, currentMissingKind)}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}

      {active === 'notifications' && (
        <div className="tp-home-quick-list">
          {visibleTasks.map((task) => {
            const notificationId = `task:${task.id}`;
            const menuOpen = taskMenuId === task.id;
            const expanded = expandedNotificationId === notificationId;
            const busy = taskActionId === task.id;

            return (
              <article
                className={`tp-home-quick-notification is-task${expanded ? ' is-expanded' : ''}`}
                key={notificationId}
              >
                <span className="tp-home-quick-severity is-task" aria-hidden="true" />
                <div className="tp-home-quick-notification-copy">
                  <div className="tp-home-quick-compact-row">
                    <button
                      type="button"
                      className="tp-home-quick-notification-toggle"
                      aria-expanded={expanded}
                      aria-controls={`${notificationId}:detail`}
                      onClick={() =>
                        setExpandedNotificationId((current) =>
                          current === notificationId ? null : notificationId,
                        )
                      }
                    >
                      <strong>{task.title}</strong>
                      <ChevronDown className="tp-home-quick-chevron" size={16} aria-hidden="true" />
                    </button>

                    <div className="tp-home-quick-task-tools">
                      {task.rewardPoints > 0 ? (
                        <b className="tp-home-quick-points">+{task.rewardPoints} P</b>
                      ) : null}
                      <button
                        type="button"
                        className="tp-home-quick-task-menu-button"
                        aria-label={`${task.title} görev seçenekleri`}
                        aria-expanded={menuOpen}
                        onClick={() =>
                          setTaskMenuId((current) =>
                            current === task.id ? null : task.id,
                          )
                        }
                      >
                        <MoreHorizontal size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {menuOpen ? (
                    <div className="tp-home-quick-task-menu">
                      <button
                        type="button"
                        className="tp-home-quick-task-menu-option"
                        disabled={busy}
                        onClick={() => void snoozeTask(task)}
                      >
                        <Clock3 size={19} aria-hidden="true" />
                        <span><strong>Şimdi değil</strong><small>24 saat gizle</small></span>
                      </button>
                      <button
                        type="button"
                        className="tp-home-quick-task-menu-option"
                        disabled={busy}
                        onClick={() => void markUnsuitable(task)}
                      >
                        <OctagonX size={19} aria-hidden="true" />
                        <span><strong>Bana uygun değil</strong><small>Görevi kaldır</small></span>
                      </button>
                    </div>
                  ) : null}

                  {expanded ? (
                    <div
                      id={`${notificationId}:detail`}
                      className="tp-home-quick-notification-detail"
                    >
                      {task.description ? <p>{task.description}</p> : null}
                      {onOpenTask ? (
                        <button
                          type="button"
                          className="tp-home-quick-task-action"
                          onClick={() => {
                            close();
                            onOpenTask(task);
                          }}
                        >
                          <span>Göreve git</span><span aria-hidden="true">→</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

          {informationNotifications.map((item) => {
            const notificationId = `info:${item.id}`;
            const expanded = expandedNotificationId === notificationId;

            return (
              <article
                className={`tp-home-quick-notification${expanded ? ' is-expanded' : ''}`}
                key={item.id}
              >
                <span
                  className={`tp-home-quick-severity is-${item.severity}`}
                  aria-hidden="true"
                />
                <div className="tp-home-quick-notification-copy">
                  <button
                    type="button"
                    className="tp-home-quick-notification-toggle"
                    aria-expanded={expanded}
                    aria-controls={`${notificationId}:detail`}
                    onClick={() =>
                      setExpandedNotificationId((current) =>
                        current === notificationId ? null : notificationId,
                      )
                    }
                  >
                    <strong>{item.title}</strong>
                    <ChevronDown className="tp-home-quick-chevron" size={16} aria-hidden="true" />
                  </button>

                  {expanded ? (
                    <div
                      id={`${notificationId}:detail`}
                      className="tp-home-quick-notification-detail"
                    >
                      <p>{item.detail}</p>
                      <button
                        type="button"
                        className="tp-home-quick-task-action"
                        onClick={() => {
                          close();
                          onOpenDecision(item.target);
                        }}
                      >
                        <span>Detaya git</span><span aria-hidden="true">→</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

          {taskMessage ? <p className="tp-home-quick-task-message" role="status">{taskMessage}</p> : null}

          {!visibleTasks.length && !informationNotifications.length ? (
            <p className="tp-home-quick-empty">Şu an yeni bir gelişme görünmüyor.</p>
          ) : null}

          <button
            type="button"
            className="tp-home-quick-link"
            onClick={() => {
              close();
              onOpenNotifications();
            }}
          >
            Bildirim merkezine git <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </dialog>,
    document.body,
  );
}