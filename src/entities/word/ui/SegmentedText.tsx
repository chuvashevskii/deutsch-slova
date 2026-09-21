import { cn } from '@/shared/lib/cn';
import type { Segment } from '@/shared/lib/german';

const MARK_CLASS: Record<string, string> = {
  suffix: 'mark-suffix',
  ending: 'mark-ending',
  umlaut: 'mark-umlaut',
  prefix: 'mark-prefix',
};

const GENUS_CLASS: Record<string, string> = {
  m: 'text-masculine',
  f: 'text-feminine',
  n: 'text-neuter',
};

interface SegmentedTextProps {
  segments: Segment[];
  genus?: string | null;
  className?: string;
  /** В инфинитиве приставка ещё слитна — отделяем её чертой: zu│machen. */
  splitPrefix?: boolean;
}

/** Рисует словоформу с пометками морфологии и цветом рода. */
export const SegmentedText = ({ segments, genus, className, splitPrefix }: SegmentedTextProps) => (
  <span className={cn('font-serif font-semibold', genus ? GENUS_CLASS[genus] : undefined, className)}>
    {segments.map((segment, index) => (
      <span
        key={index}
        className={cn(
          segment.mark ? MARK_CLASS[segment.mark] : undefined,
          segment.mark === 'prefix' && splitPrefix && 'mark-prefix-split',
        )}
      >
        {segment.text}
      </span>
    ))}
  </span>
);
