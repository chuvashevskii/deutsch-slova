import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router';
import { ErrorBoundary } from '@/shared/ui';

import './app/index.css';

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
