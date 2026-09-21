-- Два общих списка: обращения по карточкам и бэклог слов.
--
-- Общие — значит читают все вошедшие, а пишет каждый своё. Это меняет
-- обращение с личными данными: вход через Google открытый, и адреса
-- почты стали бы видны каждому, кто зарегистрировался. Поэтому автор
-- подписывается псевдонимом из profiles, а почта в списки не идёт вовсе.

create table public.feedback (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  word_id     text not null references public.words (id) on delete cascade,
  message     text not null check (btrim(message) <> '' and length(message) <= 2000),
  -- Снимок слова на момент жалобы. Словарь заливается из Anki повторно:
  -- пожаловались на форму, поправили карточку, залили заново — и жалоба
  -- стала непроверяемой. Со снимком видно, на что человек смотрел.
  snapshot    jsonb not null default '{}'::jsonb,
  -- Что было введено и что ожидалось, если жалоба пришла с «Учить».
  -- Половина обращений будет вида «я написал верно, а мне не засчитали».
  context     jsonb,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index feedback_word_idx on public.feedback (word_id);
create index feedback_created_idx on public.feedback (created_at desc);

comment on table public.feedback is
  'Обращения по карточкам. Список общий: читают все вошедшие, пишет каждый своё, разбирает администратор.';

alter table public.feedback enable row level security;

create policy "Обращения видны всем вошедшим"
  on public.feedback for select to authenticated using (true);

create policy "Своё обращение создаёт автор"
  on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Править обращение нельзя никому, кроме администратора: единственное
-- изменяемое поле — отметка «разобрано», и это его работа. Автору
-- достаточно удалить своё и написать заново.
create policy "Обращения разбирает администратор"
  on public.feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Обращение удаляет автор или администратор"
  on public.feedback for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create table public.backlog (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  word        text not null check (btrim(word) <> '' and length(word) <= 120),
  translation text not null check (btrim(translation) <> '' and length(translation) <= 200),
  note        text not null default '' check (length(note) <= 500),
  state       text not null default 'new' check (state in ('new', 'added', 'rejected')),
  created_at  timestamptz not null default now()
);

create index backlog_state_idx on public.backlog (state, created_at desc);

comment on table public.backlog is
  'Слова на будущее. Список общий: предлагает каждый, состояние строки меняет администратор.';

alter table public.backlog enable row level security;

create policy "Бэклог виден всем вошедшим"
  on public.backlog for select to authenticated using (true);

create policy "Своё предложение создаёт автор"
  on public.backlog for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Своё предложение правит автор или администратор"
  on public.backlog for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "Предложение удаляет автор или администратор"
  on public.backlog for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- Политики RLS работают на уровне строки, а не колонки: автор правит свою
-- строку целиком, значит смог бы объявить собственное предложение
-- заведённым. Состояние строки — работа администратора, и это
-- единственный способ закрыть колонку отдельно от остальных.
--
-- Служебный ключ (auth.uid() пуст) проходит: им работает скрипт заливки,
-- он закрывает строки, слова которых появились в колоде.
create or replace function public.guard_backlog_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state is distinct from old.state
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Состояние строки бэклога меняет только администратор';
  end if;
  return new;
end;
$$;

create trigger backlog_state_guard
  before update on public.backlog
  for each row execute function public.guard_backlog_state();
