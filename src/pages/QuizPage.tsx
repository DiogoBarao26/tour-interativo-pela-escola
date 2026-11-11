import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Clock, GameHeader, PhaseTrack, ScorePill } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import type { AnswerResult, FinishResult, QuizPhasePayload, SessionState } from '../domain/types';

interface Ending {
  message: string;
  score: number;
  canRetry: boolean;
}
import { useAudio } from '../lib/audio';
import { callGame, nextPath, readToken } from '../services/gameApi';

export function QuizPage() {
  const navigate = useNavigate();
  const audio = useAudio();
  const { config } = useConfig();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const [payload, setPayload] = useState<QuizPhasePayload | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [questionEnds, setQuestionEnds] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [outcome, setOutcome] = useState<Ending | null>(null);
  const [cursor, setCursor] = useState(0);
  const busy = useRef(false);
  const finishedCall = useRef(false);

  useEffect(() => {
    audioRef.current.playMusic('music_quiz');
    const token = readToken();
    if (!token) {
      navigate('/');
      return;
    }
    let cancel = false;
    Promise.all([
      callGame<{ state: SessionState }>('state', { token }),
      callGame<QuizPhasePayload>('start-phase', { token, phase: 'quiz' }),
    ])
      .then(([stateResponse, phase]) => {
        if (cancel) return;
        setSession(stateResponse.state);
        setPayload(phase);
        setCursor(phase.answered.length);
        setQuestionEnds(Date.now() + phase.perQuestionSec * 1000);
      })
      .catch(async (caught) => {
        if (cancel) return;
        const message = caught instanceof Error ? caught.message : 'Não foi possível abrir o quiz.';
        if (/não está liberada|já foi encerrado|tentativas desta fase acabaram/i.test(message)) {
          try {
            const stateResponse = await callGame<{ state: SessionState }>('state', { token });
            if (cancel) return;
            const path = nextPath(stateResponse.state);
            if (path !== '/tour/quiz') {
              navigate(path);
              return;
            }
          } catch {
            // A mensagem abaixo explica por que as perguntas não abriram.
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

  const question = payload && cursor < payload.questions.length ? payload.questions[cursor] : undefined;
  const totalLeft = payload ? (new Date(payload.startedAt).getTime() + payload.timeLimitSec * 1000 - now) / 1000 : 0;
  const questionLeft = (questionEnds - now) / 1000;

  useEffect(() => {
    if (!payload || outcome || feedback || !question) return;
    if (totalLeft > 0) return;
    if (finishedCall.current) return;
    finishedCall.current = true;
    const token = readToken();
    if (!token) return;
    void callGame<FinishResult>('finish-phase', { token, attemptId: payload.attemptId, phase: 'quiz' })
      .then((result) => setOutcome({ message: result.message, score: result.score, canRetry: result.canRetry }))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Não foi possível encerrar o quiz.'));
  }, [feedback, outcome, payload, question, totalLeft]);

  useEffect(() => {
    if (!payload || outcome || feedback || !question) return;
    if (questionLeft > 0) return;
    void choose(null, true);
    // A escolha usa o estado atual da pergunta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionLeft, question?.id]);

  async function choose(alternativeId: string | null, timeout = false) {
    if (!payload || !question || busy.current || feedback || outcome) return;
    busy.current = true;
    setSelected(alternativeId);
    const token = readToken();
    if (!token) return;
    try {
      const result = await callGame<AnswerResult>('answer', {
        token,
        attemptId: payload.attemptId,
        questionId: question.id,
        alternativeId,
        timeout,
      });
      audioRef.current.playSfx(result.correct ? 'sfx_correct' : 'sfx_wrong');
      setFeedback(result);
      setPayload((current) => current ? {
        ...current,
        score: result.attemptScore,
        errors: result.errors,
        answered: [...current.answered, {
          questionId: question.id,
          correct: result.correct,
          points: result.pointsAwarded,
          correctAlternativeId: result.correctAlternativeId ?? '',
          selectedAlternativeId: alternativeId,
        }],
      } : current);
      if (result.phaseLocked || result.canRetry) {
        setOutcome({ message: result.message, score: result.attemptScore, canRetry: result.canRetry });
      }
    } catch (caught) {
      busy.current = false;
      setSelected(null);
      setError(caught instanceof Error ? caught.message : 'Não foi possível registrar a resposta.');
    }
  }

  function nextQuestion() {
    setFeedback(null);
    setSelected(null);
    busy.current = false;
    setCursor((current) => current + 1);
    setQuestionEnds(Date.now() + (payload?.perQuestionSec ?? 30) * 1000);
  }

  async function retry() {
    const token = readToken();
    if (!token) return;
    setOutcome(null);
    setFeedback(null);
    setSelected(null);
    busy.current = false;
    finishedCall.current = false;
    const phase = await callGame<QuizPhasePayload>('start-phase', { token, phase: 'quiz' });
    setPayload(phase);
    setCursor(0);
    setQuestionEnds(Date.now() + phase.perQuestionSec * 1000);
  }

  async function continueTour() {
    const token = readToken();
    if (!token) return navigate('/');
    const stateResponse = await callGame<{ state: SessionState }>('state', { token });
    navigate(nextPath(stateResponse.state));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pb-28 pt-4 md:px-8">
      <PhaseTrack current="quiz" session={session} />
      <div className="flex items-start justify-between gap-3">
        <GameHeader title="Fase 1 — Quiz" subtitle={`${payload ? payload.answered.length : 0} de ${payload?.questions.length ?? 0} perguntas`} />
        <div className="grid grid-cols-2 gap-2">
          <Clock seconds={Math.max(0, totalLeft)} label="Fase" />
          <Clock seconds={Math.max(0, question ? questionLeft : 0)} label="Pergunta" />
        </div>
      </div>
      <ScorePill score={payload?.score ?? 0} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!payload && !error ? <p>Carregando perguntas...</p> : null}
      {outcome ? (
        <section className="card p-6">
          <h2 className="text-2xl font-extrabold">{outcome.message}</h2>
          <p className="mt-2 text-lg">Pontuação desta fase: {outcome.score} pontos.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {outcome.canRetry ? (
              <button className="btn btn-primary" type="button" onClick={() => void retry()}>{config.theme.retryButtonLabel}</button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={() => void continueTour()}>Continuar</button>
            )}
          </div>
        </section>
      ) : null}
      {question && !outcome ? (
        <section className="card p-5 md:p-8" aria-live="polite">
          <p className="text-sm font-bold">Pergunta {cursor + 1} de {payload?.questions.length}. Vale {question.points} pontos.</p>
          {question.imageUrl ? <img src={question.imageUrl} alt="" className="mt-4 max-h-56 w-full rounded-2xl object-cover" /> : null}
          <h2 className="mt-4 text-2xl font-extrabold md:text-3xl">{question.prompt}</h2>
          <div className="mt-5 grid gap-3">
            {question.alternatives.map((alternative, option) => {
              const picked = selected === alternative.id;
              const show = Boolean(feedback);
              const isCorrect = feedback?.correctAlternativeId === alternative.id;
              return (
                <motion.button
                  key={alternative.id}
                  type="button"
                  className="min-h-14 rounded-2xl border-2 bg-white px-4 py-3 text-left text-lg font-bold"
                  disabled={Boolean(feedback)}
                  onClick={() => void choose(alternative.id)}
                  animate={show && picked && !feedback?.correct ? { x: [0, -8, 8, -4, 0] } : show && isCorrect ? { scale: [1, 1.03, 1] } : {}}
                  style={{
                    borderColor: show && isCorrect ? '#1f7a4d' : show && picked ? '#a33b24' : 'transparent',
                  }}
                >
                  <span className="mr-2">{option + 1}.</span>
                  {alternative.label}
                  {show && isCorrect ? <span className="ml-2 text-sm">Correta</span> : null}
                  {show && picked && !isCorrect ? <span className="ml-2 text-sm">Sua escolha</span> : null}
                </motion.button>
              );
            })}
          </div>
          {feedback ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-extrabold">{feedback.message} {feedback.pointsAwarded > 0 ? `+${feedback.pointsAwarded} pontos.` : ''}</p>
              {!feedback.phaseLocked && !feedback.canRetry ? (
                <button className="btn btn-primary" type="button" onClick={nextQuestion}>Próxima</button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
