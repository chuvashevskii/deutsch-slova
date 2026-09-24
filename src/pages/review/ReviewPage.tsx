import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useIsAdmin } from '@/entities/settings';
import type { NestKind } from '@/entities/word';
import {
  EDIT_MODES,
  EDIT_TABLES,
  EDIT_TABLE_SHORT,
  editTable,
  fieldLabel,
  matchesMode,
  useEdits,
  useRevertEdit,
  type EditMode,
  type EditRow,
  type EditTable,
} from '@/entities/word-edit';
import { cn } from '@/shared/lib/cn';
import { Busy, busyClasses, LoadError, WordRowsSkeleton } from '@/shared/ui';

import { NestList } from './NestList';

/**
 * Три вида одного разбора.
 *
 * «Правки» отвечают на вопрос «что я изменил». Гнёзда — на другой:
 * «верно ли это решение», и для него надо видеть не правку, а всю
 * пару или тройку сразу, с пометами и подсказками. Список слов для
 * этого не годится: он показывает их через сотню строк друг от друга.
 */
const VIEWS = [
  { key: 'edits', label: 'Правки' },
  { key: 'head', label: 'По слову' },
  { key: 'translation', label: 'По переводу' },
] as const;

type View = (typeof VIEWS)[number]['key'];

const REASON_TONE: Record<string, string> = {
  'уровень 1': 'bg-surface-2 text-muted',
  'уровень 2': 'bg-gold/15 text-preposition',
  'уровень 3': 'bg-ok/10 text-ok',
  разделение: 'bg-bad/10 text-bad',
  формат: 'bg-surface-2 text-faint',
  ранг: 'bg-surface-2 text-faint',
};

const Value = ({ text, kind }: { text: string | null; kind: 'old' | 'new' }) => {
  if (!text) {
    return <span className="italic text-faint">пусто</span>;
  }
  return (
    <span className={kind === 'old' ? 'text-muted line-through' : 'font-semibold'}>{text}</span>
  );
};

const EditRowView = ({ row }: { row: EditRow }) => {
  const revert = useRevertEdit();
  const reverting = revert.isPending && revert.variables === row.id;
  const reverted = row.reverted_at !== null;
  // Поверх этой правки легла другая: «стало» здесь описывает не словарь,
  // а промежуточный шаг. Откатывать нечего — откатит следующую.
  const superseded = row.superseded === true;
  // INFO: строка о рождении карточки — «было» пусто, потому что до неё
  // карточки не существовало. Откат тут значит удаление созданного,
  // и кнопка обязана называть это своим именем: «Откатить» обещало бы
  // возврат прежнего значения, а возвращать нечего.
  const isCreation =
    row.old_value === null && (row.reason === 'разделение' || row.reason === 'создание');

  return (
    <li
      className={cn(
        'rounded-xl border border-line bg-surface px-3.5 py-3',
        reverted && 'opacity-60',
        row.disputed && !reverted && 'border-gold/50',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          to={`/words?q=${encodeURIComponent(row.head ?? '')}`}
          className="font-serif text-[16px] font-semibold underline decoration-line underline-offset-2"
        >
          {row.head}
        </Link>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{row.translation}</span>
        {row.rank ? (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] text-faint">
            №{row.rank}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[9.5px] text-faint">
            вне списка
          </span>
        )}
        <span
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider',
            REASON_TONE[row.reason ?? ''] ?? 'bg-surface-2 text-muted',
          )}
        >
          {row.reason}
        </span>
        {row.is_draft ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
            черновик
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[13.5px] leading-relaxed">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          {fieldLabel(row.field ?? '')}
        </span>{' '}
        <Value text={row.old_value} kind="old" /> <span className="text-faint">→</span>{' '}
        <Value text={row.new_value} kind="new" />
      </p>

      {row.note ? <p className="mt-1 text-[12.5px] leading-snug text-muted">{row.note}</p> : null}

      <div className="mt-2 flex items-center gap-2">
        {reverted || superseded ? (
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            {reverted ? 'откачено' : 'перекрыта поздней правкой'}
          </span>
        ) : (
          <button
            type="button"
            disabled={revert.isPending}
            onClick={() => revert.mutate(row.id as number)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-bad',
              busyClasses(reverting),
            )}
          >
            <Busy busy={reverting} label={isCreation ? 'Удаляем' : 'Откатываем'}>
              {isCreation ? 'Удалить карточку' : 'Откатить'}
            </Busy>
          </button>
        )}
        {/* INFO: причина отказа приходит из базы словами: «карточка уже
            согласована», «по ней идёт обучение». Заменять её на общее
            «не удалось» значит прятать единственное, что объясняет отказ. */}
        {revert.isError && revert.variables === row.id ? (
          <span className="text-[12px] leading-snug text-bad">
            {revert.error instanceof Error ? revert.error.message : 'Не удалось откатить'}
          </span>
        ) : null}
      </div>
    </li>
  );
};

/**
 * Разбор колоды на однозначность ответа: что именно изменено и чем это
 * вернуть назад.
 *
 * Отметка о сверке с правленых карточек не снимается — так решено
 * владельцем колоды, — поэтому правка живёт в словаре сразу, а этот
 * экран остаётся единственным местом, где её видно. Отсюда и кнопка
 * отката на каждой строке: страховка, а не удобство.
 */
export const ReviewPage = () => {
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data, isLoading, isError, refetch } = useEdits();
  const [table, setTable] = useState<EditTable>('Существительные');
  const [mode, setMode] = useState<EditMode>('disputed');
  const [view, setView] = useState<View>('edits');

  const byTable = useMemo(() => {
    const map = new Map<EditTable, EditRow[]>(EDIT_TABLES.map((name) => [name, []]));
    for (const row of data?.rows ?? []) {
      map.get(editTable({ pos: row.pos, wortart: row.wortart }))?.push(row);
    }
    return map;
  }, [data]);

  if (adminLoading || isLoading) return <WordRowsSkeleton />;

  if (!isAdmin) {
    return (
      <div className="py-4">
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] leading-relaxed text-faint">
          Страница для администратора колоды: здесь сверяют правки словаря.
        </p>
      </div>
    );
  }

  if (isError) return <LoadError what="журнал правок" onRetry={() => void refetch()} />;

  const rows = (byTable.get(table) ?? []).filter((row) => matchesMode(row, mode));
  const open = (byTable.get(table) ?? []).filter((row) => row.reverted_at === null).length;

  return (
    <div className="py-4">
      <header className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <h1 className="text-[15px] font-semibold">Правки словаря</h1>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          Разбор колоды на однозначность ответа. Правки уже в словаре — строку можно откатить.
        </p>
        {data?.truncated ? (
          <p className="mt-2 rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] text-bad">
            Журнал длиннее, чем помещается на экран, — показана только последняя часть.
          </p>
        ) : null}
      </header>

      <nav className="mt-2.5 flex flex-wrap gap-1.5">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[12px]',
              item.key === view ? 'border-ink bg-ink text-bg' : 'border-line text-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <nav className="mt-1.5 flex flex-wrap gap-1.5">
        {EDIT_TABLES.map((name) => {
          const n =
            view === 'edits'
              ? (byTable.get(name) ?? []).filter((row) => row.reverted_at === null).length
              : null;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTable(name)}
              title={name}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[12px]',
                name === table ? 'border-ink bg-ink text-bg' : 'border-line text-muted',
              )}
            >
              {EDIT_TABLE_SHORT[name]}
              {n === null ? null : (
                <span className="ml-1.5 font-mono text-[10.5px] opacity-70">{n}</span>
              )}
            </button>
          );
        })}
      </nav>

      {view !== 'edits' ? (
        <NestList kind={view as NestKind} table={table} />
      ) : (
        <>
          <nav className="mt-2 flex flex-wrap gap-1.5">
            {EDIT_MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={cn(
                  'rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider',
                  item.key === mode ? 'bg-surface-2 text-ink' : 'text-faint',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-faint">
            {rows.length} из {open}
          </p>

          {rows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] leading-relaxed text-faint">
              {open === 0
                ? 'В этой таблице правок пока нет.'
                : 'Под этот отбор ничего не попало — попробуйте «все».'}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {rows.map((row) => (
                <EditRowView key={row.id} row={row} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
