-- Озвучка слова из колоды Anki. Берётся только звук самих словоформ;
-- озвучка примеров не переносится — примеры читаются глазами.
--
-- В колонке лежит путь внутри бакета, а не полная ссылка: адрес стенда
-- меняется, а путь нет. Имена повторяют уже существующие form_* и
-- singular/plural, чтобы связь формы и её звука читалась без словаря.

alter table public.words
  add column audio_head        text,
  add column audio_plural      text,
  add column audio_ich         text,
  add column audio_du          text,
  add column audio_er          text,
  add column audio_wir         text,
  add column audio_ihr         text,
  add column audio_comparative text,
  add column audio_superlative text;

comment on column public.words.audio_head is
  'Путь в бакете audio до озвучки словарной формы: для существительного это Singular, для глагола инфинитив. Пусто, если записи нет.';

-- Бакет создаётся миграцией, иначе после «supabase db reset» звук
-- отвалится молча: колонки с путями останутся, а хранилища не будет.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

-- Читать озвучку может кто угодно: это словарные записи, ничего личного
-- в них нет. Запись идёт из скрипта заливки служебным ключом, который
-- политики обходит, поэтому политики на запись не нужны вовсе.
create policy "Озвучка читается всеми"
  on storage.objects for select
  using (bucket_id = 'audio');
