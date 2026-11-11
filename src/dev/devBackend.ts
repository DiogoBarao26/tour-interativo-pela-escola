import { defaultAudio, defaultHomeConfig, defaultRules, defaultTheme } from '../domain/defaults';
import type {
  AudioSettings,
  FinalResult,
  HomeConfig,
  PhaseKey,
  PhaseStatus,
  PuzzleAdmin,
  QuestionAdmin,
  RulesSettings,
  SessionState,
  ThemeSettings,
  WordAdmin,
} from '../domain/types';
import {
  clamp,
  countCorrectPieces,
  gridSize,
  isPermutation,
  isApproved,
  puzzleScoreFor,
  shuffleNumbers,
} from '../domain/rules';
import type { AdminContent, DashboardData } from '../services/adminApi';
import { activeGame, GAMES, playGameId } from '../admin/teamPassword';

const STORAGE_KEY = 'tour.local.db.v3';

interface Budget {
  quiz: number;
  puzzle: number;
  words: number;
  quizAttempts: number;
  puzzleAttempts: number;
  wordsAttempts: number;
  threshold: number;
  successTitle: string;
  successDetail: string;
  encourageTitle: string;
  encourageDetail: string;
}

interface Attempt {
  id: string;
  phase: PhaseKey;
  number: number;
  status: 'active' | 'finished';
  startedAt: number;
  score: number;
  errors: number;
  timeMs: number;
  secret: Record<string, unknown>;
  answers: { questionId: string; alternativeId: string | null; correct: boolean; points: number }[];
  instances: { id: string; wordId: string; style: number; resolved: boolean; spawnedAt: number }[];
}

interface Session {
  id: string;
  token: string;
  name: string;
  className: string | null;
  status: 'active' | 'finished';
  createdAt: string;
  finishedAt: string | null;
  phases: Record<PhaseKey, { status: PhaseStatus; score: number; timeMs: number; errors: number; attemptsUsed: number }>;
  budget: Budget;
  attempts: Attempt[];
  totalScore: number;
  totalTimeMs: number;
  errorCount: number;
  result: FinalResult | null;
}

interface Db {
  theme: ThemeSettings;
  rules: RulesSettings;
  audio: AudioSettings;
  questions: QuestionAdmin[];
  puzzles: PuzzleAdmin[];
  words: WordAdmin[];
  sessions: Session[];
}

interface Store {
  games: Record<string, Db>;
}

function seed(): Db {
  const rules = defaultRules();
  const puzzleId = crypto.randomUUID();
  rules.puzzleSelectedId = puzzleId;
  const q1 = crypto.randomUUID();
  const q2 = crypto.randomUUID();
  const q3 = crypto.randomUUID();
  const q4 = crypto.randomUUID();
  const q5 = crypto.randomUUID();
  const alt = (label: string, isCorrect: boolean, position: number) => ({
    id: crypto.randomUUID(),
    label,
    isCorrect,
    position,
  });
  return {
    theme: defaultTheme(),
    rules,
    audio: defaultAudio(),
    puzzles: [
      {
        id: puzzleId,
        title: 'Fachada da Escola Horizonte',
        imageUrl: '',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
    questions: [
      question(q1, 'Em que ano a Escola Horizonte foi fundada?', 1, ['1982', '1998', '2005', '2010'], 1),
      question(q2, 'Qual é o lema da Escola Horizonte?', 2, ['Vencer a qualquer custo', 'Aprender juntos', 'Estudar só na véspera', 'Cada um por si'], 1),
      question(q3, 'Onde acontecem os experimentos de ciências?', 3, ['Na biblioteca', 'Na quadra', 'No laboratório', 'No refeitório'], 2),
      question(q4, 'Quais etapas de ensino a escola oferece nesta demonstração?', 4, ['Somente o Ensino Médio', 'Educação Infantil, Fundamental e Médio', 'Apenas cursos livres', 'Somente a Educação Infantil'], 1),
      question(q5, 'Qual projeto semanal convida as famílias para a escola?', 5, ['Família na escola', 'Noite silenciosa', 'Prova relâmpago', 'Recreio eterno'], 0),
    ].map((item, index) => ({ ...item, position: index + 1 })),
    words: [
      word('respeito', true, 7),
      word('colaboração', true, 7),
      word('biblioteca', true, 7),
      word('ciências', true, 7),
      word('inclusão', true, 6),
      word('sustentabilidade', true, 6),
      word('pressa', false, 0),
      word('bagunça', false, 0),
      word('exclusão', false, 0),
      word('sujeira', false, 0),
    ],
    sessions: [],
  };

  function question(id: string, prompt: string, position: number, labels: string[], correctIndex: number): QuestionAdmin {
    return {
      id,
      prompt,
      imageUrl: null,
      points: 10,
      position,
      active: true,
      alternatives: labels.map((label, index) => alt(label, index === correctIndex, index + 1)),
    };
  }
  function word(label: string, isCorrect: boolean, points: number): WordAdmin {
    return { id: crypto.randomUUID(), label, isCorrect, points, active: true };
  }
}

function loadStore(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as Store) : { games: {} };
  if (!parsed.games) parsed.games = {};
  let changed = !raw;
  for (const game of GAMES) {
    if (!parsed.games[game.id]) {
      parsed.games[game.id] = seed();
      changed = true;
    }
  }
  for (const game of GAMES) slim(parsed.games[game.id]);
  if (changed) saveStore(parsed);
  return parsed;
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error('Não coube neste aparelho. Use uma foto menor e tente de novo.');
  }
}

function slim(db: Db | undefined) {
  if (!db) return;
  for (const session of db.sessions ?? []) {
    for (const attempt of session.attempts ?? []) {
      const secret = attempt.secret as { imageUrl?: string; questions?: { imageUrl?: string | null }[] };
      if (typeof secret?.imageUrl === 'string' && secret.imageUrl.startsWith('data:')) secret.imageUrl = 'bundled:escola.svg';
      if (!Array.isArray(secret?.questions)) continue;
      for (const question of secret.questions) {
        if (typeof question.imageUrl === 'string' && question.imageUrl.startsWith('data:')) question.imageUrl = null;
      }
    }
  }
}

function adminSlotId() {
  return activeGame()?.id ?? GAMES[0].id;
}

function load(): Db {
  return loadStore().games[adminSlotId()];
}

function save(db: Db) {
  const store = loadStore();
  store.games[adminSlotId()] = db;
  saveStore(store);
}

function viewingId() {
  const onAdmin = typeof location !== 'undefined' && location.pathname.includes('/admin');
  if (onAdmin) return activeGame()?.id ?? null;
  return playGameId();
}

export function listGames() {
  const store = loadStore();
  return GAMES.map((game) => ({
    id: game.id,
    name: game.name,
    schoolName: store.games[game.id].theme.schoolName,
    gameTitle: store.games[game.id].theme.gameTitle,
  }));
}

export function readHomeConfig(): HomeConfig {
  const id = viewingId();
  const db = id ? loadStore().games[id] : null;
  if (!db) return { ...defaultHomeConfig('local'), configured: true, mode: 'local' };
  const selected = db.puzzles.find((item) => item.id === db.rules.puzzleSelectedId);
  return {
    ...defaultHomeConfig('local'),
    configured: true,
    mode: 'local',
    theme: db.theme,
    rules: {
      ...db.rules,
      puzzleTitle: selected?.title ?? db.rules.puzzleTitle,
      puzzleImageUrl: selected?.imageUrl || null,
    },
    audio: db.audio,
  };
}

export const admin = {
  loadContent(): AdminContent {
    const db = load();
    return {
      theme: db.theme,
      rules: db.rules,
      audio: db.audio,
      questions: [...db.questions].sort((a, b) => a.position - b.position),
      puzzles: db.puzzles,
      words: db.words,
    };
  },
  saveTheme(theme: ThemeSettings) {
    const db = load();
    db.theme = theme;
    save(db);
  },
  saveRules(rules: RulesSettings) {
    const db = load();
    db.rules = rules;
    save(db);
  },
  saveAudio(audio: AudioSettings) {
    const db = load();
    db.audio = audio;
    save(db);
  },
  saveQuestion(question: QuestionAdmin) {
    const db = load();
    const index = db.questions.findIndex((item) => item.id === question.id);
    if (index >= 0) db.questions[index] = question;
    else db.questions.push(question);
    save(db);
  },
  deleteQuestion(id: string) {
    const db = load();
    db.questions = db.questions.filter((item) => item.id !== id);
    save(db);
  },
  reorderQuestions(ids: string[]) {
    const db = load();
    ids.forEach((id, index) => {
      const question = db.questions.find((item) => item.id === id);
      if (question) question.position = index + 1;
    });
    save(db);
  },
  savePuzzle(puzzle: PuzzleAdmin) {
    const db = load();
    const index = db.puzzles.findIndex((item) => item.id === puzzle.id);
    if (index >= 0) db.puzzles[index] = puzzle;
    else db.puzzles.push(puzzle);
    save(db);
  },
  deletePuzzle(id: string) {
    const db = load();
    db.puzzles = db.puzzles.filter((item) => item.id !== id);
    if (db.rules.puzzleSelectedId === id) db.rules.puzzleSelectedId = db.puzzles[0]?.id ?? null;
    save(db);
  },
  saveWord(word: WordAdmin) {
    const db = load();
    const index = db.words.findIndex((item) => item.id === word.id);
    if (index >= 0) db.words[index] = word;
    else db.words.push(word);
    save(db);
  },
  deleteWord(id: string) {
    const db = load();
    db.words = db.words.filter((item) => item.id !== id);
    save(db);
  },
  loadDashboard(): DashboardData {
    const db = load();
    const rows = db.sessions
      .slice()
      .reverse()
      .map((session) => ({
        id: session.id,
        name: session.name,
        className: session.className || '—',
        date: new Date(session.createdAt).toLocaleDateString('pt-BR'),
        time: new Date(session.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        quizScore: session.phases.quiz.score,
        puzzleScore: session.phases.puzzle.score,
        wordsScore: session.phases.words.score,
        totalScore: session.totalScore,
        totalTimeMs: session.totalTimeMs,
        result: session.status === 'finished' ? (session.result?.approved ? 'Aprovado' : 'Incentivo') : 'Em andamento',
        finished: session.status === 'finished',
        quizAttempts: session.phases.quiz.attemptsUsed,
        puzzleAttempts: session.phases.puzzle.attemptsUsed,
        wordsAttempts: session.phases.words.attemptsUsed,
        errors: session.errorCount,
        createdAt: session.createdAt,
      }));
    const phaseErrors = (['quiz', 'puzzle', 'words'] as const).map((phase) => ({
      phase,
      errors: db.sessions.reduce((sum, session) => sum + session.attempts.filter((item) => item.phase === phase).reduce((inner, item) => inner + item.errors, 0), 0),
    }));
    return { rows, phaseErrors };
  },
};

let chain = Promise.resolve();

export function handle(action: string, body: Record<string, unknown>) {
  const job = chain.then(() => {
    const store = loadStore();
    const id = action === 'start' ? String(body.slotId ?? '') : slotByToken(store, String(body.token ?? ''));
    const db = store.games[id];
    if (!db) throw new Error(action === 'start' ? 'Escolha um jogo para começar.' : 'Esta partida não foi encontrada. Volte ao início.');
    const result = run(db, action, body);
    store.games[id] = db;
    saveStore(store);
    return result;
  });
  chain = job.then(() => undefined, () => undefined);
  return job;
}

function slotByToken(store: Store, token: string) {
  if (!token) return '';
  return GAMES.find((game) => store.games[game.id]?.sessions.some((session) => session.token === token))?.id ?? '';
}

function run(db: Db, action: string, body: Record<string, unknown>) {
  switch (action) {
    case 'start':
      return start(db, body);
    case 'state':
      return { state: toState(sessionByToken(db, String(body.token ?? ''))) };
    case 'start-phase':
      return startPhase(db, String(body.token ?? ''), String(body.phase ?? '') as PhaseKey);
    case 'answer':
      return answer(db, body);
    case 'puzzle-complete':
      return completePuzzle(db, body);
    case 'word-spawn':
      return spawn(db, body);
    case 'word-hit':
      return hit(db, body);
    case 'word-expire':
      return expire(db, body);
    case 'finish-phase':
      return finish(db, body);
    case 'finalize':
      return { state: finalize(sessionByToken(db, String(body.token ?? ''))) };
    default:
      throw new Error('Ação desconhecida.');
  }
}

function start(db: Db, body: Record<string, unknown>) {
  const name = clean(body.name, 2, 80, 'Informe seu nome.');
  const className = db.theme.collectClass ? clean(body.className, 1, 40, 'Informe a turma ou identificação.') : null;
  const enabled = (['quiz', 'puzzle', 'words'] as const).filter((phase) => db.rules[`${phase}Enabled`]);
  if (enabled.length === 0) throw new Error('Nenhuma fase está ativa. Avise a equipe da escola.');
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const session: Session = {
    id: crypto.randomUUID(),
    token,
    name,
    className,
    status: 'active',
    createdAt: new Date().toISOString(),
    finishedAt: null,
    phases: {
      quiz: blankPhase(db.rules.quizEnabled),
      puzzle: blankPhase(db.rules.puzzleEnabled),
      words: blankPhase(db.rules.wordsEnabled),
    },
    budget: {
      quiz: db.rules.quizMaxScore,
      puzzle: db.rules.puzzleScore + db.rules.puzzleSpeedBonus,
      words: db.rules.wordsMaxScore,
      quizAttempts: db.rules.quizAttempts,
      puzzleAttempts: db.rules.puzzleAttempts,
      wordsAttempts: db.rules.wordsAttempts,
      threshold: db.rules.approvalThreshold,
      successTitle: db.theme.successTitle,
      successDetail: db.theme.successDetail,
      encourageTitle: db.theme.encourageTitle,
      encourageDetail: db.theme.encourageDetail,
    },
    attempts: [],
    totalScore: 0,
    totalTimeMs: 0,
    errorCount: 0,
    result: null,
  };
  db.sessions.push(session);
  return { token, state: toState(session) };
}

function startPhase(db: Db, token: string, phase: PhaseKey) {
  const session = sessionByToken(db, token);
  if (session.status === 'finished') throw new Error('Este tour já foi encerrado.');
  if (!['quiz', 'puzzle', 'words'].includes(phase)) throw new Error('Fase inválida.');
  if (nextOpen(session) !== phase) throw new Error('Esta fase ainda não está liberada.');
  const active = session.attempts.find((item) => item.phase === phase && item.status === 'active');
  if (active) {
    if (phase === 'quiz') syncQuiz(db, active);
    if (phase === 'words') {
      const fresh = secretFor(db, 'words') as WordsSecret;
      const previous = active.secret as WordsSecret;
      active.secret = { ...previous, words: fresh.words, maxScore: fresh.maxScore, penalty: fresh.penalty };
      const ids = new Set(fresh.words.map((word) => word.id));
      active.instances = active.instances.filter((item) => ids.has(item.wordId));
    }
    return payload(db, session, active);
  }
  const used = session.phases[phase].attemptsUsed;
  const max = session.budget[`${phase}Attempts`];
  if (used >= max) throw new Error('As tentativas desta fase acabaram.');
  const attempt: Attempt = {
    id: crypto.randomUUID(),
    phase,
    number: used + 1,
    status: 'active',
    startedAt: Date.now(),
    score: 0,
    errors: 0,
    timeMs: 0,
    secret: secretFor(db, phase),
    answers: [],
    instances: [],
  };
  session.attempts.push(attempt);
  session.phases[phase].status = 'active';
  session.phases[phase].attemptsUsed = used + 1;
  return payload(db, session, attempt);
}

function answer(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const attempt = attemptOf(session, String(body.attemptId ?? ''), 'quiz');
  if (attempt.status !== 'active') throw new Error('Esta tentativa já foi encerrada.');
  syncQuiz(db, attempt);
  const secret = attempt.secret as QuizSecret;
  const question = secret.questions.find((item) => item.id === String(body.questionId ?? ''));
  if (!question) throw new Error('Pergunta inválida.');
  const existing = attempt.answers.find((item) => item.questionId === question.id);
  if (existing) {
    return {
      correct: existing.correct,
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
  if (Date.now() - attempt.startedAt > secret.timeLimitSec * 1000 + 4000) throw new Error('O tempo do quiz acabou.');
  const timeout = Boolean(body.timeout);
  const selected = body.alternativeId ? String(body.alternativeId) : null;
  if (!timeout && (!selected || !question.alternatives.some((item) => item.id === selected))) throw new Error('Escolha uma alternativa.');
  const correct = !timeout && selected === question.correctAlternativeId;
  const room = Math.max(0, secret.maxScore - attempt.score);
  const points = correct ? Math.min(question.points, room) : 0;
  attempt.answers.push({ questionId: question.id, alternativeId: selected, correct, points });
  attempt.score += points;
  if (!correct) attempt.errors += 1;
  let phaseLocked = false;
  let canRetry = false;
  let message = correct ? 'Resposta correta.' : timeout ? 'O tempo da pergunta acabou.' : 'Resposta incorreta.';
  if (attempt.answers.length >= secret.questions.length) {
    const outcome = close(session, attempt, true);
    phaseLocked = outcome.phaseLocked;
    canRetry = outcome.canRetry;
    message = outcome.message;
  }
  return {
    correct,
    pointsAwarded: points,
    attemptScore: attempt.score,
    errors: attempt.errors,
    correctAlternativeId: question.correctAlternativeId,
    phaseLocked,
    canRetry,
    message,
  };
}

function completePuzzle(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const attempt = attemptOf(session, String(body.attemptId ?? ''), 'puzzle');
  if (attempt.status !== 'active') throw new Error('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as PuzzleSecret;
  const arrangement = Array.isArray(body.arrangement) ? body.arrangement.map(Number) : [];
  const size = secret.rows * secret.rows;
  if (!isPermutation(arrangement, size)) throw new Error('O quebra-cabeça enviado é inválido.');
  const elapsed = Date.now() - attempt.startedAt;
  const correctPieces = countCorrectPieces(arrangement);
  const solved = correctPieces === size;
  if (!solved && elapsed + 1500 < secret.timeLimitSec * 1000) throw new Error('O quebra-cabeça ainda está em andamento.');
  const limited = Math.min(elapsed, secret.timeLimitSec * 1000);
  attempt.score = puzzleScoreFor({
    correctPieces,
    totalPieces: size,
    elapsedMs: limited,
    timeLimitSec: secret.timeLimitSec,
    baseScore: secret.baseScore,
    speedBonus: secret.speedBonus,
  });
  if (!solved) attempt.errors += 1;
  const outcome = close(session, attempt, solved);
  return {
    solved,
    correctPieces,
    totalPieces: size,
    score: attempt.score,
    timeMs: limited,
    phaseLocked: outcome.phaseLocked,
    canRetry: outcome.canRetry,
    message: outcome.message,
  };
}

function spawn(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const attempt = attemptOf(session, String(body.attemptId ?? ''), 'words');
  if (attempt.status !== 'active') throw new Error('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as WordsSecret;
  if (Date.now() - attempt.startedAt > secret.timeLimitSec * 1000 + 1500) throw new Error('O tempo da nuvem acabou.');
  const open = attempt.instances.filter((item) => !item.resolved);
  if (open.length >= secret.maxSimultaneous) throw new Error('A tela já está cheia de palavras.');
  const latest = attempt.instances[attempt.instances.length - 1];
  if (latest && Date.now() - latest.spawnedAt < secret.spawnIntervalMs - 200) throw new Error('Aguarde a próxima palavra.');
  const word = secret.words[Math.floor(Math.random() * secret.words.length)];
  if (!word) throw new Error('Não há palavras publicadas.');
  const instance = { id: crypto.randomUUID(), wordId: word.id, style: Math.floor(Math.random() * 6), resolved: false, spawnedAt: Date.now() };
  attempt.instances.push(instance);
  return { instanceId: instance.id, text: word.label, style: instance.style };
}

function hit(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const attempt = attemptOf(session, String(body.attemptId ?? ''), 'words');
  if (attempt.status !== 'active') throw new Error('Esta tentativa já foi encerrada.');
  const secret = attempt.secret as WordsSecret;
  const instance = attempt.instances.find((item) => item.id === String(body.instanceId ?? ''));
  if (!instance) throw new Error('Palavra não encontrada.');
  if (instance.resolved) return { correct: false, delta: 0, score: attempt.score, errors: attempt.errors, duplicate: true };
  if (Date.now() - attempt.startedAt > secret.timeLimitSec * 1000 + 2000) throw new Error('O tempo da nuvem acabou.');
  const word = secret.words.find((item) => item.id === instance.wordId);
  if (!word) throw new Error('Palavra não encontrada.');
  const raw = word.isCorrect ? word.points : -secret.penalty;
  const next = clamp(attempt.score + raw, 0, secret.maxScore);
  const delta = next - attempt.score;
  instance.resolved = true;
  attempt.score = next;
  if (!word.isCorrect) attempt.errors += 1;
  return { correct: word.isCorrect, delta, score: next, errors: attempt.errors, duplicate: false };
}

function expire(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const attempt = attemptOf(session, String(body.attemptId ?? ''), 'words');
  const instance = attempt.instances.find((item) => item.id === String(body.instanceId ?? ''));
  if (instance && !instance.resolved) instance.resolved = true;
  return { ok: true };
}

function finish(db: Db, body: Record<string, unknown>) {
  const session = sessionByToken(db, String(body.token ?? ''));
  const phase = String(body.phase ?? '') as PhaseKey;
  const attempt = attemptOf(session, String(body.attemptId ?? ''), phase);
  if (attempt.status === 'finished') {
    const locked = session.phases[phase].status === 'locked';
    return { score: attempt.score, timeMs: attempt.timeMs, errors: attempt.errors, phaseLocked: locked, canRetry: !locked && canRetry(session, phase), message: locked ? 'Fase encerrada.' : 'Você ainda pode tentar novamente.' };
  }
  if (phase === 'puzzle') throw new Error('Use a conclusão do quebra-cabeça.');
  const limit = Number(attempt.secret.timeLimitSec ?? 0) * 1000;
  if (Date.now() - attempt.startedAt + 1500 < limit) throw new Error('A fase ainda está em andamento.');
  return close(session, attempt, phase === 'words' ? attempt.score > 0 : false);
}

function close(session: Session, attempt: Attempt, success: boolean) {
  attempt.status = 'finished';
  attempt.timeMs = Math.max(0, Date.now() - attempt.startedAt);
  const phase = attempt.phase;
  if (!success && canRetry(session, phase)) {
    session.phases[phase].status = 'pending';
    return { score: attempt.score, timeMs: attempt.timeMs, errors: attempt.errors, phaseLocked: false, canRetry: true, message: 'O tempo acabou. Você pode tentar esta fase novamente.' };
  }
  session.phases[phase].status = 'locked';
  session.phases[phase].score = attempt.score;
  session.phases[phase].timeMs = attempt.timeMs;
  session.phases[phase].errors = attempt.errors;
  recompute(session);
  if (!nextOpen(session)) finalize(session);
  const message = phase === 'words'
    ? 'Fase encerrada. Sua pontuação foi registrada.'
    : success
      ? 'Fase concluída. Sua pontuação foi registrada.'
      : 'O tempo acabou. A pontuação desta tentativa foi registrada.';
  return { score: attempt.score, timeMs: attempt.timeMs, errors: attempt.errors, phaseLocked: true, canRetry: false, message };
}

function finalize(session: Session): SessionState {
  if (session.status !== 'finished') {
    if (nextOpen(session)) throw new Error('Ainda há fases pendentes.');
    recompute(session);
    const maxScore = ['quiz', 'puzzle', 'words'].reduce((sum, phase) => {
      if (skipped(session, phase as PhaseKey)) return sum;
      return sum + Number(session.budget[phase as 'quiz' | 'puzzle' | 'words']);
    }, 0);
    const approved = isApproved(session.totalScore, session.budget.threshold);
    session.status = 'finished';
    session.finishedAt = new Date().toISOString();
    session.result = {
      participantName: session.name,
      className: session.className,
      quizScore: session.phases.quiz.score,
      puzzleScore: session.phases.puzzle.score,
      wordsScore: session.phases.words.score,
      totalScore: session.totalScore,
      maxScore,
      percent: maxScore === 0 ? 0 : Math.round((session.totalScore / maxScore) * 100),
      totalTimeMs: session.totalTimeMs,
      approved,
      title: approved ? session.budget.successTitle : session.budget.encourageTitle,
      detail: approved ? session.budget.successDetail : session.budget.encourageDetail,
      finishedAt: session.finishedAt,
    };
  }
  return toState(session);
}

function payload(db: Db, session: Session, attempt: Attempt) {
  const common = {
    attemptId: attempt.id,
    attemptsUsed: session.phases[attempt.phase].attemptsUsed,
    attemptsMax: session.budget[`${attempt.phase}Attempts`],
    startedAt: new Date(attempt.startedAt).toISOString(),
  };
  if (attempt.phase === 'quiz') {
    const secret = attempt.secret as QuizSecret;
    return {
      phase: 'quiz' as const,
      ...common,
      timeLimitSec: secret.timeLimitSec,
      perQuestionSec: secret.perQuestionSec,
      score: attempt.score,
      errors: attempt.errors,
      questions: secret.questions.map((question) => {
        const live = db.questions.find((item) => item.id === question.id);
        return {
          id: question.id,
          prompt: question.prompt,
          imageUrl: live?.imageUrl || question.imageUrl,
          points: question.points,
          alternatives: question.alternatives,
        };
      }),
      answered: attempt.answers.map((item) => ({
        questionId: item.questionId,
        correct: item.correct,
        points: item.points,
        correctAlternativeId: secret.questions.find((question) => question.id === item.questionId)?.correctAlternativeId ?? '',
        selectedAlternativeId: item.alternativeId,
      })),
    };
  }
  if (attempt.phase === 'puzzle') {
    const secret = attempt.secret as PuzzleSecret;
    const selected = db.puzzles.find((item) => item.id === db.rules.puzzleSelectedId) ?? db.puzzles.find((item) => item.active);
    return {
      phase: 'puzzle' as const,
      ...common,
      ...secret,
      imageUrl: selected?.imageUrl || secret.imageUrl,
      title: selected?.title || secret.title,
    };
  }
  const secret = attempt.secret as WordsSecret;
  return {
    phase: 'words' as const,
    ...common,
    timeLimitSec: secret.timeLimitSec,
    fallSpeed: secret.fallSpeed,
    customSpeed: secret.customSpeed,
    spawnIntervalMs: secret.spawnIntervalMs,
    maxSimultaneous: secret.maxSimultaneous,
    maxScore: secret.maxScore,
    score: attempt.score,
    errors: attempt.errors,
    activeInstances: attempt.instances.filter((item) => !item.resolved).map((item) => ({
      instanceId: item.id,
      text: secret.words.find((word) => word.id === item.wordId)?.label ?? 'palavra',
      style: item.style,
    })),
  };
}

function syncQuiz(db: Db, attempt: Attempt) {
  const fresh = secretFor(db, 'quiz') as QuizSecret;
  const previous = (attempt.secret ?? {}) as Partial<QuizSecret>;
  const live = new Map(fresh.questions.map((question) => [question.id, question]));
  const ordered = Array.isArray(previous.questions) ? previous.questions : [];
  const kept = ordered
    .map((question) => live.get(question.id))
    .filter((question): question is QuizSecret['questions'][number] => Boolean(question));
  const known = new Set(kept.map((question) => question.id));
  const questions = [...kept, ...fresh.questions.filter((question) => !known.has(question.id))];
  attempt.secret = {
    timeLimitSec: previous.timeLimitSec || fresh.timeLimitSec,
    perQuestionSec: previous.perQuestionSec || fresh.perQuestionSec,
    maxScore: fresh.maxScore,
    questions,
  };
  attempt.answers = (attempt.answers ?? []).filter((item) => questions.some((question) => question.id === item.questionId));
}

function secretFor(db: Db, phase: PhaseKey): Record<string, unknown> {
  if (phase === 'quiz') {
    let questions = db.questions
      .filter((item) => item.active)
      .sort((a, b) => a.position - b.position)
      .map((item) => {
        const correct = item.alternatives.find((alternative) => alternative.isCorrect);
        if (!correct || item.alternatives.length < 2) return null;
        return {
          id: item.id,
          prompt: item.prompt,
          imageUrl: item.imageUrl?.startsWith('data:') ? null : item.imageUrl,
          points: item.points,
          correctAlternativeId: correct.id,
          alternatives: item.alternatives.map((alternative) => ({ id: alternative.id, label: alternative.label })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (questions.length === 0) throw new Error('Não há perguntas ativas no quiz.');
    if (db.rules.quizRandomOrder) questions = shuffle(questions);
    return { timeLimitSec: db.rules.quizTimeTotal, perQuestionSec: db.rules.quizTimePerQuestion, maxScore: db.rules.quizMaxScore, questions };
  }
  if (phase === 'puzzle') {
    const selected = db.puzzles.find((item) => item.id === db.rules.puzzleSelectedId) ?? db.puzzles.find((item) => item.active);
    const rows = gridSize(db.rules.puzzleDifficulty);
    return {
      timeLimitSec: db.rules.puzzleTimeTotal,
      rows,
      baseScore: db.rules.puzzleScore,
      speedBonus: db.rules.puzzleSpeedBonus,
      imageUrl: selected?.imageUrl?.startsWith('data:') ? 'bundled:escola.svg' : (selected?.imageUrl || 'bundled:escola.svg'),
      title: selected?.title || 'Quebra-cabeça da escola',
      shuffle: shuffleNumbers(rows * rows),
    };
  }
  const words = db.words.filter((item) => item.active).map((item) => ({ id: item.id, label: item.label, isCorrect: item.isCorrect, points: item.points }));
  if (words.length === 0) throw new Error('Não há palavras ativas na nuvem.');
  return {
    timeLimitSec: db.rules.wordsTimeTotal,
    fallSpeed: db.rules.wordsFallSpeed,
    customSpeed: db.rules.wordsCustomSpeed,
    spawnIntervalMs: db.rules.wordsSpawnIntervalMs,
    maxSimultaneous: db.rules.wordsMaxSimultaneous,
    maxScore: db.rules.wordsMaxScore,
    penalty: db.rules.wordsPenalty,
    words,
  };
}

function toState(session: Session): SessionState {
  return {
    sessionId: session.id,
    participantName: session.name,
    className: session.className,
    phases: {
      quiz: snap(session, 'quiz'),
      puzzle: snap(session, 'puzzle'),
      words: snap(session, 'words'),
    },
    totalScore: session.totalScore,
    totalTimeMs: session.totalTimeMs,
    errorCount: session.errorCount,
    finished: session.status === 'finished',
    result: session.result,
  };
}

function snap(session: Session, phase: PhaseKey) {
  const skippedPhase = skipped(session, phase);
  return {
    enabled: !skippedPhase,
    status: session.phases[phase].status,
    score: session.phases[phase].score,
    timeMs: session.phases[phase].timeMs,
    errors: session.phases[phase].errors,
    attemptsUsed: session.phases[phase].attemptsUsed,
    attemptsMax: session.budget[`${phase}Attempts`],
  };
}

function recompute(session: Session) {
  session.totalScore = (['quiz', 'puzzle', 'words'] as const).reduce((sum, phase) => sum + (skipped(session, phase) ? 0 : session.phases[phase].score), 0);
  session.totalTimeMs = session.phases.quiz.timeMs + session.phases.puzzle.timeMs + session.phases.words.timeMs;
  session.errorCount = session.phases.quiz.errors + session.phases.puzzle.errors + session.phases.words.errors;
}

function nextOpen(session: Session): PhaseKey | null {
  for (const phase of ['quiz', 'puzzle', 'words'] as const) {
    if (skipped(session, phase)) continue;
    if (session.phases[phase].status !== 'locked') return phase;
  }
  return null;
}

function skipped(session: Session, phase: PhaseKey) {
  const item = session.phases[phase];
  return item.status === 'locked' && item.attemptsUsed === 0 && item.timeMs === 0 && item.score === 0;
}

function canRetry(session: Session, phase: PhaseKey) {
  return session.phases[phase].attemptsUsed < session.budget[`${phase}Attempts`];
}

function blankPhase(enabled: boolean) {
  return { status: enabled ? 'pending' as const : 'locked' as const, score: 0, timeMs: 0, errors: 0, attemptsUsed: 0 };
}

function sessionByToken(db: Db, token: string) {
  const session = db.sessions.find((item) => item.token === token);
  if (!session) throw new Error('Sessão não encontrada. Comece o tour novamente.');
  return session;
}

function attemptOf(session: Session, id: string, phase: PhaseKey) {
  const attempt = session.attempts.find((item) => item.id === id && item.phase === phase);
  if (!attempt) throw new Error('Tentativa não encontrada.');
  return attempt;
}

function clean(value: unknown, min: number, max: number, message: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new Error(message);
  return text;
}

function shuffle<T>(values: T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

type QuizSecret = {
  timeLimitSec: number;
  perQuestionSec: number;
  maxScore: number;
  questions: { id: string; prompt: string; imageUrl: string | null; points: number; correctAlternativeId: string; alternatives: { id: string; label: string }[] }[];
};
type PuzzleSecret = { timeLimitSec: number; rows: number; baseScore: number; speedBonus: number; imageUrl: string; title: string; shuffle: number[] };
type WordsSecret = {
  timeLimitSec: number;
  fallSpeed: HomeConfig['rules']['wordsFallSpeed'];
  customSpeed: number;
  spawnIntervalMs: number;
  maxSimultaneous: number;
  maxScore: number;
  penalty: number;
  words: { id: string; label: string; isCorrect: boolean; points: number }[];
};
