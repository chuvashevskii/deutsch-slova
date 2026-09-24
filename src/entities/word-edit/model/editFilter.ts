import type { EditRow } from './editsQuery';

/**
 * Отборы внутри таблицы.
 *
 * «Спорные» стоят первыми не по алфавиту: это строки, где правило дало
 * несколько допустимых решений и выбрал я. Остальное можно пролистать,
 * эти — надо посмотреть.
 */
export const EDIT_MODES = [
  { key: 'disputed', label: 'спорные' },
  { key: 'all', label: 'все' },
  { key: 'collisions', label: 'пересечения' },
  { key: 'splits', label: 'рождённые' },
  { key: 'reverted', label: 'откаченные' },
] as const;

export type EditMode = (typeof EDIT_MODES)[number]['key'];

/** Уровни правила однозначности — то, ради чего затеян разбор. */
const LEVELS = new Set(['уровень 1', 'уровень 2', 'уровень 3']);

/**
 * Попадает ли правка в отбор.
 *
 * Из рабочих отборов выпадают две породы строк, и по одной причине:
 * они больше не описывают словарь.
 *
 * **Откаченная** отменена человеком. **Перекрытая** — та, поверх которой
 * легла вторая правка того же поля: у `und` подсказку сперва укоротили,
 * потом сняли вовсе, и первая строка показывала «стало: соединяет
 * слова…», когда подсказки уже не было.
 *
 * Держать их рядом с действующими значит показывать как правду то, что
 * правдой быть перестало. Посмотреть можно, но отдельно и намеренно.
 */
export const matchesMode = (
  row: Pick<EditRow, 'reverted_at' | 'disputed' | 'reason' | 'superseded'>,
  mode: EditMode,
): boolean => {
  if (mode === 'reverted') return row.reverted_at !== null;
  if (row.reverted_at !== null) return false;
  if (row.superseded === true) return false;
  if (mode === 'all') return true;
  if (mode === 'disputed') return row.disputed === true;
  // INFO: отбор о рождении карточки, а не только о разделении:
  // заведённая руками появляется тем же образом — строкой с пустым
  // «было», — и откатывается тем же удалением.
  if (mode === 'splits') return row.reason === 'разделение' || row.reason === 'создание';
  return LEVELS.has(row.reason ?? '');
};
