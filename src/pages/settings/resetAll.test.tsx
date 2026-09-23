import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResetSummary } from '@/entities/review';

/**
 * Полный сброс — действие необратимое, и от экрана требуется ровно две
 * вещи: не сделать его одним промахом и доказать, что удаление прошло.
 *
 * Второе важнее, чем кажется. Колода из двух с половиной тысяч слов
 * сбрасывается мгновенно, и на глаз отличить «сработало» от «молча
 * не сработало» нельзя: список слов выглядит так же. Поэтому экран
 * показывает числа, пришедшие из базы, а не слово «готово».
 */
const resetState = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  data: undefined as ResetSummary | undefined,
};

vi.mock('@/entities/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/review')>()),
  useResetAllProgress: () => resetState,
  useProgressSize: (enabled: boolean) => ({
    data: enabled ? { cards: 12, reviews: 1937 } : undefined,
  }),
}));

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useProgressSummary: () => ({
    data: {
      total: 2586,
      new: 2100,
      learning: 400,
      known: 80,
      declared: 6,
      requested: 0,
      nounsWithGenus: 0,
      drafts: 1124,
    },
    isError: false,
  }),
}));

vi.mock('@/entities/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/settings')>()),
  useUserSettings: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useProfile: () => ({ data: undefined }),
  useSaveSettings: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
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

describe('сброс всего прогресса', () => {
  beforeEach(() => {
    resetState.mutate = vi.fn();
    resetState.reset = vi.fn();
    resetState.isPending = false;
    resetState.isError = false;
    resetState.data = undefined;
  });

  it('одним нажатием ничего не удаляет', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить прогресс' }));
    expect(resetState.mutate).not.toHaveBeenCalled();
  });

  it('перед удалением называет точные числа, а не выведенные из долей', () => {
    // Числа берутся прямым счётом строк. Доли из `progress_summary`
    // для этого не годятся: они зовут карточку новой, пока `state = 0`,
    // и предупреждение обещало бы меньше, чем удаляет.
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить прогресс' }));
    const warning = screen.getByText(/Точно сбросить/).textContent ?? '';
    expect(warning).toContain('карточек с прогрессом — 12');
    expect(warning).toContain('ответов в журнале — 1937');
  });

  it('удаляет только после второго подтверждения', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить прогресс' }));
    fireEvent.click(screen.getByRole('button', { name: 'Да, сбросить всё' }));
    expect(resetState.mutate).toHaveBeenCalledTimes(1);
  });

  it('отмена возвращает всё назад, не тронув прогресс', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить прогресс' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: 'Сбросить прогресс' })).toBeInTheDocument();
    expect(resetState.mutate).not.toHaveBeenCalled();
  });

  it('после сброса показывает числа из базы, а не слово «готово»', () => {
    resetState.data = { cards: 480, reviews: 1937, marks: 6 };
    show();
    expect(screen.getByText(/Сброс прошёл/)).toBeInTheDocument();
    expect(screen.getByText(/1937/)).toBeInTheDocument();
  });

  it('из сообщения об успехе есть выход', () => {
    // Иначе секция остаётся в нём до перезагрузки страницы: ни сбросить
    // ещё раз, ни убрать устаревшие числа.
    resetState.reset = vi.fn();
    resetState.data = { cards: 480, reviews: 1937, marks: 6 };
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(resetState.reset).toHaveBeenCalled();
  });

  it('при отказе говорит, что ничего не удалено', () => {
    resetState.isError = true;
    show();
    expect(screen.getByText(/ничего не удалено/)).toBeInTheDocument();
  });
});
