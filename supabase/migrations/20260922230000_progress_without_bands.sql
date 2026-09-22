-- Разбивка по частям частотного списка ушла с экрана статистики, и
-- сводке больше незачем её считать: progress_summary зовут из шапки,
-- то есть на каждом экране, и лишний агрегат там платится всегда.
--
-- Раздел убран не за ненадобностью цифр, а потому что он повторял
-- соседнее число: новые слова очередь выдаёт строго по рангу, значит
-- «как далеко я по частотности» и «сколько слов выучено» — почти одно
-- и то же. Пробелы в колоде при этом факт разовый: их смотрят при
-- пополнении, а не каждый день.

create or replace function public.progress_summary()
returns jsonb
language sql
stable
as $$
  with mine as (
    select w.pos, w.genus,
           case when m.mark = 'known' then 'declared' else public.word_status(c) end as status,
           (m.mark = 'requested') as requested
    from public.words w
    left join public.cards c on c.word_id = w.id and c.user_id = auth.uid()
    left join public.word_marks m on m.word_id = w.id and m.user_id = auth.uid()
  )
  select jsonb_build_object(
    'total',    count(*),
    'new',      count(*) filter (where status = 'new'),
    'learning', count(*) filter (where status = 'learning'),
    'known',    count(*) filter (where status = 'known'),
    'declared', count(*) filter (where status = 'declared'),
    'requested',count(*) filter (where requested),
    'nounsWithGenus', count(*) filter (where pos = 'noun' and genus is not null)
  )
  from mine;
$$;

comment on function public.progress_summary is
  'Состав колоды для текущего пользователя. «Знаю» рукой считается отдельно от заслуженного ответами.';
