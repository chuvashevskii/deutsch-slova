import { parseRektion, type RektionTokenKind } from '@/shared/lib/german';

const TOKEN_CLASS: Record<RektionTokenKind, string> = {
  text: '',
  akkusativ: 'font-bold text-akkusativ',
  dativ: 'font-bold text-dativ',
  genitiv: 'font-bold text-genitiv',
  preposition: 'font-bold text-preposition',
  noObject: 'italic text-faint',
};

/** Управление глагола: падежи и предлоги подсвечены, сокращения раскрыты. */
export const RektionChips = ({ rektion }: { rektion: string[] }) => {
  if (!rektion.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {rektion.map((line) => (
        <span
          key={line}
          className="max-w-full rounded-full border border-line bg-surface-2 px-3 py-1 font-serif text-[13.5px]"
        >
          {parseRektion(line).map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
};
