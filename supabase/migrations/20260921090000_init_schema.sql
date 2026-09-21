-- Словарь, состояние карточек FSRS и журнал повторений.

create table public.words (
  id                text primary key,
  rank              integer not null unique,
  pos               text not null check (pos in ('verb', 'noun', 'adj')),
  head              text not null,
  translation       text not null,
  definition        text not null default '',
  frequency         bigint not null default 0,
  corpus_share      double precision not null default 0,
  ipa               text not null default '',
  pronunciation_ru  text not null default '',

  -- существительные
  singular          text,
  plural            text,
  genus             text check (genus in ('m', 'f', 'n')),
  suffix            text,
  plural_ending     text,
  stress_singular   text,
  stress_plural     text,

  -- глаголы
  form_ich          text,
  form_du           text,
  form_er           text,
  form_wir          text,
  form_ihr          text,
  rektion           text[] not null default '{}',
  separable_prefix  text,
  register          text,
  stress_infinitive text,

  -- прилагательные и наречия
  wortart           text,
  komparativ        text,
  superlativ        text,
  stress_word       text,

  -- правило образования формы, из колоды Anki
  rule_status       text not null default 'none'
                      check (rule_status in ('high', 'mixed', 'exception', 'notsuffix', 'none')),
  rule_label        text not null default '',

  examples_de       text[] not null default '{}',
  examples_ru       text[] not null default '{}',

  created_at        timestamptz not null default now()
);

comment on table public.words is 'Частотный словарь. Общий для всех, правится только миграциями.';
comment on column public.words.corpus_share is 'Доля токенов корпуса — из неё считается покрытие текста.';

create index words_pos_idx on public.words (pos);

-- Состояние карточки в терминах FSRS: стабильность, сложность, срок.
create table public.cards (
  user_id        uuid not null references auth.users (id) on delete cascade,
  word_id        text not null references public.words (id) on delete cascade,
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  state          smallint not null default 0 check (state between 0 and 3),
  last_review    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, word_id)
);

comment on column public.cards.state is '0 — новая, 1 — изучается, 2 — на повторении, 3 — переучивается.';

create index cards_due_idx on public.cards (user_id, due);

-- Журнал ответов: нужен и для статистики, и для будущей подгонки параметров FSRS.
create table public.reviews (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users (id) on delete cascade,
  word_id            text not null references public.words (id) on delete cascade,
  rating             smallint not null check (rating between 1 and 4),
  state              smallint not null check (state between 0 and 3),
  stability          double precision,
  difficulty         double precision,
  elapsed_days       integer,
  scheduled_days     integer,
  answered_correctly boolean not null default true,
  answered_genus     text check (answered_genus in ('m', 'f', 'n')),
  duration_ms        integer,
  reviewed_at        timestamptz not null default now()
);

create index reviews_user_time_idx on public.reviews (user_id, reviewed_at desc);

create table public.user_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  desired_retention double precision not null default 0.9
                      check (desired_retention between 0.7 and 0.99),
  daily_new_limit   integer not null default 10 check (daily_new_limit >= 0),
  updated_at        timestamptz not null default now()
);

-- Row Level Security: словарь читают все вошедшие, свои данные видит только владелец.

alter table public.words enable row level security;
alter table public.cards enable row level security;
alter table public.reviews enable row level security;
alter table public.user_settings enable row level security;

create policy "Словарь читают вошедшие пользователи"
  on public.words for select
  to authenticated
  using (true);

create policy "Свои карточки видны владельцу"
  on public.cards for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свои карточки создаёт владелец"
  on public.cards for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Свои карточки правит владелец"
  on public.cards for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Свои карточки удаляет владелец"
  on public.cards for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свой журнал виден владельцу"
  on public.reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свой журнал пополняет владелец"
  on public.reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Свой журнал чистит владелец"
  on public.reviews for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свои настройки видны владельцу"
  on public.user_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Свои настройки создаёт владелец"
  on public.user_settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Свои настройки правит владелец"
  on public.user_settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
