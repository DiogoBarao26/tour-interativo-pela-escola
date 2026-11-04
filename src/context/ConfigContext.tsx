import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { defaultHomeConfig } from '../domain/defaults';
import type { HomeConfig } from '../domain/types';
import { applyTheme } from '../lib/theme';
import { isSupabaseConfigured } from '../lib/supabase';
import { loadHomeConfig } from '../services/gameApi';

interface ConfigValue {
  config: HomeConfig;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const Context = createContext<ConfigValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const initialMode = isSupabaseConfigured ? 'remote' : 'local';
  const [config, setConfig] = useState<HomeConfig>(() => defaultHomeConfig(initialMode));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadHomeConfig();
      setConfig(next);
      applyTheme(next.theme);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o tour.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applyTheme(config.theme);
    void reload();
    // A carga inicial usa o tema padrão e depois substitui pelo publicado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ config, loading, error, reload }), [config, loading, error, reload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConfig() {
  const value = useContext(Context);
  if (!value) throw new Error('Configuração indisponível.');
  return value;
}
