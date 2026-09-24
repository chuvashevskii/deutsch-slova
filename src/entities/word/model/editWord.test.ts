import { describe, expect, it } from 'vitest';

import { draftFromWord, editFindings, editPatch, isOwnCard, kindOfWord } from './editWord';
import type { Word } from './types';

/** Карточка из базы: только то, что читает правка, остальное умолчаниями. */
const word = (over: Partial<Word> = {}): Word =>
  ({
    id: 'my-0001',
    head: 'Zuversicht',
    pos: 'noun',
    wortart: null,
    translation: 'Уверенность в хорошем',
    register: 'neutral · нейтральный',
    definition: '',
    genus: 'f',
    singular: 'die Zuversicht',
    plural: null,
    komparativ: null,
    superlativ: null,
    rektion: [],
    form_ich: null,
    form_du: null,
    form_er: null,
    form_wir: null,
    form_ihr: null,
    separable_prefix: null,
    examples_de: ['Ihre Zuversicht steckt alle an.', 'Er hat die Zuversicht verloren.'],
    examples_ru: ['Её уверенность передаётся всем.', 'Он потерял уверенность.'],
    ...over,
  }) as Word;

describe('черновик из карточки', () => {
  it('переносит правимые поля', () => {
    const d = draftFromWord(word());
    expect(d.translation).toBe('Уверенность в хорошем');
    expect(d.register).toBe('neutral · нейтральный');
    expect(d.examplesDe[1]).toBe('Er hat die Zuversicht verloren.');
  });

  // Без них проверки примеров молчали бы: «управление заявлено, а предлога
  // в примерах нет» смотрит на rektion, а не на то, что правят.
  it('переносит и неправимые — проверкам они нужны', () => {
    const d = draftFromWord(word({ pos: 'verb', rektion: ['an etw. (Dat.)'], separable_prefix: 'auf' }));
    expect(d.rektion).toEqual(['an etw. (Dat.)']);
    expect(d.separable).toBe(true);
  });

  it('карточка с одним примером не роняет пару', () => {
    const d = draftFromWord(word({ examples_de: ['Nur eins.'], examples_ru: ['Только один.'] }));
    expect(d.examplesDe).toEqual(['Nur eins.', '']);
  });

  it('часть речи узнаётся по паре pos и wortart', () => {
    expect(kindOfWord({ pos: 'adj', wortart: 'прилагательное и наречие' }).value).toBe('adj-adv');
    expect(kindOfWord({ pos: 'adj', wortart: null }).value).toBe('adj');
    expect(kindOfWord({ pos: 'noun', wortart: null }).value).toBe('noun');
  });
});

describe('находки экрана правки', () => {
  const findings = (w: Word) => editFindings(draftFromWord(w), []).map((f) => f.text);

  it('чистая карточка замечаний не даёт', () => {
    expect(findings(word())).toEqual([]);
  });

  it('видит то, что правит: подсказку', () => {
    expect(findings(word({ definition: 'Вера в хорошее' })).some((t) => t.includes('с заглавной'))).toBe(
      true,
    );
  });

  it('видит примеры', () => {
    expect(
      findings(word({ examples_de: ['Eins.'], examples_ru: ['Один.'] })).some((t) =>
        t.includes('Примеров 1 из двух'),
      ),
    ).toBe(true);
  });

  // Суть отбора: карточка из Anki может нарушать что-то в роде или
  // формах, и запирать из-за этого правку перевода нельзя.
  it('не показывает то, чего не правит: род', () => {
    expect(findings(word({ genus: '' })).some((t) => t.includes('род'))).toBe(false);
  });

  it('не показывает то, чего не правит: приставку', () => {
    const verb = word({
      pos: 'verb',
      head: 'bekommen',
      separable_prefix: 'auf',
      examples_de: ['Er bekommt ein Buch.', 'Sie bekommt Post.'],
      examples_ru: ['Он получает книгу.', 'Она получает почту.'],
    });
    expect(findings(verb).some((t) => t.includes('не начинается'))).toBe(false);
  });
});

describe('что уходит в базу', () => {
  it('без изменений — пусто', () => {
    const w = word();
    expect(editPatch(w, draftFromWord(w))).toEqual({});
  });

  it('только изменившееся', () => {
    const w = word();
    const d = { ...draftFromWord(w), translation: 'Другое' };
    expect(editPatch(w, d)).toEqual({ translation: 'Другое' });
  });

  it('пробелы по краям не считаются изменением', () => {
    const w = word();
    const d = { ...draftFromWord(w), translation: '  Уверенность в хорошем  ' };
    expect(editPatch(w, d)).toEqual({});
  });

  it('примеры уходят массивом без пустых', () => {
    const w = word();
    const d = { ...draftFromWord(w), examplesDe: ['Eins.', ''] as [string, string] };
    expect(editPatch(w, d)).toEqual({ examples_de: ['Eins.'] });
  });

  it('подсказку можно стереть', () => {
    const w = word({ definition: 'вера в хорошее' });
    const d = { ...draftFromWord(w), definition: '' };
    expect(editPatch(w, d)).toEqual({ definition: '' });
  });
});

describe('что можно удалить', () => {
  it.each([
    ['my-0001', true],
    ['my-9999', true],
    ['list-0042', false],
    ['1234', false],
    ['my-0001_b', false],
  ])('%s → %s', (id, own) => {
    expect(isOwnCard(id)).toBe(own);
  });
});
