import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Clock, GameHeader, PhaseTrack, ScorePill } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import type { PuzzlePhasePayload, PuzzleResult, SessionState } from '../domain/types';
import { isSolved, resolvePuzzleImage } from '../domain/rules';
import { sliceImage } from '../game/sliceImage';
import { useAudio } from '../lib/audio';
import { callGame, nextPath, readToken } from '../services/gameApi';

export function PuzzlePage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const audio = useAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const [payload, setPayload] = useState<PuzzlePhasePayload | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [pieces, setPieces] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PuzzleResult | null>(null);
  const drag = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const sent = useRef(false);

  useEffect(() => {
    audioRef.current.playMusic('music_puzzle');
    const token = readToken();
    if (!token) {
      navigate('/');
      return;
    }
    let cancel = false;
    Promise.all([
      callGame<{ state: SessionState }>('state', { token }),
      callGame<PuzzlePhasePayload>('start-phase', { token, phase: 'puzzle' }),
    ])
      .then(async ([stateResponse, phase]) => {
        if (cancel) return;
        setSession(stateResponse.state);
        setPayload(phase);
        const saved = sessionStorage.getItem(`tour.puzzle.${phase.attemptId}`);
        const stored = saved ? (JSON.parse(saved) as number[]) : null;
        setOrder(stored && stored.length === phase.shuffle.length ? stored : phase.shuffle);
        setPieces(await sliceImage(resolvePuzzleImage(phase.imageUrl), phase.rows));
      })
      .catch(async (caught) => {
        if (cancel) return;
        const message = caught instanceof Error ? caught.message : 'Não foi possível abrir o quebra-cabeça.';
        if (/não está liberada|já foi encerrado|tentativas desta fase acabaram/i.test(message)) {
          try {
            const stateResponse = await callGame<{ state: SessionState }>('state', { token });
            if (cancel) return;
            const path = nextPath(stateResponse.state);
            if (path !== '/tour/quebra-cabeca') {
              navigate(path);
              return;
            }
          } catch {
            // A mensagem abaixo explica por que a foto não abriu.
          }
        }
        setError(message);
      });
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      audioRef.current.stopMusic();
    };
  }, [navigate]);

  useEffect(() => {
    if (payload && order.length) sessionStorage.setItem(`tour.puzzle.${payload.attemptId}`, JSON.stringify(order));
  }, [order, payload]);

  const totalLeft = payload ? (new Date(payload.startedAt).getTime() + payload.timeLimitSec * 1000 - now) / 1000 : 0;
  const solved = order.length > 0 && isSolved(order);

  useEffect(() => {
    if (!payload || outcome || sent.current || order.length === 0) return;
    if (solved || totalLeft <= 0) {
      sent.current = true;
      const token = readToken();
      if (!token) return;
      void callGame<PuzzleResult>('puzzle-complete', { token, attemptId: payload.attemptId, arrangement: order })
        .then((result) => {
          if (result.solved) {
            audioRef.current.playSfx('sfx_puzzle_done');
            audioRef.current.playSfx('sfx_celebrate');
          }
          setOutcome(result);
        })
        .catch((caught) => {
          sent.current = false;
          setError(caught instanceof Error ? caught.message : 'Não foi possível registrar o quebra-cabeça.');
        });
    }
  }, [order, outcome, payload, solved, totalLeft]);

  function swap(from: number, to: number) {
    setOrder((current) => {
      const next = [...current];
      const origin = next[from];
      const destination = next[to];
      if (origin == null || destination == null) return current;
      next[from] = destination;
      next[to] = origin;
      return next;
    });
    audioRef.current.playSfx('sfx_puzzle_move');
    setSelected(null);
  }

  function activate(index: number) {
    if (selected == null) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    swap(selected, index);
  }

  async function retry() {
    const token = readToken();
    if (!token) return;
    sent.current = false;
    setOutcome(null);
    const phase = await callGame<PuzzlePhasePayload>('start-phase', { token, phase: 'puzzle' });
    setPayload(phase);
    setOrder(phase.shuffle);
    setPieces(await sliceImage(resolvePuzzleImage(phase.imageUrl), phase.rows));
  }

  async function continueTour() {
    const token = readToken();
    if (!token) return navigate('/');
    const stateResponse = await callGame<{ state: SessionState }>('state', { token });
    navigate(nextPath(stateResponse.state));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-4 md:px-8">
      <PhaseTrack current="puzzle" session={session} />
      <div className="flex items-start justify-between gap-3">
        <GameHeader title="Fase 2 — Quebra-cabeça" subtitle={payload?.title} />
        <Clock seconds={Math.max(0, totalLeft)} label="Tempo" />
      </div>
      <ScorePill score={outcome?.score ?? 0} label="Pontos da fase" />
      <p className="text-sm">Toque em uma peça e depois no destino, ou arraste uma peça até outra. Também funciona com a tecla Enter.</p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {outcome ? (
        <motion.section className="card p-6" initial={{ scale: 0.96 }} animate={{ scale: 1 }}>
          <h2 className="text-2xl font-extrabold">{outcome.solved ? 'Imagem completa!' : 'Tempo encerrado'}</h2>
          <p className="mt-2">{outcome.message}</p>
          <p className="mt-2 font-bold">{outcome.correctPieces} de {outcome.totalPieces} peças no lugar. Pontuação: {outcome.score}.</p>
          <div className="mt-4">
            {outcome.canRetry ? (
              <button className="btn btn-primary" type="button" onClick={() => void retry()}>{config.theme.retryButtonLabel}</button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => void continueTour()}>Continuar</button>
            )}
          </div>
        </motion.section>
      ) : null}
      {payload && pieces.length > 0 && !outcome ? (
        <div
          className="grid gap-1 rounded-3xl bg-white p-2 shadow-card"
          style={{ gridTemplateColumns: `repeat(${payload.rows}, minmax(0, 1fr))`, touchAction: 'none' }}
        >
          {order.map((piece, index) => (
            <button
              key={`${piece}-${index}`}
              type="button"
              data-cell={index}
              className="overflow-hidden rounded-xl border-2"
              style={{ borderColor: selected === index ? 'var(--progress)' : 'transparent', aspectRatio: '1' }}
              aria-pressed={selected === index}
              aria-label={`Peça ${index + 1}${selected === index ? ', selecionada' : ''}`}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                activate(index);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { index, x: event.clientX, y: event.clientY, moved: false };
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 10) drag.current.moved = true;
              }}
              onPointerUp={(event) => {
                const origin = drag.current;
                drag.current = null;
                if (!origin?.moved) return;
                suppressClick.current = true;
                const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]');
                const destination = element ? Number((element as HTMLElement).dataset.cell) : origin.index;
                if (destination !== origin.index) swap(origin.index, destination);
              }}
            >
              <img src={pieces[piece]} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
      {!payload && !error ? <p>Preparando as peças...</p> : null}
    </main>
  );
}
