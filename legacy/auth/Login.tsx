import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('E-posta ve şifre alanlarını doldurun.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        if (
          error.message
            .toLowerCase()
            .includes('invalid login credentials')
        ) {
          setErrorMessage('E-posta veya şifre hatalı.');
        } else if (
          error.message
            .toLowerCase()
            .includes('email not confirmed')
        ) {
          setErrorMessage(
            'Önce e-posta adresinizi doğrulamanız gerekiyor.',
          );
        } else {
          setErrorMessage(error.message);
        }

        return;
      }

      if (data.session) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        'Giriş yapılırken bir hata oluştu.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page login-page">
      <section className="login-panel">
        <div className="login-logo">
          <Compass size={68} strokeWidth={1.4} />
        </div>

        <h1>Giriş Yap</h1>

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label htmlFor="login-email">
              Kullanıcı adı / E-posta
            </label>

            <div className="auth-input">
              <UserRound size={22} />

              <input
                id="login-email"
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

          <div className="auth-field">
            <label htmlFor="login-password">
              Şifre
            </label>

            <div className="auth-input">
              <LockKeyhole size={22} />

              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
              />

              <button
                type="button"
                className="eye-button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
                aria-label="Şifreyi göster veya gizle"
              >
                {showPassword ? (
                  <EyeOff size={23} />
                ) : (
                  <Eye size={23} />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="auth-error">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? 'Giriş Yapılıyor...'
              : 'Giriş Yap'}
          </button>
        </form>

        <div className="login-register">
          <span>Hesabın yok mu?</span>

          <button
            type="button"
            onClick={() => navigate('/register')}
          >
            Ücretsiz Üye Ol
          </button>
        </div>
      </section>
    </main>
  );
}