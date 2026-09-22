import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Проверка черновых партий по конвенциям колоды.
 *
 * Карточки для неё пишу я, и ошибиться в одном поле из сорока легко:
 * первая партия ушла без ударений и без правил рода, хотя в колоде они
 * заполнены у 85% и 79% карточек. На глаз такое не ловится — карточка
 * выглядит целой, просто чего-то в ней нет.
 *
 * Проверка идёт по файлам партий, а не по базе: файл — источник,
 * база лишь его отражение.
 */
const POS = new Set([
  'noun', 'verb', 'adj', 'adverb', 'pronoun', 'preposition', 'conjunction', 'numeral', 'particle',
]);
const RULE_STATUS = new Set(['high', 'mixed', 'exception', 'notsuffix', 'none']);
const GENUS = new Set(['m', 'f', 'n']);
const VOWELS = 'aeiouäöüy';

/** Гласных рядов в слове: по ним же считается позиция ударения. */
const vowelGroups = (word) => {
  let groups = 0;
  let inside = false;
  for (const letter of word.toLowerCase()) {
    const isVowel = VOWELS.includes(letter);
    if (isVowel && !inside) groups += 1;
    inside = isVowel;
  }
  return groups;
};

const cards = readdirSync('data/drafts')
  .filter((name) => name.endsWith('.json'))
  .flatMap((name) => JSON.parse(readFileSync(`data/drafts/${name}`, 'utf8')));

describe('черновые партии', () => {
  it('есть что проверять', () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it.each(cards.map((card) => [card.rank, card.head, card]))('%s %s', (_rank, _head, card) => {
    expect(POS.has(card.pos), `часть речи «${card.pos}»`).toBe(true);
    expect(card.head?.trim(), 'заголовок').toBeTruthy();
    expect(card.translation?.trim(), 'перевод').toBeTruthy();
    expect(card.translation[0], 'перевод с заглавной').toBe(card.translation[0].toUpperCase());

    expect(card.ipa, 'IPA в косых чертах').toMatch(/^\/.+\/$/);
    expect(card.pronunciation_ru?.trim(), 'русская транскрипция').toBeTruthy();

    expect(card.examples_de?.length, 'примеров на немецком').toBe(2);
    expect(card.examples_ru?.length, 'переводов примеров').toBe(2);

    expect(RULE_STATUS.has(card.rule_status), `статус правила «${card.rule_status}»`).toBe(true);

    // Род правила бывает только у слова с родом — это же требует и схема.
    if (card.rule_genus) {
      expect(GENUS.has(card.rule_genus), 'род правила').toBe(true);
      expect(card.genus, 'род правила без рода слова').toBeTruthy();
    }

    if (card.pos === 'noun') {
      expect(GENUS.has(card.genus), `род «${card.genus}»`).toBe(true);
      expect(card.singular, 'Singular с артиклем').toMatch(/^(der|die|das) /);
      // Множественного может не быть вовсе — «der Dank», «das Obst».
      // Пустое поле тут законно, а вот множественное без артикля нет.
      if (card.plural) expect(card.plural, 'Plural с артиклем').toMatch(/^die /);
      // Ударение отмечается у многосложных: у односложного отмечать нечего.
      if (vowelGroups(card.head) > 1) {
        expect(card.stress_singular, 'ударение существительного').toBeTruthy();
      }
    } else if (vowelGroups(card.head) > 1) {
      // У глагола ударение живёт в своём поле: оно относится к инфинитиву,
      // а у отделяемых приставок важно, падает оно на приставку или нет.
      const stress = card.pos === 'verb' ? card.stress_infinitive : card.stress_word;
      expect(stress, `ударение (${card.pos === 'verb' ? 'инфинитива' : 'слова'})`).toBeTruthy();
    }

    // Номер ударения — гласный ряд, и выйти за их число он не может.
    for (const stress of [card.stress_word, card.stress_singular, card.stress_infinitive]) {
      if (!stress) continue;
      const group = Number.parseInt(String(stress).split('.')[0], 10);
      expect(group, 'номер гласного ряда').toBeGreaterThan(0);
      expect(group, 'ударение за пределами слова').toBeLessThanOrEqual(vowelGroups(card.head));
    }

    // Подписи к формам идут парой: разъехавшаяся пара молча сдвигает их.
    if (card.forms || card.form_labels) {
      expect(card.form_labels?.length ?? 0, 'подписей и форм поровну').toBe(card.forms?.length ?? 0);
    }
  });

  it('ранги не повторяются: иначе вторая карточка затрёт первую', () => {
    const ranks = cards.map((card) => card.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});
