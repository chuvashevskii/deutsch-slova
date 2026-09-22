import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DEFAULT_SETTINGS,
  NEW_LIMITS,
  useProfile,
  useSaveNickname,
  useSaveSettings,
  useUserSettings,
  type AnswerSettings,
} from '@/entities/settings';
import { useProgressSummary } from '@/entities/word';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/features/theme';
import { cn } from '@/shared/lib/cn';
import { Busy, busyClasses, LoadError, Skeleton, Spinner } from '@/shared/ui';

type InputKey = Extract<keyof AnswerSettings, `input_${string}`> | 'ask_genus';

/**
 * Галочки отдельные на каждую группу форм, а не один переключатель ввода:
 * цена очень разная. Пять форм спряжения с телефона — марафон, а одно поле
 * множественного числа — секунды.
 */
const INPUT_GROUPS: Array<{ title: string; hint: string; items: Array<{ key: InputKey; label: string }> }> = [
  {
    title: 'Существительное',
    hint: 'Единственное вы обычно и так знаете — множественное в немецком отдельная боль.',
    items: [
      { key: 'input_noun_singular', label: 'Singular' },
      { key: 'input_noun_plural', label: 'Plural' },
    ],
  },
  {
    title: 'Глагол',
    hint: 'Формы местоимений — это пять полей подряд.',
    items: [
      { key: 'input_verb_infinitive', label: 'Инфинитив' },
      { key: 'input_verb_forms', label: 'Формы местоимений' },
    ],
  },
  {
    title: 'Прилагательные, наречия, служебные',
    hint: 'Одно поле — само слово.',
    items: [{ key: 'input_other', label: 'Слово' }],
  },
];

// INFO: переключателя «Формы по родам» здесь нет намеренно. Склонение
// прилагательного и определителя — общее правило языка: у `groß` формы
// ровно те же, что у `jeder`, и показывать их у двух слов значило бы
// завести формат ради двух слов. Собственные формы бывают у считанных
// слов вроде `der Deutsche / die Deutsche`; их в колоде пока нет,
// и переключатель, который ничего не меняет, обещал бы работу,
// которой не существует. Настройка и разбор ответа на месте —
// вернём переключатель вместе с такими словами.

const THEMES = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлое' },
  { value: 'dark', label: 'Тёмное' },
] as const;

const Toggle = ({
  checked,
  onChange,
  label,
  saving,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  /** Галочка уже переключилась, но ответ сервера ещё не пришёл. */
  saving: boolean;
}) => (
  <label className="flex cursor-pointer items-center gap-3 py-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-[18px] w-[18px] shrink-0 accent-ink"
    />
    <span className="text-[14.5px]">{label}</span>
    {saving ? <Spinner className="text-muted" /> : null}
  </label>
);

export const SettingsPage = () => {
  const { user } = useAuth();
  const { data: settings = DEFAULT_SETTINGS, isLoading, isError, refetch } = useUserSettings();
  const { data: profile } = useProfile();
  const saveSettings = useSaveSettings();
  const saveNickname = useSaveNickname();
  const theme = useTheme();
  const { data: progress } = useProgressSummary();

  // INFO: черновик пуст, пока человек не начал править: показывается то, что
  // пришло из базы. Так поле не приходится досылать эффектом, когда
  // профиль подгрузился.
  const [draft, setDraft] = useState<string | null>(null);
  const nickname = draft ?? profile?.nickname ?? '';

  // INFO: что именно сохраняется, мутация знает сама — это её аргументы.
  // Отдельное состояние рядом с ними было лишним и умело разойтись:
  // крутилка гасла по `onSettled`, а запрос ещё шёл.
  const savingPatch = saveSettings.isPending ? saveSettings.variables?.patch : undefined;
  const savingKey = savingPatch
    ? (Object.keys(savingPatch)[0] as keyof AnswerSettings)
    : undefined;

  // INFO: показать умолчания вместо непрочитанных настроек значит соврать:
  // человек увидит снятые галочки там, где сам их ставил.
  if (isError) {
    return (
      <LoadError
        what="настройки"
        onRetry={() => {
          refetch().catch(() => undefined);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  const update = (patch: Partial<AnswerSettings>) => {
    if (user) saveSettings.mutate({ userId: user.id, patch });
  };

  const anyInput =
    settings.input_noun_singular ||
    settings.input_noun_plural ||
    settings.input_verb_infinitive ||
    settings.input_verb_forms ||
    settings.input_other;

  return (
    <div className="py-4">
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Что вводить с клавиатуры</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          По умолчанию карточка ничего не спрашивает: показывает перевод, вы вспоминаете слово
          и открываете ответ. Включите то, что хотите писать руками.
        </p>

        {INPUT_GROUPS.map((group) => (
          <div key={group.title} className="mt-4 border-t border-line-soft pt-3 first:border-t-0">
            <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">
              {group.title}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-faint">{group.hint}</p>
            <div className="mt-1">
              {group.items.map((item) => (
                <Toggle
                  key={item.key}
                  label={item.label}
                  checked={settings[item.key]}
                  saving={savingKey === item.key}
                  onChange={(value) => update({ [item.key]: value })}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 border-t border-line-soft pt-3">
          <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">Артикль</p>
          <p className="mt-1 text-[12px] leading-snug text-faint">
            Три кнопки der / die / das. Живут отдельно от ввода: остаются, даже когда печатать
            ничего не надо, и только они наполняют «Путаницу в роде».
          </p>
          <Toggle
            label="Спрашивать артикль"
            checked={settings.ask_genus}
            saving={savingKey === 'ask_genus'}
            onChange={(value) => update({ ask_genus: value })}
          />
        </div>

        {!anyInput ? (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
            Пока ввод выключен, «Точность» и «Где спотыкаетесь» в статистике считать не из чего:
            правильность ответа определяет только проверка напечатанного.
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Новых слов в день</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Сколько незнакомых слов добавлять к повторениям за сессию. Просроченные повторения
          в этот счёт входят: если долгов больше лимита, новых не будет вовсе.
        </p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {NEW_LIMITS.map((limit) => (
            <button
              key={limit}
              type="button"
              aria-pressed={settings.daily_new_limit === limit}
              onClick={() => update({ daily_new_limit: limit })}
              className={cn(
                'flex touch-manipulation items-center justify-center rounded-lg border border-line bg-surface-2 py-2.5 text-[14px] font-semibold tabular-nums',
                settings.daily_new_limit === limit && 'border-ink bg-ink text-bg',
              )}
            >
              <Busy busy={savingPatch?.daily_new_limit === limit} label="Сохраняем лимит">
                {limit}
              </Busy>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Черновые карточки</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Слова, собранные по частотному списку, а не взятые из готовой колоды: разбор у них
          выведен автоматически и человеком не сверен. В списке слов они видны всегда
          и помечены, а в «Учить» попадают только с этой настройкой.
        </p>
        <Toggle
          label="Давать черновики в «Учить»"
          checked={settings.include_drafts}
          saving={savingKey === 'include_drafts'}
          onChange={(value) => update({ include_drafts: value })}
        />
        {progress?.drafts ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Ждут сверки: {progress.drafts}.{' '}
            <Link to="/words?draft=1" className="underline underline-offset-2">
              Посмотреть список
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Оформление</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Выбор запоминается в этом браузере, а не в учётной записи: с телефона вечером
          и за столом днём удобны разные, и таскать один между ними ни к чему.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme.choice === option.value}
              onClick={() => theme.change(option.value)}
              className={cn(
                'touch-manipulation rounded-lg border border-line bg-surface-2 py-2.5 text-[13.5px] font-semibold',
                theme.choice === option.value && 'border-ink bg-ink text-bg',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Псевдоним</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Им подписаны ваши строки в обращениях и бэклоге — эти списки общие. Почта туда
          не попадает.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nickname}
            maxLength={40}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14.5px]"
          />
          <button
            type="button"
            disabled={
              !user || !nickname.trim() || nickname.trim() === profile?.nickname || saveNickname.isPending
            }
            onClick={() => {
              if (user) saveNickname.mutate({ userId: user.id, nickname: nickname.trim() });
            }}
            className={cn(
              'flex shrink-0 items-center rounded-lg border border-ink bg-ink px-4 text-[14px] font-semibold text-bg',
              busyClasses(saveNickname.isPending),
            )}
          >
            <Busy busy={saveNickname.isPending} label="Сохраняем псевдоним">
              Сохранить
            </Busy>
          </button>
        </div>
      </section>

      {saveSettings.isError || saveNickname.isError ? (
        <p className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.
        </p>
      ) : null}
    </div>
  );
};
