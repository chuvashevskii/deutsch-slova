import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LEARN_QUEUE_QUERY_KEY, PROGRESS_QUERY_KEY, WORDS_PAGE_QUERY_KEY } from '@/entities/word';
import { supabase } from '@/shared/api';

/**
 * Отметка, которую человек сам ставит слову.
 *
 * `requested` — «хочу увидеть сегодня»: слово встаёт в начало очереди
 * и не считается против дневного лимита новых. Снимается само, как только
 * на слово ответили.
 *
 * `known` — «знаю»: слово уходит из очереди **не навсегда**. Отметка
 * заводит ему зрелую карточку, и через срок из настроек слово вернётся
 * один раз на проверку. Знание выветривается, и отметка, прятавшая
 * слово насовсем, об этом не знала.
 *
 * В статистике оно по-прежнему считается отдельно от заслуженного
 * «знаю»: одно объявлено нажатием кнопки, другое набрано растущими
 * интервалами. Как только на слово ответят по-настоящему, объявление
 * снимается само — триггером на журнале ответов.
 */
export type WordMark = 'requested' | 'known';

const invalidate = async (client: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
    client.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
    client.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
  ]);
};

/**
 * Ставит отметку или снимает её. Отдельной кнопки «отменить» нет:
 * нажатие по уже стоящей отметке её убирает — промахнуться и остаться
 * с ненужной пометкой невозможно.
 */
export const useToggleMark = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      wordId,
      mark,
      active,
    }: {
      userId: string;
      wordId: string;
      mark: WordMark;
      /** Стоит ли отметка сейчас: если да — снимаем. */
      active: boolean;
    }) => {
      // INFO: «знаю» идёт функцией базы, а не записью в таблицу: отметка
      // должна ещё и посеять карточку, а снятие — убрать посеянную,
      // но не заработанную. Делать это двумя запросами с клиента значит
      // однажды оставить слово с отметкой и без карточки.
      if (mark === 'known') {
        const { error } = await supabase.rpc(active ? 'unmark_known' : 'mark_known', {
          p_word_id: wordId,
        });
        if (error) throw error;
        return;
      }
      if (active) {
        const { error } = await supabase
          .from('word_marks')
          .delete()
          .eq('user_id', userId)
          .eq('word_id', wordId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('word_marks')
        .upsert({ user_id: userId, word_id: wordId, mark }, { onConflict: 'user_id,word_id' });
      if (error) throw error;
    },
    onSuccess: () => invalidate(client),
  });
};

/**
 * Возвращает слово в состояние нового: удаляет карточку с её состоянием
 * FSRS.
 *
 * Журнал ответов при этом **не трогается**. Вы действительно отвечали на
 * это слово в тот день, и стереть записи значило бы задним числом
 * переписать точность и тепловую карту. Слово становится новым, история
 * остаётся правдой.
 */
export const useResetProgress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, wordId }: { userId: string; wordId: string }) => {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('user_id', userId)
        .eq('word_id', wordId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(client),
  });
};

/** Сколько чего удалил полный сброс. */
export interface ResetSummary {
  /** Карточек с состоянием FSRS. */
  cards: number;
  /** Записей в журнале ответов. */
  reviews: number;
  /** Отметок «учить сегодня» и «знаю». */
  marks: number;
}

/**
 * Полный сброс обучения.
 *
 * Отличается от сброса по одному слову не только объёмом: здесь уходит
 * и **журнал ответов**. По одному слову журнал берегут — человек правда
 * отвечал в тот день, и стирать запись значило бы переписать точность
 * и тепловую карту задним числом. Полный сброс просят ради чистого
 * листа, и если журнал оставить, статистика продолжит показывать сотни
 * ответов и закрашенные дни — решат, что кнопка не сработала.
 *
 * Числа возвращает сама функция базы: экран обязан подтвердить, что
 * удаление прошло, а «готово» без чисел этого не доказывает.
 */
export const useResetAllProgress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ResetSummary> => {
      const { data, error } = await supabase.rpc('reset_all_progress');
      if (error) throw error;
      return data as unknown as ResetSummary;
    },
    onSuccess: () => invalidate(client),
  });
};

/** Размер накопленного — ровно столько строк и удалит сброс. */
export interface ProgressSize {
  cards: number;
  reviews: number;
}

export const PROGRESS_SIZE_QUERY_KEY = ['progress-size'] as const;

/**
 * Сколько строк накопило обучение — прямым счётом по таблицам.
 *
 * Считать по долям из `progress_summary` было нельзя, и это выяснилось
 * на стенде: доли берутся из `word_status`, а она зовёт карточку новой,
 * пока `state = 0`. Предупреждение обещало одно слово там, где удалялось
 * двенадцать карточек. В обычной жизни так не выходит — приложение
 * пишет состояние вместе с ответом, — но обещание перед необратимым
 * удалением не должно держаться на «обычно не выходит».
 *
 * Запрос идёт `head`-ом: нужны только числа, строки не везутся.
 * Включается, лишь когда человек раскрыл предупреждение.
 */
export const useProgressSize = (enabled: boolean) =>
  useQuery({
    queryKey: PROGRESS_SIZE_QUERY_KEY,
    enabled,
    queryFn: async (): Promise<ProgressSize> => {
      const [cards, reviews] = await Promise.all([
        supabase.from('cards').select('*', { count: 'exact', head: true }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
      ]);
      if (cards.error) throw cards.error;
      if (reviews.error) throw reviews.error;
      return { cards: cards.count ?? 0, reviews: reviews.count ?? 0 };
    },
  });
