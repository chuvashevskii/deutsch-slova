import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  useDeleteFeedback,
  useFeedback,
  useResolveFeedback,
  type FeedbackRow,
} from '@/entities/feedback';
import { useIsAdmin } from '@/entities/settings';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const ContextBlock = ({ row }: { row: FeedbackRow }) => {
  const context = row.context;
  if (!context) return null;
  const keys = Object.keys(context.expected ?? {});
  if (keys.length === 0 && !context.answeredGenus) return null;

  return (
    <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted">
      <p className="text-faint">что было введено</p>
      {keys.map((key) => (
        <p key={key}>
          {key}: <b className="text-ink">{context.given[key] || '—'}</b>
          {context.given[key] !== context.expected[key] ? (
            <> · ожидалось {context.expected[key]}</>
          ) : null}
        </p>
      ))}
      {context.answeredGenus ? <p>артикль: {context.answeredGenus}</p> : null}
    </div>
  );
};

export const FeedbackPage = () => {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const [mine, setMine] = useState(false);
  const { data: rows, isLoading, isError } = useFeedback(mine, user?.id);
  const resolve = useResolveFeedback();
  const remove = useDeleteFeedback();

  return (
    <div className="py-4">
      <div className="mb-3 flex gap-1.5">
        {[
          { value: false, label: 'все' },
          { value: true, label: 'мои' },
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={mine === option.value}
            onClick={() => setMine(option.value)}
            className={cn(
              'rounded-full border border-line px-3 py-1 text-[12.5px]',
              mine === option.value && 'border-ink bg-ink text-bg',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="py-10 text-center text-sm text-muted">Загружаем…</p> : null}
      {isError ? (
        <p className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          Не удалось загрузить список. Проверьте соединение.
        </p>
      ) : null}

      {rows?.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-[13px] leading-relaxed text-faint">
          Пока ничего. Обращение отправляется с оборота карточки — кнопкой «Что-то не так
          с карточкой» на экране <Link to="/" className="underline">Учить</Link> или в раскрытой
          строке <Link to="/words" className="underline">списка слов</Link>.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {(rows ?? []).map((row) => (
          <li
            key={row.id}
            className={cn(
              'rounded-xl border border-line bg-surface p-3.5',
              row.resolved_at && 'opacity-60',
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                to={`/words?q=${encodeURIComponent(String(row.snapshot.head ?? ''))}`}
                className="font-serif text-[16px] font-semibold underline decoration-line"
              >
                {row.snapshot.singular ?? row.snapshot.head ?? row.word_id}
              </Link>
              {row.sameWord > 1 ? (
                <span
                  title="Столько обращений по этому слову — похоже, дело в карточке"
                  className="rounded-full bg-bad/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-bad"
                >
                  жалоб {row.sameWord}
                </span>
              ) : null}
              {row.resolved_at ? (
                <span className="rounded-full bg-ok/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-ok">
                  разобрано
                </span>
              ) : null}
              <span className="ml-auto font-mono text-[10.5px] text-faint">
                {row.nickname} · {when(row.created_at)}
              </span>
            </div>

            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{row.message}</p>
            <ContextBlock row={row} />

            {isAdmin || row.user_id === user?.id ? (
              <div className="mt-2.5 flex gap-1.5">
                {isAdmin ? (
                  <button
                    type="button"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ id: row.id, resolved: !row.resolved_at })}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] disabled:opacity-40"
                  >
                    {resolve.isPending && resolve.variables?.id === row.id ? <Spinner /> : null}
                    {row.resolved_at ? 'Вернуть в работу' : 'Разобрано'}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-bad disabled:opacity-40"
                >
                  {remove.isPending && remove.variables === row.id ? <Spinner /> : null}
                  Удалить
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};
