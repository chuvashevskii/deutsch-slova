/**
 * Разбор ошибки, с которой провайдер вернул нас обратно.
 *
 * Supabase кладёт её либо в строку запроса, либо во фрагмент после
 * решётки — зависит от того, на каком шаге всё сорвалось. Смотреть надо
 * в оба места, иначе половина отказов проходит незамеченной.
 */
export interface OAuthFailure {
  code: string;
  text: string;
  /** Что делать — если по коду это понятно. */
  hint: string | null;
}

const HINTS: Array<[RegExp, string]> = [
  [
    /unable to exchange external code/i,
    'Провайдер выдал код, а обменять его на сессию не вышло. Обычно это неверный Client Secret в настройках провайдера.',
  ],
  [
    /redirect_uri_mismatch/i,
    'Адрес возврата не совпадает с тем, что прописан у клиента OAuth.',
  ],
  [/access_denied/i, 'Вы отклонили доступ на экране провайдера.'],
  [/bad_oauth_state|invalid state/i, 'Попытка входа устарела. Начните заново.'],
];

export const readOAuthFailure = (search: string, hash: string): OAuthFailure | null => {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = (name: string) => params.get(name) ?? fragment.get(name);

  const code = pick('error_code') ?? pick('error');
  if (!code) return null;

  const text = pick('error_description')?.replace(/\+/g, ' ') ?? code;
  const hint = HINTS.find(([pattern]) => pattern.test(text) || pattern.test(code))?.[1] ?? null;
  return { code, text, hint };
};
