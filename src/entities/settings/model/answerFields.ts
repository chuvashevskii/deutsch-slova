import type { Word } from '@/entities/word';
import { isMissingForm, stripArticle } from '@/shared/lib/german';

import type { AnswerSettings } from './settingsQuery';

export interface AnswerField {
  key: string;
  label: string;
  expected: string;
}

/**
 * Формы с подписями — роды определителя и подобное. Спрашиваются только
 * подписанные: подпись и есть то, что можно спросить. У `vorne / vorn`
 * подписей нет, потому что нет и слотов — это варианты написания,
 * а не парадигма, и поле ввода под них не поставить.
 */
const formFields = (word: Word, settings: AnswerSettings): AnswerField[] => {
  if (!settings.input_forms) return [];
  const labels = word.form_labels ?? [];
  const forms = word.forms ?? [];
  if (labels.length !== forms.length) return [];
  return forms
    .map((expected, index) => ({ key: `forms_${index}`, label: labels[index], expected }))
    .filter((field) => field.expected && !isMissingForm(field.expected));
};

/**
 * Какие формы карточка просит ввести. Раньше набор определялся одной лишь
 * частью речи, теперь — ещё и настройками: печатать пять форм спряжения
 * с телефона долго, и человек вправе прокрутить слово в уме.
 *
 * Пустой список — не ошибка, а обычный случай: карточка тогда показывает
 * «Показать» вместо «Проверить», и правильность не проверяется вовсе.
 */
export const answerFields = (word: Word, settings: AnswerSettings): AnswerField[] => {
  // INFO: формы с подписями не привязаны к части речи: они бывают
  // и у местоимения (jeder / jede / jedes), и у существительного
  // (der Deutsche / die Deutsche). Поэтому добавляются ко всем веткам.
  const extra = formFields(word, settings);

  if (word.pos === 'noun') {
    const fields: AnswerField[] = [];
    if (settings.input_noun_singular && word.singular) {
      fields.push({ key: 'singular', label: 'Singular', expected: stripArticle(word.singular) });
    }
    if (settings.input_noun_plural && word.plural) {
      fields.push({ key: 'plural', label: 'Plural', expected: stripArticle(word.plural) });
    }
    return [...fields, ...extra];
  }

  if (word.pos === 'verb') {
    const fields: AnswerField[] = [];
    if (settings.input_verb_infinitive && word.head) {
      fields.push({ key: 'head', label: 'Infinitiv', expected: word.head });
    }
    if (settings.input_verb_forms) {
      const persons = [
        ['form_ich', 'ich'],
        ['form_du', 'du'],
        ['form_er', 'er/sie/es'],
        ['form_wir', 'wir/sie/Sie'],
        ['form_ihr', 'ihr'],
      ] as const;
      for (const [key, label] of persons) {
        const expected = (word[key] as string | null) ?? '';
        // INFO: прочерк из колоды означает «формы нет» — спрашивать её нельзя.
        if (expected && !isMissingForm(expected)) fields.push({ key, label, expected });
      }
    }
    return [...fields, ...extra];
  }

  const base: AnswerField[] =
    settings.input_other && word.head
      ? [{ key: 'head', label: 'Wort', expected: word.head }]
      : [];
  return [...base, ...extra];
};

/**
 * Спрашивать ли артикль. Настройка отдельная от ввода форм: три кнопки
 * почти ничего не стоят и кормят матрицу путаницы в роде, поэтому они
 * остаются даже там, где печатать ничего не надо.
 */
export const asksGenus = (word: Word, settings: AnswerSettings): boolean =>
  settings.ask_genus && word.pos === 'noun' && Boolean(word.genus);
