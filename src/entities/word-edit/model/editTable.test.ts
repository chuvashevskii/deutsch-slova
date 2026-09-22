import { describe, expect, it } from 'vitest';

import { EDIT_MODES, matchesMode, type EditMode } from './editFilter';
import { EDIT_TABLES, editTable, fieldLabel } from './editTable';

/**
 * Раскладка по таблицам повторяет ту, что считает `scripts/check-deck.mjs`.
 * Разойдись они — отчёт и экран показывали бы разные числа об одной работе,
 * и верить было бы нечему.
 */
describe('таблицы разбора', () => {
  it('существительное и глагол — по части речи', () => {
    expect(editTable({ pos: 'noun', wortart: null })).toBe('Существительные');
    expect(editTable({ pos: 'verb', wortart: null })).toBe('Глаголы');
  });

  it('«прилагательное и наречие» — своя таблица, а не прилагательные', () => {
    // На лице карточки у них своя подпись, значит и разбор свой.
    expect(editTable({ pos: 'adj', wortart: 'прилагательное и наречие' })).toBe(
      'Прилагательные и наречия',
    );
    expect(editTable({ pos: 'adj', wortart: 'прилагательное' })).toBe('Прилагательные');
  });

  it('вопросительное наречие идёт к наречиям', () => {
    expect(editTable({ pos: 'adverb', wortart: 'вопросительное наречие' })).toBe('Наречия');
    expect(editTable({ pos: 'adverb', wortart: 'наречие' })).toBe('Наречия');
  });

  it('всё мелкое собрано в служебные', () => {
    for (const pos of ['pronoun', 'conjunction', 'numeral', 'particle', 'preposition']) {
      expect(editTable({ pos, wortart: null })).toBe('Служебные');
    }
  });

  it('незнакомая часть речи не теряется: попадает в служебные', () => {
    // Потерянная строка хуже строки не на своём месте: её не видно вовсе.
    expect(editTable({ pos: 'interjection', wortart: null })).toBe('Служебные');
    expect(editTable({ pos: null, wortart: null })).toBe('Служебные');
  });

  it('каждая таблица из списка достижима', () => {
    const reached = new Set([
      editTable({ pos: 'noun', wortart: null }),
      editTable({ pos: 'verb', wortart: null }),
      editTable({ pos: 'adverb', wortart: 'наречие' }),
      editTable({ pos: 'adj', wortart: 'прилагательное' }),
      editTable({ pos: 'adj', wortart: 'прилагательное и наречие' }),
      editTable({ pos: 'particle', wortart: null }),
    ]);
    expect([...reached].sort()).toEqual([...EDIT_TABLES].sort());
  });
});

describe('подпись поля', () => {
  it('называет колонку по-человечески', () => {
    expect(fieldLabel('register')).toBe('помета');
    expect(fieldLabel('definition')).toBe('подсказка');
  });

  it('незнакомую колонку показывает как есть, а не прячет', () => {
    expect(fieldLabel('corpus_share')).toBe('corpus_share');
  });
});

const row = (
  over: Partial<{
    reverted_at: string | null;
    disputed: boolean;
    reason: string;
    superseded: boolean;
  }>,
) => ({
  reverted_at: null,
  disputed: false,
  reason: 'уровень 2',
  superseded: false,
  ...over,
});

describe('отбор правок', () => {
  it('«все» берёт действующие правки любого повода', () => {
    expect(matchesMode(row({ reason: 'формат' }), 'all')).toBe(true);
    expect(matchesMode(row({ reason: 'разделение' }), 'all')).toBe(true);
  });

  it('откаченная правка не попадает ни в один рабочий отбор', () => {
    // Она больше не описывает словарь: показать её рядом с действующими
    // значит выдать отменённое за правду.
    const reverted = row({ reverted_at: '2026-09-22T10:00:00Z', disputed: true });
    for (const mode of EDIT_MODES.map((m) => m.key).filter((k) => k !== 'reverted')) {
      expect(matchesMode(reverted, mode), mode).toBe(false);
    }
    expect(matchesMode(reverted, 'reverted')).toBe(true);
  });

  it('«откаченные» показывают только их', () => {
    expect(matchesMode(row({}), 'reverted')).toBe(false);
  });

  it('«спорные» — только помеченные', () => {
    expect(matchesMode(row({ disputed: true }), 'disputed')).toBe(true);
    expect(matchesMode(row({ disputed: false }), 'disputed')).toBe(false);
  });

  it('«пересечения» — три уровня правила, но не формат и не ранг', () => {
    for (const reason of ['уровень 1', 'уровень 2', 'уровень 3']) {
      expect(matchesMode(row({ reason }), 'collisions'), reason).toBe(true);
    }
    for (const reason of ['формат', 'ранг', 'разделение', 'прочее']) {
      expect(matchesMode(row({ reason }), 'collisions'), reason).toBe(false);
    }
  });

  it('перекрытая правка не попадает в рабочие отборы', () => {
    // Поверх неё легла вторая правка того же поля: строка показывала бы
    // «стало» тем, чего в словаре уже нет.
    const old = row({ superseded: true, disputed: true });
    for (const mode of EDIT_MODES.map((m) => m.key).filter((k) => k !== 'reverted')) {
      expect(matchesMode(old, mode), mode).toBe(false);
    }
  });

  it('«разделённые» — только разделение', () => {
    expect(matchesMode(row({ reason: 'разделение' }), 'splits')).toBe(true);
    expect(matchesMode(row({ reason: 'уровень 3' }), 'splits')).toBe(false);
  });

  it('у каждого отбора своя подпись', () => {
    const keys = EDIT_MODES.map((m) => m.key as EditMode);
    expect(new Set(keys).size).toBe(keys.length);
    expect(EDIT_MODES.every((m) => m.label.length > 0)).toBe(true);
  });
});
