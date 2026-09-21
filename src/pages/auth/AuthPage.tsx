import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { authErrorText, useAuth } from '@/features/auth';
import { isLoopbackHost } from '@/shared/config/resolveSupabaseUrl';

export const AuthPage = () => {
  const { session, isLoading, signInWithGoogle, signInWithPassword, signUpWithPassword } =
    useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted">Проверяем вход…</div>;
  }
  if (session) return <Navigate to="/" replace />;

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(authErrorText(cause));
      setIsSigningIn(false);
    }
  };

  // INFO: Google не принимает приватные адреса вида 192.168.x.x как redirect
  // URI, а локальный Supabase выдаёт себя за 127.0.0.1 — с телефона этот
  // адрес указывает на сам телефон. Поэтому по сети кнопку Google не
  // показываем вовсе: она уводила в «сайт недоступен». Вход по паролю
  // существует только ради проверки вёрстки и в сборку не идёт.
  const overNetwork = import.meta.env.DEV && !isLoopbackHost(window.location.hostname);
  const runLocal = (action: (mail: string, pass: string) => Promise<void>) => () => {
    setError(null);
    setIsSigningIn(true);
    action(email.trim(), password)
      .catch((cause: unknown) => {
        setError(authErrorText(cause));
      })
      .finally(() => setIsSigningIn(false));
  };

  const localSignIn = import.meta.env.DEV ? (
    <section className="mt-8 rounded-xl border border-dashed border-line px-4 py-4">
      <h2 className="text-[13px] font-semibold">Локальный вход</h2>
      <p className="mt-1 text-xs leading-relaxed text-faint">
        Только для дев-режима. Аккаунта ещё нет — нажмите «Завести аккаунт»: почта любая,
        пароль от шести знаков, подтверждение почты локально выключено.
      </p>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="почта"
        autoComplete="off"
        className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px]"
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="пароль"
        autoComplete="off"
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px]"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={runLocal(signInWithPassword)}
          disabled={isSigningIn || !email || !password}
          className="flex-1 rounded-lg border border-line px-3 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
        >
          Войти
        </button>
        <button
          type="button"
          onClick={runLocal(signUpWithPassword)}
          disabled={isSigningIn || !email || !password}
          className="flex-1 rounded-lg border border-line px-3 py-2.5 text-[13.5px] disabled:opacity-50"
        >
          Завести аккаунт
        </button>
      </div>
    </section>
  ) : null;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Zwei<span className="text-feminine">tausend</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Немецкие слова по частотности. На обороте карточки — разбор форм: род, суффикс,
        окончание множественного, ударение и управление глагола. Интервалы повторений
        считает FSRS.
      </p>

      {overNetwork ? (
        <p className="mt-8 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
          Страница открыта по адресу в локальной сети, и вход через Google отсюда не
          работает: Google не принимает такие адреса. Войдите по паролю ниже.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="mt-8 w-full rounded-lg border border-ink bg-ink px-5 py-3.5 text-[15px] font-semibold text-bg transition-opacity disabled:opacity-60"
        >
          {isSigningIn ? 'Открываем Google…' : 'Войти через Google'}
        </button>
      )}

      {error ? (
        <p className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>
      ) : null}

      {localSignIn}

      <p className="mt-6 text-xs leading-relaxed text-faint">
        Прогресс привязан к вашему аккаунту и виден только вам — на уровне базы это закрыто
        политиками Row Level Security.
      </p>
    </main>
  );
};
