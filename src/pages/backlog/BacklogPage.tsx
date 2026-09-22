import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  BACKLOG_STATE_LABEL,
  useAddToBacklog,
  useBacklog,
  useCheckDuplicate,
  useDeleteBacklog,
  useSetBacklogState,
  type BacklogState,
} from '@/entities/backlog';
import { useIsAdmin } from '@/entities/settings';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui';

const STATE_TONE: Record<BacklogState, string> = {
  new: 'border border-line-soft text-faint',
  added: 'bg-ok/10 text-ok',
  rejected: 'bg-surface-2 text-muted',
};

/**
 * Форма добавления. Проверка на дубль двойная: в колоде 1462 слова,
 * наизусть их никто не помнит, а список общий — без проверки он
 * наполнялся бы тем, что уже есть, и одним и тем же от разных людей.
 */
const AddForm = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  // INFO: пришли по ссылке «предложить X» с пустого поиска в списке слов.
  const [word, setWord] = useState(params.get('word') ?? '');
  const [translation, setTranslation] = useState('');
  const [note, setNote] = useState('');
  const add = useAddToBacklog();
  const { data: duplicate } = useCheckDuplicate(word);

  const blocked = Boolean(duplicate?.inDeck || duplicate?.inBacklog);

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Предложить слово</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Строка попадёт в общий список. Карточку со всеми формами потом заводят в Anki, и при
        следующей заливке строка закроется сама.
      </p>
      <input
        type="text"
        value={word}
        maxLength={120}
        onChange={(event) => setWord(event.target.value)}
        placeholder="слово по-немецки"
        className="mt-3 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14.5px]"
      />
      <input
        type="text"
        value={translation}
        maxLength={200}
        onChange={(event) => setTranslation(event.target.value)}
        placeholder="перевод"
        className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14.5px]"
      />
      <input
        type="text"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        placeholder="заметка, если нужна"
        className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14.5px]"
      />

      {duplicate?.inDeck ? (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
          Такое слово уже в колоде:{' '}
          <Link to={`/words?q=${encodeURIComponent(duplicate.inDeck.head)}`} className="underline">
            {duplicate.inDeck.head} — {duplicate.inDeck.translation}
          </Link>
        </p>
      ) : null}
      {duplicate?.inBacklog ? (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
          «{duplicate.inBacklog.word}» уже предложил{' '}
          <b className="font-semibold">{duplicate.inBacklog.nickname}</b>.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!user || !word.trim() || !translation.trim() || blocked || add.isPending}
        onClick={() => {
          if (!user) return;
          add.mutate(
            { userId: user.id, word, translation, note },
            {
              onSuccess: () => {
                setWord('');
                setTranslation('');
                setNote('');
              },
            },
          );
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink bg-ink px-4 py-2.5 text-[14px] font-semibold text-bg disabled:opacity-40"
      >
        {add.isPending ? <Spinner /> : null}
        В бэклог
      </button>
      {add.isError ? (
        <p className="mt-2 text-[12px] text-bad">Не удалось добавить, попробуйте ещё раз.</p>
      ) : null}
    </section>
  );
};

export const BacklogPage = () => {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: rows, isLoading, isError } = useBacklog();
  const setState = useSetBacklogState();
  const remove = useDeleteBacklog();

  return (
    <div className="py-4">
      <AddForm />

      {isLoading ? <p className="py-10 text-center text-sm text-muted">Загружаем…</p> : null}
      {isError ? (
        <p className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          Не удалось загрузить список. Проверьте соединение.
        </p>
      ) : null}

      {rows?.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] leading-relaxed text-faint">
          Список пуст. Сюда складывают слова, встреченные в жизни, чтобы не забыть завести карточку.
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-2">
        {(rows ?? []).map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-serif text-[16px] font-semibold">{row.word}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{row.translation}</span>
              <span
                className={cn(
                  'whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider',
                  STATE_TONE[row.state],
                )}
              >
                {BACKLOG_STATE_LABEL[row.state]}
              </span>
            </div>
            {row.note ? (
              <p className="mt-1 text-[12.5px] leading-snug text-muted">{row.note}</p>
            ) : null}
            <p className="mt-1 font-mono text-[10.5px] text-faint">{row.nickname}</p>

            {isAdmin || row.user_id === user?.id ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isAdmin
                  ? (['new', 'added', 'rejected'] as BacklogState[])
                      .filter((state) => state !== row.state)
                      .map((state) => (
                        <button
                          key={state}
                          type="button"
                          disabled={setState.isPending}
                          onClick={() => setState.mutate({ id: row.id, state })}
                          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] disabled:opacity-40"
                        >
                          {setState.isPending &&
                          setState.variables?.id === row.id &&
                          setState.variables?.state === state ? (
                            <Spinner />
                          ) : null}
                          {BACKLOG_STATE_LABEL[state]}
                        </button>
                      ))
                  : null}
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
