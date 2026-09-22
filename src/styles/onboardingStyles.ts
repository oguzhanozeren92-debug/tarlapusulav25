export const onboardingStyles = `
.tp-onboarding-page {
  min-height: 100vh;
  background: #f7f8f6;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #1d2a22;
}

.tp-welcome-shell,
.tp-form-shell,
.tp-question-shell,
.tp-ready-shell {
  width: min(100%, 480px);
  min-height: 680px;
  background: #ffffff;
  border: 1px solid #e4e9e3;
  border-radius: 32px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(26, 56, 35, 0.08);
  position: relative;
  overflow: hidden;
}

.tp-welcome-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.tp-logo-mark {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: #f2f7ee;
  border: 2px solid #d8e6d7;
  display: grid;
  place-items: center;
  font-size: 48px;
  margin-top: 28px;
}

.tp-logo-title {
  margin: 20px 0 6px;
  font-size: 34px;
  letter-spacing: 1px;
  color: #163d28;
}

.tp-logo-title span {
  color: #65a83c;
}

.tp-welcome-tagline {
  max-width: 310px;
  color: #647069;
  line-height: 1.55;
  margin: 0;
}

.tp-landscape {
  width: calc(100% + 64px);
  height: 230px;
  margin-top: 38px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    to bottom,
    #fbfcf8 0%,
    #f0f5e9 100%
  );
}

.tp-sun {
  position: absolute;
  right: 65px;
  top: 20px;
  font-size: 38px;
}

.tp-hill {
  position: absolute;
  width: 130%;
  height: 160px;
  border-radius: 50%;
}

.tp-hill-one {
  left: -50%;
  bottom: -70px;
  background: #dfead3;
}

.tp-hill-two {
  right: -55%;
  bottom: -85px;
  background: #cddfbd;
}

.tp-field-lines {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 105px;
  display: flex;
  justify-content: center;
  gap: 20px;
  overflow: hidden;
}

.tp-field-lines span {
  width: 28px;
  height: 150px;
  border-left: 8px solid #95b96e;
  border-radius: 50%;
  transform: rotate(20deg);
}

.tp-welcome-actions {
  width: 100%;
  margin-top: 25px;
  display: grid;
  gap: 10px;
}

.tp-main-button,
.tp-secondary-button,
.tp-provider-button {
  width: 100%;
  min-height: 52px;
  border-radius: 13px;
  font-weight: 800;
  font-size: 15px;
}

.tp-main-button {
  border: 1px solid #226b39;
  background: #226b39;
  color: white;
}

.tp-main-button:hover {
  background: #19592f;
}

.tp-secondary-button {
  border: 1px solid #d8dfd7;
  background: #ffffff;
  color: #34443a;
}

.tp-policy {
  margin: 20px 20px 0;
  color: #8a948d;
  font-size: 11px;
  line-height: 1.5;
}

.tp-form-shell h1,
.tp-question-shell h1,
.tp-ready-shell h1 {
  color: #18261e;
}

.tp-back-button {
  border: 0;
  background: transparent;
  font-size: 26px;
  color: #24352b;
  padding: 4px;
}

.tp-small-logo,
.tp-register-icon {
  width: 78px;
  height: 78px;
  border-radius: 22px;
  background: #f2f7ee;
  display: grid;
  place-items: center;
  font-size: 40px;
  margin: 36px auto 22px;
}

.tp-form-shell h1 {
  text-align: center;
  margin-bottom: 8px;
}

.tp-form-subtitle {
  text-align: center;
  color: #6f7972;
  margin-top: 0;
  margin-bottom: 30px;
}

.tp-login-buttons {
  display: grid;
  gap: 12px;
}

.tp-provider-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #d9dfd8;
  background: white;
  color: #26352c;
}

.tp-provider-button > span {
  width: 22px;
  font-weight: 900;
  font-size: 20px;
}

.tp-google {
  border-color: #ccd8ca;
}

.tp-email-button {
  color: #226b39;
  border-color: #9fc3a4;
}

.tp-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #98a099;
  padding: 5px 0;
}

.tp-divider span {
  flex: 1;
  height: 1px;
  background: #e5e9e4;
}

.tp-text-login {
  min-height: 48px;
  border-radius: 12px;
  background: #f6f7f5;
  border: 1px solid #e5e8e4;
  font-weight: 700;
  color: #46534b;
}

.tp-guest-link {
  width: 100%;
  border: 0;
  background: transparent;
  color: #246b3a;
  font-weight: 700;
  margin-top: 22px;
}

.tp-trust-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 40px;
}

.tp-trust-grid > div {
  padding: 14px;
  border-radius: 13px;
  background: #f7f9f6;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-trust-grid strong {
  font-size: 13px;
}

.tp-trust-grid span {
  font-size: 11px;
  color: #78827b;
}

.tp-register-form {
  display: grid;
  gap: 18px;
}

.tp-register-form label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-size: 13px;
  font-weight: 700;
}

.tp-register-form input {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: white;
  color: #1d2a22;
  font-size: 16px;
  outline: none;
}

.tp-register-form input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-register-form small {
  color: #8a948d;
  font-weight: 400;
  line-height: 1.4;
}

.tp-password-info {
  font-size: 12px;
  color: #4f7959;
}

.tp-center-text {
  text-align: center;
  color: #7b867f;
  font-size: 12px;
  margin-top: 24px;
}

.tp-center-text button {
  border: 0;
  background: transparent;
  color: #226b39;
  font-weight: 800;
}

.tp-question-shell {
  display: flex;
  flex-direction: column;
  max-height: 900px;
}

.tp-question-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-question-top strong {
  font-size: 13px;
  color: #6f7972;
}

.tp-progress {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
  margin: 22px 0 34px;
}

.tp-progress span {
  height: 5px;
  background: #e4e8e3;
  border-radius: 99px;
}

.tp-progress span.tp-progress-active {
  background: #347846;
}

.tp-question-copy {
  margin-bottom: 22px;
}

.tp-question-label {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 1.2px;
  color: #37804a;
  font-weight: 900;
}

.tp-question-copy h1 {
  font-size: 25px;
  line-height: 1.25;
  margin: 0 0 8px;
}

.tp-question-copy > p:last-child {
  color: #78827b;
  margin: 0;
  font-size: 13px;
}

.tp-options {
  display: grid;
  gap: 9px;
  flex: 1;
  overflow-y: auto;
  padding-right: 3px;
}

.tp-option {
  min-height: 58px;
  display: grid;
  grid-template-columns: 42px 1fr 26px;
  align-items: center;
  text-align: left;
  border: 1px solid #dce2db;
  border-radius: 13px;
  background: white;
  color: #26352c;
  padding: 8px 13px;
  font-weight: 700;
}

.tp-option.selected {
  border: 1.5px solid #4a9658;
  background: #f3f9f2;
  color: #1e6334;
}

.tp-option-icon {
  font-size: 24px;
}

.tp-option-check {
  width: 23px;
  height: 23px;
  border-radius: 50%;
  background: #e7f2e5;
  display: grid;
  place-items: center;
  color: #23713a;
  font-weight: 900;
}

.tp-other-product-box {
  padding: 16px;
  border: 1px solid #cddfcd;
  border-radius: 14px;
  background: #f8fbf7;
  display: grid;
  gap: 7px;
}

.tp-other-product-box label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-weight: 800;
  font-size: 13px;
}

.tp-other-product-box input {
  width: 100%;
  min-height: 48px;
  border-radius: 11px;
  border: 1px solid #ccd8cb;
  padding: 0 13px;
  font-size: 16px;
  background: white;
  color: #1d2a22;
  outline: none;
}

.tp-other-product-box input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-other-product-box small {
  color: #77827a;
  font-size: 11px;
}

.tp-question-actions {
  display: grid;
  grid-template-columns: 1fr 130px;
  gap: 12px;
  align-items: center;
  margin-top: 25px;
}

.tp-skip-button {
  border: 0;
  background: transparent;
  text-align: left;
  color: #758078;
  font-weight: 700;
}

.tp-next-button {
  min-height: 48px;
}

.tp-ready-shell {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tp-ready-circle {
  width: 165px;
  height: 165px;
  margin-top: 50px;
  border-radius: 50%;
  background:
    radial-gradient(
      circle at 50% 35%,
      #f9fff5 0%,
      #dfeeda 70%
    );
  display: grid;
  place-items: center;
  position: relative;
}

.tp-ready-circle span {
  width: 65px;
  height: 65px;
  display: grid;
  place-items: center;
  background: #337b46;
  color: white;
  font-size: 35px;
  border-radius: 50%;
}

.tp-ready-shell h1 {
  margin: 25px 0 7px;
  font-size: 30px;
}

.tp-ready-shell > p {
  margin: 0;
  color: #737e76;
}

.tp-profile-progress-card {
  width: 100%;
  margin-top: 30px;
  background: #f7f9f6;
  border-radius: 14px;
  padding: 18px;
  text-align: left;
}

.tp-profile-progress-card > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-profile-progress-card span {
  color: #748078;
  font-size: 12px;
}

.tp-profile-bar {
  width: 100%;
  height: 8px;
  margin-top: 14px;
  border-radius: 99px;
  background: #e4e8e3;
  overflow: hidden;
}

.tp-profile-bar span {
  display: block;
  width: 30%;
  height: 100%;
  background: #3e8c4f;
}

.tp-ready-benefits {
  width: 100%;
  display: grid;
  gap: 9px;
  margin: 25px 0;
  text-align: left;
}

.tp-ready-benefits > div {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 8px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e4e8e3;
  border-radius: 12px;
}

.tp-ready-benefits span {
  font-size: 23px;
}

.tp-ready-benefits p {
  margin: 0;
  font-size: 13px;
  color: #56625a;
}


.tp-auth-message {
  width: 100%;
  border: 1px solid #f0d3c7;
  background: #fff7f3;
  color: #8b4637;
  border-radius: 11px;
  padding: 11px 12px;
  font-size: 12px;
  line-height: 1.45;
}

.tp-auth-message-info {
  border-color: #d5e1ef;
  background: #f4f8fd;
  color: #46627a;
  margin-bottom: 18px;
}

.tp-verification-shell {
  text-align: center;
}

.tp-verification-icon {
  width: 96px;
  height: 96px;
  margin: 70px auto 20px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  background: #f2f7ee;
  font-size: 48px;
}

.tp-verification-address {
  margin: 0 auto 22px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #f6f7f5;
  color: #34443a;
  font-weight: 800;
  font-size: 13px;
  word-break: break-all;
}

.tp-verification-back {
  margin-top: 10px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}


.tp-field-form-shell {
  width: min(100%, 560px);
  min-height: 680px;
  background: #ffffff;
  border: 1px solid #e4e9e3;
  border-radius: 32px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(26, 56, 35, 0.08);
}

.tp-field-form-heading {
  text-align: center;
  margin-bottom: 24px;
}

.tp-field-form-heading .tp-register-icon {
  margin: 18px auto 16px;
}

.tp-field-form-heading h1 {
  margin: 0 0 8px;
  color: #18261e;
  font-size: 28px;
}

.tp-field-form-heading p {
  margin: 0 auto;
  max-width: 430px;
  color: #78827b;
  font-size: 13px;
  line-height: 1.55;
}

.tp-field-form {
  display: grid;
  gap: 14px;
}

.tp-field-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tp-field-form label {
  display: grid;
  gap: 7px;
  color: #34443a;
  font-size: 13px;
  font-weight: 800;
}

.tp-field-form input {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: #ffffff;
  color: #1d2a22;
  font-size: 15px;
  outline: none;
}

.tp-field-form input:focus {
  border-color: #4c8c5b;
  box-shadow: 0 0 0 3px rgba(76, 140, 91, 0.1);
}

.tp-field-note {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7f9f6;
  color: #69756d;
  font-size: 12px;
  line-height: 1.45;
}

.tp-field-detail-page {
  min-height: 100vh;
  background: #f6f8f5;
  color: #1d2a22;
  padding-bottom: 92px;
}

.tp-field-detail-header {
  min-height: 78px;
  background: #ffffff;
  border-bottom: 1px solid #e7ebe6;
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.tp-field-detail-header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-detail-header span {
  color: #7a857e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-field-detail-header strong {
  color: #173923;
  font-size: 17px;
}

.tp-field-detail-back,
.tp-field-detail-more {
  width: 40px;
  height: 40px;
  border: 1px solid #e1e7e0;
  background: #ffffff;
  border-radius: 12px;
  color: #23352a;
  font-size: 20px;
}

.tp-field-detail-content {
  width: min(100% - 32px, 920px);
  margin: 24px auto 0;
  display: grid;
  gap: 18px;
}

.tp-field-hero-card,
.tp-field-detail-section {
  background: #ffffff;
  border: 1px solid #e2e8e1;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(37, 62, 44, 0.04);
}

.tp-field-hero-card {
  padding: 22px;
}

.tp-field-hero-top {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  gap: 14px;
  align-items: start;
}

.tp-field-hero-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #f0f6ec;
  font-size: 30px;
}

.tp-field-hero-copy {
  min-width: 0;
}

.tp-field-hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tp-field-hero-copy h1 {
  margin: 0;
  font-size: 23px;
  color: #17261d;
}

.tp-field-hero-copy p {
  margin: 7px 0 4px;
  font-weight: 800;
  color: #405046;
}

.tp-field-hero-copy > span {
  color: #7b867e;
  font-size: 13px;
}

.tp-field-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid #e9ede8;
  margin-top: 20px;
  padding-top: 18px;
}

.tp-field-hero-stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
  border-right: 1px solid #e8ece7;
}

.tp-field-hero-stats > div:first-child {
  padding-left: 0;
}

.tp-field-hero-stats > div:last-child {
  border-right: 0;
}

.tp-field-hero-stats span {
  color: #839087;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 800;
}

.tp-field-hero-stats strong {
  font-size: 16px;
  color: #21352a;
}

.tp-field-detail-section {
  padding: 20px;
}

.tp-field-detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.tp-field-detail-section-head h2 {
  margin: 3px 0 0;
  font-size: 19px;
  color: #1d2d23;
}

.tp-field-detail-kicker {
  font-size: 10px;
  letter-spacing: 1px;
  font-weight: 900;
  color: #3a7c4b;
}

.tp-field-detail-fresh {
  font-size: 11px;
  color: #2f7d32;
  background: #edf7ed;
  border-radius: 999px;
  padding: 5px 9px;
  font-weight: 800;
}

.tp-field-detail-status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.tp-field-detail-status-grid article {
  border: 1px solid #e6ebe5;
  border-radius: 15px;
  padding: 14px;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  background: #fbfcfa;
}

.tp-detail-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #eef5eb;
  font-size: 19px;
}

.tp-field-detail-status-grid strong {
  color: #26382d;
}

.tp-field-detail-status-grid p,
.tp-field-detail-map-copy p,
.tp-field-production-main p {
  margin: 5px 0 0;
  color: #748078;
  line-height: 1.45;
  font-size: 12px;
}

.tp-field-detail-map-card {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 18px;
  align-items: center;
  border: 1px solid #e1e8df;
  border-radius: 16px;
  padding: 14px;
  background: #f8faf6;
}

.tp-field-detail-map-shape {
  height: 120px;
  border-radius: 14px;
  background:
    linear-gradient(30deg, transparent 48%, rgba(96, 138, 75, .08) 49%, rgba(96, 138, 75, .08) 51%, transparent 52%),
    #edf4e8;
  display: grid;
  place-items: center;
}

.tp-field-detail-map-shape > div {
  width: 76px;
  height: 88px;
  border: 2px solid #688f67;
  border-radius: 28px 20px 32px 20px;
  background: rgba(134, 177, 116, .28);
  transform: rotate(-6deg);
}

.tp-field-detail-map-copy strong {
  color: #294133;
}

.tp-field-detail-map-card > button,
.tp-field-production-actions button {
  min-height: 42px;
  border-radius: 11px;
  border: 1px solid #cfdccf;
  background: #ffffff;
  color: #2d653b;
  font-weight: 800;
  padding: 0 14px;
}

.tp-field-production-card {
  border: 1px solid #e2e8e1;
  border-radius: 16px;
  padding: 16px;
}

.tp-field-production-main {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
  align-items: center;
}

.tp-field-production-main > div:last-child {
  display: flex;
  flex-direction: column;
}

.tp-field-production-main span {
  color: #7f8b82;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.tp-field-production-main strong {
  color: #22352a;
  font-size: 18px;
  margin-top: 2px;
}

.tp-field-production-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.tp-field-choice-label {
  display: block;
  color: #34443a;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 7px;
}

.tp-cycle-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tp-cycle-choice button {
  min-height: 72px;
  border: 1px solid #d9e1d8;
  border-radius: 13px;
  background: #ffffff;
  color: #34443a;
  text-align: left;
  padding: 12px 14px;
  font-weight: 900;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.tp-cycle-choice button small {
  color: #7c877f;
  font-weight: 500;
  line-height: 1.3;
}

.tp-cycle-choice button.active {
  border-color: #4e925c;
  background: #f2f8f0;
  color: #24643a;
  box-shadow: 0 0 0 2px rgba(78, 146, 92, .08);
}

.tp-field-form select,
.tp-production-profile-form select {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6ddd5;
  border-radius: 11px;
  padding: 0 13px;
  background: #ffffff;
  color: #1d2a22;
  font-size: 14px;
  outline: none;
}

.tp-field-note-soft {
  background: #f6faf4;
  border-color: #dbe7d8;
}

.tp-production-profile-summary {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: stretch;
}

.tp-production-profile-summary > div {
  border: 1px solid #e3e8e2;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fbfcfa;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-production-profile-summary span {
  color: #849087;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-production-profile-summary strong {
  color: #2b3f32;
  font-size: 13px;
}

.tp-production-profile-summary > button {
  border: 1px solid #d2ddd1;
  background: #ffffff;
  color: #306b3e;
  border-radius: 12px;
  padding: 0 12px;
  font-weight: 800;
}

.tp-production-profile-form {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
  display: grid;
  gap: 12px;
}

.tp-production-profile-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  grid-column: 1 / -1;
}

.tp-production-profile-title > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-production-profile-title span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-production-profile-title strong {
  color: #25392d;
}

.tp-production-profile-title > button {
  width: 30px;
  height: 30px;
  border: 1px solid #d9e2d8;
  border-radius: 9px;
  background: #ffffff;
  color: #66736a;
  font-size: 20px;
}

.tp-production-profile-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tp-production-profile-fields label,
.tp-history-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-production-profile-fields input,
.tp-history-form input,
.tp-history-form textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-history-form textarea {
  min-height: 82px;
  padding-top: 10px;
  resize: vertical;
}

.tp-production-profile-save {
  min-height: 44px;
  border: 1px solid #27703c;
  border-radius: 11px;
  background: #27703c;
  color: #ffffff;
  font-weight: 900;
}

.tp-production-history-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e8ece7;
}

.tp-production-history-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;
}

.tp-production-history-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-production-history-head span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-production-history-head strong {
  color: #26382d;
  font-size: 15px;
}

.tp-production-history-head small {
  color: #52725a;
  background: #f0f6ee;
  border-radius: 999px;
  padding: 6px 9px;
  font-weight: 800;
}

.tp-yield-history-list,
.tp-season-history-list {
  display: grid;
  gap: 9px;
}

.tp-yield-history-card,
.tp-season-history-card {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 13px;
  border: 1px solid #e2e8e1;
  border-radius: 13px;
  background: #fbfcfa;
}

.tp-yield-year {
  width: 58px;
  height: 58px;
  border-radius: 13px;
  background: #edf5ea;
  display: grid;
  place-items: center;
  color: #2d733e;
  font-weight: 900;
}

.tp-yield-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tp-yield-main strong {
  color: #25392d;
  font-size: 15px;
}

.tp-yield-main span,
.tp-yield-main small {
  color: #748078;
  font-size: 11px;
}

.tp-yield-main p {
  margin: 3px 0 0;
  color: #637067;
  font-size: 12px;
  line-height: 1.4;
}

.tp-yield-history-card > button,
.tp-season-history-card > button {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 800;
}

.tp-history-form {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
}

.tp-history-form-full {
  grid-column: 1 / -1;
}

.tp-field-sections-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #e8ece7;
}

.tp-field-sections-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-end;
  margin-bottom: 12px;
}

.tp-field-sections-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-sections-head span {
  color: #7a867e;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.tp-field-sections-head strong {
  color: #26382d;
  font-size: 15px;
}

.tp-field-sections-head small {
  color: #4d7258;
  background: #f0f6ee;
  border-radius: 999px;
  padding: 6px 9px;
  font-weight: 800;
  white-space: nowrap;
}

.tp-section-loading {
  padding: 16px;
  border-radius: 12px;
  background: #f8faf7;
  color: #738078;
  font-size: 13px;
}

.tp-field-sections-list {
  display: grid;
  gap: 9px;
}

.tp-field-section-card {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e2e8e1;
  border-radius: 13px;
  background: #fbfcfa;
}

.tp-field-section-number {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #edf5ea;
  color: #2d733e;
  font-weight: 900;
}

.tp-field-section-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-field-section-copy strong {
  color: #26382d;
}

.tp-field-section-copy span {
  color: #748078;
  font-size: 12px;
}

.tp-field-section-area {
  display: flex;
  align-items: center;
  gap: 9px;
}

.tp-field-section-area strong {
  color: #395543;
  font-size: 13px;
  white-space: nowrap;
}

.tp-field-section-area button {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 800;
}

.tp-field-sections-empty {
  padding: 18px;
  border: 1px dashed #ccd9cb;
  border-radius: 14px;
  background: #f9fbf8;
  text-align: center;
}

.tp-field-sections-empty > div {
  font-size: 28px;
  margin-bottom: 6px;
}

.tp-field-sections-empty strong {
  display: block;
  color: #294133;
}

.tp-field-sections-empty p {
  max-width: 520px;
  margin: 6px auto 0;
  color: #77827a;
  line-height: 1.45;
  font-size: 12px;
}

.tp-field-section-form {
  margin-top: 14px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  border: 1px solid #cfddcf;
  border-radius: 15px;
  background: #f7faf6;
}

.tp-field-section-form-title {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.tp-field-section-form-title > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-field-section-form-title span {
  color: #3b7b4a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-field-section-form-title strong {
  color: #25392d;
  font-size: 16px;
}

.tp-field-section-form-title > button {
  width: 30px;
  height: 30px;
  border: 1px solid #d9e2d8;
  border-radius: 9px;
  background: #ffffff;
  color: #66736a;
  font-size: 20px;
}

.tp-field-section-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-field-section-form input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-field-section-form input:focus {
  border-color: #5d9368;
  box-shadow: 0 0 0 3px rgba(77, 139, 92, .09);
}

.tp-field-section-area-note,
.tp-field-section-message {
  grid-column: 1 / -1;
  font-size: 11px;
  line-height: 1.45;
}

.tp-field-section-area-note {
  color: #748078;
}

.tp-field-section-message {
  color: #a7473f;
  background: #fff4f2;
  border: 1px solid #f0d2cd;
  border-radius: 10px;
  padding: 9px 11px;
}

.tp-field-section-save {
  grid-column: 1 / -1;
  min-height: 46px;
  border: 1px solid #27703c;
  border-radius: 11px;
  background: #27703c;
  color: #ffffff;
  font-weight: 900;
}

.tp-field-section-save:disabled {
  opacity: .65;
}

.tp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(21, 34, 25, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: tpModalFade .18s ease-out;
}

.tp-modal-card {
  width: min(100%, 620px);
  max-height: min(88vh, 820px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #ffffff;
  border: 1px solid rgba(225, 232, 224, .95);
  border-radius: 22px;
  box-shadow:
    0 24px 80px rgba(20, 45, 28, .22),
    0 4px 18px rgba(20, 45, 28, .08);
  padding: 20px;
  animation: tpModalRise .22s cubic-bezier(.2,.8,.2,1);
}

.tp-modal-card-medium {
  width: min(100%, 600px);
}

.tp-modal-card-large {
  width: min(100%, 760px);
}

.tp-modal-form {
  margin: 0 !important;
  border: 0 !important;
  background: #ffffff !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.tp-modal-form .tp-production-profile-title,
.tp-modal-form .tp-field-section-form-title {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #ffffff;
  padding-bottom: 12px;
  border-bottom: 1px solid #edf0ec;
  margin-bottom: 4px;
}

.tp-modal-form .tp-production-profile-title > button,
.tp-modal-form .tp-field-section-form-title > button {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  font-size: 21px;
}

.tp-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid #edf0ec;
}

.tp-modal-cancel,
.tp-modal-primary {
  min-height: 44px;
  border-radius: 11px;
  padding: 0 18px;
  font-weight: 900;
}

.tp-modal-cancel {
  border: 1px solid #d7dfd6;
  background: #ffffff;
  color: #56635a;
}

.tp-modal-primary {
  min-width: 128px;
}

@keyframes tpModalFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes tpModalRise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tp-activity-add-top {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #cfdccf;
  border-radius: 10px;
  background: #ffffff;
  color: #2d6b3d;
  font-weight: 900;
}

.tp-activity-list {
  display: grid;
  gap: 9px;
}

.tp-activity-card {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 11px;
  align-items: start;
  border: 1px solid #e2e8e1;
  border-radius: 14px;
  background: #fbfcfa;
  padding: 13px;
}

.tp-activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: #edf5ea;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.tp-activity-copy {
  min-width: 0;
}

.tp-activity-title-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.tp-activity-title-row strong {
  color: #25392d;
}

.tp-activity-title-row span {
  color: #839087;
  font-size: 11px;
  white-space: nowrap;
}

.tp-activity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 5px;
}

.tp-activity-meta span {
  background: #f0f4ee;
  color: #647269;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 700;
}

.tp-activity-copy p {
  margin: 7px 0 0;
  color: #67746b;
  font-size: 12px;
  line-height: 1.45;
}

.tp-activity-delete {
  border: 0;
  background: transparent;
  color: #b44c43;
  font-size: 11px;
  font-weight: 900;
}

.tp-activity-form {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 11px;
  border: 1px solid #cfddcf;
  border-radius: 14px;
  background: #f7faf6;
}

.tp-activity-form label {
  display: grid;
  gap: 6px;
  color: #405046;
  font-size: 12px;
  font-weight: 800;
}

.tp-activity-form input,
.tp-activity-form select,
.tp-activity-form textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd7cc;
  border-radius: 10px;
  background: #ffffff;
  padding: 0 11px;
  color: #213229;
  outline: none;
  font-size: 14px;
}

.tp-activity-form textarea {
  min-height: 86px;
  padding-top: 10px;
  resize: vertical;
}

.tp-activity-full {
  grid-column: 1 / -1;
}

.tp-dose-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.tp-dose-choice button {
  min-height: 64px;
  border: 1px solid #d8e0d7;
  border-radius: 12px;
  background: #ffffff;
  color: #34443a;
  padding: 10px 12px;
  text-align: left;
  font-weight: 900;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.tp-dose-choice button small {
  color: #7b877f;
  font-weight: 500;
}

.tp-dose-choice button.active {
  border-color: #4e925c;
  background: #f1f7ef;
  color: #286b3b;
  box-shadow: 0 0 0 2px rgba(78, 146, 92, .08);
}

.tp-smart-calc {
  border: 1px solid #d8e6d5;
  border-radius: 12px;
  background: #f4f9f2;
  padding: 11px 13px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  align-items: center;
}

.tp-smart-calc span {
  grid-row: 1 / 3;
  color: #3f7a4c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .6px;
  text-transform: uppercase;
}

.tp-smart-calc strong {
  color: #245f35;
  font-size: 14px;
}

.tp-smart-calc small {
  color: #718078;
  font-size: 10px;
}

.tp-activity-photo-field {
  border: 1px solid #dbe4da;
  border-radius: 13px;
  background: #f8faf7;
  padding: 12px;
}

.tp-activity-photo-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.tp-activity-photo-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-activity-photo-head span {
  color: #3f7a4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .7px;
}

.tp-activity-photo-head strong {
  color: #2a3f31;
  font-size: 13px;
}

.tp-activity-photo-head > button {
  border: 0;
  background: transparent;
  color: #af4d45;
  font-size: 11px;
  font-weight: 900;
}

.tp-activity-photo-picker {
  min-height: 112px;
  border: 1.5px dashed #bfcfbd;
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  display: flex !important;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex-direction: column;
  gap: 4px !important;
  padding: 14px;
}

.tp-activity-photo-picker > span {
  font-size: 26px;
}

.tp-activity-photo-picker > strong {
  color: #2f6b3d;
  font-size: 13px;
}

.tp-activity-photo-picker > small {
  color: #7c8880;
  font-weight: 500;
  line-height: 1.35;
}

.tp-activity-photo-picker input,
.tp-activity-photo-preview input {
  display: none;
}

.tp-activity-photo-preview {
  display: grid;
  grid-template-columns: 116px 1fr;
  gap: 12px;
  align-items: center;
}

.tp-activity-photo-preview img {
  width: 116px;
  height: 90px;
  object-fit: cover;
  border-radius: 11px;
  border: 1px solid #dce5db;
  background: #eef3ec;
}

.tp-activity-photo-preview label {
  min-height: 44px;
  border: 1px solid #cfdccf;
  border-radius: 10px;
  background: #ffffff;
  color: #2d6b3d;
  display: grid !important;
  place-items: center;
  cursor: pointer;
  font-weight: 900 !important;
}

.tp-calendar-page{min-height:100vh;background:#f5f7f4;color:#1f2f24;padding-bottom:90px}.tp-calendar-header{min-height:68px;padding:10px 22px;border-bottom:1px solid #e4e9e3;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);display:grid;grid-template-columns:42px 1fr 42px;gap:10px;align-items:center;position:sticky;top:0;z-index:20}.tp-calendar-header>button{width:38px;height:38px;border:1px solid #dce4db;border-radius:11px;background:#fff;color:#33503b;font-size:18px}.tp-calendar-header>div{display:flex;flex-direction:column;gap:2px}.tp-calendar-header span,.tp-calendar-toolbar span,.tp-calendar-group-title span{color:#447d50;font-size:9px;font-weight:900;letter-spacing:.8px}.tp-calendar-header strong{color:#203126;font-size:15px}.tp-calendar-header .tp-calendar-header-add{background:#2d733e;color:#fff;border-color:#2d733e;font-size:22px}.tp-calendar-content{width:min(100%,900px);margin:0 auto;padding:22px}.tp-calendar-hero{border:1px solid #dfe6de;border-radius:20px;background:#fff;padding:22px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;box-shadow:0 8px 26px rgba(33,57,39,.05)}.tp-calendar-hero>div:first-child>span{color:#407b4d;font-size:9px;font-weight:900;letter-spacing:.9px}.tp-calendar-hero h1{margin:5px 0 6px;color:#1f3225;font-size:24px;line-height:1.15}.tp-calendar-hero p{margin:0;max-width:570px;color:#748078;font-size:11px;line-height:1.5}.tp-calendar-summary{display:grid;grid-template-columns:repeat(3,88px);border:1px solid #e3e9e2;border-radius:15px;overflow:hidden;background:#fafcf9}.tp-calendar-summary>div{min-height:76px;padding:10px;border-right:1px solid #e5ebe4;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px}.tp-calendar-summary>div:last-child{border-right:0}.tp-calendar-summary strong{color:#2e713e;font-size:20px}.tp-calendar-summary span{color:#7c887f;font-size:9px;font-weight:800}.tp-calendar-toolbar{margin:18px 0 10px;display:flex;justify-content:space-between;align-items:end;gap:12px}.tp-calendar-toolbar>div{display:flex;flex-direction:column;gap:2px}.tp-calendar-toolbar strong{color:#283b2f;font-size:15px}.tp-calendar-toolbar>button,.tp-calendar-empty button{min-height:40px;padding:0 13px;border:1px solid #cad9c9;border-radius:10px;background:#fff;color:#2d6f3e;font-weight:900}.tp-calendar-groups{display:grid;gap:18px}.tp-calendar-group-title{margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center}.tp-calendar-group-title strong{color:#647269;font-size:10px}.tp-calendar-group-title.overdue span{color:#b9564d}.tp-calendar-group-title.completed span{color:#78847c}.tp-calendar-list{display:grid;gap:9px}.tp-calendar-item{border:1px solid #e0e7df;border-radius:14px;background:#fff;padding:12px;display:grid;grid-template-columns:30px 40px 1fr auto;gap:10px;align-items:start}.tp-calendar-item.completed{opacity:.65}.tp-calendar-check{width:28px;height:28px;border:1px solid #cbd8ca;border-radius:9px;background:#fff;color:#2f743f;font-weight:900}.tp-calendar-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#eef5eb;font-size:19px}.tp-calendar-copy{min-width:0}.tp-calendar-title-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tp-calendar-title-row strong{color:#25382c;font-size:13px}.tp-calendar-title-row span{border-radius:999px;background:#f1f5ef;color:#627168;padding:3px 6px;font-size:9px;font-weight:800}.tp-calendar-copy p{margin:3px 0 0;color:#6e7a72;font-size:11px}.tp-calendar-meta{margin-top:6px;display:flex;flex-wrap:wrap;gap:7px}.tp-calendar-meta span{color:#567260;font-size:10px;font-weight:700}.tp-calendar-copy>small{display:block;margin-top:6px;color:#7a867e;font-size:10px;line-height:1.4}.tp-calendar-delete{border:0;background:transparent;color:#b05049;font-size:10px;font-weight:900}.tp-calendar-empty{border:1px dashed #cbd8c9;border-radius:15px;background:#fafcf9;padding:24px;text-align:center}.tp-calendar-empty>div{font-size:28px}.tp-calendar-empty strong{display:block;margin-top:6px;color:#2d4133}.tp-calendar-empty p{margin:5px 0 12px;color:#7b877f;font-size:11px}.tp-reminder-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.tp-reminder-form label{display:grid;gap:6px;color:#405046;font-size:12px;font-weight:800}.tp-reminder-form input,.tp-reminder-form select,.tp-reminder-form textarea{width:100%;min-height:44px;border:1px solid #ccd7cc;border-radius:10px;background:#fff;padding:0 11px;color:#213229;outline:none;font-size:14px}.tp-reminder-form textarea{min-height:82px;padding-top:10px;resize:vertical}.tp-reminder-full{grid-column:1/-1}
.tp-ai-page {
  min-height: 100vh;
  background: #f4f7f3;
  color: #1f2e24;
  padding-bottom: 92px;
}

.tp-ai-page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  min-height: 68px;
  padding: 10px 22px;
  background: rgba(255, 255, 255, .94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5eae4;
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  gap: 10px;
  align-items: center;
}

.tp-ai-page-header > button {
  width: 38px;
  height: 38px;
  border: 1px solid #dde5dc;
  border-radius: 11px;
  background: #ffffff;
  color: #33483a;
  font-size: 18px;
}

.tp-ai-page-header > div:nth-child(2) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-ai-page-header span {
  color: #3d7d4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
  text-transform: uppercase;
}

.tp-ai-page-header strong {
  color: #203126;
  font-size: 15px;
}

.tp-ai-page-spark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #edf6ea;
  color: #2d773f;
  font-size: 21px;
  font-weight: 900;
}

.tp-ai-page-content {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 15px;
}

.tp-ai-hero,
.tp-ai-access-card,
.tp-ai-workspace {
  border: 1px solid #e0e7df;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 8px 26px rgba(32, 60, 39, .05);
}

.tp-ai-hero {
  padding: 22px;
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 16px;
  align-items: start;
}

.tp-ai-hero-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 17px;
  background: linear-gradient(145deg, #e7f4e2, #f5faF2);
  color: #24723b;
  font-size: 27px;
  font-weight: 900;
  border: 1px solid #d5e6d1;
}

.tp-ai-hero > div:last-child > span,
.tp-ai-workspace-head span,
.tp-ai-access-copy > span {
  color: #3e7e4c;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .9px;
}

.tp-ai-hero h1 {
  margin: 5px 0 6px;
  color: #1d3023;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.12;
}

.tp-ai-hero p {
  margin: 0;
  color: #6e7a72;
  font-size: 12px;
  line-height: 1.55;
}

.tp-ai-access-card {
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.tp-ai-access-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-access-copy strong {
  color: #263c2c;
  font-size: 14px;
}

.tp-ai-access-copy small {
  color: #7a867e;
  font-size: 10px;
  line-height: 1.4;
}

.tp-ai-access-badges {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tp-ai-access-badges span {
  border: 1px solid #d8e5d5;
  background: #f3f8f1;
  color: #397448;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.tp-ai-workspace {
  padding: 20px;
}

.tp-ai-workspace-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.tp-ai-workspace-head > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-workspace-head strong {
  color: #2b3f31;
  font-size: 14px;
}

.tp-ai-step-two {
  margin-top: 18px;
}

.tp-ai-field-select {
  width: 100%;
  min-height: 48px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid #ccd8cb;
  border-radius: 12px;
  background: #ffffff;
  color: #25372c;
  font-size: 13px;
  outline: none;
}

.tp-ai-main-picker {
  margin-top: 10px;
  min-height: 190px;
  border: 1.5px dashed #b8ccb5;
  border-radius: 16px;
  background: #f9fbf8;
  cursor: pointer;
  display: flex !important;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  gap: 6px !important;
  padding: 22px;
}

.tp-ai-main-picker > div {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #edf5ea;
  font-size: 27px;
}

.tp-ai-main-picker strong {
  color: #2c6d3c;
  font-size: 15px;
}

.tp-ai-main-picker span {
  max-width: 440px;
  color: #77837b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
}

.tp-ai-main-picker input,
.tp-ai-main-photo input {
  display: none;
}

.tp-ai-main-photo {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #dce5db;
  border-radius: 15px;
  background: #f8faf7;
  display: grid;
  grid-template-columns: minmax(180px, 300px) 1fr;
  gap: 14px;
  align-items: center;
}

.tp-ai-main-photo img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 12px;
  background: #edf2eb;
}

.tp-ai-main-photo > div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.tp-ai-main-photo strong {
  color: #294033;
}

.tp-ai-main-photo small {
  color: #76827a;
  line-height: 1.4;
}

.tp-ai-main-photo label,
.tp-ai-main-photo button,
.tp-ai-empty-field button {
  min-height: 40px;
  border: 1px solid #cedbcd;
  border-radius: 10px;
  background: #ffffff;
  color: #326f41;
  display: grid !important;
  place-items: center;
  padding: 0 11px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.tp-ai-main-photo button {
  color: #aa4d45;
}

.tp-ai-note-field {
  margin-top: 14px;
  display: grid;
  gap: 6px;
  color: #425148;
  font-size: 11px;
  font-weight: 800;
}

.tp-ai-note-field textarea {
  min-height: 74px;
  border: 1px solid #ccd8cb;
  border-radius: 11px;
  padding: 10px 11px;
  resize: vertical;
  color: #26372d;
  outline: none;
  font-family: inherit;
}

.tp-ai-main-analyze {
  width: 100%;
  min-height: 52px;
  margin-top: 14px;
  border: 1px solid #27733d;
  border-radius: 13px;
  background: #27733d;
  color: #ffffff;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  box-shadow: 0 8px 20px rgba(39, 115, 61, .15);
}

.tp-ai-main-analyze span {
  font-size: 19px;
}

.tp-ai-main-analyze:disabled {
  opacity: .5;
  box-shadow: none;
}

.tp-ai-limit-box {
  margin-top: 14px;
  border: 1px solid #eadfc7;
  border-radius: 14px;
  background: #fffbf3;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.tp-ai-limit-box > div {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}

.tp-ai-limit-box strong {
  color: #5d4a24;
  font-size: 12px;
}

.tp-ai-limit-box p {
  margin: 3px 0 0;
  color: #88795a;
  font-size: 10px;
}

.tp-ai-limit-box > button {
  min-height: 42px;
  border: 1px solid #e2d6ba;
  border-radius: 10px;
  background: #ffffff;
  color: #77613a;
  padding: 6px 11px;
  font-weight: 900;
}

.tp-ai-limit-box button small {
  display: block;
  margin-top: 2px;
  font-size: 8px;
}

.tp-ai-page-result {
  margin-top: 14px;
  padding: 16px;
}

.tp-ai-save-history {
  width: 100%;
  min-height: 45px;
  margin-top: 13px;
  border: 1px solid #cbdaca;
  border-radius: 11px;
  background: #ffffff;
  color: #2e6d3d;
  font-weight: 900;
}

.tp-ai-page-error {
  margin-top: 12px;
}

.tp-ai-empty-field {
  margin-top: 10px;
  border: 1px dashed #cad7c8;
  border-radius: 12px;
  padding: 14px;
  background: #f9fbf8;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.tp-ai-nav-main span {
  font-size: 21px !important;
}

.tp-ai-analyze-area {
  margin-top: 10px;
  display: grid;
  gap: 5px;
}

.tp-ai-analyze-button {
  min-height: 46px;
  border: 1px solid #3f8251;
  border-radius: 11px;
  background: #f2f8f0;
  color: #246438;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tp-ai-analyze-button > span {
  font-size: 18px;
}

.tp-ai-analyze-button:disabled {
  opacity: .68;
}

.tp-ai-analyze-area > small {
  color: #78847c;
  font-size: 10px;
  text-align: center;
}

.tp-ai-error {
  margin-top: 10px;
  border: 1px solid #efcfc9;
  background: #fff5f3;
  color: #a34b43;
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 11px;
}

.tp-ai-result {
  margin-top: 12px;
  border: 1px solid #d8e4d6;
  border-radius: 13px;
  background: #fbfdf9;
  padding: 13px;
}

.tp-ai-result.tp-ai-attention,
.tp-ai-history-card.tp-ai-attention {
  border-color: #ead9a4;
  background: #fffaf0;
}

.tp-ai-result.tp-ai-urgent,
.tp-ai-history-card.tp-ai-urgent {
  border-color: #efc7c0;
  background: #fff5f3;
}

.tp-ai-result.tp-ai-uncertain,
.tp-ai-history-card.tp-ai-uncertain {
  border-color: #d9dee0;
  background: #f7f9fa;
}

.tp-ai-result-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.tp-ai-result-head > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-result-head span,
.tp-ai-possible span,
.tp-ai-list > span,
.tp-ai-history-card span {
  color: #467852;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .7px;
}

.tp-ai-result-head strong {
  color: #24372b;
  font-size: 15px;
}

.tp-ai-confidence {
  min-width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #edf5ea;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #2c6e3d;
  font-weight: 900;
}

.tp-ai-confidence small {
  font-size: 8px;
  color: #6e7b72;
  font-weight: 700;
}

.tp-ai-possible {
  margin-top: 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-ai-possible strong {
  color: #2c3f32;
}

.tp-ai-list {
  margin-top: 11px;
}

.tp-ai-list p {
  margin: 4px 0 0;
  color: #66736a;
  line-height: 1.45;
  font-size: 11px;
}

.tp-ai-disclaimer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e5eae4;
  color: #7c8780;
  font-size: 9px;
  line-height: 1.45;
}

.tp-ai-history-card {
  margin-top: 9px;
  border: 1px solid #d8e4d6;
  background: #f7fbf5;
  border-radius: 10px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tp-ai-history-card > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-ai-history-card strong {
  color: #2b4132;
  font-size: 11px;
}

.tp-ai-history-card small {
  color: #64806b;
  white-space: nowrap;
  font-weight: 800;
}

.tp-activity-photo-thumb {
  margin-top: 9px;
  width: min(230px, 100%);
  border: 1px solid #dce5db;
  border-radius: 11px;
  padding: 5px;
  background: #ffffff;
  text-align: left;
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 8px;
  align-items: center;
}

.tp-activity-photo-thumb img {
  width: 68px;
  height: 54px;
  object-fit: cover;
  border-radius: 8px;
  background: #eef3ec;
}

.tp-activity-photo-thumb span {
  color: #3b7148;
  font-size: 11px;
  font-weight: 800;
}

.tp-activity-photo-note {
  color: #66736a;
  font-size: 11px;
  line-height: 1.45;
  padding: 10px 12px;
  border: 1px dashed #cfd9ce;
  border-radius: 10px;
  background: #fbfcfa;
}

.tp-field-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.tp-field-quick-actions button {
  min-height: 118px;
  border: 1px solid #e3e8e2;
  background: #fbfcfa;
  border-radius: 15px;
  padding: 14px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tp-field-quick-actions button > span {
  font-size: 24px;
}

.tp-field-quick-actions strong {
  color: #26382d;
  margin-top: 3px;
}

.tp-field-quick-actions small {
  color: #7d8881;
  line-height: 1.4;
}

.tp-field-detail-bottom {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(100%, 960px);
  min-height: 72px;
  background: rgba(255, 255, 255, .97);
  border: 1px solid #e3e8e2;
  border-bottom: 0;
  border-radius: 18px 18px 0 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  padding: 7px 10px;
  z-index: 30;
  box-shadow: 0 -8px 30px rgba(34, 60, 41, .06);
}

.tp-field-detail-bottom button {
  min-height: 52px;
  border: 0;
  background: transparent;
  color: #78847c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
}

.tp-field-detail-bottom button > span {
  font-size: 19px;
}

.tp-field-detail-bottom button.active {
  color: #28713c;
}

.tp-field-detail-bottom .tp-field-detail-main-action {
  width: 66px;
  min-height: 66px;
  justify-self: center;
  margin-top: -22px;
  border-radius: 50%;
  background: #28743e;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(40, 116, 62, .22);
}

.tp-field-detail-main-action > span {
  font-size: 26px !important;
}

.tp-real-field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.tp-real-field-grid .analysisItem {
  border: 1px solid #e3e9e2;
  border-radius: 14px;
  padding: 14px;
  background: #fbfcfa;
}

.tp-real-field-note {
  border: 1px solid #dce8dc;
  background: #f6faf5;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.tp-real-field-note strong {
  color: #234f31;
}

.tp-real-field-note p {
  margin: 6px 0 0;
  color: #66736a;
  line-height: 1.5;
  font-size: 13px;
}

.tp-fields-loading {
  padding: 10px 0;
  color: #758078;
  font-size: 12px;
}

@media (max-width: 520px) {
  .tp-onboarding-page {
    padding: 0;
    align-items: stretch;
  }

  .tp-welcome-shell,
  .tp-form-shell,
  .tp-question-shell,
  .tp-ready-shell,
  .tp-field-form-shell {
    width: 100%;
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    padding: 24px;
  }

  .tp-field-form-grid {
    grid-template-columns: 1fr;
  }

  .tp-logo-mark {
    margin-top: 45px;
  }

  .tp-landscape {
    width: calc(100% + 48px);
  }

  .tp-trust-grid {
    margin-top: 28px;
  }

  .tp-field-detail-header {
    padding: 0 14px;
  }

  .tp-field-detail-content {
    width: calc(100% - 20px);
    margin-top: 12px;
  }

  .tp-field-hero-card,
  .tp-field-detail-section {
    border-radius: 16px;
  }

  .tp-field-hero-top {
    grid-template-columns: 50px 1fr;
  }

  .tp-field-hero-top > .statusPill {
    grid-column: 2;
    width: fit-content;
  }

  .tp-field-hero-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .tp-field-hero-stats > div {
    padding: 0 8px;
  }

  .tp-field-detail-status-grid {
    grid-template-columns: 1fr;
  }

  .tp-field-detail-map-card {
    grid-template-columns: 1fr;
  }

  .tp-field-detail-map-shape {
    height: 150px;
  }

  .tp-field-detail-map-card > button {
    width: 100%;
  }

  .tp-cycle-choice {
    grid-template-columns: 1fr;
  }

  .tp-production-profile-summary {
    grid-template-columns: 1fr 1fr;
  }

  .tp-production-profile-summary > button {
    min-height: 42px;
    grid-column: 1 / -1;
  }

  .tp-production-profile-fields,
  .tp-history-form {
    grid-template-columns: 1fr;
  }

  .tp-yield-history-card,
  .tp-season-history-card {
    grid-template-columns: 56px 1fr;
  }

  .tp-yield-history-card > button,
  .tp-season-history-card > button {
    grid-column: 2;
    justify-self: start;
  }

  .tp-production-history-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-field-section-form {
    grid-template-columns: 1fr;
  }

  .tp-field-sections-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-field-section-card {
    grid-template-columns: 34px 1fr;
  }

  .tp-field-section-area {
    grid-column: 2;
    justify-content: space-between;
  }

  .tp-modal-backdrop {
    padding: 0;
    align-items: flex-end;
  }

  .tp-modal-card,
  .tp-modal-card-medium,
  .tp-modal-card-large {
    width: 100%;
    max-height: 92vh;
    border-radius: 22px 22px 0 0;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    box-shadow: 0 -18px 55px rgba(20, 45, 28, .18);
  }

  .tp-modal-actions {
    position: sticky;
    bottom: 0;
    background: #ffffff;
    padding-bottom: 2px;
  }

  .tp-modal-cancel,
  .tp-modal-primary {
    flex: 1;
  }

  .tp-dose-choice {
    grid-template-columns: 1fr 1fr;
  }

  .tp-smart-calc {
    grid-template-columns: 1fr;
  }

  .tp-smart-calc span {
    grid-row: auto;
  }

  .tp-calendar-content { padding: 14px; }
  .tp-calendar-hero { grid-template-columns: 1fr; padding: 16px; }
  .tp-calendar-summary { grid-template-columns: repeat(3, 1fr); }
  .tp-calendar-toolbar { align-items: stretch; flex-direction: column; }
  .tp-calendar-item { grid-template-columns: 30px 38px 1fr; }
  .tp-calendar-delete { grid-column: 3; justify-self: start; }
  .tp-reminder-form { grid-template-columns: 1fr; }

  .tp-ai-page-content {
    padding: 14px;
  }

  .tp-ai-hero {
    grid-template-columns: 46px 1fr;
    padding: 16px;
  }

  .tp-ai-hero-icon {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 22px;
  }

  .tp-ai-access-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .tp-ai-access-badges {
    justify-content: flex-start;
  }

  .tp-ai-workspace {
    padding: 15px;
  }

  .tp-ai-main-photo {
    grid-template-columns: 1fr;
  }

  .tp-ai-main-photo img {
    max-height: 250px;
  }

  .tp-ai-limit-box {
    align-items: stretch;
    flex-direction: column;
  }

  .tp-ai-empty-field {
    align-items: stretch;
    flex-direction: column;
  }

  .tp-activity-photo-preview {
    grid-template-columns: 92px 1fr;
  }

  .tp-activity-photo-preview img {
    width: 92px;
    height: 76px;
  }

  .tp-activity-form {
    grid-template-columns: 1fr;
  }

  .tp-activity-card {
    grid-template-columns: 40px 1fr;
  }

  .tp-activity-delete {
    grid-column: 2;
    justify-self: start;
  }

  .tp-activity-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .tp-field-quick-actions {
    grid-template-columns: 1fr 1fr;
  }

  .tp-real-field-grid {
    grid-template-columns: 1fr;
  }

  .tp-question-shell {
    max-height: none;
  }
}
.tp-push-card{margin-top:14px;border:1px solid #dfe6de;border-radius:17px;background:#fff;padding:15px;display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center}
.tp-push-card.enabled{border-color:#cfe0cd;background:#fbfdf9}
.tp-push-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:#eef5eb;font-size:21px}
.tp-push-copy{min-width:0;display:flex;flex-direction:column;gap:2px}
.tp-push-copy>span{color:#427a4e;font-size:9px;font-weight:900;letter-spacing:.8px}
.tp-push-copy>strong{color:#293c30;font-size:13px}
.tp-push-copy p{margin:2px 0 0;color:#758178;font-size:10px;line-height:1.45}
.tp-push-copy small{margin-top:5px;color:#497455;font-size:10px;line-height:1.4}
.tp-push-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.tp-push-actions button{min-height:38px;border:1px solid #d4ddd3;border-radius:10px;background:#fff;color:#607067;padding:0 11px;font-size:10px;font-weight:900}
.tp-push-actions button.primary{border-color:#2d733e;background:#2d733e;color:#fff}
.tp-push-actions button:disabled{opacity:.55}
@media(max-width:700px){
  .tp-push-card{grid-template-columns:42px 1fr;align-items:start}
  .tp-push-actions{grid-column:1/-1;justify-content:stretch}
  .tp-push-actions button{flex:1}
}


/* ===== ANA SAYFA / ÖRNEK TARLA AÇILIR KART YENİ DÜZEN ===== */
.tp-demo-expanded-card{
  padding-top:12px;
}

.tp-demo-main-grid{
  display:grid;
  grid-template-columns:minmax(0,1.05fr) minmax(250px,.95fr);
  gap:18px;
  align-items:stretch;
}

.tp-demo-map-panel,
.tp-demo-action-panel{
  min-width:0;
}

.tp-demo-map-large{
  height:100%;
  min-height:238px;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

.tp-demo-action-panel{
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:14px;
}

.tp-demo-mini-signals{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
}

.tp-demo-mini-signals span{
  min-height:66px;
  border:1px solid #e2e8df;
  border-radius:16px;
  background:#f7faf6;
  display:grid;
  place-items:center;
  font-size:25px;
  box-shadow:0 6px 18px rgba(45,77,51,.06);
}

.tp-demo-action-stack{
  display:grid;
  gap:10px;
}

.tp-demo-action-stack button{
  min-height:52px;
  width:100%;
  border:1px solid #dfe6dc;
  border-radius:14px;
  background:#fff;
  color:#21492b;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:11px;
  padding:0 16px;
  font-size:14px;
  font-weight:800;
  box-shadow:0 5px 14px rgba(45,77,51,.05);
}

.tp-demo-action-stack button span{
  font-size:20px;
}

.tp-demo-action-stack button:hover{
  background:#f7faf6;
}

.tp-demo-action-stack button.primary{
  background:#26763d;
  color:#fff;
  border-color:#26763d;
  justify-content:center;
}

.tp-demo-recommendation{
  margin-top:16px;
  width:100%;
}

@media (max-width:760px){
  .tp-demo-main-grid{
    grid-template-columns:1fr;
  }

  .tp-demo-map-large{
    min-height:210px;
  }

  .tp-demo-action-panel{
    gap:12px;
  }

  .tp-demo-mini-signals span{
    min-height:58px;
  }
}


/* ===== TARLALARIM / PREMIUM TARLA KARTLARI ===== */
.tp-premium-field-card{
  --tp-accent:#2f7d32;
  --tp-soft:#f3f8f1;
  --tp-border:#d8e7d5;
  overflow:hidden;
  border:1px solid var(--tp-border)!important;
  border-left:5px solid var(--tp-accent)!important;
  border-radius:22px!important;
  background:linear-gradient(135deg,rgba(255,255,255,.97),var(--tp-soft))!important;
  box-shadow:0 12px 34px rgba(29,52,34,.07)!important;
  margin-bottom:16px;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

.tp-field-tone-good{--tp-accent:#2f8b49;--tp-soft:#f1f8ef;--tp-border:#d7e8d3}
.tp-field-tone-check{--tp-accent:#d99200;--tp-soft:#fff8e9;--tp-border:#f0ddb2}
.tp-field-tone-urgent{--tp-accent:#d84a45;--tp-soft:#fff1f0;--tp-border:#efcfcc}

.tp-premium-field-head{
  display:grid;
  grid-template-columns:minmax(260px,1fr) auto auto;
  gap:18px;
  align-items:center;
  padding:18px 20px;
}

.tp-premium-field-identity,.tp-premium-status-button{
  border:0;
  background:transparent;
  padding:0;
  color:inherit;
}

.tp-premium-field-identity{
  min-width:0;
  display:flex;
  align-items:center;
  gap:14px;
  text-align:left;
  cursor:pointer;
}

.tp-premium-crop-icon{
  width:58px;height:58px;flex:0 0 58px;
  display:grid;place-items:center;
  border-radius:17px;
  background:rgba(255,255,255,.74);
  border:1px solid rgba(60,92,61,.09);
  font-size:31px;
}

.tp-premium-field-copy{min-width:0}
.tp-premium-field-copy .fieldTitleRow{
  display:flex;align-items:center;gap:8px;margin-bottom:5px;
}
.tp-premium-field-copy h3{
  margin:0;
  font-size:17px;
  line-height:1.2;
  font-weight:850;
  letter-spacing:-.025em;
  color:#132319;
}
.tp-premium-field-copy p{
  margin:3px 0 0;
  display:flex;align-items:center;flex-wrap:wrap;gap:7px;
  color:#5d685f;
  font-size:13px;
}
.tp-premium-field-copy .tp-premium-parcel{color:#31463a}

.tp-field-shortcuts{display:flex;gap:9px;align-items:center}
.tp-field-shortcuts button{
  width:78px;min-height:72px;padding:8px 6px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:15px;
  background:rgba(255,255,255,.74);
  color:#48554c;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  cursor:pointer;transition:.18s ease;
  box-shadow:0 5px 14px rgba(29,52,34,.035);
}
.tp-field-shortcuts button span{font-size:25px;line-height:1}
.tp-field-shortcuts button small{
  font-size:10px;line-height:1.15;font-weight:750;white-space:nowrap;
}
.tp-field-shortcuts button:hover,.tp-field-shortcuts button.active{
  transform:translateY(-1px);
  border-color:var(--tp-accent);
  color:var(--tp-accent);
  background:rgba(255,255,255,.98);
  box-shadow:0 8px 18px rgba(29,52,34,.06);
}
.tp-field-shortcuts button.active{
  outline:2px solid color-mix(in srgb,var(--tp-accent) 12%,transparent);
}

.tp-premium-status-button{
  min-width:100px;
  display:flex;align-items:center;justify-content:flex-end;gap:12px;
  cursor:pointer;
}
.tp-premium-status{
  display:flex;align-items:center;gap:7px;
  font-size:13px;font-weight:850;white-space:nowrap;
}
.tp-premium-status i{width:9px;height:9px;border-radius:50%}
.tp-premium-status-button .chevron{color:#31443a;font-size:17px}

.tp-premium-field-body{
  display:grid;
  grid-template-columns:minmax(300px,.92fr) minmax(340px,1.08fr);
  gap:0;
  margin:0 12px 12px;
  border:1px solid rgba(46,79,51,.10);
  border-radius:18px;
  overflow:hidden;
  background:rgba(255,255,255,.78);
  box-shadow:0 8px 24px rgba(29,52,34,.04);
}

.tp-premium-visual{
  min-height:270px;
  border-right:1px solid rgba(46,79,51,.09);
  padding:12px;
}

.tp-premium-satellite-map{
  position:relative;
  min-height:246px;height:100%;
  overflow:hidden;border-radius:14px;
  background:
    linear-gradient(18deg,rgba(255,255,255,.12) 0 8%,transparent 8% 15%,rgba(255,255,255,.10) 15% 18%,transparent 18% 100%),
    repeating-linear-gradient(7deg,#70874e 0 18px,#607a43 18px 36px,#789151 36px 54px,#526d3d 54px 72px);
}
.tp-premium-map-grid{
  position:absolute;inset:0;opacity:.25;
  background:
    linear-gradient(90deg,transparent 48%,rgba(255,255,255,.55) 49% 51%,transparent 52%),
    linear-gradient(0deg,transparent 48%,rgba(255,255,255,.35) 49% 51%,transparent 52%);
  background-size:84px 84px;
}
.tp-premium-parcel-shape{
  position:absolute;left:19%;top:18%;width:62%;height:64%;
  border:3px solid rgba(255,255,255,.94);
  clip-path:polygon(12% 7%,86% 0,100% 36%,87% 88%,32% 100%,0 66%);
  display:grid;place-items:center;
  box-shadow:0 0 0 999px rgba(19,43,21,.05);
}
.tp-premium-parcel-shape.good{background:rgba(47,139,73,.42)}
.tp-premium-parcel-shape.check{background:rgba(217,146,0,.45)}
.tp-premium-parcel-shape.urgent{background:rgba(216,74,69,.45)}
.tp-premium-parcel-shape span{
  color:#fff;font-size:17px;font-weight:850;text-shadow:0 2px 8px rgba(0,0,0,.25);
}
.tp-premium-map-zoom{
  position:absolute;right:12px;bottom:12px;
  display:grid;border-radius:9px;overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.13);
}
.tp-premium-map-zoom button{
  width:34px;height:34px;border:0;border-bottom:1px solid #d8ded7;
  background:#fff;color:#1d2d22;font-size:20px;cursor:pointer;
}
.tp-premium-map-zoom button:last-child{border-bottom:0}
.tp-premium-map-update{
  position:absolute;left:12px;bottom:12px;padding:8px 10px;
  border-radius:9px;background:rgba(255,255,255,.92);
  display:flex;flex-direction:column;gap:2px;
  box-shadow:0 4px 12px rgba(0,0,0,.09);
}
.tp-premium-map-update strong{font-size:10px}
.tp-premium-map-update span{color:var(--tp-accent);font-size:10px}

.tp-premium-insight{
  min-width:0;padding:17px;
  display:flex;flex-direction:column;gap:13px;
}
.tp-premium-insight-title{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
}
.tp-panel-eyebrow{
  display:block;margin-bottom:3px;
  color:var(--tp-accent);
  font-size:9px;font-weight:900;letter-spacing:.09em;
}
.tp-premium-insight-title h4,.tp-premium-check-panel h4{
  margin:0;color:#1a281f;font-size:15px;line-height:1.2;font-weight:850;letter-spacing:-.015em;
}
.tp-premium-insight-title small{
  display:block;margin-top:4px;color:#758079;font-size:10px;
}
.tp-health-dot{width:9px;height:9px;border-radius:50%;margin-top:7px}
.tp-health-dot.good{background:#2f8b49}
.tp-health-dot.check{background:#d99200}
.tp-health-dot.urgent{background:#d84a45}

.tp-premium-metrics{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
}
.tp-premium-metrics>div{
  min-width:0;padding:10px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:12px;background:rgba(255,255,255,.80);
  display:flex;align-items:center;gap:8px;
}
.tp-premium-metrics>div>span{font-size:20px}
.tp-premium-metrics p{min-width:0;margin:0;color:#758079;font-size:9px}
.tp-premium-metrics strong{
  display:block;margin-top:2px;color:#1c2c21;font-size:11px;
}

.tp-premium-detail-button{
  margin-left:auto;min-width:220px;min-height:45px;padding:0 15px;
  border:0;border-radius:10px;color:#fff;
  display:flex;align-items:center;justify-content:center;gap:9px;
  font-size:12px;font-weight:850;cursor:pointer;
  box-shadow:0 7px 18px rgba(29,52,34,.10);
}
.tp-premium-detail-button.good{background:#268142}
.tp-premium-detail-button.check{background:#dd9200}
.tp-premium-detail-button.urgent{background:#d92d29}
.tp-premium-detail-button b{margin-left:auto;font-size:18px;font-weight:500}

.tp-premium-recommendation{
  margin-top:auto;padding:12px 14px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:12px;
  display:flex;align-items:flex-start;gap:10px;
  background:rgba(255,255,255,.60);
}
.tp-premium-recommendation.good{background:#f2f8f0}
.tp-premium-recommendation.check{background:#fff7e3}
.tp-premium-recommendation.urgent{background:#fff0ef}
.tp-premium-recommendation>span{font-size:19px}
.tp-premium-recommendation strong{
  display:block;margin-bottom:2px;color:#29372e;font-size:11px;
}
.tp-premium-recommendation p{
  margin:0;color:#566159;font-size:10px;line-height:1.45;
}
.tp-premium-remove-demo{align-self:flex-start;margin:0;font-size:9px;opacity:.72}

.tp-premium-weather{
  height:100%;min-height:246px;padding:14px;border-radius:14px;
  background:linear-gradient(145deg,#fbfdff,#f2f7f8);
  display:flex;flex-direction:column;gap:14px;
}
.tp-weather-current{display:flex;align-items:center;gap:14px}
.tp-weather-big-icon{font-size:48px}
.tp-weather-current strong{
  display:block;color:#16241b;font-size:32px;letter-spacing:-.04em;
}
.tp-weather-current span:not(.tp-weather-big-icon){color:#66736a;font-size:12px}
.tp-weather-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tp-weather-metrics div,.tp-weather-days div{
  text-align:center;border:1px solid #e7ece8;border-radius:10px;background:#fff;
}
.tp-weather-metrics div{padding:9px 6px}
.tp-weather-metrics small,.tp-weather-days small{
  display:block;color:#7b867f;font-size:9px;
}
.tp-weather-metrics strong,.tp-weather-days strong{
  display:block;margin-top:2px;color:#243229;font-size:11px;
}
.tp-weather-days{
  display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:auto;
}
.tp-weather-days div{padding:8px 3px}
.tp-weather-days span{display:block;margin:5px 0;font-size:20px}

.tp-premium-weather-note{
  padding:13px;border:1px solid rgba(45,72,49,.10);
  border-radius:12px;background:#f8fbf7;
  display:flex;gap:10px;align-items:flex-start;
}
.tp-premium-weather-note span{font-size:20px}
.tp-premium-weather-note p{
  margin:0;color:#536057;font-size:11px;line-height:1.5;
}

.tp-premium-check-panel{
  min-height:246px;padding:20px;border-radius:14px;
  background:linear-gradient(145deg,#f8fbf7,#eef5ed);
  display:flex;align-items:center;gap:18px;
}
.tp-check-hero{
  width:84px;height:84px;flex:0 0 84px;
  display:grid;place-items:center;border-radius:24px;
  background:#fff;font-size:38px;
  box-shadow:0 8px 24px rgba(29,52,34,.07);
}
.tp-premium-check-panel p{
  max-width:340px;margin:8px 0 14px;
  color:#647067;font-size:11px;line-height:1.5;
}
.tp-premium-check-panel button{
  min-height:38px;padding:0 14px;border:0;border-radius:9px;
  background:#278044;color:#fff;font-size:11px;font-weight:800;cursor:pointer;
}

@media(max-width:900px){
  .tp-premium-field-head{grid-template-columns:1fr auto}
  .tp-field-shortcuts{
    grid-column:1/-1;justify-content:flex-start;order:3;
  }
  .tp-premium-field-body{grid-template-columns:1fr}
  .tp-premium-visual{
    border-right:0;border-bottom:1px solid rgba(46,79,51,.09);
  }
}

@media(max-width:600px){
  .tp-premium-field-head{padding:14px;gap:12px}
  .tp-premium-crop-icon{
    width:48px;height:48px;flex-basis:48px;font-size:26px;
  }
  .tp-premium-field-copy h3{font-size:14px}
  .tp-premium-status-button{min-width:auto}
  .tp-premium-status{font-size:11px}
  .tp-field-shortcuts{
    display:grid;grid-template-columns:repeat(3,1fr);width:100%;
  }
  .tp-field-shortcuts button{width:100%;min-height:64px}
  .tp-premium-field-body{margin:0 8px 8px}
  .tp-premium-visual{min-height:220px;padding:8px}
  .tp-premium-satellite-map,.tp-premium-weather,.tp-premium-check-panel{
    min-height:210px;
  }
  .tp-premium-insight{padding:13px}
  .tp-premium-metrics{grid-template-columns:1fr}
  .tp-premium-detail-button{width:100%;min-width:0}
  .tp-weather-days{
    grid-template-columns:repeat(5,minmax(48px,1fr));overflow-x:auto;
  }
  .tp-premium-check-panel{
    flex-direction:column;align-items:flex-start;
  }
}


/* ===== A STİLİ / RENKLİ PREMIUM INLINE SVG İKONLAR ===== */
.tp-shortcut-svg{
  width:28px;
  height:28px;
  flex:0 0 28px;
  display:block;
  color:#34433a;
  transition:transform .18s ease,color .18s ease;
}

.tp-satellite-svg{color:#166534}
.tp-weather-svg{color:#475569}
.tp-camera-svg{color:#26342b}

.tp-field-shortcuts button.active .tp-shortcut-svg{
  transform:translateY(-1px);
}

.tp-field-shortcuts button.active{
  position:relative;
  background:#eaf6ee;
  border-color:#2f8b49;
  box-shadow:0 8px 20px rgba(22,101,52,.08);
}

.tp-field-shortcuts button.active::after{
  content:'';
  position:absolute;
  left:50%;
  bottom:-1px;
  width:24px;
  height:3px;
  border-radius:999px 999px 0 0;
  background:#2f8b49;
  transform:translateX(-50%);
}

.tp-field-tone-check .tp-field-shortcuts button.active{
  background:#fff7e6;
  border-color:#d99200;
}

.tp-field-tone-check .tp-field-shortcuts button.active::after{
  background:#d99200;
}

.tp-field-tone-urgent .tp-field-shortcuts button.active{
  background:#fff0ef;
  border-color:#d84a45;
}

.tp-field-tone-urgent .tp-field-shortcuts button.active::after{
  background:#d84a45;
}

.tp-detail-svg{
  width:18px;
  height:18px;
  flex:0 0 18px;
  display:block;

/* ===== GERÇEK HAVA DURUMU / 3 KAYNAK KARŞILAŞTIRMA ===== */
.tp-live-weather{
  position:relative;
}

.tp-weather-location{
  display:flex;
  align-items:center;
  gap:6px;
  color:#607067;
}

.tp-weather-location span{
  font-size:13px;
}

.tp-weather-location small{
  font-size:9px;
  font-weight:800;
}

.tp-weather-current>div small{
  display:block;
  margin-top:3px;
  color:#879188;
  font-size:9px;
}

.tp-weather-days em{
  display:block;
  margin-top:1px;
  color:#8b948d;
  font-size:9px;
  font-style:normal;
}

.tp-weather-state-card{
  min-height:210px;
  padding:22px;
  border:1px dashed #d5ded5;
  border-radius:14px;
  background:rgba(255,255,255,.72);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
}

.tp-weather-state-card>span{
  font-size:38px;
}

.tp-weather-state-card strong{
  margin-top:8px;
  color:#23342a;
  font-size:13px;
}

.tp-weather-state-card small{
  max-width:280px;
  margin-top:5px;
  color:#748078;
  font-size:10px;
  line-height:1.5;
}

.tp-weather-state-card button{
  margin-top:12px;
  min-height:34px;
  padding:0 12px;
  border:1px solid #bfd2c0;
  border-radius:9px;
  background:#fff;
  color:#2c7040;
  font-size:10px;
  font-weight:850;
  cursor:pointer;
}

.tp-weather-detail-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
}

.tp-weather-detail-grid>div{
  padding:10px;
  border:1px solid rgba(45,72,49,.10);
  border-radius:11px;
  background:rgba(255,255,255,.72);
}

.tp-weather-detail-grid small{
  display:block;
  color:#7b877f;
  font-size:9px;
}

.tp-weather-detail-grid strong{
  display:block;
  margin-top:3px;
  color:#26372c;
  font-size:11px;
}

.tp-parcel-lookup-panel{
  grid-column:1 / -1;
  margin-top:2px;
}

.tp-parcel-lookup-actions{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,.78fr);
  gap:10px;
}

.tp-parcel-lookup-actions button{
  min-height:46px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border-radius:11px;
  padding:0 14px;
  font-family:inherit;
  font-size:11px;
  font-weight:850;
  letter-spacing:.01em;
  cursor:pointer;
  transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;
}

.tp-parcel-lookup-actions button:hover:not(:disabled){
  transform:translateY(-1px);
}

.tp-parcel-lookup-actions button svg{
  width:17px;
  height:17px;
  flex:0 0 17px;
}

.tp-parcel-search-button{
  border:1px solid #286b3c;
  background:linear-gradient(180deg,#347d49 0%,#286a3c 100%);
  color:#fff;
  box-shadow:0 7px 16px rgba(39,105,59,.15);
}

.tp-parcel-search-button:hover:not(:disabled){
  box-shadow:0 10px 22px rgba(39,105,59,.20);
}

.tp-parcel-search-button:disabled{
  opacity:.7;
  cursor:wait;
}

.tp-parcel-tkgm-button{
  border:1px solid rgba(42,103,59,.30);
  background:#fff;
  color:#2c6940;
}

.tp-parcel-tkgm-button:hover{
  border-color:#2c6940;
  box-shadow:0 7px 16px rgba(34,80,45,.07);
}

.tp-parcel-spinner{
  width:16px;
  height:16px;
  display:block;
  border:2px solid rgba(255,255,255,.32);
  border-top-color:#fff;
  border-radius:50%;
  animation:tpParcelSpin .8s linear infinite;
}

@keyframes tpParcelSpin{
  to{transform:rotate(360deg)}
}

.tp-parcel-result-divider{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:16px 0 11px;
  color:#7b877f;
  font-size:8.5px;
  font-weight:900;
  letter-spacing:.13em;
}

.tp-parcel-result-divider::before,
.tp-parcel-result-divider::after{
  content:'';
  height:1px;
  flex:1;
  background:#e6ebe6;
}

.tp-parcel-result-divider span{
  padding:0 10px;
}

.tp-parcel-result-card{
  display:grid;
  grid-template-columns:minmax(0,1.4fr) minmax(90px,.7fr) minmax(145px,.85fr);
  gap:0;
  align-items:center;
  overflow:hidden;
  border:1px solid rgba(45,112,65,.11);
  border-radius:13px;
  background:linear-gradient(90deg,#f0f8ef 0%,#f8fbf7 100%);
}

.tp-parcel-result-card.error{
  display:block;
  border-color:rgba(176,71,58,.14);
  background:#fff6f4;
}

.tp-parcel-result-status{
  min-width:0;
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 13px;
}

.tp-parcel-result-icon{
  width:27px;
  height:27px;
  flex:0 0 27px;
  display:grid;
  place-items:center;
  border:1.5px solid #3c9a55;
  border-radius:50%;
  color:#2e8546;
  font-size:13px;
  font-weight:900;
}

.tp-parcel-result-card.error .tp-parcel-result-icon{
  border-color:#c56557;
  color:#b54e42;
}

.tp-parcel-result-status div{
  min-width:0;
}

.tp-parcel-result-status strong{
  display:block;
  color:#245c36;
  font-size:11px;
  font-weight:900;
}

.tp-parcel-result-card.error .tp-parcel-result-status strong{
  color:#94483e;
}

.tp-parcel-result-status small{
  display:block;
  margin-top:2px;
  overflow:hidden;
  color:#7a877e;
  font-size:8.5px;
  line-height:1.35;
  text-overflow:ellipsis;
}

.tp-parcel-result-metric{
  min-height:48px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:8px 12px;
  border-left:1px solid rgba(45,112,65,.10);
}

.tp-parcel-result-metric small{
  color:#7e8981;
  font-size:8px;
  font-weight:700;
}

.tp-parcel-result-metric strong{
  display:block;
  margin-top:2px;
  color:#24372a;
  font-size:10.5px;
  font-weight:900;
  font-variant-numeric:tabular-nums;
}

.tp-parcel-result-metric span{
  margin-top:1px;
  color:#56655b;
  font-size:9px;
  font-weight:750;
  font-variant-numeric:tabular-nums;
}

.tp-parcel-map-info{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:9px;
  padding:9px 11px;
  border:1px solid #dce8f2;
  border-radius:9px;
  background:#f1f6fb;
  color:#48677e;
  font-size:9px;
  font-weight:650;
  line-height:1.4;
}

.tp-parcel-map-info svg{
  width:15px;
  height:15px;
  flex:0 0 15px;
  color:#3975aa;
}

.tp-parcel-fieldmap-preview{
  margin-top:12px;
}

.tp-parcel-map-note{
  display:flex;
  gap:8px;
  align-items:flex-start;
  margin-top:8px;
  padding:10px 12px;
  border:1px solid rgba(39,80,55,.10);
  border-radius:12px;
  background:#f8fbf7;
  color:#68746b;
  font-size:10px;
  line-height:1.45;
}

.tp-parcel-map-note p{
  margin:0;
}

.tp-inline-satellite-link{
  margin-top:6px;
  border:0;
  background:transparent;
  padding:0;
  color:#3c7049;
  font-size:11px;
  font-weight:800;
  cursor:pointer;
}

@media(max-width:600px){
  .tp-parcel-lookup-actions{
    grid-template-columns:1fr;
  }

  .tp-parcel-result-card{
    grid-template-columns:1fr;
  }

  .tp-parcel-result-metric{
    min-height:auto;
    border-top:1px solid rgba(45,112,65,.10);
    border-left:0;
  }
}

@media(max-width:600px){
  .tp-weather-detail-grid{
    grid-template-columns:1fr;
  }

}



/* ===== TARLALARIM / GERÇEK FIELDMAP UYDU GÖRÜNÜMÜ ===== */
.tp-premium-fieldmap-shell{
  position:relative;
  width:100%;
  min-height:300px;
  overflow:hidden;
  border-radius:18px;
  background:#e9efe7;
}

.tp-premium-fieldmap-shell > *:first-child{
  width:100%;
}

.tp-premium-fieldmap-badge{
  position:absolute;
  left:12px;
  bottom:12px;
  z-index:5;
  display:flex;
  align-items:center;
  gap:7px;
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.7);
  border-radius:12px;
  background:rgba(20,43,28,.78);
  color:#fff;
  box-shadow:0 8px 22px rgba(18,43,26,.16);
  backdrop-filter:blur(8px);
  font-size:10px;
  font-weight:800;
}


.tp-crop-cycle-status{
  grid-column:1 / -1;
  display:flex;
  align-items:center;
  gap:9px;
  margin-top:-2px;
  padding:9px 11px;
  border:1px solid #e1e8df;
  border-radius:11px;
  background:#f8faf7;
}

.tp-crop-cycle-status > span{
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  flex:0 0 28px;
  border-radius:9px;
  background:#edf5ea;
  font-size:14px;
}

.tp-crop-cycle-status strong{
  display:block;
  color:#2d4535;
  font-size:10px;
  font-weight:850;
}

.tp-crop-cycle-status small{
  display:block;
  margin-top:1px;
  color:#7d887f;
  font-size:8.5px;
  line-height:1.35;
}

.tp-crop-cycle-status.perennial{
  border-color:#d7e7d4;
  background:#f3f8f1;
}

.tp-premium-fieldmap-badge-icon{
  width:16px;
  height:16px;
  flex:0 0 16px;
}

/* ===== 2026 DESKTOP AGRI DASHBOARD / LEFT MENU ===== */
.tp-desktop-shell{
  min-height:100vh;
  background:#f7f9f7;
  color:#17251c;
}

.tp-placeholder-page{
  min-height:100vh;
}

.tp-side-backdrop{
  position:fixed;
  inset:0;
  z-index:9997;
  border:0;
  background:rgba(7,31,20,.38);
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
  cursor:pointer;
}

.tp-desktop-sidebar{
  position:fixed;
  top:0;
  left:0;
  z-index:9998;
  width:272px;
  height:100vh;
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  padding:18px 14px 16px;
  background:
    radial-gradient(circle at 18% 0%,rgba(51,154,91,.16),transparent 28%),
    linear-gradient(180deg,#073f2b 0%,#064832 46%,#043a28 100%);
  color:#fff;
  box-shadow:16px 0 40px rgba(1,28,18,.22);
  transform:translateX(-106%);
  transition:transform .22s ease;
  overflow:hidden;
}

.tp-desktop-sidebar.open{
  transform:translateX(0);
}

.tp-side-brand{
  display:grid;
  grid-template-columns:44px minmax(0,1fr) 30px;
  align-items:center;
  gap:10px;
  padding:2px 4px 16px;
  border-bottom:1px solid rgba(255,255,255,.12);
}

.tp-side-logo-mark{
  width:44px;
  height:44px;
  display:grid;
  place-items:center;
  border-radius:14px;
  background:linear-gradient(145deg,#0d7046,#0a5b3a);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);
  font-size:22px;
}

.tp-side-logo-copy{
  min-width:0;
}

.tp-side-logo-copy strong{
  display:block;
  overflow:hidden;
  color:#fff;
  font-size:19px;
  font-weight:900;
  letter-spacing:-.45px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.tp-side-logo-copy small{
  display:block;
  margin-top:2px;
  color:rgba(255,255,255,.62);
  font-size:9px;
  font-weight:600;
}

.tp-side-close{
  width:30px;
  height:30px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.12);
  border-radius:9px;
  background:rgba(255,255,255,.06);
  color:#fff;
  font-size:20px;
  line-height:1;
  cursor:pointer;
}

.tp-side-close:hover{
  background:rgba(255,255,255,.12);
}

.tp-side-nav{
  display:flex;
  flex:1;
  flex-direction:column;
  gap:3px;
  overflow:auto;
  padding:14px 0 12px;
  scrollbar-width:none;
}

.tp-side-nav::-webkit-scrollbar{
  display:none;
}

.tp-side-nav button{
  width:100%;
  min-height:40px;
  display:grid;
  grid-template-columns:28px minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
  border:0;
  border-radius:10px;
  padding:7px 10px;
  background:transparent;
  color:rgba(255,255,255,.88);
  text-align:left;
  font:inherit;
  font-size:11.5px;
  font-weight:720;
  cursor:pointer;
  transition:background .15s ease,color .15s ease,transform .15s ease;
}

.tp-side-nav button:hover{
  background:rgba(255,255,255,.075);
  color:#fff;
  transform:translateX(1px);
}

.tp-side-nav button.active{
  background:linear-gradient(90deg,rgba(37,142,77,.95),rgba(30,127,70,.95));
  color:#fff;
  box-shadow:0 8px 20px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.05);
}

.tp-side-icon{
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  color:rgba(255,255,255,.92);
  font-size:15px;
  line-height:1;
}

.tp-side-nav b{
  border-radius:999px;
  background:#78db69;
  color:#073d27;
  padding:3px 7px;
  font-size:8px;
  font-weight:900;
  letter-spacing:.2px;
}

.tp-side-profile{
  display:grid;
  grid-template-columns:40px 1fr auto;
  align-items:center;
  gap:9px;
  margin-top:6px;
  padding:10px 8px;
  border-top:1px solid rgba(255,255,255,.10);
}

.tp-side-avatar{
  width:40px;
  height:40px;
  display:grid;
  place-items:center;
  border:2px solid rgba(255,255,255,.14);
  border-radius:50%;
  background:#fff;
  color:#17653c;
  font-weight:900;
}

.tp-side-profile strong{
  display:block;
  color:#fff;
  font-size:11px;
}

.tp-side-profile small{
  display:block;
  margin-top:2px;
  color:rgba(255,255,255,.60);
  font-size:9px;
}

.tp-side-plan-card{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:8px;
  padding:12px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:14px;
  background:rgba(255,255,255,.055);
}

.tp-side-plan-card>span{
  color:rgba(255,255,255,.72);
  font-size:9px;
}

.tp-side-plan-card>strong{
  color:#7ae37f;
  font-size:20px;
  line-height:1;
}

.tp-side-plan-card>small{
  color:rgba(255,255,255,.58);
  font-size:8.5px;
}

.tp-side-plan-progress{
  height:7px;
  overflow:hidden;
  border-radius:999px;
  background:rgba(255,255,255,.12);
}

.tp-side-plan-progress i{
  display:block;
  width:66%;
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg,#70df72,#55c663);
}

.tp-side-plan-card button{
  min-height:38px;
  margin-top:4px;
  border:1px solid rgba(255,255,255,.68);
  border-radius:9px;
  background:transparent;
  color:#fff;
  font:inherit;
  font-size:10px;
  font-weight:850;
  cursor:pointer;
}

.tp-side-plan-card button:hover{
  background:rgba(255,255,255,.08);
}

.tp-home-with-sidebar{
  padding-left:0!important;
  box-sizing:border-box;
  background:#f7f9f7;
}

.tp-home-with-sidebar .topbar{
  left:0!important;
  width:100%!important;
}

.tp-home-with-sidebar .content{
  max-width:1180px;
  margin:0 auto;
}

.tp-menu-trigger{
  cursor:pointer;
}

.tp-placeholder-top{
  height:72px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 28px;
  border-bottom:1px solid #e4e9e4;
  background:rgba(255,255,255,.96);
}

.tp-placeholder-top-left{
  display:flex;
  align-items:center;
  gap:8px;
}

.tp-placeholder-top>div:last-child{
  display:flex;
  gap:10px;
  align-items:center;
  border:1px solid #dfe6df;
  border-radius:12px;
  padding:8px 14px;
  background:#fff;
}

.tp-placeholder-top button{
  border:0;
  background:transparent;
  color:#176a37;
  font-weight:800;
  font-size:14px;
  cursor:pointer;
}

.tp-placeholder-top .tp-menu-trigger{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border:1px solid #e0e7e0;
  border-radius:10px;
  background:#fff;
  color:#174f31;
  font-size:18px;
}

.tp-placeholder-top div span{
  font-size:10px;
  color:#879087;
  text-transform:uppercase;
}

.tp-placeholder-top div strong{
  font-size:12px;
}

.tp-placeholder-main{
  max-width:1220px;
  margin:0 auto;
  padding:34px;
}

.tp-placeholder-heading{
  display:flex;
  align-items:center;
  gap:18px;
  margin-bottom:28px;
}

.tp-placeholder-icon{
  width:58px;
  height:58px;
  display:grid;
  place-items:center;
  border:1px solid #dce8dc;
  border-radius:18px;
  background:#eef7ed;
  font-size:28px;
}

.tp-placeholder-heading h1{
  margin:0;
  font-size:30px;
  letter-spacing:-.8px;
}

.tp-placeholder-heading p{
  margin:5px 0 0;
  color:#738078;
  font-size:14px;
}

.tp-coming-badge{
  margin-left:auto;
  border:1px solid #cfe4d0;
  background:#edf8ed;
  color:#18743a;
  border-radius:999px;
  padding:7px 11px;
  font-size:10px;
  font-weight:900;
  letter-spacing:.5px;
}

.tp-placeholder-cards{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:16px;
}

.tp-placeholder-cards article{
  min-height:190px;
  border:1px solid #e0e6e0;
  border-radius:18px;
  background:#fff;
  padding:20px;
  box-shadow:0 8px 26px rgba(24,55,35,.04);
}

.tp-placeholder-cards article>span{
  display:inline-grid;
  place-items:center;
  width:34px;
  height:34px;
  border-radius:10px;
  background:#edf6ed;
  color:#18723b;
  font-size:11px;
  font-weight:900;
}

.tp-placeholder-cards h3{
  margin:24px 0 8px;
  font-size:17px;
}

.tp-placeholder-cards p{
  min-height:42px;
  color:#7a857d;
  font-size:12px;
  line-height:1.55;
}

.tp-placeholder-cards button{
  border:0;
  background:transparent;
  color:#147038;
  font-weight:800;
  padding:0;
  cursor:default;
}

.tp-placeholder-preview{
  margin-top:18px;
  min-height:230px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:30px;
  padding:32px;
  border:1px solid #dfe8df;
  border-radius:20px;
  background:linear-gradient(120deg,#f1f8ef,#fff);
}

.tp-placeholder-preview small{
  color:#218143;
  font-weight:900;
  letter-spacing:1.2px;
}

.tp-placeholder-preview h2{
  font-size:25px;
  margin:9px 0;
}

.tp-placeholder-preview p{
  max-width:650px;
  color:#6f7d73;
  line-height:1.6;
}

.tp-placeholder-visual{
  width:170px;
  height:150px;
  display:grid;
  place-items:center;
  border-radius:28px;
  background:#e9f5e8;
  font-size:70px;
}

@media(max-width:899px){.tp-placeholder-cards{grid-template-columns:1fr}.tp-placeholder-main{padding:20px 15px}.tp-placeholder-heading{align-items:flex-start}.tp-coming-badge{display:none}.tp-placeholder-preview{padding:22px}.tp-placeholder-visual{display:none}.tp-placeholder-top{padding:0 14px}.tp-desktop-sidebar{width:min(86vw,285px)}}


/* ===== HAVA DURUMU / FOTOĞRAFLI HERO ===== */
.tp-weather-hero{
  min-height:190px;
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:18px;
  margin-bottom:14px;
  padding:24px 26px;
  border-radius:17px;
  background-position:center;
  background-size:cover;
  overflow:hidden;
  box-shadow:0 14px 34px rgba(25,58,73,.14);
}

.tp-weather-hero-copy{
  max-width:590px;
  color:#fff;
}

.tp-weather-hero-kicker{
  display:inline-flex;
  margin-bottom:8px;
  padding:5px 8px;
  border:1px solid rgba(255,255,255,.22);
  border-radius:999px;
  background:rgba(255,255,255,.11);
  font-size:7px;
  font-weight:950;
  letter-spacing:.09em;
  backdrop-filter:blur(5px);
}

.tp-weather-hero h1{
  margin:0;
  color:#fff !important;
  font-size:26px !important;
  line-height:1.04;
  letter-spacing:-.025em;
}

.tp-weather-hero p{
  max-width:560px;
  margin:8px 0 12px;
  color:rgba(255,255,255,.84) !important;
  font-size:9px !important;
  line-height:1.55;
}

.tp-weather-hero-pills{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}

.tp-weather-hero-pills span{
  padding:5px 8px;
  border-radius:8px;
  background:rgba(255,255,255,.13);
  color:#fff;
  font-size:7.5px;
  font-weight:820;
  backdrop-filter:blur(6px);
}

.tp-weather-location-card-hero{
  min-width:180px;
  align-self:flex-start;
  border:1px solid rgba(255,255,255,.24) !important;
  background:rgba(255,255,255,.91) !important;
  box-shadow:0 8px 24px rgba(10,33,43,.14);
  backdrop-filter:blur(8px);
}

@media(max-width:760px){
  .tp-weather-hero{
    min-height:180px;
    align-items:flex-start;
    flex-direction:column;
    padding:20px;
  }

  .tp-weather-hero h1{
    font-size:22px !important;
  }

  .tp-weather-location-card-hero{
    width:100%;
    min-width:0;
    box-sizing:border-box;
  }
}



/* Tarla detayı: küçük ekranda tek sütunlu, kaydırılabilir işlem menüsü. */
.tp-field-detail-page .tp-field-fab-backdrop {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  z-index: 1000 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: rgba(2, 10, 5, .74) !important;
  backdrop-filter: blur(3px);
  cursor: default;
}

.tp-field-detail-page .tp-field-fab-wrap {
  position: fixed !important;
  left: max(14px, calc((100vw - 760px) / 2 + 14px)) !important;
  bottom: calc(82px + env(safe-area-inset-bottom)) !important;
  z-index: 1001 !important;
  display: flex !important;
  flex-direction: column-reverse !important;
  align-items: flex-start !important;
  gap: 10px !important;
  width: min(320px, calc(100vw - 28px)) !important;
  pointer-events: none;
}

.tp-field-detail-page .tp-field-fab {
  box-sizing: border-box !important;
  display: grid !important;
  place-items: center !important;
  flex: none !important;
  width: 52px !important;
  height: 52px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 2px solid #78dca0 !important;
  border-radius: 50% !important;
  background: #123321 !important;
  color: #e7ffea !important;
  box-shadow: 0 8px 26px rgba(0, 0, 0, .34) !important;
  font: 400 30px/1 system-ui, sans-serif !important;
  cursor: pointer;
  pointer-events: auto;
}

.tp-field-detail-page .tp-field-fab-menu {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  flex-wrap: nowrap !important;
  gap: 4px !important;
  width: 100% !important;
  max-height: min(55dvh, 340px) !important;
  margin: 0 !important;
  padding: 8px !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  border: 1px solid rgba(120, 220, 160, .38) !important;
  border-radius: 18px !important;
  background: #0e1912 !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, .45) !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: auto !important;
  overscroll-behavior: contain;
}

.tp-field-detail-page .tp-field-fab-menu button {
  box-sizing: border-box !important;
  display: grid !important;
  grid-template-columns: 32px minmax(0, 1fr) !important;
  align-items: center !important;
  flex: none !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 44px !important;
  margin: 0 !important;
  padding: 5px 10px !important;
  border: 0 !important;
  border-radius: 10px !important;
  background: transparent !important;
  color: #f3fff2 !important;
  box-shadow: none !important;
  text-align: left !important;
  font-family: inherit !important;
  cursor: pointer;
}

.tp-field-detail-page .tp-field-fab-menu button:focus-visible,
.tp-field-detail-page .tp-field-fab-menu button:hover {
  background: #1a3021 !important;
  outline-color: #78dca0;
}

.tp-field-detail-page .tp-field-fab-menu button span {
  box-sizing: border-box !important;
  display: grid !important;
  place-items: center !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 9px !important;
  color: #fff !important;
  font-size: 17px !important;
}

.tp-field-detail-page .tp-field-fab-menu button strong {
  overflow: hidden !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-field-detail-page .tp-field-fab-menu .green { background: #27814b !important; }
.tp-field-detail-page .tp-field-fab-menu .amber { background: #9e7120 !important; }
.tp-field-detail-page .tp-field-fab-menu .blue { background: #476b9d !important; }
.tp-field-detail-page .tp-field-fab-menu .purple { background: #71569a !important; }
.tp-field-detail-page .tp-field-fab-menu .cyan { background: #327d7b !important; }
.tp-field-detail-page .tp-field-fab-menu .gray { background: #57665c !important; }
.tp-field-detail-page .tp-field-fab-menu .red { background: #873c3c !important; }
.tp-field-detail-page .tp-field-fab-menu .tp-field-fab-delete {
  margin-top: 4px !important;
  border-top: 1px solid #344036 !important;
  border-radius: 0 0 10px 10px !important;
  color: #ffc6c6 !important;
}

.tp-field-detail-page .tp-field-delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(1, 7, 3, .8);
  backdrop-filter: blur(5px);
}

.tp-field-detail-page .tp-field-delete-dialog {
  box-sizing: border-box;
  width: min(100%, 390px);
  padding: 22px;
  border: 1px solid #36583c;
  border-radius: 20px;
  background: #0e1912;
  color: #f2fff2;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .55);
}

.tp-field-detail-page .tp-field-delete-kicker {
  color: #f8a8a8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
}

.tp-field-detail-page .tp-field-delete-dialog h2 {
  margin: 8px 0 12px;
  color: #fff;
  font-size: 23px;
}

.tp-field-detail-page .tp-field-delete-dialog p {
  margin: 0 0 14px;
  color: #d7e3d7;
  font-size: 14px;
  line-height: 1.55;
}

.tp-field-detail-page .tp-field-delete-dialog .tp-field-delete-warning {
  padding: 12px;
  border: 1px solid #736036;
  border-radius: 11px;
  background: #292315;
  color: #ffe2a3;
}

.tp-field-detail-page .tp-field-delete-dialog .tp-field-delete-error {
  color: #ffc3c3;
}

.tp-field-detail-page .tp-field-delete-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.tp-field-detail-page .tp-field-delete-actions button {
  min-height: 46px;
  padding: 8px;
  border: 1px solid #335840;
  border-radius: 11px;
  background: #193023;
  color: #f2fff2;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.tp-field-detail-page .tp-field-delete-actions .danger {
  border-color: #bb5353;
  background: #973434;
  color: #fff;
}

.tp-field-detail-page .tp-field-delete-actions button:disabled {
  opacity: .6;
  cursor: wait;
}

#field-info, #field-production, #field-sections, #field-operations {
  scroll-margin-top: 92px;
}

@media (max-height: 600px) {
  .tp-field-detail-page .tp-field-fab-menu {
    max-height: calc(100dvh - 175px) !important;
  }
}

/* SVG'ler class CSS'i yüklenmese bile devleşmesin */
svg.tp-shortcut-svg,
svg.tp-premium-fieldmap-badge-icon{
  display:block !important;
  overflow:visible;
}

svg.tp-shortcut-svg{
  width:22px !important;
  height:22px !important;
  min-width:22px !important;
  min-height:22px !important;
  max-width:22px !important;
  max-height:22px !important;
}

svg.tp-premium-fieldmap-badge-icon{
  width:16px !important;
  height:16px !important;
  min-width:16px !important;
  min-height:16px !important;
  max-width:16px !important;
  max-height:16px !important;
}


/* SVG boyut güvenliği: ikonların kartı kaplamasını engeller */
.tp-shortcut-svg{
  width:22px !important;
  height:22px !important;
  max-width:22px !important;
  max-height:22px !important;
  flex:0 0 22px !important;
}

.tp-premium-fieldmap-badge-icon{
  width:16px !important;
  height:16px !important;
  max-width:16px !important;
  max-height:16px !important;
  flex:0 0 16px !important;
}


/* ===== YENİ TARLA: KAPAK FOTOĞRAFI + ŞIK KOMPAKT AKSİYONLAR ===== */
.tp-field-form-heading-cover{display:block!important;text-align:left!important;margin-bottom:18px!important}
.tp-new-field-cover{position:relative;height:190px;overflow:hidden;border-radius:22px;background:#e6eee5;box-shadow:0 12px 30px rgba(30,58,38,.11)}
.tp-new-field-cover img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 55%}
.tp-new-field-cover-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,24,13,.02) 22%,rgba(7,27,14,.72) 100%)}
.tp-new-field-cover-copy{position:absolute;left:22px;right:22px;bottom:19px;color:#fff}
.tp-new-field-cover-copy>span{display:inline-flex;margin-bottom:7px;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.14);backdrop-filter:blur(7px);font-size:8px;font-weight:900;letter-spacing:.1em}
.tp-new-field-cover-copy h1{margin:0!important;color:#fff!important;font-size:27px!important;line-height:1.05!important;text-align:left!important;text-shadow:0 2px 10px rgba(0,0,0,.18)}
.tp-new-field-cover-copy p{margin:7px 0 0!important;max-width:360px;color:rgba(255,255,255,.9)!important;font-size:11px!important;line-height:1.4!important;text-align:left!important}
.tp-new-field-intro{margin:12px 2px 0!important;color:#718077!important;font-size:10px!important;line-height:1.45!important;text-align:left!important}

.tp-parcel-lookup-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
.tp-parcel-search-button,.tp-parcel-tkgm-button{
  min-height:52px!important;height:auto!important;width:100%!important;
  display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;
  border:1px solid #dfe7df!important;border-radius:14px!important;padding:7px 10px!important;
  background:#fff!important;color:#29382f!important;box-shadow:0 5px 16px rgba(28,55,35,.055)!important;
  font-size:10px!important;font-weight:800!important;text-align:left!important;
}
.tp-parcel-search-button:hover:not(:disabled),.tp-parcel-tkgm-button:hover{background:#fbfdfb!important;border-color:#cad9cb!important}
.tp-parcel-button-icon{
  width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important;
  display:grid!important;place-items:center!important;border-radius:10px!important;background:#edf5ed!important;color:#2f7541!important;
}
.tp-parcel-button-icon.neutral{background:#f1f3f1!important;color:#59665e!important}
.tp-parcel-button-icon svg,.tp-parcel-search-button svg,.tp-parcel-tkgm-button svg{
  width:17px!important;height:17px!important;min-width:17px!important;min-height:17px!important;max-width:17px!important;max-height:17px!important;
  flex:0 0 17px!important;display:block!important;
}
.tp-parcel-spinner{width:17px!important;height:17px!important;min-width:17px!important;max-width:17px!important}
@media(max-width:560px){
 .tp-new-field-cover{height:165px;border-radius:18px}
 .tp-new-field-cover-copy{left:17px;right:17px;bottom:15px}
 .tp-new-field-cover-copy h1{font-size:24px!important}
 .tp-parcel-lookup-actions{grid-template-columns:1fr 1fr!important}
 .tp-parcel-search-button,.tp-parcel-tkgm-button{min-height:48px!important;padding:6px 8px!important;font-size:9px!important}
 .tp-parcel-button-icon{width:31px!important;height:31px!important;min-width:31px!important;max-width:31px!important}
}



/* ===== TOPRAK ANALİZİ V1 ===== */
.tp-soil-page{min-height:100vh;background:#f5f7f3;color:#1e2d23}
.tp-soil-topbar{height:64px;display:flex;align-items:center;gap:11px;padding:0 22px;border-bottom:1px solid #e2e8e1;background:rgba(255,255,255,.96);position:sticky;top:0;z-index:20}
.tp-soil-topbar>button{width:36px;height:36px;border:1px solid #dbe4dc;border-radius:10px;background:#fff;color:#245936;font-size:18px;cursor:pointer}
.tp-soil-topbar>div{display:flex;flex-direction:column;gap:2px}.tp-soil-topbar strong{font-size:13px}.tp-soil-topbar small{color:#849087;font-size:8px}
.tp-soil-main{width:min(1080px,calc(100% - 30px));margin:0 auto;padding:18px 0 90px}
.tp-soil-hero{min-height:192px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 30px;border:1px solid #dbe3d8;border-radius:20px;background:linear-gradient(135deg,#233e2c 0%,#395a3f 58%,#897b54 140%);color:#fff;overflow:hidden;box-shadow:0 16px 34px rgba(30,61,40,.12)}
.tp-soil-hero-copy{max-width:650px}.tp-soil-hero-kicker{display:inline-flex;margin-bottom:9px;padding:5px 8px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:7px;font-weight:950;letter-spacing:.09em}
.tp-soil-hero h1{max-width:620px;margin:0;color:#fff;font-size:28px;line-height:1.08;letter-spacing:-.03em}.tp-soil-hero p{max-width:610px;margin:9px 0 14px;color:rgba(255,255,255,.78);font-size:9px;line-height:1.55}
.tp-soil-hero-pills{display:flex;gap:7px;flex-wrap:wrap}.tp-soil-hero-pills span{padding:6px 9px;border-radius:9px;background:rgba(255,255,255,.10);font-size:7.5px;font-weight:800}
.tp-soil-hero-visual{position:relative;width:190px;height:140px;display:grid;place-items:center;flex:0 0 190px}.tp-soil-hero-visual span{position:relative;z-index:2;font-size:62px;filter:drop-shadow(0 8px 14px rgba(0,0,0,.18))}.tp-soil-hero-visual i{position:absolute;width:170px;height:85px;bottom:10px;border-radius:50%;background:linear-gradient(180deg,#6d5539,#402f21);transform:perspective(130px) rotateX(56deg);box-shadow:0 12px 30px rgba(0,0,0,.18)}
.tp-soil-actions-grid{display:grid;grid-template-columns:1.15fr .95fr;gap:14px;margin-top:14px}.tp-soil-card{border:1px solid #e0e6de;border-radius:17px;background:#fff;padding:17px;box-shadow:0 8px 26px rgba(31,58,39,.045)}
.tp-soil-card-title{display:flex;align-items:center;gap:10px;margin-bottom:13px}.tp-soil-card-title>div{display:flex;flex-direction:column;gap:2px}.tp-soil-card-title strong{font-size:12px}.tp-soil-card-title small{color:#8b958f;font-size:8px}.tp-soil-card-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;font-size:15px;font-weight:900}.tp-soil-card-icon.blue{background:#eaf2f7;color:#527a95}.tp-soil-card-icon.green{background:#e9f4ea;color:#3b8250}.tp-soil-card-icon.amber{background:#f6f0e2;color:#a9822d}
.tp-soil-dropzone{min-height:138px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1px dashed #cdd9ce;border-radius:14px;background:#fafcf9;cursor:pointer;text-align:center}.tp-soil-dropzone input{display:none}.tp-soil-dropzone>span{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#edf5ee;color:#347248;font-size:17px;font-weight:900}.tp-soil-dropzone strong{margin-top:3px;font-size:10px}.tp-soil-dropzone small{color:#919b94;font-size:8px}.tp-soil-dropzone.has-file{border-style:solid;border-color:#bcd2c0;background:#f5faf5}
.tp-soil-field-link{margin-top:13px;padding-top:13px;border-top:1px solid #eef1ed}.tp-soil-field-link>span{display:block;margin-bottom:7px;color:#67766c;font-size:7px;font-weight:950;letter-spacing:.08em}.tp-soil-field-link p{margin:7px 0 0;color:#7f8a82;font-size:8px}.tp-soil-field-link p strong{color:#2b5839}
.tp-soil-location-status{display:flex;align-items:center;gap:9px;padding:10px;border-radius:12px;background:#f5f8f4}.tp-soil-location-status>span{font-size:18px}.tp-soil-location-status>div{display:flex;flex-direction:column;gap:2px}.tp-soil-location-status small{color:#8b958d;font-size:7.5px}.tp-soil-location-status strong{font-size:9px}
.tp-soil-location-options{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.tp-soil-location-options button{display:flex;align-items:center;gap:8px;min-height:58px;padding:8px;border:1px solid #e1e8e1;border-radius:12px;background:#fff;text-align:left;font-family:inherit;cursor:pointer}.tp-soil-location-options button>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:#edf5ee;color:#2f7540;font-weight:900}.tp-soil-location-options button>div{display:flex;flex-direction:column;gap:2px}.tp-soil-location-options button strong{font-size:8.5px}.tp-soil-location-options button small{color:#929c95;font-size:7px}.tp-soil-location-options button.available{border-color:#c5dcc8;background:#f7fbf7}
.tp-soil-manual-location{margin-top:10px;padding:10px;border:1px solid #edf0ec;border-radius:12px;background:#fafbf9}.tp-soil-manual-location>small{display:block;margin-bottom:6px;color:#7f8a83;font-size:7.5px;font-weight:800}.tp-soil-manual-location>div{display:grid;grid-template-columns:1fr 1fr;gap:7px}.tp-soil-manual-location input{height:38px;border:1px solid #dfe6df;border-radius:9px;padding:0 10px;background:#fff;font:inherit;font-size:9px;outline:none}.tp-soil-location-message{margin:8px 0 0;color:#6f7d73;font-size:8px;line-height:1.4}.tp-soil-primary-outline{width:100%;min-height:39px;margin-top:10px;border:1px solid #33754a;border-radius:10px;background:#fff;color:#2e6c43;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
.tp-soil-guide-card{grid-column:1/-1}.tp-soil-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.tp-soil-steps>div{display:flex;flex-direction:column;align-items:flex-start;min-height:104px;padding:12px;border:1px solid #e7ebe5;border-radius:12px;background:#fbfcfa}.tp-soil-steps span{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#edf4ea;color:#3c7449;font-size:9px;font-weight:950}.tp-soil-steps strong{margin-top:8px;font-size:9px}.tp-soil-steps small{margin-top:3px;color:#8c968f;font-size:7.5px;line-height:1.35}
.tp-soil-ai-card{margin-top:14px;padding:18px;border:1px solid #d9e4d9;border-radius:17px;background:linear-gradient(135deg,#f7fbf7,#f4f7f0 65%,#faf7ef);box-shadow:0 9px 28px rgba(31,67,40,.055)}.tp-soil-ai-head{display:grid;grid-template-columns:46px 1fr auto;gap:11px;align-items:start}.tp-soil-ai-symbol{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:#2f7746;color:#fff;font-size:20px;box-shadow:0 8px 18px rgba(47,119,70,.18)}.tp-soil-ai-head>div:nth-child(2)>span{color:#4d7759;font-size:7px;font-weight:950;letter-spacing:.09em}.tp-soil-ai-head h2{margin:3px 0 4px;font-size:15px}.tp-soil-ai-head p{margin:0;color:#778379;font-size:8.5px;line-height:1.45}.tp-soil-ai-badge{padding:5px 8px;border-radius:999px;background:#fff;border:1px solid #d9e5da;color:#4a6d54;font-size:7px;font-weight:900}.tp-soil-ai-preview{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}.tp-soil-ai-preview>div{display:flex;flex-direction:column;gap:3px;padding:10px;border:1px solid #e2e8e0;border-radius:11px;background:rgba(255,255,255,.8)}.tp-soil-ai-preview small{color:#8b958f;font-size:7px}.tp-soil-ai-preview strong{font-size:8.5px}.tp-soil-ai-button{width:100%;min-height:42px;margin-top:11px;border:0;border-radius:11px;background:#286f40;color:#fff;font:inherit;font-size:9.5px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(40,111,64,.15)}.tp-soil-ai-button:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}.tp-soil-ai-message{margin-top:8px;padding:8px 10px;border-radius:9px;background:#fff;border:1px solid #e1e7df;color:#657268;font-size:8px}
.tp-soil-history-card{margin-top:14px;padding:17px;border:1px solid #e0e6de;border-radius:17px;background:#fff}.tp-soil-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.tp-soil-section-head>div{display:flex;flex-direction:column;gap:2px}.tp-soil-section-head span{color:#6a7b6e;font-size:7px;font-weight:950;letter-spacing:.08em}.tp-soil-section-head h2{margin:0;font-size:13px}.tp-soil-section-head button{border:0;background:transparent;color:#34764a;font:inherit;font-size:8px;font-weight:850;cursor:pointer}.tp-soil-empty-history{min-height:125px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-top:11px;border:1px dashed #dfe5dd;border-radius:13px;background:#fafbf9;text-align:center}.tp-soil-empty-history>span{font-size:23px}.tp-soil-empty-history strong{margin-top:4px;font-size:9.5px}.tp-soil-empty-history p{max-width:400px;margin:4px 0 0;color:#8a948d;font-size:8px}
.tp-detail-soil-shortcut{display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:10px!important;width:100%!important;border:1px solid #dce7dc!important;border-radius:12px!important;padding:10px!important;background:linear-gradient(135deg,#f7fbf7,#fff)!important;color:inherit!important;text-align:left!important;font:inherit!important;cursor:pointer!important}.tp-detail-soil-shortcut>div:nth-child(2){display:flex;flex-direction:column;gap:3px}.tp-detail-soil-shortcut strong{font-size:9px}.tp-detail-soil-shortcut p{margin:0;color:#849087;font-size:7.5px;line-height:1.4}.tp-detail-soil-shortcut>span{color:#438057;font-size:17px}
@media(max-width:760px){.tp-soil-main{width:min(100% - 16px,1080px);padding-top:10px}.tp-soil-hero{min-height:170px;padding:20px}.tp-soil-hero h1{font-size:21px}.tp-soil-hero-visual{display:none}.tp-soil-actions-grid{grid-template-columns:1fr}.tp-soil-guide-card{grid-column:auto}.tp-soil-steps{grid-template-columns:1fr 1fr}.tp-soil-ai-preview{grid-template-columns:1fr}.tp-soil-location-options{grid-template-columns:1fr}.tp-soil-ai-head{grid-template-columns:42px 1fr}.tp-soil-ai-badge{display:none}}

`;
