import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const isSupabaseConfigured = url.startsWith('https://') && anonKey.length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
