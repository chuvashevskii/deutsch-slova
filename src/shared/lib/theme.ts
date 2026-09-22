/**
 * Оформление: светлое, тёмное или по системе.
 *
 * Хранится в браузере, а не в учётной записи, намеренно. Это настройка
 * устройства, а не человека: с телефона вечером хочется тёмное, за
 * столом днём светлое, и таскать один выбор между ними — мешать.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export const readThemeChoice = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return CHOICES.includes(stored as ThemeChoice) ? (stored as ThemeChoice) : 'system';
  } catch {
    // INFO: приватный режим и заблокированное хранилище — не повод падать.
    return 'system';
  }
};

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Во что выбор превращается прямо сейчас. */
export const resolveTheme = (choice: ThemeChoice): 'light' | 'dark' =>
  choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice;

/**
 * Проставляет тему на документ. Тёмная палитра живёт в CSS под
 * `[data-theme='dark']`, светлая — умолчание, поэтому атрибут при ней
 * снимается, а не выставляется в 'light'.
 */
export const applyTheme = (choice: ThemeChoice): void => {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  if (resolved === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  // INFO: полоса статуса на телефоне должна совпасть с фоном страницы.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#161518' : '#F3F2EC');
};

export const storeThemeChoice = (choice: ThemeChoice): void => {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // INFO: выбор не переживёт перезагрузку — это терпимо, тема всё равно
    // применится к текущей сессии.
  }
};
