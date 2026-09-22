import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Экраны не должны выдавать сбой загрузки за пустые данные.
 *
 * Раньше упавший запрос выглядел как «в колоде пока нет слов» и «словарь
 * пуст», а статистика рисовала нули — то есть приложение уверенно
 * сообщало о том, чего не видело. Поймать это руками трудно: шлюз при
 * упавшей базе не отвечает отказом, а висит, — поэтому проверка здесь.
 */
const queueState = { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() };
const statsState = { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() };
const progressState = { data: undefined as unknown, isError: false };
const pageState = {
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

/** Бесконечная выборка отдаёт страницы пачками — так же, как в жизни. */
const chunks = (...pages: Array<{ total: number; rows: unknown[] }>) => ({ pages });

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useLearnQueue: () => queueState,
  useStatsSummary: () => statsState,
  useProgressSummary: () => progressState,
  useWordsInfinite: () => pageState,
  useWordsFacets: () => ({ data: undefined }),
  useWord: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useAuth: () => ({ user: { id: 'u1' }, session: {}, isLoading: false }),
}));

vi.mock('@/entities/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/settings')>();
  return { ...actual, useUserSettings: () => ({ data: actual.DEFAULT_SETTINGS, isLoading: false }) };
});

vi.mock('@/entities/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/review')>()),
  useAnswerCard: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

const { LearnPage } = await import('./learn/LearnPage');
const { StatsPage } = await import('./stats/StatsPage');
const { WordsPage } = await import('./words/WordsPage');

const show = (node: React.ReactElement) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  queueState.data = undefined;
  queueState.isLoading = false;
  queueState.isError = false;
  statsState.data = undefined;
  statsState.isLoading = false;
  statsState.isError = false;
  progressState.data = undefined;
  progressState.isError = false;
  pageState.data = undefined;
  pageState.isLoading = false;
  pageState.isError = false;
});

describe('«Учить» при сбое загрузки', () => {
  it('говорит о сбое, а не о пустом словаре', () => {
    queueState.isError = true;
    show(<LearnPage />);
    expect(screen.getByText(/Не удалось загрузить очередь повторений/)).toBeInTheDocument();
    expect(screen.queryByText(/словарь пуст/i)).not.toBeInTheDocument();
  });

  it('пустой словарь по-прежнему называется пустым, когда он действительно пуст', () => {
    queueState.data = { total: 0, items: [] };
    progressState.data = { total: 0, new: 0, learning: 0, known: 0, declared: 0, requested: 0, nounsWithGenus: 0, bands: {} };
    show(<LearnPage />);
    expect(screen.getByText(/В колоде пока нет слов/)).toBeInTheDocument();
  });
});

describe('«Статистика» при сбое загрузки', () => {
  it('не показывает нули вместо неизвестного', () => {
    statsState.isError = true;
    show(<StatsPage />);
    expect(screen.getByText(/Не удалось загрузить статистику/)).toBeInTheDocument();
    expect(screen.queryByText('повторений сегодня')).not.toBeInTheDocument();
  });

  it('падение сводки прогресса тоже считается сбоем, а не нулями', () => {
    statsState.data = { reviewedToday: 0, dueNow: 0, accuracy: null, checkedReviews: 0, checkedPos: [], totalReviews: 0, forecast: [], perDay: {}, activeDays: 0, genusMatrix: [], ruleErrors: [] };
    progressState.isError = true;
    show(<StatsPage />);
    expect(screen.getByText(/Не удалось загрузить статистику/)).toBeInTheDocument();
  });
});

describe('«Слова» при сбое загрузки', () => {
  it('говорит о сбое, а не о пустой колоде', () => {
    pageState.isError = true;
    show(<WordsPage />);
    expect(screen.getByText(/Не удалось загрузить список слов/)).toBeInTheDocument();
    expect(screen.queryByText(/В колоде пока нет слов/)).not.toBeInTheDocument();
  });

  it('пустая колода по-прежнему называется пустой', () => {
    pageState.data = chunks({ total: 0, rows: [] });
    show(<WordsPage />);
    expect(screen.getByText(/В колоде пока нет слов/)).toBeInTheDocument();
  });

  it('пустой результат поиска — это «ничего не найдено», а не пустая колода', () => {
    pageState.data = chunks({ total: 0, rows: [] });
    render(
      <MemoryRouter initialEntries={['/words?q=nesuschestvuyuscheeslovo']}>
        <WordsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
    expect(screen.queryByText(/В колоде пока нет слов/)).not.toBeInTheDocument();
  });
});
