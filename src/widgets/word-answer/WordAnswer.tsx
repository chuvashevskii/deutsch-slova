import {
  FormRow,
  RektionChips,
  RuleBadge,
  SegmentedText,
  VERB_PERSONS,
  WordExamples,
  type Word,
} from '@/entities/word';
import type { FeedbackContext } from '@/entities/feedback';
import { FeedbackButton } from '@/features/feedback';
import {
  infinitiveSegments,
  isMissingForm,
  nounPluralSegments,
  nounSingularSegments,
  plainSegments,
  verbFormSegments,
} from '@/shared/lib/german';

export type WrongAnswers = Partial<Record<string, string>>;

interface WordAnswerProps {
  word: Word;
  /** Что человек ввёл неверно — показывается зачёркнутым рядом с правильной формой. */
  wrongAnswers?: WrongAnswers;
  answeredGenus?: 'm' | 'f' | 'n' | null;
  /** Что было введено и что ожидалось — уходит вместе с обращением. */
  feedbackContext?: FeedbackContext | null;
}

const GENUS_ARTICLE: Record<string, string> = { m: 'der', f: 'die', n: 'das' };

const MissingForm = ({ text }: { text: string }) => (
  <span className="font-sans text-[13px] font-normal italic text-faint">{text}</span>
);

/** Оборот карточки: формы с разбором, произношение, правило, управление, примеры. */
export const WordAnswer = ({
  word,
  wrongAnswers = {},
  answeredGenus,
  feedbackContext,
}: WordAnswerProps) => {
  const genusMistake =
    word.pos === 'noun' && answeredGenus !== undefined && answeredGenus !== word.genus;

  return (
    <div>
      {word.pos === 'noun' ? (
        <>
          {word.singular ? (
            <FormRow label="Singular" wrongAnswer={wrongAnswers.singular} audio={word.audio_head}>
              <SegmentedText
                segments={nounSingularSegments(word.singular, word.suffix, word.stress_singular)}
                genus={word.genus}
              />
            </FormRow>
          ) : (
            <FormRow label="Singular">
              <MissingForm text="kein Singular" />
            </FormRow>
          )}
          {word.plural ? (
            <FormRow label="Plural" wrongAnswer={wrongAnswers.plural} audio={word.audio_plural}>
              <SegmentedText
                segments={nounPluralSegments(
                  word.singular ?? '',
                  word.plural,
                  word.plural_ending,
                  word.stress_plural,
                )}
              />
            </FormRow>
          ) : (
            <FormRow label="Plural">
              <MissingForm text="kein Plural" />
            </FormRow>
          )}
        </>
      ) : null}

      {word.pos === 'verb' ? (
        <>
          <FormRow label="Infinitiv" audio={word.audio_head}>
            <SegmentedText
              segments={infinitiveSegments(word.head, word.separable_prefix, word.stress_infinitive)}
              splitPrefix
            />
          </FormRow>
          {VERB_PERSONS.map((person) => {
            const value = word[person.key] as string | null;
            if (!value) return null;
            if (isMissingForm(value)) {
              return (
                <FormRow key={person.key} label={person.label}>
                  <MissingForm text="нет формы" />
                </FormRow>
              );
            }
            return (
              <FormRow
                key={person.key}
                label={person.label}
                wrongAnswer={wrongAnswers[person.key]}
                audio={word[person.audio] as string | null}
              >
                <SegmentedText segments={verbFormSegments(value, word.separable_prefix)} />
              </FormRow>
            );
          })}
        </>
      ) : null}

      {/* Всё, что не существительное и не глагол: прилагательные, наречия,
          местоимения, союзы, частицы. Ветка сделана запасной, а не «для
          прилагательных»: иначе у частицы карточка осталась бы без слова. */}
      {word.pos !== 'noun' && word.pos !== 'verb' ? (
        <>
          <FormRow label="Wort" wrongAnswer={wrongAnswers.head} audio={word.audio_head}>
            <SegmentedText segments={plainSegments(word.head, word.stress_word)} />
          </FormRow>
          {word.komparativ ? (
            <FormRow label="Komparativ" audio={word.audio_comparative}>
              <SegmentedText segments={plainSegments(word.komparativ, null)} />
            </FormRow>
          ) : null}
          {word.superlativ ? (
            <FormRow label="Superlativ" audio={word.audio_superlative}>
              <SegmentedText segments={plainSegments(word.superlativ, null)} />
            </FormRow>
          ) : null}
        </>
      ) : null}

      {word.ipa || word.pronunciation_ru ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-3 border-t border-line-soft pt-3">
          {word.ipa ? <span className="font-ipa text-[15px] text-muted">{word.ipa}</span> : null}
          {word.pronunciation_ru ? (
            <span className="text-[12.5px] font-semibold tracking-wide text-faint">
              {word.pronunciation_ru}
            </span>
          ) : null}
        </div>
      ) : null}

      {genusMistake ? (
        <div className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] text-bad">
          Род: вы ответили <b>{answeredGenus ? GENUS_ARTICLE[answeredGenus] : '—'}</b>
        </div>
      ) : null}

      <RuleBadge
        status={word.rule_status}
        label={word.rule_label}
        pos={word.pos}
        ruleGenus={word.rule_genus}
        genus={word.genus}
      />
      <RektionChips rektion={word.rektion} />
      <WordExamples examplesDe={word.examples_de} examplesRu={word.examples_ru} />
      <FeedbackButton word={word} context={feedbackContext} />
    </div>
  );
};
