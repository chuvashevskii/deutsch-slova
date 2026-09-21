/**
 * Отображение заметок Anki в строки таблицы words.
 *
 * Вынесено отдельным модулем от скрипта заливки, потому что это самая
 * содержательная часть: у каждого из четырёх типов заметок свои имена полей,
 * и ошибка здесь тихо испортит весь словарь. Модуль чистый — ни сети,
 * ни файлов, — поэтому покрыт тестами.
 */

/** Типы заметок, которые считаются словами. Фразы сюда не входят. */
export const WORD_MODELS = [
  'Существительное на немецком',
  'Глагол на немецком',
  'Прилагательное и наречие',
  'Deutsch Typing v3',
];

export const PHRASE_MODEL = 'Deutsch Phrases v1';
export const DRAFT_DECK = '99. Черновик — не трогать';

/**
 * Часть речи по значению поля Wortart. В колоде прилагательные и наречия
 * лежат одним типом заметки, различить их можно только этим полем.
 */
const POS_BY_WORTART = {
  'прилагательное': 'adj',
  'прилагательное и наречие': 'adj',
  'наречие': 'adverb',
  'вопросительное наречие': 'adverb',
  'вопросительное местоимение': 'pronoun',
  'предлог': 'preposition',
  'количественное слово': 'numeral',
  'формула вежливости': 'particle',
  'устойчивый оборот': 'particle',
};

/**
 * Одиннадцать служебных слов лежат в типе Deutsch Typing v3, и поле
 * usage_type у всех пустое — часть речи взять неоткуда. Поэтому список
 * заведён руками; он короткий и виден целиком.
 *
 * Четыре последних — многословные обороты. Отдельного значения «оборот»
 * в колонке pos нет, и заводить его ради четырёх строк не стоит: счётный
 * оборот ближе всего к числительному, «что-нибудь ещё» — к частице.
 */
const POS_BY_FUNCTION_WORD = {
  weil: 'conjunction',
  und: 'conjunction',
  oder: 'conjunction',
  aber: 'conjunction',
  mal: 'particle',
  doch: 'particle',
  'sonst noch was': 'particle',
  'eine halbe Stunde': 'numeral',
  'zweieinhalb Stunden': 'numeral',
  'dreieinhalb Stunden': 'numeral',
};

const ARTICLES = /^(der|die|das)\s+/i;
const SOUND = /\[sound:([^\]]+)\]/g;

/** Значение поля без разметки Anki: без ссылок на звук и лишних пробелов. */
export const clean = (value) =>
  (value ?? '')
    .replace(SOUND, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

/** Имя звукового файла из поля, или null. */
export const soundFile = (value) => {
  const match = [...(value ?? '').matchAll(SOUND)];
  return match.length ? match[0][1] : null;
};

/** Многострочное поле в массив строк: примеры и управление хранятся массивами. */
export const toLines = (value) =>
  clean(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const stripArticle = (value) => clean(value).replace(ARTICLES, '').trim();

/** Прочерк в поле означает «формы нет», а не пустое значение. */
const orNull = (value) => {
  const text = clean(value);
  return text && text !== '—' && text !== '-' ? text : null;
};

const RULE_STATUSES = new Set(['high', 'mixed', 'exception', 'notsuffix', 'none']);
const ruleStatus = (value) => {
  const text = clean(value);
  return RULE_STATUSES.has(text) ? text : 'none';
};

const GENUS = new Set(['m', 'f', 'n']);
const genusOf = (value) => {
  const text = clean(value);
  return GENUS.has(text) ? text : null;
};

/**
 * Заметка Anki → строка words. Возвращает null, если тип заметки не про
 * слово; вызывающий такие пропускает.
 */
export const noteToWord = (note) => {
  const field = (name) => note.fields[name]?.value ?? '';
  const base = {
    id: String(note.noteId),
    definition: clean(field('Definition')),
    ipa: clean(field('IPA')) || clean(field('ipa')),
    pronunciation_ru: clean(field('AusspracheRU')) || clean(field('pronunciation_ru')),
    examples_de: [],
    examples_ru: [],
    rektion: [],
  };

  if (note.modelName === 'Существительное на немецком') {
    const singular = orNull(field('Singular'));
    const plural = orNull(field('Plural'));
    return {
      ...base,
      pos: 'noun',
      head: stripArticle(singular ?? plural ?? ''),
      translation: clean(field('Übersetzung')),
      singular,
      plural,
      genus: genusOf(field('Genus')),
      suffix: orNull(field('Suffix')),
      plural_ending: orNull(field('PluralEndung')),
      rule_status: ruleStatus(field('RegelStatus')),
      rule_label: clean(field('RegelLabel')),
      // Колода не хранит род, который предсказывает правило, отдельным
      // полем — но для «надёжного» и «с исключениями» он по определению
      // совпадает с настоящим: в этом и смысл пометки. У исключения он
      // другой, и вывести его неоткуда — оставляем пустым, плашка это
      // переживает и показывает одно название правила.
      rule_genus: ['high', 'mixed'].includes(ruleStatus(field('RegelStatus')))
        ? genusOf(field('Genus'))
        : null,
      stress_singular: orNull(field('BetonungSg')),
      stress_plural: orNull(field('BetonungPl')),
      examples_de: toLines(field('BeispieleDE')),
      examples_ru: toLines(field('BeispieleRU')),
      // Словарная форма существительного — это Singular, отдельной
      // колонки под её звук не нужно: audio_head и есть она.
      audio: {
        audio_head: soundFile(field('AudioSg')),
        audio_plural: soundFile(field('AudioPl')),
      },
    };
  }

  if (note.modelName === 'Глагол на немецком') {
    return {
      ...base,
      pos: 'verb',
      head: clean(field('Infinitiv')),
      translation: clean(field('Übersetzung')),
      form_ich: orNull(field('Ich')),
      form_du: orNull(field('Du')),
      form_er: orNull(field('ErSieEs')),
      form_wir: orNull(field('WirSieSie')),
      form_ihr: orNull(field('Ihr')),
      rektion: toLines(field('Rektion')),
      separable_prefix: orNull(field('Präfix')),
      register: orNull(field('Register')),
      stress_infinitive: orNull(field('BetonungInf')),
      examples_de: toLines(field('BeispieleDE')),
      examples_ru: toLines(field('BeispieleRU')),
      audio: {
        audio_head: soundFile(field('AudioInf')),
        audio_ich: soundFile(field('AudioIch')),
        audio_du: soundFile(field('AudioDu')),
        audio_er: soundFile(field('AudioEr')),
        audio_wir: soundFile(field('AudioWirSieSie')),
        audio_ihr: soundFile(field('AudioIhr')),
      },
    };
  }

  if (note.modelName === 'Прилагательное и наречие') {
    const wortart = clean(field('Wortart'));
    return {
      ...base,
      pos: POS_BY_WORTART[wortart] ?? 'adj',
      head: clean(field('Wort')),
      translation: clean(field('Übersetzung')),
      wortart: wortart || null,
      komparativ: orNull(field('Komparativ')),
      superlativ: orNull(field('Superlativ')),
      rule_status: ruleStatus(field('RegelStatus')),
      rule_label: clean(field('RegelLabel')),
      stress_word: orNull(field('BetonungWort')),
      examples_de: toLines(field('BeispieleDE')),
      examples_ru: toLines(field('BeispieleRU')),
      audio: {
        audio_head: soundFile(field('AudioWort')),
        audio_comparative: soundFile(field('AudioKomp')),
        audio_superlative: soundFile(field('AudioSup')),
      },
    };
  }

  if (note.modelName === 'Deutsch Typing v3') {
    const head = clean(field('answer'));
    return {
      ...base,
      pos: POS_BY_FUNCTION_WORD[head] ?? 'particle',
      head,
      translation: clean(field('ru')),
      definition: clean(field('usage_note')),
      examples_de: toLines(field('example_de')),
      examples_ru: toLines(field('example_ru')),
      audio: { audio_head: soundFile(field('display_answer')) },
    };
  }

  return null;
};
