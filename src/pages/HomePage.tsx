import { motion } from 'framer-motion';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhaseTrack } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import { PHASE_META } from '../domain/defaults';
import { maxPossibleScore } from '../domain/rules';
import { useAudio } from '../lib/audio';
import { callGame, nextPath, saveToken } from '../services/gameApi';
import type { SessionState } from '../domain/types';

export function HomePage() {
  const { config, loading, error } = useConfig();
  const audio = useAudio();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = config.mode !== 'unconfigured' && !loading && !error;
  const total = maxPossibleScore(config.rules);

  useEffect(() => {
    audio.playMusic('music_home');
    return () => audio.stopMusic();
  }, [audio]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!ready) return;
    setPending(true);
    try {
      const response = await callGame<{ token: string; state: SessionState }>('start', { name, className });
      saveToken(response.token);
      audio.playMusic('music_home');
      navigate(nextPath(response.state));
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Não foi possível começar o tour.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-28 pt-6 md:px-8">
      {config.mode === 'development' ? (
        <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold">
          Modo de desenvolvimento neste navegador. Os resultados ficam apenas neste computador. A versão publicada usa o Supabase.
        </p>
      ) : null}
      <motion.section
        className="card overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div
          className="min-h-48 bg-cover bg-center p-6 md:p-10"
          style={{
            backgroundImage: config.theme.coverUrl
              ? `linear-gradient(180deg, color-mix(in srgb, var(--bg) 10%, transparent), var(--bg)), url(${config.theme.coverUrl})`
              : undefined,
          }}
        >
          <div className="flex items-center gap-4">
            {config.theme.logoUrl ? (
              <img src={config.theme.logoUrl} alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-extrabold text-white" style={{ background: 'var(--primary)' }} aria-hidden>
                {config.theme.schoolName.slice(0, 1)}
              </div>
            )}
            <p className="text-lg font-extrabold">{config.theme.schoolName}</p>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">{config.theme.gameTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg">{config.theme.welcomeText}</p>
        </div>
      </motion.section>

      <section className="mt-6" aria-label="Os três desafios">
        <PhaseTrack current="home" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PHASE_META.map((phase, index) => {
            const enabled = config.rules[`${phase.key}Enabled`];
            const points = phase.key === 'quiz'
              ? config.rules.quizMaxScore
              : phase.key === 'puzzle'
                ? config.rules.puzzleScore + config.rules.puzzleSpeedBonus
                : config.rules.wordsMaxScore;
            return (
              <motion.article
                key={phase.key}
                className="card p-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <h2 className="text-lg font-extrabold">{phase.step} — {phase.title}</h2>
                <p className="mt-2">{phase.summary}</p>
                <p className="mt-3 text-sm font-bold">{enabled ? `Até ${points} pontos` : 'Fase desativada pela escola'}</p>
              </motion.article>
            );
          })}
        </div>
        <p className="mt-3 text-sm font-semibold">Pontuação máxima deste tour: {total} pontos.</p>
      </section>

      <form className="card mt-6 grid gap-4 p-5 md:p-7" onSubmit={onSubmit}>
        <h2 className="text-2xl font-extrabold">Antes de começar</h2>
        {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}
        {config.mode === 'unconfigured' ? <SetupHelp /> : null}
        <label className="grid gap-2 font-bold">
          Seu nome
          <input className="field font-semibold" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required={ready} />
        </label>
        {config.theme.collectClass ? (
          <label className="grid gap-2 font-bold">
            Turma ou identificação
            <input className="field font-semibold" value={className} onChange={(event) => setClassName(event.target.value)} maxLength={40} required={ready} />
          </label>
        ) : null}
        {formError ? <p role="alert" className="font-semibold text-red-800">{formError}</p> : null}
        <button className="btn btn-primary text-lg" type="submit" disabled={!ready || pending || loading}>
          {pending ? 'Abrindo o tour...' : config.theme.startButtonLabel}
        </button>
        <p className="text-sm">Não é preciso criar conta. O som começa depois do primeiro toque ou clique.</p>
      </form>
      <footer className="mt-6 text-sm">
        <a className="font-extrabold underline" href={`${import.meta.env.BASE_URL}admin`}>Área da escola</a>
      </footer>
    </main>
  );
}

function SetupHelp() {
  return (
    <div className="rounded-2xl bg-white p-4 text-sm leading-6">
      <p className="font-extrabold">O tour ainda não está ligado a um banco de dados.</p>
      <ol className="mt-2 list-decimal pl-5">
        <li>Crie um projeto no Supabase e execute os arquivos SQL da pasta supabase/migrations.</li>
        <li>Publique a função game e crie o primeiro administrador.</li>
        <li>Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no GitHub Actions.</li>
        <li>Abra o endereço publicado no GitHub Pages. O passo a passo completo está no README.</li>
      </ol>
    </div>
  );
}
