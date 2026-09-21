-- Список слов отдавала одна выборка на всю колоду: клиент забирал каждое
-- слово со всеми полями, а строке списка нужно восемь. На двух тысячах слов
-- это 2,2 МБ за сеанс против 0,4 МБ, и пять шестых уходило впустую.
--
-- Отбор, сортировка и страница переезжают в базу. Функции идут с правами
-- вызывающего (умолчание в Postgres), поэтому политики RLS продолжают
-- действовать: чужие карточки прогресса не видны и отсюда.

-- Статус слова для текущего пользователя. Повторяет knowledgeStatus
-- на клиенте: карточки нет или она новая — «new», интервал меньше
-- порога зрелости — «learning», иначе «known».
create or replace function public.word_status(card public.cards)
returns text
language sql
immutable
as $$
  select case
    when card.word_id is null or card.state = 0 then 'new'
    when card.scheduled_days >= 21 then 'known'
    else 'learning'
  end;
$$;

comment on function public.word_status is
  'Статус слова для владельца карточки: new, learning или known.';

-- Строка поиска как безопасный шаблон ILIKE: собственные шаблонные знаки
-- пользователя экранируются, иначе «%» вернул бы всю колоду.
create or replace function public.like_escape(p_query text)
returns text
language sql
immutable
as $$
  select '%' || replace(replace(replace(btrim(p_query), '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%';
$$;

comment on function public.like_escape is
  'Строка поиска как шаблон ILIKE с экранированными % и _.';

-- Страница списка: только те поля, что видно в строке, плюс общее число
-- найденного, чтобы клиент знал, сколько всего страниц.
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
        select jsonb_agg(to_jsonb(page) order by page.rank)
        from (
          select * from matched order by rank limit p_limit offset p_offset
        ) as page
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.words_page is
  'Страница списка слов: поля строки, статус для текущего пользователя и общее число найденного.';

-- Счётчики для фильтра: сколько слов каждой части речи и каждого рода.
-- Считаются по всей колоде, а не по текущему отбору, чтобы цифра рядом
-- с пунктом не прыгала от того, что уже выбрано.
create or replace function public.words_facets()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'pos', coalesce((
      select jsonb_object_agg(pos, n)
      from (select pos, count(*) n from public.words group by pos) t
    ), '{}'::jsonb),
    'genus', coalesce((
      select jsonb_object_agg(genus, n)
      from (select genus, count(*) n from public.words where genus is not null group by genus) t
    ), '{}'::jsonb)
  );
$$;

comment on function public.words_facets is
  'Сколько слов каждой части речи и каждого рода — для подписей в фильтре.';

-- Сводка прогресса: два числа в шапке и состав колоды на статистике.
-- Раньше ради них шапка тянула весь словарь вместе с карточками — а она
-- висит на каждом экране, так что словарь грузился всегда.
create or replace function public.progress_summary()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total',    count(*),
    'new',      count(*) filter (where public.word_status(c) = 'new'),
    'learning', count(*) filter (where public.word_status(c) = 'learning'),
    'known',    count(*) filter (where public.word_status(c) = 'known'),
    'coverage', coalesce(sum(
      case public.word_status(c)
        when 'known' then w.corpus_share
        when 'learning' then w.corpus_share * 0.5
        else 0
      end
    ), 0)
  )
  from public.words w
  left join public.cards c on c.word_id = w.id and c.user_id = auth.uid();
$$;

comment on function public.progress_summary is
  'Состав колоды и покрытие текста для текущего пользователя, одним числом на статус.';
