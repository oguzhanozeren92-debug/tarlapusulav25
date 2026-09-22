import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import './Auth.css';

export default function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  const handleRegister = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Ad Soyad alanını doldurun.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('E-posta adresinizi girin.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        'Şifre en az 6 karakter olmalıdır.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        'Şifreler birbiriyle eşleşmiyor.',
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,

          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (error) {
        const message =
          error.message.toLowerCase();

        if (
          message.includes('already registered') ||
          message.includes('already been registered')
        ) {
          setErrorMessage(
            'Bu e-posta adresiyle daha önce hesap oluşturulmuş.',
          );
        } else {
          setErrorMessage(error.message);
        }

        return;
      }

      if (data.session) {
        navigate('/', { replace: true });
        return;
      }

      if (data.user) {
        setSuccessMessage(
          'Hesabın oluşturuldu. E-posta adresine gönderilen doğrulama bağlantısını kontrol et.',
        );
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        'Kayıt oluşturulurken bir hata oluştu.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page register-page">
      <section className="register-panel">
        <div className="register-logo">
          <Compass size={64} strokeWidth={1.4} />
        </div>

        <h1>Ücretsiz Kaydolun</h1>

        <form onSubmit={handleRegister}>
          <div className="auth-field register-field">
            <label htmlFor="full-name">
              Ad Soyad
            </label>

            <div className="auth-input register-input">
              <UserRound size={25} />

              <input
                id="full-name"
                type="text"
                value={fullName}
                autoComplete="name"
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrorMessage('');
                }}
              />
            </div>
          </div>

          <div className="auth-field register-field">
            <label htmlFor="register-email">
              Email
            </label>

            <div className="auth-input register-input">
              <Mail size={25} />

              <input
                id="register-email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage('');
                }}
              />
            </div>
          </div>

          <div className="auth-field register-field">
            <label htmlFor="register-password">
              Şifre
            </label>

            <div className="auth-input register-input">
              <LockKeyhole size={25} />

              <input
                id="register-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
              />

              <button
                type="button"
                className="eye-button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value,
                  )
                }
                aria-label="Şifreyi göster veya gizle"
              >
                {showPassword ? (
                  <EyeOff size={24} />
                ) : (
                  <Eye size={24} />
                )}
              </button>
            </div>
          </div>

          <div className="auth-field register-field">
            <label htmlFor="confirm-password">
              Tekrar Şifre
            </label>

            <div className="auth-input register-input">
              <LockKeyhole size={25} />

              <input
                id="confirm-password"
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirmPassword(
                    e.target.value,
                  );
                  setErrorMessage('');
                }}
              />

              <button
                type="button"
                className="eye-button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) => !value,
                  )
                }
                aria-label="Şifreyi göster veya gizle"
              >
                {showConfirmPassword ? (
                  <EyeOff size={24} />
                ) : (
                  <Eye size={24} />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="auth-error">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="auth-success">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            className="register-button"
            disabled={loading}
          >
            {loading
              ? 'Kayıt Oluşturuluyor...'
              : 'Kayıt Ol'}
          </button>
        </form>

        <div className="register-login">
          <span>Zaten Bir Hesabın var mı?</span>

          <button
            type="button"
            onClick={() => navigate('/login')}
          >
            Oturum Aç
          </button>
        </div>
      </section>
    </main>
  );
}