import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Clock, GameHeader, PhaseTrack, ScorePill } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import type { FinishResult, HitResult, SessionState, WordInstancePublic, WordsPhasePayload } from '../domain/types';
import { fallPixelsPerSecond } from '../domain/rules';
import { useAudio } from '../lib/audio';
import { callGame, nextPath, readToken } from '../services/gameApi';

interface FallingWord extends WordInstancePublic {
  x: number;
  y: number;
  note: string;
}

const COLORS = ['var(--primary)', 'var(--secondary)', 'var(--progress)', '#1d4e89', '#7a4e2d', '#0f6b4c'];

export function WordsPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const audio = useAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const [payload, setPayload] = useState<WordsPhasePayload | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [words, setWords] = useState<FallingWord[]>([]);
  const [score, setScore] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FinishResult | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const wordsRef = useRef<FallingWord[]>([]);
  const payloadRef = useRef<WordsPhasePayload | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    audioRef.current.playMusic('music_words');
    const token = readToken();
    if (!token) {
      navigate('/');
      return;
    }
    let cancel = false;
    Promise.all([
      callGame<{ state: SessionState }>('state', { token }),
      callGame<WordsPhasePayload>('start-phase', { token, phase: 'words' }),
    ])
      .then(([stateResponse, phase]) => {
        if (cancel) return;
        setSession(stateResponse.state);
        setPayload(phase);
        setScore(phase.score);
        const initial = phase.activeInstances.map((item) => ({ ...item, x: 8 + Math.random() * 70, y: 10, note: '' }));
        wordsRef.current = initial;
        setWords(initial);
      })
      .catch(async (caught) => {
        try {
          const stateResponse = await callGame<{ state: SessionState }>('state', { token });
          if (!cancel) navigate(nextPath(stateResponse.state));
        } catch {
          if (!cancel) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a nuvem.');
        }
      });
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancel = true;
      window.clearInterval(clock);
      audioRef.current.stopMusic();
    };
  }, [navigate]);

  useEffect(() => {
    if (!payload) return;
    let frame = 0;
    let last = performance.now();
    let spawnAt = performance.now();
    const loop = (time: number) => {
      const current = payloadRef.current;
      if (!current || ended.current) return;
      const delta = Math.min(0.05, (time - last) / 1000);
      last = time;
      const height = areaRef.current?.clientHeight ?? 420;
      const speed = fallPixelsPerSecond(current.fallSpeed, current.customSpeed);
      const expired: string[] = [];
      const next = wordsRef.current.map((word) => ({ ...word, y: word.y + speed * delta }));
      const visible = next.filter((word) => {
        if (word.y < height - 36) return true;
        expired.push(word.instanceId);
        return false;
      });
      wordsRef.current = visible;
      setWords(visible);
      const token = readToken();
      expired.forEach((instanceId) => {
        if (token) void callGame('word-expire', { token, attemptId: current.attemptId, instanceId }).catch(() => undefined);
      });
      if (time >= spawnAt && visible.length < current.maxSimultaneous && token) {
        spawnAt = time + current.spawnIntervalMs;
        void callGame<WordInstancePublic>('word-spawn', { token, attemptId: current.attemptId })
          .then((spawned) => {
            if (ended.current || wordsRef.current.some((item) => item.instanceId === spawned.instanceId)) return;
            const created = { ...spawned, x: 6 + Math.random() * 72, y: -10, note: '' };
            wordsRef.current = [...wordsRef.current, created];
            setWords(wordsRef.current);
          })
          .catch((caught: Error) => {
            if (/tempo/i.test(caught.message)) void finish();
          });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [payload]);

  const totalLeft = payload ? (new Date(payload.startedAt).getTime() + payload.timeLimitSec * 1000 - now) / 1000 : 0;

  useEffect(() => {
    if (payload && totalLeft <= 0) void finish();
  }, [payload, totalLeft]);

  async function finish() {
    if (ended.current || !payloadRef.current) return;
    ended.current = true;
    const token = readToken();
    if (!token) return;
    try {
      const result = await callGame<FinishResult>('finish-phase', {
        token,
        attemptId: payloadRef.current.attemptId,
        phase: 'words',
      });
      audioRef.current.playSfx('sfx_finish');
      setOutcome(result);
      setScore(result.score);
    } catch (caught) {
      ended.current = false;
      setError(caught instanceof Error ? caught.message : 'Não foi possível encerrar a nuvem.');
    }
  }

  async function tap(word: FallingWord) {
    const current = payloadRef.current;
    const token = readToken();
    if (!current || !token || ended.current) return;
      const marked = wordsRef.current.map((item) => item.instanceId === word.instanceId ? { ...item, note: '...' } : item);
      wordsRef.current = marked;
      setWords(marked);
    try {
      const result = await callGame<HitResult>('word-hit', { token, attemptId: current.attemptId, instanceId: word.instanceId });
      audioRef.current.playSfx(result.correct ? 'sfx_word_ok' : 'sfx_word_bad');
      setScore(result.score);
      wordsRef.current = wordsRef.current.filter((item) => item.instanceId !== word.instanceId);
      setWords(wordsRef.current);
      if (!result.duplicate) {
        setError(null);
        const note = result.correct ? `Correta, ${result.delta >= 0 ? '+' : ''}${result.delta} pontos` : `Não representa a escola, ${result.delta} pontos`;
        setOutcomeNote(note);
      }
    } catch (caught) {
      wordsRef.current = wordsRef.current.map((item) => item.instanceId === word.instanceId ? { ...item, note: '' } : item);
      setWords(wordsRef.current);
      setError(caught instanceof Error ? caught.message : 'Sem conexão. Tente tocar de novo.');
    }
  }

  const [note, setOutcomeNote] = useState('');

  async function retry() {
    const token = readToken();
    if (!token) return;
    ended.current = false;
    setOutcome(null);
    const phase = await callGame<WordsPhasePayload>('start-phase', { token, phase: 'words' });
    setPayload(phase);
    setScore(phase.score);
    setWords([]);
    wordsRef.current = [];
  }

  async function continueTour() {
    const token = readToken();
    if (!token) return navigate('/');
    const stateResponse = await callGame<{ state: SessionState }>('state', { token });
    navigate(nextPath(stateResponse.state));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-4 md:px-8">
      <PhaseTrack current="words" session={session} />
      <div className="flex items-start justify-between gap-3">
        <GameHeader title="Fase 3 — Nuvem de palavras" subtitle="Toque nos conceitos que representam a escola." />
        <Clock seconds={Math.max(0, totalLeft)} label="Tempo" />
      </div>
      <ScorePill score={score} />
      {note ? <p className="font-extrabold" aria-live="polite">{note}</p> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {outcome ? (
        <section className="card p-6">
          <h2 className="text-2xl font-extrabold">{outcome.message}</h2>
          <p className="mt-2 text-lg">Pontuação desta fase: {outcome.score} pontos.</p>
          <div className="mt-4">
            {outcome.canRetry ? (
              <button className="btn btn-primary" type="button" onClick={() => void retry()}>{config.theme.retryButtonLabel}</button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => void continueTour()}>Ver resultado</button>
            )}
          </div>
        </section>
      ) : (
        <div ref={areaRef} className="relative min-h-[62dvh] overflow-hidden rounded-3xl bg-white/80 shadow-card">
          {words.map((word) => (
            <button
              key={word.instanceId}
              type="button"
              className="absolute rounded-full px-3 py-2 font-extrabold"
              style={{
                left: `${word.x}%`,
                top: word.y,
                color: COLORS[word.style % COLORS.length],
                fontSize: `${1.05 + (word.style % 3) * 0.35}rem`,
                background: 'white',
              }}
              onClick={() => void tap(word)}
            >
              {word.text}
              <span className="sr-only">{word.note}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
