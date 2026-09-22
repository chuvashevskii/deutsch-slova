import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Word } from '@/entities/word';

import { WordAnswer } from './WordAnswer';

vi.mock('@/entities/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/settings')>()),
  useIsAdmin: () => ({ data: false }),
}));

vi.mock('@/features/feedback', () => ({ FeedbackButton: () => null }));

// Согласование карточки живёт в мутации — ей нужен клиент запросов,
// а проверяется здесь не оно.
vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useConfirmWord: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

const word = (overrides: Partial<Word>): Word =>
  ({
    id: 'list-0102',
    pos: 'pronoun',
    head: 'jeder',
    translation: 'Каждый',
    confirmed_at: '2026-09-22T00:00:00Z',
    rektion: [],
    forms: [],
    examples_de: [],
    examples_ru: [],
    rule_status: 'none',
    rule_label: '',
    ...overrides,
  }) as unknown as Word;

/**
 * Частотный список даёт «jeder, jede, jedes» одной записью — это одно
 * слово в трёх родах. Карточка одна, но показать формы было негде:
 * Singular/Plural есть у существительного, пять лиц у глагола, а у
 * определителя — ничего, и две формы из трёх молча пропадали.
 */
describe('строка форм', () => {
  it('показывает формы, которым нет своего поля', () => {
    render(<WordAnswer word={word({ forms: ['jeder', 'jede', 'jedes'] })} />);
    expect(screen.getByText('Formen')).toBeTruthy();
    expect(screen.getByText('jeder · jede · jedes')).toBeTruthy();
  });

  it('без форм строки нет — пустая подпись обещала бы то, чего нет', () => {
    render(<WordAnswer word={word({ forms: [] })} />);
    expect(screen.queryByText('Formen')).toBeNull();
  });

  it('варианты написания идут той же строкой: это не роды', () => {
    render(<WordAnswer word={word({ head: 'vorne', forms: ['vorne', 'vorn'] })} />);
    expect(screen.getByText('vorne · vorn')).toBeTruthy();
  });
});
