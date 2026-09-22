import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Что именно перестало работать: «приложение», «этот экран». */
  scope: string;
  /** Показывать ли кнопку перезагрузки страницы. У экрана хватает навигации. */
  offerReload?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Ловит ошибку отрисовки и показывает сообщение вместо белого экрана.
 *
 * Без неё любая ошибка в компоненте уносила всё приложение в пустую
 * страницу: ни текста, ни навигации, ни способа понять, что случилось.
 * Это та же болезнь, что «сбой загрузки выглядит как пустые данные», —
 * приложение молчит там, где должно объяснить.
 *
 * Границ две. Внешняя держит приложение целиком, внутренняя стоит вокруг
 * экрана: падение одного экрана не должно уносить навигацию, с которой
 * можно уйти на рабочий.
 *
 * Текст ошибки показывается только в дев-режиме. В продакшене он ничего
 * не говорит человеку, а выдать может лишнее.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // INFO: в консоль пишем всегда — это единственный след, по которому
    // ошибку потом искать, и в продакшене тоже.
    console.error('Ошибка отрисовки:', error, info.componentStack);
  }

  private readonly retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-[600px] px-4 py-10">
        <div className="rounded-xl border border-bad/30 bg-bad/5 px-4 py-6 text-center">
          <p className="text-[15px] font-semibold text-bad">Что-то сломалось: {this.props.scope}</p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-muted">
            Это ошибка в самом приложении, а не в ваших данных. Прогресс и словарь на месте.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-lg border border-ink bg-ink px-4 py-2 text-[13px] font-semibold text-bg"
            >
              Попробовать ещё раз
            </button>
            {this.props.offerReload ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-semibold"
              >
                Перезагрузить
              </button>
            ) : null}
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-left font-mono text-[11px] text-muted">
              {error.message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
