-- Проверка отметки «знаю» на живой базе, сценарием.
--
-- Суть перемены: отметка не прячет слово навсегда, а сеет зрелую
-- карточку. Проверить это значит проверить время, а времени в тесте
-- нет — поэтому срок проверки сдвигается назад, и «через три месяца»
-- наступает внутри транзакции.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
--        -f scripts/check-known.sql
--
-- Все «ок?» должны быть t.

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'known-probe@local', '', now(), now());

insert into public.words (id, head, translation, pos, rank, confirmed_at)
values ('zzz-k1', 'zzzkenne', 'Знакомое слово', 'noun', 1, now()),
       ('zzz-k2', 'zzzneu',   'Незнакомое слово', 'noun', 2, now());

insert into public.user_settings (user_id, known_interval_days)
values ('00000000-0000-0000-0000-0000000000ee', 90)
on conflict (user_id) do update set known_interval_days = excluded.known_interval_days;

create temporary table result (n serial, case_ text, want text, got text) on commit drop;
grant insert, select on result to authenticated;
grant usage, select on sequence result_n_seq to authenticated;

create or replace function pg_temp.check(p_case text, p_want text, p_sql text) returns void
language plpgsql as $$
declare got text;
begin
  begin
    execute p_sql into got;
    got := coalesce(got, '(null)');
  exception when others then
    got := 'ОТКАЗ: ' || sqlerrm;
  end;
  insert into result (case_, want, got) values (p_case, p_want, got);
end $$;

/*
 * Что из прогонных слов сейчас в очереди.
 *
 * INFO: отбираем только `zzz-`, а не всю очередь. Первая версия прятала
 * остальную колоду массовой отметкой «знаю» — и перестала прятать ровно
 * потому, что проверяемая перемена заработала: отметка больше не
 * исключает слово. Прятать теперь нечем, и незачем: присутствие или
 * отсутствие своих двух слов видно и так.
 */
create or replace function pg_temp.queue() returns text
language sql as $$
  select coalesce(string_agg(x.id, ', ' order by x.id), '—')
    from jsonb_array_elements(public.learn_queue(p_limit => 3000)->'items') e
    cross join lateral (select e->'word'->>'id' as id) x
   where x.id like 'zzz-%';
$$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ee","role":"authenticated"}';
set local role authenticated;

select pg_temp.check('до отметки оба в очереди', 'zzz-k1, zzz-k2', $$select pg_temp.queue()$$);

-- ── отметили знакомым ───────────────────────────────────────────────────

select pg_temp.check('отметка называет день возврата', '90',
  $$select round(extract(epoch from (public.mark_known('zzz-k1') - now())) / 86400)::text$$);

select pg_temp.check('карточка посеяна зрелой', '2 | 90 | 90 | 1',
  $$select state || ' | ' || scheduled_days || ' | ' || round(stability) || ' | ' || reps
      from public.cards where word_id = 'zzz-k1'$$);

select pg_temp.check('в списке — «знаю сам», а не «знаю»', 'declared',
  $$select (public.words_page(p_query => 'zzzkenne')->'rows'->0->>'status')$$);

select pg_temp.check('из очереди ушло', 'zzz-k2', $$select pg_temp.queue()$$);

-- ── прошло три месяца ───────────────────────────────────────────────────
-- Сдвигаем срок назад: так «через 90 дней» наступает здесь и сейчас.

reset role;
update public.cards set due = now() - interval '1 day' where word_id = 'zzz-k1';
set local role authenticated;

select pg_temp.check('вернулось на проверку', 'zzz-k1, zzz-k2', $$select pg_temp.queue()$$);

-- ── ответили ────────────────────────────────────────────────────────────

reset role;
insert into public.reviews (user_id, word_id, rating, state, stability, difficulty,
                            elapsed_days, scheduled_days, duration_ms, reviewed_at)
values ('00000000-0000-0000-0000-0000000000ee', 'zzz-k1', 3, 2, 227, 5, 90, 227, 1000, now());
set local role authenticated;

select pg_temp.check('настоящий ответ снимает объявление', '0',
  $$select count(*)::text from public.word_marks
     where word_id = 'zzz-k1' and mark = 'known'$$);

-- ── снятие отметки ──────────────────────────────────────────────────────

select pg_temp.check('отметили второе', '90',
  $$select round(extract(epoch from (public.mark_known('zzz-k2') - now())) / 86400)::text$$);

select pg_temp.check('посеянная карточка есть', '1',
  $$select count(*)::text from public.cards where word_id = 'zzz-k2'$$);

-- `void::text` — пустая строка, а не null: отсюда и ожидание.
select pg_temp.check('снятие отработало без отказа', '',
  $$select public.unmark_known('zzz-k2')::text$$);

select pg_temp.check('карточки не осталось', '0',
  $$select count(*)::text from public.cards where word_id = 'zzz-k2'$$);

-- Заработанную карточку снятие отметки трогать не должно: те ответы
-- были настоящими.
select pg_temp.check('заработанную карточку снятие не трогает', '1',
  $$select count(*)::text from public.cards where word_id = 'zzz-k1'$$);

-- ── заслуженный интервал не понижается ──────────────────────────────────

reset role;
update public.cards set scheduled_days = 300, stability = 300,
       due = now() + interval '300 days' where word_id = 'zzz-k1';
set local role authenticated;

select pg_temp.check('отметка не откатывает 300 дней до 90', '300',
  $$select scheduled_days::text from public.cards
     where word_id = (select 'zzz-k1' from public.mark_known('zzz-k1'))$$);

-- ── итог ────────────────────────────────────────────────────────────────

select case_ as "случай", want as "ждали", got as "получили", got = want as "ок?"
  from result order by n;

select count(*) filter (where got <> want) || ' из ' || count(*) || ' не сошлось' as "итог"
  from result;

rollback;
