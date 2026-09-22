import { describe, expect, it } from 'vitest';

import { readOAuthFailure } from './oauthError';

describe('ошибка возврата от провайдера', () => {
  it('читает отказ из строки запроса', () => {
    const failure = readOAuthFailure(
      '?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A',
      '',
    );
    expect(failure?.code).toBe('unexpected_failure');
    expect(failure?.text).toContain('Unable to exchange external code');
    expect(failure?.hint).toContain('Client Secret');
  });

  it('читает отказ из фрагмента: там он оказывается на другом шаге', () => {
    const failure = readOAuthFailure('', '#error=access_denied&error_description=The+user+denied');
    expect(failure?.code).toBe('access_denied');
    expect(failure?.hint).toContain('отклонили');
  });

  it('успешный возврат отказом не считается', () => {
    expect(readOAuthFailure('?code=abc123', '')).toBeNull();
    expect(readOAuthFailure('', '#access_token=xyz&token_type=bearer')).toBeNull();
  });

  it('незнакомый отказ показывается как есть, без выдуманной подсказки', () => {
    const failure = readOAuthFailure('?error=teapot&error_description=I+am+a+teapot', '');
    expect(failure?.code).toBe('teapot');
    expect(failure?.text).toBe('I am a teapot');
    expect(failure?.hint).toBeNull();
  });
});
