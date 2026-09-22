import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/api';

export const NESTS_QUERY_KEY = ['words', 'nests'] as const;

/**
 * Два рода гнёзд — два разных вопроса к колоде.
 *
 * `head` — одно немецкое слово, разные значения: `Bank` банк и скамейка,
 * `wählen` выбирать, голосовать и набирать номер. Здесь видно, не слиплись
 * ли два значения в одной карточке и не пора ли её делить.
 *
 * `translation` — один русский перевод у разных немецких слов: все
 * «Получать» рядом. Здесь видно, разведены ли они пометой или подсказкой,
 * то есть работает ли правило однозначности.
 */
export type NestKind = 'head' | 'translation';

export interface NestCard {
  id: string;
  head: string;
  translation: string;
  register: string | null;
  definition: string | null;
  rank: number | null;
  is_draft: boolean;
  label: string;
  pos: string;
  wortart: string | null;
  /** Карточку трогал разбор, и правка не откачена. */
  edited: boolean;
}

export interface Nest {
  /** Немецкое слово или русский вариант перевода — по чему собрано гнездо. */
  key: string;
  label: string;
  /** Правило однозначности нарушено: кто-то без различителя или различители совпали. */
  flawed: boolean;
  cards: NestCard[];
}

/**
 * Гнёзда считает база, а не экран.
 *
 * Иначе правило однозначности жило бы в двух местах — в валидаторе
 * и здесь, — и однажды они разошлись бы в числах об одной колоде.
 * Сейчас признак изъяна приходит готовым и совпадает с отчётом
 * `npm run check:deck` до единицы.
 */
export const useNests = (kind: NestKind) =>
  useQuery({
    queryKey: [...NESTS_QUERY_KEY, kind],
    queryFn: async (): Promise<Nest[]> => {
      const { data, error } = await supabase.rpc('word_nests', { p_kind: kind });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Nest[];
    },
  });
