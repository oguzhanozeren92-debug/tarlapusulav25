import MobileWheelPicker from '../components/MobileWheelPicker';
import PcsePilotReadiness from '../features/field-detail/components/PcsePilotReadiness';
import FieldGrowthObservations from '../features/field-detail/components/FieldGrowthObservations';
import FieldGrowthStatus from '../features/field-detail/components/FieldGrowthStatus';
import SeasonModelInputs from '../features/field-detail/components/SeasonModelInputs';
import FieldCostSummary from '../features/field-detail/components/FieldCostSummary';
import FieldSeasonSummary from '../features/field-detail/components/FieldSeasonSummary';
import FieldIrrigationMethod from '../features/field-detail/components/FieldIrrigationMethod';
import { useEffect, useState } from 'react';
import './FieldDetailLayout.css';
import { getEntitlementSnapshot } from '../entitlements/useEntitlementStore';
import { onboardingStyles } from '../styles/onboardingStyles';

type FieldDetailScreenProps = Record<string, any>;

export default function FieldDetailScreen(props: FieldDetailScreenProps) {
  const {
    activities,
    activitiesLoading,
    activityCost,
    activityDate,
    activityDoseMode,
    activityDurationHours,
    activityFormLoading,
    activityFormOpen,
    activityMessage,
    activityNotes,
    activityPhoto,
    activityPhotoPreview,
    activityProductName,
    activityQuantity,
    activityType,
    activityUnit,
    activityWaterM3,
    aiAnalysis,
    aiAnalysisError,
    aiAnalyzing,
    annualCrop,
    annualFormLoading,
    annualFormOpen,
    annualHarvestDate,
    annualNotes,
    annualPlantingDate,
    annualSeasons,
    annualYear,
    clearActivityPhoto,
    cmsRuntimeCss,
    detailBearing,
    detailCropCycle,
    detailPlantingYear,
    fieldDetailEntry,
    fieldFabOpen,
    fieldSections,
    handleActivityPhotoChange,
    handleAddActivity,
    handleAddAnnualSeason,
    handleAddFieldSection,
    handleAddPerennialYield,
    handleAiAnalyzeActivityPhoto,
    handleDeleteActivity,
    handleDeleteField,
    handleDeleteAnnualSeason,
    handleDeleteFieldSection,
    handleDeletePerennialYield,
    handleSaveProductionProfile,
    historyLoading,
    historyMessage,
    openActivityForm,
    openAiAnalysisScreen,
    openReminderModal,
    openSoilAnalysisForField,
    perennialYields,
    productionProfileLoading,
    productionProfileMessage,
    productionProfileOpen,
    resetAnnualForm,
    resetSectionForm,
    resetYieldForm,
    sectionArea,
    sectionCrop,
    sectionFormLoading,
    sectionFormMessage,
    sectionFormOpen,
    sectionName,
    sectionsLoading,
    selectedField,
    setActivityCost,
    setActivityDate,
    setActivityDoseMode,
    setActivityDurationHours,
    setActivityFormOpen,
    setActivityMessage,
    setActivityNotes,
    setActivityProductName,
    setActivityQuantity,
    setActivityType,
    setActivityUnit,
    setActivityWaterM3,
    setAnnualCrop,
    setAnnualFormOpen,
    setAnnualHarvestDate,
    setAnnualNotes,
    setAnnualPlantingDate,
    setAnnualYear,
    setDetailBearing,
    setDetailCropCycle,
    setDetailPlantingYear,
    setFieldFabOpen,
    setProductionProfileMessage,
    setProductionProfileOpen,
    setScreen,
    setSectionArea,
    setSectionCrop,
    setSectionFormMessage,
    setSectionFormOpen,
    setSectionName,
    setYieldFormOpen,
    setYieldHarvestDate,
    setYieldKg,
    setYieldNotes,
    setYieldYear,
    statusInfo,
    yieldFormLoading,
    yieldFormOpen,
    yieldHarvestDate,
    yieldKg,
    yieldNotes,
    yieldYear,
  } = props;

  const opensSeasonTask =
    fieldDetailEntry?.actionTarget === 'field-season' &&
    String(fieldDetailEntry?.fieldId ?? '') === String(selectedField?.id ?? '');
  const opensGrowthTarget =
    fieldDetailEntry?.actionTarget === 'field-growth' &&
    String(fieldDetailEntry?.fieldId ?? '') === String(selectedField?.id ?? '');

  const [activeDetailTab, setActiveDetailTab] =
    useState<'overview' | 'production' | 'history'>(
      opensSeasonTask || opensGrowthTarget ? 'production' : 'overview',
    );
  const [deleteFieldOpen, setDeleteFieldOpen] = useState(false);
  const [deleteFieldLoading, setDeleteFieldLoading] = useState(false);
  const [deleteFieldError, setDeleteFieldError] = useState('');
  const isPremiumFieldPlan = getEntitlementSnapshot().isPremium;

  const confirmDeleteField = async () => {
    setDeleteFieldLoading(true);
    setDeleteFieldError('');
    try {
      await handleDeleteField(selectedField);
      setDeleteFieldOpen(false);
    } catch (error) {
      setDeleteFieldError(error instanceof Error ? error.message : 'Tarla silinemedi. Tekrar dene.');
    } finally {
      setDeleteFieldLoading(false);
    }
  };

  useEffect(() => {
    if (opensGrowthTarget) {
      setActiveDetailTab('production');

      window.setTimeout(() => {
        const details = document.getElementById(
          'tp-field-growth-detail',
        ) as HTMLDetailsElement | null;

        if (details) details.open = true;
        details?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 260);

      return;
    }

    if (opensSeasonTask) {
      setActiveDetailTab('production');
      setAnnualFormOpen(true);

      window.setTimeout(() => {
        const input = document.getElementById(
          'tp-field-season-planting-date',
        ) as HTMLInputElement | null;

        input?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        input?.focus();
      }, 260);

      return;
    }

    setActiveDetailTab('overview');
  }, [
    selectedField.id,
    fieldDetailEntry?.nonce,
    opensSeasonTask,
    opensGrowthTarget,
    setAnnualFormOpen,
  ]);

  useEffect(() => {
    if (activityFormOpen) setActiveDetailTab('history');
  }, [activityFormOpen]);

  const detailInfo = statusInfo[selectedField.status];

    const scrollFieldDetailTo = (id: string) => {
      setFieldFabOpen(false);
      setActiveDetailTab(id === 'field-info' ? 'overview' : 'production');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 40);
    };

    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles}</style>

        <div className="tp-field-detail-page">
          <header className="tp-field-detail-header">
            <button
              className="tp-field-detail-back"
              onClick={() => setScreen('home')}
            >
              ←
            </button>

            <div>
              <span>Tarla Detayları</span>
              <strong>{selectedField.name}</strong>
            </div>

            <button type="button" className="tp-field-detail-more" aria-label="Tarla menüsünü aç" onClick={() => setFieldFabOpen(true)}>•••</button>
          </header>

          <main className="tp-field-detail-content">
            <section id="field-info" className="tp-field-hero-card">
              <div className="tp-field-hero-top">
                <div className="tp-field-hero-icon">🌾</div>

                <div className="tp-field-hero-copy">
                  <div className="tp-field-hero-name-row">
                    <h1>{selectedField.name}</h1>
                    {selectedField.demo && <span className="demoBadge">ÖRNEK</span>}
                  </div>

                  <p>
                    {selectedField.ada} Ada • {selectedField.parsel} Parsel
                  </p>

                  <span>
                    {[selectedField.village, selectedField.district, selectedField.city]
                      .filter(Boolean)
                      .join(' / ') || 'Konum bilgisi henüz eklenmedi'}
                  </span>
                </div>

                <span
                  className="statusPill"
                  style={{
                    color: detailInfo.color,
                    backgroundColor: detailInfo.bg,
                  }}
                >
                  {detailInfo.label}
                </span>
              </div>

              <div className="tp-field-hero-stats">
                <div>
                  <span>Alan</span>
                  <strong>{selectedField.area.toLocaleString('tr-TR')} da</strong>
                </div>

                <div>
                  <span>Ürün</span>
                  <strong>{selectedField.crop}</strong>
                </div>

                <div>
                  <span>Sezon</span>
                  <strong>{selectedField.season}</strong>
                </div>
              </div>
            </section>

            <div className="tp-field-detail-tabs" role="group" aria-label="Tarla detayı bölümleri">
              {([['overview', 'Özet'], ['production', 'Üretim'], ['history', 'İşlemler']] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={activeDetailTab === key}
                  className={activeDetailTab === key ? 'active' : ''} onClick={() => setActiveDetailTab(key)}>
                  {label}
                </button>
              ))}
            </div>

            {activeDetailTab === 'overview' && (
              <section className="tp-field-detail-overview" aria-label="Tarla kayıtları özeti">
                <h2>Bu tarlada neler var?</h2>
                <p>Gerçek kayıtlarına buradan ulaşabilirsin.</p>
                <button type="button" onClick={() => setActiveDetailTab('production')}>
                  <span><strong>Ürün ve bölümler</strong><small>{historyLoading || sectionsLoading ? 'Kayıtlar yükleniyor…' : `${(selectedField.cropCycle ?? 'annual') === 'perennial' ? perennialYields.length : annualSeasons.length} sezon/verim · ${fieldSections.length} bölüm`}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
                <button type="button" onClick={() => setActiveDetailTab('history')}>
                  <span><strong>İşlemler ve masraflar</strong><small>{activitiesLoading ? 'Kayıtlar yükleniyor…' : `${activities.length} işlem · masraf özetini gör`}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
                {!selectedField.demo && (
                  <button type="button" onClick={() => openSoilAnalysisForField(selectedField)}>
                    <span><strong>Toprak analizi</strong><small>Bu tarlanın raporlarını gör veya ekle</small></span>
                    <span aria-hidden="true">›</span>
                  </button>
                )}
              </section>
            )}

            {activeDetailTab === 'production' && (
            <section id="field-production" className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">ÜRETİM</span>
                  <h2>Ürün ve sezon</h2>
                </div>
              </div>

              <div className="tp-field-production-card">
                <div className="tp-field-production-main">
                  <div className="tp-detail-icon">
                    {(selectedField.cropCycle ?? 'annual') === 'perennial' ? '🌳' : '🌱'}
                  </div>
                  <div>
                    <span>Mevcut ürün</span>
                    <strong>{selectedField.crop}</strong>
                    <p>
                      {(selectedField.cropCycle ?? 'annual') === 'perennial'
                        ? 'Çok yıllık ürün'
                        : `${selectedField.season} üretim sezonu • Tek yıllık ürün`}
                    </p>
                  </div>
                </div>

                <div className="tp-production-profile-summary">
                  <div>
                    <span>Ürün tipi</span>
                    <strong>
                      {(selectedField.cropCycle ?? 'annual') === 'perennial'
                        ? 'Çok yıllık'
                        : 'Tek yıllık'}
                    </strong>
                  </div>

                  {(selectedField.cropCycle ?? 'annual') === 'perennial' && (
                    <>
                      <div>
                        <span>Dikim yılı</span>
                        <strong>{selectedField.plantingYear ?? '—'}</strong>
                      </div>

                      <div>
                        <span>Bahçe yaşı</span>
                        <strong>
                          {selectedField.plantingYear
                            ? `${Math.max(
                                0,
                                new Date().getFullYear() - selectedField.plantingYear,
                              )} yaş`
                            : '—'}
                        </strong>
                      </div>

                      <div>
                        <span>Ürün veriyor</span>
                        <strong>
                          {selectedField.bearing === null ||
                          selectedField.bearing === undefined
                            ? '—'
                            : selectedField.bearing
                              ? 'Evet'
                              : 'Henüz değil'}
                        </strong>
                      </div>
                    </>
                  )}

                  {!selectedField.demo && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductionProfileOpen(true);
                        setProductionProfileMessage('');
                      }}
                    >
                      ✎ Düzenle
                    </button>
                  )}
                </div>

                {productionProfileOpen && !selectedField.demo && (
                  <div
                    className="tp-modal-backdrop"
                    role="presentation"
                    onMouseDown={() => setProductionProfileOpen(false)}
                  >
                    <div
                      className="tp-modal-card tp-modal-card-medium"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Ürün tipini düzenle"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="tp-production-profile-form tp-modal-form">
                    <div className="tp-production-profile-title">
                      <div>
                        <span>ÜRÜN TİPİNİ DÜZENLE</span>
                        <strong>Tek yıllık / çok yıllık ayrımını belirle</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProductionProfileOpen(false)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="tp-cycle-choice">
                      <button
                        type="button"
                        className={detailCropCycle === 'annual' ? 'active' : ''}
                        onClick={() => setDetailCropCycle('annual')}
                      >
                        🌾 Tek yıllık
                        <small>Her sezon ayrı ürün/sezon kaydı</small>
                      </button>

                      <button
                        type="button"
                        className={detailCropCycle === 'perennial' ? 'active' : ''}
                        onClick={() => setDetailCropCycle('perennial')}
                      >
                        🌳 Çok yıllık
                        <small>Dikim yılı ve yıllık verim geçmişi</small>
                      </button>
                    </div>

                    {detailCropCycle === 'perennial' && (
                      <div className="tp-production-profile-fields">
                        <label>
                          Dikim yılı
                          <input
                            value={detailPlantingYear}
                            onChange={(e) => setDetailPlantingYear(e.target.value)}
                            inputMode="numeric"
                            placeholder="2018"
                          />
                        </label>

                        <label>
                          Ürün veriyor mu?
                          <MobileWheelPicker
                            title="Ürün veriyor mu?"
                            value={detailBearing ? 'yes' : 'no'}
                            onChange={(value) => setDetailBearing(value === 'yes')}
                            options={[
                              { value: 'yes', label: 'Evet' },
                              { value: 'no', label: 'Henüz değil' },
                            ]}
                          />
                        </label>
                      </div>
                    )}

                    {productionProfileMessage && (
                      <div className="tp-field-section-message">
                        {productionProfileMessage}
                      </div>
                    )}

                    <div className="tp-modal-actions">
                      <button
                        type="button"
                        className="tp-modal-cancel"
                        onClick={() => setProductionProfileOpen(false)}
                      >
                        İptal
                      </button>

                      <button
                        type="button"
                        className="tp-production-profile-save tp-modal-primary"
                        onClick={() => void handleSaveProductionProfile()}
                        disabled={productionProfileLoading}
                      >
                        {productionProfileLoading ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="tp-field-production-actions">
                  <button
                    onClick={() => {
                      if (selectedField.demo) {
                        alert('Örnek tarlaya bölüm eklenmez. Gerçek bir tarla seç.');
                        return;
                      }

                      resetSectionForm();
                      setSectionFormOpen(true);
                      setSectionFormMessage('');
                    }}
                  >
                    + Tarla Bölümü Ekle
                  </button>

                  <button
                    onClick={() => {
                      if (selectedField.demo) {
                        alert('Örnek tarlada geçmiş kaydı oluşturulmaz.');
                        return;
                      }

                      if ((selectedField.cropCycle ?? 'annual') === 'perennial') {
                        resetYieldForm();
                        setYieldFormOpen(true);
                        setAnnualFormOpen(false);
                      } else {
                        resetAnnualForm();
                        setAnnualFormOpen(true);
                        setYieldFormOpen(false);
                      }
                    }}
                  >
                    {(selectedField.cropCycle ?? 'annual') === 'perennial'
                      ? '📊 Yıllık Verim Ekle'
                      : '🕘 Yeni Sezon Ekle'}
                  </button>
                </div>

                {!selectedField.demo && (<details id="tp-field-growth-detail" className="tp-field-detail-deep">
                  <summary>Gelişim takibi ve sezon verileri <span aria-hidden="true">⌄</span></summary>
                  <FieldGrowthStatus field={selectedField} />
                {(selectedField.cropCycle ?? 'annual') === 'annual' && (
                  <PcsePilotReadiness
                    field={selectedField}
                    seasons={annualSeasons}
                    loading={historyLoading}
                    onAddSeason={() => {
                      resetAnnualForm();
                      setAnnualFormOpen(true);
                    }}
                    onEditCropType={() => {
                      setProductionProfileMessage('');
                      setProductionProfileOpen(true);
                    }}
                  />
                )}

                {(selectedField.cropCycle ?? 'annual') === 'annual' && (
                  <FieldGrowthObservations fieldId={String(selectedField.id)} seasons={annualSeasons} />
                )}

                <FieldIrrigationMethod fieldId={String(selectedField.id)} />
                <SeasonModelInputs field={selectedField} seasons={annualSeasons} seasonsLoading={historyLoading} />
                </details>)}

                {!selectedField.demo && (
                  <div className="tp-production-history-block">
                    {(selectedField.cropCycle ?? 'annual') === 'annual' && <FieldSeasonSummary
                      seasons={annualSeasons}
                      activities={activities}
                      loading={historyLoading || activitiesLoading}
                    />}
                    <div className="tp-production-history-head">
                      <div>
                        <span>
                          {(selectedField.cropCycle ?? 'annual') === 'perennial'
                            ? 'VERİM GEÇMİŞİ'
                            : 'SEZON GEÇMİŞİ'}
                        </span>
                        <strong>
                          {(selectedField.cropCycle ?? 'annual') === 'perennial'
                            ? 'Yıllara göre alınan ürün'
                            : 'Yıllara göre ürün ve sezon kayıtları'}
                        </strong>
                      </div>

                      {(selectedField.cropCycle ?? 'annual') === 'perennial' &&
                        selectedField.area > 0 && (
                          <small>kg/da otomatik hesaplanır</small>
                        )}
                    </div>

                    {historyLoading ? (
                      <div className="tp-section-loading">Üretim geçmişi yükleniyor...</div>
                    ) : (selectedField.cropCycle ?? 'annual') === 'perennial' ? (
                      perennialYields.length > 0 ? (
                        <div className="tp-yield-history-list">
                          {perennialYields.map((item) => (
                            <article key={item.id} className="tp-yield-history-card">
                              <div className="tp-yield-year">{item.year}</div>

                              <div className="tp-yield-main">
                                <strong>
                                  {item.yieldKg === null
                                    ? 'Ürün miktarı girilmedi'
                                    : `${item.yieldKg.toLocaleString('tr-TR')} kg`}
                                </strong>

                                <span>
                                  {item.yieldKg !== null && selectedField.area > 0
                                    ? `${(item.yieldKg / selectedField.area).toLocaleString(
                                        'tr-TR',
                                        { maximumFractionDigits: 1 },
                                      )} kg/da`
                                    : 'Dekar verimi hesaplanmadı'}
                                </span>

                                {item.harvestDate && (
                                  <small>Hasat: {item.harvestDate}</small>
                                )}

                                {item.notes && <p>{item.notes}</p>}
                              </div>

                              <button
                                onClick={() => void handleDeletePerennialYield(item.id)}
                              >
                                Sil
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="tp-field-sections-empty">
                          <div>📊</div>
                          <strong>Henüz yıllık verim kaydı yok</strong>
                          <p>
                            2024, 2025, 2026 gibi her yıl kaç kg ürün aldığını
                            kaydedebilirsin.
                          </p>
                        </div>
                      )
                    ) : annualSeasons.length > 0 ? (
                      <div className="tp-season-history-list">
                        {annualSeasons.map((item) => (
                          <article key={item.id} className="tp-season-history-card">
                            <div className="tp-yield-year">{item.year}</div>

                            <div className="tp-yield-main">
                              <strong>{item.crop}</strong>
                              <span>
                                Ekim: {item.plantingDate ?? '—'} • Hasat:{' '}
                                {item.harvestDate ?? '—'}
                              </span>
                              {item.notes && <p>{item.notes}</p>}
                            </div>

                            <button
                              onClick={() => void handleDeleteAnnualSeason(item.id)}
                            >
                              Sil
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="tp-field-sections-empty">
                        <div>🕘</div>
                        <strong>Henüz sezon geçmişi yok</strong>
                        <p>
                          Tek yıllık ürünlerde her üretim sezonunu ayrı bir kayıt
                          olarak tutabilirsin.
                        </p>
                      </div>
                    )}

                    {annualFormOpen &&
                      (selectedField.cropCycle ?? 'annual') === 'annual' && (
                        <div
                          className="tp-modal-backdrop"
                          role="presentation"
                          onMouseDown={() => setAnnualFormOpen(false)}
                        >
                          <div
                            className="tp-modal-card tp-modal-card-medium"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Yeni sezon ekle"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <form
                              className="tp-history-form tp-modal-form"
                              onSubmit={handleAddAnnualSeason}
                            >
                          <div className="tp-production-profile-title">
                            <div>
                              <span>YENİ SEZON</span>
                              <strong>Tek yıllık üretim sezonu ekle</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAnnualFormOpen(false)}
                            >
                              ×
                            </button>
                          </div>

                          <label>
                            Sezon yılı
                            <input
                              value={annualYear}
                              onChange={(e) => setAnnualYear(e.target.value)}
                              inputMode="numeric"
                              placeholder="2026"
                            />
                          </label>

                          <label>
                            Ürün
                            <input
                              value={annualCrop}
                              onChange={(e) => setAnnualCrop(e.target.value)}
                              placeholder="Buğday"
                            />
                          </label>

                          <label>
                            Ekim tarihi
                            <input
                              id="tp-field-season-planting-date"
                              type="date"
                              value={annualPlantingDate}
                              onChange={(e) => setAnnualPlantingDate(e.target.value)}
                            />
                          </label>

                          <label>
                            Hasat tarihi
                            <input
                              type="date"
                              value={annualHarvestDate}
                              onChange={(e) => setAnnualHarvestDate(e.target.value)}
                            />
                          </label>

                          <label className="tp-history-form-full">
                            Not
                            <textarea
                              value={annualNotes}
                              onChange={(e) => setAnnualNotes(e.target.value)}
                              placeholder="Sezonla ilgili kısa not..."
                            />
                          </label>

                          <div className="tp-modal-actions tp-history-form-full">
                            <button
                              type="button"
                              className="tp-modal-cancel"
                              onClick={() => setAnnualFormOpen(false)}
                            >
                              İptal
                            </button>

                            <button
                              className="tp-production-profile-save tp-modal-primary"
                              type="submit"
                              disabled={annualFormLoading}
                            >
                              {annualFormLoading ? 'Kaydediliyor...' : 'Sezonu Kaydet'}
                            </button>
                          </div>
                            </form>
                          </div>
                        </div>
                      )}

                    {yieldFormOpen &&
                      (selectedField.cropCycle ?? 'annual') === 'perennial' && (
                        <div
                          className="tp-modal-backdrop"
                          role="presentation"
                          onMouseDown={() => setYieldFormOpen(false)}
                        >
                          <div
                            className="tp-modal-card tp-modal-card-medium"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Yıllık verim ekle"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <form
                              className="tp-history-form tp-modal-form"
                              onSubmit={handleAddPerennialYield}
                            >
                          <div className="tp-production-profile-title">
                            <div>
                              <span>YILLIK VERİM</span>
                              <strong>Bu yıl alınan ürün miktarını kaydet</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setYieldFormOpen(false)}
                            >
                              ×
                            </button>
                          </div>

                          <label>
                            Yıl
                            <input
                              value={yieldYear}
                              onChange={(e) => setYieldYear(e.target.value)}
                              inputMode="numeric"
                              placeholder="2025"
                            />
                          </label>

                          <label>
                            Toplam ürün (kg)
                            <input
                              value={yieldKg}
                              onChange={(e) => setYieldKg(e.target.value)}
                              inputMode="decimal"
                              placeholder="4100"
                            />
                          </label>

                          <label>
                            Hasat tarihi
                            <input
                              type="date"
                              value={yieldHarvestDate}
                              onChange={(e) => setYieldHarvestDate(e.target.value)}
                            />
                          </label>

                          <label className="tp-history-form-full">
                            Not
                            <textarea
                              value={yieldNotes}
                              onChange={(e) => setYieldNotes(e.target.value)}
                              placeholder="Kalite, rekolte, hasat koşulları..."
                            />
                          </label>

                          <div className="tp-modal-actions tp-history-form-full">
                            <button
                              type="button"
                              className="tp-modal-cancel"
                              onClick={() => setYieldFormOpen(false)}
                            >
                              İptal
                            </button>

                            <button
                              className="tp-production-profile-save tp-modal-primary"
                              type="submit"
                              disabled={yieldFormLoading}
                            >
                              {yieldFormLoading
                                ? 'Kaydediliyor...'
                                : 'Yıllık Verimi Kaydet'}
                            </button>
                          </div>
                            </form>
                          </div>
                        </div>
                      )}

                    {historyMessage && (
                      <div className="tp-field-section-message">
                        {historyMessage}
                      </div>
                    )}
                  </div>
                )}

                {!selectedField.demo && (
                  <div id="field-sections" className="tp-field-sections-block">
                    <div className="tp-field-sections-head">
                      <div>
                        <span>Tarla bölümleri</span>
                        <strong>
                          {fieldSections.length > 0
                            ? `${fieldSections.length} bölüm kayıtlı`
                            : 'Henüz bölüm eklenmedi'}
                        </strong>
                      </div>

                      <small>
                        {fieldSections
                          .reduce((total, item) => total + (item.area ?? 0), 0)
                          .toLocaleString('tr-TR')}{' '}
                        / {selectedField.area.toLocaleString('tr-TR')} da
                      </small>
                    </div>

                    {sectionsLoading ? (
                      <div className="tp-section-loading">Bölümler yükleniyor...</div>
                    ) : fieldSections.length > 0 ? (
                      <div className="tp-field-sections-list">
                        {fieldSections.map((section, index) => (
                          <article key={section.id} className="tp-field-section-card">
                            <div className="tp-field-section-number">{index + 1}</div>

                            <div className="tp-field-section-copy">
                              <strong>{section.name}</strong>
                              <span>{section.crop}</span>
                            </div>

                            <div className="tp-field-section-area">
                              <strong>
                                {section.area !== null
                                  ? `${section.area.toLocaleString('tr-TR')} da`
                                  : 'Alan yok'}
                              </strong>
                              <button
                                onClick={() => void handleDeleteFieldSection(section.id)}
                                aria-label={`${section.name} bölümünü sil`}
                              >
                                Sil
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="tp-field-sections-empty">
                        <div>🌱</div>
                        <strong>Bu tarla tek parça görünüyor</strong>
                        <p>
                          Aynı tarlada farklı ürün veya yönetim alanları varsa
                          “Tarla Bölümü Ekle” ile ayrı ayrı kaydedebilirsin.
                        </p>
                      </div>
                    )}

                    {sectionFormOpen && (
                      <div
                        className="tp-modal-backdrop"
                        role="presentation"
                        onMouseDown={() => {
                          resetSectionForm();
                          setSectionFormOpen(false);
                        }}
                      >
                        <div
                          className="tp-modal-card tp-modal-card-medium"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Tarla bölümü ekle"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <form
                            className="tp-field-section-form tp-modal-form"
                            onSubmit={handleAddFieldSection}
                          >
                        <div className="tp-field-section-form-title">
                          <div>
                            <span>YENİ BÖLÜM</span>
                            <strong>Tarla içinde ayrı bir alan oluştur</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              resetSectionForm();
                              setSectionFormOpen(false);
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <label>
                          Bölüm adı
                          <input
                            type="text"
                            value={sectionName}
                            onChange={(e) => setSectionName(e.target.value)}
                            placeholder="Örn: Kuzey Bölümü"
                          />
                        </label>

                        <label>
                          Bu bölümdeki ürün
                          <input
                            type="text"
                            value={sectionCrop}
                            onChange={(e) => setSectionCrop(e.target.value)}
                            placeholder="Örn: Kiraz"
                          />
                        </label>

                        <label>
                          Bölüm alanı (dekar)
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sectionArea}
                            onChange={(e) => setSectionArea(e.target.value)}
                            placeholder="Örn: 25"
                          />
                        </label>

                        <div className="tp-field-section-area-note">
                          Kayıtlı bölümlerin toplamı tarla alanını aşamaz.
                        </div>

                        {sectionFormMessage && (
                          <div className="tp-field-section-message">
                            {sectionFormMessage}
                          </div>
                        )}

                        <div className="tp-modal-actions">
                          <button
                            type="button"
                            className="tp-modal-cancel"
                            onClick={() => {
                              resetSectionForm();
                              setSectionFormOpen(false);
                            }}
                          >
                            İptal
                          </button>

                          <button
                            className="tp-field-section-save tp-modal-primary"
                            type="submit"
                            disabled={sectionFormLoading}
                          >
                            {sectionFormLoading ? 'Kaydediliyor...' : 'Bölümü Kaydet'}
                          </button>
                        </div>
                          </form>
                        </div>
                      </div>
                    )}

                    {!sectionFormOpen && sectionFormMessage && (
                      <div className="tp-field-section-message">
                        {sectionFormMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            )}

            {activeDetailTab === 'history' && (
            <section className="tp-field-detail-section">
              <div className="tp-field-detail-section-head">
                <div>
                  <span className="tp-field-detail-kicker">TARLA GEÇMİŞİ</span>
                  <h2>Yapılan işlemler</h2>
                </div>

                {!selectedField.demo && (
                  <button
                    className="tp-activity-add-top"
                    onClick={() => openActivityForm('Diğer')}
                  >
                    + İşlem Ekle
                  </button>
                )}
              </div>

              {!selectedField.demo && <FieldCostSummary
                activities={activities}
                area={selectedField.area}
                loading={activitiesLoading}
                onAdd={() => openActivityForm('Diğer')}
              />}

              {activitiesLoading ? (
                <div className="tp-section-loading">İşlemler yükleniyor...</div>
              ) : activities.length > 0 ? (
                <div className="tp-activity-list">
                  {activities.map((activity) => {
                    const icon =
                      activity.type === 'Gübreleme'
                        ? '🧪'
                        : activity.type === 'İlaçlama'
                          ? '🧴'
                          : activity.type === 'Sulama'
                            ? '💧'
                            : activity.type === 'Hasat'
                              ? '🧺'
                              : activity.type === 'Ekim / Dikim'
                                ? '🌱'
                                : activity.type === 'Budama'
                                  ? '✂️'
                                  : activity.type === 'Saha Kontrolü'
                                    ? '📷'
                                    : '📝';

                    return (
                      <article key={activity.id} className="tp-activity-card">
                        <div className="tp-activity-icon">{icon}</div>

                        <div className="tp-activity-copy">
                          <div className="tp-activity-title-row">
                            <strong>{activity.title}</strong>
                            <span>{activity.activityDate}</span>
                          </div>

                          <div className="tp-activity-meta">
                            {activity.productName && (
                              <span>Ürün: {activity.productName}</span>
                            )}

                            {activity.quantity !== null && (
                              <span>
                                Miktar: {activity.quantity.toLocaleString('tr-TR')}
                                {activity.unit ? ` ${activity.unit}` : ''}
                              </span>
                            )}

                            {activity.cost !== null && (
                              <span>
                                Maliyet: {activity.cost.toLocaleString('tr-TR')} TL
                              </span>
                            )}
                          </div>

                          {activity.notes && <p>{activity.notes}</p>}

                          {activity.photoUrl && (
                            <button
                              type="button"
                              className="tp-activity-photo-thumb"
                              onClick={() => window.open(activity.photoUrl ?? '', '_blank')}
                            >
                              <img
                                src={activity.photoUrl}
                                alt={`${activity.title} fotoğrafı`}
                              />
                              <span>Fotoğrafı büyüt</span>
                            </button>
                          )}

                          {activity.aiAnalysis && (
                            <div
                              className={`tp-ai-history-card tp-ai-${activity.aiAnalysis.status}`}
                            >
                              <div>
                                <span>AI ÖN DEĞERLENDİRME</span>
                                <strong>{activity.aiAnalysis.headline}</strong>
                              </div>
                              <small>
                                Güven: %{activity.aiAnalysis.confidence}
                              </small>
                            </div>
                          )}
                        </div>

                        <button
                          className="tp-activity-delete"
                          onClick={() => void handleDeleteActivity(activity.id)}
                        >
                          Sil
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="tp-field-sections-empty">
                  <div>📒</div>
                  <strong>Henüz tarla işlemi kaydedilmedi</strong>
                  <p>
                    Gübreleme, ilaçlama, sulama, hasat ve saha kontrollerini
                    buraya kaydedebilirsin.
                  </p>
                </div>
              )}

              {activityFormOpen && !selectedField.demo && (
                <div
                  className="tp-modal-backdrop"
                  role="presentation"
                  onMouseDown={() => {
                    setActivityFormOpen(false);
                    setActivityMessage('');
                  }}
                >
                  <div
                    className="tp-modal-card tp-modal-card-large"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Yeni tarla işlemi"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <form
                      className="tp-activity-form tp-modal-form"
                      onSubmit={handleAddActivity}
                    >
                  <div className="tp-production-profile-title">
                    <div>
                      <span>YENİ TARLA İŞLEMİ</span>
                      <strong>Yaptığın işlemi kaydet</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActivityFormOpen(false);
                        setActivityMessage('');
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <label>
                    İşlem türü
                    <MobileWheelPicker
                      title="İşlem türü"
                      value={activityType}
                      onChange={setActivityType}
                      options={[
                        'Saha Kontrolü',
                        'Gübreleme',
                        'İlaçlama',
                        'Sulama',
                        'Ekim / Dikim',
                        'Hasat',
                        'Budama',
                        'Toprak İşleme',
                        'Diğer',
                      ].map((item) => ({ value: item, label: item }))}
                    />
                  </label>

                  <label>
                    Tarih
                    <input
                      type="date"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Kullanılan ürün / malzeme
                    <input
                      value={activityProductName}
                      onChange={(e) => setActivityProductName(e.target.value)}
                      placeholder="Örn: Üre, bordo bulamacı..."
                    />
                  </label>

                  {(activityType === 'Gübreleme' ||
                    activityType === 'İlaçlama') && (
                    <>
                      <div className="tp-activity-full">
                        <span className="tp-field-choice-label">Miktarı nasıl gireceksin?</span>
                        <div className="tp-dose-choice">
                          <button
                            type="button"
                            className={activityDoseMode === 'per_decare' ? 'active' : ''}
                            onClick={() => setActivityDoseMode('per_decare')}
                          >
                            Dekara miktar
                            <small>Örn: 20 kg/da</small>
                          </button>
                          <button
                            type="button"
                            className={activityDoseMode === 'total' ? 'active' : ''}
                            onClick={() => setActivityDoseMode('total')}
                          >
                            Toplam miktar
                            <small>Örn: tüm tarlada 1000 kg</small>
                          </button>
                        </div>
                      </div>

                      <label>
                        {activityDoseMode === 'per_decare'
                          ? 'Dekara kullanılan miktar'
                          : 'Tarlada toplam kullanılan miktar'}
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder={activityDoseMode === 'per_decare' ? 'Örn: 20' : 'Örn: 1000'}
                        />
                      </label>

                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          placeholder="Seç"
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'g', label: 'g' },
                            { value: 'L', label: 'L' },
                            { value: 'mL', label: 'mL' },
                          ]}
                        />
                      </label>

                      {activityQuantity.trim() &&
                        Number.isFinite(Number(activityQuantity.replace(',', '.'))) &&
                        selectedField.area > 0 && (
                          <div className="tp-smart-calc tp-activity-full">
                            <span>Otomatik hesap</span>
                            <strong>
                              {activityDoseMode === 'per_decare'
                                ? `Toplam: ${(
                                    Number(activityQuantity.replace(',', '.')) *
                                    selectedField.area
                                  ).toLocaleString('tr-TR', {
                                    maximumFractionDigits: 2,
                                  })} ${activityUnit || 'birim'}`
                                : `Dekara: ${(
                                    Number(activityQuantity.replace(',', '.')) /
                                    selectedField.area
                                  ).toLocaleString('tr-TR', {
                                    maximumFractionDigits: 2,
                                  })} ${activityUnit || 'birim'}/da`}
                            </strong>
                            <small>{selectedField.area.toLocaleString('tr-TR')} da tarla alanına göre</small>
                          </div>
                        )}
                    </>
                  )}

                  {activityType === 'Sulama' && (
                    <>
                      <label>
                        Toplam kullanılan su (m³)
                        <input
                          inputMode="decimal"
                          value={activityWaterM3}
                          onChange={(e) => setActivityWaterM3(e.target.value)}
                          placeholder="Örn: 120"
                        />
                      </label>

                      <label>
                        Sulama süresi (saat)
                        <input
                          inputMode="decimal"
                          value={activityDurationHours}
                          onChange={(e) => setActivityDurationHours(e.target.value)}
                          placeholder="Örn: 4"
                        />
                      </label>

                      {activityWaterM3.trim() &&
                        Number.isFinite(Number(activityWaterM3.replace(',', '.'))) &&
                        selectedField.area > 0 && (
                          <div className="tp-smart-calc tp-activity-full">
                            <span>Otomatik hesap</span>
                            <strong>
                              {(
                                Number(activityWaterM3.replace(',', '.')) /
                                selectedField.area
                              ).toLocaleString('tr-TR', {
                                maximumFractionDigits: 2,
                              })} m³/da
                            </strong>
                            <small>Dekara kullanılan sulama suyu</small>
                          </div>
                        )}
                    </>
                  )}

                  {activityType === 'Hasat' && (
                    <>
                      <label>
                        Toplam hasat miktarı
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder="Örn: 4200"
                        />
                      </label>
                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'ton', label: 'ton' },
                            { value: 'adet', label: 'adet' },
                          ]}
                        />
                      </label>
                    </>
                  )}

                  {!['Gübreleme', 'İlaçlama', 'Sulama', 'Hasat'].includes(activityType) && (
                    <>
                      <label>
                        Miktar (isteğe bağlı)
                        <input
                          inputMode="decimal"
                          value={activityQuantity}
                          onChange={(e) => setActivityQuantity(e.target.value)}
                          placeholder="Varsa miktar"
                        />
                      </label>
                      <label>
                        Birim
                        <MobileWheelPicker
                          title="Birim seç"
                          value={activityUnit}
                          onChange={setActivityUnit}
                          placeholder="Seç"
                          options={[
                            { value: 'kg', label: 'kg' },
                            { value: 'L', label: 'L' },
                            { value: 'da', label: 'da' },
                            { value: 'saat', label: 'saat' },
                            { value: 'adet', label: 'adet' },
                          ]}
                        />
                      </label>
                    </>
                  )}

                  <label>
                    Maliyet (TL)
                    <input
                      inputMode="decimal"
                      value={activityCost}
                      onChange={(e) => setActivityCost(e.target.value)}
                      placeholder="İsteğe bağlı"
                    />
                  </label>

                  <label className="tp-activity-full">
                    Not
                    <textarea
                      value={activityNotes}
                      onChange={(e) => setActivityNotes(e.target.value)}
                      placeholder="Tarlada gördüklerin, uygulama detayı, hava koşulları..."
                    />
                  </label>

                  <div className="tp-activity-photo-field tp-activity-full">
                    <div className="tp-activity-photo-head">
                      <div>
                        <span>FOTOĞRAF</span>
                        <strong>
                          {activityType === 'Saha Kontrolü'
                            ? 'Tarladan bir görüntü ekle'
                            : 'İstersen bu işleme fotoğraf ekle'}
                        </strong>
                      </div>

                      {activityPhoto && (
                        <button
                          type="button"
                          onClick={clearActivityPhoto}
                        >
                          Kaldır
                        </button>
                      )}
                    </div>

                    {activityPhotoPreview ? (
                      <div className="tp-activity-photo-preview">
                        <img src={activityPhotoPreview} alt="Seçilen saha fotoğrafı" />

                        <label>
                          Fotoğrafı Değiştir
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) =>
                              handleActivityPhotoChange(e.target.files?.[0])
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="tp-activity-photo-picker">
                        <span>📷</span>
                        <strong>Fotoğraf Seç / Kamera Aç</strong>
                        <small>
                          JPG, PNG veya telefon kamerasından fotoğraf • en fazla 12 MB
                        </small>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) =>
                            handleActivityPhotoChange(e.target.files?.[0])
                          }
                        />
                      </label>
                    )}

                    {activityType === 'Saha Kontrolü' && activityPhoto && (
                      <div className="tp-ai-analyze-area">
                        <button
                          type="button"
                          className="tp-ai-analyze-button"
                          onClick={() => void handleAiAnalyzeActivityPhoto()}
                          disabled={aiAnalyzing}
                        >
                          <span>{aiAnalyzing ? '◌' : '✦'}</span>
                          {aiAnalyzing
                            ? 'AI fotoğrafı inceliyor...'
                            : 'AI ile Analiz Et'}
                        </button>

                        <small>
                          Yaprak, meyve veya sorunlu bölge net görünürse sonuç daha iyi olur.
                        </small>
                      </div>
                    )}

                    {aiAnalysisError && (
                      <div className="tp-ai-error">{aiAnalysisError}</div>
                    )}

                    {aiAnalysis && (
                      <div className={`tp-ai-result tp-ai-${aiAnalysis.status}`}>
                        <div className="tp-ai-result-head">
                          <div>
                            <span>AI ÖN DEĞERLENDİRME</span>
                            <strong>{aiAnalysis.headline}</strong>
                          </div>

                          <div className="tp-ai-confidence">
                            %{aiAnalysis.confidence}
                            <small>güven</small>
                          </div>
                        </div>

                        <div className="tp-ai-possible">
                          <span>Olası durum</span>
                          <strong>{aiAnalysis.possibleIssue}</strong>
                        </div>

                        {aiAnalysis.observations.length > 0 && (
                          <div className="tp-ai-list">
                            <span>Fotoğrafta görülenler</span>
                            {aiAnalysis.observations.map((item, index) => (
                              <p key={`obs-${index}`}>• {item}</p>
                            ))}
                          </div>
                        )}

                        {aiAnalysis.recommendations.length > 0 && (
                          <div className="tp-ai-list">
                            <span>Önerilen sonraki adım</span>
                            {aiAnalysis.recommendations.map((item, index) => (
                              <p key={`rec-${index}`}>• {item}</p>
                            ))}
                          </div>
                        )}

                        <div className="tp-ai-disclaimer">
                          {aiAnalysis.disclaimer}
                        </div>
                      </div>
                    )}
                  </div>

                  {activityMessage && (
                    <div className="tp-field-section-message tp-activity-full">
                      {activityMessage}
                    </div>
                  )}

                  <div className="tp-modal-actions tp-activity-full">
                    <button
                      type="button"
                      className="tp-modal-cancel"
                      onClick={() => {
                        setActivityFormOpen(false);
                        setActivityMessage('');
                      }}
                    >
                      İptal
                    </button>

                    <button
                      className="tp-production-profile-save tp-modal-primary"
                      type="submit"
                      disabled={activityFormLoading}
                    >
                      {activityFormLoading ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
                    </button>
                  </div>
                    </form>
                  </div>
                </div>
              )}

              {!activityFormOpen && activityMessage && (
                <div className="tp-field-section-message">{activityMessage}</div>
              )}
            </section>

            )}
          </main>

          {fieldFabOpen && (
            <button
              type="button"
              className="tp-field-fab-backdrop"
              aria-label="Menüyü kapat"
              onClick={() => setFieldFabOpen(false)}
            />
          )}

          <div className={`tp-field-fab-wrap ${fieldFabOpen ? 'open' : ''}`}>
            {fieldFabOpen && <div className="tp-field-fab-menu" id="field-action-menu">
              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openActivityForm('Saha Kontrolü');
                }}
              >
                <span className="green">▣</span>
                <strong>İşlem Ekle</strong>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openReminderModal(selectedField);
                }}
              >
                <span className="amber">♧</span>
                <strong>Hatırlatma Ekle</strong>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFieldFabOpen(false);
                  openAiAnalysisScreen();
                }}
              >
                <span className="blue">✦</span>
                <strong>AI Saha Analizi</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-production')}>
                <span className="purple">▥</span>
                <strong>Üretim Geçmişi</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-sections')}>
                <span className="cyan">▦</span>
                <strong>Tarla Bölümleri</strong>
              </button>

              <button type="button" onClick={() => scrollFieldDetailTo('field-info')}>
                <span className="gray">⚙</span>
                <strong>Tarla Bilgileri</strong>
              </button>
              {!selectedField.demo && (
                <button type="button" className="tp-field-fab-delete" onClick={() => {
                  setFieldFabOpen(false);
                  setDeleteFieldError('');
                  setDeleteFieldOpen(true);
                }}>
                  <span className="red">×</span>
                  <strong>Tarlayı Sil</strong>
                </button>
              )}
            </div>}

            <button
              type="button"
              className="tp-field-fab"
              aria-label={fieldFabOpen ? 'Menüyü kapat' : 'Tarla işlemlerini aç'}
              aria-expanded={fieldFabOpen}
              aria-controls="field-action-menu"
              onClick={() => setFieldFabOpen((value) => !value)}
            >
              {fieldFabOpen ? '×' : '+'}
            </button>
          </div>

          {deleteFieldOpen && (
            <div className="tp-field-delete-backdrop" onClick={() => !deleteFieldLoading && setDeleteFieldOpen(false)}>
              <section
                className="tp-field-delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="field-delete-title"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="tp-field-delete-kicker">TARLA SİLME</span>
                <h2 id="field-delete-title">Emin misin?</h2>
                <p><strong>{selectedField.name}</strong> tarlasını ve ona bağlı kayıtları kalıcı olarak sileceksin. Bu işlem geri alınamaz.</p>
                {!isPremiumFieldPlan && (
                  <p className="tp-field-delete-warning">
                    Ücretsiz planda tarla değiştirme hakkı 7 günde bir yenilenir. İlk eklemeden sonraki 24 saatlik düzeltme süresi istisnadır.
                  </p>
                )}
                {deleteFieldError && <p className="tp-field-delete-error" role="alert">{deleteFieldError}</p>}
                <div className="tp-field-delete-actions">
                  <button type="button" onClick={() => setDeleteFieldOpen(false)} disabled={deleteFieldLoading}>Vazgeç</button>
                  <button type="button" className="danger" onClick={() => void confirmDeleteField()} disabled={deleteFieldLoading}>
                    {deleteFieldLoading ? 'Siliniyor…' : 'Evet, Tarlayı Sil'}
                  </button>
                </div>
              </section>
            </div>
          )}

          <nav className="tp-field-detail-bottom">
            <button onClick={() => setScreen('home')}>
              <span>⌂</span>
              Ana Sayfa
            </button>

            <button type="button" className={activeDetailTab === 'overview' ? 'active' : ''} onClick={() => setActiveDetailTab('overview')}>
              <span>▢</span>
              Tarla Detayı
            </button>

            <button
              className="tp-field-detail-main-action"
              onClick={openAiAnalysisScreen}
            >
              <span>✦</span>
              AI Analiz
            </button>

            <button type="button" className={activeDetailTab === 'production' ? 'active' : ''} onClick={() => setActiveDetailTab('production')}>
              <span>▦</span>
              Üretim
            </button>

            <button type="button" className={activeDetailTab === 'history' ? 'active' : ''} onClick={() => setActiveDetailTab('history')}>
              <span>☷</span>
              İşlemler
            </button>
          </nav>
        </div>
      </>
    );
}
