import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { Spinner } from './Spinner';

/**
 * Подменяет содержимое кнопки крутилкой, пока действие идёт на сервере.
 *
 * Крутилка встаёт **на нажатую кнопку и вместо её текста**. Раньше она
 * приставлялась рядом с подписью, и кнопка на время запроса становилась
 * шире — ряд кнопок дёргался. А в «Новых словах в день» она и вовсе
 * появлялась на всех кнопках, кроме выбранной: выглядело это как общий
 * индикатор экрана, по которому не понять, что именно приняли.
 *
 * Текст остаётся в потоке прозрачным, а не убирается: место под него
 * занято, и кнопка не меняет размер. Прозрачность выбрана вместо
 * `visibility: hidden` намеренно — скрытый текст выпадает из дерева
 * доступности, и кнопка осталась бы без имени, с одним «Сохраняем».
 */
export const Busy = ({
  busy,
  label,
  children,
}: {
  busy: boolean;
  /** Что именно ждём: уходит в подпись для чтения с экрана. */
  label?: string;
  children: ReactNode;
}) => (
  <span className="relative inline-flex items-center justify-center gap-1.5">
    <span className={cn('inline-flex items-center gap-1.5', busy && 'opacity-0')}>{children}</span>
    {busy ? (
      // INFO: центрует обёртка, а не сама крутилка. `animate-spin` задаёт
      // `transform: rotate()` и затирает `-translate-x/y`, которыми её
      // центровали раньше: кольцо крутилось не вокруг своего центра,
      // а по орбите вокруг угла — заметно и некрасиво.
      <span className="absolute inset-0 flex items-center justify-center">
        {/* Кольцо толще и без приглушения: тонкая полупрозрачная дуга
            на тёмной кнопке не читается. */}
        <Spinner label={label} className="border-2 opacity-100" />
      </span>
    ) : null}
  </span>
);
