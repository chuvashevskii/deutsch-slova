import { describe, expect, it } from 'vitest';

import {
  clampPage,
  EMPTY_FILTER,
  isFilterEmpty,
  PAGE_SIZE,
  readFilter,
  writeFilter,
  type WordsFilter,
} from './wordsFilter';

const filter = (patch: Partial<WordsFilter>): WordsFilter => ({ ...EMPTY_FILTER, ...patch });

describe('адрес страницы', () => {
  it('пустой фильтр не оставляет в адресе ничего', () => {
    expect(writeFilter(EMPTY_FILTER).toString()).toBe('');
  });

  it('переживает запись и чтение', () => {
    const source = filter({ pos: ['noun', 'verb'], genus: ['f'], status: ['known'], query: 'haus', page: 3 });
    expect(readFilter(writeFilter(source))).toEqual(source);
  });

  it('мусор в адресе не ломает фильтр', () => {
    const parsed = readFilter(new URLSearchParams('genus=q&status=нет&page=-5'));
    expect(parsed.genus).toEqual([]);
    expect(parsed.status).toEqual([]);
    expect(parsed.page).toBe(1);
  });
});

describe('страницы', () => {
  it('номер не уходит за последнюю страницу', () => {
    expect(clampPage(99, PAGE_SIZE * 2)).toBe(2);
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(1, 0)).toBe(1);
  });
});

describe('пустой фильтр', () => {
  it('узнаётся по любому выставленному условию', () => {
    expect(isFilterEmpty(EMPTY_FILTER)).toBe(true);
    expect(isFilterEmpty(filter({ query: 'x' }))).toBe(false);
    expect(isFilterEmpty(filter({ pos: ['noun'] }))).toBe(false);
    expect(isFilterEmpty(filter({ status: ['known'] }))).toBe(false);
  });
});
