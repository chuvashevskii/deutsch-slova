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

/**
 * Отсутствие ранга — не «самый редкий», а отсутствие данных: этих слов
 * нет в частотном списке 4500. Поэтому отбор трёхзначный, и «все»
 * отличается от «только с рангом».
 */
describe('отбор по частотному списку', () => {
  it('различает три состояния, а не два', () => {
    expect(readFilter(new URLSearchParams()).ranked).toBeNull();
    expect(readFilter(new URLSearchParams('ranked=0')).ranked).toBe(false);
    expect(readFilter(new URLSearchParams('ranked=1')).ranked).toBe(true);
  });

  it('переживает дорогу в адрес и обратно', () => {
    for (const ranked of [null, true, false]) {
      const filter = { ...EMPTY_FILTER, ranked };
      expect(readFilter(writeFilter(filter))).toEqual(filter);
    }
  });

  it('непонятное значение читается как «все», а не как отбор', () => {
    // Иначе кривая ссылка молча показала бы часть колоды как целое.
    expect(readFilter(new URLSearchParams('ranked=да')).ranked).toBeNull();
  });

  it('считается заполнением фильтра — иначе «Сбросить» его не увидит', () => {
    expect(isFilterEmpty({ ...EMPTY_FILTER, ranked: false })).toBe(false);
  });

  it('сочетается с отбором по сверке', () => {
    const filter = { ...EMPTY_FILTER, ranked: false, draft: true };
    const params = writeFilter(filter);
    expect(params.get('ranked')).toBe('0');
    expect(params.get('draft')).toBe('1');
    expect(readFilter(params)).toEqual(filter);
  });
});

describe('заведённые руками', () => {
  it('читается из адреса только «да»', () => {
    expect(readFilter(new URLSearchParams()).own).toBeNull();
    expect(readFilter(new URLSearchParams('own=1')).own).toBe(true);
  });

  // «Всё, кроме своих» — это просто словарь, и отдельного состояния
  // под него нет: own=0 не отбор, а мусор в адресе.
  it('«нет» в адрес не пишется и из адреса не читается', () => {
    expect(readFilter(new URLSearchParams('own=0')).own).toBeNull();
    expect(writeFilter({ ...EMPTY_FILTER, own: false }).has('own')).toBe(false);
  });

  it('туда и обратно', () => {
    const params = writeFilter({ ...EMPTY_FILTER, own: true });
    expect(params.get('own')).toBe('1');
    expect(readFilter(params).own).toBe(true);
  });

  it('пустым фильтр с отбором не считается', () => {
    expect(isFilterEmpty({ ...EMPTY_FILTER, own: true })).toBe(false);
  });
});
