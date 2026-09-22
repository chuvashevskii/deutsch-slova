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
 * Стилистическая помета — русская половина строки «umgangssprachlich ·
 * разговорный».
 *
 * Нейтральный регистр показывается наравне с остальными, хотя раньше
 * скрывался как «состояние по умолчанию». Рассуждение было верным для
 * одиночного слова и неверным для группы: помета ставится только там,
 * где у слова есть сосед по переводу, и тогда молчание об одном из них
 * возвращает ровно ту неоднозначность, ради которой помета заведена.
 * Увидев «Получать · разговорный» и «Получать · книжный», человек ждёт
 * третьего ярлыка у `bekommen`, а не пустого места.
 *
 * Помета не разбирается по словарю: русская половина берётся как есть.
 * Перечисление пришлось бы править всякий раз, когда в колоде заведут
 * новую помету, и `derb` у `scheißen` уже показал, чем это кончается —
 * слово молчало, потому что его пометы не было в списке.
 */
export const registerLabel = (register: string | null): string | null => {
  if (!register) return null;
  const russian = register.split('·')[1]?.trim();
  if (russian) return russian;
  // INFO: помета без русской половины — форма, которую убрала миграция
  // 20260922310000. Разбор оставлен на случай базы, до которой она
  // ещё не доехала: лучше показать подпись, чем промолчать.
  const lower = register.toLowerCase();
  if (lower.includes('umgang')) return 'разговорный';
  if (lower.includes('formell')) return 'книжный';
  if (lower.includes('neutral')) return 'нейтральный';
  if (lower.includes('derb')) return 'грубый';
  return null;
};
