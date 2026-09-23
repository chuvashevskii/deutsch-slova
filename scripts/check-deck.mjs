#!/usr/bin/env node
/**
 * Проверка всей колоды на однозначность ответа.
 *
 * Правило — «Карточка → Однозначность ответа»: на лице стоит русское
 * слово, поле ввода сверяется с заголовком своей карточки, и никаких
 * «тоже верно» там нет. Значит две карточки с одним переводом дают
 * ошибку за верный ответ.
 *
 * Проверка идёт по базе, а не по файлам партий: половина колоды пришла
 * из Anki и файлов не имеет, а правило про пересечение переводов
 * проверяется только на всей колоде сразу.
 *
 *   node scripts/check-deck.mjs
 *   node scripts/check-deck.mjs --list            подробности по находкам
 *   node scripts/check-deck.mjs --csv отчёт.csv   таблица для разбора
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const csvPath = (() => {
  const i = process.argv.indexOf('--csv');
  return i > -1 ? process.argv[i + 1] : null;
})();

/**
 * Куда смотрим. Правило то же, что у заливок: локальный стек спрашиваем
 * у него самого, всё нелокальное требует явного `--remote`. Проверка
 * ничего не пишет, но промахнуться проектом значит отчитаться о чужой
 * колоде как о своей.
 */
const target = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url || key) {
    if (!url || !key) {
      throw new Error('Нужны обе переменные: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.');
    }
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost' && !flags.has('--remote')) {
      throw new Error(`Цель не локальная (${host}). Добавьте --remote, если правда хотите туда.`);
    }
    return { url: url.replace(/\/$/, ''), key, label: host };
  }
  const status = JSON.parse(
    execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      maxBuffer: 1 << 24,
    }),
  );
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY, label: 'локальный стек' };
};

/**
 * Подписи части речи — те же, что видит человек на лице карточки
 * (`src/entities/word/model/types.ts`). Группировка идёт по подписи,
 * а не по `pos`: чип на лице и есть то, что разводит `Anfang` «Начало»
 * от `anfangen` «Начинать». «Прилагательное и наречие» — своя подпись,
 * поэтому и своя группа.
 */
const POS_LABEL = {
  noun: 'сущ.',
  verb: 'глаг.',
  adj: 'прил.',
  adverb: 'нареч.',
  pronoun: 'мест.',
  preposition: 'предл.',
  conjunction: 'союз',
  numeral: 'числ.',
  particle: 'част.',
};
const WORTART_LABEL = {
  'прилагательное': 'прил.',
  'наречие': 'нареч.',
  'прилагательное и наречие': 'прил. · нареч.',
  'вопросительное наречие': 'нареч.',
  'вопросительное местоимение': 'мест.',
  'формула вежливости': 'оборот',
  'устойчивый оборот': 'оборот',
  'предлог': 'предл.',
  'количественное слово': 'числ.',
};
const label = (w) => WORTART_LABEL[w.wortart ?? ''] ?? POS_LABEL[w.pos] ?? w.pos;

/** Таблицы отчёта — по ним же идут партии разбора. */
const TABLE = (w) => {
  if (w.pos === 'noun') return 'Существительные';
  if (w.pos === 'verb') return 'Глаголы';
  if (w.wortart === 'прилагательное и наречие') return 'Прилагательные и наречия';
  if (w.pos === 'adj') return 'Прилагательные';
  if (w.pos === 'adverb') return 'Наречия';
  return 'Служебные';
};

/** Поля, где пустая строка — расхождение: колода кладёт туда NULL. */
const NULLABLE = [
  'komparativ',
  'superlativ',
  'singular',
  'plural',
  'plural_ending',
  'suffix',
  'separable_prefix',
  'stress_word',
  'stress_infinitive',
  'stress_singular',
  'stress_plural',
  'register',
  'wortart',
];

const REGISTER_FORM = /^[a-zäöüß]+ · .+$/;
// Разделитель ключа: символ, которого не бывает в переводе.
const SEP = '\u0000';

/**
 * Перевод, приведённый к сравнимому виду: без разницы регистра и «ё».
 *
 * Уточнение в скобках **остаётся**. Сперва оно срезалось — казалось,
 * что «Звонить по телефону (не klingeln)» и «Звонить по телефону» —
 * один и тот же вопрос. Замер показал обратное: срезание создавало
 * 39 ложных групп, и почти все — там, где скобка ровно и разводит
 * слова: `Arzt` «Врач» против `Ärztin` «Врач (женщина)`,
 * `arbeiten` «Работать» против `funktionieren` «Работать (о механизме)».
 *
 * Правило проверяет то, что человек видит на лице карточки. Скобка
 * видна, значит и считается.
 */
const normalize = (t) =>
  t
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

const variants = (t) =>
  normalize(t)
    .split('/')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Страница поменьше и отступ при обрыве.
 *
 * Тысяча строк по двадцати колонкам — полтора мегабайта на запрос,
 * и по сети облако такой ответ иногда обрывает: `TypeError: terminated`.
 * Локально это незаметно, а проверка прода падала на полпути — как раз
 * там, где она нужнее всего. Пятьсот строк проходят, а три попытки
 * с удвоением паузы закрывают случайный обрыв.
 */
const PAGE = 500;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const fetchPage = async (db, columns, from) => {
  let wait = 500;
  for (let attempt = 1; ; attempt += 1) {
    const { data, error } = await db
      .from('words')
      .select(columns)
      .order('id')
      .range(from, from + PAGE - 1);
    if (!error) return data;
    if (attempt >= 3) throw new Error(`строки ${from}–${from + PAGE - 1}: ${error.message}`);
    await sleep(wait);
    wait *= 2;
  }
};

const fetchAll = async (db) => {
  const rows = [];
  const columns = `id, head, pos, wortart, translation, register, definition, rank, confirmed_at, examples_de, rektion, ${NULLABLE.join(', ')}`;
  for (let from = 0; ; from += PAGE) {
    const data = await fetchPage(db, columns, from);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
};

const { url, key, label: where } = target();
const words = await fetchAll(createClient(url, key, { auth: { persistSession: false } }));

// ── Проверка 1. Формат пометы ───────────────────────────────────────────
const badRegister = words.filter((w) => w.register !== null && !REGISTER_FORM.test(w.register));

// ── Проверка 2. Пустые строки там, где колода кладёт NULL ───────────────
const blanks = [];
for (const w of words) {
  for (const field of NULLABLE) if (w[field] === '') blanks.push({ w, field });
}

// ── Проверка 3. Пересечение переводов ───────────────────────────────────
// Группа — слова с общим вариантом перевода и одной подписью части речи.
const groups = new Map();
for (const w of words) {
  for (const v of variants(w.translation)) {
    const gkey = `${label(w)}${SEP}${v}`;
    if (!groups.has(gkey)) groups.set(gkey, { label: label(w), variant: v, cards: [] });
    const g = groups.get(gkey);
    if (!g.cards.some((c) => c.id === w.id)) g.cards.push(w);
  }
}

/** Чем карточка отличается от соседа по переводу. */
const differentiator = (w) => `${w.register ?? ''}${SEP}${(w.definition ?? '').trim()}`;

const collisions = [];
for (const g of groups.values()) {
  if (g.cards.length < 2) continue;
  const missing = g.cards.filter((w) => !w.register && !(w.definition ?? '').trim());
  const keys = g.cards.map(differentiator);
  const clashing = keys.length !== new Set(keys).size;
  if (missing.length || clashing) collisions.push({ ...g, missing, clashing });
}

// ── Проверка 4. Подсказка занята делом ──────────────────────────────────
//
// Справочник ставит подсказке два разных вопроса и требует проверять оба:
// «указывает ли перевод на нужное слово» и «понятно ли из перевода,
// что слово значит». Первый закрывается соседом по переводу, второй —
// нет: `passen` «Подходить» указывает однозначно, но не объясняет,
// что подходит по размеру, а не «приближается».
//
// Поэтому список **не нарушение**, а повод перечитать: подсказка без
// соседа обязана отвечать на второй вопрос. Если не отвечает — она
// пересказ перевода, как было у `und` «И» → «соединяет слова или части
// предложения», и её место пусто.
//
// Сосед бывает двух родов: по переводу (два слова отвечают на один вопрос)
// и по заголовку (одно немецкое слово, две карточки на разные значения —
// `Eis` лёд и мороженое).
const inGroup = new Set();
for (const g of groups.values()) {
  if (g.cards.length > 1) for (const w of g.cards) inGroup.add(w.id);
}
const headCount = new Map();
for (const w of words) headCount.set(w.head, (headCount.get(w.head) ?? 0) + 1);

const idleDefinition = words.filter(
  (w) =>
    (w.definition ?? '').trim() &&
    !inGroup.has(w.id) &&
    (headCount.get(w.head) ?? 0) < 2,
);

// ── Проверка 5. Помета не живёт в подсказке ─────────────────────────────
//
// У `furchtbar` подсказка состояла из слова «разговорное», у `dumm` —
// из слова «нейтральное». Это помета, а не подсказка, и место ей
// в `register`: иначе чип на лице не появится, а правило «помета
// обязательна у всех в группе» проверить нечем — половина помет
// лежит в другом поле.
const REGISTER_WORDS = /разговорн|нейтральн|книжн|грубо|просторечн|формальн/i;
const registerInDefinition = words.filter((w) => REGISTER_WORDS.test((w.definition ?? '').trim()));

// ── Проверка 6. Карточка показывает то, что просит ──────────────────────
//
// У `mancher` оба примера стояли в других формах — «Manche Leute»,
// «Manches versteht man» — а ввести карточка просила `mancher`. Человек
// печатал ту форму, которой его и учили, и получал ошибку.
//
// Проверка касается только слов, у которых заголовок — обычная, живая
// форма: местоимений, частиц, союзов, предлогов, наречий. У глагола
// в примерах стоят спряжённые формы, у существительного — падежные,
// и требовать там дословного совпадения значило бы требовать неживых
// предложений.
const SHOWS_HEAD = new Set(['pronoun', 'particle', 'conjunction', 'preposition', 'adverb']);

// INFO: проверка молча пропускает карточку без примеров, и однажды это
// сделало её пустой: `examples_de` не было в списке запрашиваемых
// колонок, примеры у всех оказались пусты, и проверка отчиталась нулём
// нарушений, не посмотрев ни на одну карточку. Счётчик рассмотренных
// не даёт этому повториться.
let headChecked = 0;
const headUnseen = words.filter((w) => {
  if (!SHOWS_HEAD.has(w.pos)) return false;
  const examples = (w.examples_de ?? []).join(' ').toLowerCase();
  if (!examples.trim()) return false;
  headChecked += 1;
  // INFO: границы слова — по буквам немецкого алфавита: `\b` не считает
  // ä, ö, ü, ß буквами и рвёт слово посередине.
  //
  // Парный союз пишется в заголовке с многоточием — `weder … noch`, —
  // и целиком в предложении не встречается никогда. Ищутся обе половины
  // по отдельности: карточка показывает союз, если показала оба слова.
  const parts = w.head
    .toLowerCase()
    .replace(/^sich\s+/, '')
    .split('…')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.some((part) => {
    const at = new RegExp(`(?<![a-zäöüß])${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zäöüß])`);
    return !at.test(examples);
  });
});

// ── Проверка 7. Управление показано в примерах ──────────────────────────
//
// Карточка объявляет, с каким предлогом живёт глагол, — и обязана это
// показать. `wirken` заявляет `auf`, оба примера без него; человек
// заучивает слово, но не то, как его пристроить в предложение.
//
// Ищется только предложное управление: падеж без предлога («etwas
// (Akk.)») в предложении буквой не выражен, и проверить его строкой
// нельзя.
const PREP_MODEL = /^\s*([a-zäöüA-ZÄÖÜ]+)\s+(?:etw|jmdm|jmdn|sich)/;
let rektionChecked = 0;
const rektionUnseen = words.filter((w) => {
  if (w.pos !== 'verb') return false;
  const preps = (w.rektion ?? [])
    .map((model) => PREP_MODEL.exec(model)?.[1]?.toLowerCase())
    .filter(Boolean);
  if (!preps.length) return false;
  const examples = (w.examples_de ?? []).join(' ').toLowerCase();
  if (!examples.trim()) return false;
  rektionChecked += 1;
  // INFO: предлог слипается с местоимением — `darüber`, `damit`, —
  // и там управление показано. Границу слева не требуем.
  return !preps.some((prep) => new RegExp(`${prep}(?![a-zäöüß])`).test(examples));
});

// ── Проверка 8. Множественное показано в примерах ───────────────────────
//
// Карточка просит напечатать множественное число, а показать его
// не обязана ничем. Из 1040 существительных с множественным 87%
// показывают — остальные просят форму, которой человек не видел.
let pluralChecked = 0;
const pluralUnseen = words.filter((w) => {
  if (w.pos !== 'noun' || !w.plural) return false;
  const plural = w.plural.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
  if (!plural) return false;
  const examples = (w.examples_de ?? []).join(' ').toLowerCase();
  if (!examples.trim()) return false;
  pluralChecked += 1;
  return !new RegExp(`(?<![a-zäöüß])${plural}(?![a-zäöüß])`).test(examples);
});

// ── Проверка 9. Примеры карточки не близнецы ────────────────────────────
//
// Два примера даются, чтобы показать слово дважды по-разному. Если они
// отличаются одним словом — «Wir buchen eine Tour» и «Wir buchen zwei
// Touren», — второй не добавляет ничего.
let twinsChecked = 0;
const twinExamples = words.filter((w) => {
  const examples = w.examples_de ?? [];
  if (examples.length !== 2) return false;
  twinsChecked += 1;
  const [a, b] = examples.map((s) => new Set(s.toLowerCase().split(/\s+/)));
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(a.size, b.size) > 0.6;
});

// ── Проверка 10. Форма дефиниции ────────────────────────────────────────
// Не блокирующая: в колоде из Anki дефиниции длиннее правила, и обрезать
// их механически значит потерять то, ради чего они написаны.
const badDefinition = [];
for (const w of words) {
  const d = (w.definition ?? '').trim();
  if (!d) continue;
  const problems = [];
  const count = d.split(/\s+/).length;
  if (count < 2) problems.push('меньше двух слов');
  if (count > 5) problems.push(`${count} слов вместо 2–5`);
  if (d[0] !== d[0].toLowerCase()) problems.push('с заглавной');
  if (d.endsWith('.')) problems.push('с точкой на конце');
  if (d.toLowerCase().includes(w.head.toLowerCase())) problems.push('содержит сам ответ');
  if (problems.length) badDefinition.push({ w, problems });
}

// ── Отчёт ───────────────────────────────────────────────────────────────
const drafts = words.filter((w) => !w.confirmed_at).length;
const say = (ok, text) => console.log(`${ok ? '  ✓' : '  ✗'} ${text}`);

console.log(`\nКолода: ${words.length} слов (${drafts} черновиков) — ${where}\n`);

console.log('Блокирующие проверки');
say(!badRegister.length, `формат пометы: ${badRegister.length} нарушений`);
say(!blanks.length, `пустые строки вместо NULL: ${blanks.length}`);
say(!collisions.length, `переводы без различителя: ${collisions.length} групп`);

console.log('\nОтчётные');
say(!headUnseen.length, `карточка просит форму, которой не показывает: ${headUnseen.length} (рассмотрено ${headChecked})`);
console.log(`  · подсказка без соседа по переводу: ${idleDefinition.length} — перечитать, объясняют ли значение`);
say(!registerInDefinition.length, `помета в поле подсказки: ${registerInDefinition.length}`);
say(!rektionUnseen.length, `управление не показано в примерах: ${rektionUnseen.length} (рассмотрено ${rektionChecked})`);
say(!pluralUnseen.length, `множественное не показано в примерах: ${pluralUnseen.length} (рассмотрено ${pluralChecked})`);
say(!twinExamples.length, `примеры-близнецы: ${twinExamples.length} (рассмотрено ${twinsChecked})`);
say(!badDefinition.length, `форма дефиниции: ${badDefinition.length} нарушений`);

if (collisions.length) {
  const byTable = new Map();
  let cards = new Set();
  for (const c of collisions) {
    const t = TABLE(c.cards[0]);
    byTable.set(t, (byTable.get(t) ?? 0) + 1);
    for (const w of c.cards) cards.add(w.id);
  }
  console.log(`\nГруппы без различителя — ${cards.size} карточек:`);
  for (const [t, n] of [...byTable].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${n}`);
}

if (flags.has('--list')) {
  for (const c of collisions.slice(0, 200)) {
    const why = c.missing.length
      ? `без различителя: ${c.missing.map((w) => w.head).join(', ')}`
      : 'различители совпадают';
    console.log(`\n  «${c.variant}» · ${c.label} — ${why}`);
    for (const w of c.cards) {
      console.log(`     ${w.head.padEnd(20)} ${w.translation.padEnd(34)} ${w.register ?? '—'}`);
    }
  }
  for (const w of idleDefinition) {
    console.log(`  без соседа: ${w.head.padEnd(18)} «${w.translation}» — «${w.definition}»`);
  }
  for (const w of headUnseen) {
    console.log(`  просит, но не показывает: ${w.head.padEnd(16)} «${(w.examples_de ?? []).join(' | ')}»`);
  }
  for (const w of rektionUnseen) {
    console.log(`  управление не показано: ${w.head.padEnd(16)} [${(w.rektion ?? []).join(', ')}] «${(w.examples_de ?? []).join(' | ')}»`);
  }
  for (const w of pluralUnseen) {
    console.log(`  мн. не показано: ${w.head.padEnd(18)} ${w.plural} «${(w.examples_de ?? []).join(' | ')}»`);
  }
  for (const w of twinExamples) {
    console.log(`  близнецы: ${w.head.padEnd(16)} «${(w.examples_de ?? []).join('» / «')}»`);
  }
  for (const w of registerInDefinition) {
    console.log(`  помета в подсказке: ${w.head.padEnd(14)} «${w.definition}»`);
  }
  for (const b of badDefinition.slice(0, 60)) {
    console.log(`  ${b.w.head.padEnd(20)} ${b.problems.join(', ')} — «${b.w.definition}»`);
  }
}

if (csvPath) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['таблица,вариант,подпись,слово,перевод,помета,дефиниция,черновик,причина'];
  for (const c of collisions) {
    for (const w of c.cards) {
      lines.push(
        [
          TABLE(w),
          c.variant,
          c.label,
          w.head,
          w.translation,
          w.register,
          w.definition,
          w.confirmed_at ? 'нет' : 'да',
          c.missing.length ? 'нет различителя' : 'различители совпадают',
        ]
          .map(esc)
          .join(','),
      );
    }
  }
  writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`\nТаблица: ${csvPath} (${lines.length - 1} строк)`);
}

const failed = badRegister.length + blanks.length + collisions.length;
console.log(failed ? `\nПроверка не пройдена: ${failed} находок\n` : '\nПроверка пройдена\n');
process.exit(failed ? 1 : 0);
