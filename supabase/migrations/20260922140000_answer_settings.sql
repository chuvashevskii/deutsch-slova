-- Ввод форм становится настройкой.
--
-- Печатать пять форм спряжения с телефона — марафон, и человек должен
-- иметь право просто прокрутить слово в уме. Поэтому ввод выключается,
-- и по умолчанию он выключен: включает тот, кому он нужен.
--
-- Галочки отдельные на каждую группу форм, а не один переключатель:
-- цена ввода очень разная. Множественное число существительного можно
-- спрашивать, а единственное нет — единственное вы и так знаете.

alter table public.user_settings
  add column input_noun_singular   boolean not null default false,
  add column input_noun_plural     boolean not null default false,
  add column input_verb_infinitive boolean not null default false,
  add column input_verb_forms      boolean not null default false,
  add column input_other           boolean not null default false,
  -- Артикль спрашивается по умолчанию: три кнопки почти ничего не стоят,
  -- а кормят «Путаницу в роде» — самую полезную из статистик.
  add column ask_genus             boolean not null default true;

comment on column public.user_settings.ask_genus is
  'Спрашивать ли артикль у существительного. Не зависит от ввода форм: кнопки остаются, даже когда печатать ничего не надо.';

-- В таблице стояло 10, а очередь брала 20, и никто не читал ни то,
-- ни другое. Умолчание приводится к тому, что работало на деле.
alter table public.user_settings alter column daily_new_limit set default 20;

-- Правильность ответа определяла проверка ввода. Без ввода её определять
-- нечем, и выводить её из оценки нельзя: «Снова» означает «покажи
-- пораньше», а не «я ошибся». Пустое значение честнее выдуманного —
-- статистика такие ответы просто не считает.
alter table public.reviews alter column answered_correctly drop not null;

comment on column public.reviews.answered_correctly is
  'Результат проверки введённых форм. Пусто, если ввод был выключен: тогда правильность не проверялась и в статистику ответ не идёт.';

-- Строка настроек заводится вместе с пользователем. Иначе первый заход
-- показывал бы умолчания, которых нет в базе, и первое же изменение
-- настройки пришлось бы отличать от создания.
create or replace function public.ensure_user_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.ensure_user_rows();

-- Тем, кто зарегистрировался раньше триггера.
insert into public.user_settings (user_id)
select id from auth.users on conflict do nothing;
