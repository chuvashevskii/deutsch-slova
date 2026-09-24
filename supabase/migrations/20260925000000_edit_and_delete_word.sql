-- Правка и удаление карточки из приложения.
--
-- До сих пор словарь правился только файлами: партия в `data/edits/`,
-- прогон `apply-edits.mjs`. Для разбора двух с половиной тысяч карточек
-- это верно — правки видны в диффе, повторяемы и откатываются, — но
-- заметив опечатку в переводе, человек не должен идти в редактор
-- и запускать скрипт.
--
-- Поэтому правка из приложения пишет **в тот же журнал**: строка на
-- каждое изменённое поле, с тем же «было» и «стало», и откатывается
-- той же кнопкой на «Правках». Иначе появился бы второй способ менять
-- словарь — молча и мимо истории.
--
-- Полей ровно четыре: перевод, помета, подсказка, примеры. Всё
-- остальное — род, формы, управление, ранг — либо приезжает из Anki,
-- либо выводится правилом, и править это руками значит разойтись
-- с источником.

-- Новая причина рядом с прежними: правка с экрана отличается от партии
-- разбора тем, что за ней не стоит правило, и в отборе «спорные» ей
-- не место.
alter table public.word_edits drop constraint if exists word_edits_reason_check;
alter table public.word_edits add constraint word_edits_reason_check
  check (reason in ('формат', 'уровень 1', 'уровень 2', 'уровень 3',
                    'разделение', 'создание', 'правка', 'ранг', 'прочее'));

-- Соседи по переводу: та же функция, но умеет исключить саму карточку.
-- Без этого правка, не трогающая перевод, показала бы карточке её же
-- как столкновение.
drop function if exists public.translation_neighbours(text, text);

create or replace function public.translation_neighbours(
  p_translation text,
  p_label text,
  p_exclude text default null
)
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
    and (p_exclude is null or w.id <> p_exclude)
    and btrim(lower(replace(own.v, 'ё', 'е'))) in (select v from variants where v <> '');
$$;

/**
 * Правит четыре поля карточки и пишет каждое изменение в журнал.
 *
 * Возвращает число записанных строк: ноль значит «ничего не изменилось»,
 * и экран об этом честно скажет, а не нарисует успех.
 */
create or replace function public.update_word(p_id text, p_patch jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.words;
  -- Только эти. Список здесь, а не в вызывающем коде: функция —
  -- последняя преграда, и она не должна верить тому, что ей прислали.
  editable text[] := array['translation', 'register', 'definition', 'examples_de', 'examples_ru'];
  field text;
  was text;
  became text;
  written integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Править словарь может только администратор';
  end if;

  select * into w from public.words where id = p_id;
  if not found then
    raise exception 'Карточки % нет', p_id;
  end if;

  -- Проверки те же, что у заведения: форма подсказывает, а отвечает
  -- за словарь база.
  if p_patch ? 'translation' and btrim(coalesce(p_patch->>'translation', '')) = '' then
    raise exception 'Перевод пустым не бывает';
  end if;
  if p_patch ? 'register' then
    if btrim(coalesce(p_patch->>'register', '')) = '' then
      raise exception 'Помета пустой не бывает';
    end if;
    if btrim(p_patch->>'register') !~ '^[a-zäöüß]+ · [а-яё]+$' then
      raise exception 'Помета «%» написана не по формату', p_patch->>'register';
    end if;
  end if;

  perform set_config('app.word_edit', 'on', true);

  foreach field in array editable loop
    if not (p_patch ? field) then
      continue;
    end if;

    -- Массивы примеров сравниваются и хранятся текстом «строка | строка»:
    -- журнал держит `old_value`/`new_value` текстом, и заводить ради
    -- двух полей вторую пару колонок значило бы раздвоить откат.
    if field in ('examples_de', 'examples_ru') then
      execute format('select array_to_string(%I, '' | '') from public.words where id = $1', field)
        into was using p_id;
      became := array_to_string(
        array(select btrim(v) from jsonb_array_elements_text(p_patch->field) as v
               where btrim(v) <> ''),
        ' | ');
    else
      execute format('select %I from public.words where id = $1', field) into was using p_id;
      became := btrim(coalesce(p_patch->>field, ''));
      if field <> 'definition' then
        became := nullif(became, '');
      end if;
    end if;

    if coalesce(was, '') = coalesce(became, '') then
      continue;
    end if;

    if field in ('examples_de', 'examples_ru') then
      execute format('update public.words set %I = $1 where id = $2', field)
        using array(select btrim(v) from jsonb_array_elements_text(p_patch->field) as v
                     where btrim(v) <> ''), p_id;
    else
      execute format('update public.words set %I = $1 where id = $2', field)
        using became, p_id;
    end if;

    insert into public.word_edits (word_id, field, old_value, new_value, reason, batch, disputed)
    values (p_id, field, was, became, 'правка', 'Экран карточки', false);
    written := written + 1;
  end loop;

  perform set_config('app.word_edit', 'off', true);
  return written;
end;
$$;

comment on function public.update_word is
  'Правит перевод, помету, подсказку и примеры. Каждое изменение — строка журнала, откатывается как обычная правка. Только администратору.';

/**
 * Удаляет карточку, заведённую руками.
 *
 * Только `my-…`: карточку из Anki или из разбора частотного списка
 * удалять нельзя — источник о том не знает, и следующий импорт привезёт
 * её обратно, а вместе с ней недоумение.
 */
create or replace function public.delete_word(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.words;
  learners integer;
begin
  if not public.is_admin() then
    raise exception 'Удалять карточки может только администратор';
  end if;

  select * into w from public.words where id = p_id;
  if not found then
    raise exception 'Карточки % нет', p_id;
  end if;

  if w.id !~ '^my-[0-9]+$' then
    raise exception 'Карточка «%» не заведена руками — её источник Anki или частотный список', w.head;
  end if;

  -- Внешние ключи на `words` стоят с `on delete cascade`, то есть
  -- удаление слова молча унесло бы и карточки, и историю ответов.
  -- Поэтому проверка здесь, до удаления, и по всем пользователям:
  -- своё обучение человек знает, чужое — нет.
  select count(*) into learners
    from public.cards c where c.word_id = w.id;
  if learners > 0 or exists (select 1 from public.reviews r where r.word_id = w.id) then
    raise exception 'По карточке «%» уже идёт обучение — удаление стёрло бы прогресс', w.head;
  end if;

  delete from public.words where id = w.id;
  return w.head;
end;
$$;

comment on function public.delete_word is
  'Удаляет карточку, заведённую руками, если по ней никто не учится. Только администратору.';

revoke execute on function public.update_word(text, jsonb) from public;
revoke execute on function public.update_word(text, jsonb) from anon;
grant execute on function public.update_word(text, jsonb) to authenticated;

revoke execute on function public.delete_word(text) from public;
revoke execute on function public.delete_word(text) from anon;
grant execute on function public.delete_word(text) to authenticated;
