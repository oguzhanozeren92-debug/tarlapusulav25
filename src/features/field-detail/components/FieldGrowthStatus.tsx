import { useMemo } from 'react';
import { Sprout } from 'lucide-react';

import { useHomePhenologyInsight } from '../../phenology/hooks/useHomePhenologyInsight';

import './FieldGrowthStatus.css';

type Props = {
  field: any;
};

function confidenceLabel(value: unknown) {
  if (value === 'high') return 'Yüksek';
  if (value === 'medium') return 'Orta';
  return 'Ön değerlendirme';
}

export default function FieldGrowthStatus({ field }: Props) {
  const insight = useHomePhenologyInsight(field);
  const phenology = insight.phenology;

  const sourceLabel = useMemo(() => {
    const evidence = (phenology?.basis ?? [])
      .map((item) => String(item ?? '').toLocaleLowerCase('tr-TR'))
      .join(' ');

    if (evidence.includes('nasa harvest')) return 'Uydu + sezon';
    if (String(field?.cropCycle ?? field?.crop_cycle ?? '') === 'perennial') {
      return 'Ürün takvimi + sezon';
    }
    return 'Sezon + gelişim verisi';
  }, [field?.cropCycle, field?.crop_cycle, phenology?.basis]);

  const usable = Boolean(
    phenology &&
      phenology.dataStatus === 'usable' &&
      phenology.stage !== 'unknown',
  );

  return (
    <section className="tp-field-growth-status" aria-label="Gelişim durumu">
      <div className="tp-field-growth-status-icon" aria-hidden="true">
        <Sprout size={21} strokeWidth={1.8} />
      </div>

      <div className="tp-field-growth-status-copy">
        <span>GELİŞİM DURUMU</span>
        <strong>
          {usable
            ? phenology?.stageLabel || 'Gelişim dönemi'
            : insight.phenologyContextStatus === 'loading' ||
                insight.timeSeriesStatus === 'loading'
              ? 'Gelişim verisi hazırlanıyor'
              : 'Gelişim dönemi henüz net değil'}
        </strong>
        <p>
          {usable
            ? phenology?.summary ||
              'Sezon ve gözlem verileri birlikte değerlendirilerek mevcut gelişim dönemi izleniyor.'
            : insight.phenologyContextMessage ||
              insight.timeSeriesMessage ||
              'Sezon veya gözlem verisi tamamlandıkça bu alan otomatik güncellenecek.'}
        </p>

        {usable ? (
          <div className="tp-field-growth-status-meta">
            <span>Güven: {confidenceLabel(phenology?.confidence)}</span>
            <span>{sourceLabel}</span>
          </div>
        ) : null}

        {usable && (phenology?.basis ?? []).length > 0 ? (
          <small>
            {(phenology?.basis ?? [])
              .map((item) => String(item ?? '').trim())
              .filter(Boolean)
              .slice(0, 2)
              .join(' · ')}
          </small>
        ) : null}
      </div>
    </section>
  );
}
