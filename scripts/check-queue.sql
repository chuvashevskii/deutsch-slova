-- Проверка очереди «Учить» на живой базе, сценарием.
--
-- Очередь живёт в SQL, и обычные тесты до неё не достают: они проверяют
-- разбор и отбор на клиенте. Между тем эта функция уже ломалась молча —
-- отдавала плоское слово вместо {word, card}, и экран показывал «на
-- сегодня всё» при тридцати словах (см. заголовок check-contract.mjs).
--
-- Сценарий строит свой мирок внутри транзакции и откатывает его целиком:
-- пользователь, четыре карточки, отметки. В колоде после прогона
-- не остаётся ничего.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
--        -f scripts/check-queue.sql
--
-- Каждая строка вывода — «ждали / получили / ок?». Все «ок?» должны
-- быть t.

begin;

-- ── мирок ───────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'queue-probe@local', '', now(), now());

-- Колода прогона — только эти четыре слова: всё прочее скрыто отметкой
-- «знаю», иначе очередь потонула бы в двух с половиной тысячах.
insert into public.word_marks (user_id, word_id, mark)
select '00000000-0000-0000-0000-0000000000cc', id, 'known' from public.words;

insert into public.words (id, head, translation, pos, rank, confirmed_at)
values
  ('zzz-ranked',   'zzzranked',   'Слово с рангом',      'noun', 1,    now()),
  ('zzz-rankless', 'zzzrankless', 'Слово без ранга',     'noun', null, now()),
  ('my-zzz1',      'zzzmine',     'Заведено руками',     'noun', null, now()),
  ('zzz-wanted',   'zzzwanted',   'Отмечено на сегодня', 'noun', 2,    now());

insert into public.word_marks (user_id, word_id, mark)
values ('00000000-0000-0000-0000-0000000000cc', 'zzz-wanted', 'requested');

-- Строку настроек заводит триггер на auth.users, поэтому не insert.
insert into public.user_settings (user_id, learn_sources)
values ('00000000-0000-0000-0000-0000000000cc', '{}')
on conflict (user_id) do update set learn_sources = excluded.learn_sources;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated"}';
set local role authenticated;

-- ── что ждём ────────────────────────────────────────────────────────────
create temporary table expected (step int, sources text[], want text) on commit drop;
insert into expected values
  (1, '{}',                        'my-zzz1, zzz-ranked, zzz-rankless, zzz-wanted'),
  (2, '{rankless}',                'my-zzz1, zzz-rankless'),
  (3, '{own}',                     'my-zzz1'),
  (4, '{requested}',               'zzz-wanted'),
  (5, '{own,requested}',           'my-zzz1, zzz-wanted'),
  (6, '{rankless,own,requested}',  'my-zzz1, zzz-rankless, zzz-wanted');

-- ── прогон ──────────────────────────────────────────────────────────────
create or replace function pg_temp.run(p_sources text[]) returns text
language plpgsql as $$
declare got text;
begin
  update public.user_settings set learn_sources = p_sources
   where user_id = '00000000-0000-0000-0000-0000000000cc';
  select coalesce(string_agg(x.id, ', ' order by x.id), '—') into got
    from jsonb_array_elements(public.learn_queue(p_limit => 50)->'items') e
    cross join lateral (select e->'word'->>'id' as id) x;
  return got;
end $$;

select e.step,
       array_to_string(e.sources, '+') as "источники",
       e.want                          as "ждали",
       pg_temp.run(e.sources)          as "получили",
       pg_temp.run(e.sources) = e.want as "ок?"
  from expected e order by e.step;

-- ── начатую карточку отбор не выкидывает ────────────────────────────────
-- Ради этого в функции и стоит `or c.reps > 0`: человек включил режим
-- на время, а у начатого слова уже идёт срок повторения.
insert into public.cards (user_id, word_id, due, reps, state, stability, difficulty, lapses)
values ('00000000-0000-0000-0000-0000000000cc', 'zzz-ranked', now() - interval '1 day', 3, 2, 5, 5, 0);

select 'начатая ранговая при source=own' as "случай",
       'my-zzz1, zzz-ranked'             as "ждали",
       pg_temp.run('{own}')              as "получили",
       pg_temp.run('{own}') = 'my-zzz1, zzz-ranked' as "ок?";

rollback;
