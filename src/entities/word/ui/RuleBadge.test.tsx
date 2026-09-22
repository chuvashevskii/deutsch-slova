import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RuleBadge } from './RuleBadge';

/**
 * Плашка правила говорит о двух вещах и больше ни о чём: род
 * существительного и степени сравнения. У местоимения `alle` она
 * сообщала «род правилом не выводится · Степеней не образует» — обе
 * половины про отсутствие того, чего у местоимения не бывает.
 */
describe('плашка правила', () => {
  it('местоимению не показывается вовсе', () => {
    const { container } = render(
      <RuleBadge status="none" label="Степеней не образует" pos="pronoun" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('частице, предлогу и числительному тоже', () => {
    for (const pos of ['particle', 'preposition', 'numeral', 'conjunction', 'verb']) {
      const { container } = render(
        <RuleBadge status="none" label="Степеней не образует" pos={pos} />,
      );
      expect(container, pos).toBeEmptyDOMElement();
    }
  });

  it('существительному без правила говорит, что род придётся запомнить', () => {
    render(<RuleBadge status="none" label="" pos="noun" />);
    expect(screen.getByText(/род правилом не выводится/)).toBeTruthy();
  });

  it('существительному с правилом называет предсказанный род', () => {
    render(<RuleBadge status="mixed" label="-e" pos="noun" ruleGenus="f" genus="f" />);
    expect(screen.getByText('женский')).toBeTruthy();
    expect(screen.getByText('-e')).toBeTruthy();
  });

  it('прилагательному показывает только степени, без разговоров о роде', () => {
    render(<RuleBadge status="none" label="Степеней не образует" pos="adj" />);
    expect(screen.getByText('Степеней не образует')).toBeTruthy();
    expect(screen.queryByText(/род правилом не выводится/)).toBeNull();
  });

  it('наречию без подписи показывать нечего', () => {
    const { container } = render(<RuleBadge status="none" label="" pos="adverb" />);
    expect(container).toBeEmptyDOMElement();
  });
});
