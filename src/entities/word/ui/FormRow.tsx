import type { ReactNode } from 'react';

import { AudioButton } from './AudioButton';

interface FormRowProps {
  label: string;
  children: ReactNode;
  wrongAnswer?: string | null;
  /** Путь к озвучке этой формы в бакете audio. */
  audio?: string | null;
}

/** Строка «подпись — форма» на обороте карточки. */
export const FormRow = ({ label, children, wrongAnswer, audio }: FormRowProps) => (
  <div className="flex items-baseline gap-3 border-b border-line-soft py-2 last:border-b-0">
    <span className="w-[86px] shrink-0 text-right font-mono text-[10.5px] tracking-wide text-faint">
      {label}
    </span>
    <span className="min-w-0 flex-1 text-xl leading-snug">
      {children}
      {wrongAnswer ? (
        <span className="ml-2 font-sans text-xs font-normal text-bad line-through">{wrongAnswer}</span>
      ) : null}
    </span>
    <AudioButton path={audio ?? null} label={label} />
  </div>
);
