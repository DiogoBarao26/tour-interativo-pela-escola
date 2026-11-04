import type { AudioSettings, HomeConfig, RulesSettings, ThemeSettings } from './types';

export const FONT_OPTIONS = [
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Fredoka', label: 'Fredoka' },
  { id: 'Outfit', label: 'Outfit' },
  { id: 'Lexend', label: 'Lexend' },
  { id: 'Atkinson', label: 'Atkinson Hyperlegible' },
] as const;

export const FONT_STACK: Record<string, string> = {
  Nunito: '"Nunito", sans-serif',
  Fredoka: '"Fredoka", sans-serif',
  Outfit: '"Outfit", sans-serif',
  Lexend: '"Lexend", sans-serif',
  Atkinson: '"Atkinson Hyperlegible", sans-serif',
};

export const FALL_SPEED_OPTIONS: { id: string; label: string; pxPerSec: number | null }[] = [
  { id: 'very_slow', label: 'Muito lenta', pxPerSec: 28 },
  { id: 'slow', label: 'Lenta', pxPerSec: 46 },
  { id: 'normal', label: 'Normal', pxPerSec: 76 },
  { id: 'fast', label: 'Rápida', pxPerSec: 118 },
  { id: 'very_fast', label: 'Muito rápida', pxPerSec: 168 },
  { id: 'custom', label: 'Personalizada', pxPerSec: null },
];

export const AUDIO_CATALOG: { key: keyof AudioSettings['tracks']; label: string; kind: 'music' | 'sfx'; file: string }[] = [
  { key: 'music_home', label: 'Música da tela inicial', kind: 'music', file: 'music-home.wav' },
  { key: 'music_quiz', label: 'Música do quiz', kind: 'music', file: 'music-quiz.wav' },
  { key: 'music_puzzle', label: 'Música do quebra-cabeça', kind: 'music', file: 'music-puzzle.wav' },
  { key: 'music_words', label: 'Música da nuvem de palavras', kind: 'music', file: 'music-words.wav' },
  { key: 'music_victory', label: 'Música de vitória', kind: 'music', file: 'music-victory.wav' },
  { key: 'music_encourage', label: 'Música de incentivo', kind: 'music', file: 'music-encourage.wav' },
  { key: 'sfx_correct', label: 'Resposta correta', kind: 'sfx', file: 'sfx-correct.wav' },
  { key: 'sfx_wrong', label: 'Resposta incorreta', kind: 'sfx', file: 'sfx-wrong.wav' },
  { key: 'sfx_puzzle_move', label: 'Movimento do quebra-cabeça', kind: 'sfx', file: 'sfx-move.wav' },
  { key: 'sfx_puzzle_done', label: 'Conclusão do quebra-cabeça', kind: 'sfx', file: 'sfx-puzzle-done.wav' },
  { key: 'sfx_word_ok', label: 'Palavra correta', kind: 'sfx', file: 'sfx-word-ok.wav' },
  { key: 'sfx_word_bad', label: 'Palavra incorreta', kind: 'sfx', file: 'sfx-word-bad.wav' },
  { key: 'sfx_finish', label: 'Encerramento', kind: 'sfx', file: 'sfx-finish.wav' },
  { key: 'sfx_celebrate', label: 'Comemoração', kind: 'sfx', file: 'sfx-celebrate.wav' },
];

export const defaultTheme = (): ThemeSettings => ({
  schoolName: 'Escola Horizonte',
  logoUrl: null,
  coverUrl: null,
  gameTitle: 'TOUR INTERATIVO PELA ESCOLA',
  welcomeText:
    'Conheça os espaços, os projetos e os valores da nossa escola em três desafios. É rápido, divertido e feito para a comunidade.',
  successTitle: 'PARABÉNS! VOCÊ CONHECE MUITO BEM NOSSA ESCOLA!',
  successDetail: 'Sua pontuação mostra que você prestou atenção no que torna esta escola especial.',
  encourageTitle: 'QUASE LÁ! QUE TAL TENTAR NOVAMENTE?',
  encourageDetail: 'Cada tentativa ajuda a descobrir um pouco mais sobre a escola. Vamos juntos?',
  startButtonLabel: 'COMEÇAR TOUR',
  retryButtonLabel: 'TENTAR NOVAMENTE',
  fontFamily: 'Nunito',
  fontScale: 1,
  colorPrimary: '#0b6e62',
  colorSecondary: '#e39b2b',
  colorBackground: '#eef6f3',
  colorButton: '#0b6e62',
  colorText: '#14312e',
  colorProgress: '#d86b2a',
  collectClass: true,
});

export const defaultRules = (): RulesSettings => ({
  approvalThreshold: 100,
  onFail: 'retry',
  quizEnabled: true,
  quizTimeTotal: 180,
  quizTimePerQuestion: 30,
  quizAttempts: 2,
  quizRandomOrder: false,
  quizMaxScore: 50,
  puzzleEnabled: true,
  puzzleTimeTotal: 180,
  puzzleAttempts: 2,
  puzzleDifficulty: 'easy',
  puzzleScore: 24,
  puzzleSpeedBonus: 6,
  puzzleSelectedId: null,
  puzzleTitle: 'Fachada da Escola Horizonte',
  puzzleImageUrl: null,
  wordsEnabled: true,
  wordsTimeTotal: 50,
  wordsAttempts: 2,
  wordsFallSpeed: 'normal',
  wordsCustomSpeed: 80,
  wordsSpawnIntervalMs: 1100,
  wordsMaxSimultaneous: 5,
  wordsPenalty: 4,
  wordsMaxScore: 40,
});

export const defaultAudio = (): AudioSettings => ({
  enabled: true,
  masterVolume: 0.85,
  musicVolume: 0.45,
  sfxVolume: 0.9,
  tracks: {},
});

export function defaultHomeConfig(mode: HomeConfig['mode']): HomeConfig {
  return {
    configured: mode !== 'unconfigured',
    mode,
    theme: defaultTheme(),
    rules: defaultRules(),
    audio: defaultAudio(),
  };
}

export const PHASE_META = [
  {
    key: 'quiz' as const,
    step: 'FASE 1',
    title: 'QUIZ',
    summary: 'Responda perguntas sobre a escola, uma de cada vez.',
    path: '/tour/quiz',
  },
  {
    key: 'puzzle' as const,
    step: 'FASE 2',
    title: 'QUEBRA-CABEÇA',
    summary: 'Monte uma fotografia real dos espaços da instituição.',
    path: '/tour/quebra-cabeca',
  },
  {
    key: 'words' as const,
    step: 'FASE 3',
    title: 'NUVEM DE PALAVRAS',
    summary: 'Toque nos conceitos e valores que representam a escola.',
    path: '/tour/nuvem',
  },
];
