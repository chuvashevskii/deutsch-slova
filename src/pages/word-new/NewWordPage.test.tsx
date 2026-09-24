import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { NewWordPage } from './NewWordPage';

/**
 * Оформление подсказки не даёт завести карточку.
 *
 * Проверка не только логики: у формы два списка — красный «мешает
 * завести» и серый «стоит взглянуть», — и правило, поднятое в коде,
 * должно переехать из второго в первый вместе с кнопкой. Разъедься
 * они, человек увидел бы замечание серым и упёрся в кнопку без причины.
 */
vi.mock('@/entities/word', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/word')>()),
  useTranslationNeighbours: () => ({ data: [] }),
  useCreateWord: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

/** Карточка, к которой не придраться ничем, кроме подсказки. */
const fill = () => {
  render(
    <MemoryRouter initialEntries={['/words/new?word=Zuversicht']}>
      <NewWordPage />
    </MemoryRouter>,
  );
  const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
  type(screen.getAllByLabelText('Перевод')[0], 'Уверенность в хорошем');
  type(screen.getByLabelText('Пример 1'), 'Ihre Zuversicht steckt alle an.');
  type(screen.getAllByLabelText('Перевод')[1], 'Её уверенность передаётся всем.');
  type(screen.getByLabelText('Пример 2'), 'Er hat die Zuversicht verloren.');
  type(screen.getAllByLabelText('Перевод')[2], 'Он потерял уверенность.');
  return {
    hint: screen.getByLabelText('Подсказка (необязательно)'),
    button: screen.getByRole('button', { name: /Завести карточку/ }),
    type,
  };
};

describe('оформление подсказки на экране', () => {
  it('без подсказки карточку заводить можно', () => {
    const { button } = fill();
    expect(screen.getByText('Карточку можно заводить')).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('подсказка с заглавной буквы запирает кнопку', () => {
    const { hint, button, type } = fill();
    type(hint, 'Вера в хорошее');
    expect(screen.getByText('Мешает завести: 1')).toBeInTheDocument();
    expect(screen.getByText('Подсказка: с заглавной буквы')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('исправленная подсказка отпирает её обратно', () => {
    const { hint, button, type } = fill();
    type(hint, 'Вера в хорошее');
    expect(button).toBeDisabled();
    type(hint, 'вера в хорошее');
    expect(screen.getByText('Карточку можно заводить')).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});

describe('спряжение показывается только глаголу', () => {
  const open = () =>
    render(
      <MemoryRouter initialEntries={['/words/new?word=arbeiten']}>
        <NewWordPage />
      </MemoryRouter>,
    );

  it('у существительного секции нет', () => {
    open();
    expect(screen.queryByText('Спряжение')).not.toBeInTheDocument();
  });

  it('у глагола есть все пять лиц', () => {
    open();
    fireEvent.change(screen.getByLabelText('Часть речи'), { target: { value: 'verb' } });
    expect(screen.getByText('Спряжение')).toBeInTheDocument();
    for (const person of ['ich', 'du', 'er/sie/es', 'wir/sie/Sie', 'ihr']) {
      expect(screen.getByLabelText(person)).toBeInTheDocument();
    }
  });

  it('частично заполненное спряжение — серое замечание, не красный блок', () => {
    open();
    fireEvent.change(screen.getByLabelText('Часть речи'), { target: { value: 'verb' } });
    fireEvent.change(screen.getAllByLabelText('Перевод')[0], { target: { value: 'Работать' } });
    fireEvent.change(screen.getByLabelText('Пример 1'), {
      target: { value: 'Ich arbeite im Büro.' },
    });
    fireEvent.change(screen.getAllByLabelText('Перевод')[1], {
      target: { value: 'Я работаю в офисе.' },
    });
    fireEvent.change(screen.getByLabelText('Пример 2'), {
      target: { value: 'Sie arbeitet als Ärztin.' },
    });
    fireEvent.change(screen.getAllByLabelText('Перевод')[2], {
      target: { value: 'Она работает врачом.' },
    });
    fireEvent.change(screen.getByLabelText('er/sie/es'), { target: { value: 'arbeitet' } });

    expect(screen.getByText(/Спряжение заполнено не до конца/)).toBeInTheDocument();
    expect(screen.getByText('Карточку можно заводить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Завести карточку/ })).not.toBeDisabled();
  });
});

describe('отделяемая приставка на экране', () => {
  const openVerb = () => {
    render(
      <MemoryRouter initialEntries={['/words/new?word=aufstehen']}>
        <NewWordPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Часть речи'), { target: { value: 'verb' } });
  };

  it('у существительного секции нет', () => {
    render(
      <MemoryRouter initialEntries={['/words/new?word=Zuversicht']}>
        <NewWordPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Отделяемая приставка')).not.toBeInTheDocument();
  });

  it('галочка есть, а поля приставки до неё нет', () => {
    openVerb();
    expect(screen.getByText('Глагол с отделяемой приставкой')).toBeInTheDocument();
    expect(screen.queryByLabelText('Приставка')).not.toBeInTheDocument();
  });

  it('галочка открывает поле и подставляет приставку сама', () => {
    openVerb();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByLabelText('Приставка')).toHaveValue('auf');
  });

  // Ради этого всё и затевалось: человек видит разделение до сохранения.
  it('предпросмотр показывает разделение тем же рисовальщиком, что и карточка', () => {
    openVerb();
    fireEvent.click(screen.getByRole('checkbox'));
    const preview = screen.getByText('как будет на карточке').parentElement;
    expect(preview?.textContent).toContain('aufstehen');
    expect(preview?.querySelector('.mark-prefix')?.textContent).toBe('auf');
  });

  it('приставка мимо слова запирает кнопку', () => {
    openVerb();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Приставка'), { target: { value: 'ein' } });
    expect(screen.getByText(/не начинается с «ein»/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Завести карточку/ })).toBeDisabled();
  });
});
