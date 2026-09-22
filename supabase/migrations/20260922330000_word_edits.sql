-- Журнал правок словаря.
--
-- Разбор колоды на однозначность ответа трогает и согласованные карточки,
-- причём отметку о сверке с них решено не снимать: правка живёт в колоде
-- сразу. Значит единственное место, где видно, что именно изменилось, —
-- этот журнал. Он же даёт откат: без записи «было» вернуть прежнее
-- значение неоткуда, а «я помню» — не механизм.
--
-- Строку пишет скрипт служебным ключом. Через приложение журнал только
-- читается и откатывается.

create table public.word_edits (
  id bigserial primary key,
  word_id text not null references public.words(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  -- Уровень правила, по которому сделана правка: «Карточка →
  -- Однозначность ответа». «формат» и «ранг» стоят особняком — это
  -- не про однозначность, но и они меняют словарь.
  reason text not null check (
    reason in ('формат', 'уровень 1', 'уровень 2', 'уровень 3', 'разделение', 'ранг', 'прочее')
  ),
  batch text not null,
  -- Правило дало несколько допустимых решений, и я выбрал одно.
  -- Такие строки владелец колоды смотрит первыми.
  disputed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

comment on table public.word_edits is
  'Что и почему изменено в словаре при разборе на однозначность ответа. Пишется скриптом, читается и откатывается администратором.';

create index word_edits_batch_idx on public.word_edits (batch, word_id, id);
-- Неоткаченные спорные — то, с чего начинается просмотр.
create index word_edits_open_idx on public.word_edits (disputed, id) where reverted_at is null;

alter table public.word_edits enable row level security;

create policy "Журнал правок читает админ"
  on public.word_edits for select
  to authenticated
  using (public.is_admin());

-- Строка карточки рядом с правкой: без неё пришлось бы вторым запросом
-- добирать слово, а список сортируется и фильтруется по обоим сразу.
create view public.word_edits_view with (security_invoker = on) as
select
  e.id,
  e.word_id,
  e.field,
  e.old_value,
  e.new_value,
  e.reason,
  e.batch,
  e.disputed,
  e.note,
  e.created_at,
  e.reverted_at,
  w.head,
  w.translation,
  w.pos,
  w.wortart,
  w.register,
  w.definition,
  w.rank,
  (w.confirmed_at is null) as is_draft
from public.word_edits e
join public.words w on w.id = e.word_id;

comment on view public.word_edits_view is
  'Правка вместе со строкой слова. Права наследуются от word_edits: видит администратор.';

-- Откат правки.
--
-- Триггер guard_word_update не пускает вошедшего пользователя к словарю
-- дальше отметки о сверке — и правильно делает: руками через API словарь
-- не правят. Откат же обязан вернуть прежнее значение, поэтому функция
-- поднимает на время транзакции флаг, который триггер признаёт.
-- Выставить его снаружи нельзя: PostgREST чужие настройки сессии
-- не передаёт.
create or replace function public.revert_word_edit(p_edit bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.word_edits;
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

  perform set_config('app.word_edit', 'on', true);
  execute format('update public.words set %I = $1 where id = $2', e.field)
    using e.old_value, e.word_id;
  perform set_config('app.word_edit', 'off', true);

  update public.word_edits set reverted_at = now() where id = p_edit;
end;
$$;

comment on function public.revert_word_edit is
  'Возвращает слову прежнее значение поля и помечает правку откаченной. Только администратору.';

grant execute on function public.revert_word_edit(bigint) to authenticated;

-- Триггер теперь знает про откат.
create or replace function public.guard_word_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INFO: заливка идёт служебным ключом, без пользователя в токене.
  -- Ей словарь менять можно — иначе повторный импорт станет невозможен.
  if auth.uid() is null then
    return new;
  end if;

  -- INFO: откат правки — единственный способ для вошедшего изменить
  -- словарь. Флаг ставит revert_word_edit и только на свою транзакцию.
  if coalesce(current_setting('app.word_edit', true), 'off') = 'on' then
    return new;
  end if;

  if to_jsonb(new) - 'confirmed_at' <> to_jsonb(old) - 'confirmed_at' then
    raise exception 'Через приложение у слова меняется только отметка о сверке';
  end if;

  return new;
end;
$$;
