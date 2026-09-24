import { describe, expect, it } from 'vitest';

import { describeSources, LEARN_SOURCES, readSources, toggleSource } from './learnSources';

describe('источники очереди', () => {
  it('пусто значит вся колода', () => {
    expect(readSources([])).toEqual([]);
    expect(readSources(null)).toEqual([]);
    expect(describeSources([])).toBe('вся колода');
  });

  // Значение из более новой схемы не должно ронять экран и не должно
  // молча притворяться отмеченной галочкой.
  it('незнакомое значение отбрасывается', () => {
    expect(readSources(['own', 'что-то-новое'])).toEqual(['own']);
  });

  it('порядок задаёт список, а не нажатия', () => {
    expect(readSources(['requested', 'rankless'])).toEqual(['rankless', 'requested']);
    expect(toggleSource(['requested'], 'rankless')).toEqual(['rankless', 'requested']);
  });

  it('переключение туда и обратно', () => {
    expect(toggleSource([], 'own')).toEqual(['own']);
    expect(toggleSource(['own'], 'own')).toEqual([]);
  });

  it('повторное включение не задваивает', () => {
    expect(toggleSource(['own'], 'requested')).toEqual(['own', 'requested']);
    expect(toggleSource(toggleSource(['own'], 'requested'), 'requested')).toEqual(['own']);
  });

  it('описание перечисляет выбранное', () => {
    expect(describeSources(['own', 'requested'])).toBe(
      'заведённые руками + отмеченные «учить сегодня»',
    );
  });

  // Значения — часть схемы: у колонки стоит проверка на этот же список.
  it('значения совпадают с разрешёнными в базе', () => {
    expect(LEARN_SOURCES.map((s) => s.value)).toEqual(['rankless', 'own', 'requested']);
  });
});
