-- Список и сводка учитывают отметки.
--
-- «Знаю» рукой и «знаю» по ответам — разные вещи, и в одну долю их
-- сводить нельзя: одно заслужено растущими интервалами, другое объявлено
-- нажатием кнопки. Поэтому у объявленного свой статус — declared.

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
           case when m.mark = 'known' then 'declared' else public.word_status(c) end as status,
           (m.mark = 'requested') as requested,
           (c.word_id is not null) as has_progress
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
  'Страница списка слов: поля строки, статус с учётом отметок и общее число найденного.';

create or replace function public.progress_summary()
returns jsonb
language sql
stable
as $$
  with mine as (
    select w.rank, w.pos, w.genus,
           case when m.mark = 'known' then 'declared' else public.word_status(c) end as status,
           (m.mark = 'requested') as requested
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
  ),
  bands as (
    select
      case
        when rank is null then 'none'
        when rank <= 500  then '1-500'
        when rank <= 1000 then '501-1000'
        when rank <= 2000 then '1001-2000'
        else '2001-4500'
      end as band,
      count(*) as total,
      count(*) filter (where status = 'known') as known,
      count(*) filter (where status = 'learning') as learning,
      count(*) filter (where status = 'declared') as declared
    from mine
    group by 1
  )
  select jsonb_build_object(
    'total',    (select count(*) from mine),
    'new',      (select count(*) filter (where status = 'new') from mine),
    'learning', (select count(*) filter (where status = 'learning') from mine),
    'known',    (select count(*) filter (where status = 'known') from mine),
    'declared', (select count(*) filter (where status = 'declared') from mine),
    'requested',(select count(*) filter (where requested) from mine),
    'nounsWithGenus', (select count(*) filter (where pos = 'noun' and genus is not null) from mine),
    'bands', coalesce((
      select jsonb_object_agg(band, jsonb_build_object(
        'total', total, 'known', known, 'learning', learning, 'declared', declared
      ))
      from bands
    ), '{}'::jsonb)
  );
$$;

comment on function public.progress_summary is
  'Состав колоды и продвижение по частотному списку. «Знаю» рукой считается отдельно от заслуженного ответами.';

-- Счётчики фильтра: к частям речи и родам добавляются отметки, иначе
-- рядом с новым пунктом фильтра не будет цифры, а у остальных она есть.
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
    ), '{}'::jsonb)
  );
$$;
