import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Word } from '@/entities/word';
import { supabase, type Json } from '@/shared/api';

export const FEEDBACK_QUERY_KEY = ['feedback'] as const;

/**
 * Что человек ввёл и что ожидалось — только для жалоб с экрана «Учить».
 * Индексная сигнатура нужна, чтобы тип укладывался в jsonb-колонку.
 */
export interface FeedbackContext {
  given: Record<string, string>;
  expected: Record<string, string>;
  answeredGenus: string | null;
  allCorrect: boolean | null;
  [key: string]: unknown;
}

export interface FeedbackRow {
  id: number;
  user_id: string;
  word_id: string;
  message: string;
  snapshot: Partial<Word>;
  context: FeedbackContext | null;
  resolved_at: string | null;
  created_at: string;
  nickname: string;
  /** Сколько всего обращений по этому же слову: три подряд — дело в карточке. */
  sameWord: number;
}

/**
 * Снимок слова на момент жалобы. Полную строку не храним: словарь
 * заливается повторно, и важно то, на что человек смотрел, а не всё
 * подряд. Озвучка и служебные поля в снимке не нужны.
 */
export const wordSnapshot = (word: Word): Partial<Word> => ({
  id: word.id,
  rank: word.rank,
  pos: word.pos,
  head: word.head,
  translation: word.translation,
  singular: word.singular,
  plural: word.plural,
  genus: word.genus,
  form_ich: word.form_ich,
  form_du: word.form_du,
  form_er: word.form_er,
  form_wir: word.form_wir,
  form_ihr: word.form_ihr,
  komparativ: word.komparativ,
  superlativ: word.superlativ,
  ipa: word.ipa,
  rule_status: word.rule_status,
  rule_label: word.rule_label,
  examples_de: word.examples_de,
  examples_ru: word.examples_ru,
});

/**
 * Список обращений. Псевдонимы подтягиваются отдельной выборкой, а не
 * связью: таблицы связаны через auth.users, и PostgREST такой путь сам
 * не выводит.
 */
export const useFeedback = (mine: boolean, userId: string | undefined) =>
  useQuery({
    queryKey: [...FEEDBACK_QUERY_KEY, mine, userId],
    queryFn: async (): Promise<FeedbackRow[]> => {
      let request = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (mine && userId) request = request.eq('user_id', userId);
      const { data, error } = await request;
      if (error) throw error;

      const rows = data ?? [];
      const authors = [...new Set(rows.map((row) => row.user_id))];
      const names = new Map<string, string>();
      if (authors.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nickname')
          .in('user_id', authors);
        for (const profile of profiles ?? []) names.set(profile.user_id, profile.nickname);
      }

      const perWord = new Map<string, number>();
      for (const row of rows) perWord.set(row.word_id, (perWord.get(row.word_id) ?? 0) + 1);

      return rows.map((row) => ({
        ...row,
        snapshot: (row.snapshot ?? {}) as Partial<Word>,
        context: (row.context ?? null) as FeedbackContext | null,
        nickname: names.get(row.user_id) ?? 'Аноним',
        sameWord: perWord.get(row.word_id) ?? 1,
      }));
    },
  });

export const useSendFeedback = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      word: Word;
      message: string;
      context?: FeedbackContext | null;
    }) => {
      const { error } = await supabase.from('feedback').insert({
        user_id: input.userId,
        word_id: input.word.id,
        message: input.message.trim(),
        snapshot: wordSnapshot(input.word) as unknown as Json,
        context: (input.context ?? null) as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY });
    },
  });
};

/** Отметить разобранным или вернуть в работу. Доступно администратору. */
export const useResolveFeedback = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: number; resolved: boolean }) => {
      const { error } = await supabase
        .from('feedback')
        .update({ resolved_at: resolved ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY });
    },
  });
};

export const useDeleteFeedback = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('feedback').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY });
    },
  });
};
