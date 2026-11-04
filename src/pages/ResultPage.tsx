import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Celebration } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import type { SessionState } from '../domain/types';
import { formatDuration } from '../domain/rules';
import { useAudio } from '../lib/audio';
import { callGame, clearToken, readToken } from '../services/gameApi';

export function ResultPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const audio = useAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      navigate('/');
      return;
    }
    let cancel = false;
    callGame<{ state: SessionState }>('finalize', { token })
      .then((response) => {
        if (cancel) return;
        setSession(response.state);
        const approved = response.state.result?.approved;
        audioRef.current.playMusic(approved ? 'music_victory' : 'music_encourage');
        if (approved) audioRef.current.playSfx('sfx_celebrate');
      })
      .catch((caught) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o resultado.');
      });
    return () => {
      cancel = true;
      audioRef.current.stopMusic();
    };
  }, [navigate]);

  const result = session?.result;

  function again() {
    clearToken();
    navigate('/');
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 pb-28 pt-8">
      <Celebration active={Boolean(result?.approved)} />
      {error ? <p role="alert" className="font-semibold text-red-800">{error}</p> : null}
      {!result && !error ? <p>Calculando o resultado...</p> : null}
      {result ? (
        <motion.section className="card relative z-40 p-6 md:p-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--progress)' }}>
            {result.participantName}{result.className ? ` · ${result.className}` : ''}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{result.title}</h1>
          <p className="mt-4 text-lg">{result.detail}</p>
          <motion.p className="mt-6 text-6xl font-extrabold" style={{ color: 'var(--primary)' }} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            {result.totalScore}
          </motion.p>
          <p className="font-bold">de {result.maxScore} pontos · {result.percent}% de aproveitamento</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Stat label="Quiz" value={`${result.quizScore} pontos`} />
            <Stat label="Quebra-cabeça" value={`${result.puzzleScore} pontos`} />
            <Stat label="Nuvem de palavras" value={`${result.wordsScore} pontos`} />
            <Stat label="Tempo total" value={formatDuration(result.totalTimeMs)} />
          </dl>
          <button className="btn btn-primary mt-8" type="button" onClick={again}>{config.theme.retryButtonLabel}</button>
        </motion.section>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <dt className="text-sm font-bold">{label}</dt>
      <dd className="text-xl font-extrabold">{value}</dd>
    </div>
  );
}
