import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/api';

import type { Word } from './types';

export const WORDS_PAGE_QUERY_KEY = ['words', 'page'] as const;
export const WORDS_FACETS_QUERY_KEY = ['words', 'facets'] as const;
export const WORD_QUERY_KEY = ['words', 'one'] as const;
export const PROGRESS_QUERY_KEY = ['progress'] as const;
export const LEARN_QUEUE_QUERY_KEY = ['learn-queue'] as const;
export const STATS_QUERY_KEY = ['stats'] as const;

/** Строка списка: только то, что видно, без примеров и форм. */
export interface WordListRow {
  id: string;
  rank: number | null;
  pos: string;
  head: string;
  translation: string;
  genus: string | null;
  singular: string | null;
  wortart: string | null;
  status: 'new' | 'learning' | 'known' | 'declared';
  /** Человек попросил показать это слово сегодня. */
  requested: boolean;
  /** На слово уже отвечали — значит есть что сбрасывать. */
  has_progress: boolean;
  /** Разбор собран автоматически и человеком не сверен. */
  draft: boolean;
}

export interface WordsPageResult {
  total: number;
  rows: WordListRow[];
}

export interface WordsPageParams {
  pos: string[];
  genus: string[];
  status: string[];
  query: string;
  /** true — только черновики, false — только сверенные, null — все. */
  draft: boolean | null;
  /** true — только со своим рангом, false — только вне списка, null — все. */
  ranked: boolean | null;
  limit: number;
  offset: number;
}

/** Сколько строк тянем за раз. Список бесконечный, это размер порции. */
export const WORDS_BATCH = 50;

export type WordsQuery = Omit<WordsPageParams, 'limit' | 'offset'>;

const fetchWordsPage = async (params: WordsPageParams): Promise<WordsPageResult> => {
  const { data, error } = await supabase.rpc('words_page', {
    p_pos: params.pos,
    p_genus: params.genus,
    p_status: params.status,
    p_query: params.query,
    p_limit: params.limit,
    p_offset: params.offset,
    // INFO: null здесь значит «не отбирать по сверке», и функция ждёт
    // отсутствия аргумента, а не null: у неё умолчание — «все».
    p_draft: params.draft ?? undefined,
    p_ranked: params.ranked ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as WordsPageResult;
};

/**
 * Список порциями по мере прокрутки.
 *
 * Отбор и счёт по-прежнему делает база: каждая порция приходит со своим
 * общим числом найденного, поэтому знать, когда остановиться, можно без
 * отдельного запроса. Следующее смещение считается по уже полученным
 * строкам, а не по номеру порции: так пропуск или повтор невозможны.
 */
export const useWordsInfinite = (params: WordsQuery) =>
  useInfiniteQuery({
    queryKey: [...WORDS_PAGE_QUERY_KEY, params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchWordsPage({ ...params, limit: WORDS_BATCH, offset: pageParam as number }),
    getNextPageParam: (lastPage, loadedPages) => {
      const shown = loadedPages.reduce((count, page) => count + page.rows.length, 0);
      return shown < lastPage.total ? shown : undefined;
    },
  });

export interface WordsFacets {
  /**
   * Сколько слов всего. Приходит от базы, а не складывается из `pos`:
   * выводить целое из слагаемых значит зависеть от того, что ни одно
   * из них не забыли.
   */
  total: number;
  pos: Record<string, number>;
  genus: Record<string, number>;
  /** Сколько карточек ждёт сверки. */
  drafts: number;
  /** Сколько слов вне частотного списка: ранга у них нет и не будет. */
  rankless: number;
}

/** Сколько слов каждой части речи и каждого рода — для подписей в фильтре. */
export const useWordsFacets = () =>
  useQuery({
    queryKey: WORDS_FACETS_QUERY_KEY,
    staleTime: Infinity,
    queryFn: async (): Promise<WordsFacets> => {
      const { data, error } = await supabase.rpc('words_facets');
      if (error) throw new Error(error.message);
      return data as unknown as WordsFacets;
    },
  });

export interface ProgressSummary {
  total: number;
  new: number;
  learning: number;
  known: number;
  /** Помечено «знаю» рукой. Считается отдельно от заслуженного «знаю». */
  declared: number;
  requested: number;
  nounsWithGenus: number;
  /**
   * Сколько карточек ждёт сверки. Не зависит от настройки: черновики
   * есть, даже когда в «Учить» они не попадают.
   */
  drafts: number;
}

/**
 * Состав колоды и продвижение по частотному списку. Живёт здесь, а не
 * в списке, потому что нужен и шапке на каждом экране, и статистике.
 */
export const useProgressSummary = () =>
  useQuery({
    queryKey: PROGRESS_QUERY_KEY,
    queryFn: async (): Promise<ProgressSummary> => {
      const { data, error } = await supabase.rpc('progress_summary');
      if (error) throw new Error(error.message);
      return data as unknown as ProgressSummary;
    },
  });

export interface LearnQueueItem {
  word: Word;
  card: Record<string, unknown> | null;
}

export interface LearnQueue {
  total: number;
  items: LearnQueueItem[];
}

/**
 * Очередь повторений: длина и первые несколько слов целиком. Раньше экран
 * ради одной карточки забирал весь словарь — очередь считалась на клиенте,
 * и для неё нужно было знать про каждое слово, наступил ли срок.
 */
/**
 * Очередь повторений. `limit` — сколько карточек прислать целиком;
 * с нулём приходит одна только длина, и это единственный способ узнать
 * её, не повторяя правила очереди второй раз в другом запросе.
 */
export const useLearnQueue = (enabled: boolean, limit = 5) =>
  useQuery({
    queryKey: [...LEARN_QUEUE_QUERY_KEY, limit],
    enabled,
    queryFn: async (): Promise<LearnQueue> => {
      const { data, error } = await supabase.rpc('learn_queue', { p_limit: limit });
      if (error) throw new Error(error.message);
      return data as unknown as LearnQueue;
    },
  });

export interface StatsSummary {
  reviewedToday: number;
  dueNow: number;
  /** Доля верных среди проверенных ответов. null — проверять было нечего. */
  accuracy: number | null;
  /** Сколько ответов вообще проверялось: остальные шли без ввода форм. */
  checkedReviews: number;
  /** Части речи, попавшие в точность: у остальных ввод был выключен. */
  checkedPos: string[];
  totalReviews: number;
  forecast: number[];
  perDay: Record<string, number>;
  activeDays: number;
  genusMatrix: Array<{ expected: string; answered: string; n: number }>;
  ruleErrors: Array<{ label: string; total: number; wrong: number }>;
}

/**
 * Агрегаты статистики. Журнал повторений на клиент не выгружается: он растёт
 * без предела, а экрану нужны пять чисел и две небольшие сводки.
 */
export const useStatsSummary = () =>
  useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: async (): Promise<StatsSummary> => {
      const { data, error } = await supabase.rpc('stats_summary', {
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw new Error(error.message);
      return data as unknown as StatsSummary;
    },
  });

/** Полное слово — когда строку списка развернули. */
export const useWord = (id: string | null) =>
  useQuery({
    queryKey: [...WORD_QUERY_KEY, id],
    enabled: Boolean(id),
    staleTime: Infinity,
    queryFn: async (): Promise<Word> => {
      const { data, error } = await supabase.from('words').select('*').eq('id', id!).single();
      if (error) throw new Error(error.message);
      return data as Word;
    },
  });
