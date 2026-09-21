import { useCallback, useEffect, useRef } from 'react';

/**
 * Сколько миллисекунд прошло с показа текущего элемента.
 * Отсчёт перезапускается, когда меняется ключ.
 */
export const useElapsed = (key: string | undefined): (() => number) => {
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [key]);

  return useCallback(() => (startedAt.current ? Date.now() - startedAt.current : 0), []);
};
