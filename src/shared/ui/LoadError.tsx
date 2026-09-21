interface LoadErrorProps {
  /** Что именно не загрузилось: «колоду», «список слов», «статистику». */
  what: string;
  onRetry?: () => void;
}

/**
 * Сообщение о неудавшейся загрузке.
 *
 * Существует потому, что без него экраны показывали пустоту: список
 * говорил «в колоде пока нет слов», карточка — «словарь пуст»,
 * а статистика рисовала нули. Всё это утверждения о данных, которых мы
 * на самом деле не видели. Не знать и знать, что пусто, — разные вещи,
 * и путать их нельзя: человек решит, что потерял свой словарь.
 */
export const LoadError = ({ what, onRetry }: LoadErrorProps) => (
  <div className="my-4 rounded-xl border border-bad/30 bg-bad/5 px-4 py-5 text-center">
    <p className="text-[13.5px] font-semibold text-bad">Не удалось загрузить {what}</p>
    <p className="mx-auto mt-1 max-w-[34ch] text-[12.5px] leading-relaxed text-muted">
      Это сбой связи с базой, а не пустые данные. Проверьте соединение и попробуйте ещё раз.
    </p>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-semibold"
      >
        Повторить
      </button>
    ) : null}
  </div>
);
