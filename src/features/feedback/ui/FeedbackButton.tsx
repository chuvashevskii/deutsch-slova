import { useState } from 'react';

import { useSendFeedback, type FeedbackContext } from '@/entities/feedback';
import type { Word } from '@/entities/word';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Busy, busyClasses } from '@/shared/ui';

/**
 * Кнопка «что-то не так» на обороте карточки.
 *
 * Вместе с текстом уходит снимок слова: словарь заливается из Anki
 * повторно, и через неделю жалоба «здесь неверная форма» стала бы
 * непроверяемой — поле уже другое. Со снимком видно, на что человек
 * смотрел. Если жалоба пришла с «Учить», в снимок добавляется и то,
 * что было введено: половина обращений будет «я написал верно,
 * а мне не засчитали».
 */
export const FeedbackButton = ({
  word,
  context,
}: {
  word: Word;
  context?: FeedbackContext | null;
}) => {
  const { user } = useAuth();
  const send = useSendFeedback();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) return null;

  if (send.isSuccess && !open) {
    return (
      <p className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-[12.5px] text-ok">
        Обращение отправлено — оно в разделе «Ещё → Обращения».
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12px] text-faint hover:text-muted"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4.6v4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.85" fill="currentColor" />
        </svg>
        Что-то не так с карточкой
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <label htmlFor="feedback-message" className="block text-[12.5px] font-semibold">
        Что не так с «{word.head}»
      </label>
      <p className="mt-0.5 text-[11.5px] leading-snug text-faint">
        К сообщению приложится снимок карточки — как она выглядит сейчас. Список общий, подпись —
        ваш псевдоним.
      </p>
      <textarea
        id="feedback-message"
        rows={3}
        maxLength={2000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="mt-2 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13.5px]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!message.trim() || send.isPending}
          onClick={() =>
            send.mutate(
              { userId: user.id, word, message, context },
              {
                onSuccess: () => {
                  setMessage('');
                  setOpen(false);
                },
              },
            )
          }
          className={cn(
            'flex items-center rounded-lg border border-ink bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg',
            busyClasses(send.isPending),
          )}
        >
          <Busy busy={send.isPending} label="Отправляем">
            Отправить
          </Busy>
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-muted"
        >
          Отмена
        </button>
      </div>
      {send.isError ? (
        <p className="mt-2 text-[12px] text-bad">Не удалось отправить, попробуйте ещё раз.</p>
      ) : null}
    </div>
  );
};
