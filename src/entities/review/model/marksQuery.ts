import { useMutation, useQueryClient } from '@tanstack/react-query';

import { LEARN_QUEUE_QUERY_KEY, PROGRESS_QUERY_KEY, WORDS_PAGE_QUERY_KEY } from '@/entities/word';
import { supabase } from '@/shared/api';

/**
 * Отметка, которую человек сам ставит слову.
 *
 * `requested` — «хочу увидеть сегодня»: слово встаёт в начало очереди
 * и не считается против дневного лимита новых. Снимается само, как только
 * на слово ответили.
 *
 * `known` — «знаю, не показывай»: слово уходит из очереди совсем.
 * В статистике оно считается отдельно от заслуженного «знаю»: одно
 * объявлено нажатием кнопки, другое набрано растущими интервалами.
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
