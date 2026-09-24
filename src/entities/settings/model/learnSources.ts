/**
 * Откуда очередь берёт слова.
 *
 * Был один переключатель — «только слова вне частотного списка».
 * Набор вместо него, потому что просьба была уметь то же для своих
 * карточек и для отмеченных «учить сегодня», **и сочетать их**.
 * Три отдельных флага здесь не работают: «только безранговые» плюс
 * «только свои» — это либо пересечение, в котором почти всегда пусто,
 * либо объединение, и по двум галочкам не угадать, что имелось в виду.
 *
 * Набор отвечает однозначно: отмеченные источники складываются по «или»,
 * пустой набор значит всю колоду.
 */
export const LEARN_SOURCES = [
  {
    value: 'rankless',
    label: 'Вне частотного списка',
    hint: 'Составные существительные, женские формы профессий, обороты с sein — их нет в списке 4500.',
  },
  {
    value: 'own',
    label: 'Заведённые руками',
    hint: 'Карточки, собранные в приложении. У них номер вида my-0007.',
  },
  {
    value: 'requested',
    label: 'Отмеченные «учить сегодня»',
    hint: 'То, что вы сами выбрали в словаре кнопкой «Учить сегодня».',
  },
] as const;

export type LearnSource = (typeof LEARN_SOURCES)[number]['value'];

const KNOWN = new Set<string>(LEARN_SOURCES.map((s) => s.value));

/**
 * Приводит хранимое к тому, что умеет показать экран.
 *
 * База ограничена проверкой, но чужое значение может приехать из более
 * новой версии схемы, а порядок — из чего угодно. Экран не должен
 * от этого молча переставать отмечать галочку.
 */
export const readSources = (stored: string[] | null | undefined): LearnSource[] =>
  LEARN_SOURCES.map((s) => s.value).filter((value) => (stored ?? []).includes(value));

/** Переключение одного источника. Порядок задаёт список, а не нажатия. */
export const toggleSource = (current: string[] | null | undefined, value: LearnSource) => {
  const now = new Set(readSources(current));
  if (now.has(value)) now.delete(value);
  else now.add(value);
  return LEARN_SOURCES.map((s) => s.value).filter((v) => now.has(v));
};

/** Что показать одной строкой: «вся колода» или перечисление. */
export const describeSources = (stored: string[] | null | undefined): string => {
  const chosen = readSources(stored);
  if (!chosen.length) return 'вся колода';
  return LEARN_SOURCES.filter((s) => chosen.includes(s.value))
    .map((s) => s.label.toLowerCase())
    .join(' + ');
};

export const isKnownSource = (value: string): value is LearnSource => KNOWN.has(value);
