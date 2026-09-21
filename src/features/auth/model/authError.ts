/**
 * Сообщения Supabase приходят по-английски, а всё остальное в приложении
 * по-русски. Показывать человеку «Invalid login credentials» посреди
 * русского экрана — значит вываливать на него внутренности библиотеки.
 *
 * Переводятся только те случаи, которые действительно случаются при входе.
 * Незнакомое сообщение показывается как есть: выдуманный общий текст
 * скрыл бы настоящую причину, а она может быть важна.
 */
const KNOWN: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Неверная почта или пароль'],
  [/email not confirmed/i, 'Почта не подтверждена'],
  [/user already registered/i, 'Такой аккаунт уже есть — войдите'],
  [/password should be at least (\d+)/i, 'Пароль короче $1 знаков'],
  [/rate limit|too many requests/i, 'Слишком много попыток, подождите минуту'],
  [/failed to fetch|network/i, 'Нет связи с базой. Проверьте, что она запущена'],
];

export const authErrorText = (cause: unknown): string => {
  const raw = cause instanceof Error ? cause.message : String(cause ?? '');
  for (const [pattern, text] of KNOWN) {
    const match = raw.match(pattern);
    if (match) return text.replace('$1', match[1] ?? '');
  }
  return raw || 'Не удалось войти';
};
