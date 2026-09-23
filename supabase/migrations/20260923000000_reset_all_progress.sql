-- Полный сброс обучения — одной кнопкой и одной транзакцией.
--
-- Сброс по одному слову уже есть, и он журнал ответов **не трогает**:
-- вы действительно отвечали в тот день, и стирать запись значило бы
-- переписать задним числом точность и тепловую карту.
--
-- Здесь правило обратное, и это осознанно. Полный сброс просят,
-- когда хотят начать с чистого листа: если оставить журнал, статистика
-- продолжит показывать сотни ответов и закрашенные дни, и человек
-- решит, что кнопка не сработала. Поэтому уходит всё — состояние
-- карточек, журнал ответов и отметки рукой.
--
-- Функция возвращает, сколько чего удалено. Без этого экран может
-- сказать только «готово», а просили подтвердить, что удаление
-- действительно прошло: числа это и подтверждают.

create or replace function public.reset_all_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed_cards integer;
  removed_reviews integer;
  removed_marks integer;
begin
  if uid is null then
    raise exception 'Сбрасывать прогресс может только вошедший';
  end if;

  -- INFO: порядок не важен — таблицы друг на друга не ссылаются,
  -- обе висят на user_id. Важно, что всё в одной транзакции: половина
  -- сброса хуже, чем ни одного.
  delete from public.cards where user_id = uid;
  get diagnostics removed_cards = row_count;

  delete from public.reviews where user_id = uid;
  get diagnostics removed_reviews = row_count;

  delete from public.word_marks where user_id = uid;
  get diagnostics removed_marks = row_count;

  return jsonb_build_object(
    'cards', removed_cards,
    'reviews', removed_reviews,
    'marks', removed_marks
  );
end;
$$;

comment on function public.reset_all_progress is
  'Удаляет всё обучение вошедшего: карточки, журнал ответов, отметки. Возвращает числа удалённого.';

-- Права на выполнение — только вошедшим. Анониму функция ни к чему,
-- а `security definer` без этого пускал бы кого угодно.
--
-- Одного `revoke from public` мало, и это проверено: у `anon` в этой
-- схеме стоит свой явный грант от правил по умолчанию, и отзыв у PUBLIC
-- его не снимает. Роль названа отдельно.
revoke execute on function public.reset_all_progress() from public;
revoke execute on function public.reset_all_progress() from anon;
grant execute on function public.reset_all_progress() to authenticated;
