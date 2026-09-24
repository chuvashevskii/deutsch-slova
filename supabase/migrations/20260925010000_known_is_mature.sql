-- «Знаю» перестаёт быть вечным исключением.
--
-- Отметка убирала слово из очереди навсегда, и это неверно по сути:
-- знание выветривается, а отметка об этом не знала. Человек, честно
-- отметивший триста знакомых слов, через год не имел ни одного повода
-- усомниться ни в одном из них.
--
-- Теперь «Знаю» **заводит карточку сразу зрелой**. Слово уходит
-- из очереди, но не насовсем: через заданный срок оно вернётся один раз
-- на проверку. Ответил «Хорошо» — следующая встреча вдвое-втрое дальше
-- и так до горизонта. Промахнулся — карточка падает в «учу», и это
-- ровно тот сигнал, ради которого всё затевалось.
--
-- Почему посев, а не «нажать за человека Легко»: на новой карточке
-- «Легко» даёт восемь дней. Восемь дней — это обычное заучивание,
-- а не «я это знаю». Посев ставит стабильность сразу такой, какой она
-- была бы у слова, прожившего с человеком несколько месяцев.

alter table public.user_settings
  add column if not exists known_interval_days integer not null default 90;

alter table public.user_settings drop constraint if exists user_settings_known_interval_check;
alter table public.user_settings add constraint user_settings_known_interval_check
  check (known_interval_days between 21 and 3650);

comment on column public.user_settings.known_interval_days is
  'Через сколько дней вернуть на проверку слово, отмеченное «знаю». Снизу ограничено 21 днём — порогом зрелости: меньший срок сделал бы отметку обычным заучиванием.';

/**
 * Отмечает слово знакомым и заводит ему зрелую карточку.
 *
 * Возвращает день, когда слово вернётся на проверку.
 */
create or replace function public.mark_known(p_word_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  span integer;
  existing public.cards;
  when_due timestamptz;
begin
  if uid is null then
    raise exception 'Нужно войти';
  end if;
  if not exists (select 1 from public.words w where w.id = p_word_id) then
    raise exception 'Карточки % нет', p_word_id;
  end if;

  select coalesce(known_interval_days, 90) into span
    from public.user_settings where user_id = uid;
  span := coalesce(span, 90);

  select * into existing from public.cards c where c.user_id = uid and c.word_id = p_word_id;

  -- INFO: заслуженный интервал не понижаем. Если человек уже довёл слово
  -- до двухсот дней, а потом нажал «Знаю», посев на девяносто откатил бы
  -- его назад — отметка стала бы наказанием за прилежание.
  if found and existing.scheduled_days >= span then
    when_due := existing.due;
  else
    when_due := now() + make_interval(days => span);
    insert into public.cards (
      user_id, word_id, due, stability, difficulty,
      elapsed_days, scheduled_days, reps, lapses, state,
      learning_steps, last_review, updated_at
    ) values (
      uid, p_word_id, when_due, span, 5,
      0, span, 1, 0, 2,
      0, now(), now()
    )
    on conflict (user_id, word_id) do update set
      due = excluded.due,
      stability = excluded.stability,
      difficulty = excluded.difficulty,
      scheduled_days = excluded.scheduled_days,
      reps = greatest(public.cards.reps, 1),
      state = 2,
      last_review = excluded.last_review,
      updated_at = excluded.updated_at;
  end if;

  insert into public.word_marks (user_id, word_id, mark)
  values (uid, p_word_id, 'known')
  on conflict (user_id, word_id) do update set mark = 'known';

  return when_due;
end;
$$;

comment on function public.mark_known is
  'Отмечает слово знакомым: заводит зрелую карточку с интервалом из настроек. Слово вернётся один раз на проверку, а не исчезнет навсегда.';

/**
 * Снимает отметку «знаю».
 *
 * Карточка удаляется только если человек на слово ни разу не отвечал:
 * она была объявлена, а не заработана, и оставлять её значило бы держать
 * слово зрелым после того, как зрелость отозвали. Отвечал — карточка
 * остаётся: те ответы были настоящими.
 */
create or replace function public.unmark_known(p_word_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Нужно войти';
  end if;

  delete from public.word_marks
   where user_id = uid and word_id = p_word_id and mark = 'known';

  if not exists (
    select 1 from public.reviews r where r.user_id = uid and r.word_id = p_word_id
  ) then
    delete from public.cards c where c.user_id = uid and c.word_id = p_word_id;
  end if;
end;
$$;

comment on function public.unmark_known is
  'Снимает отметку «знаю». Посеянную карточку удаляет, заработанную оставляет.';

revoke execute on function public.mark_known(text) from public;
revoke execute on function public.mark_known(text) from anon;
grant execute on function public.mark_known(text) to authenticated;

revoke execute on function public.unmark_known(text) from public;
revoke execute on function public.unmark_known(text) from anon;
grant execute on function public.unmark_known(text) to authenticated;

-- Настоящий ответ снимает объявление: слово больше не «знаю сам»,
-- а то, чем его сделал планировщик. Триггер на `reviews`, а не на
-- `cards`: у посеянной карточки `reps` уже единица, и по ней ответ
-- от посева не отличить, а строка в журнале ответов бывает только
-- от живого нажатия.
create or replace function public.drop_known_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.word_marks
   where user_id = new.user_id and word_id = new.word_id and mark = 'known';
  return new;
end;
$$;

drop trigger if exists reviews_drop_known on public.reviews;
create trigger reviews_drop_known
  after insert on public.reviews
  for each row execute function public.drop_known_on_review();
