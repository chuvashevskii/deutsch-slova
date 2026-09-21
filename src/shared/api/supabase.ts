import { createClient } from '@supabase/supabase-js';

import { env } from '@/shared/config/env';

import type { Database } from './database.types';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// INFO: в дев-режиме клиент доступен из консоли — нужен для ручной проверки
// запросов и политик RLS без прохода через полноценный вход.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).supabase = supabase;
}
