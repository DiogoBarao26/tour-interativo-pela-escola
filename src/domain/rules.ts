import type { Difficulty, FallSpeed, RulesSettings } from './types';
import { FALL_SPEED_OPTIONS } from './defaults';

export function gridSize(difficulty: Difficulty): number {
  if (difficulty === 'medium') return 4;
  if (difficulty === 'hard') return 5;
  return 3;
}

export function fallPixelsPerSecond(speed: FallSpeed, custom: number): number {
  if (speed === 'custom') return clamp(custom, 12, 320);
  const found = FALL_SPEED_OPTIONS.find((item) => item.id === speed);
  return found?.pxPerSec ?? 76;
}

export function maxPossibleScore(rules: RulesSettings): number {
  let total = 0;
  if (rules.quizEnabled) total += rules.quizMaxScore;
  if (rules.puzzleEnabled) total += rules.puzzleScore + rules.puzzleSpeedBonus;
  if (rules.wordsEnabled) total += rules.wordsMaxScore;
  return total;
}

export function puzzleScoreFor(input: {
  correctPieces: number;
  totalPieces: number;
  elapsedMs: number;
  timeLimitSec: number;
  baseScore: number;
  speedBonus: number;
}): number {
  const ratio = input.totalPieces === 0 ? 0 : input.correctPieces / input.totalPieces;
  const base = Math.round(ratio * input.baseScore);
  const solved = input.correctPieces === input.totalPieces && input.totalPieces > 0;
  if (!solved) return base;
  const limit = input.timeLimitSec * 1000;
  const ratioTime = limit <= 0 ? 1 : input.elapsedMs / limit;
  const bonus = ratioTime <= 0.5 ? input.speedBonus : ratioTime <= 0.75 ? Math.round(input.speedBonus / 2) : 0;
  return Math.min(input.baseScore + input.speedBonus, base + bonus);
}

export function isApproved(score: number, threshold: number): boolean {
  return score > threshold;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function shuffleNumbers(length: number): number[] {
  const values = Array.from({ length }, (_, index) => index);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = values[i]!;
    values[i] = values[j]!;
    values[j] = current;
  }
  if (values.every((value, index) => value === index) && values.length > 1) {
    const first = values[0]!;
    values[0] = values[1]!;
    values[1] = first;
  }
  return values;
}

export function isSolved(arrangement: number[]): boolean {
  return arrangement.every((value, index) => value === index);
}

export function countCorrectPieces(arrangement: number[]): number {
  return arrangement.reduce((sum, value, index) => sum + (value === index ? 1 : 0), 0);
}

export function isPermutation(arrangement: number[], size: number): boolean {
  if (arrangement.length !== size) return false;
  const seen = new Set<number>();
  for (const value of arrangement) {
    if (!Number.isInteger(value) || value < 0 || value >= size || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function hexColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function readableText(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#14221f' : '#ffffff';
}

export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const value = hex.replace('#', '');
    const parts = [0, 2, 4].map((start) => {
      const channel = parseInt(value.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function publicAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\//, '')}`;
}

export function resolvePuzzleImage(url: string | null): string {
  if (!url || url === 'bundled:escola.svg') return publicAsset('demo/escola.svg');
  return url;
}
