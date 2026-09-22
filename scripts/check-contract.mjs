#!/usr/bin/env node
/**
 * Сверка формы ответов базы с тем, что ждёт приложение.
 *
 * Появился после живого случая: очередь `learn_queue` стала возвращать
 * плоское слово вместо `{word, card}`, экран «Учить» брал `items[0].word`,
 * получал `undefined` и показывал «на сегодня всё» при тридцати словах
 * в очереди. Ни один тест этого не заметил: тесты проверяют разбор
 * и отбор, а стык «функция отдаёт — экран читает» держался на памяти.
 *
 * Проверка сравнивает ключи, а не значения: содержимое меняется каждый
 * день, а форма меняться не должна молча.
 *
 *   node scripts/check-contract.mjs
 *   node scripts/check-contract.mjs --remote   (с SUPABASE_URL и ключом)
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));

const target = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url || key) {
    if (!url || !key) {
      throw new Error('Нужны обе переменные: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.');
    }
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost' && !flags.has('--remote')) {
      throw new Error(`Цель не локальная (${host}). Добавьте --remote.`);
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
 * Что читает приложение. Каждая строка — поле, до которого экран
 * добирается по имени; промах даёт `undefined`, а не ошибку, поэтому
 * такие промахи и не видны.
 */
const CONTRACT = [
  {
    what: 'learn_queue',
    who: 'src/pages/learn/LearnPage.tsx — queue.items[0].word',
    call: (db) => db.rpc('learn_queue', { p_limit: 2 }),
    check: (d) => {
      const miss = [];
      if (typeof d?.total !== 'number') miss.push('total');
      if (!Array.isArray(d?.items)) miss.push('items');
      const first = d?.items?.[0];
      if (d?.total > 0 && !first) miss.push('items пуст при total > 0');
      if (first) {
        if (!first.word) miss.push('items[].word');
        if (!('card' in first)) miss.push('items[].card');
        for (const f of ['id', 'head', 'translation', 'pos', 'ipa', 'examples_de'])
          if (!(f in (first.word ?? {}))) miss.push(`items[].word.${f}`);
      }
      return miss;
    },
  },
  {
    what: 'words_page',
    who: 'src/pages/words/WordsPage.tsx — rows[].draft / status / requested',
    call: (db) => db.rpc('words_page', { p_limit: 2 }),
    check: (d) => {
      const miss = [];
      if (typeof d?.total !== 'number') miss.push('total');
      if (!Array.isArray(d?.rows)) miss.push('rows');
      const row = d?.rows?.[0];
      if (row)
        for (const f of [
          'id', 'rank', 'pos', 'head', 'translation', 'genus', 'singular',
          'wortart', 'status', 'requested', 'has_progress', 'draft',
        ])
          if (!(f in row)) miss.push(`rows[].${f}`);
      return miss;
    },
  },
  {
    what: 'words_facets',
    who: 'src/pages/words/WordsPage.tsx — чипы отбора',
    call: (db) => db.rpc('words_facets'),
    check: (d) => ['total', 'pos', 'genus', 'drafts', 'rankless'].filter((f) => !(f in (d ?? {}))),
  },
  {
    what: 'progress_summary',
    who: 'src/widgets/app-layout/AppLayout.tsx — счётчик в шапке',
    call: (db) => db.rpc('progress_summary'),
    check: (d) =>
      ['total', 'new', 'learning', 'known', 'declared', 'requested', 'nounsWithGenus', 'drafts']
        .filter((f) => !(f in (d ?? {}))),
  },
  {
    what: 'stats_summary',
    who: 'src/pages/stats/StatsPage.tsx — плитки и графики',
    call: (db) => db.rpc('stats_summary'),
    check: (d) =>
      ['reviewedToday', 'dueNow', 'accuracy', 'checkedReviews', 'checkedPos', 'totalReviews',
       'forecast', 'perDay', 'activeDays', 'genusMatrix', 'ruleErrors']
        .filter((f) => !(f in (d ?? {}))),
  },
  {
    what: 'word_nests (по переводу)',
    who: 'src/pages/review/NestList.tsx',
    call: (db) => db.rpc('word_nests', { p_kind: 'translation' }),
    check: (d) => {
      if (!Array.isArray(d)) return ['ответ не массив'];
      const n = d[0];
      if (!n) return [];
      const miss = ['key', 'label', 'flawed', 'cards'].filter((f) => !(f in n));
      const c = n.cards?.[0];
      if (c)
        for (const f of ['id', 'head', 'translation', 'register', 'definition', 'rank', 'is_draft', 'pos', 'wortart', 'edited'])
          if (!(f in c)) miss.push(`cards[].${f}`);
      return miss;
    },
  },
  {
    what: 'word_nests (по слову)',
    who: 'src/pages/review/NestList.tsx',
    call: (db) => db.rpc('word_nests', { p_kind: 'head' }),
    check: (d) => (Array.isArray(d) ? [] : ['ответ не массив']),
  },
  {
    what: 'word_edits_view',
    who: 'src/pages/review/ReviewPage.tsx — строка правки',
    call: (db) => db.from('word_edits_view').select('*').limit(1),
    check: (d) => {
      const row = Array.isArray(d) ? d[0] : d;
      if (!row) return [];
      return ['id', 'word_id', 'field', 'old_value', 'new_value', 'reason', 'batch',
              'disputed', 'note', 'reverted_at', 'superseded', 'head', 'translation',
              'pos', 'wortart', 'rank', 'is_draft'].filter((f) => !(f in row));
    },
  },
  {
    what: 'words (строка словаря)',
    who: 'src/widgets/word-answer/WordAnswer.tsx — оборот карточки',
    call: (db) => db.from('words').select('*').limit(1),
    check: (d) => {
      const row = Array.isArray(d) ? d[0] : d;
      if (!row) return ['нет строк'];
      return ['id', 'head', 'translation', 'pos', 'wortart', 'genus', 'singular', 'plural',
              'plural_ending', 'suffix', 'ipa', 'pronunciation_ru', 'rule_status', 'rule_label',
              'rule_genus', 'komparativ', 'superlativ', 'rektion', 'forms', 'form_labels',
              'examples_de', 'examples_ru', 'register', 'definition', 'rank', 'confirmed_at',
              'separable_prefix', 'stress_word', 'stress_infinitive', 'stress_singular',
              'stress_plural', 'audio_head'].filter((f) => !(f in row));
    },
  },
];

const { url, key, label } = target();
const db = createClient(url, key, { auth: { persistSession: false } });

console.log(`\nСтык базы и приложения — ${label}\n`);
let broken = 0;

for (const item of CONTRACT) {
  const { data, error } = await item.call(db);
  if (error) {
    console.log(`  ✗ ${item.what}: ${error.message}`);
    console.log(`      читает: ${item.who}`);
    broken += 1;
    continue;
  }
  const miss = item.check(data);
  if (miss.length) {
    console.log(`  ✗ ${item.what}: нет полей — ${miss.join(', ')}`);
    console.log(`      читает: ${item.who}`);
    broken += 1;
  } else {
    console.log(`  ✓ ${item.what}`);
  }
}

console.log(broken ? `\nСтык разошёлся: ${broken}\n` : '\nСтык сходится\n');
process.exit(broken ? 1 : 0);
