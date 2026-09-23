/**
 * Правила разбора немецких форм, которыми пользуется проверка колоды.
 *
 * Вынесены из `check-deck.mjs` отдельно, потому что тот скрипт при
 * загрузке сразу идёт в базу: проверить его правила тестом, не подняв
 * стек, было нельзя. А правила здесь именно те, на которых проверка
 * трижды ошибалась и молча требовала правок у целых карточек.
 */

/**
 * Предлог, слитый с артиклем.
 *
 * `führen` объявляет `zu etw. (Dat.)`, а пример говорит `führt zum
 * Bahnhof` — управление показано, просто `zu dem` по-немецки пишется
 * одним словом.
 */
export const CONTRACTIONS = {
  an: ['am', 'ans'],
  auf: ['aufs'],
  bei: ['beim'],
  durch: ['durchs'],
  für: ['fürs'],
  hinter: ['hinterm', 'hinters'],
  in: ['im', 'ins'],
  über: ['überm', 'übers'],
  um: ['ums'],
  unter: ['unterm', 'unters'],
  von: ['vom'],
  vor: ['vorm', 'vors'],
  zu: ['zum', 'zur'],
};

/**
 * Предлог — это слово прямо перед `etw` или `jmdm`/`jmdn`.
 *
 * Якорь на начало строки не годился: у возвратных моделей впереди стоит
 * `sich (Akk.)`, и `sich (Akk.) auf etw. (Akk.)` разбиралось в пустоту —
 * предлог `auf` не доставался вовсе, а карточка попадала в нарушители,
 * хотя пример его показывал. Падежная пометка в ловушку не попадает:
 * между `Akk` и следующим словом стоит «.)», а не пробел.
 */
const PREP_MODEL = /([a-zäöüA-ZÄÖÜ]+)\s+(?:etw|jmdm|jmdn)/g;

/** Предлоги, которые объявляют модели управления карточки. */
export const prepositionsOf = (rektion) =>
  (rektion ?? [])
    .flatMap((model) => [...model.matchAll(PREP_MODEL)].map((m) => m[1].toLowerCase()))
    .filter((prep) => prep !== 'sich');

/** Показан ли предлог в примерах — сам по себе или слитый с артиклем. */
export const prepositionShown = (prep, examples) => {
  const forms = [prep, ...(CONTRACTIONS[prep] ?? [])].join('|');
  return new RegExp(`(?:${forms})(?![a-zäöüß])`).test(examples);
};

/**
 * Дательный падеж множественного добавляет `-n` — `drei Tagen`,
 * `mit zwei Lehrbüchern`. Это то же множественное, и проверка обязана
 * его засчитывать. Окончание не добавляется, когда множественное
 * и так кончается на `-n` или `-s`.
 */
export const dativePlural = (plural) => (/[ns]$/.test(plural) ? plural : `${plural}n`);

/** Показано ли множественное в примерах — в любом из двух написаний. */
export const pluralShown = (plural, examples) =>
  new RegExp(`(?<![a-zäöüß])(?:${plural}|${dativePlural(plural)})(?![a-zäöüß])`).test(examples);
