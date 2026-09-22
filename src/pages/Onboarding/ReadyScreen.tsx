import { onboardingStyles } from '../../styles/onboardingStyles';

type ReadyScreenProps = {
  cmsRuntimeCss: string;
  onContinue: () => void;
};

export default function ReadyScreen({
  cmsRuntimeCss,
  onContinue,
}: ReadyScreenProps) {
  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      <div className="tp-onboarding-page">
        <div className="tp-ready-shell">
          <div className="tp-ready-circle">
            <span>✓</span>
          </div>

          <h1>Hazırsın!</h1>

          <p>TarlaPusula başlangıç profilini oluşturdu.</p>

          <div className="tp-profile-progress-card">
            <div>
              <strong>Profilin %30 tamamlandı</strong>
              <span>Seni kullandıkça daha iyi tanıyacağız.</span>
            </div>

            <div className="tp-profile-bar">
              <span />
            </div>
          </div>

          <div className="tp-ready-benefits">
            <div>
              <span>🌦️</span>
              <p>Hava ve risk uyarıları kişiselleşecek.</p>
            </div>

            <div>
              <span>🌱</span>
              <p>Ürünlerine uygun içerikler gösterilecek.</p>
            </div>

            <div>
              <span>🔔</span>
              <p>Gereksiz bildirimler azaltılacak.</p>
            </div>
          </div>

          <button className="tp-main-button" onClick={onContinue}>
            Ana Sayfaya Geç
          </button>
        </div>
      </div>
    </>
  );
}
