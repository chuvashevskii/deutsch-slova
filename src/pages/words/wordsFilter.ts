/**
 * Значения фильтра прогресса. Четыре первых — состояние знания,
 * «requested» стоит особняком: это не состояние, а пожелание, и оно
 * сочетается с любым из них.
 */
export type ProgressFilter = 'new' | 'learning' | 'known' | 'declared' | 'requested';

const PROGRESS_VALUES: readonly ProgressFilter[] = [
  'new',
  'learning',
  'known',
  'declared',
  'requested',
];

export interface WordsFilter {
  /** Части речи: пустой список значит «любая». */
  pos: string[];
  genus: string[];
  status: ProgressFilter[];
  query: string;
}

export const EMPTY_FILTER: WordsFilter = {
  pos: [],
  genus: [],
  status: [],
  query: '',
};

export const isFilterEmpty = (filter: WordsFilter): boolean =>
  filter.pos.length === 0 &&
  filter.genus.length === 0 &&
  filter.status.length === 0 &&
  filter.query === '';

const splitList = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : [];

export const readFilter = (params: URLSearchParams): WordsFilter => {
  return {
    pos: splitList(params.get('pos')),
    genus: splitList(params.get('genus')).filter((value) => value === 'm' || value === 'f' || value === 'n'),
    status: splitList(params.get('status')).filter((value): value is ProgressFilter =>
      PROGRESS_VALUES.includes(value as ProgressFilter),
    ),
    query: params.get('q') ?? '',
  };
};

/**
 * Обратное к readFilter. Значения по умолчанию в адрес не пишутся, чтобы
 * ссылка на список без фильтров оставалась просто «/words».
 */
export const writeFilter = (filter: WordsFilter): URLSearchParams => {
  const params = new URLSearchParams();
  if (filter.pos.length) params.set('pos', filter.pos.join(','));
  if (filter.genus.length) params.set('genus', filter.genus.join(','));
  if (filter.status.length) params.set('status', filter.status.join(','));
  if (filter.query) params.set('q', filter.query);
  return params;
};

