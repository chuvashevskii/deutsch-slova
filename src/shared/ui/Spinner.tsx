import { cn } from '@/shared/lib/cn';

/**
 * Показывает, что действие ушло на сервер и ответа ещё нет.
 *
 * Без него нажатие выглядит как зависание: кнопка гаснет, и непонятно,
 * приняли её или нет. Размер наследуется от текста рядом, поэтому
 * крутилка не выбивается из строки, куда бы её ни поставили.
 */
export const Spinner = ({ className, label }: { className?: string; label?: string }) => (
  <span
    role="status"
    aria-label={label ?? 'Сохраняем'}
    className={cn(
      'inline-block h-[1em] w-[1em] shrink-0 animate-spin rounded-full',
      'border border-current border-t-transparent opacity-60',
      className,
    )}
  />
);
