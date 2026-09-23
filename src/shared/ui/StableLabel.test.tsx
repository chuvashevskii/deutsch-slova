import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StableLabel } from './StableLabel';

describe('подпись, держащая ширину', () => {
  it('показывает нужную подпись', () => {
    render(<StableLabel shown="Знаю" other="Вернуть в колоду" />);
    expect(screen.getByText('Знаю')).toBeInTheDocument();
  });

  it('держит место под вторую подпись, а не выбрасывает её', () => {
    // Если убрать `invisible` в пользу `hidden`, ширина снова поедет:
    // место занимать — единственная работа этого элемента.
    render(<StableLabel shown="Знаю" other="Вернуть в колоду" />);
    const other = screen.getByText('Вернуть в колоду');
    expect(other).toBeInTheDocument();
    expect(other.className).toContain('invisible');
  });

  it('вторую подпись не отдаёт чтению с экрана', () => {
    // Иначе кнопка читалась бы как «Знаю Вернуть в колоду».
    render(<StableLabel shown="Знаю" other="Вернуть в колоду" />);
    expect(screen.getByText('Вернуть в колоду')).toHaveAttribute('aria-hidden', 'true');
  });

  it('обе подписи кладутся в одну ячейку, иначе они встанут рядом', () => {
    render(<StableLabel shown="Знаю" other="Вернуть в колоду" />);
    for (const text of ['Знаю', 'Вернуть в колоду']) {
      const node = screen.getByText(text);
      expect(node.className, text).toContain('col-start-1');
      expect(node.className, text).toContain('row-start-1');
    }
  });
});
