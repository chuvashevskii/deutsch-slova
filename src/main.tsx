import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router';
import { applyTheme, readThemeChoice } from '@/shared/lib/theme';
import { ErrorBoundary } from '@/shared/ui';

import './app/index.css';

// INFO: тема ставится до первой отрисовки, иначе тёмный экран
// на мгновение вспыхнет светлым.
applyTheme(readThemeChoice());

const container = document.getElementById('root');
if (!container) throw new Error('Не найден корневой элемент #root');

createRoot(container).render(
  <StrictMode>
    {/* INFO: внешняя граница стоит снаружи провайдеров — она обязана
        пережить и их собственное падение. */}
    <ErrorBoundary scope="приложение" offerReload>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
