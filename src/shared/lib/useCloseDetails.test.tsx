import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCloseDetails } from './useCloseDetails';

const Menu = () => {
  const ref = useCloseDetails();
  return (
    <div>
      <details ref={ref} data-testid="menu">
        <summary>все слова</summary>
        <label>
          <input type="checkbox" /> наречия
        </label>
      </details>
      <button type="button">снаружи</button>
    </div>
  );
};

const menu = () => screen.getByTestId('menu') as HTMLDetailsElement;

/**
 * Раскрытый `<details>` сам не закрывается: он висит, пока не нажмёшь
 * на его же заголовок. На широком экране список закрывает половину
 * страницы, и мышь уходит куда угодно, только не обратно.
 */
describe('закрытие списка', () => {
  it('клик вне закрывает', () => {
    render(<Menu />);
    menu().open = true;
    fireEvent.pointerDown(screen.getByRole('button', { name: 'снаружи' }));
    expect(menu().open).toBe(false);
  });

  it('клик внутри не закрывает — иначе не отметить пункт', () => {
    render(<Menu />);
    menu().open = true;
    fireEvent.pointerDown(screen.getByRole('checkbox'));
    expect(menu().open).toBe(true);
  });

  it('Escape закрывает', () => {
    render(<Menu />);
    menu().open = true;
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu().open).toBe(false);
  });

  it('закрытый список посторонние клики не трогают', () => {
    render(<Menu />);
    expect(menu().open).toBe(false);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'снаружи' }));
    expect(menu().open).toBe(false);
  });
});
