-- Очередь возвращала карточки не той формы, и «Учить» показывал пустой экран.
--
-- Миграция `20260922340000` добавляла очереди режим «только вне списка».
-- Я пересобрал тело функции по выводу `pg_get_functiondef`, но прочитал
-- его усечённым и хвост дописал по догадке. Вместо
--
--     jsonb_build_object('word', to_jsonb(w), 'card', to_jsonb(c))
--
-- стало `to_jsonb(w)` — плоское слово без обёртки. Экран «Учить» берёт
-- `items[0].word`, получал `undefined` и показывал «на сегодня всё»,
-- хотя очередь честно сообщала `total` тридцать. «Статистика» при этом
-- считала своё число другим запросом и показывала тридцать — два экрана
-- расходились, и это и был симптом.
--
-- Заодно терялась `card`: без неё кнопки оценки не знают текущих
-- интервалов.
--
-- Урок: проверять надо тем, чем пользуется приложение. Я тогда вытащил
-- `items->0->>'head'`, увидел «sein» и счёл это подтверждением —
-- а подтвердил лишь собственную догадку о форме.

create or replace function public.learn_queue(
  p_new_limit int default null,
  p_limit     int default 5
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
        (select learn_rankless_only from public.user_settings where user_id = auth.uid()),
        false
      ) as rankless_only
  ),
  mine as (
    select w.id, w.rank, w.head, c.due, c.reps, m.mark
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    where coalesce(m.mark, '') <> 'known'
      and (w.confirmed_at is not null or (select include_drafts from settings))
      -- INFO: отбор не трогает уже начатые карточки. Человек включил
      -- режим на время, а начатое слово, исчезнув из очереди, потеряло бы
      -- свой срок повторения — и вернулось бы позже, чем нужно.
      and (
        not (select rankless_only from settings)
        or w.rank is null
        or c.reps > 0
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

comment on function public.learn_queue is
  'Очередь на «Учить»: запрошенные вручную, просроченные по сроку, новые по рангу в пределах дневного лимита. «Знаю» исключены, черновики — пока их не включили в настройках, безранговые — по отдельному режиму. Элемент очереди: {word, card}.';
