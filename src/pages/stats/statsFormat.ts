/**
 * Ключ дня по местному времени. Через toISOString нельзя: он переводит
 * в UTC, и вечером ключ уезжал бы на сутки вперёд — прогноз и тепловая
 * карта переставали бы совпадать.
 */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** «12 ответов» — с правильным окончанием, иначе подпись читается как машинная. */
export const plural = (count: number, one: string, few: string, many: string): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
