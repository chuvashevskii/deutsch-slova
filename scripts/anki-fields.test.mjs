import { describe, expect, it } from 'vitest';

import { clean, noteToWord, soundFile, stripArticle, toLines } from './anki-fields.mjs';

const note = (modelName, fields) => ({
  noteId: 123,
  modelName,
  fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { value: v }])),
});

describe('очистка полей Anki', () => {
  it('выбрасывает ссылку на звук и разметку', () => {
    expect(clean('kriegen [sound:tts_de_kriegen.mp3]')).toBe('kriegen');
    expect(clean('первое<br>второе')).toBe('первое\nвторое');
    expect(clean('<b>жирное</b>&nbsp;слово')).toBe('жирное слово');
  });

  it('достаёт имя звукового файла, но только первое', () => {
    expect(soundFile('[sound:a.mp3] и [sound:b.mp3]')).toBe('a.mp3');
    expect(soundFile('')).toBeNull();
  });

  it('разбирает многострочное поле в массив без пустых строк', () => {
    expect(toLines('Ich kriege. [sound:x.mp3]<br><br>Du kriegst.')).toEqual(['Ich kriege.', 'Du kriegst.']);
  });

  it('срезает артикль, не трогая слово', () => {
    expect(stripArticle('die Zeitung')).toBe('Zeitung');
    expect(stripArticle('das Gehalt')).toBe('Gehalt');
    // «Die» внутри слова не артикль
    expect(stripArticle('Dienstag')).toBe('Dienstag');
  });
});

describe('существительное', () => {
  const zeitung = noteToWord(note('Существительное на немецком', {
    Übersetzung: 'Газета', Singular: 'die Zeitung', Plural: 'die Zeitungen', Genus: 'f',
    Suffix: 'ung', PluralEndung: 'en', RegelStatus: 'high', RegelLabel: '-ung',
    IPA: '/ˈtsaɪ̯tʊŋ/', AusspracheRU: 'ЦАЙтун', BetonungSg: '1', BetonungPl: '',
    AudioSg: '[sound:sg.mp3]', AudioPl: '[sound:pl.mp3]',
    BeispieleDE: 'Ich lese die Zeitung. [sound:e.mp3]', BeispieleRU: 'Я читаю газету.',
  }));

  it('заголовок без артикля, формы с артиклем', () => {
    expect(zeitung.head).toBe('Zeitung');
    expect(zeitung.singular).toBe('die Zeitung');
    expect(zeitung.plural).toBe('die Zeitungen');
  });

  it('пустое ударение множественного — это null, а не пустая строка', () => {
    expect(zeitung.stress_plural).toBeNull();
    expect(zeitung.stress_singular).toBe('1');
  });

  it('словарная форма озвучена звуком единственного числа', () => {
    expect(zeitung.audio).toEqual({ audio_head: 'sg.mp3', audio_plural: 'pl.mp3' });
  });

  it('прочерк в форме означает, что формы нет', () => {
    const leute = noteToWord(note('Существительное на немецком', {
      Übersetzung: 'Люди', Singular: '—', Plural: 'die Leute', Genus: '',
    }));
    expect(leute.singular).toBeNull();
    expect(leute.head).toBe('Leute');
    expect(leute.genus).toBeNull();
  });
});

describe('глагол', () => {
  const kriegen = noteToWord(note('Глагол на немецком', {
    Infinitiv: 'kriegen', Übersetzung: 'Получать', Ich: 'kriege', Du: 'kriegst',
    ErSieEs: 'kriegt', WirSieSie: 'kriegen', Ihr: 'kriegt',
    Rektion: 'etw. (Akk.)<br>etw. (Akk.) + von jmdm. (Dat.)',
    Register: 'umgangssprachlich · разговорный', Präfix: '', BetonungInf: '1',
    AudioInf: '[sound:inf.mp3]', AudioIch: '[sound:ich.mp3]',
  }));

  it('пять форм и управление массивом', () => {
    expect(kriegen.form_ich).toBe('kriege');
    expect(kriegen.rektion).toEqual(['etw. (Akk.)', 'etw. (Akk.) + von jmdm. (Dat.)']);
  });

  it('пустая приставка — null, недостающий звук — null', () => {
    expect(kriegen.separable_prefix).toBeNull();
    expect(kriegen.audio.audio_du).toBeNull();
    expect(kriegen.audio.audio_head).toBe('inf.mp3');
  });
});

describe('часть речи у прилагательных и наречий', () => {
  const posOf = (wortart) =>
    noteToWord(note('Прилагательное и наречие', { Wort: 'x', Übersetzung: 'x', Wortart: wortart })).pos;

  it('различает то, что в колоде лежит одним типом', () => {
    expect(posOf('прилагательное')).toBe('adj');
    expect(posOf('наречие')).toBe('adverb');
    expect(posOf('вопросительное местоимение')).toBe('pronoun');
    expect(posOf('количественное слово')).toBe('numeral');
    expect(posOf('предлог')).toBe('preposition');
  });

  it('незнакомое значение не роняет заливку, а считается прилагательным', () => {
    expect(posOf('нечто небывалое')).toBe('adj');
  });
});

describe('служебные слова', () => {
  const posOf = (answer) => noteToWord(note('Deutsch Typing v3', { answer, ru: 'x' })).pos;

  it('союзы и частицы разведены по списку', () => {
    expect(posOf('weil')).toBe('conjunction');
    expect(posOf('doch')).toBe('particle');
    expect(posOf('zweieinhalb Stunden')).toBe('numeral');
  });
});

describe('фразы и прочие типы', () => {
  it('не превращаются в слова', () => {
    expect(noteToWord(note('Deutsch Phrases v1', { phrase_de: 'Woher kommst du?' }))).toBeNull();
  });
});
