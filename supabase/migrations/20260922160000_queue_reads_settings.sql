-- Дневной лимит новых слов лежал в user_settings и не читался никем:
-- очередь брала своё зашитое число. Теперь берёт настройку, а зашитое
-- остаётся запасным значением на случай, когда строки настроек ещё нет.

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
    select w.id, w.rank, w.head, c.due, c.reps
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
  ),
  due as (
    select id, rank, head, due from mine where reps > 0 and due <= now()
  ),
  fresh as (
    select id, rank, head from mine where reps is null or reps = 0
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
    select id, 0 as bucket, due as order_time, rank, head from due
    union all
    select id, 1 as bucket, null::timestamptz as order_time, rank, head from fresh_limited
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
  'Очередь на «Учить»: просроченные по сроку, следом новые по рангу в пределах дневного лимита из настроек.';
