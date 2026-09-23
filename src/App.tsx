import SoilAnalysisPage from './pages/SoilAnalysis/SoilAnalysisPage';
import PestStoreScreen from './components/PestStoreScreen';
import MarketPricesScreen from './components/MarketPricesScreen';
import AgriculturalSupportScreen from './components/AgriculturalSupportScreen';
import AgriNewsScreen from './components/AgriNewsScreen';
import PlantNutritionScreen from './components/PlantNutritionScreen';
import ProducerMarketScreen from './components/ProducerMarketScreen';
import PestGuideScreen from './components/PestGuideScreen';
import AdminPageBuilder from './pages/Admin/AdminPageBuilder';
import AuthScreens from './pages/Auth/AuthScreens';
import OnboardingScreen from './pages/Onboarding/OnboardingScreen';
import ReadyScreen from './pages/Onboarding/ReadyScreen';
import HomeScreen from './pages/Home/HomeScreen';
import PusulaTest from './pages/PusulaTest/PusulaTest';
import CalendarScreen from './pages/Calendar/CalendarScreen';
import AiAnalysisScreen from './pages/AiAnalysis/AiAnalysisScreen';
import AddFieldScreen from './pages/AddFieldScreen';
import WeatherHubScreen from './pages/Weather/WeatherHubScreen';
import DemMapScreen from './pages/DemMap/DemMapScreen';
import UnifiedMapScreen from './pages/UnifiedMap/UnifiedMapScreen';
import type { MapSection } from './components/MapTopNav';
import PlaceholderScreen from './pages/Placeholder/PlaceholderScreen';
import NotificationsHubScreen from './pages/Notifications/NotificationsHubScreen';
import FieldDetailScreen from './pages/FieldDetailScreen';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FALLBACK_DESKTOP_MENU_ITEMS, BASE_PLACEHOLDER_META, weatherDayLabel, weatherIcon } from './data/navigation';
import AppDrawer from './components/AppDrawer';
import GlobalPusulaBand from './components/GlobalPusulaBand';
import PusulaIntroTrailer from './components/PusulaIntroTrailer';
import { cmsBlockStyle, cmsText, cmsSub } from './utils/cmsUtils';
import { useEntitlementStore } from './entitlements/useEntitlementStore';
import { useMenuHistory } from './features/app-shell/hooks/useMenuHistory';
import { useAdminRole } from './features/app-shell/hooks/useAdminRole';
import { useAppCms } from './features/cms/hooks/useAppCms';
import { useAppWeatherData } from './features/weather/hooks/useAppWeatherData';
import { useFieldSatellite } from './features/satellite/hooks/useFieldSatellite';
import { useCalendarController } from './features/calendar/hooks/useCalendarController';
import { useAuthOnboardingController } from './features/auth/hooks/useAuthOnboardingController';
import { useFieldRegistryController } from './features/fields/hooks/useFieldRegistryController';
import { useFieldActivities } from './features/field-detail/hooks/useFieldActivities';
import { useFieldProductionHistory } from './features/field-detail/hooks/useFieldProductionHistory';
import { useFieldSections } from './features/field-detail/hooks/useFieldSections';
import { ensureAgStackGeoId } from './services/agstackGeoId.service';
import {
  startGamificationSession,
} from './gamification/useGamificationStore';
import type {
  Screen,
  Field,
} from './types';














































export default function App() {
  const { isNewUserPreview } = useEntitlementStore();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [pusulaIntroOpen, setPusulaIntroOpen] = useState(false);

  const { goBackInMenu } = useMenuHistory({
    screen,
    setScreen,
    closeMenu: () => setSideMenuOpen(false),
  });
  const {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    authLoading,
    authMessage,
    setAuthMessage,
    verificationEmail,
    onboardingStep,
    setOnboardingStep,
    answers,
    setAnswers,
    otherProduct,
    setOtherProduct,
    selectAnswer,
    nextOnboardingStep,
    skipOnboardingStep,
    handleEmailRegister,
    handleEmailLogin,
  } = useAuthOnboardingController({ isNewUserPreview, setScreen });
  const [era5MapOpen, setEra5MapOpen] = useState(false);
  const [demMapOpen, setDemMapOpen] = useState(false);
  const [sentinel1MapOpen, setSentinel1MapOpen] = useState(false);
  const [unifiedMapOpen, setUnifiedMapOpen] = useState(false);
  const [unifiedMapSection, setUnifiedMapSection] = useState<MapSection>('vegetation');
  const [mapFieldId, setMapFieldId] = useState('');
  const isAdmin = useAdminRole();
  const {
    cmsPages,
    cmsBlocks,
    cmsMenus,
    cmsRuntimeCss,
    cmsPageFor,
    cmsBlockFor,
    cmsMenuFor,
  } = useAppCms(screen);
  const [favoriteFieldId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('tp_favorite_field_id') ?? '';
    } catch {
      return '';
    }
  });

  // Geliştirici test anahtarındaki YENİ KULLANICI modu yalnızca önizlemedir.
  // Gerçek profil/veri değişmeden mevcut yeni kullanıcı onboarding ekranı açılır.
  const newUserPreviewWasActiveRef = useRef(false);
  const newUserPreviewReturnScreenRef = useRef<Screen>('home');
  const agStackGeoIdSyncedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isNewUserPreview) {
      if (newUserPreviewWasActiveRef.current) return;

      newUserPreviewWasActiveRef.current = true;

      const nonAppScreens = [
        'welcome',
        'login',
        'emailRegister',
        'emailLogin',
        'emailVerification',
        'onboarding',
        'ready',
      ];

      newUserPreviewReturnScreenRef.current = nonAppScreens.includes(String(screen))
        ? 'home'
        : screen;

      setPusulaIntroOpen(false);
      setOnboardingStep(0);
      setAnswers({});
      setOtherProduct('');
      setAuthMessage('');
      setScreen('onboarding');
      return;
    }

    if (!newUserPreviewWasActiveRef.current) return;

    newUserPreviewWasActiveRef.current = false;
    setPusulaIntroOpen(false);
    setScreen(newUserPreviewReturnScreenRef.current ?? 'home');
  }, [isNewUserPreview]);
  // Merkezi puan motorunu bir kez başlat.
  // Oturum varsa günlük giriş ödülünü de server-side limit kontrolüyle dener.
  useEffect(() => {
    return startGamificationSession();
  }, []);

  const {
    realFields,
    setRealFields,
    selectedField,
    setSelectedField,
    fieldFormLoading,
    fieldFormMessage,
    setFieldFormMessage,
    fieldName,
    setFieldName,
    fieldCity,
    provinceOptions,
    districtOptions,
    villageOptions,
    selectedProvinceId,
    selectedDistrictId,
    locationOptionsLoading,
    locationOptionsMessage,
    fieldVillage,
    fieldAda,
    setFieldAda,
    fieldParcel,
    setFieldParcel,
    fieldLatitude,
    fieldLongitude,
    parcelLocationMessage,
    parcelLookupLoading,
    parcelLookupMessage,
    parcelGeometry,
    parcelLookupSource,
    fieldArea,
    setFieldArea,
    fieldCrop,
    fieldSeason,
    setFieldSeason,
    fieldCropCycle,
    fieldPlantingYear,
    setFieldPlantingYear,
    fieldBearing,
    setFieldBearing,
    loadProvinceOptions,
    handleProvinceSelection,
    handleDistrictSelection,
    handleVillageSelection,
    handleParcelLookup,
    openOfficialParcelQuery,
    openAddField,
    resetFieldForm,
    handleFieldCropSelection,
    handleAddField,
    handleDeleteField,
    districtDisplayName,
  } = useFieldRegistryController({
    screen,
    setScreen,
    isNewUserPreview,
    setPusulaIntroOpen,
  });

  // Kayıtlı parsel sınırı olan gerçek tarlaların AgStack GeoID eşlemesini
  // ekran seçimine bağlı kalmadan arka planda tamamla. Edge Function aynı
  // geometri hash'i için kalıcı kaydı döndürdüğünden tekrar çağrılar ucuzdur.
  useEffect(() => {
    if (isNewUserPreview || !realFields.length) return;

    for (const field of realFields) {
      const fieldId = String(field?.id ?? '').trim();
      const hasBoundary = Boolean(field?.parcelGeometry);

      if (!fieldId || !hasBoundary || agStackGeoIdSyncedRef.current.has(fieldId)) {
        continue;
      }

      agStackGeoIdSyncedRef.current.add(fieldId);

      void ensureAgStackGeoId(fieldId).catch((error) => {
        // Başarısız çağrı session boyunca kilitlenmez; sonraki gerçek tarla
        // yenilemesinde veya sayfa açılışında tekrar denenebilir.
        agStackGeoIdSyncedRef.current.delete(fieldId);
        console.info(`AgStack GeoID arka plan eşlemesi tamamlanamadı (${fieldId}):`, error);
      });
    }
  }, [realFields, isNewUserPreview]);

  const {
    fieldWeather,
    fieldHourlyWeather,
    loadFieldHourlyWeather,
    weatherHubFieldId,
    setWeatherHubFieldId,
    loadHomeWeather,
    loadFieldWeather,
    nasaPowerState,
    era5ClimateState,
    unifiedClimateContext,
  } = useAppWeatherData({ realFields, favoriteFieldId });

  useEffect(() => {
    if (screen !== 'home') return;
    const preferredHomeField =
      realFields.find((field) => String(field.id) === favoriteFieldId) ??
      realFields[0] ??
      null;
    void loadHomeWeather(preferredHomeField);
  }, [screen, realFields, favoriteFieldId]);

  const { satelliteByField, loadFieldSatellite } = useFieldSatellite();
  const {
    calendarReminders,
    calendarLoading,
    reminderFormOpen,
    reminderFormLoading,
    reminderMessage,
    reminderFieldId,
    reminderType,
    reminderTitle,
    reminderDate,
    reminderTime,
    reminderNotes,
    setReminderFormOpen,
    setReminderMessage,
    setReminderFieldId,
    setReminderType,
    setReminderTitle,
    setReminderDate,
    setReminderTime,
    setReminderNotes,
    pushSupported,
    pushEnabled,
    pushLoading,
    pushMessage,
    openCalendarScreen,
    openReminderModal,
    handleAddReminder,
    handleToggleReminder,
    handleDeleteReminder,
    enablePushNotifications,
    disablePushNotifications,
    sendTestPushNotification,
  } = useCalendarController({ realFields, selectedField, setScreen });

  const [fieldControlFieldId, setFieldControlFieldId] = useState('');
  const [soilFieldId, setSoilFieldId] = useState('');

  const {
    fieldSections,
    sectionsLoading,
    sectionFormOpen,
    setSectionFormOpen,
    sectionFormLoading,
    sectionFormMessage,
    setSectionFormMessage,
    sectionName,
    setSectionName,
    sectionCrop,
    setSectionCrop,
    sectionArea,
    setSectionArea,
    resetSectionForm,
    resetSectionsUi,
    loadFieldSections,
    handleAddFieldSection,
    handleDeleteFieldSection,
  } = useFieldSections({ selectedField });

  const {
    annualSeasons,
    perennialYields,
    historyLoading,
    historyMessage,
    setHistoryMessage,
    annualFormOpen,
    setAnnualFormOpen,
    annualFormLoading,
    annualYear,
    setAnnualYear,
    annualCrop,
    setAnnualCrop,
    annualPlantingDate,
    setAnnualPlantingDate,
    annualHarvestDate,
    setAnnualHarvestDate,
    annualNotes,
    setAnnualNotes,
    yieldFormOpen,
    setYieldFormOpen,
    yieldFormLoading,
    yieldYear,
    setYieldYear,
    yieldKg,
    setYieldKg,
    yieldHarvestDate,
    setYieldHarvestDate,
    yieldNotes,
    setYieldNotes,
    productionProfileOpen,
    setProductionProfileOpen,
    productionProfileLoading,
    productionProfileMessage,
    setProductionProfileMessage,
    detailCropCycle,
    setDetailCropCycle,
    detailPlantingYear,
    setDetailPlantingYear,
    detailBearing,
    setDetailBearing,
    resetAnnualForm,
    resetYieldForm,
    loadProductionHistory,
    handleSaveProductionProfile,
    handleAddAnnualSeason,
    handleDeleteAnnualSeason,
    handleAddPerennialYield,
    handleDeletePerennialYield,
    syncProfileFromField,
    resetProductionUi,
  } = useFieldProductionHistory({ selectedField, setSelectedField, setRealFields });

  const {
    activities,
    activitiesLoading,
    activityFormOpen,
    setActivityFormOpen,
    activityFormLoading,
    activityMessage,
    setActivityMessage,
    activityType,
    setActivityType,
    activityDate,
    setActivityDate,
    activityProductName,
    setActivityProductName,
    activityQuantity,
    setActivityQuantity,
    activityUnit,
    setActivityUnit,
    activityDoseMode,
    setActivityDoseMode,
    activityWaterM3,
    setActivityWaterM3,
    activityDurationHours,
    setActivityDurationHours,
    activityCost,
    setActivityCost,
    activityNotes,
    setActivityNotes,
    activityPhoto,
    activityPhotoPreview,
    aiAnalysis,
    diagnosisSequenceNo,
    diagnosisNeedsMoreEvidence,
    diagnosisRequestedEvidence,
    aiAnalyzing,
    aiAnalysisError,
    aiAccessStatus,
    aiAccessLoading,
    aiHistorySaveStatus,
    aiHistorySaveMessage,
    aiHistorySavedPoints,
    clearActivityPhoto,
    handleActivityPhotoChange,
    openAiAnalysisScreen,
    handleAiAnalyzeActivityPhoto,
    handleDiagnosisFollowUpPhoto,
    loadFieldActivities,
    openActivityForm,
    handleAddActivity,
    handleSaveAiAnalysisToHistory,
    handleDeleteActivity,
  } = useFieldActivities({
    selectedField,
    setSelectedField,
    realFields,
    setScreen,
    unifiedClimateContext,
  });

  const [fieldFabOpen, setFieldFabOpen] = useState(false);
  const [fieldDetailEntry, setFieldDetailEntry] = useState<{
    fieldId: string;
    actionTarget: string | null;
    nonce: number;
  } | null>(null);

  const statusInfo = {
    good: {
      label: 'İyi',
      color: '#2f7d32',
      bg: '#edf7ed',
    },
    check: {
      label: 'Kontrol Et',
      color: '#d58b00',
      bg: '#fff7df',
    },
    urgent: {
      label: 'İlgilen',
      color: '#d8453a',
      bg: '#fff0ee',
    },
  };

  const openFieldDetail = (
    field: Field,
    entry: { actionTarget?: string | null } = {},
  ) => {
    setFieldFabOpen(false);
    setFieldDetailEntry(
      entry.actionTarget
        ? {
            fieldId: String(field.id),
            actionTarget: String(entry.actionTarget),
            nonce: Date.now(),
          }
        : null,
    );
    setSelectedField(field);
    resetSectionsUi();
    resetProductionUi();
    setActivityFormOpen(false);
    setActivityMessage('');
    syncProfileFromField(field);
    setScreen('fieldDetail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (screen !== 'fieldDetail' || !selectedField) return;
    void loadFieldSections(selectedField);
    void loadProductionHistory(selectedField);
    void loadFieldActivities(selectedField);
    syncProfileFromField(selectedField);
  }, [screen, selectedField?.id]);

  const openSoilAnalysisForField = (field?: Field | null) => {
    if (field) {
      setSoilFieldId(String(field.id));
    }
    setScreen('soilAnalysisHub');
  };

  const pusulaTestMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('pusulaTest') === '1';

  if (pusulaTestMode) {
    return <PusulaTest />;
  }


  if (pusulaIntroOpen) {
    const clearPreviewSeenFlag = () => {
      if (!isNewUserPreview || typeof window === 'undefined') return;

      // Önizleme gerçek kullanıcının "fragmanı gördü" kaydını kirletmesin.
      try {
        window.localStorage.removeItem('tp_pusula_intro_seen_v1');
      } catch {
        // localStorage kapalıysa önizleme yine çalışır.
      }
    };

    return (
      <PusulaIntroTrailer
        open
        hasFields={isNewUserPreview ? false : realFields.length > 0}
        onClose={() => {
          setPusulaIntroOpen(false);
          clearPreviewSeenFlag();
        }}
        onStartFirstField={() => {
          setPusulaIntroOpen(false);
          clearPreviewSeenFlag();

          if (isNewUserPreview) {
            // Test hesabındaki gerçek tarlalar alan limitini tetiklemesin.
            // Form açılır; aşağıdaki handleAddField koruması gerçek kayıt yapılmasını engeller.
            resetFieldForm();
            setFieldFormMessage('');
            setScreen('addField');
            if (provinceOptions.length === 0) void loadProvinceOptions();
            return;
          }

          openAddField();
        }}
      />
    );
  }

  if (screen === 'calendar') {
    return (
      <CalendarScreen
        cmsRuntimeCss={cmsRuntimeCss}
        cmsPageFor={cmsPageFor}
        cmsBlockFor={cmsBlockFor}
        cmsMenuFor={cmsMenuFor}
        cmsText={cmsText}
        cmsSub={cmsSub}
        cmsBlockStyle={cmsBlockStyle}
        calendarReminders={calendarReminders}
        calendarLoading={calendarLoading}
        pushEnabled={pushEnabled}
        pushSupported={pushSupported}
        pushMessage={pushMessage}
        pushLoading={pushLoading}
        reminderMessage={reminderMessage}
        reminderFormOpen={reminderFormOpen}
        reminderFieldId={reminderFieldId}
        reminderType={reminderType}
        reminderTitle={reminderTitle}
        reminderDate={reminderDate}
        reminderTime={reminderTime}
        reminderNotes={reminderNotes}
        reminderFormLoading={reminderFormLoading}
        realFields={realFields}
        setScreen={setScreen}
        setReminderFormOpen={setReminderFormOpen}
        setReminderMessage={setReminderMessage}
        setReminderFieldId={setReminderFieldId}
        setReminderType={setReminderType}
        setReminderTitle={setReminderTitle}
        setReminderDate={setReminderDate}
        setReminderTime={setReminderTime}
        setReminderNotes={setReminderNotes}
        openReminderModal={openReminderModal}
        handleAddReminder={handleAddReminder}
        handleToggleReminder={handleToggleReminder}
        handleDeleteReminder={handleDeleteReminder}
        enablePushNotifications={enablePushNotifications}
        disablePushNotifications={disablePushNotifications}
        sendTestPushNotification={sendTestPushNotification}
        openAiAnalysisScreen={openAiAnalysisScreen}
      />
    );
  }

  if (screen === 'aiAnalysis') {
    return (
      <>
        <AppDrawer
          open={sideMenuOpen}
          activeScreen={screen}
          onClose={() => setSideMenuOpen(false)}
          onNavigate={(target, label) => {
            setSideMenuOpen(false);

            if (label === 'Tarlalarım') {
              setScreen('home');
              window.setTimeout(() => {
                document
                  .querySelector('.tp-home-field')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }, 80);
              return;
            }

            setScreen(target as Screen);
          }}
        />

        <GlobalPusulaBand
          screen="aiAnalysis"
          title="Pusula AI"
          fieldName={
            realFields.find((field) => String(field.id) === String(favoriteFieldId))?.name ??
            realFields[0]?.name ??
            null
          }
          onBack={goBackInMenu}
          onMenu={() => setSideMenuOpen(true)}
          onOpenAi={() => setScreen('aiAnalysis')}
        />

        <AiAnalysisScreen
          cmsRuntimeCss={cmsRuntimeCss}
          cmsPageFor={cmsPageFor}
          cmsBlockFor={cmsBlockFor}
          cmsText={cmsText}
          cmsSub={cmsSub}
          aiAccessStatus={aiAccessStatus}
          aiAccessLoading={aiAccessLoading}
          realFields={realFields}
          fieldWeather={fieldWeather}
          loadFieldWeather={loadFieldWeather}
          unifiedClimateContext={unifiedClimateContext}
          selectedField={selectedField}
          setSelectedField={setSelectedField}
          activityPhotoPreview={activityPhotoPreview}
          activityPhoto={activityPhoto}
          activityNotes={activityNotes}
          setActivityNotes={setActivityNotes}
          aiAnalyzing={aiAnalyzing}
          aiAnalysisError={aiAnalysisError}
          aiAnalysis={aiAnalysis}
          diagnosisSequenceNo={diagnosisSequenceNo}
          diagnosisNeedsMoreEvidence={diagnosisNeedsMoreEvidence}
          diagnosisRequestedEvidence={diagnosisRequestedEvidence}
          aiHistorySaveStatus={aiHistorySaveStatus}
          aiHistorySaveMessage={aiHistorySaveMessage}
          aiHistorySavedPoints={aiHistorySavedPoints}
          setScreen={setScreen}
          clearActivityPhoto={clearActivityPhoto}
          handleActivityPhotoChange={handleActivityPhotoChange}
          handleAiAnalyzeActivityPhoto={handleAiAnalyzeActivityPhoto}
          handleDiagnosisFollowUpPhoto={handleDiagnosisFollowUpPhoto}
          handleSaveAiAnalysisToHistory={handleSaveAiAnalysisToHistory}
          openAddField={openAddField}
          openCalendarScreen={openCalendarScreen}
        />
      </>
    );
  }

  if (
    screen === 'welcome' ||
    screen === 'login' ||
    screen === 'emailRegister' ||
    screen === 'emailLogin' ||
    screen === 'emailVerification'
  ) {
    return (
      <AuthScreens
        screen={screen}
        setScreen={setScreen}
        cmsRuntimeCss={cmsRuntimeCss}
        email={email}
        setEmail={setEmail}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        authLoading={authLoading}
        authMessage={authMessage}
        setAuthMessage={setAuthMessage}
        verificationEmail={verificationEmail}
        handleEmailRegister={handleEmailRegister}
        handleEmailLogin={handleEmailLogin}
      />
    );
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        cmsRuntimeCss={cmsRuntimeCss}
        onboardingStep={onboardingStep}
        answers={answers}
        otherProduct={otherProduct}
        authMessage={authMessage}
        authLoading={authLoading}
        onOtherProductChange={setOtherProduct}
        onBack={() => {
          if (onboardingStep === 0) {
            if (isNewUserPreview) return;
            setScreen('login');
          } else {
            setOnboardingStep(onboardingStep - 1);
          }
        }}
        onSelectAnswer={selectAnswer}
        onSkip={skipOnboardingStep}
        onNext={nextOnboardingStep}
      />
    );
  }

  if (screen === 'addField') {
    return (
      <AddFieldScreen
        cmsRuntimeCss={cmsRuntimeCss}
        setScreen={setScreen}
        fieldName={fieldName}
        setFieldName={setFieldName}
        selectedProvinceId={selectedProvinceId}
        selectedDistrictId={selectedDistrictId}
        provinceOptions={provinceOptions}
        districtOptions={districtOptions}
        villageOptions={villageOptions}
        fieldVillage={fieldVillage}
        locationOptionsLoading={locationOptionsLoading}
        locationOptionsMessage={locationOptionsMessage}
        fieldAda={fieldAda}
        setFieldAda={setFieldAda}
        fieldParcel={fieldParcel}
        setFieldParcel={setFieldParcel}
        parcelLookupLoading={parcelLookupLoading}
        parcelLookupMessage={parcelLookupMessage}
        parcelGeometry={parcelGeometry}
        parcelLookupSource={parcelLookupSource}
        parcelLocationMessage={parcelLocationMessage}
        fieldLatitude={fieldLatitude}
        fieldLongitude={fieldLongitude}
        fieldArea={fieldArea}
        setFieldArea={setFieldArea}
        fieldSeason={fieldSeason}
        setFieldSeason={setFieldSeason}
        fieldCrop={fieldCrop}
        fieldCropCycle={fieldCropCycle}
        fieldPlantingYear={fieldPlantingYear}
        setFieldPlantingYear={setFieldPlantingYear}
        fieldBearing={fieldBearing}
        setFieldBearing={setFieldBearing}
        fieldFormMessage={fieldFormMessage}
        fieldFormLoading={fieldFormLoading}
        getDistrictDisplayName={districtDisplayName}
        handleProvinceSelection={handleProvinceSelection}
        handleDistrictSelection={handleDistrictSelection}
        handleVillageSelection={handleVillageSelection}
        handleParcelLookup={handleParcelLookup}
        openOfficialParcelQuery={openOfficialParcelQuery}
        handleFieldCropSelection={handleFieldCropSelection}
        handleAddField={handleAddField}
      />
    );
  }

  if (screen === 'ready') {
    return (
      <ReadyScreen
        cmsRuntimeCss={cmsRuntimeCss}
        onContinue={() => {
          setScreen('home');

          // Geliştirici YENİ KULLANICI önizlemesinde gerçek hesapta tarla olsa bile
          // fragmanı 0 tarlalı yeni kullanıcı gibi zorla göster.
          if (isNewUserPreview) {
            window.setTimeout(() => setPusulaIntroOpen(true), 260);
          }
        }}
      />
    );
  }

  if (screen === 'fieldDetail' && selectedField) {
    return (
      <FieldDetailScreen
        {...{
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
          yieldYear
        }}
      />
    );
  }

  const cmsDesktopMenuItems = cmsMenus.filter(item=>item.is_visible && item.show_desktop && (!item.admin_only || isAdmin)).sort((a,b)=>a.position-b.position).map(item=>({screen:((item.page_key || 'home') as Screen),icon:item.icon || '•',label:item.label,badge:item.badge_text || undefined}));
  const desktopMenuItems: Array<{ screen: Screen; icon: string; label: string; badge?: string }> = [
    ...(cmsDesktopMenuItems.length ? cmsDesktopMenuItems : FALLBACK_DESKTOP_MENU_ITEMS),
    ...(isAdmin && !(cmsDesktopMenuItems.length && cmsDesktopMenuItems.some(item=>item.screen==='adminHub')) ? [{screen:'adminHub' as Screen,icon:'◆',label:'Yönetim',badge:'ADMIN'}] : []),
  ].map((item) =>
    String(item.screen) === 'supportHub'
      ? { ...item, label: 'Tarım Gündemi' }
      : item,
  );

  const placeholderMeta = { ...BASE_PLACEHOLDER_META };
  (Object.keys(BASE_PLACEHOLDER_META) as Screen[]).forEach((pageScreen)=>{
    const page=cmsPages.find(item=>item.page_key===pageScreen && item.is_visible);
    const base=BASE_PLACEHOLDER_META[pageScreen]; if(!page || !base) return;
    const cmsCards=cmsBlocks.filter(item=>item.page_key===pageScreen && item.is_visible).sort((a,b)=>a.position-b.position).map(item=>item.title || item.block_key);
    placeholderMeta[pageScreen]={title:page.title || base.title,subtitle:page.subtitle || base.subtitle,icon:page.icon || base.icon,cards:cmsCards.length?cmsCards:base.cards};
  });
    if (unifiedMapOpen) {
    return (
      <UnifiedMapScreen
        fields={realFields}
        selectedFieldId={
          mapFieldId ||
          soilFieldId ||
          weatherHubFieldId ||
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        initialSection={unifiedMapSection}
        onFieldChange={(id) => {
          setMapFieldId(id);
          setSoilFieldId(id);
          setWeatherHubFieldId(id);
          setFieldControlFieldId(id);
        }}
        onBack={() => setUnifiedMapOpen(false)}
      />
    );
  }

    if (sentinel1MapOpen) {
    return (
      <UnifiedMapScreen
        fields={realFields}
        selectedFieldId={mapFieldId || soilFieldId || favoriteFieldId || String(realFields[0]?.id ?? '')}
        initialSection="radar"
        onFieldChange={(id) => { setMapFieldId(id); setSoilFieldId(id); }}
        onBack={() => setSentinel1MapOpen(false)}
      />
    );
  }

    if (demMapOpen) {
    return (
      <DemMapScreen
        fields={realFields}
        selectedFieldId={
          mapFieldId ||
          soilFieldId ||
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        onFieldChange={(id) => {
          setMapFieldId(id);
          setSoilFieldId(id);
        }}
        onBack={() => setDemMapOpen(false)}
      />
    );
  }

    if (era5MapOpen) {
    return (
      <UnifiedMapScreen
        fields={realFields}
        selectedFieldId={mapFieldId || weatherHubFieldId || favoriteFieldId || String(realFields[0]?.id ?? '')}
        initialSection="climate"
        onFieldChange={(id) => { setMapFieldId(id); setWeatherHubFieldId(id); }}
        onBack={() => setEra5MapOpen(false)}
      />
    );
  }


  const withGlobalDrawer = (
    content: ReactNode,
    showGlobalBand = true,
  ) => (
    <>
      <AppDrawer
        open={sideMenuOpen}
        activeScreen={screen}
        onClose={() => setSideMenuOpen(false)}
        onNavigate={(target, label) => {
          setSideMenuOpen(false);

          if (label === 'Tarlalarım') {
            setScreen('home');
            window.setTimeout(() => {
              document
                .querySelector('.tp-home-field')
                ?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
            return;
          }

          setScreen(target as Screen);
        }}
      />
      {showGlobalBand && screen !== 'home' && (
        <GlobalPusulaBand
          screen={String(screen)}
          title={
            desktopMenuItems.find(
              (item) => String(item.screen) === String(screen),
            )?.label ?? null
          }
          fieldName={
            realFields.find((field) => String(field.id) === String(favoriteFieldId))?.name ??
            realFields[0]?.name ??
            null
          }
          onBack={goBackInMenu}
          onMenu={() => setSideMenuOpen(true)}
          onOpenAi={() => setScreen('aiAnalysis')}
        />
      )}
      {content}
    </>
  );

  if (screen === 'notificationsHub') {
    return withGlobalDrawer(
      <NotificationsHubScreen
        fields={realFields}
        selectedFieldId={
          selectedField?.id ??
          favoriteFieldId ??
          realFields[0]?.id ??
          ''
        }
        setScreen={setScreen}
        onOpenFieldDetail={openFieldDetail}
      />,
    );
  }

  if (screen === 'soilAnalysisHub') {
    return withGlobalDrawer(
      <SoilAnalysisPage
        fields={realFields}
        selectedFieldId={
          soilFieldId ||
          String(
            realFields.find(
              (field) => String(field.id) === favoriteFieldId,
            )?.id ??
              realFields[0]?.id ??
              '',
          )
        }
        onFieldChange={(id) => setSoilFieldId(id)}
        onBack={() => setScreen('home')}
        onOpenDemMap={() => setDemMapOpen(true)}
        onOpenSentinel1Map={() => setSentinel1MapOpen(true)}
      />
    );
  }


  if (screen === 'inventoryHub') {
    return withGlobalDrawer(
      <PestStoreScreen
        fields={realFields}
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
        onNavigateToField={(fieldId) => {
          const field = realFields.find(
            (item) => String(item.id) === String(fieldId),
          );

          if (field) {
            openFieldDetail(field);
          }
        }}
      />
    );
  }

  if (screen === 'marketHub') {
    return withGlobalDrawer(
      <MarketPricesScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        setScreen={setScreen}
      />
    );
  }

  if (screen === 'supportHub') {
    return withGlobalDrawer(
      <AgriculturalSupportScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />,
    );
  }

  if (screen === 'fieldControlHub') {
    return withGlobalDrawer(
      <UnifiedMapScreen
        fields={realFields}
        selectedFieldId={
          mapFieldId ||
          fieldControlFieldId ||
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        initialSection="vegetation"
        onFieldChange={(id) => {
          setMapFieldId(id);
          setFieldControlFieldId(id);
          setSoilFieldId(id);
          setWeatherHubFieldId(id);
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'weatherHub') {
    return withGlobalDrawer(
      <WeatherHubScreen
        cmsRuntimeCss={cmsRuntimeCss}
        cmsPageFor={cmsPageFor}
        cmsBlockFor={cmsBlockFor}
        cmsText={cmsText}
        realFields={realFields}
        fieldWeather={fieldWeather}
        fieldHourlyWeather={fieldHourlyWeather}
        loadFieldHourlyWeather={loadFieldHourlyWeather}
        onPlanSprayWindow={(field, date, time, until) => {
          openCalendarScreen();
          openReminderModal(field);
          setReminderType('İlaçlama');
          setReminderTitle('İlaçlama hava kontrolü');
          setReminderDate(date);
          setReminderTime(time);
          setReminderNotes(`${time}–${until} aralığı saatlik hava tahmininde değerlendirilebilir görünüyor. İşlem öncesi tarladaki hava koşullarını ve kullanacağın ürünün etiketini kontrol et.`);
        }}
        weatherHubFieldId={weatherHubFieldId}
        nasaPowerState={nasaPowerState}
        era5ClimateState={era5ClimateState}
        unifiedClimateContext={unifiedClimateContext}
        sideMenuOpen={false}
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
        setWeatherHubFieldId={setWeatherHubFieldId}
        loadFieldWeather={loadFieldWeather}
        weatherDayLabel={weatherDayLabel}
        weatherIcon={weatherIcon}
        openEra5Map={() => { setUnifiedMapSection('climate'); setUnifiedMapOpen(true); }}
      />
    );
  }

  if (screen === 'adminHub') {
    return <AdminPageBuilder onBack={() => setScreen('home')} />;
  }

  if (screen === 'agendaHub') {
    return withGlobalDrawer(
      <AgriNewsScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />
    );
  }

  if (screen === 'nutritionHub') {
    return withGlobalDrawer(
      <PlantNutritionScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />
    );
  }

  if (screen === 'producerMarketHub') {
    return withGlobalDrawer(
      <ProducerMarketScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />
    );
  }

  if (screen === 'pestGuideHub') {
    return withGlobalDrawer(
      <PestGuideScreen
        fields={realFields}
        selectedFieldId={
          favoriteFieldId ||
          String(realFields[0]?.id ?? '')
        }
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        sideMenuOpen={false}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />
    );
  }

  const placeholder = placeholderMeta[screen];
  if (placeholder) {
    return withGlobalDrawer(
      <PlaceholderScreen
        cmsRuntimeCss={cmsRuntimeCss}
        placeholder={placeholder}
        sideMenuOpen={false}
        screen={screen}
        desktopMenuItems={desktopMenuItems}
        setScreen={setScreen}
        setSideMenuOpen={setSideMenuOpen}
      />
    );
  }

  return withGlobalDrawer(
    <HomeScreen
      cmsRuntimeCss={cmsRuntimeCss}
      realFields={realFields}
      setRealFields={setRealFields}
      favoriteFieldId={favoriteFieldId}
      satelliteByField={satelliteByField}
      loadFieldSatellite={loadFieldSatellite}
      fieldWeather={fieldWeather}
      fieldHourlyWeather={fieldHourlyWeather}
      loadFieldHourlyWeather={loadFieldHourlyWeather}
      loadFieldWeather={loadFieldWeather}
      setWeatherHubFieldId={setWeatherHubFieldId}
      openAddField={openAddField}
      openAiAnalysisScreen={openAiAnalysisScreen}
      openCalendarScreen={openCalendarScreen}
      openSoilAnalysisForField={openSoilAnalysisForField}
      openFieldDetail={openFieldDetail}
      handleDeleteField={handleDeleteField}
      setFieldControlFieldId={setFieldControlFieldId}
      setScreen={setScreen}
      setSideMenuOpen={setSideMenuOpen}
      sideMenuOpen={false}
    />,
    false,
  );
}
