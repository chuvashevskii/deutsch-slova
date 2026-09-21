-- Экран «Учить» показывает одну карточку, а тянул весь словарь со всеми
-- карточками прогресса: очередь считалась на клиенте, и для неё нужно было
-- знать про каждое слово, наступил ли срок.
--
-- Очередь переезжает в базу. Правило то же, что было на клиенте: сначала
-- просроченные по возрастанию срока, следом новые по рангу, и новых берём
-- столько, сколько осталось от дневного лимита после просроченных.

create or replace function public.learn_queue(
  p_new_limit int default 20,
  p_limit     int default 5
)
returns jsonb
language sql
stable
as $$
  with mine as (
    select w.id, w.rank, c.due, c.reps
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
  ),
  due as (
    select id, rank, due from mine where reps > 0 and due <= now()
  ),
  fresh as (
    select id, rank from mine where reps is null or reps = 0
  ),
  -- INFO: ограничение считается отдельной выборкой. Если написать
  -- «order by … limit …» после union, оно урежет всю очередь, а не только
  -- новые слова, и просроченные начнут пропадать.
  fresh_limited as (
    select id, rank from fresh
    order by rank
    limit greatest(0, p_new_limit - (select count(*) from due))
  ),
  queue as (
    select id, 0 as bucket, due as order_time, rank from due
    union all
    select id, 1 as bucket, null::timestamptz as order_time, rank from fresh_limited
  ),
  ordered as (
    select id, row_number() over (order by bucket, order_time, rank) as position
    from queue
  )
  select jsonb_build_object(
    'total', (select count(*) from ordered),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object('word', to_jsonb(w), 'card', to_jsonb(c))
        order by o.position
      )
      from ordered o
      join public.words w on w.id = o.id
      left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
      where o.position <= p_limit
    ), '[]'::jsonb)
  );
$$;

comment on function public.learn_queue is
  'Очередь повторений: длина и первые несколько слов целиком, вместе с состоянием карточки.';
