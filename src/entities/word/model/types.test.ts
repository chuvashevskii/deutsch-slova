import { describe, expect, it } from 'vitest';

import { posLabel, registerLabel } from './types';

const word = (pos: string, wortart: string | null = null) => ({ pos, wortart });

describe('подпись части речи', () => {
  it('берётся из части речи, когда уточнения нет', () => {
    expect(posLabel(word('noun'))).toBe('сущ.');
    expect(posLabel(word('verb'))).toBe('глаг.');
  });

  it('уточнение из колоды важнее части речи', () => {
    expect(posLabel(word('adj', 'наречие'))).toBe('нареч.');
    expect(posLabel(word('adj', 'прилагательное и наречие'))).toBe('прил. · нареч.');
  });

  it('называет часть речи, но не разряд внутри неё', () => {
    expect(posLabel(word('adverb', 'вопросительное наречие'))).toBe('нареч.');
    expect(posLabel(word('pronoun', 'вопросительное местоимение'))).toBe('мест.');
    expect(posLabel(word('numeral', 'количественное слово'))).toBe('числ.');
  });

  it('сводит формулы вежливости и устойчивые сочетания к одному слову', () => {
    expect(posLabel(word('particle', 'формула вежливости'))).toBe('оборот');
    expect(posLabel(word('particle', 'устойчивый оборот'))).toBe('оборот');
  });

  it('незнакомое уточнение не скрывает часть речи', () => {
    expect(posLabel(word('verb', 'нечто небывалое'))).toBe('глаг.');
  });

  it('незнакомая часть речи показывается как есть, а не пустотой', () => {
    expect(posLabel(word('interjection'))).toBe('interjection');
  });

  it('каждая подпись умещается в шесть знаков', () => {
    const singles = ['noun', 'verb', 'adj', 'adverb', 'pronoun', 'preposition', 'conjunction', 'numeral', 'particle'];
    for (const pos of singles) expect(posLabel(word(pos)).length).toBeLessThanOrEqual(6);
  });
});

describe('стилистическая помета', () => {
  it('узнаёт разговорный и книжный в обоих написаниях', () => {
    expect(registerLabel('umgangssprachlich · разговорный')).toBe('разговорный');
    expect(registerLabel('formell · книжный')).toBe('книжный');
  });

  it('молчит про нейтральный: это состояние по умолчанию', () => {
    expect(registerLabel('neutral · нейтральный')).toBeNull();
  });

  it('молчит и про пустое, и про незнакомое — не выдумывает помету', () => {
    expect(registerLabel(null)).toBeNull();
    expect(registerLabel('')).toBeNull();
    expect(registerLabel('gehoben')).toBeNull();
  });
});
