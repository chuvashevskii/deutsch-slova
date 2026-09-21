-- В частотном списке есть не только существительные, глаголы и
-- прилагательные: там местоимения, предлоги, союзы, числительные и
-- частицы. Карточка для них устроена просто — написать слово, — но
-- подпись и фильтр в списке должны называть часть речи верно.

alter table public.words
  drop constraint words_pos_check;

alter table public.words
  add constraint words_pos_check check (pos in (
    'noun', 'verb', 'adj', 'adverb', 'pronoun',
    'preposition', 'conjunction', 'numeral', 'particle'
  ));

comment on column public.words.pos is
  'Часть речи. Определяется артиклем в списке либо статьёй немецкого Викисловаря.';
