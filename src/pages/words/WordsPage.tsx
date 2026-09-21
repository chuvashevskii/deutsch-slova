import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  STATUS_LABEL,
  useResetProgress,
  useToggleMark,
  type ListStatus,
} from '@/entities/review';
import {
  posLabel,
  useWord,
  useWordsFacets,
  useWordsPage,
  type WordListRow,
} from '@/entities/word';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { LoadError, Skeleton, WordRowsSkeleton } from '@/shared/ui';
import { WordAnswer } from '@/widgets/word-answer/WordAnswer';

import {
  clampPage,
  isFilterEmpty,
  PAGE_SIZE,
  readFilter,
  writeFilter,
  type ProgressFilter,
  type WordsFilter,
} from './wordsFilter';

const GENUS_TEXT: Record<string, string> = {
  m: 'text-masculine',
  f: 'text-feminine',
  n: 'text-neuter',
};

const POS_OPTIONS = [
  { value: 'noun', label: 'существительные', short: 'сущ.' },
  { value: 'verb', label: 'глаголы', short: 'глаголы' },
  { value: 'adj', label: 'прилагательные', short: 'прил.' },
  { value: 'adverb', label: 'наречия', short: 'наречия' },
  { value: 'pronoun', label: 'местоимения', short: 'мест.' },
  { value: 'numeral', label: 'числительные', short: 'числ.' },
  { value: 'conjunction', label: 'союзы', short: 'союзы' },
  { value: 'preposition', label: 'предлоги', short: 'предлоги' },
  { value: 'particle', label: 'частицы', short: 'частицы' },
] as const;

const GENUS_OPTIONS = [
  { value: 'm', label: 'der' },
  { value: 'f', label: 'die' },
  { value: 'n', label: 'das' },
] as const;

const STATUS_OPTIONS = [
  { value: 'new', label: 'новые' },
  { value: 'learning', label: 'учу' },
  { value: 'known', label: 'знаю' },
  { value: 'declared', label: 'знаю сам' },
  { value: 'requested', label: 'на сегодня' },
] as const satisfies ReadonlyArray<{ value: ProgressFilter; label: string }>;

const toggled = <Item extends string>(list: Item[], value: Item): Item[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'touch-manipulation rounded-full border border-line px-3 py-1 text-[12.5px] text-muted',
      active && 'border-ink bg-ink text-bg',
    )}
  >
    {children}
  </button>
);

/**
 * Действия над словом в раскрытой строке. Отдельной кнопки «отменить»
 * нет: нажатие по стоящей отметке её снимает.
 */
const WordActions = ({ row }: { row: WordListRow }) => {
  const { user } = useAuth();
  const toggleMark = useToggleMark();
  const resetProgress = useResetProgress();
  const declared = row.status === 'declared';
  const busy = toggleMark.isPending || resetProgress.isPending;

  if (!user) return null;

  const action = (mark: 'requested' | 'known', active: boolean) => () =>
    toggleMark.mutate({ userId: user.id, wordId: row.id, mark, active });

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-soft pt-3">
      <button
        type="button"
        disabled={busy || declared}
        onClick={action('requested', row.requested)}
        aria-pressed={row.requested}
        className={cn(
          'rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40',
          row.requested && 'border-ink bg-ink text-bg',
        )}
      >
        {row.requested ? 'Убрать из очереди' : 'Учить сегодня'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={action('known', declared)}
        aria-pressed={declared}
        className={cn(
          'rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-40',
          declared && 'border-ink bg-ink text-bg',
        )}
      >
        {declared ? 'Вернуть в колоду' : 'Знаю'}
      </button>
      {row.has_progress ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => resetProgress.mutate({ userId: user.id, wordId: row.id })}
          className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-bad disabled:opacity-40"
        >
          Сбросить прогресс
        </button>
      ) : null}
      {toggleMark.isError || resetProgress.isError ? (
        <span className="w-full text-[12px] text-bad">Не удалось сохранить, попробуйте ещё раз.</span>
      ) : null}
    </div>
  );
};

/** Полная карточка приходит отдельным запросом — только для раскрытой строки. */
const ExpandedWord = ({ row }: { row: WordListRow }) => {
  const { data: word, isLoading, isError } = useWord(row.id);
  if (isLoading) {
    return (
      <div className="py-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
    );
  }
  if (isError || !word) {
    return <p className="py-3 text-center text-[13px] text-bad">Не удалось загрузить карточку</p>;
  }
  return (
    <>
      <WordAnswer word={word} />
      <WordActions row={row} />
    </>
  );
};

export const WordsPage = () => {
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  const filter = useMemo(() => readFilter(params), [params]);
  const { data: facets } = useWordsFacets();

  // INFO: условия и страница живут в адресе, а не в состоянии компонента:
  // так список переживает перезагрузку и его можно передать ссылкой.
  const update = (patch: Partial<WordsFilter>) => {
    const next = { ...filter, ...patch };
    if (patch.page === undefined) next.page = 1;
    setParams(writeFilter(next), { replace: true });
  };

  // INFO: артикли — ветка существительного. Выбор артикля включает ветку,
  // а снятие ветки уносит артикли с собой: род без существительных
  // не отбирает ничего.
  const toggleNoun = () => {
    const isOn = filter.pos.includes('noun');
    update({ pos: toggled([...filter.pos], 'noun'), genus: isOn ? [] : filter.genus });
  };

  const toggleGenus = (value: 'm' | 'f' | 'n') => {
    const genus = toggled([...filter.genus], value);
    const pos = genus.length && !filter.pos.includes('noun') ? [...filter.pos, 'noun'] : filter.pos;
    update({ genus, pos });
  };

  const {
    data: pageData,
    isLoading,
    isError: pageFailed,
    refetch: reloadPage,
  } = useWordsPage({
    pos: filter.pos,
    genus: filter.genus,
    status: filter.status,
    query: filter.query,
    limit: PAGE_SIZE,
    offset: (Math.max(1, filter.page) - 1) * PAGE_SIZE,
  });

  const total = pageData?.total ?? 0;
  const pageRows = pageData?.rows ?? [];
  const page = clampPage(filter.page, total);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // INFO: счётчики фильтра живут отдельной выборкой с бесконечным кэшем,
  // и одна неудача оставляла бы их пустыми на всю сессию. Судить по ним
  // о размере колоды поэтому нельзя: список объявил бы её пустой.
  const facetTotal = Object.values(facets?.pos ?? {}).reduce((sum, value) => sum + value, 0);
  const deckIsEmpty = !pageFailed && !isLoading && total === 0 && isFilterEmpty(filter);

  // INFO: артикль подразумевает существительное, поэтому в подписи он
  // приписывается к нему через двоеточие, а не идёт отдельным пунктом.
  const genusLabels = filter.genus.map(
    (value) => GENUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
  );
  const chosenLabels = filter.pos.map((value) => {
    const short = POS_OPTIONS.find((option) => option.value === value)?.short ?? value;
    return value === 'noun' && genusLabels.length ? `${short}: ${genusLabels.join(', ')}` : short;
  });
  const selectSummary =
    chosenLabels.length === 0
      ? 'все слова'
      : chosenLabels.length <= 2
        ? chosenLabels.join(', ')
        : `выбрано ${chosenLabels.length}`;

  const headOf = (word: WordListRow): string =>
    word.pos === 'noun' && word.singular ? word.singular : word.head;

  return (
    <div>
      <div className="flex items-center gap-1.5 pt-3">
        <details className="relative min-w-0 flex-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] [&::-webkit-details-marker]:hidden">
            <span className={cn('truncate', chosenLabels.length && 'font-medium')}>
              {selectSummary}
            </span>
            <span aria-hidden className="shrink-0 font-mono text-[10px] text-faint">
              ▾
            </span>
          </summary>
          <div className="absolute z-20 mt-1 max-h-[60vh] w-full overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface shadow-lg">
            {POS_OPTIONS.map((option) => (
              <div key={option.value}>
                <label className="flex cursor-pointer items-center gap-2.5 border-b border-line-soft px-3 py-2.5 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={filter.pos.includes(option.value)}
                    onChange={
                      option.value === 'noun'
                        ? toggleNoun
                        : () => update({ pos: toggled([...filter.pos], option.value) })
                    }
                    className="h-4 w-4 shrink-0 accent-ink"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-faint">
                    {facets?.pos[option.value] ?? 0}
                  </span>
                </label>
                {option.value === 'noun'
                  ? GENUS_OPTIONS.map((genus) => (
                      <label
                        key={genus.value}
                        className="flex cursor-pointer items-center gap-2.5 border-b border-line-soft bg-surface-2 py-2 pl-9 pr-3 text-[13px]"
                      >
                        <input
                          type="checkbox"
                          checked={filter.genus.includes(genus.value)}
                          onChange={() => toggleGenus(genus.value)}
                          className="h-3.5 w-3.5 shrink-0 accent-ink"
                        />
                        <span
                          className={cn('min-w-0 flex-1 truncate font-serif', GENUS_TEXT[genus.value])}
                        >
                          {genus.label}
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-faint">
                          {facets?.genus[genus.value] ?? 0}
                        </span>
                      </label>
                    ))
                  : null}
              </div>
            ))}
          </div>
        </details>

        <button
          type="button"
          onClick={() => setParams(new URLSearchParams(), { replace: true })}
          disabled={isFilterEmpty(filter)}
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12.5px] text-muted disabled:opacity-40"
        >
          Сбросить
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 py-2.5">
        {STATUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            active={filter.status.includes(option.value)}
            onClick={() => update({ status: toggled([...filter.status], option.value) })}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      <input
        type="search"
        value={filter.query}
        onChange={(event) => update({ query: event.target.value })}
        placeholder="Поиск по слову, переводу или рангу"
        className="mb-2.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14.5px] outline-none focus:border-focus"
      />

      <p className="px-0.5 pb-2 font-mono text-[11px] text-faint">
        {facetTotal === 0 || total === facetTotal ? `${total} слов` : `${total} из ${facetTotal}`}
        {pageCount > 1 ? ` · страница ${page} из ${pageCount}` : ''}
      </p>

      {/* INFO: сбой загрузки показывается отдельно от пустого результата.
          Раньше неудавшийся запрос выглядел как «в колоде пока нет слов» —
          то есть приложение уверенно сообщало о том, чего не видело. */}
      {pageFailed ? (
        <LoadError
          what="список слов"
          onRetry={() => {
            reloadPage().catch(() => undefined);
          }}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {isLoading && pageRows.length === 0 ? (
          <WordRowsSkeleton />
        ) : pageRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {pageFailed ? 'Список не загрузился' : deckIsEmpty ? 'В колоде пока нет слов' : 'Ничего не найдено'}
            {/* INFO: искали слово и не нашли — самый естественный момент
                предложить завести его на будущее. */}
            {!isLoading && !pageFailed && !deckIsEmpty && filter.query.trim() ? (
              <Link
                to={`/backlog?word=${encodeURIComponent(filter.query.trim())}`}
                className="mt-3 inline-block rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink"
              >
                Предложить «{filter.query.trim()}» в бэклог
              </Link>
            ) : null}
          </div>
        ) : (
          pageRows.map((word) => {
            const status = word.status as ListStatus;
            const isOpen = openId === word.id;
            return (
              <div key={word.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : word.id)}
                  className={cn(
                    'grid w-full touch-manipulation grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-left',
                    isOpen && 'bg-surface-2',
                  )}
                >
                  <span className="text-right font-mono text-[11px] tabular-nums text-faint">
                    {word.rank ?? '·'}
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        className={cn(
                          'truncate font-serif text-[17.5px] font-semibold leading-tight',
                          word.genus ? GENUS_TEXT[word.genus] : undefined,
                        )}
                      >
                        {headOf(word)}
                      </span>
                      <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-faint">
                        {posLabel(word)}
                      </span>
                    </span>
                    <span className="truncate text-[12.5px] leading-snug text-muted">
                      {word.translation}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {word.requested ? (
                      <span
                        title="Стоит в очереди на сегодня"
                        className="whitespace-nowrap rounded-full bg-ink px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-bg"
                      >
                        сегодня
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider',
                        status === 'known' && 'bg-ok/10 text-ok',
                        status === 'learning' && 'bg-gold/15 text-preposition',
                        status === 'declared' && 'bg-surface-2 text-muted',
                        status === 'new' && 'border border-line-soft text-faint',
                      )}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-b border-line-soft bg-surface-2 px-3.5 pb-4 pt-1.5">
                    <ExpandedWord row={word} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 py-3">
          <button
            type="button"
            onClick={() => update({ page: page - 1 })}
            disabled={page <= 1}
            className="rounded-lg border border-line px-3.5 py-2 text-[13px] disabled:opacity-40"
          >
            Назад
          </button>
          <span className="font-mono text-[11.5px] tabular-nums text-faint">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => update({ page: page + 1 })}
            disabled={page >= pageCount}
            className="rounded-lg border border-line px-3.5 py-2 text-[13px] disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      ) : null}
    </div>
  );
};
