import { describe, expect, it } from 'vitest';

import { EMPTY_FILTER, isFilterEmpty, readFilter, writeFilter } from './wordsFilter';

/**
 * Отбор «и как наречие» — подкатегория прилагательного, как род
 * у существительного: он не значение в списке частей речи, а признак
 * рядом. Слово `gut` и так считается в обоих отборах.
 */
describe('отбор двойных слов', () => {
  it('пустой фильтр остаётся пустым', () => {
    expect(isFilterEmpty(EMPTY_FILTER)).toBe(true);
  });

  it('выбранный признак делает фильтр непустым — «Сбросить» должен ожить', () => {
    expect(isFilterEmpty({ ...EMPTY_FILTER, dual: true })).toBe(false);
  });

  it('пишется в адрес и читается обратно', () => {
    const params = writeFilter({ ...EMPTY_FILTER, pos: ['adj'], dual: true });
    expect(params.get('dual')).toBe('1');
    expect(readFilter(params)).toEqual({ ...EMPTY_FILTER, pos: ['adj'], dual: true });
  });

  it('невыбранный в адрес не пишется: ссылка без отборов остаётся чистой', () => {
    expect(writeFilter(EMPTY_FILTER).toString()).toBe('');
  });
});
