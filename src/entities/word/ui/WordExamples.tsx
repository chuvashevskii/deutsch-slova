interface WordExamplesProps {
  examplesDe: string[];
  examplesRu: string[];
}

export const WordExamples = ({ examplesDe, examplesRu }: WordExamplesProps) => {
  if (!examplesDe.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {examplesDe.map((sentence, index) => (
        <div key={sentence} className="border-l-2 border-line pl-3">
          <div className="font-serif text-[15.5px] leading-snug">{sentence}</div>
          {examplesRu[index] ? (
            <div className="mt-0.5 text-[13px] text-muted">{examplesRu[index]}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
