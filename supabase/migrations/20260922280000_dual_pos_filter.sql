-- Слово бывает сразу двух частей речи.
--
-- `gut`, `ganz`, `schnell` — прилагательные, которые работают
-- и наречиями; в колоде они помечены «прилагательное и наречие»,
-- но в поле `pos` у них одно значение — `adj`. Отбор сравнивал именно
-- его, и фильтр «наречия» показывал 101 слово, теряя 80 таких.
-- Для человека это выглядит как пропажа: `gut` наречие, а в наречиях
-- его нет.
--
-- Отбор теперь сравнивается не с одним значением, а с набором частей
-- речи слова. У обычного слова в наборе одна, у двойного — две.

create or replace function public.word_categories(p_pos text, p_wortart text)
returns text[]
language sql
immutable
as $$
  select case
    when p_wortart = 'прилагательное и наречие' then array['adj', 'adverb']
    else array[p_pos]
  end;
$$;

comment on function public.word_categories is
  'Части речи слова. Обычно одна, у «прилагательное и наречие» — две: такое слово принадлежит обоим отборам.';

-- Подпись меняет набор аргументов, поэтому старую функцию надо снять:
-- иначе рядом останется перегрузка и PostgREST не выберет между ними.
drop function if exists public.words_page(text[], text[], text[], text, int, int, boolean);

create or replace function public.words_page(
  p_pos    text[] default null,
  p_genus  text[] default null,
  p_status text[] default null,
  p_query  text   default '',
  p_limit  int    default 50,
  p_offset int    default 0,
  p_draft  boolean default null,
  p_dual   boolean default null
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
        or public.word_categories(w.pos, w.wortart) && p_pos
      )
      -- Род — подкатегория существительного: он отсекает только их.
      and (
        p_genus is null or array_length(p_genus, 1) is null
        or w.pos <> 'noun'
        or (w.genus is not null and w.genus = any (p_genus))
      )
      -- Двойные — подкатегория прилагательного, как род у существительного.
      and (
        p_dual is not true
        or public.word_categories(w.pos, w.wortart) @> array['adj', 'adverb']
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
  'Страница списка слов: поля строки, статус с учётом отметок, признак черновика и общее число найденного. Слово двух частей речи попадает в оба отбора.';

-- Счётчики у отборов считаются по тому же набору: иначе подпись «наречия
-- 101» противоречила бы списку, где их 181.
create or replace function public.words_facets()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'pos', coalesce((
      select jsonb_object_agg(category, n)
      from (
        select category, count(*) n
        from public.words w, unnest(public.word_categories(w.pos, w.wortart)) as category
        group by category
      ) t
    ), '{}'::jsonb),
    'genus', coalesce((
      select jsonb_object_agg(genus, n)
      from (select genus, count(*) n from public.words where genus is not null group by genus) t
    ), '{}'::jsonb),
    'dual', (
      select count(*) from public.words w
      where public.word_categories(w.pos, w.wortart) @> array['adj', 'adverb']
    ),
    'drafts', (select count(*) from public.words where confirmed_at is null)
  );
$$;
comment on function public.words_facets is
  'Сколько слов за каждым отбором: часть речи (двойные считаются в обеих), род, двойные, черновики.';
