-- Пустая строка вместо NULL в необязательных полях черновиков.
--
-- Расхождение того же рода, что и с пометой регистра, но шире: заливка
-- черновиков подставляла пустую строку в одиннадцать необязательных полей,
-- тогда как колода из Anki кладёт туда NULL. Интерфейс разницы не замечал
-- (`word.komparativ ? … : null` отсекает и то и другое), поэтому расхождение
-- дожило до момента, когда понадобилось спросить «заполнено ли поле».
--
-- `definition` и `rule_label` здесь намеренно не тронуты: они объявлены
-- NOT NULL, и пустая строка — их законное «пусто». У них расхождения нет,
-- колода пишет так же.

update public.words
set komparativ        = nullif(komparativ, ''),
    superlativ        = nullif(superlativ, ''),
    singular          = nullif(singular, ''),
    plural            = nullif(plural, ''),
    plural_ending     = nullif(plural_ending, ''),
    suffix            = nullif(suffix, ''),
    separable_prefix  = nullif(separable_prefix, ''),
    stress_word       = nullif(stress_word, ''),
    stress_infinitive = nullif(stress_infinitive, ''),
    stress_singular   = nullif(stress_singular, ''),
    stress_plural     = nullif(stress_plural, '')
where komparativ = '' or superlativ = '' or singular = '' or plural = ''
   or plural_ending = '' or suffix = '' or separable_prefix = ''
   or stress_word = '' or stress_infinitive = '' or stress_singular = ''
   or stress_plural = '';
