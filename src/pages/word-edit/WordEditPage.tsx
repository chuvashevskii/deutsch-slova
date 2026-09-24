import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  draftFromWord,
  editFindings,
  editPatch,
  isOwnCard,
  kindOfWord,
  posLabel,
  useDeleteWord,
  useTranslationNeighbours,
  useUpdateWord,
  useWord,
  type WordDraft,
} from '@/entities/word';
import { REGISTERS } from '@/shared/lib/deckRules';
import { cn } from '@/shared/lib/cn';
import { Busy, busyClasses, CardSkeleton, LoadError } from '@/shared/ui';

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <section className="mt-3 rounded-xl border border-line bg-surface px-4 py-3.5">
    <h2 className="text-[14.5px] font-semibold">{title}</h2>
    {hint ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{hint}</p> : null}
    <div className="mt-3 flex flex-col gap-3">{children}</div>
  </section>
);

const Field = ({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) => (
  <label className="flex flex-col gap-1">
    <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14.5px]',
        mono && 'font-serif',
      )}
    />
  </label>
);

/**
 * Правка карточки.
 *
 * Правятся четыре поля — перевод, помета, подсказка, примеры, — и это
 * не урезание ради простоты: род, формы, управление и ранг приезжают
 * из Anki или выводятся правилом, и менять их здесь значит разойтись
 * с источником молча.
 *
 * Проверки те же, что при заведении, но показываются только те, что
 * этот экран в силах снять. Карточка из Anki может нарушать что-то
 * в формах, и запирать из-за этого правку опечатки в переводе значило бы
 * оставить человека наедине с чужой ошибкой.
 *
 * Каждое изменение уходит строкой в журнал правок и откатывается
 * кнопкой на «Правках» — так же, как партии разбора.
 */
export const WordEditPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: word, isLoading, isError, refetch } = useWord(id);
  const update = useUpdateWord(id);
  const remove = useDeleteWord();

  const [draft, setDraft] = useState<WordDraft | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const current = draft ?? (word ? draftFromWord(word) : null);
  const kind = word ? kindOfWord(word) : null;
  const { data: neighbours } = useTranslationNeighbours(
    current?.translation ?? '',
    kind?.label ?? '',
    id,
  );
  const findings = useMemo(
    () => (current ? editFindings(current, neighbours ?? []) : []),
    [current, neighbours],
  );
  const blocks = findings.filter((f) => f.level === 'блок');
  const notes = findings.filter((f) => f.level === 'замечание');
  const patch = word && current ? editPatch(word, current) : {};
  const changed = Object.keys(patch).length;

  if (isLoading) return <CardSkeleton />;
  if (isError || !word || !current) {
    return <LoadError what="Карточку не удалось загрузить" onRetry={() => void refetch()} />;
  }

  const set = <K extends keyof WordDraft>(key: K, value: WordDraft[K]) =>
    setDraft({ ...current, [key]: value });

  const setExample = (lang: 'examplesDe' | 'examplesRu', index: 0 | 1, value: string) => {
    const next: [string, string] = [...current[lang]] as [string, string];
    next[index] = value;
    setDraft({ ...current, [lang]: next });
  };

  return (
    <div className="py-4 pb-24">
      <header className="rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="flex items-baseline gap-2">
          <h1 className="font-serif text-[20px] font-semibold">{word.head}</h1>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            {posLabel(word)} · {word.id}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Правятся перевод, помета, подсказка и примеры. Род, формы и управление приезжают из Anki
          — их здесь не меняют. Каждое изменение попадёт в{' '}
          <Link to="/review" className="underline underline-offset-2">
            журнал правок
          </Link>{' '}
          и откатывается.
        </p>
      </header>

      <Section title="Перевод">
        <Field label="Перевод" value={current.translation} onChange={(v) => set('translation', v)} />
      </Section>

      <Section
        title="Помета и подсказка"
        hint="Помета ставится всегда, даже нейтральная. Подсказка — два-пять слов строчными, она объясняет значение, а не повторяет ответ."
      >
        <div className="flex flex-wrap gap-1.5">
          {REGISTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('register', r)}
              aria-pressed={current.register === r}
              className={cn(
                'rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium',
                current.register === r && 'border-ink bg-ink text-bg',
              )}
            >
              {r.split(' · ')[1]}
            </button>
          ))}
        </div>
        <Field
          label="Подсказка (необязательно)"
          value={current.definition}
          onChange={(v) => set('definition', v)}
        />
      </Section>

      <Section title="Примеры" hint="Два предложения с переводом.">
        {([0, 1] as const).map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-line-soft px-3 py-2.5">
            <Field
              label={`Пример ${i + 1}`}
              value={current.examplesDe[i]}
              onChange={(v) => setExample('examplesDe', i, v)}
              mono
            />
            <Field
              label="Перевод"
              value={current.examplesRu[i]}
              onChange={(v) => setExample('examplesRu', i, v)}
            />
          </div>
        ))}
      </Section>

      {blocks.length ? (
        <section className="mt-3 rounded-xl border border-bad/40 bg-surface px-4 py-3.5">
          <h2 className="text-[14.5px] font-semibold text-bad">Мешает сохранить: {blocks.length}</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {blocks.map((f) => (
              <li key={f.text} className="text-[13px] leading-relaxed text-bad">
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes.length ? (
        <section className="mt-3 rounded-xl border border-line bg-surface px-4 py-3.5">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            не мешает сохранить, но стоит взглянуть
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {notes.map((f) => (
              <li key={f.text} className="text-[13px] leading-relaxed text-muted">
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* INFO: число, а не слово «сохранено». Правка — запись в журнал,
          и человеку важно знать, сколько строк туда легло: ноль значит,
          что он ничего не изменил, и молчаливая галочка тут соврала бы. */}
      {saved !== null ? (
        <p className="mt-3 rounded-lg border border-ok/40 px-3 py-2 text-[13px] text-ok">
          {saved === 0
            ? 'Ничего не изменилось — в журнал ничего не записано'
            : `Сохранено. Полей изменено: ${saved}`}
        </p>
      ) : null}

      {update.isError ? (
        <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {update.error instanceof Error ? update.error.message : 'Не удалось сохранить'}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={Boolean(blocks.length) || !changed || update.isPending}
          onClick={() => {
            update.mutate(patch, {
              onSuccess: (rows) => {
                setSaved(rows);
                setDraft(null);
              },
            });
          }}
          className={cn(
            'flex flex-1 items-center justify-center rounded-lg border border-ink bg-ink px-4 py-2.5 text-[14px] font-semibold text-bg',
            busyClasses(update.isPending),
          )}
        >
          <Busy busy={update.isPending} label="Сохраняем">
            {changed ? `Сохранить (${changed})` : 'Изменений нет'}
          </Busy>
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-line px-4 py-2.5 text-[14px] font-medium"
        >
          Назад
        </button>
      </div>

      {/* INFO: удаление только для заведённых руками. Карточку из Anki
          удалить нельзя вовсе — источник о том не знает, и следующий
          импорт привезёт её обратно. Кнопки поэтому просто нет. */}
      {isOwnCard(word.id) ? (
        <section className="mt-6 rounded-xl border border-bad/30 bg-surface px-4 py-3.5">
          <h2 className="text-[14.5px] font-semibold">Удалить карточку</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Карточка заведена руками, и её можно убрать совсем — вместе с историей правок. Если по
            ней уже идёт обучение, база откажет: удаление стёрло бы прогресс.
          </p>
          {remove.isError ? (
            <p className="mt-2.5 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
              {remove.error instanceof Error ? remove.error.message : 'Не удалось удалить'}
            </p>
          ) : null}
          {confirming ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(word.id, { onSuccess: () => navigate('/words?own=1') });
                }}
                className={cn(
                  'flex items-center justify-center rounded-lg border border-bad bg-bad px-4 py-2 text-[13.5px] font-semibold text-bg',
                  busyClasses(remove.isPending),
                )}
              >
                <Busy busy={remove.isPending} label="Удаляем">
                  Да, удалить «{word.head}»
                </Busy>
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-line px-4 py-2 text-[13.5px] font-medium"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-lg border border-bad px-4 py-2 text-[13.5px] font-semibold text-bad"
            >
              Удалить
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
};
