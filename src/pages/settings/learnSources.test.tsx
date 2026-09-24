import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@/entities/settings';

/**
 * Выбор источников очереди на экране.
 *
 * Проверяется не «галочка нажимается», а что уходит в базу: источники
 * складываются, порядок задаёт список, а снятие последней галочки
 * возвращает всю колоду. Ошибиться тут легко и незаметно — человек
 * увидел бы отмеченную галочку и пустую очередь.
 */
const settings = { ...DEFAULT_SETTINGS, learn_sources: [] as string[] };
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

/** Что ушло в сохранение последним вызовом: экран шлёт {userId, patch}. */
const saved = () => save.mutate.mock.calls.at(-1)?.[0]?.patch;

describe('откуда брать слова', () => {
  beforeEach(() => {
    settings.learn_sources = [];
    save.mutate = vi.fn();
  });

  it('пустой выбор назван всей колодой', () => {
    show();
    expect(screen.getByText('сейчас: вся колода')).toBeInTheDocument();
  });

  it('три источника, ни один не отмечен', () => {
    show();
    for (const label of [
      'Вне частотного списка',
      'Заведённые руками',
      'Отмеченные «учить сегодня»',
    ]) {
      expect(screen.getByLabelText(label, { exact: false })).not.toBeChecked();
    }
  });

  it('нажатие отправляет один источник', () => {
    show();
    fireEvent.click(screen.getByLabelText('Заведённые руками', { exact: false }));
    expect(saved()).toEqual({ learn_sources: ['own'] });
  });

  // Главное в этой затее: источники складываются, а не заменяют друг друга.
  it('второе нажатие добавляет, а не заменяет', () => {
    settings.learn_sources = ['own'];
    show();
    fireEvent.click(screen.getByLabelText('Отмеченные «учить сегодня»', { exact: false }));
    expect(saved()).toEqual({ learn_sources: ['own', 'requested'] });
  });

  it('порядок задаёт список, а не порядок нажатий', () => {
    settings.learn_sources = ['requested'];
    show();
    fireEvent.click(screen.getByLabelText('Вне частотного списка', { exact: false }));
    expect(saved()).toEqual({ learn_sources: ['rankless', 'requested'] });
  });

  it('снятие последней галочки возвращает всю колоду', () => {
    settings.learn_sources = ['own'];
    show();
    fireEvent.click(screen.getByLabelText('Заведённые руками', { exact: false }));
    expect(saved()).toEqual({ learn_sources: [] });
  });

  it('выбранное названо словами', () => {
    settings.learn_sources = ['own', 'requested'];
    show();
    expect(
      screen.getByText('сейчас: заведённые руками + отмеченные «учить сегодня»'),
    ).toBeInTheDocument();
  });
});
