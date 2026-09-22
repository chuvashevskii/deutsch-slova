import { cn } from '@/shared/lib/cn';

const GENUS_NAME: Record<string, string> = { m: 'мужской', f: 'женский', n: 'средний' };
const GENUS_CLASS: Record<string, string> = {
  m: 'text-masculine',
  f: 'text-feminine',
  n: 'text-neuter',
};

/** Значок и фон несут статус правила, поэтому словами он не повторяется. */
const STATUS = {
  high: { icon: '✓', tone: 'bg-ok/10 text-ok' },
  mixed: { icon: '⚠', tone: 'bg-gold/15 text-preposition' },
  exception: { icon: '✗', tone: 'bg-bad/10 text-bad' },
  notsuffix: { icon: '✗', tone: 'bg-bad/10 text-bad' },
  none: { icon: '—', tone: 'bg-surface-2 text-muted' },
} as const;

const HINT: Record<string, string> = {
  high: 'Надёжное правило',
  mixed: 'Правило с исключениями',
  exception: 'Слово нарушает правило',
  notsuffix: 'Окончание здесь не суффикс',
};

const Genus = ({ genus }: { genus: string }) => (
  <b className={GENUS_CLASS[genus]}>{GENUS_NAME[genus]}</b>
);

interface RuleBadgeProps {
  status: string;
  label: string;
  pos: string;
  /** Род, который предсказывает правило: у исключений он не совпадает с настоящим. */
  ruleGenus?: string | null;
  /** Настоящий род слова — нужен, чтобы показать, чем исключение отличается. */
  genus?: string | null;
}

/**
 * Плашка правила образования формы — из поля RegelStatus колоды Anki.
 *
 * Правила здесь двух семейств, и других не бывает: **род** существительного
 * по суффиксу и **степени сравнения** у прилагательного или наречия.
 * К местоимению, частице, предлогу и числительному не относится ни то,
 * ни другое — плашка им не показывается вовсе.
 *
 * Раньше показывалась: у местоимения `alle` стояло «род правилом
 * не выводится · Степеней не образует». Обе половины сообщали
 * об отсутствии того, чего никто и не ждал: рода по правилу у местоимения
 * не бывает, сравнивать его не с чем. Выглядело это как знание о слове,
 * а было сообщением о пустоте — та же болезнь, что «сбой загрузки
 * выглядит как пустые данные», только на обороте карточки.
 *
 * У существительного отсутствие правила — наоборот, подсказка: род
 * придётся запомнить. Поэтому им плашка показывается всегда.
 */
export const RuleBadge = ({ status, label, pos, ruleGenus, genus }: RuleBadgeProps) => {
  const aboutGenus = pos === 'noun';
  const aboutDegrees = pos === 'adj' || pos === 'adverb';
  if (!aboutGenus && !aboutDegrees) return null;
  // Прилагательному без подписи сказать нечего: значок один, без слов
  // он не читается. Существительному есть — «род придётся запомнить».
  if (aboutDegrees && !label) return null;

  const meta = STATUS[status as keyof typeof STATUS] ?? STATUS.none;
  const hint =
    HINT[status] ??
    (aboutGenus
      ? 'Правила, которое подсказало бы род, для этого слова нет — запоминается'
      : 'Степеней сравнения у этого слова нет');

  const body = () => {
    if (!aboutGenus) return null;
    if (status === 'exception' && ruleGenus && genus && ruleGenus !== genus) {
      return (
        <>
          <Genus genus={ruleGenus} />, а здесь <Genus genus={genus} />
        </>
      );
    }
    if (status === 'notsuffix') return 'не суффикс';
    if (ruleGenus) {
      return (
        <>
          <Genus genus={ruleGenus} /> род
        </>
      );
    }
    return status === 'none' ? 'род правилом не выводится' : null;
  };

  const content = body();

  return (
    <div title={hint} className={cn('mt-3 rounded-lg px-3 py-2 text-[12.5px]', meta.tone)}>
      <span className="mr-1.5">{meta.icon}</span>
      {content}
      {label ? (
        <>
          {content ? ' · ' : null}
          <b>{label}</b>
        </>
      ) : null}
    </div>
  );
};
