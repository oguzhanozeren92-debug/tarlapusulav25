import { useMemo } from 'react';
import type { GbifPestObservation } from '../services/field-biodiversity-context';

type Props = {
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  observations: GbifPestObservation[];
  height?: number;
};

const WIDTH = 760;
const HEIGHT = 360;
const PAD = 34;

export default function GbifObservationMap({
  centerLatitude,
  centerLongitude,
  radiusKm,
  observations,
  height = 330,
}: Props) {
  const plotted = useMemo(() => {
    const safeRadius = Math.max(5, radiusKm || 25);
    const usableW = WIDTH - PAD * 2;
    const usableH = HEIGHT - PAD * 2;
    const cosLat = Math.max(0.2, Math.cos((centerLatitude * Math.PI) / 180));

    return observations
      .map((item) => {
        const dxKm = (item.longitude - centerLongitude) * 111.32 * cosLat;
        const dyKm = (item.latitude - centerLatitude) * 111.32;
        if (Math.hypot(dxKm, dyKm) > safeRadius * 1.08) return null;
        return {
          ...item,
          x: WIDTH / 2 + (dxKm / safeRadius) * (usableW / 2),
          y: HEIGHT / 2 - (dyKm / safeRadius) * (usableH / 2),
        };
      })
      .filter(Boolean) as Array<GbifPestObservation & { x: number; y: number }>;
  }, [centerLatitude, centerLongitude, observations, radiusKm]);

  const grouped = useMemo(() => {
    const values = new Map<string, number>();
    for (const item of observations) {
      values.set(item.commonLabelTr, (values.get(item.commonLabelTr) ?? 0) + 1);
    }
    return [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [observations]);

  return (
    <div className="tp-gbif-map-wrap">
      <svg
        className="tp-gbif-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Yakın çevredeki geçmiş GBIF gözlem noktaları"
        style={{ height }}
      >
        <defs>
          <linearGradient id="tpGbifBg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#edf2e8" />
            <stop offset="1" stopColor="#dfe8d8" />
          </linearGradient>
          <filter id="tpGbifShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.22" />
          </filter>
        </defs>

        <rect width={WIDTH} height={HEIGHT} rx="18" fill="url(#tpGbifBg)" />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <g key={ratio} opacity="0.32">
            <line x1={PAD} x2={WIDTH - PAD} y1={HEIGHT * ratio} y2={HEIGHT * ratio} stroke="#7f927a" strokeDasharray="5 7" />
            <line y1={PAD} y2={HEIGHT - PAD} x1={WIDTH * ratio} x2={WIDTH * ratio} stroke="#7f927a" strokeDasharray="5 7" />
          </g>
        ))}

        {[0.33, 0.66, 1].map((ratio) => {
          const maxR = Math.min(WIDTH, HEIGHT) * 0.42;
          return (
            <circle
              key={ratio}
              cx={WIDTH / 2}
              cy={HEIGHT / 2}
              r={maxR * ratio}
              fill="none"
              stroke="#82937b"
              strokeWidth="1"
              opacity="0.28"
            />
          );
        })}

        <text x={WIDTH / 2} y="22" textAnchor="middle" fontSize="12" fontWeight="800" fill="#53624f">KUZEY</text>
        <text x={WIDTH - 14} y={HEIGHT / 2} textAnchor="end" fontSize="11" fontWeight="800" fill="#667361">DOĞU</text>

        {plotted.map((item, index) => (
          <g key={`${item.gbifId}-${index}`} transform={`translate(${item.x} ${item.y})`}>
            <circle r="8" fill="#9b5f2c" opacity="0.18" />
            <circle r="4.5" fill="#854a20" stroke="#fff" strokeWidth="1.7" filter="url(#tpGbifShadow)" />
            <title>{`${item.commonLabelTr} · ${item.distanceKm ?? '—'} km · ${item.observedAt ? new Date(item.observedAt).toLocaleDateString('tr-TR') : 'Tarih yok'}`}</title>
          </g>
        ))}

        <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2})`}>
          <circle r="13" fill="#234b34" opacity="0.16" />
          <circle r="7" fill="#234b34" stroke="#fff" strokeWidth="2.5" filter="url(#tpGbifShadow)" />
          <path d="M0 -15 L4 -7 L0 -9 L-4 -7 Z" fill="#234b34" />
          <title>Seçili tarla</title>
        </g>

        <text x={PAD + 6} y={HEIGHT - 16} fontSize="11" fontWeight="700" fill="#5f6d5a">
          Gösterilen yarıçap: {radiusKm} km
        </text>
      </svg>

      <div className="tp-gbif-map-legend">
        <span><i className="field" /> Seçili tarla</span>
        <span><i className="observation" /> Geçmiş gözlem</span>
        {grouped.map(([label, count]) => (
          <span key={label}>{label} <b>{count}</b></span>
        ))}
      </div>

      <style>{`
        .tp-gbif-map-wrap{width:100%;min-width:0}
        .tp-gbif-map{display:block;width:100%;border:1px solid rgba(76,93,70,.16);border-radius:16px;background:#e7eee1}
        .tp-gbif-map-legend{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;color:#657060;font-size:10px}
        .tp-gbif-map-legend span{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #e1e7dd;border-radius:999px;background:#fff}
        .tp-gbif-map-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.tp-gbif-map-legend i.field{background:#234b34}.tp-gbif-map-legend i.observation{background:#854a20}.tp-gbif-map-legend b{color:#263a2b}
      `}</style>
    </div>
  );
}
