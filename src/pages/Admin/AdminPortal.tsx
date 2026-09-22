import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import ContentAdminPanel from '../../features/content-admin/ContentAdminPanel';
import AdminVisualBuilder from './AdminVisualBuilder';
import AdminPageBuilder from './AdminPageBuilder';
import './AdminPortal.css';

type PortalState = 'checking' | 'signed-out' | 'forbidden' | 'ready';
type PortalTab = 'content' | 'design' | 'advanced';

async function checkAdmin(user: User | null) {
  if (!user) return false;
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.error('Admin üyeliği kontrol edilemedi:', error);
    return false;
  }
  return Boolean(data?.user_id);
}

function tabTitle(tab: PortalTab) {
  if (tab === 'content') return 'İçerik Yönetimi';
  if (tab === 'advanced') return 'Gelişmiş CMS';
  return 'Görsel Düzenleyici';
}

export default function AdminPortal() {
  const [state, setState] = useState<PortalState>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<PortalTab>('design');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const resolveSession = async () => {
    setState('checking');
    const { data } = await supabase.auth.getSession();
    const nextUser = data.session?.user ?? null;
    setUser(nextUser);
    if (!nextUser) {
      setState('signed-out');
      return;
    }
    setState((await checkAdmin(nextUser)) ? 'ready' : 'forbidden');
  };

  useEffect(() => {
    void resolveSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setState('signed-out');
        return;
      }
      void checkAdmin(nextUser).then((allowed) => setState(allowed ? 'ready' : 'forbidden'));
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const allowed = await checkAdmin(data.user);
      setUser(data.user);
      if (!allowed) {
        setState('forbidden');
        setMessage('Bu hesap TarlaPusula admin listesinde değil.');
        return;
      }
      setState('ready');
      setPassword('');
    } catch (error: any) {
      setMessage(error?.message || 'Admin girişi başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    setUser(null);
    setState('signed-out');
    setBusy(false);
  };

  if (state === 'checking') {
    return (
      <main className="tp-admin-auth-shell">
        <div className="tp-admin-loading">
          <span className="tp-admin-mark">TP</span>
          <strong>Admin oturumu kontrol ediliyor…</strong>
        </div>
      </main>
    );
  }

  if (state === 'signed-out') {
    return (
      <main className="tp-admin-auth-shell">
        <section className="tp-admin-login-card">
          <div className="tp-admin-login-brand">
            <span className="tp-admin-mark">TP</span>
            <div>
              <strong>TarlaPusula</strong>
              <small>Yönetim Merkezi</small>
            </div>
          </div>
          <div className="tp-admin-login-copy">
            <span>YALNIZCA YETKİLİ HESAP</span>
            <h1>Admin girişi</h1>
            <p>Email ve şifre oturumu açar. Admin yetkisi ayrıca güvenli <b>admin_users</b> kaydından doğrulanır.</p>
          </div>
          <form onSubmit={login}>
            <label>
              Admin email
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@..." required />
            </label>
            <label>
              Şifre
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required minLength={6} />
            </label>
            {message && <div className="tp-admin-form-message">{message}</div>}
            <button type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Yönetim Merkezine Gir'}</button>
          </form>
          <small className="tp-admin-login-foot">Normal üretici girişi bu sayfadan yapılmaz.</small>
        </section>
      </main>
    );
  }

  if (state === 'forbidden') {
    return (
      <main className="tp-admin-auth-shell">
        <section className="tp-admin-login-card">
          <div className="tp-admin-login-brand">
            <span className="tp-admin-mark">TP</span>
            <div><strong>TarlaPusula</strong><small>Yönetim Merkezi</small></div>
          </div>
          <div className="tp-admin-login-copy">
            <span>YETKİ YOK</span>
            <h1>Bu hesap admin değil</h1>
            <p>{user?.email || 'Giriş yapan hesap'} için admin üyeliği bulunamadı. Email adresini bilmek tek başına yönetim yetkisi vermez.</p>
          </div>
          {message && <div className="tp-admin-form-message">{message}</div>}
          <button className="tp-admin-secondary" type="button" onClick={() => void logout()} disabled={busy}>Farklı hesapla giriş yap</button>
        </section>
      </main>
    );
  }

  return (
    <div className="tp-admin-portal">
      <aside className="tp-admin-sidebar">
        <div className="tp-admin-sidebar__brand">
          <span className="tp-admin-mark">TP</span>
          <div><strong>TarlaPusula</strong><small>Admin</small></div>
        </div>
        <nav>
          <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}><span>01</span> İçerik Merkezi</button>
          <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}><span>02</span> Görsel Düzenleyici</button>
          <button className={tab === 'advanced' ? 'active' : ''} onClick={() => setTab('advanced')}><span>03</span> Gelişmiş CMS</button>
        </nav>
        <div className="tp-admin-sidebar__account">
          <small>Giriş yapan admin</small>
          <strong>{user?.email || 'Admin'}</strong>
          <button type="button" onClick={() => void logout()} disabled={busy}>Çıkış yap</button>
        </div>
      </aside>

      <main className="tp-admin-main">
        <header className="tp-admin-topbar">
          <div>
            <span>TarlaPusula v25</span>
            <strong>{tabTitle(tab)}</strong>
          </div>
          <a href="/">Uygulamaya dön ↗</a>
        </header>
        <div className="tp-admin-main__body">
          {tab === 'content' && <ContentAdminPanel />}
          {tab === 'design' && <AdminVisualBuilder />}
          {tab === 'advanced' && <AdminPageBuilder onBack={() => setTab('design')} />}
        </div>
      </main>
    </div>
  );
}
