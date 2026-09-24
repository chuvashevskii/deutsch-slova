-- Очередь перестаёт прятать отмеченное «знаю».
--
-- Отметка теперь заводит зрелую карточку (миграция 20260925010000),
-- и слово должно возвращаться по сроку наравне со всеми. Исключать его
-- по отметке значило бы посеять карточку и тут же спрятать.

create or replace function public.learn_queue(
  p_new_limit integer default null,
  p_limit integer default 5
)
returns jsonb
language sql
stable
as $$
  with settings as (
    select
      coalesce(
        p_new_limit,
        (select daily_new_limit from public.user_settings where user_id = auth.uid()),
        20
      ) as new_limit,
      coalesce(
        (select include_drafts from public.user_settings where user_id = auth.uid()),
        false
      ) as include_drafts,
      coalesce(
        (select learn_sources from public.user_settings where user_id = auth.uid()),
        '{}'::text[]
      ) as sources
  ),
  mine as (
    select w.id, w.rank, w.head, c.due, c.reps, m.mark
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    -- INFO: отметка «знаю» больше не исключает слово из очереди.
    -- Она заводит зрелую карточку, и слово возвращается по сроку, как
    -- всякое другое, — просто нескоро. Прежняя строка
    -- `coalesce(m.mark, '') <> 'known'` убирала его навсегда, и знание
    -- выветривалось молча.
    where (w.confirmed_at is not null or (select include_drafts from settings))
      -- INFO: отбор не трогает уже начатые карточки. Человек включил
      -- режим на время, а начатое слово, исчезнув из очереди, потеряло бы
      -- свой срок повторения — и вернулось бы позже, чем нужно.
      --
      -- Источники складываются по «или», а не по «и»: набор «своё
      -- и отмеченное на сегодня» это два кармана, из которых берут,
      -- а не пересечение, в котором почти пусто. Пустой набор — всё.
      and (
        array_length((select sources from settings), 1) is null
        or c.reps > 0
        -- INFO: `@>` , а не `= any (select …)`: подзапрос отдаёт одну
        -- строку с массивом, и `= any` попытался бы привести 'rankless'
        -- к text[]. Отсюда «malformed array literal» — поймано при
        -- накатывании, а не на живых данных.
        or ((select sources from settings) @> array['rankless']::text[] and w.rank is null)
        or ((select sources from settings) @> array['own']::text[] and w.id like 'my-%')
        or (
          (select sources from settings) @> array['requested']::text[]
          and m.mark = 'requested'
        )
      )
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


-- Отметки, поставленные до этой перемены, снимаются: за ними не стоит
-- карточки, и по новым правилам слово вернулось бы в очередь новым,
-- но без срока проверки — то есть просто всплыло бы как незнакомое.
-- Честнее вернуть их в колоду явно.
delete from public.word_marks where mark = 'known';
