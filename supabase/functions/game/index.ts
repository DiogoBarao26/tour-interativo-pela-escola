import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class GameError extends Error {
  status: number;
  constructor(message: string, status = 200) {
    super(message);
    this.status = status;
  }
}

const startHits = new Map<string, number[]>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);

  try {
    const body = await req.json().catch(() => {
      throw new GameError('Pedido inválido.');
    });
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const result = await route(supabase, body ?? {}, ip);
    return respond(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
    console.error(error);
    return respond({ error: message }, 200);
  }
});

function respond(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function route(supabase: SupabaseClient, body: Record<string, unknown>, ip: string) {
  const action = String(body.action ?? '');
  switch (action) {
    case 'start':
      return startGame(supabase, body, ip);
    case 'state':
      return { state: await stateFor(supabase, String(body.token ?? '')) };
    case 'start-phase':
      return startPhase(supabase, String(body.token ?? ''), String(body.phase ?? ''));
    case 'answer':
      return answerQuiz(supabase, body);
    case 'puzzle-complete':
      return completePuzzle(supabase, body);
    case 'word-spawn':
      return spawnWord(supabase, body);
    case 'word-hit':
      return hitWord(supabase, body);
    case 'word-expire':
      return expireWord(supabase, body);
    case 'finish-phase':
      return finishPhase(supabase, body);
    case 'finalize':
      return finalize(supabase, String(body.token ?? ''));
    default:
      throw new GameError('Ação desconhecida.');
  }
}

async function startGame(supabase: SupabaseClient, body: Record<string, unknown>, ip: string) {
  if (tooManyStarts(ip)) throw new GameError('Muitas partidas foram iniciadas agora. Aguarde alguns minutos.');
  const settings = await loadSettings(supabase);
  const name = cleanText(body.name, 2, 80, 'Informe seu nome.');
  const collect = Boolean(settings.collect_class);
  const className = collect ? cleanText(body.className, 1, 40, 'Informe a turma ou identificação.') : null;
  const phases = ['quiz', 'puzzle', 'words'] as const;
  if (!phases.some((phase) => settings[`${phase}_enabled`])) {
    throw new GameError('Nenhuma fase está ativa. Avise a equipe da escola.');
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .insert({ name, class_name: className })
    .select('id')
    .single();
  if (participantError || !participant) throw new GameError('Não foi possível registrar o participante.');

  const budget = {
    quiz: Number(settings.quiz_max_score),
    puzzle: Number(settings.puzzle_score) + Number(settings.puzzle_speed_bonus),
    words: Number(settings.words_max_score),
    quizAttempts: Number(settings.quiz_attempts),
    puzzleAttempts: Number(settings.puzzle_attempts),
    wordsAttempts: Number(settings.words_attempts),
    threshold: Number(settings.approval_threshold),
    successTitle: settings.success_title,
    successDetail: settings.success_detail,
    encourageTitle: settings.encourage_title,
    encourageDetail: settings.encourage_detail,
  };

  const { error: sessionError } = await supabase.from('sessions').insert({
    participant_id: participant.id,
    token_hash: tokenHash,
    quiz_status: settings.quiz_enabled ? 'pending' : 'locked',
    puzzle_status: settings.puzzle_enabled ? 'pending' : 'locked',
    words_status: settings.words_enabled ? 'pending' : 'locked',
    budget,
  });
  if (sessionError) throw new GameError('Não foi possível abrir a partida.');
  return { token, state: await stateFor(supabase, token) };
}

async function startPhase(supabase: SupabaseClient, token: string, phase: string) {
  if (!['quiz', 'puzzle', 'words'].includes(phase)) throw new GameError('Fase inválida.');
  const session = await requireSession(supabase, token);
  const settings = await loadSettings(supabase);
  if (session.status === 'finished') throw new GameError('Este tour já foi encerrado.');
  const open = nextOpen(session);
  if (open !== phase) throw new GameError('Esta fase ainda não está liberada.');

  const active = await activeAttempt(supabase, session.id, phase);
  if (active) return enrichPhase(supabase, phasePayload(active, session), active);

  const used = Number(session[`${phase}_attempts_used`]);
  const max = Number(settings[`${phase}_attempts`]);
  if (used >= max) throw new GameError('As tentativas desta fase acabaram.');

  const secret = await buildSecret(supabase, settings, phase);
  const attemptNumber = used + 1;
  const { data: attempt, error } = await supabase
    .from('attempts')
    .insert({
      session_id: session.id,
      phase,
      attempt_number: attemptNumber,
      secret,
      meta: { resumed: false },
    })
    .select('*')
    .single();
  if (error || !attempt) {
    const existing = await activeAttempt(supabase, session.id, phase);
    if (existing) return enrichPhase(supabase, phasePayload(existing, session), existing);
    throw new GameError('Não foi possível iniciar a fase.');
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({
      [`${phase}_status`]: 'active',
      [`${phase}_attempts_used`]: attemptNumber,
    })
    .eq('id', session.id);
  if (updateError) throw new GameError('Não foi possível reservar a tentativa.');

  const fresh = await requireSession(supabase, token);
  return enrichPhase(supabase, phasePayload(attempt, fresh), attempt);
}

async function answerQuiz(supabase: SupabaseClient, body: Record<string, unknown>) {
  const token = String(body.token ?? '');
  const attempt = await requireAttempt(supabase, token, String(body.attemptId ?? ''), 'quiz');
  if (attempt.status !== 'active') throw new GameError('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as QuizSecret;
  const questionId = String(body.questionId ?? '');
  const question = secret.questions.find((item) => item.id === questionId);
  if (!question) throw new GameError('Pergunta inválida.');

  const { data: existing } = await supabase
    .from('quiz_answers')
    .select('*')
    .eq('attempt_id', attempt.id)
    .eq('question_id', questionId)
    .maybeSingle();
  if (existing) {
    return {
      correct: existing.is_correct,
      pointsAwarded: existing.points,
      attemptScore: attempt.score,
      errors: attempt.errors,
      correctAlternativeId: question.correctAlternativeId,
      phaseLocked: false,
      canRetry: false,
      duplicate: true,
      message: 'Esta pergunta já foi respondida.',
    };
  }

  const totalElapsed = Date.now() - new Date(attempt.started_at).getTime();
  if (totalElapsed > secret.timeLimitSec * 1000 + 4000) {
    throw new GameError('O tempo do quiz acabou.');
  }

  const timeout = Boolean(body.timeout);
  const selected = body.alternativeId ? String(body.alternativeId) : null;
  if (!timeout && (!selected || !question.alternatives.some((item) => item.id === selected))) {
    throw new GameError('Escolha uma alternativa.');
  }

  const correct = !timeout && selected === question.correctAlternativeId;
  const points = correct ? Math.min(question.points, remainingQuizPoints(attempt.score, secret.maxScore)) : 0;
  const { error: insertError } = await supabase.from('quiz_answers').insert({
    attempt_id: attempt.id,
    question_id: questionId,
    alternative_id: selected,
    is_correct: correct,
    points,
  });
  if (insertError) {
    if (insertError.code === '23505') throw new GameError('Esta pergunta já foi respondida.');
    throw new GameError('Não foi possível registrar a resposta.');
  }

  const score = attempt.score + points;
  const errors = attempt.errors + (correct ? 0 : 1);
  await supabase.from('attempts').update({ score, errors }).eq('id', attempt.id);

  const { count } = await supabase
    .from('quiz_answers')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attempt.id);
  const finished = (count ?? 0) >= secret.questions.length;
  let phaseLocked = false;
  let canRetry = false;
  let message = correct ? 'Resposta correta.' : timeout ? 'O tempo da pergunta acabou.' : 'Resposta incorreta.';
  if (finished) {
    const session = await requireSession(supabase, token);
    const outcome = await closeAttempt(supabase, session, { ...attempt, score, errors }, true);
    phaseLocked = outcome.phaseLocked;
    canRetry = outcome.canRetry;
    message = outcome.message;
  }

  return {
    correct,
    pointsAwarded: points,
    attemptScore: score,
    errors,
    correctAlternativeId: question.correctAlternativeId,
    phaseLocked,
    canRetry,
    message,
  };
}

async function completePuzzle(supabase: SupabaseClient, body: Record<string, unknown>) {
  const token = String(body.token ?? '');
  const attempt = await requireAttempt(supabase, token, String(body.attemptId ?? ''), 'puzzle');
  if (attempt.status !== 'active') throw new GameError('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as PuzzleSecret;
  const arrangement = Array.isArray(body.arrangement) ? body.arrangement.map((value) => Number(value)) : [];
  const size = secret.rows * secret.rows;
  if (!isPermutation(arrangement, size)) throw new GameError('O quebra-cabeça enviado é inválido.');

  const elapsed = Date.now() - new Date(attempt.started_at).getTime();
  const limited = Math.min(elapsed, secret.timeLimitSec * 1000);
  const correctPieces = arrangement.filter((value, index) => value === index).length;
  const solved = correctPieces === size;
  if (!solved && elapsed + 1500 < secret.timeLimitSec * 1000) {
    throw new GameError('O quebra-cabeça ainda está em andamento.');
  }
  const score = puzzleScore({
    correctPieces,
    totalPieces: size,
    elapsedMs: limited,
    timeLimitSec: secret.timeLimitSec,
    baseScore: secret.baseScore,
    speedBonus: secret.speedBonus,
  });
  const session = await requireSession(supabase, token);
  const outcome = await closeAttempt(supabase, session, { ...attempt, score, errors: solved ? attempt.errors : attempt.errors + (solved ? 0 : 1) }, solved);
  return {
    solved,
    correctPieces,
    totalPieces: size,
    score,
    timeMs: limited,
    phaseLocked: outcome.phaseLocked,
    canRetry: outcome.canRetry,
    message: outcome.message,
  };
}

async function spawnWord(supabase: SupabaseClient, body: Record<string, unknown>) {
  const attempt = await requireAttempt(supabase, String(body.token ?? ''), String(body.attemptId ?? ''), 'words');
  if (attempt.status !== 'active') throw new GameError('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as WordsSecret;
  const elapsed = Date.now() - new Date(attempt.started_at).getTime();
  if (elapsed > secret.timeLimitSec * 1000 + 1500) throw new GameError('O tempo da nuvem acabou.');

  const { count } = await supabase
    .from('word_instances')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attempt.id)
    .is('resolved_at', null);
  if ((count ?? 0) >= secret.maxSimultaneous) throw new GameError('A tela já está cheia de palavras.');

  const { data: latest } = await supabase
    .from('word_instances')
    .select('spawned_at')
    .eq('attempt_id', attempt.id)
    .order('spawned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && Date.now() - new Date(latest.spawned_at).getTime() < secret.spawnIntervalMs - 200) {
    throw new GameError('Aguarde a próxima palavra.');
  }

  const pool = secret.words;
  if (pool.length === 0) throw new GameError('Não há palavras publicadas.');
  const word = pool[Math.floor(Math.random() * pool.length)]!;
  const style = Math.floor(Math.random() * 6);
  const { data, error } = await supabase
    .from('word_instances')
    .insert({ attempt_id: attempt.id, word_id: word.id, style })
    .select('id')
    .single();
  if (error || !data) throw new GameError('Não foi possível soltar a palavra.');
  return { instanceId: data.id, text: word.label, style };
}

async function hitWord(supabase: SupabaseClient, body: Record<string, unknown>) {
  const attempt = await requireAttempt(supabase, String(body.token ?? ''), String(body.attemptId ?? ''), 'words');
  if (attempt.status !== 'active') throw new GameError('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as WordsSecret;
  const instanceId = String(body.instanceId ?? '');
  const { data: instance } = await supabase
    .from('word_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('attempt_id', attempt.id)
    .maybeSingle();
  if (!instance) throw new GameError('Palavra não encontrada.');
  if (instance.resolved_at) {
    return { correct: false, delta: 0, score: attempt.score, errors: attempt.errors, duplicate: true };
  }

  const word = secret.words.find((item) => item.id === instance.word_id);
  if (!word) throw new GameError('Palavra não encontrada.');
  const elapsed = Date.now() - new Date(attempt.started_at).getTime();
  if (elapsed > secret.timeLimitSec * 1000 + 2000) throw new GameError('O tempo da nuvem acabou.');

  const raw = word.isCorrect ? word.points : -secret.penalty;
  const next = clamp(attempt.score + raw, 0, secret.maxScore);
  const delta = next - attempt.score;
  const errors = attempt.errors + (word.isCorrect ? 0 : 1);
  const { data: updated } = await supabase
    .from('word_instances')
    .update({ resolved_at: new Date().toISOString(), outcome: 'hit', delta })
    .eq('id', instanceId)
    .is('resolved_at', null)
    .select('id');
  if (!updated?.length) {
    return { correct: word.isCorrect, delta: 0, score: attempt.score, errors: attempt.errors, duplicate: true };
  }
  await supabase.from('attempts').update({ score: next, errors }).eq('id', attempt.id);
  return { correct: word.isCorrect, delta, score: next, errors, duplicate: false };
}

async function expireWord(supabase: SupabaseClient, body: Record<string, unknown>) {
  const attempt = await requireAttempt(supabase, String(body.token ?? ''), String(body.attemptId ?? ''), 'words');
  const instanceId = String(body.instanceId ?? '');
  await supabase
    .from('word_instances')
    .update({ resolved_at: new Date().toISOString(), outcome: 'expired', delta: 0 })
    .eq('id', instanceId)
    .eq('attempt_id', attempt.id)
    .is('resolved_at', null);
  return { ok: true };
}

async function finishPhase(supabase: SupabaseClient, body: Record<string, unknown>) {
  const token = String(body.token ?? '');
  const phase = String(body.phase ?? '');
  const attempt = await requireAttempt(supabase, token, String(body.attemptId ?? ''), phase);
  const session = await requireSession(supabase, token);
  if (attempt.status === 'finished') {
    const locked = session[`${phase}_status`] === 'locked';
    return {
      score: attempt.score,
      timeMs: attempt.time_ms,
      errors: attempt.errors,
      phaseLocked: locked,
      canRetry: !locked && canRetry(session, phase),
      message: locked ? 'Fase encerrada.' : 'Você ainda pode tentar novamente.',
    };
  }
  if (phase === 'puzzle') throw new GameError('Use a conclusão do quebra-cabeça.');
  const secret = attempt.secret as { timeLimitSec?: number };
  const elapsed = Date.now() - new Date(attempt.started_at).getTime();
  if (elapsed + 1500 < Number(secret.timeLimitSec ?? 0) * 1000) {
    throw new GameError('A fase ainda está em andamento.');
  }
  const success = phase === 'words' ? attempt.score > 0 : false;
  return closeAttempt(supabase, session, attempt, success);
}

async function finalize(supabase: SupabaseClient, token: string) {
  const session = await requireSession(supabase, token);
  if (session.status === 'finished') return { state: toState(session) };
  if (nextOpen(session)) throw new GameError('Ainda há fases pendentes.');
  await writeResult(supabase, session);
  return { state: toState(await requireSession(supabase, token)) };
}

async function closeAttempt(
  supabase: SupabaseClient,
  session: SessionRow,
  attempt: AttemptRow,
  success: boolean,
) {
  const phase = attempt.phase;
  const timeMs = Math.max(0, Date.now() - new Date(attempt.started_at).getTime());
  await supabase
    .from('attempts')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      score: attempt.score,
      time_ms: timeMs,
      errors: attempt.errors,
    })
    .eq('id', attempt.id)
    .eq('status', 'active');

  const retry = !success && canRetry(session, phase);
  if (retry) {
    await supabase.from('sessions').update({ [`${phase}_status`]: 'pending' }).eq('id', session.id);
    return {
      score: attempt.score,
      timeMs,
      errors: attempt.errors,
      phaseLocked: false,
      canRetry: true,
      message: 'O tempo acabou. Você pode tentar esta fase novamente.',
    };
  }

  const patch: Record<string, unknown> = {
    [`${phase}_status`]: 'locked',
    [`${phase}_score`]: attempt.score,
    [`${phase}_time_ms`]: timeMs,
    [`${phase}_errors`]: attempt.errors,
  };
  const nextSession = { ...session, ...snakeToPatch(session, phase, attempt.score, timeMs, attempt.errors), [`${phase}_status`]: 'locked' };
  patch.total_score = totalOf(nextSession);
  patch.total_time_ms = timeOf(nextSession);
  patch.error_count = errorsOf(nextSession);
  await supabase.from('sessions').update(patch).eq('id', session.id);

  const merged = { ...session, ...patch } as SessionRow;
  if (!nextOpen(merged)) await writeResult(supabase, merged);
  const successMessage = phase === 'words'
    ? 'Fase encerrada. Sua pontuação foi registrada.'
    : success
      ? 'Fase concluída. Sua pontuação foi registrada.'
      : 'O tempo acabou. A pontuação desta tentativa foi registrada.';
  return {
    score: attempt.score,
    timeMs,
    errors: attempt.errors,
    phaseLocked: true,
    canRetry: false,
    message: successMessage,
  };
}

function snakeToPatch(session: SessionRow, phase: string, score: number, timeMs: number, errors: number) {
  return {
    ...session,
    [`${phase}_score`]: score,
    [`${phase}_time_ms`]: timeMs,
    [`${phase}_errors`]: errors,
  };
}

async function writeResult(supabase: SupabaseClient, session: SessionRow) {
  const budget = (session.budget ?? {}) as Budget;
  const total = totalOf(session);
  const maxScore = maxOf(session, budget);
  const approved = total > Number(budget.threshold ?? 100);
  await supabase
    .from('sessions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      total_score: total,
      total_time_ms: timeOf(session),
      error_count: errorsOf(session),
      result: approved ? 'aprovado' : 'incentivo',
      result_title: approved ? budget.successTitle : budget.encourageTitle,
      result_detail: approved ? budget.successDetail : budget.encourageDetail,
    })
    .eq('id', session.id)
    .neq('status', 'finished');
}

async function stateFor(supabase: SupabaseClient, token: string) {
  return toState(await requireSession(supabase, token));
}

async function buildSecret(supabase: SupabaseClient, settings: SettingsRow, phase: string) {
  if (phase === 'quiz') {
    const { data, error } = await supabase
      .from('questions')
      .select('id, prompt, image_url, points, position, alternatives(id, label, is_correct, position)')
      .eq('active', true)
      .order('position');
    if (error) throw new GameError('Não foi possível carregar o quiz.');
    let questions = (data ?? [])
      .map((row) => {
        const alternatives = [...(row.alternatives ?? [])].sort((a, b) => a.position - b.position);
        const correct = alternatives.find((item) => item.is_correct);
        if (!correct || alternatives.length < 2) return null;
        return {
          id: row.id,
          prompt: row.prompt,
          imageUrl: row.image_url,
          points: row.points,
          correctAlternativeId: correct.id,
          alternatives: alternatives.map((item) => ({ id: item.id, label: item.label })),
        };
      })
      .filter((item): item is QuizQuestionSecret => Boolean(item));
    if (questions.length === 0) throw new GameError('Não há perguntas ativas no quiz.');
    if (settings.quiz_random_order) questions = shuffle(questions);
    return {
      timeLimitSec: Number(settings.quiz_time_total),
      perQuestionSec: Number(settings.quiz_time_per_question),
      maxScore: Number(settings.quiz_max_score),
      questions,
    };
  }

  if (phase === 'puzzle') {
    let imageUrl = 'bundled:escola.svg';
    let title = 'Quebra-cabeça da escola';
    if (settings.puzzle_selected_id) {
      const { data } = await supabase.from('puzzles').select('*').eq('id', settings.puzzle_selected_id).maybeSingle();
      if (data) {
        title = data.title;
        imageUrl = data.image_url || imageUrl;
      }
    }
    const rows = settings.puzzle_difficulty === 'hard' ? 5 : settings.puzzle_difficulty === 'medium' ? 4 : 3;
    return {
      timeLimitSec: Number(settings.puzzle_time_total),
      rows,
      baseScore: Number(settings.puzzle_score),
      speedBonus: Number(settings.puzzle_speed_bonus),
      imageUrl,
      title,
      shuffle: shuffledOrder(rows * rows),
    };
  }

  const { data, error } = await supabase.from('words').select('id, label, is_correct, points').eq('active', true);
  if (error) throw new GameError('Não foi possível carregar as palavras.');
  const words = (data ?? []).map((word) => ({
    id: word.id,
    label: word.label,
    isCorrect: Boolean(word.is_correct),
    points: Number(word.points),
  }));
  if (words.length === 0) throw new GameError('Não há palavras ativas na nuvem.');
  return {
    timeLimitSec: Number(settings.words_time_total),
    fallSpeed: settings.words_fall_speed,
    customSpeed: Number(settings.words_custom_speed),
    spawnIntervalMs: Number(settings.words_spawn_interval_ms),
    maxSimultaneous: Number(settings.words_max_simultaneous),
    maxScore: Number(settings.words_max_score),
    penalty: Number(settings.words_penalty),
    words,
  };
}

async function enrichPhase(supabase: SupabaseClient, payload: Record<string, any>, attempt: AttemptRow) {
  if (payload.phase === 'quiz') payload.answered = await loadAnswered(supabase, attempt);
  if (payload.phase === 'words') payload.activeInstances = await activeWords(supabase, attempt);
  return payload;
}

async function activeWords(supabase: SupabaseClient, attempt: AttemptRow) {
  const secret = attempt.secret as WordsSecret;
  const { data } = await supabase
    .from('word_instances')
    .select('id, word_id, style')
    .eq('attempt_id', attempt.id)
    .is('resolved_at', null);
  return (data ?? []).map((row) => ({
    instanceId: row.id,
    text: secret.words.find((word) => word.id === row.word_id)?.label ?? 'palavra',
    style: row.style,
  }));
}

function phasePayload(attempt: AttemptRow, session: SessionRow) {
  const secret = attempt.secret as QuizSecret & PuzzleSecret & WordsSecret;
  const budget = (session.budget ?? {}) as Budget;
  const common = {
    attemptId: attempt.id,
    attemptsUsed: Number(session[`${attempt.phase}_attempts_used`]),
    attemptsMax: Number(budget[`${attempt.phase}Attempts`] ?? 1),
    startedAt: attempt.started_at,
  };
  if (attempt.phase === 'quiz') {
    return {
      phase: 'quiz',
      ...common,
      timeLimitSec: secret.timeLimitSec,
      perQuestionSec: secret.perQuestionSec,
      score: attempt.score,
      errors: attempt.errors,
      questions: secret.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        imageUrl: question.imageUrl,
        points: question.points,
        alternatives: question.alternatives,
      })),
      answered: [],
    };
  }
  if (attempt.phase === 'puzzle') {
    return {
      phase: 'puzzle',
      ...common,
      timeLimitSec: secret.timeLimitSec,
      rows: secret.rows,
      imageUrl: secret.imageUrl,
      title: secret.title,
      baseScore: secret.baseScore,
      speedBonus: secret.speedBonus,
      shuffle: secret.shuffle,
    };
  }
  return {
    phase: 'words',
    ...common,
    timeLimitSec: secret.timeLimitSec,
    fallSpeed: secret.fallSpeed,
    customSpeed: secret.customSpeed,
    spawnIntervalMs: secret.spawnIntervalMs,
    maxSimultaneous: secret.maxSimultaneous,
    maxScore: secret.maxScore,
    score: attempt.score,
    errors: attempt.errors,
    activeInstances: [],
  };
}

async function loadAnswered(supabase: SupabaseClient, attempt: AttemptRow) {
  const secret = attempt.secret as QuizSecret;
  const { data } = await supabase.from('quiz_answers').select('*').eq('attempt_id', attempt.id);
  return (data ?? []).map((row) => {
    const question = secret.questions.find((item) => item.id === row.question_id);
    return {
      questionId: row.question_id,
      correct: row.is_correct,
      points: row.points,
      correctAlternativeId: question?.correctAlternativeId ?? '',
      selectedAlternativeId: row.alternative_id,
    };
  });
}

async function activeAttempt(supabase: SupabaseClient, sessionId: string, phase: string) {
  const { data } = await supabase
    .from('attempts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('phase', phase)
    .eq('status', 'active')
    .maybeSingle();
  return data as AttemptRow | null;
}

async function requireAttempt(supabase: SupabaseClient, token: string, attemptId: string, phase: string) {
  const session = await requireSession(supabase, token);
  if (!isUuid(attemptId)) throw new GameError('Tentativa inválida.');
  const { data } = await supabase.from('attempts').select('*').eq('id', attemptId).eq('session_id', session.id).maybeSingle();
  if (!data || data.phase !== phase) throw new GameError('Tentativa não encontrada.');
  return data as AttemptRow;
}

async function requireSession(supabase: SupabaseClient, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new GameError('Sessão inválida. Comece o tour novamente.');
  const tokenHash = await sha256(token);
  const { data, error } = await supabase
    .from('sessions')
    .select('*, participants(name, class_name)')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !data) throw new GameError('Sessão não encontrada.');
  return data as SessionRow;
}

async function loadSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) throw new GameError('As configurações da escola ainda não foram publicadas.');
  return data as SettingsRow;
}

function toState(session: SessionRow) {
  const person = participantOf(session);
  const budget = (session.budget ?? {}) as Budget;
  const phases = {
    quiz: phaseSnapshot(session, 'quiz'),
    puzzle: phaseSnapshot(session, 'puzzle'),
    words: phaseSnapshot(session, 'words'),
  };
  const finished = session.status === 'finished';
  const maxScore = maxOf(session, budget);
  const totalScore = Number(session.total_score);
  return {
    sessionId: session.id,
    participantName: person.name,
    className: person.className,
    phases,
    totalScore,
    totalTimeMs: Number(session.total_time_ms),
    errorCount: Number(session.error_count),
    finished,
    result: finished
      ? {
          participantName: person.name,
          className: person.className,
          quizScore: Number(session.quiz_score),
          puzzleScore: Number(session.puzzle_score),
          wordsScore: Number(session.words_score),
          totalScore,
          maxScore,
          percent: maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100),
          totalTimeMs: Number(session.total_time_ms),
          approved: session.result === 'aprovado',
          title: session.result_title ?? '',
          detail: session.result_detail ?? '',
          finishedAt: session.finished_at,
        }
      : null,
  };
}

function phaseSnapshot(session: SessionRow, phase: 'quiz' | 'puzzle' | 'words') {
  const budget = (session.budget ?? {}) as Budget;
  const skipped = isSkipped(session, phase);
  return {
    enabled: !skipped,
    status: skipped ? 'locked' : session[`${phase}_status`],
    score: Number(session[`${phase}_score`]),
    timeMs: Number(session[`${phase}_time_ms`]),
    errors: Number(session[`${phase}_errors`]),
    attemptsUsed: Number(session[`${phase}_attempts_used`]),
    attemptsMax: Number(budget[`${phase}Attempts`] ?? 1),
  };
}

function nextOpen(session: SessionRow) {
  for (const phase of ['quiz', 'puzzle', 'words'] as const) {
    if (isSkipped(session, phase)) continue;
    if (session[`${phase}_status`] !== 'locked') return phase;
  }
  return null;
}

function isSkipped(session: SessionRow, phase: string) {
  return session[`${phase}_status`] === 'locked'
    && Number(session[`${phase}_attempts_used`]) === 0
    && Number(session[`${phase}_time_ms`]) === 0
    && Number(session[`${phase}_score`]) === 0;
}

function canRetry(session: SessionRow, phase: string) {
  const max = Number((session.budget as Budget | undefined)?.[`${phase}Attempts`] ?? 1);
  return Number(session[`${phase}_attempts_used`]) < max;
}

function totalOf(session: SessionRow) {
  return ['quiz', 'puzzle', 'words'].reduce((sum, phase) => {
    if (isSkipped(session, phase)) return sum;
    return sum + Number(session[`${phase}_score`] ?? 0);
  }, 0);
}

function timeOf(session: SessionRow) {
  return Number(session.quiz_time_ms) + Number(session.puzzle_time_ms) + Number(session.words_time_ms);
}

function errorsOf(session: SessionRow) {
  return Number(session.quiz_errors) + Number(session.puzzle_errors) + Number(session.words_errors);
}

function maxOf(session: SessionRow, budget: Budget) {
  let total = 0;
  if (!isSkipped(session, 'quiz')) total += Number(budget.quiz ?? 0);
  if (!isSkipped(session, 'puzzle')) total += Number(budget.puzzle ?? 0);
  if (!isSkipped(session, 'words')) total += Number(budget.words ?? 0);
  return total;
}

function participantOf(session: SessionRow) {
  const value = session.participants as { name?: string; class_name?: string | null } | { name?: string; class_name?: string | null }[] | null;
  const row = Array.isArray(value) ? value[0] : value;
  return { name: row?.name ?? 'Participante', className: row?.class_name ?? null };
}

function remainingQuizPoints(score: number, maxScore: number) {
  return Math.max(0, maxScore - score);
}

function puzzleScore(input: {
  correctPieces: number;
  totalPieces: number;
  elapsedMs: number;
  timeLimitSec: number;
  baseScore: number;
  speedBonus: number;
}) {
  const ratio = input.totalPieces === 0 ? 0 : input.correctPieces / input.totalPieces;
  const base = Math.round(ratio * input.baseScore);
  if (input.correctPieces !== input.totalPieces) return base;
  const limit = input.timeLimitSec * 1000;
  const ratioTime = limit <= 0 ? 1 : input.elapsedMs / limit;
  const bonus = ratioTime <= 0.5 ? input.speedBonus : ratioTime <= 0.75 ? Math.round(input.speedBonus / 2) : 0;
  return Math.min(input.baseScore + input.speedBonus, base + bonus);
}

function isPermutation(values: number[], size: number) {
  if (values.length !== size) return false;
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value >= size || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

function shuffledOrder(length: number) {
  const values = Array.from({ length }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = values[index]!;
    values[index] = values[swap]!;
    values[swap] = current;
  }
  if (values.every((value, index) => value === index) && values.length > 1) {
    const first = values[0]!;
    values[0] = values[1]!;
    values[1] = first;
  }
  return values;
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(value: unknown, min: number, max: number, message: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new GameError(message);
  if (/[\u0000-\u001F]/.test(text)) throw new GameError(message);
  return text;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(data)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function tooManyStarts(ip: string) {
  const now = Date.now();
  const recent = (startHits.get(ip) ?? []).filter((stamp) => now - stamp < 60 * 60 * 1000);
  if (recent.length >= 40) return true;
  recent.push(now);
  startHits.set(ip, recent);
  return false;
}

type SettingsRow = Record<string, any>;
type SessionRow = Record<string, any>;
type AttemptRow = Record<string, any>;
type Budget = Record<string, any>;
type QuizQuestionSecret = {
  id: string;
  prompt: string;
  imageUrl: string | null;
  points: number;
  correctAlternativeId: string;
  alternatives: { id: string; label: string }[];
};
type QuizSecret = { timeLimitSec: number; perQuestionSec: number; maxScore: number; questions: QuizQuestionSecret[] };
type PuzzleSecret = {
  timeLimitSec: number;
  rows: number;
  baseScore: number;
  speedBonus: number;
  imageUrl: string;
  title: string;
  shuffle: number[];
};
type WordsSecret = {
  timeLimitSec: number;
  fallSpeed: string;
  customSpeed: number;
  spawnIntervalMs: number;
  maxSimultaneous: number;
  maxScore: number;
  penalty: number;
  words: { id: string; label: string; isCorrect: boolean; points: number }[];
};
