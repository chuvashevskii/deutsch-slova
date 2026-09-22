#!/usr/bin/env node
/**
 * Применение правок словаря с записью в журнал.
 *
 * Правки живут файлами (`data/edits/*.json`), а не запросами на ходу:
 * файл виден в git, его можно перечитать второй раз на свежую голову
 * и прогнать заново на чистой базе. Журнал при этом заполняется сам —
 * иначе пришлось бы помнить, что и почему менялось, а «я помню» —
 * не механизм.
 *
 * Скрипт идемпотентен: поле, уже равное нужному значению, пропускается
 * и строки в журнал не даёт. Повторный прогон партии ничего не задваивает.
 *
 *   node scripts/apply-edits.mjs data/edits/sluzhebnye.json
 *   node scripts/apply-edits.mjs data/edits/*.json --dry
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const dry = flags.has('--dry');

if (!files.length) {
  console.error('Укажите файлы правок: node scripts/apply-edits.mjs data/edits/*.json');
  process.exit(1);
}

/** Правило то же, что у заливок: нелокальная цель требует явного --remote. */
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

const REASONS = new Set(['формат', 'уровень 1', 'уровень 2', 'уровень 3', 'разделение', 'ранг', 'прочее']);

/** Значение для журнала: он хранит текст, а массив примеров — не текст. */
const asText = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(' · ');
  return String(value);
};

const same = (a, b) => asText(a) === asText(b);

const { url, key, label } = target();
const db = createClient(url, key, { auth: { persistSession: false } });

let updated = 0;
let logged = 0;
let created = 0;
let skipped = 0;
const problems = [];

for (const file of files) {
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`\n${file}: ${entries.length} правок`);

  for (const entry of entries) {
    if (!entry.id || !entry.batch || !entry.reason) {
      problems.push(`${file}: у правки нет id, batch или reason`);
      continue;
    }
    if (!REASONS.has(entry.reason)) {
      problems.push(`${entry.id}: неизвестный повод «${entry.reason}»`);
      continue;
    }

    const { data: before, error: readError } = await db
      .from('words')
      .select('*')
      .eq('id', entry.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!before) {
      problems.push(`${entry.id}: карточки нет в базе`);
      continue;
    }
    if (entry.head && before.head !== entry.head) {
      // Заголовок в файле — не данные, а подпись для читающего. Расхождение
      // значит, что правка написана про другую карточку.
      problems.push(`${entry.id}: в базе «${before.head}», в правке «${entry.head}»`);
      continue;
    }

    const changes = Object.entries(entry.set ?? {}).filter(([field, value]) => !same(before[field], value));
    for (const [field] of Object.entries(entry.set ?? {})) {
      if (!(field in before)) problems.push(`${entry.id}: поля «${field}» в словаре нет`);
    }
    if (!changes.length && !entry.split) {
      skipped += 1;
      continue;
    }

    if (dry) {
      for (const [field, value] of changes) {
        console.log(`  ${before.head} · ${field}: ${asText(before[field]) ?? '—'} → ${asText(value)}`);
      }
      if (entry.split) console.log(`  ${before.head} · разделение → ${entry.split.id}`);
      continue;
    }

    if (changes.length) {
      const { error } = await db
        .from('words')
        .update(Object.fromEntries(changes))
        .eq('id', entry.id);
      if (error) throw new Error(`${entry.id}: ${error.message}`);
      updated += 1;

      const journal = changes.map(([field, value]) => ({
        word_id: entry.id,
        field,
        old_value: asText(before[field]),
        new_value: asText(value),
        reason: entry.reason,
        batch: entry.batch,
        disputed: Boolean(entry.disputed),
        note: entry.note ?? null,
      }));
      const { error: logError } = await db.from('word_edits').insert(journal);
      if (logError) throw new Error(`${entry.id} журнал: ${logError.message}`);
      logged += journal.length;
    }

    // Разделение: вторая карточка рождается копией первой с заменой полей.
    // Формы, произношение и приставка копируются — слово-то одно;
    // расходятся перевод, управление и примеры.
    if (entry.split) {
      const { data: exists } = await db.from('words').select('id').eq('id', entry.split.id).maybeSingle();
      if (exists) {
        skipped += 1;
      } else {
        const row = { ...before, ...entry.split, confirmed_at: null };
        const { error } = await db.from('words').insert(row);
        if (error) throw new Error(`${entry.split.id}: ${error.message}`);
        created += 1;

        const { error: logError } = await db.from('word_edits').insert({
          word_id: entry.split.id,
          field: 'translation',
          old_value: null,
          new_value: asText(entry.split.translation),
          reason: 'разделение',
          batch: entry.batch,
          disputed: Boolean(entry.disputed),
          note: entry.note ?? `Отделено от «${before.head} — ${before.translation}»`,
        });
        if (logError) throw new Error(`${entry.split.id} журнал: ${logError.message}`);
        logged += 1;
      }
    }
  }
}

console.log(`\n${dry ? 'Разбор' : 'Применено'} — ${label}`);
console.log(`  изменено карточек: ${updated}`);
console.log(`  создано карточек: ${created}`);
console.log(`  записей в журнале: ${logged}`);
console.log(`  пропущено (уже так): ${skipped}`);

if (problems.length) {
  console.log(`\nНе применено — ${problems.length}:`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
