import { cn } from '@/shared/lib/cn';

const GENUS_NAME: Record<string, string> = { m: 'мужской', f: 'женский', n: 'средний' };
const GENUS_CLASS: Record<string, string> = {
  m: 'text-masculine',
  f: 'text-feminine',
  n: 'text-neuter',
};

/** Значок и фон несут статус правила, поэтому словами он не повторяется. */
const STATUS = {
  high: { icon: '✓', tone: 'bg-ok/10 text-ok', hint: 'Надёжное правило' },
  mixed: { icon: '⚠', tone: 'bg-gold/15 text-preposition', hint: 'Правило с исключениями' },
  exception: { icon: '✗', tone: 'bg-bad/10 text-bad', hint: 'Слово нарушает правило' },
  notsuffix: { icon: '✗', tone: 'bg-bad/10 text-bad', hint: 'Окончание здесь не суффикс' },
  none: {
    icon: '—',
    tone: 'bg-surface-2 text-muted',
    hint: 'Правила, которое подсказало бы род, для этого слова нет — запоминается',
  },
} as const;

const Genus = ({ genus }: { genus: string }) => (
  <b className={GENUS_CLASS[genus]}>{GENUS_NAME[genus]}</b>
);

interface RuleBadgeProps {
  status: string;
  label: string;
  /** Правила здесь только про род существительного: остальным плашка не нужна. */
  pos: string;
  /** Род, который предсказывает правило: у исключений он не совпадает с настоящим. */
  ruleGenus?: string | null;
  /** Настоящий род слова — нужен, чтобы показать, чем исключение отличается. */
  genus?: string | null;
}

/**
 * Плашка правила образования формы — из поля RegelStatus колоды Anki.
 *
 * Показывает то, чего значок сказать не может: какой род предсказывает
 * правило и как оно называется. У Monat правило «дни, месяцы, времена
 * года» означает мужской род, и без этого подсказка наполовину пуста.
 * Сам статус читается по значку и фону, словами он не дублируется.
 */
export const RuleBadge = ({ status, label, pos, ruleGenus, genus }: RuleBadgeProps) => {
  // INFO: у глаголов, наречий и местоимений правил про род не бывает, и плашка
  // «правила нет» на них — шум. У существительного же её отсутствие само
  // по себе подсказка: род придётся запомнить.
  if (!label && pos !== 'noun') return null;

  const meta = STATUS[status as keyof typeof STATUS] ?? STATUS.none;

  const body = () => {
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
    <div
      title={meta.hint}
      className={cn('mt-3 rounded-lg px-3 py-2 text-[12.5px]', meta.tone)}
    >
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
