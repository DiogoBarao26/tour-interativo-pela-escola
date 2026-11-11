import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Field, Notice, TextInput } from './fields';
import { setDevAdmin } from './guard';
import { GAMES, gamePasswords, matchGame, setActiveGame } from './teamPassword';

const TEAM_EMAIL = 'equipe@tour.local';

export function LoginPage() {
  const navigate = useNavigate();
  const { reload } = useConfig();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: signError } = await supabase.auth.signInWithPassword({ email: TEAM_EMAIL, password });
        if (signError || !data.user) throw new Error('Essa senha não está certa. Tente de novo.');
        const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (!admin) {
          await supabase.auth.signOut();
          throw new Error('Essa senha não está certa. Tente de novo.');
        }
      } else {
        const game = matchGame(password);
        if (!game) throw new Error('Essa senha não está certa. Tente de novo.');
        setActiveGame(game.id);
        setDevAdmin(true);
        await reload();
      }
      navigate('/admin');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <section className="card p-6 md:p-8">
        <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>Equipe da escola</p>
        <h1 className="mt-2 text-3xl font-extrabold">Cuidar do tour</h1>
        <p className="mt-2">Cada senha abre um jogo. O que você mudar fica só no seu.</p>
        <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
          <Field label="Sua senha">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Notice error={error} />
          <button className="btn btn-primary text-lg" type="submit" disabled={pending}>
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
          {!isSupabaseConfigured ? (
            <ul className="grid gap-1 text-sm">
              {GAMES.map((game) => (
                <li key={game.id}>
                  <strong>{game.name}</strong>: {gamePasswords()[game.id]}
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      </section>
    </main>
  );
}
