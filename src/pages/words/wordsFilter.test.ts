import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTER,
  isFilterEmpty,
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
    const source = filter({ pos: ['noun', 'verb'], genus: ['f'], status: ['known'], query: 'haus' });
    expect(readFilter(writeFilter(source))).toEqual(source);
  });

  it('мусор в адресе не ломает фильтр', () => {
    const parsed = readFilter(new URLSearchParams('genus=q&status=нет&page=-5'));
    expect(parsed.genus).toEqual([]);
    expect(parsed.status).toEqual([]);
  });

  it('номер страницы из старых ссылок просто игнорируется', () => {
    // Список стал бесконечным, и «page» в адресе больше не значит ничего.
    // Сохранённая кем-то ссылка не должна из-за этого ломаться.
    expect(readFilter(new URLSearchParams('pos=noun&page=7'))).toEqual({
      ...EMPTY_FILTER,
      pos: ['noun'],
    });
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
