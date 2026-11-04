import type { HomeConfig } from '../domain/types';

export function readHomeConfig(): HomeConfig {
  throw new Error('O banco de dados ainda não foi configurado.');
}

export function handle(): Promise<never> {
  return Promise.reject(new Error('O banco de dados ainda não foi configurado.'));
}

export const admin = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error('O Supabase ainda não foi configurado.');
      };
    },
  },
);
