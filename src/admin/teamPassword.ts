const KEY = 'tour.team.password';
export const DEFAULT_TEAM_PASSWORD = 'horizonte';

export function teamPassword() {
  return localStorage.getItem(KEY) || DEFAULT_TEAM_PASSWORD;
}

export function setTeamPassword(value: string) {
  const next = value.trim();
  if (next.length < 4) throw new Error('Use uma senha com pelo menos 4 letras.');
  localStorage.setItem(KEY, next);
}

export function checkTeamPassword(value: string) {
  return value.trim().toLowerCase() === teamPassword().trim().toLowerCase();
}
