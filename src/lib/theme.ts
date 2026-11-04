import type { CSSProperties } from 'react';
import { FONT_STACK } from '../domain/defaults';
import type { ThemeSettings } from '../domain/types';
import { hexColor, readableText } from '../domain/rules';

export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  const primary = hexColor(theme.colorPrimary, '#0b6e62');
  const secondary = hexColor(theme.colorSecondary, '#e39b2b');
  const background = hexColor(theme.colorBackground, '#eef6f3');
  const button = hexColor(theme.colorButton, '#0b6e62');
  const text = hexColor(theme.colorText, '#14312e');
  const progress = hexColor(theme.colorProgress, '#d86b2a');
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--bg', background);
  root.style.setProperty('--button', button);
  root.style.setProperty('--button-text', readableText(button));
  root.style.setProperty('--text', text);
  root.style.setProperty('--progress', progress);
  root.style.setProperty('--font', FONT_STACK[theme.fontFamily] ?? FONT_STACK.Nunito);
  root.style.fontSize = `${16 * (theme.fontScale || 1)}px`;
  document.title = theme.gameTitle || 'Tour Interativo pela Escola';
}

export function themeStyle(theme: ThemeSettings): CSSProperties {
  const button = hexColor(theme.colorButton, '#0b6e62');
  return {
    ['--primary' as string]: hexColor(theme.colorPrimary, '#0b6e62'),
    ['--secondary' as string]: hexColor(theme.colorSecondary, '#e39b2b'),
    ['--bg' as string]: hexColor(theme.colorBackground, '#eef6f3'),
    ['--button' as string]: button,
    ['--button-text' as string]: readableText(button),
    ['--text' as string]: hexColor(theme.colorText, '#14312e'),
    ['--progress' as string]: hexColor(theme.colorProgress, '#d86b2a'),
    ['--font' as string]: FONT_STACK[theme.fontFamily] ?? FONT_STACK.Nunito,
    fontFamily: FONT_STACK[theme.fontFamily] ?? FONT_STACK.Nunito,
    color: hexColor(theme.colorText, '#14312e'),
    background: hexColor(theme.colorBackground, '#eef6f3'),
  };
}
