import { describe, expect, it } from 'vitest';

import { dativePlural, pluralShown, prepositionShown, prepositionsOf } from './deck-rules.mjs';

/**
 * Проверка колоды трижды ошибалась одинаково: требовала правки там, где
 * карточка всё показывает, просто немецкий пишет это иначе. Такая
 * ошибка дороже пропуска — она заставляет «чинить» здоровое.
 */
describe('множественное в примерах', () => {
  it('засчитывает дательный падеж с падежным -n', () => {
    // «Wir arbeiten an drei Projekten» — это die Projekte, просто в Dativ.
    expect(pluralShown('projekte', 'wir arbeiten an drei projekten gleichzeitig.')).toBe(true);
    expect(pluralShown('teile', 'das buch besteht aus drei teilen.')).toBe(true);
    expect(pluralShown('lehrbücher', 'wir arbeiten mit zwei lehrbüchern.')).toBe(true);
  });

  it('не добавляет -n там, где множественное и так на -n или -s', () => {
    expect(dativePlural('frauen')).toBe('frauen');
    expect(dativePlural('autos')).toBe('autos');
    expect(dativePlural('tage')).toBe('tagen');
  });

  it('по-прежнему ловит карточку, которая множественного не показывает', () => {
    expect(pluralShown('probleme', 'das ist kein problem.')).toBe(false);
    expect(pluralShown('abende', 'guten abend! am abend gehen wir spazieren.')).toBe(false);
  });

  it('не принимает за форму более длинное слово', () => {
    // `Tage` внутри `Tagesordnung` — не множественное число дня.
    expect(pluralShown('tage', 'die tagesordnung ist lang.')).toBe(false);
  });
});

describe('предлог управления в примерах', () => {
  it('засчитывает предлог, слитый с артиклем', () => {
    expect(prepositionShown('zu', 'dieser weg führt zum bahnhof.')).toBe(true);
    expect(prepositionShown('in', 'das museum befindet sich im zentrum.')).toBe(true);
    expect(prepositionShown('bei', 'beim lesen entspanne ich mich.')).toBe(true);
    expect(prepositionShown('an', 'wir gehen am bahnhof vorbei.')).toBe(true);
  });

  it('засчитывает предлог, слипшийся с местоимением', () => {
    // `darüber`, `damit` — управление показано, границу слева не требуем.
    expect(prepositionShown('über', 'er spricht nicht darüber.')).toBe(true);
  });

  it('не засчитывает более длинное слово, начинающееся так же', () => {
    expect(prepositionShown('an', 'die antwort ist falsch.')).toBe(false);
    expect(prepositionShown('in', 'das interesse wächst.')).toBe(false);
  });
});

describe('разбор моделей управления', () => {
  it('достаёт предлог из возвратной модели', () => {
    // Ровно то, на чём разбор молчал: якорь стоял на начале строки,
    // а впереди `sich (Akk.)`.
    expect(prepositionsOf(['sich (Akk.) auf etw. (Akk.)'])).toEqual(['auf']);
    expect(prepositionsOf(['sich (Akk.) von etw. (Dat.)'])).toEqual(['von']);
  });

  it('достаёт предлог из обычной модели', () => {
    expect(prepositionsOf(['an etw. (Dat.)'])).toEqual(['an']);
    expect(prepositionsOf(['etwas (Akk.) an jmdn. (Akk.)'])).toEqual(['an']);
  });

  it('беспредложную модель не выдаёт за предложную', () => {
    expect(prepositionsOf(['ohne Objekt'])).toEqual([]);
    expect(prepositionsOf(['etwas (Akk.)'])).toEqual([]);
    expect(prepositionsOf(['jemanden (Akk.)'])).toEqual([]);
  });

  it('падежную пометку за предлог не принимает', () => {
    expect(prepositionsOf(['sich (Akk.) etw. (Dat.)'])).toEqual([]);
  });

  it('собирает предлоги со всех моделей карточки', () => {
    expect(prepositionsOf(['über etw. (Akk.)', 'sich (Akk.) für etw. (Akk.)'])).toEqual([
      'über',
      'für',
    ]);
  });
});
