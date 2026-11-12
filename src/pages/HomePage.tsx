import { motion } from 'framer-motion';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearPlayGame, GAMES, playGameId, setPlayGame } from '../admin/teamPassword';
import { PhaseTrack } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import { PHASE_META } from '../domain/defaults';
import { maxPossibleScore } from '../domain/rules';
import { useAudio } from '../lib/audio';
import { Media, useMediaUrl } from '../lib/media';
import { isSupabaseConfigured } from '../lib/supabase';
import { callGame, clearToken, loadGameChoices, nextPath, saveToken } from '../services/gameApi';
import type { SessionState } from '../domain/types';

export function HomePage() {
  const { config, loading, error, reload } = useConfig();
  const audio = useAudio();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useSearchParams();
  const [choices, setChoices] = useState<{ id: string; name: string; schoolName: string; gameTitle: string }[]>([]);
  const [chosen, setChosen] = useState(playGameId());
  const ready = config.mode !== 'unconfigured' && !loading && !error && (isSupabaseConfigured || Boolean(chosen));
  const coverUrl = useMediaUrl(config.theme.coverUrl);
  const total = maxPossibleScore(config.rules);

  useEffect(() => {
    audio.playMusic('music_home');
    return () => audio.stopMusic();
  }, [audio]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    void loadGameChoices().then((games) => setChoices(games ?? []));
    const query = search.get('jogo');
    if (query && GAMES.some((game) => game.id === query) && query !== playGameId()) {
      setPlayGame(query);
      clearToken();
      setChosen(query);
      void reload();
    }
  }, [reload, search]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!ready) return;
    setPending(true);
    try {
      const response = await callGame<{ token: string; state: SessionState }>('start', { name, className, slotId: playGameId() });
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
      {config.mode === 'local' && !chosen ? (
        <section className="grid gap-4">
          <header>
            <h1 className="text-4xl font-extrabold">Escolha um jogo</h1>
            <p className="mt-2 text-lg">São seis jogos. Cada pessoa da equipe personaliza o dela.</p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            {(choices.length ? choices : GAMES.map((game) => ({ ...game, schoolName: 'Escola Horizonte', gameTitle: 'TOUR INTERATIVO PELA ESCOLA' }))).map((game) => (
              <button
                key={game.id}
                className="card p-5 text-left"
                type="button"
                onClick={() => {
                  setPlayGame(game.id);
                  clearToken();
                  setChosen(game.id);
                  setSearch({ jogo: game.id });
                  void reload();
                }}
              >
                <strong className="text-2xl">{game.name}</strong>
                <p className="mt-1 font-bold">{game.schoolName}</p>
                <p className="mt-1">{game.gameTitle}</p>
              </button>
            ))}
          </div>
          <footer className="text-sm">
            <a className="font-extrabold underline" href={`${import.meta.env.BASE_URL}admin`}>Cuidar do tour</a>
          </footer>
        </section>
      ) : null}
      {config.mode === 'local' && chosen ? (
        <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold">
          Você está no {GAMES.find((game) => game.id === chosen)?.name}.{' '}
          <button
            className="font-extrabold underline"
            type="button"
            onClick={() => {
              clearPlayGame();
              clearToken();
              setChosen(null);
              setSearch({});
              void reload();
            }}
          >
            Escolher outro jogo
          </button>
        </p>
      ) : null}
      {config.mode !== 'local' || chosen ? <>
      <motion.section
        className="card overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div
          className="min-h-48 bg-cover bg-center p-6 md:p-10"
          style={{
            backgroundImage: coverUrl
              ? `linear-gradient(180deg, color-mix(in srgb, var(--bg) 10%, transparent), var(--bg)), url(${coverUrl})`
              : undefined,
          }}
        >
          <div className="flex items-center gap-4">
            {config.theme.logoUrl ? (
              <Media url={config.theme.logoUrl} className="h-16 w-16 rounded-2xl bg-white object-contain p-1" />
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
        <a className="font-extrabold underline" href={`${import.meta.env.BASE_URL}admin`}>Cuidar do tour</a>
      </footer>
      </> : null}
    </main>
  );
}

