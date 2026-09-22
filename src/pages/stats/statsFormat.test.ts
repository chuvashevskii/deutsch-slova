import { describe, expect, it } from 'vitest';

import { dayKey, plural } from './statsFormat';

describe('ключ дня', () => {
  it('берёт местную дату, а не UTC', () => {
    // 23:30 по местному времени: в UTC это уже следующие сутки, и ключ
    // уехал бы вперёд — прогноз перестал бы совпадать с тепловой картой.
    const lateEvening = new Date(2026, 8, 22, 23, 30);
    expect(dayKey(lateEvening)).toBe('2026-09-22');
  });

  it('дополняет нулями, иначе ключи не сравнить строкой', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('окончания', () => {
  it('склоняет по-русски, а не по остатку от десяти', () => {
    const word = (count: number) => plural(count, 'ответ', 'ответа', 'ответов');
    expect(word(1)).toBe('ответ');
    expect(word(2)).toBe('ответа');
    expect(word(5)).toBe('ответов');
    expect(word(11)).toBe('ответов');
    expect(word(21)).toBe('ответ');
    expect(word(112)).toBe('ответов');
    expect(word(0)).toBe('ответов');
  });
});
