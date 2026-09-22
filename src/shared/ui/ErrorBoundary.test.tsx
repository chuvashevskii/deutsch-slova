import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

const Explodes = () => {
  throw new Error('поле формы не найдено');
};

describe('граница ошибок', () => {
  beforeEach(() => {
    // React печатает пойманную ошибку сам — в выводе тестов это шум.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('показывает сообщение вместо белого экрана', () => {
    render(
      <ErrorBoundary scope="этот экран">
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Что-то сломалось: этот экран/)).toBeInTheDocument();
  });

  it('объясняет, что данные целы: человек не должен решить, что всё потерял', () => {
    render(
      <ErrorBoundary scope="приложение">
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Прогресс и словарь на месте/)).toBeInTheDocument();
  });

  it('предлагает перезагрузку только там, где её просили', () => {
    const { unmount } = render(
      <ErrorBoundary scope="этот экран">
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Перезагрузить')).not.toBeInTheDocument();
    unmount();

    render(
      <ErrorBoundary scope="приложение" offerReload>
        <Explodes />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Перезагрузить')).toBeInTheDocument();
  });

  it('исправный потомок рисуется как обычно', () => {
    render(
      <ErrorBoundary scope="этот экран">
        <p>всё хорошо</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('всё хорошо')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
