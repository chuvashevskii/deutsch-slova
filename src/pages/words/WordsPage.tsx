import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { STATUS_LABEL, useResetProgress, useToggleMark, type ListStatus } from '@/entities/review';
import { useIsAdmin } from '@/entities/settings';
import {
  posLabel,
  useWord,
  useWordsFacets,
  useWordsInfinite,
  WORDS_BATCH,
  type WordListRow,
} from '@/entities/word';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { useCloseDetails } from '@/shared/lib/useCloseDetails';
import { Busy, busyClasses, LoadError, StableLabel, WordRowsSkeleton } from '@/shared/ui';
import { WordAnswer } from '@/widgets/word-answer/WordAnswer';

import {
  isFilterEmpty,
  readFilter,
  writeFilter,
  type ProgressFilter,
  type WordsFilter,
} from './wordsFilter';

/** Длинный запрос в подписи кнопки: полностью он её распирает. */
const shorten = (text: string): string => (text.length > 24 ? `${text.slice(0, 24)}…` : text);

/** В строке существительное показывается с артиклем, остальное словарной формой. */
const headOf = (word: WordListRow): string =>
  word.pos === 'noun' && word.singular ? word.singular : word.head;

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
  // INFO: своя категория, а не членство в двух. В строке слово подписано
  // «прил. · нареч.», и отбор с тем же именем даёт ровно его. Иначе
  // отборы пересекаются, счётчики перестают складываться в размер
  // колоды, а «прилагательные» показывают не то, что в строке написано.
  { value: 'adj_adverb', label: 'прилагательные и наречия', short: 'прил. · нареч.' },
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
 *
 * «Сбросить прогресс» стоит отдельной строкой, а не третьим в ряду:
 * она появляется и исчезает вместе с прогрессом, и в общем ряду её
 * появление сдвигало бы обе отметки.
 */
const WordActions = ({ row }: { row: WordListRow }) => {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const toggleMark = useToggleMark();
  const resetProgress = useResetProgress();
  const declared = row.status === 'declared';
  const busy = toggleMark.isPending || resetProgress.isPending;
  const savingRequested = toggleMark.isPending && toggleMark.variables?.mark === 'requested';
  const savingKnown = toggleMark.isPending && toggleMark.variables?.mark === 'known';

  if (!user) return null;

  const action = (mark: 'requested' | 'known', active: boolean) => () =>
    toggleMark.mutate({ userId: user.id, wordId: row.id, mark, active });

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || declared}
          onClick={action('requested', row.requested)}
          aria-pressed={row.requested}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium',
            row.requested && 'border-ink bg-ink text-bg',
            busyClasses(savingRequested),
          )}
        >
          <Busy busy={savingRequested} label="Сохраняем отметку">
            <StableLabel
              shown={row.requested ? 'Убрать из очереди' : 'Учить сегодня'}
              other={row.requested ? 'Учить сегодня' : 'Убрать из очереди'}
            />
          </Busy>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={action('known', declared)}
          aria-pressed={declared}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium',
            declared && 'border-ink bg-ink text-bg',
            busyClasses(savingKnown),
          )}
        >
          <Busy busy={savingKnown} label="Сохраняем отметку">
            <StableLabel
              shown={declared ? 'Вернуть в колоду' : 'Знаю'}
              other={declared ? 'Знаю' : 'Вернуть в колоду'}
            />
          </Busy>
        </button>
        {/* INFO: правка рядом с отметками, а не отдельным экраном из меню:
            опечатку замечают, глядя на карточку, и уходить за ней в другое
            место человек не станет. Только админу — правит базу. */}
        {isAdmin ? (
          <Link
            to={`/words/${encodeURIComponent(row.id)}/edit`}
            className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium"
          >
            Править
          </Link>
        ) : null}
      </div>
      {row.has_progress ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => resetProgress.mutate({ userId: user.id, wordId: row.id })}
          className={cn(
            'mt-1.5 flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-bad',
            busyClasses(resetProgress.isPending),
          )}
        >
          <Busy busy={resetProgress.isPending} label="Сбрасываем прогресс">
            Сбросить прогресс
          </Busy>
        </button>
      ) : null}
      {toggleMark.isError || resetProgress.isError ? (
        <p className="mt-1.5 text-[12px] text-bad">Не удалось сохранить, попробуйте ещё раз.</p>
      ) : null}
    </div>
  );
};

/**
 * Строка списка вместе с оборотом карточки.
 *
 * Пока карточка едет, строка не раскрывается: вместо неё крутится точка
 * на месте ранга. Заглушка в раскрытом блоке выглядела хуже — список
 * подпрыгивал сначала под её высоту, потом под настоящую карточку.
 */
const WordRow = ({
  row,
  isOpen,
  onToggle,
}: {
  row: WordListRow;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const status = row.status as ListStatus;
  const { data: word, isLoading, isError } = useWord(isOpen ? row.id : null);

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-busy={isLoading}
        onClick={onToggle}
        className={cn(
          'grid w-full touch-manipulation grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-left',
          isOpen && 'bg-surface-2',
        )}
      >
        <span className="flex justify-end text-right font-mono text-[11px] tabular-nums text-faint">
          {isLoading ? (
            <span
              aria-label="Загружаем карточку"
              className="h-3 w-3 animate-spin rounded-full border border-line border-t-muted"
            />
          ) : (
            (row.rank ?? '·')
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-px">
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                'truncate font-serif text-[17.5px] font-semibold leading-tight',
                row.genus ? GENUS_TEXT[row.genus] : undefined,
              )}
            >
              {headOf(row)}
            </span>
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              {posLabel(row)}
            </span>
          </span>
          <span className="truncate text-[12.5px] leading-snug text-muted">{row.translation}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {/* INFO: черновик виден до раскрытия строки. Иначе сверять
              нечего: пришлось бы открывать каждую карточку подряд. */}
          {row.draft ? (
            <span
              title="Черновик: разбор не сверен человеком"
              className="whitespace-nowrap rounded-full border border-dashed border-gold px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-preposition"
            >
              черновик
            </span>
          ) : null}
          {row.requested ? (
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

      {isOpen && isError ? (
        <div className="border-b border-line-soft bg-surface-2 px-3.5 py-3">
          <p className="text-center text-[13px] text-bad">Не удалось загрузить карточку</p>
        </div>
      ) : null}

      {isOpen && word ? (
        <div className="border-b border-line-soft bg-surface-2 px-3.5 pb-4 pt-1.5">
          <WordAnswer word={word} />
          <WordActions row={row} />
        </div>
      ) : null}
    </div>
  );
};

export const WordsPage = () => {
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  const filter = useMemo(() => readFilter(params), [params]);
  const { data: facets } = useWordsFacets();
  const { data: isAdmin } = useIsAdmin();

  // INFO: условия отбора живут в адресе, а не в состоянии компонента:
  // так список переживает перезагрузку и его можно передать ссылкой.
  // Прокрутка в адрес не пишется — смена условий начинает ленту заново.
  const update = (patch: Partial<WordsFilter>) => {
    setParams(writeFilter({ ...filter, ...patch }), { replace: true });
    // INFO: лента бесконечная, и после смены условий она начинается
    // заново. Если не вернуть страницу наверх, человек останется
    // смотреть в пустоту там, где раньше была трёхсотая строка.
    window.scrollTo({ top: 0 });
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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWordsInfinite({
    pos: filter.pos,
    genus: filter.genus,
    status: filter.status,
    query: filter.query,
    draft: filter.draft,
    ranked: filter.ranked,
    own: filter.own,
  });

  const total = pageData?.pages[0]?.total ?? 0;
  const pageRows = useMemo(
    () => (pageData?.pages ?? []).flatMap((chunk) => chunk.rows),
    [pageData],
  );

  // INFO: подгрузка по появлению метки в поле зрения. Метка стоит под
  // последней строкой, и браузер сам сообщает, что до неё долистали, —
  // это дешевле, чем пересчитывать прокрутку на каждый кадр.
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => undefined);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNextPage) return undefined;
    // INFO: просим следующую порцию за экран до конца, чтобы лента не замирала.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, loadMore, pageRows.length]);
  // INFO: счётчики фильтра живут отдельной выборкой с бесконечным кэшем,
  // и одна неудача оставляла бы их пустыми на всю сессию. Судить по ним
  // о размере колоды поэтому нельзя: список объявил бы её пустой.
  const facetTotal = facets?.total ?? 0;
  const deckIsEmpty = !pageFailed && !isLoading && total === 0 && isFilterEmpty(filter);

  const posMenu = useCloseDetails();

  // INFO: артикль подразумевает существительное, поэтому в подписи он
  // приписывается к нему через двоеточие, а не идёт отдельным пунктом.
  const genusLabels = filter.genus.map(
    (value) => GENUS_OPTIONS.find((option) => option.value === value)?.label ?? value,
  );
  const chosenLabels = filter.pos.map((value) => {
    const short = POS_OPTIONS.find((option) => option.value === value)?.short ?? value;
    if (value === 'noun' && genusLabels.length) return `${short}: ${genusLabels.join(', ')}`;
    return short;
  });
  const selectSummary =
    chosenLabels.length === 0
      ? 'все слова'
      : chosenLabels.length <= 2
        ? chosenLabels.join(', ')
        : `выбрано ${chosenLabels.length}`;

  return (
    <div>
      <div className="flex items-center gap-1.5 pt-3">
        <details ref={posMenu} className="relative min-w-0 flex-1">
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
                          className={cn(
                            'min-w-0 flex-1 truncate font-serif',
                            GENUS_TEXT[genus.value],
                          )}
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
        {/* INFO: отбор по сверке стоит отдельно от состояний знания:
            черновик бывает и новым, и уже выученным, поэтому в один ряд
            с «новые / учу / знаю» он не встаёт. Показывается, только
            когда черновики вообще есть. */}
        {facets?.drafts ? (
          <Chip
            active={filter.draft === true}
            onClick={() => update({ draft: filter.draft === true ? null : true })}
          >
            черновики {facets.drafts}
          </Chip>
        ) : null}
        {/* INFO: слова вне частотного списка. Ранга у них нет не по
            недосмотру — их нет в списке 4500, — и это другой по природе
            набор: составные существительные, женские формы профессий,
            обороты с sein. Брать их отдельно осмысленно. */}
        {facets?.rankless ? (
          <Chip
            active={filter.ranked === false}
            onClick={() => update({ ranked: filter.ranked === false ? null : false })}
          >
            вне списка {facets.rankless}
          </Chip>
        ) : null}
        {/* INFO: заведённые руками. Ранга у них нет, значит они лежат
            в хвосте списка вперемешку с прочими безранговыми, а моложе
            и слабее они всех — искать их отдельно нужно чаще, чем что
            бы то ни было. Фишка появляется, только когда свои есть. */}
        {facets?.own ? (
          <Chip
            active={filter.own === true}
            onClick={() => update({ own: filter.own === true ? null : true })}
          >
            заведено руками {facets.own}
          </Chip>
        ) : null}
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
        {/* INFO: счётчик в шапке считает не словарь, а то, что попадает
            в «Учить», и при черновиках он меньше. Разница ничем
            не объяснялась: вверху 1462, здесь 2585. Теперь из строки
            видно, из чего она складывается. */}
        {total === facetTotal && facets?.drafts ? ` · черновиков ${facets.drafts}` : ''}
        {pageRows.length > 0 && pageRows.length < total ? ` · показано ${pageRows.length}` : ''}
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
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted">
            <p>
              {pageFailed
                ? 'Список не загрузился'
                : deckIsEmpty
                  ? 'В колоде пока нет слов'
                  : 'Ничего не найдено'}
            </p>
            {/* INFO: искали слово и не нашли — самый естественный момент
                предложить завести его на будущее.

                Колонкой, а не в строку: ссылка была inline-block и вставала
                вплотную к тексту, без отбивки и без переноса. Длинный
                запрос в подписи обрезается — иначе кнопка вылезает
                за карточку. */}
            {/* INFO: два выхода из пустого поиска, и они разные.
                В бэклог — «запомнить на потом», карточку заводят позже.
                Своя карточка — «заведу сейчас»: человек уже искал слово,
                и это тот самый момент, когда оно ему нужно. */}
            {!isLoading && !pageFailed && !deckIsEmpty && filter.query.trim() ? (
              <div className="flex max-w-full flex-col gap-2">
                {/* INFO: завести карточку может только админ — отказ даёт
                    функция базы. Дать заполнить всю форму и отказать
                    на последнем нажатии значит обмануть, поэтому кнопки
                    у остальных нет вовсе. В бэклоге она админу и
                    показывалась, а здесь нет: расхождение поймано
                    перед заливкой в прод. Бэклог при этом для всех. */}
                {isAdmin ? (
                  <Link
                    to={`/words/new?word=${encodeURIComponent(filter.query.trim())}`}
                    className="max-w-full rounded-lg border border-ink bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg"
                  >
                    Завести карточку «{shorten(filter.query.trim())}»
                  </Link>
                ) : null}
                <Link
                  to={`/backlog?word=${encodeURIComponent(filter.query.trim())}`}
                  className={cn(
                    'max-w-full rounded-lg px-3.5 py-2 text-[13px]',
                    isAdmin
                      ? 'border border-line font-medium text-ink'
                      : 'border border-ink bg-ink font-semibold text-bg',
                  )}
                >
                  {isAdmin ? 'Или в бэклог, на потом' : 'В бэклог, на потом'}
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          pageRows.map((word) => (
            <WordRow
              key={word.id}
              row={word}
              isOpen={openId === word.id}
              onToggle={() => setOpenId(openId === word.id ? null : word.id)}
            />
          ))
        )}
      </div>

      {/* INFO: метка для наблюдателя стоит после списка. Кнопка рядом
          не дубль: наблюдатель бесполезен тому, кто ходит клавиатурой,
          а не прокруткой, и молчит, если браузер его не поддержал. */}
      {hasNextPage ? (
        <div ref={sentinel} className="flex justify-center py-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={isFetchingNextPage}
            className="rounded-lg border border-line px-4 py-2 text-[13px] text-muted disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
          </button>
        </div>
      ) : null}

      {!hasNextPage && pageRows.length > WORDS_BATCH ? (
        <p className="py-4 text-center font-mono text-[11px] text-faint">это все {total} слов</p>
      ) : null}
    </div>
  );
};
