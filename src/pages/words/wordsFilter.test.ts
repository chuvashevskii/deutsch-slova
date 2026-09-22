import { describe, expect, it } from 'vitest';

import { EMPTY_FILTER, isFilterEmpty, readFilter, writeFilter } from './wordsFilter';

/**
 * «Прилагательные и наречия» — своя категория, а не членство в двух.
 * Слово `gut` подписано в строке «прил. · нареч.», и отбор с тем же
 * именем даёт ровно его: отбор совпадает с тем, что человек видит.
 */
describe('отбор по категориям', () => {
  it('пустой фильтр остаётся пустым', () => {
    expect(isFilterEmpty(EMPTY_FILTER)).toBe(true);
  });

  it('двойная категория выбирается наравне с прочими', () => {
    const filter = { ...EMPTY_FILTER, pos: ['adj_adverb'] };
    expect(isFilterEmpty(filter)).toBe(false);
    expect(readFilter(writeFilter(filter))).toEqual(filter);
  });

  it('категории складываются, чтобы получить все прилагательные вообще', () => {
    const filter = { ...EMPTY_FILTER, pos: ['adj', 'adj_adverb'] };
    expect(writeFilter(filter).get('pos')).toBe('adj,adj_adverb');
    expect(readFilter(writeFilter(filter))).toEqual(filter);
  });

  it('пустой фильтр в адрес не пишется: ссылка остаётся чистой', () => {
    expect(writeFilter(EMPTY_FILTER).toString()).toBe('');
  });
});
