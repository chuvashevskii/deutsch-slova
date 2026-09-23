import { describe, expect, it } from 'vitest';

import { determinerForms } from './determiner';

/**
 * Основа задана в списке руками, потому что вычислить её нельзя,
 * и первая попытка это доказала: общее начало `jeder / jede / jedes`
 * — это `jede`, и женское окончание `-e` в него проваливается целиком.
 * Карточка тогда утверждала, что в женском роде окончания нет.
 */
describe('окончания определителя', () => {
  it('у der-слова окончание есть во всех трёх родах', () => {
    expect(determinerForms('jeder')).toMatchObject({
      stem: 'jed',
      endings: ['-er', '-e', '-es'],
    });
  });

  it('основа не проглатывает женское окончание', () => {
    // Ровно то, на чём сломалось вычисление: `jede` + «r», «», «s».
    for (const head of ['jeder', 'mancher', 'solcher', 'welcher']) {
      const pattern = determinerForms(head);
      expect(pattern?.endings[1], head).toBe('-e');
      expect(pattern?.stem.endsWith('e'), head).toBe(false);
    }
  });

  it('у ein-слова в мужском и среднем окончания нет, и это написано знаком', () => {
    // Пустая строка читалась бы как «забыли заполнить», а здесь пусто
    // по правилу: kein Mann, keine Frau, kein Kind.
    expect(determinerForms('kein')).toMatchObject({
      stem: 'kein',
      endings: ['—', '-e', '—'],
    });
    expect(determinerForms('irgendein')?.endings).toEqual(['—', '-e', '—']);
  });

  it('основа и окончания складываются в настоящие формы', () => {
    for (const head of ['jeder', 'mancher', 'solcher', 'welcher', 'kein', 'irgendein']) {
      const pattern = determinerForms(head);
      if (!pattern) throw new Error(`нет образца для ${head}`);
      const built = pattern.endings.map((ending) =>
        ending === '—' ? pattern.stem : pattern.stem + ending.slice(1),
      );
      expect(built, head).toEqual(pattern.forms);
    }
  });

  it('у derselbe основы нет: меняется артикль внутри слова', () => {
    const pattern = determinerForms('derselbe');
    expect(pattern?.stem).toBe('');
    expect(pattern?.forms).toEqual(['derselbe', 'dieselbe', 'dasselbe']);
  });

  it('слово, которое по роду не меняется, образца не имеет', () => {
    for (const head of ['man', 'nichts', 'wer', 'etwas', 'jemand', 'alle']) {
      expect(determinerForms(head), head).toBeNull();
    }
  });

  it('регистр заголовка не важен', () => {
    expect(determinerForms('Jeder')?.stem).toBe('jed');
  });
});
