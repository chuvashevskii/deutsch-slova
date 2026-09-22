/**
 * Планировщик повторений на FSRS (ts-fsrs).
 *
 * Одна карточка — одна оценка: промах в любой форме отправляет всё слово
 * заново, как в Anki. Состояние карточки хранится в таблице cards,
 * каждый ответ пишется в reviews — на этом журнале в будущем можно
 * подогнать параметры под конкретного человека.
 */
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';

import type { Tables } from '@/shared/api';

export type CardRow = Tables<'cards'>;

/** Кнопки на обороте карточки. Числа совпадают с Rating из ts-fsrs. */
export const ANSWER_RATINGS = [
  { rating: Rating.Again, label: 'Снова' },
  { rating: Rating.Hard, label: 'Трудно' },
  { rating: Rating.Good, label: 'Хорошо' },
  { rating: Rating.Easy, label: 'Легко' },
] as const;

export const DEFAULT_RETENTION = 0.9;

const createScheduler = (desiredRetention: number = DEFAULT_RETENTION) =>
  fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: true }));

/** Состояние новой, ещё не показанной карточки. */
export const emptyCard = (): FsrsCard => createEmptyCard();

/** Строка из базы → состояние для ts-fsrs. */
export const toFsrsCard = (row: CardRow | undefined): FsrsCard => {
  if (!row) return createEmptyCard();
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
    learning_steps: row.learning_steps,
  };
};

export interface ScheduledOutcome {
  card: FsrsCard;
  log: RecordLogItem['log'];
}

/** Считает новое состояние карточки после ответа. */
export const applyRating = (
  current: FsrsCard,
  rating: Grade,
  reviewedAt: Date,
  desiredRetention: number = DEFAULT_RETENTION,
): ScheduledOutcome => {
  const scheduled = createScheduler(desiredRetention).next(current, reviewedAt, rating);
  return { card: scheduled.card, log: scheduled.log };
};

/** Предпросмотр сроков для подписей на кнопках. */
export const previewIntervals = (
  current: FsrsCard,
  now: Date,
  desiredRetention: number = DEFAULT_RETENTION,
): Record<Grade, Date> => {
  const record = createScheduler(desiredRetention).repeat(current, now);
  return {
    [Rating.Again]: record[Rating.Again].card.due,
    [Rating.Hard]: record[Rating.Hard].card.due,
    [Rating.Good]: record[Rating.Good].card.due,
    [Rating.Easy]: record[Rating.Easy].card.due,
  };
};

/** «Знаю» — как mature в Anki: интервал от 21 дня. */
export const MATURE_DAYS = 21;

export type KnowledgeStatus = 'new' | 'learning' | 'known';

export const knowledgeStatus = (row: CardRow | undefined): KnowledgeStatus => {
  if (!row || row.state === State.New) return 'new';
  return row.scheduled_days >= MATURE_DAYS ? 'known' : 'learning';
};

/**
 * Статус в списке. К трём состояниям планировщика добавляется четвёртое —
 * объявленное человеком «знаю». Оно намеренно не сливается с заслуженным:
 * одно набрано растущими интервалами, другое поставлено кнопкой.
 */
export type ListStatus = KnowledgeStatus | 'declared';

export const STATUS_LABEL: Record<ListStatus, string> = {
  new: 'новое',
  learning: 'учу',
  known: 'знаю',
  declared: 'знаю сам',
};

/** Человекочитаемый срок до следующего показа. */
export const formatInterval = (from: Date, to: Date): string => {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} мин`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} дн`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} мес`;
  return `${(days / 365).toFixed(1)} г`;
};

export { Rating, State };
export type { FsrsCard, Grade };
