-- Отметки, которые человек сам ставит слову.
--
-- Три разных пожелания — «хочу увидеть сегодня», «отменить» и «я это
-- знаю» — на деле одна сущность, поэтому и механизм один.
--
-- Отдельная таблица, а не колонка в cards: пустая карточка-заглушка ради
-- флага попала бы в счётчики прогресса, и состав колоды поехал бы.

create table public.word_marks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  word_id    text not null references public.words (id) on delete cascade,
  mark       text not null check (mark in ('requested', 'known')),
  created_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

comment on table public.word_marks is
  'Пожелания человека по конкретному слову: requested — показать сегодня, known — знаю, не показывать.';

alter table public.word_marks enable row level security;

create policy "Свои отметки видны владельцу"
  on public.word_marks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свои отметки ставит владелец"
  on public.word_marks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Свои отметки правит владелец"
  on public.word_marks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Свои отметки снимает владелец"
  on public.word_marks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Очередь учитывает отметки: запрошенные идут первыми и мимо лимита,
-- помеченные «знаю» не приходят вовсе.
--
-- Запрошенные ставятся ПЕРЕД просроченными намеренно: человек только что
-- нажал кнопку и ждёт это слово сразу, а не после сорока долгов. Лимит
-- на них не распространяется — он сдерживает автоматический набор,
-- а не собственную просьбу.

create or replace function public.learn_queue(
  p_new_limit int default null,
  p_limit     int default 5
)
returns jsonb
language sql
stable
as $$
  with settings as (
    select coalesce(
      p_new_limit,
      (select daily_new_limit from public.user_settings where user_id = auth.uid()),
      20
    ) as new_limit
  ),
  mine as (
    select w.id, w.rank, w.head, c.due, c.reps, m.mark
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    where coalesce(m.mark, '') <> 'known'
  ),
  requested as (
    select id, rank, head from mine
    where mark = 'requested' and (reps is null or reps = 0)
  ),
  due as (
    select id, rank, head, due from mine
    where reps > 0 and due <= now()
  ),
  fresh as (
    select id, rank, head from mine
    where (reps is null or reps = 0) and coalesce(mark, '') <> 'requested'
  ),
  -- INFO: ограничение считается отдельной выборкой. Если написать
  -- «order by … limit …» после union, оно урежет всю очередь, а не только
  -- новые слова, и просроченные начнут пропадать.
  fresh_limited as (
    select id, rank, head from fresh
    order by rank nulls last, head, id
    limit greatest(0, (select new_limit from settings) - (select count(*) from due))
  ),
  queue as (
    select id, 0 as bucket, null::timestamptz as order_time, rank, head from requested
    union all
    select id, 1 as bucket, due as order_time, rank, head from due
    union all
    select id, 2 as bucket, null::timestamptz as order_time, rank, head from fresh_limited
  ),
  ordered as (
    select id, row_number() over (order by bucket, order_time, rank nulls last, head, id) as position
    from queue
  )
  select jsonb_build_object(
    'total', (select count(*) from queue),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('word', to_jsonb(w), 'card', to_jsonb(c))
          order by o.position
        )
        from ordered o
        join public.words w on w.id = o.id
        left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
        where o.position <= p_limit
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.learn_queue is
  'Очередь на «Учить»: запрошенные вручную, просроченные по сроку, новые по рангу в пределах дневного лимита. Помеченные «знаю» исключены.';

-- Отметка «хочу сегодня» снимается сама, как только на слово ответили:
-- дальше словом распоряжается планировщик, и просьба больше ни при чём.
create or replace function public.drop_request_on_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.word_marks
  where user_id = new.user_id and word_id = new.word_id and mark = 'requested';
  return new;
end;
$$;

create trigger cards_drop_request
  after insert or update on public.cards
  for each row when (new.reps > 0)
  execute function public.drop_request_on_answer();
