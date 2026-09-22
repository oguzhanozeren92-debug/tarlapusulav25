import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, LockKeyhole, Sprout, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

type PusulaPointsModalProps = {
  open: boolean;
  onClose: () => void;
  points?: number | null;
};

type PointThreshold = {
  field_number: number;
  required_points: number;
};

type PointTransaction = {
  id: string;
  rule_key: string;
  points: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PointRule = {
  rule_key: string;
  label: string;
};

const FALLBACK_THRESHOLDS: PointThreshold[] = [
  { field_number: 1, required_points: 0 },
  { field_number: 2, required_points: 1000 },
  { field_number: 3, required_points: 2500 },
];

const LEVEL_NAMES: Record<number, string> = {
  1: 'Başlangıç',
  2: 'Saha Üreticisi',
  3: 'Usta Üretici',
};

const CSS = String.raw`
.tp-points-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:10040;
  border:0;
  padding:0;
  background:rgba(10,14,18,.58);
  backdrop-filter:blur(7px);
  -webkit-backdrop-filter:blur(7px);
}

.tp-points-modal{
  position:fixed;
  z-index:10050;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  width:min(92vw,430px);
  max-height:min(84vh,720px);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  border:1px solid #d7dde2;
  border-radius:24px;
  background:#fff;
  color:#171b20;
  box-shadow:0 28px 80px rgba(15,23,42,.28);
  font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

.tp-points-modal-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:18px 18px 13px;
  border-bottom:1px solid #edf0f2;
  background:#fff;
}

.tp-points-modal-head small{
  display:block;
  margin-bottom:4px;
  color:#64707c;
  font-size:8px;
  font-weight:900;
  letter-spacing:.12em;
}

.tp-points-modal-head h2{
  margin:0;
  font-size:22px;
  line-height:1.05;
  letter-spacing:-.035em;
}

.tp-points-modal-x{
  width:36px;
  height:36px;
  flex:0 0 36px;
  display:grid;
  place-items:center;
  padding:0;
  border:1px solid #d6dde2;
  border-radius:11px;
  background:#fff;
  color:#111827;
  cursor:pointer;
}

.tp-points-modal-x svg{width:18px;height:18px}

.tp-points-hero{
  margin:14px 16px 0;
  padding:15px;
  display:grid;
  grid-template-columns:54px minmax(0,1fr) auto;
  gap:12px;
  align-items:center;
  border:1px solid #dfe4e8;
  border-radius:18px;
  background:#f7f9fa;
}

.tp-points-hero-icon{
  width:54px;
  height:54px;
  display:grid;
  place-items:center;
  border-radius:17px;
  background:#111827;
  color:#fff;
}

.tp-points-hero-icon svg{width:26px;height:26px}

.tp-points-hero-copy small{
  display:block;
  color:#6b7280;
  font-size:8px;
  font-weight:800;
  letter-spacing:.08em;
  text-transform:uppercase;
}

.tp-points-hero-copy strong{
  display:block;
  margin-top:2px;
  font-size:15px;
  line-height:1.15;
}

.tp-points-hero-copy span{
  display:block;
  margin-top:4px;
  color:#64707c;
  font-size:9px;
  line-height:1.3;
}

.tp-points-total{
  text-align:right;
  white-space:nowrap;
}

.tp-points-total strong{
  display:block;
  font-size:21px;
  letter-spacing:-.04em;
}

.tp-points-total small{
  color:#64707c;
  font-size:7px;
  font-weight:800;
  letter-spacing:.08em;
}

.tp-points-progress{
  margin:10px 16px 0;
  padding:11px 12px;
  border:1px solid #e0e5e9;
  border-radius:14px;
  background:#fff;
}

.tp-points-progress-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  color:#52606c;
  font-size:9px;
}

.tp-points-progress-row strong{
  color:#111827;
  font-size:9px;
}

.tp-points-progress-track{
  height:7px;
  margin-top:8px;
  overflow:hidden;
  border-radius:999px;
  background:#e9edf0;
}

.tp-points-progress-track i{
  display:block;
  height:100%;
  border-radius:999px;
  background:#111827;
}

.tp-points-tabs{
  margin:12px 16px 0;
  padding:3px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:3px;
  border:1px solid #e0e5e9;
  border-radius:13px;
  background:#f5f7f8;
}

.tp-points-tabs button{
  min-height:37px;
  border:0;
  border-radius:10px;
  background:transparent;
  color:#59636d;
  font-size:10px;
  font-weight:800;
  cursor:pointer;
}

.tp-points-tabs button.active{
  background:#111827;
  color:#fff;
  box-shadow:0 4px 12px rgba(17,24,39,.13);
}

.tp-points-body{
  min-height:0;
  overflow-y:auto;
  padding:12px 16px 18px;
  scrollbar-width:thin;
}

.tp-points-levels{
  display:grid;
  gap:9px;
}

.tp-points-level{
  position:relative;
  display:grid;
  grid-template-columns:38px minmax(0,1fr) auto;
  align-items:center;
  gap:10px;
  min-height:66px;
  padding:9px 10px;
  border:1px solid #e0e5e9;
  border-radius:15px;
  background:#fff;
}

.tp-points-level.current{
  border-color:#111827;
  box-shadow:inset 0 0 0 1px #111827;
}

.tp-points-level.done{
  background:#f7f9fa;
}

.tp-points-level-mark{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border-radius:12px;
  background:#eef1f3;
  color:#4b5563;
}

.tp-points-level.current .tp-points-level-mark,
.tp-points-level.done .tp-points-level-mark{
  background:#111827;
  color:#fff;
}

.tp-points-level-mark svg{width:18px;height:18px}

.tp-points-level-copy small{
  display:block;
  color:#75808a;
  font-size:7px;
  font-weight:900;
  letter-spacing:.09em;
  text-transform:uppercase;
}

.tp-points-level-copy strong{
  display:block;
  margin-top:2px;
  font-size:12px;
}

.tp-points-level-copy span{
  display:block;
  margin-top:3px;
  color:#606b75;
  font-size:8px;
  line-height:1.35;
}

.tp-points-level-value{
  min-width:60px;
  text-align:right;
}

.tp-points-level-value strong{
  display:block;
  font-size:11px;
}

.tp-points-level-value small{
  display:block;
  margin-top:3px;
  color:#69747e;
  font-size:6.8px;
}

.tp-points-history{
  display:grid;
  gap:8px;
}

.tp-points-history-row{
  display:grid;
  grid-template-columns:36px minmax(0,1fr) auto;
  gap:9px;
  align-items:center;
  min-height:58px;
  padding:9px 10px;
  border:1px solid #e3e7ea;
  border-radius:14px;
  background:#fff;
}

.tp-points-history-icon{
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border-radius:11px;
  background:#f0f3f5;
  color:#20252b;
}

.tp-points-history-icon svg{width:17px;height:17px}

.tp-points-history-copy strong{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:10px;
}

.tp-points-history-copy span{
  display:block;
  margin-top:3px;
  color:#76818b;
  font-size:7.4px;
  line-height:1.25;
}

.tp-points-history-value{
  color:#111827;
  font-size:11px;
  font-weight:900;
  white-space:nowrap;
}

.tp-points-empty{
  min-height:150px;
  display:grid;
  place-items:center;
  align-content:center;
  gap:7px;
  padding:18px;
  border:1px dashed #d7dde2;
  border-radius:15px;
  color:#6b7280;
  text-align:center;
}

.tp-points-empty strong{
  color:#20252b;
  font-size:12px;
}

.tp-points-empty span{
  max-width:240px;
  font-size:8.5px;
  line-height:1.45;
}

.tp-points-loading{
  padding:35px 12px;
  color:#66717b;
  font-size:10px;
  text-align:center;
}

@media(max-width:520px){
  .tp-points-modal{
    top:auto;
    bottom:10px;
    transform:translateX(-50%);
    width:calc(100% - 16px);
    max-height:88dvh;
    border-radius:22px;
  }

  .tp-points-modal-head{
    padding:15px 15px 11px;
  }

  .tp-points-modal-head h2{
    font-size:19px;
  }

  .tp-points-hero{
    margin:11px 12px 0;
    padding:12px;
    grid-template-columns:46px minmax(0,1fr) auto;
    gap:9px;
  }

  .tp-points-hero-icon{
    width:46px;
    height:46px;
    border-radius:14px;
  }

  .tp-points-total strong{
    font-size:18px;
  }

  .tp-points-progress,
  .tp-points-tabs{
    margin-left:12px;
    margin-right:12px;
  }

  .tp-points-body{
    padding:10px 12px 15px;
  }
}
`;

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function transactionDetail(metadata: Record<string, unknown> | null) {
  if (!metadata) return '';

  const candidates = [
    metadata.field_name,
    metadata.fieldName,
    metadata.title,
    metadata.task_title,
    metadata.taskTitle,
    metadata.source_label,
  ];

  return candidates
    .map((item) => String(item ?? '').trim())
    .find(Boolean) ?? '';
}

export default function PusulaPointsModal({
  open,
  onClose,
  points,
}: PusulaPointsModalProps) {
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  const [loading, setLoading] = useState(false);
  const [remotePoints, setRemotePoints] = useState<number | null>(null);
  const [thresholds, setThresholds] = useState<PointThreshold[]>(FALLBACK_THRESHOLDS);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [rules, setRules] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);

    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) return;

        const [scoreResult, thresholdResult, transactionResult, ruleResult] = await Promise.all([
          supabase
            .from('user_gamification')
            .select('points,lifetime_points')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('gamification_field_thresholds')
            .select('field_number,required_points')
            .eq('active', true)
            .order('field_number', { ascending: true }),
          supabase
            .from('gamification_transactions')
            .select('id,rule_key,points,metadata,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(60),
          supabase
            .from('gamification_rules')
            .select('rule_key,label'),
        ]);

        if (!alive) return;

        const score = safeNumber(
          scoreResult.data?.lifetime_points ?? scoreResult.data?.points,
          Number.NaN,
        );
        if (Number.isFinite(score)) setRemotePoints(score);

        if (Array.isArray(thresholdResult.data) && thresholdResult.data.length) {
          setThresholds(
            thresholdResult.data
              .map((item: any) => ({
                field_number: safeNumber(item.field_number),
                required_points: safeNumber(item.required_points),
              }))
              .filter((item) => item.field_number >= 1)
              .sort((a, b) => a.field_number - b.field_number),
          );
        }

        if (Array.isArray(transactionResult.data)) {
          setTransactions(transactionResult.data as PointTransaction[]);
        }

        if (Array.isArray(ruleResult.data)) {
          setRules(
            (ruleResult.data as PointRule[]).reduce<Record<string, string>>(
              (acc, item) => {
                acc[item.rule_key] = item.label;
                return acc;
              },
              {},
            ),
          );
        }
      } catch (error) {
        console.warn('[Pusula Puanı] Veriler okunamadı:', error);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setTab('levels');
  }, [open]);

  const shownPoints = useMemo(() => {
    if (remotePoints != null && Number.isFinite(remotePoints)) return remotePoints;
    const explicit = Number(points);
    return Number.isFinite(explicit) ? explicit : 0;
  }, [remotePoints, points]);

  const sortedThresholds = useMemo(() => {
    const source = thresholds.length ? thresholds : FALLBACK_THRESHOLDS;
    const unique = new Map<number, PointThreshold>();

    source.forEach((item) => {
      if (item.field_number <= 3) unique.set(item.field_number, item);
    });

    FALLBACK_THRESHOLDS.forEach((fallback) => {
      if (!unique.has(fallback.field_number)) {
        unique.set(fallback.field_number, fallback);
      }
    });

    return Array.from(unique.values()).sort(
      (a, b) => a.field_number - b.field_number,
    );
  }, [thresholds]);

  const currentLevel = useMemo(() => {
    return sortedThresholds.reduce(
      (best, item) =>
        shownPoints >= item.required_points ? Math.max(best, item.field_number) : best,
      1,
    );
  }, [shownPoints, sortedThresholds]);

  const nextThreshold = sortedThresholds.find(
    (item) => item.required_points > shownPoints,
  );

  const previousThreshold = [...sortedThresholds]
    .reverse()
    .find((item) => item.required_points <= shownPoints) ?? sortedThresholds[0];

  const progress = nextThreshold
    ? Math.max(
        0,
        Math.min(
          100,
          ((shownPoints - previousThreshold.required_points) /
            Math.max(1, nextThreshold.required_points - previousThreshold.required_points)) *
            100,
        ),
      )
    : 100;

  if (!open) return null;

  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className="tp-points-modal-backdrop"
        aria-label="Pusula Puanı penceresini kapat"
        onClick={onClose}
      />

      <section
        className="tp-points-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pusula Puanı"
      >
        <header className="tp-points-modal-head">
          <div>
            <small>PUSULA PUANI</small>
            <h2>İlerlemen ve Kazançların</h2>
          </div>
          <button
            type="button"
            className="tp-points-modal-x"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X />
          </button>
        </header>

        <div className="tp-points-hero">
          <span className="tp-points-hero-icon" aria-hidden="true">
            <Sprout />
          </span>
          <div className="tp-points-hero-copy">
            <small>SEVİYE {currentLevel}</small>
            <strong>{LEVEL_NAMES[currentLevel] ?? `Seviye ${currentLevel}`}</strong>
            <span>
              {nextThreshold
                ? `${Math.max(0, nextThreshold.required_points - shownPoints).toLocaleString('tr-TR')} P sonra ${nextThreshold.field_number}. tarla hakkı açılır.`
                : 'Mevcut tarla açma seviyelerinin tamamına ulaştın.'}
            </span>
          </div>
          <div className="tp-points-total">
            <strong>{shownPoints.toLocaleString('tr-TR')} P</strong>
            <small>TOPLAM</small>
          </div>
        </div>

        <div className="tp-points-progress">
          <div className="tp-points-progress-row">
            <span>
              {nextThreshold
                ? `Sonraki hedef · ${nextThreshold.field_number}. tarla`
                : 'Seviye hedefleri tamamlandı'}
            </span>
            <strong>
              {nextThreshold
                ? `${nextThreshold.required_points.toLocaleString('tr-TR')} P`
                : `${shownPoints.toLocaleString('tr-TR')} P`}
            </strong>
          </div>
          <div className="tp-points-progress-track" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="tp-points-tabs" role="tablist" aria-label="Pusula puanı sekmeleri">
          <button
            type="button"
            className={tab === 'levels' ? 'active' : ''}
            onClick={() => setTab('levels')}
          >
            Seviyeler
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'active' : ''}
            onClick={() => setTab('history')}
          >
            Pusula Geçmişi
          </button>
        </div>

        <div className="tp-points-body">
          {tab === 'levels' ? (
            <div className="tp-points-levels">
              {sortedThresholds.map((item) => {
                const done = shownPoints >= item.required_points;
                const current = item.field_number === currentLevel;

                return (
                  <article
                    key={item.field_number}
                    className={`tp-points-level${done ? ' done' : ''}${current ? ' current' : ''}`}
                  >
                    <span className="tp-points-level-mark" aria-hidden="true">
                      {done ? <Check /> : <LockKeyhole />}
                    </span>
                    <div className="tp-points-level-copy">
                      <small>SEVİYE {item.field_number}</small>
                      <strong>
                        {LEVEL_NAMES[item.field_number] ?? `Seviye ${item.field_number}`}
                      </strong>
                      <span>
                        {item.field_number === 1
                          ? 'İlk tarla hakkın kullanıma açık.'
                          : `${item.field_number}. tarla hakkı bu seviyede açılır.`}
                      </span>
                    </div>
                    <div className="tp-points-level-value">
                      <strong>{item.required_points.toLocaleString('tr-TR')} P</strong>
                      <small>{done ? 'AÇIK' : 'HEDEF'}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : loading && !transactions.length ? (
            <div className="tp-points-loading">Pusula geçmişi hazırlanıyor…</div>
          ) : transactions.length ? (
            <div className="tp-points-history">
              {transactions.map((item) => {
                const detail = transactionDetail(item.metadata);
                return (
                  <article className="tp-points-history-row" key={item.id}>
                    <span className="tp-points-history-icon" aria-hidden="true">
                      <Clock3 />
                    </span>
                    <div className="tp-points-history-copy">
                      <strong>{rules[item.rule_key] ?? item.rule_key}</strong>
                      <span>
                        {formatDate(item.created_at)}
                        {detail ? ` · ${detail}` : ''}
                      </span>
                    </div>
                    <strong className="tp-points-history-value">
                      +{safeNumber(item.points).toLocaleString('tr-TR')} P
                    </strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="tp-points-empty">
              <Clock3 size={22} />
              <strong>Henüz puan hareketi yok</strong>
              <span>
                Pusula kazandıkça burada hangi görevden, ne zaman ve kaç puan aldığını göreceksin.
              </span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
