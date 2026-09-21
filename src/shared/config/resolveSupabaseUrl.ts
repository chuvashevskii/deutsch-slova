const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Открыта ли страница на самой машине разработчика, а не по адресу в сети. */
export const isLoopbackHost = (hostname: string): boolean => LOCAL_HOSTS.has(hostname);

/**
 * Адрес локального Supabase для устройства, с которого открыта страница.
 *
 * В `.env` он записан как 127.0.0.1 — с телефона в той же сети этот адрес
 * указывает на сам телефон, и приложение осталось бы без данных. Поэтому
 * в дев-режиме хост берётся из адресной строки: открыли по 192.168.0.167 —
 * туда же уходят и запросы к базе. В продакшене адрес не трогается.
 */
export const resolveSupabaseUrl = (configured: string, pageHost: string, isDev: boolean): string => {
  if (!isDev || !pageHost || LOCAL_HOSTS.has(pageHost)) return configured;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return configured;
  }
  if (!LOCAL_HOSTS.has(url.hostname)) return configured;
  url.hostname = pageHost;
  return url.toString().replace(/\/$/, '');
};
