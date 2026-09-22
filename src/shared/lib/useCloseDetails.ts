import { useEffect, useRef } from 'react';

/**
 * Закрывает раскрытый `<details>` по клику вне его области и по Escape.
 *
 * Своими силами `<details>` этого не умеет: открытый список остаётся
 * висеть, пока не нажмёшь на его же заголовок. На широком экране это
 * особенно заметно — список закрывает половину страницы, и мышь уходит
 * куда угодно, только не обратно на заголовок.
 *
 * Слушается `pointerdown`, а не `click`: список должен исчезать в момент
 * нажатия, а не после отпускания кнопки, иначе он ещё мгновение висит
 * поверх того, куда человек целился.
 */
export const useCloseDetails = () => {
  const ref = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const close = () => {
      if (ref.current?.open) ref.current.open = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      const element = ref.current;
      if (!element?.open) return;
      if (!element.contains(event.target as Node)) close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return ref;
};
