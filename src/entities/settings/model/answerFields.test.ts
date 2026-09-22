import { describe, expect, it } from 'vitest';

import type { Word } from '@/entities/word';

import { answerFields } from './answerFields';
import { DEFAULT_SETTINGS } from './settingsQuery';

const word = (overrides: Partial<Word>): Word =>
  ({
    id: 'list-0102',
    pos: 'pronoun',
    head: 'jeder',
    forms: [],
    form_labels: [],
    ...overrides,
  }) as unknown as Word;

const determiner = word({
  forms: ['jeder', 'jede', 'jedes'],
  form_labels: ['der', 'die', 'das'],
});

const variants = word({ head: 'vorne', forms: ['vorne', 'vorn'], form_labels: [] });

const on = { ...DEFAULT_SETTINGS, input_forms: true };

/**
 * Формы по родам можно спрашивать вводом, варианты написания — нет.
 * Подпись и есть то, что спрашивается: без неё непонятно, какую из двух
 * форм ждёт поле, и проверка превратилась бы в угадайку.
 */
describe('ввод форм', () => {
  it('выключен по умолчанию, как и весь ввод', () => {
    expect(answerFields(determiner, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('включённый спрашивает каждую форму под своей подписью', () => {
    expect(answerFields(determiner, on)).toEqual([
      { key: 'forms_0', label: 'der', expected: 'jeder' },
      { key: 'forms_1', label: 'die', expected: 'jede' },
      { key: 'forms_2', label: 'das', expected: 'jedes' },
    ]);
  });

  it('варианты написания не спрашивает: слота у них нет', () => {
    expect(answerFields(variants, on)).toEqual([]);
  });

  it('добавляется к формам существительного, а не вместо них', () => {
    const noun = word({
      pos: 'noun',
      head: 'Deutsche',
      singular: 'der Deutsche',
      plural: 'die Deutschen',
      forms: ['der Deutsche', 'die Deutsche'],
      form_labels: ['м. р.', 'ж. р.'],
    });
    const fields = answerFields(noun, {
      ...on,
      input_noun_singular: true,
      input_noun_plural: true,
    });
    expect(fields.map((field) => field.key)).toEqual([
      'singular',
      'plural',
      'forms_0',
      'forms_1',
    ]);
  });

  it('при разной длине списков не спрашивает ничего — пара разъехалась', () => {
    const broken = word({ forms: ['jeder', 'jede'], form_labels: ['der'] });
    expect(answerFields(broken, on)).toEqual([]);
  });
});
