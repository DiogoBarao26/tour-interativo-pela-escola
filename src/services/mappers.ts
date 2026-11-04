import { defaultAudio, defaultRules, defaultTheme } from '../domain/defaults';
import type { AudioSettings, HomeConfig, ReportRow, RulesSettings, ThemeSettings } from '../domain/types';
import { clamp } from '../domain/rules';

export function mapHome(row: Record<string, unknown>, audioRow: Record<string, unknown> | null, mode: HomeConfig['mode']): HomeConfig {
  return {
    configured: true,
    mode,
    theme: mapTheme(row),
    rules: mapRules(row),
    audio: mapAudio(audioRow),
  };
}

export function mapTheme(row: Record<string, unknown>): ThemeSettings {
  const theme = defaultTheme();
  return {
    ...theme,
    schoolName: text(row.school_name, theme.schoolName),
    logoUrl: nullable(row.logo_url),
    coverUrl: nullable(row.cover_url),
    gameTitle: text(row.game_title, theme.gameTitle),
    welcomeText: text(row.welcome_text, theme.welcomeText),
    successTitle: text(row.success_title, theme.successTitle),
    successDetail: text(row.success_detail, theme.successDetail),
    encourageTitle: text(row.encourage_title, theme.encourageTitle),
    encourageDetail: text(row.encourage_detail, theme.encourageDetail),
    startButtonLabel: text(row.start_button_label, theme.startButtonLabel),
    retryButtonLabel: text(row.retry_button_label, theme.retryButtonLabel),
    fontFamily: text(row.font_family, theme.fontFamily),
    fontScale: clamp(number(row.font_scale, 1), 0.85, 1.4),
    colorPrimary: text(row.color_primary, theme.colorPrimary),
    colorSecondary: text(row.color_secondary, theme.colorSecondary),
    colorBackground: text(row.color_background, theme.colorBackground),
    colorButton: text(row.color_button, theme.colorButton),
    colorText: text(row.color_text, theme.colorText),
    colorProgress: text(row.color_progress, theme.colorProgress),
    collectClass: Boolean(row.collect_class),
  };
}

export function mapRules(row: Record<string, unknown>): RulesSettings {
  const rules = defaultRules();
  return {
    ...rules,
    approvalThreshold: number(row.approval_threshold, rules.approvalThreshold),
    onFail: row.on_fail === 'continue' ? 'continue' : 'retry',
    quizEnabled: bool(row.quiz_enabled, true),
    quizTimeTotal: number(row.quiz_time_total, rules.quizTimeTotal),
    quizTimePerQuestion: number(row.quiz_time_per_question, rules.quizTimePerQuestion),
    quizAttempts: number(row.quiz_attempts, rules.quizAttempts),
    quizRandomOrder: Boolean(row.quiz_random_order),
    quizMaxScore: number(row.quiz_max_score, rules.quizMaxScore),
    puzzleEnabled: bool(row.puzzle_enabled, true),
    puzzleTimeTotal: number(row.puzzle_time_total, rules.puzzleTimeTotal),
    puzzleAttempts: number(row.puzzle_attempts, rules.puzzleAttempts),
    puzzleDifficulty: row.puzzle_difficulty === 'medium' || row.puzzle_difficulty === 'hard' ? row.puzzle_difficulty : 'easy',
    puzzleScore: number(row.puzzle_score, rules.puzzleScore),
    puzzleSpeedBonus: number(row.puzzle_speed_bonus, rules.puzzleSpeedBonus),
    puzzleSelectedId: nullable(row.puzzle_selected_id),
    puzzleTitle: nullable(row.puzzle_title),
    puzzleImageUrl: nullable(row.puzzle_image_url),
    wordsEnabled: bool(row.words_enabled, true),
    wordsTimeTotal: number(row.words_time_total, rules.wordsTimeTotal),
    wordsAttempts: number(row.words_attempts, rules.wordsAttempts),
    wordsFallSpeed: isSpeed(row.words_fall_speed) ? row.words_fall_speed : 'normal',
    wordsCustomSpeed: number(row.words_custom_speed, rules.wordsCustomSpeed),
    wordsSpawnIntervalMs: number(row.words_spawn_interval_ms, rules.wordsSpawnIntervalMs),
    wordsMaxSimultaneous: number(row.words_max_simultaneous, rules.wordsMaxSimultaneous),
    wordsPenalty: number(row.words_penalty, rules.wordsPenalty),
    wordsMaxScore: number(row.words_max_score, rules.wordsMaxScore),
  };
}

export function mapAudio(row: Record<string, unknown> | null): AudioSettings {
  const audio = defaultAudio();
  if (!row) return audio;
  const tracks = row.tracks && typeof row.tracks === 'object' ? (row.tracks as AudioSettings['tracks']) : {};
  return {
    enabled: bool(row.enabled, true),
    masterVolume: clamp(number(row.master_volume, audio.masterVolume), 0, 1),
    musicVolume: clamp(number(row.music_volume, audio.musicVolume), 0, 1),
    sfxVolume: clamp(number(row.sfx_volume, audio.sfxVolume), 0, 1),
    tracks,
  };
}

export function themeToRow(theme: ThemeSettings) {
  return {
    school_name: theme.schoolName.trim(),
    logo_url: theme.logoUrl,
    cover_url: theme.coverUrl,
    game_title: theme.gameTitle.trim(),
    welcome_text: theme.welcomeText.trim(),
    success_title: theme.successTitle.trim(),
    success_detail: theme.successDetail.trim(),
    encourage_title: theme.encourageTitle.trim(),
    encourage_detail: theme.encourageDetail.trim(),
    start_button_label: theme.startButtonLabel.trim(),
    retry_button_label: theme.retryButtonLabel.trim(),
    font_family: theme.fontFamily,
    font_scale: theme.fontScale,
    color_primary: theme.colorPrimary,
    color_secondary: theme.colorSecondary,
    color_background: theme.colorBackground,
    color_button: theme.colorButton,
    color_text: theme.colorText,
    color_progress: theme.colorProgress,
    collect_class: theme.collectClass,
    updated_at: new Date().toISOString(),
  };
}

export function rulesToRow(rules: RulesSettings) {
  return {
    approval_threshold: rules.approvalThreshold,
    on_fail: rules.onFail,
    quiz_enabled: rules.quizEnabled,
    quiz_time_total: rules.quizTimeTotal,
    quiz_time_per_question: rules.quizTimePerQuestion,
    quiz_attempts: rules.quizAttempts,
    quiz_random_order: rules.quizRandomOrder,
    quiz_max_score: rules.quizMaxScore,
    puzzle_enabled: rules.puzzleEnabled,
    puzzle_time_total: rules.puzzleTimeTotal,
    puzzle_attempts: rules.puzzleAttempts,
    puzzle_difficulty: rules.puzzleDifficulty,
    puzzle_score: rules.puzzleScore,
    puzzle_speed_bonus: rules.puzzleSpeedBonus,
    puzzle_selected_id: rules.puzzleSelectedId,
    words_enabled: rules.wordsEnabled,
    words_time_total: rules.wordsTimeTotal,
    words_attempts: rules.wordsAttempts,
    words_fall_speed: rules.wordsFallSpeed,
    words_custom_speed: rules.wordsCustomSpeed,
    words_spawn_interval_ms: rules.wordsSpawnIntervalMs,
    words_max_simultaneous: rules.wordsMaxSimultaneous,
    words_penalty: rules.wordsPenalty,
    words_max_score: rules.wordsMaxScore,
    updated_at: new Date().toISOString(),
  };
}

export function mapReport(row: Record<string, unknown>): ReportRow {
  const participant = (Array.isArray(row.participants) ? row.participants[0] : row.participants) as
    | { name?: string; class_name?: string | null }
    | null;
  const created = new Date(String(row.created_at ?? Date.now()));
  const finished = row.status === 'finished';
  return {
    id: String(row.id),
    name: participant?.name ?? 'Participante',
    className: participant?.class_name || '—',
    date: created.toLocaleDateString('pt-BR'),
    time: created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    quizScore: number(row.quiz_score, 0),
    puzzleScore: number(row.puzzle_score, 0),
    wordsScore: number(row.words_score, 0),
    totalScore: number(row.total_score, 0),
    totalTimeMs: number(row.total_time_ms, 0),
    result: finished ? (row.result === 'aprovado' ? 'Aprovado' : 'Incentivo') : 'Em andamento',
    finished,
    quizAttempts: number(row.quiz_attempts_used, 0),
    puzzleAttempts: number(row.puzzle_attempts_used, 0),
    wordsAttempts: number(row.words_attempts_used, 0),
    errors: number(row.error_count, 0),
    createdAt: created.toISOString(),
  };
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function nullable(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function isSpeed(value: unknown): value is RulesSettings['wordsFallSpeed'] {
  return value === 'very_slow' || value === 'slow' || value === 'normal' || value === 'fast' || value === 'very_fast' || value === 'custom';
}
