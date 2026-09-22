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
  /**
   * Отбор по сверке: true — только черновики, null — все. Отдельно
   * от `status`, потому что это не состояние знания, а происхождение
   * карточки: черновик бывает и новым, и уже выученным.
   */
  draft: boolean | null;
  /**
   * Отбор по частотному списку: false — только слова вне него, true —
   * только с рангом, null — все. Отсутствие ранга не пропуск, а отсутствие
   * данных: этих слов нет в списке 4500, и учить их удобно отдельно.
   */
  ranked: boolean | null;
}

export const EMPTY_FILTER: WordsFilter = {
  pos: [],
  genus: [],
  status: [],
  query: '',
  draft: null,
  ranked: null,
};

export const isFilterEmpty = (filter: WordsFilter): boolean =>
  filter.pos.length === 0 &&
  filter.genus.length === 0 &&
  filter.status.length === 0 &&
  filter.query === '' &&
  filter.draft === null &&
  filter.ranked === null;

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
    draft: params.get('draft') === '1' ? true : params.get('draft') === '0' ? false : null,
    ranked: params.get('ranked') === '1' ? true : params.get('ranked') === '0' ? false : null,
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
  if (filter.draft !== null) params.set('draft', filter.draft ? '1' : '0');
  if (filter.ranked !== null) params.set('ranked', filter.ranked ? '1' : '0');
  return params;
};

