-- Род, который предсказывает правило. У исключений он отличается от
-- настоящего рода слова: плашка на карточке показывает оба.

alter table public.words
  add column rule_genus text check (rule_genus in ('m', 'f', 'n'));

comment on column public.words.rule_genus is
  'Род, который предсказывает правило. Отличается от genus у исключений.';
