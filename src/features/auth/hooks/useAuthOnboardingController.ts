import { useEffect, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { supabase } from '../../../supabaseClient';
import { onboardingQuestions } from '../../../data/onboarding';
import type { Screen } from '../../../types';

type UseAuthOnboardingControllerOptions = {
  isNewUserPreview: boolean;
  setScreen: Dispatch<SetStateAction<Screen>>;
};

export function useAuthOnboardingController({
  isNewUserPreview,
  setScreen,
}: UseAuthOnboardingControllerOptions) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [otherProduct, setOtherProduct] = useState('');

  const currentQuestion = onboardingQuestions[onboardingStep];

  const selectAnswer = (value: string) => {
    const current = answers[onboardingStep] || [];

    if (currentQuestion.multi) {
      const exists = current.includes(value);
      setAnswers({
        ...answers,
        [onboardingStep]: exists
          ? current.filter((item) => item !== value)
          : [...current, value],
      });

      if (value === 'Diğer ürün' && exists) setOtherProduct('');
      return;
    }

    setAnswers({ ...answers, [onboardingStep]: [value] });
  };

  const startOnboarding = () => {
    setOnboardingStep(0);
    setAnswers({});
    setOtherProduct('');
    setAuthMessage('');
    setScreen('onboarding');
  };

  useEffect(() => {
    let active = true;

    const restoreRememberedSession = async () => {
      try {
        let rememberSession = true;
        try {
          rememberSession = window.localStorage.getItem('tp_remember_session') !== 'false';
        } catch {
          rememberSession = true;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) {
          console.error('Kayıtlı oturum okunamadı:', sessionError);
          return;
        }
        if (!session?.user) return;

        if (!rememberSession) {
          await supabase.auth.signOut();
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!active) return;
        if (profileError) {
          console.error('Kayıtlı oturum profil bilgisi okunamadı:', profileError);
          return;
        }

        if (profile?.onboarding_completed) setScreen('home');
        else startOnboarding();
      } catch (error) {
        console.error('Kayıtlı oturum geri yüklenemedi:', error);
      }
    };

    void restoreRememberedSession();
    return () => {
      active = false;
    };
  }, []);

  const saveOnboarding = async () => {
    if (isNewUserPreview) {
      setAuthMessage('');
      setScreen('ready');
      return true;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setScreen('ready');
        return true;
      }

      const { error: onboardingError } = await supabase
        .from('onboarding_answers')
        .upsert(
          {
            user_id: user.id,
            usage_type: answers[0]?.[0] ?? null,
            production_types: answers[1] ?? [],
            products: answers[2] ?? [],
            other_product: otherProduct.trim() || null,
            production_area: answers[3]?.[0] ?? null,
            interests: answers[4] ?? [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (onboardingError) throw onboardingError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setScreen('ready');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onboarding kaydedilemedi.';
      console.error('Onboarding kayıt hatası:', error);
      setAuthMessage(message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const nextOnboardingStep = async () => {
    if (onboardingStep === onboardingQuestions.length - 1) {
      await saveOnboarding();
      return;
    }
    setOnboardingStep((step) => step + 1);
  };

  const skipOnboardingStep = async () => {
    await nextOnboardingStep();
  };

  const handleEmailRegister = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !cleanUsername || !password) {
      setAuthMessage('Lütfen tüm alanları doldur.');
      return;
    }
    if (cleanUsername.length < 3) {
      setAuthMessage('Kullanıcı adı en az 3 karakter olmalı.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername } },
      });
      if (error) throw error;

      if (data.session && data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username: cleanUsername, updated_at: new Date().toISOString() })
          .eq('id', data.user.id);
        if (profileError) throw profileError;
        startOnboarding();
        return;
      }

      setVerificationEmail(cleanEmail);
      setScreen('emailVerification');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hesap oluşturulamadı.';
      console.error('Kayıt hatası:', error);
      setAuthMessage(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthMessage('E-posta ve şifreni gir.');
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;

      const metadataUsername =
        typeof data.user.user_metadata?.username === 'string'
          ? data.user.user_metadata.username.trim()
          : '';

      if (metadataUsername) {
        const { error: usernameError } = await supabase
          .from('profiles')
          .update({ username: metadataUsername, updated_at: new Date().toISOString() })
          .eq('id', data.user.id)
          .is('username', null);

        if (usernameError && usernameError.code !== '23505') {
          console.warn('Kullanıcı adı profile aktarılamadı:', usernameError);
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();
      if (profileError) throw profileError;

      if (profile?.onboarding_completed) setScreen('home');
      else startOnboarding();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Giriş yapılamadı.';
      console.error('Giriş hatası:', error);
      setAuthMessage(message);
    } finally {
      setAuthLoading(false);
    }
  };

  return {
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
    startOnboarding,
    nextOnboardingStep,
    skipOnboardingStep,
    handleEmailRegister,
    handleEmailLogin,
  };
}
