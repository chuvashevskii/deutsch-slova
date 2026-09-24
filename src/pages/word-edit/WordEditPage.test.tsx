import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Word } from '@/entities/word';

/**
 * Экран правки.
 *
 * Проверяется не «поля рисуются», а три вещи, в которых легко соврать:
 * кнопка не даёт сохранить неизменённое, в базу уходит только
 * изменившееся, и удаление есть только у заведённых руками.
 */
// INFO: приведение через unknown: в карточке сорок с лишним колонок —
// озвучка, ударения, ранг, — и перечислять их ради экрана, который
// читает шесть, значит писать шум.
const card: { value: Word } = {
  value: {
    id: 'my-0001',
    head: 'Zuversicht',
    pos: 'noun',
    wortart: null,
    translation: 'Уверенность в хорошем',
    register: 'neutral · нейтральный',
    definition: '',
    genus: 'f',
    singular: 'die Zuversicht',
    rektion: [],
    examples_de: ['Ihre Zuversicht steckt alle an.', 'Er hat die Zuversicht verloren.'],
    examples_ru: ['Её уверенность передаётся всем.', 'Он потерял уверенность.'],
  } as unknown as Word,
};
const update = { mutate: vi.fn(), isPending: false, isError: false, error: null };
const remove = { mutate: vi.fn(), isPending: false, isError: false, error: null };

vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useWord: () => ({ data: card.value, isLoading: false, isError: false, refetch: vi.fn() }),
  useTranslationNeighbours: () => ({ data: [] }),
  useUpdateWord: () => update,
  useDeleteWord: () => remove,
}));

const { WordEditPage } = await import('./WordEditPage');

const show = () =>
  render(
    <MemoryRouter initialEntries={[`/words/${card.value.id}/edit`]}>
      <Routes>
        <Route path="/words/:id/edit" element={<WordEditPage />} />
      </Routes>
    </MemoryRouter>,
  );

const saveButton = () => screen.getByRole('button', { name: /Сохранить|Изменений нет/ });
/** Подпись «Перевод» стоит и у слова, и у каждого примера — первая главная. */
const translation = () => screen.getAllByLabelText('Перевод')[0];
const sent = () => update.mutate.mock.calls.at(-1)?.[0];

describe('правка карточки', () => {
  beforeEach(() => {
    update.mutate = vi.fn();
    remove.mutate = vi.fn();
    card.value = { ...card.value, id: 'my-0001' };
  });

  it('поля заполнены из карточки', () => {
    show();
    expect(translation()).toHaveValue('Уверенность в хорошем');
    expect(screen.getByLabelText('Пример 1')).toHaveValue('Ihre Zuversicht steckt alle an.');
  });

  it('без изменений кнопка мертва', () => {
    show();
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveTextContent('Изменений нет');
  });

  it('в базу уходит только изменившееся', () => {
    show();
    fireEvent.change(translation(), { target: { value: 'Уверенность' } });
    expect(saveButton()).toHaveTextContent('Сохранить (1)');
    fireEvent.click(saveButton());
    expect(sent()).toEqual({ translation: 'Уверенность' });
  });

  it('помета переключается и считается изменением', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'разговорный' }));
    fireEvent.click(saveButton());
    expect(sent()).toEqual({ register: 'umgangssprachlich · разговорный' });
  });

  it('подсказка с заглавной запирает сохранение', () => {
    show();
    fireEvent.change(screen.getByLabelText('Подсказка (необязательно)'), {
      target: { value: 'Вера в хорошее' },
    });
    expect(screen.getByText('Подсказка: с заглавной буквы')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  // Замечания про род на этом экране не снять — их и не показывают.
  it('чужого замечания не показывает', () => {
    card.value = { ...card.value, genus: '' };
    show();
    expect(screen.queryByText(/род/)).not.toBeInTheDocument();
  });
});

describe('удаление', () => {
  beforeEach(() => {
    remove.mutate = vi.fn();
    card.value = { ...card.value, id: 'my-0001' };
  });

  it('у заведённой руками кнопка есть, но в два шага', () => {
    show();
    expect(screen.queryByRole('button', { name: /Да, удалить/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(screen.getByRole('button', { name: /Да, удалить «Zuversicht»/ })).toBeInTheDocument();
  });

  it('подтверждение удаляет', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: /Да, удалить/ }));
    expect(remove.mutate.mock.calls.at(-1)?.[0]).toBe('my-0001');
  });

  it('у карточки из Anki кнопки нет вовсе', () => {
    card.value = { ...card.value, id: '1234' };
    show();
    expect(screen.queryByText('Удалить карточку')).not.toBeInTheDocument();
  });
});
