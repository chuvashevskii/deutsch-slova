import type { Tables } from '@/shared/api';

export type Word = Tables<'words'>;
export type PartOfSpeech = Word['pos'];

/**
 * Короткая подпись части речи для строки списка. Каждая — не длиннее шести
 * знаков; точка означает, что слово урезано. «Союз» короче уже не станет,
 * поэтому стоит целиком и без точки.
 */
const POS_LABEL: Record<string, string> = {
  noun: 'сущ.',
  verb: 'глаг.',
  adj: 'прил.',
  adverb: 'нареч.',
  pronoun: 'мест.',
  preposition: 'предл.',
  conjunction: 'союз',
  numeral: 'числ.',
  particle: 'част.',
};

/**
 * Уточнение из колоды Anki: там прилагательные и наречия в одном типе.
 * Подпись называет только часть речи. Разряд внутри неё — вопросительное,
 * количественное — виден из самого слова и в подписи не повторяется.
 */
const WORTART_LABEL: Record<string, string> = {
  'прилагательное': 'прил.',
  'наречие': 'нареч.',
  'прилагательное и наречие': 'прил. · нареч.',
  'вопросительное наречие': 'нареч.',
  'вопросительное местоимение': 'мест.',
  'формула вежливости': 'оборот',
  'устойчивый оборот': 'оборот',
  'предлог': 'предл.',
  'количественное слово': 'числ.',
};

/** Подпись части речи. Принимает и полное слово, и строку списка. */
export const posLabel = (word: { pos: string; wortart: string | null }): string =>
  WORTART_LABEL[word.wortart ?? ''] ?? POS_LABEL[word.pos] ?? word.pos;

export const VERB_PERSONS = [
  { key: 'form_ich', label: 'ich', audio: 'audio_ich' },
  { key: 'form_du', label: 'du', audio: 'audio_du' },
  { key: 'form_er', label: 'er/sie/es', audio: 'audio_er' },
  { key: 'form_wir', label: 'wir/sie/Sie', audio: 'audio_wir' },
  { key: 'form_ihr', label: 'ihr', audio: 'audio_ihr' },
] as const satisfies ReadonlyArray<{ key: keyof Word; label: string; audio: keyof Word }>;

/**
 * Стилистическая помета. Нейтральный регистр — состояние по умолчанию, и
 * подпись о нём не сообщает ничего, поэтому её нет: плашка появляется только
 * там, где слово из нейтрального выбивается. Незнакомая помета тоже молчит —
 * лучше промолчать, чем назвать её нейтральной наугад.
 */
export const registerLabel = (register: string | null): string | null => {
  if (!register) return null;
  const lower = register.toLowerCase();
  if (lower.includes('umgang') || lower.includes('разговор')) return 'разговорный';
  if (lower.includes('formell') || lower.includes('книжн')) return 'книжный';
  return null;
};
