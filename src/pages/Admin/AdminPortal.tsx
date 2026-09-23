import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import ContentAdminPanel from '../../features/content-admin/ContentAdminPanel';
import AdminLiveStudio from './AdminLiveStudio';
import AdminUsersPanel from './AdminUsersPanel';
import AdminBroadcastPanel from './AdminBroadcastPanel';
import './AdminPortal.css';

type PortalState = 'checking' | 'signed-out' | 'forbidden' | 'ready';
type PortalView = 'studio' | 'content' | 'users' | 'broadcast';

async function checkAdmin(user: User | null) {
  if (!user) return false;
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) {
    console.error('Admin üyeliği kontrol edilemedi:', error);
    return false;
  }
  return Boolean(data?.user_id);
}

export default function AdminPortal() {
  const [state, setState] = useState<PortalState>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<PortalView>('studio');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const resolveSession = async () => {
    setState('checking');
    const { data } = await supabase.auth.getSession();
    const nextUser = data.session?.user ?? null;
    setUser(nextUser);
    if (!nextUser) { setState('signed-out'); return; }
    setState((await checkAdmin(nextUser)) ? 'ready' : 'forbidden');
  };

  useEffect(() => {
    void resolveSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) { setState('signed-out'); return; }
      void checkAdmin(nextUser).then((allowed) => setState(allowed ? 'ready' : 'forbidden'));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const allowed = await checkAdmin(data.user);
      setUser(data.user);
      if (!allowed) { setState('forbidden'); setMessage('Bu hesap TarlaPusula admin listesinde değil.'); return; }
      setState('ready'); setPassword(''); setView('studio');
    } catch (error: any) {
      setMessage(error?.message || 'Admin girişi başarısız.');
    } finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true); await supabase.auth.signOut(); setUser(null); setState('signed-out'); setBusy(false);
  };

  if (state === 'checking') return <main className="tp-admin-auth-shell"><div className="tp-admin-loading"><span>TP</span><strong>Admin oturumu kontrol ediliyor…</strong></div></main>;

  if (state === 'signed-out') return <main className="tp-admin-auth-shell"><section className="tp-admin-login-card"><div className="tp-admin-login-brand"><span>TP</span><div><strong>TarlaPusula</strong><small>Admin Modu</small></div></div><div className="tp-admin-login-copy"><small>YALNIZCA YETKİLİ HESAP</small><h1>Uygulamayı yönet</h1><p>Admin oturumundan sonra TarlaPusula normal kullanıcı görünümüyle açılır; düzenleme araçlarını yalnız sen görürsün.</p></div><form onSubmit={login}><label>E-posta<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Şifre<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/></label>{message&&<div className="tp-admin-form-message">{message}</div>}<button disabled={busy}>{busy?'Giriş yapılıyor…':'Admin modunu aç'}</button></form></section></main>;

  if (state === 'forbidden') return <main className="tp-admin-auth-shell"><section className="tp-admin-login-card"><div className="tp-admin-login-copy"><small>YETKİ YOK</small><h1>Bu hesap admin değil</h1><p>{user?.email || 'Bu hesap'} admin_users listesinde olmadığı için yönetim araçları açılmadı.</p></div><button className="tp-admin-secondary" onClick={()=>void logout()}>Farklı hesapla giriş yap</button></section></main>;

  if (view === 'content') return <div className="tp-admin-tool-page"><div className="tp-admin-tool-head"><button onClick={()=>setView('studio')}>← Uygulamaya dön</button><div><small>ADMIN ARAÇLARI</small><strong>Haber Akışı & İçerik</strong></div></div><ContentAdminPanel /></div>;
  if (view === 'users') return <AdminUsersPanel onBack={()=>setView('studio')} />;
  if (view === 'broadcast') return <AdminBroadcastPanel onBack={()=>setView('studio')} />;

  return <AdminLiveStudio email={user?.email} onOpenContent={()=>setView('content')} onOpenUsers={()=>setView('users')} onOpenBroadcast={()=>setView('broadcast')} onLogout={()=>void logout()} />;
}
