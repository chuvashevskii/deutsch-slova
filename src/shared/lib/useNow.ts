import { useEffect, useState } from 'react';

/**
 * Текущее время как значение состояния: рендер остаётся чистым,
 * а счётчики «ждёт сейчас» и предпросмотр интервалов сами обновляются.
 */
export const useNow = (intervalMs = 30_000): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
};
