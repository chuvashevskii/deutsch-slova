#!/usr/bin/env node
/**
 * Заливка словаря из живой коллекции Anki в базу приложения.
 *
 * Скрипт повторяемый, а не одноразовый: правите карточку в Anki, гоняете
 * снова — база догоняет. Ключ строки — идентификатор заметки Anki, поэтому
 * повторный прогон обновляет слово, а не заводит второе.
 *
 * Источник правды — коллекция Anki. В репозитории ни словаря, ни озвучки
 * нет: репозиторий публичный, а это личное содержимое.
 *
 *   node scripts/import-anki.mjs [--skip-audio] [--force-audio] [--dry-run]
 *
 * Требуется: запущенный Anki с AnkiConnect и поднятый локальный Supabase.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, extname } from 'node:path';

import { noteToWord, WORD_MODELS, PHRASE_MODEL, DRAFT_DECK } from './anki-fields.mjs';

const ANKI = 'http://127.0.0.1:8765';
const MEDIA = join(homedir(), 'Library/Application Support/Anki2/User 1/collection.media');
const RANK_MAP = 'data/rank-map.csv';
const BUCKET = 'audio';

const flags = new Set(process.argv.slice(2));
const log = (...parts) => console.log(...parts);

/* ─────────────────────────── правки рангов ─────────────────────────────
 * Ранги пришли из сопоставления с частотным списком 1–4500. Ниже — те
 * места, где сопоставление автоматом не сработало, а слово в списке есть.
 * Таблица лежит в коде намеренно: это решения, их надо видеть и можно
 * оспорить, а не прятать в выгрузке.
 *
 * Ключ — заголовок так, как он записан в data/rank-map.csv. Скрипт
 * проверяет, что каждый ключ попал ровно в одну заметку, и падает иначе:
 * молча промахнуться такой таблице нельзя.
 */
const RANK_OVERRIDES = {
  // Женские формы профессий. В списке есть только мужская форма — это
  // устройство списка, а не пропуск. Ранг наследуется от мужской формы,
  // и пара встаёт в очереди рядом, что для заучивания только к лучшему.
  'die Schülerin': 669, 'die Chefin': 674, 'die Nachbarin': 787, 'die Kundin': 846,
  'die Kollegin': 899, 'die Künstlerin': 1125, 'die Partnerin': 1269, 'die Studentin': 1359,
  'die Mitarbeiterin': 1411, 'die Professorin': 1457, 'die Fahrerin': 2106,
  'die Einwohnerin': 2525, 'die Verkäuferin': 2609, 'die Rentnerin': 2629,
  'die Ausländerin': 3020, 'die Arbeitgeberin': 3053, 'die Enkelin': 3142,
  'die Architektin': 3226, 'die Beamtin': 3233, 'die Musikerin': 3249,
  'die Ingenieurin': 3261, 'die Sekretärin': 3814, 'die Historikerin': 4050,
  'die Managerin': 4359, 'die Touristin': 4454, 'die Juristin': 4480,

  // В колоде слово заведено только во множественном, в списке — в единственном.
  'die Nachrichten': 319, 'die Papiere': 836, 'die Süßigkeiten': 2238,
  'die Pommes frites': 1732,

  // В колоде слово с довеском или в другой форме, в списке — голое.
  'ein bisschen': 61, 'ein paar': 159, 'lange': 59, 'später': 105,
  'darauf': 497, 'darüber': 1491, 'noch einmal': 2862,

  // «Грядущее» подтянулось к «der Morgen» (утро, 263): род не совпадает,
  // это разные слова. Ранга у него быть не должно — «утро» остаётся с 263.
  'das Morgen': null,
};

/* ──────────────────────────── вспомогательное ─────────────────────────── */

const anki = async (action, params = {}) => {
  const response = await fetch(ANKI, {
    method: 'POST',
    body: JSON.stringify({ action, version: 6, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`AnkiConnect ${action}: ${body.error}`);
  return body.result;
};

/** Ключи локального стека берутся у самого стека — на диске их не держим. */
const supabaseConfig = () => {
  const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    maxBuffer: 1 << 24,
  }));
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
};

/** Разбор CSV с кавычками: в переводах встречаются запятые. */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((row) => row.length > 1);
  return body.map((values) => Object.fromEntries(header.map((name, i) => [name.replace(/^﻿/, ''), values[i] ?? ''])));
};

const limitConcurrency = async (items, limit, worker) => {
  const queue = [...items.entries()];
  const results = [];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      results[next[0]] = await worker(next[1]);
    }
  });
  await Promise.all(runners);
  return results;
};

/* ──────────────────────────────── ранги ───────────────────────────────── */

const loadRanks = () => {
  if (!existsSync(RANK_MAP)) {
    throw new Error(`Нет ${RANK_MAP}. Это выгрузка сопоставления с частотным списком.`);
  }
  const rows = parseCsv(readFileSync(RANK_MAP, 'utf8'));
  const byNote = new Map();
  const noteByHead = new Map();
  for (const row of rows) {
    byNote.set(row.note_id, row.rank === '' ? null : Number(row.rank));
    const seen = noteByHead.get(row.head);
    noteByHead.set(row.head, seen ? [...seen, row.note_id] : [row.note_id]);
  }

  const applied = [];
  for (const [head, rank] of Object.entries(RANK_OVERRIDES)) {
    const notes = noteByHead.get(head);
    if (!notes || notes.length !== 1) {
      throw new Error(
        `Правка ранга «${head}» попала в ${notes?.length ?? 0} заметок вместо одной. ` +
        'Таблица правок разошлась с колодой — поправьте её, прежде чем заливать.',
      );
    }
    byNote.set(notes[0], rank);
    applied.push(head);
  }
  log(`  правок ранга применено: ${applied.length}`);
  return byNote;
};

/* ──────────────────────────────── озвучка ─────────────────────────────── */

const AUDIO_SLOTS = [
  'audio_head', 'audio_plural',
  'audio_ich', 'audio_du', 'audio_er', 'audio_wir', 'audio_ihr',
  'audio_comparative', 'audio_superlative',
];

/**
 * Восемь файлов в коллекции записаны в AIFF, и Chrome его не играет.
 * ffmpeg в системе нет, зато есть встроенный afconvert.
 */
const convertedCache = new Map();
const toPlayable = (file, workDir) => {
  if (extname(file).toLowerCase() !== '.aiff') return { path: join(MEDIA, file), ext: extname(file).toLowerCase() };
  if (convertedCache.has(file)) return convertedCache.get(file);
  const target = join(workDir, `${createHash('sha1').update(file).digest('hex')}.m4a`);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', join(MEDIA, file), target]);
  const result = { path: target, ext: '.m4a' };
  convertedCache.set(file, result);
  return result;
};

const CONTENT_TYPE = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const existingObjects = async ({ url, key }) => {
  const seen = new Set();
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await response.json();
    if (!Array.isArray(page) || page.length === 0) return seen;
    for (const item of page) seen.add(item.name);
    if (page.length < 1000) return seen;
  }
};

/* ──────────────────────────────── заливка ─────────────────────────────── */

/**
 * Пачечная запись в PostgREST требует одинакового набора ключей во всех
 * строках, а набор полей у существительного и глагола разный. Поэтому
 * каждая строка приводится к полному шаблону: чего нет — то пусто.
 *
 * Значения по умолчанию повторяют умолчания схемы: колонки объявлены
 * «not null default», и прислать туда null нельзя.
 */
const WORD_TEMPLATE = {
  id: null, rank: null, pos: null, head: null, translation: null,
  definition: '', frequency: 0, corpus_share: 0,
  ipa: '', pronunciation_ru: '',
  singular: null, plural: null, genus: null, suffix: null, plural_ending: null,
  stress_singular: null, stress_plural: null,
  form_ich: null, form_du: null, form_er: null, form_wir: null, form_ihr: null,
  rektion: [], separable_prefix: null, register: null, stress_infinitive: null,
  wortart: null, komparativ: null, superlativ: null, stress_word: null,
  rule_status: 'none', rule_label: '', rule_genus: null,
  examples_de: [], examples_ru: [],
  audio_head: null, audio_plural: null,
  audio_ich: null, audio_du: null, audio_er: null, audio_wir: null, audio_ihr: null,
  audio_comparative: null, audio_superlative: null,
};

const toRow = (word) => {
  const row = { ...WORD_TEMPLATE };
  for (const [key, value] of Object.entries(word)) {
    if (!(key in WORD_TEMPLATE)) throw new Error(`Поле «${key}» не в схеме words`);
    row[key] = value ?? WORD_TEMPLATE[key];
  }
  return row;
};

const upsertWords = async ({ url, key }, rows) => {
  for (let from = 0; from < rows.length; from += 200) {
    const chunk = rows.slice(from, from + 200);
    const response = await fetch(`${url}/rest/v1/words?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`Запись слов: ${response.status} ${await response.text()}`);
  }
};

/**
 * Строки бэклога, слова которых появились в колоде, помечаются
 * заведёнными. Путь слова такой: бэклог → карточка в Anki → заливка;
 * без этого шага список пришлось бы вычищать руками.
 */
const closeBacklog = async ({ url, key }, words) => {
  const response = await fetch(`${url}/rest/v1/backlog?state=eq.new&select=id,word`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Чтение бэклога: ${response.status}`);
  const pending = await response.json();
  if (!pending.length) return 0;

  const heads = new Set(words.map((word) => word.head.trim().toLowerCase()));
  const done = pending.filter((row) => heads.has(row.word.trim().toLowerCase()));
  if (!done.length) return 0;

  const ids = done.map((row) => row.id).join(',');
  const update = await fetch(`${url}/rest/v1/backlog?id=in.(${ids})`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ state: 'added' }),
  });
  if (!update.ok) throw new Error(`Закрытие бэклога: ${update.status} ${await update.text()}`);
  return done.length;
};

/* ────────────────────────────────── ход ───────────────────────────────── */

const main = async () => {
  log('Читаю коллекцию Anki…');
  const ids = await anki('findNotes', { query: `-deck:"${DRAFT_DECK}"` });
  const notes = (await anki('notesInfo', { notes: ids })).filter(
    (note) => note.modelName !== PHRASE_MODEL && WORD_MODELS.includes(note.modelName),
  );
  log(`  заметок-слов: ${notes.length}`);

  log('Читаю ранги…');
  const ranks = loadRanks();

  const workDir = mkdtempSync(join(tmpdir(), 'anki-audio-'));
  const words = [];
  const uploads = [];
  const missingMedia = [];

  for (const note of notes) {
    const mapped = noteToWord(note);
    if (!mapped) continue;
    const { audio, ...row } = mapped;
    row.rank = ranks.has(row.id) ? ranks.get(row.id) : null;

    for (const slot of AUDIO_SLOTS) row[slot] = null;
    for (const [slot, file] of Object.entries(audio ?? {})) {
      if (!file) continue;
      if (!existsSync(join(MEDIA, file))) { missingMedia.push(file); continue; }
      const playable = toPlayable(file, workDir);
      const path = `words/${row.id}/${slot.replace('audio_', '')}${playable.ext}`;
      row[slot] = path;
      uploads.push({ path, source: playable.path, ext: playable.ext });
    }
    words.push(row);
  }

  const ranked = words.filter((word) => word.rank !== null).length;
  const voiced = words.filter((word) => word.audio_head).length;
  log(`  слов: ${words.length}, с рангом: ${ranked}, с озвучкой заголовка: ${voiced}`);
  log(`  файлов озвучки: ${uploads.length}, конвертировано из AIFF: ${convertedCache.size}`);
  if (missingMedia.length) log(`  ВНИМАНИЕ: нет на диске ${missingMedia.length} файлов`);

  if (flags.has('--dry-run')) { log('Пробный прогон, в базу ничего не пишу.'); return; }

  const config = supabaseConfig();

  if (!flags.has('--skip-audio')) {
    const already = flags.has('--force-audio') ? new Set() : await existingObjects(config);
    const todo = uploads.filter((item) => !already.has(item.path));
    log(`Заливаю озвучку: ${todo.length} файлов (уже в хранилище: ${uploads.length - todo.length})…`);
    let done = 0;
    await limitConcurrency(todo, 8, async (item) => {
      const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${item.path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': CONTENT_TYPE[item.ext] ?? 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: readFileSync(item.source),
      });
      if (!response.ok) throw new Error(`Звук ${item.path}: ${response.status} ${await response.text()}`);
      done += 1;
      if (done % 500 === 0) log(`    ${done}/${todo.length}`);
    });
    log(`  залито: ${done}`);
  }

  log('Пишу слова…');
  await upsertWords(config, words.map(toRow));
  log(`  записано: ${words.length}`);

  const closed = await closeBacklog(config, words);
  if (closed) log(`  строк бэклога закрыто: ${closed}`);

  const sizes = uploads.reduce((total, item) => total + statSync(item.source).size, 0);
  log(`\nГотово. Слов ${words.length}, звука ${uploads.length} файлов на ${(sizes / 1024 / 1024).toFixed(1)} МБ.`);
};

main().catch((error) => {
  console.error('\nЗаливка остановлена:', error.message);
  process.exitCode = 1;
});
