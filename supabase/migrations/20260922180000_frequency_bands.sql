-- «Покрытие обычного текста» считалось из colonки corpus_share, а словарь
-- приехал из Anki, где частотных долей нет вовсе: колонка везде ноль,
-- и плитка честно показывала 0.0%. Считать долю неоткуда.
--
-- Вместо оценки, которую не из чего вывести, сводка отдаёт то, что
-- измеримо: сколько слов выучено в каждой части частотного списка.
-- «Знаю 312 из первых пятисот» отвечает на тот же вопрос — далеко ли
-- я продвинулся, — но это факт, а не прикидка.

create or replace function public.progress_summary()
returns jsonb
language sql
stable
as $$
  with mine as (
    select w.rank, w.pos, w.genus, public.word_status(c) as status
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
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
      count(*) filter (where status = 'learning') as learning
    from mine
    group by 1
  )
  select jsonb_build_object(
    'total',    (select count(*) from mine),
    'new',      (select count(*) filter (where status = 'new') from mine),
    'learning', (select count(*) filter (where status = 'learning') from mine),
    'known',    (select count(*) filter (where status = 'known') from mine),
    'nounsWithGenus', (select count(*) filter (where pos = 'noun' and genus is not null) from mine),
    'bands', coalesce((
      select jsonb_object_agg(band, jsonb_build_object('total', total, 'known', known, 'learning', learning))
      from bands
    ), '{}'::jsonb)
  );
$$;

comment on function public.progress_summary is
  'Состав колоды и продвижение по частям частотного списка для текущего пользователя.';
