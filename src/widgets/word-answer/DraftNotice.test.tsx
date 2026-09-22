import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Word } from '@/entities/word';

import { DraftNotice } from './DraftNotice';

const admin = { value: false };

vi.mock('@/entities/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/settings')>()),
  useIsAdmin: () => ({ data: admin.value }),
}));

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useConfirmWord: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

const word = (confirmed: string | null) =>
  ({ id: 'list-0042', head: 'Tag', confirmed_at: confirmed }) as unknown as Word;

/**
 * Черновик обязан себя называть. Молча показанный несверенный разбор
 * неотличим от проверенного — это то же самое, что выдать незнание
 * за знание, только на обороте карточки.
 */
describe('пометка черновика', () => {
  it('на сверенной карточке ничего не показывает', () => {
    admin.value = false;
    const { container } = render(<DraftNotice word={word('2026-09-22T10:00:00Z')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('на черновике предупреждает и называет, где ошибка вероятнее', () => {
    admin.value = false;
    render(<DraftNotice word={word(null)} />);
    expect(screen.getByText(/Черновик — разбор не сверен/)).toBeTruthy();
    expect(screen.getByText(/произношение и формы/)).toBeTruthy();
  });

  it('кнопки согласования у обычного пользователя нет', () => {
    admin.value = false;
    render(<DraftNotice word={word(null)} />);
    expect(screen.queryByRole('button', { name: /Согласовать/ })).toBeNull();
  });

  it('администратору кнопка доступна', () => {
    admin.value = true;
    render(<DraftNotice word={word(null)} />);
    expect(screen.getByRole('button', { name: /Согласовать/ })).toBeTruthy();
  });
});
