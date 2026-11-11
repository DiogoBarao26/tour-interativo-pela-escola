export const GAMES = [
  { id: '1', name: 'Jogo 1', password: 'sol' },
  { id: '2', name: 'Jogo 2', password: 'lua' },
  { id: '3', name: 'Jogo 3', password: 'mar' },
  { id: '4', name: 'Jogo 4', password: 'rio' },
  { id: '5', name: 'Jogo 5', password: 'flor' },
  { id: '6', name: 'Jogo 6', password: 'estrela' },
] as const;

const PASS_KEY = 'tour.game.passwords';
const SLOT_KEY = 'tour.slot';
const PLAY_KEY = 'tour.play';

export function gamePasswords(): Record<string, string> {
  let saved: Record<string, string> = {};
  try {
    saved = JSON.parse(localStorage.getItem(PASS_KEY) || '{}') as Record<string, string>;
  } catch {
    saved = {};
  }
  return Object.fromEntries(GAMES.map((game) => [game.id, saved[game.id] || game.password]));
}

export function matchGame(value: string) {
  const typed = value.trim().toLowerCase();
  if (!typed) return null;
  const all = gamePasswords();
  return GAMES.find((game) => all[game.id].trim().toLowerCase() === typed) ?? null;
}

export function setGamePassword(id: string, value: string) {
  const next = value.trim();
  if (next.length < 3) throw new Error('Use uma senha com pelo menos 3 letras.');
  const all = gamePasswords();
  const taken = GAMES.some((game) => game.id !== id && all[game.id].trim().toLowerCase() === next.toLowerCase());
  if (taken) throw new Error('Outro jogo já usa essa senha. Escolha outra.');
  all[id] = next;
  localStorage.setItem(PASS_KEY, JSON.stringify(all));
}

export function setActiveGame(id: string) {
  sessionStorage.setItem(SLOT_KEY, id);
}

export function clearActiveGame() {
  sessionStorage.removeItem(SLOT_KEY);
}

export function activeGame() {
  const id = sessionStorage.getItem(SLOT_KEY);
  return GAMES.find((game) => game.id === id) ?? null;
}

export function setPlayGame(id: string) {
  sessionStorage.setItem(PLAY_KEY, id);
}

export function clearPlayGame() {
  sessionStorage.removeItem(PLAY_KEY);
}

export function playGameId() {
  return sessionStorage.getItem(PLAY_KEY);
}
