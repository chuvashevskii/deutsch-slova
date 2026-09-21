-- Точность и разбор ошибок считались по всему журналу, где поле
-- «ответ верен» было обязательным. Теперь ввод форм — настройка, и при
-- выключенном вводе правильность не проверялась вовсе: поле пустое.
--
-- Пустые ответы из этих двух чисел исключаются целиком. Смешивать
-- проверенное с самооценкой нельзя: себе человек ставит зачёт заметно
-- охотнее, чем машина, и общая цифра перестала бы значить хоть что-то.
--
-- Сводка вдобавок отдаёт, по скольким ответам посчитана точность и какие
-- части речи в неё попали: «точность 87%» без этого означает не то,
-- что кажется, если печатались только существительные.

create or replace function public.stats_summary(p_tz text default 'UTC')
returns jsonb
language sql
stable
as $$
  with mine as (
    select * from public.reviews where user_id = auth.uid()
  ),
  checked as (
    select * from mine where answered_correctly is not null
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
      from checked
    ),
    'checkedReviews', (select count(*) from checked),
    'checkedPos', coalesce((
      select jsonb_agg(distinct w.pos)
      from checked r join public.words w on w.id = r.word_id
    ), '[]'::jsonb),
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
    -- Матрица рода живёт на кнопках артикля, а не на вводе форм: она
    -- продолжает наполняться, даже когда печатать ничего не надо.
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
        from checked r
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
  'Агрегаты статистики за всю историю. Точность и разбор ошибок — только по ответам, где ввод проверялся.';
