-- Отделяемая приставка у карточки, заведённой руками.
--
-- Приставка не выводится из букв: `umfahren` бывает и отделяемым
-- («объехать»), и неотделяемым («сбить»), и `wiederholen` тоже. Поэтому
-- её объявляет человек галочкой, а не угадывает форма.
--
-- Колонка nullable: «ничего» это NULL, как у лиц. Пустая строка
-- означала бы «приставка есть, но пустая», и оборот карточки искал бы
-- её в начале слова.

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
    form_ich, form_du, form_er, form_wir, form_ihr, separable_prefix,
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
    -- INFO: у `form_*` «ничего» это NULL, а не пустая строка: колонки
    -- nullable без умолчания, и в колоде пустых строк там ноль. Второй
    -- способ сказать «ничего» ломает и проверку, и оборот карточки.
    nullif(btrim(coalesce(p_word->>'form_ich', '')), ''),
    nullif(btrim(coalesce(p_word->>'form_du', '')), ''),
    nullif(btrim(coalesce(p_word->>'form_er', '')), ''),
    nullif(btrim(coalesce(p_word->>'form_wir', '')), ''),
    nullif(btrim(coalesce(p_word->>'form_ihr', '')), ''),
    nullif(btrim(coalesce(p_word->>'separable_prefix', '')), ''),
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
  'Заводит карточку руками. Только администратору; карточка рождается черновиком и в «Учить» не попадает. Спряжение и отделяемая приставка необязательны.';

revoke execute on function public.create_word(jsonb) from public;
revoke execute on function public.create_word(jsonb) from anon;
grant execute on function public.create_word(jsonb) to authenticated;
