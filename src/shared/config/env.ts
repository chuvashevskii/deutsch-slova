import { resolveSupabaseUrl } from './resolveSupabaseUrl';

const readRequired = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Не задана переменная окружения ${name}. Скопируйте .env.example в .env и заполните значения из вывода "supabase status".`,
    );
  }
  return value;
};

export const env = {
  supabaseUrl: resolveSupabaseUrl(
    readRequired('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
    typeof window === 'undefined' ? '' : window.location.hostname,
    import.meta.env.DEV,
  ),
  supabaseAnonKey: readRequired('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;
