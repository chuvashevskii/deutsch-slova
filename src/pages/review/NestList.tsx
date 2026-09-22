import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useNests, type Nest, type NestCard, type NestKind } from '@/entities/word';
import { editTable, type EditTable } from '@/entities/word-edit';
import { cn } from '@/shared/lib/cn';
import { LoadError, WordRowsSkeleton } from '@/shared/ui';

const KIND_HINT: Record<NestKind, string> = {
  head: 'Одно немецкое слово, разные значения: не пора ли делить карточку.',
  translation:
    'Один русский перевод у разных слов: разведены ли они пометой или подсказкой.',
};

/**
 * Строка карточки в гнезде — два этажа, а не один.
 *
 * Сперва слово, перевод и плашки стояли одной строкой с переносом.
 * На телефоне это разваливалось: плашка — flex-элемент с `whitespace-nowrap`
 * внутри, по умолчанию она сжимается, а текст из неё вылезает наружу
 * и ложится поверх перевода. «Включать» читалось как «Вклнейтральный».
 *
 * Разделение на этажи убирает саму возможность: перевод занимает свою
 * строку целиком и переносится по словам, плашки живут под ним
 * и не конкурируют с ним за ширину. На широком экране это тоже читается
 * лучше — взгляд идёт по словам, а не по чересполосице.
 */
const Card = ({ card, kind }: { card: NestCard; kind: NestKind }) => {
  const label = card.register?.split('·')[1]?.trim() ?? card.register;
  const definition = card.definition?.trim();
  const undifferentiated = kind === 'translation' && !card.register && !definition;

  return (
    <li className="border-t border-line-soft py-2 first:border-t-0">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <Link
          to={`/words?q=${encodeURIComponent(card.head)}`}
          className="font-serif text-[15px] font-semibold underline decoration-line underline-offset-2"
        >
          {card.head}
        </Link>
        <span className="text-[13px] leading-snug text-muted">{card.translation}</span>
      </p>

      {/* INFO: различитель — то, ради чего гнездо и смотрят. Его отсутствие
          написано словом: пустота и отсутствие колонки выглядят одинаково,
          а значат разное.

          Пустой этаж не рисуется: у гнезда по слову плашек может не быть
          вовсе, и лишний отступ читался бы как потерянная строка. */}
      {label || definition || undifferentiated || card.edited || card.is_draft ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {label ? (
            <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-preposition">
              {label}
            </span>
          ) : null}
          {definition ? (
            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[11px] leading-snug text-ok">
              {definition}
            </span>
          ) : null}
          {/* INFO: в гнезде по слову этой пометки нет и быть не может.
            У `Band` «Лента» и `Band` «Группа» ответ один и тот же — `Band`, —
            различать нечего. Правило однозначности живёт только там, где
            на один русский вопрос отвечают разные немецкие слова. */}
          {undifferentiated ? (
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-bad">
              без различителя
            </span>
          ) : null}
          {card.edited ? (
            <span
              title="Карточку трогал разбор"
              className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-faint"
            >
              правлено
            </span>
          ) : null}
          {card.is_draft ? (
            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              черновик
            </span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
};

const NestBlock = ({ nest, kind }: { nest: Nest; kind: NestKind }) => (
  <li
    className={cn(
      'rounded-xl border bg-surface px-3.5 py-2.5',
      nest.flawed ? 'border-bad/40' : 'border-line',
    )}
  >
    <div className="flex items-baseline gap-2 pb-1">
      <b className="font-serif text-[15px]">{nest.key}</b>
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-faint">
        {nest.label} · {nest.cards.length}
      </span>
    </div>
    <ul>
      {nest.cards.map((card) => (
        <Card key={card.id} card={card} kind={kind} />
      ))}
    </ul>
  </li>
);

interface NestListProps {
  kind: NestKind;
  table: EditTable;
}

/**
 * Гнёзда одной таблицы.
 *
 * Список слов показывает пару через сотню строк друг от друга, и проверить
 * по нему решение нельзя: чтобы понять, верно ли разведены `bekommen`,
 * `erhalten` и `kriegen`, надо видеть все три сразу — с пометами
 * и подсказками.
 */
export const NestList = ({ kind, table }: NestListProps) => {
  const { data, isLoading, isError, refetch } = useNests(kind);
  const [onlyFlawed, setOnlyFlawed] = useState(false);

  const nests = useMemo(() => {
    const mine = (data ?? []).filter((nest) =>
      nest.cards.some((card) => editTable({ pos: card.pos, wortart: card.wortart }) === table),
    );
    return onlyFlawed ? mine.filter((nest) => nest.flawed) : mine;
  }, [data, table, onlyFlawed]);

  if (isLoading) return <WordRowsSkeleton />;
  if (isError) return <LoadError what="гнёзда" onRetry={() => void refetch()} />;

  const flawed = (data ?? []).filter(
    (nest) =>
      nest.flawed &&
      nest.cards.some((card) => editTable({ pos: card.pos, wortart: card.wortart }) === table),
  ).length;

  return (
    <>
      <p className="mt-2 text-[12px] leading-snug text-muted">{KIND_HINT[kind]}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
          {nests.length} гнёзд
        </p>
        {flawed ? (
          <button
            type="button"
            onClick={() => setOnlyFlawed((value) => !value)}
            className={cn(
              'rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider',
              onlyFlawed ? 'bg-bad/10 text-bad' : 'text-faint',
            )}
          >
            с изъяном {flawed}
          </button>
        ) : null}
      </div>

      {nests.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] leading-relaxed text-faint">
          {kind === 'head'
            ? 'В этой таблице нет слов с несколькими значениями.'
            : 'В этой таблице нет переводов, которые делят два слова.'}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {nests.map((nest) => (
            <NestBlock key={`${nest.label}-${nest.key}`} nest={nest} kind={kind} />
          ))}
        </ul>
      )}
    </>
  );
};
