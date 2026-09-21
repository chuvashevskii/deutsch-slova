import { describe, expect, it } from 'vitest';

import { authErrorText } from './authError';

describe('сообщения об ошибке входа', () => {
  it('переводит то, что действительно случается', () => {
    expect(authErrorText(new Error('Invalid login credentials'))).toBe('Неверная почта или пароль');
    expect(authErrorText(new Error('Failed to fetch'))).toBe(
      'Нет связи с базой. Проверьте, что она запущена',
    );
  });

  it('подставляет число из сообщения, а не выдумывает своё', () => {
    expect(authErrorText(new Error('Password should be at least 6 characters'))).toBe(
      'Пароль короче 6 знаков',
    );
  });

  it('незнакомое сообщение показывает как есть, а не прячет за общей фразой', () => {
    expect(authErrorText(new Error('Signups not allowed for this instance'))).toBe(
      'Signups not allowed for this instance',
    );
  });

  it('переживает не-ошибку и пустоту', () => {
    expect(authErrorText(null)).toBe('Не удалось войти');
    expect(authErrorText('строка')).toBe('строка');
  });
});
