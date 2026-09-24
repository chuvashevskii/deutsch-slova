import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@/entities/settings';

/**
 * Срок проверки для отмеченных «знаю».
 *
 * Проверяется, что выбор уходит в базу и что умолчание — не ноль:
 * нулевой срок означал бы «вернуть завтра», то есть отметка снова
 * перестала бы значить «я это знаю».
 */
const settings = { ...DEFAULT_SETTINGS };
const save = { mutate: vi.fn(), isPending: false, isError: false };

vi.mock('@/entities/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/review')>()),
  useResetAllProgress: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useProgressSize: () => ({ data: undefined }),
}));

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useProgressSummary: () => ({ data: undefined, isError: false }),
}));

vi.mock('@/entities/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/settings')>()),
  useUserSettings: () => ({ data: settings, isLoading: false, isError: false, refetch: vi.fn() }),
  useProfile: () => ({ data: undefined }),
  useSaveSettings: () => save,
  useSaveNickname: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

vi.mock('@/features/theme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/theme')>()),
  useTheme: () => ({ choice: 'system', setChoice: vi.fn() }),
}));

vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useAuth: () => ({ user: { id: 'u1' } }),
}));

const { SettingsPage } = await import('./SettingsPage');

const show = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );

const saved = () => save.mutate.mock.calls.at(-1)?.[0]?.patch;

describe('срок проверки отмеченных «знаю»', () => {
  beforeEach(() => {
    settings.known_interval_days = 90;
    save.mutate = vi.fn();
  });

  it('по умолчанию три месяца, а не ноль', () => {
    expect(DEFAULT_SETTINGS.known_interval_days).toBe(90);
    show();
    expect(screen.getByText('дней до проверки · сейчас 90')).toBeInTheDocument();
  });

  it('выбор уходит в базу', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '180' }));
    expect(saved()).toEqual({ known_interval_days: 180 });
  });

  // Ниже порога зрелости срока быть не должно: 21 день — это граница,
  // на которой слово вообще начинает считаться знакомым.
  it('ни один срок не короче порога зрелости', async () => {
    const { KNOWN_INTERVALS } = await import('@/entities/settings');
    expect(Math.min(...KNOWN_INTERVALS)).toBeGreaterThanOrEqual(21);
  });
});
