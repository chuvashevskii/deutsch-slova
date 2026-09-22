-- «Прилагательное и наречие» — своя категория, а не членство в двух.
--
-- Предыдущий заход считал такое слово принадлежащим обоим отборам:
-- `gut` попадал и в прилагательные, и в наречия. Формально верно,
-- но отборы стали пересекаться, счётчики перестали складываться
-- в размер колоды, а главное — разошлись с тем, что человек видит
-- в строке. В строке написано «прил. · нареч.», и отбор с таким же
-- именем должен давать ровно эти слова.
--
-- Теперь категории не пересекаются: у слова ровно одна. Чтобы получить
-- «все прилагательные вообще», отмечаются два пункта — зато каждый
-- пункт даёт ровно то, что обещает.

drop function if exists public.words_page(text[], text[], text[], text, int, int, boolean, boolean);
drop function if exists public.word_categories(text, text);

create or replace function public.word_category(p_pos text, p_wortart text)
returns text
language sql
immutable
as $$
  select case when p_wortart = 'прилагательное и наречие' then 'adj_adverb' else p_pos end;
$$;

comment on function public.word_category is
  'Категория слова для отбора. Совпадает с частью речи, кроме «прилагательное и наречие» — у него своя, как и в подписи строки.';

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
    'drafts', (select count(*) from public.words where confirmed_at is null)
  );
$$;
comment on function public.words_facets is
  'Сколько слов в каждой категории, каждом роде и сколько черновиков. Категории не пересекаются.';
