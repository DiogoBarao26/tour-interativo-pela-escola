import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { setDevAdmin } from './guard';
import { Field, Notice, TextInput } from './fields';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setPending(true);
    setError(null);
    const { data, error: signError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signError || !data.user) {
      setPending(false);
      setError(signError?.message.includes('confirm') ? 'Confirme o e-mail deste administrador no Supabase antes de entrar.' : 'E-mail ou senha incorretos.');
      return;
    }
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!admin) {
      await supabase.auth.signOut();
      setPending(false);
      setError('Este usuário autenticou, mas não está autorizado no painel. Inclua o usuário na tabela de administradores.');
      return;
    }
    navigate('/admin');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <section className="card p-6 md:p-8">
        <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>Área da escola</p>
        <h1 className="mt-2 text-3xl font-extrabold">Entrar no painel</h1>
        <p className="mt-2">O acesso é exclusivo de quem administra o tour. Participantes não precisam de senha.</p>
        {isSupabaseConfigured ? (
          <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
            <Field label="E-mail">
              <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Senha">
              <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <Notice error={error} />
            <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Entrando...' : 'Entrar'}</button>
          </form>
        ) : (
          <div className="mt-6 grid gap-4">
            <Notice error="O Supabase ainda não foi configurado neste build. Siga o README para criar o projeto, executar o SQL e publicar a função game." />
            {import.meta.env.DEV ? (
              <button className="btn btn-primary" type="button" onClick={() => { setDevAdmin(true); navigate('/admin'); }}>
                Abrir painel de desenvolvimento
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
