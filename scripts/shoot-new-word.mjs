/**
 * Съёмка экрана «Своя карточка» во всех состояниях.
 *
 * Не тест и не часть приложения — одноразовый инструмент, чтобы показать
 * флоу целиком: каждая часть речи, каждое блокирующее условие, каждое
 * замечание. Гоняется руками при живом дев-сервере.
 *
 * Chrome водится своим отладочным протоколом напрямую: ставить
 * playwright ради тридцати снимков дороже, чем написать шестьдесят
 * строк. WebSocket в node есть родной начиная с двадцать второй версии.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = 'http://127.0.0.1:5173';
const OUT = '/tmp/shots';
const PORT = 9333;
const SESSION = readFileSync('/tmp/shot-session-min.json', 'utf8');

mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/shot-profile',
  '--no-first-run',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ждём, пока Chrome поднимет протокол. */
const target = await (async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      // ещё не поднялся
    }
    await sleep(250);
  }
  throw new Error('Chrome не отозвался');
})();

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let seq = 0;
const waiting = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && waiting.has(msg.id)) {
    const { res, rej } = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message));
    else res(msg.result);
  }
};
const send = (method, params = {}) => {
  const id = (seq += 1);
  return new Promise((res, rej) => {
    waiting.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

await send('Page.enable');
await send('Runtime.enable');
// Телефонная ширина: приложение так и задумано, и на ней видны переносы.
await send('Emulation.setDeviceMetricsOverride', {
  width: 420,
  height: 900,
  deviceScaleFactor: 2,
  mobile: true,
});

const go = async (path) => {
  await send('Page.navigate', { url: APP + path });
  await sleep(1400);
};
const run = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  return result.value;
};

/**
 * Снимок всей страницы целиком.
 *
 * Не `captureBeyondViewport`: нижняя панель навигации у приложения
 * прижата к низу окна, и при съёмке «за экраном» она оказывалась
 * посреди снимка, перечёркивая форму. Поэтому окно сначала растягивается
 * под высоту содержимого — тогда панель остаётся там, где ей место.
 */
const shot = async (name) => {
  await sleep(500);
  const { contentSize } = await send('Page.getLayoutMetrics');
  const height = Math.min(Math.ceil(contentSize.height) + 40, 6000);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 420,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(350);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', {
    width: 420,
    height: 900,
    deviceScaleFactor: 2,
    mobile: true,
  });
  console.log('  ▸', name);
};

// Сессия кладётся до первого перехода: приложение читает её при старте.
await go('/');
await run(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(SESSION)});`);

/** Помощники, которые живут внутри страницы. */
const HELPERS = `
  const proto = Object.getPrototypeOf(document.createElement('input'));
  const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
  const fields = () => [...document.querySelectorAll('label')].map(l => l.querySelector('input')).filter(Boolean);
  const type = (i, v) => { const el = fields()[i]; setVal.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const press = (t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t)?.click();
  const pick = (v) => { const s = document.querySelector('select'); const setS = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(s), 'value').set; setS.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true })); };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
`;

/** Полностью заполненная карточка — от неё отходят все случаи. */
const FILL_GOOD = `
  ${HELPERS}
  type(0, 'Zuversicht');
  type(1, 'Уверенность в хорошем');
  type(2, 'вера, что выйдет хорошо');
  press('die');
  await wait(200);
  type(3, 'die Zuversicht');
  type(5, 'Ihre Zuversicht steckt alle an.');
  type(6, 'Её уверенность передаётся всем.');
  type(7, 'Er hat die Zuversicht verloren.');
  type(8, 'Он потерял уверенность.');
  await wait(1200);
`;

console.log('\nЧасти речи');
const KINDS = [
  ['noun', '01-chast-suschestvitelnoe'],
  ['verb', '02-chast-glagol'],
  ['adj', '03-chast-prilagatelnoe'],
  ['adj-adv', '04-chast-pril-narech'],
  ['adverb', '05-chast-narechie'],
  ['pronoun', '06-chast-mestoimenie'],
  ['preposition', '07-chast-predlog'],
  ['conjunction', '08-chast-soyuz'],
  ['particle', '09-chast-chastitsa'],
  ['numeral', '10-chast-chislitelnoe'],
];
for (const [value, name] of KINDS) {
  await go('/words/new?word=Zuversicht');
  await run(`${HELPERS} pick('${value}'); type(1, 'Пробный перевод'); await wait(1200);`);
  await shot(name);
}

console.log('\nБлокирующие');
await go('/words/new');
await run(`${HELPERS} await wait(800);`);
await shot('11-blok-pustaya-forma');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(0, ''); await wait(1000);`);
await shot('12-blok-net-slova');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(1, ''); await wait(1000);`);
await shot('13-blok-net-perevoda');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(7, ''); type(8, ''); await wait(1000);`);
await shot('14-blok-odin-primer');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(6, ''); await wait(1000);`);
await shot('15-blok-primer-bez-perevoda');

// «Проблема» стоит у Problem, и у той карточки нет ни пометы,
// ни подсказки — различить их будет нечем.
await go('/words/new?word=Schwierigkeit');
await run(`${FILL_GOOD} type(0, 'Schwierigkeit'); type(1, 'Проблема'); type(2, ''); await wait(2200);`);
await shot('16-blok-sosed-bez-razlichitelya');

// «Начало» стоит у Anfang и Beginn — обе с пометой и без подсказки.
await go('/words/new?word=Auftakt');
await run(`${FILL_GOOD} type(0, 'Auftakt'); type(1, 'Начало'); type(2, ''); await wait(2200);`);
await shot('17-blok-razlichiteli-sovpali');

console.log('\nЗамечания');
// Род не «снимается» — кнопки переключают только в одну сторону.
// Поэтому карточка заполняется целиком, а род просто не выбирается.
await go('/words/new?word=Zuversicht');
await run(`
  ${HELPERS}
  type(0, 'Zuversicht');
  type(1, 'Уверенность в хорошем');
  type(2, 'вера, что выйдет хорошо');
  type(3, 'die Zuversicht');
  type(5, 'Ihre Zuversicht steckt alle an.');
  type(6, 'Её уверенность передаётся всем.');
  type(7, 'Er hat die Zuversicht verloren.');
  type(8, 'Он потерял уверенность.');
  await wait(1200);
`);
await shot('18-zam-net-roda');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(4, 'die Zuversichten'); await wait(1200);`);
await shot('19-zam-mnozhestvennoe-ne-pokazano');

await go('/words/new?word=denken');
await run(`
  ${HELPERS}
  pick('verb');
  await wait(300);
  type(0, 'denken');
  type(1, 'Думать о чём-то');
  type(3, 'Ich denke oft.');
  type(4, 'Я часто думаю.');
  type(5, 'Er denkt lange nach.');
  type(6, 'Он долго думает.');
  press('über etw. (Akk.)');
  await wait(1500);
`);
await shot('20-zam-upravlenie-ne-pokazano');

await go('/words/new?word=Tour');
await run(`
  ${FILL_GOOD}
  type(0, 'Tour');
  type(1, 'Тур по городу');
  type(5, 'Wir buchen eine Tour durch die Stadt.');
  type(6, 'Мы бронируем тур по городу.');
  type(7, 'Wir buchen zwei Touren durch die Stadt.');
  type(8, 'Мы бронируем два тура по городу.');
  await wait(1500);
`);
await shot('21-zam-primery-bliznetsy');

await go('/words/new?word=Zuversicht');
await run(`${FILL_GOOD} type(5, 'Das ist gut.'); type(7, 'Alles in Ordnung.'); await wait(1200);`);
await shot('22-zam-slova-net-v-primerah');

const HINTS = [
  ['Вера', '23-zam-podskazka-korotkaya'],
  ['вера в то, что всё выйдет хорошо', '24-zam-podskazka-dlinnaya'],
  ['Вера в хорошее', '25-zam-podskazka-s-zaglavnoy'],
  ['вера в хорошее.', '26-zam-podskazka-s-tochkoy'],
  ['zuversicht значит вера', '27-zam-podskazka-soderzhit-otvet'],
  ['разговорное слово', '28-zam-pometa-v-podskazke'],
];
for (const [hint, name] of HINTS) {
  await go('/words/new?word=Zuversicht');
  await run(`${FILL_GOOD} type(2, ${JSON.stringify(hint)}); await wait(1200);`);
  await shot(name);
}

// Сосед есть, но различает подсказка — это только замечание.
await go('/words/new?word=Schwierigkeit');
await run(`${FILL_GOOD} type(0, 'Schwierigkeit'); type(1, 'Понятие'); type(2, 'то, что надо одолеть'); await wait(2200);`);
await shot('29-zam-sosed-razlichaetsya');

console.log('\nФлоу');
await go('/words/new?word=Zuversicht');
await run(FILL_GOOD);
await shot('30-flow-gotovo-zelyonoe');

await run(`${HELPERS} press('Завести карточку'); await wait(3000);`);
await shot('31-flow-kartochka-zavedena');

await go('/words');
await run(`
  ${HELPERS}
  const s = document.querySelector('input[placeholder*="Поиск"]');
  setVal.call(s, 'Zuversicht');
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(2500);
`);
await shot('32-flow-v-slovare');

await go('/review');
await run(`${HELPERS} press('рождённые'); await wait(2000);`);
await shot('33-flow-na-pravkah');

await go('/words');
await run(`
  ${HELPERS}
  const s = document.querySelector('input[placeholder*="Поиск"]');
  setVal.call(s, 'Quatschwortxyz');
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(2500);
`);
await shot('34-flow-pustoy-poisk');

console.log('\nГотово. Снимки в', OUT);
ws.close();
chrome.kill();
process.exit(0);
