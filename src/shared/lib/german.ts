/**
 * Разбор немецких словоформ для показа на обороте карточки:
 * ударение, суффикс существительного, окончание множественного числа,
 * чередование с умлаутом, отделяемая приставка и управление глагола.
 *
 * Логика перенесена из шаблонов личной колоды Anki. Результат —
 * массив сегментов, а не HTML-строка: React рисует его сам.
 */

const COMBINING_ACUTE = '́';
const VOWELS = 'aeiouäöüy';
const DIGRAPHS = ['ei', 'ai', 'au', 'eu', 'äu', 'ie', 'ey', 'ay', 'oi', 'ui', 'oe', 'ee', 'aa', 'oo'];
const ARTICLE_PATTERN = /^\s*(der|die|das)\s+/i;
const UMLAUT_BASE: Record<string, string> = { ä: 'a', ö: 'o', ü: 'u', Ä: 'A', Ö: 'O', Ü: 'U' };

export type MarkKind = 'suffix' | 'ending' | 'umlaut' | 'prefix';

export interface Segment {
  text: string;
  mark: MarkKind | null;
}

interface MarkRange {
  start: number;
  end: number;
  kind: MarkKind;
}

/** Сравнение ответа: умляуты раскрываются, поэтому «schoen» равно «schön». */
export const canon = (value: string): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z]/g, '');

export const stripArticle = (value: string): string => (value ?? '').replace(ARTICLE_PATTERN, '').trim();

export const isMissingForm = (value: string | null | undefined): boolean =>
  !value || /^[—–-]$/.test(value.trim());

/**
 * Позиция гласной под ударением. Спецификация — «2» или «1.2»,
 * где первое число это номер гласной группы, второе — смещение внутри дифтонга.
 * Возвращает индекс символа, после которого ставится знак ударения, или -1.
 */
export const stressPosition = (word: string, spec: string | null | undefined): number => {
  if (!spec || !word) return -1;
  const [rawIndex, rawOffset] = String(spec).split('.');
  const targetGroup = Number.parseInt(rawIndex, 10);
  const offset = rawOffset ? Number.parseInt(rawOffset, 10) : 1;
  if (!targetGroup) return -1;

  const articleMatch = word.match(ARTICLE_PATTERN);
  let position = articleMatch ? articleMatch[0].length : 0;
  let group = 0;

  while (position < word.length) {
    const current = word.charAt(position).toLowerCase();
    if (VOWELS.includes(current)) {
      group += 1;
      const pair = (current + (word.charAt(position + 1) || '')).toLowerCase();
      const groupLength = DIGRAPHS.includes(pair) ? 2 : 1;
      if (group === targetGroup) return position + Math.min(offset, groupLength) - 1;
      position += groupLength;
    } else {
      position += 1;
    }
  }
  return -1;
};

const tailRange = (word: string, tail: string | null | undefined, kind: MarkKind): MarkRange | null => {
  if (!tail) return null;
  const lowerWord = word.toLowerCase();
  const lowerTail = tail.toLowerCase();
  if (!lowerWord.endsWith(lowerTail)) return null;
  return { start: word.length - tail.length, end: word.length, kind };
};

/** Индекс гласной, сменившейся на умлаут во множественном числе. */
export const umlautShiftIndex = (singular: string, plural: string): number => {
  const singularStem = stripArticle(singular);
  const pluralStem = stripArticle(plural);
  const offset = plural.length - pluralStem.length;
  const limit = Math.min(singularStem.length, pluralStem.length);
  for (let index = 0; index < limit; index += 1) {
    const pluralChar = pluralStem.charAt(index);
    if (UMLAUT_BASE[pluralChar] && UMLAUT_BASE[pluralChar] === singularStem.charAt(index)) {
      return offset + index;
    }
  }
  return -1;
};

/** Собирает сегменты, вставляя знак ударения и расставляя пометки. */
const buildSegments = (word: string, ranges: MarkRange[], stressAt: number): Segment[] => {
  if (!word) return [];
  const markAt = new Array<MarkKind | null>(word.length).fill(null);
  ranges.forEach((range) => {
    for (let index = Math.max(0, range.start); index < Math.min(word.length, range.end); index += 1) {
      markAt[index] = range.kind;
    }
  });

  const segments: Segment[] = [];
  let buffer = '';
  let bufferMark: MarkKind | null = markAt[0] ?? null;

  const flush = () => {
    if (buffer) segments.push({ text: buffer, mark: bufferMark });
    buffer = '';
  };

  for (let index = 0; index < word.length; index += 1) {
    if (markAt[index] !== bufferMark) {
      flush();
      bufferMark = markAt[index];
    }
    buffer += word.charAt(index);
    if (index === stressAt) buffer += COMBINING_ACUTE;
  }
  flush();
  return segments;
};

export const nounSingularSegments = (
  singular: string,
  suffix: string | null | undefined,
  stress: string | null | undefined,
): Segment[] => {
  const ranges = [tailRange(singular, suffix, 'suffix')].filter((range): range is MarkRange => range !== null);
  return buildSegments(singular, ranges, stressPosition(singular, stress));
};

export const nounPluralSegments = (
  singular: string,
  plural: string,
  pluralEnding: string | null | undefined,
  stress: string | null | undefined,
): Segment[] => {
  const ranges: MarkRange[] = [];
  const ending = tailRange(plural, pluralEnding, 'ending');
  if (ending) ranges.push(ending);
  const umlautAt = umlautShiftIndex(singular, plural);
  if (umlautAt >= 0) ranges.push({ start: umlautAt, end: umlautAt + 1, kind: 'umlaut' });
  return buildSegments(plural, ranges, stressPosition(plural, stress));
};

export const infinitiveSegments = (
  infinitive: string,
  separablePrefix: string | null | undefined,
  stress: string | null | undefined,
): Segment[] => {
  const ranges: MarkRange[] = [];
  if (separablePrefix) {
    const lead = infinitive.match(/^\s*(?:sich\s+)?/);
    const start = lead ? lead[0].length : 0;
    if (infinitive.slice(start).toLowerCase().startsWith(separablePrefix.toLowerCase())) {
      ranges.push({ start, end: start + separablePrefix.length, kind: 'prefix' });
    }
  }
  return buildSegments(infinitive, ranges, stressPosition(infinitive, stress));
};

/**
 * Спрягаемая форма глагола с отделяемой приставкой: «mache zu».
 * Приставка помечается отдельно, чтобы на обороте карточки было видно
 * её связь с инфинитивом, а не с предлогами управления.
 */
export const verbFormSegments = (form: string, prefix: string | null | undefined): Segment[] => {
  const tail = prefix ? " " + prefix : "";
  if (!prefix || !form.endsWith(tail)) return [{ text: form, mark: null }];
  return [
    { text: form.slice(0, form.length - tail.length) + " ", mark: null },
    { text: prefix, mark: "prefix" },
  ];
};

export const plainSegments = (word: string, stress: string | null | undefined): Segment[] =>
  buildSegments(word, [], stressPosition(word, stress));

/* ------------------------------ управление глагола ------------------------------ */

export type RektionTokenKind = 'text' | 'akkusativ' | 'dativ' | 'genitiv' | 'preposition' | 'noObject';

export interface RektionToken {
  text: string;
  kind: RektionTokenKind;
}

// INFO: «ohne» в списке безопасен: строка «ohne Objekt» разбирается веткой
// выше и сюда не доходит, а «ohne etw. (Akk.)» — настоящее управление
// (auskommen ohne etwas), и предлог в нём красить надо.
const PREPOSITIONS =
  /\b(an|auf|bei|für|gegen|in|mit|nach|ohne|über|um|unter|von|vor|zu|aus|durch|wegen)\b/gi;
const CASE_MARKERS = /\((Akk|Dat|Gen)\.?\)/gi;
const CASE_KIND: Record<string, RektionTokenKind> = {
  akk: 'akkusativ',
  dat: 'dativ',
  gen: 'genitiv',
};

const expandAbbreviations = (line: string): string =>
  line
    .replace(/\bjmdm\.?/gi, 'jemandem')
    .replace(/\bjmdn\.?/gi, 'jemanden')
    .replace(/\bjmds\.?/gi, 'jemandes')
    .replace(/\bjmd\.?/gi, 'jemand')
    .replace(/\betw\.?/gi, 'etwas');

/** Разбирает строку управления на токены: предлоги и падежи подсвечиваются. */
export const parseRektion = (line: string): RektionToken[] => {
  if (/^\s*ohne\s+objekt\s*$/i.test(line)) {
    return [{ text: 'ohne Objekt', kind: 'noObject' }];
  }
  const expanded = expandAbbreviations(line);
  const marks: Array<{ start: number; end: number; kind: RektionTokenKind }> = [];

  for (const match of expanded.matchAll(PREPOSITIONS)) {
    if (match.index === undefined) continue;
    marks.push({ start: match.index, end: match.index + match[0].length, kind: 'preposition' });
  }
  for (const match of expanded.matchAll(CASE_MARKERS)) {
    if (match.index === undefined) continue;
    marks.push({
      start: match.index,
      end: match.index + match[0].length,
      kind: CASE_KIND[match[1].toLowerCase()] ?? 'text',
    });
  }
  marks.sort((left, right) => left.start - right.start);

  const tokens: RektionToken[] = [];
  let cursor = 0;
  marks.forEach((mark) => {
    if (mark.start < cursor) return;
    if (mark.start > cursor) tokens.push({ text: expanded.slice(cursor, mark.start), kind: 'text' });
    tokens.push({ text: expanded.slice(mark.start, mark.end), kind: mark.kind });
    cursor = mark.end;
  });
  if (cursor < expanded.length) tokens.push({ text: expanded.slice(cursor), kind: 'text' });
  return tokens;
};
