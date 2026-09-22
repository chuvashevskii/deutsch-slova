import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from './AppLayout';

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useProgressSummary: () => ({ data: { known: 3, total: 10 }, isPending: false }),
}));

vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useAuth: () => ({ user: { email: 'probe@local.test' }, signOut: vi.fn() }),
}));

// Разделы администратора показываются не всем, поэтому признак задаётся
// на каждый прогон отдельно.
let admin = false;
vi.mock('@/entities/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/settings')>()),
  useIsAdmin: () => ({ data: admin }),
}));

beforeEach(() => {
  admin = false;
});

/**
 * «Ещё» — обход нехватки места внизу телефона, а не раздел. На широком
 * экране колонка слева показывает все разделы сразу, и лишний переход
 * там ни к чему: раньше «Ещё» стояло и там, пряча за собой три ссылки.
 *
 * Обе навигации всегда есть в разметке — прячет их CSS по ширине окна,
 * поэтому проверяется состав каждой, а не видимость.
 */
const renderLayout = () => {
  const { container } = render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  );
  const [sidebar, bottom] = Array.from(container.querySelectorAll('nav'));
  return { sidebar: sidebar as HTMLElement, bottom: bottom as HTMLElement };
};

const labels = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent?.replace(/[^\p{L}\s]/gu, '').trim());

describe('навигация', () => {
  it('в боковой колонке все шесть разделов и нет «Ещё»', () => {
    const { sidebar } = renderLayout();
    expect(labels(sidebar)).toEqual([
      'Учить',
      'Слова',
      'Статистика',
      'Настройки',
      'Обращения',
      'Бэклог слов',
    ]);
  });

  it('внизу телефона четыре вкладки, шестой раздел скрыт за «Ещё»', () => {
    const { bottom } = renderLayout();
    expect(labels(bottom)).toEqual(['Учить', 'Слова', 'Статистика', 'Ещё']);
  });

  it('выход и почта есть в колонке — на телефоне они живут на «Ещё»', () => {
    const { container } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    const aside = container.querySelector('aside') as HTMLElement;
    expect(within(aside).getByText('probe@local.test')).toBeTruthy();
    expect(within(aside).getByRole('button', { name: 'Выйти' })).toBeTruthy();
  });

  it('счётчик показывает выученное из общего', () => {
    renderLayout();
    expect(screen.getAllByText('3 / 10').length).toBeGreaterThan(0);
  });
});

/**
 * Раздел «Правки» — рабочее место владельца колоды. Обычному человеку
 * он не показывается вовсе, а не прячется за отказом: пункт, который
 * всегда отвечает «сюда нельзя», хуже, чем его отсутствие.
 */
describe('разделы администратора', () => {
  it('обычному человеку их не видно', () => {
    const { sidebar } = renderLayout();
    expect(labels(sidebar)).not.toContain('Правки');
  });

  it('администратору видны последними, после редких разделов', () => {
    admin = true;
    const { sidebar } = renderLayout();
    expect(labels(sidebar)).toEqual([
      'Учить',
      'Слова',
      'Статистика',
      'Настройки',
      'Обращения',
      'Бэклог слов',
      'Правки',
    ]);
  });

  it('нижнюю панель телефона они не занимают', () => {
    admin = true;
    const { bottom } = renderLayout();
    expect(labels(bottom)).toEqual(['Учить', 'Слова', 'Статистика', 'Ещё']);
  });
});
