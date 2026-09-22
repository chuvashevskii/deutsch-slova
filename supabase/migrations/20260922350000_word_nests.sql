-- Гнёзда: карточки, которые надо смотреть вместе, а не по одной.
--
-- Разбор колоды на однозначность ответа — работа про пары и тройки,
-- а список слов показывает их порознь, через сотню строк друг от друга.
-- Проверить решение по такой выдаче нельзя: чтобы понять, верно ли
-- разведены `bekommen`, `erhalten` и `kriegen`, надо видеть все три
-- сразу, с пометами и подсказками.
--
-- Гнёзда бывают двух родов, и это два разных вопроса к колоде:
--
--   'head'        одно немецкое слово — разные значения. `Bank` банк
--                 и скамейка, `wählen` выбирать, голосовать и набирать
--                 номер. Здесь проверяют, надо ли делить карточку
--                 и не слиплись ли два значения в одно.
--
--   'translation' один русский перевод — разные немецкие слова. Все
--                 «Получать» рядом. Здесь проверяют, разведены ли они
--                 пометой или подсказкой, то есть работает ли правило.

-- Подпись части речи — та же, что человек видит на лице карточки.
-- Гнездо по переводу считается внутри подписи: `Anfang` «Начало»
-- и `anfangen` «Начинать» человек не спутает, чип их разводит.
create or replace function public.word_label(p_pos text, p_wortart text)
returns text
language sql
immutable
as $$
  select coalesce(
    case p_wortart
      when 'прилагательное' then 'прил.'
      when 'наречие' then 'нареч.'
      when 'прилагательное и наречие' then 'прил. · нареч.'
      when 'вопросительное наречие' then 'нареч.'
      when 'вопросительное местоимение' then 'мест.'
      when 'формула вежливости' then 'оборот'
      when 'устойчивый оборот' then 'оборот'
      when 'предлог' then 'предл.'
      when 'количественное слово' then 'числ.'
    end,
    case p_pos
      when 'noun' then 'сущ.'
      when 'verb' then 'глаг.'
      when 'adj' then 'прил.'
      when 'adverb' then 'нареч.'
      when 'pronoun' then 'мест.'
      when 'preposition' then 'предл.'
      when 'conjunction' then 'союз'
      when 'numeral' then 'числ.'
      when 'particle' then 'част.'
    end,
    p_pos
  );
$$;

comment on function public.word_label is
  'Подпись части речи, как она стоит на лице карточки. Та же раскладка живёт в src/entities/word/model/types.ts.';

create or replace function public.word_nests(p_kind text default 'translation')
returns jsonb
language sql
stable
as $$
  with card as (
    select w.id, w.head, w.pos, w.wortart, w.translation, w.register, w.definition,
           w.rank, (w.confirmed_at is null) as is_draft,
           public.word_label(w.pos, w.wortart) as label,
           -- Правку видно прямо в гнезде: иначе пришлось бы держать
           -- в голове, что из этого я менял, а что стояло так всегда.
           exists (
             select 1 from public.word_edits e
             where e.word_id = w.id and e.reverted_at is null
           ) as edited
    from public.words w
  ),
  keyed as (
    select card.*,
           case when p_kind = 'head' then card.head
                else btrim(variant) end as nest_key,
           case when p_kind = 'head' then '' else card.label end as nest_scope
    from card
    left join lateral unnest(
      case when p_kind = 'head' then array['']
           else string_to_array(lower(translate(card.translation, 'ё', 'е')), '/')
      end
    ) as variant on true
    where p_kind = 'head' or btrim(variant) <> ''
  ),
  nested as (
    select nest_key, nest_scope, count(distinct id) as n
    from keyed group by nest_key, nest_scope having count(distinct id) > 1
  )
  select coalesce(jsonb_agg(nest order by nest->>'label', nest->>'key'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'key', n.nest_key,
      'label', case when n.nest_scope = '' then max(k.label) else n.nest_scope end,
      -- Изъян гнезда — то самое нарушение правила однозначности,
      -- и считается оно здесь, чтобы экран не пересчитывал правило
      -- второй раз и не разошёлся с валидатором. Нарушений два рода:
      -- у карточки нет различителя вовсе, либо различители у двух
      -- карточек совпали — второе так же не даёт выбрать.
      'flawed',
        n.nest_scope <> ''
        and (
          bool_or(coalesce(k.register, '') = '' and btrim(coalesce(k.definition, '')) = '')
          or count(distinct coalesce(k.register, '') || '|' || btrim(coalesce(k.definition, '')))
             <> count(distinct k.id)
        ),
      'cards', jsonb_agg(
        jsonb_build_object(
          'id', k.id, 'head', k.head, 'translation', k.translation,
          'register', k.register, 'definition', k.definition,
          'rank', k.rank, 'is_draft', k.is_draft, 'label', k.label,
          'pos', k.pos, 'wortart', k.wortart, 'edited', k.edited
        ) order by k.rank nulls last, k.head, k.id
      )
    ) as nest
    from nested n
    join keyed k on k.nest_key = n.nest_key and k.nest_scope = n.nest_scope
    group by n.nest_key, n.nest_scope
  ) t;
$$;

comment on function public.word_nests is
  'Карточки, которые смотрят вместе: «head» — одно немецкое слово с разными значениями, «translation» — один русский перевод у разных слов.';
