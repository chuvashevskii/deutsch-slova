import { cn } from '@/shared/lib/cn';

/**
 * Заглушка на время загрузки. Повторяет очертания того, что появится,
 * чтобы экран не прыгал, когда данные придут, и чтобы ожидание не
 * выглядело как пустой экран.
 */
export const Skeleton = ({ className }: { className?: string }) => (
  <span className={cn('block animate-pulse rounded bg-line-soft', className)} aria-hidden="true" />
);

/** Несколько строк списка слов на время загрузки страницы. */
export const WordRowsSkeleton = ({ rows = 8 }: { rows?: number }) => (
  <div aria-busy="true" aria-label="Загружаем список слов">
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className="grid grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-line-soft px-3.5 py-3 last:border-b-0"
      >
        <Skeleton className="h-3 w-5" />
        <span className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-2.5 w-2/3" />
        </span>
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
    ))}
  </div>
);

/** Очертания карточки на экране «Учить». */
export const CardSkeleton = () => (
  <div
    aria-busy="true"
    aria-label="Загружаем карточку"
    className="mt-4 overflow-hidden rounded-xl border border-line bg-surface"
  >
    <div className="flex flex-col items-center gap-2.5 border-b border-line-soft px-4 py-8">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-24" />
    </div>
    <div className="flex flex-col gap-2 px-4 py-5">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  </div>
);
