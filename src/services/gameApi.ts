import { PHASE_META } from '../domain/defaults';
import type { HomeConfig, PhaseKey, SessionState } from '../domain/types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mapHome } from './mappers';

const TOKEN_KEY = 'tour.token';

export function readToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function loadHomeConfig(): Promise<HomeConfig> {
  if (isSupabaseConfigured && supabase) {
    const settings = await supabase.from('public_settings').select('*').maybeSingle();
    if (settings.error) throw new Error('Não foi possível carregar as configurações publicadas. Verifique a conexão.');
    if (!settings.data) throw new Error('A escola ainda não publicou as configurações do tour.');
    const audio = await supabase.from('public_audio').select('*').maybeSingle();
    return mapHome(settings.data, audio.data, 'remote');
  }
  const dev = await import('@devonly/backend');
  return dev.readHomeConfig();
}

export async function callGame<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.functions.invoke('game', { body: { action, ...body } });
    if (error || !data) {
      throw new Error('Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente.');
    }
    if (typeof data === 'object' && data && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as T;
  }
  const dev = await import('@devonly/backend');
  return dev.handle(action, body) as Promise<T>;
}

export function nextPath(state: SessionState) {
  if (state.finished) return '/tour/resultado';
  for (const phase of PHASE_META) {
    const snapshot = state.phases[phase.key];
    if (!snapshot.enabled) continue;
    if (snapshot.status !== 'locked') return phase.path;
  }
  return '/tour/resultado';
}

export function phaseKeyFromPath(path: string): PhaseKey | null {
  return PHASE_META.find((phase) => phase.path === path)?.key ?? null;
}
