import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase, type Tables } from '@/shared/api';

export const SETTINGS_QUERY_KEY = ['settings'] as const;
export const PROFILE_QUERY_KEY = ['profile'] as const;

export type UserSettings = Tables<'user_settings'>;
export type Profile = Tables<'profiles'>;

/**
 * Что спрашивает карточка. Умолчания повторяют умолчания схемы и нужны
 * на те доли секунды, пока настройки не пришли, а также если строки
 * настроек почему-то нет: показать карточку без ввода безопаснее, чем
 * потребовать печатать то, о чём человек не просил.
 */
export interface AnswerSettings {
  desired_retention: number;
  daily_new_limit: number;
  input_noun_singular: boolean;
  input_noun_plural: boolean;
  input_verb_infinitive: boolean;
  input_verb_forms: boolean;
  input_other: boolean;
  ask_genus: boolean;
  include_drafts: boolean;
}

export const DEFAULT_SETTINGS: AnswerSettings = {
  desired_retention: 0.9,
  daily_new_limit: 20,
  input_noun_singular: false,
  input_noun_plural: false,
  input_verb_infinitive: false,
  input_verb_forms: false,
  input_other: false,
  ask_genus: true,
  include_drafts: false,
};

/** Допустимые значения дневного лимита новых слов. */
export const NEW_LIMITS = [10, 20, 30, 40, 50] as const;

export const useUserSettings = () =>
  useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<AnswerSettings> => {
      const { data, error } = await supabase.from('user_settings').select('*').maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
    },
  });

export const useSaveSettings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Partial<AnswerSettings> }) => {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: async () => {
      // INFO: лимит новых слов меняет очередь, а глубина запоминания — сроки
      // на кнопках: обе выборки должны пересчитаться сразу.
      await client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      await client.invalidateQueries({ queryKey: ['learn-queue'] });
    },
  });
};

export const useProfile = () =>
  useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async (): Promise<{ nickname: string }> => {
      const { data, error } = await supabase.from('profiles').select('nickname').maybeSingle();
      if (error) throw error;
      return { nickname: data?.nickname ?? 'Аноним' };
    },
  });

export const useSaveNickname = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, nickname }: { userId: string; nickname: string }) => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, nickname, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
  });
};

/** Администратор ли текущий пользователь: он разбирает общие списки. */
export const useIsAdmin = () =>
  useQuery({
    queryKey: ['is-admin'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return Boolean(data);
    },
  });
