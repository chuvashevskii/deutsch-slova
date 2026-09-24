import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json } from '@/shared/api/database.types';
import { supabase } from '@/shared/api';

import type { Neighbour, toPayload } from './newWord';
import {
  PROGRESS_QUERY_KEY,
  WORDS_FACETS_QUERY_KEY,
  WORDS_PAGE_QUERY_KEY,
  LEARN_QUEUE_QUERY_KEY,
  WORD_QUERY_KEY,
} from './wordsQuery';

export const NEIGHBOURS_QUERY_KEY = ['translation-neighbours'] as const;

/**
 * Карточки, у которых уже стоит такой перевод.
 *
 * Спрашивается у базы, а не считается на клиенте: колода в две с половиной
 * тысячи строк, и везти её в браузер ради одной проверки незачем.
 * Запрос ждёт, пока человек допечатает, — иначе он уходит на каждой букве.
 */
export const useTranslationNeighbours = (translation: string, label: string, exclude?: string) =>
  useQuery({
    queryKey: [...NEIGHBOURS_QUERY_KEY, translation.trim(), label, exclude ?? ''],
    enabled: translation.trim().length > 1,
    staleTime: 60_000,
    queryFn: async (): Promise<Neighbour[]> => {
      const { data, error } = await supabase.rpc('translation_neighbours', {
        p_translation: translation.trim(),
        p_label: label,
        // INFO: правка своей же карточки иначе показала бы её саму
        // столкновением перевода — и заперла бы кнопку намертво.
        p_exclude: exclude ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Neighbour[];
    },
  });

/**
 * Заводит карточку руками.
 *
 * Словарь заливается скриптом, и политики на вставку у `words` нет —
 * пишет функция базы. Она же проверяет обязательное ещё раз: форма
 * подсказывает, а отвечает за словарь база.
 *
 * Карточка рождается черновиком и в «Учить» не попадает, пока её
 * не согласуют. Это не осторожность ради осторожности: карточка,
 * собранная за две минуты, слабее выверенной, и смешивать их в памяти
 * нельзя.
 */
export const useCreateWord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (word: ReturnType<typeof toPayload>): Promise<string> => {
      // INFO: поля карточки — простой словарь строк и массивов, но тип
      // из схемы описывает его как Json. Приведение здесь одно и явное.
      const { data, error } = await supabase.rpc('create_word', {
        p_word: word as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: WORDS_FACETS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
      ]);
    },
  });
};

/**
 * Правит карточку и возвращает число записанных строк журнала.
 *
 * Ноль значит «ничего не изменилось» — экран об этом говорит честно,
 * а не рисует успех. Запись идёт в тот же журнал, что и партии разбора:
 * второй способ менять словарь, мимо истории, заводить нельзя.
 */
export const useUpdateWord = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, string | string[]>): Promise<number> => {
      const { data, error } = await supabase.rpc('update_word', {
        p_id: id,
        p_patch: patch as unknown as Json,
      });
      if (error) throw error;
      return (data ?? 0) as unknown as number;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: WORD_QUERY_KEY }),
        client.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: NEIGHBOURS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
      ]);
    },
  });
};

/**
 * Удаляет карточку, заведённую руками, и возвращает её слово.
 *
 * Отказ даёт база: не своя карточка или по ней уже учатся. Сообщение
 * приходит оттуда же — выдумывать своё значит однажды соврать.
 */
export const useDeleteWord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { data, error } = await supabase.rpc('delete_word', { p_id: id });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: WORDS_FACETS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
      ]);
    },
  });
};
