-- Проверка правки и удаления карточки на живой базе, сценарием.
--
-- Обе функции пишут в словарь, и обе обязаны отказывать чаще, чем
-- соглашаться: править можно четыре поля, удалять — только своё
-- и только пока по нему никто не учится. Проверять такое на клиенте
-- бессмысленно: отказ даёт база.
--
-- Сценарий строит свой мирок внутри транзакции и откатывает его целиком.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
--        -f scripts/check-word-edit.sql
--
-- Все «ок?» должны быть t.
--
-- INFO: каждая попытка выполняется **один раз** и кладётся в таблицу,
-- а сравнение идёт уже с записанным. Первая версия звала функцию дважды
-- — в колонке «получили» и в колонке «ок?», — и проверки сходились
-- по второму вызову, а подписи описывали первый. Удаление при этом
-- «проходило», потому что второй вызов честно отвечал «карточки нет».

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'edit-probe@local', '', now(), now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000dd');

insert into public.words (id, head, translation, pos, register, definition,
                          examples_de, examples_ru, confirmed_at)
values
  ('my-9001', 'zzzeins', 'Пробный перевод', 'noun', 'neutral · нейтральный', 'старая подсказка',
   array['Alt eins.', 'Alt zwei.'], array['Старый один.', 'Старый два.'], null),
  ('my-9002', 'zzzzwei', 'Другой перевод', 'noun', 'neutral · нейтральный', '',
   array['Alt.'], array['Старый.'], null),
  ('9999999', 'zzzanki', 'Из колоды Anki', 'noun', 'neutral · нейтральный', '',
   array['Alt.'], array['Старый.'], now());

create temporary table result (n serial, case_ text, want text, got text) on commit drop;
-- Роль authenticated к временной таблице прав не имеет, а проверки идут
-- именно под ней. Выдаём — таблица живёт до конца транзакции.
grant insert, select on result to authenticated;
grant usage, select on sequence result_n_seq to authenticated;

/* Одна попытка: результат или текст отказа — и сразу в таблицу. */
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

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000dd","role":"authenticated"}';
set local role authenticated;

-- ── правка ──────────────────────────────────────────────────────────────

select pg_temp.check('меняет четыре поля', '4', $$select public.update_word('my-9001', '{
  "translation":"Новый перевод","register":"umgangssprachlich · разговорный",
  "definition":"новая подсказка","examples_de":["Neu eins.","Neu zwei."]}'::jsonb)::text$$);

select pg_temp.check('записалось в карточку',
  'Новый перевод | разговорный | новая подсказка | Neu eins. | Neu zwei.',
  $$select translation || ' | ' || split_part(register, ' · ', 2) || ' | ' || definition
      || ' | ' || array_to_string(examples_de, ' | ')
      from public.words where id = 'my-9001'$$);

select pg_temp.check('строк журнала на каждое поле',
  'definition, examples_de, register, translation',
  $$select string_agg(field, ', ' order by field) from public.word_edits
     where word_id = 'my-9001' and reason = 'правка'$$);

select pg_temp.check('журнал помнит прежнее', 'Пробный перевод',
  $$select old_value from public.word_edits
     where word_id = 'my-9001' and field = 'translation'$$);

select pg_temp.check('повтор той же правки ничего не пишет', '0',
  $$select public.update_word('my-9001', '{"translation":"Новый перевод"}'::jsonb)::text$$);

select pg_temp.check('поле не из списка не пишется', '0',
  $$select public.update_word('my-9001', '{"head":"подмена"}'::jsonb)::text$$);
select pg_temp.check('и слово осталось прежним', 'zzzeins',
  $$select head from public.words where id = 'my-9001'$$);

select pg_temp.check('пустой перевод — отказ', 'ОТКАЗ: Перевод пустым не бывает',
  $$select public.update_word('my-9001', '{"translation":"  "}'::jsonb)::text$$);

select pg_temp.check('помета не по формату — отказ',
  'ОТКАЗ: Помета «разговорное» написана не по формату',
  $$select public.update_word('my-9001', '{"register":"разговорное"}'::jsonb)::text$$);

-- Карточку из Anki править можно: правка видна в журнале и откатывается,
-- а значит с источником не расходится молча.
select pg_temp.check('карточка из Anki правится', '1',
  $$select public.update_word('9999999', '{"definition":"подсказка к анки"}'::jsonb)::text$$);

-- ── соседи по переводу ──────────────────────────────────────────────────

select pg_temp.check('сама себя соседкой не считает', '0',
  $$select jsonb_array_length(
      public.translation_neighbours('Другой перевод', 'noun', 'my-9002'))::text$$);

select pg_temp.check('без исключения — находит', '1',
  $$select jsonb_array_length(
      public.translation_neighbours('Другой перевод', 'noun'))::text$$);

-- ── удаление ────────────────────────────────────────────────────────────

select pg_temp.check('карточку из Anki удалить нельзя',
  'ОТКАЗ: Карточка «zzzanki» не заведена руками — её источник Anki или частотный список',
  $$select public.delete_word('9999999')$$);

reset role;
insert into public.cards (user_id, word_id, due, reps, state, stability, difficulty, lapses)
values ('00000000-0000-0000-0000-0000000000dd', 'my-9002', now(), 1, 1, 1, 5, 0);
set local role authenticated;

select pg_temp.check('по которой учатся — нельзя',
  'ОТКАЗ: По карточке «zzzzwei» уже идёт обучение — удаление стёрло бы прогресс',
  $$select public.delete_word('my-9002')$$);

select pg_temp.check('свою нетронутую — можно', 'zzzeins',
  $$select public.delete_word('my-9001')$$);

select pg_temp.check('журнальные строки ушли вместе с ней', '0',
  $$select count(*)::text from public.word_edits where word_id = 'my-9001'$$);

-- ── права ───────────────────────────────────────────────────────────────
-- INFO: выходим из роли authenticated, иначе строка из `admins`
-- не удаляется — политики не дают, — и «не админ» остаётся админом.
-- Первая версия сценария на это и попалась: обе проверки прав
-- «проходили», ничего не проверяя.

reset role;
delete from public.admins where user_id = '00000000-0000-0000-0000-0000000000dd';
set local role authenticated;

select pg_temp.check('не админу править нельзя',
  'ОТКАЗ: Править словарь может только администратор',
  $$select public.update_word('my-9002', '{"definition":"нельзя"}'::jsonb)::text$$);

select pg_temp.check('не админу удалять нельзя',
  'ОТКАЗ: Удалять карточки может только администратор',
  $$select public.delete_word('my-9002')$$);

-- ── итог ────────────────────────────────────────────────────────────────

select case_ as "случай", want as "ждали", got as "получили", got = want as "ок?"
  from result order by n;

select count(*) filter (where got <> want) || ' из ' || count(*) || ' не сошлось'
  as "итог" from result;

rollback;
