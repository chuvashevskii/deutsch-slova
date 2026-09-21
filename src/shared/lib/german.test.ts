import { describe, expect, it } from 'vitest';

import {
  canon,
  infinitiveSegments,
  isMissingForm,
  nounPluralSegments,
  nounSingularSegments,
  parseRektion,
  stressPosition,
  stripArticle,
  umlautShiftIndex,
} from './german';

const asText = (segments: Array<{ text: string }>): string => segments.map((part) => part.text).join('');
const marked = (segments: Array<{ text: string; mark: string | null }>, kind: string): string =>
  segments
    .filter((part) => part.mark === kind)
    .map((part) => part.text)
    .join('');

describe('canon', () => {
  it('приравнивает умляут и его раскрытие', () => {
    expect(canon('schön')).toBe(canon('schoen'));
    expect(canon('groß')).toBe(canon('gross'));
  });

  it('не ломает слова, где ue и ss не заменяют умляут', () => {
    expect(canon('neue')).toBe('neue');
    expect(canon('wissen')).toBe('wissen');
  });

  it('игнорирует регистр и пробелы по краям', () => {
    expect(canon('  Haben ')).toBe('haben');
  });
});

describe('stripArticle', () => {
  it('снимает артикль', () => {
    expect(stripArticle('die Zeitung')).toBe('Zeitung');
    expect(stripArticle('der Name')).toBe('Name');
  });

  it('оставляет слово без артикля как есть', () => {
    expect(stripArticle('kochen')).toBe('kochen');
  });
});

describe('isMissingForm', () => {
  it('распознаёт прочерк и пустоту', () => {
    expect(isMissingForm('—')).toBe(true);
    expect(isMissingForm('')).toBe(true);
    expect(isMissingForm(null)).toBe(true);
    expect(isMissingForm('habe')).toBe(false);
  });
});

describe('stressPosition', () => {
  it('считает гласные, пропуская артикль', () => {
    // die Zeitung: первая гласная группа — дифтонг ei
    expect(stressPosition('die Zeitung', '1')).toBe(5);
  });

  it('считает дифтонг одной гласной группой', () => {
    // kaufen: ударение на второй группе — e, потому что au это одна группа
    expect(stressPosition('kaufen', '2')).toBe(4);
  });

  it('поддерживает смещение внутри дифтонга', () => {
    // au: вторая буква группы
    expect(stressPosition('kaufen', '1.2')).toBe(2);
  });

  it('возвращает -1 без спецификации', () => {
    expect(stressPosition('kochen', null)).toBe(-1);
    expect(stressPosition('kochen', '')).toBe(-1);
  });
});

describe('umlautShiftIndex', () => {
  it('находит чередование a → ä', () => {
    expect(umlautShiftIndex('der Vater', 'die Väter')).toBe(5);
  });

  it('возвращает -1, когда чередования нет', () => {
    expect(umlautShiftIndex('die Zeitung', 'die Zeitungen')).toBe(-1);
  });
});

describe('nounSingularSegments', () => {
  it('помечает суффикс и ставит ударение', () => {
    const segments = nounSingularSegments('die Zeitung', 'ung', '1');
    // знак ударения встаёт на первую гласную дифтонга — как в шаблоне Anki
    expect(asText(segments)).toBe('die Zéitung');
    expect(marked(segments, 'suffix')).toBe('ung');
  });

  it('обходится без суффикса', () => {
    const segments = nounSingularSegments('die Milch', null, null);
    expect(asText(segments)).toBe('die Milch');
    expect(marked(segments, 'suffix')).toBe('');
  });
});

describe('nounPluralSegments', () => {
  it('помечает окончание множественного числа', () => {
    const segments = nounPluralSegments('die Zeitung', 'die Zeitungen', 'en', null);
    expect(marked(segments, 'ending')).toBe('en');
  });

  it('помечает и окончание, и умлаут', () => {
    const segments = nounPluralSegments('der Vater', 'die Väter', null, null);
    expect(marked(segments, 'umlaut')).toBe('ä');
    expect(asText(segments)).toBe('die Väter');
  });
});

describe('infinitiveSegments', () => {
  it('подсвечивает отделяемую приставку', () => {
    const segments = infinitiveSegments('anrufen', 'an', null);
    expect(marked(segments, 'prefix')).toBe('an');
    expect(asText(segments)).toBe('anrufen');
  });

  it('учитывает возвратное sich перед приставкой', () => {
    const segments = infinitiveSegments('sich anziehen', 'an', null);
    expect(marked(segments, 'prefix')).toBe('an');
  });

  it('не помечает ничего у глагола без приставки', () => {
    const segments = infinitiveSegments('kochen', null, null);
    expect(marked(segments, 'prefix')).toBe('');
  });
});

describe('parseRektion', () => {
  it('отдельно помечает «без объекта»', () => {
    expect(parseRektion('ohne Objekt')).toEqual([{ text: 'ohne Objekt', kind: 'noObject' }]);
  });

  it('раскрывает сокращения и красит падеж', () => {
    const tokens = parseRektion('etw. (Akk.)');
    expect(tokens.map((token) => token.text).join('')).toBe('etwas (Akk.)');
    expect(tokens.find((token) => token.kind === 'akkusativ')?.text).toBe('(Akk.)');
  });

  it('помечает предлог и дательный падеж', () => {
    const tokens = parseRektion('mit jmdm. (Dat.)');
    expect(tokens.map((token) => token.text).join('')).toBe('mit jemandem (Dat.)');
    expect(tokens.find((token) => token.kind === 'preposition')?.text).toBe('mit');
    expect(tokens.find((token) => token.kind === 'dativ')?.text).toBe('(Dat.)');
  });

  it('красит «unter» — управление leiden unter etw.', () => {
    const tokens = parseRektion('unter etw. (Dat.)');
    expect(tokens.find((token) => token.kind === 'preposition')?.text).toBe('unter');
    expect(tokens.find((token) => token.kind === 'dativ')?.text).toBe('(Dat.)');
  });

  it('не принимает «ohne Objekt» за предлог', () => {
    expect(parseRektion('ohne Objekt')).toEqual([{ text: 'ohne Objekt', kind: 'noObject' }]);
  });

  it('красит «ohne» в настоящем управлении — auskommen ohne etw.', () => {
    const tokens = parseRektion('ohne etw. (Akk.)');
    expect(tokens.find((token) => token.kind === 'preposition')?.text).toBe('ohne');
    expect(tokens.find((token) => token.kind === 'akkusativ')?.text).toBe('(Akk.)');
  });

  it('разбирает двойное управление', () => {
    const tokens = parseRektion('jmdm. (Dat.) + etw. (Akk.)');
    const kinds = tokens.map((token) => token.kind);
    expect(kinds).toContain('dativ');
    expect(kinds).toContain('akkusativ');
  });
});
