-- Подписи к формам из поля `forms`.
--
-- Поле `forms` заводилось как «формы, которым нет своего места»,
-- и этого хватало, пока формы только показывались. Спросить их вводом
-- уже нельзя: чтобы спросить, надо знать, **что** спрашиваешь.
-- «jeder / jede / jedes» это парадигма по родам, у каждой формы своё
-- место; «vorne / vorn» — варианты написания, и слота, который можно
-- спросить, там нет.
--
-- Подписи идут вторым массивом, как examples_de и examples_ru.
-- Есть подписи — формы показываются отдельными строками, как Singular
-- и Plural у существительного, и их можно спрашивать вводом. Нет —
-- остаётся одна строка «Formen», только для чтения.

alter table public.words
  add column form_labels text[] not null default '{}';

comment on column public.words.form_labels is
  'Подписи к forms, по одной на форму. Пусто — формы только показываются: спрашивать нечего, слота у них нет.';

alter table public.words
  add constraint words_form_labels_match
  check (array_length(form_labels, 1) is null or array_length(form_labels, 1) = array_length(forms, 1));

-- Спрашивать ли формы вводом. По умолчанию выключено, как и весь ввод:
-- карточка ничего не требует, пока человек сам не попросил.
alter table public.user_settings
  add column input_forms boolean not null default false;

comment on column public.user_settings.input_forms is
  'Спрашивать ли формы с подписями (роды определителя и подобное) вводом с клавиатуры.';
