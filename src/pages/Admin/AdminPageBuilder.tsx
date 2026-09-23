import { useEffect } from 'react';

export default function AdminPageBuilder({ onBack }: { onBack?: () => void }) {
  useEffect(() => {
    try {
      window.localStorage.setItem('tp_admin_mode_open_v1', '1');
    } catch {
      // localStorage kapalı olsa da yönlendirme çalışır.
    }

    if (window.location.pathname !== '/admin') {
      window.location.assign('/admin');
      return;
    }

    onBack?.();
  }, [onBack]);

  return null;
}
