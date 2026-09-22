-- Формат стилистической пометы и уточнения части речи.
--
-- Колода из Anki пишет помету двуязычно — «umgangssprachlich · разговорный»:
-- немецкий термин для точности, русский для читаемости. Мои черновики
-- писали голый немецкий («umgangssprachlich», «derb») и пустую строку
-- вместо NULL. Читалось пока и то и другое, но проверить «заполнена ли
-- помета у всех слов группы» на двух разных пустотах нельзя: пустая строка
-- проходит проверку на NULL и молча считается заполненной.
--
-- То же с `wortart`: у существительных и глаголов колоды там NULL,
-- у моих черновиков — пустая строка.

update public.words set register = null where register = '';
update public.words set register = 'umgangssprachlich · разговорный' where register = 'umgangssprachlich';
update public.words set register = 'formell · книжный' where register = 'formell';
update public.words set register = 'neutral · нейтральный' where register = 'neutral';
update public.words set register = 'derb · грубый' where register = 'derb';

update public.words set wortart = null where btrim(wortart) = '';

-- Проверка не перечисляет пометы, а требует формы: «немецкое · русское».
-- Перечисление пришлось бы править каждый раз, когда в колоде заведут
-- новую помету (gehoben, vulgär), и ограничение стало бы тем, что мешает
-- заливке из Anki вместо того, чтобы её страховать.
alter table public.words
  add constraint words_register_format
  check (register is null or register ~ '^[a-zäöüß]+ · .+$');

alter table public.words
  add constraint words_wortart_not_blank
  check (wortart is null or btrim(wortart) <> '');

comment on column public.words.register is
  'Стилистическая помета в форме «немецкое · русское»: umgangssprachlich · разговорный. NULL — пометы нет; пустая строка запрещена.';
