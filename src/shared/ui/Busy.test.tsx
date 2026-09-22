import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Busy } from './Busy';

/**
 * Крутилка на кнопке заменяет её текст и стоит только на нажатой.
 *
 * Раньше в «Новых словах в день» она появлялась на всех кнопках, кроме
 * выбранной: условие сравнивало значение с сохранённым, а сохранённое
 * во время запроса ещё старое. Выглядело это как общий индикатор
 * экрана, по которому не понять, что именно приняли.
 */
describe('крутилка на кнопке', () => {
  it('в покое показывает только текст', () => {
    render(<Busy busy={false}>Сохранить</Busy>);
    expect(screen.getByText('Сохранить').className).not.toContain('opacity-0');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('во время запроса скрывает текст и ставит крутилку', () => {
    render(
      <Busy busy label="Сохраняем лимит">
        Сохранить
      </Busy>,
    );
    expect(screen.getByText('Сохранить').className).toContain('opacity-0');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Сохраняем лимит');
  });

  it('текст остаётся в дереве доступности — кнопка не теряет имя', () => {
    render(
      <button type="button">
        <Busy busy>Учить сегодня</Busy>
      </button>,
    );
    // Прозрачность, а не visibility: скрытый текст выпал бы из имени
    // кнопки, и осталось бы одно «Сохраняем».
    expect(screen.getByRole('button', { name: /Учить сегодня/ })).toBeTruthy();
  });

  it('из ряда кнопок крутится только нажатая', () => {
    const limits = [10, 20, 30, 40, 50];
    render(
      <div>
        {limits.map((limit) => (
          <button key={limit} type="button">
            <Busy busy={limit === 40}>{limit}</Busy>
          </button>
        ))}
      </div>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('40').className).toContain('opacity-0');
    expect(screen.getByText('20').className).not.toContain('opacity-0');
  });
});

describe('гашение кнопки', () => {
  it('во время запроса кнопка остаётся в своём цвете', async () => {
    const { busyClasses } = await import('./busyClasses');
    expect(busyClasses(true)).not.toContain('opacity-40');
  });

  it('вне запроса гашение остаётся настоящему запрету', async () => {
    const { busyClasses } = await import('./busyClasses');
    expect(busyClasses(false)).toContain('disabled:opacity-40');
  });
});
