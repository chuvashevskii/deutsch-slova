#!/usr/bin/env node
/**
 * Заливка черновых карточек — слов из частотного списка, которых нет
 * в готовой колоде.
 *
 * Черновик отличается от обычной карточки одним: у него нет отметки
 * о сверке (`confirmed_at`). Пока её нет, слово помечено в списке
 * и не попадает в «Учить» без отдельного разрешения.
 *
 * Скрипт **никогда не трогает сверенные строки**. Согласованная карточка
 * — это решение человека, и перезаписать её повторной заливкой значило бы
 * отменить его молча. Такие ранги пропускаются с предупреждением.
 *
 *   node scripts/import-drafts.mjs data/drafts/0001-0112.json
 *   node scripts/import-drafts.mjs data/drafts/*.json --remote
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));

if (!files.length) {
  console.error('Укажите файлы партий: node scripts/import-drafts.mjs data/drafts/*.json');
  process.exit(1);
}

/**
 * Куда заливаем. Правило то же, что у заливки словаря: локальный стек
 * спрашиваем у него самого, ключи на диске не держим; всё нелокальное
 * требует явного `--remote`, потому что служебный ключ обходит политики
 * и промахнуться проектом значит переписать чужой словарь.
 */
const target = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url || key) {
    if (!url || !key) {
      throw new Error('Заданы не обе переменные: нужны и SUPABASE_URL, и SUPABASE_SERVICE_ROLE_KEY.');
    }
    const host = new URL(url).hostname;
    const isLocal = host === '127.0.0.1' || host === 'localhost';
    if (!isLocal && !flags.has('--remote')) {
      throw new Error(
        `Цель не локальная (${host}). Это может быть прод — добавьте --remote, если правда хотите туда.`,
      );
    }
    return { url: url.replace(/\/$/, ''), key, label: host };
  }

  const status = JSON.parse(
    execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', maxBuffer: 1 << 24 }),
  );
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY, label: 'локальный стек' };
};

const { url, key, label } = target();

/**
 * Обязательные поля схемы, которых в партии нет. Пустая строка и ноль
 * здесь не заглушка «потом заполним», а то же, что стоит у карточек
 * из колоды: этих полей нет ни у одной.
 */
const TEMPLATE = {
  definition: '',
  frequency: 0,
  corpus_share: 0,
  singular: '',
  plural: '',
  genus: null,
  suffix: '',
  plural_ending: '',
  stress_singular: '',
  stress_plural: '',
  form_ich: null,
  form_du: null,
  form_er: null,
  form_wir: null,
  form_ihr: null,
  rektion: [],
  forms: [],
  separable_prefix: '',
  register: '',
  stress_infinitive: '',
  wortart: '',
  komparativ: '',
  superlativ: '',
  stress_word: '',
  // INFO: пустая строка здесь запрещена проверкой: род правила бывает
  // только m/f/n или отсутствует вовсе.
  rule_genus: null,
};

const rows = [];
for (const file of files) {
  const batch = JSON.parse(readFileSync(file, 'utf8'));
  for (const card of batch) {
    if (!card.rank || !card.pos || !card.head) {
      console.error(`× ${file}: у карточки нет rank, pos или head:`, card);
      process.exit(1);
    }
    rows.push({
      // INFO: идентификатор говорит о происхождении. У карточек из Anki
      // это номер заметки — числовая строка, так что столкнуться нельзя.
      //
      // Один ранг — одна карточка, поэтому ранга в идентификаторе хватает.
      // Но ранг в схеме не уникален: в колоде 95 рангов заняты двумя
      // карточками — разными значениями одного слова (finden — находить
      // и считать) или разными словами с общим номером (lang и lange).
      // Если такое понадобится и здесь, у карточки должен быть свой `id`;
      // без него вторая молча затёрла бы первую.
      id: card.id ?? `list-${String(card.rank).padStart(4, '0')}`,
      ...TEMPLATE,
      ...card,
      confirmed_at: null,
    });
  }
}

const seen = new Map();
for (const row of rows) {
  const clash = seen.get(row.id);
  if (clash) {
    console.error(
      `× одинаковый id «${row.id}»: «${clash}» и «${row.head}». ` +
        'Если на ранге правда две карточки, задайте каждой свой id в файле партии.',
    );
    process.exit(1);
  }
  seen.set(row.id, row.head);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const ranks = rows.map((row) => row.rank);
const { data: taken, error: takenError } = await db
  .from('words')
  .select('id, rank, head, confirmed_at')
  .in('rank', ranks);
if (takenError) {
  console.error('Не удалось проверить занятые ранги:', takenError.message);
  process.exit(1);
}

const confirmed = new Set(
  (taken ?? []).filter((row) => row.confirmed_at !== null).map((row) => row.rank),
);
const skipped = rows.filter((row) => confirmed.has(row.rank));
const going = rows.filter((row) => !confirmed.has(row.rank));

for (const row of skipped) {
  console.warn(`⚠ ранг ${row.rank} (${row.head}) уже занят сверенной карточкой — пропускаю`);
}

if (going.length) {
  const { error } = await db.from('words').upsert(going, { onConflict: 'id' });
  if (error) {
    console.error('Заливка не удалась:', error.message);
    process.exit(1);
  }
}

console.log(`[${label}] залито черновиков: ${going.length}; пропущено сверенных: ${skipped.length}`);
