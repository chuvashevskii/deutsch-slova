-- Черновые карточки: слова, собранные по частотному списку, а не взятые
-- из готовой колоды. Разбор у них не сверен человеком, и выдавать их
-- за проверенные нельзя — это то же самое, что показать незнание знанием.
--
-- Поэтому у карточки есть отметка «сверена». Пока её нет, карточка
-- видна в списке слов с пометкой, но в «Учить» не попадает, если
-- человек сам не разрешил. Снять отметку может только администратор —
-- это и означает «карточка принята, она не хуже остальных».

alter table public.words add column confirmed_at timestamptz;

-- Всё, что пришло из готовой колоды, сверено по определению: это и есть
-- образец, с которым сравниваются черновики.
update public.words set confirmed_at = now() where confirmed_at is null;

comment on column public.words.confirmed_at is
  'Когда карточку сверил человек. NULL — черновик: разбор собран автоматически и не проверен.';

-- Черновиков меньшинство, и спрашивают всегда именно их.
create index words_drafts_idx on public.words (rank nulls last, head) where confirmed_at is null;

create policy "Черновик согласует админ"
  on public.words for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Политика пускает администратора к строке целиком, а руками через API
-- словарь править нельзя: он заливается скриптом. Разрешено менять
-- только отметку о сверке.
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

  if to_jsonb(new) - 'confirmed_at' <> to_jsonb(old) - 'confirmed_at' then
    raise exception 'Через приложение у слова меняется только отметка о сверке';
  end if;

  return new;
end;
$$;

create trigger guard_word_update
  before update on public.words
  for each row execute function public.guard_word_update();

-- Показывать ли черновики в «Учить». По умолчанию нет: человек пришёл
-- учить язык, а не вычитывать чужую работу.
alter table public.user_settings
  add column include_drafts boolean not null default false;

comment on column public.user_settings.include_drafts is
  'Давать ли в «Учить» несверенные карточки. По умолчанию нет.';
