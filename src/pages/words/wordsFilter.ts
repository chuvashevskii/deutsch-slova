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

/** Сколько строк показываем на одной странице списка. */
export const PAGE_SIZE = 50;

export interface WordsFilter {
  /** Части речи: пустой список значит «любая». */
  pos: string[];
  genus: string[];
  status: ProgressFilter[];
  query: string;
  page: number;
}

export const EMPTY_FILTER: WordsFilter = {
  pos: [],
  genus: [],
  status: [],
  query: '',
  page: 1,
};

export const isFilterEmpty = (filter: WordsFilter): boolean =>
  filter.pos.length === 0 &&
  filter.genus.length === 0 &&
  filter.status.length === 0 &&
  filter.query === '';

const splitList = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : [];

export const readFilter = (params: URLSearchParams): WordsFilter => {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    pos: splitList(params.get('pos')),
    genus: splitList(params.get('genus')).filter((value) => value === 'm' || value === 'f' || value === 'n'),
    status: splitList(params.get('status')).filter((value): value is ProgressFilter =>
      PROGRESS_VALUES.includes(value as ProgressFilter),
    ),
    query: params.get('q') ?? '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
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
  if (filter.page > 1) params.set('page', String(filter.page));
  return params;
};

/** Номер страницы никогда не уводит за пределы найденного. */
export const clampPage = (page: number, total: number): number =>
  Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / PAGE_SIZE)));
