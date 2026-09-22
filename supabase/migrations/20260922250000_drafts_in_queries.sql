-- Черновики в выборках: очередь их не выдаёт без разрешения, список
-- показывает всегда и помечает, сводка считает по тому же правилу,
-- что и очередь.

-- Очередь. Черновик не попадает в «Учить», пока человек не включил их
-- в настройках: иначе несверенный разбор пойдёт в память наравне
-- с проверенным, и отличить их потом будет нечем.
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
      ) as include_drafts
  ),
  mine as (
    select w.id, w.rank, w.head, c.due, c.reps, m.mark
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    where coalesce(m.mark, '') <> 'known'
      and (w.confirmed_at is not null or (select include_drafts from settings))
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
  'Очередь на «Учить»: запрошенные вручную, просроченные по сроку, новые по рангу в пределах дневного лимита. «Знаю» исключены, черновики — пока их не включили в настройках.';

-- Список слов. Черновики видны всегда: иначе их нечем сверять.
-- Появился отбор по сверке — подпись меняет набор аргументов,
-- поэтому старую функцию надо снять, а не заменить: иначе рядом
-- останется перегрузка, и PostgREST не выберет между ними.
drop function if exists public.words_page(text[], text[], text[], text, int, int);

create or replace function public.words_page(
  p_pos    text[] default null,
  p_genus  text[] default null,
  p_status text[] default null,
  p_query  text   default '',
  p_limit  int    default 50,
  p_offset int    default 0,
  p_draft  boolean default null
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
    where (p_pos is null or array_length(p_pos, 1) is null or w.pos = any (p_pos))
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

create or replace function public.words_facets()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'pos', coalesce((
      select jsonb_object_agg(pos, n) from (select pos, count(*) n from public.words group by pos) t
    ), '{}'::jsonb),
    'genus', coalesce((
      select jsonb_object_agg(genus, n)
      from (select genus, count(*) n from public.words where genus is not null group by genus) t
    ), '{}'::jsonb),
    'drafts', (select count(*) from public.words where confirmed_at is null)
  );
$$;
comment on function public.words_facets is
  'Сколько слов за каждым отбором: часть речи, род, черновики.';

-- Сводка считает то же, что даёт очередь: иначе «выучено 0 / 2574»
-- обещало бы карточки, которых человек не увидит. Число черновиков
-- отдаётся отдельно — оно не зависит от настройки.
create or replace function public.progress_summary()
returns jsonb
language sql
stable
as $$
  with settings as (
    select coalesce(
      (select include_drafts from public.user_settings where user_id = auth.uid()),
      false
    ) as include_drafts
  ),
  mine as (
    select w.pos, w.genus,
           case when m.mark = 'known' then 'declared' else public.word_status(c) end as status,
           (m.mark = 'requested') as requested
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
    where w.confirmed_at is not null or (select include_drafts from settings)
  )
  select jsonb_build_object(
    'total',    count(*),
    'new',      count(*) filter (where status = 'new'),
    'learning', count(*) filter (where status = 'learning'),
    'known',    count(*) filter (where status = 'known'),
    'declared', count(*) filter (where status = 'declared'),
    'requested',count(*) filter (where requested),
    'nounsWithGenus', count(*) filter (where pos = 'noun' and genus is not null),
    'drafts',   (select count(*) from public.words where confirmed_at is null)
  )
  from mine;
$$;
comment on function public.progress_summary is
  'Состав колоды для текущего пользователя. «Знаю» рукой считается отдельно от заслуженного ответами; черновики учитываются по той же настройке, что и в очереди.';
