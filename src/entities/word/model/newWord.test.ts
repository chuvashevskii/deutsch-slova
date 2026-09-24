import { describe, expect, it } from 'vitest';

import {
  checkDraft,
  emptyDraft,
  isReady,
  suggestPrefix,
  toPayload,
  type Neighbour,
  type WordDraft,
} from './newWord';

/** Заполненный черновик: от него отталкиваются проверки. */
const good = (over: Partial<WordDraft> = {}): WordDraft => ({
  ...emptyDraft('Zuversicht'),
  part: 'noun',
  translation: 'Уверенность в хорошем',
  genus: 'f',
  singular: 'die Zuversicht',
  examplesDe: ['Ihre Zuversicht steckt alle an.', 'Er hat die Zuversicht verloren.'],
  examplesRu: ['Её уверенность передаётся всем.', 'Он потерял уверенность.'],
  ...over,
});

const blocks = (d: WordDraft, n: Neighbour[] = []) =>
  checkDraft(d, n)
    .filter((f) => f.level === 'блок')
    .map((f) => f.text);
const notes = (d: WordDraft, n: Neighbour[] = []) =>
  checkDraft(d, n)
    .filter((f) => f.level === 'замечание')
    .map((f) => f.text);

describe('проверка своей карточки', () => {
  it('заполненную карточку пропускает', () => {
    expect(blocks(good())).toEqual([]);
    expect(isReady(checkDraft(good(), []))).toBe(true);
  });

  it('пустую не пропускает и говорит, чего нет', () => {
    const findings = blocks(emptyDraft());
    expect(findings).toContain('Нет самого слова');
    expect(findings).toContain('Нет перевода');
    expect(findings.some((t) => t.startsWith('Примеров 0'))).toBe(true);
  });

  it('половина примера примером не считается', () => {
    // Немецкий без перевода бесполезен: карточка спрашивает по-русски.
    const half = good({ examplesRu: ['Её уверенность передаётся всем.', ''] });
    expect(blocks(half).some((t) => t.startsWith('Примеров 1'))).toBe(true);
  });

  it('помета обязательна и проверяется по формату', () => {
    expect(blocks(good({ register: '' }))).toContain('Не выбрана помета регистра');
    expect(blocks(good({ register: 'книжный' }))).toContain('Помета написана не по формату');
  });
});

describe('столкновение перевода', () => {
  const same: Neighbour = {
    id: 'list-0001',
    head: 'Sicherheit',
    translation: 'Уверенность в хорошем',
    register: 'neutral · нейтральный',
    definition: null,
  };

  it('сосед с тем же различителем блокирует', () => {
    // Оба нейтральные и без подсказки — на экране человек увидит один
    // и тот же русский текст и не поймёт, какое слово от него хотят.
    const d = good({ register: 'neutral · нейтральный', definition: '' });
    expect(blocks(d, [same]).some((t) => t.includes('Sicherheit'))).toBe(true);
  });

  it('другая помета разводит карточки и оставляет только замечание', () => {
    const d = good({ register: 'formell · книжный', definition: '' });
    expect(blocks(d, [same])).toEqual([]);
    expect(notes(d, [same]).some((t) => t.includes('Sicherheit'))).toBe(true);
  });

  it('голый сосед блокирует, даже если различители формально разные', () => {
    // Поймано на стенде: у «Problem» нет ни пометы, ни подсказки.
    // Форма считала пару безобидной, а проверка колоды такую группу
    // метит — и заведённое тут же всплыло бы в ней.
    const bare: Neighbour = {
      id: 'list-0172',
      head: 'Problem',
      translation: 'Проблема',
      register: null,
      definition: null,
    };
    const d = good({ translation: 'Проблема', register: 'neutral · нейтральный' });
    expect(blocks(d, [bare]).some((t) => t.includes('Problem'))).toBe(true);
  });

  it('называет различителем то, что различает на самом деле', () => {
    const byDefinition: Neighbour = {
      id: 'list-0002',
      head: 'Gewissheit',
      translation: 'Уверенность в хорошем',
      register: 'neutral · нейтральный',
      definition: 'знание без сомнений',
    };
    const d = good({ register: 'neutral · нейтральный', definition: '' });
    expect(notes(d, [byDefinition]).some((t) => t.includes('различает подсказка'))).toBe(true);
  });

  it('подсказка разводит так же, как помета', () => {
    const d = good({ register: 'neutral · нейтральный', definition: 'вера, что выйдет хорошо' });
    expect(blocks(d, [same])).toEqual([]);
  });
});

describe('обещания, которые карточка не показывает', () => {
  it('множественное заявлено, а в примерах его нет', () => {
    const d = good({ plural: 'die Zuversichten' });
    expect(notes(d).some((t) => t.startsWith('Множественное заявлено'))).toBe(true);
  });

  it('множественное в дательном падеже засчитывается', () => {
    // `mit zwei Tagen` — это die Tage, просто в Dativ.
    const d = good({
      head: 'Tag',
      translation: 'День',
      plural: 'die Tage',
      examplesDe: ['Der Tag war lang.', 'Wir treffen uns in drei Tagen.'],
      examplesRu: ['День был долгим.', 'Встретимся через три дня.'],
    });
    expect(notes(d).some((t) => t.startsWith('Множественное заявлено'))).toBe(false);
  });

  it('управление заявлено, а предлога в примерах нет', () => {
    const d = good({
      part: 'verb',
      head: 'denken',
      translation: 'Думать',
      rektion: ['über etw. (Akk.)'],
      examplesDe: ['Ich denke oft.', 'Er denkt lange nach.'],
      examplesRu: ['Я часто думаю.', 'Он долго думает.'],
    });
    expect(notes(d)).toContain('Управление заявлено, а предлога в примерах нет');
  });

  it('отделяемую приставку принимает за предлог — и это знают', () => {
    // Граница проверки: «steckt alle an» засчитывается как предлог `an`,
    // хотя дательного дополнения там нет. Ошибаться в сторону
    // «показано» дешевле, чем гонять чинить здоровое.
    const d = good({ part: 'verb', rektion: ['an etw. (Dat.)'] });
    expect(notes(d)).not.toContain('Управление заявлено, а предлога в примерах нет');
  });

  it('слитый с артиклем предлог засчитывается', () => {
    const d = good({
      part: 'verb',
      head: 'führen',
      translation: 'Вести',
      rektion: ['zu etw. (Dat.)'],
      examplesDe: ['Der Weg führt zum Bahnhof.', 'Sie führt das Unternehmen.'],
      examplesRu: ['Дорога ведёт к вокзалу.', 'Она ведёт предприятие.'],
    });
    expect(notes(d)).not.toContain('Управление заявлено, а предлога в примерах нет');
  });

  it('примеры-близнецы видны', () => {
    const d = good({
      // Ровно та пара, на которой проверка колоды и поймала близнецов.
      examplesDe: [
        'Wir buchen eine Tour durch die Stadt.',
        'Wir buchen zwei Touren durch die Stadt.',
      ],
      examplesRu: ['Мы бронируем тур по городу.', 'Мы бронируем два тура по городу.'],
    });
    expect(notes(d).some((t) => t.startsWith('Примеры отличаются одним словом'))).toBe(true);
  });

  it('слова нет в примерах', () => {
    const d = good({ examplesDe: ['Das ist gut.', 'Alles in Ordnung.'] });
    expect(notes(d)).toContain('Самого слова в примерах нет');
  });

  // Оформление подсказки блокирующее, а не отчётное: в колоде из
  // 74 подсказок ни одна не нарушает форму, и пропускать нарушение
  // значит заводить исключение там, где исключений нет.
  it.each([
    ['Вера', 'меньше двух слов'],
    ['вера в то, что всё выйдет хорошо', 'вместо двух-пяти'],
    ['Вера в хорошее', 'с заглавной'],
    ['вера в хорошее.', 'с точкой'],
    ['zuversicht значит вера', 'содержит сам ответ'],
    ['разговорное слово', 'это помета'],
  ])('подсказка «%s» не даёт завести: %s', (definition, problem) => {
    const d = good({ definition });
    expect(blocks(d).some((t) => t.includes(problem))).toBe(true);
    expect(isReady(checkDraft(d, []))).toBe(false);
  });

  it('пустая подсказка замечаний не даёт — поле необязательное', () => {
    const d = good({ definition: '' });
    expect(blocks(d)).toEqual([]);
    expect(notes(d).some((t) => t.startsWith('Подсказка'))).toBe(false);
  });

  it('подсказка по форме проходит', () => {
    expect(isReady(checkDraft(good({ definition: 'вера в хорошее' }), []))).toBe(true);
  });

  it('замечания заводить не мешают', () => {
    // Это и есть смысл деления: карточка родится черновиком, и в «Учить»
    // без согласования всё равно не попадёт.
    const d = good({ plural: 'die Zuversichten' });
    expect(notes(d).length).toBeGreaterThan(0);
    expect(isReady(checkDraft(d, []))).toBe(true);
  });
});

describe('род спрашивается только у существительного', () => {
  it('у существительного без рода — замечание', () => {
    expect(notes(good({ genus: '' }))).toContain('У существительного не выбран род');
  });

  it('у наречия про род не спрашивают вовсе', () => {
    const d = good({
      part: 'adverb',
      genus: '',
      head: 'immer',
      translation: 'Всегда',
      examplesDe: ['Ich trinke immer Kaffee.', 'Sie ist immer pünktlich.'],
      examplesRu: ['Я всегда пью кофе.', 'Она всегда пунктуальна.'],
    });
    expect(notes(d)).not.toContain('У существительного не выбран род');
  });
});

describe('спряжение — необязательное', () => {
  /** Глагол, к которому не придраться ничем, кроме спряжения. */
  const verb = (over: Partial<WordDraft> = {}): WordDraft => ({
    ...emptyDraft('arbeiten'),
    part: 'verb',
    translation: 'Работать',
    examplesDe: ['Ich arbeite im Büro.', 'Sie arbeitet als Ärztin.'],
    examplesRu: ['Я работаю в офисе.', 'Она работает врачом.'],
    ...over,
  });

  const all = {
    formIch: 'arbeite',
    formDu: 'arbeitest',
    formEr: 'arbeitet',
    formWir: 'arbeiten',
    formIhr: 'arbeitet',
  };

  it('пустое спряжение заводить не мешает и молчит', () => {
    const d = verb();
    expect(isReady(checkDraft(d, []))).toBe(true);
    expect(notes(d).some((t) => t.startsWith('Спряжение'))).toBe(false);
  });

  it('заполненное целиком тоже молчит', () => {
    const d = verb(all);
    expect(isReady(checkDraft(d, []))).toBe(true);
    expect(notes(d).some((t) => t.startsWith('Спряжение'))).toBe(false);
  });

  // Как `regnen`: третье лицо есть, остальных не бывает. Замечание, а не
  // блок — иначе пришлось бы выдумывать «ich regne».
  it('частичное даёт замечание и не запирает кнопку', () => {
    const d = verb({ formEr: 'arbeitet', formWir: 'arbeiten' });
    expect(isReady(checkDraft(d, []))).toBe(true);
    expect(notes(d).some((t) => t.includes('пусто у ich, du, ihr'))).toBe(true);
  });

  it('у существительного про спряжение не спрашивают вовсе', () => {
    const d = good({ formEr: 'arbeitet' });
    expect(notes(d).some((t) => t.startsWith('Спряжение'))).toBe(false);
  });

  it('лица уходят в базу под именами колонок', () => {
    expect(toPayload(verb(all))).toMatchObject({
      form_ich: 'arbeite',
      form_du: 'arbeitest',
      form_er: 'arbeitet',
      form_wir: 'arbeiten',
      form_ihr: 'arbeitet',
    });
  });

  // Иначе спряжение, набранное у глагола, уехало бы вместе с человеком,
  // переключившим часть речи на существительное.
  it('не-глагол отправляет лица пустыми, даже если в черновике они есть', () => {
    expect(toPayload(good({ formEr: 'arbeitet' }))).toMatchObject({ form_er: '' });
  });
});

describe('отделяемая приставка', () => {
  const verb = (over: Partial<WordDraft> = {}): WordDraft => ({
    ...emptyDraft('aufstehen'),
    part: 'verb',
    translation: 'Вставать с постели',
    examplesDe: ['Ich stehe früh auf.', 'Er steht um sieben auf.'],
    examplesRu: ['Я встаю рано.', 'Он встаёт в семь.'],
    ...over,
  });

  it('без галочки приставку не спрашивают и в базу не шлют', () => {
    const d = verb({ separablePrefix: 'auf' });
    expect(blocks(d)).toEqual([]);
    expect(toPayload(d)).toMatchObject({ separable_prefix: '' });
  });

  it('с галочкой и верной приставкой — чисто', () => {
    const d = verb({ separable: true, separablePrefix: 'auf' });
    expect(isReady(checkDraft(d, []))).toBe(true);
    expect(toPayload(d)).toMatchObject({ separable_prefix: 'auf' });
  });

  it('галочка без приставки не даёт завести', () => {
    const d = verb({ separable: true });
    expect(blocks(d)).toContain('Глагол отмечен отделяемым, а приставка не указана');
  });

  // Самая тихая ошибка: подсветка просто не появится, и причины не будет.
  it('приставка мимо слова не даёт завести', () => {
    const d = verb({ head: 'bekommen', separable: true, separablePrefix: 'auf' });
    expect(blocks(d).some((t) => t.includes('не начинается с «auf»'))).toBe(true);
  });

  it('возвратному приставку ищут после sich', () => {
    const d = verb({ head: 'sich anziehen', separable: true, separablePrefix: 'an' });
    expect(blocks(d)).toEqual([]);
    expect(suggestPrefix('sich anziehen')).toBe('an');
  });

  it('слитная личная форма — замечание, не блок', () => {
    const d = verb({ separable: true, separablePrefix: 'auf', formEr: 'aufsteht' });
    expect(isReady(checkDraft(d, []))).toBe(true);
    expect(notes(d).some((t) => t.includes('приставка не оторвана'))).toBe(true);
  });

  it('оторванная личная форма замечаний не даёт', () => {
    const d = verb({ separable: true, separablePrefix: 'auf', formEr: 'steht auf' });
    expect(notes(d).some((t) => t.includes('приставка не оторвана'))).toBe(false);
  });

  it.each([
    ['aufstehen', 'auf'],
    ['herunterladen', 'herunter'],
    ['zusammenarbeiten', 'zusammen'],
    ['bekommen', ''],
  ])('подсказка приставки: %s → «%s»', (head, prefix) => {
    expect(suggestPrefix(head)).toBe(prefix);
  });
});
