import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/shared/api';

import { PROGRESS_QUERY_KEY, WORD_QUERY_KEY, WORDS_FACETS_QUERY_KEY, WORDS_PAGE_QUERY_KEY, LEARN_QUEUE_QUERY_KEY } from './wordsQuery';

/**
 * Согласование черновой карточки.
 *
 * Черновик — слово, собранное по частотному списку: разбор у него
 * выведен автоматически и человеком не сверен. Пока отметки нет,
 * карточка помечена в списке и не попадает в «Учить» без отдельного
 * разрешения. Снять пометку — значит сказать «я проверил, она не хуже
 * карточек из готовой колоды».
 *
 * Право на это есть только у администратора: на уровне базы стоит
 * политика, а сверх неё — сторож, который не даёт через приложение
 * менять у слова что-либо, кроме самой отметки. Словарь заливается
 * скриптом, и правка его через клиент была бы дырой.
 */
export const useConfirmWord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ wordId, confirmed }: { wordId: string; confirmed: boolean }) => {
      const { error } = await supabase
        .from('words')
        .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
        .eq('id', wordId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: WORDS_FACETS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: WORD_QUERY_KEY }),
      ]);
    },
  });
};
