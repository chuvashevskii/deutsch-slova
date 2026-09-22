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

export interface HeatmapCell {
  key: string;
  count: number;
  /** День ещё не наступил: место в сетке есть, дня нет. */
  future: boolean;
}

/**
 * Сетка активности: строки — дни недели от понедельника, столбцы — недели.
 *
 * Сетка выравнивается по понедельнику и всегда прямоугольная. Раньше она
 * начиналась с произвольного дня, и строки разъезжались с подписями:
 * сегодняшний вторник рисовался в строке «пн». Последняя неделя ещё
 * и обрывалась на сегодняшнем дне, отчего сетка выглядела обрезанной —
 * теперь остаток недели занимают пустые клетки будущего.
 */
export const buildHeatmap = (
  perDay: Record<string, number>,
  today: Date,
  weeks: number,
): { cells: HeatmapCell[]; max: number; weeks: number; todayKey: string } => {
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - mondayOffset - (weeks - 1) * 7);

  const todayKey = dayKey(today);
  const cells: HeatmapCell[] = [];
  for (let step = 0; step < weeks * 7; step += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + step);
    const key = dayKey(date);
    cells.push({ key, count: perDay[key] ?? 0, future: key > todayKey });
  }
  return { cells, max: Math.max(1, ...Object.values(perDay)), weeks, todayKey };
};
