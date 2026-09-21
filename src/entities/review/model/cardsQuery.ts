import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  LEARN_QUEUE_QUERY_KEY,
  PROGRESS_QUERY_KEY,
  STATS_QUERY_KEY,
  WORDS_PAGE_QUERY_KEY,
} from '@/entities/word';
import { supabase, type Tables } from '@/shared/api';

import { applyRating, toFsrsCard, type Grade } from './scheduler';

export type CardRow = Tables<'cards'>;

export interface AnswerInput {
  userId: string;
  wordId: string;
  rating: Grade;
  current: CardRow | undefined;
  /** Результат проверки ввода. null — проверять было нечего, ввод выключен. */
  answeredCorrectly: boolean | null;
  answeredGenus: 'm' | 'f' | 'n' | null;
  durationMs: number;
  desiredRetention?: number;
}

/** Пишет ответ: пересчитывает состояние FSRS и пополняет журнал. */
export const useAnswerCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AnswerInput) => {
      const reviewedAt = new Date();
      const previous = toFsrsCard(input.current);
      const { card } = applyRating(previous, input.rating, reviewedAt, input.desiredRetention);

      const { error: cardError } = await supabase.from('cards').upsert(
        {
          user_id: input.userId,
          word_id: input.wordId,
          due: card.due.toISOString(),
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          reps: card.reps,
          lapses: card.lapses,
          state: card.state,
          learning_steps: card.learning_steps,
          last_review: reviewedAt.toISOString(),
          updated_at: reviewedAt.toISOString(),
        },
        { onConflict: 'user_id,word_id' },
      );
      if (cardError) throw cardError;

      const { error: reviewError } = await supabase.from('reviews').insert({
        user_id: input.userId,
        word_id: input.wordId,
        rating: input.rating,
        state: previous.state,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        answered_correctly: input.answeredCorrectly,
        answered_genus: input.answeredGenus,
        duration_ms: input.durationMs,
        reviewed_at: reviewedAt.toISOString(),
      });
      if (reviewError) throw reviewError;
    },
    onSuccess: async () => {
      // INFO: ответ меняет и статус слова, и сводку прогресса — их считает
      // база, поэтому кэш всех затронутых выборок надо сбросить, иначе
      // счётчики в шапке и отметки в списке застынут.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: WORDS_PAGE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LEARN_QUEUE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY }),
      ]);
    },
  });
};
