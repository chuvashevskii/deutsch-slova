-- Ранг был «not null unique» — то есть удостоверением личности слова.
-- Живая колода в это не укладывается:
--
--   * 341 слово из 1462 в частотный список 1–4500 не входит вовсе.
--     Ранга у них нет, и выдумывать число нельзя: «нет данных о частоте»
--     и «самое редкое слово» — разные утверждения;
--   * 141 карточка делит 66 рангов. Частотный список даёт один ранг на
--     словоформу, а в колоде у многозначного слова своя карточка на
--     каждое значение: finden «находить» и finden «считать».
--
-- Ранг перестаёт быть ключом и становится тем, чем он и является, —
-- местом в частотном списке, которого может не быть.

alter table public.words alter column rank drop not null;
alter table public.words drop constraint words_rank_key;
create index words_rank_idx on public.words (rank);

comment on column public.words.rank is
  'Место в частотном списке 1–4500. Пусто, если слова в списке нет. Не уникален: у многозначного слова несколько карточек на один ранг.';

-- Сортировка «order by rank» при одинаковых рангах оставляла порядок на
-- усмотрение базы, и карточки прыгали бы между запросами. Второй и третий
-- ключ делают его определённым, а «nulls last» явно отправляет слова без
-- ранга в конец, а не полагается на умолчание Postgres.

create or replace function public.learn_queue(
  p_new_limit int default 20,
  p_limit     int default 5
)
returns jsonb
language sql
stable
as $$
  with mine as (
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
    limit greatest(0, p_new_limit - (select count(*) from due))
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
  'Очередь на «Учить»: просроченные по сроку, следом новые по рангу в пределах дневного лимита.';

create or replace function public.words_page(
  p_pos    text[] default null,
  p_genus  text[] default null,
  p_status text[] default null,
  p_query  text   default '',
  p_limit  int    default 50,
  p_offset int    default 0
)
returns jsonb
language sql
stable
as $$
  with matched as (
    select w.id, w.rank, w.pos, w.head, w.translation, w.genus, w.singular, w.wortart,
           public.word_status(c) as status
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    where (p_pos is null or array_length(p_pos, 1) is null or w.pos = any (p_pos))
      -- Род — подкатегория существительного: он отсекает только их.
      and (
        p_genus is null or array_length(p_genus, 1) is null
        or w.pos <> 'noun'
        or (w.genus is not null and w.genus = any (p_genus))
      )
      and (
        p_status is null or array_length(p_status, 1) is null
        or public.word_status(c) = any (p_status)
      )
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
  'Страница списка слов: поля строки, статус для текущего пользователя и общее число найденного.';
