import {
  areTwins,
  definitionProblems,
  detectPrefix,
  prefixDetached,
  prefixFits,
  headShown,
  pluralShown,
  prepositionShown,
  prepositionsOf,
  REGISTER_FORM,
} from '@/shared/lib/deckRules';

/**
 * Часть речи так, как её размечает колода.
 *
 * Пара, а не одно поле: `pos` разбирают запросы и планировщик, `wortart`
 * — подпись, по которой карточки группируются при поиске столкновений.
 * У существительных и глаголов подписи нет, у наречий и прилагательных
 * есть, и заводить карточку надо ровно так же — иначе своя карточка
 * попадёт в отдельную группу и столкновения перевода никто не заметит.
 */
export interface WordKind {
  value: string;
  title: string;
  pos: string;
  wortart: string | null;
  /** Подпись группы — по ней ищутся соседи по переводу. */
  label: string;
  asks: Array<'genus' | 'grade' | 'rektion' | 'forms'>;
}

export const WORD_KINDS: WordKind[] = [
  {
    value: 'noun',
    title: 'Существительное',
    pos: 'noun',
    wortart: null,
    label: 'noun',
    asks: ['genus'],
  },
  {
    value: 'verb',
    title: 'Глагол',
    pos: 'verb',
    wortart: null,
    label: 'verb',
    asks: ['rektion', 'forms'],
  },
  {
    value: 'adj',
    title: 'Прилагательное',
    pos: 'adj',
    wortart: 'прилагательное',
    label: 'прилагательное',
    asks: ['grade'],
  },
  {
    value: 'adj-adv',
    title: 'Прилагательное и наречие',
    pos: 'adj',
    wortart: 'прилагательное и наречие',
    label: 'прилагательное и наречие',
    asks: ['grade'],
  },
  {
    value: 'adverb',
    title: 'Наречие',
    pos: 'adverb',
    wortart: 'наречие',
    label: 'наречие',
    asks: [],
  },
  {
    value: 'pronoun',
    title: 'Местоимение',
    pos: 'pronoun',
    wortart: null,
    label: 'pronoun',
    asks: [],
  },
  {
    value: 'preposition',
    title: 'Предлог',
    pos: 'preposition',
    wortart: 'предлог',
    label: 'предлог',
    asks: [],
  },
  {
    value: 'conjunction',
    title: 'Союз',
    pos: 'conjunction',
    wortart: null,
    label: 'conjunction',
    asks: [],
  },
  {
    value: 'particle',
    title: 'Частица',
    pos: 'particle',
    wortart: null,
    label: 'particle',
    asks: [],
  },
  {
    value: 'numeral',
    title: 'Числительное',
    pos: 'numeral',
    wortart: 'количественное слово',
    label: 'количественное слово',
    asks: [],
  },
];

/** Черновик карточки в том виде, в каком его держит форма. */
export interface WordDraft {
  head: string;
  part: string;
  translation: string;
  genus: string;
  singular: string;
  plural: string;
  komparativ: string;
  superlativ: string;
  rektion: string[];
  formIch: string;
  formDu: string;
  formEr: string;
  formWir: string;
  formIhr: string;
  register: string;
  definition: string;
  examplesDe: [string, string];
  examplesRu: [string, string];
  /** Отделяемый ли глагол. Галочка, а не догадка: `umfahren` бывает обоим. */
  separable: boolean;
  separablePrefix: string;
}

export const emptyDraft = (head = ''): WordDraft => ({
  head,
  part: 'noun',
  translation: '',
  genus: '',
  singular: '',
  plural: '',
  komparativ: '',
  superlativ: '',
  rektion: [],
  formIch: '',
  formDu: '',
  formEr: '',
  formWir: '',
  formIhr: '',
  register: 'neutral · нейтральный',
  definition: '',
  examplesDe: ['', ''],
  examplesRu: ['', ''],
  separable: false,
  separablePrefix: '',
});

/**
 * Лица настоящего времени — в том же порядке, в каком их показывает
 * оборот карточки (`VERB_PERSONS`). Порядок не косметика: человек
 * заполняет форму, глядя на ту же таблицу, которую потом увидит.
 */
export const VERB_FORM_FIELDS = [
  { key: 'formIch', column: 'form_ich', label: 'ich' },
  { key: 'formDu', column: 'form_du', label: 'du' },
  { key: 'formEr', column: 'form_er', label: 'er/sie/es' },
  { key: 'formWir', column: 'form_wir', label: 'wir/sie/Sie' },
  { key: 'formIhr', column: 'form_ihr', label: 'ihr' },
] as const satisfies ReadonlyArray<{ key: keyof WordDraft; column: string; label: string }>;

/** Готовые модели управления: руками их набирать негде и незачем. */
export const REKTION_MODELS = [
  'ohne Objekt',
  'etwas (Akk.)',
  'jemanden (Akk.)',
  'jemandem (Dat.)',
  'an etw. (Dat.)',
  'auf etw. (Akk.)',
  'für etw. (Akk.)',
  'in etw. (Dat.)',
  'mit etw. (Dat.)',
  'nach etw. (Dat.)',
  'über etw. (Akk.)',
  'um etw. (Akk.)',
  'von etw. (Dat.)',
  'vor etw. (Dat.)',
  'zu etw. (Dat.)',
  'sich (Akk.)',
  'sich (Akk.) auf etw. (Akk.)',
  'sich (Akk.) für etw. (Akk.)',
  'sich (Akk.) über etw. (Akk.)',
  'sich (Akk.) von etw. (Dat.)',
];

/**
 * Замечание к карточке.
 *
 * Два уровня — те же, что в проверке колоды: блокирующее не даёт завести
 * карточку, отчётное предупреждает и пропускает. Так форма и скрипт
 * говорят об одном одними словами.
 */
export interface Finding {
  level: 'блок' | 'замечание';
  text: string;
}

export const kindOf = (value: string): WordKind =>
  WORD_KINDS.find((p) => p.value === value) ?? WORD_KINDS[0];

/** Карточка, с которой новая делит перевод. */
export interface Neighbour {
  id: string;
  head: string;
  translation: string;
  register: string | null;
  definition: string | null;
}

/** Чем карточка отличается от соседа по переводу — помета плюс подсказка. */
const differentiator = (register: string | null, definition: string | null) =>
  JSON.stringify([(register ?? '').trim(), (definition ?? '').trim()]);

/**
 * Что не так с карточкой.
 *
 * Правила берутся из общего модуля, а не пишутся здесь заново: форма
 * и проверка колоды разъехались бы на первой же правке, а это ровно
 * та болезнь, которую в колоде и лечили.
 */
export const checkDraft = (draft: WordDraft, neighbours: Neighbour[]): Finding[] => {
  const out: Finding[] = [];
  const kind = kindOf(draft.part);
  const head = draft.head.trim();
  const examples = draft.examplesDe.join(' ').toLowerCase();
  const filledPairs = [0, 1].filter(
    (i) => draft.examplesDe[i].trim() && draft.examplesRu[i].trim(),
  );

  if (!head) out.push({ level: 'блок', text: 'Нет самого слова' });
  if (!draft.translation.trim()) out.push({ level: 'блок', text: 'Нет перевода' });

  if (!draft.register.trim()) {
    out.push({ level: 'блок', text: 'Не выбрана помета регистра' });
  } else if (!REGISTER_FORM.test(draft.register.trim())) {
    out.push({ level: 'блок', text: 'Помета написана не по формату' });
  }

  if (filledPairs.length < 2) {
    out.push({
      level: 'блок',
      text: `Примеров ${filledPairs.length} из двух — нужны оба, вместе с переводом`,
    });
  }

  // INFO: самое дорогое при заведении руками. Человек потом увидит
  // на экране «Уверенность» и не поймёт, какое из двух слов от него
  // хотят. Различитель — помета или подсказка, как в справочнике.
  //
  // Условий два, и второе легко потерять — так и вышло, поймали
  // на стенде. Проверка колоды метит группу не только когда различители
  // совпали, но и когда у кого-то в ней нет ни пометы, ни подсказки:
  // такая карточка неотличима от любой соседки. Форма обязана судить
  // так же, иначе заведённое здесь тут же всплывёт в проверке.
  const mine = differentiator(draft.register, draft.definition);
  for (const n of neighbours) {
    const bare = !(n.register ?? '').trim() && !(n.definition ?? '').trim();
    if (bare) {
      out.push({
        level: 'блок',
        text: `У «${n.head}» тот же перевод и нет ни пометы, ни подсказки — рядом с вашей карточкой их будет не различить. Сначала надо дополнить «${n.head}» или взять другой перевод`,
      });
    } else if (differentiator(n.register, n.definition) === mine) {
      out.push({
        level: 'блок',
        text: `«${n.head}» переводится так же, и различить их нечем — нужна другая помета или подсказка`,
      });
    } else {
      out.push({
        level: 'замечание',
        text: `Так же переводится «${n.head}» — различает ${(n.definition ?? '').trim() ? 'подсказка' : 'помета'}`,
      });
    }
  }

  if (kind.asks.includes('genus') && !draft.genus) {
    out.push({ level: 'замечание', text: 'У существительного не выбран род' });
  }

  const plural = draft.plural
    .trim()
    .replace(/^die\s+/i, '')
    .toLowerCase();
  if (plural && examples.trim() && !pluralShown(plural, examples)) {
    out.push({
      level: 'замечание',
      text: 'Множественное заявлено, но в примерах его нет — карточка попросит форму, которой человек не видел',
    });
  }

  const preps = prepositionsOf(draft.rektion);
  if (preps.length && examples.trim() && !preps.some((p) => prepositionShown(p, examples))) {
    out.push({ level: 'замечание', text: 'Управление заявлено, а предлога в примерах нет' });
  }

  if (filledPairs.length === 2 && areTwins(draft.examplesDe[0], draft.examplesDe[1])) {
    out.push({
      level: 'замечание',
      text: 'Примеры отличаются одним словом — второй ничего не добавляет',
    });
  }

  if (head && examples.trim() && !headShown(head, examples)) {
    out.push({ level: 'замечание', text: 'Самого слова в примерах нет' });
  }

  // INFO: блокирующие, а не отчётные. Подсказка — единственное поле,
  // где оформление задано целиком: в колоде из 74 подсказок ни одна
  // не написана с заглавной, ни одна не кончается точкой, ни одна
  // не вышла за два-пять слов. Это не пожелание, а действующая норма,
  // и пропускать её нарушение через форму значит заводить исключение
  // там, где исключений нет.
  //
  // Поле необязательное: пустая подсказка замечаний не даёт вовсе.
  // Строгость начинается с того, что человек что-то написал.
  // INFO: спряжение необязательно целиком, и частично заполненное —
  // замечание, а не блок. Пустое лицо в колоде значит «формы не бывает»:
  // `regnen`, `schneien`, `es gibt` живут только в третьем лице, и
  // одиннадцать глаголов заполнены частично именно поэтому. Блокировать
  // значило бы требовать выдумать «ich regne».
  //
  // Но промолчать тоже нельзя: у остальных 699 глаголов заполнены все
  // пять, и частичное заполнение куда чаще «не дописал», чем «не бывает».
  if (kind.asks.includes('forms')) {
    const filled = VERB_FORM_FIELDS.filter((f) => draft[f.key].toString().trim());
    if (filled.length && filled.length < VERB_FORM_FIELDS.length) {
      const empty = VERB_FORM_FIELDS.filter((f) => !draft[f.key].toString().trim())
        .map((f) => f.label)
        .join(', ');
      out.push({
        level: 'замечание',
        text: `Спряжение заполнено не до конца — пусто у ${empty}. Оставьте так, если формы не бывает, как у «regnen»`,
      });
    }
  }

  // INFO: приставка проверяется жёстко, потому что ошибка здесь немая.
  // `infinitiveSegments` подсвечивает приставку только когда она совпала
  // с началом слова; не совпав — молчит. Человек написал бы «auf»
  // у `bekommen`, увидел бы обычное слово и не понял, что пропало.
  if (draft.separable && kind.asks.includes('forms')) {
    const prefix = draft.separablePrefix.trim();
    if (!prefix) {
      out.push({ level: 'блок', text: 'Глагол отмечен отделяемым, а приставка не указана' });
    } else if (!prefixFits(head, prefix)) {
      out.push({
        level: 'блок',
        text: `«${head || 'Слово'}» не начинается с «${prefix}» — приставка не подсветится`,
      });
    } else {
      // В колоде у всех 145 отделяемых личные формы записаны с оторванной
      // приставкой: «steht auf», «findet statt». Слитная означала бы, что
      // глагол на самом деле неотделяемый. Замечание, а не блок: форма
      // бывает и длиннее одного слова — у «es gibt» это видно.
      const stuck = VERB_FORM_FIELDS.filter(
        (f) => draft[f.key].toString().trim() && !prefixDetached(draft[f.key].toString(), prefix),
      );
      if (stuck.length) {
        out.push({
          level: 'замечание',
          text: `У ${stuck.map((f) => f.label).join(', ')} приставка не оторвана — в колоде пишут «steht auf», а не «aufsteht»`,
        });
      }
    }
  }

  for (const problem of definitionProblems(draft.definition, head)) {
    out.push({ level: 'блок', text: `Подсказка: ${problem}` });
  }

  return out;
};

/** Приставка, которую стоит предложить, когда человек поставил галочку. */
export const suggestPrefix = (head: string) => detectPrefix(head.trim());

/** Карточку можно заводить, когда блокирующих замечаний нет. */
export const isReady = (findings: Finding[]) => !findings.some((f) => f.level === 'блок');

/** То, что уходит в функцию базы. */
export const toPayload = (draft: WordDraft) => {
  const kind = kindOf(draft.part);
  return {
    head: draft.head.trim(),
    translation: draft.translation.trim(),
    pos: kind.pos,
    wortart: kind.wortart,
    genus: kind.asks.includes('genus') ? draft.genus : '',
    singular: draft.singular.trim(),
    plural: draft.plural.trim(),
    komparativ: draft.komparativ.trim(),
    superlativ: draft.superlativ.trim(),
    rektion: draft.rektion,
    // INFO: лица уходят всегда, даже пустыми: база сама переводит
    // пустую строку в NULL, и пустое лицо у глагола — это «формы
    // не бывает», а не «поле забыли».
    ...Object.fromEntries(
      VERB_FORM_FIELDS.map((f) => [
        f.column,
        kind.asks.includes('forms') ? draft[f.key].toString().trim() : '',
      ]),
    ),
    separable_prefix:
      kind.asks.includes('forms') && draft.separable ? draft.separablePrefix.trim() : '',
    register: draft.register.trim(),
    definition: draft.definition.trim(),
    examples_de: draft.examplesDe.map((s) => s.trim()).filter(Boolean),
    examples_ru: draft.examplesRu.map((s) => s.trim()).filter(Boolean),
  };
};
