import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { readOAuthFailure, useAuth } from '@/features/auth';

/**
 * Возврат от провайдера. Обычно здесь только ждут сессию, но провайдер
 * может вернуть и отказ — и тогда молча уводить на вход нельзя: со
 * стороны это выглядит так, будто кнопка не работает, и причина
 * теряется вместе с адресом.
 */
export const AuthCallbackPage = () => {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const failure = readOAuthFailure(window.location.search, window.location.hash);

  useEffect(() => {
    if (isLoading || failure) return;
    navigate(session ? '/' : '/auth', { replace: true });
  }, [session, isLoading, failure, navigate]);

  if (failure) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-xl border border-bad/30 bg-bad/5 px-4 py-5">
          <p className="text-[15px] font-semibold text-bad">Вход не завершился</p>
          {failure.hint ? (
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{failure.hint}</p>
          ) : null}
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{failure.text}</p>
          <p className="mt-1 font-mono text-[11px] text-faint">{failure.code}</p>
        </div>
        <Link
          to="/auth"
          className="mt-4 rounded-lg border border-ink bg-ink px-5 py-3 text-center text-[15px] font-semibold text-bg"
        >
          Попробовать ещё раз
        </Link>
      </main>
    );
  }

  return <div className="p-10 text-center text-sm text-muted">Завершаем вход…</div>;
};
