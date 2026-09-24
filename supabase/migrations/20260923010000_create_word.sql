-- Карточка, заведённая руками.
--
-- Словарь заливается скриптом, и политики на вставку у `words` нет
-- вовсе — это намеренно: правка словаря через клиент была бы дырой.
-- Но слово, встреченное в жизни, заводить где-то надо, и бэклог для
-- этого мал: он хранит только слово с переводом, а карточке нужны
-- формы и примеры.
--
-- Поэтому вставка идёт функцией: она одна знает, что можно, проверяет
-- обязательное на стороне сервера (клиенту нельзя верить даже своему)
-- и пишет строку в журнал — чтобы карточка была видна на «Правках»
-- и откатывалась, как разделения.

alter table public.words
  add column if not exists created_by uuid references auth.users (id) on delete set null;

comment on column public.words.created_by is
  'Кто завёл карточку руками. NULL — карточка из колоды Anki или из разбора частотного списка.';

-- Причина «создание» рядом с «разделением»: обе рождают карточку,
-- но разными путями, и различать их в журнале нужно.
alter table public.word_edits drop constraint if exists word_edits_reason_check;
alter table public.word_edits add constraint word_edits_reason_check
  check (reason in ('формат', 'уровень 1', 'уровень 2', 'уровень 3',
                    'разделение', 'создание', 'ранг', 'прочее'));

/**
 * Заводит карточку и возвращает её идентификатор.
 *
 * Идентификатор говорит о происхождении, как и у остальных: число —
 * заметка Anki, `list-0042` — разбор частотного списка, `my-0007` —
 * заведено руками. По нему видно, откуда карточка, без лишней колонки.
 */
create or replace function public.create_word(p_word jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id text;
  -- INFO: имена с префиксом, а не head/pos: переменная с именем колонки
  -- затеняет её внутри запроса, и `where lower(w.head) = lower(head)`
  -- падает с «column reference is ambiguous».
  v_head text := btrim(coalesce(p_word->>'head', ''));
  v_translation text := btrim(coalesce(p_word->>'translation', ''));
  v_pos text := coalesce(p_word->>'pos', '');
  v_wortart text := nullif(btrim(coalesce(p_word->>'wortart', '')), '');
  v_register text := nullif(btrim(coalesce(p_word->>'register', '')), '');
begin
  if not public.is_admin() then
    raise exception 'Заводить карточки может только администратор';
  end if;

  -- Обязательное проверяется здесь, а не только в форме: форма
  -- подсказывает, а отвечает за словарь база.
  if v_head = '' then raise exception 'У карточки нет заголовка'; end if;
  if v_translation = '' then raise exception 'У карточки нет перевода'; end if;
  if v_pos not in ('noun', 'verb', 'adj', 'adverb', 'pronoun', 'preposition',
                   'conjunction', 'numeral', 'particle') then
    raise exception 'Часть речи «%» не из списка', v_pos;
  end if;
  if v_register is not null and v_register !~ '^[a-zäöüß]+ · [а-яё]+$' then
    raise exception 'Помета «%» написана не по формату', v_register;
  end if;
  if exists (select 1 from public.words w
             where lower(w.head) = lower(v_head)
               and coalesce(w.wortart, w.pos) = coalesce(v_wortart, v_pos)) then
    raise exception 'Карточка «%» с такой частью речи уже есть', v_head;
  end if;

  -- INFO: номер берётся от наибольшего существующего, а не счётчиком:
  -- карточку могут удалить откатом, и счётчик разошёлся бы с колодой.
  select 'my-' || lpad((coalesce(max(substring(id from 4)::int), 0) + 1)::text, 4, '0')
    into new_id
    from public.words where id ~ '^my-[0-9]+$';

  -- INFO: часть колонок объявлена not null с пустым умолчанием —
  -- пустая строка и пустой массив там канонический «ничего», а null
  -- роняет вставку. Поэтому не nullif, а coalesce к пустому.
  insert into public.words (
    id, head, translation, pos, wortart, genus, singular, plural,
    komparativ, superlativ, rektion, forms, form_labels,
    examples_de, examples_ru, register, definition,
    rule_status, confirmed_at, created_by
  ) values (
    new_id, v_head, v_translation, v_pos, v_wortart,
    nullif(btrim(coalesce(p_word->>'genus', '')), ''),
    nullif(btrim(coalesce(p_word->>'singular', '')), ''),
    nullif(btrim(coalesce(p_word->>'plural', '')), ''),
    nullif(btrim(coalesce(p_word->>'komparativ', '')), ''),
    nullif(btrim(coalesce(p_word->>'superlativ', '')), ''),
    coalesce(array(select jsonb_array_elements_text(p_word->'rektion')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_word->'forms')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_word->'form_labels')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_word->'examples_de')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_word->'examples_ru')), '{}'),
    v_register,
    btrim(coalesce(p_word->>'definition', '')),
    coalesce(nullif(btrim(coalesce(p_word->>'rule_status', '')), ''), 'none'),
    null, uid
  );

  -- «Было» пусто: до этой строки карточки не существовало. Тем же
  -- признаком откат узнаёт рождение и удаляет созданное.
  insert into public.word_edits (word_id, field, old_value, new_value, reason, batch, disputed, note)
  values (new_id, 'head', null, v_head, 'создание', 'Своя карточка', false,
          nullif(btrim(coalesce(p_word->>'note', '')), ''));

  return new_id;
end;
$$;

comment on function public.create_word is
  'Заводит карточку руками. Только администратору; карточка рождается черновиком и в «Учить» не попадает.';

revoke execute on function public.create_word(jsonb) from public;
revoke execute on function public.create_word(jsonb) from anon;
grant execute on function public.create_word(jsonb) to authenticated;

/**
 * Соседи по переводу — те карточки, с которыми новая столкнётся.
 *
 * Самая дорогая ошибка при заведении руками: написать перевод, который
 * уже стоит у другого слова. Человек потом видит на экране «Уверенность»
 * и не знает, какое из двух слов от него хотят. Форма спрашивает об этом
 * до сохранения, а не проверка после заливки.
 */
create or replace function public.translation_neighbours(p_translation text, p_label text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with variants as (
    select btrim(lower(replace(v, 'ё', 'е'))) as v
    from unnest(string_to_array(p_translation, '/')) as v
  )
  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'id', w.id, 'head', w.head, 'translation', w.translation,
           'register', w.register, 'definition', w.definition
         )), '[]'::jsonb)
  from public.words w
  cross join lateral unnest(string_to_array(w.translation, '/')) as own(v)
  where coalesce(w.wortart, w.pos) = p_label
    and btrim(lower(replace(own.v, 'ё', 'е'))) in (select v from variants where v <> '');
$$;

comment on function public.translation_neighbours is
  'Карточки той же части речи, у которых уже есть такой вариант перевода.';

revoke execute on function public.translation_neighbours(text, text) from public;
revoke execute on function public.translation_neighbours(text, text) from anon;
grant execute on function public.translation_neighbours(text, text) to authenticated;
