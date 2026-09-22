import type { HomeDecisionEvent } from '../types/homeDecision';

type RiskRadarLevel = 'low' | 'moderate' | 'high' | 'critical';

type RiskRadarCompact = {
  supported?: boolean;
  overall?: {
    score?: number;
    level?: RiskRadarLevel;
    levelLabel?: string;
    headline?: string;
    recommendation?: string;
  } | null;
  topThreats?: Array<{
    name?: string;
    score?: number;
    level?: RiskRadarLevel;
    peakScore7d?: number;
    peakDate?: string | null;
    trend?: string;
    reasons?: string[];
    action?: string;
  }>;
  generatedAt?: string;
} | null;

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return text(value);

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  }).format(parsed);
}

/**
 * Risk Radar zaten Supabase tarafında gerçek hava + ürün + fenoloji bağlamıyla
 * hesaplanır. Bu adaptör yeni bir tarımsal skor üretmez; yalnızca doğrulanmış
 * Radar sonucunu Home Decision Engine'in kanonik olay biçimine dönüştürür.
 */
export function buildRiskRadarDecision(
  fieldId: string | number | null | undefined,
  radar: RiskRadarCompact,
  now = new Date(),
): HomeDecisionEvent | null {
  if (!fieldId || !radar?.supported || !radar.overall) return null;

  const level = radar.overall.level;
  if (!level || level === 'low') return null;

  const threat = radar.topThreats?.[0];
  if (!threat) return null;

  const threatName = text(threat.name) || 'Hastalık / zararlı';
  const score = finiteNumber(threat.score ?? radar.overall.score);
  const peakScore = finiteNumber(threat.peakScore7d);
  const peakDate = displayDate(threat.peakDate);
  const isDanger = level === 'critical' || level === 'high';
  const dayKey = localDayKey(now);

  const peakDetail =
    peakScore != null && score != null && peakScore > score
      ? `7 günlük tepe risk %${Math.round(peakScore)}${peakDate ? ` · ${peakDate}` : ''}.`
      : '';

  const action = text(threat.action || radar.overall.recommendation);
  const headline = text(radar.overall.headline);
  const detail = [
    score != null ? `Risk skoru %${Math.round(score)}.` : '',
    peakDetail,
    action || headline,
  ]
    .filter(Boolean)
    .join(' ');

  const safeKey = threatName
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'risk';

  return {
    id: `risk-radar:${String(fieldId)}:${safeKey}:${level}:${dayKey}`,
    group: 'risk-radar',
    source: 'risk-radar',
    priority: level === 'critical' ? 118 : level === 'high' ? 110 : 97,
    severity: isDanger ? 'danger' : 'warning',
    target: 'ai',
    channels: ['today', 'notification', 'pusula'],
    label: 'RİSK RADARI',
    title: isDanger
      ? `${threatName} Riski Yüksek`
      : `${threatName} Riskini Takip Et`,
    detail:
      detail ||
      `${threatName} için iklimsel risk seviyesi ${text(radar.overall.levelLabel) || level}.`,
    evidence: (threat.reasons ?? []).map(text).filter(Boolean).slice(0, 3),
    today: {
      tone: isDanger ? 'red' : 'amber',
      visual: 'spraying',
      iconKey: 'leaf-green',
      iconClass: 'leaf',
    },
    notification: {
      iconKey: 'leaf',
      iconTone: isDanger ? 'gold' : 'green',
      dotTone: isDanger ? 'danger' : 'warning',
    },
  };
}
