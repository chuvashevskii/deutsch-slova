import { useRef, useState } from 'react';

import {
  ANSWER_RATINGS,
  formatInterval,
  previewIntervals,
  toFsrsCard,
  useAnswerCard,
  type CardRow,
  type Grade,
} from '@/entities/review';
import { answerFields, asksGenus, DEFAULT_SETTINGS, useUserSettings } from '@/entities/settings';
import { posLabel, registerLabel, useLearnQueue, useProgressSummary } from '@/entities/word';
import { useAuth } from '@/features/auth';
import { canon } from '@/shared/lib/german';
import { cn } from '@/shared/lib/cn';
import { useElapsed } from '@/shared/lib/useElapsed';
import { useCardKeys } from '@/shared/lib/useCardKeys';
import { useNow } from '@/shared/lib/useNow';
import { Busy, CardSkeleton, LoadError, Skeleton } from '@/shared/ui';
import { WordAnswer, type WrongAnswers } from '@/widgets/word-answer/WordAnswer';

const GENUS_CHOICES = [
  { value: 'm', article: 'der', className: 'text-masculine' },
  { value: 'f', article: 'die', className: 'text-feminine' },
  { value: 'n', article: 'das', className: 'text-neuter' },
] as const;

export const LearnPage = () => {
  const { user } = useAuth();
  const {
    data: queue,
    isLoading: queueLoading,
    isError: queueFailed,
    refetch: reloadQueue,
  } = useLearnQueue(Boolean(user));
  const { data: progress, isPending: progressPending } = useProgressSummary();
  const { data: settings = DEFAULT_SETTINGS } = useUserSettings();
  const answerCard = useAnswerCard();
  const now = useNow();

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [chosenGenus, setChosenGenus] = useState<'m' | 'f' | 'n' | null>(null);
  const [checked, setChecked] = useState<{ wrong: WrongAnswers; allCorrect: boolean | null } | null>(
    null,
  );
  const [gradingAs, setGradingAs] = useState<Grade | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const head = queue?.items[0];
  const current = head?.word;
  const cardRow = (head?.card ?? undefined) as CardRow | undefined;
  const elapsedMs = useElapsed(current?.id);

  // INFO: всё, что зависит от карточки, считается до ранних возвратов —
  // иначе хук с клавишами оказался бы за условием, а порядок хуков
  // обязан быть одинаковым на каждой отрисовке.
  const fields = current ? answerFields(current, settings) : [];
  const wantsGenus = current ? asksGenus(current, settings) : false;
  const nothingAsked = fields.length === 0 && !wantsGenus;

  /**
   * Человек не ввёл ничего: все спрошенные поля пусты и артикль не выбран.
   *
   * Отличается от ошибки. Написать `jede` вместо `jeder` — промах,
   * и его показывают зачёркнутым рядом с верной формой. Не написать
   * ничего — это «не вспомнил», и зачёркивать там нечего.
   *
   * На подсчёт не влияет: невспомненное слово верным не бывает,
   * и в точность оно идёт как неверное. Разная только надпись.
   */
  const answeredNothing =
    checked !== null &&
    checked.allCorrect === false &&
    Object.keys(checked.wrong).length === fields.length &&
    Object.values(checked.wrong).every((given) => !given) &&
    (!wantsGenus || chosenGenus === null);
  const previews = previewIntervals(toFsrsCard(cardRow), new Date(now), settings.desired_retention);

  const reset = () => {
    setInputs({});
    setChosenGenus(null);
    setChecked(null);
    setGradingAs(null);
    inputRefs.current = [];
    // INFO: после ответа фокус уходит в никуда, и следующую карточку
    // с клавиатуры уже не начать. Возвращаем его в первое поле.
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  };

  /**
   * Правильность определяется только там, где было что проверять. Если не
   * спрошено ни формы, ни артикля, результат — null: выводить его из
   * будущей оценки нельзя, «Снова» означает «покажи пораньше», а не
   * «я ошибся». Статистика такие ответы не считает.
   */
  const handleCheck = () => {
    if (!current) return;
    if (nothingAsked) {
      setChecked({ wrong: {}, allCorrect: null });
      return;
    }
    const wrong: WrongAnswers = {};
    let allCorrect = true;
    fields.forEach((field) => {
      const given = (inputs[field.key] ?? '').trim();
      if (canon(given) !== canon(field.expected)) {
        allCorrect = false;
        wrong[field.key] = given;
      }
    });
    if (wantsGenus && chosenGenus !== current.genus) allCorrect = false;
    setChecked({ wrong, allCorrect });
  };

  const handleGrade = (rating: Grade) => {
    if (!current || !user || answerCard.isPending) return;
    setGradingAs(rating);
    answerCard.mutate(
      {
        userId: user.id,
        wordId: current.id,
        rating,
        current: cardRow,
        answeredCorrectly: checked?.allCorrect ?? null,
        answeredGenus: wantsGenus ? chosenGenus : null,
        durationMs: elapsedMs(),
        desiredRetention: settings.desired_retention,
      },
      { onSuccess: reset, onError: () => setGradingAs(null) },
    );
  };

  useCardKeys({
    onGrade: current && checked && !answerCard.isPending ? handleGrade : null,
    onReveal: current && checked === null ? handleCheck : null,
  });

  if (queueLoading) return <CardSkeleton />;

  // INFO: сбой загрузки нельзя показывать как «словарь пуст» — человек
  // решит, что потерял колоду. Не знать и знать, что пусто, — разное.
  if (queueFailed) {
    return (
      <LoadError
        what="очередь повторений"
        onRetry={() => {
          reloadQueue().catch(() => undefined);
        }}
      />
    );
  }

  // INFO: пустой словарь и выполненный на сегодня план выглядят одинаково —
  // карточки нет, — но говорить «повторений не осталось» там, где учить нечего
  // в принципе, значит вводить в заблуждение.
  if (!current) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">
          {progress?.total === 0 ? 'словарь пуст' : 'на сегодня всё'}
        </p>
        <p className="mt-2 text-sm text-muted">
          {progress?.total === 0
            ? 'В колоде пока нет слов — учить нечего.'
            : 'Повторений не осталось. В «Статистике» видно, что придёт завтра.'}
        </p>
      </div>
    );
  }

  const register = registerLabel(current.register);

  return (
    <div>
      <div className="flex items-center gap-2 py-3 font-mono text-[11px] text-muted">
        {progressPending ? (
          <Skeleton className="h-3 w-44" />
        ) : (
          <>
            <span>
              к повторению <b className="font-medium tabular-nums text-ink">{queue?.total ?? 0}</b>
            </span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span>
              учу <b className="font-medium tabular-nums text-ink">{progress?.learning ?? 0}</b>
            </span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <span>
              знаю <b className="font-medium tabular-nums text-ink">{progress?.known ?? 0}</b>
            </span>
          </>
        )}
      </div>

      <article className="overflow-hidden rounded-xl border border-line bg-surface">
        <header className="border-b border-line-soft px-4 py-6 text-center">
          <h1 className="text-balance font-serif text-[26px] font-semibold leading-tight">
            {current.translation}
          </h1>
          {current.definition ? (
            <p className="mt-1.5 text-[13.5px] text-muted">{current.definition}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {current.rank ? (
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">
                №{current.rank}
              </span>
            ) : (
              // INFO: у трети колоды ранга нет — этих слов нет в списке
              // 4500. Пустое место на их карточке выглядело как потеря
              // данных; пометка говорит, что данных и не было.
              <span
                title="Слова нет в частотном списке: ранга у него не существует"
                className="rounded-full border border-dashed border-line px-2 py-0.5 font-mono text-[10.5px] text-faint"
              >
                вне списка
              </span>
            )}
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted">
              {posLabel(current)}
            </span>
            {register ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted">
                {register}
              </span>
            ) : null}
          </div>
        </header>

        {checked === null ? (
          <div className="px-4 pb-5 pt-4">
            {wantsGenus ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {GENUS_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={chosenGenus === choice.value}
                    onClick={() => setChosenGenus(choice.value)}
                    className={cn(
                      'touch-manipulation rounded-lg border-[1.5px] border-line bg-surface-2 px-1 py-2.5 font-serif text-[17px] font-semibold',
                      choice.className,
                      chosenGenus === choice.value &&
                        'border-current bg-surface shadow-[inset_0_0_0_1px_currentColor]',
                    )}
                  >
                    {choice.article}
                  </button>
                ))}
              </div>
            ) : null}

            {fields.map((field, index) => (
              <div key={field.key} className="mb-2 flex items-center gap-2.5">
                <label
                  htmlFor={`answer-${field.key}`}
                  className="w-[86px] shrink-0 truncate text-right font-mono text-[11px] text-faint"
                >
                  {field.label}
                </label>
                <input
                  id={`answer-${field.key}`}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  value={inputs[field.key] ?? ''}
                  onChange={(event) =>
                    setInputs((previous) => ({ ...previous, [field.key]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const next = inputRefs.current[index + 1];
                    if (next) next.focus();
                    else handleCheck();
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border-[1.5px] border-line bg-surface-2 px-3 py-2.5 font-serif text-[17px] outline-none focus:border-focus focus:bg-surface"
                />
              </div>
            ))}

            {nothingAsked ? (
              <p className="text-center text-[13px] leading-relaxed text-muted">
                Вспомните слово и его формы, потом откройте ответ.
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleCheck}
              className="mt-5 w-full touch-manipulation rounded-lg border border-ink bg-ink px-5 py-3 text-[15px] font-semibold text-bg"
            >
              {nothingAsked ? 'Показать' : 'Проверить'}
            </button>
            {nothingAsked ? (
              <p className="mt-2 text-center font-mono text-[10px] text-faint">Enter</p>
            ) : null}
          </div>
        ) : (
          <div className="border-t border-line-soft px-4 pb-5">
            {/* INFO: «есть ошибки» про пустое поле — укор не по делу:
                человек ничего не написал, значит и ошибиться не мог,
                он не вспомнил. Вердикты разные, а вот засчитывается
                и то и другое одинаково: невспомненное слово верным
                не бывает. */}
            {checked.allCorrect === null ? (
              <p className="py-3 font-mono text-[11px] uppercase tracking-widest text-faint">
                проверьте себя сами
              </p>
            ) : answeredNothing ? (
              <p className="py-3 font-mono text-[11px] uppercase tracking-widest text-muted">
                — ответ не введён
              </p>
            ) : (
              <p
                className={cn(
                  'py-3 font-mono text-[11px] uppercase tracking-widest',
                  checked.allCorrect ? 'text-ok' : 'text-bad',
                )}
              >
                {checked.allCorrect ? '✓ верно' : '✗ есть ошибки'}
              </p>
            )}

            <WordAnswer
              word={current}
              wrongAnswers={checked.wrong}
              answeredGenus={wantsGenus ? chosenGenus : undefined}
              feedbackContext={{
                given: Object.fromEntries(fields.map((field) => [field.key, inputs[field.key] ?? ''])),
                expected: Object.fromEntries(fields.map((field) => [field.key, field.expected])),
                answeredGenus: wantsGenus ? chosenGenus : null,
                allCorrect: checked.allCorrect,
              }}
            />

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {ANSWER_RATINGS.map((option) => (
                <button
                  key={option.rating}
                  type="button"
                  disabled={answerCard.isPending}
                  onClick={() => handleGrade(option.rating)}
                  className={cn(
                    'relative touch-manipulation rounded-lg border border-line bg-surface-2 px-1 pb-2 pt-2.5 text-[13px] font-semibold disabled:opacity-50',
                    option.rating === 1 && 'text-bad',
                    option.rating === 4 && 'text-ok',
                    gradingAs === option.rating && 'border-ink',
                  )}
                >
                  <span className="absolute left-1.5 top-1 font-mono text-[9px] font-normal text-faint">
                    {option.rating}
                  </span>
                  {option.label}
                  {/* INFO: крутилка встаёт на место срока, а подпись оценки
                      остаётся: иначе не видно, какую именно кнопку нажали. */}
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-faint">
                    <Busy busy={gradingAs === option.rating} label="Сохраняем ответ">
                      {formatInterval(new Date(now), previews[option.rating])}
                    </Busy>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-2 text-center font-mono text-[10px] text-faint">
              клавиши 1–4 ставят оценку
            </p>

            {answerCard.isError ? (
              <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
                Не удалось сохранить ответ. Проверьте соединение и нажмите оценку ещё раз.
              </p>
            ) : null}
          </div>
        )}
      </article>
    </div>
  );
};
