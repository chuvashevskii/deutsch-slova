-- Повторная нормализация пустых строк.
--
-- Миграция `20260922320000` уже делала это — и на локальной базе
-- сработала, потому что черновики там были залиты раньше. В проде
-- порядок оказался обратным: схема приезжает миграциями, а карточки
-- скриптом, и скрипт отработал после. Файлы партий несли `""`
-- в `plural` и `plural_ending` у существительных без множественного
-- числа, и 98 пустых строк вернулись в уже нормализованную базу.
--
-- Поймала это проверка `npm run check:deck --remote`: локально ноль,
-- в проде 98. Расхождение того самого рода, ради которого проверка
-- и умеет ходить в облако.
--
-- Сами файлы партий исправлены — там теперь `null`. Эта миграция
-- убирает то, что уже успело заехать, и безопасна при повторном
-- прогоне: `nullif` от `null` тоже `null`.

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
