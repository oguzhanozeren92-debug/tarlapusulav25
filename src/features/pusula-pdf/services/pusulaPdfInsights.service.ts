import type { PusulaPdfSnapshot, PusulaPdfSatellitePoint } from '../types';

export type PusulaEvidence = {
  label: string;
  value: string;
};

export type PusulaInsight = {
  id: string;
  title: string;
  meaning: string;
  action: string;
  evidence: PusulaEvidence[];
  confidence: 'high' | 'medium' | 'limited';
};

export type PusulaPdfGuidance = {
  weeklyHeadline: string;
  weeklySummary: string;
  insights: PusulaInsight[];
  next7Days: string[];
  dataQualityNote: string;
};

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const fmt = (value: number | null | undefined, digits = 3) =>
  finite(value) ? value.toFixed(digits) : 'veri yok';

const orderedPoints = (snapshot: PusulaPdfSnapshot) =>
  [...snapshot.satellite.points]
    .filter((point) => point?.date)
    .sort((a, b) => a.date.localeCompare(b.date));

const validSeries = (
  points: PusulaPdfSatellitePoint[],
  key: 'ndvi' | 'ndmi' | 'ndre' | 'savi' | 'gndvi',
) => points.filter((point) => finite(point[key]));

const delta = (
  points: PusulaPdfSatellitePoint[],
  key: 'ndvi' | 'ndmi' | 'ndre' | 'savi' | 'gndvi',
) => {
  const series = validSeries(points, key);
  if (series.length < 2) return null;
  return (series.at(-1)![key] as number) - (series[0][key] as number);
};

const trendWord = (change: number | null, threshold = 0.025) => {
  if (change === null) return 'ölçülemiyor';
  if (change > threshold) return 'yükseliyor';
  if (change < -threshold) return 'geriliyor';
  return 'yatay seyrediyor';
};

const weatherRows = (snapshot: PusulaPdfSnapshot): any[] => {
  const weather: any = snapshot.weather;
  if (Array.isArray(weather?.history) && weather.history.length) {
    return weather.history;
  }
  if (Array.isArray(weather?.daily) && weather.daily.length) {
    return weather.daily;
  }
  if (Array.isArray(weather?.forecast) && weather.forecast.length) {
    return weather.forecast;
  }
  if (Array.isArray(weather?.providers)) {
    return weather.providers.flatMap((provider: any) =>
      provider?.history ?? provider?.daily ?? provider?.forecast ?? [],
    );
  }
  return [];
};

const firstNumber = (row: any, keys: string[]) => {
  for (const key of keys) {
    if (finite(row?.[key])) return row[key] as number;
  }
  return null;
};

const latestPcseEvidence = (snapshot: PusulaPdfSnapshot) =>
  [...(snapshot.layerArchive ?? [])]
    .filter((item) => item?.layer === 'phenology-pcse-wofost')
    .sort((a, b) => String(a.observedAt ?? '').localeCompare(String(b.observedAt ?? '')))
    .at(-1) ?? null;

const latestAquaCropEvidence = (snapshot: PusulaPdfSnapshot) =>
  [...(snapshot.layerArchive ?? [])]
    .filter((item) => item?.layer === 'irrigation-aquacrop-pilot')
    .sort((a, b) => String(a.observedAt ?? '').localeCompare(String(b.observedAt ?? '')))
    .at(-1) ?? null;

const latestPyFao56Evidence = (snapshot: PusulaPdfSnapshot) =>
  [...(snapshot.layerArchive ?? [])]
    .filter((item) => item?.layer === 'irrigation-pyfao56-dual-kc')
    .sort((a, b) => String(a.observedAt ?? '').localeCompare(String(b.observedAt ?? '')))
    .at(-1) ?? null;

const latestDecisionEvidence = (snapshot: PusulaPdfSnapshot, layer: string) =>
  [...(snapshot.layerArchive ?? [])]
    .filter((item) => item?.layer === layer)
    .sort((a, b) => String(a.observedAt ?? '').localeCompare(String(b.observedAt ?? '')))
    .at(-1) ?? null;

const listText = (value: unknown, limit = 3) =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, limit)
    : [];

const modelMetric = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function buildPusulaPdfGuidance(
  snapshot: PusulaPdfSnapshot,
): PusulaPdfGuidance {
  const points = orderedPoints(snapshot);
  const ndviSeries = validSeries(points, 'ndvi');
  const ndmiSeries = validSeries(points, 'ndmi');
  const ndviDelta = delta(points, 'ndvi');
  const ndmiDelta = delta(points, 'ndmi');
  const weather = weatherRows(snapshot).slice(0, 7);
  const rainValues = weather
    .map((row) => firstNumber(row, ['rain', 'precipitation', 'precipitationMm']))
    .filter(finite);
  const totalRain = rainValues.length
    ? rainValues.reduce((sum, value) => sum + value, 0)
    : null;

  const insights: PusulaInsight[] = [];
  const next7Days: string[] = [];

  if (ndviSeries.length >= 2) {
    const ndviDirection = trendWord(ndviDelta);
    const ndmiDirection = trendWord(ndmiDelta);

    let meaning =
      `Bitki gelişim göstergesi son ${ndviSeries.length} gerçek uydu ölçümünde ${ndviDirection}.`;

    if (ndmiSeries.length >= 2) {
      meaning += ` Nem sinyali aynı dönemde ${ndmiDirection}.`;
    }

    if (
      ndviDelta !== null &&
      ndviDelta < -0.025 &&
      ndmiDelta !== null &&
      ndmiDelta < -0.025
    ) {
      meaning +=
        ' İki göstergenin birlikte gerilemesi su stresiyle uyumlu olabilir; bu tek başına kesin neden değildir.';
      next7Days.push(
        'NDVI ve NDMI gerilemesinin görüldüğü alanı sahada kontrol et; yaprak görünümü ve toprak nemini gözlemle.',
      );
    } else if (ndviDelta !== null && ndviDelta < -0.025) {
      meaning +=
        ' Gelişimdeki gerilemenin nedeni yalnız uydu verisiyle belirlenemez; fenoloji ve saha gözlemiyle doğrulanmalıdır.';
      next7Days.push(
        'Gelişimin zayıfladığı alanı yerinde kontrol et ve gerekirse aynı bölgeden Pusula teşhisi için fotoğraf ekle.',
      );
    } else if (ndviDelta !== null && ndviDelta > 0.025) {
      next7Days.push(
        'Gelişim artışını bir sonraki uydu ölçümünde tekrar karşılaştır; ani bölgesel sapmaları takip et.',
      );
    }

    insights.push({
      id: 'vegetation-trend',
      title:
        ndviDelta !== null && ndviDelta < -0.025
          ? 'Bitki gelişiminde gerileme sinyali'
          : ndviDelta !== null && ndviDelta > 0.025
            ? 'Bitki gelişimi güçleniyor'
            : 'Bitki gelişimi dengeli seyrediyor',
      meaning,
      action:
        ndviDelta !== null && ndviDelta < -0.025
          ? 'Önceliği değişimin görüldüğü alanın saha kontrolüne ver.'
          : 'Mevcut seyri koru ve yeni uydu ölçümünde aynı alanları karşılaştır.',
      evidence: [
        {
          label: 'NDVI',
          value: `${fmt(ndviSeries[0]?.ndvi)} → ${fmt(ndviSeries.at(-1)?.ndvi)}`,
        },
        {
          label: 'NDMI',
          value:
            ndmiSeries.length >= 2
              ? `${fmt(ndmiSeries[0]?.ndmi)} → ${fmt(ndmiSeries.at(-1)?.ndmi)}`
              : 'yeterli ölçüm yok',
        },
        { label: 'Uydu ölçümü', value: `${ndviSeries.length} tarih` },
      ],
      confidence: ndmiSeries.length >= 2 ? 'high' : 'medium',
    });
  } else {
    insights.push({
      id: 'satellite-data-limited',
      title: 'Uydu görüntüleri hazır; değişimin yönü için ölçüm bekleniyor',
      meaning:
        'Tarlanın farklı tarihlerdeki uydu görüntüleri hazır. Ancak değişimin güçlenme mi zayıflama mı olduğunu güvenilir biçimde söylemek için en az iki gerçek sayısal ölçüm gerekiyor.',
      action:
        'Şimdilik görüntüleri karşılaştır; belirgin renk veya bölgesel değişim görürsen sahada aynı alanı kontrol et. Ölçümler tamamlandığında Pusula değişimin yönünü ve olası nedenlerini otomatik açıklayacak.',
      evidence: [
        { label: 'Uydu tarihi', value: `${points.length}` },
        { label: 'Geçerli NDVI', value: `${ndviSeries.length}` },
        { label: 'Geçerli NDMI', value: `${ndmiSeries.length}` },
      ],
      confidence: 'limited',
    });
  }

  if (weather.length) {
    let meaning = `${weather.length} günlük hava verisi rapora bağlı.`;
    if (totalRain !== null) {
      meaning += ` Bu görünümde toplam yağış ${totalRain.toFixed(1)} mm.`;
      if (totalRain <= 1) {
        meaning +=
          ' Yağış desteği düşük görünüyor; sulama kararı ürün evresi, toprak ve saha nemiyle birlikte değerlendirilmelidir.';
        next7Days.push(
          'Yağış düşük kalırsa sulama ihtiyacını ürün evresi ve saha/toprak nemiyle birlikte kontrol et.',
        );
      }
    }

    insights.push({
      id: 'weather-water',
      title: 'Hava ve su bağlamı',
      meaning,
      action:
        'Tek başına hava tahminine göre işlem yapma; sulama/fenoloji kaydı ve uydu nem sinyaliyle birlikte değerlendir.',
      evidence: [
        { label: 'Hava günü', value: `${weather.length}` },
        {
          label: 'Yağış',
          value: totalRain === null ? 'veri yok' : `${totalRain.toFixed(1)} mm`,
        },
        {
          label: 'Fenoloji/Kc',
          value: `${snapshot.irrigation.kcSnapshots.length} kayıt`,
        },
      ],
      confidence:
        snapshot.irrigation.kcSnapshots.length > 0 ? 'high' : 'medium',
    });
  }

  const pcse = latestPcseEvidence(snapshot);
  if (pcse) {
    const details = pcse.details ?? {};
    const status = String(details.status ?? 'unknown');
    const missingInputs = Array.isArray(details.missingInputs) ? details.missingInputs.map(String).filter(Boolean) : [];
    if (status === 'completed') {
      const stage = String(details.stage ?? 'belirlenemedi');
      const dvs = modelMetric(pcse.metrics?.dvs);
      insights.push({
        id: 'pcse-wofost-phenology-evidence',
        title: 'PCSE/WOFOST gelişim modeli kanıtı',
        meaning: `WOFOST72_PP potansiyel gelişim modeli evreyi “${stage}” olarak hesapladı${dvs !== null ? ` (DVS ${dvs.toFixed(2)})` : ''}. Bu fenoloji baseline’ıdır; su stresi ve sulama kararı üretmez.`,
        action: 'Evreyi NASA Harvest NDVI eğrisi ve saha gözlemiyle birlikte doğrula.',
        evidence: [
          { label: 'Model', value: 'PCSE WOFOST72_PP' },
          { label: 'Evre', value: stage },
          { label: 'Su stresi yetkisi', value: 'Yok' },
        ],
        confidence: 'medium',
      });
    } else if (missingInputs.length) {
      next7Days.push(`PCSE/WOFOST fenoloji doğrulaması ${missingInputs.length} gerçek girdi eksik olduğu için sentetik ürün/çeşit/tarih üretmeden bekliyor.`);
    }
  }

  const aquaCrop = latestAquaCropEvidence(snapshot);
  if (aquaCrop) {
    const details = aquaCrop.details ?? {};
    const status = String(details.status ?? 'unknown');
    const missingInputs = Array.isArray(details.missingInputs) ? details.missingInputs.map(String).filter(Boolean) : [];
    if (status === 'completed') {
      const crop = String(details.cropModelKey ?? 'ürün');
      const start = String(details.simulationStart ?? '');
      const end = String(details.simulationEnd ?? '');
      insights.push({
        id: 'aquacrop-pilot-evidence',
        title: 'AquaCrop sezon simülasyonu tamamlandı',
        meaning: `AquaCrop pilotu ${crop} modeli için gerçek hava, toprak, başlangıç suyu ve sulama yönetimi girdileriyle çalıştı${start && end ? ` (${start} – ${end})` : ''}. Bu sezon ölçekli bağımsız kanıttır; bugünkü sulama reçetesi değildir.`,
        action: 'AquaCrop sonucunu sezon bağlamı olarak kullan; bugünkü sulama kararında production su dengesi ve saha gözlemi önceliklidir.',
        evidence: [
          { label: 'Model', value: 'AquaCrop pilot' },
          { label: 'Ürün modeli', value: crop },
          { label: 'Yetki', value: 'Bağımsız kanıt' },
        ],
        confidence: 'medium',
      });
    } else if (missingInputs.length) {
      next7Days.push(`AquaCrop doğrulaması ${missingInputs.length} gerçek girdi eksik olduğu için sentetik değer üretmeden bekliyor.`);
    }
  }

  const pyfao = latestPyFao56Evidence(snapshot);
  if (pyfao) {
    const details = pyfao.details ?? {};
    const metrics = pyfao.metrics ?? {};
    const status = String(details.status ?? 'unknown');
    const rootMin = modelMetric(metrics.rootDepletionMinMm);
    const rootMax = modelMetric(metrics.rootDepletionMaxMm);
    const horizon = modelMetric(metrics.horizonDays);
    const scenarios = modelMetric(metrics.scenarioCount);
    const missingInputs = Array.isArray(details.missingInputs)
      ? details.missingInputs.map(String).filter(Boolean)
      : [];

    if (status === 'completed' && rootMin !== null && rootMax !== null) {
      insights.push({
        id: 'pyfao56-dual-kc-evidence',
        title: 'FAO-56 bağımsız su dengesi kanıtı',
        meaning: `pyfao56 Dual-Kc shadow modeli kök bölgesi açığını ${rootMin.toFixed(1)}–${rootMax.toFixed(1)} mm aralığında hesapladı${horizon ? `; model ufku ${Math.round(horizon)} gün` : ''}. Bu bağımsız model kanıtıdır; production sulama reçetesi değildir.`,
        action: 'Sulama kararını production su dengesiyle uygula; model kanıtını saha nemi ve yeni ölçümlerle birlikte doğrulama katmanı olarak kullan.',
        evidence: [
          { label: 'Model', value: 'pyfao56 Dual-Kc shadow' },
          { label: 'Kök açığı', value: `${rootMin.toFixed(1)}–${rootMax.toFixed(1)} mm` },
          { label: 'Senaryo', value: scenarios ? `${Math.round(scenarios)}` : 'kayıtlı' },
        ],
        confidence: 'medium',
      });
    } else if (missingInputs.length) {
      next7Days.push(
        `FAO-56 Dual-Kc doğrulaması için ${missingInputs.length} gerçek girdi eksik; model sentetik değer üretmeden bekliyor.`,
      );
    }
  }

  if (!snapshot.activities.length) {
    next7Days.push(
      'Yaptığın tarla işlemlerini kaydet; sonraki PUSULAPDF değişimleri yapılan müdahalelerle karşılaştırabilsin.',
    );
  }

  const soilIntelligence = latestDecisionEvidence(snapshot, 'soil-intelligence');
  if (soilIntelligence) {
    const details = soilIntelligence.details ?? {};
    const metrics = soilIntelligence.metrics ?? {};
    const status = String(metrics.status ?? 'empty');
    const evidence = listText(details.evidence, 3);
    const warnings = listText(details.warnings, 2);

    if (status === 'lab-backed' || status === 'context-only') {
      const labBacked = status === 'lab-backed';
      insights.push({
        id: 'soil-intelligence-evidence',
        title: labBacked
          ? 'Toprak bağlamı laboratuvar ölçümüyle destekli'
          : 'SoilGrids toprak bağlamı hazır',
        meaning: [
          labBacked
            ? 'Bu tarlaya ait laboratuvar analizi ölçüm otoritesi olarak rapora bağlı.'
            : 'SoilGrids 250 m model tahmini pH, organik karbon ve tekstür için arka plan bağlamı sağlıyor; laboratuvar ölçümü yerine geçmiyor.',
          ...evidence,
        ].filter(Boolean).join(' '),
        action: labBacked
          ? 'Besleme yorumunda laboratuvar ölçümünü öncelikli kabul et; SoilGrids’i yalnız mekânsal bağlam olarak kullan.'
          : 'Gübreleme veya toprak düzeltme kararı için mümkün olduğunda bu tarlanın laboratuvar analizini ekle.',
        evidence: [
          { label: 'Ölçüm otoritesi', value: labBacked ? 'Laboratuvar' : 'Yok' },
          { label: 'SoilGrids', value: metrics.soilGridsContextAvailable ? 'Model bağlamı mevcut' : 'Yok' },
          { label: 'Hidrolik eşik tahmini', value: 'Üretilmedi' },
        ],
        confidence: labBacked ? 'high' : 'limited',
      });

      if (!labBacked && !snapshot.soilAnalyses.length) {
        next7Days.push('SoilGrids arka planı mevcut; gübreleme kararını güçlendirmek için gerçek laboratuvar toprak analizi ekle.');
      }
      if (warnings.length) {
        next7Days.push(`Toprak verisi notu: ${warnings[0]}`);
      }
    }
  }

  const irrigationSynthesis = latestDecisionEvidence(snapshot, 'irrigation-synthesis');
  if (irrigationSynthesis) {
    const details = irrigationSynthesis.details ?? {};
    const metrics = irrigationSynthesis.metrics ?? {};
    const headline = String(details.headline ?? '').trim();
    const summary = String(details.summary ?? '').trim();
    const agreement = String(metrics.synthesisAgreement ?? 'partial');
    const soilContext = String(metrics.soilContext ?? 'missing');
    const decision = String(metrics.decision ?? 'veri yok');

    insights.push({
      id: 'irrigation-synthesis-evidence',
      title: headline || 'Sulama model sentezi',
      meaning: summary || 'Production sulama kararı bağımsız model kanıtlarıyla birlikte arşivlendi.',
      action: agreement === 'mixed'
        ? 'Modeller ayrışıyorsa sulama öncesi saha nemi ve son sulama kaydını doğrula.'
        : 'Bugünkü uygulamada production su dengesi kararını esas al; pyfao56/AquaCrop/toprak bağlamını destekleyici kanıt olarak kullan.',
      evidence: [
        { label: 'Production kararı', value: decision },
        { label: 'Model uyumu', value: agreement },
        { label: 'Toprak bağlamı', value: soilContext },
      ],
      confidence: agreement === 'aligned' ? 'high' : agreement === 'mixed' ? 'medium' : 'limited',
    });
  }

  const plantHealth = latestDecisionEvidence(snapshot, 'plant-health-synthesis');
  if (plantHealth) {
    const details = plantHealth.details ?? {};
    const metrics = plantHealth.metrics ?? {};
    const riskScore = modelMetric(metrics.riskScore);
    const riskLevel = String(metrics.riskLevel ?? '').trim();
    const photoMatched = metrics.photoEvidenceMatched === true;
    const title = String(details.title ?? 'Bitki sağlığı risk takibi').trim();
    const meaning = String(details.detail ?? '').trim();

    insights.push({
      id: 'plant-health-synthesis-evidence',
      title,
      meaning: meaning || 'Risk Radar sonucu bitki sağlığı karar akışına gerçek kaynaklarıyla bağlandı.',
      action: 'İklimsel risk sinyalini sahada belirti kontrolüyle doğrula; fotoğraf AI ön değerlendirmesini kesin teşhis olarak kullanma.',
      evidence: [
        { label: 'Risk seviyesi', value: riskLevel || 'veri yok' },
        { label: 'Risk skoru', value: riskScore === null ? 'veri yok' : `%${Math.round(riskScore)}` },
        { label: 'Fotoğraf kanıtı', value: photoMatched ? 'Etiket eşleşti · ön değerlendirme' : 'Eşleşen fotoğraf kanıtı yok' },
      ],
      confidence: photoMatched ? 'medium' : 'limited',
    });
  }

  const observationFollowUp = latestDecisionEvidence(snapshot, 'satellite-field-observation-follow-up');
  if (observationFollowUp) {
    const details = observationFollowUp.details ?? {};
    const metrics = observationFollowUp.metrics ?? {};
    const status = String(metrics.trackedIssueStatus ?? metrics.comparisonStatus ?? 'unknown');
    const area = String(details.direction ?? 'Takip alanı').trim();
    const comparisonSummary = String(details.trackedIssueSummary ?? details.comparisonSummary ?? '').trim();
    const dueForPhoto = metrics.dueForPhoto === true;
    const statusLabel = status === 'improving'
      ? 'iyileşiyor'
      : status === 'worsening'
        ? 'kötüleşiyor'
        : status === 'stable'
          ? 'benzer seyrediyor'
          : status === 'not_visible'
            ? 'yeni fotoğrafta görünmüyor'
            : 'takipte';

    insights.push({
      id: 'field-observation-follow-up-evidence',
      title: `Saha takip alanı ${statusLabel}`,
      meaning: comparisonSummary || `${area} için aynı nokta fotoğraf/uydu takibi rapora bağlandı.`,
      action: dueForPhoto
        ? 'Takip alanından aynı noktaya yakın yeni fotoğraf çek; değişimi önceki saha kanıtıyla karşılaştır.'
        : 'Yeni uydu veya planlı takip tarihi geldiğinde aynı noktadan yeniden fotoğrafla doğrula.',
      evidence: [
        { label: 'Alan', value: area },
        { label: 'Takip durumu', value: statusLabel },
        { label: 'Yeni fotoğraf', value: dueForPhoto ? 'Zamanı geldi' : 'Henüz değil' },
      ],
      confidence: status === 'unknown' ? 'limited' : 'medium',
    });

    if (dueForPhoto) {
      next7Days.push(`${area} takip alanından aynı noktaya yakın yeni fotoğraf çek; Pusula önceki kanıtla karşılaştırsın.`);
    }
  }

  if (!snapshot.soilAnalyses.length) {
    next7Days.push(
      'Toprak analizin varsa ekle; besleme yorumlarının yalnız uydu görüntüsüne dayanmasını önle.',
    );
  }

  const uniqueActions = [...new Set(next7Days)].slice(0, 5);
  const main = insights[0];

  return {
    weeklyHeadline: main?.title ?? 'Bu haftanın tarla özeti',
    weeklySummary:
      main?.meaning ??
      'Mevcut gerçek kayıtlar bir araya getirildi. Yeni ölçümler geldikçe haftalık yorum güçlenecek.',
    insights,
    next7Days: uniqueActions,
    dataQualityNote:
      snapshot.missing.length > 0
        ? `Eksik veri kaynakları: ${snapshot.missing.length}. PUSULAPDF eksik alanlar için değer veya kesin neden üretmez.`
        : 'Ana veri kaynakları bağlı. Yorumlar yine saha gözlemiyle birlikte değerlendirilmelidir.',
  };
}
