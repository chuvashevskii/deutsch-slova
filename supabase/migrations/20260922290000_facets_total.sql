-- Общее число слов приходит от базы, а не складывается из отборов.
--
-- Клиент считал его суммой по частям речи. Пока у слова была одна часть
-- речи, сумма совпадала с размером колоды; с тех пор как двойные слова
-- считаются и в прилагательных, и в наречиях, сумма стала больше
-- колоды на 80 — и список писал «181 из 1562» при 1482 словах.
--
-- Складывать счётчики отборов, чтобы узнать целое, вообще нельзя:
-- отборы пересекаются. Целое надо спрашивать.

create or replace function public.words_facets()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.words),
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
  'Сколько слов за каждым отбором и сколько всего. Отборы пересекаются — сумма по ним размером колоды не является.';
