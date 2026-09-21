import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '@/features/auth';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { AuthPage } from '@/pages/auth/AuthPage';
import { BacklogPage } from '@/pages/backlog/BacklogPage';
import { FeedbackPage } from '@/pages/feedback/FeedbackPage';
import { LearnPage } from '@/pages/learn/LearnPage';
import { MorePage } from '@/pages/more/MorePage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StatsPage } from '@/pages/stats/StatsPage';
import { WordsPage } from '@/pages/words/WordsPage';
import { AppLayout } from '@/widgets/app-layout/AppLayout';

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
      <Route path="/words" element={<WordsPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="/more" element={<MorePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/backlog" element={<BacklogPage />} />
    </Route>
    {/* Неизвестный адрес ведёт на главную, а не в пустую страницу. */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
