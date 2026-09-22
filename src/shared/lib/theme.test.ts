import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, readThemeChoice, resolveTheme, storeThemeChoice } from './theme';

const mockSystem = (dark: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#F3F2EC" />';
});
afterEach(() => vi.unstubAllGlobals());

describe('выбор оформления', () => {
  it('по умолчанию идёт за системой', () => {
    expect(readThemeChoice()).toBe('system');
    mockSystem(true);
    expect(resolveTheme('system')).toBe('dark');
    mockSystem(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('явный выбор системе не подчиняется', () => {
    mockSystem(true);
    expect(resolveTheme('light')).toBe('light');
    mockSystem(false);
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('мусор в хранилище не ломает выбор', () => {
    localStorage.setItem('theme', 'неоновое');
    expect(readThemeChoice()).toBe('system');
  });

  it('переживает и помнит выбор', () => {
    storeThemeChoice('dark');
    expect(readThemeChoice()).toBe('dark');
  });
});

describe('применение темы', () => {
  it('тёмная ставит атрибут, светлая его снимает', () => {
    mockSystem(false);
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('полоса статуса красится под фон, иначе виден стык', () => {
    mockSystem(false);
    const meta = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    applyTheme('dark');
    expect(meta()).toBe('#161518');
    applyTheme('light');
    expect(meta()).toBe('#F3F2EC');
  });
});
