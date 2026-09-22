import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/features/auth';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { LearnPage } from '@/pages/learn/LearnPage';
import { CardSkeleton } from '@/shared/ui';
import { AppLayout } from '@/widgets/app-layout/AppLayout';

/*
 * INFO: «Учить» и вход грузятся сразу — это первый экран и для вошедшего,
 * и для нового человека, откладывать их значит добавить лишний круг
 * к самому частому пути. Остальное подгружается по требованию: список,
 * статистика и редкие разделы на карточке не нужны, а с телефона каждый
 * лишний килобайт заметен.
 */
const WordsPage = lazy(() =>
  import('@/pages/words/WordsPage').then((module) => ({ default: module.WordsPage })),
);
const StatsPage = lazy(() =>
  import('@/pages/stats/StatsPage').then((module) => ({ default: module.StatsPage })),
);
const MorePage = lazy(() =>
  import('@/pages/more/MorePage').then((module) => ({ default: module.MorePage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const FeedbackPage = lazy(() =>
  import('@/pages/feedback/FeedbackPage').then((module) => ({ default: module.FeedbackPage })),
);
const BacklogPage = lazy(() =>
  import('@/pages/backlog/BacklogPage').then((module) => ({ default: module.BacklogPage })),
);
const ReviewPage = lazy(() =>
  import('@/pages/review/ReviewPage').then((module) => ({ default: module.ReviewPage })),
);

export const AppRouter = () => (
  <Routes>
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route
      element={
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      }
    >
      <Route index element={<LearnPage />} />
      <Route
        path="/words"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <WordsPage />
          </Suspense>
        }
      />
      <Route
        path="/stats"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <StatsPage />
          </Suspense>
        }
      />
      <Route
        path="/more"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <MorePage />
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <SettingsPage />
          </Suspense>
        }
      />
      <Route
        path="/feedback"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <FeedbackPage />
          </Suspense>
        }
      />
      <Route
        path="/backlog"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <BacklogPage />
          </Suspense>
        }
      />
      {/* INFO: страница администратора колоды. Маршрут открыт всем
          вошедшим, а содержимое — нет: сама страница отвечает отказом.
          Прятать маршрут не за чем, прятать нечего. */}
      <Route
        path="/review"
        element={
          <Suspense fallback={<CardSkeleton />}>
            <ReviewPage />
          </Suspense>
        }
      />
    </Route>
    {/* INFO: неизвестный адрес ведёт на главную, а не в пустую страницу. */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
