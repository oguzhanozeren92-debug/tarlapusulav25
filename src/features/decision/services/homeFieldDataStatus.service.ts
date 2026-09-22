import type { HomeFieldDataStatusItem } from '../components/HomeFieldDataStatus';
import { isRecentSatelliteObservation } from '../../satellite/services/buildHomeSatelliteDecision';
import type { HomeDualKcEvidenceStatus } from '../../irrigation/hooks/useHomeIrrigationDecision';
import { readHomeDualKcEvidenceSnapshot } from '../../irrigation/services/homeDualKcEvidenceSnapshot';
import type { FieldWeatherState } from '../../../types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type Sources = {
  weather: { status?: string | null; available: boolean };
  phenology: { status: LoadStatus; usable: boolean; stageLabel?: string | null };
  satellite: { status: LoadStatus; quality?: string; observationCount: number; latestDate?: string | null };
  soil: { status: LoadStatus; reportDate?: string | null };
  irrigation: {
    status: LoadStatus;
    decisionCode?: string | null;
    evidenceStatus?: HomeDualKcEvidenceStatus;
  };
};

function dayLabel(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : null;
}

function irrigationEvidenceSuffix(status: HomeDualKcEvidenceStatus | undefined) {
  if (status === 'ready') return ' · gelişmiş model kanıtı hazır';
  if (status === 'waiting') return ' · gelişmiş model veri bekliyor';
  if (status === 'loading') return ' · model kanıtı kontrol ediliyor';
  if (status === 'not_applicable') return ' · susuz tarla';
  if (status === 'error') return ' · model kanıtı alınamadı';
  return '';
}

export function hasUsableFieldWeatherForecast(state: FieldWeatherState | null | undefined, now: Date = new Date()) {
  return state?.status === 'ready' && state.forecast.some((day) => {
    const date = Date.parse(day.date ?? '');
    return Number.isFinite(date) && date >= now.getTime() - 86_400_000 &&
      [day.tempMax, day.tempMin, day.precipitation].some((value) => value != null && Number.isFinite(value));
  });
}

export function buildHomeFieldDataStatuses(sources: Sources): HomeFieldDataStatusItem[] {
  const { weather, phenology, satellite, soil, irrigation } = sources;
  const satelliteDate = dayLabel(satellite.latestDate);
  const satelliteRecent = satellite.quality === 'usable' && isRecentSatelliteObservation(satellite.latestDate);
  const reportDate = dayLabel(soil.reportDate);
  const projectedEvidenceStatus = readHomeDualKcEvidenceSnapshot().status;
  const evidenceSuffix = irrigationEvidenceSuffix(
    irrigation.evidenceStatus ?? projectedEvidenceStatus,
  );

  return [
    {
      label: 'Hava durumu',
      target: 'weather',
      actionLabel: 'Havayı aç',
      status: weather.status === 'error' ? 'error' : weather.available ? 'ready' : weather.status === 'loading' ? 'loading' : 'missing',
      detail: weather.status === 'error' ? 'Tarla tahmini alınamadı' : weather.available ? 'Bu tarla için güncel tahmin var' : weather.status === 'loading' ? 'Tarla tahmini yükleniyor' : 'Tarla tahmini henüz yok',
    },
    {
      label: 'Ürün evresi',
      target: 'calendar',
      actionLabel: 'Takvimi aç',
      status: phenology.status === 'error' ? 'error' : phenology.status === 'loading' ? 'loading' : phenology.usable ? 'ready' : 'missing',
      detail: phenology.status === 'error' ? 'Veri alınamadı' : phenology.status === 'loading' ? 'Hesaplanıyor' : phenology.usable ? phenology.stageLabel || 'Evre bilgisi var' : 'Evre için veri eksik',
    },
    {
      label: 'Uydu NDVI',
      target: 'map_vegetation',
      actionLabel: 'Haritada aç',
      status: satellite.status === 'error' ? 'error' : satellite.status === 'loading' ? 'loading' : satelliteRecent ? 'ready' : 'missing',
      detail: satellite.status === 'error' ? 'Veri alınamadı' : satellite.status === 'loading' ? 'Gözlemler yükleniyor' : satelliteRecent && satelliteDate ? `Son gözlem ${satelliteDate} · ${satellite.observationCount} kayıt` : satelliteDate ? `Son gözlem ${satelliteDate}; güncel eğilim yok` : 'Güvenilir gözlem henüz yok',
    },
    {
      label: 'Toprak analizi',
      target: 'soil',
      actionLabel: 'Analizi aç',
      status: soil.status === 'error' ? 'error' : soil.status === 'loading' ? 'loading' : soil.status === 'ready' && soil.reportDate ? 'ready' : 'missing',
      detail: soil.status === 'error' ? 'Veri alınamadı' : soil.status === 'loading' ? 'Raporlar yükleniyor' : reportDate ? `Son rapor ${reportDate}` : 'Henüz rapor yok',
    },
    {
      label: 'Sulama',
      target: 'irrigation_detail',
      actionLabel: 'Sulamayı aç',
      status: irrigation.status === 'error' ? 'error' : irrigation.status === 'loading' ? 'loading' : irrigation.status === 'ready' && irrigation.decisionCode && irrigation.decisionCode !== 'needs_data' ? 'ready' : 'missing',
      detail:
        (irrigation.status === 'error'
          ? 'Veri alınamadı'
          : irrigation.status === 'loading'
            ? 'Değerlendiriliyor'
            : irrigation.decisionCode === 'needs_data'
              ? 'Sulama bilgisi eksik'
              : irrigation.status === 'ready' && irrigation.decisionCode
                ? 'Değerlendirme hazır'
                : 'Sulama verisi yok') + evidenceSuffix,
    },
  ];
}
