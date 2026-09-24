import { isOwnCard, useConfirmWord, type Word } from '@/entities/word';
import { useIsAdmin } from '@/entities/settings';
import { Busy, busyClasses } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';

/**
 * Предупреждение на обороте черновой карточки.
 *
 * Черновики бывают двух пород, и путать их нельзя. Собранный
 * по частотному списку выведен автоматически — перевод, род,
 * множественное, правило, — и сверять у него надо в первую очередь
 * произношение и формы: они выводятся хуже прочего. Сказать
 * «проверьте всё» значит не сказать ничего.
 *
 * Заведённый руками (`my-…`) не выводился ниоткуда: его написал
 * человек, и ошибиться мог только он. Обещать ему «собрана
 * по частотному списку» — неправда, и поймана она была на живом
 * прогоне по своей же карточке.
 *
 * Молча показать любой из них рядом с проверенными нельзя: по виду
 * они неотличимы, а доверия заслуживают разного.
 *
 * Кнопка согласования видна только администратору: на уровне базы
 * стоит политика, здесь — то же правило, чтобы не показывать кнопку,
 * которая всё равно не сработает.
 */
export const DraftNotice = ({ word }: { word: Word }) => {
  const { data: isAdmin } = useIsAdmin();
  const confirm = useConfirmWord();

  if (word.confirmed_at) return null;

  const own = isOwnCard(word.id);

  return (
    <div className="mb-3 rounded-lg border border-dashed border-gold bg-gold/5 px-3 py-2.5">
      <p className="text-[12.5px] font-semibold text-preposition">
        {own ? 'Черновик — карточка заведена руками' : 'Черновик — разбор не сверен'}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        {own ? (
          <>
            Её написали вы, а не вывел разбор. В «Учить» она не попадёт, пока вы её не согласуете.
            Поправить перевод, помету, подсказку или примеры можно кнопкой «Править» в словаре.
          </>
        ) : (
          <>
            Карточка собрана по частотному списку, а не взята из готовой колоды. Внимательнее всего
            стоит смотреть на произношение и формы: там ошибка вероятнее всего. Нашли неточность —
            нажмите «Что-то не так» ниже.
          </>
        )}
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
