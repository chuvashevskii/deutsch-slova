import { useEffect } from 'react';

/**
 * Клавиши на карточке: цифры для оценок и Enter для показа ответа.
 *
 * Обработчик висит на документе, а не на кнопке: нажимать приходится,
 * когда фокус где угодно — сразу после проверки он на кнопке «Проверить»,
 * которой уже нет.
 *
 * Пока курсор в поле ввода, клавиши не срабатывают, иначе цифра внутри
 * немецкой формы превратилась бы в оценку.
 */
const isTyping = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

interface CardKeys {
  /** Ответ открыт: цифры 1–4 ставят оценку. */
  onGrade: ((rating: 1 | 2 | 3 | 4) => void) | null;
  /** Ответ ещё закрыт: Enter открывает его. */
  onReveal: (() => void) | null;
}

export const useCardKeys = ({ onGrade, onReveal }: CardKeys): void => {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      if (onGrade && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        onGrade(Number(event.key) as 1 | 2 | 3 | 4);
        return;
      }
      if (onReveal && event.key === 'Enter') {
        event.preventDefault();
        onReveal();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onGrade, onReveal]);
};
