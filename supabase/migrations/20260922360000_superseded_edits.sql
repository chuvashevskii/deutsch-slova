-- Перекрытая правка не должна выглядеть действующей.
--
-- Журнал — история, и одно поле правится дважды: у `und` подсказку
-- сперва укоротили, потом сняли вовсе. На экране обе строки выглядели
-- одинаково живыми, и первая показывала «стало: соединяет слова…»,
-- когда подсказки у слова уже не было.
--
-- Это та же болезнь, что с откаченной правкой: строка описывает не то,
-- что в словаре сейчас. Откат помечается `reverted_at`, перекрытие
-- вычисляется — позже той же карточке и тому же полю досталась другая,
-- не откаченная правка.

create or replace view public.word_edits_view with (security_invoker = on) as
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
  (w.confirmed_at is null) as is_draft,
  -- INFO: столбец добавляется в конец: `create or replace view`
  -- не умеет вставлять его в середину — переименованием это для него
  -- и выглядит.
  exists (
    select 1
    from public.word_edits later
    where later.word_id = e.word_id
      and later.field = e.field
      and later.id > e.id
      and later.reverted_at is null
  ) as superseded
from public.word_edits e
join public.words w on w.id = e.word_id;

comment on view public.word_edits_view is
  'Правка вместе со строкой слова и признаком перекрытия. Права наследуются от word_edits: видит администратор.';
