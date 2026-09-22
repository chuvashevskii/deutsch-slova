-- Слова вне частотного списка — свой отбор.
--
-- У 305 карточек колоды нет ранга, и это не пропуск: сверка шла по всему
-- списку 4500, а этих слов там нет. Частотный список считает словоформы
-- по корпусу, колода — учебник A1/A2, и в список не попадают составные
-- существительные (Wetterbericht), женские формы профессий (Köchin),
-- обороты с sein (dabei sein) и бытовая лексика курса (Mensa).
--
-- Ранг им взять неоткуда, поэтому вместо выдуманного номера — отбор:
-- в списке слов их можно показать отдельно, а в «Учить» брать одними
-- ими. Это разные слова по природе, и учить их пачкой осмысленно.

alter table public.user_settings
  add column learn_rankless_only boolean not null default false;

comment on column public.user_settings.learn_rankless_only is
  'Брать в «Учить» только слова вне частотного списка. По умолчанию нет: очередь идёт по рангу.';

-- Отбор в списке слов. Параметр добавляется в конец, но старую функцию
-- приходится снести: иначе рядом останется прежняя семиаргументная,
-- и PostgREST не сможет выбрать между двумя перегрузками.
drop function if exists public.words_page(text[], text[], text[], text, integer, integer, boolean);

create or replace function public.words_page(
  p_pos text[] default null,
  p_genus text[] default null,
  p_status text[] default null,
  p_query text default '',
  p_limit integer default 50,
  p_offset integer default 0,
  p_draft boolean default null,
  p_ranked boolean default null
)
returns jsonb
language sql
stable
as $$
  with matched as (
    select w.id, w.rank, w.pos, w.head, w.translation, w.genus, w.singular, w.wortart,
           case when m.mark = 'known' then 'declared' else public.word_status(c) end as status,
           (m.mark = 'requested') as requested,
           (c.word_id is not null) as has_progress,
           (w.confirmed_at is null) as draft
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    where (
        p_pos is null or array_length(p_pos, 1) is null
        or public.word_category(w.pos, w.wortart) = any (p_pos)
      )
      -- Род — подкатегория существительного: он отсекает только их.
      and (
        p_genus is null or array_length(p_genus, 1) is null
        or w.pos <> 'noun'
        or (w.genus is not null and w.genus = any (p_genus))
      )
      -- «Запрошено» — не состояние знания, а пожелание, и оно может
      -- сочетаться с любым статусом. Поэтому проверяется отдельно.
      and (
        p_status is null or array_length(p_status, 1) is null
        or (case when m.mark = 'known' then 'declared' else public.word_status(c) end) = any (p_status)
        or ('requested' = any (p_status) and m.mark = 'requested')
      )
      and (p_draft is null or (w.confirmed_at is null) = p_draft)
      -- Наличие ранга, а не его значение: «вне списка» — это отсутствие
      -- данных о частоте, и отбирается оно по пустоте поля.
      and (p_ranked is null or (w.rank is not null) = p_ranked)
      -- INFO: шаблонные знаки экранируются, иначе «%» или «_» в поиске
      -- сработали бы как маска и вернули всю колоду.
      and (
        btrim(coalesce(p_query, '')) = ''
        or w.head ilike public.like_escape(p_query)
        or w.translation ilike public.like_escape(p_query)
        or w.rank::text = btrim(p_query)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'rows', coalesce(
      (
        select jsonb_agg(to_jsonb(page) order by page.rank nulls last, page.head, page.id)
        from (
          select * from matched
          order by rank nulls last, head, id
          limit p_limit offset p_offset
        ) as page
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.words_page is
  'Страница списка слов: поля строки, статус с учётом отметок, признак черновика и общее число найденного.';

-- Сколько слов вне списка — для подписи на фильтре.
create or replace function public.words_facets()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    -- Категории не пересекаются, и сумма по ним равна этому числу.
    -- Оно всё равно приходит отдельно: выводить целое из слагаемых
    -- значит зависеть от того, что ни одно из них не забыли.
    'total', (select count(*) from public.words),
    'pos', coalesce((
      select jsonb_object_agg(category, n)
      from (
        select public.word_category(pos, wortart) as category, count(*) n
        from public.words group by 1
      ) t
    ), '{}'::jsonb),
    'genus', coalesce((
      select jsonb_object_agg(genus, n)
      from (select genus, count(*) n from public.words where genus is not null group by genus) t
    ), '{}'::jsonb),
    'drafts', (select count(*) from public.words where confirmed_at is null),
    'rankless', (select count(*) from public.words where rank is null)
  );
$$;

comment on function public.words_facets is
  'Сколько слов в каждой категории, каждом роде, сколько черновиков и сколько вне частотного списка.';

-- Очередь «Учить» умеет идти одними безранговыми.
create or replace function public.learn_queue(p_new_limit integer default null, p_limit integer default 5)
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
        select jsonb_agg(to_jsonb(item) order by item.position)
        from (
          select w.*, o.position
          from ordered o
          join public.words w on w.id = o.id
          order by o.position
          limit p_limit
        ) as item
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.learn_queue is
  'Очередь повторений с учётом настроек: дневного лимита новых, черновиков и режима «только вне списка».';
