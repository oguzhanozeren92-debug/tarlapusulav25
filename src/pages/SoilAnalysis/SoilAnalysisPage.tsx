import { useEffect, useMemo, useState } from 'react';
import {
  Beaker,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FileText,
  FileUp,
  FlaskConical,
  History,
  Home,
  Info,
  LandPlot,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  Sprout,
  TestTube2,
} from 'lucide-react';
import MobileWheelPicker from '../../components/MobileWheelPicker';
import {
  analyzeSoilReport,
  findNearbySoilLabs,
  getSoilAnalysisFileUrl,
  listSoilAnalyses,
  loadDistrictOptions,
  loadProvinceOptions,
  type SoilAnalysisRecord,
  type SoilLabResult,
} from '../../lib/soilAnalysisService';
import './soilAnalysis.css';
import { addPoints } from '../../gamification/useGamificationStore';
import {
  fetchSoilGridsProfile,
  type SoilGridsProfile,
} from '../../services/soilGridsService';

type Field = {
  id: string | number;
  name: string;
  crop?: string;
  area?: number;
  ada?: string | number;
  parsel?: string | number;
  city?: string;
  district?: string;
  village?: string;
  latitude?: number | null;
  longitude?: number | null;
  parcelCentroidLat?: number | null;
  parcelCentroidLng?: number | null;
};

type MenuItem = {
  screen: string;
  label: string;
  badge?: string;
};

type Props = {
  fields: Field[];
  selectedFieldId: string;
  onFieldChange: (id: string) => void;
  onBack: () => void;
  // Eski App sürümleri bu iki prop'u hâlâ gönderebilir; Toprak modülü artık
  // DEM/Sentinel haritasına yönlendirme yapmadığı için uyumluluk amacıyla tutulur.
  onOpenDemMap?: () => void;
  onOpenSentinel1Map?: () => void;
  onNavigate?: (screen: string) => void;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setSideMenuOpen?: (open: boolean) => void;
};

type LocationOption = {
  id: number;
  name: string;
};

const SAMPLE_STEPS = [
  {
    no: '1',
    image:
      'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=700&q=82',
    title: 'Tarlayı temsil edecek noktaları seç',
    short: 'Tek bir köşeden numune alma.',
    details:
      'Tarla homojense zikzak yürüyerek yaklaşık 8–15 farklı noktadan alt numune al. Gübre yığını, yol kenarı, su biriken çukur ve sıra dışı bölgeleri genel numuneye karıştırma.',
  },
  {
    no: '2',
    image:
      'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=700&q=82',
    title: 'Yüzeyi temizle ve uygun derinlikten al',
    short: 'Bitki artığını numuneye katma.',
    details:
      'Yüzeydeki yaprak, sap ve taşları uzaklaştır. Tarla bitkilerinde çoğu rutin analiz için 0–20/30 cm katman kullanılır. Özel analizlerde laboratuvarın istediği derinliği esas al.',
  },
  {
    no: '3',
    image:
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=700&q=82',
    title: 'Alt numuneleri temiz kapta karıştır',
    short: 'Homojen bir birleşik numune hazırla.',
    details:
      'Aynı derinlikten aldığın alt numuneleri temiz plastik kovada iyice karıştır. Çok ıslak toprağı kapalı poşette uzun süre bekletme.',
  },
  {
    no: '4',
    image:
      'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=700&q=82',
    title: 'Yaklaşık 0,5–1 kg temsili numune gönder',
    short: 'Etiketlemeyi unutma.',
    details:
      'Karışımın içinden laboratuvarın istediği miktarı ayır. Rutin toprak analizlerinde yaklaşık 500 g–1 kg çoğu durumda yeterlidir. Kesin miktarı laboratuvara sor.',
  },
];

export default function SoilAnalysisPage({
  fields,
  selectedFieldId,
  onFieldChange,
  onBack,
  onNavigate,
  setSideMenuOpen,
}: Props) {
  const realFields = fields.filter(
    (field) => !String(field.id).startsWith('demo'),
  );

  const selectedField =
    fields.find((field) => String(field.id) === selectedFieldId) ??
    realFields[0] ??
    fields[0];

  const selectedFieldIsDemo = Boolean(
    selectedField && String(selectedField.id).startsWith('demo'),
  );

  useEffect(() => {
    if (selectedFieldIsDemo && realFields.length > 0) {
      onFieldChange(String(realFields[0].id));
    }
  }, [onFieldChange, realFields, selectedFieldIsDemo]);

  const [reportFile, setReportFile] = useState<File | null>(null);

  const [deviceLocation, setDeviceLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);

  const [labsLoading, setLabsLoading] = useState(false);
  const [labsMessage, setLabsMessage] = useState('');
  const [labs, setLabs] = useState<SoilLabResult[]>([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');

  const [latestAnalysis, setLatestAnalysis] =
    useState<SoilAnalysisRecord | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<SoilAnalysisRecord[]>([]);

  const [soilGridsStatus, setSoilGridsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [soilGridsProfile, setSoilGridsProfile] =
    useState<SoilGridsProfile | null>(null);
  const [soilGridsMessage, setSoilGridsMessage] = useState('');

  const fieldLat =
    selectedField?.parcelCentroidLat ?? selectedField?.latitude ?? null;

  const fieldLng =
    selectedField?.parcelCentroidLng ?? selectedField?.longitude ?? null;

  const hasFieldLocation =
    Number.isFinite(Number(fieldLat)) &&
    Number.isFinite(Number(fieldLng));

  const loadSoilGridsForSelectedField = async (
    forceRefresh = false,
    signal?: AbortSignal,
  ) => {
    if (!selectedField || selectedFieldIsDemo || !hasFieldLocation) {
      setSoilGridsStatus('idle');
      setSoilGridsProfile(null);
      setSoilGridsMessage(
        selectedFieldIsDemo
          ? 'Tahmini toprak profili gerçek bir tarla seçildiğinde hazırlanır.'
          : 'SoilGrids profili için seçili tarlada koordinat bulunmalı.',
      );
      return;
    }

    const latitude = Number(fieldLat);
    const longitude = Number(fieldLng);

    try {
      setSoilGridsStatus('loading');
      setSoilGridsMessage('');

      const profile = await fetchSoilGridsProfile(latitude, longitude, {
        forceRefresh,
        signal,
      });

      if (signal?.aborted) return;

      const primaryValues = [
        profile.properties.ph.topsoil0To30,
        profile.properties.organicCarbon.topsoil0To30,
        profile.texture.clayPercent,
        profile.texture.sandPercent,
        profile.texture.siltPercent,
      ];

      if (primaryValues.every((value) => value === null)) {
        throw new Error(
          profile.warnings[0] ||
            'SoilGrids bu koordinat için kullanılabilir değer döndürmedi.',
        );
      }

      setSoilGridsProfile(profile);
      setSoilGridsStatus('ready');

      if (profile.warnings.length > 0) {
        setSoilGridsMessage(
          `Profil hazır; ${profile.warnings.length} alt katman geçici olarak alınamadı.`,
        );
      }
    } catch (error) {
      if (signal?.aborted) return;

      setSoilGridsProfile(null);
      setSoilGridsStatus('error');
      setSoilGridsMessage(
        error instanceof Error
          ? error.message
          : 'Tahmini SoilGrids profili alınamadı.',
      );
    }
  };

  const province = provinces.find(
    (item) => String(item.id) === provinceId,
  );

  const district = districts.find(
    (item) => String(item.id) === districtId,
  );

  const effectiveLocation = useMemo(() => {
    if (deviceLocation) {
      return {
        source: 'device' as const,
        lat: deviceLocation.lat,
        lng: deviceLocation.lng,
        city: selectedField?.city ?? province?.name ?? '',
        district: selectedField?.district ?? district?.name ?? '',
        label: 'Cihaz konumu',
      };
    }

    if (hasFieldLocation) {
      return {
        source: 'field' as const,
        lat: Number(fieldLat),
        lng: Number(fieldLng),
        city: selectedField?.city ?? '',
        district: selectedField?.district ?? '',
        label: `${selectedField?.name ?? 'Seçili tarla'} konumu`,
      };
    }

    return {
      source: 'manual' as const,
      lat: null,
      lng: null,
      city: province?.name ?? '',
      district: district?.name ?? '',
      label:
        district?.name && province?.name
          ? `${district.name} / ${province.name}`
          : province?.name || 'İl / ilçe seçilmedi',
    };
  }, [
    deviceLocation,
    district?.name,
    fieldLat,
    fieldLng,
    hasFieldLocation,
    province?.name,
    selectedField?.city,
    selectedField?.district,
    selectedField?.name,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    void loadSoilGridsForSelectedField(false, controller.signal);

    return () => {
      controller.abort();
    };
    // Seçili tarla/koordinat değişince SoilGrids profilini yeniden hazırla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedField?.id,
    selectedFieldIsDemo,
    fieldLat,
    fieldLng,
    hasFieldLocation,
  ]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        setLocationOptionsLoading(true);

        const data = await loadProvinceOptions();

        if (mounted) {
          setProvinces(data);
        }
      } catch (error) {
        console.error('İller yüklenemedi:', error);
      } finally {
        if (mounted) {
          setLocationOptionsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setDistrictId('');
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        setLocationOptionsLoading(true);

        const data = await loadDistrictOptions(Number(provinceId));

        if (mounted) {
          setDistricts(data);
          setDistrictId('');
        }
      } catch (error) {
        console.error('İlçeler yüklenemedi:', error);
      } finally {
        if (mounted) {
          setLocationOptionsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [provinceId]);

  useEffect(() => {
    if (
      !selectedField?.id ||
      String(selectedField.id).startsWith('demo')
    ) {
      setHistory([]);
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        setHistoryLoading(true);

        const rows = await listSoilAnalyses(
          String(selectedField.id),
        );

        if (mounted) {
          setHistory(rows);
          setLatestAnalysis(rows[0] ?? null);
        }
      } catch (error) {
        console.warn(
          'Toprak analiz geçmişi yüklenemedi:',
          error,
        );
      } finally {
        if (mounted) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedField?.id]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(
        'Bu cihaz konum paylaşımını desteklemiyor.',
      );
      return;
    }

    setLocationLoading(true);
    setLocationMessage('Konum alınıyor...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setLocationLoading(false);
        setLocationMessage('Cihaz konumu hazır.');
      },

      () => {
        setLocationLoading(false);

        setLocationMessage(
          'Konum izni verilmedi. Tarla konumu varsa onu, yoksa il / ilçe seçimini kullanabilirsin.',
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  };

  const handleFindLabs = async () => {
    if (
      effectiveLocation.source === 'manual' &&
      (!effectiveLocation.city ||
        !effectiveLocation.district)
    ) {
      setLabs([]);

      setLabsMessage(
        'Cihaz veya tarla konumu yoksa önce il ve ilçe seç.',
      );

      return;
    }

    try {
      setLabsLoading(true);
      setLabsMessage('');

      const results = await findNearbySoilLabs({
        latitude: effectiveLocation.lat,
        longitude: effectiveLocation.lng,
        city: effectiveLocation.city,
        district: effectiveLocation.district,
      });

      setLabs(results);

      setLabsMessage(
        results.length
          ? `${results.length} analiz/laboratuvar sonucu bulundu. Gitmeden önce toprak analizi yaptıklarını telefonla doğrulaman iyi olur.`
          : 'Bu konum için sonuç bulunamadı. İl/ilçe değiştirerek tekrar deneyebilirsin.',
      );
    } catch (error) {
      setLabs([]);

      setLabsMessage(
        error instanceof Error
          ? error.message
          : 'Yakındaki laboratuvarlar getirilemedi.',
      );
    } finally {
      setLabsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedField) {
      setAnalysisMessage(
        'Önce analizin ait olduğu tarlayı seç.',
      );
      return;
    }

    if (String(selectedField.id).startsWith('demo')) {
      setAnalysisMessage(
        'Bu örnek tarla yalnızca önizleme içindir. Analiz sonucunu kaydedebilmek için Tarlalarım bölümünde kayıtlı gerçek bir tarla seçmelisin.',
      );
      return;
    }

    if (!reportFile) {
      setAnalysisMessage(
        'Önce PDF veya fotoğraf olarak analiz raporunu yükle.',
      );
      return;
    }

    try {
      setAnalysisLoading(true);

      setAnalysisMessage(
        'Rapor yükleniyor ve Toprak Analizi AI tarafından yorumlanıyor...',
      );

      const record = await analyzeSoilReport({
        file: reportFile,

        field: {
          id: String(selectedField.id),
          name: selectedField.name,
          crop: selectedField.crop ?? '',
          area: selectedField.area ?? null,
          ada: selectedField.ada ?? null,
          parsel: selectedField.parsel ?? null,
          city: selectedField.city ?? '',
          district: selectedField.district ?? '',
          village: selectedField.village ?? '',
        },
      });

      setLatestAnalysis(record);

      setHistory((current) => [
        record,
        ...current.filter(
          (item) => item.id !== record.id,
        ),
      ]);

      let pointMessage = '';

      try {
        const reward = await addPoints('ADD_SOIL_ANALYSIS', {
          dedupeKey: `soil-analysis:${String(record.id)}`,
          metadata: {
            source: 'soil_analysis',
            analysisId: String(record.id),
            fieldId: String(selectedField.id),
            fieldName: selectedField.name,
          },
          toastTitle: 'Toprak analizi ödülü',
        });

        if (reward.awarded && reward.awardedPoints > 0) {
          pointMessage = ` +${reward.awardedPoints} Puan kazandın.`;
        }
      } catch (pointError) {
        console.warn(
          'Toprak analizi puanı verilemedi; analiz kaydı korunuyor:',
          pointError,
        );
      }

      setAnalysisMessage(
        `AI yorumu hazır, sisteme kaydedildi ve PDF raporu oluşturuldu.${pointMessage}`,
      );
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : 'Toprak analizi yorumlanamadı.',
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const openStoredFile = async (
    path: string | null | undefined,
    kind: 'report' | 'pdf',
  ) => {
    if (!path) return;

    try {
      const url = await getSoilAnalysisFileUrl(path);

      window.open(
        url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (error) {
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : `${
              kind === 'pdf' ? 'PDF' : 'Rapor'
            } açılamadı.`,
      );
    }
  };

  const navigate = (screen: string) => {
    if (screen === 'home') {
      onBack();
      return;
    }
    onNavigate?.(screen);
  };

  const soilValue = (value: number | null | undefined, digits = 1) =>
    value == null || !Number.isFinite(Number(value))
      ? '—'
      : Number(value).toFixed(digits);

  const fieldOptions = [...realFields, ...fields.filter((field) =>
    String(field.id).startsWith('demo'),
  )].map((field) => {
    const isDemo = String(field.id).startsWith('demo');
    return {
      value: String(field.id),
      label: `${field.name}${field.crop ? ` · ${field.crop}` : ''}${isDemo ? ' · ÖRNEK' : ''}`,
      description: isDemo
        ? 'Önizleme tarlası · analiz kaydedilemez'
        : field.area != null
          ? `${field.area.toLocaleString('tr-TR')} da · ${field.ada ?? '-'} Ada / ${field.parsel ?? '-'} Parsel`
          : '',
    };
  });

  return (
    <div className="soil-page soil-module-page">
      <main className="soil-main soil-module-main">
        <section className="soil-module-intro">
          <div className="soil-module-intro-icon" aria-hidden="true">
            <LandPlot size={22} />
          </div>
          <div>
            <span>TOPRAK</span>
            <h1>Toprağı tanı, laboratuvar sonucuyla netleştir.</h1>
            <p>
              Önce model tahminini gör. Elinde analiz varsa yükle; yoksa doğru
              numune alma adımlarını ve yakın laboratuvarları buradan bul.
            </p>
          </div>
        </section>

        <section className="soil-module-stack">
          <article className="soil-card soil-profile-card soil-profile-combined">
            <div className="soil-profile-field" aria-label="Seçili tarla">
              <div className="soil-profile-field-copy">
                <small>SEÇİLİ TARLA</small>
                <strong>{selectedField?.name ?? 'Tarla seç'}</strong>
                <span>{selectedField?.crop || 'Ürün bilgisi yok'}</span>
              </div>
              <MobileWheelPicker
                title="Toprak bilgisi gösterilecek tarla"
                value={String(selectedField?.id ?? '')}
                onChange={onFieldChange}
                options={fieldOptions}
                placeholder="Tarla seç"
              />
            </div>

            <div className="soil-profile-divider" />

            <div className="soil-card-head">
              <span className="soil-card-icon"><Sprout size={19} /></span>
              <div>
                <small>MODEL TAHMİNİ</small>
                <strong>Tahmini Toprak Profili</strong>
                <p>SoilGrids · yaklaşık 250 m çözünürlük · 0–30 cm üst toprak</p>
              </div>
              <button
                type="button"
                className="soil-icon-button"
                onClick={() => void loadSoilGridsForSelectedField(true)}
                disabled={soilGridsStatus === 'loading' || !hasFieldLocation || selectedFieldIsDemo}
                aria-label="Tahmini toprak profilini yenile"
              >
                <RefreshCw size={16} className={soilGridsStatus === 'loading' ? 'soil-spin' : ''} />
              </button>
            </div>

            {soilGridsStatus === 'loading' && (
              <div className="soil-state-row">
                <span className="soil-loader" />
                <div>
                  <strong>Tahmini profil hazırlanıyor</strong>
                  <p>pH, organik karbon ve toprak bünyesi gerçek SoilGrids verisinden okunuyor.</p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'idle' && (
              <div className="soil-state-row">
                <MapPin size={18} />
                <div>
                  <strong>Tarla konumu gerekli</strong>
                  <p>{soilGridsMessage || 'Koordinatı bulunan gerçek bir tarla seç.'}</p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'error' && (
              <div className="soil-state-row soil-state-error">
                <CircleAlert size={18} />
                <div>
                  <strong>Tahmini profil alınamadı</strong>
                  <p>{soilGridsMessage || 'SoilGrids servisine şu anda ulaşılamıyor.'}</p>
                </div>
              </div>
            )}

            {soilGridsStatus === 'ready' && soilGridsProfile && (
              <>
                <div className="soil-metric-grid">
                  <div><small>pH</small><strong>{soilValue(soilGridsProfile.properties.ph.topsoil0To30)}</strong><span>H₂O</span></div>
                  <div><small>Organik karbon</small><strong>{soilValue(soilGridsProfile.properties.organicCarbon.topsoil0To30)}</strong><span>g/kg</span></div>
                  <div><small>Kil</small><strong>{soilGridsProfile.texture.clayPercent == null ? '—' : `%${soilValue(soilGridsProfile.texture.clayPercent)}`}</strong><span>0–30 cm</span></div>
                  <div><small>Kum</small><strong>{soilGridsProfile.texture.sandPercent == null ? '—' : `%${soilValue(soilGridsProfile.texture.sandPercent)}`}</strong><span>0–30 cm</span></div>
                  <div><small>Silt</small><strong>{soilGridsProfile.texture.siltPercent == null ? '—' : `%${soilValue(soilGridsProfile.texture.siltPercent)}`}</strong><span>0–30 cm</span></div>
                </div>

                <details className="soil-depth-details">
                  <summary>
                    <span><TestTube2 size={16} /> Derinliğe göre tahmini değerler</span>
                    <ChevronRight size={16} />
                  </summary>
                  <div className="soil-depth-table">
                    <div className="soil-depth-row soil-depth-head">
                      <span>Derinlik</span><span>pH</span><span>SOC</span><span>Kil</span><span>Kum</span><span>Silt</span>
                    </div>
                    {(['0-5cm', '5-15cm', '15-30cm'] as const).map((depth) => {
                      const layerValue = (key: 'ph' | 'organicCarbon' | 'clay' | 'sand' | 'silt') =>
                        soilGridsProfile.properties[key].layers.find((item) => item.depth === depth)?.value ?? null;
                      return (
                        <div className="soil-depth-row" key={depth}>
                          <strong>{depth.replace('cm', ' cm')}</strong>
                          <span>{soilValue(layerValue('ph'))}</span>
                          <span>{soilValue(layerValue('organicCarbon'))}</span>
                          <span>{layerValue('clay') == null ? '—' : `%${soilValue(layerValue('clay'))}`}</span>
                          <span>{layerValue('sand') == null ? '—' : `%${soilValue(layerValue('sand'))}`}</span>
                          <span>{layerValue('silt') == null ? '—' : `%${soilValue(layerValue('silt'))}`}</span>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {soilGridsMessage && <p className="soil-inline-message">{soilGridsMessage}</p>}
              </>
            )}

            <div className="soil-trust-note">
              <Info size={17} />
              <div>
                <strong>Bu bir laboratuvar sonucu değildir.</strong>
                <p>
                  SoilGrids tarlanın çevresindeki model tahminini verir. Gübreleme,
                  kireçleme veya toprak düzeltme kararında gerçek laboratuvar analizi
                  her zaman daha güçlü kanıttır.
                </p>
              </div>
            </div>
          </article>

          <article className="soil-card soil-upload-card">
            <div className="soil-card-head">
              <span className="soil-card-icon"><FileUp size={19} /></span>
              <div>
                <small>GERÇEK ANALİZ</small>
                <strong>Toprak Analizi Yükle</strong>
                <p>PDF veya rapor fotoğrafını tarlaya bağla; Pusula değerleri okuyup yorumlasın.</p>
              </div>
            </div>

            <label className={`soil-upload-zone ${reportFile ? 'has-file' : ''}`}>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setReportFile(event.target.files?.[0] ?? null);
                  setAnalysisMessage('');
                }}
              />
              <span className="soil-upload-icon">{reportFile ? <FileText size={22} /> : <FileUp size={22} />}</span>
              <div>
                <strong>{reportFile?.name || 'Analiz raporunu seç'}</strong>
                <small>{reportFile ? `${Math.max(1, Math.round(reportFile.size / 1024))} KB · hazır` : 'PDF · JPG · PNG · WEBP'}</small>
              </div>
              <ChevronRight size={18} />
            </label>

            <div className="soil-upload-field">
              <span>Bu rapor hangi tarlaya ait?</span>
              <MobileWheelPicker
                title="Analizin ait olduğu tarla"
                value={String(selectedField?.id ?? '')}
                onChange={onFieldChange}
                options={fieldOptions}
              />
            </div>

            {selectedFieldIsDemo && (
              <div className="soil-warning-note">
                <CircleAlert size={17} />
                <span>Örnek tarlaya analiz kaydedilemez. Kayıtlı gerçek bir tarla seç.</span>
              </div>
            )}

            <button
              type="button"
              className="soil-primary-button"
              disabled={!reportFile || !selectedField || selectedFieldIsDemo || analysisLoading}
              onClick={handleAnalyze}
            >
              <Sparkles size={17} />
              {analysisLoading ? 'Rapor okunuyor…' : 'Pusula ile Oku · Kaydet · PDF Oluştur'}
            </button>

            {analysisMessage && <div className="soil-action-message">{analysisMessage}</div>}
          </article>

          {latestAnalysis?.ai_result && (
            <article className="soil-card soil-pusula-card">
              <div className="soil-card-head">
                <span className="soil-card-icon"><Sparkles size={19} /></span>
                <div>
                  <small>PUSULA TOPRAK YORUMU</small>
                  <strong>{latestAnalysis.summary || 'Son laboratuvar analizi'}</strong>
                  <p>{latestAnalysis.status_label || 'Laboratuvar raporuna göre değerlendirme'}</p>
                </div>
              </div>

              <div className="soil-ai-grid">
                <div><small>Toprak özeti</small><p>{latestAnalysis.ai_result.soilSummary || '—'}</p></div>
                <div><small>Ürüne göre</small><p>{latestAnalysis.ai_result.cropInterpretation || '—'}</p></div>
              </div>

              {(latestAnalysis.ai_result.attentionPoints ?? []).length > 0 && (
                <div className="soil-list-box">
                  <strong>Dikkat edilecekler</strong>
                  <ul>{(latestAnalysis.ai_result.attentionPoints ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}

              {(latestAnalysis.ai_result.recommendations ?? []).length > 0 && (
                <div className="soil-list-box">
                  <strong>Öneriler</strong>
                  <ul>{(latestAnalysis.ai_result.recommendations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}

              <div className="soil-secondary-actions">
                <button type="button" onClick={() => void openStoredFile(latestAnalysis.report_path, 'report')} disabled={!latestAnalysis.report_path}>
                  <FileText size={15} /> Orijinal rapor
                </button>
                <button type="button" onClick={() => void openStoredFile(latestAnalysis.pdf_path, 'pdf')} disabled={!latestAnalysis.pdf_path}>
                  <FileText size={15} /> Pusula PDF
                </button>
              </div>
            </article>
          )}

          <article className="soil-card soil-guide-card">
            <div className="soil-card-head">
              <span className="soil-card-icon"><Beaker size={19} /></span>
              <div>
                <small>SAHADA</small>
                <strong>Toprak Analizi Nasıl Alınır?</strong>
                <p>Laboratuvara göndermeden önce temsili bir numune hazırlamak için kısa rehber.</p>
              </div>
            </div>

            <div className="soil-sample-steps">
              {SAMPLE_STEPS.map((step) => (
                <details key={step.no} className="soil-sample-step" open={step.no === '1'}>
                  <summary>
                    <span className="soil-step-number">{step.no}</span>
                    <div><strong>{step.title}</strong><small>{step.short}</small></div>
                    <ChevronRight size={17} />
                  </summary>
                  <p>{step.details}</p>
                </details>
              ))}
            </div>

            <div className="soil-soft-note">
              <Info size={16} />
              <span>Numune derinliği ve miktarı analiz türüne göre değişebilir. Laboratuvarın kabul talimatı varsa onu esas al.</span>
            </div>
          </article>

          <article className="soil-card soil-labs-card">
            <div className="soil-card-head">
              <span className="soil-card-icon"><FlaskConical size={19} /></span>
              <div>
                <small>LABORATUVAR</small>
                <strong>Yakındaki Laboratuvarlar</strong>
                <p>Önce tarla konumu, istersen cihaz konumu; ikisi yoksa il/ilçe kullanılır.</p>
              </div>
            </div>

            <div className="soil-location-chip">
              <MapPin size={16} />
              <div><small>Arama konumu</small><strong>{effectiveLocation.label}</strong></div>
            </div>

            <div className="soil-location-buttons">
              <button type="button" onClick={requestLocation} disabled={locationLoading}>
                <LocateFixed size={16} /> {locationLoading ? 'Konum alınıyor…' : 'Cihaz konumu'}
              </button>
              <button type="button" onClick={() => setDeviceLocation(null)} disabled={!hasFieldLocation}>
                <LandPlot size={16} /> Tarla konumu
              </button>
            </div>

            {!deviceLocation && !hasFieldLocation && (
              <div className="soil-manual-location">
                <MobileWheelPicker
                  title="İl seç"
                  value={provinceId}
                  onChange={setProvinceId}
                  options={provinces.map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder={locationOptionsLoading ? 'İller yükleniyor…' : 'İl seç'}
                />
                <MobileWheelPicker
                  title="İlçe seç"
                  value={districtId}
                  onChange={setDistrictId}
                  options={districts.map((item) => ({ value: String(item.id), label: item.name }))}
                  disabled={!provinceId || locationOptionsLoading}
                  placeholder={!provinceId ? 'Önce il seç' : locationOptionsLoading ? 'İlçeler yükleniyor…' : 'İlçe seç'}
                />
              </div>
            )}

            {locationMessage && <p className="soil-inline-message">{locationMessage}</p>}

            <button type="button" className="soil-primary-button soil-lab-search" onClick={handleFindLabs} disabled={labsLoading}>
              <MapPin size={17} /> {labsLoading ? 'Laboratuvarlar aranıyor…' : 'Laboratuvarları Bul'}
            </button>

            {labsMessage && <p className="soil-inline-message">{labsMessage}</p>}

            {labs.length > 0 && (
              <div className="soil-lab-list">
                {labs.map((lab) => (
                  <article key={`${lab.name}-${lab.latitude}-${lab.longitude}`}>
                    <span className="soil-lab-icon"><FlaskConical size={16} /></span>
                    <div>
                      <strong>{lab.name}</strong>
                      <small>{lab.address || 'Adres bilgisi sınırlı'}</small>
                      <p>
                        {lab.distanceKm != null ? `${lab.distanceKm.toFixed(1)} km` : ''}
                        {lab.distanceKm != null && lab.phone ? ' · ' : ''}
                        {lab.phone || ''}
                      </p>
                    </div>
                    {lab.mapUrl ? <a href={lab.mapUrl} target="_blank" rel="noreferrer">Yol</a> : null}
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="soil-card soil-history-card">
            <div className="soil-card-head">
              <span className="soil-card-icon"><History size={19} /></span>
              <div>
                <small>GEÇMİŞ</small>
                <strong>Toprak Analizlerim</strong>
                <p>{selectedField?.name ?? 'Seçili tarla'} · {history.length} kayıt</p>
              </div>
            </div>

            {historyLoading ? (
              <div className="soil-empty-state">Analiz geçmişi yükleniyor…</div>
            ) : history.length === 0 ? (
              <div className="soil-empty-state">
                <FileText size={21} />
                <strong>Henüz kayıtlı analiz yok</strong>
                <span>İlk raporu yüklediğinde burada tarih sırasıyla saklanacak.</span>
              </div>
            ) : (
              <div className="soil-history-list-new">
                {history.map((item) => (
                  <article key={item.id}>
                    <div className="soil-history-date">
                      <CalendarDays size={15} />
                      <span>{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div>
                      <strong>{item.summary || 'Toprak Analizi'}</strong>
                      <small>{item.crop ? `${item.crop} · ` : ''}{item.status_label || 'Değerlendirildi'}</small>
                    </div>
                    <button type="button" onClick={() => setLatestAnalysis(item)} aria-label="Analiz yorumunu aç">
                      <ChevronRight size={17} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>

      <nav className="soil-app-bottom-nav" aria-label="Ana uygulama menüsü">
        <button type="button" onClick={() => navigate('home')}>
          <Home size={18} /><span>Ana Sayfa</span>
        </button>
        <button type="button" onClick={() => navigate('home')}>
          <LandPlot size={18} /><span>Tarlalarım</span>
        </button>
        <button type="button" className="soil-bottom-ai" onClick={() => navigate('aiAnalysis')}>
          <b><Sparkles size={20} /></b><span>AI Analiz</span>
        </button>
        <button type="button" onClick={() => navigate('calendar')}>
          <CalendarDays size={18} /><span>Takvim</span>
        </button>
        <button type="button" onClick={() => setSideMenuOpen?.(true)}>
          <MoreHorizontal size={19} /><span>Daha Fazla</span>
        </button>
      </nav>
    </div>
  );
}
