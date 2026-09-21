import { describe, expect, it } from 'vitest';

import { isLoopbackHost, resolveSupabaseUrl } from './resolveSupabaseUrl';

const LOCAL = 'http://127.0.0.1:54421';

describe('resolveSupabaseUrl', () => {
  it('подставляет хост страницы, когда её открыли по адресу в сети', () => {
    expect(resolveSupabaseUrl(LOCAL, '192.168.0.167', true)).toBe('http://192.168.0.167:54421');
  });

  it('оставляет адрес как есть на самой машине разработчика', () => {
    expect(resolveSupabaseUrl(LOCAL, 'localhost', true)).toBe(LOCAL);
    expect(resolveSupabaseUrl(LOCAL, '127.0.0.1', true)).toBe(LOCAL);
  });

  it('в продакшене не вмешивается', () => {
    expect(resolveSupabaseUrl(LOCAL, '192.168.0.167', false)).toBe(LOCAL);
  });

  it('не трогает адрес размещённого Supabase', () => {
    const hosted = 'https://abcdef.supabase.co';
    expect(resolveSupabaseUrl(hosted, '192.168.0.167', true)).toBe(hosted);
  });

  it('возвращает исходную строку, если это не адрес', () => {
    expect(resolveSupabaseUrl('не-адрес', '192.168.0.167', true)).toBe('не-адрес');
  });
});

describe('isLoopbackHost', () => {
  it('узнаёт машину разработчика', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
  });

  it('адрес в локальной сети машиной разработчика не считает', () => {
    expect(isLoopbackHost('192.168.0.167')).toBe(false);
  });
});
