import { describe, expect, it } from 'vitest';

import { buildHeatmap, dayKey } from './statsFormat';

const weekday = (key: string) => new Date(`${key}T00:00:00`).getDay();

describe('сетка активности', () => {
  it('всегда начинается с понедельника — иначе строки разъезжаются с подписями', () => {
    // Вторник: именно на таком дне сетка и сбивалась, рисуя сегодня в «пн».
    const { cells } = buildHeatmap({}, new Date(2026, 8, 22), 16);
    expect(weekday(cells[0].key)).toBe(1);
    expect(weekday(cells[7].key)).toBe(1);
  });

  it('прямоугольная: остаток текущей недели занимают клетки будущего', () => {
    const { cells } = buildHeatmap({}, new Date(2026, 8, 22), 16);
    expect(cells).toHaveLength(16 * 7);
    expect(cells.filter((cell) => cell.future)).toHaveLength(5);
  });

  it('сегодня попадает в сетку и будущим не считается', () => {
    const today = new Date(2026, 8, 22);
    const { cells, todayKey } = buildHeatmap({}, today, 16);
    const cell = cells.find((item) => item.key === todayKey);
    expect(cell).toBeDefined();
    expect(cell?.future).toBe(false);
    expect(todayKey).toBe(dayKey(today));
  });

  it('воскресенье не ломает выравнивание', () => {
    const { cells } = buildHeatmap({}, new Date(2026, 8, 27), 4);
    expect(weekday(cells[0].key)).toBe(1);
    expect(cells.filter((cell) => cell.future)).toHaveLength(0);
  });

  it('насыщенность считается от самого деятельного дня', () => {
    const { max } = buildHeatmap({ '2026-09-21': 7, '2026-09-22': 3 }, new Date(2026, 8, 22), 4);
    expect(max).toBe(7);
  });
});
