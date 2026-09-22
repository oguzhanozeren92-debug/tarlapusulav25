import type { FormEvent } from 'react';
import FieldMap from '../../components/FieldMap';
import MobileWheelPicker from '../../components/MobileWheelPicker';
import { TURKEY_CROP_PICKER_OPTIONS } from '../../data/crops';
import { onboardingStyles } from '../../styles/onboardingStyles';
import type { CropCycle, LocationOption, Screen } from '../../types';

type Setter<T> = (value: T) => void;

type AddFieldScreenProps = {
  cmsRuntimeCss: string;
  setScreen: Setter<Screen>;

  fieldName: string;
  setFieldName: Setter<string>;

  selectedProvinceId: number | null;
  selectedDistrictId: number | null;
  provinceOptions: LocationOption[];
  districtOptions: LocationOption[];
  villageOptions: LocationOption[];
  fieldVillage: string;
  locationOptionsLoading: boolean;
  locationOptionsMessage: string;

  fieldAda: string;
  setFieldAda: Setter<string>;
  fieldParcel: string;
  setFieldParcel: Setter<string>;

  parcelLookupLoading: boolean;
  parcelLookupMessage: string;
  parcelGeometry: any | null;
  parcelLookupSource: string;
  parcelLocationMessage: string;

  fieldLatitude: number | null;
  fieldLongitude: number | null;
  fieldArea: string;
  setFieldArea: Setter<string>;
  fieldSeason: string;
  setFieldSeason: Setter<string>;

  fieldCrop: string;
  fieldCropCycle: CropCycle;
  fieldPlantingYear: string;
  setFieldPlantingYear: Setter<string>;
  fieldBearing: boolean;
  setFieldBearing: Setter<boolean>;

  fieldFormMessage: string;
  fieldFormLoading: boolean;

  getDistrictDisplayName: (name: string) => string;
  handleProvinceSelection: (value: string) => void;
  handleDistrictSelection: (value: string) => void;
  handleVillageSelection: (value: string) => void;
  handleParcelLookup: () => void | Promise<void>;
  openOfficialParcelQuery: () => void;
  handleFieldCropSelection: (value: string) => void;
  handleAddField: (event: FormEvent) => void | Promise<void>;
};

export default function AddFieldScreen({
  cmsRuntimeCss,
  setScreen,
  fieldName,
  setFieldName,
  selectedProvinceId,
  selectedDistrictId,
  provinceOptions,
  districtOptions,
  villageOptions,
  fieldVillage,
  locationOptionsLoading,
  locationOptionsMessage,
  fieldAda,
  setFieldAda,
  fieldParcel,
  setFieldParcel,
  parcelLookupLoading,
  parcelLookupMessage,
  parcelGeometry,
  parcelLookupSource,
  parcelLocationMessage,
  fieldLatitude,
  fieldLongitude,
  fieldArea,
  setFieldArea,
  fieldSeason,
  setFieldSeason,
  fieldCrop,
  fieldCropCycle,
  fieldPlantingYear,
  setFieldPlantingYear,
  fieldBearing,
  setFieldBearing,
  fieldFormMessage,
  fieldFormLoading,
  getDistrictDisplayName,
  handleProvinceSelection,
  handleDistrictSelection,
  handleVillageSelection,
  handleParcelLookup,
  openOfficialParcelQuery,
  handleFieldCropSelection,
  handleAddField,
}: AddFieldScreenProps) {
  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      <div className="tp-onboarding-page">
        <div className="tp-field-form-shell">
          <div className="tp-question-top">
            <button className="tp-back-button" onClick={() => setScreen('home')}>
              ←
            </button>
            <strong>YENİ TARLA</strong>
          </div>

          <div className="tp-field-form-heading tp-field-form-heading-cover">
            <div className="tp-new-field-cover">
              <img
                src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=86"
                alt=""
              />
              <div className="tp-new-field-cover-overlay" />
              <div className="tp-new-field-cover-copy">
                <span>YENİ TARLA</span>
                <h1>Tarlanı ekle</h1>
                <p>Ada, parsel ve üretim bilgilerini kaydet.</p>
              </div>
            </div>
            <p className="tp-new-field-intro">
              İstersen parsel konumunu ekleyip uydu görünümünde de kontrol edebilirsin.
            </p>
          </div>

          <form className="tp-field-form" onSubmit={handleAddField}>
            <label className="tp-field-full">
              Tarla adı
              <input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Örn: Kuzey Buğday Tarlası"
                required
              />
            </label>

            <div className="tp-field-form-grid">
              <label>
                İl
                <MobileWheelPicker
                  title="İl seç"
                  value={selectedProvinceId === null ? '' : String(selectedProvinceId)}
                  onChange={handleProvinceSelection}
                  disabled={locationOptionsLoading && provinceOptions.length === 0}
                  placeholder={
                    provinceOptions.length === 0 && locationOptionsLoading
                      ? 'İller yükleniyor...'
                      : 'İl seç'
                  }
                  searchable
                  searchPlaceholder="İl ara..."
                  options={provinceOptions.map((province) => ({
                    value: String(province.id),
                    label: province.name,
                  }))}
                />
              </label>

              <label>
                İlçe
                <MobileWheelPicker
                  title="İlçe seç"
                  value={selectedDistrictId === null ? '' : String(selectedDistrictId)}
                  onChange={handleDistrictSelection}
                  disabled={!selectedProvinceId || districtOptions.length === 0}
                  placeholder={
                    !selectedProvinceId
                      ? 'Önce il seç'
                      : districtOptions.length === 0 && locationOptionsLoading
                        ? 'İlçeler yükleniyor...'
                        : 'İlçe seç'
                  }
                  searchable
                  searchPlaceholder="İlçe ara..."
                  options={districtOptions.map((district) => ({
                    value: String(district.id),
                    label: getDistrictDisplayName(district.name),
                  }))}
                />
              </label>
            </div>

            <label className="tp-field-full">
              Köy / Mahalle
              <MobileWheelPicker
                title="Köy / Mahalle seç"
                value={String(
                  villageOptions.find((item) => item.name === fieldVillage)?.id ?? '',
                )}
                onChange={handleVillageSelection}
                disabled={!selectedDistrictId || villageOptions.length === 0}
                placeholder={
                  !selectedDistrictId
                    ? 'Önce ilçe seç'
                    : villageOptions.length === 0 && locationOptionsLoading
                      ? 'Köy / mahalle yükleniyor...'
                      : 'Köy / mahalle seç'
                }
                searchable
                searchPlaceholder="Köy veya mahalle ara..."
                options={villageOptions.map((village) => ({
                  value: String(village.id),
                  label: village.name,
                }))}
              />
            </label>

            {locationOptionsMessage && (
              <div className="tp-field-form-message">{locationOptionsMessage}</div>
            )}

            <div className="tp-field-form-grid">
              <label>
                Ada
                <input
                  value={fieldAda}
                  onChange={(e) => setFieldAda(e.target.value)}
                  inputMode="numeric"
                  placeholder="87"
                  required
                />
              </label>

              <label>
                Parsel
                <input
                  value={fieldParcel}
                  onChange={(e) => setFieldParcel(e.target.value)}
                  inputMode="numeric"
                  placeholder="6"
                  required
                />
              </label>
            </div>

            <div className="tp-parcel-lookup-panel">
              <div className="tp-parcel-lookup-actions">
                <button
                  type="button"
                  className="tp-parcel-search-button"
                  onClick={() => void handleParcelLookup()}
                  disabled={parcelLookupLoading}
                >
                  {parcelLookupLoading ? (
                    <span className="tp-parcel-spinner" aria-hidden="true" />
                  ) : (
                    <span className="tp-parcel-button-icon">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle
                          cx="10.7"
                          cy="10.7"
                          r="6.1"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <path
                          d="m15.3 15.3 4.2 4.2"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span>
                    {parcelLookupLoading ? 'Parsel aranıyor...' : 'Parseli Sorgula'}
                  </span>
                </button>

                <button
                  type="button"
                  className="tp-parcel-tkgm-button"
                  onClick={openOfficialParcelQuery}
                >
                  <span className="tp-parcel-button-icon neutral">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M14 5h5v5M19 5l-7 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11 6H6.8A1.8 1.8 0 0 0 5 7.8v9.4A1.8 1.8 0 0 0 6.8 19h9.4a1.8 1.8 0 0 0 1.8-1.8V13"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span>TKGM'de Kontrol Et</span>
                </button>
              </div>

              {parcelLookupMessage && !parcelGeometry && (
                <div className="tp-parcel-result-card error">
                  <div className="tp-parcel-result-status">
                    <span className="tp-parcel-result-icon">!</span>
                    <div>
                      <strong>Parsel bulunamadı</strong>
                      <small>{parcelLookupMessage}</small>
                    </div>
                  </div>
                </div>
              )}

              {parcelGeometry &&
                fieldLatitude !== null &&
                fieldLongitude !== null && (
                  <>
                    <div className="tp-parcel-result-divider">
                      <span>SORGULAMA SONUCU</span>
                    </div>

                    <div className="tp-parcel-result-card success">
                      <div className="tp-parcel-result-status">
                        <span className="tp-parcel-result-icon">✓</span>
                        <div>
                          <strong>Parsel bulundu</strong>
                          <small>
                            {parcelLookupSource
                              ? `Kaynak: ${parcelLookupSource}`
                              : `${fieldAda} Ada • ${fieldParcel} Parsel`}
                          </small>
                        </div>
                      </div>

                      <div className="tp-parcel-result-metric">
                        <small>Alan</small>
                        <strong>{fieldArea ? `${fieldArea} da` : '—'}</strong>
                      </div>

                      <div className="tp-parcel-result-metric">
                        <small>Merkez koordinat</small>
                        <strong>{fieldLatitude.toFixed(6)}</strong>
                        <span>{fieldLongitude.toFixed(6)}</span>
                      </div>
                    </div>

                    <div className="tp-parcel-map-info">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle
                          cx="12"
                          cy="12"
                          r="8"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M12 10.7V16M12 8h.01"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>
                        Gerçek parsel bulundu. Uydu görünümü otomatik açıldı ve parsel
                        sınırı haritaya yüklendi.
                      </span>
                    </div>

                    <div className="tp-parcel-fieldmap-preview">
                      <FieldMap
                        initialCenter={[fieldLongitude, fieldLatitude]}
                        initialZoom={17}
                        height={360}
                        parcelGeometry={parcelGeometry}
                        sections={[]}
                        drawEnabled={Boolean(parcelGeometry)}
                      />
                    </div>
                  </>
                )}

              {parcelLocationMessage && (
                <div className="tp-parcel-map-info">
                  <span>{parcelLocationMessage}</span>
                </div>
              )}
            </div>

            <div className="tp-field-form-grid">
              <label>
                Alan (da)
                <input
                  value={fieldArea}
                  onChange={(e) => setFieldArea(e.target.value)}
                  inputMode="decimal"
                  placeholder="68,2"
                  required
                />
              </label>

              <label>
                Üretim yılı
                <input
                  value={fieldSeason}
                  onChange={(e) => setFieldSeason(e.target.value)}
                  inputMode="numeric"
                  placeholder="2026"
                  required
                />
              </label>
            </div>

            <label className="tp-field-full">
              Ürün
              <MobileWheelPicker
                title="Ürün seç"
                value={fieldCrop}
                onChange={handleFieldCropSelection}
                placeholder="Ürün seç"
                searchable
                searchPlaceholder="Ürün ara..."
                options={TURKEY_CROP_PICKER_OPTIONS}
              />
            </label>

            {fieldCrop && (
              <div className={`tp-crop-cycle-status ${fieldCropCycle}`}>
                <span>{fieldCropCycle === 'perennial' ? '🌳' : '🌾'}</span>
                <div>
                  <strong>
                    {fieldCropCycle === 'perennial'
                      ? 'Çok yıllık ürün'
                      : 'Tek yıllık ürün'}
                  </strong>
                  <small>
                    {fieldCropCycle === 'perennial'
                      ? 'Dikim ve verim bilgileri aşağıda açıldı.'
                      : 'Sezon bazlı üretim kaydı olarak takip edilecek.'}
                  </small>
                </div>
              </div>
            )}

            {fieldCropCycle === 'perennial' && (
              <>
                <div className="tp-field-form-grid">
                  <label>
                    Dikim yılı
                    <input
                      value={fieldPlantingYear}
                      onChange={(e) => setFieldPlantingYear(e.target.value)}
                      inputMode="numeric"
                      placeholder="Örn: 2018"
                    />
                  </label>

                  <label>
                    Ürün veriyor mu?
                    <MobileWheelPicker
                      title="Ürün veriyor mu?"
                      value={fieldBearing ? 'yes' : 'no'}
                      onChange={(value) => setFieldBearing(value === 'yes')}
                      options={[
                        { value: 'yes', label: 'Evet, ürün alıyorum' },
                        { value: 'no', label: 'Hayır, henüz verime yatmadı' },
                      ]}
                    />
                  </label>
                </div>

                <div className="tp-field-note tp-field-note-soft">
                  🌳 Çok yıllık ürünlerde dikim yılı, bahçe yaşı ve yıllara göre kg
                  verim geçmişi tutulur.
                </div>
              </>
            )}

            <div className="tp-field-note">
              🗺️ Harita sınırı ve aynı parselde birden fazla ürün bölümü sonraki
              adımda eklenecek.
            </div>

            {fieldFormMessage && (
              <div className="tp-auth-message">{fieldFormMessage}</div>
            )}

            <button
              className="tp-main-button"
              type="submit"
              disabled={fieldFormLoading}
            >
              {fieldFormLoading ? 'Kaydediliyor...' : 'Tarlayı Kaydet'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}