import { onboardingQuestions } from '../../data/onboarding';
import { onboardingStyles } from '../../styles/onboardingStyles';

type OnboardingScreenProps = {
  cmsRuntimeCss: string;
  onboardingStep: number;
  answers: Record<number, string[]>;
  otherProduct: string;
  authMessage: string;
  authLoading: boolean;
  onOtherProductChange: (value: string) => void;
  onBack: () => void;
  onSelectAnswer: (value: string) => void;
  onSkip: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
};

export default function OnboardingScreen({
  cmsRuntimeCss,
  onboardingStep,
  answers,
  otherProduct,
  authMessage,
  authLoading,
  onOtherProductChange,
  onBack,
  onSelectAnswer,
  onSkip,
  onNext,
}: OnboardingScreenProps) {
  const currentQuestion = onboardingQuestions[onboardingStep];
  const selectedAnswers = answers[onboardingStep] || [];
  const showOtherProductInput =
    onboardingStep === 2 && selectedAnswers.includes('Diğer ürün');

  if (!currentQuestion) return null;

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      <div className="tp-onboarding-page">
        <div className="tp-question-shell">
          <div className="tp-question-top">
            <button className="tp-back-button" onClick={onBack}>
              ←
            </button>

            <strong>
              {onboardingStep + 1} / {onboardingQuestions.length}
            </strong>
          </div>

          <div className="tp-progress">
            {onboardingQuestions.map((_, index) => (
              <span
                key={index}
                className={index <= onboardingStep ? 'tp-progress-active' : ''}
              />
            ))}
          </div>

          <div className="tp-question-copy">
            <p className="tp-question-label">SENİ TANIYALIM</p>
            <h1>{currentQuestion.title}</h1>
            <p>{currentQuestion.subtitle}</p>
          </div>

          <div className="tp-options">
            {currentQuestion.options.map(([icon, label]) => {
              const selected = selectedAnswers.includes(label);

              return (
                <button
                  key={label}
                  className={`tp-option ${selected ? 'selected' : ''}`}
                  onClick={() => onSelectAnswer(label)}
                >
                  <span className="tp-option-icon">{icon}</span>
                  <span>{label}</span>
                  <span className="tp-option-check">{selected ? '✓' : ''}</span>
                </button>
              );
            })}

            {showOtherProductInput && (
              <div className="tp-other-product-box">
                <label>
                  Diğer ürünün adı
                  <input
                    type="text"
                    value={otherProduct}
                    onChange={(e) => onOtherProductChange(e.target.value)}
                    placeholder="Örn: Şeker pancarı, Pamuk, Çay, Kivi..."
                  />
                </label>

                <small>Buraya listede olmayan ürünü yazabilirsin.</small>
              </div>
            )}
          </div>

          {authMessage && <div className="tp-auth-message">{authMessage}</div>}

          <div className="tp-question-actions">
            <button
              className="tp-skip-button"
              onClick={onSkip}
              disabled={authLoading}
            >
              Şimdilik geç
            </button>

            <button
              className="tp-main-button tp-next-button"
              onClick={onNext}
              disabled={authLoading}
            >
              {authLoading
                ? 'Kaydediliyor...'
                : onboardingStep === onboardingQuestions.length - 1
                  ? 'Tamamla'
                  : 'Devam'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
