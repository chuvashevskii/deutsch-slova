/**
 * Правила колоды — те самые, которыми проверка ищет расхождения.
 *
 * Лежат здесь, а не в `scripts/`, потому что нужны дважды: скрипту,
 * когда он вычитывает всю колоду, и форме, когда человек заводит
 * карточку руками. Две копии одних правил разъехались бы — весь день
 * ушёл на починку ровно такого расхождения между переводом и примерами.
 *
 * Обычный JS с JSDoc, а не TypeScript: скрипты запускаются node напрямую,
 * без сборки, и `.ts` они бы не подхватили.
 */

/** Допустимые пометы регистра — ровно те, что живут в колоде. */
export const REGISTERS = [
  'neutral · нейтральный',
  'umgangssprachlich · разговорный',
  'formell · книжный',
  'derb · грубый',
];

/** Помета пишется двумя языками через средний пробел с точкой. */
export const REGISTER_FORM = /^[a-zäöüß]+ · [а-яё]+$/;

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

/**
 * Предлоги, которые объявляют модели управления карточки.
 * @param {string[] | null | undefined} rektion
 * @returns {string[]}
 */
export const prepositionsOf = (rektion) =>
  (rektion ?? [])
    .flatMap((model) => [...model.matchAll(PREP_MODEL)].map((m) => m[1].toLowerCase()))
    .filter((prep) => prep !== 'sich');

/**
 * Показан ли предлог в примерах — сам по себе или слитый с артиклем.
 *
 * Проверка приблизительная и ошибается в одну сторону: отделяемую
 * приставку она считает предлогом. `Ihre Zuversicht steckt alle an`
 * засчитает `an`, хотя дательного дополнения там нет. Различить их
 * можно только разбором предложения, а ошибаться лучше в сторону
 * «показано»: ложная тревога заставляет чинить здоровое, и это дороже
 * пропуска — проверка отчётная, не блокирующая.
 * @param {string} prep
 * @param {string} examples — примеры одной строкой, в нижнем регистре
 */
export const prepositionShown = (prep, examples) => {
  const forms = [prep, ...(CONTRACTIONS[prep] ?? [])].join('|');
  return new RegExp(`(?:${forms})(?![a-zäöüß])`).test(examples);
};

/**
 * Дательный падеж множественного добавляет `-n` — `drei Tagen`,
 * `mit zwei Lehrbüchern`. Это то же множественное, и проверка обязана
 * его засчитывать. Окончание не добавляется, когда множественное
 * и так кончается на `-n` или `-s`.
 * @param {string} plural
 */
export const dativePlural = (plural) => (/[ns]$/.test(plural) ? plural : `${plural}n`);

/**
 * Показано ли множественное в примерах — в любом из двух написаний.
 * @param {string} plural — без артикля, в нижнем регистре
 * @param {string} examples
 */
export const pluralShown = (plural, examples) =>
  new RegExp(`(?<![a-zäöüß])(?:${plural}|${dativePlural(plural)})(?![a-zäöüß])`).test(examples);

/**
 * Два примера даются, чтобы показать слово дважды по-разному. Если они
 * отличаются одним словом — «Wir buchen eine Tour» и «Wir buchen zwei
 * Touren», — второй не добавляет ничего.
 * @param {string} a
 * @param {string} b
 */
export const areTwins = (a, b) => {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!wa.size || !wb.size) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size) > 0.6;
};

/**
 * Встречается ли заголовок в примерах. Ищется начало слова, а не точное
 * совпадение: немецкий склоняет и спрягает, `Tisch` живёт в примере
 * как `Tische`, а `gehen` — как `geht`.
 * @param {string} head
 * @param {string} examples
 */
export const headShown = (head, examples) => {
  const stem = head
    .toLowerCase()
    .replace(/^(der|die|das)\s+/, '')
    .trim();
  if (stem.length < 3) return true;
  const short = stem.length > 5 ? stem.slice(0, stem.length - 2) : stem;
  return examples.toLowerCase().includes(short);
};

/**
 * Слова, которым место в помете, а не в подсказке.
 *
 * У `furchtbar` подсказка состояла из слова «разговорное», у `dumm` —
 * из слова «нейтральное». Это помета, и лежать ей надо в своём поле:
 * иначе чип на лице карточки не появится, а правило «помета обязательна
 * у всех в группе» проверить нечем — половина помет в другом поле.
 */
export const REGISTER_WORDS = /разговорн|нейтральн|книжн|грубо|просторечн|формальн/i;

/**
 * Что не так с подсказкой. Пустая подсказка допустима — она
 * не обязательна; проверяется только заполненная.
 * @param {string} definition
 * @param {string} head
 * @returns {string[]} перечень претензий, пустой — значит всё в порядке
 */
export const definitionProblems = (definition, head) => {
  const d = definition.trim();
  if (!d) return [];
  const problems = [];
  const count = d.split(/\s+/).length;
  if (count < 2) problems.push('меньше двух слов');
  if (count > 5) problems.push(`${count} слов вместо двух-пяти`);
  if (d[0] !== d[0].toLowerCase()) problems.push('с заглавной буквы');
  if (d.endsWith('.')) problems.push('с точкой на конце');
  if (head && d.toLowerCase().includes(head.toLowerCase())) problems.push('содержит сам ответ');
  if (REGISTER_WORDS.test(d)) problems.push('это помета, ей место в своём поле');
  return problems;
};

/**
 * Приведение перевода к виду, по которому ищется столкновение.
 *
 * Скобки **не** снимаются: уточнение в них и есть то, чем карточки
 * различают. Снятие скобок однажды уже пробовали — измерили, и оно
 * создало тридцать девять ложных групп.
 * @param {string} text
 */
export const normalizeTranslation = (text) =>
  text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

/**
 * Варианты перевода: слэш разделяет равноправные, скобки — нет.
 * @param {string} translation
 */
export const translationVariants = (translation) =>
  translation
    .split('/')
    .map((part) => normalizeTranslation(part))
    .filter(Boolean);

/**
 * Отделяемые приставки — те, что встречаются в колоде.
 *
 * Список не учебник, а перепись: ровно двадцать девять приставок
 * у ста сорока пяти глаголов. Он нужен, чтобы **предложить** приставку,
 * когда человек отметил глагол отделяемым, — поле остаётся открытым,
 * и приставку не из списка можно вписать руками.
 *
 * Порядок от длинных к коротким: у `herunterladen` надо узнать
 * `herunter`, а не `her`.
 */
export const SEPARABLE_PREFIXES = [
  'zusammen', 'herunter', 'zurück', 'vorbei', 'heraus', 'weiter', 'kennen',
  'wieder', 'statt', 'teil', 'fest', 'fern', 'wahr', 'leid', 'aus', 'ein',
  'vor', 'mit', 'los', 'nach', 'her', 'hin', 'weh', 'auf', 'ab', 'an', 'um',
  'zu', 'bei',
].sort((a, b) => b.length - a.length);

/** Возвратное `sich` перед словом: приставка начинается после него. */
const SICH = /^\s*sich\s+/i;

/** Где в слове начинается собственно глагол — после `sich`, если он есть. */
export const stemStart = (head) => (head.match(SICH)?.[0].length ?? 0);

/**
 * Приставка, которой начинается слово, — или пусто.
 *
 * Только подсказка: `umfahren` бывает и отделяемым («объехать»),
 * и неотделяемым («сбить»), и различить их по буквам нельзя —
 * поэтому решает человек галочкой, а список лишь избавляет
 * от набора руками.
 */
export const detectPrefix = (head) => {
  const rest = (head ?? '').slice(stemStart(head ?? '')).toLowerCase();
  return SEPARABLE_PREFIXES.find((p) => rest.startsWith(p) && rest.length > p.length) ?? '';
};

/**
 * Начинается ли слово этой приставкой.
 *
 * Проверка не придирка: `infinitiveSegments` подсвечивает приставку
 * только когда она совпала с началом слова, а не совпав — молчит.
 * Человек написал бы «auf» у `bekommen` и не увидел ни подсветки,
 * ни причины.
 */
export const prefixFits = (head, prefix) => {
  const h = (head ?? '').trim();
  const p = (prefix ?? '').trim().toLowerCase();
  if (!p) return true;
  const rest = h.slice(stemStart(h)).toLowerCase();
  return rest.startsWith(p) && rest.length > p.length;
};

/**
 * Оторвана ли приставка в личной форме.
 *
 * В колоде у всех ста сорока пяти отделяемых глаголов личные формы
 * записаны с оторванной приставкой в конце: `steht auf`, `findet statt`.
 * Слитная форма означала бы, что глагол на самом деле неотделяемый.
 */
export const prefixDetached = (form, prefix) => {
  const f = (form ?? '').trim().toLowerCase();
  const p = (prefix ?? '').trim().toLowerCase();
  if (!f || !p) return true;
  return f.endsWith(` ${p}`);
};
