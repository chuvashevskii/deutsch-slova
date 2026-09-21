-- Псевдоним для общих списков.
--
-- Лежит отдельно от user_settings намеренно. Настройки читает только
-- владелец, а псевдоним нужен другим людям: они видят подпись под чужой
-- строкой в обращениях и бэклоге. Открыть для чтения всю таблицу настроек
-- ради одного поля — значит показать заодно и лимиты, и галочки ввода.
--
-- Почта не покидает базу ни в каком виде: вход через Google открытый,
-- и адреса всех вошедших стали бы видны каждому.

create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null default 'Аноним' check (btrim(nickname) <> '' and length(nickname) <= 40),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Публичная часть учётной записи: только псевдоним. Почта сюда не попадает.';

alter table public.profiles enable row level security;

create policy "Псевдонимы видны всем вошедшим"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Свой псевдоним создаёт владелец"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Свой псевдоним правит владелец"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Строка профиля заводится вместе с пользователем, как и настройки.
create or replace function public.ensure_user_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

insert into public.profiles (user_id)
select id from auth.users on conflict do nothing;

-- Роль администратора держится отдельной таблицей, а не колонкой
-- в настройках. Политики RLS работают на уровне строки, а не колонки:
-- человек правит свою строку настроек — значит смог бы выставить себе
-- и признак администратора. Здесь политики на запись нет вовсе,
-- админ добавляется только напрямую в базе.

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Кто может разбирать общие списки. Пополняется только напрямую в базе: политик на запись нет намеренно.';

alter table public.admins enable row level security;

create policy "Список администраторов виден вошедшим"
  on public.admins for select
  to authenticated
  using (true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

comment on function public.is_admin is
  'Администратор ли текущий пользователь. Используется в политиках общих списков.';
