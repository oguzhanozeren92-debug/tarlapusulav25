import { useEffect } from 'react';

/**
 * Legacy compatibility component.
 * Admin management now lives inside the normal TarlaPusula application via
 * InAppAdminMode. Keeping this tiny component prevents stale imports from
 * breaking TypeScript builds while old links are phased out.
 */
export default function AdminPortal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }
  }, []);

  return null;
}
