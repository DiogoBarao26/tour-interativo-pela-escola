export type PhaseKey = 'quiz' | 'puzzle' | 'words';
export type FailPolicy = 'retry' | 'continue';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type FallSpeed = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast' | 'custom';
export type PhaseStatus = 'pending' | 'active' | 'locked';

export interface ThemeSettings {
  schoolName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  gameTitle: string;
  welcomeText: string;
  successTitle: string;
  successDetail: string;
  encourageTitle: string;
  encourageDetail: string;
  startButtonLabel: string;
  retryButtonLabel: string;
  fontFamily: string;
  fontScale: number;
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorButton: string;
  colorText: string;
  colorProgress: string;
  collectClass: boolean;
}

export interface RulesSettings {
  approvalThreshold: number;
  onFail: FailPolicy;
  quizEnabled: boolean;
  quizTimeTotal: number;
  quizTimePerQuestion: number;
  quizAttempts: number;
  quizRandomOrder: boolean;
  quizMaxScore: number;
  puzzleEnabled: boolean;
  puzzleTimeTotal: number;
  puzzleAttempts: number;
  puzzleDifficulty: Difficulty;
  puzzleScore: number;
  puzzleSpeedBonus: number;
  puzzleSelectedId: string | null;
  puzzleTitle: string | null;
  puzzleImageUrl: string | null;
  wordsEnabled: boolean;
  wordsTimeTotal: number;
  wordsAttempts: number;
  wordsFallSpeed: FallSpeed;
  wordsCustomSpeed: number;
  wordsSpawnIntervalMs: number;
  wordsMaxSimultaneous: number;
  wordsPenalty: number;
  wordsMaxScore: number;
}

export interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  tracks: Partial<Record<AudioKey, string | null>>;
}

export type AudioKey =
  | 'music_home'
  | 'music_quiz'
  | 'music_puzzle'
  | 'music_words'
  | 'music_victory'
  | 'music_encourage'
  | 'sfx_correct'
  | 'sfx_wrong'
  | 'sfx_puzzle_move'
  | 'sfx_puzzle_done'
  | 'sfx_word_ok'
  | 'sfx_word_bad'
  | 'sfx_finish'
  | 'sfx_celebrate';

export interface HomeConfig {
  configured: boolean;
  mode: 'remote' | 'development' | 'unconfigured';
  theme: ThemeSettings;
  rules: RulesSettings;
  audio: AudioSettings;
}

export interface AlternativePublic {
  id: string;
  label: string;
}

export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  imageUrl: string | null;
  points: number;
  alternatives: AlternativePublic[];
}

export interface AnsweredQuestion {
  questionId: string;
  correct: boolean;
  points: number;
  correctAlternativeId: string;
  selectedAlternativeId: string | null;
}

export interface PhaseSnapshot {
  enabled: boolean;
  status: PhaseStatus;
  score: number;
  timeMs: number;
  errors: number;
  attemptsUsed: number;
  attemptsMax: number;
}

export interface SessionState {
  sessionId: string;
  participantName: string;
  className: string | null;
  phases: Record<PhaseKey, PhaseSnapshot>;
  totalScore: number;
  totalTimeMs: number;
  errorCount: number;
  finished: boolean;
  result: FinalResult | null;
}

export interface FinalResult {
  participantName: string;
  className: string | null;
  quizScore: number;
  puzzleScore: number;
  wordsScore: number;
  totalScore: number;
  maxScore: number;
  percent: number;
  totalTimeMs: number;
  approved: boolean;
  title: string;
  detail: string;
  finishedAt: string;
}

export interface QuizPhasePayload {
  phase: 'quiz';
  attemptId: string;
  timeLimitSec: number;
  perQuestionSec: number;
  attemptsUsed: number;
  attemptsMax: number;
  score: number;
  errors: number;
  questions: QuizQuestionPublic[];
  answered: AnsweredQuestion[];
  startedAt: string;
}

export interface PuzzlePhasePayload {
  phase: 'puzzle';
  attemptId: string;
  timeLimitSec: number;
  rows: number;
  imageUrl: string;
  title: string;
  baseScore: number;
  speedBonus: number;
  attemptsUsed: number;
  attemptsMax: number;
  startedAt: string;
  shuffle: number[];
}

export interface WordInstancePublic {
  instanceId: string;
  text: string;
  style: number;
}

export interface WordsPhasePayload {
  phase: 'words';
  attemptId: string;
  timeLimitSec: number;
  fallSpeed: FallSpeed;
  customSpeed: number;
  spawnIntervalMs: number;
  maxSimultaneous: number;
  maxScore: number;
  attemptsUsed: number;
  attemptsMax: number;
  score: number;
  errors: number;
  startedAt: string;
  activeInstances: WordInstancePublic[];
}

export type PhasePayload = QuizPhasePayload | PuzzlePhasePayload | WordsPhasePayload;

export interface AnswerResult {
  correct: boolean;
  pointsAwarded: number;
  attemptScore: number;
  errors: number;
  correctAlternativeId: string | null;
  phaseLocked: boolean;
  canRetry: boolean;
  message: string;
}

export interface PuzzleResult {
  solved: boolean;
  correctPieces: number;
  totalPieces: number;
  score: number;
  timeMs: number;
  phaseLocked: boolean;
  canRetry: boolean;
  message: string;
}

export interface HitResult {
  correct: boolean;
  delta: number;
  score: number;
  errors: number;
  duplicate: boolean;
}

export interface FinishResult {
  score: number;
  timeMs: number;
  errors: number;
  phaseLocked: boolean;
  canRetry: boolean;
  message: string;
}

export interface AlternativeAdmin {
  id: string;
  label: string;
  isCorrect: boolean;
  position: number;
}

export interface QuestionAdmin {
  id: string;
  prompt: string;
  imageUrl: string | null;
  points: number;
  position: number;
  active: boolean;
  alternatives: AlternativeAdmin[];
}

export interface PuzzleAdmin {
  id: string;
  title: string;
  imageUrl: string;
  active: boolean;
  createdAt: string;
}

export interface WordAdmin {
  id: string;
  label: string;
  isCorrect: boolean;
  points: number;
  active: boolean;
}

export interface ReportRow {
  id: string;
  name: string;
  className: string;
  date: string;
  time: string;
  quizScore: number;
  puzzleScore: number;
  wordsScore: number;
  totalScore: number;
  totalTimeMs: number;
  result: string;
  finished: boolean;
  quizAttempts: number;
  puzzleAttempts: number;
  wordsAttempts: number;
  errors: number;
  createdAt: string;
}
