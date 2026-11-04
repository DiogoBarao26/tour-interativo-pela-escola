import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const DEV_KEY = 'tour.dev.admin';

export function devAdminOn() {
  return sessionStorage.getItem(DEV_KEY) === '1';
}

export function setDevAdmin(on: boolean) {
  sessionStorage.setItem(DEV_KEY, on ? '1' : '0');
}

export function RequireAdmin() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'no'>('loading');

  useEffect(() => {
    const client = supabase;
    if (isSupabaseConfigured && client) {
      void client.auth.getSession().then(async ({ data }) => {
        const user = data.session?.user;
        if (!user) {
          setStatus('no');
          return;
        }
        const { data: admin } = await client.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
        setStatus(admin ? 'ok' : 'no');
      });
      return;
    }
    setStatus(devAdminOn() ? 'ok' : 'no');
  }, []);

  if (status === 'loading') return <p className="p-8 font-bold">Carregando painel...</p>;
  if (status === 'no') return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
