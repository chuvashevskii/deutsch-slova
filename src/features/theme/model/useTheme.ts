import { useCallback, useEffect, useState } from 'react';

import { applyTheme, readThemeChoice, storeThemeChoice, type ThemeChoice } from '@/shared/lib/theme';

/**
 * Выбор оформления и слежение за системным.
 *
 * Пока выбрано «как в системе», приложение обязано переключаться вместе
 * с ней — человек меняет её вечером и ждёт, что страница потемнеет,
 * а не что надо перезагрузиться.
 */
export const useTheme = () => {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => applyTheme('system');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [choice]);

  const change = useCallback((next: ThemeChoice) => {
    storeThemeChoice(next);
    setChoice(next);
  }, []);

  return { choice, change };
};
