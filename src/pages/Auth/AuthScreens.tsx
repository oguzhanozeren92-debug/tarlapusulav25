import {
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

import type { Screen } from '../../types';
import './Auth.css';

type AuthScreensProps = {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  cmsRuntimeCss: string;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  username: string;
  setUsername: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  authLoading: boolean;
  authMessage: string;
  setAuthMessage: Dispatch<SetStateAction<string>>;
  verificationEmail: string;
  handleEmailRegister: (
    e: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
  handleEmailLogin: (
    e: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

function BrandMark() {
  return (
    <svg viewBox="0 0 72 72" className="tp-authv2-brand-mark" aria-hidden="true">
      <circle cx="36" cy="36" r="27" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M46 17L39.5 34L23 40L31.5 31.5L46 17Z" fill="#57b947" />
      <path d="M26 55L32.5 38L49 32L40.5 40.5L26 55Z" fill="#173b63" />
      <circle cx="36" cy="36" r="4.2" fill="#edf6ef" />
      <path d="M25 55C31 50 38 47 47 46C43 53 36 57 27 58" fill="none" stroke="#5f9f31" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19C6.5 15.8 8.8 14 12 14C15.2 14 17.5 15.8 18.5 19" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.3" />
      <path d="M8 10V7.4C8 5.2 9.8 3.5 12 3.5C14.2 3.5 16 5.2 16 7.4V10" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4.5 7L12 12.5L19.5 7" />
    </svg>
  );
}

function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.8 12C4.9 8.8 7.9 7 12 7C16.1 7 19.1 8.8 21.2 12C19.1 15.2 16.1 17 12 17C7.9 17 4.9 15.2 2.8 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {off && <path d="M4 4L20 20" />}
    </svg>
  );
}

function SatelliteIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="20" y="17" width="9" height="9" rx="1.3" transform="rotate(45 20 17)" />
      <path d="M13 12L20 19M28 27L35 34M9 16L5 20L12 27L16 23M32 25L36 21L43 28L39 32" />
      <path d="M18 31C15 34 15 38 18 41M14 28C9 33 9 40 14 45" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M20 9C15 9 11 13 11 18V30C11 35 15 39 20 39C22.3 39 24.4 38.2 26 36.8C27.6 38.2 29.7 39 32 39C37 39 41 35 41 30C41 27.8 40.2 25.8 38.8 24.2C40.2 22.6 41 20.6 41 18C41 13 37 9 32 9C29.7 9 27.6 9.8 26 11.2C24.4 9.8 22.3 9 20 9Z" />
      <path d="M26 11V37M17 17H22M17 24H22M17 31H22M30 17H36M30 24H36M30 31H36" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M14 30H34C38.4 30 42 26.4 42 22C42 17.7 38.6 14.2 34.3 14C32.6 9.9 28.7 7 24 7C17.8 7 12.8 11.7 12.2 17.7C8.7 18.5 6 21.7 6 25.5C6 28 7.2 30.2 9 31.6" />
      <path d="M15 35L12 41M24 35L21 41M33 35L30 41" />
    </svg>
  );
}

function BrandHeader() {
  return (
    <header className="tp-authv2-brand">
      <div className="tp-authv2-brand-row">
        <BrandMark />
        <div className="tp-authv2-wordmark">
          <span>Tarla</span><strong>Pusula</strong>
        </div>
      </div>
      <p>
        Tarlanı takip eder,
        <br />
        zamanı gelince seni yönlendirir.
      </p>
    </header>
  );
}

function FeatureCards() {
  return (
    <section className="tp-authv2-features">
      <article className="tp-authv2-feature">
        <span className="tp-authv2-feature-icon"><SatelliteIcon /></span>
        <strong>Tarlayı Uydudan Takip Etme</strong>
      </article>

      <article className="tp-authv2-feature">
        <span className="tp-authv2-feature-icon"><AiIcon /></span>
        <strong>Yapay Zeka Entegrasyonu</strong>
      </article>

      <article className="tp-authv2-feature">
        <span className="tp-authv2-feature-icon"><WeatherIcon /></span>
        <strong>Hava Durumu ve Uyarılar</strong>
      </article>
    </section>
  );
}

export default function AuthScreens({
  screen,
  setScreen,
  cmsRuntimeCss,
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
  handleEmailRegister,
  handleEmailLogin,
}: AuthScreensProps) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(() => {
    try {
      return window.localStorage.getItem('tp_remember_session') !== 'false';
    } catch {
      return true;
    }
  });

  const visibleScreen =
    screen === 'welcome' || screen === 'login' ? 'emailLogin' : screen;

  const openLogin = () => {
    setAuthMessage('');
    setScreen('emailLogin');
  };

  const openRegister = () => {
    setAuthMessage('');
    setConfirmPassword('');
    setScreen('emailRegister');
  };

  const onSubmitLogin = (e: FormEvent<HTMLFormElement>) => {
    try {
      window.localStorage.setItem(
        'tp_remember_session',
        rememberSession ? 'true' : 'false',
      );
    } catch {
      // localStorage kullanılamıyorsa Supabase oturumu normal şekilde devam eder.
    }

    handleEmailLogin(e);
  };

  if (visibleScreen === 'emailLogin') {
    return (
      <>
        <style>{cmsRuntimeCss}</style>

        <main className="tp-authv2">
          <div className="tp-authv2-inner">
            <BrandHeader />

            <section className="tp-authv2-panel">
              <h1>Giriş Yap</h1>

              <form onSubmit={onSubmitLogin}>
                <div className="tp-authv2-group">
                  <label htmlFor="tp-login-email">Kullanıcı adı / E-posta</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><UserIcon /></span>
                    <input
                      id="tp-login-email"
                      type="email"
                      value={email}
                      placeholder="Kullanıcı adı / E-posta"
                      autoComplete="email"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setAuthMessage('');
                      }}
                    />
                  </div>
                </div>

                <div className="tp-authv2-group">
                  <label htmlFor="tp-login-password">Şifre</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><LockIcon /></span>
                    <input
                      id="tp-login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Şifre"
                      autoComplete="current-password"
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthMessage('');
                      }}
                    />
                    <button
                      type="button"
                      className="tp-authv2-eye"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      aria-label={showLoginPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      <EyeIcon off={showLoginPassword} />
                    </button>
                  </div>
                </div>

                <label className="tp-authv2-remember">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setRememberSession(checked);

                      try {
                        window.localStorage.setItem(
                          'tp_remember_session',
                          checked ? 'true' : 'false',
                        );
                      } catch {
                        // Tercih bu tarayıcıda saklanamıyorsa yalnızca mevcut ekranda uygulanır.
                      }
                    }}
                  />
                  <span className="tp-authv2-checkmark" aria-hidden="true">
                    <svg viewBox="0 0 18 18">
                      <path d="M4.2 9.4 7.2 12.3 13.8 5.7" />
                    </svg>
                  </span>
                  <span className="tp-authv2-remember-copy">
                    <strong>Oturumumu açık tut</strong>
                    <small>Bu cihazda tekrar giriş isteme</small>
                  </span>
                </label>

                {authMessage && (
                  <div className="tp-authv2-message">{authMessage}</div>
                )}

                <button
                  type="submit"
                  className="tp-authv2-primary"
                  disabled={authLoading}
                >
                  {authLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>

              <div className="tp-authv2-footer">
                <span>Hesabın yok mu?</span>
                <button type="button" onClick={openRegister}>
                  Ücretsiz Üye Ol
                </button>
              </div>
            </section>

            <FeatureCards />
          </div>
        </main>
      </>
    );
  }

  if (visibleScreen === 'emailRegister') {
    const onSubmitRegister = (e: FormEvent<HTMLFormElement>) => {
      if (password !== confirmPassword) {
        e.preventDefault();
        setAuthMessage('Şifreler birbiriyle eşleşmiyor.');
        return;
      }
      handleEmailRegister(e);
    };

    return (
      <>
        <style>{cmsRuntimeCss}</style>

        <main className="tp-authv2">
          <div className="tp-authv2-inner tp-authv2-register-inner">
            <BrandHeader />

            <section className="tp-authv2-panel tp-authv2-register-panel">
              <h1>Ücretsiz Kaydolun</h1>

              <form onSubmit={onSubmitRegister}>
                <div className="tp-authv2-group">
                  <label htmlFor="tp-register-name">Ad Soyad</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><UserIcon /></span>
                    <input
                      id="tp-register-name"
                      type="text"
                      value={username}
                      placeholder="Ad Soyad"
                      autoComplete="name"
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setAuthMessage('');
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="tp-authv2-group">
                  <label htmlFor="tp-register-email">Email</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><MailIcon /></span>
                    <input
                      id="tp-register-email"
                      type="email"
                      value={email}
                      placeholder="Email"
                      autoComplete="email"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setAuthMessage('');
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="tp-authv2-group">
                  <label htmlFor="tp-register-password">Şifre</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><LockIcon /></span>
                    <input
                      id="tp-register-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Şifre"
                      autoComplete="new-password"
                      minLength={8}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthMessage('');
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="tp-authv2-eye"
                      onClick={() => setShowRegisterPassword((v) => !v)}
                      aria-label={showRegisterPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      <EyeIcon off={showRegisterPassword} />
                    </button>
                  </div>
                </div>

                <div className="tp-authv2-group">
                  <label htmlFor="tp-register-confirm">Tekrar Şifre</label>
                  <div className="tp-authv2-input">
                    <span className="tp-authv2-input-icon"><LockIcon /></span>
                    <input
                      id="tp-register-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      placeholder="Tekrar Şifre"
                      autoComplete="new-password"
                      minLength={8}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setAuthMessage('');
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="tp-authv2-eye"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      <EyeIcon off={showConfirmPassword} />
                    </button>
                  </div>
                </div>

                {authMessage && (
                  <div className="tp-authv2-message">{authMessage}</div>
                )}

                <button
                  type="submit"
                  className="tp-authv2-primary tp-authv2-register-primary"
                  disabled={authLoading}
                >
                  {authLoading ? 'Kayıt Oluşturuluyor...' : 'Kayıt Ol'}
                </button>
              </form>

              <div className="tp-authv2-footer">
                <span>Zaten hesabın var mı?</span>
                <button type="button" onClick={openLogin}>Oturum Aç</button>
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  if (visibleScreen === 'emailVerification') {
    return (
      <>
        <style>{cmsRuntimeCss}</style>

        <main className="tp-authv2">
          <div className="tp-authv2-inner tp-authv2-verification-inner">
            <BrandHeader />

            <section className="tp-authv2-panel tp-authv2-verification-panel">
              <div className="tp-authv2-verification-icon"><MailIcon /></div>
              <h1>E-postanı doğrula</h1>
              <p>Hesabını etkinleştirmek için gönderdiğimiz doğrulama bağlantısına tıkla.</p>
              <strong>{verificationEmail || email}</strong>

              <button
                type="button"
                className="tp-authv2-primary"
                onClick={() => {
                  setPassword('');
                  setAuthMessage('');
                  setScreen('emailLogin');
                }}
              >
                Giriş Ekranına Git
              </button>
            </section>
          </div>
        </main>
      </>
    );
  }

  return null;
}
