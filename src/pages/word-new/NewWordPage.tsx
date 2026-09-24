import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  checkDraft,
  emptyDraft,
  isReady,
  kindOf,
  REKTION_MODELS,
  SegmentedText,
  suggestPrefix,
  VERB_FORM_FIELDS,
  toPayload,
  useCreateWord,
  useTranslationNeighbours,
  WORD_KINDS,
  type WordDraft,
} from '@/entities/word';
import { REGISTERS } from '@/shared/lib/deckRules';
import { infinitiveSegments } from '@/shared/lib/german';
import { cn } from '@/shared/lib/cn';
import { Busy, busyClasses } from '@/shared/ui';

const GENUS = [
  { value: 'm', title: 'der', klass: 'text-masculine' },
  { value: 'f', title: 'die', klass: 'text-feminine' },
  { value: 'n', title: 'das', klass: 'text-neuter' },
];

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
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) => (
  <label className="flex flex-col gap-1">
    <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">{label}</span>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14.5px]',
        mono && 'font-serif',
      )}
    />
  </label>
);

/**
 * Заведение карточки руками.
 *
 * Не мастер из шагов, а один экран с чек-листом. Человек уже знает
 * слово — его не надо вести за руку, ему надо показать, чего карточке
 * не хватает.
 *
 * Спрашивается только то, что нужно этой части речи: существительному
 * род, глаголу управление, прилагательному степени. Транскрипцию,
 * ударения и озвучку не спрашиваем вовсе — их привозит импорт из Anki,
 * и карточка без них рисуется, черновики так и живут.
 *
 * Проверки те же, что у проверки колоды, и берутся из общего модуля:
 * блокирующие не дают завести карточку, отчётные предупреждают.
 * Это и есть смысл экрана — поймать расхождение до того, как оно
 * попадёт в словарь, а не после заливки.
 */
export const NewWordPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const create = useCreateWord();
  const [draft, setDraft] = useState<WordDraft>(() => emptyDraft(params.get('word') ?? ''));
  const [created, setCreated] = useState<string | null>(null);

  const kind = kindOf(draft.part);
  const { data: neighbours } = useTranslationNeighbours(draft.translation, kind.label);
  const findings = useMemo(() => checkDraft(draft, neighbours ?? []), [draft, neighbours]);
  const ready = isReady(findings);
  const blocks = findings.filter((f) => f.level === 'блок');
  const notes = findings.filter((f) => f.level === 'замечание');

  const set = <K extends keyof WordDraft>(key: K, value: WordDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setExample = (lang: 'examplesDe' | 'examplesRu', index: 0 | 1, value: string) =>
    setDraft((d) => {
      const next: [string, string] = [...d[lang]] as [string, string];
      next[index] = value;
      return { ...d, [lang]: next };
    });

  if (created) {
    return (
      <div className="py-4">
        <section className="rounded-xl border border-ok/40 bg-surface px-4 py-4">
          <h1 className="text-[16px] font-semibold">Карточка заведена</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            «{draft.head}» лежит в словаре под номером {created}. Она черновик: в «Учить» не
            попадёт, пока вы её не согласуете. Ранга у неё нет — она вне частотного списка, —
            и в словаре отбирается кнопкой «заведено руками».
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/words?q=${encodeURIComponent(draft.head)}`}
              className="rounded-lg border border-ink bg-ink px-4 py-2 text-[13.5px] font-semibold text-bg"
            >
              Открыть в словаре
            </Link>
            <Link
              to="/words?own=1"
              className="rounded-lg border border-line px-4 py-2 text-[13.5px] font-medium"
            >
              Все свои
            </Link>
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft());
                setCreated(null);
              }}
              className="rounded-lg border border-line px-4 py-2 text-[13.5px] font-medium"
            >
              Завести ещё
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="py-4 pb-24">
      <header className="rounded-xl border border-line bg-surface px-4 py-3.5">
        <h1 className="text-[16px] font-semibold">Своя карточка</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Спрашивается только нужное этой части речи. Транскрипцию, ударения и озвучку заводить не
          надо — карточка живёт и без них.
        </p>
      </header>

      <Section title="Слово">
        <Field
          label="Немецкое слово"
          value={draft.head}
          onChange={(v) => set('head', v)}
          mono
          placeholder="Zuversicht"
        />
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
            Часть речи
          </span>
          <select
            value={draft.part}
            onChange={(event) => set('part', event.target.value)}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14.5px]"
          >
            {WORD_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.title}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Перевод"
          value={draft.translation}
          onChange={(v) => set('translation', v)}
          placeholder="Уверенность в хорошем"
        />
      </Section>

      <Section
        title="Помета и подсказка"
        hint="Помета ставится всегда, даже нейтральная: так видно, что её не забыли. Подсказка — два-пять слов строчными, она объясняет значение, а не повторяет ответ."
      >
        <div className="flex flex-wrap gap-1.5">
          {REGISTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('register', r)}
              aria-pressed={draft.register === r}
              className={cn(
                'rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium',
                draft.register === r && 'border-ink bg-ink text-bg',
              )}
            >
              {r.split(' · ')[1]}
            </button>
          ))}
        </div>
        <Field
          label="Подсказка (необязательно)"
          value={draft.definition}
          onChange={(v) => set('definition', v)}
          placeholder="вера, что выйдет хорошо"
        />
      </Section>

      {kind.asks.includes('genus') ? (
        <Section title="Существительное">
          <div className="flex gap-1.5">
            {GENUS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => {
                  set('genus', g.value);
                  if (!draft.singular.trim() && draft.head.trim()) {
                    set('singular', `${g.title} ${draft.head.trim()}`);
                  }
                }}
                aria-pressed={draft.genus === g.value}
                className={cn(
                  'flex-1 rounded-lg border border-line py-2 font-serif text-[15px] font-semibold',
                  draft.genus === g.value ? 'border-ink bg-ink text-bg' : g.klass,
                )}
              >
                {g.title}
              </button>
            ))}
          </div>
          <Field
            label="Singular"
            value={draft.singular}
            onChange={(v) => set('singular', v)}
            mono
            placeholder="die Zuversicht"
          />
          <Field
            label="Plural"
            value={draft.plural}
            onChange={(v) => set('plural', v)}
            mono
            placeholder="die Zuversichten"
          />
        </Section>
      ) : null}

      {kind.asks.includes('grade') ? (
        <Section
          title="Степени"
          hint="Оставьте пустыми, если их нет — карточка не станет их спрашивать."
        >
          <Field
            label="Komparativ"
            value={draft.komparativ}
            onChange={(v) => set('komparativ', v)}
            mono
          />
          <Field
            label="Superlativ"
            value={draft.superlativ}
            onChange={(v) => set('superlativ', v)}
            mono
          />
        </Section>
      ) : null}

      {kind.asks.includes('forms') ? (
        <Section
          title="Отделяемая приставка"
          hint="У aufstehen, anrufen, stattfinden приставка отрывается: «er steht auf». Буквами это не видно — umfahren и wiederholen бывают и такими, и обычными, поэтому решаете вы."
        >
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft.separable}
              onChange={(event) => {
                const on = event.target.checked;
                setDraft((d) => ({
                  ...d,
                  separable: on,
                  // Подставляем только при включении и только в пустое:
                  // стереть подставленное человек уже мог намеренно.
                  separablePrefix:
                    on && !d.separablePrefix.trim() ? suggestPrefix(d.head) : d.separablePrefix,
                }));
              }}
              className="h-4 w-4 accent-ink"
            />
            <span className="text-[13.5px]">Глагол с отделяемой приставкой</span>
          </label>
          {draft.separable ? (
            <>
              <Field
                label="Приставка"
                value={draft.separablePrefix}
                onChange={(v) => set('separablePrefix', v)}
                mono
                placeholder="auf"
              />
              {/* Тем же составителем сегментов и тем же рисовальщиком,
                  что и оборот карточки: показывать «как будет» чем-то
                  похожим значит однажды показать не то. */}
              <div className="rounded-lg border border-line-soft px-3 py-2.5">
                <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                  как будет на карточке
                </p>
                <p className="mt-1.5 text-[19px]">
                  <SegmentedText
                    segments={infinitiveSegments(
                      draft.head.trim(),
                      draft.separablePrefix.trim(),
                      null,
                    )}
                    splitPrefix
                  />
                </p>
              </div>
            </>
          ) : null}
        </Section>
      ) : null}

      {kind.asks.includes('forms') ? (
        <Section
          title="Спряжение"
          hint="Необязательно. Пустое лицо значит «такой формы не бывает» — так в колоде живут regnen, schneien и es gibt. Заполнять частично можно."
        >
          {VERB_FORM_FIELDS.map((person) => (
            <Field
              key={person.key}
              label={person.label}
              value={draft[person.key].toString()}
              onChange={(v) => set(person.key, v)}
              mono
            />
          ))}
        </Section>
      ) : null}

      {kind.asks.includes('rektion') ? (
        <Section
          title="Управление"
          hint="Заявленный предлог должен встретиться в примерах — иначе карточка обещает то, чего не показывает."
        >
          <div className="flex flex-wrap gap-1.5">
            {REKTION_MODELS.map((model) => {
              const on = draft.rektion.includes(model);
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() =>
                    set(
                      'rektion',
                      on ? draft.rektion.filter((m) => m !== model) : [...draft.rektion, model],
                    )
                  }
                  aria-pressed={on}
                  className={cn(
                    'rounded-lg border border-line px-2.5 py-1 font-serif text-[12px] italic',
                    on && 'border-ink bg-ink text-bg',
                  )}
                >
                  {model}
                </button>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section
        title="Примеры"
        hint="Два предложения с переводом. Второй должен показывать слово иначе, а не повторять первый другим числом."
      >
        {([0, 1] as const).map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-line-soft px-3 py-2.5"
          >
            <Field
              label={`Пример ${i + 1}`}
              value={draft.examplesDe[i]}
              onChange={(v) => setExample('examplesDe', i, v)}
              mono
            />
            <Field
              label="Перевод"
              value={draft.examplesRu[i]}
              onChange={(v) => setExample('examplesRu', i, v)}
            />
          </div>
        ))}
      </Section>

      <section
        className={cn(
          'mt-3 rounded-xl border px-4 py-3.5',
          ready ? 'border-ok/40 bg-surface' : 'border-bad/40 bg-surface',
        )}
      >
        <h2 className={cn('text-[14.5px] font-semibold', ready ? 'text-ok' : 'text-bad')}>
          {ready ? 'Карточку можно заводить' : `Мешает завести: ${blocks.length}`}
        </h2>
        {blocks.length ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {blocks.map((f) => (
              <li key={f.text} className="text-[13px] leading-relaxed text-bad">
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        {notes.length ? (
          <>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-faint">
              не мешает завести, но стоит взглянуть
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {notes.map((f) => (
                <li key={f.text} className="text-[13px] leading-relaxed text-muted">
                  {f.text}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {create.isError ? (
        <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {create.error instanceof Error ? create.error.message : 'Не удалось завести карточку'}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!ready || create.isPending}
          onClick={() => {
            create.mutate(toPayload(draft), { onSuccess: (id) => setCreated(id) });
          }}
          className={cn(
            'flex flex-1 items-center justify-center rounded-lg border border-ink bg-ink px-4 py-2.5 text-[14px] font-semibold text-bg',
            busyClasses(create.isPending),
          )}
        >
          <Busy busy={create.isPending} label="Заводим карточку">
            Завести карточку
          </Busy>
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-line px-4 py-2.5 text-[14px] font-medium"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};
