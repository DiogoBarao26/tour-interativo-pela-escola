import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { setDevAdmin } from './guard';

const LINKS = [
  ['/admin', 'Início'],
  ['/admin/aparencia', 'Nome e cores'],
  ['/admin/quiz', 'Perguntas'],
  ['/admin/quebra-cabeca', 'Foto'],
  ['/admin/nuvem', 'Palavras'],
  ['/admin/configuracoes', 'Tempo e pontos'],
  ['/admin/sons', 'Sons'],
  ['/admin/relatorios', 'Quem jogou'],
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function logout() {
    if (supabase && isSupabaseConfigured) await supabase.auth.signOut();
    setDevAdmin(false);
    navigate('/admin/login');
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      <aside className={`${open ? 'block' : 'hidden'} border-b bg-white md:block md:border-r`}>
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-extrabold uppercase" style={{ color: 'var(--primary)' }}>Equipe</p>
            <strong>Cuidar do tour</strong>
          </div>
          <button className="btn btn-secondary !min-h-11 md:hidden" type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X aria-hidden />
          </button>
        </div>
        <nav className="grid gap-1 p-3" aria-label="Seções do painel">
          {LINKS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) => `rounded-2xl px-4 py-3 font-extrabold ${isActive ? 'text-white' : ''}`}
              style={({ isActive }) => ({ background: isActive ? 'var(--primary)' : 'transparent' })}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="grid gap-2 p-3">
          <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}`}>Jogar</a>
          <button className="btn btn-secondary" type="button" onClick={() => void logout()}>Sair</button>
        </div>
      </aside>
      <div>
        <header className="flex items-center gap-3 p-4 md:hidden">
          <button className="btn btn-secondary !min-h-11" type="button" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu aria-hidden />
          </button>
          <strong>Cuidar do tour</strong>
        </header>
        <div className="px-4 pb-16 pt-2 md:px-8 md:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
