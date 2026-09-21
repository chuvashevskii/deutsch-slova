import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth';

/** Supabase сам разбирает параметры в адресе, здесь только ждём сессию. */
export const AuthCallbackPage = () => {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    navigate(session ? '/' : '/auth', { replace: true });
  }, [session, isLoading, navigate]);

  return <div className="p-10 text-center text-sm text-muted">Завершаем вход…</div>;
};
