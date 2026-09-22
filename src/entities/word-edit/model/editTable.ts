/**
 * Таблицы разбора — шесть групп, по которым идёт просмотр правок.
 *
 * Деление то же, что у партий разбора, и оно не повторяет `pos` один
 * в один: «прилагательное и наречие» — отдельная подпись на лице
 * карточки, а значит и отдельная группа. Слово `schnell` спрашивается
 * иначе, чем `schön`, и смешивать их в одной таблице значит смешивать
 * два разных разбора.
 *
 * Служебные собраны вместе: местоимений, союзов, числительных, частиц
 * и предлогов вместе меньше сотни, и каждому своя вкладка была бы
 * вкладкой на десяток строк.
 */
export const EDIT_TABLES = [
  'Существительные',
  'Глаголы',
  'Наречия',
  'Прилагательные',
  'Прилагательные и наречия',
  'Служебные',
] as const;

export type EditTable = (typeof EDIT_TABLES)[number];

/** Та же раскладка живёт в `scripts/check-deck.mjs` — отчёт и экран считают одинаково. */
export const editTable = (word: { pos: string | null; wortart: string | null }): EditTable => {
  if (word.pos === 'noun') return 'Существительные';
  if (word.pos === 'verb') return 'Глаголы';
  if (word.wortart === 'прилагательное и наречие') return 'Прилагательные и наречия';
  if (word.pos === 'adj') return 'Прилагательные';
  if (word.pos === 'adverb') return 'Наречия';
  return 'Служебные';
};

/** Подпись поля — в журнале хранится имя колонки, человеку нужно слово. */
export const FIELD_LABEL: Record<string, string> = {
  translation: 'перевод',
  register: 'помета',
  definition: 'подсказка',
  rank: 'ранг',
  head: 'заголовок',
  rektion: 'управление',
  examples_de: 'примеры',
  examples_ru: 'переводы примеров',
  wortart: 'часть речи',
  genus: 'род',
};

export const fieldLabel = (field: string): string => FIELD_LABEL[field] ?? field;
