import { describe, expect, it } from 'vitest';

import {
  applyRating,
  emptyCard,
  toFsrsCard,
  formatInterval,
  knowledgeStatus,
  previewIntervals,
  Rating,
  State,
  type CardRow,
  type Grade,
} from './scheduler';

const NOW = new Date('2026-09-21T09:00:00.000Z');

const rowFrom = (overrides: Partial<CardRow>): CardRow => ({
  user_id: '00000000-0000-0000-0000-000000000000',
  word_id: 'w1',
  due: NOW.toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: State.New,
  learning_steps: 0,
  last_review: null,
  updated_at: NOW.toISOString(),
  ...overrides,
});

describe('applyRating', () => {
  it('переводит новую карточку в обучение и назначает срок в будущем', () => {
    const { card } = applyRating(emptyCard(), Rating.Good, NOW);
    expect(card.state).toBe(State.Learning);
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.reps).toBe(1);
  });

  it('«Легко» отодвигает дальше, чем «Хорошо»', () => {
    const good = applyRating(emptyCard(), Rating.Good, NOW).card;
    const easy = applyRating(emptyCard(), Rating.Easy, NOW).card;
    expect(easy.due.getTime()).toBeGreaterThan(good.due.getTime());
  });

  it('«Снова» на зрелой карточке считает промах и роняет срок', () => {
    const mature = applyRating(emptyCard(), Rating.Easy, NOW).card;
    const later = new Date(mature.due.getTime());
    const relearned = applyRating(mature, Rating.Again, later).card;
    expect(relearned.lapses).toBe(1);
    expect(relearned.scheduled_days).toBeLessThan(mature.scheduled_days);
  });

  it('копит стабильность после выпуска из обучения', () => {
    // «Легко» сразу выпускает карточку в повторения, дальше успех растит стабильность
    const graduated = applyRating(emptyCard(), Rating.Easy, NOW).card;
    expect(graduated.state).toBe(State.Review);
    const repeated = applyRating(graduated, Rating.Good, new Date(graduated.due)).card;
    expect(repeated.stability).toBeGreaterThan(graduated.stability);
    expect(repeated.scheduled_days).toBeGreaterThan(graduated.scheduled_days);
  });
});

describe('previewIntervals', () => {
  it('возвращает срок для каждой из четырёх кнопок по возрастанию', () => {
    const preview = previewIntervals(emptyCard(), NOW);
    expect(preview[Rating.Again].getTime()).toBeLessThanOrEqual(preview[Rating.Hard].getTime());
    expect(preview[Rating.Hard].getTime()).toBeLessThanOrEqual(preview[Rating.Good].getTime());
    expect(preview[Rating.Good].getTime()).toBeLessThanOrEqual(preview[Rating.Easy].getTime());
  });
});

describe('knowledgeStatus', () => {
  it('без строки в базе слово новое', () => {
    expect(knowledgeStatus(undefined)).toBe('new');
  });

  it('карточка в состоянии New остаётся новой', () => {
    expect(knowledgeStatus(rowFrom({ state: State.New }))).toBe('new');
  });

  it('интервал меньше 21 дня — это «учу»', () => {
    expect(knowledgeStatus(rowFrom({ state: State.Review, scheduled_days: 10 }))).toBe('learning');
  });

  it('интервал от 21 дня — это «знаю»', () => {
    expect(knowledgeStatus(rowFrom({ state: State.Review, scheduled_days: 21 }))).toBe('known');
  });
});

describe('formatInterval', () => {
  it('минуты, часы, дни и месяцы', () => {
    expect(formatInterval(NOW, new Date(NOW.getTime() + 60_000))).toBe('1 мин');
    expect(formatInterval(NOW, new Date(NOW.getTime() + 3 * 3_600_000))).toBe('3 ч');
    expect(formatInterval(NOW, new Date(NOW.getTime() + 5 * 86_400_000))).toBe('5 дн');
    expect(formatInterval(NOW, new Date(NOW.getTime() + 60 * 86_400_000))).toBe('2 мес');
  });

  it('никогда не показывает ноль минут', () => {
    expect(formatInterval(NOW, new Date(NOW.getTime() + 1_000))).toBe('1 мин');
  });
});

/**
 * Раньше тесты гоняли планировщик в памяти, и дефект прошёл мимо них:
 * в живом приложении карточка каждый раз читается из базы, а номер шага
 * заучивания там не хранился. «Хорошо» бесконечно возвращало слово через
 * десять минут. Этот блок ходит именно через сохранение и чтение.
 */
describe('карточка через сохранение в базу', () => {
  /** Ровно те поля, что уходят в cards и читаются обратно. */
  const roundTrip = (card: ReturnType<typeof emptyCard>, reviewedAt: Date) =>
    toFsrsCard(
      rowFrom({
        due: card.due.toISOString(),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        learning_steps: card.learning_steps,
        last_review: reviewedAt.toISOString(),
      }),
    );

  /** Отвечает подряд, всякий раз приходя ровно в назначенный срок. */
  const answerSeries = (grades: Grade[], throughDatabase: boolean) => {
    let card = emptyCard();
    let now = NOW;
    const intervals: number[] = [];
    for (const grade of grades) {
      const reviewedAt = now;
      const next = applyRating(card, grade, reviewedAt).card;
      intervals.push(next.due.getTime() - reviewedAt.getTime());
      card = throughDatabase ? roundTrip(next, reviewedAt) : next;
      now = new Date(next.due);
    }
    return { intervals, card };
  };

  it('«Хорошо» подряд удлиняет сроки, а не топчется на месте', () => {
    const { intervals } = answerSeries(Array(6).fill(Rating.Good) as Grade[], true);
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
  });

  it('сохранение не меняет расписание: через базу так же, как в памяти', () => {
    const grades = [Rating.Good, Rating.Good, Rating.Hard, Rating.Good, Rating.Again, Rating.Good] as Grade[];
    expect(answerSeries(grades, true).intervals).toEqual(answerSeries(grades, false).intervals);
  });

  it('карточка выходит из заучивания и дорастает до «знаю»', () => {
    const { card } = answerSeries(Array(5).fill(Rating.Good) as Grade[], true);
    expect(card.state).toBe(State.Review);
    expect(knowledgeStatus(rowFrom({ state: card.state, scheduled_days: card.scheduled_days }))).toBe('known');
  });

  it('номер шага заучивания переживает сохранение', () => {
    const learning = applyRating(emptyCard(), Rating.Good, NOW).card;
    expect(roundTrip(learning, NOW).learning_steps).toBe(learning.learning_steps);
  });
});
