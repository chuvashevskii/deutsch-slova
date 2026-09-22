import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLearnQueue, useProgressSummary, useStatsSummary } from '@/entities/word';
import { cn } from '@/shared/lib/cn';
import { useNow } from '@/shared/lib/useNow';
import { LoadError, Skeleton } from '@/shared/ui';

import { buildHeatmap, dayKey, plural } from './statsFormat';

const FORECAST_DAYS = 14;
const HEATMAP_WEEKS = 16;
const GENUS_ORDER = ['m', 'f', 'n'] as const;
const GENUS_ARTICLE: Record<string, string> = { m: 'der', f: 'die', n: 'das' };

const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const shortDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const monthOnly = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

const POS_SHORT: Record<string, string> = {
  noun: 'существительные',
  verb: 'глаголы',
  adj: 'прилагательные',
  adverb: 'наречия',
  pronoun: 'местоимения',
  preposition: 'предлоги',
  conjunction: 'союзы',
  numeral: 'числительные',
  particle: 'частицы',
};

const Tile = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-xl border border-line bg-surface p-3.5">
    <div className="font-mono text-[27px] font-medium leading-none tracking-tight tabular-nums">
      {value}
    </div>
    <div className="mt-1.5 text-xs leading-snug text-muted">{label}</div>
  </div>
);

const Section = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className="mt-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    {note ? <p className="mb-3 mt-0.5 text-[12.5px] text-muted">{note}</p> : <div className="mb-3" />}
    {children}
  </section>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border border-dashed border-line px-3.5 py-4 text-center text-[12.5px] leading-snug text-faint">
    {children}
  </p>
);

export const StatsPage = () => {
  // INFO: выбранный день общий для прогноза и тепловой карты — нажатие
  // в одном месте не должно оставлять подпись в другом.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const { data: stats, isLoading: statsLoading, isError: statsFailed, refetch } = useStatsSummary();
  const { data: progress, isError: progressFailed } = useProgressSummary();
  // INFO: длину очереди спрашиваем у самой очереди, с нулевым лимитом:
  // повторять её правила вторым запросом значит завести два числа,
  // которые однажды разойдутся.
  const { data: queue } = useLearnQueue(true, 0);
  const now = useNow();

  const reviewedToday = stats?.reviewedToday ?? 0;
  const inQueue = queue?.total ?? 0;
  const requested = progress?.requested ?? 0;
  const accuracy = stats?.accuracy ?? null;
  const checkedReviews = stats?.checkedReviews ?? 0;
  const checkedPos = stats?.checkedPos ?? [];
  const composition = {
    new: progress?.new ?? 0,
    learning: progress?.learning ?? 0,
    known: progress?.known ?? 0,
    declared: progress?.declared ?? 0,
  };
  const deckSize = progress?.total ?? 0;
  const forecast = stats?.forecast ?? new Array<number>(FORECAST_DAYS).fill(0);

  // INFO: сетку строит клиент: начало недели и часовой пояс — его забота,
  // база отдаёт только «день → сколько повторений».
  const heatmap = useMemo(() => {
    const grid = buildHeatmap(stats?.perDay ?? {}, new Date(now), HEATMAP_WEEKS);

    // INFO: подпись месяца ставится над той неделей, где месяц начался,
    // и только если для неё есть место: иначе «сен» и «окт» наложатся.
    const months: string[] = [];
    let previous = '';
    for (let week = 0; week < grid.weeks; week += 1) {
      const first = grid.cells[week * 7];
      const label = first ? monthOnly.format(new Date(`${first.key}T00:00:00`)) : '';
      months.push(label && label !== previous ? label : '');
      if (label) previous = label;
    }

    return { ...grid, months };
  }, [stats, now]);

  const pickedHeatmap = useMemo(() => {
    if (!pickedDay) return null;
    const cell = heatmap.cells.find((item) => item.key === pickedDay);
    return cell ? { date: new Date(`${cell.key}T00:00:00`), count: cell.count } : null;
  }, [pickedDay, heatmap]);

  const genusMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {
      m: { m: 0, f: 0, n: 0 },
      f: { m: 0, f: 0, n: 0 },
      n: { m: 0, f: 0, n: 0 },
    };
    let total = 0;
    (stats?.genusMatrix ?? []).forEach((cell) => {
      if (!matrix[cell.expected] || matrix[cell.expected][cell.answered] === undefined) return;
      matrix[cell.expected][cell.answered] += cell.n;
      total += cell.n;
    });
    return { matrix, total };
  }, [stats]);

  const ruleErrors: Array<[string, { total: number; wrong: number }]> = (
    stats?.ruleErrors ?? []
  ).map((row) => [row.label, { total: row.total, wrong: row.wrong }]);

  const nounsWithGenus = progress?.nounsWithGenus ?? 0;
  const totalWords = Math.max(1, progress?.total ?? 0);
  const forecastMax = Math.max(1, ...forecast);
  const forecastDays = forecast.map((count, offset) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return { key: dayKey(date), date, count };
  });
  const pickedForecast = forecastDays.find((day) => day.key === pickedDay) ?? null;
  const forecastTotal = forecast.reduce((sum, value) => sum + value, 0);

  // INFO: нули вместо статистики читаются как «вы ничего не делали».
  // Пока данные не пришли или запрос упал, честнее сказать об этом.
  if (statsFailed || progressFailed) {
    return (
      <LoadError
        what="статистику"
        onRetry={() => {
          refetch().catch(() => undefined);
        }}
      />
    );
  }

  if (statsLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 py-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[86px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="grid grid-cols-2 gap-2 py-3">
        <Tile value={String(reviewedToday)} label="ответов сегодня" />
        <Tile value={String(inQueue)} label="в очереди сейчас" />
        <Tile value={`${composition.known} / ${deckSize}`} label="выучено слов" />
        <Tile value={accuracy === null ? '—' : `${accuracy}%`} label="ответов без ошибок" />
      </div>

      {requested > 0 ? (
        <p className="mt-1 px-1 text-[12px] leading-snug text-faint">
          Из них {requested} — слова, которые вы сами попросили показать сегодня.
        </p>
      ) : null}

      {accuracy === null ? (
        <p className="mt-1 rounded-lg border border-dashed border-line px-3.5 py-2.5 text-[12.5px] leading-snug text-faint">
          «Ответов без ошибок» пусто: правильность определяет только проверка напечатанного,
          а ввод форм сейчас выключен. Включается в <Link to="/settings" className="underline">настройках</Link>.
        </p>
      ) : (
        <p className="mt-1 px-1 text-[12px] leading-snug text-faint">
          Точность посчитана по {checkedReviews}{' '}
          {checkedReviews % 10 === 1 && checkedReviews % 100 !== 11 ? 'ответу' : 'ответам'}, где формы
          вводились с клавиатуры{checkedPos.length ? `: ${checkedPos.map((pos) => POS_SHORT[pos] ?? pos).join(', ')}` : ''}.
          Остальные в неё не идут.
        </p>
      )}

      <Section
        title="Состав колоды"
        note="«Знаю» — интервал от 21 дня, «учу» — меньше; это считает планировщик. «Знаю сам» — отметка рукой, она стоит отдельно: объявленное и заслуженное в одну долю не складываются."
      >
        <div className="flex h-2.5 overflow-hidden rounded-full bg-line-soft">
          <span className="bg-neuter" style={{ width: `${(100 * composition.known) / totalWords}%` }} />
          <span className="bg-gold" style={{ width: `${(100 * composition.learning) / totalWords}%` }} />
          <span className="bg-line" style={{ width: `${(100 * composition.declared) / totalWords}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-neuter" />
            знаю {composition.known}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-gold" />
            учу {composition.learning}
          </span>
          {composition.declared > 0 ? (
            <span className="flex items-center gap-1.5" title="Вы отметили эти слова сами — планировщик их не проверял">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-line" />
              знаю сам {composition.declared}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-line-soft" />
            новые {composition.new}
          </span>
        </div>
      </Section>

      <Section
        title="Что придёт в ближайшие две недели"
        note={
          forecastTotal
            ? `${shortDay.format(forecastDays[0].date)} — ${shortDay.format(forecastDays[forecastDays.length - 1].date)}, всего ${forecastTotal} ${plural(forecastTotal, 'карточка', 'карточки', 'карточек')}.`
            : undefined
        }
      >
        {forecastTotal === 0 ? (
          <Empty>Пока нечего планировать — ни одна карточка ещё не отвечена.</Empty>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-3.5">
            {/* INFO: у каждого дня есть своя дорожка во всю высоту. Без неё
                пустые дни были невидимы, и график из одного столбика читался
                как обрезанный, а не как спокойная неделя. */}
            <div className="flex h-28 items-stretch gap-1">
              {forecastDays.map(({ key, date, count }, index) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`${dayMonth.format(date)}: ${count} ${plural(count, 'карточка', 'карточки', 'карточек')}`}
                  aria-pressed={pickedDay === key}
                  onClick={() => setPickedDay(pickedDay === key ? null : key)}
                  className="flex flex-1 flex-col gap-1"
                >
                  <span className="h-[11px] shrink-0 text-center font-mono text-[9px] leading-[11px] tabular-nums text-muted">
                    {count || ''}
                  </span>
                  <span className="relative min-w-0 flex-1 overflow-hidden rounded-[3px] bg-line-soft">
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-0 rounded-[3px]',
                        index === 0 ? 'bg-ink' : 'bg-ink/30',
                        pickedDay === key && 'bg-neuter',
                      )}
                      style={{ height: count ? `${Math.max(4, (100 * count) / forecastMax)}%` : 0 }}
                    />
                  </span>
                </button>
              ))}
            </div>
            {/* INFO: раньше подписей было три — «сегодня», «+7», «+13».
                Смещение вместо даты читается как загадка; теперь под каждым
                столбиком стоит число месяца. */}
            <div className="mt-1.5 flex gap-1">
              {forecastDays.map(({ key, date }, index) => (
                <span
                  key={key}
                  className={cn(
                    'flex-1 text-center font-mono text-[9px] tabular-nums',
                    index === 0 ? 'font-semibold text-ink' : 'text-faint',
                  )}
                >
                  {date.getDate()}
                </span>
              ))}
            </div>
            <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[12.5px] leading-snug text-muted">
              {pickedForecast
                ? `${dayMonth.format(pickedForecast.date)} — ${pickedForecast.count} ${plural(pickedForecast.count, 'карточка', 'карточки', 'карточек')}`
                : 'Первый столбик — сегодня. Нажмите на любой, чтобы увидеть дату и число карточек.'}
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Активность за четыре месяца"
        note={
          stats?.totalReviews
            ? `Квадрат — день, насыщенность — число ответов. Дней с ответами: ${stats.activeDays ?? 0}; ответов всего: ${stats.totalReviews}.`
            : 'Квадрат — день. Заполнится, как только начнёте отвечать.'
        }
      >
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <div className="flex gap-1.5">
            <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-[14px]">
              {['пн', '', 'ср', '', 'пт', '', 'вс'].map((label, index) => (
                <span key={index} className="flex items-center font-mono text-[8px] text-faint">
                  {label}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              {/* INFO: подписи месяцев — единственное, по чему в такой сетке
                  можно понять, куда смотришь. Без них столбцы безымянные. */}
              <div
                className="grid gap-[3px] pb-[3px] font-mono text-[8px] text-faint"
                style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, minmax(0, 1fr))` }}
              >
                {heatmap.months.map((label, index) => (
                  <span key={index} className="truncate">
                    {label}
                  </span>
                ))}
              </div>
              <div
                className="grid grid-flow-col grid-rows-7 gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, minmax(0, 1fr))` }}
              >
                {heatmap.cells.map((cell) => {
                  // INFO: дни после сегодняшнего занимают место, но не рисуются.
                  // Иначе последняя неделя обрывается и сетка выглядит обрезанной.
                  if (cell.future) return <span key={cell.key} className="aspect-square w-full" />;

                  const date = new Date(`${cell.key}T00:00:00`);
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      aria-label={`${dayMonth.format(date)}: ${cell.count} ${plural(cell.count, 'ответ', 'ответа', 'ответов')}`}
                      aria-pressed={pickedDay === cell.key}
                      onClick={() => setPickedDay(pickedDay === cell.key ? null : cell.key)}
                      className={cn(
                        'aspect-square w-full rounded-sm bg-line-soft',
                        cell.key === heatmap.todayKey && 'ring-1 ring-ink',
                        pickedDay === cell.key && 'ring-1 ring-feminine',
                      )}
                      style={
                        cell.count
                          ? {
                              backgroundColor: 'hsl(var(--neuter))',
                              opacity: 0.25 + 0.75 * Math.min(1, cell.count / heatmap.max),
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* INFO: без легенды насыщенность — просто разные оттенки серо-зелёного,
              и непонятно, в какую сторону она растёт. */}
          <div className="mt-2.5 flex items-center justify-end gap-1 font-mono text-[9px] text-faint">
            <span>реже</span>
            {[0.25, 0.5, 0.75, 1].map((opacity) => (
              <span
                key={opacity}
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: 'hsl(var(--neuter))', opacity }}
              />
            ))}
            <span>чаще</span>
          </div>
          <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[12.5px] leading-snug text-muted">
            {pickedHeatmap
              ? `${dayMonth.format(pickedHeatmap.date)} — ${pickedHeatmap.count} ${plural(pickedHeatmap.count, 'ответ', 'ответа', 'ответов')}`
              : 'Обведённый квадрат — сегодня. Нажмите на любой, чтобы увидеть день и число ответов.'}
          </p>
        </div>
      </Section>

      <Section
        title="Путаница в роде"
        note={
          genusMatrix.total
            ? 'Строка — правильный род, столбец — что вы нажали. Диагональ — попадания.'
            : undefined
        }
      >
        {genusMatrix.total === 0 ? (
          <Empty>
            {nounsWithGenus
              ? `Появится, когда ответите на несколько существительных — их в колоде ${nounsWithGenus}.`
              : 'Появится, когда в колоде будут существительные и вы ответите на несколько.'}
          </Empty>
        ) : (
          <table className="w-full border-collapse font-mono text-xs tabular-nums">
            <thead>
              <tr>
                <th className="border border-line-soft p-1.5" />
                {GENUS_ORDER.map((genus) => (
                  <th key={genus} className="border border-line-soft p-1.5 text-[10.5px] font-normal">
                    {GENUS_ARTICLE[genus]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GENUS_ORDER.map((row) => (
                <tr key={row}>
                  <th className="border border-line-soft p-1.5 text-[10.5px] font-normal text-faint">
                    {GENUS_ARTICLE[row]}
                  </th>
                  {GENUS_ORDER.map((column) => {
                    const value = genusMatrix.matrix[row][column];
                    return (
                      <td
                        key={column}
                        className={cn(
                          'border border-line-soft p-1.5 text-center',
                          row === column && 'bg-ok/10 font-medium text-ok',
                          row !== column && value > 0 && 'bg-bad/10 font-medium text-bad',
                        )}
                      >
                        {value || '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Где спотыкаетесь"
        note={ruleErrors.length ? 'Доля ответов с ошибкой по правилу образования формы.' : undefined}
      >
        {ruleErrors.length === 0 ? (
          <Empty>
            {checkedReviews === 0
              ? 'Считается только по ответам, где формы вводятся с клавиатуры. Включите ввод в настройках.'
              : 'Нужно хотя бы по два ответа на правило — потом здесь будет видно, какие модели формы даются хуже.'}
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {ruleErrors.map(([label, entry]) => {
              const percent = Math.round((100 * entry.wrong) / entry.total);
              return (
                <div key={label} className="grid grid-cols-[1fr_54px_40px] items-center gap-2.5 text-[13px]">
                  <span className="truncate" title={label}>
                    {label}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <i className="block h-full bg-bad" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="text-right font-mono text-[11.5px] tabular-nums text-muted">
                    {percent}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
};
