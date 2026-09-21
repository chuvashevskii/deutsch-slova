-- Статистика считалась на клиенте по всему журналу повторений, а он растёт
-- без предела: строка на каждый ответ. При 70 ответах в день это 25 000
-- строк за год — и все они ехали на телефон ради пяти чисел.
--
-- Агрегаты переезжают в базу. Журнал остаётся единственным источником
-- правды: счётчиков, которые можно рассинхронизировать, здесь нет.

create or replace function public.stats_summary(p_tz text default 'UTC')
returns jsonb
language sql
stable
as $$
  with mine as (
    select * from public.reviews where user_id = auth.uid()
  ),
  -- Начало суток берём в поясе пользователя: иначе вечером «сегодня»
  -- в UTC уже закончится, а у человека день ещё идёт.
  day_start as (
    select (date_trunc('day', now() at time zone p_tz) at time zone p_tz) as ts
  )
  select jsonb_build_object(
    'reviewedToday', (select count(*) from mine, day_start where reviewed_at >= day_start.ts),
    'dueNow', (
      select count(*) from public.cards
      where user_id = auth.uid() and reps > 0 and due <= now()
    ),
    'accuracy', (
      select case when count(*) = 0 then null
             else round(100.0 * count(*) filter (where answered_correctly) / count(*)) end
      from mine
    ),
    'totalReviews', (select count(*) from mine),
    'forecast', coalesce((
      select jsonb_agg(n order by offset_days)
      from (
        select offset_days, count(c.word_id) as n
        from generate_series(0, 13) offset_days
        left join public.cards c
          on c.user_id = auth.uid() and c.reps > 0
         and least(greatest(floor(extract(epoch from c.due - now()) / 86400)::int, 0), 13) = offset_days
        group by offset_days
      ) t
    ), '[]'::jsonb),
    -- Тепловую карту отдаём картой «день → сколько», сетку строит клиент:
    -- начало недели и часовой пояс — его забота.
    'perDay', coalesce((
      select jsonb_object_agg(review_day::text, n)
      from (
        select (reviewed_at at time zone p_tz)::date as review_day, count(*) as n
        from mine
        where reviewed_at >= now() - interval '120 days'
        group by 1
      ) t
    ), '{}'::jsonb),
    'activeDays', (
      select count(distinct (reviewed_at at time zone p_tz)::date) from mine
    ),
    'genusMatrix', coalesce((
      select jsonb_agg(jsonb_build_object('expected', w.genus, 'answered', m.answered_genus, 'n', cnt))
      from (
        select r.word_id, r.answered_genus, count(*) as cnt
        from mine r where r.answered_genus is not null
        group by 1, 2
      ) m
      join public.words w on w.id = m.word_id and w.genus is not null
    ), '[]'::jsonb),
    'ruleErrors', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'total', total, 'wrong', wrong)
                       order by wrong::numeric / total desc, total desc)
      from (
        select w.rule_label as label, count(*) as total,
               count(*) filter (where not r.answered_correctly) as wrong
        from mine r
        join public.words w on w.id = r.word_id
        where coalesce(w.rule_label, '') <> ''
        group by w.rule_label
        having count(*) >= 2
        order by count(*) filter (where not r.answered_correctly)::numeric / count(*) desc
        limit 8
      ) t
    ), '[]'::jsonb)
  );
$$;

comment on function public.stats_summary is
  'Агрегаты статистики за всю историю: журнал повторений на клиент не выгружается.';

-- Сводке добавляется число существительных с родом: матрица путаницы
-- показывает его, пока ответов ещё нет, и ради одного числа тянуть словарь
-- не стоит. Функция переопределяется целиком — так видно её текущий вид,
-- а не разницу с предыдущей миграцией.
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
    'nounsWithGenus', count(*) filter (where w.pos = 'noun' and w.genus is not null),
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
  'Состав колоды, покрытие текста и число существительных с родом для текущего пользователя.';
