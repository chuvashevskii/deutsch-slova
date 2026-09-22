-- Откат строки о создании карточки.
--
-- Разделение многозначного слова пишет в журнал строку, у которой
-- «было» пусто: карточка не изменилась, а родилась. Кнопка «Откатить»
-- пыталась записать это пустое значение обратно в перевод и падала
-- на NOT NULL:
--
--   null value in column "translation" violates not-null constraint
--
-- Ошибка тут милосерднее тихого успеха: обнулённый перевод был бы хуже.
-- Но по смыслу откат создания — это удаление созданного, а не правка
-- поля, и функция теперь так и делает.
--
-- Удаление ограничено двумя условиями. Карточка должна оставаться
-- черновиком: согласованную владелец уже принял, и снимать её
-- откатом чужой строки нельзя. И по ней не должно быть обучения:
-- удалить слово, которое человек уже учит, значит стереть его прогресс
-- заодно с карточкой.

create or replace function public.revert_word_edit(p_edit bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.word_edits;
  w public.words;
begin
  if not public.is_admin() then
    raise exception 'Откатывать правки может только администратор';
  end if;

  select * into e from public.word_edits where id = p_edit for update;
  if not found then
    raise exception 'Правка % не найдена', p_edit;
  end if;
  if e.reverted_at is not null then
    return;
  end if;

  select * into w from public.words where id = e.word_id;

  -- Строка о рождении карточки: «было» пусто, потому что до неё
  -- карточки не существовало.
  if e.old_value is null and e.reason = 'разделение' then
    if w.confirmed_at is not null then
      raise exception 'Карточка «%» уже согласована — откатом её не снять', w.head;
    end if;
    if exists (select 1 from public.cards c where c.word_id = w.id)
       or exists (select 1 from public.reviews r where r.word_id = w.id) then
      raise exception 'По карточке «%» уже идёт обучение — удаление стёрло бы прогресс', w.head;
    end if;
    -- Журнальные строки этой карточки уходят вместе с ней: на что
    -- ссылаться, если карточки нет.
    delete from public.words where id = w.id;
    return;
  end if;

  perform set_config('app.word_edit', 'on', true);
  execute format('update public.words set %I = $1 where id = $2', e.field)
    using e.old_value, e.word_id;
  perform set_config('app.word_edit', 'off', true);

  update public.word_edits set reverted_at = now() where id = p_edit;
end;
$$;

comment on function public.revert_word_edit is
  'Возвращает слову прежнее значение поля. Строка о создании карточки (разделение) откатывается удалением созданного черновика, если по нему нет обучения.';
