import { useConfirmWord, type Word } from '@/entities/word';
import { useIsAdmin } from '@/entities/settings';
import { Busy, busyClasses } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';

/**
 * Предупреждение на обороте черновой карточки.
 *
 * Черновик собран по частотному списку: перевод, род, множественное
 * и правило выведены автоматически. Молча показать такой разбор рядом
 * с проверенными карточками нельзя — по виду они неотличимы, а доверия
 * заслуживают разного.
 *
 * Отдельно названы поля, где ошибка вероятнее всего: произношение
 * и формы неправильных глаголов выводятся хуже прочего, и сверять
 * надо в первую очередь их. Сказать «проверьте всё» — значит не сказать
 * ничего.
 *
 * Кнопка согласования видна только администратору: на уровне базы
 * стоит политика, здесь — то же правило, чтобы не показывать кнопку,
 * которая всё равно не сработает.
 */
export const DraftNotice = ({ word }: { word: Word }) => {
  const { data: isAdmin } = useIsAdmin();
  const confirm = useConfirmWord();

  if (word.confirmed_at) return null;

  return (
    <div className="mb-3 rounded-lg border border-dashed border-gold bg-gold/5 px-3 py-2.5">
      <p className="text-[12.5px] font-semibold text-preposition">Черновик — разбор не сверен</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        Карточка собрана по частотному списку, а не взята из готовой колоды. Внимательнее всего
        стоит смотреть на произношение и формы: там ошибка вероятнее всего. Нашли неточность —
        нажмите «Что-то не так» ниже.
      </p>
      {isAdmin ? (
        <button
          type="button"
          disabled={confirm.isPending}
          onClick={() => confirm.mutate({ wordId: word.id, confirmed: true })}
          className={cn(
            'mt-2 flex items-center rounded-lg border border-ink bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-bg',
            busyClasses(confirm.isPending),
          )}
        >
          <Busy busy={confirm.isPending} label="Согласовываем">
            Согласовать
          </Busy>
        </button>
      ) : null}
      {confirm.isError ? (
        <p className="mt-1.5 text-[12px] text-bad">Не удалось согласовать, попробуйте ещё раз.</p>
      ) : null}
    </div>
  );
};
